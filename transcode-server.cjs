#!/usr/bin/env node

/**
 * HandBrake Transcode Server
 * 
 * This server POLLS for transcode jobs from Supabase and executes HandBrakeCLI.
 * No incoming HTTP needed - works behind firewalls/NAT.
 * 
 * Requirements:
 * - HandBrakeCLI installed (sudo apt install handbrake-cli)
 * - Access to media files (NAS mount)
 * 
 * Setup:
 * 1. Install HandBrakeCLI: sudo apt install handbrake-cli
 * 2. Configure settings in server_settings table
 * 3. Run: node transcode-server.cjs
 * 4. Or use systemd service (see setup-transcode-service.sh)
 */

const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.TRANSCODE_PORT || 3003;
const HOST = process.env.TRANSCODE_HOST || '0.0.0.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 10000; // 10 seconds

// Active jobs tracker
const activeJobs = new Map();
let isPolling = false;
let mediaBasePath = process.env.MEDIA_BASE_PATH || '/mnt/truenas';
let jellyfinServerUrl = '';
let jellyfinApiKey = '';

console.log('🎬 HandBrake Transcode Server starting...');
console.log(`📡 Supabase URL: ${SUPABASE_URL ? 'Configured' : 'Not configured'}`);
console.log(`📂 Media base path: ${mediaBasePath}`);

/**
 * Fetch settings from Supabase
 */
async function fetchSettings() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/server_settings?select=setting_key,setting_value`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`
      }
    });
    
    if (res.ok) {
      const settings = await res.json();
      for (const s of settings) {
        if (s.setting_key === 'media_base_path') mediaBasePath = s.setting_value;
        if (s.setting_key === 'jellyfin_server_url') jellyfinServerUrl = s.setting_value;
        if (s.setting_key === 'jellyfin_api_key') jellyfinApiKey = s.setting_value;
      }
      console.log(`📂 Media base path updated: ${mediaBasePath}`);
    }
  } catch (err) {
    console.error('Failed to fetch settings:', err.message);
  }
}

/**
 * Update job status directly in Supabase
 */
async function updateJobStatus(jobId, status, progress, logs = [], error = null) {
  if (!SUPABASE_URL || !jobId) return;

  try {
    const body = {
      status,
      progress,
      logs,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'processing' && !body.started_at) {
      body.started_at = new Date().toISOString();
    }
    if (status === 'completed' || status === 'failed') {
      body.completed_at = new Date().toISOString();
    }
    if (error) {
      body.error = error;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/transcode_jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error('Failed to update job status:', await res.text());
    }

    // If completed successfully, update media_compatibility
    if (status === 'completed') {
      await markMediaCompatible(jobId);
    }
  } catch (err) {
    console.error('Failed to update job status:', err.message);
  }
}

/**
 * Mark media as compatible after successful transcode
 */
async function markMediaCompatible(jobId) {
  try {
    // Get the jellyfin_item_id from the job
    const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/transcode_jobs?id=eq.${jobId}&select=jellyfin_item_id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`
      }
    });
    
    if (!jobRes.ok) return;
    const jobs = await jobRes.json();
    if (!jobs.length) return;
    
    const jellyfinItemId = jobs[0].jellyfin_item_id;
    
    // Update media_compatibility
    await fetch(`${SUPABASE_URL}/rest/v1/media_compatibility?jellyfin_item_id=eq.${jellyfinItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'compatible',
        resolved: true,
        resolved_at: new Date().toISOString()
      })
    });
    
    console.log(`✅ Marked media ${jellyfinItemId} as compatible`);
  } catch (err) {
    console.error('Failed to mark media compatible:', err.message);
  }
}

/**
 * Get file path from Jellyfin
 */
async function getFilePathFromJellyfin(jellyfinItemId) {
  if (!jellyfinServerUrl || !jellyfinApiKey) {
    throw new Error('Jellyfin not configured');
  }

  const res = await fetch(`${jellyfinServerUrl}/Items/${jellyfinItemId}?api_key=${jellyfinApiKey}`);
  if (!res.ok) {
    throw new Error(`Jellyfin API error: ${res.status}`);
  }
  
  const item = await res.json();
  const jellyfinPath = item.Path;
  
  if (!jellyfinPath) {
    throw new Error('No file path in Jellyfin response');
  }
  
  // Convert Jellyfin path to local path
  // Jellyfin might show: /media/Movies/Film.mkv
  // We need: /mnt/truenas/Movies/Film.mkv
  
  // Try to extract the relative part after common prefixes
  const prefixesToStrip = ['/media', '/mnt/media', '/data/media', '/srv/media'];
  let relativePath = jellyfinPath;
  
  for (const prefix of prefixesToStrip) {
    if (jellyfinPath.startsWith(prefix)) {
      relativePath = jellyfinPath.substring(prefix.length);
      break;
    }
  }
  
  const localPath = path.join(mediaBasePath, relativePath);
  console.log(`📁 Jellyfin path: ${jellyfinPath}`);
  console.log(`📁 Local path: ${localPath}`);
  
  return localPath;
}

/**
 * Poll for pending jobs
 */
async function pollForJobs() {
  if (isPolling || activeJobs.size > 0) return; // Only one job at a time
  isPolling = true;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/transcode_jobs?status=eq.pending&order=created_at.asc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!res.ok) {
      console.error('Failed to fetch jobs:', await res.text());
      return;
    }

    const jobs = await res.json();
    
    if (jobs.length > 0) {
      const job = jobs[0];
      console.log(`\n🎬 Found pending job: ${job.id}`);
      console.log(`   Item: ${job.jellyfin_item_name}`);
      
      // Mark as processing immediately to prevent double-pickup
      await updateJobStatus(job.id, 'processing', 1, []);
      
      // Get file path from Jellyfin or use stored path
      let filePath = job.file_path;
      
      if (!filePath) {
        try {
          filePath = await getFilePathFromJellyfin(job.jellyfin_item_id);
          // Store the path for future reference
          await fetch(`${SUPABASE_URL}/rest/v1/transcode_jobs?id=eq.${job.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ file_path: filePath })
          });
        } catch (err) {
          console.error('Failed to get file path:', err.message);
          await updateJobStatus(job.id, 'failed', 0, [], `Failed to get file path: ${err.message}`);
          return;
        }
      }
      
      // Execute transcode
      executeTranscode(job.id, filePath, job.output_format || 'hevc', true);
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  } finally {
    isPolling = false;
  }
}

/**
 * Parse HandBrake progress output
 */
function parseProgress(output) {
  const match = output.match(/(\d+\.?\d*)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Get HandBrake preset for output format
 */
function getPreset(format) {
  switch (format) {
    case 'hevc':
    case 'h265':
      return {
        encoder: 'x265',
        preset: 'Fast 1080p30',
        extension: 'mkv',
        extraArgs: ['--encoder-preset', 'medium', '--quality', '22']
      };
    case 'h264':
      return {
        encoder: 'x264',
        preset: 'Fast 1080p30',
        extension: 'mp4',
        extraArgs: ['--encoder-preset', 'medium', '--quality', '20']
      };
    default:
      return {
        encoder: 'x265',
        preset: 'Fast 1080p30',
        extension: 'mkv',
        extraArgs: ['--encoder-preset', 'medium', '--quality', '22']
      };
  }
}

/**
 * Execute transcode job
 */
async function executeTranscode(jobId, inputPath, outputFormat, replaceOriginal = true) {
  const logs = [];
  const addLog = (msg, level = 'info') => {
    const entry = { timestamp: new Date().toISOString(), message: msg, level };
    logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${msg}`);
  };

  try {
    addLog(`Starting transcode job: ${jobId}`);
    addLog(`Input file: ${inputPath}`);
    
    // Check if file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const fileStats = fs.statSync(inputPath);
    addLog(`File size: ${(fileStats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);

    const preset = getPreset(outputFormat);
    const inputDir = path.dirname(inputPath);
    const inputName = path.basename(inputPath, path.extname(inputPath));
    const tempOutput = path.join(inputDir, `${inputName}_transcoded.${preset.extension}`);
    
    addLog(`Output format: ${outputFormat} (${preset.encoder})`);
    addLog(`Temp output: ${tempOutput}`);

    await updateJobStatus(jobId, 'processing', 5, logs);

    // Build HandBrakeCLI command
    const args = [
      '-i', inputPath,
      '-o', tempOutput,
      '-e', preset.encoder,
      ...preset.extraArgs,
      '--audio-lang-list', 'any',
      '--all-audio',
      '--subtitle', 'scan,1,2,3,4,5',
      '--native-language', 'nor'
    ];

    addLog(`Running: HandBrakeCLI ${args.join(' ')}`);
    await updateJobStatus(jobId, 'processing', 10, logs);

    // Spawn HandBrakeCLI
    const handbrake = spawn('HandBrakeCLI', args);
    activeJobs.set(jobId, handbrake);

    let lastProgress = 10;

    handbrake.stdout.on('data', (data) => {
      const output = data.toString();
      const progress = parseProgress(output);
      if (progress !== null && progress > lastProgress) {
        lastProgress = Math.min(progress * 0.8 + 10, 90);
        updateJobStatus(jobId, 'processing', Math.round(lastProgress), logs);
      }
    });

    handbrake.stderr.on('data', (data) => {
      const output = data.toString();
      const progress = parseProgress(output);
      if (progress !== null && progress > lastProgress) {
        lastProgress = Math.min(progress * 0.8 + 10, 90);
        updateJobStatus(jobId, 'processing', Math.round(lastProgress), logs);
      }
      if (output.includes('ERROR') || output.includes('error')) {
        addLog(output.trim(), 'error');
      }
    });

    // Wait for process to complete
    await new Promise((resolve, reject) => {
      handbrake.on('close', (code) => {
        activeJobs.delete(jobId);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`HandBrakeCLI exited with code ${code}`));
        }
      });
      handbrake.on('error', reject);
    });

    addLog('Transcoding complete, verifying output...', 'success');
    await updateJobStatus(jobId, 'processing', 92, logs);

    // Verify output file exists and has content
    if (!fs.existsSync(tempOutput)) {
      throw new Error('Output file was not created');
    }

    const outputStats = fs.statSync(tempOutput);
    if (outputStats.size < 1000) {
      throw new Error('Output file is too small, transcoding may have failed');
    }

    addLog(`Output file size: ${(outputStats.size / 1024 / 1024 / 1024).toFixed(2)} GB`, 'success');

    // Replace original if requested
    if (replaceOriginal) {
      addLog('Replacing original file...');
      await updateJobStatus(jobId, 'processing', 95, logs);
      
      const backupPath = `${inputPath}.original`;
      fs.renameSync(inputPath, backupPath);
      addLog(`Original backed up to: ${backupPath}`);
      
      // Move transcoded file to original location (with new extension)
      const finalPath = path.join(inputDir, `${inputName}.${preset.extension}`);
      fs.renameSync(tempOutput, finalPath);
      addLog(`Transcoded file moved to: ${finalPath}`, 'success');
      
      // Delete backup after successful move
      fs.unlinkSync(backupPath);
      addLog('Original file removed', 'success');
    }

    addLog('✅ Transcode job completed successfully!', 'success');
    await updateJobStatus(jobId, 'completed', 100, logs);

    return { success: true, logs };

  } catch (error) {
    addLog(`❌ Transcode failed: ${error.message}`, 'error');
    await updateJobStatus(jobId, 'failed', 0, logs, error.message);
    activeJobs.delete(jobId);
    return { success: false, error: error.message, logs };
  }
}

/**
 * Cancel active job
 */
function cancelJob(jobId) {
  const process = activeJobs.get(jobId);
  if (process) {
    process.kill('SIGTERM');
    activeJobs.delete(jobId);
    return true;
  }
  return false;
}

/**
 * HTTP Server (for health checks and manual control)
 */
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    exec('which HandBrakeCLI', (error) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'transcode-server',
        handbrakeAvailable: !error,
        activeJobs: activeJobs.size,
        mediaBasePath,
        polling: true
      }));
    });
    return;
  }

  // Status
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeJobs: Array.from(activeJobs.keys()),
      mediaBasePath,
      jellyfinConfigured: !!jellyfinServerUrl
    }));
    return;
  }

  // Cancel job
  if (req.url === '/cancel' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { jobId } = JSON.parse(body);
        const cancelled = cancelJob(jobId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: cancelled }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Initialize
async function init() {
  await fetchSettings();
  
  // Start polling for jobs
  console.log(`\n🔄 Starting job polling (every ${POLL_INTERVAL/1000}s)...`);
  setInterval(pollForJobs, POLL_INTERVAL);
  
  // Initial poll
  pollForJobs();
}

server.listen(PORT, HOST, () => {
  console.log(`✅ Transcode Server listening on http://${HOST}:${PORT}`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  init();
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  activeJobs.forEach((proc) => proc.kill('SIGTERM'));
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  activeJobs.forEach((proc) => proc.kill('SIGTERM'));
  server.close(() => process.exit(0));
});

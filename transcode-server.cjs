#!/usr/bin/env node

/**
 * HandBrake Transcode Server
 * 
 * This server POLLS for transcode jobs via Edge Function and executes HandBrakeCLI.
 * No service_role key needed - uses transcode_secret for authentication.
 */

const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const PORT = process.env.TRANSCODE_PORT || 3003;
const HOST = process.env.TRANSCODE_HOST || '0.0.0.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const TRANSCODE_SECRET = process.env.TRANSCODE_SECRET;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 10000;

// Active jobs tracker
const activeJobs = new Map();
let isPolling = false;
let mediaBasePath = process.env.MEDIA_BASE_PATH || '/mnt/truenas';

console.log('🎬 HandBrake Transcode Server starting...');
console.log(`📡 Supabase URL: ${SUPABASE_URL ? 'Configured' : 'Not configured'}`);
console.log(`🔑 Transcode Secret: ${TRANSCODE_SECRET ? 'Configured' : 'Not configured'}`);
console.log(`📂 Media base path: ${mediaBasePath}`);

/**
 * Simple HTTP request helper (works without fetch)
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Call the transcode-jobs edge function
 */
async function callEdgeFunction(action, data = {}) {
  if (!SUPABASE_URL || !TRANSCODE_SECRET) {
    throw new Error('Supabase URL or Transcode Secret not configured');
  }

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/transcode-jobs`;
  
  const res = await httpRequest(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-transcode-secret': TRANSCODE_SECRET
    },
    body: JSON.stringify({ action, ...data })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Edge function error: ${res.status} - ${errorText}`);
  }

  return res.json();
}

/**
 * Update job status via edge function
 */
async function updateJobStatus(jobId, status, progress, logs = [], error = null, filePath = null) {
  if (!jobId) return;

  try {
    await callEdgeFunction('update', {
      jobId,
      status,
      progress,
      logs,
      error,
      filePath
    });
  } catch (err) {
    console.error('Failed to update job status:', err.message);
  }
}

/**
 * Get file path from Jellyfin via edge function
 */
async function getFilePathFromJellyfin(jellyfinItemId) {
  try {
    const result = await callEdgeFunction('jellyfin', { itemId: jellyfinItemId });
    
    if (!result.path) {
      throw new Error('No file path in response');
    }
    
    const jellyfinPath = result.path;
    
    // Convert Jellyfin path to local path
    // Jellyfin might use different mount paths than the host system
    const prefixesToStrip = ['/NAS', '/media', '/mnt/media', '/data/media', '/srv/media', '/data'];
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
  } catch (err) {
    throw new Error(`Failed to get path from Jellyfin: ${err.message}`);
  }
}

/**
 * Poll for pending jobs via edge function
 */
async function pollForJobs() {
  if (isPolling || activeJobs.size > 0) return; // Only one job at a time
  isPolling = true;

  try {
    const result = await callEdgeFunction('poll');
    
    // Update settings from response
    if (result.settings) {
      if (result.settings.media_base_path) {
        mediaBasePath = result.settings.media_base_path;
      }
    }
    
    if (result.jobs && result.jobs.length > 0) {
      const job = result.jobs[0];
      console.log(`\n🎬 Found pending job: ${job.id}`);
      console.log(`   Item: ${job.jellyfin_item_name}`);
      
      // Mark as processing immediately
      await updateJobStatus(job.id, 'processing', 1, []);
      
      // Get file path
      let filePath = job.file_path;
      
      if (!filePath) {
        try {
          filePath = await getFilePathFromJellyfin(job.jellyfin_item_id);
          // Store the path
          await updateJobStatus(job.id, 'processing', 2, [], null, filePath);
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
        polling: true,
        supabaseConfigured: !!SUPABASE_URL,
        secretConfigured: !!TRANSCODE_SECRET
      }));
    });
    return;
  }

  // Status
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeJobs: Array.from(activeJobs.keys()),
      mediaBasePath
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

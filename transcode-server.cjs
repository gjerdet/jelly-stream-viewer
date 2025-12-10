#!/usr/bin/env node

/**
 * HandBrake Transcode Server
 * 
 * This server listens for transcode requests and executes HandBrakeCLI.
 * 
 * Requirements:
 * - HandBrakeCLI installed (sudo apt install handbrake-cli)
 * - Access to media files (NAS mount)
 * 
 * Setup:
 * 1. Install HandBrakeCLI: sudo apt install handbrake-cli
 * 2. Configure NAS mount path in server_settings
 * 3. Run: node transcode-server.cjs
 * 4. Or use systemd service (see setup-transcode-service.sh)
 */

const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.TRANSCODE_PORT || 3003;
const HOST = process.env.TRANSCODE_HOST || '0.0.0.0';
const TRANSCODE_SECRET = process.env.TRANSCODE_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Active jobs tracker
const activeJobs = new Map();

console.log('🎬 HandBrake Transcode Server starting...');
console.log(`🔐 Secret configured: ${TRANSCODE_SECRET ? 'Yes' : 'No'}`);

/**
 * Update job status in Supabase
 */
async function updateJobStatus(jobId, status, progress, logs = [], error = null) {
  if (!SUPABASE_URL || !jobId) return;

  try {
    const updateUrl = `${SUPABASE_URL}/functions/v1/transcode-status`;
    await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-transcode-secret': TRANSCODE_SECRET
      },
      body: JSON.stringify({ jobId, status, progress, logs, error })
    });
  } catch (err) {
    console.error('Failed to update job status:', err.message);
  }
}

/**
 * Parse HandBrake progress output
 */
function parseProgress(output) {
  // HandBrake outputs: Encoding: task 1 of 1, 45.23 % (120.45 fps, avg 118.32 fps, ETA 00h05m12s)
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

    await updateJobStatus(jobId, 'running', 5, logs);

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
    await updateJobStatus(jobId, 'running', 10, logs);

    // Spawn HandBrakeCLI
    const handbrake = spawn('HandBrakeCLI', args);
    activeJobs.set(jobId, handbrake);

    let lastProgress = 10;

    handbrake.stdout.on('data', (data) => {
      const output = data.toString();
      const progress = parseProgress(output);
      if (progress !== null && progress > lastProgress) {
        lastProgress = Math.min(progress * 0.8 + 10, 90); // Scale to 10-90%
        updateJobStatus(jobId, 'running', Math.round(lastProgress), logs);
      }
    });

    handbrake.stderr.on('data', (data) => {
      const output = data.toString();
      const progress = parseProgress(output);
      if (progress !== null && progress > lastProgress) {
        lastProgress = Math.min(progress * 0.8 + 10, 90);
        updateJobStatus(jobId, 'running', Math.round(lastProgress), logs);
      }
      // Log important stderr messages
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
    await updateJobStatus(jobId, 'running', 92, logs);

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
      await updateJobStatus(jobId, 'running', 95, logs);
      
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
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-transcode-secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    // Check if HandBrakeCLI is available
    exec('which HandBrakeCLI', (error) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'transcode-server',
        handbrakeAvailable: !error,
        activeJobs: activeJobs.size
      }));
    });
    return;
  }

  // Start transcode
  if (req.url === '/transcode' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      // Verify secret
      const secret = req.headers['x-transcode-secret'];
      if (TRANSCODE_SECRET && secret !== TRANSCODE_SECRET) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid secret' }));
        return;
      }

      try {
        const { jobId, filePath, outputFormat, replaceOriginal } = JSON.parse(body);
        
        if (!jobId || !filePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing jobId or filePath' }));
          return;
        }

        // Send immediate response
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'accepted', jobId }));

        // Execute in background
        executeTranscode(jobId, filePath, outputFormat || 'hevc', replaceOriginal !== false);

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
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

  // Status
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeJobs: Array.from(activeJobs.keys())
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Transcode Server listening on http://${HOST}:${PORT}`);
  console.log(`📍 Transcode endpoint: http://${HOST}:${PORT}/transcode`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
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

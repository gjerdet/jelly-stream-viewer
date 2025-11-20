#!/usr/bin/env node

/**
 * Simple Git Pull Server (CommonJS)
 * 
 * This server listens on localhost and executes git pull when triggered.
 * Much simpler than webhook setup - no domain or proxy needed!
 * 
 * Setup:
 * 1. Run: npm install (for this repo)
 * 2. Start: node git-pull-server.cjs
 * 3. Or use systemd service (see setup script)
 */

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.GIT_PULL_PORT || 3002;
const HOST = process.env.GIT_PULL_HOST || '0.0.0.0'; // Listen on all interfaces
const UPDATE_SECRET = process.env.UPDATE_SECRET || '';
const APP_DIR = process.env.APP_DIR || process.cwd();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client if credentials are available
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('✅ Supabase client initialized');
}

console.log('🚀 Git Pull Server starting...');
console.log(`📁 Working directory: ${APP_DIR}`);
console.log(`🔐 Secret configured: ${UPDATE_SECRET ? 'Yes' : 'No'}`);

/**
 * Verify HMAC signature
 */
function verifySignature(payload, signature, secret) {
  if (!secret) return true; // Skip verification if no secret set
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

/**
 * Update status in Supabase
 */
async function updateStatus(updateId, status, progress, currentStep, logs, error = null) {
  if (!supabase || !updateId) return;
  
  try {
    await supabase
      .from('update_status')
      .update({
        status,
        progress,
        current_step: currentStep,
        logs: JSON.stringify(logs),
        error,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && { completed_at: new Date().toISOString() })
      })
      .eq('id', updateId);
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

/**
 * Add log entry
 */
function addLog(logs, message, level = 'info') {
  logs.push({
    timestamp: new Date().toISOString(),
    message,
    level
  });
  console.log(`[${level.toUpperCase()}] ${message}`);
}

/**
 * Execute command and capture output
 */
function execCommand(command, cwd, logs) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        addLog(logs, `Command failed: ${command}`, 'error');
        addLog(logs, error.message, 'error');
        if (stderr) addLog(logs, stderr, 'error');
        reject(error);
      } else {
        if (stdout) addLog(logs, stdout, 'success');
        if (stderr) addLog(logs, stderr, 'warning');
        resolve(stdout);
      }
    });
  });
}

/**
 * Execute git pull and related commands with live updates
 */
async function executeGitPull(updateId) {
  const logs = [];
  
  try {
    addLog(logs, '🚀 Starting update process...', 'info');
    await updateStatus(updateId, 'running', 10, 'Stashing changes...', logs);

    // Step 1: Git stash
    addLog(logs, '📦 Stashing local changes...', 'info');
    await execCommand('git stash', APP_DIR, logs);
    await updateStatus(updateId, 'running', 25, 'Pulling latest changes...', logs);

    // Step 2: Git pull
    addLog(logs, '⬇️ Pulling latest changes from GitHub...', 'info');
    await execCommand('git pull origin main', APP_DIR, logs);
    await updateStatus(updateId, 'running', 40, 'Getting commit SHA...', logs);

    // Step 3: Get new commit SHA
    addLog(logs, '🔍 Getting current commit SHA...', 'info');
    const commitSha = await execCommand('git rev-parse HEAD', APP_DIR, logs);
    const trimmedSha = commitSha.trim();
    addLog(logs, `Current commit: ${trimmedSha.slice(0, 7)}`, 'success');
    
    // Step 4: Update installed_commit_sha in database
    if (supabase) {
      addLog(logs, '💾 Updating installed version in database...', 'info');
      await supabase
        .from('server_settings')
        .upsert({
          setting_key: 'installed_commit_sha',
          setting_value: trimmedSha,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      addLog(logs, '✅ Database updated with new version', 'success');
    }
    
    await updateStatus(updateId, 'running', 55, 'Installing dependencies...', logs);

    // Step 5: npm install
    addLog(logs, '📦 Installing dependencies...', 'info');
    await execCommand('npm install --production', APP_DIR, logs);
    await updateStatus(updateId, 'running', 75, 'Building application...', logs);

    // Step 6: npm build
    addLog(logs, '🔨 Building application...', 'info');
    await execCommand('npm run build', APP_DIR, logs);
    await updateStatus(updateId, 'running', 90, 'Finalizing...', logs);

    addLog(logs, '✅ Update completed successfully!', 'success');
    await updateStatus(updateId, 'completed', 100, 'Update completed', logs);

    return { success: true };
  } catch (error) {
    addLog(logs, `❌ Update failed: ${error.message}`, 'error');
    await updateStatus(updateId, 'failed', 0, 'Update failed', logs, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Update-Signature');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'git-pull-server',
      directory: APP_DIR,
    }));
    return;
  }

  // Git pull endpoint
  if (req.url === '/git-pull' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      // Verify signature if secret is set
      const signature = req.headers['x-update-signature'];

      if (UPDATE_SECRET && !verifySignature(body, signature, UPDATE_SECRET)) {
        console.error('❌ Invalid signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      // Parse request body to get updateId
      let updateId = null;
      try {
        const data = JSON.parse(body || '{}');
        updateId = data.updateId;
      } catch (err) {
        console.error('Failed to parse request body:', err);
      }

      console.log('🔄 Git pull triggered', updateId ? `(Update ID: ${updateId})` : '');

      // Send immediate response
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'accepted',
        message: 'Update started',
        updateId
      }));

      // Execute git pull in background
      executeGitPull(updateId).then((result) => {
        if (result.success) {
          console.log('✅ Update completed successfully');
        } else {
          console.error('❌ Update failed:', result.error);
        }
      }).catch((err) => {
        console.error('❌ Unexpected error during update:', err);
      });
    });

    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`✅ Git Pull Server listening on http://${HOST}:${PORT}`);
  console.log(`📍 Endpoint: http://${HOST}:${PORT}/git-pull`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  if (HOST === '0.0.0.0') {
    console.log(`🌐 Accessible from LAN: http://192.168.9.24:${PORT}/git-pull`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

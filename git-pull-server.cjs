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
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.GIT_PULL_PORT || 3002;
const HOST = process.env.GIT_PULL_HOST || '0.0.0.0'; // Listen on all interfaces
const UPDATE_SECRET = process.env.UPDATE_SECRET || '';
const APP_DIR = process.env.APP_DIR || process.cwd();
// Allow either SUPABASE_URL or VITE_SUPABASE_URL (common in .env on the server)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Find npm binary path (NVM or system)
 */
function findNpmPath() {
  // Allow explicit override via environment variable
  const envNpm = process.env.NPM_PATH;
  if (envNpm && fs.existsSync(envNpm)) {
    console.log(`📦 Using npm from NPM_PATH env: ${envNpm}`);
    return envNpm;
  }

  // Try to find npm in common locations
  const homeDir = os.homedir();

  // Prefer any installed Node 20.x from NVM dynamically
  const preferredNpmPaths = [];
  const nvmNodeDir = path.join(homeDir, '.nvm/versions/node');
  try {
    if (fs.existsSync(nvmNodeDir)) {
      const entries = fs.readdirSync(nvmNodeDir, { withFileTypes: true });
      const v20Dirs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('v20.'))
        .map((e) => e.name)
        .sort()
        .reverse(); // highest version first

      for (const dir of v20Dirs) {
        preferredNpmPaths.push(path.join(nvmNodeDir, dir, 'bin/npm'));
      }
    }
  } catch (err) {
    console.warn('⚠️  Failed to scan NVM directory for Node 20.x, falling back to defaults:', err.message);
  }

  const possiblePaths = [
    // Dynamically detected NVM Node 20.x paths
    ...preferredNpmPaths,
    // Fallback NVM paths (18.x and "current")
    path.join(homeDir, '.nvm/versions/node/v18.20.0/bin/npm'),
    path.join(homeDir, '.nvm/current/bin/npm'),
    // System paths
    '/usr/local/bin/npm',
    '/usr/bin/npm',
  ];

  for (const npmPath of possiblePaths) {
    if (fs.existsSync(npmPath)) {
      console.log(`📦 Found npm at: ${npmPath}`);
      return npmPath;
    }
  }

  // Try to find via which command
  try {
    const whichNpm = execSync('which npm', { encoding: 'utf8' }).trim();
    if (whichNpm && fs.existsSync(whichNpm)) {
      console.log(`📦 Found npm via which: ${whichNpm}`);
      return whichNpm;
    }
  } catch (err) {
    // which failed, continue
  }

  console.warn('⚠️  Could not find npm, will use "npm" and hope it\'s in PATH');
  return 'npm';
}

const NPM_PATH = findNpmPath();

function getNpmCommand() {
  // If we only have a generic npm, fall back to calling it directly
  if (!NPM_PATH || NPM_PATH === 'npm') {
    return 'npm';
  }

  // Try to resolve the real npm CLI JS file and pair it with the matching node binary
  const npmDir = path.dirname(NPM_PATH);
  const nodeFromNvm = path.join(npmDir, 'node');
  const npmCliFromNvm = path.join(
    npmDir.replace(/bin$/, 'lib/node_modules/npm/bin'),
    'npm-cli.js',
  );

  if (fs.existsSync(nodeFromNvm) && fs.existsSync(npmCliFromNvm)) {
    console.log(`🟢 Using node from: ${nodeFromNvm}`);
    console.log(`📦 Using npm CLI from: ${npmCliFromNvm}`);
    // Run: /path/to/node /path/to/npm-cli.js
    return `"${nodeFromNvm}" "${npmCliFromNvm}"`;
  }

  console.warn('⚠️  Could not find npm-cli.js next to npm, falling back to npm binary directly');
  return `"${NPM_PATH}"`;
}

const NPM_CMD = getNpmCommand();

// Log configuration status
if (SUPABASE_URL) {
  console.log('✅ Supabase URL configured - will use edge function for status updates');
} else {
  console.log('⚠️  No SUPABASE_URL - status updates will be skipped');
}

console.log('🚀 Git Pull Server starting...');
console.log(`📁 Working directory: ${APP_DIR}`);
console.log(`🔐 Signature verification: DISABLED (private network)`);

/**
 * Verify HMAC signature - DISABLED for private network deployment
 */
function verifySignature(payload, signature, secret) {
  // Signature verification disabled - server runs on private network only
  return true;
}

// Edge function URL for updating status (doesn't require service_role key)
const SUPABASE_EDGE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/update-status` : null;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Update status via Edge Function (no service_role key needed)
 */
async function updateStatus(updateId, status, progress, currentStep, logs, error = null) {
  if (!SUPABASE_EDGE_URL || !updateId) {
    console.log('[updateStatus] Skipped: edge_url=' + !!SUPABASE_EDGE_URL + ', updateId=' + updateId);
    return;
  }
  
  try {
    console.log(`[updateStatus] Calling edge function for ${updateId}: status=${status}, progress=${progress}`);
    
    const response = await fetch(SUPABASE_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // For public functions, the platform expects apikey + authorization headers
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        'x-update-secret': UPDATE_SECRET || ''
      },
      body: JSON.stringify({
        updateId,
        status,
        progress,
        currentStep,
        logs,
        error
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[updateStatus] Edge function error:', result.error);
    } else {
      console.log(`[updateStatus] Success, rows updated: ${result.rowsAffected || 0}`);
    }
  } catch (err) {
    console.error('[updateStatus] Exception:', err.message);
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
  const envPath = path.join(APP_DIR, '.env');
  const envBackupPath = path.join(APP_DIR, '.env.backup');
  
  try {
    addLog(logs, '🚀 Starting update process...', 'info');
    await updateStatus(updateId, 'running', 5, 'Backing up .env...', logs);

    // Step 0: Backup .env file
    if (fs.existsSync(envPath)) {
      addLog(logs, '💾 Backing up .env file...', 'info');
      fs.copyFileSync(envPath, envBackupPath);
      addLog(logs, '✅ .env backed up successfully', 'success');
    }

    await updateStatus(updateId, 'running', 10, 'Stashing changes...', logs);

    // Step 1: Git stash
    addLog(logs, '📦 Stashing local changes...', 'info');
    await execCommand('git stash', APP_DIR, logs);
    await updateStatus(updateId, 'running', 25, 'Pulling latest changes...', logs);

    // Step 2: Git pull
    addLog(logs, '⬇️ Pulling latest changes from GitHub...', 'info');
    await execCommand('git pull origin main', APP_DIR, logs);

    // Step 2.5: Restore .env file immediately after git pull
    if (fs.existsSync(envBackupPath)) {
      addLog(logs, '🔄 Restoring .env file...', 'info');
      fs.copyFileSync(envBackupPath, envPath);
      addLog(logs, '✅ .env restored successfully', 'success');
    }
    await updateStatus(updateId, 'running', 40, 'Getting commit SHA...', logs);

    // Step 3: Get new commit SHA
    addLog(logs, '🔍 Getting current commit SHA...', 'info');
    const commitSha = await execCommand('git rev-parse HEAD', APP_DIR, logs);
    const trimmedSha = commitSha.trim();
    addLog(logs, `Current commit: ${trimmedSha.slice(0, 7)}`, 'success');
    
    // Step 4: Update installed_commit_sha in database
    // Update installed version via edge function
    if (SUPABASE_EDGE_URL) {
      addLog(logs, '💾 Updating installed version in database...', 'info');
      try {
        const syncUrl = `${SUPABASE_URL}/functions/v1/sync-installed-version`;
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'x-update-secret': UPDATE_SECRET || ''
          },
          body: JSON.stringify({ commitSha: trimmedSha })
        });
        if (syncResponse.ok) {
          addLog(logs, '✅ Database updated with new version', 'success');
        } else {
          addLog(logs, '⚠️ Failed to update version in database', 'warning');
        }
      } catch (err) {
        addLog(logs, `⚠️ Version sync error: ${err.message}`, 'warning');
      }
    }
    
    await updateStatus(updateId, 'running', 50, 'Cleaning for fresh install...', logs);

    // Step 5: Clean install to ensure devDependencies are installed
    addLog(logs, '🧹 Removing node_modules, lock files and vite cache...', 'info');
    await execCommand('rm -rf node_modules package-lock.json .vite node_modules/.vite node_modules/.vite-temp', APP_DIR, logs);
    await updateStatus(updateId, 'running', 55, 'Installing dependencies...', logs);

    addLog(logs, '📦 Installing all dependencies (with --include=dev)...', 'info');
    await execCommand(`${NPM_CMD} install --include=dev`, APP_DIR, logs);
    
    // Verify critical package exists
    addLog(logs, '🔍 Verifying @vitejs/plugin-react-swc...', 'info');
    try {
      await execCommand('ls node_modules/@vitejs/plugin-react-swc/package.json', APP_DIR, logs);
      addLog(logs, '✅ @vitejs/plugin-react-swc found', 'success');
    } catch (e) {
      addLog(logs, '⚠️ @vitejs/plugin-react-swc NOT found - trying explicit install', 'warning');
      await execCommand(`${NPM_CMD} install @vitejs/plugin-react-swc --save-dev`, APP_DIR, logs);
    }
    
    await updateStatus(updateId, 'running', 75, 'Building application...', logs);

    // Step 6: npm build
    addLog(logs, '🔨 Building application...', 'info');
    await execCommand(`${NPM_CMD} run build`, APP_DIR, logs);
    await updateStatus(updateId, 'running', 90, 'Finalizing...', logs);

    addLog(logs, '✅ Update completed successfully!', 'success');
    await updateStatus(updateId, 'completed', 100, 'Update completed', logs);

    // Cleanup backup file
    if (fs.existsSync(envBackupPath)) {
      fs.unlinkSync(envBackupPath);
      addLog(logs, '🧹 Cleaned up .env backup', 'info');
    }

    return { success: true };
  } catch (error) {
    // Restore .env on failure
    if (fs.existsSync(envBackupPath)) {
      try {
        fs.copyFileSync(envBackupPath, envPath);
        addLog(logs, '🔄 Restored .env from backup after failure', 'warning');
        fs.unlinkSync(envBackupPath);
      } catch (restoreErr) {
        addLog(logs, `⚠️ Failed to restore .env: ${restoreErr.message}`, 'error');
      }
    }
    addLog(logs, `❌ Update failed: ${error.message}`, 'error');
    await updateStatus(updateId, 'failed', 0, 'Update failed', logs, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch Netdata stats from localhost
 */
async function fetchNetdataStats(monitoringUrl) {
  const baseUrl = (monitoringUrl || 'http://localhost:19999').replace(/\/$/, '');
  
  const results = {
    systemInfo: null,
    cpu: null,
    ram: null,
    disk: null,
    network: null,
  };

  try {
    // Fetch system info
    const infoRes = await fetch(`${baseUrl}/api/v1/info`);
    if (infoRes.ok) results.systemInfo = await infoRes.json();

    // Fetch CPU usage
    const cpuRes = await fetch(`${baseUrl}/api/v1/data?chart=system.cpu&after=-60&points=60&group=average&format=json&options=seconds`);
    if (cpuRes.ok) results.cpu = await cpuRes.json();

    // Fetch RAM usage
    const ramRes = await fetch(`${baseUrl}/api/v1/data?chart=system.ram&after=-60&points=60&group=average&format=json&options=seconds`);
    if (ramRes.ok) results.ram = await ramRes.json();

    // Fetch disk usage
    const diskRes = await fetch(`${baseUrl}/api/v1/data?chart=disk_space._&after=-60&points=1&group=average&format=json&options=seconds`);
    if (diskRes.ok) results.disk = await diskRes.json();

    // Fetch network usage
    const netRes = await fetch(`${baseUrl}/api/v1/data?chart=system.net&after=-60&points=60&group=average&format=json&options=seconds`);
    if (netRes.ok) results.network = await netRes.json();

    return { success: true, data: results };
  } catch (err) {
    console.error('Failed to fetch Netdata stats:', err.message);
    return { 
      success: false, 
      error: 'Kunne ikke hente data fra Netdata',
      details: err.message,
      suggestion: 'Sjekk at Netdata kjører på ' + baseUrl
    };
  }
}

/**
 * HTTP Server
 */
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // Server stats endpoint - fetches from Netdata locally
  if (req.url?.startsWith('/server-stats') && req.method === 'GET') {
    // Parse monitoring_url from query string if provided
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    const monitoringUrl = urlParts.searchParams.get('monitoring_url') || process.env.MONITORING_URL || 'http://localhost:19999';
    
    fetchNetdataStats(monitoringUrl).then((result) => {
      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: result.error,
          details: result.details,
          suggestion: result.suggestion
        }));
      }
    }).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Setup Netdata endpoint - install Netdata locally
  if (req.url === '/setup-netdata' && req.method === 'POST') {
    console.log('📊 Received setup-netdata request');
    
    // Check if Netdata is already installed
    exec('which netdata', (error, stdout) => {
      if (stdout && stdout.trim()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Netdata er allerede installert',
          path: stdout.trim(),
          alreadyInstalled: true
        }));
        return;
      }
      
      // Send immediate response - installation runs in background
      console.log('📦 Starting Netdata installation...');
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Netdata installasjon startet. Dette kan ta noen minutter.',
        alreadyInstalled: false
      }));
      
      // Run installation in background
      exec('bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait --disable-telemetry', 
        { shell: '/bin/bash', timeout: 600000 }, // 10 min timeout
        (installError, installStdout, installStderr) => {
          if (installError) {
            console.error('❌ Netdata installation failed:', installError.message);
            if (installStderr) console.error('stderr:', installStderr);
          } else {
            console.log('✅ Netdata installation completed');
            if (installStdout) console.log('stdout:', installStdout);
          }
        }
      );
    });
    return;
  }

  // Diagnostics endpoint - check Node version, dist/ permissions, and Netdata status
  if (req.url === '/diagnostics' && req.method === 'GET') {
    console.log('🔍 Received diagnostics request');
    
    const results = {
      node: { ok: false, version: '', required: '20.0.0', message: '' },
      distPermissions: { ok: false, writable: false, exists: false, message: '' },
      netdata: { ok: false, running: false, message: '' },
      services: {
        preview: { ok: false, active: false, exists: false },
        gitPull: { ok: false, active: false, exists: false }
      }
    };
    
    // Check Node version
    try {
      const nodeVersion = process.version.replace('v', '');
      const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
      results.node.version = process.version;
      results.node.ok = majorVersion >= 20;
      results.node.message = majorVersion >= 20 
        ? `Node ${process.version} ✓` 
        : `Node ${process.version} er for gammel. Krever v20+`;
    } catch (err) {
      results.node.message = `Kunne ikke sjekke Node-versjon: ${err.message}`;
    }
    
    // Check dist/ permissions
    const distPath = path.join(APP_DIR, 'dist');
    try {
      results.distPermissions.exists = fs.existsSync(distPath);
      if (results.distPermissions.exists) {
        // Try to write a test file
        const testFile = path.join(distPath, '.write-test-' + Date.now());
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          results.distPermissions.writable = true;
          results.distPermissions.ok = true;
          results.distPermissions.message = 'dist/ er skrivbar ✓';
        } catch (writeErr) {
          results.distPermissions.writable = false;
          results.distPermissions.message = `Ingen skrivetilgang til dist/: ${writeErr.message}`;
        }
      } else {
        // dist/ doesn't exist - check if we can create it
        try {
          fs.mkdirSync(distPath);
          fs.rmdirSync(distPath);
          results.distPermissions.writable = true;
          results.distPermissions.ok = true;
          results.distPermissions.message = 'dist/ eksisterer ikke, men kan opprettes ✓';
        } catch (createErr) {
          results.distPermissions.writable = false;
          results.distPermissions.message = `Kan ikke opprette dist/: ${createErr.message}`;
        }
      }
    } catch (err) {
      results.distPermissions.message = `Feil ved sjekk av dist/: ${err.message}`;
    }
    
    // Check Netdata status
    const checkNetdata = () => {
      return new Promise((resolve) => {
        exec('systemctl is-active netdata', (error, stdout) => {
          const isActive = stdout.trim() === 'active';
          if (isActive) {
            results.netdata.ok = true;
            results.netdata.running = true;
            results.netdata.message = 'Netdata kjører ✓';
          } else {
            // Check if installed but not running
            exec('which netdata', (err2, which) => {
              if (which && which.trim()) {
                results.netdata.running = false;
                results.netdata.message = 'Netdata er installert men kjører ikke';
              } else {
                results.netdata.running = false;
                results.netdata.message = 'Netdata er ikke installert';
              }
              resolve();
            });
            return;
          }
          resolve();
        });
      });
    };
    
    // Check service status
    const checkService = (name) => {
      return new Promise((resolve) => {
        exec(`systemctl is-active ${name}`, (error, stdout) => {
          const isActive = stdout.trim() === 'active';
          exec(`systemctl show ${name} --property=LoadState`, (err2, details) => {
            const loadState = details ? details.split('=')[1]?.trim() : 'unknown';
            resolve({
              ok: isActive,
              active: isActive,
              exists: loadState !== 'not-found'
            });
          });
        });
      });
    };
    
    Promise.all([
      checkNetdata(),
      checkService('jelly-stream-preview'),
      checkService('jelly-git-pull')
    ]).then(([_, previewStatus, gitPullStatus]) => {
      results.services.preview = previewStatus;
      results.services.gitPull = gitPullStatus;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        diagnostics: results,
        fixCommands: {
          nodeVersion: 'nvm install 20 && nvm use 20',
          distPermissions: `sudo chown -R $(whoami):$(whoami) ${APP_DIR} && sudo rm -rf ${distPath}`,
          netdataInstall: 'bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait --disable-telemetry',
          netdataStart: 'sudo systemctl start netdata && sudo systemctl enable netdata',
          previewService: 'sudo bash setup-preview-service.sh',
          gitPullService: 'sudo bash setup-git-pull-service.sh'
        },
        timestamp: new Date().toISOString()
      }));
    });
    return;
  }

  // Service logs endpoint - get recent journalctl logs for a service
  if (req.url?.startsWith('/service-logs') && req.method === 'GET') {
    const urlParts = new URL(req.url, `http://${req.headers.host}`);
    const serviceName = urlParts.searchParams.get('service') || 'jelly-stream-preview';
    const lines = parseInt(urlParts.searchParams.get('lines') || '50', 10);
    
    // Validate service name to prevent command injection
    const allowedServices = ['jelly-stream-preview', 'jelly-git-pull', 'jelly-transcode', 'netdata'];
    if (!allowedServices.includes(serviceName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid service name' }));
      return;
    }
    
    exec(`journalctl -u ${serviceName} -n ${Math.min(lines, 500)} --no-pager`, (error, stdout, stderr) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: !error,
        service: serviceName,
        logs: stdout || stderr || 'No logs available',
        error: error ? error.message : null,
        timestamp: new Date().toISOString()
      }));
    });
    return;
  }

  // Service status endpoint - get systemd status for jelly-stream-preview
  if (req.url === '/service-status' && req.method === 'GET') {
    console.log('📊 Received service-status request');
    
    const getServiceStatus = (serviceName, callback) => {
      exec(`systemctl is-active ${serviceName}`, (error, stdout, stderr) => {
        const isActive = stdout.trim() === 'active';
        
        // Get more details if service exists
        exec(`systemctl show ${serviceName} --property=LoadState,ActiveState,SubState,MainPID,ExecMainStartTimestamp --no-pager`, (err2, details) => {
          const props = {};
          if (details) {
            details.split('\n').forEach(line => {
              const [key, ...value] = line.split('=');
              if (key && value.length) props[key] = value.join('=');
            });
          }
          
          callback({
            name: serviceName,
            active: isActive,
            state: stdout.trim() || 'unknown',
            loadState: props.LoadState || 'unknown',
            activeState: props.ActiveState || 'unknown',
            subState: props.SubState || 'unknown',
            pid: props.MainPID || null,
            startedAt: props.ExecMainStartTimestamp || null
          });
        });
      });
    };
    
    // Check all services
    getServiceStatus('jelly-stream-preview', (previewStatus) => {
      getServiceStatus('jelly-git-pull', (gitPullStatus) => {
        getServiceStatus('jelly-transcode', (transcodeStatus) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            services: {
              'jelly-stream-preview': previewStatus,
              'jelly-git-pull': gitPullStatus,
              'jelly-transcode': transcodeStatus
            },
            timestamp: new Date().toISOString()
          }));
        });
      });
    });
    return;
  }

  // Restart service endpoint - restart jelly-stream-preview
  if (req.url === '/restart-preview' && req.method === 'POST') {
    console.log('🔄 Received restart-preview request');
    
    // Verify signature if secret is set
    const signature = req.headers['x-update-signature'];
    if (UPDATE_SECRET && !verifySignature('', signature, UPDATE_SECRET)) {
      console.error('❌ Invalid signature');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }
    
    exec('systemctl restart jelly-stream-preview', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to restart jelly-stream-preview:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: error.message,
          stderr: stderr,
          stdout: stdout,
        }));
        return;
      }
      
      console.log('✅ jelly-stream-preview restarted successfully');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Service jelly-stream-preview restarted successfully',
        stdout: stdout,
      }));
    });
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

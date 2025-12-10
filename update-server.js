#!/usr/bin/env node
/**
 * Auto-Update Server for Jelly Stream Viewer
 * 
 * Dette scriptet lytter på webhook requests og kjører automatisk oppdatering av appen.
 * 
 * Installasjon:
 * 1. npm install express
 * 2. Konfigurer miljøvariabler (se nedenfor)
 * 3. Kjør: node update-server.js
 * 4. Eller bruk PM2: pm2 start update-server.js
 * 
 * Miljøvariabler:
 * - PORT: Port å lytte på (default: 3001)
 * - UPDATE_SECRET: Hemmelighet for HMAC signatur-validering
 * - APP_DIR: Sti til app-mappen (default: /var/www/jelly-stream-viewer)
 * - RESTART_COMMAND: Kommando for å restarte appen (default: pm2 restart jelly-stream)
 */

import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
const execAsync = promisify(exec);


const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const UPDATE_SECRET = process.env.UPDATE_SECRET || 'change-me-in-production';
const APP_DIR = process.env.APP_DIR || '/var/www/jelly-stream-viewer';
const RESTART_COMMAND = process.env.RESTART_COMMAND || 'pm2 restart jelly-stream';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting: Track request timestamps per IP
const requestTracker = new Map();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS = 5;

// Logging helper
function log(message, ...args) {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
}

// HMAC signature verification
function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Rate limiting check
function checkRateLimit(ip) {
  const now = Date.now();
  const requests = requestTracker.get(ip) || [];
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }
  
  // Add current request
  recentRequests.push(now);
  requestTracker.set(ip, recentRequests);
  
  return true;
}

// Setup nginx configuration for webhook
async function setupNginxWebhook() {
  log('Setting up nginx webhook configuration...');
  
  const nginxConfig = `# Webhook endpoint for auto-updates
location /update-webhook {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Webhook-Signature $http_x_webhook_signature;
    proxy_set_header X-Webhook-Timestamp $http_x_webhook_timestamp;
    
    # Security
    allow all;
    
    # Timeouts
    proxy_connect_timeout 10s;
    proxy_send_timeout 10s;
    proxy_read_timeout 10s;
}
`;

  const configPath = '/etc/nginx/conf.d/webhook.conf';
  
  try {
    // Write nginx config
    await execAsync(`echo '${nginxConfig}' | sudo tee ${configPath}`);
    log('Nginx webhook config created');
    
    // Test nginx config
    await execAsync('sudo nginx -t');
    log('Nginx config valid');
    
    // Reload nginx
    await execAsync('sudo systemctl reload nginx');
    log('Nginx reloaded successfully');
    
    return true;
  } catch (error) {
    log('Warning: Could not setup nginx webhook config (may need manual setup):', error.message);
    return false;
  }
}

// Setup systemd service for update server
async function setupUpdateServerService() {
  log('Setting up update server systemd service...');
  
  const serviceFile = `[Unit]
Description=Jelly Stream Viewer Auto-Update Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="UPDATE_SECRET=${UPDATE_SECRET}"
Environment="APP_DIR=${APP_DIR}"
Environment="RESTART_COMMAND=sudo systemctl restart jelly-stream"
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/update-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-update

[Install]
WantedBy=multi-user.target
`;

  try {
    // Write service file
    await execAsync(`echo '${serviceFile}' | sudo tee /etc/systemd/system/jelly-update-server.service`);
    log('Systemd service file created');
    
    // Reload systemd
    await execAsync('sudo systemctl daemon-reload');
    
    // Enable and start service
    await execAsync('sudo systemctl enable jelly-update-server.service');
    await execAsync('sudo systemctl restart jelly-update-server.service');
    
    log('Update server service enabled and started');
    return true;
  } catch (error) {
    log('Warning: Could not setup update server service (may need manual setup):', error.message);
    return false;
  }
}

// Update database with new commit SHA
async function updateDatabaseVersion(commitSha) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('Warning: Supabase credentials not configured, skipping database update');
    return false;
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      setting_key: 'installed_commit_sha',
      setting_value: commitSha,
      updated_at: new Date().toISOString()
    });

    const url = new URL(`${SUPABASE_URL}/rest/v1/server_settings`);
    url.searchParams.append('setting_key', 'eq.installed_commit_sha');

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log('Database version updated successfully');
          resolve(true);
        } else {
          log('Failed to update database version:', res.statusCode, body);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      log('Error updating database version:', error);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

// Update function - preserves .env file across updates
async function performUpdate() {
  log('Starting update process...');
  
  try {
    // Step 0: Setup nginx and update server service (first time setup)
    await setupNginxWebhook();
    await setupUpdateServerService();
    
    // Step 0.5: Backup .env file before git pull
    log('Backing up .env file...');
    try {
      await execAsync('if [ -f .env ]; then cp .env .env.backup; fi', { cwd: APP_DIR });
      log('.env backed up successfully');
    } catch (backupError) {
      log('Warning: Could not backup .env:', backupError.message);
    }
    
    // Step 1: Git pull
    log('Pulling latest changes from GitHub...');
    const { stdout: gitOutput } = await execAsync('git pull', { cwd: APP_DIR });
    log('Git output:', gitOutput);
    
    // Step 1.5: Restore .env file after git pull
    log('Restoring .env file...');
    try {
      await execAsync('if [ -f .env.backup ]; then cp .env.backup .env; fi', { cwd: APP_DIR });
      log('.env restored successfully');
    } catch (restoreError) {
      log('Warning: Could not restore .env:', restoreError.message);
    }
    
    // Step 2: Install dependencies
    log('Installing dependencies...');
    const { stdout: npmOutput } = await execAsync('npm install', { cwd: APP_DIR });
    log('NPM output:', npmOutput);
    
    // Step 3: Build
    log('Building application...');
    const { stdout: buildOutput } = await execAsync('npm run build', { cwd: APP_DIR });
    log('Build output:', buildOutput);
    
    // Step 4: Get current commit SHA
    const { stdout: shaOutput } = await execAsync('git rev-parse HEAD', { cwd: APP_DIR });
    const commitSha = shaOutput.trim();
    log('New version SHA:', commitSha);
    
    // Step 4.5: Update database with new commit SHA
    await updateDatabaseVersion(commitSha);
    
    // Step 5: Restart application
    log('Restarting application...');
    const { stdout: restartOutput } = await execAsync(RESTART_COMMAND, { cwd: APP_DIR });
    log('Restart output:', restartOutput);
    
    // Step 6: Clean up backup
    try {
      await execAsync('rm -f .env.backup', { cwd: APP_DIR });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    log('Update completed successfully!');
    
    return {
      success: true,
      commitSha,
      message: 'Oppdatering fullført'
    };
    
  } catch (error) {
    log('Update failed:', error);
    // Try to restore .env on failure
    try {
      await execAsync('if [ -f .env.backup ]; then cp .env.backup .env; fi', { cwd: APP_DIR });
      log('.env restored after failure');
    } catch (restoreError) {
      // Ignore restore errors
    }
    throw error;
  }
}

// Webhook endpoint
app.post('/update', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    log('Rate limit exceeded for IP:', clientIp);
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Rate limit exceeded. Try again later.'
    });
  }
  
  try {
    // Get signature and timestamp from headers (support both legacy and new names)
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      log('Missing signature or timestamp');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify timestamp (reject requests older than 5 minutes)
    const requestTime = new Date(timestamp).getTime();
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    if (isNaN(requestTime) || now - requestTime > maxAge || requestTime > now) {
      log('Invalid or expired timestamp:', timestamp);
      return res.status(401).json({ error: 'Invalid or expired timestamp' });
    }
    
    // Verify HMAC signature
    const payload = JSON.stringify(req.body);
    
    try {
      if (!verifySignature(payload, signature, UPDATE_SECRET)) {
        log('Invalid signature from IP:', clientIp);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      log('Signature verification error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    log('Update request received from:', clientIp);
    
    // Send immediate response
    res.status(200).json({ 
      message: 'Update started',
      timestamp: new Date().toISOString()
    });
    
    // Perform update in background
    setTimeout(async () => {
      try {
        const result = await performUpdate();
        log('Update result:', result);
      } catch (error) {
        log('Update error:', error);
      }
    }, 100);
    
  } catch (error) {
    log('Request handling error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  log(`Update server listening on port ${PORT}`);
  log(`Webhook URL: http://localhost:${PORT}/update`);
  log(`App directory: ${APP_DIR}`);
  log(`Restart command: ${RESTART_COMMAND}`);
  log('');
  log('Security features enabled:');
  log('  ✓ HMAC-SHA256 signature verification');
  log('  ✓ Timestamp validation (5-minute window)');
  log('  ✓ Rate limiting (5 requests per 5 minutes)');
  log('  ✓ Constant-time signature comparison');
  log('');
  log('Configuration:');
  log('  1. Set UPDATE_SECRET in environment or server_settings.update_webhook_secret');
  log('  2. Set update_webhook_url in Admin to: http://YOUR_SERVER_IP:' + PORT + '/update');
  log('  3. Ensure this script has permissions to run git, npm, and restart commands');
  log('  4. IMPORTANT: Change UPDATE_SECRET from default value!');
});

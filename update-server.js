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

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const UPDATE_SECRET = process.env.UPDATE_SECRET || 'change-me-in-production';
const APP_DIR = process.env.APP_DIR || '/var/www/jelly-stream-viewer';
const RESTART_COMMAND = process.env.RESTART_COMMAND || 'pm2 restart jelly-stream';

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

// Update function
async function performUpdate() {
  log('Starting update process...');
  
  try {
    // Step 1: Git pull
    log('Pulling latest changes from GitHub...');
    const { stdout: gitOutput } = await execAsync('git pull', { cwd: APP_DIR });
    log('Git output:', gitOutput);
    
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
    
    // Step 5: Restart application
    log('Restarting application...');
    const { stdout: restartOutput } = await execAsync(RESTART_COMMAND, { cwd: APP_DIR });
    log('Restart output:', restartOutput);
    
    log('Update completed successfully!');
    
    return {
      success: true,
      commitSha,
      message: 'Oppdatering fullført'
    };
    
  } catch (error) {
    log('Update failed:', error);
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
    // Get signature and timestamp from headers
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
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

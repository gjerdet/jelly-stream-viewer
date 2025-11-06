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
 * - UPDATE_SECRET: Hemmelighet for å autentisere requests
 * - APP_DIR: Sti til app-mappen (default: /var/www/jelly-stream-viewer)
 * - RESTART_COMMAND: Kommando for å restarte appen (default: pm2 restart jelly-stream)
 */

const express = require('express');
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

// Logging helper
function log(message, ...args) {
  console.log(`[${new Date().toISOString()}]`, message, ...args);
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
  // Verify secret
  const providedSecret = req.headers['x-update-secret'];
  if (providedSecret !== UPDATE_SECRET) {
    log('Unauthorized update attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  log('Update request received');
  
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
  log('Configuration:');
  log('  1. Set UPDATE_SECRET in environment or server_settings.update_webhook_secret');
  log('  2. Set update_webhook_url in Admin to: http://YOUR_SERVER_IP:' + PORT + '/update');
  log('  3. Ensure this script has permissions to run git, npm, and restart commands');
});

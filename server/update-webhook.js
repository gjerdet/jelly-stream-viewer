#!/usr/bin/env node

/**
 * Webhook server for receiving update triggers from Supabase Edge Functions
 * Run this with: node server/update-webhook.js
 * Or add to your process manager (PM2, systemd, etc.)
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key-here';
const PROJECT_PATH = process.env.PROJECT_PATH || '/var/www/jelly-stream-viewer';

// Verify HMAC signature
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(digest, 'utf8')
  );
}

// Execute update script
function runUpdate() {
  return new Promise((resolve, reject) => {
    const updateScript = path.join(__dirname, '../update-server.js');
    
    console.log(`[${new Date().toISOString()}] Starting update...`);
    
    exec(`node ${updateScript}`, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[${new Date().toISOString()}] Update error:`, error);
        reject(error);
        return;
      }
      
      console.log(`[${new Date().toISOString()}] Update output:`, stdout);
      if (stderr) {
        console.error(`[${new Date().toISOString()}] Update stderr:`, stderr);
      }
      
      resolve({ stdout, stderr });
    });
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature, X-Webhook-Timestamp');
  
  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Get signature and timestamp from headers
      const signature = req.headers['x-webhook-signature'];
      const timestamp = req.headers['x-webhook-timestamp'];
      
      if (!signature || !timestamp) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing authentication headers' }));
        return;
      }
      
      // Verify signature
      const isValid = verifySignature(body, signature, WEBHOOK_SECRET);
      
      if (!isValid) {
        console.error(`[${new Date().toISOString()}] Invalid signature`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
      
      // Parse request body
      const data = JSON.parse(body);
      console.log(`[${new Date().toISOString()}] Received update trigger:`, data);
      
      // Send immediate response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Update triggered',
        timestamp: new Date().toISOString()
      }));
      
      // Run update in background
      setTimeout(async () => {
        try {
          await runUpdate();
          console.log(`[${new Date().toISOString()}] Update completed successfully`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Update failed:`, error);
        }
      }, 100);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Request processing error:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Webhook server listening on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Project path: ${PROJECT_PATH}`);
  console.log(`[${new Date().toISOString()}] Webhook secret: ${WEBHOOK_SECRET.substring(0, 4)}...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, closing server...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] SIGINT received, closing server...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] Server closed`);
    process.exit(0);
  });
});

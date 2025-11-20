#!/usr/bin/env node

/**
 * Simple Git Pull Server
 * 
 * This server listens on localhost and executes git pull when triggered.
 * Much simpler than webhook setup - no domain or proxy needed!
 * 
 * Setup:
 * 1. Run: npm install express
 * 2. Start: node git-pull-server.js
 * 3. Or use systemd service (see setup script)
 */

const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.GIT_PULL_PORT || 3002;
const UPDATE_SECRET = process.env.UPDATE_SECRET || '';
const APP_DIR = process.env.APP_DIR || process.cwd();

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
 * Execute git pull and related commands
 */
function executeGitPull(callback) {
  const commands = [
    'git stash',
    'git pull origin main',
    'npm install --production',
    'npm run build'
  ].join(' && ');

  console.log('⚙️  Executing update commands...');
  
  exec(commands, { cwd: APP_DIR }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Update failed:', error.message);
      callback({ success: false, error: error.message, stderr });
      return;
    }

    console.log('✅ Update completed successfully!');
    console.log('📝 Output:', stdout);
    
    callback({ success: true, output: stdout });
  });
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
      directory: APP_DIR 
    }));
    return;
  }

  // Git pull endpoint
  if (req.url === '/git-pull' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // Verify signature if secret is set
      const signature = req.headers['x-update-signature'];
      
      if (UPDATE_SECRET && !verifySignature(body, signature, UPDATE_SECRET)) {
        console.error('❌ Invalid signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      console.log('🔄 Git pull triggered');

      // Send immediate response
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'accepted', 
        message: 'Update started' 
      }));

      // Execute git pull in background
      executeGitPull((result) => {
        if (result.success) {
          console.log('✅ Update completed successfully');
        } else {
          console.error('❌ Update failed:', result.error);
        }
      });
    });

    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, 'localhost', () => {
  console.log(`✅ Git Pull Server listening on http://localhost:${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/git-pull`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
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

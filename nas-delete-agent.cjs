/**
 * NAS Delete Agent - Local file deletion service
 * Runs on TrueNAS Scale to handle secure file deletions
 * 
 * Usage: node nas-delete-agent.cjs
 * 
 * Environment variables:
 *   NAS_DELETE_SECRET - HMAC secret for request signing (required)
 *   NAS_DELETE_PORT - Port to listen on (default: 3003)
 *   NAS_MOVIES_PATH - Base path for movies (e.g., /mnt/data/movies)
 *   NAS_SHOWS_PATH - Base path for TV shows (e.g., /mnt/data/shows)
 *   NAS_DOWNLOADS_PATH - Base path for downloads (e.g., /mnt/data/downloads)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const PORT = parseInt(process.env.NAS_DELETE_PORT || '3003', 10);
const SECRET = process.env.NAS_DELETE_SECRET;
const ALLOWED_PATHS = [
  process.env.NAS_MOVIES_PATH,
  process.env.NAS_SHOWS_PATH,
  process.env.NAS_DOWNLOADS_PATH,
].filter(Boolean);

// Validate configuration
if (!SECRET) {
  console.error('ERROR: NAS_DELETE_SECRET environment variable is required');
  process.exit(1);
}

if (ALLOWED_PATHS.length === 0) {
  console.error('ERROR: At least one path must be configured (NAS_MOVIES_PATH, NAS_SHOWS_PATH, or NAS_DOWNLOADS_PATH)');
  process.exit(1);
}

console.log('NAS Delete Agent starting...');
console.log('Allowed paths:', ALLOWED_PATHS);

// HMAC verification
function verifySignature(payload, signature, timestamp) {
  // Check timestamp (5 minute window)
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return { valid: false, reason: 'Request expired' };
  }

  // Verify HMAC
  const message = `${timestamp}:${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(message)
    .digest('hex');

  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

// Check if path is within allowed directories
function isPathAllowed(filePath) {
  const normalizedPath = path.normalize(filePath);
  
  for (const allowedPath of ALLOWED_PATHS) {
    const normalizedAllowed = path.normalize(allowedPath);
    if (normalizedPath.startsWith(normalizedAllowed + path.sep) || normalizedPath === normalizedAllowed) {
      return true;
    }
  }
  
  return false;
}

// Delete file or directory
async function deleteFile(filePath) {
  const stats = await fs.promises.stat(filePath);
  
  if (stats.isDirectory()) {
    await fs.promises.rm(filePath, { recursive: true, force: true });
  } else {
    await fs.promises.unlink(filePath);
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Timestamp, X-Signature');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      allowedPaths: ALLOWED_PATHS,
    }));
    return;
  }

  // Delete endpoint
  if (req.url === '/delete' && req.method === 'POST') {
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];

    if (!timestamp || !signature) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing authentication headers' }));
      return;
    }

    // Read body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Verify signature
    const verification = verifySignature(payload, signature, timestamp);
    if (!verification.valid) {
      console.log(`[REJECTED] Signature verification failed: ${verification.reason}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: verification.reason }));
      return;
    }

    const { filePath } = payload;
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'filePath is required' }));
      return;
    }

    // Check if path is allowed
    if (!isPathAllowed(filePath)) {
      console.log(`[REJECTED] Path not allowed: ${filePath}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Path not in allowed directories',
        allowedPaths: ALLOWED_PATHS 
      }));
      return;
    }

    // Check if file exists
    try {
      await fs.promises.access(filePath);
    } catch (e) {
      console.log(`[NOT FOUND] File does not exist: ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found', path: filePath }));
      return;
    }

    // Delete file
    try {
      await deleteFile(filePath);
      console.log(`[DELETED] ${filePath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'File deleted',
        path: filePath 
      }));
    } catch (e) {
      console.error(`[ERROR] Failed to delete ${filePath}:`, e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to delete file',
        details: e.message 
      }));
    }
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`NAS Delete Agent listening on port ${PORT}`);
});

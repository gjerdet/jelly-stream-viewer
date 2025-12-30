#!/usr/bin/env node

/**
 * Simple Git Pull Server
 *
 * This server listens on a configurable host/port and executes git pull when triggered.
 * It also (optionally) reports progress back to the backend (update_status + installed_commit_sha)
 * so the web UI can stop “hanging” on status polling.
 */

import http from 'http';
import { exec } from 'child_process';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.GIT_PULL_PORT || 3002;
const HOST = process.env.GIT_PULL_HOST || '0.0.0.0';
const UPDATE_SECRET = process.env.UPDATE_SECRET || '';
const APP_DIR = process.env.APP_DIR || process.cwd();

// Optional: used to report update completion back to the backend
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🚀 Git Pull Server starting...');
console.log(`📁 Working directory: ${APP_DIR}`);
console.log(`🌐 Listening on: ${HOST}:${PORT}`);
console.log(`🔐 Secret configured: ${UPDATE_SECRET ? 'Yes' : 'No'}`);
console.log(`🗄️  Backend reporting: ${SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`);

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } catch (e) {
    console.warn('⚠️  Could not initialize backend client:', e?.message || e);
    return null;
  }
}

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function normalizeSignature(signature) {
  if (!signature) return '';
  const s = Array.isArray(signature) ? signature[0] : String(signature);
  return s.replace(/^sha256=/i, '');
}

/**
 * Verify HMAC signature
 */
function verifySignature(payload, signature, secret) {
  if (!secret) return true; // Skip verification if no secret set

  const provided = normalizeSignature(signature);
  if (!provided) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return provided === expectedSignature;
}

async function appendUpdateLogs(updateId, entries, patch = {}) {
  const supabase = getSupabaseClient();
  if (!supabase || !updateId) return;

  try {
    const { data } = await supabase
      .from('update_status')
      .select('logs')
      .eq('id', updateId)
      .maybeSingle();

    let existing = [];
    const currentLogs = data?.logs;
    if (typeof currentLogs === 'string') {
      existing = safeParseJson(currentLogs) || [];
    } else if (Array.isArray(currentLogs)) {
      existing = currentLogs;
    }

    const nextLogs = [...existing, ...entries];

    await supabase
      .from('update_status')
      .update({
        ...patch,
        logs: JSON.stringify(nextLogs),
        updated_at: new Date().toISOString(),
      })
      .eq('id', updateId);
  } catch (e) {
    console.warn('⚠️  Failed to write update logs:', e?.message || e);
  }
}

async function setInstalledCommitSha(commitSha) {
  const supabase = getSupabaseClient();
  if (!supabase || !commitSha) return;

  try {
    await supabase
      .from('server_settings')
      .upsert(
        {
          setting_key: 'installed_commit_sha',
          setting_value: commitSha,
          updated_at: new Date().toISOString(),
          updated_by: null,
        },
        { onConflict: 'setting_key' },
      );
  } catch (e) {
    console.warn('⚠️  Failed to set installed_commit_sha:', e?.message || e);
  }
}

function getGitHeadSha() {
  return new Promise((resolve) => {
    exec('git rev-parse HEAD', { cwd: APP_DIR }, (err, stdout) => {
      if (err) return resolve('');
      resolve(String(stdout || '').trim());
    });
  });
}

/**
 * Execute git pull and related commands
 * Preserves .env file across updates
 */
function executeGitPull({ updateId } = {}, callback) {
  // Backup .env, do git pull, restore .env, then build
  const commands = [
    // Backup .env if it exists
    'if [ -f .env ]; then cp .env .env.backup; fi',
    'git stash',
    'git pull origin main',
    // Restore .env from backup
    'if [ -f .env.backup ]; then cp .env.backup .env; fi',
    'npm install --production',
    'npm run build',
    // Clean up backup
    'rm -f .env.backup',
  ].join(' && ');

  console.log('⚙️  Executing update commands (preserving .env)...');

  // Best effort: mark as in-progress
  appendUpdateLogs(updateId, [
    {
      timestamp: new Date().toISOString(),
      message: '🔄 Oppdatering køyrer på serveren...',
      level: 'info',
    },
  ], {
    status: 'in_progress',
    progress: 20,
    current_step: 'Oppdatering køyrer på serveren...',
    started_at: new Date().toISOString(),
  });

  exec(commands, { cwd: APP_DIR }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Update failed:', error.message);
      // Try to restore .env on failure
      exec('if [ -f .env.backup ]; then cp .env.backup .env; fi', { cwd: APP_DIR });

      // Best effort: persist failure
      appendUpdateLogs(updateId, [
        {
          timestamp: new Date().toISOString(),
          message: `❌ Oppdatering feila: ${error.message}`,
          level: 'error',
        },
        ...(stderr
          ? [
              {
                timestamp: new Date().toISOString(),
                message: String(stderr).slice(-2000),
                level: 'error',
              },
            ]
          : []),
      ], {
        status: 'failed',
        progress: 0,
        current_step: 'Feil under oppdatering',
        error: error.message,
        completed_at: new Date().toISOString(),
      });

      callback({ success: false, error: error.message, stderr });
      return;
    }

    (async () => {
      const newSha = await getGitHeadSha();
      if (newSha) {
        await setInstalledCommitSha(newSha);
      }

      await appendUpdateLogs(updateId, [
        {
          timestamp: new Date().toISOString(),
          message: '✅ Oppdatering fullført på serveren!',
          level: 'success',
        },
        ...(newSha
          ? [
              {
                timestamp: new Date().toISOString(),
                message: `🔖 Installert commit: ${newSha.slice(0, 7)}`,
                level: 'info',
              },
            ]
          : []),
      ], {
        status: 'completed',
        progress: 100,
        current_step: 'Oppdatering fullført!',
        completed_at: new Date().toISOString(),
      });
    })().catch((e) => console.warn('⚠️  Post-update reporting failed:', e?.message || e));

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
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
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'git-pull-server',
        directory: APP_DIR,
        host: HOST,
        port: PORT,
        backendReporting: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      }),
    );
    return;
  }

  // Git pull endpoint
  if (req.url === '/git-pull' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const parsedBody = safeParseJson(body) || {};
      const updateId = parsedBody?.updateId;

      // Verify signature if secret is set
      const signature = req.headers['x-update-signature'];

      if (UPDATE_SECRET && !verifySignature(body, signature, UPDATE_SECRET)) {
        console.error('❌ Invalid signature');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }

      console.log('🔄 Git pull triggered', updateId ? `(updateId: ${updateId})` : '');

      // Send immediate response
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'accepted',
          message: 'Update started',
        }),
      );

      // Execute git pull in background
      executeGitPull({ updateId }, (result) => {
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
server.listen(PORT, HOST, () => {
  console.log(`✅ Git Pull Server listening on http://${HOST}:${PORT}`);
  console.log(`📍 Endpoint: http://${HOST}:${PORT}/git-pull`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
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

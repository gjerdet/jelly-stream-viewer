#!/usr/bin/env node

/**
 * Git Pull Server
 *
 * Polls the database every 30 seconds for pending update requests.
 * When a "requested" status is found, executes git pull and reports back.
 * No public URL needed — the server pulls from the cloud, not vice versa.
 */

import http from 'http';
import { exec } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.GIT_PULL_PORT || 3002;
const HOST = process.env.GIT_PULL_HOST || '0.0.0.0';
const APP_DIR = process.env.APP_DIR || process.cwd();
const POLL_INTERVAL_MS = 30_000;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🚀 Git Pull Server starting...');
console.log(`📁 Working directory: ${APP_DIR}`);
console.log(`🌐 Listening on: ${HOST}:${PORT}`);
console.log(`🗄️  Backend polling: ${SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? 'Yes (every 30s)' : 'No — SUPABASE_URL/KEY missing!'}`);

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
  try { return JSON.parse(str); } catch { return null; }
}

function getGitHeadSha() {
  return new Promise((resolve) => {
    exec('git rev-parse HEAD', { cwd: APP_DIR }, (err, stdout) => {
      resolve(err ? '' : String(stdout || '').trim());
    });
  });
}

async function appendUpdateLogs(supabase, updateId, entries, patch = {}) {
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

    await supabase
      .from('update_status')
      .update({
        ...patch,
        logs: JSON.stringify([...existing, ...entries]),
        updated_at: new Date().toISOString(),
      })
      .eq('id', updateId);
  } catch (e) {
    console.warn('⚠️  Failed to write update logs:', e?.message || e);
  }
}

async function setInstalledCommitSha(supabase, commitSha) {
  if (!supabase || !commitSha) return;
  try {
    await supabase
      .from('server_settings')
      .upsert(
        { setting_key: 'installed_commit_sha', setting_value: commitSha, updated_at: new Date().toISOString(), updated_by: null },
        { onConflict: 'setting_key' },
      );
  } catch (e) {
    console.warn('⚠️  Failed to set installed_commit_sha:', e?.message || e);
  }
}

function executeGitPull(supabase, updateId) {
  return new Promise((resolve) => {
    const commands = [
      'if [ -f .env ]; then cp .env .env.backup; fi',
      'git stash',
      'git pull origin main',
      'if [ -f .env.backup ]; then cp .env.backup .env; fi',
      'npm install --production',
      'npm run build',
      'rm -f .env.backup',
    ].join(' && ');

    console.log(`⚙️  Executing git pull for updateId=${updateId}...`);

    appendUpdateLogs(supabase, updateId, [{
      timestamp: new Date().toISOString(),
      message: '🔄 Lokal server køyrer git pull...',
      level: 'info',
    }], { status: 'in_progress', progress: 20, current_step: 'Køyrer git pull...', started_at: new Date().toISOString() });

    exec(commands, { cwd: APP_DIR }, async (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Update failed:', error.message);
        exec('if [ -f .env.backup ]; then cp .env.backup .env; fi', { cwd: APP_DIR });

        await appendUpdateLogs(supabase, updateId, [
          { timestamp: new Date().toISOString(), message: `❌ Oppdatering feila: ${error.message}`, level: 'error' },
          ...(stderr ? [{ timestamp: new Date().toISOString(), message: String(stderr).slice(-2000), level: 'error' }] : []),
        ], { status: 'failed', progress: 0, current_step: 'Feil under oppdatering', error: error.message, completed_at: new Date().toISOString() });

        return resolve({ success: false, error: error.message });
      }

      const newSha = await getGitHeadSha();
      if (newSha) await setInstalledCommitSha(supabase, newSha);

      await appendUpdateLogs(supabase, updateId, [
        { timestamp: new Date().toISOString(), message: '✅ Oppdatering fullført!', level: 'success' },
        ...(newSha ? [{ timestamp: new Date().toISOString(), message: `🔖 Installert commit: ${newSha.slice(0, 7)}`, level: 'info' }] : []),
      ], { status: 'completed', progress: 100, current_step: 'Oppdatering fullført!', completed_at: new Date().toISOString() });

      console.log('✅ Update completed!');
      resolve({ success: true });
    });
  });
}

// ── Database poller ────────────────────────────────────────────────────────────
let polling = false;

async function pollForUpdates() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data: rows } = await supabase
      .from('update_status')
      .select('id, status')
      .eq('status', 'requested')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!rows || rows.length === 0) return;

    const row = rows[0];
    console.log(`📥 Found pending update request: ${row.id}`);

    // Claim it immediately to prevent duplicate execution
    const { error: claimErr } = await supabase
      .from('update_status')
      .update({ status: 'in_progress', progress: 5, current_step: 'Lokal server har henta forespørselen...', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'requested'); // Only claim if still "requested"

    if (claimErr) {
      console.warn('⚠️  Could not claim update row (maybe another process got it):', claimErr.message);
      return;
    }

    await executeGitPull(supabase, row.id);
  } catch (e) {
    console.warn('⚠️  Poll error:', e?.message || e);
  }
}

// Start polling
setInterval(pollForUpdates, POLL_INTERVAL_MS);
// Also poll immediately on startup
setTimeout(pollForUpdates, 5_000);

// ── HTTP Server (health check + manual trigger) ────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Update-Signature');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'git-pull-server',
      mode: 'polling',
      directory: APP_DIR,
      host: HOST,
      port: PORT,
      pollIntervalSeconds: POLL_INTERVAL_MS / 1000,
      backendConnected: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
    }));
    return;
  }

  // Keep /git-pull for backward compat (manual trigger via LAN)
  if (req.url === '/git-pull' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No database connection configured' }));
        return;
      }

      // Create a new update_status row and execute
      const { data: row } = await supabase
        .from('update_status')
        .insert({ status: 'in_progress', progress: 5, current_step: 'Manuell trigger via LAN...' })
        .select('id')
        .single();

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'accepted', updateId: row?.id }));

      executeGitPull(supabase, row?.id);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Git Pull Server listening on http://${HOST}:${PORT}`);
  console.log(`🔄 Polling database every ${POLL_INTERVAL_MS / 1000}s for update requests`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  const ip = Object.values(require('os').networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address;
  if (ip) console.log(`🌐 Accessible from LAN: http://${ip}:${PORT}`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });

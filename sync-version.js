#!/usr/bin/env node
/**
 * Sync Current Git Version to Database
 * 
 * Dette scriptet synkroniserer den nåværende Git commit SHA med Supabase-databasen.
 * Kjør dette scriptet én gang for å synkronisere versjonen første gang.
 * 
 * Bruk:
 * node sync-version.js
 * 
 * Krever at .env filen er konfigurert med VITE_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const execAsync = promisify(exec);

async function syncVersion() {
  try {
    console.log('Henter nåværende Git commit SHA...');
    
    // Get current commit SHA
    const { stdout: shaOutput } = await execAsync('git rev-parse HEAD');
    const commitSha = shaOutput.trim();
    
    console.log(`Funnet commit SHA: ${commitSha}`);
    
    // Get Supabase credentials
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('Feil: VITE_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY mangler i .env filen');
      process.exit(1);
    }
    
    console.log('Oppdaterer database...');
    
    // Update database
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

    await new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✓ Database oppdatert!');
            console.log(`  Installert versjon: ${commitSha.slice(0, 7)}`);
            resolve();
          } else {
            console.error('Feil ved oppdatering av database:', res.statusCode, body);
            reject(new Error(`Database error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Nettverksfeil:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
    
    console.log('\n✓ Synkronisering fullført!');
    console.log('Du kan nå sjekke versjonen i Admin → Updates');
    
  } catch (error) {
    console.error('Feil ved synkronisering:', error.message);
    process.exit(1);
  }
}

syncVersion();

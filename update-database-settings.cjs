#!/usr/bin/env node

/**
 * Update git-pull settings in Supabase database
 * Usage: node update-database-settings.cjs <git_pull_url> <git_pull_secret>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const gitPullUrl = process.argv[2];
const gitPullSecret = process.argv[3];

if (!gitPullUrl || !gitPullSecret) {
  console.error('Usage: node update-database-settings.cjs <git_pull_url> <git_pull_secret>');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  Supabase credentials not found. Skipping database update.');
  console.warn('   You will need to manually configure the settings in Admin Panel.');
  process.exit(0);
}

async function updateSettings() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Update or insert git_pull_server_url
    const { error: urlError } = await supabase
      .from('server_settings')
      .upsert({
        setting_key: 'git_pull_server_url',
        setting_value: gitPullUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (urlError) {
      throw new Error(`Failed to update git_pull_server_url: ${urlError.message}`);
    }

    // Update or insert git_pull_secret
    const { error: secretError } = await supabase
      .from('server_settings')
      .upsert({
        setting_key: 'git_pull_secret',
        setting_value: gitPullSecret,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (secretError) {
      throw new Error(`Failed to update git_pull_secret: ${secretError.message}`);
    }

    console.log('✅ Database settings updated successfully!');
    console.log(`   Git Pull Server URL: ${gitPullUrl}`);
    console.log(`   Git Pull Secret: ${gitPullSecret.substring(0, 10)}...`);
    
  } catch (error) {
    console.error('❌ Failed to update database settings:', error.message);
    console.warn('   You will need to manually configure the settings in Admin Panel.');
    process.exit(1);
  }
}

updateSettings();

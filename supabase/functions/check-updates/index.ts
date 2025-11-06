import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking for updates');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get GitHub repo URL from settings
    const { data: repoData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'github_repo_url')
      .maybeSingle();

    if (!repoData?.setting_value) {
      return new Response(
        JSON.stringify({ 
          error: 'GitHub repository ikke konfigurert',
          needsSetup: true
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract owner and repo from GitHub URL
    // Format: https://github.com/owner/repo or git@github.com:owner/repo.git
    const repoUrl = repoData.setting_value;
    let owner = '';
    let repo = '';

    if (repoUrl.includes('github.com')) {
      const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (match) {
        owner = match[1];
        repo = match[2];
      }
    }

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ 
          error: 'Ugyldig GitHub URL',
          needsSetup: true
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Checking GitHub: ${owner}/${repo}`);

    // Get latest commit from GitHub
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/main`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Jellyfin-Stream-Viewer'
        }
      }
    );

    if (!githubResponse.ok) {
      console.error('GitHub API error:', githubResponse.status);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke hente data fra GitHub',
          details: `Status: ${githubResponse.status}`
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const latestCommit = await githubResponse.json();

    // Get current installed version from settings
    const { data: versionData } = await supabase
      .from('server_settings')
      .select('setting_value')
      .eq('setting_key', 'installed_commit_sha')
      .maybeSingle();

    const installedSha = versionData?.setting_value || '';
    const latestSha = latestCommit.sha;
    const updateAvailable = installedSha !== latestSha;

    console.log(`Installed: ${installedSha.slice(0, 7)}, Latest: ${latestSha.slice(0, 7)}, Update available: ${updateAvailable}`);

    return new Response(
      JSON.stringify({
        updateAvailable,
        installedVersion: {
          sha: installedSha,
          shortSha: installedSha.slice(0, 7)
        },
        latestVersion: {
          sha: latestSha,
          shortSha: latestSha.slice(0, 7),
          message: latestCommit.commit.message,
          author: latestCommit.commit.author.name,
          date: latestCommit.commit.author.date
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error checking updates:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Ukjent feil' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

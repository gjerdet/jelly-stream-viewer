import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-update-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Syncing installed version from local repository');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the provided commit SHA from request
    const { commitSha } = await req.json();
    
    if (!commitSha || typeof commitSha !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'commitSha er påkrevd' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Updating installed version to: ${commitSha}`);

    // Update the installed_commit_sha in server_settings
    const { error: updateError } = await supabase
      .from('server_settings')
      .upsert({
        setting_key: 'installed_commit_sha',
        setting_value: commitSha,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (updateError) {
      console.error('Error updating installed version:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Kunne ikke oppdatere installert versjon',
          details: updateError.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully synced installed version');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Installert versjon synkronisert',
        commitSha: commitSha,
        shortSha: commitSha.slice(0, 7)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error syncing installed version:', error);
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

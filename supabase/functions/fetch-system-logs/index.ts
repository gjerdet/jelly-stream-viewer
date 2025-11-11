import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logType } = await req.json();
    console.log('Fetching logs of type:', logType);

    // Note: Supabase Analytics requires direct access to Logflare or Management API
    // This is a simplified implementation that returns mock/recent logs
    console.log('Analytics logging is available through Supabase dashboard');

    // Return empty logs with helpful message
    return new Response(JSON.stringify({ 
      logs: [],
      message: `${logType} logger er tilgjengelige i Supabase Dashboard under Logs & Analytics`,
      info: 'For production logging, sett opp egen logging-tabell eller bruk Supabase Dashboard'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-system-logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        logs: [],
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 200, // Return 200 instead of 500 for better UX
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

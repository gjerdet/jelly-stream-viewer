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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = '';
    let logs: any[] = [];

    switch (logType) {
      case 'auth':
        // Fetch auth logs
        query = `
          select id, auth_logs.timestamp, event_message, metadata.level, metadata.msg as msg
          from auth_logs
          cross join unnest(metadata) as metadata
          order by timestamp desc
          limit 100
        `;
        break;

      case 'database':
        // Fetch postgres logs
        query = `
          select identifier, postgres_logs.timestamp, id, event_message, parsed.error_severity
          from postgres_logs
          cross join unnest(metadata) as m
          cross join unnest(m.parsed) as parsed
          where parsed.error_severity != 'LOG'
          order by timestamp desc
          limit 100
        `;
        break;

      case 'edge':
        // Fetch edge function logs (HTTP calls)
        query = `
          select id, function_edge_logs.timestamp, event_message, 
                 response.status_code, request.method, m.function_id, 
                 m.execution_time_ms, m.deployment_id
          from function_edge_logs
          cross join unnest(metadata) as m
          cross join unnest(m.response) as response
          cross join unnest(m.request) as request
          order by timestamp desc
          limit 100
        `;
        break;

      default:
        throw new Error(`Unknown log type: ${logType}`);
    }

    // Execute analytics query
    const { data, error } = await supabase.rpc('run_analytics_query', {
      query_text: query
    });

    if (error) {
      console.error('Error fetching logs:', error);
      throw error;
    }

    // Parse event_message JSON strings if present
    logs = (data || []).map((log: any) => {
      try {
        if (log.event_message && typeof log.event_message === 'string') {
          const parsed = JSON.parse(log.event_message);
          return { ...log, ...parsed };
        }
        return log;
      } catch {
        return log;
      }
    });

    console.log(`Fetched ${logs.length} ${logType} logs`);

    return new Response(JSON.stringify({ logs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [] 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

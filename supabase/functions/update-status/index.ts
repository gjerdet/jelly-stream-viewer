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
    // Verify the update secret if configured
    const updateSecret = Deno.env.get('UPDATE_SECRET');
    const providedSecret = req.headers.get('x-update-secret');
    
    if (updateSecret && providedSecret !== updateSecret) {
      console.log('Invalid or missing update secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { updateId, status, progress, currentStep, logs, error } = await req.json();

    if (!updateId) {
      return new Response(
        JSON.stringify({ error: 'updateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating status for ${updateId}: status=${status}, progress=${progress}`);

    const updateData: Record<string, unknown> = {
      status,
      progress,
      current_step: currentStep,
      logs,
      updated_at: new Date().toISOString(),
    };

    if (error) {
      updateData.error = error;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error: updateError } = await supabase
      .from('update_status')
      .update(updateData)
      .eq('id', updateId)
      .select();

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully updated, rows affected: ${data?.length || 0}`);

    return new Response(
      JSON.stringify({ success: true, rowsAffected: data?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

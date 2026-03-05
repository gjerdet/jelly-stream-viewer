import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, details?: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ success: false, error: message, details: details ?? null, ...extra }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse optional updateId from body
    let updateId: string | null = null;
    try {
      const body = await req.json();
      updateId = body?.updateId ?? null;
    } catch { /* no body */ }

    // Create a new update_status record with status "requested"
    // The local git-pull-server will poll for this and execute the update
    const { data: statusRow, error: insertErr } = await supabase
      .from("update_status")
      .insert({
        status: "requested",
        progress: 0,
        current_step: "Ventar på at lokal server hentar oppdatering...",
        logs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          message: "📋 Oppdateringsforespørsel registrert — ventar på lokal server...",
          level: "info",
        }]),
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("trigger-update: insert error", insertErr);
      return fail("Kunne ikkje opprette oppdateringsstatus i databasen", insertErr.message);
    }

    const newUpdateId = statusRow?.id ?? updateId;

    console.log("trigger-update: queued update request", newUpdateId);
    return ok({
      success: true,
      message: "Oppdateringsforespørsel sendt — lokal server hentar og køyrer oppdatering automatisk",
      updateId: newUpdateId,
      queued: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("trigger-update unhandled:", msg);
    return fail("Uventa feil i edge-funksjonen", msg);
  }
});

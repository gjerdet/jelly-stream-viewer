import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function resp(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const { data: rows } = await supabase
      .from("server_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["update_webhook_url", "git_pull_server_url"]);

    const cfg = new Map<string, string>(
      (rows ?? []).map((r: { setting_key: string; setting_value: string }) => [r.setting_key, r.setting_value]),
    );

    const baseUrl =
      cfg.get("update_webhook_url") ||
      cfg.get("git_pull_server_url") ||
      "";

    if (!baseUrl) {
      return resp({
        ok: false,
        reason: "no_url",
        message: "Git Pull Server URL er ikkje konfigurert",
        details: "Gå til Admin → Servere og legg inn URL under «Git Pull Server URL».",
      });
    }

    // Try to reach the /health endpoint (strip trailing slash, handle /update path)
    let healthUrl: string;
    try {
      const u = new URL(baseUrl);
      u.pathname = "/health";
      u.search = "";
      healthUrl = u.toString();
    } catch {
      healthUrl = baseUrl.replace(/\/$/, "") + "/health";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let fetchRes: Response;
    try {
      fetchRes = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
    } catch (e: unknown) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg.includes("abort") || msg.includes("timeout");
      return resp({
        ok: false,
        reason: isTimeout ? "timeout" : "connection_failed",
        message: isTimeout
          ? `Tidsavbrot etter 10 sekund mot ${healthUrl}`
          : `Kunne ikkje nå git-pull serveren`,
        details: isTimeout
          ? "Sjekk at git-pull-server.js køyrer og er eksponert via offentleg URL."
          : `Feilmelding: ${msg}`,
        url: healthUrl,
      });
    }
    clearTimeout(timer);

    const body = await fetchRes.text().catch(() => "");

    if (!fetchRes.ok) {
      return resp({
        ok: false,
        reason: "http_error",
        message: `Serveren svarte med HTTP ${fetchRes.status}`,
        details: body || "Ingen responskropps",
        url: healthUrl,
        statusCode: fetchRes.status,
      });
    }

    return resp({
      ok: true,
      message: "Git Pull Server er tilgjengeleg ✅",
      details: body || "OK",
      url: healthUrl,
      statusCode: fetchRes.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return resp({
      ok: false,
      reason: "internal_error",
      message: "Uventa feil i edge-funksjonen",
      details: msg,
    });
  }
});

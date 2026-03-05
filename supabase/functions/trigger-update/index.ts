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
      status: 200, // Always 200 so the client can read the JSON body
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function hmac(payload: string, secret: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
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

    // Load webhook URL + secret from DB
    const { data: rows } = await supabase
      .from("server_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "update_webhook_url",
        "update_webhook_secret",
        "git_pull_server_url",
        "git_pull_secret",
      ]);

    const cfg = new Map<string, string>(
      (rows ?? []).map((r: { setting_key: string; setting_value: string }) => [r.setting_key, r.setting_value]),
    );

    const webhookUrl =
      cfg.get("update_webhook_url") ||
      cfg.get("git_pull_server_url") ||
      "";

    const secret =
      (Deno.env.get("UPDATE_SECRET") || "").trim() ||
      cfg.get("update_webhook_secret") ||
      cfg.get("git_pull_secret") ||
      "";

    // Validate URL
    if (!webhookUrl) {
      return fail(
        "Git pull server URL er ikkje konfigurert",
        "Gå til Admin → Servere og legg inn ein offentleg URL (t.d. via Cloudflare Tunnel) under «Git Pull Server URL».",
        { needsPublicUrl: true },
      );
    }

    // Parse optional updateId from body
    let updateId: string | null = null;
    try {
      const body = await req.json();
      updateId = body?.updateId ?? null;
    } catch { /* no body */ }

    const payload = JSON.stringify({ updateId });
    const sig = secret ? await hmac(payload, secret) : "";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sig) headers["X-Update-Signature"] = sig;

    // Call the git-pull server with a 20s timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: payload,
        signal: controller.signal,
      });
    } catch (e: unknown) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg.includes("abort") || msg.includes("timeout");
      return fail(
        isTimeout
          ? "Git pull server svarte ikkje innan 20 sekund (tidsavbrot)"
          : "Kunne ikkje nå git pull serveren",
        isTimeout
          ? `Tidsavbrot mot ${webhookUrl}. Sjekk at git-pull-server.js køyrer.`
          : `Feilmelding: ${msg}`,
        { connectionFailed: true },
      );
    }
    clearTimeout(timer);

    const responseText = await res.text().catch(() => "");

    if (!res.ok) {
      return fail(
        `Git pull server svarte med HTTP ${res.status}`,
        responseText || "Ingen detaljar",
        { connectionFailed: true },
      );
    }

    console.log("trigger-update: success", webhookUrl);
    return ok({ success: true, message: "Git pull starta på serveren", serverResponse: responseText });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("trigger-update unhandled:", msg);
    return fail("Uventa feil i edge-funksjonen", msg);
  }
});

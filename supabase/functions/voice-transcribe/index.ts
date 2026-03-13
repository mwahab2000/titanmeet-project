import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TRANSCRIBE_PER_DAY = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const correlationId = crypto.randomUUID();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit via service role
    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const today = new Date().toISOString().slice(0, 10);

    const { data: usage } = await svc
      .from("voice_usage")
      .select("transcribe_count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usage && usage.transcribe_count >= MAX_TRANSCRIBE_PER_DAY) {
      return new Response(JSON.stringify({
        code: "rate_limited",
        message: "Daily voice limit reached. Resets at midnight.",
        correlationId,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Increment usage
    await svc.from("voice_usage").upsert(
      { user_id: user.id, usage_date: today, transcribe_count: (usage?.transcribe_count ?? 0) + 1 },
      { onConflict: "user_id,usage_date" }
    );

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const languageMode = (formData.get("language_mode") as string) || "auto";

    if (!file) {
      return new Response(JSON.stringify({ error: "No audio file provided", correlationId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Whisper request
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "json");
    if (languageMode !== "auto") {
      whisperForm.append("language", languageMode);
    }

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error(`[voice-transcribe] Whisper error ${whisperRes.status}: ${errText} [${correlationId}]`);
      if (whisperRes.status === 429) {
        return new Response(JSON.stringify({ code: "rate_limited", message: "AI rate limited, try again shortly.", correlationId }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service unavailable", retryable: true, correlationId }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await whisperRes.json();

    return new Response(JSON.stringify({
      transcript: result.text ?? "",
      detected_language: result.language ?? languageMode,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[voice-transcribe] ${e} [${correlationId}]`);
    return new Response(JSON.stringify({ error: "Internal error", correlationId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

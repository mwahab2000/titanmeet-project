import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PARSE_PER_DAY = 50;

// ── System prompt v1.0 ──
const SYSTEM_PROMPT_V1 = `You are TitanMeet Voice Assistant helping event organizers.

DATABASE SCHEMA (use EXACTLY these field names):
- events: title(text), start_date(date YYYY-MM-DD), description(text), venue_name(text), status(draft|published)
- agenda_items: title(text), start_time(HH:MM 24hr text), end_time(HH:MM 24hr text), description(text)
- speakers: name(text), title(text), linkedin_url(text)
- attendees: name(text), email(text), mobile(text E.164)

RULES:
- start_date format: YYYY-MM-DD only
- start_time/end_time format: HH:MM (24hr) only
- mobile: must be E.164 format (+201234567890)
- Never use fields not listed above
- Do not propose setting a field already set in event_snapshot unless user explicitly requests a change
- Today is {date}
- Event snapshot: {event_snapshot}
- Additional context: {context}
- Previously confirmed actions: {confirmed_actions_summary}

AVAILABLE ACTION TYPES:
create_event, update_event_fields, add_agenda_item, update_agenda_item, delete_agenda_item,
set_venue, add_speaker, update_speaker, remove_speaker, send_invitations, publish_event,
request_manual_upload, run_publish_readiness

Return ONLY valid JSON:
{
  "pending_actions": [
    {
      "id": "uuid",
      "type": "action_type",
      "target": { "event_id": "uuid_or_null", "draft_key": "string_or_null" },
      "payload": {},
      "confidence": 0.0-1.0,
      "source_text": "original user text",
      "language": "detected language code",
      "requires_confirmation": true,
      "requires_manual_step": false,
      "manual_step": null,
      "created_at": "ISO timestamp",
      "source_chunk_id": "chunk_id",
      "action_group_id": "group_id"
    }
  ],
  "assistant_reply": "Friendly confirmation or clarifying question",
  "missing_fields": ["field1", "field2"]
}

If unclear, set confidence < 0.6 and ask for clarification.
Never invent data not mentioned by the user.`;

function buildSystemPrompt(date: string, eventSnapshot: unknown, context: unknown, confirmedSummary: unknown): string {
  const override = Deno.env.get("SYSTEM_PROMPT_OVERRIDE");
  const base = override || SYSTEM_PROMPT_V1;
  return base
    .replace("{date}", date)
    .replace("{event_snapshot}", JSON.stringify(eventSnapshot))
    .replace("{context}", JSON.stringify(context))
    .replace("{confirmed_actions_summary}", JSON.stringify(confirmedSummary ?? {}));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const correlationId = crypto.randomUUID();

  try {
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

    // Rate limit
    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await svc
      .from("voice_usage")
      .select("parse_count")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usage && usage.parse_count >= MAX_PARSE_PER_DAY) {
      return new Response(JSON.stringify({
        code: "rate_limited",
        message: "Daily voice limit reached. Resets at midnight.",
        correlationId,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await svc.from("voice_usage").upsert(
      { user_id: user.id, usage_date: today, parse_count: (usage?.parse_count ?? 0) + 1 },
      { onConflict: "user_id,usage_date" }
    );

    const body = await req.json();
    const { transcript_text, context, event_snapshot, language_mode, date, confirmed_actions_summary } = body;

    const systemPrompt = buildSystemPrompt(
      date || new Date().toISOString().slice(0, 10),
      event_snapshot || {},
      context || {},
      confirmed_actions_summary
    );

    // Call GPT-4o-mini
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript_text },
        ],
        temperature: 0.2,
        max_completion_tokens: 2000,
      }),
    });

    if (!gptRes.ok) {
      const errText = await gptRes.text();
      console.error(`[voice-parse-actions] GPT error ${gptRes.status}: ${errText} [${correlationId}]`);
      if (gptRes.status === 429) {
        return new Response(JSON.stringify({ code: "rate_limited", message: "AI rate limited.", correlationId }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service unavailable", retryable: true, correlationId }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gptData = await gptRes.json();
    const rawContent = gptData.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    let parsed: { pending_actions?: unknown[]; assistant_reply?: string; missing_fields?: string[] };
    try {
      // Try direct parse first
      parsed = JSON.parse(rawContent);
    } catch {
      // Try extracting JSON block
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Retry with GPT
          const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: transcript_text },
                { role: "assistant", content: rawContent },
                { role: "user", content: "RETURN ONLY JSON. No markdown, no explanation." },
              ],
              temperature: 0,
              max_completion_tokens: 2000,
            }),
          });

          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryContent = retryData.choices?.[0]?.message?.content ?? "";
            try {
              parsed = JSON.parse(retryContent);
            } catch {
              const m2 = retryContent.match(/\{[\s\S]*\}/);
              parsed = m2 ? JSON.parse(m2[0]) : {
                pending_actions: [],
                assistant_reply: "I didn't catch that clearly. Could you repeat?",
                missing_fields: [],
              };
            }
          } else {
            parsed = {
              pending_actions: [],
              assistant_reply: "I had trouble understanding. Could you repeat that?",
              missing_fields: [],
            };
          }
        }
      } else {
        parsed = {
          pending_actions: [],
          assistant_reply: "Could you repeat that? I need a clearer instruction.",
          missing_fields: [],
        };
      }
    }

    return new Response(JSON.stringify({
      pending_actions: parsed.pending_actions ?? [],
      assistant_reply: parsed.assistant_reply ?? "",
      missing_fields: parsed.missing_fields ?? [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[voice-parse-actions] ${e} [${correlationId}]`);
    return new Response(JSON.stringify({ error: "Internal error", correlationId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

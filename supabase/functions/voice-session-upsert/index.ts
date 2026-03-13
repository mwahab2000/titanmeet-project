import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authErr } = await client.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      event_id, draft_key, status, language_mode,
      transcript_append, pending_actions_set, context_merge,
      client_updated_at,
    } = body;

    // ── Find or create session ──
    let query = client
      .from("voice_sessions")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(1);

    // Draft→event migration: find by draft_key first
    if (draft_key && event_id) {
      query = query.eq("draft_key", draft_key);
    } else if (event_id) {
      query = query.eq("event_id", event_id);
    } else if (draft_key) {
      query = query.eq("draft_key", draft_key);
    }

    const { data: existing } = await query.maybeSingle();

    // ── Optimistic lock check ──
    if (existing && client_updated_at) {
      const serverTime = new Date(existing.updated_at).getTime();
      const clientTime = new Date(client_updated_at).getTime();
      if (serverTime > clientTime) {
        return new Response(JSON.stringify({ conflict: true, server_session: existing }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const now = new Date().toISOString();

    if (existing) {
      // ── Update existing ──
      const updates: Record<string, unknown> = { updated_at: now };

      // Draft→event migration
      if (draft_key && event_id) {
        updates.event_id = event_id;
        updates.draft_key = null;
      } else {
        if (event_id !== undefined) updates.event_id = event_id;
        if (draft_key !== undefined) updates.draft_key = draft_key;
      }

      if (status) {
        updates.status = status;
        if (status === "paused") updates.paused_at = now;
        if (status === "active") updates.last_heard_at = now;
      }
      if (language_mode) updates.language_mode = language_mode;

      // Append-only transcript
      if (transcript_append && Array.isArray(transcript_append) && transcript_append.length > 0) {
        const currentTranscript = Array.isArray(existing.transcript) ? existing.transcript : [];
        updates.transcript = [...currentTranscript, ...transcript_append];
        updates.last_heard_at = now;
      }

      // Full replace pending actions
      if (pending_actions_set !== undefined) {
        updates.pending_actions = pending_actions_set;
      }

      // Merge context
      if (context_merge && typeof context_merge === "object") {
        const currentContext = (existing.context && typeof existing.context === "object") ? existing.context : {};
        updates.context = { ...currentContext, ...context_merge };
      }

      const { data: updated, error: updateErr } = await client
        .from("voice_sessions")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ session: updated, created: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // ── Create new session ──
      const newSession: Record<string, unknown> = {
        user_id: user.id,
        event_id: event_id || null,
        draft_key: (!event_id && draft_key) ? draft_key : null,
        status: status || "paused",
        language_mode: language_mode || "auto",
        transcript: transcript_append || [],
        pending_actions: pending_actions_set || [],
        confirmed_actions: [],
        context: context_merge || {},
        last_heard_at: now,
        created_at: now,
        updated_at: now,
      };

      const { data: created, error: insertErr } = await client
        .from("voice_sessions")
        .insert(newSession)
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ session: created, created: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error(`[voice-session-upsert] ${e}`);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

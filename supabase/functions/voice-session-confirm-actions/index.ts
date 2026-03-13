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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { voice_session_id, confirm_action_ids, apply } = body;

    if (!voice_session_id || !Array.isArray(confirm_action_ids)) {
      return new Response(JSON.stringify({ error: "Missing voice_session_id or confirm_action_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch session (user-scoped via RLS)
    const { data: session, error: fetchErr } = await userClient
      .from("voice_sessions")
      .select("*")
      .eq("id", voice_session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pending: any[] = Array.isArray(session.pending_actions) ? session.pending_actions : [];
    const confirmed: any[] = Array.isArray(session.confirmed_actions) ? session.confirmed_actions : [];
    const idsSet = new Set(confirm_action_ids);

    const toConfirm = pending.filter((a: any) => idsSet.has(a.id));
    const remaining = pending.filter((a: any) => !idsSet.has(a.id));

    // Move to confirmed
    const newConfirmed = [...confirmed, ...toConfirm.map((a: any) => ({ ...a, confirmed_at: new Date().toISOString() }))];

    // Log each action
    for (const action of toConfirm) {
      await userClient.from("voice_action_log").insert({
        voice_session_id,
        user_id: user.id,
        event_id: session.event_id,
        action,
        status: apply ? "confirmed" : "proposed",
      });
    }

    // Execute if apply=true and event_id exists
    let executedCount = 0;
    let failedCount = 0;
    const failures: { action_id: string; error: string }[] = [];

    if (apply && session.event_id) {
      // Use service role for execution to bypass RLS edge cases
      const svc = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Verify ownership first
      const { data: event } = await userClient
        .from("events")
        .select("id, created_by")
        .eq("id", session.event_id)
        .single();

      if (!event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const action of toConfirm) {
        try {
          await executeAction(svc, session.event_id, action);
          executedCount++;

          // Update audit log
          await userClient.from("voice_action_log")
            .update({ status: "executed" })
            .eq("voice_session_id", voice_session_id)
            .eq("status", "confirmed")
            .contains("action", { id: action.id });
        } catch (e: any) {
          failedCount++;
          failures.push({ action_id: action.id, error: e.message || String(e) });

          await userClient.from("voice_action_log")
            .update({ status: "failed", error: e.message })
            .eq("voice_session_id", voice_session_id)
            .eq("status", "confirmed")
            .contains("action", { id: action.id });
        }
      }
    }

    // Update session
    await userClient.from("voice_sessions").update({
      pending_actions: remaining,
      confirmed_actions: newConfirmed,
      updated_at: new Date().toISOString(),
    }).eq("id", voice_session_id);

    return new Response(JSON.stringify({
      executed_count: executedCount,
      failed_count: failedCount,
      failures,
      confirmed_count: toConfirm.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[voice-session-confirm-actions] ${e}`);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeAction(svc: any, eventId: string, action: any) {
  const { type, payload } = action;

  switch (type) {
    case "update_event_fields": {
      const allowed = ["title", "start_date", "description", "venue_name"];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (payload[key] !== undefined) updates[key] = payload[key];
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await svc.from("events").update(updates).eq("id", eventId);
        if (error) throw error;
      }
      break;
    }
    case "set_venue": {
      const { error } = await svc.from("events").update({ venue_name: payload.venue_name }).eq("id", eventId);
      if (error) throw error;
      break;
    }
    case "add_agenda_item": {
      const { error } = await svc.from("agenda_items").insert({
        event_id: eventId,
        title: payload.title,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        description: payload.description || payload.notes || null,
      });
      if (error) throw error;
      break;
    }
    case "add_speaker": {
      const { error } = await svc.from("speakers").insert({
        event_id: eventId,
        name: payload.name,
        title: payload.title || null,
        linkedin_url: payload.linkedin_url || null,
      });
      if (error) throw error;
      break;
    }
    case "publish_event": {
      const { error } = await svc.from("events").update({ status: "published" }).eq("id", eventId);
      if (error) throw error;
      break;
    }
    case "send_invitations": {
      // Invoke existing edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-event-invitations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_id: eventId }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`send-invitations failed: ${t}`);
      }
      await res.text();
      break;
    }
    case "delete_agenda_item": {
      if (payload.agenda_item_id) {
        const { error } = await svc.from("agenda_items").delete().eq("id", payload.agenda_item_id).eq("event_id", eventId);
        if (error) throw error;
      }
      break;
    }
    case "update_agenda_item": {
      if (payload.agenda_item_id) {
        const updates: Record<string, unknown> = {};
        if (payload.title) updates.title = payload.title;
        if (payload.start_time) updates.start_time = payload.start_time;
        if (payload.end_time) updates.end_time = payload.end_time;
        if (payload.description !== undefined) updates.description = payload.description;
        const { error } = await svc.from("agenda_items").update(updates).eq("id", payload.agenda_item_id).eq("event_id", eventId);
        if (error) throw error;
      }
      break;
    }
    case "update_speaker": {
      if (payload.speaker_id) {
        const updates: Record<string, unknown> = {};
        if (payload.name) updates.name = payload.name;
        if (payload.title) updates.title = payload.title;
        if (payload.linkedin_url) updates.linkedin_url = payload.linkedin_url;
        const { error } = await svc.from("speakers").update(updates).eq("id", payload.speaker_id).eq("event_id", eventId);
        if (error) throw error;
      }
      break;
    }
    case "remove_speaker": {
      if (payload.speaker_id) {
        const { error } = await svc.from("speakers").delete().eq("id", payload.speaker_id).eq("event_id", eventId);
        if (error) throw error;
      }
      break;
    }
    case "create_event":
    case "request_manual_upload":
    case "run_publish_readiness":
      // These are handled on the frontend, not executed server-side
      break;
    default:
      console.warn(`[voice-confirm] Unknown action type: ${type}`);
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const serviceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Public: validate token & get survey ──
    if (action === "get" && req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid token" }, 400);

      const db = serviceClient();
      const { data: invite } = await db
        .from("survey_invites")
        .select("*, surveys(*), attendees(name, email)")
        .eq("token", token)
        .single();

      if (!invite) return json({ error: "Survey not found" }, 404);
      if (invite.status === "submitted") return json({ error: "Already submitted", alreadySubmitted: true }, 400);

      // Mark opened
      if (!invite.opened_at) {
        await db
          .from("survey_invites")
          .update({ opened_at: new Date().toISOString(), status: "opened" })
          .eq("id", invite.id);
      }

      // Fetch questions
      const { data: questions } = await db
        .from("survey_questions")
        .select("id, question_text, type, required, order_index, settings")
        .eq("survey_id", invite.survey_id)
        .order("order_index");

      return json({
        survey: {
          id: invite.surveys.id,
          title: invite.surveys.title,
          description: invite.surveys.description,
        },
        questions: questions || [],
        attendee: { name: invite.attendees.name },
        invite_id: invite.id,
      });
    }

    // ── Public: submit response ──
    if (action === "submit" && req.method === "POST") {
      const body = await req.json();
      const { token, answers } = body;
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid token" }, 400);
      if (!answers || typeof answers !== "object") return json({ error: "Invalid answers" }, 400);

      const db = serviceClient();
      const { data: invite } = await db
        .from("survey_invites")
        .select("*")
        .eq("token", token)
        .single();

      if (!invite) return json({ error: "Survey not found" }, 404);
      if (invite.status === "submitted") return json({ error: "Already submitted" }, 400);

      const now = new Date().toISOString();

      // Insert into survey_responses
      const { data: response, error: respErr } = await db
        .from("survey_responses")
        .insert({
          survey_id: invite.survey_id,
          event_id: invite.event_id,
          respondent_id: invite.attendee_id,
          respondent_email: null,
          status: "submitted",
          submitted_at: now,
        })
        .select()
        .single();

      if (respErr) {
        console.error("Insert response error:", respErr);
        return json({ error: "Failed to save response" }, 500);
      }

      // Insert individual answers
      const { data: questions } = await db
        .from("survey_questions")
        .select("id, type")
        .eq("survey_id", invite.survey_id);

      const answerRows = (questions || [])
        .filter((q: any) => answers[q.id] !== undefined)
        .map((q: any) => {
          const val = answers[q.id];
          const row: any = {
            response_id: response.id,
            question_id: q.id,
            event_id: invite.event_id,
          };
          if (typeof val === "number") row.value_number = val;
          else if (typeof val === "string") row.value_text = val;
          else row.value_json = val;
          return row;
        });

      if (answerRows.length > 0) {
        await db.from("survey_answers").insert(answerRows);
      }

      // Update invite
      await db
        .from("survey_invites")
        .update({ submitted_at: now, status: "submitted" })
        .eq("id", invite.id);

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("survey-api error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

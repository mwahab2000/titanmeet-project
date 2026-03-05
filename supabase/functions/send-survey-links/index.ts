import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsOptions(req);
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { survey_id, event_id, invite_ids, base_url } = body;
    if (!survey_id || !event_id) return json({ error: "Missing fields" }, 400);

    // Verify ownership
    const { data: owns } = await supabase.rpc("owns_event", { _event_id: event_id });
    if (!owns) return json({ error: "Forbidden" }, 403);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get event + survey info
    const { data: eventData } = await db.from("events").select("title").eq("id", event_id).single();
    const { data: surveyData } = await db.from("surveys").select("title").eq("id", survey_id).single();

    // Get invites to send
    let query = db
      .from("survey_invites")
      .select("*, attendees(name, email)")
      .eq("survey_id", survey_id);

    if (invite_ids && invite_ids.length > 0) {
      query = query.in("id", invite_ids);
    } else {
      query = query.in("status", ["created"]);
    }

    const { data: invites } = await query;
    if (!invites || invites.length === 0) return json({ sent: 0, message: "No invites to send" });

    // Setup email
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return json({ error: "Email not configured" }, 500);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const rootUrl = base_url || "https://titanmeet.com";
    let sentCount = 0;

    for (const invite of invites) {
      const attendee = invite.attendees;
      if (!attendee?.email) continue;

      const surveyUrl = `${rootUrl}/s/${invite.token}`;
      const html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${eventData?.title || "Event"}</h1>
          </div>
          <div style="padding: 32px 24px;">
            <p style="color: #334155; font-size: 16px; margin-bottom: 8px;">Hi ${attendee.name},</p>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">We'd love to hear your feedback. Please take a moment to complete our survey:</p>
            <h2 style="color: #1e293b; font-size: 18px; margin: 16px 0 8px;">${surveyData?.title || "Survey"}</h2>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${surveyUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #3b82f6); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">Take Survey</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">This link is unique to you. Please do not share it.</p>
          </div>
          <div style="background: #f8fafc; padding: 16px 24px; text-align: center;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">Powered by TitanMeet</p>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `TitanMeet <${GMAIL_USER}>`,
          to: attendee.email,
          subject: `Survey: ${surveyData?.title || "Feedback"} - ${eventData?.title || "Event"}`,
          html,
        });

        await db
          .from("survey_invites")
          .update({ sent_at: new Date().toISOString(), status: "sent" })
          .eq("id", invite.id);

        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send to ${attendee.email}:`, emailErr);
      }
    }

    return json({ sent: sentCount, total: invites.length });
  } catch (err) {
    console.error("send-survey-links error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

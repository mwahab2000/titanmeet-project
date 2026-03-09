import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Process Email Queue
 * Called by a daily cron job. Picks up pending rows where send_at <= now(),
 * renders the onboarding email template, sends via Gmail SMTP, marks as sent.
 */

const APP_URL = "https://titanmeet.com";
const CHEATSHEET_PDF_LINK = "#"; // Replace with actual Supabase Storage URL
const HELP_CENTER_URL = "#"; // Replace with actual help center URL
const UNSUBSCRIBE_URL = "#"; // Replace with actual unsubscribe URL

// ── Email templates from the onboarding sequence doc ──

function getEmailTemplate(templateId: string, firstName: string): { subject: string; html: string } | null {
  const name = firstName || "there";

  const wrapper = (body: string) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Google Sans',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:32px 36px;font-size:14px;line-height:1.7;color:#334155;">
<span style="font-size:20px;font-weight:800;color:#1A7A4A;display:block;margin-bottom:24px;">✦ TitanMeet</span>
${body}
<div style="font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:24px;">
TitanMeet · <a href="${UNSUBSCRIBE_URL}" style="color:#94a3b8;">Unsubscribe</a>
</div>
</div>
</body></html>`;

  const cta = (text: string, url: string) =>
    `<a href="${url}" style="display:inline-block;background:#1A7A4A;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;margin:8px 0 16px;">${text}</a>`;

  const taskBox = (title: string, content: string) =>
    `<div style="background:#E8F5EE;border:1px solid #A7F3D0;border-radius:8px;padding:14px 18px;margin:16px 0;">
<strong style="color:#1A7A4A;display:block;margin-bottom:4px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">${title}</strong>
${content}
</div>`;

  switch (templateId) {
    case "onboarding_day0":
      return {
        subject: `Your TitanMeet account is ready, ${name} 🎉`,
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">Welcome aboard, ${name}.</h2>
<p>Your account is active and ready. TitanMeet is built specifically for corporate event managers who need to create professional event websites, manage attendees, and communicate at scale — without the complexity of enterprise software.</p>
${taskBox("📋 Your Starter Kit", `Download your Quick Reference Cheat Sheet — a 2-page PDF with the complete workflow and publish checklist.<br/>${cta("Download Cheat Sheet", CHEATSHEET_PDF_LINK)}`)}
<p>In the next few days, we'll send you one short email per step — each with a single task that takes under 10 minutes. By Day 6 you'll have a live event page.</p>
<p>If you prefer to explore on your own, everything is at <a href="${APP_URL}" style="color:#1A7A4A;font-weight:700;">app.titanmeet.com</a>.</p>
<p style="margin-bottom:4px;">Questions? Reply to this email or open a support ticket from the app (Dashboard → Support).</p>
<p>— The TitanMeet Team</p>
`),
      };

    case "onboarding_day1":
      return {
        subject: "Step 1: Set up your client (takes 2 minutes)",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">First things first — create your Client.</h2>
<p>In TitanMeet, events live inside <strong>Clients</strong>. A client is simply the organisation you're managing events for (your company, or a client company if you're an agency).</p>
<p><strong>Your task today:</strong> Create your first client. It takes under 2 minutes.</p>
${cta("Create Your First Client →", `${APP_URL}/dashboard/clients/new`)}
<p style="font-size:13px;color:#64748b;">You'll need: <strong>Organisation name</strong> and a <strong>URL slug</strong> (e.g. <code>acme-corp</code>). The slug becomes part of your event URLs, so choose something professional.</p>
<p>Once your client is created, you're ready to build your first event tomorrow.</p>
<p>— TitanMeet Team</p>
`),
      };

    case "onboarding_day2":
      return {
        subject: "Build your first event in 10 minutes flat",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">Ready to build your first event?</h2>
<p>The <strong>Quick Event Wizard</strong> takes you through 6 steps in order — basics, hero image, venue, organizers & speakers, agenda, and a final review. Most users complete it in under 10 minutes.</p>
${taskBox("🎯 Today's Task", "Complete the Quick Event Wizard for your first event. You don't need everything perfect — you can always go back and edit later.")}
${cta("Open Quick Event Wizard →", `${APP_URL}/dashboard/events/quick-setup`)}
<p style="font-size:13px;color:#64748b;">What you'll need ready: event title, date & time, venue name, a hero/cover image (JPG or PNG, ideally 1920×1080px), and a short description.</p>
<p>— TitanMeet Team</p>
`),
      };

    case "onboarding_day4":
      return {
        subject: "Add your first attendees — 3 ways to do it",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">Time to populate your attendee list.</h2>
<p>There are three ways to add attendees in TitanMeet — choose the one that matches your situation:</p>
<p><strong>Option A — CSV Import (best for 10+ people):</strong> Export your guest list from Excel as a CSV with columns: Name, Email, Mobile. Upload it in the Attendees section.</p>
<p><strong>Option B — Manual Add (best for small groups):</strong> Add attendees one by one directly in the Attendees section.</p>
<p><strong>Option C — Invite Link (best for open registration):</strong> Share a public registration link from the Invitations section — attendees sign themselves up.</p>
${cta("Go to My Events →", `${APP_URL}/dashboard`)}
<p style="font-size:13px;color:#64748b;">Once attendees are added, you can organise them into <strong>Groups</strong> (VIP, Staff, Press, etc.) for targeted communications and transport assignments.</p>
<p>— TitanMeet Team</p>
`),
      };

    case "onboarding_day6":
      return {
        subject: "You're 7 checks away from going live",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">Let's get your event live today.</h2>
<p>Publishing your event page requires passing 7 checks. Most of them you've probably already completed:</p>
${taskBox("✅ The 7 Publish Requirements", `☐ Client selected<br/>☐ Event title<br/>☐ Event slug (URL identifier)<br/>☐ Event date set<br/>☐ Description written<br/>☐ At least 1 hero image uploaded<br/>☐ Venue name or location entered`)}
<p>Go to your event workspace → <strong>Website</strong> section to see which checks are passing. Fix any that aren't, then click <strong>Publish</strong>.</p>
${cta("Check My Publish Status →", `${APP_URL}/dashboard`)}
<p style="font-size:13px;color:#64748b;">Once published, copy your public URL and share it with your team or on your company intranet. Your attendees can view the full event page and RSVP directly.</p>
<p>— TitanMeet Team</p>
`),
      };

    case "onboarding_day9":
      return {
        subject: "The 2 TitanMeet features that save the most time",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">Running more than one event per year?</h2>
<p>These two features will save you hours:</p>
<p><strong>🗂 Templates:</strong> Once you've set up an event you're happy with, save it as a Template. Next time you create a similar event (same venue structure, same agenda format, same organizer team), apply the template and your workspace is pre-filled. Find it at Dashboard → Templates.</p>
<p><strong>📨 Bulk Communications:</strong> Send a single email or WhatsApp message to all attendees, a specific group, or selected individuals — directly from the Communications section in your event workspace. Every message is logged so your team always knows what was sent and when.</p>
${cta("Explore Templates →", `${APP_URL}/dashboard/templates`)}
<p>— TitanMeet Team</p>
`),
      };

    case "onboarding_day14":
      return {
        subject: "Two weeks in — here's everything at your fingertips",
        html: wrapper(`
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:12px;">You've got this. Here's your full resource list.</h2>
<p>It's been two weeks since you joined TitanMeet. Whether you've run your first event already or you're still setting things up — here's everything you need to move forward:</p>
<p>📚 <strong><a href="${HELP_CENTER_URL}" style="color:#1A7A4A;">Help Center</a></strong> — 7 articles covering every major feature, including a troubleshooting guide for publish issues.</p>
<p>📋 <strong><a href="${CHEATSHEET_PDF_LINK}" style="color:#1A7A4A;">Quick Reference Cheat Sheet</a></strong> — The 2-page PDF with workflow map and publish checklist.</p>
<p>🎟 <strong><a href="${APP_URL}/dashboard/billing" style="color:#1A7A4A;">Your Plan & Billing</a></strong> — Review your current usage and upgrade if you're approaching your limits.</p>
<p>🆘 <strong><a href="${APP_URL}/dashboard/support" style="color:#1A7A4A;">Support Tickets</a></strong> — Open a ticket any time from inside the app. We respond within 1 business day.</p>
${taskBox("🗓 Want a live walkthrough?", "We run a free 60-minute onboarding webinar every month. Reply to this email with \"webinar\" and we'll send you the next date.")}
<p>Thank you for being part of TitanMeet. We're building new features every month — watch your inbox for product updates.</p>
<p>— The TitanMeet Team</p>
`),
      };

    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const correlationId = crypto.randomUUID();

  try {
    // Authenticate: accept internal secret (for cron) or service role
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const isAuthed =
      (internalSecret && internalSecret === serviceRoleKey) ||
      (authHeader && authHeader === `Bearer ${serviceRoleKey}`);

    if (!isAuthed) {
      return new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pending emails where send_at <= now
    const { data: pendingEmails, error: fetchErr } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .order("send_at", { ascending: true })
      .limit(50);

    if (fetchErr) {
      console.error(`[${correlationId}] Error fetching queue:`, fetchErr);
      return new Response(JSON.stringify({ error: "Failed to fetch queue", correlationId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, correlationId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set up SMTP
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error(`[${correlationId}] Gmail credentials not configured`);
      return new Response(JSON.stringify({ error: "Email service unavailable", correlationId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    let sentCount = 0;
    let errorCount = 0;

    for (const row of pendingEmails) {
      const template = getEmailTemplate(row.template_id, row.first_name || "");

      if (!template) {
        console.warn(`[${correlationId}] Unknown template: ${row.template_id}`);
        await supabase
          .from("email_queue")
          .update({ status: "error", error: "Unknown template", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        errorCount++;
        continue;
      }

      try {
        await transporter.sendMail({
          from: `TitanMeet Team <${GMAIL_USER}>`,
          to: row.email,
          subject: template.subject,
          html: template.html,
        });

        await supabase
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);

        sentCount++;
      } catch (sendErr: any) {
        console.error(`[${correlationId}] Failed to send ${row.template_id} to ${row.email}:`, sendErr.message);
        await supabase
          .from("email_queue")
          .update({ status: "error", error: sendErr.message?.slice(0, 500), sent_at: new Date().toISOString() })
          .eq("id", row.id);
        errorCount++;
      }
    }

    console.log(`[${correlationId}] Processed: ${sentCount} sent, ${errorCount} errors`);
    return new Response(
      JSON.stringify({ success: true, processed: sentCount, errors: errorCount, correlationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[${correlationId}] process-email-queue error:`, err);
    return new Response(JSON.stringify({ error: "Internal error", correlationId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

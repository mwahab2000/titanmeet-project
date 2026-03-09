import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/**
 * Onboarding Email Trigger
 * Called via Supabase Database Webhook on INSERT to auth.users.
 * Inserts 7 rows into email_queue for the 14-day onboarding drip.
 */

const ONBOARDING_SCHEDULE = [
  { template_id: "onboarding_day0",  delay_days: 0  },
  { template_id: "onboarding_day1",  delay_days: 1  },
  { template_id: "onboarding_day2",  delay_days: 2  },
  { template_id: "onboarding_day4",  delay_days: 4  },
  { template_id: "onboarding_day6",  delay_days: 6  },
  { template_id: "onboarding_day9",  delay_days: 9  },
  { template_id: "onboarding_day14", delay_days: 14 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const correlationId = crypto.randomUUID();

  try {
    // This function is called by a database webhook — validate with internal secret
    const internalSecret = req.headers.get("x-internal-secret");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!internalSecret || internalSecret !== serviceRoleKey) {
      console.error(`[${correlationId}] Unauthorized call to onboarding-email-trigger`);
      return new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();

    // Database webhooks send { type, table, record, ... }
    const record = payload.record;
    if (!record) {
      console.error(`[${correlationId}] No record in webhook payload`);
      return new Response(JSON.stringify({ error: "No record provided", correlationId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = record.id;
    const email = record.email;
    const firstName =
      record.raw_user_meta_data?.full_name?.split(" ")[0] ||
      record.raw_user_meta_data?.name?.split(" ")[0] ||
      "";

    if (!userId || !email) {
      console.error(`[${correlationId}] Missing user id or email`);
      return new Response(JSON.stringify({ error: "Missing user data", correlationId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const rows = ONBOARDING_SCHEDULE.map((step) => {
      const sendAt = new Date(now.getTime() + step.delay_days * 24 * 60 * 60 * 1000);
      return {
        user_id: userId,
        email,
        first_name: firstName,
        template_id: step.template_id,
        send_at: sendAt.toISOString(),
        status: "pending",
      };
    });

    const { error } = await supabase.from("email_queue").insert(rows);

    if (error) {
      console.error(`[${correlationId}] Failed to insert email_queue rows:`, error);
      return new Response(JSON.stringify({ error: "Failed to queue emails", correlationId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${correlationId}] Queued ${rows.length} onboarding emails for ${email}`);
    return new Response(
      JSON.stringify({ success: true, queued: rows.length, correlationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[${correlationId}] onboarding-email-trigger error:`, err);
    return new Response(JSON.stringify({ error: "Internal error", correlationId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

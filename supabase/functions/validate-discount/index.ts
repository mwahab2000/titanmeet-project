import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }).auth.getUser();
      userId = user?.id ?? null;
    }

    const body = await req.json();
    const { action } = body;

    // ── Record redemption (service-role insert) ──
    if (action === "record_redemption") {
      const { discountCodeId, customerEmail, subscriptionId, paddleCustomerId, paddleTransactionId, planApplied, billingInterval, status } = body;
      const redemptionStatus = status || "pending";

      // For "applied" status with a transaction ID, use upsert to prevent duplicates
      if (redemptionStatus === "applied" && paddleTransactionId) {
        // Try to find and update existing pending redemption first
        const { data: existing } = await sb
          .from("discount_code_redemptions")
          .select("id")
          .eq("discount_code_id", discountCodeId)
          .eq("user_id", userId || body.userId)
          .eq("status", "pending")
          .order("redeemed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Finalize existing pending redemption
          const { error } = await sb.from("discount_code_redemptions").update({
            status: "applied",
            subscription_id: subscriptionId,
            paddle_customer_id: paddleCustomerId,
            paddle_transaction_id: paddleTransactionId,
            customer_email: customerEmail,
            metadata: body.metadata || {},
          }).eq("id", existing.id);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ ok: true, updated: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Insert new redemption record
      const { error } = await sb.from("discount_code_redemptions").insert({
        discount_code_id: discountCodeId,
        user_id: userId || body.userId,
        customer_email: customerEmail,
        subscription_id: subscriptionId,
        paddle_customer_id: paddleCustomerId,
        paddle_transaction_id: paddleTransactionId,
        plan_applied: planApplied,
        billing_interval: billingInterval,
        status: redemptionStatus,
        metadata: body.metadata || {},
      });
      if (error) {
        // Handle unique constraint violation for duplicate transactions gracefully
        if (error.code === "23505") {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Abandon stale pending redemptions ──
    if (action === "abandon_pending") {
      const { discountCodeId } = body;
      const targetUserId = userId || body.userId;
      if (targetUserId && discountCodeId) {
        await sb.from("discount_code_redemptions")
          .update({ status: "abandoned" })
          .eq("discount_code_id", discountCodeId)
          .eq("user_id", targetUserId)
          .eq("status", "pending");
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate discount code ──
    const { code, planId, interval } = body;
    if (!code || !planId || !interval) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_INVALID", error_message: "Missing required fields." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = code.trim().toUpperCase();
    const { data: dc, error: fetchErr } = await sb
      .from("discount_codes")
      .select("*")
      .eq("code", normalized)
      .maybeSingle();

    if (fetchErr || !dc) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_INVALID", error_message: "This discount code is not valid." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dc.is_active) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_INACTIVE", error_message: "This discount code is no longer active." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    if (dc.starts_at && new Date(dc.starts_at) > now) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_INACTIVE", error_message: "This discount code is not yet active." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (dc.expires_at && new Date(dc.expires_at) < now) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_EXPIRED", error_message: "This discount code has expired." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plans = Array.isArray(dc.applicable_plans) ? dc.applicable_plans : [];
    if (plans.length > 0 && !plans.includes(planId)) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_NOT_VALID_FOR_PLAN", error_message: "This code doesn't apply to the selected plan." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intervals = Array.isArray(dc.applicable_intervals) ? dc.applicable_intervals : [];
    if (intervals.length > 0 && !intervals.includes(interval)) {
      return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_NOT_VALID_FOR_INTERVAL", error_message: "This code doesn't apply to the selected billing interval." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Global limit — only count applied redemptions
    if (dc.max_redemptions != null) {
      const { count } = await sb
        .from("discount_code_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_code_id", dc.id)
        .eq("status", "applied");
      if ((count ?? 0) >= dc.max_redemptions) {
        return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_REDEMPTION_LIMIT_REACHED", error_message: "This discount code has reached its maximum uses." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Per-customer limit — only count applied redemptions
    if (dc.max_redemptions_per_customer != null && userId) {
      const { count } = await sb
        .from("discount_code_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_code_id", dc.id)
        .eq("user_id", userId)
        .eq("status", "applied");
      if ((count ?? 0) >= dc.max_redemptions_per_customer) {
        return new Response(JSON.stringify({ valid: false, error_code: "DISCOUNT_CODE_PER_CUSTOMER_LIMIT_REACHED", error_message: "You've already used this discount code." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      valid: true,
      error_code: null,
      error_message: null,
      discount: {
        id: dc.id,
        code: dc.code,
        discount_type: dc.discount_type,
        discount_value: dc.discount_value,
        duration_type: dc.duration_type,
        duration_cycles: dc.duration_cycles,
        paddle_discount_id: dc.paddle_discount_id,
        description: dc.description,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

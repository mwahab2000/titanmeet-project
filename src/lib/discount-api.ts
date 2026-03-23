import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────
export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  paddle_discount_id: string | null;
  discount_type: string;
  discount_value: number;
  applicable_plans: string[];
  applicable_intervals: string[];
  duration_type: string;
  duration_cycles: number | null;
  max_redemptions: number | null;
  max_redemptions_per_customer: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type RedemptionStatus = "pending" | "applied" | "failed" | "abandoned";

export interface DiscountRedemption {
  id: string;
  discount_code_id: string;
  user_id: string | null;
  customer_email: string | null;
  subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_transaction_id: string | null;
  plan_applied: string;
  billing_interval: string;
  redeemed_at: string;
  status: RedemptionStatus;
  metadata: Record<string, unknown>;
}

export type DiscountErrorCode =
  | "DISCOUNT_CODE_INVALID"
  | "DISCOUNT_CODE_EXPIRED"
  | "DISCOUNT_CODE_INACTIVE"
  | "DISCOUNT_CODE_NOT_VALID_FOR_PLAN"
  | "DISCOUNT_CODE_NOT_VALID_FOR_INTERVAL"
  | "DISCOUNT_CODE_REDEMPTION_LIMIT_REACHED"
  | "DISCOUNT_CODE_PER_CUSTOMER_LIMIT_REACHED";

export interface DiscountValidationResult {
  valid: boolean;
  error_code: DiscountErrorCode | null;
  error_message: string | null;
  discount: {
    code: string;
    discount_type: string;
    discount_value: number;
    duration_type: string;
    duration_cycles: number | null;
    paddle_discount_id: string | null;
    description: string | null;
  } | null;
}

const ERROR_MESSAGES: Record<DiscountErrorCode, string> = {
  DISCOUNT_CODE_INVALID: "This discount code is not valid.",
  DISCOUNT_CODE_EXPIRED: "This discount code has expired.",
  DISCOUNT_CODE_INACTIVE: "This discount code is no longer active.",
  DISCOUNT_CODE_NOT_VALID_FOR_PLAN: "This code doesn't apply to the selected plan.",
  DISCOUNT_CODE_NOT_VALID_FOR_INTERVAL: "This code doesn't apply to the selected billing interval.",
  DISCOUNT_CODE_REDEMPTION_LIMIT_REACHED: "This discount code has reached its maximum uses.",
  DISCOUNT_CODE_PER_CUSTOMER_LIMIT_REACHED: "You've already used this discount code.",
};

export function getDiscountErrorMessage(code: DiscountErrorCode): string {
  return ERROR_MESSAGES[code] || "Invalid discount code.";
}

// ── Validation ─────────────────────────────────────────────────
export async function validateDiscountCode(
  code: string,
  planId: string,
  interval: "monthly" | "annual",
  userId?: string,
): Promise<DiscountValidationResult> {
  const normalized = code.trim().toUpperCase();

  const { data: dc, error } = await supabase
    .from("discount_codes" as any)
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !dc) {
    return { valid: false, error_code: "DISCOUNT_CODE_INVALID", error_message: ERROR_MESSAGES.DISCOUNT_CODE_INVALID, discount: null };
  }

  const d = dc as any as DiscountCode;

  if (!d.is_active) {
    return { valid: false, error_code: "DISCOUNT_CODE_INACTIVE", error_message: ERROR_MESSAGES.DISCOUNT_CODE_INACTIVE, discount: null };
  }

  const now = new Date();
  if (d.starts_at && new Date(d.starts_at) > now) {
    return { valid: false, error_code: "DISCOUNT_CODE_INACTIVE", error_message: ERROR_MESSAGES.DISCOUNT_CODE_INACTIVE, discount: null };
  }
  if (d.expires_at && new Date(d.expires_at) < now) {
    return { valid: false, error_code: "DISCOUNT_CODE_EXPIRED", error_message: ERROR_MESSAGES.DISCOUNT_CODE_EXPIRED, discount: null };
  }

  const plans: string[] = Array.isArray(d.applicable_plans) ? d.applicable_plans : [];
  if (plans.length > 0 && !plans.includes(planId)) {
    return { valid: false, error_code: "DISCOUNT_CODE_NOT_VALID_FOR_PLAN", error_message: ERROR_MESSAGES.DISCOUNT_CODE_NOT_VALID_FOR_PLAN, discount: null };
  }

  const intervals: string[] = Array.isArray(d.applicable_intervals) ? d.applicable_intervals : [];
  if (intervals.length > 0 && !intervals.includes(interval)) {
    return { valid: false, error_code: "DISCOUNT_CODE_NOT_VALID_FOR_INTERVAL", error_message: ERROR_MESSAGES.DISCOUNT_CODE_NOT_VALID_FOR_INTERVAL, discount: null };
  }

  // Check global redemption limit (only count applied redemptions)
  if (d.max_redemptions != null) {
    const { count } = await supabase
      .from("discount_code_redemptions" as any)
      .select("id", { count: "exact", head: true })
      .eq("discount_code_id", d.id)
      .eq("status", "applied");
    if ((count ?? 0) >= d.max_redemptions) {
      return { valid: false, error_code: "DISCOUNT_CODE_REDEMPTION_LIMIT_REACHED", error_message: ERROR_MESSAGES.DISCOUNT_CODE_REDEMPTION_LIMIT_REACHED, discount: null };
    }
  }

  // Check per-customer limit (only count applied redemptions)
  if (d.max_redemptions_per_customer != null && userId) {
    const { count } = await supabase
      .from("discount_code_redemptions" as any)
      .select("id", { count: "exact", head: true })
      .eq("discount_code_id", d.id)
      .eq("user_id", userId)
      .eq("status", "applied");
    if ((count ?? 0) >= d.max_redemptions_per_customer) {
      return { valid: false, error_code: "DISCOUNT_CODE_PER_CUSTOMER_LIMIT_REACHED", error_message: ERROR_MESSAGES.DISCOUNT_CODE_PER_CUSTOMER_LIMIT_REACHED, discount: null };
    }
  }

  return {
    valid: true,
    error_code: null,
    error_message: null,
    discount: {
      code: d.code,
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      duration_type: d.duration_type,
      duration_cycles: d.duration_cycles,
      paddle_discount_id: d.paddle_discount_id,
      description: d.description,
    },
  };
}

// ── Redemption tracking ────────────────────────────────────────
// Create a pending redemption before checkout opens (will be finalized by webhook)
export async function createPendingRedemption(params: {
  discountCodeId: string;
  userId?: string;
  customerEmail?: string;
  planApplied: string;
  billingInterval: string;
}) {
  const { data, error } = await supabase.functions.invoke("validate-discount", {
    body: { action: "record_redemption", ...params, status: "pending" },
  });
  return { data, error };
}

// Finalize redemption after successful checkout (called by paddle webhook)
// This is NOT called from frontend — it's handled server-side
export async function recordRedemption(params: {
  discountCodeId: string;
  userId?: string;
  customerEmail?: string;
  subscriptionId?: string;
  paddleCustomerId?: string;
  paddleTransactionId?: string;
  planApplied: string;
  billingInterval: string;
}) {
  const { error } = await supabase.functions.invoke("validate-discount", {
    body: { action: "record_redemption", ...params, status: "applied" },
  });
  return { error };
}

// ── Admin CRUD ─────────────────────────────────────────────────
export async function listDiscountCodes() {
  const { data, error } = await supabase
    .from("discount_codes" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return { data: (data as any as DiscountCode[]) || [], error };
}

export async function getDiscountRedemptions(codeId: string) {
  const { data, error } = await supabase
    .from("discount_code_redemptions" as any)
    .select("*")
    .eq("discount_code_id", codeId)
    .order("redeemed_at", { ascending: false });
  return { data: (data as any as DiscountRedemption[]) || [], error };
}

export async function createDiscountCode(
  input: Partial<DiscountCode> & { code: string; created_by: string },
) {
  const { data, error } = await supabase
    .from("discount_codes" as any)
    .insert(input as any)
    .select()
    .single();
  return { data: data as any as DiscountCode | null, error };
}

export async function updateDiscountCode(id: string, updates: Partial<DiscountCode>) {
  const { data, error } = await supabase
    .from("discount_codes" as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  return { data: data as any as DiscountCode | null, error };
}

export async function toggleDiscountCode(id: string, is_active: boolean) {
  return updateDiscountCode(id, { is_active } as any);
}

// ── Price calculation helpers ──────────────────────────────────
export function calculateDiscountedPrice(
  basePrice: number,
  discountType: string,
  discountValue: number,
): number {
  if (discountType === "percent") {
    return Math.max(0, basePrice * (1 - discountValue / 100));
  }
  // fixed
  return Math.max(0, basePrice - discountValue);
}

export function formatDiscountSummary(
  discountType: string,
  discountValue: number,
  durationType?: string,
  durationCycles?: number | null,
): string {
  const amount = discountType === "percent" ? `${discountValue}% off` : `$${discountValue} off`;
  if (durationType === "forever") return amount;
  if (durationType === "repeating" && durationCycles) {
    return `${amount} for ${durationCycles} billing cycle${durationCycles > 1 ? "s" : ""}`;
  }
  return `${amount} (first billing cycle)`;
}

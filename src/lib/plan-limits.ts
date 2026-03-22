/**
 * Shared plan-limit types used by both frontend and edge functions.
 * Feature gating, quota responses, and error codes live here.
 */

/* ------------------------------------------------------------------ */
/*  Error codes                                                        */
/* ------------------------------------------------------------------ */

export type PlanLimitErrorCode =
  | "PLAN_LIMIT_EXCEEDED_CLIENTS"
  | "PLAN_LIMIT_EXCEEDED_EVENTS"
  | "PLAN_LIMIT_EXCEEDED_ATTENDEES"
  | "PLAN_LIMIT_EXCEEDED_ADMIN_USERS"
  | "PLAN_LIMIT_EXCEEDED_EMAILS"
  | "PLAN_LIMIT_EXCEEDED_WHATSAPP"
  | "PLAN_LIMIT_EXCEEDED_AI_PROMPTS"
  | "PLAN_LIMIT_EXCEEDED_AI_IMAGES"
  | "PLAN_LIMIT_EXCEEDED_BRAND_KITS"
  | "PLAN_LIMIT_EXCEEDED_STORAGE"
  | "FEATURE_NOT_AVAILABLE_ON_PLAN";

export type WarningLevel = "ok" | "soft_warning" | "hard_block";

/* ------------------------------------------------------------------ */
/*  Check response                                                     */
/* ------------------------------------------------------------------ */

export interface PlanCheckResponse {
  allowed: boolean;
  error_code: PlanLimitErrorCode | null;
  message: string;
  current_usage?: number;
  limit?: number | null;
  percent?: number;
  plan_id: string;
  warning_level?: WarningLevel;
  is_grandfathered?: boolean;
  upgrade_recommended?: boolean;
  resource?: string;
  feature?: string;
  correlationId?: string;
}

/* ------------------------------------------------------------------ */
/*  Feature gates                                                      */
/* ------------------------------------------------------------------ */

export type GatedFeature =
  | "segmentation"
  | "workspace_analytics"
  | "live_dashboard";

/* ------------------------------------------------------------------ */
/*  Resource types for quota checks                                    */
/* ------------------------------------------------------------------ */

export type QuotaResource =
  | "clients"
  | "active_events"
  | "attendees_per_event"
  | "admin_users"
  | "emails"
  | "whatsapp"
  | "ai_prompts"
  | "ai_images"
  | "brand_kits"
  | "storage";

/* ------------------------------------------------------------------ */
/*  Friendly error messages for UI                                     */
/* ------------------------------------------------------------------ */

export const PLAN_ERROR_MESSAGES: Record<PlanLimitErrorCode, string> = {
  PLAN_LIMIT_EXCEEDED_CLIENTS: "You've reached your client limit.",
  PLAN_LIMIT_EXCEEDED_EVENTS: "You've reached your monthly event limit.",
  PLAN_LIMIT_EXCEEDED_ATTENDEES: "This event has reached its attendee limit.",
  PLAN_LIMIT_EXCEEDED_ADMIN_USERS: "You've reached your admin user limit.",
  PLAN_LIMIT_EXCEEDED_EMAILS: "You've reached your monthly email limit.",
  PLAN_LIMIT_EXCEEDED_WHATSAPP: "You've reached your monthly WhatsApp message limit.",
  PLAN_LIMIT_EXCEEDED_AI_PROMPTS: "You've reached your monthly AI Builder prompt limit.",
  PLAN_LIMIT_EXCEEDED_AI_IMAGES: "You've reached your monthly AI image generation limit.",
  PLAN_LIMIT_EXCEEDED_BRAND_KITS: "You've reached your brand kit limit.",
  PLAN_LIMIT_EXCEEDED_STORAGE: "You've reached your storage limit.",
  FEATURE_NOT_AVAILABLE_ON_PLAN: "This feature is not available on your current plan.",
};

/* ------------------------------------------------------------------ */
/*  AI Builder-friendly responses                                      */
/* ------------------------------------------------------------------ */

export function getAIFriendlyLimitMessage(response: PlanCheckResponse): string {
  if (response.allowed && response.warning_level === "soft_warning") {
    return `⚠️ ${response.message} Consider upgrading for higher limits.`;
  }

  if (!response.allowed && response.error_code === "FEATURE_NOT_AVAILABLE_ON_PLAN") {
    return `This feature isn't available on your **${response.plan_id}** plan. Upgrade to Professional or Enterprise to unlock it.`;
  }

  if (!response.allowed && response.error_code) {
    const base = PLAN_ERROR_MESSAGES[response.error_code] || response.message;
    return `${base} Upgrade your plan to continue, or wait until your next billing cycle for monthly quotas to reset.`;
  }

  return response.message;
}

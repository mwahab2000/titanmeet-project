import { invokeEdgeFunction } from "@/integrations/supabase/client";

export type AiAction =
  | "event_builder"
  | "communications_draft"
  | "best_send_time"
  | "survey_analysis"
  | "dashboard_insights"
  | "agenda_generation"
  | "seo_optimization"
  | "event_chat";

interface AiRequest {
  action: AiAction;
  prompt?: string;
  context?: Record<string, unknown>;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface AiResponse<T = unknown> {
  result: T;
  correlationId: string;
}

export async function callAi<T = unknown>(request: AiRequest): Promise<T> {
  const { data, error } = await invokeEdgeFunction("ai-assistant", request as unknown as Record<string, unknown>);

  if (error) {
    throw new Error(error.message || "AI request failed");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return (data as AiResponse<T>).result;
}

/* ── Typed helpers ── */

export interface EventBuilderResult {
  title: string;
  slug: string;
  description: string;
  heroTagline: string;
  dressCode: string;
  suggestedTheme: string;
  agenda: Array<{ time: string; title: string; duration_minutes: number; speaker: string }>;
}

export interface CommsDraftResult {
  subject: string;
  body: string;
}

export interface BestSendTimeResult {
  recommendedTime: string;
  reason: string;
}

export interface SurveyAnalysisResult {
  summary: string;
  keyThemes: string[];
  sentiment: { positive: number; neutral: number; negative: number };
  topInsights: string[];
  npsScore: number | null;
}

export interface DashboardInsight {
  icon: string;
  message: string;
  severity: "info" | "warning" | "tip";
}

export interface AgendaItemAI {
  time: string;
  title: string;
  description: string;
  duration_minutes: number;
  type: string;
}

export interface SeoResult {
  improvedTitle: string;
  metaDescription: string;
  improvedDescription: string;
  suggestedSlug: string;
  seoTips: string[];
}

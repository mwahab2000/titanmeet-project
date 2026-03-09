import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5-mini";

/* ── action-specific system prompts ──────────────────────── */
const SYSTEM_PROMPTS: Record<string, string> = {
  event_builder: `You are an expert event planner AI. Given a natural-language description of an event, extract structured details. Return ONLY a JSON object with these fields:
{
  "title": string,
  "slug": string (lowercase, hyphens, no spaces),
  "description": string (2-3 sentences),
  "heroTagline": string (short catchy tagline),
  "dressCode": string (one of: business_formal, business_casual, smart_casual, semi_formal, formal),
  "suggestedTheme": string (one of: corporate, elegant, modern),
  "agenda": [{ "time": "HH:MM", "title": string, "duration_minutes": number, "speaker": string }]
}
Do not include any text outside the JSON object.`,

  communications_draft: `You are a professional event communications writer. Given event details and a communication type, write a message. Return ONLY a JSON object:
{
  "subject": string,
  "body": string
}
The body should be professional, warm, and concise (under 200 words). Do not include any text outside the JSON.`,

  best_send_time: `You are a communications timing expert. Given attendee distribution info, recommend the best time to send a message. Return ONLY a JSON object:
{
  "recommendedTime": string (e.g. "Tuesday 10:00 AM"),
  "reason": string (1-2 sentences)
}`,

  survey_analysis: `You are a data analyst specializing in event feedback. Analyze survey responses and return ONLY a JSON object:
{
  "summary": string (2-3 sentences),
  "keyThemes": [string, string, string],
  "sentiment": { "positive": number, "neutral": number, "negative": number },
  "topInsights": [string, string, string],
  "npsScore": number | null
}
Sentiment values should be percentages summing to 100.`,

  dashboard_insights: `You are an event management advisor. Given dashboard metrics, provide actionable insights. Return ONLY a JSON array:
[
  { "icon": string (one of: calendar, users, trending-up, clock, alert-triangle, check, sparkles), "message": string, "severity": "info" | "warning" | "tip" }
]
Provide 3-5 insights. Be specific and actionable.`,

  agenda_generation: `You are an expert event agenda designer. Given event parameters, create a detailed agenda. Return ONLY a JSON array:
[
  { "time": "HH:MM", "title": string, "description": string, "duration_minutes": number, "type": "keynote" | "break" | "workshop" | "networking" | "meal" | "other" }
]
Create a realistic, well-paced agenda with appropriate breaks.`,

  seo_optimization: `You are an SEO specialist for events. Given current event metadata, suggest optimizations. Return ONLY a JSON object:
{
  "improvedTitle": string (max 60 chars, keyword-rich),
  "metaDescription": string (max 160 chars),
  "improvedDescription": string,
  "suggestedSlug": string (lowercase, hyphens),
  "seoTips": [string, string, string]
}`,

  event_chat: `You are TitanMeet AI, a helpful event management assistant. You help event organizers manage their events effectively. You have access to the event's current context and can answer questions, draft messages, and provide recommendations. Be concise, friendly, and actionable. If asked to draft a message, provide the full text ready to copy.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured", correlationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, prompt, context, messages: chatMessages } = body;

    if (!action || !SYSTEM_PROMPTS[action]) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}`, correlationId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const model = Deno.env.get("AI_MODEL") || DEFAULT_MODEL;
    const systemPrompt = SYSTEM_PROMPTS[action];
    const isChat = action === "event_chat";

    // Build messages array
    const aiMessages: Array<{ role: string; content: string }> = [];

    if (isChat) {
      // For chat, include context in system prompt
      const contextStr = context ? `\n\nCurrent event context:\n${JSON.stringify(context, null, 2)}` : "";
      aiMessages.push({ role: "system", content: systemPrompt + contextStr });
      // Add conversation history
      if (Array.isArray(chatMessages)) {
        for (const m of chatMessages) {
          aiMessages.push({ role: m.role, content: m.content });
        }
      }
    } else {
      aiMessages.push({ role: "system", content: systemPrompt });
      // Build user prompt with context
      let userPrompt = prompt || "";
      if (context) {
        userPrompt = `Context:\n${JSON.stringify(context, null, 2)}\n\nRequest: ${userPrompt}`;
      }
      aiMessages.push({ role: "user", content: userPrompt });
    }

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        temperature: isChat ? 0.7 : 0.3,
        max_tokens: isChat ? 1000 : 2000,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment.", correlationId }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds.", correlationId }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error(`[${correlationId}] AI gateway error ${status}:`, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable", correlationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    if (isChat) {
      // Return raw text for chat
      return new Response(
        JSON.stringify({ result: rawContent, correlationId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For structured actions, parse JSON from the response
    let parsed: unknown;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error(`[${correlationId}] Failed to parse AI JSON:`, rawContent);
      return new Response(
        JSON.stringify({ error: "AI returned malformed response. Please try again.", raw: rawContent, correlationId }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ result: parsed, correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[${correlationId}] ai-assistant error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

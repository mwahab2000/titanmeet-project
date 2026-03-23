import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AIAction[];
  actionLog?: ActionLogEntry[];
}

export interface AIAction {
  type: "created" | "updated" | "added" | "warning" | "info" | "venue_search" | "venue_photos" | "proposal";
  label: string;
  detail?: string;
  status?: "pending" | "success" | "failed" | "skipped";
  data?: any;
}

export interface ActionLogEntry {
  action: string;
  target: string;
  status: "pending" | "success" | "failed" | "skipped";
  message: string;
  category?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface EventContext {
  clientId?: string;
  clientName?: string;
  eventId?: string;
  eventName?: string;
  eventStatus?: "draft" | "published" | "ongoing" | "completed" | "archived";
  mode?: "new_event" | "existing_draft";
}

export interface CompletedField {
  key: string;
  label: string;
  value: string;
}

export interface MissingField {
  key: string;
  label: string;
  priority: "required" | "recommended";
}

export interface DraftState {
  // Event context
  eventContext: EventContext;
  // Section statuses (legacy compat + enriched)
  client: { name?: string; slug?: string; id?: string; status: "empty" | "partial" | "done" };
  eventBasics: { title?: string; date?: string; location?: string; status: "empty" | "partial" | "done" };
  venue: { name?: string; address?: string; lat?: number; lng?: number; place_id?: string; photo_count?: number; status: "empty" | "partial" | "done" };
  organizers: { count: number; status: "empty" | "partial" | "done" };
  attendees: { count: number; status: "empty" | "partial" | "done" };
  agenda: { items: number; status: "empty" | "partial" | "done" };
  communications: { status: "empty" | "partial" | "done" };
  media: { heroCount: number; galleryCount: number; hasBanner: boolean; status: "empty" | "partial" | "done" };
  publishReadiness: { score: number; missing: string[]; status: "empty" | "partial" | "done" };
  // Enriched data
  speakers?: { count: number };
  description?: string;
  themeId?: string;
}

const emptyDraft: DraftState = {
  eventContext: {},
  client: { status: "empty" },
  eventBasics: { status: "empty" },
  venue: { status: "empty" },
  organizers: { count: 0, status: "empty" },
  attendees: { count: 0, status: "empty" },
  agenda: { items: 0, status: "empty" },
  communications: { status: "empty" },
  media: { heroCount: 0, galleryCount: 0, hasBanner: false, status: "empty" },
  publishReadiness: { score: 0, missing: [], status: "empty" },
};

function mapDraftState(raw: Record<string, any> | undefined): DraftState {
  if (!raw) return emptyDraft;

  const eventContext: EventContext = {
    clientId: raw.client_id || raw.eventContext?.clientId,
    clientName: raw.client?.name || raw.eventContext?.clientName,
    eventId: raw.event_id || raw.eventContext?.eventId,
    eventName: raw.eventBasics?.title || raw.eventContext?.eventName,
    eventStatus: raw.event_status || raw.eventContext?.eventStatus,
    mode: raw.event_mode || raw.eventContext?.mode,
  };

  return {
    eventContext,
    client: raw.client ?? emptyDraft.client,
    eventBasics: raw.eventBasics ?? emptyDraft.eventBasics,
    venue: raw.venue ?? emptyDraft.venue,
    organizers: raw.organizers ?? emptyDraft.organizers,
    attendees: raw.attendees ?? emptyDraft.attendees,
    agenda: raw.agenda ?? emptyDraft.agenda,
    communications: raw.communications ?? emptyDraft.communications,
    media: raw.media ?? emptyDraft.media,
    publishReadiness: raw.publishReadiness ?? emptyDraft.publishReadiness,
    speakers: raw.speakers,
    description: raw.description,
    themeId: raw.themeId,
  };
}

export function useAIBuilderSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, eventId?: string, clientId?: string, voiceMode?: boolean) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      abortRef.current = new AbortController();

      const { data, error } = await supabase.functions.invoke("ai-event-builder", {
        body: {
          sessionId,
          message: content,
          context: { eventId, clientId },
          voiceMode: voiceMode || false,
        },
      });

      if (error) {
        if (data?.rateLimited) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.error || "You've reached your usage limit. Please upgrade your plan or wait for the next billing period.",
            timestamp: new Date(),
            actions: [{
              type: "warning",
              label: data.burstBlocked ? "Rate limited — too many requests" : "Monthly usage limit reached",
              detail: `${data.usage}/${data.limit} ${data.resource || "requests"} used`,
            }],
          };
          setMessages((prev) => [...prev, assistantMsg]);
          return;
        }
        throw error;
      }

      if (data?.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const actionLog: ActionLogEntry[] = data?.actionLog || [];

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.reply || "I'm ready to help you build your event. What would you like to start with?",
        timestamp: new Date(),
        actions: data?.actions,
        actionLog,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data?.draft) {
        setDraft(mapDraftState(data.draft));
      }
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an issue connecting to the AI service. Please try again in a moment.",
        timestamp: new Date(),
        actions: [{ type: "warning", label: "Connection error", detail: err?.message || "Unknown error" }],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setDraft(emptyDraft);
    setSessionId(null);
  }, []);

  return { messages, draft, isLoading, sessionId: sessionId || "", sendMessage, clearSession };
}

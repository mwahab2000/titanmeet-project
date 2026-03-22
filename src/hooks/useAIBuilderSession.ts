import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: AIAction[];
}

export interface AIAction {
  type: "created" | "updated" | "added" | "warning" | "info" | "venue_search" | "venue_photos";
  label: string;
  detail?: string;
  data?: any;
}

export interface DraftState {
  client: { name?: string; slug?: string; id?: string; status: "empty" | "partial" | "done" };
  eventBasics: { title?: string; date?: string; location?: string; status: "empty" | "partial" | "done" };
  venue: { name?: string; address?: string; lat?: number; lng?: number; place_id?: string; photo_count?: number; status: "empty" | "partial" | "done" };
  organizers: { count: number; status: "empty" | "partial" | "done" };
  attendees: { count: number; status: "empty" | "partial" | "done" };
  agenda: { items: number; status: "empty" | "partial" | "done" };
  communications: { status: "empty" | "partial" | "done" };
  publishReadiness: { score: number; missing: string[]; status: "empty" | "partial" | "done" };
}

const emptyDraft: DraftState = {
  client: { status: "empty" },
  eventBasics: { status: "empty" },
  venue: { status: "empty" },
  organizers: { count: 0, status: "empty" },
  attendees: { count: 0, status: "empty" },
  agenda: { items: 0, status: "empty" },
  communications: { status: "empty" },
  publishReadiness: { score: 0, missing: [], status: "empty" },
};

function mapDraftState(raw: Record<string, any> | undefined): DraftState {
  if (!raw) return emptyDraft;
  return {
    client: raw.client ?? emptyDraft.client,
    eventBasics: raw.eventBasics ?? emptyDraft.eventBasics,
    venue: raw.venue ?? emptyDraft.venue,
    organizers: raw.organizers ?? emptyDraft.organizers,
    attendees: raw.attendees ?? emptyDraft.attendees,
    agenda: raw.agenda ?? emptyDraft.agenda,
    communications: raw.communications ?? emptyDraft.communications,
    publishReadiness: raw.publishReadiness ?? emptyDraft.publishReadiness,
  };
}

export function useAIBuilderSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, eventId?: string, clientId?: string) => {
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
        },
      });

      if (error) throw error;

      if (data?.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.reply || "I'm ready to help you build your event. What would you like to start with?",
        timestamp: new Date(),
        actions: data?.actions,
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

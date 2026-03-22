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
  type: "created" | "updated" | "added" | "warning" | "info";
  label: string;
  detail?: string;
}

export interface DraftState {
  client: { name?: string; slug?: string; status: "empty" | "partial" | "done" };
  eventBasics: { title?: string; date?: string; location?: string; status: "empty" | "partial" | "done" };
  venue: { name?: string; address?: string; status: "empty" | "partial" | "done" };
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

export function useAIBuilderSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
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
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.reply || "I'm ready to help you build your event. What would you like to start with?",
        timestamp: new Date(),
        actions: data?.actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data?.draft) {
        setDraft(data.draft);
      }
    } catch (err: any) {
      // If the edge function doesn't exist yet, provide a helpful fallback
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm currently being set up. The AI Event Builder backend (`ai-event-builder` edge function) needs to be deployed. Once connected, I'll be able to help you create clients, events, agendas, and manage your entire workflow conversationally.",
        timestamp: new Date(),
        actions: [{ type: "info", label: "Backend not connected", detail: "Deploy the ai-event-builder edge function to enable full functionality." }],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId]);

  const clearSession = useCallback(() => {
    setMessages([]);
    setDraft(emptyDraft);
  }, []);

  return { messages, draft, isLoading, sessionId, sendMessage, clearSession };
}

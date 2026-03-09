import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useEventWorkspaceOptional } from "@/contexts/EventWorkspaceContext";
import { callAi } from "@/lib/ai-api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "What's missing to publish?",
  "Summarize this event",
  "Draft a reminder message",
];

const AiChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctx = useEventWorkspaceOptional();
  const event = ctx?.event;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildContext = async () => {
    if (!event) return {};
    const [attRes, rsvpRes] = await Promise.all([
      supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("confirmed", true),
    ]);
    return {
      title: event.title,
      date: event.event_date,
      venue: event.venue_name,
      status: event.status,
      attendeeCount: attRes.count ?? 0,
      rsvpCount: rsvpRes.count ?? 0,
      slug: event.slug,
      description: event.description,
    };
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    const newMsg: ChatMsg = { role: "user", content: msg };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const context = await buildContext();
      const result = await callAi<string>({
        action: "event_chat",
        context,
        messages: updatedMessages,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result }]);
    } catch (err: any) {
      toast.error(err.message || "AI chat failed");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        title="TitanMeet AI"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[350px] h-[520px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold text-sm">TitanMeet AI</span>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-1 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2 pt-4">
              <p className="text-xs text-muted-foreground text-center mb-3">Try a quick prompt:</p>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2 flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your event..."
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="bg-purple-600 hover:bg-purple-700 text-white shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AiChatWidget;

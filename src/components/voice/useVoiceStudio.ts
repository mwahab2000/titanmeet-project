import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/integrations/supabase/client";
import type {
  VoiceSession,
  VoiceLanguage,
  TranscriptEntry,
  VoiceActionEnvelope,
  EventSnapshot,
  VoiceParseResponse,
} from "@/types/voice";
import { toast } from "sonner";

const RTL_LANGS = new Set(["ar"]);

interface UseVoiceStudioOptions {
  eventId: string | null;
  draftKey?: string | null;
  eventSnapshot: EventSnapshot;
}

export function useVoiceStudio({ eventId, draftKey, eventSnapshot }: UseVoiceStudioOptions) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pendingActions, setPendingActions] = useState<VoiceActionEnvelope[]>([]);
  const [confirmedActions, setConfirmedActions] = useState<VoiceActionEnvelope[]>([]);
  const [assistantReply, setAssistantReply] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [language, setLanguage] = useState<VoiceLanguage>("auto");
  const [status, setStatus] = useState<"idle" | "active" | "paused" | "processing">("idle");
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const lastParsedChunkRef = useRef<string | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkCounterRef = useRef(0);

  // ── Load existing session ──
  const loadSession = useCallback(async () => {
    const { data, error } = await invokeEdgeFunction<{ session: VoiceSession | null }>(
      "voice-session-get",
      { event_id: eventId, draft_key: draftKey }
    );
    if (error) {
      console.error("[VoiceStudio] session load error:", error);
      return;
    }
    const s = data?.session;
    if (s) {
      setSession(s);
      setTranscript(Array.isArray(s.transcript) ? s.transcript : []);
      setPendingActions(Array.isArray(s.pending_actions) ? s.pending_actions : []);
      setConfirmedActions(Array.isArray(s.confirmed_actions) ? s.confirmed_actions : []);
      setLanguage(s.language_mode as VoiceLanguage);
      lastParsedChunkRef.current = (s.context as any)?.last_parsed_chunk_id ?? null;
      setStatus(s.status === "active" ? "active" : "paused");
    }
  }, [eventId, draftKey]);

  // ── Upsert session ──
  const upsertSession = useCallback(
    async (updates: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {
        event_id: eventId,
        draft_key: draftKey,
        client_updated_at: session?.updated_at,
        ...updates,
      };
      const { data, error } = await invokeEdgeFunction<{
        session: VoiceSession;
        conflict?: boolean;
        created?: boolean;
      }>("voice-session-upsert", payload);

      if (error) {
        console.error("[VoiceStudio] upsert error:", error);
        return null;
      }
      if (data?.conflict) {
        // Server has newer data; reload
        await loadSession();
        return null;
      }
      if (data?.session) {
        setSession(data.session);
        return data.session;
      }
      return null;
    },
    [eventId, draftKey, session?.updated_at, loadSession]
  );

  // ── Clear silence timers ──
  const clearSilenceTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    silenceTimerRef.current = null;
    countdownRef.current = null;
    setSilenceCountdown(null);
  }, []);

  // ── Start silence countdown ──
  const startSilenceCountdown = useCallback(
    (onPause: () => void) => {
      clearSilenceTimers();
      // Wait 3s, then show countdown 7→0
      silenceTimerRef.current = setTimeout(() => {
        let remaining = 7;
        setSilenceCountdown(remaining);
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearSilenceTimers();
            onPause();
          } else {
            setSilenceCountdown(remaining);
          }
        }, 1000);
      }, 3000);
    },
    [clearSilenceTimers]
  );

  // ── Transcribe a chunk ──
  const transcribeChunk = useCallback(
    async (blob: Blob, mimeType: string): Promise<{ text: string; lang: string } | null> => {
      setIsTranscribing(true);

      const formData = new FormData();
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      formData.append("file", blob, `chunk.${ext}`);
      formData.append("language_mode", language);
      formData.append("mime_type", mimeType);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`;

      const tryFetch = async (): Promise<Response> => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        });
        return res;
      };

      try {
        let res = await tryFetch();

        if (res.status === 503) {
          const body = await res.json();
          if (body.retryable) {
            toast.info("AI service unavailable, retrying…");
            await new Promise((r) => setTimeout(r, 3000));
            res = await tryFetch();
            if (!res.ok) {
              await res.text();
              toast.error("Voice Studio paused — AI service unavailable. Session saved.");
              return null;
            }
          }
        }

        if (res.status === 429) {
          const body = await res.json();
          toast.error(body.message || "Rate limit reached");
          return null;
        }

        if (!res.ok) {
          await res.text();
          return null;
        }

        const data = await res.json();
        return { text: data.transcript || "", lang: data.detected_language || language };
      } catch (err) {
        console.error("[VoiceStudio] transcribe error:", err);
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    [language]
  );

  // ── Parse actions from new transcript ──
  const parseActions = useCallback(
    async (newSegments: TranscriptEntry[]) => {
      if (newSegments.length === 0) return;
      setIsParsing(true);

      const transcriptText = newSegments.map((s) => s.text).join(" ");

      try {
        const { data, error } = await invokeEdgeFunction<VoiceParseResponse>(
          "voice-parse-actions",
          {
            transcript_text: transcriptText,
            context: session?.context || {},
            event_snapshot: eventSnapshot,
            language_mode: language,
            date: new Date().toISOString().slice(0, 10),
            confirmed_actions_summary: confirmedActions.length > 0
              ? { count: confirmedActions.length, types: confirmedActions.map((a) => a.type) }
              : undefined,
          }
        );

        if (error) {
          console.error("[VoiceStudio] parse error:", error);
          return;
        }

        if (data) {
          if (data.assistant_reply) setAssistantReply(data.assistant_reply);
          if (data.missing_fields) setMissingFields(data.missing_fields);

          if (data.pending_actions && data.pending_actions.length > 0) {
            // Dedupe by action id
            setPendingActions((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const newActions = data.pending_actions.filter((a) => !existingIds.has(a.id));
              const merged = [...prev, ...newActions];
              // Persist
              upsertSession({ pending_actions_set: merged });
              return merged;
            });
          }
        }
      } catch (err) {
        console.error("[VoiceStudio] parse error:", err);
      } finally {
        setIsParsing(false);
      }
    },
    [session?.context, eventSnapshot, language, confirmedActions, upsertSession]
  );

  // ── Handle chunk from recorder ──
  const handleChunk = useCallback(
    async (blob: Blob, mimeType: string, onPause: () => void) => {
      const chunkId = `chunk_${Date.now()}_${chunkCounterRef.current++}`;

      const result = await transcribeChunk(blob, mimeType);

      if (!result || !result.text.trim()) {
        // Empty transcript → start silence detection
        startSilenceCountdown(onPause);
        return;
      }

      // Got text → clear any silence countdown
      clearSilenceTimers();

      const entry: TranscriptEntry = {
        ts: new Date().toISOString(),
        text: result.text,
        lang: result.lang,
        dir: RTL_LANGS.has(result.lang) ? "rtl" : "ltr",
        chunk_id: chunkId,
      };

      setTranscript((prev) => [...prev, entry]);

      // Persist transcript append
      await upsertSession({
        transcript_append: [entry],
        status: "active",
        language_mode: language,
        context_merge: { last_parsed_chunk_id: chunkId },
      });

      // Parse new segments
      const newSegments = [entry];
      lastParsedChunkRef.current = chunkId;
      await parseActions(newSegments);
    },
    [transcribeChunk, clearSilenceTimers, startSilenceCountdown, upsertSession, language, parseActions]
  );

  // ── Pause session ──
  const pauseSession = useCallback(async () => {
    clearSilenceTimers();
    setStatus("paused");
    await upsertSession({ status: "paused" });
  }, [clearSilenceTimers, upsertSession]);

  // ── Activate session ──
  const activateSession = useCallback(async () => {
    clearSilenceTimers();
    setStatus("active");
    await upsertSession({ status: "active", language_mode: language });
  }, [clearSilenceTimers, upsertSession, language]);

  // ── Confirm actions ──
  const confirmActions = useCallback(
    async (actionIds: string[]) => {
      if (!session) return;
      const apply = !!eventId;

      const { data, error } = await invokeEdgeFunction<{
        executed_count: number;
        failed_count: number;
        failures: { action_id: string; error: string }[];
      }>("voice-session-confirm-actions", {
        voice_session_id: session.id,
        confirm_action_ids: actionIds,
        apply,
      });

      if (error) {
        toast.error("Failed to confirm actions");
        return;
      }

      if (data) {
        if (data.executed_count > 0) {
          toast.success(`${data.executed_count} action(s) applied successfully`);
        }
        if (data.failed_count > 0) {
          toast.error(`${data.failed_count} action(s) failed`);
        }
      }

      // Move from pending to confirmed locally
      setPendingActions((prev) => {
        const idsSet = new Set(actionIds);
        return prev.filter((a) => !idsSet.has(a.id));
      });
      setConfirmedActions((prev) => {
        const idsSet = new Set(actionIds);
        const confirmed = pendingActions.filter((a) => idsSet.has(a.id));
        return [...prev, ...confirmed];
      });
    },
    [session, eventId, pendingActions]
  );

  // ── Discard actions ──
  const discardActions = useCallback(
    async (actionIds: string[]) => {
      const idsSet = new Set(actionIds);
      const remaining = pendingActions.filter((a) => !idsSet.has(a.id));
      setPendingActions(remaining);
      await upsertSession({ pending_actions_set: remaining });
    },
    [pendingActions, upsertSession]
  );

  // ── Update action (edit) ──
  const updateAction = useCallback(
    async (actionId: string, newPayload: Record<string, unknown>) => {
      const updated = pendingActions.map((a) =>
        a.id === actionId ? { ...a, payload: { ...a.payload, ...newPayload } } : a
      );
      setPendingActions(updated);
      await upsertSession({ pending_actions_set: updated });
    },
    [pendingActions, upsertSession]
  );

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      clearSilenceTimers();
    };
  }, [clearSilenceTimers]);

  return {
    session,
    transcript,
    pendingActions,
    confirmedActions,
    assistantReply,
    missingFields,
    language,
    setLanguage,
    status,
    silenceCountdown,
    isTranscribing,
    isParsing,
    loadSession,
    handleChunk,
    pauseSession,
    activateSession,
    confirmActions,
    discardActions,
    updateAction,
  };
}

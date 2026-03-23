import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceModeState =
  | "idle"
  | "listening"
  | "silence_detected"
  | "transcribing"
  | "auto_submitting"
  | "processing"
  | "responding"
  | "waiting_for_reply"
  | "paused_due_to_inactivity";

// ── Configurable thresholds ────────────────────────────────────
const SILENCE_THRESHOLD_MS = 1_200; // slightly longer to avoid cutting natural pauses
const INACTIVITY_TIMEOUT_MS = 15_000;
const RELISTEN_DELAY_MS = 1_400; // delay after response rendered before re-listen
const SILENCE_CHECK_INTERVAL_MS = 200;
const MIN_TRANSCRIPT_LENGTH = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Map spoken words to option numbers */
const SPOKEN_NUMBER_MAP: Record<string, number> = {
  one: 1, first: 1, "option one": 1, "number one": 1, "1": 1,
  two: 2, second: 2, "option two": 2, "number two": 2, "2": 2,
  three: 3, third: 3, "option three": 3, "number three": 3, "3": 3,
  four: 4, fourth: 4, "option four": 4, "number four": 4, "4": 4,
  five: 5, fifth: 5, "option five": 5, "number five": 5, "5": 5,
  six: 6, sixth: 6, "option six": 6, "6": 6,
  other: -1, "something else": -1,
};

/** Detect if assistant message contains numbered options */
export function hasNumberedOptions(text: string): boolean {
  const lines = text.split("\n");
  let numberedCount = 0;
  for (const line of lines) {
    if (/^\s*\d+[\.\)]\s+\S/.test(line)) numberedCount++;
  }
  return numberedCount >= 2;
}

/** Parse a spoken reply into an option number or cleaned text */
export function parseSpokenReply(spoken: string): { optionNumber: number | null; text: string } {
  const cleaned = spoken.trim().toLowerCase();
  for (const [key, val] of Object.entries(SPOKEN_NUMBER_MAP)) {
    if (cleaned === key || cleaned === key.replace(" ", "")) {
      return { optionNumber: val, text: spoken.trim() };
    }
  }
  const digitMatch = cleaned.match(/^(\d+)/);
  if (digitMatch) {
    return { optionNumber: parseInt(digitMatch[1], 10), text: spoken.trim() };
  }
  return { optionNumber: null, text: spoken.trim() };
}

interface UseVoiceModeOptions {
  onTranscript: (text: string) => void;
  isAiLoading: boolean;
  lastAssistantMessage?: string;
}

export function useVoiceMode({ onTranscript, isAiLoading, lastAssistantMessage }: UseVoiceModeOptions) {
  const [state, setState] = useState<VoiceModeState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Low-confidence fallback: transcript awaiting user confirmation
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track speech activity for silence detection
  const lastSpeechAtRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const bestConfidenceRef = useRef<number>(1);
  // Gate: only re-listen after response is rendered in the UI
  const responseRenderedRef = useRef(false);

  const isSupported = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (relistenTimerRef.current) { clearTimeout(relistenTimerRef.current); relistenTimerRef.current = null; }
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const submitTranscript = useCallback((text: string, confidence: number) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < MIN_TRANSCRIPT_LENGTH) {
      console.log("[VoiceMode] Empty or too-short transcript, skipping");
      setError("I didn't catch that. Try again.");
      setInterimTranscript("");
      setTimeout(() => {
        if (stateRef.current !== "idle") {
          setError(null);
          setState("waiting_for_reply");
        }
      }, 1500);
      return;
    }

    // Low-confidence → ask for confirmation instead of auto-submitting
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      console.log(`[VoiceMode] Low confidence (${confidence.toFixed(2)}), asking confirmation for: "${trimmed}"`);
      setPendingConfirmation(trimmed);
      setState("waiting_for_reply");
      setInterimTranscript("");
      return;
    }

    console.log(`[VoiceMode] Auto-submitting (confidence ${confidence.toFixed(2)}): "${trimmed}"`);
    setState("auto_submitting");
    setInterimTranscript("");
    setPendingConfirmation(null);
    onTranscript(trimmed);
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (!isSupported) { setError("Voice input not supported in this browser."); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // Request higher quality if supported
    recognition.maxAlternatives = 1;

    // Reset speech tracking
    lastSpeechAtRef.current = 0;
    hasSpeechRef.current = false;
    accumulatedTranscriptRef.current = "";
    bestConfidenceRef.current = 1;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      let minConfidence = 1;

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalText += transcript + " ";
          if (confidence > 0 && confidence < minConfidence) {
            minConfidence = confidence;
          }
        } else {
          interimText += transcript;
        }
      }

      const combined = (finalText + interimText).trim();
      if (combined) {
        lastSpeechAtRef.current = Date.now();
        hasSpeechRef.current = true;
        if (finalText.trim()) {
          accumulatedTranscriptRef.current = finalText.trim();
          bestConfidenceRef.current = minConfidence;
        }
      }
      setInterimTranscript(combined);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }

      const currentState = stateRef.current;
      if (currentState === "silence_detected" || currentState === "transcribing") {
        const transcript = accumulatedTranscriptRef.current.trim();
        const confidence = bestConfidenceRef.current;
        setState("transcribing");
        console.log(`[VoiceMode] Transcription complete: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
        setTimeout(() => {
          submitTranscript(transcript, confidence);
        }, 100);
        return;
      }

      if (currentState === "listening" && !hasSpeechRef.current) {
        console.log("[VoiceMode] No speech detected, pausing");
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      console.log(`[VoiceMode] Recognition error: ${event.error}`);
      if (event.error === "no-speech") {
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
        return;
      }
      if (event.error === "not-allowed") {
        setError("Microphone access denied.");
        setState("idle");
        return;
      }
      if (event.error !== "aborted") {
        setError(`Voice error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    setInterimTranscript("");
    setError(null);
    setPendingConfirmation(null);
    setState("listening");
    console.log("[VoiceMode] Started listening (1.2s silence threshold)");

    // Inactivity timer — pause if no speech at all for 15s
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (stateRef.current === "listening" && !hasSpeechRef.current) {
        console.log("[VoiceMode] 15s inactivity, pausing");
        stopRecognition();
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    }, INACTIVITY_TIMEOUT_MS);

    // Silence detection — poll for silence after speech started
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    silenceTimerRef.current = setInterval(() => {
      if (!hasSpeechRef.current) return;
      const elapsed = Date.now() - lastSpeechAtRef.current;
      if (elapsed >= SILENCE_THRESHOLD_MS && stateRef.current === "listening") {
        console.log(`[VoiceMode] ${SILENCE_THRESHOLD_MS}ms silence detected, stopping recognition`);
        setState("silence_detected");
        if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
        stopRecognition();
      }
    }, SILENCE_CHECK_INTERVAL_MS);

    try {
      recognition.start();
    } catch {
      setError("Could not start voice input.");
      setState("idle");
    }
  }, [isSupported, stopRecognition, submitTranscript]);

  const startVoiceMode = useCallback(() => {
    setError(null);
    setPendingConfirmation(null);
    responseRenderedRef.current = false;
    startListening();
  }, [startListening]);

  const stopVoiceMode = useCallback(() => {
    clearTimers();
    stopRecognition();
    setState("idle");
    setInterimTranscript("");
    setError(null);
    setPendingConfirmation(null);
    responseRenderedRef.current = false;
  }, [clearTimers, stopRecognition]);

  const resumeVoiceMode = useCallback(() => {
    setError(null);
    setPendingConfirmation(null);
    startListening();
  }, [startListening]);

  /** Called by the page when the bot response is fully rendered in the DOM */
  const notifyResponseRendered = useCallback(() => {
    if (stateRef.current === "idle") return;
    console.log("[VoiceMode] Response rendered, scheduling re-listen");
    responseRenderedRef.current = true;
  }, []);

  /** Confirm a low-confidence transcript */
  const confirmPendingTranscript = useCallback(() => {
    if (!pendingConfirmation) return;
    console.log(`[VoiceMode] User confirmed transcript: "${pendingConfirmation}"`);
    setState("auto_submitting");
    const text = pendingConfirmation;
    setPendingConfirmation(null);
    onTranscript(text);
  }, [pendingConfirmation, onTranscript]);

  /** Retry after low-confidence transcript */
  const retryPendingTranscript = useCallback(() => {
    console.log("[VoiceMode] User rejected transcript, retrying");
    setPendingConfirmation(null);
    startListening();
  }, [startListening]);

  // ── State transitions based on AI loading ────────────────────
  useEffect(() => {
    if (state === "idle") return;

    // AI started loading → mark as responding
    if (isAiLoading && (state === "auto_submitting" || state === "processing")) {
      setState("responding");
      responseRenderedRef.current = false; // reset render gate
    }

    // AI finished loading → wait for render, then re-listen
    if (!isAiLoading && state === "responding") {
      setState("waiting_for_reply");
      clearTimers();

      // Poll for responseRenderedRef (set by page) then schedule re-listen
      const pollInterval = setInterval(() => {
        if (responseRenderedRef.current) {
          clearInterval(pollInterval);
          const hasOptions = lastAssistantMessage && hasNumberedOptions(lastAssistantMessage);
          const delay = hasOptions ? RELISTEN_DELAY_MS : RELISTEN_DELAY_MS * 1.2;
          console.log(`[VoiceMode] Render confirmed, re-listen in ${delay}ms`);
          relistenTimerRef.current = setTimeout(() => {
            if (stateRef.current === "waiting_for_reply") {
              startListening();
            }
          }, delay);
        }
      }, 150);

      // Safety: if render signal never comes within 5s, re-listen anyway
      const safetyTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        if (stateRef.current === "waiting_for_reply") {
          console.log("[VoiceMode] Render signal timeout, re-listening anyway");
          relistenTimerRef.current = setTimeout(() => {
            if (stateRef.current === "waiting_for_reply") {
              startListening();
            }
          }, RELISTEN_DELAY_MS);
        }
      }, 5000);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(safetyTimeout);
      };
    }
  }, [isAiLoading, state, lastAssistantMessage, startListening, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      stopRecognition();
    };
  }, [clearTimers, stopRecognition]);

  return {
    state,
    interimTranscript,
    error,
    isSupported,
    isActive: state !== "idle",
    pendingConfirmation,
    startVoiceMode,
    stopVoiceMode,
    resumeVoiceMode,
    notifyResponseRendered,
    confirmPendingTranscript,
    retryPendingTranscript,
  };
}

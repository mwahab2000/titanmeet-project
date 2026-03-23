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

const SILENCE_THRESHOLD_MS = 1_000;
const INACTIVITY_TIMEOUT_MS = 15_000;
const RELISTEN_DELAY_MS = 1_200;
const SILENCE_CHECK_INTERVAL_MS = 200;

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

  const submitTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      // Too short / empty — don't submit junk
      console.log("[VoiceMode] Empty or too-short transcript, skipping");
      setError("I didn't catch that. Try again.");
      setInterimTranscript("");
      // Resume listening after a brief pause
      setTimeout(() => {
        if (stateRef.current !== "idle") {
          setError(null);
          setState("waiting_for_reply");
        }
      }, 1500);
      return;
    }
    console.log("[VoiceMode] Auto-submitting transcript:", trimmed);
    setState("auto_submitting");
    setInterimTranscript("");
    onTranscript(trimmed);
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (!isSupported) { setError("Voice input not supported in this browser."); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // Reset speech tracking
    lastSpeechAtRef.current = 0;
    hasSpeechRef.current = false;
    accumulatedTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      const combined = (finalText + interimText).trim();
      if (combined) {
        lastSpeechAtRef.current = Date.now();
        hasSpeechRef.current = true;
        accumulatedTranscriptRef.current = finalText.trim();
      }
      setInterimTranscript(combined);
    };

    recognition.onend = () => {
      // Recognition ended (browser-initiated or our stop call)
      if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }

      const currentState = stateRef.current;
      // If we're in silence_detected or transcribing, the submit is already handled
      if (currentState === "silence_detected" || currentState === "transcribing") {
        const transcript = accumulatedTranscriptRef.current.trim();
        setState("transcribing");
        // Small delay to show "transcribing" state visually
        setTimeout(() => {
          submitTranscript(transcript);
        }, 100);
        return;
      }

      // If still in listening and no speech was detected
      if (currentState === "listening" && !hasSpeechRef.current) {
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
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
    setState("listening");

    // Inactivity timer — pause if no speech at all for 15s
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (stateRef.current === "listening" && !hasSpeechRef.current) {
        stopRecognition();
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    }, INACTIVITY_TIMEOUT_MS);

    // Silence detection — poll for 1s of silence after speech started
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    silenceTimerRef.current = setInterval(() => {
      if (!hasSpeechRef.current) return; // No speech yet, let inactivity timer handle it
      const elapsed = Date.now() - lastSpeechAtRef.current;
      if (elapsed >= SILENCE_THRESHOLD_MS && stateRef.current === "listening") {
        console.log("[VoiceMode] 1s silence detected, stopping recognition");
        setState("silence_detected");
        // Clear inactivity timer since we're handling it
        if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
        stopRecognition(); // This triggers onend which handles submit
      }
    }, SILENCE_CHECK_INTERVAL_MS);

    try {
      recognition.start();
      console.log("[VoiceMode] Started listening (continuous, 1s silence threshold)");
    } catch {
      setError("Could not start voice input.");
      setState("idle");
    }
  }, [isSupported, clearTimers, stopRecognition, submitTranscript]);

  const startVoiceMode = useCallback(() => {
    setError(null);
    startListening();
  }, [startListening]);

  const stopVoiceMode = useCallback(() => {
    clearTimers();
    stopRecognition();
    setState("idle");
    setInterimTranscript("");
    setError(null);
  }, [clearTimers, stopRecognition]);

  const resumeVoiceMode = useCallback(() => {
    setError(null);
    startListening();
  }, [startListening]);

  // Track AI loading state transitions
  useEffect(() => {
    if (state === "idle") return;

    if (isAiLoading && (state === "processing" || state === "auto_submitting" || state === "listening" || state === "silence_detected" || state === "transcribing")) {
      setState("responding");
    }

    if (!isAiLoading && state === "responding") {
      // AI finished — re-listen after delay
      const hasOptions = lastAssistantMessage && hasNumberedOptions(lastAssistantMessage);
      setState("waiting_for_reply");
      clearTimers();
      relistenTimerRef.current = setTimeout(() => {
        if (stateRef.current === "waiting_for_reply") {
          startListening();
        }
      }, hasOptions ? RELISTEN_DELAY_MS : RELISTEN_DELAY_MS * 1.5);
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
    startVoiceMode,
    stopVoiceMode,
    resumeVoiceMode,
  };
}

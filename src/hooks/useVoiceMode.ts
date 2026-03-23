import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceModeState =
  | "idle"
  | "listening"
  | "processing"
  | "responding"
  | "waiting_for_reply"
  | "paused_due_to_inactivity";

const INACTIVITY_TIMEOUT_MS = 15_000;
const RELISTEN_DELAY_MS = 1_200;

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

/** Detect if assistant message contains numbered options (e.g. "1. Confirm") */
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
  // Check if starts with a digit
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
  const stateRef = useRef(state);
  stateRef.current = state;

  const isSupported = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (relistenTimerRef.current) { clearTimeout(relistenTimerRef.current); relistenTimerRef.current = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) { setError("Voice input not supported in this browser."); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalResult = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalResult += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript((finalResult + interim).trim());
    };

    recognition.onend = () => {
      const trimmed = finalResult.trim();
      if (trimmed && stateRef.current === "listening") {
        setState("processing");
        setInterimTranscript("");
        onTranscript(trimmed);
      } else if (stateRef.current === "listening") {
        // No speech detected — start inactivity timer
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

    // Start inactivity timer
    clearTimers();
    inactivityTimerRef.current = setTimeout(() => {
      if (stateRef.current === "listening") {
        stopRecognition();
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    }, INACTIVITY_TIMEOUT_MS);

    try {
      recognition.start();
    } catch {
      setError("Could not start voice input.");
      setState("idle");
    }
  }, [isSupported, onTranscript, clearTimers, stopRecognition]);

  // Start voice mode
  const startVoiceMode = useCallback(() => {
    setError(null);
    startListening();
  }, [startListening]);

  // Stop/exit voice mode
  const stopVoiceMode = useCallback(() => {
    clearTimers();
    stopRecognition();
    setState("idle");
    setInterimTranscript("");
    setError(null);
  }, [clearTimers, stopRecognition]);

  // Resume from paused
  const resumeVoiceMode = useCallback(() => {
    setError(null);
    startListening();
  }, [startListening]);

  // Track AI loading state transitions
  useEffect(() => {
    if (state === "idle") return;

    if (isAiLoading && (state === "processing" || state === "listening")) {
      setState("responding");
    }

    if (!isAiLoading && state === "responding") {
      // AI finished responding — check if we should re-listen
      const shouldRelisten = lastAssistantMessage && hasNumberedOptions(lastAssistantMessage);
      if (shouldRelisten) {
        setState("waiting_for_reply");
        clearTimers();
        relistenTimerRef.current = setTimeout(() => {
          if (stateRef.current === "waiting_for_reply") {
            startListening();
          }
        }, RELISTEN_DELAY_MS);
      } else {
        // Still relisten but with a slightly longer delay
        setState("waiting_for_reply");
        clearTimers();
        relistenTimerRef.current = setTimeout(() => {
          if (stateRef.current === "waiting_for_reply") {
            startListening();
          }
        }, RELISTEN_DELAY_MS * 1.5);
      }
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

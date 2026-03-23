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
const SILENCE_THRESHOLD_MS = 1_400;       // silence duration before ending utterance
const POST_SPEECH_TAIL_MS = 350;          // extra recording after silence to capture trailing words
const INACTIVITY_TIMEOUT_MS = 15_000;
const RELISTEN_DELAY_MS = 1_400;
const SILENCE_CHECK_INTERVAL_MS = 150;
const MIN_TRANSCRIPT_LENGTH = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.60;
const ENERGY_SILENCE_THRESHOLD = 0.015;   // RMS below this = silence (0–1 range)

// ── Filler words to strip ──────────────────────────────────────
const FILLER_PATTERN = /\b(uh|um|hmm|ah|er|like,?\s)/gi;
const REPEATED_WORD_PATTERN = /\b(\w+)\s+\1\b/gi;

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

// ── Transcript cleaning ────────────────────────────────────────
function cleanTranscript(raw: string): string {
  let text = raw.trim();
  // Remove filler words
  text = text.replace(FILLER_PATTERN, " ");
  // Remove repeated words ("the the" → "the")
  text = text.replace(REPEATED_WORD_PATTERN, "$1");
  // Collapse multiple spaces
  text = text.replace(/\s{2,}/g, " ");
  // Capitalize first letter
  text = text.trim();
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text;
}

// ── Confidence heuristic ───────────────────────────────────────
function computeConfidence(raw: string, apiConfidence: number): number {
  const cleaned = raw.trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);

  // Start from API confidence (Web Speech API returns 0 sometimes — treat as unknown/OK)
  let confidence = apiConfidence > 0 ? apiConfidence : 0.80;

  // Penalty: very short transcript (1-2 words that aren't option numbers)
  if (words.length <= 1 && !SPOKEN_NUMBER_MAP[cleaned]) {
    confidence *= 0.7;
  }

  // Penalty: mostly filler
  const nonFiller = cleaned.replace(FILLER_PATTERN, "").trim();
  if (nonFiller.length < 3) {
    confidence *= 0.4;
  }

  // Penalty: very short character count
  if (cleaned.length < 4) {
    confidence *= 0.6;
  }

  // Boost: matches a known option keyword exactly
  if (SPOKEN_NUMBER_MAP[cleaned]) {
    confidence = Math.max(confidence, 0.95);
  }

  return Math.max(0, Math.min(1, confidence));
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
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postSpeechTailRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Speech tracking
  const lastSpeechAtRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const lastInterimRef = useRef("");          // fallback if final is empty
  const bestConfidenceRef = useRef<number>(0);
  const responseRenderedRef = useRef(false);

  // Web Audio API refs for energy-based silence detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const isSupported = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // ── Audio energy helpers ─────────────────────────────────────
  const getAudioEnergy = useCallback((): number => {
    if (!analyserRef.current) return 0;
    const data = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length); // RMS
  }, []);

  const startAudioMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      console.log("[VoiceMode] Audio monitor started (16kHz, mono, noise suppression)");
    } catch (err) {
      console.warn("[VoiceMode] Could not start audio monitor:", err);
    }
  }, []);

  const stopAudioMonitor = useCallback(() => {
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch {} sourceRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // ── Timer cleanup ────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (relistenTimerRef.current) { clearTimeout(relistenTimerRef.current); relistenTimerRef.current = null; }
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (postSpeechTailRef.current) { clearTimeout(postSpeechTailRef.current); postSpeechTailRef.current = null; }
  }, []);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (postSpeechTailRef.current) { clearTimeout(postSpeechTailRef.current); postSpeechTailRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // ── Transcript submission ────────────────────────────────────
  const submitTranscript = useCallback((rawText: string, apiConfidence: number) => {
    const cleaned = cleanTranscript(rawText);
    const confidence = computeConfidence(rawText, apiConfidence);

    console.log(`[VoiceMode] Transcript: "${cleaned}" | raw: "${rawText}" | API conf: ${apiConfidence.toFixed(2)} | computed: ${confidence.toFixed(2)} | len: ${cleaned.length}`);

    if (!cleaned || cleaned.length < MIN_TRANSCRIPT_LENGTH) {
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

    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      console.log(`[VoiceMode] Low confidence (${confidence.toFixed(2)}), asking confirmation`);
      setPendingConfirmation(cleaned);
      setState("waiting_for_reply");
      setInterimTranscript("");
      return;
    }

    console.log(`[VoiceMode] Auto-submitting: "${cleaned}"`);
    setState("auto_submitting");
    setInterimTranscript("");
    setPendingConfirmation(null);
    onTranscript(cleaned);
  }, [onTranscript]);

  // ── Core listening logic ─────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSupported) { setError("Voice input not supported in this browser."); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    // Reset tracking
    lastSpeechAtRef.current = 0;
    hasSpeechRef.current = false;
    accumulatedTranscriptRef.current = "";
    lastInterimRef.current = "";
    bestConfidenceRef.current = 0;

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      let weightedConfidence = 0;
      let finalCount = 0;

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalText += transcript + " ";
          weightedConfidence += confidence;
          finalCount++;
        } else {
          interimText += transcript;
        }
      }

      const combined = (finalText + interimText).trim();
      if (combined) {
        lastSpeechAtRef.current = Date.now();
        hasSpeechRef.current = true;
        lastInterimRef.current = combined;  // always save latest for fallback
        if (finalText.trim()) {
          accumulatedTranscriptRef.current = finalText.trim();
          bestConfidenceRef.current = finalCount > 0 ? weightedConfidence / finalCount : 0;
        }
      }
      setInterimTranscript(combined);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }

      const currentState = stateRef.current;
      if (currentState === "silence_detected" || currentState === "transcribing") {
        // Use final transcript, fall back to last interim if empty
        let transcript = accumulatedTranscriptRef.current.trim();
        let confidence = bestConfidenceRef.current;
        if (!transcript && lastInterimRef.current) {
          transcript = lastInterimRef.current;
          confidence = 0.50; // lower confidence for interim-only
          console.log("[VoiceMode] No final result, using interim fallback");
        }
        setState("transcribing");
        console.log(`[VoiceMode] Finalizing: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
        setTimeout(() => submitTranscript(transcript, confidence), 80);
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
        stopAudioMonitor();
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
    console.log(`[VoiceMode] Started listening (${SILENCE_THRESHOLD_MS}ms silence + ${POST_SPEECH_TAIL_MS}ms tail)`);

    // Inactivity timer
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (stateRef.current === "listening" && !hasSpeechRef.current) {
        console.log("[VoiceMode] 15s inactivity, pausing");
        stopRecognition();
        setState("paused_due_to_inactivity");
        setInterimTranscript("");
      }
    }, INACTIVITY_TIMEOUT_MS);

    // Hybrid silence detection: time-based + audio energy
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    silenceTimerRef.current = setInterval(() => {
      if (!hasSpeechRef.current) return;
      const elapsed = Date.now() - lastSpeechAtRef.current;

      // Only trigger if both time AND energy confirm silence
      if (elapsed >= SILENCE_THRESHOLD_MS && stateRef.current === "listening") {
        const energy = getAudioEnergy();
        if (energy < ENERGY_SILENCE_THRESHOLD) {
          console.log(`[VoiceMode] Silence confirmed: ${elapsed}ms elapsed, energy=${energy.toFixed(4)}`);
          setState("silence_detected");
          if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }

          // Post-speech tail: wait extra ms to capture trailing words
          postSpeechTailRef.current = setTimeout(() => {
            console.log(`[VoiceMode] Post-speech tail complete (${POST_SPEECH_TAIL_MS}ms), stopping recognition`);
            stopRecognition();
          }, POST_SPEECH_TAIL_MS);
        }
        // If energy is still high, user is likely still speaking — don't cut off
      }
    }, SILENCE_CHECK_INTERVAL_MS);

    try {
      recognition.start();
    } catch {
      setError("Could not start voice input.");
      setState("idle");
    }
  }, [isSupported, stopRecognition, submitTranscript, getAudioEnergy, stopAudioMonitor]);

  // ── Public API ───────────────────────────────────────────────
  const startVoiceMode = useCallback(async () => {
    setError(null);
    setPendingConfirmation(null);
    responseRenderedRef.current = false;
    await startAudioMonitor();
    startListening();
  }, [startListening, startAudioMonitor]);

  const stopVoiceMode = useCallback(() => {
    clearTimers();
    stopRecognition();
    stopAudioMonitor();
    setState("idle");
    setInterimTranscript("");
    setError(null);
    setPendingConfirmation(null);
    responseRenderedRef.current = false;
  }, [clearTimers, stopRecognition, stopAudioMonitor]);

  const resumeVoiceMode = useCallback(() => {
    setError(null);
    setPendingConfirmation(null);
    startListening();
  }, [startListening]);

  const notifyResponseRendered = useCallback(() => {
    if (stateRef.current === "idle") return;
    console.log("[VoiceMode] Response rendered, scheduling re-listen");
    responseRenderedRef.current = true;
  }, []);

  const confirmPendingTranscript = useCallback(() => {
    if (!pendingConfirmation) return;
    console.log(`[VoiceMode] User confirmed transcript: "${pendingConfirmation}"`);
    setState("auto_submitting");
    const text = pendingConfirmation;
    setPendingConfirmation(null);
    onTranscript(text);
  }, [pendingConfirmation, onTranscript]);

  const retryPendingTranscript = useCallback(() => {
    console.log("[VoiceMode] User rejected transcript, retrying");
    setPendingConfirmation(null);
    startListening();
  }, [startListening]);

  // ── State transitions based on AI loading ────────────────────
  useEffect(() => {
    if (state === "idle") return;

    if (isAiLoading && (state === "auto_submitting" || state === "processing")) {
      setState("responding");
      responseRenderedRef.current = false;
    }

    if (!isAiLoading && state === "responding") {
      setState("waiting_for_reply");
      clearTimers();

      const pollInterval = setInterval(() => {
        if (responseRenderedRef.current) {
          clearInterval(pollInterval);
          const hasOptions = lastAssistantMessage && hasNumberedOptions(lastAssistantMessage);
          const delay = hasOptions ? RELISTEN_DELAY_MS : RELISTEN_DELAY_MS * 1.2;
          console.log(`[VoiceMode] Render confirmed, re-listen in ${Math.round(delay)}ms`);
          relistenTimerRef.current = setTimeout(() => {
            if (stateRef.current === "waiting_for_reply") {
              startListening();
            }
          }, delay);
        }
      }, 150);

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
      stopAudioMonitor();
    };
  }, [clearTimers, stopRecognition, stopAudioMonitor]);

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

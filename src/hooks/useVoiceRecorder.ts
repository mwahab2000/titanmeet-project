import { useState, useRef, useCallback, useMemo } from "react";

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string | null;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscript: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const hasMediaDevices = !!(navigator.mediaDevices?.getUserMedia);
    return !!(SpeechRecognition || hasMediaDevices);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: just record audio, no live transcript
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Voice input is not supported in this browser. Please use text input instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
          setTranscript("[Voice recording captured — speech-to-text unavailable in this browser]");
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          setError("Microphone access denied. Please allow microphone access in your browser settings.");
        } else {
          setError("Could not access microphone. Please check your device settings.");
        }
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = "";

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        setTranscript((finalTranscript + interim).trim());
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Please allow microphone access in your browser settings.");
        } else if (event.error === "no-speech") {
          setError("No speech detected. Please try again and speak clearly.");
        } else if (event.error !== "aborted") {
          setError(`Voice input error: ${event.error}. Please try text input instead.`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (finalTranscript.trim()) {
          setTranscript(finalTranscript.trim());
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      setError("Could not start voice input. Please try text input instead.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript(null);
    setError(null);
  }, []);

  return { isRecording, isProcessing, transcript, error, isSupported, startRecording, stopRecording, clearTranscript };
}

import { useRef, useState, useCallback } from "react";

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm"; // fallback
}

export interface UseVoiceRecorderOptions {
  timeslice?: number; // ms
  onChunk: (blob: Blob, mimeType: string) => void;
  onError?: (err: Error) => void;
}

export function useVoiceRecorder({ timeslice = 15000, onChunk, onError }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("");

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mimeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          onChunk(e.data, mimeType);
        }
      };

      recorder.onerror = () => {
        onError?.(new Error("MediaRecorder error"));
        stop();
      };

      recorder.start(timeslice);
      setIsRecording(true);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [timeslice, onChunk, onError]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop, mimeType: mimeRef.current };
}

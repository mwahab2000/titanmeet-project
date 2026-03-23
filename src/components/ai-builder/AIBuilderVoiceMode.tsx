import { Mic, MicOff, Pause, Play, X, Check, RotatCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceModeState } from "@/hooks/useVoiceMode";
import { cn } from "@/lib/utils";

interface Props {
  state: VoiceModeState;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  isActive: boolean;
  pendingConfirmation: string | null;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
  onConfirmTranscript: () => void;
  onRetryTranscript: () => void;
}

const stateLabels: Record<VoiceModeState, string> = {
  idle: "",
  listening: "Listening…",
  silence_detected: "Got it…",
  transcribing: "Transcribing…",
  auto_submitting: "Sending…",
  processing: "Processing…",
  responding: "AI is responding…",
  waiting_for_reply: "Getting ready to listen…",
  paused_due_to_inactivity: "Voice mode paused — no activity detected.",
};

export const AIBuilderVoiceMode = ({
  state,
  interimTranscript,
  error,
  isSupported,
  isActive,
  pendingConfirmation,
  onStart,
  onStop,
  onResume,
  onConfirmTranscript,
  onRetryTranscript,
}: Props) => {
  if (!isSupported) return null;

  // Start button in header area (not active)
  if (!isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={onStart}
      >
        <Mic className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Voice Mode</span>
      </Button>
    );
  }

  // Active voice mode strip
  return (
    <div className="border-b border-border bg-primary/5 px-3 sm:px-4 py-2 flex items-center gap-3">
      {/* Mic indicator */}
      <div className="relative shrink-0">
        {state === "listening" ? (
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mic className="h-4 w-4" />
            </span>
          </span>
        ) : state === "paused_due_to_inactivity" ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Pause className="h-4 w-4" />
          </span>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Mic className="h-4 w-4" />
          </span>
        )}
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        {pendingConfirmation ? (
          <div>
            <p className="text-xs font-medium text-foreground truncate">
              I heard: "{pendingConfirmation}"
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Button size="sm" variant="default" className="h-6 text-[10px] gap-1 px-2" onClick={onConfirmTranscript}>
                <Check className="h-3 w-3" />
                Send
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={onRetryTranscript}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={cn(
              "text-xs font-medium truncate",
              state === "listening" ? "text-primary" : "text-muted-foreground"
            )}>
              {error || stateLabels[state]}
            </p>
            {state === "listening" && interimTranscript && (
              <p className="text-xs text-foreground/70 truncate mt-0.5">
                "{interimTranscript}"
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {state === "paused_due_to_inactivity" && (
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={onResume}>
            <Play className="h-3 w-3" />
            Resume
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStop} title="Exit Voice Mode">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

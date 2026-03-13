import React, { useCallback, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pause, Play, Loader2 } from "lucide-react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVoiceStudio } from "./useVoiceStudio";
import VoiceEarIcon from "./VoiceEarIcon";
import VoiceTranscript from "./VoiceTranscript";
import VoiceActionCard from "./VoiceActionCard";
import type { VoiceLanguage, EventSnapshot } from "@/types/voice";
import { ScrollArea } from "@/components/ui/scroll-area";

const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "el", label: "Ελληνικά" },
  { value: "tr", label: "Türkçe" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
];

interface VoiceStudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VoiceStudioSheet: React.FC<VoiceStudioSheetProps> = ({ open, onOpenChange }) => {
  const { event } = useEventWorkspace();
  const [isListening, setIsListening] = useState(false);

  const eventSnapshot: EventSnapshot = {
    event_id: event?.id ?? null,
    draft_key: null,
    title: event?.title ?? null,
    start_date: event?.start_date?.slice(0, 10) ?? null,
    venue_name: event?.venue_name ?? null,
    status: (event?.status as "draft" | "published") ?? "draft",
    agenda_count: 0,
    speaker_count: 0,
    attendee_count: 0,
    confirmed_count: 0,
    readiness_percent: 0,
  };

  const studio = useVoiceStudio({
    eventId: event?.id ?? null,
    eventSnapshot,
  });

  const handlePause = useCallback(() => {
    setIsListening(false);
    recorder.stop();
    studio.pauseSession();
  }, []);

  const recorder = useVoiceRecorder({
    timeslice: 15000,
    onChunk: (blob, mime) => {
      studio.handleChunk(blob, mime, handlePause);
    },
    onError: (err) => {
      console.error("Recorder error:", err);
      handlePause();
    },
  });

  // Load session when sheet opens
  useEffect(() => {
    if (open) {
      studio.loadSession();
    }
  }, [open]);

  const handleStartListening = async () => {
    setIsListening(true);
    await studio.activateSession();
    await recorder.start();
  };

  const handleStopListening = () => {
    handlePause();
  };

  const handleToggle = () => {
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => {
      if (!v && isListening) handleStopListening();
      onOpenChange(v);
    }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-base flex items-center gap-2">
              <VoiceEarIcon size={20} />
              Voice Studio
            </SheetTitle>
            <Select
              value={studio.language}
              onValueChange={(v) => studio.setLanguage(v as VoiceLanguage)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        {/* Body */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {/* Ear + controls */}
            <div className="flex flex-col items-center gap-3 py-4">
              <button
                onClick={handleToggle}
                className="relative group focus:outline-none"
                aria-label={isListening ? "Pause listening" : "Start listening"}
              >
                <div
                  className={`
                    w-20 h-20 rounded-full flex items-center justify-center transition-all
                    ${isListening
                      ? "bg-primary/20 shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
                      : "bg-muted hover:bg-muted/80"
                    }
                  `}
                >
                  {isListening ? (
                    <VoiceEarIcon
                      size={36}
                      className="text-primary animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                    />
                  ) : (
                    <VoiceEarIcon size={36} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </div>
                {/* Pulse rings while listening */}
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                    <span className="absolute -inset-2 rounded-full border border-primary/10 animate-ping [animation-delay:500ms]" />
                  </>
                )}
              </button>

              {/* Status text */}
              <div className="text-center">
                {isListening && !studio.isTranscribing && studio.silenceCountdown === null && (
                  <span className="text-sm text-primary font-medium">Listening…</span>
                )}
                {studio.isTranscribing && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    Processing speech
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </span>
                  </span>
                )}
                {studio.silenceCountdown !== null && (
                  <span className="text-sm text-amber-500 font-medium">
                    Pausing in {studio.silenceCountdown}…
                  </span>
                )}
                {!isListening && studio.status === "paused" && studio.transcript.length > 0 && (
                  <span className="text-sm text-muted-foreground">Paused (saved). Tap to resume.</span>
                )}
                {!isListening && studio.status === "idle" && studio.transcript.length === 0 && (
                  <span className="text-sm text-muted-foreground">Tap the ear to start</span>
                )}
              </div>

              {/* Play/Pause button */}
              <Button
                size="sm"
                variant={isListening ? "destructive" : "default"}
                className="gap-1.5"
                onClick={handleToggle}
              >
                {isListening ? (
                  <><Pause className="h-4 w-4" /> Pause</>
                ) : (
                  <><Play className="h-4 w-4" /> {studio.transcript.length > 0 ? "Resume" : "Start"}</>
                )}
              </Button>
            </div>

            {/* Transcript */}
            {(studio.transcript.length > 0 || studio.isTranscribing) && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Transcript
                </h3>
                <VoiceTranscript
                  entries={studio.transcript}
                  isTranscribing={studio.isTranscribing}
                />
              </div>
            )}

            {/* Assistant reply */}
            {studio.assistantReply && (
              <div className="rounded-lg bg-secondary/10 border border-secondary/20 p-3">
                <p className="text-sm text-foreground">{studio.assistantReply}</p>
                {studio.missingFields.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Missing: {studio.missingFields.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Parsing indicator */}
            {studio.isParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing actions…
              </div>
            )}

            {/* Pending actions */}
            {studio.pendingActions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Proposed Actions
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {studio.pendingActions.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {studio.pendingActions.map((action) => (
                    <VoiceActionCard
                      key={action.id}
                      action={action}
                      onConfirm={(id) => studio.confirmActions([id])}
                      onDiscard={(id) => studio.discardActions([id])}
                      onUpdate={studio.updateAction}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed actions */}
            {studio.confirmedActions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Confirmed ({studio.confirmedActions.length})
                </h3>
                <div className="space-y-1">
                  {studio.confirmedActions.map((a, i) => (
                    <div
                      key={a.id + i}
                      className="text-xs text-muted-foreground flex items-center gap-1.5 py-1"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px]">✓</span>
                      <span>{a.type.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default VoiceStudioSheet;

import { useState, useRef, useCallback } from "react";
import { Send, Mic, MicOff, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";

interface AIBuilderComposerProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export const AIBuilderComposer = ({ onSend, isLoading }: AIBuilderComposerProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isRecording, transcript, error, startRecording, stopRecording, clearTranscript } = useVoiceRecorder();

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput("");
    textareaRef.current?.focus();
  }, [input, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcceptTranscript = () => {
    if (transcript) {
      onSend(transcript);
      clearTranscript();
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Transcript preview mode
  if (transcript && !isRecording) {
    return (
      <div className="border-t border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium text-primary mb-1">Voice Transcript</p>
            <p className="text-sm text-foreground">{transcript}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button size="icon" variant="default" className="h-8 w-8" onClick={handleAcceptTranscript} disabled={isLoading}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clearTranscript}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Recording state */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-3 px-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
          <span className="text-sm text-destructive font-medium">Recording… speak now</span>
          <span className="text-xs text-muted-foreground ml-auto">{transcript || "Listening…"}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or use your voice…"
          className="min-h-[44px] max-h-[160px] resize-none rounded-xl border-border bg-background text-sm"
          rows={1}
          disabled={isRecording}
        />

        <Button
          size="icon"
          variant={isRecording ? "destructive" : "outline"}
          className={cn("h-10 w-10 shrink-0 rounded-xl", isRecording && "animate-pulse")}
          onClick={handleToggleRecording}
          disabled={isLoading}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>

        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={!input.trim() || isLoading || isRecording}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

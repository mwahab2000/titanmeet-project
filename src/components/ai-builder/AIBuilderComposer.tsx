import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Mic, MicOff, X, Check, AlertCircle, Paperclip, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AIBuilderComposerProps {
  onSend: (message: string) => void;
  onFileUpload?: (file: File) => void;
  isLoading: boolean;
  pendingUpload?: { file: File; previewUrl: string } | null;
  onClearUpload?: () => void;
}

export const AIBuilderComposer = ({ onSend, onFileUpload, isLoading, pendingUpload, onClearUpload }: AIBuilderComposerProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, transcript, error, isSupported, startRecording, stopRecording, clearTranscript } = useVoiceRecorder();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSend(text);
    setInput("");
    if (window.innerWidth >= 768) {
      textareaRef.current?.focus();
    }
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return; // Only images for now
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return;
      }
      onFileUpload(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Transcript preview mode
  if (transcript && !isRecording) {
    return (
      <div className="border-t border-border bg-card p-3 sm:p-4 pb-[env(safe-area-inset-bottom,0.75rem)]">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-3 sm:px-4 py-2.5 sm:py-3">
            <p className="text-xs font-medium text-primary mb-1">Voice Transcript</p>
            <p className="text-sm text-foreground leading-relaxed">{transcript}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button size="icon" variant="default" className="h-10 w-10 sm:h-8 sm:w-8 rounded-xl" onClick={handleAcceptTranscript} disabled={isLoading}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8 rounded-xl" onClick={clearTranscript}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-3 sm:p-4 pb-[env(safe-area-inset-bottom,0.75rem)]">
      {/* Recording state */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
          <span className="text-sm text-destructive font-medium">Recording…</span>
          <span className="text-xs text-muted-foreground ml-auto truncate max-w-[50%]">
            {transcript || "Listening…"}
          </span>
        </div>
      )}

      {/* Permission denied / unsupported */}
      {error && !isRecording && !transcript && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs px-2" onClick={clearTranscript}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Pending upload preview */}
      {pendingUpload && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <img
            src={pendingUpload.previewUrl}
            alt="Upload preview"
            className="h-12 w-12 rounded-lg object-cover border border-border"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{pendingUpload.file.name}</p>
            <p className="text-[10px] text-muted-foreground">{(pendingUpload.file.size / 1024).toFixed(0)} KB — ready to upload</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClearUpload}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isRecording}
          aria-label="Upload image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingUpload ? "Add a note about this image…" : "Type a message…"}
          className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border bg-background text-sm leading-relaxed"
          rows={1}
          disabled={isRecording}
        />

        {/* Mic button */}
        {isSupported && (
          <Button
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            className={cn("h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-xl", isRecording && "animate-pulse")}
            onClick={handleToggleRecording}
            disabled={isLoading}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}

        <Button
          size="icon"
          className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={(!input.trim() && !pendingUpload) || isLoading || isRecording}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

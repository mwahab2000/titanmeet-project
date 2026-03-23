import { useState, useRef, useCallback, useEffect } from "react";
import { Send, X, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
      if (!allowedTypes.includes(file.type) && !file.type.startsWith("image/")) {
        toast.error("Only image files are supported (JPEG, PNG, GIF, WebP)");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size < 100) {
        toast.error("File appears to be empty or corrupted. Please try another image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      onFileUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="border-t border-border bg-card p-3 sm:p-4 pb-[env(safe-area-inset-bottom,0.75rem)]">
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
          disabled={isLoading}
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
        />

        <Button
          size="icon"
          className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={(!input.trim() && !pendingUpload) || isLoading}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

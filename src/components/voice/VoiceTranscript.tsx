import React, { useRef, useEffect } from "react";
import type { TranscriptEntry } from "@/types/voice";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VoiceTranscriptProps {
  entries: TranscriptEntry[];
  isTranscribing: boolean;
}

const VoiceTranscript: React.FC<VoiceTranscriptProps> = ({ entries, isTranscribing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, isTranscribing]);

  if (entries.length === 0 && !isTranscribing) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Start speaking and your words will appear here…
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-48 pr-2">
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div
            key={entry.chunk_id + i}
            className="text-sm leading-relaxed px-3 py-1.5 rounded-lg bg-muted/50"
            dir={entry.dir}
            style={{ textAlign: entry.dir === "rtl" ? "right" : "left" }}
          >
            <span className="text-foreground">{entry.text}</span>
            <span className="ml-2 text-[10px] text-muted-foreground uppercase">{entry.lang}</span>
          </div>
        ))}
        {isTranscribing && (
          <div className="text-sm text-muted-foreground px-3 py-1.5 flex items-center gap-1.5">
            Processing speech
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
};

export default VoiceTranscript;

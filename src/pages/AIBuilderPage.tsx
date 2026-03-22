import { useRef, useEffect, useState } from "react";
import { useAIBuilderSession } from "@/hooks/useAIBuilderSession";
import { AIBuilderChatMessage } from "@/components/ai-builder/AIBuilderChatMessage";
import { AIBuilderComposer } from "@/components/ai-builder/AIBuilderComposer";
import { AIBuilderDraftPanel } from "@/components/ai-builder/AIBuilderDraftPanel";
import { AIBuilderEmptyState } from "@/components/ai-builder/AIBuilderEmptyState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RotateCcw, Bot, PanelRightClose, PanelRightOpen, ClipboardList } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const AIBuilderPage = () => {
  const { messages, draft, isLoading, sendMessage, clearSession } = useAIBuilderSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [draftSheetOpen, setDraftSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const effectiveShowPanel = !isMobile && showPanel;

  return (
    <div className={`flex ${isMobile ? "h-[calc(100dvh-8rem)]" : "h-[calc(100vh-7rem)]"} rounded-xl border border-border bg-background overflow-hidden`}>
      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 sm:px-4 py-2.5 sm:py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">AI Builder</h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Build events conversationally</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={clearSession}>
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">New Session</span>
              </Button>
            )}
            {/* Mobile: draft sheet trigger */}
            {isMobile && (
              <Sheet open={draftSheetOpen} onOpenChange={setDraftSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto p-0">
                  <SheetTitle className="sr-only">Draft Summary</SheetTitle>
                  <AIBuilderDraftPanel draft={draft} />
                </SheetContent>
              </Sheet>
            )}
            {/* Desktop: toggle panel */}
            {!isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPanel(!showPanel)}>
                {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4">
          {messages.length === 0 ? (
            <AIBuilderEmptyState onSelectPrompt={(p) => sendMessage(p)} />
          ) : (
            <div className="max-w-3xl mx-auto py-3 sm:py-4">
              {messages.map((msg) => (
                <AIBuilderChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3 py-4 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <AIBuilderComposer onSend={(msg) => sendMessage(msg)} isLoading={isLoading} />
      </div>

      {/* Desktop draft summary panel */}
      {effectiveShowPanel && (
        <div className="w-72 shrink-0">
          <AIBuilderDraftPanel draft={draft} />
        </div>
      )}
    </div>
  );
};

export default AIBuilderPage;

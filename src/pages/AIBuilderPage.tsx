import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Zap } from "lucide-react";
import { useAIBuilderSession } from "@/hooks/useAIBuilderSession";
import type { ProposalSection } from "@/components/ai-builder/AIEventProposalPreview";
import { AIBuilderChatMessage } from "@/components/ai-builder/AIBuilderChatMessage";
import { AIBuilderComposer } from "@/components/ai-builder/AIBuilderComposer";
import { AIBuilderDraftPanel } from "@/components/ai-builder/AIBuilderDraftPanel";
import { AIBuilderEmptyState } from "@/components/ai-builder/AIBuilderEmptyState";
import { AIBuilderVoiceMode } from "@/components/ai-builder/AIBuilderVoiceMode";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RotateCcw, Bot, PanelRightClose, PanelRightOpen, ClipboardList } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AIBuilderUsageBanner } from "@/components/ai-builder/AIBuilderUsageBanner";
import { AIBuilderExamplesTrigger } from "@/components/ai-builder/AIBuilderExamplesTrigger";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useVoiceMode } from "@/hooks/useVoiceMode";
import { useHeroImageSelection } from "@/hooks/useHeroImageSelection";
import type { HeroImageCandidate } from "@/components/ai-builder/AIHeroImageCard";
import type { VenueResult } from "@/components/ai-builder/AIVenueSearchResults";
import type { VenuePhoto } from "@/components/ai-builder/AIVenuePhotoBrowser";
import type { EventProposal } from "@/components/ai-builder/AIEventProposalPreview";
import type { VisualIdentityData } from "@/components/ai-builder/AIVisualIdentityPreview";

const AIBuilderPage = () => {
  const { messages, draft, isLoading, sendMessage, clearSession } = useAIBuilderSession();
  const heroSelection = useHeroImageSelection();
  const onboarding = useOnboardingStatus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [draftSheetOpen, setDraftSheetOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ultraFastMode, setUltraFastMode] = useState(() => {
    try { return localStorage.getItem("titanmeet_ultra_fast") === "true"; } catch { return false; }
  });
  const isMobile = useIsMobile();

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return undefined;
  }, [messages]);

  const voiceMode = useVoiceMode({
    onTranscript: (text) => sendMessage(text, undefined, undefined, true, ultraFastMode),
    isAiLoading: isLoading,
    lastAssistantMessage,
  });

  const toggleUltraFast = useCallback(() => {
    setUltraFastMode(prev => {
      const next = !prev;
      try { localStorage.setItem("titanmeet_ultra_fast", String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleVenueSelect = (venue: VenueResult) => {
    sendMessage(
      `I'd like to use "${venue.name}" at ${venue.address} as the venue. Place ID: ${venue.place_id}, coordinates: ${venue.lat}, ${venue.lng}, map: ${venue.map_url}`
    );
  };

  const handlePhotosConfirm = (photos: VenuePhoto[]) => {
    sendMessage(
      `Please save these ${photos.length} selected venue photos: ${JSON.stringify(photos.map(p => ({
        photo_reference: p.photo_reference,
        width: p.width,
        height: p.height,
        attributions: p.attributions,
      })))}`
    );
  };

  const handleProposalApprove = (proposal: EventProposal) => {
    sendMessage(`I approve this proposal. Please save it now. Here is the proposal: ${JSON.stringify(proposal)}`);
  };

  const handleProposalReject = () => {
    sendMessage("I'd like to make some changes to the proposal before saving. What would you like to adjust?");
  };

  const handlePartialApply = useCallback((sections: ProposalSection[]) => {
    sendMessage(`I want to apply only these sections from the proposal: ${sections.join(", ")}. Please save only those parts and skip the rest.`);
  }, [sendMessage]);

  const handleHeroImageAdd = useCallback((image: HeroImageCandidate) => {
    heroSelection.addCandidate(image);
    heroSelection.selectImage(image.id);
    const count = heroSelection.selectedCount + 1;
    sendMessage(`I've added this image to my hero selection. I now have ${count} image(s) selected.`);
  }, [heroSelection, sendMessage]);

  const handleHeroImageRefine = useCallback((image: HeroImageCandidate) => {
    sendMessage(`I'd like to refine this image (asset ID: ${image.id}). What adjustments would you like to suggest, or let me describe what I want changed.`);
  }, [sendMessage]);

  const handleVisualIdentityApply = useCallback((identity: VisualIdentityData) => {
    const parts: string[] = [];
    if (identity.hero_asset_id) parts.push(`hero (asset: ${identity.hero_asset_id})`);
    if (identity.banner_asset_id) parts.push(`banner (asset: ${identity.banner_asset_id})`);
    sendMessage(`I approve this visual identity. Please apply the full identity: ${parts.join(" and ")}. Save both images to the event.`);
  }, [sendMessage]);

  const handleVisualIdentityRefine = useCallback((identity: VisualIdentityData) => {
    sendMessage("I'd like to refine this visual identity. What adjustments can we make?");
  }, [sendMessage]);

  const handleVisualIdentityRegenerate = useCallback(() => {
    sendMessage("Generate another visual identity with a different style direction.");
  }, [sendMessage]);

  const handleFileUpload = useCallback((file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setPendingUpload({ file, previewUrl });
  }, []);

  const handleClearUpload = useCallback(() => {
    if (pendingUpload?.previewUrl) {
      URL.revokeObjectURL(pendingUpload.previewUrl);
    }
    setPendingUpload(null);
  }, [pendingUpload]);

  const handleSelectPrompt = useCallback((prompt: string) => {
    const newUser = onboarding.isNewUser;
    if (newUser) onboarding.completeOnboarding();
    if (prompt === "__ONBOARDING_START__") {
      sendMessage("I'm new here — help me create my first event step by step", undefined, undefined, false, ultraFastMode, true);
      return;
    }
    sendMessage(prompt, undefined, undefined, false, ultraFastMode, newUser);
  }, [sendMessage, ultraFastMode, onboarding]);

  const handleSendWithUpload = useCallback(async (message: string) => {
    // Mark onboarding complete on first real interaction
    if (onboarding.isNewUser) onboarding.completeOnboarding();

    if (!pendingUpload) {
      sendMessage(message, undefined, undefined, false, ultraFastMode);
      return;
    }

    // Upload file to media-library bucket first
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to upload files");
        return;
      }

      const ext = pendingUpload.file.name.split(".").pop() || "png";
      const filePath = `${user.id}/uploads/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("media-library")
        .upload(filePath, pendingUpload.file, {
          contentType: pendingUpload.file.type,
          upsert: false,
        });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        toast.error("Failed to upload image");
        return;
      }

      // Send message with upload info so AI can register it
      const uploadContext = `[UPLOADED_IMAGE: path="${filePath}", name="${pendingUpload.file.name}", type="${pendingUpload.file.type}", size=${pendingUpload.file.size}]`;
      const fullMessage = message.trim()
        ? `${message}\n\n${uploadContext}`
        : `I've uploaded an image. ${uploadContext}`;

      handleClearUpload();
      sendMessage(fullMessage, undefined, undefined, false, ultraFastMode);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  }, [pendingUpload, sendMessage, handleClearUpload]);

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
            <Button
              variant={ultraFastMode ? "default" : "outline"}
              size="sm"
              className={`h-8 text-xs gap-1 ${ultraFastMode ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`}
              onClick={toggleUltraFast}
              title={ultraFastMode ? "Ultra-Fast Mode ON" : "Enable Ultra-Fast Mode"}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{ultraFastMode ? "Ultra-Fast" : "Fast"}</span>
            </Button>
            {!voiceMode.isActive && (
              <AIBuilderVoiceMode
                state={voiceMode.state}
                interimTranscript={voiceMode.interimTranscript}
                error={voiceMode.error}
                isSupported={voiceMode.isSupported}
                isActive={voiceMode.isActive}
                onStart={voiceMode.startVoiceMode}
                onStop={voiceMode.stopVoiceMode}
                onResume={voiceMode.resumeVoiceMode}
              />
            )}
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { voiceMode.stopVoiceMode(); heroSelection.reset(); clearSession(); }}>
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">New Session</span>
              </Button>
            )}
            {isMobile && (
              <Sheet open={draftSheetOpen} onOpenChange={setDraftSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ClipboardList className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[75dvh] overflow-y-auto p-0">
                  <SheetTitle className="sr-only">Draft Summary</SheetTitle>
                  <AIBuilderDraftPanel draft={draft} onApplyRecommendation={(p) => sendMessage(p)} isLoading={isLoading} />
                </SheetContent>
              </Sheet>
            )}
            {!isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPanel(!showPanel)}>
                {showPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Voice mode active strip */}
        {voiceMode.isActive && (
          <AIBuilderVoiceMode
            state={voiceMode.state}
            interimTranscript={voiceMode.interimTranscript}
            error={voiceMode.error}
            isSupported={voiceMode.isSupported}
            isActive={voiceMode.isActive}
            onStart={voiceMode.startVoiceMode}
            onStop={voiceMode.stopVoiceMode}
            onResume={voiceMode.resumeVoiceMode}
          />
        )}

        {/* Usage warning */}
        <AIBuilderUsageBanner />

        {/* Persistent examples trigger (visible when conversation exists) */}
        {messages.length > 0 && (
          <AIBuilderExamplesTrigger onSelectPrompt={(p) => sendMessage(p)} />
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4">
          {messages.length === 0 ? (
            <AIBuilderEmptyState onSelectPrompt={handleSelectPrompt} isNewUser={onboarding.isNewUser} />
          ) : (
            <div className="max-w-3xl mx-auto py-3 sm:py-4">
              {messages.map((msg) => (
                <AIBuilderChatMessage
                  key={msg.id}
                  message={msg}
                  onVenueSelect={handleVenueSelect}
                  onPhotosConfirm={handlePhotosConfirm}
                  onProposalApprove={handleProposalApprove}
                  onProposalReject={handleProposalReject}
                  onPartialApply={handlePartialApply}
                  onHeroImageAdd={handleHeroImageAdd}
                  onHeroImageRefine={handleHeroImageRefine}
                  onVisualIdentityApply={handleVisualIdentityApply}
                  onVisualIdentityRefine={handleVisualIdentityRefine}
                  onVisualIdentityRegenerate={handleVisualIdentityRegenerate}
                  heroSelectedIds={heroSelection.selectedIds}
                  isProcessing={isLoading}
                />
              ))}
              {(isLoading || isUploading) && (
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
        <AIBuilderComposer
          onSend={handleSendWithUpload}
          onFileUpload={handleFileUpload}
          isLoading={isLoading || isUploading}
          pendingUpload={pendingUpload}
          onClearUpload={handleClearUpload}
        />
      </div>

      {/* Desktop draft summary panel */}
      {effectiveShowPanel && (
        <div className="w-72 shrink-0">
          <AIBuilderDraftPanel draft={draft} onApplyRecommendation={(p) => sendMessage(p)} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};

export default AIBuilderPage;

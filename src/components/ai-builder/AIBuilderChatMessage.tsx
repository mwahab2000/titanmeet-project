import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, CheckCircle2, AlertTriangle, Info, Plus, Pencil, MapPin, ImageIcon, XCircle, Clock, ChevronDown, ChevronUp, Sparkles, Palette } from "lucide-react";
import type { ChatMessage, AIAction, ActionLogEntry } from "@/hooks/useAIBuilderSession";
import { cn } from "@/lib/utils";
import { AIVenueSearchResults, type VenueResult } from "./AIVenueSearchResults";
import { AIVenuePhotoBrowser, type VenuePhoto } from "./AIVenuePhotoBrowser";
import { AIEventProposalPreview, type EventProposal } from "./AIEventProposalPreview";
import { AIHeroImageGrid, type HeroImageCandidate } from "./AIHeroImageCard";
import { AIVisualIdentityPreview, type VisualIdentityData } from "./AIVisualIdentityPreview";

const actionIcons: Record<string, typeof CheckCircle2> = {
  created: Plus,
  updated: Pencil,
  added: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  venue_search: MapPin,
  venue_photos: ImageIcon,
  proposal: Sparkles,
  visual_identity: Palette,
};

const actionColors: Record<string, string> = {
  created: "text-green-400 bg-green-400/10 border-green-400/20",
  updated: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  added: "text-green-400 bg-green-400/10 border-green-400/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  info: "text-muted-foreground bg-muted/50 border-border",
  venue_search: "text-primary bg-primary/10 border-primary/20",
  venue_photos: "text-primary bg-primary/10 border-primary/20",
  proposal: "text-primary bg-primary/10 border-primary/20",
  visual_identity: "text-primary bg-primary/10 border-primary/20",
};

const logStatusConfig = {
  success: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", label: "Done" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", label: "Failed" },
  pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", label: "Pending" },
  skipped: { icon: Info, color: "text-muted-foreground", bg: "bg-muted/50 border-border", label: "Skipped" },
};

const failureCategoryLabels: Record<string, string> = {
  validation: "Invalid input",
  permission: "Access denied",
  external_api: "Service error",
  parsing: "Parse error",
  duplicate_conflict: "Already exists",
  internal: "System error",
};

/** Extract image URLs from action data for inline display */
function extractGeneratedImages(actions?: AIAction[]): HeroImageCandidate[] {
  if (!actions) return [];
  const images: HeroImageCandidate[] = [];
  for (const action of actions) {
    if (action.data?.generated_image_url) {
      const isRefined = !!action.data.base_image_id;
      images.push({
        id: action.data.media_asset_id || crypto.randomUUID(),
        url: action.data.generated_image_url,
        storagePath: action.data.storage_path || "",
        label: action.data.label || action.label,
        isRefined,
        refinementInstruction: isRefined ? action.data.refinement_instruction : undefined,
      });
    }
    if (action.data?.generated_images && Array.isArray(action.data.generated_images)) {
      for (const img of action.data.generated_images) {
        images.push({
          id: img.media_asset_id || crypto.randomUUID(),
          url: img.url,
          storagePath: img.storage_path || "",
          label: img.label,
        });
      }
    }
    // Handle ranked images from rank_hero_images tool
    if (action.data?.ranked_images && Array.isArray(action.data.ranked_images)) {
      for (const ranked of action.data.ranked_images) {
        images.push({
          id: ranked.id,
          url: ranked.preview_url || "",
          storagePath: "",
          label: ranked.title || `Rank #${ranked.rank}`,
          rank: ranked.rank,
          score: ranked.score,
          reason: ranked.reason,
          isRecommended: ranked.is_recommended || ranked.rank === 1,
        });
      }
    }
  }
  return images;
}

interface AIBuilderChatMessageProps {
  message: ChatMessage;
  onVenueSelect?: (venue: VenueResult) => void;
  onPhotosConfirm?: (photos: VenuePhoto[]) => void;
  onProposalApprove?: (proposal: EventProposal) => void;
  onProposalReject?: () => void;
  onHeroImageAdd?: (image: HeroImageCandidate) => void;
  onHeroImageRefine?: (image: HeroImageCandidate) => void;
  onVisualIdentityApply?: (identity: VisualIdentityData) => void;
  onVisualIdentityRefine?: (identity: VisualIdentityData) => void;
  onVisualIdentityRegenerate?: () => void;
  heroSelectedIds?: Set<string>;
  isProcessing?: boolean;
}

export const AIBuilderChatMessage = ({
  message,
  onVenueSelect,
  onPhotosConfirm,
  onProposalApprove,
  onProposalReject,
  onHeroImageAdd,
  onHeroImageRefine,
  heroSelectedIds,
  isProcessing,
}: AIBuilderChatMessageProps) => {
  const isUser = message.role === "user";
  const [venueSelected, setVenueSelected] = useState(false);
  const [photosConfirmed, setPhotosConfirmed] = useState(false);
  const [proposalHandled, setProposalHandled] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);

  const venueSearchAction = message.actions?.find(a => a.type === "venue_search" && a.data?.venues?.length > 0);
  const venuePhotosAction = message.actions?.find(a => a.type === "venue_photos" && a.data?.photos?.length > 0);
  const proposalAction = message.actions?.find(a => a.type === "proposal" && a.data?.proposal);

  const generatedImages = useMemo(() => extractGeneratedImages(message.actions), [message.actions]);
  const hasRankedImages = generatedImages.some(img => typeof img.rank === "number");
  const actionLog = message.actionLog;
  const hasActionLog = actionLog && actionLog.length > 0;
  const hasFailures = actionLog?.some(e => e.status === "failed");
  const hasSuccesses = actionLog?.some(e => e.status === "success");

  const handleVenueSelect = (venue: VenueResult) => {
    setVenueSelected(true);
    onVenueSelect?.(venue);
  };

  const handlePhotosConfirm = (photos: VenuePhoto[]) => {
    setPhotosConfirmed(true);
    onPhotosConfirm?.(photos);
  };

  return (
    <div className={cn("flex gap-2 sm:gap-3 py-3 sm:py-4 px-1 sm:px-2", isUser ? "flex-row-reverse" : "")}>
      <div className={cn(
        "flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
      )}>
        {isUser ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      </div>

      <div className={cn("flex flex-col gap-2 max-w-[85%] sm:max-w-[80%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border text-card-foreground rounded-bl-md"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-ol:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:my-2 max-w-none break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* ── Generated Images (inline preview) ── */}
        {generatedImages.length > 0 && (
          <AIHeroImageGrid
            images={generatedImages}
            selectedIds={heroSelectedIds}
            onAdd={onHeroImageAdd}
            onRefine={onHeroImageRefine}
            selectionMode={false}
            showRanking={hasRankedImages}
          />
        )}

        {/* ── Structured Action Log ── */}
        {hasActionLog && (
          <div className="w-full rounded-xl border border-border bg-card/50 overflow-hidden">
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span>Action Log</span>
                {hasFailures && hasSuccesses && (
                  <span className="text-yellow-400 font-medium">• Partial</span>
                )}
                {hasFailures && !hasSuccesses && (
                  <span className="text-destructive font-medium">• Failed</span>
                )}
                {!hasFailures && hasSuccesses && (
                  <span className="text-green-400 font-medium">• Complete</span>
                )}
              </span>
              {logExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {logExpanded && (
              <div className="border-t border-border divide-y divide-border/50">
                {actionLog!.map((entry, i) => {
                  const config = logStatusConfig[entry.status] || logStatusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2">
                      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate">{entry.message}</span>
                        </div>
                        {entry.status === "failed" && entry.category && (
                          <span className="text-[10px] text-destructive/80 mt-0.5 block">
                            {failureCategoryLabels[entry.category] || entry.category}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50">
                          {entry.target}
                        </span>
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", config.bg, config.color)}>
                        {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Venue search results */}
        {venueSearchAction && !venueSelected && (
          <AIVenueSearchResults
            venues={venueSearchAction.data.venues}
            onSelect={handleVenueSelect}
            disabled={isProcessing || venueSelected}
          />
        )}

        {venueSearchAction && venueSelected && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-green-400 bg-green-400/10 border-green-400/20">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Venue selected — saving...</span>
          </div>
        )}

        {/* Venue photo browser */}
        {venuePhotosAction && !photosConfirmed && (
          <AIVenuePhotoBrowser
            photos={venuePhotosAction.data.photos}
            placeId={venuePhotosAction.data.place_id}
            onConfirmSelection={handlePhotosConfirm}
            disabled={isProcessing || photosConfirmed}
          />
        )}

        {venuePhotosAction && photosConfirmed && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-green-400 bg-green-400/10 border-green-400/20">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Photos saved!</span>
          </div>
        )}

        {/* Event Proposal Preview */}
        {proposalAction && !proposalHandled && (
          <AIEventProposalPreview
            proposal={proposalAction.data.proposal}
            onApprove={() => { setProposalHandled(true); onProposalApprove?.(proposalAction.data.proposal); }}
            onReject={() => { setProposalHandled(true); onProposalReject?.(); }}
            disabled={isProcessing}
          />
        )}

        {proposalAction && proposalHandled && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-green-400 bg-green-400/10 border-green-400/20">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Proposal handled</span>
          </div>
        )}

        {/* Standard action badges (only when no action log — avoid duplication) */}
        {!hasActionLog && message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.actions
              .filter(a => a.type !== "venue_search" && a.type !== "venue_photos" && a.type !== "proposal")
              .filter(a => !a.data?.generated_image_url && !a.data?.generated_images)
              .map((action, i) => {
                const Icon = actionIcons[action.type] || Info;
                return (
                  <div key={i} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", actionColors[action.type] || actionColors.info)}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">{action.label}</span>
                    {action.detail && action.type !== "venue_search" && action.type !== "venue_photos" && (
                      <span className="text-muted-foreground ml-1 hidden sm:inline truncate max-w-[200px]">— {action.detail}</span>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground/60">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
};

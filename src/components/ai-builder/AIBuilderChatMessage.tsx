import { useState } from "react";
import { Bot, User, CheckCircle2, AlertTriangle, Info, Plus, Pencil, MapPin, ImageIcon } from "lucide-react";
import type { ChatMessage, AIAction } from "@/hooks/useAIBuilderSession";
import { cn } from "@/lib/utils";
import { AIVenueSearchResults, type VenueResult } from "./AIVenueSearchResults";
import { AIVenuePhotoBrowser, type VenuePhoto } from "./AIVenuePhotoBrowser";

const actionIcons: Record<string, typeof CheckCircle2> = {
  created: Plus,
  updated: Pencil,
  added: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  venue_search: MapPin,
  venue_photos: ImageIcon,
};

const actionColors: Record<string, string> = {
  created: "text-green-400 bg-green-400/10 border-green-400/20",
  updated: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  added: "text-green-400 bg-green-400/10 border-green-400/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  info: "text-muted-foreground bg-muted/50 border-border",
  venue_search: "text-primary bg-primary/10 border-primary/20",
  venue_photos: "text-primary bg-primary/10 border-primary/20",
};

interface AIBuilderChatMessageProps {
  message: ChatMessage;
  onVenueSelect?: (venue: VenueResult) => void;
  onPhotosConfirm?: (photos: VenuePhoto[]) => void;
  isProcessing?: boolean;
}

export const AIBuilderChatMessage = ({ message, onVenueSelect, onPhotosConfirm, isProcessing }: AIBuilderChatMessageProps) => {
  const isUser = message.role === "user";
  const [venueSelected, setVenueSelected] = useState(false);
  const [photosConfirmed, setPhotosConfirmed] = useState(false);

  const venueSearchAction = message.actions?.find(a => a.type === "venue_search" && a.data?.venues?.length > 0);
  const venuePhotosAction = message.actions?.find(a => a.type === "venue_photos" && a.data?.photos?.length > 0);

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
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

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

        {/* Standard action badges */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.actions
              .filter(a => a.type !== "venue_search" && a.type !== "venue_photos")
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

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { VoiceActionEnvelope } from "@/types/voice";
import VoiceActionEditForm from "./VoiceActionEditForm";

const NON_UNDOABLE: Set<string> = new Set(["send_invitations", "publish_event"]);

const ACTION_LABELS: Record<string, string> = {
  create_event: "Create Event",
  update_event_fields: "Update Event",
  add_agenda_item: "Add Agenda Item",
  update_agenda_item: "Update Agenda Item",
  delete_agenda_item: "Delete Agenda Item",
  set_venue: "Set Venue",
  add_speaker: "Add Speaker",
  update_speaker: "Update Speaker",
  remove_speaker: "Remove Speaker",
  send_invitations: "Send Invitations",
  publish_event: "Publish Event",
  request_manual_upload: "Manual Upload",
  run_publish_readiness: "Check Readiness",
};

function summarizePayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (payload.title) parts.push(String(payload.title));
  if (payload.name) parts.push(String(payload.name));
  if (payload.venue_name) parts.push(String(payload.venue_name));
  if (payload.start_date) parts.push(String(payload.start_date));
  if (payload.start_time) parts.push(`at ${payload.start_time}`);
  return parts.join(" · ") || "—";
}

interface VoiceActionCardProps {
  action: VoiceActionEnvelope;
  onConfirm: (id: string) => void;
  onDiscard: (id: string) => void;
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
}

const VoiceActionCard: React.FC<VoiceActionCardProps> = ({
  action,
  onConfirm,
  onDiscard,
  onUpdate,
}) => {
  const [editing, setEditing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const isDestructive = NON_UNDOABLE.has(action.type);

  const handleConfirmClick = () => {
    if (isDestructive) {
      setShowWarning(true);
    } else {
      onConfirm(action.id);
    }
  };

  const confidenceColor =
    action.confidence >= 0.8
      ? "text-primary"
      : action.confidence >= 0.6
        ? "text-amber-500"
        : "text-destructive";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
              {ACTION_LABELS[action.type] || action.type}
            </Badge>
            <span className={`text-[10px] font-mono ${confidenceColor}`}>
              {Math.round(action.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 truncate">
            {summarizePayload(action.payload)}
          </p>
        </div>
      </div>

      {!editing && (
        <div className="flex gap-1.5">
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleConfirmClick}>
            <Check className="h-3 w-3" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => onDiscard(action.id)}>
            <Trash2 className="h-3 w-3" /> Discard
          </Button>
        </div>
      )}

      {editing && (
        <VoiceActionEditForm
          action={action}
          onSave={(id, payload) => {
            onUpdate(id, payload);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              This action cannot be undone
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action.type === "send_invitations"
                ? "Invitations will be sent to all attendees. This cannot be reversed."
                : "Publishing this event will make it publicly visible. This cannot be reversed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                setShowWarning(false);
                onConfirm(action.id);
              }}
            >
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VoiceActionCard;

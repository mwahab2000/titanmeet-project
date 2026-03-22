import { Bot, User, CheckCircle2, AlertTriangle, Info, Plus, Pencil } from "lucide-react";
import type { ChatMessage, AIAction } from "@/hooks/useAIBuilderSession";
import { cn } from "@/lib/utils";

const actionIcons: Record<AIAction["type"], typeof CheckCircle2> = {
  created: Plus,
  updated: Pencil,
  added: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const actionColors: Record<AIAction["type"], string> = {
  created: "text-green-400 bg-green-400/10 border-green-400/20",
  updated: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  added: "text-green-400 bg-green-400/10 border-green-400/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  info: "text-muted-foreground bg-muted/50 border-border",
};

export const AIBuilderChatMessage = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === "user";

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

        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.actions.map((action, i) => {
              const Icon = actionIcons[action.type] || Info;
              return (
                <div key={i} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", actionColors[action.type])}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{action.label}</span>
                  {action.detail && <span className="text-muted-foreground ml-1 hidden sm:inline">— {action.detail}</span>}
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

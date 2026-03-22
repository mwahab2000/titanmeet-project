import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield } from "lucide-react";

interface Props {
  className?: string;
}

export function GrandfatheredBadge({ className }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 cursor-help ${className || ""}`}
          >
            <Shield className="h-3 w-3" />
            Grandfathered
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">
            You're on a legacy pricing plan. You'll keep this price as long as your subscription remains active.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

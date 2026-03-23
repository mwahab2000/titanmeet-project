import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Loader2, CheckCircle2 } from "lucide-react";
import { validateDiscountCode, formatDiscountSummary, type DiscountValidationResult } from "@/lib/discount-api";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface DiscountCodeInputProps {
  planId: string;
  interval: "monthly" | "annual";
  onApplied: (result: DiscountValidationResult) => void;
  onCleared: () => void;
  className?: string;
}

export default function DiscountCodeInput({
  planId,
  interval,
  onApplied,
  onCleared,
  className = "",
}: DiscountCodeInputProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscountValidationResult | null>(null);

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await validateDiscountCode(code, planId, interval, user?.id);
      setResult(res);
      if (res.valid) {
        onApplied(res);
      }
    } catch {
      setResult({
        valid: false,
        error_code: "DISCOUNT_CODE_INVALID",
        error_message: "Unable to validate code. Please try again.",
        discount: null,
      });
    } finally {
      setLoading(false);
    }
  }, [code, planId, interval, user?.id, onApplied]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
    onCleared();
  }, [onCleared]);

  if (!open && !result?.valid) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 ${className}`}
      >
        <Tag className="h-3.5 w-3.5" />
        Have a discount code?
      </button>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={`space-y-2 ${className}`}
      >
        {result?.valid && result.discount ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    {result.discount.code}
                  </Badge>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {formatDiscountSummary(
                      result.discount.discount_type,
                      result.discount.discount_value,
                      result.discount.duration_type,
                      result.discount.duration_cycles,
                    )}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 w-7 p-0 shrink-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (result) setResult(null);
                }}
                placeholder="Enter code"
                className="h-9 font-mono text-sm uppercase"
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
              />
              <Button
                onClick={handleApply}
                disabled={loading || !code.trim()}
                size="sm"
                variant="outline"
                className="h-9 shrink-0"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
              </Button>
              <Button
                onClick={() => { setOpen(false); handleClear(); }}
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {result && !result.valid && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive"
              >
                {result.error_message}
              </motion.p>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

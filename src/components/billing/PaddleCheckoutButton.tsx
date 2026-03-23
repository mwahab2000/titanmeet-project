import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createPendingRedemption } from "@/lib/discount-api";
import { supabase } from "@/integrations/supabase/client";

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || "";
const PADDLE_ENV = import.meta.env.VITE_PADDLE_ENV || "sandbox";

let paddleLoadPromise: Promise<void> | null = null;
let paddleInitialized = false;

function loadPaddleJs(): Promise<void> {
  if ((window as any).Paddle && paddleInitialized) return Promise.resolve();
  if (paddleLoadPromise) return paddleLoadPromise;

  paddleLoadPromise = new Promise((resolve, reject) => {
    // Check if script already exists
    if ((window as any).Paddle) {
      initPaddle();
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      try {
        initPaddle();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => {
      paddleLoadPromise = null;
      reject(new Error("Failed to load Paddle.js"));
    };
    document.head.appendChild(script);
  });

  return paddleLoadPromise;
}

function initPaddle() {
  const Paddle = (window as any).Paddle;
  if (!Paddle) throw new Error("Paddle not available");
  if (paddleInitialized) return;

  if (PADDLE_ENV === "sandbox") {
    Paddle.Environment.set("sandbox");
  }
  Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
  });
  paddleInitialized = true;
}

interface PaddleCheckoutButtonProps {
  priceId: string;
  planId: string;
  type: "one_time" | "subscription";
  disabled?: boolean;
  /** Paddle-native discount ID to apply at checkout */
  paddleDiscountId?: string | null;
  /** TitanMeet discount code ID for redemption tracking */
  discountCodeId?: string | null;
  /** Selected billing interval */
  billingInterval?: "monthly" | "annual";
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

const PaddleCheckoutButton = ({
  priceId,
  planId,
  type,
  disabled,
  paddleDiscountId,
  discountCodeId,
  billingInterval,
  onSuccess,
  onError,
}: PaddleCheckoutButtonProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setSdkError(null);
        await loadPaddleJs();
        if (!cancelled && mountedRef.current) setLoading(false);
      } catch (err: any) {
        if (!cancelled && mountedRef.current) {
          setSdkError(err.message || "Failed to load Paddle");
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const handleClick = useCallback(() => {
    const Paddle = (window as any).Paddle;
    if (!Paddle?.Checkout) {
      toast.error("Payment system not ready. Please refresh.");
      return;
    }

    if (!priceId) {
      console.warn(`[PaddleCheckout] No priceId for plan "${planId}". Check VITE_PADDLE_PRICE_* env vars.`);
      toast.error("Price not configured for this plan.");
      return;
    }

    const checkoutConfig: any = {
      items: [{ priceId, quantity: 1 }],
      customData: { plan_id: planId, user_id: user?.id || "" },
      settings: {
        displayMode: "overlay",
        theme: "light",
        locale: "en",
        successUrl: window.location.origin + "/dashboard/billing?payment=success",
      },
      customer: user?.email ? { email: user.email } : undefined,
      eventCallback: (event: any) => {
        if (event.name === "checkout.completed") {
          const transactionId = event.data?.transaction_id || event.data?.id || "";
          onSuccess?.(transactionId);
          toast.success("Payment confirmed! Your access will update in a moment.");
          // Refresh to pick up webhook-updated subscription
          setTimeout(() => window.location.reload(), 5000);
          setTimeout(() => window.location.reload(), 10000);
        }
        if (event.name === "checkout.closed") {
          // User closed the overlay
        }
        if (event.name === "checkout.error") {
          const errMsg = event.data?.error?.message || "Checkout error";
          onError?.(errMsg);
          toast.error("Payment failed. Please try again.");
        }
      },
    };

    // Apply Paddle-native discount if provided
    if (paddleDiscountId) {
      checkoutConfig.discountId = paddleDiscountId;
    }

    Paddle.Checkout.open(checkoutConfig);
  }, [priceId, planId, user, paddleDiscountId, onSuccess, onError]);

  if (disabled) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Select this plan to continue
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {sdkError && (
        <p className="text-sm text-destructive text-center py-2">{sdkError}</p>
      )}
      <Button
        onClick={handleClick}
        disabled={loading || !!sdkError}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? "Loading..." : "Pay with Card"}
      </Button>

      {/* Payment method badges */}
      <div className="flex items-center justify-center gap-1.5">
        {["Visa", "Mastercard", "Amex"].map((method) => (
          <span
            key={method}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
          >
            {method}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Secured by Paddle · All major cards accepted
      </p>
    </div>
  );
};

export default PaddleCheckoutButton;

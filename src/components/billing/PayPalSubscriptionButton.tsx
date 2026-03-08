import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "AVZxi-ykDACzyXDxwnTeiQoHQFh-_PmShWmC6aeToqxjdnNqOTWGWHJYkCy_ZnGvZvJM-PZs_NfGIMi-";

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription&currency=USD&debug=${import.meta.env.DEV}&components=buttons`;

let sdkLoadPromise: Promise<void> | null = null;

function loadPayPalSdk(): Promise<void> {
  if ((window as any).paypal) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.setAttribute("data-sdk-integration-source", "button-factory");
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error("Failed to load PayPal SDK"));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

interface PayPalSubscriptionButtonProps {
  planId: string;
  onApproved: (subscriptionId: string) => void;
  disabled?: boolean;
}

const PayPalSubscriptionButton = ({ planId, onApproved, disabled }: PayPalSubscriptionButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || disabled) return;

    let cancelled = false;

    const render = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadPayPalSdk();

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";

        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) {
          throw new Error("PayPal SDK not available");
        }

        paypal.Buttons({
          fundingSource: paypal.FUNDING.PAYPAL, // Disable card — not supported for subscriptions in sandbox
          style: {
            shape: "pill",
            color: "blue",
            layout: "vertical",
            label: "subscribe",
          },
          createSubscription: (_data: any, actions: any) => {
            return actions.subscription.create({ plan_id: planId });
          },
          onClick: (data: any) => {
            console.log("[PayPal Sub] Button clicked, plan:", planId, data);
          },
          onApprove: async (data: any) => {
            console.log("[PayPal Sub] Approved:", data);
            if (data.subscriptionID) {
              onApproved(data.subscriptionID);
            }
          },
          onCancel: (data: any) => {
            console.log("[PayPal Sub] Cancelled:", data);
            toast.info("Subscription checkout was cancelled.");
          },
          onError: (err: any) => {
            console.error("[PayPal Sub] Checkout error:", err);
            const msg = err?.message || String(err);
            const isFundingIssue = msg.includes("funding") || msg.includes("card") || msg.includes("INSTRUMENT_DECLINED");
            if (isFundingIssue) {
              toast.error("Card checkout isn't available for subscriptions in this environment. Please use PayPal account login.");
            } else if (import.meta.env.DEV) {
              toast.error(`PayPal error: ${msg.slice(0, 200)}`);
            } else {
              toast.error("PayPal checkout error. Please try again.");
            }
          },
        }).render(containerRef.current);

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("[PayPal Sub] SDK load error:", err);
          setError(err.message || "Failed to load PayPal");
          setLoading(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [planId, onApproved, disabled]);

  if (disabled) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Select this plan to subscribe
      </div>
    );
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2 text-sm text-muted-foreground">Loading PayPal...</span>
        </div>
      )}
      {error && <p className="text-sm text-destructive text-center py-2">{error}</p>}
      <div ref={containerRef} className={loading ? "hidden" : ""} />
      <p className="text-xs text-muted-foreground text-center mt-2">
        Subscribe using your PayPal account
      </p>
    </div>
  );
};

export default PayPalSubscriptionButton;

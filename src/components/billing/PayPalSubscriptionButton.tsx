import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// PayPal Sandbox Client ID - publishable key, safe for frontend
const PAYPAL_CLIENT_ID = "AVZxi-ykDACzyXDxwnTeiQoHQFh-_PmShWmC6aeToqxjdnNqOTWGWHJYkCy_ZnGvZvJM-PZs_NfGIMi-";

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;

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
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || disabled) return;

    let cancelled = false;
    renderedRef.current = false;

    const render = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadPayPalSdk();

        if (cancelled || !containerRef.current) return;

        // Clear previous buttons
        containerRef.current.innerHTML = "";

        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) {
          throw new Error("PayPal SDK not available");
        }

        paypal.Buttons({
          style: {
            shape: "pill",
            color: "blue",
            layout: "vertical",
            label: "subscribe",
          },
          createSubscription: (_data: any, actions: any) => {
            return actions.subscription.create({
              plan_id: planId,
            });
          },
          onApprove: async (data: any) => {
            if (data.subscriptionID) {
              onApproved(data.subscriptionID);
            }
          },
          onError: (err: any) => {
            console.error("PayPal button error:", err);
            toast.error("PayPal checkout error. Please try again.");
          },
        }).render(containerRef.current);

        renderedRef.current = true;
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("PayPal SDK load error:", err);
          setError(err.message || "Failed to load PayPal");
          setLoading(false);
          toast.error("Failed to load PayPal. Please refresh and try again.");
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
      {error && (
        <p className="text-sm text-destructive text-center py-2">{error}</p>
      )}
      <div ref={containerRef} className={loading ? "hidden" : ""} />
    </div>
  );
};

export default PayPalSubscriptionButton;

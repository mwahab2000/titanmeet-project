import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "AVZxi-ykDACzyXDxwnTeiQoHQFh-_PmShWmC6aeToqxjdnNqOTWGWHJYkCy_ZnGvZvJM-PZs_NfGIMi-";

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&debug=${import.meta.env.DEV}&components=buttons`;

let sdkLoadPromise: Promise<void> | null = null;

function loadPayPalOrderSdk(): Promise<void> {
  if ((window as any).paypal) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
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

interface PayPalOneTimeButtonProps {
  planId: string;
  onCreateOrder: (planId: string) => Promise<string>;
  onCaptureOrder: (orderId: string) => Promise<boolean>;
  disabled?: boolean;
}

const PayPalOneTimeButton = ({ planId, onCreateOrder, onCaptureOrder, disabled }: PayPalOneTimeButtonProps) => {
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
        await loadPayPalOrderSdk();

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";

        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) {
          throw new Error("PayPal SDK not available");
        }

        paypal.Buttons({
          style: {
            shape: "pill",
            color: "gold",
            layout: "vertical",
            label: "pay",
          },
          onClick: (data: any) => {
            console.log("[PayPal Order] Button clicked, plan:", planId, data);
          },
          createOrder: async () => {
            try {
              return await onCreateOrder(planId);
            } catch (err: any) {
              console.error("[PayPal Order] createOrder failed:", err);
              const msg = err?.message || String(err);
              if (import.meta.env.DEV) {
                toast.error(`Order creation failed: ${msg.slice(0, 200)}`);
              } else {
                toast.error("Failed to create order. Please try again.");
              }
              throw err;
            }
          },
          onApprove: async (data: any) => {
            console.log("[PayPal Order] Approved:", data);
            await onCaptureOrder(data.orderID);
          },
          onCancel: (data: any) => {
            console.log("[PayPal Order] Cancelled:", data);
            toast.info("Payment was cancelled.");
          },
          onError: (err: any) => {
            console.error("[PayPal Order] Checkout error:", err);
            const msg = err?.message || String(err);
            if (import.meta.env.DEV) {
              toast.error(`PayPal error: ${msg.slice(0, 200)}`);
            } else {
              toast.error("PayPal checkout error. Please try again.");
            }
          },
        }).render(containerRef.current);

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("[PayPal Order] SDK load error:", err);
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
  }, [planId, onCreateOrder, onCaptureOrder, disabled]);

  if (disabled) return null;

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
    </div>
  );
};

export default PayPalOneTimeButton;

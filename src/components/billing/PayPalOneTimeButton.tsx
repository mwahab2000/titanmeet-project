import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// PayPal Sandbox Client ID - publishable key, safe for frontend
const PAYPAL_CLIENT_ID = "AVZxi-ykDACzyXDxwnTeiQoHQFh-_PmShWmC6aeToqxjdnNqOTWGWHJYkCy_ZnGvZvJM-PZs_NfGIMi-";

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;

let sdkLoadPromise: Promise<void> | null = null;

function loadPayPalOrderSdk(): Promise<void> {
  // If subscription SDK is already loaded, we can reuse it
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
          createOrder: async () => {
            return await onCreateOrder(planId);
          },
          onApprove: async (data: any) => {
            await onCaptureOrder(data.orderID);
          },
          onError: (err: any) => {
            console.error("PayPal button error:", err);
            toast.error("PayPal checkout error. Please try again.");
          },
        }).render(containerRef.current);

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("PayPal SDK load error:", err);
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

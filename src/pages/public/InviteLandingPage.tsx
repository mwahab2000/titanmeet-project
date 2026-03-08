import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const InviteLandingPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Missing token"); return; }

    const validate = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("invite-get", {
          body: { token },
        });

        if (fnErr || data?.error) {
          setError(data?.error || "Invalid invitation link");
          return;
        }

        // Redirect to public event page
        if (data.client_slug && data.event_slug) {
          navigate(`/${data.client_slug}/${data.event_slug}`, { replace: true });
        } else {
          setError("Event page not available yet.");
        }
      } catch {
        setError("Failed to validate invitation");
      }
    };

    validate();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-2xl font-bold text-foreground">Invitation</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading your invitation…</p>
      </div>
    </div>
  );
};

export default InviteLandingPage;

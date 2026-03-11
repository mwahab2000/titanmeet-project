import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, edgeFunctionUrl } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageState = "loading" | "invite" | "confirmed" | "error";

interface InviteData {
  event_title: string;
  attendee_name: string;
  client_slug: string;
  event_slug: string;
  status: string;
}

const InviteLandingPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string>("Invalid or expired link");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!token) { setError("Missing token"); setState("error"); return; }

    const validate = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("invite-get", {
          body: { token },
        });

        if (fnErr || data?.error) {
          setError(data?.error || "Invalid invitation link");
          setState("error");
          return;
        }

        setInvite(data);

        if (data.status === "rsvp_yes" || data.rsvp_at) {
          setState("confirmed");
        } else {
          setState("invite");
        }
      } catch {
        setError("Failed to validate invitation");
        setState("error");
      }
    };

    validate();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setConfirming(true);
    try {
      const url = edgeFunctionUrl("confirm-rsvp", { token });
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Confirmation failed");
        setState("error");
        return;
      }

      setState("confirmed");
    } catch {
      setError("Failed to confirm. Please try again.");
      setState("error");
    } finally {
      setConfirming(false);
    }
  };

  const eventUrl = invite?.client_slug && invite?.event_slug
    ? `/${invite.client_slug}/${invite.event_slug}`
    : null;

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-gray-500">Loading your invitation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <img
            src="/images/TitanMeetLogo.png"
            alt="TitanMeet"
            className="h-8 mx-auto mb-6"
          />
        </div>

        {/* Content */}
        <div className="px-8 pb-8">
          {state === "invite" && invite && (
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  You're Invited!
                </h1>
                <p className="text-gray-600 text-lg">
                  Hi {invite.attendee_name}!
                </p>
                <p className="text-gray-500">
                  You've been invited to{" "}
                  <span className="font-semibold text-gray-700">
                    {invite.event_title}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  {confirming ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    "✓ Confirm My Attendance"
                  )}
                </Button>

                {eventUrl && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(eventUrl)}
                    className="w-full h-11 text-gray-600 border-gray-200 rounded-xl"
                  >
                    View Event Details →
                  </Button>
                )}
              </div>
            </div>
          )}

          {state === "confirmed" && invite && (
            <div className="text-center space-y-6">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  You're Confirmed! 🎉
                </h1>
                <p className="text-gray-500">
                  Hi {invite.attendee_name}, your attendance for{" "}
                  <span className="font-semibold text-gray-700">
                    {invite.event_title}
                  </span>{" "}
                  has been confirmed.
                </p>
                <p className="text-emerald-600 font-medium mt-2">
                  Thank you for responding!
                </p>
              </div>

              {eventUrl && (
                <Button
                  onClick={() => navigate(eventUrl)}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  View Event Details →
                </Button>
              )}
            </div>
          )}

          {state === "error" && (
            <div className="text-center space-y-6">
              <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  Invalid or Expired Link
                </h1>
                <p className="text-gray-500">{error}</p>
                <p className="text-gray-400 text-sm mt-2">
                  Please contact the event organizer for a new invitation.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 text-center">
          <p className="text-gray-400 text-xs">Powered by TitanMeet</p>
        </div>
      </div>
    </div>
  );
};

export default InviteLandingPage;

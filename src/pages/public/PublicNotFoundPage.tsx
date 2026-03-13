import { Link } from "react-router-dom";
import type { NotFoundReason } from "@/lib/publicSite/types";

interface Props {
  reason?: NotFoundReason;
}

const copy: Record<NotFoundReason, { title: string; description: string }> = {
  client_not_found: {
    title: "Client Not Found",
    description: "The organization you're looking for doesn't exist or the URL may be incorrect.",
  },
  event_not_found: {
    title: "Event Not Found",
    description: "The event you're looking for doesn't exist or the URL may be incorrect.",
  },
};

const PublicNotFoundPage = ({ reason }: Props) => {
  const { title, description } = copy[reason ?? "event_not_found"];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground/30 font-display">404</h1>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <Link to="/" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default PublicNotFoundPage;

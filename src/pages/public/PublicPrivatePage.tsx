import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

const PublicPrivatePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <div className="text-center max-w-md space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">This Event is Private</h2>
      <p className="text-muted-foreground">This event hasn't been published yet. Check back later or contact the organizer.</p>
      <Link to="/" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
        Go Home
      </Link>
    </div>
  </div>
);

export default PublicPrivatePage;

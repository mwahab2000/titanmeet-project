import { Link } from "react-router-dom";

const PublicNotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <div className="text-center max-w-md space-y-4">
      <h1 className="text-6xl font-bold text-muted-foreground/30 font-display">404</h1>
      <h2 className="text-xl font-semibold text-foreground">Event Not Found</h2>
      <p className="text-muted-foreground">The event you're looking for doesn't exist or the URL may be incorrect.</p>
      <Link to="/" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
        Go Home
      </Link>
    </div>
  </div>
);

export default PublicNotFoundPage;

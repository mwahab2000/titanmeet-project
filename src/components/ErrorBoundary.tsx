import * as Sentry from "@sentry/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Loading chunk");
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-center max-w-md space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            {this.state.isChunkError ? "Update Available" : "Something went wrong"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {this.state.isChunkError
              ? "A newer version of the app is available. Please reload to continue."
              : "An unexpected error occurred. Please try reloading the page."}
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

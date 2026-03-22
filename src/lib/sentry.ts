import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || "development";

const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1;
const replaysSessionSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE) || 0.05;
const replaysOnErrorSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE) || 1.0;

export function initSentry() {
  if (!dsn) {
    console.info("[Sentry] Disabled — no VITE_SENTRY_DSN configured.");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    enabled: !!dsn,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],

    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,

    // Strip PII from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "ui.input") return null;
      return breadcrumb;
    },

    // Scrub sensitive data from events
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}

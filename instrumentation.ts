// Next.js instrumentation hook — runs once per server process.
// Loads the runtime-specific Sentry config and exposes Sentry's request-error
// hook so RSC and route-handler errors get captured.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

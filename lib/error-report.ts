// Single error-reporting funnel. Server actions and route handlers should
// catch unexpected errors here so we get user-scoped reports in Sentry.
//
// Usage:
//   try { ... } catch (e) { reportError(e, { action: "setRSVP", userId }); throw e; }
import * as Sentry from "@sentry/nextjs";

interface Context {
  action?: string;
  userId?: string;
  groupId?: string;
  eventId?: string;
  [key: string]: unknown;
}

export function reportError(err: unknown, ctx: Context = {}): void {
  if (!process.env.SENTRY_DSN) {
    // Local / unconfigured — still log for the operator.
    console.error("[error-report]", ctx, err);
    return;
  }
  Sentry.withScope((scope) => {
    if (ctx.userId) scope.setUser({ id: ctx.userId });
    for (const [k, v] of Object.entries(ctx)) {
      if (k === "userId") continue;
      scope.setTag(k, String(v));
    }
    Sentry.captureException(err);
  });
}

/**
 * Wrap a server action body so unexpected errors are reported. Caller still
 * sees the original exception (we rethrow). RateLimitError and validation
 * errors are intentionally NOT reported — they're expected user-facing
 * outcomes.
 */
export async function withErrorReport<T>(
  ctx: Context,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    const name = e instanceof Error ? e.constructor.name : "";
    const SKIP = new Set(["RateLimitError", "LLMRateLimitError", "ZodError"]);
    if (!SKIP.has(name)) reportError(e, ctx);
    throw e;
  }
}

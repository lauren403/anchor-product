import * as Sentry from "@sentry/nextjs";

/**
 * Initialise Sentry on the server.
 *
 * WHY THERE IS NO NEXT_RUNTIME CHECK
 * ----------------------------------
 * This used to be gated on `process.env.NEXT_RUNTIME === "nodejs" | "edge"`,
 * which is the stock Next.js convention. Anchor does not run on stock Next.js:
 * it is built by `vinext` and served from a single Cloudflare Worker.
 *
 * `vinext` never sets NEXT_RUNTIME — verified two ways:
 *   1. `grep -rn NEXT_RUNTIME` across all 740 files of vinext@0.0.50: no matches.
 *   2. In our own built artifact, dist/server/index.js reads
 *      `process.env.NEXT_RUNTIME` exactly twice and assigns it zero times.
 *
 * So both branches compared against `undefined`, neither config was ever
 * imported, and `Sentry.init` never ran. Not "Sentry failed to send" —
 * Sentry was never started. Every unhandled server error was invisible, and
 * /api/acceptance/sentry returned 503 delivery_failed because
 * captureException produced no eventId and flush() resolved false.
 *
 * There is exactly one server runtime here, so there is nothing to branch on.
 * The edge config is the correct one for a Worker: the server config sets
 * `includeLocalVariables`, which is a Node-only capability.
 */
export async function register() {
  await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;

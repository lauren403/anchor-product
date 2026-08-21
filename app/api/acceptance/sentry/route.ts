// WHY THIS FOLDER IS NOT NAMED "_acceptance"
//
// It used to be. In the Next.js App Router an underscore-prefixed folder is a
// PRIVATE folder: "opting the folder and all its subfolders out of routing".
// So /api/_acceptance/sentry was never a route. Every request 404d at the
// framework level, before a single line of the guard below was evaluated.
//
// That is the whole of the "endpoint returns 404 in acceptance mode" known
// issue on the v7 beta record, and it is why the synthetic-event and rollback
// stages were trimmed from the smoke test on 2026-08-04 rather than fixed.
//
// Do not rename this folder back. If it needs to read as internal, say so here
// - the guard below is what keeps it unreachable, not the folder name.
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

class AnchorSyntheticAcceptanceError extends Error {
  override name = "AnchorSyntheticAcceptanceError";
}

function unavailable(): Response {
  return new Response(null, {
    status: 404,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request): Promise<Response> {
  // The acceptance flag arrives two ways on purpose. Wrangler passes it at
  // DEPLOY time as a Worker var, which does not reach process.env in this
  // build, so the gate always failed closed and this endpoint 404d during the
  // smoke test (deferred known issue on the v7 beta record, 2026-08-04).
  // The NEXT_PUBLIC_ copy is inlined at BUILD time - the mechanism the health
  // route already relies on - so it is present at runtime. Either being "true"
  // is enough; every other condition below is unchanged, so this still fails
  // closed in beta and production, where neither flag is ever set.
  if (
    process.env.NEXT_PUBLIC_ANCHOR_ENV !== "preview" ||
    (process.env.NEXT_PUBLIC_ANCHOR_SMOKE_ACCEPTANCE_ENABLED !== "true" &&
      process.env.ANCHOR_SMOKE_ACCEPTANCE_ENABLED !== "true") ||
    request.headers.get("x-anchor-acceptance-gate") !== "verified"
  ) {
    return unavailable();
  }

  const sentinel = request.headers.get("x-anchor-synthetic-sentinel") ?? "";
  if (!/^anchor-smoke-[a-f0-9]{32}$/.test(sentinel)) return unavailable();

  let eventId = "";
  Sentry.withScope((scope) => {
    scope.setUser({ id: sentinel, email: `${sentinel}@invalid.example` });
    scope.setTag("anchor.synthetic.barrier", sentinel);
    scope.setExtra("anchor.synthetic.capacity", sentinel);
    scope.setContext("anchor.synthetic.moment", { value: sentinel });
    scope.addBreadcrumb({ category: "anchor.synthetic", message: sentinel });
    scope.setFingerprint([sentinel]);
    eventId = Sentry.captureException(
      new AnchorSyntheticAcceptanceError(`Synthetic acceptance only: ${sentinel}`),
    );
  });

  if (!eventId || !(await Sentry.flush(10_000))) {
    return Response.json(
      { status: "delivery_failed" },
      { status: 503, headers: { "cache-control": "no-store, max-age=0" } },
    );
  }

  return Response.json(
    { status: "accepted", eventId },
    { status: 202, headers: { "cache-control": "no-store, max-age=0" } },
  );
}
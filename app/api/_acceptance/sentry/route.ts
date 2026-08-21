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
  // The acceptance flag is supplied two ways on purpose. Wrangler passes it at
  // DEPLOY time as a Worker var, which does not reach process.env in this build,
  // so the gate always failed closed and the endpoint 404d during the smoke test
  // (recorded as a deferred known issue on the v7 beta record, 2026-08-04).
  // The NEXT_PUBLIC_ copy is inlined at BUILD time - the same mechanism the
  // health route already relies on - so it is present at runtime. Either one
  // being "true" is enough; every other condition below is unchanged, so this
  // still fails closed in beta and production, where neither is ever set.
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
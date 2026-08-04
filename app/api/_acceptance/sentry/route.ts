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
  if (
    process.env.NEXT_PUBLIC_ANCHOR_ENV !== "preview" ||
    process.env.ANCHOR_SMOKE_ACCEPTANCE_ENABLED !== "true" ||
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

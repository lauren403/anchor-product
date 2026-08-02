export const dynamic = "force-dynamic";

export function GET(): Response {
  const environment = process.env.NEXT_PUBLIC_ANCHOR_ENV ?? "local";
  const release = process.env.NEXT_PUBLIC_RELEASE_SHA ?? "development";

  return Response.json(
    {
      status: "ok",
      service: "anchor",
      environment,
      release,
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}

import { timingSafeEqual } from "node:crypto";

// The application artifact is produced by the verified Vinext build before
// Wrangler bundles this acceptance-only adapter.
// @ts-expect-error generated deployment artifact is absent during source typecheck
import app from "../dist/server/index.js";

function unauthorized(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "cache-control": "no-store, max-age=0",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

async function hasValidBearer(request: Request, expected: string): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || expected.length < 32) return false;

  const supplied = authorization.slice("Bearer ".length);
  const encoded = new TextEncoder();
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoded.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoded.encode(expected)),
  ]);

  return timingSafeEqual(new Uint8Array(suppliedDigest), new Uint8Array(expectedDigest));
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    if (!(await hasValidBearer(request, env.ANCHOR_SMOKE_TOKEN))) {
      return unauthorized();
    }

    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.set("x-anchor-acceptance-gate", "verified");

    return app.fetch(new Request(request, { headers }), env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;

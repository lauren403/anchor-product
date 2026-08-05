import { timingSafeEqual } from "node:crypto";

// Rehearsal-only gate. The application artifact is produced by the verified
// Vinext build before Wrangler bundles this adapter (same pattern as
// smoke/worker.ts). It fronts the real v7 app with a browser-native HTTP Basic
// password prompt so the throwaway workers.dev rehearsal beta is not publicly
// open. NOT for production: production carries no gate here and is fronted by
// Cloudflare at the edge on the real hostname.
// @ts-expect-error generated deployment artifact is absent during source typecheck
import app from "../dist/server/index.js";

const REALM = 'Basic realm="Anchor closed beta", charset="UTF-8"';

function requireAuth(): Response {
  return new Response("Anchor closed beta — authentication required.\n", {
    status: 401,
    headers: {
      "www-authenticate": REALM,
      "cache-control": "no-store, max-age=0",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

// Constant-time compare of BOTH username and password via fixed-length SHA-256
// digests (32 bytes each, so timingSafeEqual never throws on length). Fails
// closed if the expected password is unset or shorter than 8 chars.
export async function hasValidBasic(request: Request, expectedUser: string, expectedPass: string): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ") || expectedPass.length < 8) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(authorization.slice("Basic ".length)), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  const [userDigest, expectedUserDigest, passDigest, expectedPassDigest] = await Promise.all([
    sha256(user), sha256(expectedUser), sha256(pass), sha256(expectedPass),
  ]);
  // Evaluate both compares before combining so neither result leaks via timing.
  const userOk = timingSafeEqual(userDigest, expectedUserDigest);
  const passOk = timingSafeEqual(passDigest, expectedPassDigest);
  return userOk && passOk;
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext): Promise<Response> {
    const secrets = env as unknown as Record<string, string | undefined>;
    const expectedUser = secrets.ANCHOR_BETA_USER ?? "beta";
    const expectedPass = secrets.ANCHOR_BETA_PASSWORD ?? "";
    if (!(await hasValidBasic(request, expectedUser, expectedPass))) {
      return requireAuth();
    }
    const headers = new Headers(request.headers);
    headers.delete("authorization");
    headers.set("x-anchor-beta-gate", "verified");
    return app.fetch(new Request(request, { headers }), env, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;

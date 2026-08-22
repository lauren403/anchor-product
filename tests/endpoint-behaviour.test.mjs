import assert from "node:assert/strict";
import test from "node:test";

// Behavioural tests for the built Worker's endpoints.
//
// WHY THIS FILE EXISTS
// --------------------
// Eight of the ten tests in operations.test.mjs assert by reading source files as
// strings and regex-matching them. They check that code was WRITTEN, not that it
// WORKS, and two real defects survived for weeks because of it:
//
//   * "synthetic Sentry acceptance route fails closed outside the gated preview"
//     passed while /api/_acceptance/sentry returned 404 — the route was hidden inside
//     a Next.js private folder and did not exist at all. The test was regex-matching
//     the source of a file that was never routable. Fixed in #44.
//
//   * "official Sentry SDK covers browser, Node.js and Edge runtimes" passed while
//     Sentry.init had NEVER executed on the server, because instrumentation.ts gated
//     it on NEXT_RUNTIME, which nothing sets on a Cloudflare Worker. So the app had no
//     server-side error monitoring at all. Fixed in #47.
//
// These call the built artifact instead, using the same worker.fetch pattern
// rendered-html.test.mjs already uses. Requires `npm run build` first, which
// `npm test` does before running this file.

const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function loadWorker() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(url.href);
  return worker;
}

async function call(worker, path, init = {}) {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);
}

const GATED = {
  "x-anchor-acceptance-gate": "verified",
  "x-anchor-synthetic-sentinel": `anchor-smoke-${"0".repeat(31)}1`,
};

test("health endpoint answers, and carries no user data or secrets", async () => {
  const worker = await loadWorker();
  const response = await call(worker, "/api/health");
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "anchor");
  // Exactly these four keys. A new one here should be a decision, not an accident.
  assert.deepEqual(Object.keys(body).sort(), ["environment", "release", "service", "status"]);
});

test("acceptance route fails closed without the gate header", async () => {
  const worker = await loadWorker();
  assert.equal((await call(worker, "/api/acceptance/sentry", { method: "POST" })).status, 404);
});

test("acceptance route fails closed on a malformed sentinel", async () => {
  const worker = await loadWorker();
  const response = await call(worker, "/api/acceptance/sentry", {
    method: "POST",
    headers: { ...GATED, "x-anchor-synthetic-sentinel": "not-a-valid-sentinel" },
  });
  assert.equal(response.status, 404);
});

test("acceptance route exists — GET is 405, not 404", async () => {
  // 404 here would mean the route is unroutable again, which is the #44 regression.
  const worker = await loadWorker();
  assert.equal((await call(worker, "/api/acceptance/sentry")).status, 405);
});

// This is the test that would have caught the NEXT_RUNTIME defect. It asserts the
// correct behaviour for whichever build it was handed, so it is meaningful in both
// the ordinary quality gate and the acceptance workflow rather than being skipped:
//
//   * a preview + acceptance build  -> 202 with an event id, proving Sentry.init ran
//   * any other build               -> 404, proving the route stays shut
//
// NEXT_PUBLIC_ANCHOR_ENV is inlined at build time, so the build itself decides which
// case applies; /api/health reports it.
test("gated acceptance call: 202 with an event id in an acceptance build, otherwise closed", async () => {
  const worker = await loadWorker();
  const { environment } = await (await call(worker, "/api/health")).json();

  const acceptanceBuild =
    environment === "preview" &&
    (process.env.ANCHOR_SMOKE_ACCEPTANCE_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_ANCHOR_SMOKE_ACCEPTANCE_ENABLED === "true");

  const response = await call(worker, "/api/acceptance/sentry", { method: "POST", headers: GATED });

  if (!acceptanceBuild) {
    assert.equal(response.status, 404, "acceptance route must stay shut outside a gated preview build");
    return;
  }

  assert.equal(response.status, 202, "expected 202 accepted, not 503 delivery_failed — is Sentry.init running?");
  const body = await response.json();
  assert.equal(body.status, "accepted");
  assert.match(body.eventId, /^[a-f0-9]{32}$/);
});

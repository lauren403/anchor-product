import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("health endpoint exposes no user data or secrets", async () => {
  const route = await readFile("app/api/health/route.ts", "utf8");
  assert.match(route, /status: "ok"/);
  assert.doesNotMatch(route, /SENTRY_DSN|user|email|moment|barrier/i);
  assert.match(route, /no-store/);
});

test("monitoring strips identity, breadcrumbs, contexts, query and fragment data", async () => {
  const source = await readFile("lib/sentry-privacy.ts", "utf8");
  for (const expected of ["delete event.user", "delete event.request", "delete event.breadcrumbs", "delete event.contexts", "sendDefaultPii: false", "enableLogs: false"]) {
    assert.ok(source.includes(expected), `Missing monitoring privacy control: ${expected}`);
  }
  assert.doesNotMatch(source, /replayIntegration|feedbackIntegration|localStorage\.getItem|sessionStorage\.getItem/i);
});

test("official Sentry SDK covers browser, Node.js and Edge runtimes", async () => {
  const [client, instrumentation, server, edge] = await Promise.all([
    readFile("instrumentation-client.ts", "utf8"),
    readFile("instrumentation.ts", "utf8"),
    readFile("sentry.server.config.ts", "utf8"),
    readFile("sentry.edge.config.ts", "utf8"),
  ]);
  assert.match(client, /@sentry\/nextjs/);
  assert.match(instrumentation, /captureRequestError/);
  assert.match(server, /includeLocalVariables: false/);
  assert.match(edge, /privacySafeSentryOptions/);
});

test("release ledger covers code, content, approvals, rollback and decision", async () => {
  const record = JSON.parse(await readFile("governance/releases/anchor-v7-beta-rc1.json", "utf8"));
  assert.equal(record.code.repository, "PENDING_GITHUB_REPOSITORY");
  assert.ok(record.content.taxonomy_version);
  assert.ok(record.risk.rollback_ref);
  assert.equal(record.governance.approvals.length, 6);
  assert.equal(record.decision.status, "draft");
});

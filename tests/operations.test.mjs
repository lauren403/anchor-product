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
  for (const expected of ["delete event.user", "delete event.request", "delete event.breadcrumbs", "delete event.contexts", "delete event.message", "delete exception.value", "delete span.description", "sendDefaultPii: false", "enableLogs: false"]) {
    assert.ok(source.includes(expected), `Missing monitoring privacy control: ${expected}`);
  }
  assert.doesNotMatch(source, /replayIntegration|feedbackIntegration|localStorage\.getItem|sessionStorage\.getItem/i);
});

test("monitoring scrubber removes sensitive values while preserving stack frames", async () => {
  const { scrubSentryEvent } = await import("../lib/sentry-privacy.ts");
  const secret = "private-moment-and-email@example.com";
  const event = {
    message: secret,
    request: { url: `https://example.test/?moment=${secret}` },
    user: { email: secret },
    breadcrumbs: [{ message: secret }],
    contexts: { response: { body: secret } },
    extra: { outcome: secret },
    tags: { barrier: secret },
    fingerprint: [secret],
    server_name: secret,
    transaction: `/moment/${secret}`,
    transaction_info: { source: secret },
    exception: { values: [{ type: "TypeError", value: secret, stacktrace: { frames: [{ filename: "app/page.tsx", lineno: 1 }] } }] },
    spans: [{ description: secret, data: { capacity: secret }, tags: { outcome: secret } }],
  };

  const scrubbed = scrubSentryEvent(event);
  assert.doesNotMatch(JSON.stringify(scrubbed), new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(scrubbed.transaction, "anchor-route");
  assert.equal(scrubbed.exception.values[0].type, "TypeError");
  assert.equal(scrubbed.exception.values[0].stacktrace.frames[0].filename, "app/page.tsx");
});

test("official Sentry SDK covers browser, Node.js and Edge runtimes", async () => {
  const [client, instrumentation, server, edge] = await Promise.all([
    readFile("instrumentation-client.ts", "utf8"),
    readFile("instrumentation.ts", "utf8"),
    readFile("sentry.server.config.ts", "utf8"),
    readFile("sentry.edge.config.ts", "utf8"),
  ]);
  assert.match(client, /@sentry\/nextjs/);
  assert.doesNotMatch(client, /integrations:\s*\[\]/);
  assert.match(instrumentation, /captureRequestError/);
  assert.match(server, /includeLocalVariables: false/);
  assert.doesNotMatch(server, /integrations:\s*\[\]/);
  assert.match(edge, /privacySafeSentryOptions/);
  assert.doesNotMatch(edge, /integrations:\s*\[\]/);
});

test("Sentry source maps use the Vinext Vite build and are never public", async () => {
  const [viteConfig, nextConfig] = await Promise.all([
    readFile("vite.config.ts", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);
  assert.match(viteConfig, /sentryVitePlugin/);
  assert.match(viteConfig, /sentryBuildConfigured\s*\?\s*\[/);
  assert.match(viteConfig, /sourcemap:\s*sentryBuildConfigured \? \("hidden" as const\) : false/);
  assert.match(viteConfig, /filesToDeleteAfterUpload:\s*\["\.\/dist\/\*\*\/\*\.map"\]/);
  assert.doesNotMatch(nextConfig, /withSentryConfig/);
});

test("release ledger covers code, content, approvals, rollback and decision", async () => {
  const record = JSON.parse(await readFile("governance/releases/anchor-v7-beta-rc1.json", "utf8"));
  assert.equal(record.code.repository, "PENDING_GITHUB_REPOSITORY");
  assert.ok(record.content.taxonomy_version);
  assert.ok(record.risk.rollback_ref);
  assert.equal(record.governance.approvals.length, 6);
  assert.equal(record.decision.status, "draft");
});

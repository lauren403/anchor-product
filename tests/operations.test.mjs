import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("health endpoint exposes no user data or secrets", async () => {
  const route = await readFile("app/api/health/route.ts", "utf8");
  assert.match(route, /status: "ok"/);
  assert.doesNotMatch(route, /SENTRY_DSN|user|email|moment|barrier/i);
  assert.match(route, /no-store/);
});

test("monitoring strips identity, breadcrumbs, contexts, query and fragment data", async () => {
  // THIS TEST USED TO READ THE SOURCE AND ASSERT IT CONTAINED THE STRING "delete event.user".
  //
  // That is the "check that the code was written" pattern this repository keeps digging out,
  // and on 2026-08-24 it did exactly what that pattern always does. lib/sentry-privacy.ts
  // stopped deleting event.user and started setting { ip_address: "0.0.0.0" } instead - a
  // STRONGER privacy control, because deleting the field let Sentry's ingestion fill an IP
  // back in and derive a location from it. The old test would have failed that improvement
  // and passed a change that deleted the user object while leaking through some other field.
  // It was testing the spelling, not the behaviour.
  //
  // So it now runs the scrubber and looks at what comes out.
  const { scrubSentryEvent, privacySafeSentryOptions, NON_GEOLOCATABLE_IP } = await import(
    "../lib/sentry-privacy.ts"
  );

  const scrubbed = scrubSentryEvent({
    user: { id: "u1", email: "someone@example.com", username: "someone", name: "Some One",
            ip_address: "203.0.113.9", geo: { city: "Nedlands", country_code: "AU" } },
    request: { url: "https://example.test/?moment=x", cookies: { s: "1" } },
    breadcrumbs: [{ message: "x" }],
    contexts: { response: { body: "x" } },
    extra: { outcome: "x" },
    message: "x",
    fingerprint: ["x"],
    server_name: "worker-1",
    transaction_info: { source: "url" },
    tags: { barrier: "x" },
    exception: { values: [{ type: "TypeError", value: "x" }] },
    spans: [{ description: "x", data: { a: 1 }, tags: { b: 2 } }],
  });

  // Identity: gone. Every field an application could populate.
  for (const field of ["id", "email", "username", "name", "data", "geo"]) {
    assert.equal(scrubbed.user?.[field], undefined, `event.user.${field} survived the scrubber`);
  }

  // The IP is not merely removed - it is REPLACED. Removing it leaves the field for
  // Sentry's ingestion to fill in from the connection, which is how acceptance runs #24
  // to #30 came back carrying a country, a region, and on #27 a city.
  assert.equal(scrubbed.user?.ip_address, NON_GEOLOCATABLE_IP);
  assert.notEqual(scrubbed.user?.ip_address, "203.0.113.9");

  for (const field of ["request", "breadcrumbs", "contexts", "extra", "message",
                       "fingerprint", "server_name", "transaction_info", "tags"]) {
    assert.equal(scrubbed[field], undefined, `event.${field} survived the scrubber`);
  }

  assert.equal(scrubbed.exception.values[0].value, undefined, "exception value survived");
  assert.equal(scrubbed.exception.values[0].type, "TypeError", "exception type must be kept");
  assert.equal(scrubbed.spans[0].description, undefined);
  assert.equal(scrubbed.spans[0].data, undefined);
  assert.equal(scrubbed.spans[0].tags, undefined);

  // Options read from the function, not grepped out of the file.
  const options = privacySafeSentryOptions();
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.enableLogs, false);
  assert.equal(options.beforeBreadcrumb(), null, "breadcrumbs must be dropped at the source");

  // A negative source check is a different thing from asserting code was written: there is
  // no behaviour to observe for an integration that must never be imported at all.
  const source = await readFile("lib/sentry-privacy.ts", "utf8");
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


test("Sentry source-map release identity matches runtime events", async () => {
  const [privacy, vite] = await Promise.all([
    readFile("lib/sentry-privacy.ts", "utf8"),
    readFile("vite.config.ts", "utf8"),
  ]);
  assert.match(privacy, /release: `anchor@\$\{release\}`/);
  assert.match(vite, /name: `anchor@\$\{/);
});

test("synthetic Sentry acceptance route fails closed outside the gated preview", async () => {
  const route = await readFile("app/api/acceptance/sentry/route.ts", "utf8");
  assert.match(route, /NEXT_PUBLIC_ANCHOR_ENV !== "preview"/);
  assert.match(route, /ANCHOR_SMOKE_ACCEPTANCE_ENABLED !== "true"/);
  assert.match(route, /x-anchor-acceptance-gate/);
  assert.match(route, /AnchorSyntheticAcceptanceError/);
  assert.match(route, /Sentry\.flush\(10_000\)/);
  assert.doesNotMatch(route, /export (?:async )?function GET/);
});

test("Cloudflare smoke adapter gates every application request", async () => {
  const source = await readFile("smoke/worker.ts", "utf8");
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /env\.ANCHOR_SMOKE_TOKEN/);
  assert.match(source, /headers\.delete\("authorization"\)/);
  assert.match(source, /return unauthorized\(\)/);
});

test("no route or page is hidden inside a private underscore folder", async () => {
  // The acceptance endpoint lived at app/api/_acceptance/sentry/route.ts for
  // months and 404d every single time it was called. In the Next.js App Router
  // an underscore-prefixed folder is a PRIVATE folder: it and all its subfolders
  // are opted out of routing. Nothing errors, nothing warns - the route simply
  // does not exist, and the failure is indistinguishable from a bad guard.
  //
  // This walks app/ and fails if any routable file is parked in one.
  const offenders = [];
  async function walk(dir, hidden) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(next, hidden || entry.name.startsWith("_"));
      } else if (hidden && /^(route|page)\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        offenders.push(next);
      }
    }
  }
  await walk("app", false);
  assert.deepEqual(offenders, [], `unroutable files in a private folder: ${offenders.join(", ")}`);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";

import { checkDeployedAssets, extractAssetPaths } from "../scripts/deployed-asset-check.mjs";

// THE SELF-CHECK FOR THE DEPLOY GATE
// ----------------------------------
// scripts/deployed-asset-check.mjs is the last thing standing between a green deploy and
// a white screen. On 2026-08-23 there was no such thing, and Deploy Anchor #2 reported
// complete success while shipping an application whose every asset returned 503.
//
// A gate nobody has ever seen fail is a gate nobody should trust. The important test in
// this file is not "does it pass on a good deploy" - it is "does it FAIL on the exact
// deploy that actually shipped". So one of these tests reconstructs that deploy: a page
// that renders, a health endpoint that would answer perfectly, and assets that 503.
//
// Same reasoning as the self-check inside tests/accessibility.test.mjs, which runs axe
// over deliberately broken markup and fails if axe does not object.

const PAGE = `<!DOCTYPE html><html lang="en-AU"><head>
  <link rel="stylesheet" href="/assets/index-CEocvWo4.css">
  <script type="module" src="/assets/framework-DGxO92TS.js"></script>
</head><body><div id="root">Finding a gentle place to begin…</div></body></html>`;

/** Start a throwaway server on a random port. Returns { base, close }. */
async function serve(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function respond(reply, status, body, type = "text/html") {
  reply.writeHead(status, { "content-type": type });
  reply.end(body);
}

test("it extracts the hashed asset paths a real page references", () => {
  assert.deepEqual(extractAssetPaths(PAGE), [
    "/assets/framework-DGxO92TS.js",
    "/assets/index-CEocvWo4.css",
  ]);
});

test("it does not invent asset paths out of ordinary prose", () => {
  assert.deepEqual(extractAssetPaths("<p>We keep our assets under review.</p>"), []);
});

test("it passes when every referenced asset serves 200", async () => {
  const { base, close } = await serve((request, reply) => {
    if (request.url === "/") return respond(reply, 200, PAGE);
    return respond(reply, 200, "/* asset */", "text/plain");
  });

  try {
    const result = await checkDeployedAssets(base);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.checked.length, 2);
  } finally {
    await close();
  }
});

// THE ONE THAT MATTERS. This is Deploy Anchor #2 reproduced exactly: the page renders,
// every asset 503s. If this test ever passes-as-ok, the gate has stopped working.
test("it FAILS on the deploy that actually shipped: page renders, every asset 503s", async () => {
  const { base, close } = await serve((request, reply) => {
    if (request.url === "/") return respond(reply, 200, PAGE);
    return respond(reply, 503, "Service Unavailable", "text/plain");
  });

  try {
    const result = await checkDeployedAssets(base);
    assert.equal(result.ok, false, "the gate passed a deploy whose assets all 503'd");
    assert.match(result.reason, /did not serve 200/);
    assert.deepEqual(
      result.checked.map((asset) => asset.status),
      [503, 503],
    );
  } finally {
    await close();
  }
});

test("it fails when even one asset of several is broken", async () => {
  const { base, close } = await serve((request, reply) => {
    if (request.url === "/") return respond(reply, 200, PAGE);
    if (request.url.endsWith(".css")) return respond(reply, 200, "body{}", "text/css");
    return respond(reply, 404, "Not found", "text/plain");
  });

  try {
    const result = await checkDeployedAssets(base);
    assert.equal(result.ok, false, "one broken asset must fail the whole deploy");
    assert.equal(result.checked.filter((a) => a.status === 200).length, 1);
  } finally {
    await close();
  }
});

// A page that renders empty has nothing to fail on. Without an explicit guard the check
// would be vacuously true - the same "it passed because it tested nothing" failure this
// gate exists to catch.
test("it fails when the page references no assets at all, rather than passing vacuously", async () => {
  const { base, close } = await serve((request, reply) =>
    respond(reply, 200, "<!DOCTYPE html><html><body></body></html>"),
  );

  try {
    const result = await checkDeployedAssets(base);
    assert.equal(result.ok, false, "an empty page must not pass by having nothing to check");
    assert.match(result.reason, /referenced no \/assets\/ files/);
  } finally {
    await close();
  }
});

test("it fails when the page itself does not load", async () => {
  const { base, close } = await serve((request, reply) => respond(reply, 500, "boom", "text/plain"));

  try {
    const result = await checkDeployedAssets(base);
    assert.equal(result.ok, false);
    assert.match(result.reason, /page itself returned HTTP 500/);
  } finally {
    await close();
  }
});

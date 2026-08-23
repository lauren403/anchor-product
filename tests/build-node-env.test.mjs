import assert from "node:assert/strict";
import test from "node:test";

import { nodeEnvForVite, sentryPluginWouldSkipUpload } from "../build/build-node-env.ts";

// THE SELF-CHECK FOR SOURCE-MAP UPLOADS
// -------------------------------------
// On 2026-08-23 the acceptance gate reached, for the first time, the assertion
// `Release has no source-map artifacts.` The cause was not a missing token, a wrong
// release name, or a token scope. It was ordering: @sentry/vite-plugin reads
// process.env.NODE_ENV at construction, and vite.config.ts constructed it before vinext
// had set NODE_ENV to "production" for the build.
//
// The important test in this file is not "does nodeEnvForVite return production" - it is
// "would the Sentry plugin have skipped the upload under the OLD ordering, and does it
// stop skipping under the new one". A test that only checked the happy path would have
// passed just as happily on the broken build.

test("it reproduces the bug: a build whose NODE_ENV is still 'development' skips the upload", () => {
  // Exactly what was measured locally on 2026-08-23 by printing NODE_ENV at the moment
  // sentryVitePlugin() was called during `npm run build`:
  //     >>> DIAG NODE_ENV at plugin construction = "development"
  assert.equal(
    sentryPluginWouldSkipUpload("development"),
    true,
    "if this ever returns false, the reproduction is wrong and this whole file proves nothing",
  );
});

test("a production build resolves to production, so the plugin uploads", () => {
  const resolved = nodeEnvForVite("build", "production");
  assert.equal(resolved, "production");
  assert.equal(
    sentryPluginWouldSkipUpload(resolved),
    false,
    "a production build must not be seen as development by the Sentry plugin",
  );
});

test("the default build mode also resolves to production", () => {
  // vinext's own default when no --mode is passed is "development"; the command is what
  // decides a build. This is the shape `npm run build` actually takes in CI.
  const resolved = nodeEnvForVite("build", undefined);
  assert.equal(resolved, "production");
  assert.equal(sentryPluginWouldSkipUpload(resolved), false);
});

test("test mode stays test, and serve stays development", () => {
  // These two are vinext's rules, mirrored deliberately. Getting them wrong would change
  // behaviour rather than only its timing, which is not what this fix is allowed to do.
  assert.equal(nodeEnvForVite("build", "test"), "test");
  assert.equal(nodeEnvForVite("serve", "development"), "development");
  assert.equal(nodeEnvForVite("serve", undefined), "development");
  assert.equal(nodeEnvForVite(undefined, undefined), "development");
});

test("the skip predicate is narrow: only the literal string 'development' skips", () => {
  // The predicate reproduced from @sentry/bundler-plugin-core is a strict equality on one
  // string. If a future version widens it, this test is where that shows up.
  for (const value of ["production", "test", "Development", "", undefined]) {
    assert.equal(
      sentryPluginWouldSkipUpload(value),
      false,
      `unexpected skip for NODE_ENV=${JSON.stringify(value)}`,
    );
  }
});

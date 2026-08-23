// WHICH NODE_ENV A VITE INVOCATION IS ACTUALLY RUNNING UNDER
// ==========================================================
//
// This exists because of a bug that hid for as long as Sentry has been configured on this
// project, and was only caught on 2026-08-23 when the acceptance gate finally reached the
// assertion `Release has no source-map artifacts.`
//
// @sentry/vite-plugin decides ONCE, at construction, whether it is allowed to create a
// release and upload source maps. In @sentry/bundler-plugin-core 5.3.0:
//
//     const isDevMode = process.env["NODE_ENV"] === "development";
//
// That line runs while vite.config.ts is still assembling its plugins array. vinext resolves
// NODE_ENV to "production" for a build - but it does so inside its own `config` hook, which
// Vite cannot call until after the config factory has returned. So during `npm run build`
// the Sentry plugin was constructed while NODE_ENV still read "development", concluded it
// was running in dev, and quietly did neither job:
//
//     [sentry-vite-plugin] Debug: Running in development mode. Will not create release.
//     [sentry-vite-plugin] Debug: Running in development mode. Will not upload sourcemaps.
//     [sentry-vite-plugin] Debug: Deleting asset after upload: dist/client/assets/...js.map
//
// It deleted the maps anyway - "after upload", after an upload that never happened - so the
// deployed artifact looked exactly right and the "Verify private source-map handling" step
// went green. `silent: true` suppressed both Debug lines. Nothing anywhere reported a
// problem; there was simply never a source map behind any release.
//
// The rule below is vinext's own rule, copied deliberately (vinext/dist/index.js, the
// `vinext:config` hook). Applying it in the config factory does not change what NODE_ENV
// ends up as - vinext sets the identical value a moment later. It only makes the value
// correct EARLIER, in time for a plugin that reads it at construction.

/** What vinext will resolve NODE_ENV to for this command and mode. */
export function nodeEnvForVite(
  command: string | undefined,
  mode: string | undefined,
): "test" | "production" | "development" {
  if (mode === "test") return "test";
  if (command === "build") return "production";
  return "development";
}

/**
 * The predicate @sentry/bundler-plugin-core evaluates at plugin construction.
 *
 * Reproduced here rather than described, so the test suite can point it at both the broken
 * ordering and the fixed one and prove which way it falls. A comment claiming "this is fixed
 * now" is not evidence; a test that fails when the ordering regresses is.
 */
export function sentryPluginWouldSkipUpload(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development";
}

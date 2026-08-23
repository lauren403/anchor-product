import vinext from "vinext";
import { defineConfig } from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { sites } from "./build/sites-vite-plugin.ts";
import { nodeEnvForVite } from "./build/build-node-env.ts";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command, mode }) => {
  // NODE_ENV MUST BE CORRECT BEFORE THE PLUGINS ARRAY IS BUILT, NOT AFTER.
  //
  // @sentry/vite-plugin reads process.env.NODE_ENV once, at construction, to decide whether
  // it may create a release and upload source maps. vinext sets NODE_ENV for a build in its
  // own `config` hook - which Vite cannot call until this factory has already returned. The
  // Sentry plugin was therefore being constructed under NODE_ENV="development" during every
  // production build, and silently uploaded nothing. See build/build-node-env.ts for the
  // full account and the evidence.
  //
  // This assigns the value vinext resolves anyway; only the timing changes.
  // @types/node declares NODE_ENV read-only. The narrow cast is the write being made
  // deliberately and visibly, rather than hidden behind `as any`.
  (process.env as { NODE_ENV?: string }).NODE_ENV = nodeEnvForVite(command, mode);

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const sentryBuildConfigured = Boolean(
    process.env.SENTRY_AUTH_TOKEN &&
      process.env.SENTRY_ORG &&
      process.env.SENTRY_PROJECT,
  );

  return {
    build: {
      // Hidden maps retain Sentry symbolication without adding sourceMappingURL
      // references to browser assets. The upload plugin removes maps afterward.
      sourcemap: sentryBuildConfigured ? ("hidden" as const) : false,
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
      ...(sentryBuildConfigured
        ? [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              release: {
                name: `anchor@${
                  process.env.NEXT_PUBLIC_RELEASE_SHA ??
                  process.env.RELEASE_SHA ??
                  "development"
                }`,
              },
              sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.map"],
              },
              // NOT silent. `silent: true` is what let the dev-mode misfire above run
              // unnoticed for the entire life of this configuration: the plugin logged
              // exactly what it was doing, and the log was thrown away. If an upload
              // fails, this build should say so out loud.
              //
              // Deliberately not `debug: true`: debug sets SENTRY_LOG_LEVEL=debug on the
              // sentry-cli child process, and these logs are readable by anyone with
              // repository access. Info and warnings are enough to notice a failure.
              silent: false,
            }),
          ]
        : []),
    ],
  };
});

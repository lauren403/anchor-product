#!/usr/bin/env node

import process from "node:process";

const allowedEnvironments = new Set(["local", "preview", "beta", "production"]);
const argumentIndex = process.argv.indexOf("--environment");
const requestedEnvironment = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
const environment = requestedEnvironment ?? process.env.NEXT_PUBLIC_ANCHOR_ENV ?? "local";
const errors = [];

if (!allowedEnvironments.has(environment)) {
  errors.push(`NEXT_PUBLIC_ANCHOR_ENV must be one of ${[...allowedEnvironments].join(", ")}.`);
}

const release = process.env.NEXT_PUBLIC_RELEASE_SHA;
if (environment !== "local" && !release) {
  errors.push("NEXT_PUBLIC_RELEASE_SHA is required outside local development.");
}

if (release && !/^(?:[a-f0-9]{7,40}|local-preview|development)$/i.test(release)) {
  errors.push("NEXT_PUBLIC_RELEASE_SHA must be a 7–40 character Git commit SHA or an approved local value.");
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (["beta", "production"].includes(environment) && !sentryDsn) {
  errors.push("NEXT_PUBLIC_SENTRY_DSN is required for beta and production.");
}

if (sentryDsn) {
  try {
    const url = new URL(sentryDsn);
    if (url.protocol !== "https:" || !url.hostname.endsWith("sentry.io")) {
      errors.push("NEXT_PUBLIC_SENTRY_DSN must be an HTTPS sentry.io DSN.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SENTRY_DSN must be a valid URL.");
  }
}

for (const name of ["PREVIEW_HEALTHCHECK_URL", "BETA_HEALTHCHECK_URL", "PRODUCTION_HEALTHCHECK_URL"]) {
  const value = process.env[name];
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/api/health") {
      errors.push(`${name} must use HTTPS and end at /api/health.`);
    }
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
}

if (errors.length > 0) {
  console.error("Anchor configuration is invalid:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Anchor configuration passed for ${environment}.`);

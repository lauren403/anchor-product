#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const [eventPath, attachmentsPath, releaseFilesPath, eventId, sentinel, release, outputPath] =
  process.argv.slice(2);

for (const [name, value] of Object.entries({
  eventPath,
  attachmentsPath,
  releaseFilesPath,
  eventId,
  sentinel,
  release,
  outputPath,
})) {
  assert.ok(value, `Missing required argument: ${name}`);
}

const [event, attachments, releaseFiles] = await Promise.all([
  readFile(eventPath, "utf8").then(JSON.parse),
  readFile(attachmentsPath, "utf8").then(JSON.parse),
  readFile(releaseFilesPath, "utf8").then(JSON.parse),
]);

const serialized = JSON.stringify(event);
assert.ok(!serialized.includes(sentinel), "Synthetic sentinel reached Sentry.");
assert.equal(event.eventID ?? event.id, eventId, "Sentry returned the wrong event.");
assert.ok(event.user == null, "Sentry event contains a user object.");
assert.ok(Array.isArray(event.entries), "Sentry event entries are missing.");
assert.ok(!event.entries.some((entry) => ["request", "breadcrumbs"].includes(entry.type)));
assert.ok(Array.isArray(attachments) && attachments.length === 0, "Event has attachments.");
assert.ok(Array.isArray(releaseFiles) && releaseFiles.length > 0, "Release has no source-map artifacts.");

const tags = new Map((event.tags ?? []).map((tag) => [tag.key, tag.value]));
assert.equal(tags.get("environment"), "preview", "Unexpected Sentry environment.");
assert.equal(tags.get("release"), release, "Runtime and source-map releases do not match.");

const exceptionEntry = event.entries.find((entry) => entry.type === "exception");
const exceptions = exceptionEntry?.data?.values ?? [];
assert.ok(exceptions.length > 0, "Sentry event has no exception.");
assert.ok(
  exceptions.some((exception) => exception.type === "AnchorSyntheticAcceptanceError"),
  "Synthetic exception type was not preserved.",
);
assert.ok(
  exceptions.every((exception) => !exception.value || !exception.value.includes("anchor-smoke-")),
  "Synthetic exception value was not removed.",
);
const frames = exceptions.flatMap((exception) => exception.stacktrace?.frames ?? []);
assert.ok(frames.length > 0, "Sentry event has no diagnostic stack frames.");
assert.ok(!(event.errors ?? []).some((error) => /source.?map/i.test(error.type ?? error.message ?? "")));

const evidence = {
  schemaVersion: 1,
  eventId,
  release,
  environment: "preview",
  checkedAt: new Date().toISOString(),
  privacy: {
    sentinelAbsent: true,
    userAbsent: true,
    requestAbsent: true,
    breadcrumbsAbsent: true,
    attachmentsAbsent: true,
  },
  diagnostics: {
    exceptionTypePreserved: true,
    stackFramesPresent: true,
    sourceMapArtifactsPresent: true,
    sourceMapErrorsAbsent: true,
  },
};

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

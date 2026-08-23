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
// THE USER OBJECT: WHO PUT IT THERE MATTERS MORE THAN WHETHER IT IS THERE
// ------------------------------------------------------------------------
// This used to be a flat `assert.ok(event.user == null)`. Acceptance run #21 showed why
// that is not good enough, and why it can never pass:
//
//   { data:null, email:null, geo:object, id:null, ip_address:string, name:null, username:null }
//
// Every field the APPLICATION could populate is null. lib/sentry-privacy.ts sets
// sendDefaultPii:false and its beforeSend does `delete event.user` outright, on all three
// runtimes. The app sends no user object whatsoever. The ip_address and geo are attached
// by SENTRY'S INGESTION, derived from the connection that delivered the envelope - the
// same reason `tags` come back populated after scrubSentryEvent deletes those too.
//
// So the old assertion could never go green no matter what the code did, and a gate that
// can never pass is as useless as one that can never fail. It also blurred the only
// distinction that matters here: an identity the app leaked is a defect; an IP Sentry
// recorded is a project setting.
//
// These two checks keep it red - correctly - while saying which problem it is.
const IDENTITY_FIELDS = ["id", "email", "username", "name", "data"];
const INGEST_FIELDS = ["ip_address", "geo"];
const user = event.user ?? {};

const leaked = IDENTITY_FIELDS.filter((field) => user[field] != null);
assert.deepEqual(
  leaked,
  [],
  `THE APPLICATION LEAKED IDENTITY to Sentry: ${leaked.join(", ")}. This is a code defect - ` +
    "lib/sentry-privacy.ts is supposed to delete event.user before send. Field names only; " +
    "values are deliberately not printed, this runs in a public log.",
);

const ingestAttached = INGEST_FIELDS.filter((field) => user[field] != null);
assert.deepEqual(
  ingestAttached,
  [],
  `Sentry's ingestion attached ${ingestAttached.join(" and ")} to the event. The application ` +
    "did not send this and cannot remove it: sendDefaultPii is already false and beforeSend " +
    "already deletes event.user. Fix it in the Sentry project instead - Settings > Security " +
    "& Privacy > 'Prevent Storing of IP Addresses'. Until that is enabled this check stays " +
    "red, which is the correct state for a health service storing client IPs and derived " +
    "geolocation.",
);
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

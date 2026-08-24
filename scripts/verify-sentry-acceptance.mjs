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

// Acceptance run #22, after 'Prevent Storing of IP Addresses' was enabled org-wide:
// ip_address is GONE, geo REMAINS. Sentry keeps the location it derived before it stopped
// storing the address it derived it from. How much that matters depends entirely on the
// granularity - a country code is close to nothing, a city on a mental-health tool is not -
// and nothing in the log said which. So print geo's SHAPE too: nested key names and value
// types, never values. "city:string" and "city:null" are the two answers that matter.
if (user.geo != null && typeof user.geo === "object") {
  const geoShape = Object.entries(user.geo)
    .map(([key, value]) => `${key}:${value === null ? "null" : typeof value}`)
    .sort()
    .join(", ");
  console.error(`Sentry geo object shape (keys and value types only): { ${geoShape} }`);
}

const ingestAttached = INGEST_FIELDS.filter((field) => user[field] != null);

// ip_address must be gone, OR be the one placeholder the application now sends on purpose.
//
// lib/sentry-privacy.ts stopped deleting event.user and started setting
// { ip_address: "0.0.0.0" } instead, to deny Relay's geo lookup an input it can resolve.
// So exactly one non-null value is legitimate here and every other one is a regression.
// The org setting Security & Privacy > 'Prevent Storing of IP Addresses', enabled
// 2026-08-23, may still null it out entirely - either outcome is fine.
//
// This is the narrowest form of the check, not a softened one: any real address, any
// partial, any "{{auto}}" left unresolved still fails, and fails loudly.
const NON_GEOLOCATABLE_IP = "0.0.0.0";
assert.ok(
  user.ip_address == null || user.ip_address === NON_GEOLOCATABLE_IP,
  "Sentry stored an ip_address that is neither absent nor the deliberate " +
    `${NON_GEOLOCATABLE_IP} placeholder. Either scrubSentryEvent stopped running, or the org ` +
    "setting Security & Privacy > 'Prevent Storing of IP Addresses' was turned off. The value " +
    "is not printed - this runs in a log anyone with repository access can read.",
);

// GEO IS AN ACCEPTED, UNREMOVABLE RESIDUAL - AND THIS IS NOT A SOFTENED ASSERTION.
//
// Sentry attaches geo during INGESTION, after data-scrubbing rules run. Proven, not assumed:
// an org-level Advanced Data Scrubbing rule [Remove] [Anything] from [$user.geo] was added
// 2026-08-23, and acceptance runs #24 and #25 - fifteen minutes apart, both well past any
// config-propagation window - still received geo. Nothing in Sentry's settings reaches it, and
// the application cannot either (sendDefaultPii is false, beforeSend deletes event.user).
//
// The release owner accepted this residual on 2026-08-23 having been shown the measurement,
// not a description of it. What is stored is COUNTRY AND REGION ONLY, confirmed twice: the
// Sentry UI on a real event reads "Geography: United States (US)", and runs #24 and #25 both
// printed { country_code:string, region:string }. No city, no suburb, no coordinates.
//
// So this check gets STRICTER, not looser. It pins geo to exactly those two keys and fails the
// moment Sentry stores anything more. A permanently-red gate teaches people to ignore it; this
// one goes green on the known state and objects the instant that state changes.
const ACCEPTED_GEO_KEYS = ["country_code", "region"];
if (user.geo != null) {
  assert.equal(
    typeof user.geo,
    "object",
    "Sentry's geo is no longer an object. The accepted residual was a two-key object.",
  );
  const unexpectedGeo = Object.keys(user.geo)
    .filter((key) => user.geo[key] != null && !ACCEPTED_GEO_KEYS.includes(key))
    .sort();
  assert.deepEqual(
    unexpectedGeo,
    [],
    `Sentry is now storing MORE location than was accepted: ${unexpectedGeo.join(", ")}. The ` +
      "accepted residual is country_code and region only. A city, a postcode or coordinates is a " +
      "new decision for the release owner, not a regression to wave through. Field names only; " +
      "values are never printed, this runs in a public log.",
  );
}

// Anything ingest-attached that is neither the accepted geo nor the ip_address already
// accounted for above - which is now either absent or the deliberate 0.0.0.0 placeholder,
// both already asserted. Without this second exclusion the placeholder would trip this
// line as "new and unexamined" the moment it started being sent, which is the opposite of
// the truth.
const unaccounted = ingestAttached.filter(
  (field) => field !== "geo" && field !== "ip_address",
);
assert.deepEqual(
  unaccounted,
  [],
  `Sentry's ingestion attached ${unaccounted.join(" and ")}, which is neither the ip_address that ` +
    "was cleared nor the geo residual that was accepted. This is new and unexamined.",
);
assert.ok(Array.isArray(event.entries), "Sentry event entries are missing.");
assert.ok(!event.entries.some((entry) => ["request", "breadcrumbs"].includes(entry.type)));
assert.ok(Array.isArray(attachments) && attachments.length === 0, "Event has attachments.");
// The legacy release-artifacts endpoint is reported, NOT asserted on. See the
// symbolication check further down for why: it answers the wrong question.
console.error(
  `Legacy release-files endpoint listed ${Array.isArray(releaseFiles) ? releaseFiles.length : "a non-array"} ` +
    "artifact(s). This is a diagnostic only - debug-ID artifact bundles do not appear here.",
);

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

// DOES THIS EVENT ACTUALLY SYMBOLICATE?
// -------------------------------------
// This replaces `assert.ok(releaseFiles.length > 0, "Release has no source-map artifacts.")`,
// which asked the wrong question and took two runs to be seen doing it.
//
// That assertion read /api/0/projects/{org}/{project}/releases/{version}/files/ - the
// LEGACY release-artifacts endpoint. Modern sentry-cli uploads DEBUG-ID ARTIFACT BUNDLES,
// which that endpoint does not list. On runs #27 and #28 the build log said
// "Successfully uploaded source maps to Sentry" three times, once per build environment,
// while that endpoint reported nothing at all. getsentry/sentry-cli#2071 is the same
// report from someone else. The artifact-bundles API is undocumented and moves, so this
// does not chase it.
//
// What matters was never whether an admin endpoint lists files. It is whether a stack
// trace arriving in Sentry is READABLE - the property source maps actually buy, and the
// one thing an endpoint quirk cannot fake.
//
// Three independent markers, any one of which means a frame resolved to real source. The
// Sentry web API and the ingest envelope name these differently, so all three are checked
// rather than guessed at:
//   - frame.context      (web API) an array of [lineNo, text] pairs Sentry resolved
//   - frame.context_line (envelope) the resolved source line
//   - a source-file extension on the filename, rather than a hashed /assets/*.js bundle
// A minified frame has none of them.
const SOURCE_FILE = /\.(ts|tsx|mts|cts|jsx|mjs|cjs)(\?|$)/;

function frameResolvedToSource(frame) {
  if (Array.isArray(frame.context) && frame.context.length > 0) return true;
  if (typeof frame.context_line === "string" && frame.context_line.length > 0) return true;
  return SOURCE_FILE.test(String(frame.filename ?? frame.absPath ?? frame.abs_path ?? ""));
}

// Counts and key names only - never a filename, never a line of source. This runs in a
// log anyone with repository access can read, and the same rule that governs the geo
// shape line governs this one.
console.error(
  "Sentry frame shape (counts and key names only): " +
    JSON.stringify({
      frames: frames.length,
      withContext: frames.filter((frame) => Array.isArray(frame.context) && frame.context.length > 0).length,
      // Same length>0 condition the resolver uses. An earlier draft counted any string
      // here, so a frame carrying context_line:"" was reported as having a context line
      // while the verdict said otherwise - a diagnostic that contradicts its own gate is
      // worse than no diagnostic.
      withContextLine: frames.filter(
        (frame) => typeof frame.context_line === "string" && frame.context_line.length > 0,
      ).length,
      withSourceExtension: frames.filter((frame) =>
        SOURCE_FILE.test(String(frame.filename ?? frame.absPath ?? frame.abs_path ?? "")),
      ).length,
      inApp: frames.filter((frame) => frame.inApp === true || frame.in_app === true).length,
      keys: [...new Set(frames.flatMap((frame) => Object.keys(frame)))].sort(),
    }),
);

const resolved = frames.filter(frameResolvedToSource).length;
assert.ok(
  resolved > 0,
  `Not one of the ${frames.length} stack frames on this event resolved to source. Source maps ` +
    "either did not reach Sentry or did not match this release, so a real crash would arrive " +
    "minified and unreadable. Read the frame shape printed immediately above: it names every " +
    "key Sentry returned, which is what tells you whether this check is looking in the wrong " +
    "place again or whether symbolication genuinely is not happening.",
);
// SENTRY'S OWN PROCESSING ERRORS.
//
// This assertion is older than tonight and had never once been reached: the release-files
// check above it failed first on every run that got this far. Run #29 reached it and it
// fired - as a bare assert.ok with no message, printing only "The expression evaluated to
// a falsy value". A gate that fails without saying what it found is the exact failure this
// project keeps digging out, so it now names them.
//
// Types only, never messages: a Sentry processing error message can quote a file path or
// a URL, and this runs in a log anyone with repository access can read.
// Print EVERY processing-error type first, not only the ones the filter below catches.
// That filter is /source.?map/i, which matches "invalid_source_map" but NOT, for example,
// "js_no_source" - so on its own it would show a partial picture and invite a partial
// conclusion. What is fatal stays exactly as it was; what is visible does not.
const allErrorTypes = [
  ...new Set((event.errors ?? []).map((error) => String(error.type ?? "untyped"))),
].sort();
if (allErrorTypes.length > 0) {
  console.error(`Sentry processing errors on this event, types only: ${allErrorTypes.join(", ")}`);
}

const sourceMapErrors = (event.errors ?? []).filter((error) =>
  /source.?map/i.test(error.type ?? error.message ?? ""),
);

// WHICH FILES FAILED - path only, never the origin and never a query string.
//
// Run #30 reported five js_invalid_sourcemap_location errors against ten frames, and
// nothing said WHICH five. Without that, the only options are to guess or to leave a real
// defect standing, and a guess is what produced the wrong lead about debug IDs: a grep for
// the literal string "debugId" reported 2 of 17 built files carrying one, when in fact 15
// of 17 carry the injected `_sentryDebugIdIdentifier` runtime snippet. The grep was wrong,
// not the build.
//
// These are static asset paths from a throwaway smoke Worker - build output, not anything
// a person typed. The origin and any query string are still dropped, because the rule that
// values never reach this log does not get relaxed just because it is inconvenient.
// Run #32 printed "(no path on the error)": url, abs_path and absPath were all absent.
// Three guessed field names, three misses. So this stops guessing the field and reports
// the SHAPE first - exactly the move that settled the geo question and the frame question.
const PATH_LIKE = /^[\w@./-]+\.(js|mjs|cjs|ts|tsx|map)$/;

/** A string worth printing: an asset path, and nothing else. */
function pathLikeValue(value) {
  const raw = String(value ?? "");
  if (!raw) return null;
  try {
    const { pathname } = new URL(raw);
    return pathname;
  } catch {
    const withoutQuery = raw.split("?")[0];
    return PATH_LIKE.test(withoutQuery) ? withoutQuery : null;
  }
}

/** Every path-like string anywhere in a value, to a bounded depth. No guessed field names. */
function collectPaths(value, depth = 0, found = []) {
  if (depth > 3 || value == null) return found;
  if (typeof value === "string") {
    const path = pathLikeValue(value);
    if (path) found.push(path);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, depth + 1, found);
    return found;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectPaths(item, depth + 1, found);
  }
  return found;
}

if (sourceMapErrors.length > 0) {
  console.error(
    "Source-map error object keys (names only): " +
      JSON.stringify([...new Set(sourceMapErrors.flatMap((error) => Object.keys(error)))].sort()),
  );

  // Run #33 measured the shape as { data, message, type } with `data` an OBJECT - so the
  // path was nested one level below where the previous scan looked. Rather than reach for
  // `error.data.url` and risk a fourth wrong field name, this walks the whole error to a
  // bounded depth and reports the nested key names too. Follow the shape; do not guess it.
  const nestedKeys = [
    ...new Set(
      sourceMapErrors.flatMap((error) =>
        Object.entries(error).flatMap(([key, value]) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? Object.keys(value).map((inner) => `${key}.${inner}`)
            : [],
        ),
      ),
    ),
  ].sort();
  if (nestedKeys.length > 0) {
    console.error(`Nested keys on those errors (names only): ${JSON.stringify(nestedKeys)}`);
  }

  // Any value on any of those keys that reads as an asset path, origin and query dropped.
  // Anything that does not look like a path is reported as its type and never its content -
  // the rule that values do not reach this log holds even while chasing a defect.
  const paths = [...new Set(sourceMapErrors.flatMap((error) => collectPaths(error)))].sort();
  console.error(
    paths.length > 0
      ? `Source-map errors name these paths: ${paths.join(", ")}`
      : "No value on any source-map error read as an asset path. Value types present: " +
          JSON.stringify([
            ...new Set(sourceMapErrors.flatMap((error) => Object.values(error).map((v) => typeof v))),
          ].sort()),
  );
}
if (sourceMapErrors.length > 0) {
  const types = [...new Set(sourceMapErrors.map((error) => String(error.type ?? "untyped")))].sort();
  console.error(
    `Sentry recorded ${sourceMapErrors.length} source-map processing error(s), types only: ${types.join(", ")}`,
  );
}

// Kept fatal deliberately. Run #29 showed 5 of 10 frames resolving to source while Sentry
// still logged a source-map error, so something in this build is shipping without a usable
// map. Softening a check before knowing what it caught is how the geo residual came to be
// pinned to a shape that was never measured. Read the types printed above, then decide
// whether they are benign - do not relax this line to make the run green.
assert.equal(
  sourceMapErrors.length,
  0,
  "Sentry logged source-map processing errors for this event - see the types printed above. " +
    "Some part of this release symbolicates and some does not.",
);

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
    // Was `sourceMapArtifactsPresent`, which recorded the answer to the wrong question.
    // This records what was actually established: frames on a real event resolved to
    // source, which is what symbolication means in practice.
    framesResolvedToSource: resolved,
    framesTotal: frames.length,
    sourceMapErrorsAbsent: true,
  },
};

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });

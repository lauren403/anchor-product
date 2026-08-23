// Does the deployed page actually load?
//
// WHY THIS EXISTS
// ---------------
// Deploy Anchor #2, on 2026-08-23, reported success on every step - including its
// public health check - and shipped an application nobody could use. Every request
// under /assets/ returned 503, so no stylesheet and no JavaScript module loaded, and
// the page sat on "Finding a gentle place to begin" forever.
//
// /api/health is served by the Worker. The Worker was completely healthy. Only the app
// was broken, and nothing in the pipeline could tell the difference. A deploy gate that
// cannot distinguish a working application from a white screen is not a gate.
//
// So this fetches the rendered page, extracts the asset paths the HTML actually
// references, and requires every one of them to serve 200.
//
// WHY IT IS A MODULE AND NOT INLINE BASH
// --------------------------------------
// It started as a shell block inside deploy.yml, which meant it could never be tested.
// Every other harness built for this repository on 2026-08-23 carries a self-check that
// runs it against deliberately broken input and fails if it does not object - because a
// checker that silently checks nothing is exactly the failure mode this whole exercise
// keeps uncovering. This file exists so tests/deployed-asset-check.test.mjs can point a
// deliberately broken server at it and prove it says no.
//
// Usage:  DEPLOYMENT_URL=https://example.workers.dev node scripts/deployed-asset-check.mjs
// Exits non-zero if the deployed page cannot load its own assets.

// Matches the hashed asset paths the build emits, e.g. /assets/index-CEocvWo4.css.
// Deliberately narrow: it must not match arbitrary text that happens to contain the
// word "assets", and it must not run away to the end of an attribute.
const ASSET_PATH = /\/assets\/[A-Za-z0-9._-]+/g;

/**
 * Pull the distinct /assets/ paths out of a rendered HTML document.
 * Returns them sorted, so failures are reported in a stable order.
 */
export function extractAssetPaths(html) {
  return [...new Set(String(html ?? "").match(ASSET_PATH) ?? [])].sort();
}

/**
 * Fetch `base`, then fetch every asset the returned HTML references.
 *
 * Resolves to { ok, reason, checked } rather than throwing, so callers can report
 * every bad asset instead of only the first one.
 */
export async function checkDeployedAssets(base, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const root = String(base).replace(/\/$/, "");

  const pageResponse = await fetchImpl(`${root}/`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!pageResponse.ok) {
    return { ok: false, reason: `The page itself returned HTTP ${pageResponse.status}.`, checked: [] };
  }

  const paths = extractAssetPaths(await pageResponse.text());

  // A page that references nothing must NOT pass. Without this, a deploy that renders an
  // empty document sails through by having no assets to fail on - the check would be
  // vacuously true, which is the same bug in a different costume.
  if (paths.length === 0) {
    return { ok: false, reason: "The rendered page referenced no /assets/ files.", checked: [] };
  }

  const checked = await Promise.all(
    paths.map(async (path) => {
      try {
        const response = await fetchImpl(`${root}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
        return { path, status: response.status };
      } catch (error) {
        return { path, status: 0, error: String(error?.message ?? error) };
      }
    }),
  );

  const broken = checked.filter((asset) => asset.status !== 200);
  return {
    ok: broken.length === 0,
    reason: broken.length
      ? `${broken.length} of ${checked.length} asset(s) did not serve 200.`
      : undefined,
    checked,
  };
}

// CLI entry. Only runs when this file is executed directly, never when imported by a test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const base = process.env.DEPLOYMENT_URL;
  if (!base) {
    console.error("::error::DEPLOYMENT_URL is not set.");
    process.exit(1);
  }

  const result = await checkDeployedAssets(base);

  for (const asset of result.checked) {
    if (asset.status === 200) {
      console.log(`ok    ${asset.path}`);
    } else {
      console.error(`::error::${asset.path} returned ${asset.error ?? asset.status}`);
    }
  }

  if (!result.ok) {
    console.error(`::error::The deployed page cannot load its own assets. ${result.reason}`);
    process.exit(1);
  }

  console.log(`Every one of the ${result.checked.length} asset(s) referenced by the rendered page served 200.`);
}

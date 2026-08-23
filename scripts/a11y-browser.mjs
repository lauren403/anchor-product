// Accessibility check with REAL layout, in a real browser.
//
// WHY THIS EXISTS ALONGSIDE tests/accessibility.test.mjs
// ------------------------------------------------------
// The jsdom suite runs on every push and catches most of WCAG A/AA, but jsdom does no
// layout and no paint, so two whole classes of check are impossible there:
//
//   * colour contrast, which needs computed, painted colours;
//   * anything depending on computed ARIA semantics.
//
// That second gap was not theoretical. On 2026-08-23 this script found
// `aria-prohibited-attr` (serious) on the onboarding progress dots: a bare <div> carrying
// an aria-label. A bare div has an implicit role of "generic", aria-label is prohibited
// on generic, so the label was being silently discarded and screen-reader users were told
// nothing about which onboarding step they were on. The jsdom suite passed clean on the
// same markup.
//
// Playwright is deliberately NOT a devDependency: it would be installed by `npm ci` in
// every CI job and slow down every run. The workflow that calls this installs it ad hoc.
//
// Usage:  npm run build && node scripts/a11y-browser.mjs
// Exits non-zero if there are violations.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const ROOT = new URL("../dist/client/", import.meta.url).pathname;
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const CONTENT_TYPES = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

// Render through the real Worker, the same way tests/accessibility.test.mjs does, so both
// halves are looking at the identical artifact.
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("run", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("http://localhost/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
if (response.status !== 200) {
  console.error(`Homepage did not render: HTTP ${response.status}`);
  process.exit(1);
}
const html = await response.text();

// Serve the built client assets so real CSS actually applies - without this the contrast
// check is meaningless, because there would be nothing to compute contrast against.
const server = createServer(async (request, reply) => {
  const path = decodeURIComponent(request.url.split("?")[0]);
  if (path === "/") {
    reply.writeHead(200, { "content-type": "text/html" });
    reply.end(html);
    return;
  }
  try {
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    reply.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
    reply.end(body);
  } catch {
    reply.writeHead(404);
    reply.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();

const browser = await chromium.launch();
// Phone-sized by default: this is where the product is actually used, and contrast and
// focus problems often only appear at the size real people hold.
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });

const styleSheetCount = await page.evaluate(() => document.styleSheets.length);
if (styleSheetCount === 0) {
  console.error("No stylesheets applied - contrast results would be meaningless. Aborting.");
  await browser.close();
  server.close();
  process.exit(1);
}

await page.addScriptTag({ path: AXE_PATH });
const results = await page.evaluate(
  async (tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
  WCAG_AA,
);

await browser.close();
server.close();

console.log(`Stylesheets applied: ${styleSheetCount}`);
console.log(`Page errors: ${pageErrors.length ? pageErrors.join("; ") : "none"}`);
console.log(
  `axe: ${results.passes.length} passing check(s), ${results.violations.length} violation(s), ${results.incomplete.length} needing review`,
);

for (const violation of results.violations) {
  console.log(`\n[${violation.impact}] ${violation.id} — ${violation.help}`);
  console.log(`  ${violation.helpUrl}`);
  for (const node of violation.nodes.slice(0, 8)) {
    console.log(`  · ${node.target.join(" ")}`);
    const why = (node.any?.[0]?.message ?? node.all?.[0]?.message ?? "").split("\n")[0];
    if (why) console.log(`    ${why}`);
  }
  if (violation.nodes.length > 8) console.log(`  · ...and ${violation.nodes.length - 8} more`);
}

if (results.incomplete.length) {
  console.log(`\nNeeding human review (axe could not decide):`);
  for (const item of results.incomplete) {
    console.log(`  · ${item.id} (${item.nodes.length} node(s)) — ${item.help}`);
  }
}

// A run that checked nothing must not read as a pass - the same guard the jsdom suite has.
if (results.passes.length === 0) {
  console.error("\naxe reported zero passing checks, so it did not analyse the page.");
  process.exit(1);
}

if (results.violations.length > 0) {
  console.error(`\nFAILED: ${results.violations.length} WCAG 2.1 A/AA violation(s) with real layout.`);
  process.exit(1);
}

console.log("\nPASSED: no WCAG 2.1 A/AA violations with real layout, colour contrast included.");

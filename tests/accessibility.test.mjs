import assert from "node:assert/strict";
import test, { after } from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

// Runtime accessibility testing against the BUILT artifact.
//
// WHY THIS FILE EXISTS
// --------------------
// The release record anchor-v7-beta-2026-08-04 was approved citing "zero automated
// WCAG A/AA violations in acceptance run". Verified on 2026-08-23: no workflow in this
// repository produced accessibility results of any kind, and no accessibility tooling
// was installed. The claim described a check that had never run.
//
// Anchor is built for disabled and neurodivergent users, so that is the claim least
// safe to leave unmeasured. This file makes it measurable.
//
// It complements the static half in eslint.config.mjs: jsx-a11y reads the JSX source,
// axe-core reads the DOM the server actually produced - landmarks, heading order,
// duplicate ids, accessible names on real elements. Neither catches what the other
// does, and neither substitutes for testing with actual users (issue #12).
//
// Uses the same worker.fetch pattern as rendered-html.test.mjs, so it needs
// `npm run build` first, which `npm test` does before running this file.

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// ONE jsdom window for the whole file, reused via document.write.
//
// axe-core binds to `window`/`document` when its module body evaluates. It must
// therefore be imported AFTER the globals exist, and it cannot be pointed at a second
// window afterwards - a fresh jsdom per test makes axe.run throw "axe.run arguments are
// invalid", and a cache-busting import does not help because the binding is internal.
// Reusing one live window and replacing its document sidesteps all of that.
let harness;

async function getHarness() {
  if (harness) return harness;

  const dom = new JSDOM(
    "<!doctype html><html lang=\"en\"><head><title>init</title></head><body></body></html>",
    // jsdom logs CSS parse errors for modern syntax it does not implement; those are not
    // accessibility findings and would drown the real output.
    { pretendToBeVisual: true, virtualConsole: new VirtualConsole() },
  );
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.NodeList = window.NodeList;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;

  const { default: axe } = await import("axe-core");
  harness = { dom, window, axe };
  return harness;
}

after(() => {
  harness?.dom.window.close();
});

async function runAxe(html) {
  const { window, axe } = await getHarness();
  window.document.open();
  window.document.write(html);
  window.document.close();

  return axe.run(window.document, {
    runOnly: { type: "tag", values: WCAG_AA },
    // Colour contrast needs real layout and paint, which jsdom does not do. Leaving it
    // enabled produces "incomplete" noise rather than findings. It is covered by the
    // human review, and is the clearest gap in this file - stated rather than hidden.
    rules: { "color-contrast": { enabled: false } },
  });
}

async function renderHomepage() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200, "expected the homepage to render");
  return response.text();
}

function describe(violations) {
  return violations
    .map((v) => {
      const where = v.nodes.slice(0, 3).map((n) => `      ${n.target.join(" ")}`).join("\n");
      const more = v.nodes.length > 3 ? `\n      ...and ${v.nodes.length - 3} more` : "";
      return `  [${v.impact ?? "unknown"}] ${v.id}: ${v.help}\n${where}${more}\n      ${v.helpUrl}`;
    })
    .join("\n\n");
}

test("rendered homepage has no WCAG 2.1 A/AA violations", async () => {
  const results = await runAxe(await renderHomepage());

  assert.equal(
    results.violations.length,
    0,
    `axe-core found ${results.violations.length} WCAG 2.1 A/AA violation(s):\n\n${describe(results.violations)}\n`,
  );

  // Guard against a silent pass: if axe checked nothing, the assertion above is
  // meaningless. This is the mistake the operations tests made - asserting a result
  // without confirming anything actually ran.
  assert.ok(
    results.passes.length > 0,
    "axe-core reported zero passing checks, so it did not analyse the page",
  );
});

// SELF-CHECK. A passing accessibility test is only worth something if it is capable of
// failing. Eight of the ten operations tests on this project asserted that code had been
// WRITTEN rather than that it worked, and two real defects survived weeks behind them.
// This runs the exact same harness over deliberately broken markup and requires it to
// object. If axe is ever misconfigured into checking nothing, this fails first and the
// green tick above stops being trusted.
test("the axe harness itself detects violations when they exist", async () => {
  const results = await runAxe(
    `<!doctype html><html><head><title>t</title></head><body>
      <img src="/x.png">
      <input type="text">
      <div id="dup"></div><div id="dup"></div>
    </body></html>`,
  );

  const ids = results.violations.map((v) => v.id);
  assert.ok(
    results.violations.length > 0,
    "axe found nothing wrong with markup that has an unlabelled image, an unlabelled input and a duplicate id - the harness is not actually checking anything",
  );
  assert.ok(ids.includes("html-has-lang"), `expected html-has-lang, got: ${ids.join(", ")}`);
  assert.ok(ids.includes("image-alt"), `expected image-alt, got: ${ids.join(", ")}`);
  assert.ok(ids.includes("label"), `expected label, got: ${ids.join(", ")}`);
});

test("rendered homepage declares a language and a title", async () => {
  // Cheap, high-value checks that survive without layout: WCAG 3.1.1 and 2.4.2.
  const html = await renderHomepage();
  assert.match(html, /<html[^>]*\slang=["'][a-z]{2}(-[A-Za-z]{2,})?["']/i, "missing <html lang>");
  assert.match(html, /<title[^>]*>\s*\S[\s\S]*?<\/title>/i, "missing or empty <title>");
});

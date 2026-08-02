import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/anchor/LegacyAnchorApp.jsx", import.meta.url), "utf8");

test("ecosystem navigation names the Hub and clinic and suppresses referrer leakage", () => {
  assert.match(source, /ADHD Hub/);
  assert.match(source, /Clinic support/);
  assert.match(source, /rel="noreferrer"/);
});

test("outbound ecosystem URLs never include a lived-moment label", () => {
  const urls = [...source.matchAll(/href="(https:[^"]+)"/g)].map((match) => match[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) assert.doesNotMatch(url, /[?&]moment=/);
});

test("combined export and deletion cover product and recommendation records", () => {
  assert.match(source, /product: state, recommendations: loadAnchorState\(\)/);
  assert.match(source, /clearAnchorState\(\); reset\(\)/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { moments, supports } from "../lib/anchor/taxonomy.ts";
import { recommendSupport } from "../lib/anchor/recommendation.ts";

test("matches low-capacity sensory eating moments to texture-first support", () => {
  const result = recommendSupport({ momentId: "nothing-manageable", capacity: "very-low", barrier: "sensory-load", mode: "do" });
  assert.equal(result.support.id, "temperature-texture-effort");
});

test("matches late-reply shame to the bounded reply bridge", () => {
  const result = recommendSupport({ momentId: "reply-late", capacity: "some", barrier: "shame", mode: "connect" });
  assert.equal(result.support.id, "late-reply-bridge");
});

test("rejects unknown moments and unsupported delivery combinations", () => {
  assert.throws(() => recommendSupport({ momentId: "unknown", capacity: "some", barrier: "activation", mode: "do" }), /Unknown Anchor moment/);
  assert.throws(() => recommendSupport({ momentId: "research-hype", capacity: "very-low", barrier: "decision-load", mode: "do" }), /No reviewed Anchor support/);
});

test("every configured moment has an eligible support at each declared capacity", () => {
  for (const moment of moments) {
    for (const capacity of ["very-low", "some", "steady"]) {
      const eligible = supports.filter((support) => moment.supportIds.includes(support.id) && support.capacity.includes(capacity));
      assert.ok(eligible.length > 0, `${moment.id} has no support for ${capacity}`);
      for (const support of eligible) {
        for (const mode of support.modes) {
          const result = recommendSupport({ momentId: moment.id, capacity, barrier: moment.defaultBarriers[0], mode });
          assert.ok(result.support.capacity.includes(capacity));
          assert.ok(result.support.modes.includes(mode));
        }
      }
    }
  }
});

test("taxonomy references are complete and unique", () => {
  assert.equal(new Set(moments.map((item) => item.id)).size, moments.length);
  assert.equal(new Set(supports.map((item) => item.id)).size, supports.length);
  const supportIds = new Set(supports.map((item) => item.id));
  for (const moment of moments) for (const supportId of moment.supportIds) assert.ok(supportIds.has(supportId), `${moment.id} references missing ${supportId}`);
});

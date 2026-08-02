# Anchor v7 architecture

## Decision

v7 is a local-first web release candidate. The visual/product layer retains v5's complete experience; the recommendation domain is TypeScript and is isolated from presentation code so it can later be shared with a native application.

## Layers

1. **Presentation** — the v5-derived Today, Explore, Plan, Check in and More experiences.
2. **Product state** — a typed v7 state adapter with strict migration, bounded history and a standards-compatible local identifier.
3. **Recommendation domain** — versioned types, lived-moment taxonomy, approved supports, eligibility gates and deterministic ranking.
4. **Recommendation state** — device-local consent and outcome patterns, capped at 100 entries.
5. **Ecosystem boundary** — fixed, non-sensitive outbound links and an inbound deep-link contract.

## Recommendation contract

Input:

- lived moment;
- available capacity;
- primary barrier;
- preferred support mode.

Output:

- one approved support;
- a visible explanation;
- the content boundary;
- an optional user-recorded outcome.

Capacity and support mode are hard eligibility constraints. The engine throws when a caller requests an unsupported combination; it does not silently return a mismatched support. The user interface only shows combinations that the taxonomy can fulfil.

## Data posture

- No backend or database is bound.
- No account or cross-device identity exists.
- No user-entered state leaves the browser.
- Outbound links use `noreferrer` and never include a lived-moment identifier.
- Moment handoffs should use URL fragments so the value is not included in the HTTP request. Legacy query handoffs are accepted, consumed and immediately removed from the address bar.
- Campaign attribution may use non-sensitive campaign identifiers; no symptoms, outcomes or meal choices are included.

## Known transition debt

The v5 presentation library remains JavaScript while the state and recommendation domains are TypeScript. This preserves the validated experience without a high-risk rewrite. A later modularisation pass can type individual presentation components after the closed beta establishes which surfaces should remain.

That debt does not weaken recommendation safety: every decision rule, taxonomy type, state migration and integration contract used by the new personalisation loop is typed and tested.

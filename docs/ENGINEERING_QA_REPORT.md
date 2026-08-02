# Anchor v7 engineering QA report

Date: 2 August 2026  
Status: release candidate; not approved for public or external-beta deployment

## Outcome

The v5 experience and v6 recommendation foundation are merged successfully. The release candidate builds, renders and completes its primary interaction journeys without a known application error.

## Defects discovered and corrected

1. **Recommendation mismatch** — v6 could rank a support that did not match the selected capacity or support mode. v7 now treats both as hard eligibility gates and rejects unsupported combinations.
2. **Cross-pillar fallback** — an unsupported combination could fall through to a support from another lived moment. Eligibility is now restricted to the selected moment's approved support identifiers.
3. **Deep-link privacy** — a query-based moment identifier could remain in the URL when a campaign also opened the Explore experience. Moment handoffs now take priority; legacy query values are consumed and removed. URL fragments are the preferred contract.
4. **Identifier compatibility** — v5 used `crypto.randomUUID()` directly. v7 uses a standards-compatible secure fallback.
5. **Hydration flash** — local state could briefly show onboarding before an existing user's state loaded. A deliberate loading state now prevents the false screen.
6. **Timer completion duplication** — timer effects could report completion more than once when callbacks changed. Completion is now idempotent.
7. **Modal accessibility** — support panels lacked a stable accessible name and reliable focus return. Dialog naming, Escape close, initial focus and trigger-focus restoration are implemented.
8. **Dependency exposure** — the starter dependency set included advisories. Next.js was updated and PostCSS/Sharp were constrained to patched releases; the production audit now reports zero known vulnerabilities.
9. **Strategy drift** — a v5 evidence card still described future scent/tea behaviour. It was removed so v7 matches the approved decision not to develop those products.

## Automated verification

- Production build: passed.
- Hosting artifact structure: passed.
- Lint: passed with zero errors and zero warnings.
- Unit/integration/render tests: 9 passed, 0 failed.
- Production dependency audit: 0 known vulnerabilities.
- Taxonomy identifiers: unique.
- Every moment/support reference: valid.
- Every configured capacity has at least one eligible support.
- Unknown and unsupported recommendation inputs: rejected.
- Combined export/deletion contract: present.
- Outbound ecosystem links: no lived-moment parameters.

## Browser interaction verification

- Three-step onboarding and optional name persistence.
- Today, Explore, Plan, Check in and More navigation present.
- Five-stage moment finder completed for a low-capacity sensory eating moment.
- Explanation, boundary and optional outcome visible.
- Outcome confirmation displayed as device-local.
- Six meal cards present with non-empty alternative text.
- Opened meal photograph loaded at 1600 px natural width.
- Meal detail displayed ingredients, easier version, claims boundary and credit.
- No unnamed buttons found in the tested integrated and Explore states.
- Modal closed with Escape and returned focus to its initiating control.
- Fragment-based Hub handoff opened the correct moment at the capacity step.
- Legacy query-based moment handoff removed the moment value while retaining non-sensitive campaign attribution.
- No application-origin console error observed; browser-extension metadata noise was excluded as unrelated to the product.

## External route verification

At the time of QA, the ADHD Hub, Body Belonging ADHD support page and Halaxy practitioner route each returned HTTP 200.

## Remaining gates

This report is engineering evidence, not clinical or regulatory approval. External beta remains blocked pending clinical, APD, privacy, First Nations governance, lived-experience/accessibility, intended-purpose and independent security review. Reciprocal changes to the live Hub and clinic sites must also be implemented and tested before the ecosystem can be described as publicly connected.

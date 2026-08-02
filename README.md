# Anchor v7 — ecosystem integration release candidate

Anchor v7 combines the complete v5 product experience with the typed, explainable recommendation foundation introduced in v6.

## Product boundary

Anchor is a private, low-shame general wellbeing and education tool. It does not diagnose ADHD, generate clinical advice, monitor users, alter medication, provide crisis support or send entries to Body Belonging Clinic.

## Included

- Situation-led Today and Explore experiences.
- Typed lived-moment taxonomy and deterministic recommendation engine.
- Capacity-, barrier- and delivery-aware recommendation flow.
- Device-local plan, check-ins, saved meals, saved ideas and recommendation outcomes.
- One combined export and one combined deletion pathway.
- Six credited real-food meal experiences and nutrition claims boundaries.
- Connection cards, guided companions and appointment-preparation export.
- Privacy-safe ecosystem navigation to the ADHD Hub and Body Belonging Clinic.
- Campaign and Hub deep-link contracts.

## Deliberately excluded

- Accounts, cloud sync, clinician dashboards or remote monitoring.
- Meta pixels or sensitive cross-domain event labels.
- Generative health recommendations.
- Subscriptions, payments, tea, scent or physical inventory.
- Public deployment approval.

## Quality commands

```sh
npm run lint
npm run typecheck
npm run validate:config -- --environment preview
npm run test:unit
npm test
npm run test:rollback
```

`npm run quality` is the local equivalent of the required pull-request gate. The repository also includes CodeQL, dependency review, Dependabot, environment validation, privacy-limited error/performance monitoring, scheduled health checks, a rollback drill and a code/content/governance release ledger.

See `docs/RELEASE_ENGINEERING.md` and `docs/ROLLBACK_RUNBOOK.md` before creating a beta release.

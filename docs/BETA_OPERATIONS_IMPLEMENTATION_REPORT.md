# Anchor beta operations implementation report

Date: 2 August 2026

## Executive result

Anchor v7 now contains a tested release-engineering control plane suitable for publication into a dedicated private GitHub repository. The application remains pre-beta. No live environment or external monitoring account was activated.

## Implemented and verified

| Control | Implementation | Verification |
| --- | --- | --- |
| Authoritative source structure | Repository-ready v7 source, ownership, PR template and release records | Local source audit |
| Protected change blueprint | Active ruleset payload requiring PR, review, code owners, current checks, resolved threads and linear history | JSON parsed; provider application pending |
| CI | Configuration, lint, TypeScript, behavioural tests, build, rendered checks, audit, rollback and artifact retention | Local equivalent passed |
| Dependency scanning | PR dependency review, production audit and CodeQL | Workflow YAML parsed; first hosted run pending |
| Dependency updates | Weekly grouped npm and monthly Actions Dependabot configuration | Configuration parsed |
| Environments | Preview, beta and production contracts; beta/production protected workflow | Provider environment creation pending |
| Configuration | Fail-closed environment, release, Sentry and health URL validation | Positive and negative tests passed |
| Error/performance monitoring | Sentry browser tracing with strict data minimisation | Build and privacy-control tests passed; DSN smoke test pending |
| Uptime | `/api/health` and 15-minute three-environment workflow | Build and contract tests passed; deployed URL tests pending |
| Rollback | Immutable artifact checksum, clean restoration and Worker import drill | Passed |
| Release record | JSON ledger joining code, content, six governance domains, verification, rollback and decision | Draft validation passed; approved validation correctly failed |

## Final local verification

- ESLint: passed with zero errors and warnings.
- TypeScript: passed.
- Automated tests: 12 passed, zero failed.
- Production build and Sites artifact validation: passed.
- Production dependency audit: zero known vulnerabilities.
- Rollback restoration drill: passed.
- Browser runtime: primary route rendered with no application-origin console errors.
- Beta configuration without monitoring: correctly rejected.
- Release with pending governance: correctly rejected.

## External/admin gates not represented as complete

1. Create a dedicated private repository, recommended name `anchor-product`.
2. Push this exact source as the bootstrap commit and make it the only authoritative source.
3. Allow the first workflows to run, then apply `.github/rulesets/main.json`.
4. Add at least one independent reviewer with write access; the author cannot satisfy their own required review.
5. Create GitHub environments `preview`, `beta` and `production`; add required reviewers to beta and production.
6. Select and configure the actual hosting targets for all three environments.
7. Create the approved Sentry project, set environment-scoped DSNs and complete a scrubbed test-error/performance smoke test.
8. Set the three health-check repository variables and verify scheduled uptime runs.
9. Perform one provider-level rollback drill and record recovery time.
10. Complete the six governance approvals and replace every pending release-ledger field with immutable evidence.

The connected GitHub capability can work with existing repositories but cannot create a repository or administer branch rules and environments. The only visible repository named `gentle-hub-for-us` is the ADHD Hub source and should not be repurposed as Anchor’s authoritative repository without a deliberate monorepo decision.

# Anchor beta release engineering

## Source of truth

The dedicated private Anchor GitHub repository is authoritative for code, reviewed content, environment contracts and release records. ZIP files and hosted builds are outputs only. `main` represents the next production candidate; `beta` represents the current closed-beta candidate; short-lived branches feed pull requests.

## Required repository controls

Apply `.github/rulesets/main.json` to `main` after the first successful workflow run has created the named checks. No bypass actor is permitted. At least one reviewer other than the last pusher must have write access, otherwise required review is not operationally possible.

The required checks are:

- `Anchor quality gate`;
- `Dependency review`;
- `CodeQL JavaScript and TypeScript`.

Require conversations resolved, code-owner review, stale-review dismissal, linear history, and prevention of force pushes and deletion.

## Environments

| Environment | Trigger | Data | Monitoring | Promotion rule |
| --- | --- | --- | --- | --- |
| Preview | Pull request artifact/deployment | Synthetic only | Optional | Quality gate passes |
| Beta | Manual release workflow plus protected `beta` environment | Consented closed-beta use only | Required | Approved release record and designated approver |
| Production | Manual release workflow plus protected `production` environment | General public use within approved scope | Required | New approved record; beta evidence reviewed |

Create GitHub environments named `preview`, `beta` and `production`. Give `beta` and `production` required reviewers, prevent self-review where the account plan permits, and restrict production deployment to `main`. Store `SENTRY_DSN` as an environment secret and each `/api/health` URL as a repository variable.

The repository intentionally creates a verified deployment artifact, not a live deployment, until the hosting provider and immutable deployment identifiers are formally approved. Adding an unreviewed deploy command would create false assurance.

## Configuration contract

`scripts/validate-config.mjs` fails invalid environment names, missing release identifiers, non-HTTPS monitoring configuration and incorrect health endpoints. Beta and production builds fail closed without Sentry configuration.

## Monitoring boundary

Sentry Browser Tracing captures application exceptions and sampled performance transactions. The client removes user identity, breadcrumbs, contexts, extra fields, query strings and fragments before transmission. Session replay and in-product user feedback are not installed. The monitoring project must use an Australian-approved retention period and access group before beta.

## Uptime

The scheduled workflow checks preview, beta and production health endpoints every 15 minutes. It validates both HTTP success and the expected JSON contract. A failed check must alert the incident owner through GitHub notification routing; production should later add an independent external probe so uptime does not depend on GitHub Actions alone.

## Dependencies

Dependabot opens grouped weekly npm updates and monthly workflow updates. Pull requests receive dependency review, CodeQL and `npm audit`. Major framework, monitoring, storage or cryptography updates require separate pull requests and a rollback reference.

## Release sequence

1. Change enters through a pull request.
2. Required checks pass and the correct content/governance owners approve.
3. A release record is completed for the exact commit.
4. The protected environment approver authorises promotion.
5. The immutable artifact is deployed by the approved hosting mechanism.
6. Health, monitoring and primary user journey smoke tests pass.
7. The release record receives deployment evidence and final status.

No release should be described as beta-ready while any approval is pending.

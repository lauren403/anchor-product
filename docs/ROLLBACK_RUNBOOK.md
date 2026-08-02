# Anchor rollback runbook

## Trigger

Rollback immediately for a privacy leak, incorrect recommendation eligibility, broken deletion/export, unavailable primary journey, unsafe content, widespread client error or failed health check that cannot be corrected within 15 minutes.

## Authority

- Incident lead: named in the approved release record.
- Rollback owner: named in the approved release record.
- Clinical content withdrawal: clinical owner may request immediate withdrawal without waiting for a normal release meeting.

## Procedure

1. Pause promotion and acquisition traffic.
2. Record the incident time, affected environment and current deployment identifier.
3. Select the `risk.rollback_ref` from the current approved release record.
4. Redeploy that immutable, checksum-verified artifact through the approved hosting provider; do not rebuild dependencies from floating versions.
5. Verify `/api/health`, the moment finder, recommendation eligibility, data deletion, meal detail and Hub/clinic handoffs.
6. Verify Sentry error rate has returned to baseline and no sensitive fields were transmitted.
7. Update the release and incident records. Reopen only after the incident lead signs off.

## Tested boundary

`npm run test:rollback` packages the exact built `dist` directory, verifies its SHA-256 checksum, restores it into a clean temporary location and imports the restored Worker entry. This proves artifact restorability. A provider-level rollback remains a required drill in beta because only the selected host can prove permissions, routing and recovery time.

Target recovery time for closed beta: 30 minutes. Target recovery point: the preceding approved immutable release.

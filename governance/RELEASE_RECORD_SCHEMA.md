# Anchor release record

Every beta or production release must add one immutable JSON record under `governance/releases/`.

The record joins:

- the exact 40-character Git commit and workflow run;
- versioned taxonomy, support, nutrition and ecosystem content;
- named clinical, nutrition, privacy, First Nations, accessibility and security approvals;
- technical verification evidence;
- last-known-good rollback reference and owner;
- the final release-owner decision.

Draft records may contain pending values. The release workflow rejects them. Approval evidence must be a stable internal reference; do not commit confidential reports, reviewer signatures, personal contact information or health data.

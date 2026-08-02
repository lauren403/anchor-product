#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const recordPath = process.argv[2];
const requireApproved = process.argv.includes("--require-approved");

if (!recordPath) {
  console.error("Usage: npm run validate:release -- <release-record.json> [--require-approved]");
  process.exit(64);
}

const record = JSON.parse(await readFile(recordPath, "utf8"));
const errors = [];
const requiredStrings = [
  "release_id",
  "target_environment",
  "code.commit",
  "code.repository",
  "content.taxonomy_version",
  "content.meal_library_version",
  "risk.rollback_ref",
  "decision.status",
];

function get(path) {
  return path.split(".").reduce((value, key) => value?.[key], record);
}

for (const path of requiredStrings) {
  const value = get(path);
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} is required.`);
}

if (!new Set(["preview", "beta", "production"]).has(record.target_environment)) {
  errors.push("target_environment must be preview, beta or production.");
}

if (!Array.isArray(record.governance?.approvals)) {
  errors.push("governance.approvals must be an array.");
} else {
  const requiredDomains = ["clinical", "nutrition", "privacy", "first_nations", "accessibility", "security"];
  for (const domain of requiredDomains) {
    const approval = record.governance.approvals.find((item) => item.domain === domain);
    if (!approval) {
      errors.push(`Missing ${domain} governance approval record.`);
      continue;
    }
    if (requireApproved && approval.status !== "approved") {
      errors.push(`${domain} approval must be approved for release.`);
    }
    if (requireApproved && (!approval.reviewer || !approval.approved_at || !approval.evidence_ref)) {
      errors.push(`${domain} approval requires reviewer, approved_at and evidence_ref.`);
    }
  }
}

if (requireApproved) {
  if (!/^[a-f0-9]{40}$/i.test(record.code?.commit ?? "")) errors.push("code.commit must be a full Git SHA.");
  if (record.decision?.status !== "approved") errors.push("decision.status must be approved.");
  if (!record.decision?.release_owner || !record.decision?.approved_at) {
    errors.push("An approved release requires release_owner and approved_at.");
  }
}

if (errors.length > 0) {
  console.error("Release record is invalid:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Release record ${record.release_id} passed${requireApproved ? " approval" : " draft"} validation.`);

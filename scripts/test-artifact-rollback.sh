#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
artifact_root="${project_root}/dist"

[[ -f "${artifact_root}/server/index.js" ]] || {
  echo "Build the release artifact before running the rollback drill." >&2
  exit 66
}

rollback_root="$(mktemp -d /tmp/anchor-rollback.XXXXXX)"
trap 'rm -rf "${rollback_root}"' EXIT

tar -C "${project_root}" -cf "${rollback_root}/release.tar" dist
sha256sum "${rollback_root}/release.tar" > "${rollback_root}/release.tar.sha256"
sha256sum --check "${rollback_root}/release.tar.sha256"
mkdir "${rollback_root}/restored"
tar -C "${rollback_root}/restored" -xf "${rollback_root}/release.tar"

node --input-type=module - "${rollback_root}/restored/dist" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const dist = process.argv[2];
JSON.parse(await readFile(`${dist}/.openai/hosting.json`, "utf8"));
const worker = await import(`${pathToFileURL(`${dist}/server/index.js`).href}?rollback=${Date.now()}`);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("Restored artifact is not deployable.");
}
NODE

echo "Rollback drill passed: immutable artifact checksum and restored Worker verified."

#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const [recordPath, environment, commit] = process.argv.slice(2);
const record = JSON.parse(await readFile(recordPath, "utf8"));

if (record.target_environment !== environment) {
  throw new Error(`Release record targets ${record.target_environment}, not ${environment}.`);
}
if (record.code.commit !== commit) {
  throw new Error(`Release record commit ${record.code.commit} does not match workflow commit ${commit}.`);
}

console.log(`Release target verified for ${environment} at ${commit}.`);

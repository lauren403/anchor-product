// Render a CodeQL SARIF file as a markdown table for the GitHub Actions run summary.
//
// WHY: code scanning is unavailable on this plan (Advanced Security is
// Organizations-only), so there is no alert list to click through. Printing the
// findings here means the run page itself is the report - nobody has to download
// and unzip a SARIF to learn what CodeQL found.
import { readFileSync } from "node:fs";

const sarif = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rows = [];

for (const run of sarif.runs ?? []) {
  // Rule metadata lives separately from results; index it so each row can carry a
  // severity and a human-readable rule name rather than a bare rule id.
  const rules = new Map();
  for (const rule of run.tool?.driver?.rules ?? []) rules.set(rule.id, rule);
  for (const ext of run.tool?.extensions ?? []) {
    for (const rule of ext.rules ?? []) rules.set(rule.id, rule);
  }

  for (const result of run.results ?? []) {
    const rule = rules.get(result.ruleId) ?? {};
    const props = rule.properties ?? {};
    const location = result.locations?.[0]?.physicalLocation ?? {};
    const uri = location.artifactLocation?.uri ?? "(no location)";
    const line = location.region?.startLine;
    rows.push({
      severity: (props["security-severity"] ? `${props["security-severity"]} ` : "") +
        (props.problem?.severity ?? rule.defaultConfiguration?.level ?? result.level ?? "note"),
      rule: rule.name ?? result.ruleId ?? "(unknown rule)",
      id: result.ruleId ?? "",
      where: line ? `${uri}:${line}` : uri,
      // Escape backslashes BEFORE pipes: doing it the other way round turns the
      // backslash this adds into an escape for the wrong character, and a message
      // containing a literal backslash can then break out of the table cell.
      // Flagged by CodeQL as js/incomplete-sanitization on this very file, which is
      // a fair demonstration that the summary works.
      message: (result.message?.text ?? "")
        .replace(/\s+/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|")
        .trim(),
    });
  }
}

if (process.argv[3] === "--count") {
  process.stdout.write(String(rows.length));
} else if (rows.length) {
  console.log("| Severity | Rule | Location | Message |");
  console.log("| --- | --- | --- | --- |");
  for (const r of rows) {
    console.log(`| ${r.severity} | ${r.rule}<br><sub>\`${r.id}\`</sub> | \`${r.where}\` | ${r.message} |`);
  }
}

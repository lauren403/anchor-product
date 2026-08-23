import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// ACCESSIBILITY LINTING - why this block exists.
//
// eslint-config-next already pulls in eslint-plugin-jsx-a11y, but it enables only a
// handful of its rules and reports them as WARNINGS. Measured on 2026-08-23 against a
// component containing six deliberate violations, the stock configuration caught ONE
// (a missing alt attribute) and let the other five through: a click handler on a
// non-interactive div, an anchor with no accessible content, an unlabelled input, an
// invalid ARIA role, and a <marquee>. Because every finding was a warning, `eslint`
// exited 0 and the quality gate passed regardless.
//
// That mattered here more than it would elsewhere. The release record claimed "zero
// automated WCAG A/AA violations in acceptance run" while no workflow in this
// repository produced accessibility results at all, and Anchor is built for disabled
// and neurodivergent users - the population least able to absorb an untested claim.
//
// So: the plugin's full recommended ruleset, promoted to ERROR, on every file that can
// contain JSX. Static analysis only; the runtime half is tests/accessibility.test.mjs,
// which runs axe-core over the rendered HTML.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // No `plugins` key here on purpose: eslint-config-next has already registered
    // "jsx-a11y", and flat config refuses to redefine a plugin name. We only widen
    // and promote its rules.
    //
    // Promote the rules the recommended set ENABLES (31 of 34), and leave the three it
    // deliberately switches off switched off: jsx-a11y/label-has-for (deprecated,
    // superseded by label-has-associated-control), jsx-a11y/control-has-associated-label
    // and jsx-a11y/anchor-ambiguous-text. Turning all 34 on produced 19 errors in
    // LegacyAnchorApp.jsx from those three alone - noise that would have meant editing
    // working, accessible markup to satisfy rules their own authors disable.
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    rules: Object.fromEntries(
      Object.entries(jsxA11y.configs.recommended.rules)
        .filter(([, level]) => {
          const severity = Array.isArray(level) ? level[0] : level;
          return severity !== "off" && severity !== 0;
        })
        .map(([rule]) => [rule, "error"]),
    ),
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

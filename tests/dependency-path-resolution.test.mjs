/**
 * Dependency path-resolution tests.
 *
 * A skill installed as a PLUGIN lives at
 *   $HOME/.claude/plugins/cache/<marketplace>/<plugin>/<version>/...
 * and NOT at
 *   $HOME/.claude/skills/<plugin>/...
 *
 * SKILL.md once invoked doc-freshness-reverse-lint's reverse_lint.py through the
 * second path only. When that skill was plugin-installed the path missed, and the
 * fallback branch logged "doc-freshness-reverse-lint: not installed" — so Phase 4
 * step 24 silently did nothing while the handoff still read as clean.
 *
 * These tests fail if that shape comes back.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function findSkillMd() {
  const pluginsRoot = resolve(ROOT, "plugins");
  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = resolve(pluginsRoot, entry.name, "SKILL.md");
      if (existsSync(candidate)) return candidate;
    }
  }
  const legacy = resolve(ROOT, "SKILL.md");
  return existsSync(legacy) ? legacy : null;
}

const skillMdPath = findSkillMd();
const skillMd = skillMdPath ? readFileSync(skillMdPath, "utf-8") : null;

describe("Dependency path resolution", () => {
  it("SKILL.md exists", () => {
    assert.ok(skillMd, "expected a SKILL.md to test");
  });

  // The bug class, stated generally: never execute an interpreter directly
  // against a hardcoded ~/.claude/skills/ path. That root only exists for
  // personal-scope installs, so the call silently misses on plugin installs.
  it("never invokes an interpreter on a hardcoded ~/.claude/skills/ path", () => {
    const DIRECT_INVOCATION =
      /\b(python3?|node|bash|sh)\s+["']?(~|\$HOME|\$\{HOME\})\/\.claude\/skills\//;

    const offenders = skillMd
      .split("\n")
      .map((line, n) => ({ line, n: n + 1 }))
      .filter(({ line }) => DIRECT_INVOCATION.test(line));

    assert.deepEqual(
      offenders.map(({ n, line }) => `${n}: ${line.trim()}`),
      [],
      "resolve the script into a variable across both install roots, then invoke the variable"
    );
  });

  it("resolves reverse_lint.py at BOTH the personal-skills root and the plugin cache", () => {
    const personal = /\$HOME\/\.claude\/skills\/doc-freshness-reverse-lint\/scripts\/reverse_lint\.py/;
    const pluginCache = /\$HOME"?\/\.claude\/plugins\/cache\/\*\/doc-freshness-reverse-lint\/\*\/scripts\/reverse_lint\.py/;

    assert.match(skillMd, personal, "must still try the git-clone / personal-scope install root");
    assert.match(skillMd, pluginCache, "must also try the plugin-cache install root");
  });

  it("picks the highest version when several are cached", () => {
    // Several plugin versions can sit in the cache at once; an unsorted glob
    // would pick 1.9.0 over 1.10.0. `sort -V` is present on both macOS
    // (Apple sort 2.3+) and GNU coreutils.
    assert.match(
      skillMd,
      /doc-freshness-reverse-lint\/\*\/scripts\/reverse_lint\.py[\s\S]{0,120}?sort -V/,
      "the plugin-cache glob must be version-sorted"
    );
  });

  it("the not-found branch names the paths it tried", () => {
    // A bare "not installed" was read by a human as proof the skill was absent,
    // when it was in fact installed as a plugin. The log must be checkable.
    const notFoundLine = skillMd.match(/doc-freshness-reverse-lint: not [a-z]+[^\n]*/);
    assert.ok(notFoundLine, "expected a not-found log line for the reverse-lint step");
    assert.match(
      notFoundLine[0],
      /not found/,
      'say "not found" (a claim about lookup), not "not installed" (a claim about install state)'
    );
    assert.match(
      skillMd,
      /not found — tried/,
      "the not-found branch must print the paths it tried"
    );
  });
});

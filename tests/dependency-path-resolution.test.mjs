/**
 * Dependency path-resolution tests.
 *
 * A skill installed as a PLUGIN lives at
 *   $HOME/.claude/plugins/cache/<marketplace>/<plugin>/<version>/...
 * and NOT at
 *   $HOME/.claude/skills/<plugin>/...
 *
 * SKILL.md once invoked doc-freshness-reverse-lint's reverse_lint.py through the
 * second path only. On a plugin install the path missed, the fallback logged
 * "not installed", and step 24 silently did nothing while the handoff still read
 * as clean. A human read that log as proof the skill was absent; it had been
 * installed the whole time.
 *
 * THESE TESTS EXECUTE THE RESOLVER. An earlier version of this file only regex-matched
 * SKILL.md's text, which could not tell working resolution from broken resolution that
 * merely contained the right words — flipping `||` to `&&` in the snippet kept every
 * assertion green while restoring the original bug. Behavior is asserted by running
 * scripts/resolve_dep.sh against fixture HOMEs; the text assertions are a secondary lint,
 * scoped to the step-24 code fence so prose elsewhere cannot satisfy them.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PLUGIN_DIR = resolve(ROOT, "plugins/session-handoff");
const RESOLVER = resolve(PLUGIN_DIR, "scripts/resolve_dep.sh");
const AUDIT = resolve(PLUGIN_DIR, "scripts/skill_freshness_audit.py");
const SKILL_MD_PATH = resolve(PLUGIN_DIR, "SKILL.md");
const skillMd = existsSync(SKILL_MD_PATH) ? readFileSync(SKILL_MD_PATH, "utf-8") : null;

// This repo's OWN plugin name. Its scripts legitimately fall back to
// $HOME/.claude/skills/session-handoff/ after CLAUDE_PLUGIN_ROOT; only
// references to OTHER plugins through that root are the bug.
const OWN_PLUGIN = "session-handoff";

let TMP;
before(() => { TMP = mkdtempSync(join(tmpdir(), "dep-resolution-")); });
after(() => { if (TMP) rmSync(TMP, { recursive: true, force: true }); });

/** Build a fake $HOME. `personal` = [plugin], `cached` = [[marketplace, plugin, version]]. */
function fakeHome(label, { personal = [], cached = [], relpath = "scripts/r.py" } = {}) {
  const home = join(TMP, label);
  for (const plugin of personal) {
    const p = join(home, ".claude/skills", plugin, relpath);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "#personal\n");
  }
  for (const [market, plugin, version] of cached) {
    const p = join(home, ".claude/plugins/cache", market, plugin, version, relpath);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "#cached\n");
  }
  mkdirSync(join(home, ".claude"), { recursive: true });
  return home;
}

function runResolver(home, plugin = "dep", relpath = "scripts/r.py") {
  const r = spawnSync("sh", [RESOLVER, plugin, relpath], {
    env: { ...process.env, HOME: home },
    encoding: "utf-8",
  });
  return { status: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

/** The fenced bash block belonging to step 24, so prose elsewhere can't satisfy assertions. */
function step24Fence() {
  const start = skillMd.indexOf("24. **Doc freshness reverse-lint**");
  assert.ok(start !== -1, "could not locate step 24 heading");
  const fenceStart = skillMd.indexOf("```bash", start);
  assert.ok(fenceStart !== -1, "could not locate step 24 bash fence");
  const fenceEnd = skillMd.indexOf("```", fenceStart + 7);
  assert.ok(fenceEnd !== -1, "unterminated step 24 bash fence");
  return skillMd.slice(fenceStart + 7, fenceEnd);
}

describe("resolve_dep.sh — behavior", () => {
  it("the resolver exists and is executable as a script", () => {
    assert.ok(existsSync(RESOLVER), `expected ${RESOLVER}`);
  });

  it("resolves a personal-scope install", () => {
    const home = fakeHome("personal-only", { personal: ["dep"] });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /\.claude\/skills\/dep\/scripts\/r\.py$/);
  });

  it("resolves a PLUGIN install — the case the original bug missed entirely", () => {
    const home = fakeHome("plugin-only", { cached: [["mkt", "dep", "1.3.0"]] });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /plugins\/cache\/mkt\/dep\/1\.3\.0\/scripts\/r\.py$/);
  });

  it("personal scope shadows the plugin cache", () => {
    const home = fakeHome("both", { personal: ["dep"], cached: [["mkt", "dep", "9.9.9"]] });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /\.claude\/skills\/dep\//);
  });

  it("picks the highest version, not the lexically-last (1.10.0 > 1.9.0)", () => {
    const home = fakeHome("multiversion", {
      cached: [["mkt", "dep", "1.9.0"], ["mkt", "dep", "1.10.0"]],
    });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /\/1\.10\.0\//, "version-sort must beat string-sort");
  });

  it("picks the highest version ACROSS marketplaces, not the last marketplace name", () => {
    // The marketplace segment precedes the version in the path, so `sort -V` over
    // whole paths ranks by marketplace name and lets an older copy win.
    const home = fakeHome("multimarket", {
      cached: [["aaa-mkt", "dep", "2.5.0"], ["zzz-mkt", "dep", "1.0.0"]],
    });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /aaa-mkt\/dep\/2\.5\.0\//, "must rank on version, not marketplace name");
  });

  it("does not mistake a marketplace named like the plugin for the plugin", () => {
    const home = fakeHome("namecollision", { cached: [["dep", "other", "1.0.0"]] });
    assert.equal(runResolver(home).status, 1);
  });

  it("survives spaces in $HOME", () => {
    const home = fakeHome("has space", { cached: [["mkt", "dep", "1.0.0"]] });
    const r = runResolver(home);
    assert.equal(r.status, 0, r.err);
    assert.match(r.out, /has space\//);
  });

  it("when nothing resolves: exit 1, and stderr NAMES BOTH roots tried", () => {
    const home = fakeHome("nothing");
    const r = runResolver(home);
    assert.equal(r.status, 1);
    assert.match(r.err, /not found/, 'must say "not found", a claim about lookup');
    assert.doesNotMatch(r.err, /not installed/, '"not installed" claims install state it cannot know');
    assert.match(r.err, /\.claude\/skills\/dep\//, "must name the personal root it tried");
    assert.match(r.err, /\.claude\/plugins\/cache\//, "must name the plugin-cache root it tried");
  });

  // zsh is the default macOS shell (where this skill is mostly run) but is absent on
  // ubuntu-latest, where CI runs. Skip rather than drop: the assertion is about a real
  // zsh-only failure mode, so it must still run on the platform that has zsh.
  const HAS_ZSH = spawnSync("zsh", ["-c", "exit 0"]).status === 0;

  it("is silent on stderr under zsh when the cache root is absent", { skip: !HAS_ZSH && "zsh not installed" }, () => {
    // zsh's nomatch fails a non-matching glob at expansion time, before 2>/dev/null
    // applies, so a glob-based resolver leaked a raw shell error here.
    const home = fakeHome("zsh-nomatch", { personal: ["dep"] });
    const r = spawnSync("zsh", ["-c", `sh ${JSON.stringify(RESOLVER)} dep scripts/r.py`], {
      env: { ...process.env, HOME: home },
      encoding: "utf-8",
    });
    assert.equal(r.status, 0);
    assert.equal((r.stderr || "").trim(), "", "no raw shell error may precede our own message");
  });
});

describe("skill_freshness_audit.py — both install roots", () => {
  function fakeSkillHome(label, entries) {
    const home = join(TMP, label);
    for (const [rel, name] of entries) {
      const p = join(home, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, `---\nname: ${name}\ndescription: d\n---\n`);
    }
    mkdirSync(join(home, ".claude"), { recursive: true });
    return home;
  }
  function runAudit(home) {
    const r = spawnSync("python3", [AUDIT, "--json"], {
      env: { ...process.env, HOME: home },
      encoding: "utf-8",
    });
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch { /* left null */ }
    return { status: r.status, json: parsed, err: r.stderr || "" };
  }

  it("audits PLUGIN-scope skills — previously it saw none and reported clean", () => {
    const home = fakeSkillHome("audit-plugin", [
      [".claude/plugins/cache/mkt/alpha/1.10.0/SKILL.md", "alpha"],
      [".claude/plugins/cache/mkt/beta/2.0.0/SKILL.md", "beta"],
    ]);
    const r = runAudit(home);
    assert.ok(r.json, `expected JSON, stderr: ${r.err}`);
    assert.deepEqual(r.json.skills.map((s) => s.name).sort(), ["alpha", "beta"]);
  });

  it("keeps the highest cached version of a skill", () => {
    const home = fakeSkillHome("audit-versions", [
      [".claude/plugins/cache/mkt/alpha/1.9.0/SKILL.md", "alpha"],
      [".claude/plugins/cache/mkt/alpha/1.10.0/SKILL.md", "alpha"],
    ]);
    const r = runAudit(home);
    assert.equal(r.json.skills.length, 1);
    assert.match(r.json.skills[0].path, /\/1\.10\.0\//);
  });

  it("a missing personal root is a skipped root, not a fatal exit", () => {
    const home = fakeSkillHome("audit-nopersonal", [
      [".claude/plugins/cache/mkt/alpha/1.0.0/SKILL.md", "alpha"],
    ]);
    const r = runAudit(home);
    assert.notEqual(r.status, 2, "must not abort just because ~/.claude/skills is absent");
    assert.equal(r.json.skills.length, 1);
  });
});

describe("SKILL.md — step 24 lint", () => {
  it("the step 24 bash fence is syntactically valid shell", () => {
    const fence = step24Fence();
    const f = join(TMP, "step24.sh");
    writeFileSync(f, fence);
    const r = spawnSync("bash", ["-n", f], { encoding: "utf-8" });
    assert.equal(r.status, 0, `bash -n rejected the step 24 fence:\n${r.stderr}`);
  });

  it("step 24 does not reference ANY other plugin through the ~/.claude/skills root", () => {
    // Match the PATH wherever it appears, not just adjacent to an interpreter: the
    // fix replaced direct invocation with a resolved variable, so an interpreter-
    // adjacency rule would miss the most likely way the bug returns.
    // Match the path by its distinctive middle, with NO requirement on how the home
    // prefix is spelled — ~, $HOME, ${HOME}, "$HOME", or nothing at all all count.
    // Anchoring on the prefix let a mutation through during review.
    const fence = step24Fence();
    const re = /\.claude\/skills\/([a-z0-9._-]+)/gi;
    const offenders = [...fence.matchAll(re)]
      .map((m) => m[1])
      .filter((plugin) => plugin !== OWN_PLUGIN);
    assert.deepEqual([...new Set(offenders)], [], "resolve cross-plugin scripts via resolve_dep.sh");
  });

  it("step 24 does not use a literal HEAD~N as a revision", () => {
    // `git diff HEAD~N..HEAD` exits 128 and the loop runs zero times, which then
    // gets reported as "clean" — the same silent no-op by a different route.
    // Matches the revision-RANGE form so that naming HEAD~N in a warning is still allowed.
    assert.doesNotMatch(
      step24Fence(),
      /HEAD~N\s*\.\./,
      "substitute a real base SHA; HEAD~N is a placeholder, not a revision"
    );
  });

  it("no step prescribes logging a bare ': not installed'", () => {
    const offenders = skillMd
      .split("\n")
      .map((line, n) => ({ line, n: n + 1 }))
      .filter(({ line }) => /log\s+"[^"]*:\s*not installed/i.test(line));
    assert.deepEqual(
      offenders.map(({ n, line }) => `${n}: ${line.trim()}`),
      [],
      'say "not found — tried <paths>"; install state is not what a failed lookup observed'
    );
  });

  it("the reverse-lint summary row admits a skipped state", () => {
    const row = skillMd.split("\n").find((l) => /^\|.*Doc-freshness reverse-lint/.test(l));
    assert.ok(row, "expected a reverse-lint row in the summary table");
    // Must ENUMERATE skipped as a fillable option, not merely mention the word:
    // the row is the menu the model picks from, and it previously offered only
    // "Clean / N candidates" — so a step that never ran got written up as clean.
    assert.match(
      row,
      /"skipped:/i,
      'the row must offer "skipped: <reason>" as an option, not just mention skipping'
    );
  });
});

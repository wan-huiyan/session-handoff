#!/usr/bin/env python3
"""Skill freshness audit (session-handoff step 24b).

Scans installed skills at BOTH install roots (~/.claude/skills/*/SKILL.md and
~/.claude/plugins/cache/*/*/*/SKILL.md) and reports, per skill:

  - age: days since the frontmatter `last_verified` date if declared,
    otherwise days since the SKILL.md file was last modified
  - STALE flag: age exceeds the skill's own frontmatter
    `staleness_window_days` if declared, otherwise --stale-days (default 90)
  - NO-DESCRIPTION flag: frontmatter lacks a `description`
  - CONTRACT flag: skill declares `last_verified` without a
    `staleness_window_days` window (opts into the freshness contract
    without declaring one)

Never auto-bumps `last_verified` — this is a surface-for-human-review tool.
Flagged skills belong in the handoff doc's "Stale docs to review" section.

Exit codes: 0 nothing flagged, 1 at least one skill flagged, 2 no skill
root found at either install location.
"""

import argparse
import datetime
import json
import re
import sys
from pathlib import Path

DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def default_skill_roots():
    """Both roots a skill can be installed under.

    A skill installed as a PLUGIN never appears under ~/.claude/skills; it lives at
    ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/. Scanning only the first
    root made this audit report zero skills — written up as "clean" — for anyone whose
    skills are all plugin-scope.
    """
    base = Path.home() / ".claude"
    return [base / "skills", base / "plugins" / "cache"]


def _version_key(text):
    """Sort key for a version directory name; non-numeric parts sort lowest."""
    return tuple(int(p) if p.isdigit() else -1 for p in re.split(r"[._-]", text))


def _personal_skill_mds(root):
    """Layouts found under a personal/git-clone root.

    <root>/<skill>/SKILL.md              — the plain personal install
    <root>/<repo>/skills/<skill>/SKILL.md
    <root>/<repo>/plugins/<plugin>/SKILL.md
    <root>/<repo>/plugins/<plugin>/skills/<skill>/SKILL.md

    A git clone holds many skills. Keying those on the parent directory would collapse
    them all onto the literal string "skills" or "plugins" and drop every one but the
    alphabetically first, so each is keyed on the directory that actually names it.
    """
    for pattern in ("*/SKILL.md",
                    "*/skills/*/SKILL.md",
                    "*/plugins/*/SKILL.md",
                    "*/plugins/*/skills/*/SKILL.md"):
        for skill_md in sorted(root.glob(pattern)):
            yield skill_md.parent.name, skill_md


def _cache_skill_mds(root):
    """Layouts found under ~/.claude/plugins/cache.

    <mkt>/<plugin>/<ver>/SKILL.md                  — single-skill plugin
    <mkt>/<plugin>/<ver>/skills/<skill>/SKILL.md   — multi-skill plugin (the common one)

    Only the first was matched before, which on a real machine is a small minority of
    installed skills; the rest were silently unaudited and the empty result read as clean.
    """
    for skill_md in sorted(root.glob("*/*/*/SKILL.md")):
        # <mkt>/<plugin>/<ver>/SKILL.md — the skill is named by the PLUGIN dir; keying
        # on skill_md.parent here would key on the version ("9.9.9") and never collide
        # with the same skill installed elsewhere.
        version_dir = skill_md.parent
        yield version_dir.parent.name, _version_key(version_dir.name), skill_md
    for skill_md in sorted(root.glob("*/*/*/skills/*/SKILL.md")):
        # <mkt>/<plugin>/<ver>/skills/<skill>/SKILL.md — here the leaf names the skill.
        version_dir = skill_md.parents[2]
        yield skill_md.parent.name, _version_key(version_dir.name), skill_md


def discover_skill_mds(roots, layouts=None):
    """Every SKILL.md under the given roots, one per skill name.

    Personal-scope wins over the plugin cache (it is what a developer has checked out);
    within the cache the highest version wins.
    """
    best = {}  # skill name -> (rank, version_key, path)

    def offer(name, rank, version_key, path):
        # Skip fixture trees, which are test data rather than installed skills.
        if "tests/fixtures" in str(path).replace("\\", "/"):
            return
        cand = (rank, version_key)
        if name not in best or cand > best[name][0]:
            best[name] = (cand, path)

    for root, layout in zip(roots, layouts or _layouts_for(roots)):
        if layout == "personal":
            for name, path in _personal_skill_mds(root):
                offer(name, 2, (), path)
        else:
            for name, vkey, path in _cache_skill_mds(root):
                offer(name, 1, vkey, path)

    return [best[n][1] for n in sorted(best)]


def _layouts_for(roots):
    """Tag each root by shape, so a cache-shaped glob is never run on a personal root."""
    return ["cache" if r.name == "cache" else "personal" for r in roots]


def parse_frontmatter(text):
    """Extract simple `key: value` pairs from YAML frontmatter."""
    fields = {}
    if not text.startswith("---"):
        return fields
    end = text.find("\n---", 3)
    if end == -1:
        return fields
    for line in text[3:end].splitlines():
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            fields[m.group(1)] = m.group(2).strip().strip("\"'")
    return fields


def parse_date(value):
    """Parse a YYYY-MM-DD date out of a frontmatter value, if any."""
    if not value:
        return None
    m = DATE_RE.search(value)
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def audit_skill(skill_md, default_window, today):
    fm = parse_frontmatter(
        skill_md.read_text(encoding="utf-8", errors="replace"))
    name = fm.get("name") or skill_md.parent.name

    last_verified = parse_date(fm.get("last_verified"))
    if last_verified:
        age_days = (today - last_verified).days
        age_source = "last_verified"
    else:
        mtime = datetime.date.fromtimestamp(skill_md.stat().st_mtime)
        age_days = (today - mtime).days
        age_source = "mtime"

    window = default_window
    declared_window = fm.get("staleness_window_days")
    if declared_window and declared_window.isdigit():
        window = int(declared_window)

    flags = []
    if age_days > window:
        flags.append("stale")
    if not fm.get("description"):
        flags.append("no-description")
    if fm.get("last_verified") and not declared_window:
        flags.append("no-staleness-window")

    return {
        "name": name,
        "path": str(skill_md),
        "age_days": age_days,
        "age_source": age_source,
        "window_days": window,
        "flags": flags,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Audit installed skills for freshness: flags skills whose "
            "last_verified / last-modified age exceeds their staleness "
            "window, and skills whose frontmatter lacks a description. "
            "Surfaces candidates for human review — never auto-bumps "
            "last_verified."
        ),
        epilog="Exit codes: 0 clean, 1 skills flagged, 2 no skill root found.",
    )
    parser.add_argument(
        "--skills-dir", type=Path, action="append", dest="skills_dirs",
        metavar="DIR",
        help="directory containing <skill>/SKILL.md trees. Repeatable. "
             "Default: both install roots (~/.claude/skills and the plugin cache).",
    )
    parser.add_argument(
        "--stale-days", type=int, default=90, metavar="N",
        help="default staleness window in days when a skill declares no "
             "staleness_window_days of its own (default: 90)",
    )
    parser.add_argument("--json", action="store_true",
                        help="emit machine-readable JSON instead of text")
    parser.add_argument(
        "--human", action="store_true",
        help="human-readable text output (default behavior; flag kept for "
             "compatibility with the skill's documented invocation)",
    )
    args = parser.parse_args(argv)

    roots = args.skills_dirs or default_skill_roots()
    present = [d for d in roots if d.is_dir()]

    if not present:
        # A missing root is a skipped root, not a fatal error: a plugin-scope-only
        # user has no ~/.claude/skills at all, and exiting 2 there used to make the
        # audit report nothing while the caller wrote up "clean".
        print("skill_freshness_audit: no skill roots found — tried "
              + ", ".join(str(d) for d in roots), file=sys.stderr)
        return 2

    today = datetime.date.today()
    results = []
    for skill_md in discover_skill_mds(present):
        results.append(audit_skill(skill_md, args.stale_days, today))

    flagged = [r for r in results if r["flags"]]
    exit_code = 1 if flagged else 0

    if args.json:
        print(json.dumps({
            "skill_roots": [str(d) for d in present],
            "stale_days_default": args.stale_days,
            "skills": results,
            "flagged_count": len(flagged),
            "exit_code": exit_code,
        }, indent=2))
        return exit_code

    if not results:
        print("No skills found under " + ", ".join(str(d) for d in present))
        return 0

    print(f"Skill freshness audit — {len(results)} skill(s) under "
          + ", ".join(str(d) for d in present))
    print(f"(default staleness window: {args.stale_days} days)\n")
    for r in results:
        marker = "FLAG " if r["flags"] else "ok   "
        flags = f"  [{', '.join(r['flags'])}]" if r["flags"] else ""
        print(f"  {marker}{r['name']:<40} {r['age_days']:>5}d "
              f"({r['age_source']}, window {r['window_days']}d){flags}")
    print()
    if flagged:
        print(f"{len(flagged)} skill(s) flagged — add to the handoff doc's "
              "\"Stale docs to review\" section for human verification. "
              "Never auto-bump last_verified.")
    else:
        print("All skills fresh.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())

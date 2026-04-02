# session-handoff

End-of-session handoff that captures all knowledge, updates documentation, and prepares paste-ready prompts for the next session.

## Quick Start

```
You: /session-handoff
Claude: [scans git log, writes handoff doc, updates memory, creates next-session prompt]

You: wrap up this session
Claude: [same — triggers on natural language too]
```

## Installation

**Claude Code:**
```bash
# Git clone (recommended)
git clone https://github.com/wan-huiyan/session-handoff.git ~/.claude/skills/session-handoff
```

**Cursor** (2.4+):
```bash
# Per-project rule (most reliable)
mkdir -p .cursor/rules
# Copy SKILL.md content into .cursor/rules/session-handoff.mdc with alwaysApply: true
```

## What You Get

Every handoff produces:

| Artifact | Description |
|---|---|
| **Handoff doc** | What was completed, what remains, key decisions, files modified, branch status |
| **Lessons update** | Non-obvious debugging patterns and user corrections captured |
| **Memory files** | New feedback/reference files created or updated |
| **ADRs** | Architectural Decision Records for significant choices |
| **Future plan** | Updated with completed items and newly discovered work |
| **Sessions archive** | Running log of all sessions with dates and outcomes |
| **Next session prompt** | Paste-ready prompt with full context to resume immediately |

## Typical Ad-Hoc vs With Skill

| | Ad-hoc wrap-up | With session-handoff |
|---|---|---|
| Knowledge capture | Mental notes, maybe a quick message | Structured handoff doc with decisions table |
| Lessons learned | Lost when context window resets | Written to persistent memory files |
| Next session start | Re-read code, reconstruct context | Paste the prompt, start immediately |
| Parallel streams | Forgotten | Separate prompts for each work stream |
| Memory hygiene | Skipped | Automatic check for orphaned files |

## How It Works

| Phase | Steps | What happens |
|---|---|---|
| **Capture** | 1-4 | Scan git log, write handoff doc, capture lessons, update memory files |
| **Update** | 5-9 | Propagate to future plan, roadmap, sessions archive, MEMORY.md, ADRs |
| **Prepare** | 10-11 | Write next-session prompt(s) for all work streams |
| **Verify** | 12-15 | Check for uncommitted changes, memory hygiene, final confirmation |

## Companion Skills

- **[session-handoff-consolidator](https://github.com/wan-huiyan/session-handoff-consolidator)** — After 3+ handoffs accumulate, merges them into a single prioritised "start here" document
- **[memory-hygiene](https://github.com/wan-huiyan/memory-hygiene)** — Audit and clean up persistent memory files

## Limitations

- Does not expose context-window usage (Claude Code limitation) — trigger manually when you notice compression
- Assumes `docs/` and `memory/` directory structure — adapts gracefully but works best with this layout
- Git-dependent — requires a git repository for commit scanning and branch status
- Does not auto-trigger at session end — must be invoked explicitly

<details>
<summary>Quality Checklist</summary>

The skill guarantees:
- [ ] All commits since session start are accounted for
- [ ] Handoff doc has all 5 sections (completed, remaining, decisions, files, branch)
- [ ] Lessons scanned for non-obvious debugging patterns
- [ ] MEMORY.md index is consistent with memory files on disk
- [ ] No uncommitted changes left behind
- [ ] Next-session prompt is paste-ready (no "see above" references)
- [ ] ADR numbers checked for duplicates

</details>

## Version History

- **1.0.0** — Initial release. 4-phase checklist with 15 steps, companion skill integration, auto-trigger hook suggestion.

## License

MIT

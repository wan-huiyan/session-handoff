# session-handoff

End-of-session handoff that captures all knowledge, updates documentation, and prepares paste-ready prompts for the next session. Includes built-in cross-session consolidation when multiple handoffs accumulate.

## Quick Start

```
You: /session-handoff
Claude: [scans git log, writes handoff doc, updates memory, creates next-session prompt]

You: wrap up this session
Claude: [same — triggers on natural language too]

You: consolidate handoffs
Claude: [merges 3+ handoff docs into a single source-of-truth plan]
```

## Installation

**Claude Code:**
```bash
git clone https://github.com/wan-huiyan/session-handoff.git ~/.claude/skills/session-handoff
```

**Cursor** (2.4+):
```bash
mkdir -p .cursor/rules
# Copy SKILL.md content into .cursor/rules/session-handoff.mdc with alwaysApply: true
```

## What You Get

Every handoff produces:

| Artifact | Description |
|---|---|
| **Handoff doc** | What was completed, what remains, blockers/open issues, key decisions, files modified, branch status |
| **Lessons update** | Non-obvious debugging patterns and user corrections captured |
| **Memory files** | New feedback/reference files created or updated |
| **ADRs** | Architectural Decision Records for significant choices |
| **Future plan** | Updated with completed items and newly discovered work |
| **Sessions archive** | Running log of all sessions with dates and outcomes |
| **Next session prompt** | Paste-ready prompt with full context to resume immediately |
| **Consolidated plan** | *(when 3+ handoffs exist)* Single source of truth with decision supersession, gap analysis, and PR reconciliation |

## Typical Ad-Hoc vs With Skill

| | Ad-hoc wrap-up | With session-handoff |
|---|---|---|
| Knowledge capture | Mental notes, maybe a quick message | Structured handoff doc with decisions table |
| Lessons learned | Lost when context window resets | Written to persistent memory files |
| Next session start | Re-read code, reconstruct context | Paste the prompt, start immediately |
| Parallel streams | Forgotten | Separate prompts for each work stream |
| Memory hygiene | Skipped | Automatic check for orphaned files |
| After 5 parallel sessions | Cross-reference 5 handoff docs manually | One consolidated plan with superseded decisions resolved |

## How It Works

| Phase | Steps | What happens |
|---|---|---|
| **1. Capture** | 1-4 | Scan git log, write handoff doc, capture lessons, update memory files |
| **2. Update** | 5-9 | Propagate to future plan, roadmap, sessions archive, MEMORY.md, ADRs |
| **3. Prepare** | 10-11 | Write next-session prompt(s) for all work streams |
| **4. Verify** | 12-15 | Check for uncommitted changes, memory hygiene, final confirmation |
| **5. Consolidate** | 16-20 | *(conditional)* Merge handoffs into single plan, track decision supersession, identify gaps |

### When does consolidation run?

Phase 5 triggers automatically when 3+ handoff docs exist in `docs/handoffs/`, or when you explicitly ask to consolidate. It:

- **Tracks decision supersession** — marks decisions as OPEN, RESOLVED, or SUPERSEDED across sessions
- **Validates claims** — checks every PR/branch reference against actual git/GitHub state
- **Identifies gaps** — cross-checks "what needs to happen next" against what actually happened
- **Produces one plan** — `docs/plans/future_sessions_plan.md` that a cold-start session can read without touching any other handoff doc

## Key Design Decisions

| Decision | Rationale |
|---|---|
| 5-phase sequential checklist | Ensures nothing is skipped; each phase builds on the previous |
| Consolidation as Phase 5 (not separate skill) | Reduces cognitive overhead — one skill handles the full handoff lifecycle |
| Conditional consolidation (3+ threshold) | Avoids unnecessary overhead for simple linear session sequences |
| Strikethrough for resolved decisions | Visual scanning — instantly see what's decided vs open |
| Paste-ready next-session prompts | Eliminates "see above" references that break across context windows |

## Limitations

- Does not detect context-window size (Claude Code limitation) — trigger manually when you notice compression
- Assumes `docs/` and `memory/` directory structure — creates them if missing, but works best when pre-existing
- Git-dependent for commit scanning and branch status (gracefully degrades without git)
- Requires `gh` CLI for PR status validation during consolidation (skips PR checks without it)
- Does not auto-trigger at session end — must be invoked explicitly

<details>
<summary>Quality Checklist</summary>

The skill guarantees:
- [ ] All commits since session start are accounted for
- [ ] Handoff doc has all 6 sections (completed, remaining, blockers, decisions, files, branch)
- [ ] Lessons scanned for non-obvious debugging patterns
- [ ] MEMORY.md index is consistent with memory files on disk
- [ ] No uncommitted changes left behind
- [ ] Next-session prompt is paste-ready (no "see above" references)
- [ ] ADR numbers checked for duplicates
- [ ] (If consolidating) Every PR/branch claim verified against current state
- [ ] (If consolidating) Decision supersession timeline is complete

</details>

## Related Skills

- **[memory-hygiene](https://github.com/wan-huiyan/memory-hygiene)** — Deep memory cleanup beyond what Phase 4 covers

## Version History

- **1.1.0** — Merged session-handoff-consolidator as Phase 5 (conditional consolidation). Added edge case handling, anti-patterns section, improved triggers.
- **1.0.0** — Initial release. 4-phase checklist with 15 steps.

## License

MIT

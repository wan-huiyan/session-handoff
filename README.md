# session-handoff

> 📦 **Also available in the [context-baton](https://github.com/wan-huiyan/context-baton) marketplace**, paired with [successor-handoff](https://github.com/wan-huiyan/context-baton/tree/master/plugins/successor-handoff) for mid-run agent-to-agent handoffs during long autonomous work. This standalone repo tracks the same SKILL.md as the bundle.

End-of-session handoff that captures all knowledge, **dispatches session output across the canonical 7-bucket `docs/` taxonomy** (aligned with [memory-hygiene v3.1](https://github.com/wan-huiyan/memory-hygiene)), and prepares paste-ready prompts for the next session. Includes built-in cross-session consolidation when multiple handoffs accumulate, and a mandatory **doc-freshness reverse-lint** verify step that catches stale normative guidance in project docs after this session's lessons.

**v1.4** is the first release aligned with the 7-bucket taxonomy — session artifacts are routed to `decisions/`, `runbooks/`, `analysis/`, `references/`, `reviews/`, `handoffs/`, `deliverables/` rather than dumped into a single handoff doc.

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

**Claude Code (plugin install — recommended):**
```bash
# Add the marketplace, then install the plugin
claude plugin marketplace add wan-huiyan/session-handoff
claude plugin install session-handoff@wan-huiyan-session-handoff
```

**Claude Code (git clone):**
```bash
git clone https://github.com/wan-huiyan/session-handoff.git ~/.claude/skills/session-handoff
```

**Cursor** (2.4+):
```bash
# Per-project rule (most reliable)
mkdir -p .cursor/rules
# Copy plugins/session-handoff/SKILL.md content into .cursor/rules/session-handoff.mdc with alwaysApply: true

# Or via npx skills CLI
npx skills add wan-huiyan/session-handoff --global
```

## What You Get

Every handoff dispatches session output across the 7 canonical buckets (rich sessions touch 3-5 of them):

| Bucket | Populated when the session... |
|---|---|
| **`docs/decisions/`** | Made an architectural or methodological choice (ADRs) |
| **`docs/runbooks/`** | Created/updated an operational procedure (retrain, rerun, QA) |
| **`docs/analysis/`** | Produced findings, investigations, diagnostics |
| **`docs/references/`** | Updated schemas, data dictionaries, project conventions |
| **`docs/reviews/`** | Produced review-panel or audit output |
| **`docs/handoffs/`** | **Always** — the session handoff doc + next-session prompt (+ parallel prompts) |
| **`docs/deliverables/`** | Produced an external-facing artifact (client draft, published output, slides) |

Plus:

| Artifact | Description |
|---|---|
| **Lessons update** | Non-obvious debugging patterns and user corrections captured |
| **Memory files** | New feedback/reference files created or updated |
| **Future plan** | Updated with completed items and newly discovered work |
| **Sessions archive** | Running log of all sessions with dates, outcomes, and bucket footprint |
| **PR (committed + pushed)** | All session work committed to a feature branch, pushed, and a PR created (optionally merged) |
| **Next session prompt** | Paste-ready prompt with full context to resume immediately |
| **Doc-freshness reverse-lint** | Invokes [doc-freshness-reverse-lint](https://github.com/wan-huiyan/claude-ecosystem-hygiene/tree/main/plugins/doc-freshness-reverse-lint) against lessons/feedback touched this session and surfaces candidate stale docs in the handoff |
| **Consolidated plan** | *(when 3+ handoffs exist)* Single source of truth with decision supersession, gap analysis, and PR reconciliation |

## Typical Ad-Hoc vs With Skill

| | Ad-hoc wrap-up | With session-handoff |
|---|---|---|
| Knowledge capture | Mental notes, maybe a quick message | Structured handoff doc with decisions table |
| Lessons learned | Lost when context window resets | Written to persistent memory files |
| Next session start | Re-read code, reconstruct context | Paste the prompt, start immediately |
| Parallel streams | Forgotten | Separate prompts for each work stream |
| Git workflow | Uncommitted changes left behind | Committed, pushed, PR created and optionally merged |
| Memory hygiene | Skipped | Automatic check for orphaned files |
| After 5 parallel sessions | Cross-reference 5 handoff docs manually | One consolidated plan with superseded decisions resolved |

## How It Works

| Phase | Steps | What happens |
|---|---|---|
| **1. Capture** | 1-4 | Scan git log, capture lessons, collect session artifacts for bucket triage |
| **2. Dispatch** | 5-16 | Route session output to the 7 canonical buckets (decisions/runbooks/analysis/references/reviews/handoffs/deliverables), then propagate to future plan, sessions archive, MEMORY.md |
| **3. Prepare** | 17-18 | Write next-session prompt(s) for all work streams |
| **4. Commit, PR, Verify** | 19-25 | Commit code + docs, push branch, create PR, optionally merge, memory hygiene check, **doc-freshness reverse-lint** |
| **5. Consolidate** | 26-30 | *(conditional)* Merge handoffs into single plan, track decision supersession, identify gaps |

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
- [ ] All changes committed, pushed, and PR created
- [ ] Next-session prompt is paste-ready (no "see above" references)
- [ ] ADR numbers checked for duplicates
- [ ] (If consolidating) Every PR/branch claim verified against current state
- [ ] (If consolidating) Decision supersession timeline is complete

</details>

## Related Skills

- **[memory-hygiene](https://github.com/wan-huiyan/memory-hygiene)** v3.1+ — Source of truth for the 7-bucket `docs/` taxonomy. Deep memory cleanup + `docs/` taxonomy audit/migration beyond what session-handoff does in-line.
- **[doc-freshness-reverse-lint](https://github.com/wan-huiyan/claude-ecosystem-hygiene/tree/main/plugins/doc-freshness-reverse-lint)** — Invoked automatically in Phase 4 step 24. Catches stale normative guidance in project docs after lessons/feedback updates. Falls back gracefully if not installed.
- **[successor-handoff](https://github.com/wan-huiyan/context-baton/tree/master/plugins/successor-handoff)** — Mid-run agent-to-agent handoff for long autonomous workflows. Pairs with session-handoff in the context-baton bundle.

## Version History

- **1.4.0** — Aligned with [memory-hygiene v3.1](https://github.com/wan-huiyan/memory-hygiene/pull/3) 7-bucket `docs/` taxonomy. New Phase 2 dispatches session output across `decisions/runbooks/analysis/references/reviews/handoffs/deliverables` instead of a single handoff file. Phase 4 adds a mandatory doc-freshness reverse-lint verify step.
- **1.3.0** — Phase 4 now includes explicit commit, push, PR creation, and optional merge steps. Previously just said "commit and push any stragglers" which was too vague.
- **1.2.0** — Plugin packaging fix: restructured to canonical `plugins/<name>/` layout.
- **1.1.0** — Merged session-handoff-consolidator as Phase 5 (conditional consolidation). Added edge case handling, anti-patterns section, improved triggers.
- **1.0.0** — Initial release. 4-phase checklist with 15 steps.

## License

MIT

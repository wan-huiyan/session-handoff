---
name: session-handoff
description: End-of-session handoff that captures all knowledge, updates all documentation, and prepares prompts for the next session. Use when wrapping up a work session.
version: 1.0.0
triggers:
  - "wrap up"
  - "session handoff"
  - "end of session"
  - "create handoff"
  - "hand over"
  - "write handoff"
---

# Session Handoff

Comprehensive end-of-session knowledge capture. Ensures nothing is lost between sessions.

## When to use
- End of any non-trivial work session (3+ tasks completed)
- User says "wrap up", "hand over", "create handoff", or similar
- Before context window approaches limits

## The Checklist (execute in order)

### Phase 1: Capture (what happened)

1. **Scan git log** for all commits this session:
   ```bash
   git log --oneline --since="today" | head -30
   ```

2. **Write handoff doc** -> `docs/handoffs/session_N_handoff.md`
   - Section 1: What was completed (with specifics — PRs, test counts, key metrics)
   - Section 2: What remains (prioritised, with file pointers)
   - Section 3: Key decisions (table: Decision | Resolution | Rationale)
   - Section 4: Files modified (table)
   - Section 5: Branch status

3. **Scan for missed lessons** — review the session for:
   - Debugging that required non-obvious investigation
   - Bugs with root causes worth documenting
   - Patterns that would help in future similar situations
   - User corrections that should become rules
   Add to `memory/lessons.md` with sequential numbering.

4. **Create/update memory feedback files** for significant findings:
   - New feedback files for major discoveries (`feedback_*.md`)
   - Update `reference_*.md` if project constants changed
   - Update architectural decision records with new decisions

### Phase 2: Update (propagate changes)

5. **Update future plan** -> `docs/plans/future_sessions_plan.md`
   - Mark completed items as DONE
   - Add new items discovered during session
   - Update status of in-progress items

6. **Update roadmap** (if it exists)

7. **Update sessions archive** -> `memory/sessions_archive.md`
   - Add entry with session number, date, one-line summary, key outcomes

8. **Update MEMORY.md index**
   - Add new memory files
   - Update lesson count
   - Add session reference

9. **Create ADRs** for significant architectural/methodological decisions
   - `docs/decisions/NNNN-kebab-case.md`
   - Check for duplicate ADR numbers first

### Phase 3: Prepare (next session)

10. **Write next session prompt** -> `docs/handoffs/session_N+1_prompt.md`
    - Key context (what's done, what's blocked)
    - Start files to read
    - Priority tasks with specific instructions
    - Research context

11. **Write any additional prompts** for parallel work streams (e.g., cleanup, different feature)

### Phase 4: Verify (nothing lost)

12. **Check for uncommitted changes:**
    ```bash
    git status --short
    git diff --name-only
    git log --oneline origin/BRANCH..HEAD
    ```

13. **Commit and push** any stragglers

14. **Quick memory hygiene check:**
    - Any new memory files missing from MEMORY.md?
    - Lesson count accurate?
    - Any ADR number duplicates?

15. **Final confirmation** to user: list all artifacts produced

## Output format

Present a summary table at the end:

| Artifact | Status |
|---|---|
| Handoff doc | `docs/handoffs/session_N_handoff.md` |
| Lessons added | N new (total: M) |
| Memory files | N created/updated |
| ADRs | N new (NNNN-NNNN) |
| Future plan | Updated |
| Sessions archive | Updated |
| Next session prompt | `docs/handoffs/session_N+1_prompt.md` |
| Git status | All committed and pushed |

## Integration with session-handoff-consolidator

After 3+ handoff docs accumulate, use `/session-handoff-consolidator` to:
- Merge overlapping tasks across handoffs
- Detect superseded decisions (later session overrides earlier)
- Produce a single "start here" document
- Reconcile PR statuses and branch cleanup

## Auto-trigger hook (optional)

Add to `.claude/settings.json` to get a reminder when context is running low:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"import sys; sys.exit(0)\"",
        "timeout": 1000
      }]
    }]
  }
}
```

Note: Claude Code doesn't expose context-window size to hooks yet. For now, manually trigger `/session-handoff` when you notice responses getting shorter or the system starts compressing earlier messages.

## Tips
- Start with git log to jog memory about what happened
- Don't skip the "missed lessons" scan — debugging patterns are the most valuable lessons
- Check reference files and architectural decisions for staleness
- If the session had a critical bug, add it to project CLAUDE.md (not just lessons)
- The next session prompt should be paste-ready — include all context needed to start immediately
- After consolidating 5+ handoffs, archive older ones to reduce MEMORY.md bloat

## Example output

A completed handoff produces this structure:

```
docs/handoffs/
  session_12_handoff.md      # What happened, what remains
  session_13_prompt.md       # Paste-ready start prompt
  refactor_cleanup.md        # (if parallel streams exist)
```

Handoff doc sections:

```markdown
# Session 12 Handoff — Add user authentication flow

## Completed
- [x] OAuth2 integration (PR #15, 3 commits)
- [x] Token refresh middleware (42 tests pass)

## Remaining (prioritised)
1. **Rate limiting** — needs Redis config (ADR-0008)
2. **Session expiry UI** — stale mock data in fixtures

## Key Decisions
| Decision | Resolution | Rationale |
|---|---|---|
| Token storage | httpOnly cookies | XSS protection vs localStorage |

## Branch Status
- `feature/auth-flow` — 4 commits ahead of main, ready for PR
```

## Composability

### Input / Output Contract

**Input:** Invoked at end of a work session. Reads git log, memory files, and project structure.

**Output:** Handoff doc, updated memory/lessons, next session prompt, sessions archive entry,
and ADRs. All files are committed and pushed.

### Dependencies

- Requires `git` for commit history and status
- Works with any project structure that uses `docs/` and `memory/` directories
- Optional: `session-handoff-consolidator` for merging accumulated handoffs

### Scope Boundaries

- **Use this skill when** wrapping up a work session
- **Do NOT use for** mid-session progress updates (just use git commits)
- **Hand off to** `session-handoff-consolidator` when 3+ handoffs accumulate

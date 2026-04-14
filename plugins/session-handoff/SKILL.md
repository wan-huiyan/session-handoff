---
name: session-handoff
description: >
  End-of-session handoff that captures all knowledge, updates documentation, and
  prepares prompts for the next session. Includes cross-session consolidation when
  multiple handoffs accumulate. Use when wrapping up a work session or when you need
  a single source of truth after parallel sessions.
version: 1.3.0
triggers:
  - "wrap up"
  - "session handoff"
  - "end of session"
  - "create handoff"
  - "hand over"
  - "write handoff"
  - "consolidate"
  - "consolidate handoffs"
  - "what's the current state"
  - "start here document"
---

# Session Handoff

Comprehensive end-of-session knowledge capture with built-in cross-session
consolidation. Ensures nothing is lost between sessions and produces a single
source of truth when multiple handoffs accumulate.

## When to use

- End of any non-trivial work session (3+ tasks completed)
- User says "wrap up", "hand over", "create handoff", or similar
- Before context window approaches limits
- After parallel sessions complete and you need one "start here" document
- User says "consolidate", "what's the current state"

## Edge cases

- **No git repo:** Skip git log and branch status steps. Note this in the handoff doc.
- **No `memory/` directory:** Create it. Initialize `lessons.md` and `sessions_archive.md`.
- **No `docs/` directory:** Create `docs/handoffs/` and `docs/plans/`.
- **First session (no prior handoffs):** Skip consolidation. Write session_1_handoff.md.
- **Single handoff exists:** Skip consolidation — it only adds value with 3+ handoffs.
- **Handoff docs use different naming:** Scan for `session*handoff*` and `*_handoff.md` patterns.

## The Checklist (execute in order)

### Phase 1: Capture (what happened)

1. **Scan git log** for all commits this session:
   ```bash
   git log --oneline --since="today" | head -30
   ```

2. **Write handoff doc** -> `docs/handoffs/session_N_handoff.md`
   - Section 1: What was completed (with specifics — PRs, test counts, key metrics)
   - Section 2: What remains (prioritised, with file pointers)
   - Section 3: Blockers & open issues (what's stuck, what's waiting on external input, what failed)
   - Section 4: Key decisions (table: Decision | Resolution | Rationale)
   - Section 5: Files modified (table)
   - Section 6: Branch status

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

11. **Write parallel session prompts** when upcoming work can be split into independent streams

    **When to split:** If the next session's scope contains 2+ tasks with **zero file overlap**, split
    them into separate prompts that can run simultaneously on separate branches.

    **File overlap check:** For each task, list the files it will modify. If the sets are disjoint
    (e.g., `_feature_common/` + `dataform/` vs `cr_client_dashboard/` only), they're safe to parallelize.

    **Naming convention:** `session_N+1_prompt.md` (primary) + `session_N+1b_[topic]_prompt.md` (parallel).
    Use a short descriptive suffix like `_insight_card_redesign` or `_cleanup`.

    **Each parallel prompt must include:**
    - Its own branch name (e.g., `feat/s71-distance-v6` vs `feat/s71b-insight-redesign`)
    - A "Parallel session" section naming the other stream + confirming no file overlap
    - Any shared prerequisites (e.g., "merge PR #N first, then branch from main")
    - Its own guardrails (test count, deploy restrictions)

    **Skip splitting when:**
    - Tasks share files or have ordering dependencies
    - One task is trivially small (< 15 min) — just sequence it
    - The user hasn't expressed interest in parallel execution

### Phase 4: Commit, PR, and verify (nothing lost)

12. **Check for uncommitted changes:**
    ```bash
    git status --short
    git diff --name-only
    git log --oneline origin/BRANCH..HEAD
    ```

13. **Commit all session work** — stage and commit in logical groups:
    - **Code changes first:** feature code, bug fixes, tests (one commit with descriptive message)
    - **Docs second:** handoff doc, next-session prompt, plan updates, lessons (separate commit)
    - If the session already has multiple commits on a feature branch, add docs as a new commit on the same branch.
    - If uncommitted work is on `main`, create a feature branch first: `git checkout -b feat/sN-description`

14. **Push and create PR:**
    ```bash
    git push -u origin <branch-name>
    gh pr create --title "feat(sN): <summary>" --body "<PR body with summary + test plan>"
    ```
    - PR body should include: summary bullets, test plan checklist, line/file counts
    - If the session had no code changes (docs-only), use `docs(sN):` prefix instead of `feat(sN):`

15. **Merge PR** (if appropriate):
    - If the user asks to merge: `gh pr merge <number> --squash`
    - If the user doesn't ask: note in the summary table that the PR is open and ready for review
    - After merge: `git checkout main && git pull` to sync local main
    - Update the next-session prompt to note the PR is merged (remove "merge PR #N" from prerequisites)

16. **Quick memory hygiene check:**
    - Any new memory files missing from MEMORY.md?
    - Lesson count accurate?
    - Any ADR number duplicates?

17. **Final confirmation** to user: list all artifacts produced

### Phase 5: Consolidate (when 3+ handoffs exist)

This phase runs automatically when 3+ handoff docs are detected, or when the user
explicitly asks to consolidate. It merges overlapping information from parallel
sessions into a single authoritative plan.

16. **Gather all sources** — read in parallel:
    - All handoff docs (`docs/handoffs/session*_handoff.md`)
    - PR status (`gh pr list --state all --limit 20 --json number,title,state,mergedAt`)
    - Memory files (MEMORY.md, sessions_archive, lessons)
    - Any status/findings docs

17. **Track decision supersession** — build a timeline across sessions:
    - Mark each decision as **OPEN**, **RESOLVED**, or **SUPERSEDED**
    - For superseded decisions, note which later session reversed it and why
    - Use strikethrough + resolution notes for resolved items:
      ```
      ~~Token storage in localStorage?~~ RESOLVED (Session 5). httpOnly cookies for XSS protection.
      ```

18. **Map experiments and identify gaps** — cross-check every "What Needs To Happen Next"
    section from every handoff against what actually happened:
    - Promised work that was never started
    - Planned validations that were skipped
    - Integration items that were deferred and forgotten
    - Branch cleanup that accumulated across sessions

19. **Write consolidated plan** -> `docs/plans/future_sessions_plan.md`
    Structure:
    ```markdown
    # Consolidated Plan for Future Sessions

    ## Current State Summary
    ### Merged to main (PR table with outcomes)
    ### Open work (PRs, branches)
    ### Key findings (experiments, discoveries)

    ## Priority Actions (P1-PN)
    (Each with: what, why, dependencies, experiment plan if applicable)

    ## Branch Cleanup (table with action per branch)

    ## Decision Queue
    ### Open decisions (numbered, with blockers)
    ### Resolved decisions (strikethrough, with rationale)
    ```

20. **Verify all claims are current** — for each claim in the consolidated plan:
    - Is the PR status current? (`gh pr view N --json state`)
    - Are branch references still valid? (`git branch -a`)
    - Have any deferred items been completed without updating the plan?

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
| Consolidated plan | (if Phase 5 ran) `docs/plans/future_sessions_plan.md` |
| PR | `#N` — merged / open for review |
| Git status | All committed and pushed |

## Anti-patterns

- **Don't concatenate handoff docs** — the value of consolidation is resolving conflicts and surfacing gaps, not appending
- **Don't assume handoff docs are current** — check git/PR status for every claim
- **Don't keep resolved decisions as open** — clutters the decision queue
- **Don't hardcode test counts or line counts** — they go stale immediately; use "as of PR #N" instead
- **Don't skip the lessons scan** — debugging patterns are the most valuable long-term knowledge
- **Don't write "see above" in next-session prompts** — they must be paste-ready with full context

## Tips

- Start with git log to jog memory about what happened
- Check reference files and architectural decisions for staleness
- If the session had a critical bug, add it to project CLAUDE.md (not just lessons)
- The next session prompt should be paste-ready — include all context needed to start immediately
- After consolidation, archive older handoff docs to reduce clutter
- The consolidated plan is a living document — update it when new sessions complete

## Example output

A completed handoff produces this structure:

```
docs/handoffs/
  session_12_handoff.md      # What happened, what remains
  session_13_prompt.md       # Primary next-session prompt
  session_13b_auth_cleanup_prompt.md  # Parallel stream (zero file overlap)

docs/plans/
  future_sessions_plan.md    # (if Phase 5 ran) single source of truth
```

Parallel prompt example (`session_13b_auth_cleanup_prompt.md`):
```markdown
# Session 13b — Auth Token Cleanup (Parallel)
**Branch:** `feat/s13b-auth-cleanup` (from main after PR #15 merge)

## Parallel session
S13 (rate limiting) runs on `feat/s13-rate-limiting`.
**No file overlap** — this session touches `auth/tokens/` only;
S13 touches `middleware/` + `config/`.
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

## Blockers & Open Issues
- **Redis not provisioned** — rate limiting blocked until infra team sets up Redis (asked in #ops-requests)
- **CI flake on auth tests** — intermittent timeout in `test_token_refresh`, not related to our changes

## Key Decisions
| Decision | Resolution | Rationale |
|---|---|---|
| Token storage | httpOnly cookies | XSS protection vs localStorage |

## Branch Status
- `feature/auth-flow` — 4 commits ahead of main, ready for PR
```

Decision supersession example (from consolidated plan):

```markdown
## Decision Queue

1. **Should we add WebSocket support?** — OPEN, blocked on load testing results
2. ~~**Defer rate limiting?**~~ RESOLVED (Session 8). Implemented in PR #22 after abuse incident.
3. ~~**localStorage for tokens?**~~ SUPERSEDED (Session 5 reversed Session 3). httpOnly cookies chosen for XSS protection.
```

## Composability

### Input / Output Contract

**Input:** Invoked at end of a work session. Reads git log, memory files, and project structure.
For consolidation: reads all existing handoff docs and validates against git/GitHub state.

**Output:** Handoff doc, updated memory/lessons, next session prompt, sessions archive entry,
ADRs, and optionally a consolidated plan. All files are committed and pushed.

### Dependencies

- Requires `git` for commit history and status
- Requires `gh` CLI for PR status checks (gracefully degrades without it)
- Works with any project structure that uses `docs/` and `memory/` directories (creates them if missing)

### Scope Boundaries

- **Use this skill when** wrapping up a work session or consolidating after parallel sessions
- **Do NOT use for** mid-session progress updates (just use git commits)
- **Hand off to** `memory-hygiene` for deep memory cleanup beyond what Phase 4 covers

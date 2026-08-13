# session-handoff

End-of-session handoff that captures all knowledge, **dispatches session output across the canonical 7-bucket `docs/` taxonomy** (aligned with [memory-hygiene v3.3](https://github.com/wan-huiyan/memory-hygiene)), and prepares paste-ready prompts for the next session. Includes a built-in **label audit** (Phase 0), cross-session consolidation when multiple handoffs accumulate, a mandatory **doc-freshness reverse-lint + skill-freshness audit** that catches stale normative guidance, **future-to-do GitHub issue emission**, and a closing **user-facing live-dashboard recap** for the chat.

**v1.18** is the current release — makes the Phase 4 reverse-lint actually run (it was dead on plugin-scope installs and scanned zero files everywhere else, while reporting "clean"), moves the step into a bundled, tested `reverse_lint_step.sh`, adds `find_own_script.sh` and `resolve_dep.sh` so bundled and sibling-plugin scripts resolve at all three install roots, and extends the skill-freshness audit to the nested plugin layout it had been skipping. **v1.13** added the review-findings audit (handoff §7 table + step 24d merge into the usage record), hardened subagent-usage verification (including the unit-mismatch variant: a non-zero scalar can still be ~2× off the itemized truth), a new-model rate-table caveat, next-prompt gating (write one only when a next action is recommended), and docs-only handoff-PR auto-merge — on top of the v1.9 bucket-aware dispatch.

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
| **Label audit (Phase 0)** | Blocks the handoff if it ships code→human label tables (Salesforce statuses, HTTP codes, enums) without inline `[verified: path:line]` or `[HYPOTHESIS]` tags — prevents fabricated semantic labels from propagating to the next session |
| **Lessons update** | Non-obvious debugging patterns and user corrections captured |
| **Memory files** | New feedback/reference files created or updated |
| **Future plan** | Updated with completed items and newly discovered work |
| **Sessions archive** | Running log of all sessions with dates, outcomes, and bucket footprint |
| **PR (committed + pushed)** | All session work committed to a feature branch, pushed, and a PR created (optionally merged) |
| **Next session prompt** | Paste-ready prompt with full context to resume immediately |
| **Doc-freshness reverse-lint** | Invokes [doc-freshness-reverse-lint](https://github.com/wan-huiyan/claude-ecosystem-hygiene/tree/main/plugins/doc-freshness-reverse-lint) against lessons/feedback touched this session and surfaces candidate stale docs in the handoff |
| **Skill-freshness audit** | When a `SKILL.md` is edited this session, runs an audit against project docs/CLAUDE.md to surface guidance that contradicts the new skill behavior |
| **Future-to-do GitHub issues** | Each follow-up item in the future-to-do plan is drafted as a `gh issue create` payload, shown for review, then filed — so action doesn't depend on a future session re-reading the handoff |
| **Live-dashboard recap (Phase 6)** | Chat-only, user-facing summary translating shipped PRs into what the user will *see* in the product next time they open it — grouped by venue, not by PR |
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
| Stale project docs after a lesson update | No one notices for weeks | Reverse-lint surfaces candidates in the handoff |
| Follow-up items | Trapped inside a doc no one reads | Filed as GitHub issues with full context |
| User-visible impact | "We shipped 4 PRs" | Per-venue before/after the user will actually see |
| After 5 parallel sessions | Cross-reference 5 handoff docs manually | One consolidated plan with superseded decisions resolved |

## How It Works

| Phase | Steps | What happens |
|---|---|---|
| **0. Label audit** | — | Block the handoff if it contains code→human label tables without `[verified: path:line]` or `[HYPOTHESIS]` tags. Escape hatch via frontmatter for retrospective references. |
| **1. Capture** | 1-4 | Scan git log, capture lessons, collect session artifacts for bucket triage |
| **2. Dispatch** | 5-16 | Route session output to the 7 canonical buckets (decisions/runbooks/analysis/references/reviews/handoffs/deliverables), then propagate to future plan, sessions archive, MEMORY.md |
| **3. Prepare** | 17-18 | Write next-session prompt(s) for all work streams |
| **4. Commit, PR, verify** | 19-25 | Commit code + docs, push branch, create PR, optionally merge, memory hygiene check, **doc-freshness reverse-lint**, **skill-freshness audit**, **emit future-to-do items as GitHub issues** |
| **5. Consolidate** | 26-30 | *(conditional)* Merge handoffs into single plan, track decision supersession, identify gaps |
| **6. Live-dashboard recap** | 31-35 | *(chat output, not a file)* User-facing "what you'll see in the product" summary grouped by venue |

### When does consolidation run?

Phase 5 triggers automatically when 3+ handoff docs exist in `docs/handoffs/`, or when you explicitly ask to consolidate. It:

- **Tracks decision supersession** — marks decisions as OPEN, RESOLVED, or SUPERSEDED across sessions
- **Validates claims** — checks every PR/branch reference against actual git/GitHub state
- **Identifies gaps** — cross-checks "what needs to happen next" against what actually happened
- **Produces one plan** — `docs/plans/future_sessions_plan.md` that a cold-start session can read without touching any other handoff doc

### Why Phase 6 (live-dashboard recap)?

Handoff docs are written for *Claude in a future session* — dense, technical, complete. The user reading the chat needs a different register: what changed, where they'll notice it, what to verify themselves. Without Phase 6, the user has to read the handoff doc or click through 4-8 PRs to know what changed in their product. Phase 6 closes that loop in conversational chat output.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| 7-phase sequential checklist | Ensures nothing is skipped; each phase builds on the previous |
| Phase 0 label audit (blocking with escape hatch) | Author-side gate — false positives cost 30s of human ack, false negatives cost a fabricated label shipping to a client. The asymmetry is by design. |
| Consolidation as Phase 5 (not separate skill) | Reduces cognitive overhead — one skill handles the full handoff lifecycle |
| Conditional consolidation (3+ threshold) | Avoids unnecessary overhead for simple linear session sequences |
| Phase 6 as chat-only (no file) | The recap's audience is the *human* closing the session — it's release-notes register, not handoff register |
| GitHub issues for future-to-do items | Filing each follow-up closes the loop on "will the next session actually act on this?" — issues persist outside the handoff doc |
| Strikethrough for resolved decisions | Visual scanning — instantly see what's decided vs open |
| Paste-ready next-session prompts | Eliminates "see above" references that break across context windows |

## Limitations

- Context usage is visible in Claude Code (`/context`, the statusline's context indicator) — but this skill does not auto-fire on a context threshold. End-of-session capture is manually triggered by design: you decide when the session is "done". The opt-in SessionStart hook below closes the other half of the loop by auto-surfacing the previous session's handoff prompt at startup, and Claude Code's PreCompact/SessionEnd hooks are available if you want to build tighter automation yourself.
- Assumes `docs/` and `memory/` directory structure — creates them if missing, but works best when pre-existing
- Git-dependent for commit scanning and branch status (gracefully degrades without git)
- Requires `gh` CLI for PR status validation during consolidation and for future-to-do issue emission (skips those checks without it)
- Does not auto-trigger at session end — must be invoked explicitly
- Helper scripts (`find_own_script.sh`, `resolve_dep.sh`, `reverse_lint_step.sh`, `label_audit.py`, `session_metrics.py`, `skill_freshness_audit.py`, `sessionstart_handoff_context.py`) ship with the plugin in `plugins/session-handoff/scripts/`. They are resolved from **three** roots in order: `${CLAUDE_PLUGIN_ROOT}/scripts/`, then `~/.claude/skills/session-handoff/scripts/` (git-clone install), then `~/.claude/plugins/cache/*/session-handoff/*/scripts/` (plugin install, highest version). The third is not optional — a plugin install creates neither of the first two, and checking only those made every bundled script unreachable on a plugin-scope machine. `find_own_script.sh` performs that lookup; `resolve_dep.sh` does the same for a *sibling* plugin's script. If a script resolves at none of the three, that step logs the roots it tried and continues

## Automating the loop with hooks (opt-in)

The plugin ships a SessionStart hook script, `plugins/session-handoff/scripts/sessionstart_handoff_context.py`, that checks the project for the newest `docs/handoffs/session_*_prompt.md` and — if one exists — injects a short pointer into the new session's context so Claude reads the handoff prompt before starting work. If no prompt exists (or anything goes wrong), it emits nothing and exits 0, so it never blocks startup.

**This hook is NOT registered automatically** — installing the plugin does not change your hook configuration. To opt in, add this to your `~/.claude/settings.json` (or the project's `.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$HOME/.claude/skills/session-handoff/scripts/sessionstart_handoff_context.py\""
          }
        ]
      }
    ]
  }
}
```

The command above assumes the git-clone install path. For a plugin (marketplace) install, point the command at the script inside the installed plugin directory instead — or simply copy `sessionstart_handoff_context.py` somewhere stable and reference that path. The `startup|resume` matcher fires on new and resumed sessions but not on `/clear`; add `|clear` if you want the pointer after clears too.

<details>
<summary>Quality Checklist</summary>

The skill guarantees:
- [ ] Phase 0 label audit passed (or skipped via documented frontmatter)
- [ ] All commits since session start are accounted for
- [ ] Handoff doc has all 6 sections (completed, remaining, blockers, decisions, files, branch)
- [ ] Lessons scanned for non-obvious debugging patterns
- [ ] MEMORY.md index is consistent with memory files on disk
- [ ] All changes committed, pushed, and PR created
- [ ] Doc-freshness reverse-lint ran against this session's lesson/feedback edits
- [ ] Skill-freshness audit ran if any SKILL.md was edited
- [ ] Future-to-do follow-ups filed as GitHub issues
- [ ] Next-session prompt is paste-ready (no "see above" references)
- [ ] ADR numbers checked for duplicates
- [ ] Live-dashboard recap delivered in chat (or "internal-only" note)
- [ ] (If consolidating) Every PR/branch claim verified against current state
- [ ] (If consolidating) Decision supersession timeline is complete

</details>

## Development

Run the test suite (validates manifest/version consistency across `plugin.json`,
`marketplace.json`, `package.json`, and `SKILL.md` frontmatter):

```bash
npm test
```

`main` is **branch-protected**: changes land via pull request only, and the
`test-gate` status check must pass before merge (enforced for admins too — no direct
pushes). Solo flow:

```bash
git checkout -b fix/something
# …edit…
git push -u origin fix/something          # hook runs npm test first (see below)
gh pr create --fill
gh pr merge --squash --delete-branch --auto   # merges once test-gate is green
```

**Enable the local pre-push guard (recommended, once per clone):**

```bash
git config core.hooksPath .githooks
```

This makes `git push` run `npm test` first and **abort the push if it fails** — so a
malformed version (e.g. a `.1.9.1` leading-dot semver typo) or a cross-file version
drift fails fast on your machine instead of after you've opened a PR. It's the fast
local layer; branch protection is the authoritative server-side gate. Override the
hook in a genuine emergency with `git push --no-verify` (the server gate still applies).

## Related Skills

- **[memory-hygiene](https://github.com/wan-huiyan/memory-hygiene)** v3.3+ — Source of truth for the 7-bucket `docs/` taxonomy. Deep memory cleanup + `docs/` taxonomy audit/migration beyond what session-handoff does in-line.
- **[doc-freshness-reverse-lint](https://github.com/wan-huiyan/claude-ecosystem-hygiene/tree/main/plugins/doc-freshness-reverse-lint)** — Invoked automatically in Phase 4. Catches stale normative guidance in project docs after lessons/feedback updates. Resolved at **both** install roots (`~/.claude/skills/` and the plugin cache); if it resolves at neither, step 24 logs the roots it tried and the step is reported as **skipped**, never as clean.

## Version History

- **1.26.0** — **A staged lesson was invisible to the reverse-lint.** `reverse_lint_step.sh` collected files committed since `BASE`, modified but not staged, and untracked, but omitted the index-only set from `git diff --cached --name-only`. A newly created `lessons.md` that had already been staged therefore matched none of the three inputs, so the step reported `SKIPPED — no lessons/axioms/feedback files changed` without scanning it. The file collector now includes staged paths explicitly, and an end-to-end regression creates a repository, stages `lessons.md` without committing it, and proves the lint reports exactly one file scanned.
- **1.25.0** — **Two steps that reported success having done nothing — the exact failure this skill exists to catch, in its own text.** (1) **Step 24c silently destroyed step 24d's work.** 24c writes the usage record with `>`, 24d then merges `review_findings` / `review_summary` into that same JSON and appends a table to the same `.md`, and 24c's own sanity-check tells you to "redirect its output over the fork's files" — so a refresh, which the numbers moving mid-session make the normal thing to do, replaced both files wholesale. Nothing warned. The record still had tokens, models and transcript counts; it just had no findings, and the cross-session roll-up they exist for was gone. On 2026-08-07 a session refreshed near the end to pick up later subagents and wiped **fifteen merged findings**, caught only by listing the JSON's top-level keys afterwards. 24c now names the overwrite, fixes the order (24c then 24d, never the reverse), **carries 24d's two fields across the refresh in the fence itself**, and ends by printing the top-level keys — the print is the verification, and `review_findings` must be in it. The Markdown table has no carry and must be re-appended by hand; that is said, not glossed. (2) **The skill-freshness audit passes without opening the file you edited.** Step 24b's audit scans the two roots a skill is *installed* under; a plugin skill's SOURCE — the marketplace checkout or clone that **step 24e explicitly tells you to edit** — is a third place it never looks. Measured on the author's machine: 247 skills audited, `session-handoff` reported from the plugin cache at **1.20.0**, zero results from any `marketplaces/` path, while the repo being edited was at **1.21.0**. It passed, on the wrong file, one version behind. Two more reasons the pass means little: the trigger greps `git diff` in the CURRENT repo, so editing a plugin skill in a separate repo never fires it; and the cache copy's age comes from `mtime`, the install time, so it reads `0d` regardless of contents. 24b now states its scope, gives the direct check that closes the gap (version bumped in every place that repo records it — verified by grep, not memory, five places here — and that repo's own gates run), and states the general form: **an audit that reports "all clean" without naming what it examined has told you nothing.** Prefer a check that prints its scope and compare that scope against what you changed; `--human` prints its roots on line one. **And a third of the same shape, found by running this repo's own gate to ship the other two: the pre-push hook was corrupting the repo it guards.** Git exports `GIT_DIR` / `GIT_INDEX_FILE` into every hook, and a child's `cwd` does not override an inherited `GIT_DIR` — so `npm test` run from `.githooks/pre-push` handed those variables to the suite's fixture repos, whose `git init` / `config` / `commit` then wrote into the **real** repo. One green push left `core.bare=true`, `user.name=t`, the pushed branch ref pointing at a fixture commit, and an empty index; `git status` afterwards answered `fatal: this operation must be run in a work tree`. Nothing was lost — the push succeeded and the commit was intact on `origin` — but the tests were green, the hook printed "tests passed", and the damage was invisible until the next git command. The fixture helper now scrubs every `GIT_*` variable before spawning git, and the hook unsets them as a second layer; reproduced against a throwaway repo and confirmed fixed against the same.

- **1.24.0** — **The step that verifies a rebuilt docs branch was comparing the wrong two things, and cried wolf twice in one afternoon.** Step 20's rebuild path (`git reset --hard origin/main` + cherry-pick, for when the feature branch was already squash-merged) ended with `git diff --stat origin/main..HEAD` to confirm only the docs files remained. **Two dots compare tip to tip**, so every file `main` gained after you branched renders as a deletion *you* appear to be making. That is correct only in the instant of the hard reset and wrong the moment a parallel session merges before you push — which is the exact situation the step exists for. In the repo where this was found `main` moved four times in two days; the line fired spuriously **twice**, each time triggering an investigation into a data loss that had not happened, one of them large enough to get its own exploration prompt written for it. Verified against GitHub this session: for a real PR, GitHub reported 5 files / 219 insertions / 16 deletions and `git diff --stat <base>...<head>` reproduced it exactly, while the two-dot form returned a different file set and invented deletions. Now three dots, which diff from the fork point and answer *what does this branch propose*. Alongside it, a second line the step never had: `git diff --diff-filter=D --name-only origin/main...HEAD`, **which must be empty.** The hazard it catches is real and was reproduced here — a branch whose *tree* is stale (from `git reset --soft`, or an old worktree committed with `git add -A`) still passes `git merge-base --is-ancestor`, still reports 0 commits behind, and a fast-forward push then replaces `main`'s tree wholesale; in the source repo one such PR deleted a 322-line client-facing file while describing itself as a copy fix, and a follow-up PR restored it 17 minutes later. Also hardened, deliberately: the two `"$BASE"..HEAD` ranges in step 24b and `reverse_lint_step.sh`. `BASE` is contractually a SHA on the branch's own history — where that holds, two dots and three dots are byte-identical — but nothing enforces it, and step 20's own rebuild destroys the ancestor property outright. Both now use three dots and both gain a `git merge-base` guard, so a `BASE` from an unrelated history reports **SKIPPED** with its reason instead of letting an erroring diff read as "nothing changed". Left alone on purpose: `git log --oneline origin/BRANCH..HEAD` in step 19 — in `git log`, two dots mean "commits on B not on A", which is exactly what "my unpushed commits" wants; three dots there would be the symmetric difference and wrong.
- **1.23.0** — **A prompt INDEX row rots on a different clock from the page it points at, and the row is what gets read first.** Step 26a makes the next prompt reachable; nothing made it *true*. Many repos keep a one-row-per-prompt index whose rows carry a summary and a status — two copies of the same claim, maintained by different sessions at different times, with nothing forcing agreement. Measured 2026-08-07, **both rows on the same index were wrong in opposite directions while both prompt pages were current**: one said *"what is left is four files and five ledger entries, verified absent from `main`"* when all four were present and the page's own foot already said *"the file restoration is finished"* — so it **advertised finished work as the remaining work** and the actual remainder went unadvertised; the other said *"expect `main` to be red for reasons of its own (#839)"* when that issue was closed and `main` measured green. **The second is the dangerous direction**, because a stale "expect it to be broken" does not merely misinform, it disables a check — the reader has been pre-authorised to ignore red. New **step 25d** sits beside 25c (which checks your own work survived) and checks the pointer to the NEXT work: re-derive the row's headline claim rather than re-reading it, check the row agrees with its own page (a page corrected at its foot while the row keeps the superseded summary is the normal failure), and grep the figure across the repo because the same sentence is usually pasted into a ledger entry too — it was. It also covers closing the row when you close the item (a row still marked live for a merged PR sends the next session to a deleted branch) and one structural check: **is the page's remaining work at the TOP?** A prompt that grows by appending dated corrections becomes a long finished job with the live work in a coda after the archive, and a reader working top-down re-runs the completed part — measured at 200 lines of finished work ahead of a ten-line remainder.
- **1.21.0** — **A green merge is not evidence your work survived it.** New **step 25c**, a third closing check beside 25a/25b and non-blankable like them: after the LAST merge of the session, verify your own work still exists on `main`. On 2026-08-07 a PR whose parent WAS current `main` — so every "am I behind?" check passed — deleted **59 files and 5,081 lines** already merged, belonging to four sessions, with no conflict and every gate green including the project's own validator. **One session reported its wrap-up complete while four of its files and six of its ledger entries were already deleted**, and did not find out for 3½ hours. No gate catches it because a deletion is a valid state of a file. Three passes, because each catches what the previous cannot: files exist · content survived (a file can exist and be rolled back) · **ledger TEXT, not just ids** — a task can survive by `id` while its `detail` is reverted to pre-session wording byte for byte, which no id check and no validator sees. Plus splice-never-revert recovery and the broadcast step, since losses are per-session and a wrapped session's are found by nobody.
- **1.20.0** — **The audit blocked the shape the skill itself prescribes, which taught authors to waive the whole file.** `label_audit.py` flagged the `P0`/`P1`/`P2`/`P3` column in §7's review-findings table — the exact table the skill's own template asks for — so every handoff carrying a review round hit a false positive on its first run. The documented response is the frontmatter escape hatch, and that is the problem: **a skip waives the ENTIRE file**, so a document reaching for it to clear one nuisance table also silently waives the real code legend further down. Severity grades are now **exempt in the scanner**: they are the author's own assignment, there is no external system to fabricate against, the row's description *is* the claim, and the disposition column already cites where it was fixed. Covers `P0`–`P9`, `SEV1`, `CRITICAL`/`BLOCKER`/`HIGH`/`MEDIUM`/`LOW`/`INFO`/`MAJOR`/`MINOR`/`TRIVIAL`/`NIT`. **Real legends still block** — the new fixture carries a severity table and a Salesforce code table in the same file and asserts both outcomes, and the test was confirmed to go red with the exemption removed. Also: **step 14 gains the terminating chip's ordering** — the last chip must name its own PR, which tempts you to predict the number; on 2026-08-07 a session wrote `846` and GitHub allocated **849**, three others having opened in between. A guessed chip is the worst kind of wrong, because it points at a real recently-merged PR belonging to someone else's work and the validator passes. Create, read the number, then `--amend`.
- **1.19.0** — **A skill improves itself, and the copy you run can be ahead of the copy you edit.** New **step 24e**: improve the skills you *used* this session, which is the half step 24b's freshness audit does not cover — a skill you have just executed end to end is a skill you have evidence about, and that evidence evaporates when the session closes. It carries an explicit do-not-edit-for-its-own-sake rule, because a skill that grows a paragraph per session becomes unreadable and unreadable is how steps get dropped. **The trap it documents cost this release its own first attempt:** the plugin *cache* copy of v1.18.0 was **53 lines longer** than the same version in this repo, and those 53 lines were step 17b in full — the owner's promptback preference, set 2026-08-06, present in no commit on any branch. Both copies declared `1.18.0`. Editing the source and publishing would have deleted it silently; 24e now requires `diff $SRC $CACHE` to be empty *before* you edit either, and a non-empty diff to be rescued as its own reviewable commit. Also: step 25a gains the two things the PR-to-card enumeration actually turns up — a PR orphaned by a session that already wrapped (attribute it on evidence, not on date) and the chip-fix PR needing its own chip, terminated in one PR rather than iterated; and step 24's reverse-lint now names the **benign SKIPPED** it reports in projects whose memory lives outside the repo, so it is read as neither clean nor broken.
- **1.18.0** — **The 1.17.0 fix reached two of five lookups.** v1.17.0 established that a plugin install creates neither `$CLAUDE_PLUGIN_ROOT` (usually unset in the shell a step runs in) nor `~/.claude/skills/session-handoff/`, and gave step 24 and one 24c fence a third root. Three lookups were left on two roots and therefore still dead on every plugin-scope machine: **Phase 0's label audit**, **step 24b's skill-freshness audit**, and the standalone `session_metrics.py` fence. Phase 0 is the one that mattered — it is the gate that blocks a handoff shipping unverified code→human label tables, and it had been silently skipping. Nothing failed, which is exactly why it shipped: the test suite asserted the fix existed in the fences it had been pointed at, not that every lookup had it. All five now resolve across all three roots, the standalone metrics fence is guarded before it runs, and a new lint fails the build if any `${CLAUDE_PLUGIN_ROOT:+…}` chain in any fence lacks a plugin-cache fallback — a rule about the shape of the code rather than about the places someone remembered to look.
- **1.17.0** — **A step that never ran was reported as clean, twice over.** Step 24's reverse-lint was dead on every plugin-scope install: it reached `doc-freshness-reverse-lint` through a hardcoded `~/.claude/skills/…` path, a root that only exists for personal-scope installs, so on a plugin install the lookup missed and the fallback logged `not installed`. A user read that log as proof the skill was absent and went hunting for it in old-laptop backups — it had been installed at v1.3.0 the whole time. Underneath that, the step scanned **zero files on every install regardless**, because `git diff --name-only HEAD~N..HEAD` shipped with `HEAD~N` as a literal: git exits 128 and the loop body never runs. Both failures ended at the same place — a summary table whose reverse-lint row offered only "Clean / N candidates", so *never ran* got written up as *clean*. Fixes: three new bundled scripts. `resolve_dep.sh` resolves a *sibling* plugin's script (`CLAUDE_PLUGIN_ROOT` cannot — it points at this plugin's own root), version-sorting on the version segment so a second marketplace can't make an older copy win. `find_own_script.sh` does the same for this plugin's OWN scripts across **three** roots — a first pass at this fix shipped a two-root bootstrap and so still reported SKIPPED on the very machine that reported the bug, because a plugin install creates neither `CLAUDE_PLUGIN_ROOT` nor `~/.claude/skills/session-handoff/`. `reverse_lint_step.sh` holds the step logic itself, so it can be executed by the test suite rather than only read; `BASE` must now be a real SHA and the step reports **skipped** when it isn't; the reverse-lint row became the fourth non-blankable row and enumerates `skipped: <reason>`; `skill_freshness_audit.py` had the identical single-root bug and now scans both, so plugin-scope skills are audited instead of silently returning nothing; and every "not installed" log line became "not found — tried &lt;paths&gt;", because a failed lookup is not evidence about install state. Tests now **execute** the resolver against fixture HOMEs rather than grepping SKILL.md for the right words — the previous text-only guard stayed green through a one-character `||`→`&&` edit that restored the original bug.

- **1.16.0** — **Naming the next-session prompt is not delivering it.** A session wrote a good prompt, committed it, listed it in the bucket table — and referred to it in the closing summary only as *"the S386 next-session prompt"*. The owner's reply: *"where's my next session prompt? I can't see the actual name to pass into a new session."* The user's very next action after a handoff is to paste a path into a fresh session; a nickname makes them grep `docs/handoffs/` for a filename the session already knew. New **step 26a** requires the repo-relative path in its own fenced block, `ls`-verified before printing, with rules for multiple prompts and for the no-prompt case — and a matching **non-blankable** output-table row. The skill already said prompts must be "paste-ready"; that was about the prompt's *contents*, and nothing said the same about its *path*. Found 2026-08-06.
- **1.15.0** — **Two closing checks, both added because a user had to ask for them.** A session presented a complete wrap-up; the owner asked *"is everything in the tracker, and would the next session know everything?"* and **both halves found a real gap.** Neither is visible from inside the artifacts you just wrote. **(a) PR-to-card enumeration** — the obvious failure is `prs: []`, but the one that survives every validator is a *plausible, non-empty* chip that is simply short: three of eight merged PRs were on no card, because a card cannot know about a PR that merged after it was written. **(b) Prompt cold-start** — a prompt can be flawlessly executable and still read as a trivial chore, because the reason it matters lives only in the author's head; you cannot judge whether it stands alone while holding the context it omits. Both rows are now non-blankable in the output table. Found 2026-08-05.
- **1.14.2** — **A fourth part that outlives the wrap-up: a tracker field mirroring LIVE state is a copy of something outside the repo, and nothing in the repo can check it.** No rebase, no validator and no diff sees it. DoodleRun's `meta.deployed_rev` read a revision two behind main while a merged, TestFlight-shipped, four-ways-verified feature was **unreachable in production** — the owner found it on his phone in one try. Check such fields against the thing itself, never against the repo, which agrees with itself by construction. General form: **a harness that stands in for a dependency proves your code handles a shape; only the dependency proves the shape arrives.** Found 2026-08-05.
- **1.14.1** — **Step 14 becomes the project-tracker step**, with a row in the wrap-up footprint table so it is a forcing function rather than a paragraph: if the repo keeps a hand-maintained tracker or ledger, its own header IS the checklist and every part of it gets done — including folding in phone-made overlay ticks and then CLEARING the overlay, and taking your session off any running board (nothing expires those: no heartbeat, no TTL). Carries the three parts that OUTLIVE the wrap-up and are therefore the ones that get skipped — the PR chip that cannot be written before the PR exists, pasted figures that a parallel session can rot inside an hour (a rebase resolves the text and tells you nothing about the values), and the successor task that falls due *because* you closed one. Plus: splice a machine-parseable ledger, never re-dump it. Owner's instruction, 2026-08-05.
  Also completes 1.14.0, which moved step 17 to ALWAYS and left two places behind. The Phase-3 routing table (§ "Where each artifact goes", row 6) still read *"next-session prompt only when there's a recommended next action"* and marked the filename *(conditional)*, so a session reading the table and not the step four hundred lines down got the old behaviour — the table is the part you read while dispatching. And 1.14.0 shipped with no Version History entry at all. Both fixed; the reversal is now stated in the table, in step 17 and here.
- **1.14.0** — **Preparing the next-session prompt is part of the handoff.** Step 17 changes from gated to ALWAYS, whenever there is any next work at all: a prompt that already exists is RE-READ against what the session actually learned and EDITED, never merely cited, because one written earlier in the same session was drafted before its later findings. Skipping is allowed only when you would recommend no concrete next task, and then it must be SAID in the handoff and the summary rather than left silent. Owner's instruction, 2026-08-04.
- **1.13.1** — Review-findings audit: handoff §7 table (finding · reviewer · disposition) + step 24d merge into the session usage record. Subagent-record verification replaces the "fixed in both tools" claim: always sanity-check against a recursive transcript count; a non-zero subagent scalar can still be ~2× off the itemized truth (unit mismatch) — prefer the bundled tokens-only recompute's record. New-model rate-table caveat (tokens canonical, fork dollars flagged). Next-session prompt gated on a real recommended action (step 17). Docs-only handoff PRs: review-agent pass then squash-merge (step 22). Squash-merged-branch docs-PR rebuild recipe (step 20). Cost examples stated as ratios (anonymization pass).
- **1.9.1** — Added a session usage-metrics step (step 24c): archives the session's `cctime` output as a structured record so handoffs carry token/cost accounting. Invokes the cctime fork by absolute path to avoid the upstream name-collision. Falls back gracefully if the fork isn't installed.
- **1.9.0** — Skill-freshness audit step (runs when any SKILL.md edited this session) + future-to-do GitHub issue emission (each follow-up filed via `gh issue create`) + memory-hygiene v3.3 alignment in the lead.
- **1.8.0** — Added the skill-freshness audit script wiring and tightened v3.3 references throughout the checklist.
- **1.7.0** — Phase 6: user-facing live-dashboard recap delivered as chat output (not a file). Translates shipped PRs into per-venue "what you'll see next time" summaries.
- **1.4.0** — Aligned with [memory-hygiene v3.1+](https://github.com/wan-huiyan/memory-hygiene/pull/3) 7-bucket `docs/` taxonomy. New Phase 2 dispatches session output across `decisions/runbooks/analysis/references/reviews/handoffs/deliverables` instead of a single handoff file. Phase 4 adds a mandatory doc-freshness reverse-lint verify step.
- **1.3.0** — Phase 4 now includes explicit commit, push, PR creation, and optional merge steps. Previously just said "commit and push any stragglers" which was too vague.
- **1.2.0** — Plugin packaging fix: restructured to canonical `plugins/<name>/` layout.
- **1.1.0** — Merged session-handoff-consolidator as Phase 5 (conditional consolidation). Added edge case handling, anti-patterns section, improved triggers.
- **1.0.0** — Initial release. 4-phase checklist with 15 steps.

## License

MIT

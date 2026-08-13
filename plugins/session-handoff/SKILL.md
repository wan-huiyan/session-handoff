---
name: session-handoff
description: "End-of-session handoff that captures session knowledge, dispatches output across the canonical 7-bucket docs/ taxonomy (decisions/runbooks/analysis/references/reviews/handoffs/deliverables — aligned with memory-hygiene v3.3), triggers a doc-freshness reverse-lint + skill-freshness audit to catch stale normative guidance, emits the future-to-do plan's follow-up items as GitHub issues, updates memory, and prepares next-session prompts. Use when: (1) user says 'wrap up', 'hand over', 'create handoff', 'end of session', 'write handoff', 'session handoff'; (2) non-trivial work session (3+ tasks) is ending; (3) context window is approaching limits; (4) user says 'consolidate', 'what's the current state', 'start here document' after parallel sessions; (5) the session produced artifacts that belong in more than one docs/ bucket (ADR + analysis + runbook + review). Includes cross-session consolidation when 3+ handoffs accumulate and a mandatory reverse-lint verify step against any lessons.md / feedback_*.md touched this session."
version: 1.26.0
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

# Session Handoff v1.22 — Bucket-aware + reverse-lint + skill-freshness + issue emission + review-findings audit + show-and-tell

Comprehensive end-of-session knowledge capture with built-in cross-session
consolidation. Ensures nothing is lost between sessions and produces a single
source of truth when multiple handoffs accumulate.

**v1.9 alignment with memory-hygiene v3.3**: session output is dispatched across
the canonical **7-bucket docs/ taxonomy** — not just `docs/handoffs/`. At the end of
the workflow, invokes `doc-freshness-reverse-lint` and a **skill-freshness audit**
against any memory or SKILL.md files touched this session to surface stale normative
guidance, and emits the future-to-do plan's follow-up items as **GitHub issues** so
nothing relies on a future session re-reading the handoff to act on them.

Counterpart skill: **memory-hygiene v3.3** cleans Claude's persistent memory +
audits project `docs/` against the same taxonomy. Run memory-hygiene after
10+ sessions or when `docs/` has drifted.

## When to use

- End of any non-trivial work session (3+ tasks completed)
- User says "wrap up", "hand over", "create handoff", or similar
- Before context window approaches limits
- After parallel sessions complete and you need one "start here" document
- User says "consolidate", "what's the current state"

## Canonical 7-bucket docs/ taxonomy (from memory-hygiene v3.3)

Session output is **dispatched** to the right bucket — not dumped into one handoff file.
A typical rich session produces artifacts in 3-5 of these 7 buckets simultaneously.

| # | Bucket | Write here when the session produced... | Filename convention |
|---|--------|------------------------------------------|---------------------|
| 1 | `docs/decisions/` | An architectural / methodological choice worth preserving (go/no-go, tradeoff, supersession) | `NNNN-kebab-case.md` (ADR — check for duplicate numbers first) |
| 2 | `docs/runbooks/` | A new rerun / retrain / operational procedure, or updated steps to an existing one | `<verb>_<noun>.md` (e.g. `retrain_propensity.md`, `rerun_guide.md`) |
| 3 | `docs/analysis/` | Findings, investigations, diagnostics, discovery write-ups, exploratory analyses | `analysis_<topic>.md`, `discovery_<topic>.md`, `findings_<topic>.md` |
| 4 | `docs/references/` | New/updated schema, data dictionary, API ref, project-convention doc | `<system>_reference.md`, `data_dictionary.md`, `<topic>_dictionary.md` |
| 5 | `docs/reviews/` | Review-panel output, peer review, audit report | `review_<topic>.md`, `<topic>_audit_report.md`, `next_stage_<topic>.md` |
| 6 | `docs/handoffs/` | **Handoff doc always**; next-session prompt **always, whenever there is any next work at all** — written or REFRESHED, never merely cited (Phase 3 step 17). Skip only when you would recommend no concrete next task, and then SAY so; optional parallel prompts | `session_N_handoff.md`, `session_N+1_prompt.md`, `session_N+1b_<topic>_prompt.md` |
| 7 | `docs/deliverables/` | External-facing artifact (client draft, published output, slide deck, PDF, XLSX) | Keep original extension; add a `.provenance.md` sibling if the artifact was generated |

**Reserved top-level file**: only `docs/README.md`. No other loose files at `docs/*`.

**Exclude from `docs/` entirely**: `__pycache__/`, `.py` scripts (belong in `scripts/`), `.DS_Store`.

If a session artifact doesn't fit any bucket, surface it to the user — don't invent an 8th bucket.

## Edge cases

- **No git repo:** Skip git log and branch status steps. Note this in the handoff doc.
- **No `memory/` directory:** Create it. Initialize `lessons.md` and `sessions_archive.md`.
- **No `docs/` directory:** Create `docs/handoffs/` and `docs/plans/`.
- **First session (no prior handoffs):** Skip consolidation. Write session_1_handoff.md.
- **Single handoff exists:** Skip consolidation — it only adds value with 3+ handoffs.
- **Handoff docs use different naming:** Scan for `session*handoff*` and `*_handoff.md` patterns.

## The Checklist (execute in order)

### Phase 0: Label audit (loose mode, blocking-with-escape-hatch)

Before emitting any handoff doc that contains code → human-label tables (e.g.
`AD — Accepted Fully` Salesforce status codes, HTTP-status legends, enum
descriptions), run the label audit. This is the **author-side gate** that
prevents the "predecessor handoff fabricates semantic labels" failure mode
(see `~/.claude/lessons.md` L-S109b-1 and `axioms.md` § Authoritative Labels).

**Run after Phase 1 Step 2 (handoff doc draft) and before any other phase.**

```bash
# Resolve the bundled script across ALL THREE roots. A plugin install creates neither
# of the first two: CLAUDE_PLUGIN_ROOT is often unset in the shell a step runs in, and
# ~/.claude/skills/session-handoff/ does not exist. Checking only two silently skipped
# this audit on every plugin-scope machine.
LABEL_AUDIT="${CLAUDE_PLUGIN_ROOT:+${CLAUDE_PLUGIN_ROOT}/scripts/label_audit.py}"
[ -f "$LABEL_AUDIT" ] || LABEL_AUDIT="$HOME/.claude/skills/session-handoff/scripts/label_audit.py"
[ -f "$LABEL_AUDIT" ] || LABEL_AUDIT="$(find -L "$HOME/.claude/plugins/cache" -mindepth 5 -maxdepth 5 \
    -path '*/session-handoff/*/scripts/label_audit.py' 2>/dev/null \
  | awk -F/ '{print $(NF-2)"\t"$0}' | sort -V -k1,1 | tail -1 | cut -f2-)"

python3 "$LABEL_AUDIT" docs/handoffs/session_N_handoff.md
```

If the script resolves at neither location, log "label audit: not found — tried
&lt;both paths&gt; — labels unverified" in the handoff doc and continue — never block the
handoff on missing tooling. Say "not found" (what you observed), not "not installed"
(what you inferred); see the naming rule in step 24.

**Behavior:**

- **Exit 0 (clean)** — no code-legend rows detected, OR every flagged row
  carries an inline tag. Continue.
- **Exit 1 (blocking — untagged rows)** — print the offending rows, then
  fix one of these ways before continuing:
  - Add `[verified: <repo-relative-path>:<line>]` after the description for
    every row whose label has been confirmed against an authoritative source
    (vendor doc, INFORMATION_SCHEMA, internal data dictionary derived from
    real probes). Cite the file + line that contains the verification.
  - Add `[HYPOTHESIS]` after the description for any row whose label is a
    guess, so the receiving session knows to re-probe.
  - If the table is a retrospective reference (e.g., quoting an old
    fabricated table to explain why the new system exists) and re-tagging is
    onerous, set frontmatter `label-audit-skipped: <reason>` to bypass.
- **Exit 2 (skipped via frontmatter)** — print the skip reason; the
  receiving session sees it and knows to treat ALL labels in this doc as
  unverified.

**The escape hatch is a load-bearing feature**, not a workaround. False
positives (e.g., a git-commit-hash table with 3-letter codes) cost 30s of
human ack to bypass; false negatives cost a fabricated label shipping to a
client. The asymmetry is by design.

**But keep the escape hatch RARE, or it stops meaning anything.** A frontmatter
skip waives the whole file, so a document that reaches for it to clear one
nuisance table also waives the real code legend eight sections down. That is
why §7's own severity column — `P0`/`P1`/`P2`/`P3`, `HIGH`/`MEDIUM`/`LOW`,
`SEV1` — is **exempt in the scanner** rather than left to the hatch: those are
grades the author assigned to their own findings, so there is no external
system to fabricate against, the row's description IS the claim, and the
disposition column already cites where it was fixed. Before this exemption the
skill's own prescribed handoff shape blocked every time (2026-08-07), which
taught authors to skip the file by reflex. **If you find yourself using the
hatch routinely, the pattern belongs in the scanner — say so rather than
normalising the waiver.**

**Run the same scanner against any next-session prompts you write in
Phase 3** (`session_N+1_prompt.md`, parallel prompts) — the receiving
session is downstream of these too.

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
   - Section 7 (**REQUIRED when a review panel or code-review agent ran this session** — `roundtable:agent-review-panel`, `/code-review`, `requesting-code-review`, or any reviewer subagent): **Review findings** — a table of every P0/P1/P2 the reviewers caught, **which reviewer caught each** (persona + speciality / VoltAgent `subagent_type`), and its disposition. This makes the cost of the review gate legible, shows whether the panel earned its keep, and — accumulated across sessions — reveals which perspectives reliably catch which bug classes (so future panels can be staffed deliberately). Use this shape:

     | Severity | Finding (one line) | Caught by (persona · speciality) | Disposition |
     |---|---|---|---|
     | P1 | Client `.j2` rendered new negative phrases as "inconclusive" — contradicted the headline | Correctness Hawk · `voltagent-qa-sec:code-reviewer` | Fixed `7ae73a0` |
     | P1 | `_mechanism_story` ungated by framing (gap #2) | Architecture Critic · `voltagent-qa-sec:architect-reviewer` | Fixed `7ae73a0` |
     | P2 | Sign-label bug: P(positive) mislabeled "probability of a negative effect" | Correctness Hawk · `voltagent-qa-sec:code-reviewer` | Fixed `7ae73a0` |
     | P3 | MIXED override is a 3rd behaviour change | Devil's Advocate · generic | Documented (accepted) |

     Rules: one row per finding the panel **raised** (not just the ones you fixed) — include `Documented`/`Rejected` dispositions so a deferred-but-real concern isn't lost. Cite the fixing commit/PR for `Fixed`. If a finding was caught by multiple reviewers, list the primary + "(+N concur)". If **no** review ran this session, omit the section entirely (don't fabricate a clean-bill row). Pull the data from the review report's Action Items table + `integration_log.jsonl` (disposition/epistemic label) when those exist — don't reconstruct from memory.

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

### Phase 2: Dispatch to the 7 canonical buckets

Before writing the handoff doc (Phase 1 step 2), triage everything the session produced and
decide which of the 7 buckets each artifact belongs to. The handoff doc then cross-links each
bucket output rather than duplicating its content.

5. **Triage session output.** For each significant artifact the session produced, pick a bucket
   using the taxonomy table above. If unsure between two buckets, prefer the more specific one
   (e.g., a review of an analysis → `reviews/` not `analysis/`).

6. **`docs/decisions/` — write/update ADRs** for significant architectural/methodological decisions.
   - Path: `docs/decisions/NNNN-kebab-case.md`
   - Check for duplicate ADR numbers first (grep `^\d{4}-` in `docs/decisions/`)
   - Status, Context, Decision, Consequences, Confirmation, (optional) Supersedes/SupersededBy

7. **`docs/runbooks/` — capture new or updated operational procedures.**
   - New rerun/retrain procedure → new file under `docs/runbooks/`
   - Updated steps to existing runbook → edit in place, add a dated changelog entry at the top

8. **`docs/analysis/` — write up findings and investigations.**
   - Exploratory analysis, diagnostic runs, discovery write-ups
   - Include methodology + what-would-change-the-conclusion so future sessions can re-evaluate

9. **`docs/references/` — update schemas, data dictionaries, convention docs.**
   - If the session added columns to a table, update the data dictionary
   - If the session changed project conventions, update the relevant reference doc

10. **`docs/reviews/` — write review-panel or audit output.**
    - Review reports, peer reviews, audit findings produced this session

11. **`docs/handoffs/` — always write session handoff + next prompt (Phase 3 below covers this).**

12. **`docs/deliverables/` — record external-facing artifacts.**
    - Client drafts, published outputs, slide decks, PDFs, XLSXs
    - If the artifact was generated (not hand-authored), add a `.provenance.md` sibling with
      source inputs, generation date, and regeneration command

13. **Update future plan** -> `docs/plans/future_sessions_plan.md`
    - Mark completed items as DONE
    - Add new items discovered during session
    - Update status of in-progress items

14. **Update the project's own tracker / roadmap / ledger — EVERY part of its
    ritual, not the easy ones**

    Many repos keep a hand-maintained progress tracker with its own documented
    wrap-up procedure (DoodleRun: `docs/site/assets/data.js`, seven parts, listed
    in that file's own header). **That header IS the checklist — read it and do
    all of it.** A session that ships work without updating the tracker has left
    the repo lying, and the parts people skip are always the same ones.

    - **Do every part.** Typically: a session card; task statuses (folding in any
      live/overlay ticks the owner made from a phone, then CLEARING the overlay);
      new rulings appended, never silently edited — supersede instead; newly
      committed pages registered as artifacts; refreshed issue/state snapshots;
      **your session taken OFF any running board** (nothing expires it — no
      heartbeat, no TTL — so a card left up keeps telling the owner your session
      is alive); and the "last updated" stamp bumped.
    - **Run its validator if it has one** (`node docs/site/tools/validate_data.mjs`
      and friends). Validators here enforce enums the schema does not document,
      so run them rather than guessing.
    - **Splice, never re-dump.** If the ledger is machine-parseable and
      hand-formatted, a full re-serialise comes back with dozens of lines of diff
      that are other sessions' escaping — which lands as a conflict on work you
      never touched. Locate the one object, render just that, splice it back,
      then re-parse the whole file to prove you did not break it.

    **FOUR PARTS OF THIS OUTLIVE THE WRAP-UP, so the wrap-up cannot be the last
    thing you do.** Doing all N parts and still leaving the repo lying is the
    normal failure, not a careless one:

    1. **The PR chip cannot be written at wrap-up, because the PR does not exist
       yet.** A tracker entry is finished when the PR is **merged**, not when the
       card is written — go back and add the number, and the same for any
       artifact whose page lands in that PR.

       **AND THE VARIANT THAT SURVIVES DOING THAT: a card is finished when the
       LAST of its PRs merges, not the first.** The obvious failure is `prs: []`.
       The one that gets past it is a card carrying a *plausible, non-empty*
       chip that is simply short — you added the number when the card was
       written, then kept working and merged three more. On 2026-08-05 a session
       shipped eight PRs across three cards and **three of them (#534, #536,
       #541) were on no card at all**; every card looked correct in the diff and
       passed the validator, because a validator can only see that the field is
       populated. **Only step 25's enumeration catches it** — the card cannot
       know about a PR that merged after it.

       **AND THE TERMINATING CHIP: NEVER PREDICT YOUR OWN PR NUMBER — CREATE,
       READ, THEN AMEND.** Chasing the last chip needs a final PR that names
       both its predecessor and *itself*, or the chain never ends. That tempts
       you to write the number before the PR exists. **It will be wrong**: on
       2026-08-07 a session wrote `846` from the last number it had seen and
       GitHub allocated **849**, three others having opened in between. The
       order that works is:

           git commit … && git push
           gh pr create …            # read the number it prints
           # edit the chip to that number
           git commit --amend && git push --force-with-lease

       A guessed chip is the worst kind of wrong here, because it is *plausible*
       — it points at a real, recently-merged pull request belonging to somebody
       else's work, so nothing looks broken and the validator passes. Read the
       number; do not derive it.
    2. **Every figure you paste into a tracker is a COPY, and a parallel session
       can rot it inside an hour.** Rebasing resolves the text conflict and tells
       you nothing about the values. After any rebase onto someone else's work,
       re-grep the figures you wrote against the artifacts they came from.
    3. **Flipping a task to `done` is half a status change.** Closing one block
       makes the next block due, and the successor normally has no home. **Ask
       what falls due BECAUSE you finished, and give it a task — and an issue —
       before you close yours.**
    4. **A tracker field that mirrors LIVE state is a copy of something outside
       the repo, and nothing in the repo can check it.** Item 2 is about figures
       a parallel session can rot; this is worse, because no rebase, no
       validator and no diff can see it. On 2026-08-05 DoodleRun's
       `meta.deployed_rev` read `doodlerun-00025-lc8` while the live service was
       **two revisions behind main** — so a feature that had merged, shipped to
       TestFlight and been verified four ways was **unreachable in production**,
       and the owner found it on his phone in one try. **Check any such field
       against the thing itself** (`gcloud run services describe`, a `curl` of
       the deployed endpoint) — never against the repo, which agrees with itself
       by construction.

       The general form, worth stating because it outruns trackers: **a harness
       that stands in for a dependency proves your code handles a shape. Only
       the dependency proves the shape arrives.** Before a card says a
       server-fed surface is ready to look at, read the deployed contract.


15. **Update sessions archive** -> `memory/sessions_archive.md`
    - Add entry with session number, date, one-line summary, key outcomes
    - Include a bucket-footprint line (e.g. "Wrote to: decisions/, analysis/, handoffs/")

16. **Update MEMORY.md index**
    - Add new memory files
    - Update lesson count
    - Add session reference

#### Emitting follow-up items as GitHub issues

This is the issue-filing half of step 13. The future-to-do plan's whole job is
preserving context across sessions — but a follow-up that lives only as plan
prose decays into a stale TODO, because the next session has no actionable
breadcrumb. Filing each follow-up as a GitHub issue closes that loop.

**Which items to emit:** the *new* follow-up items this session discovered and is
*not* completing now — whatever the plan calls them (`Next steps`, `Follow-ups`,
`Deferred`, `Open questions`). Skip items already marked DONE and items already
tracked by an existing issue.

**Default behavior — dry-run preview.** Do NOT file issues silently. For each
follow-up item, draft a `gh issue create` payload and show the user the full
command(s) for inspection first:

```bash
gh issue create \
  --repo <owner>/<name> \
  --title "<concise follow-up title>" \
  --body "<why this matters + origin session/PR + file pointers>" \
  --label "follow-up"        # optional — only if the label already exists in the repo
```

Present all drafted commands as one batch, then let the user approve, edit, or
skip individual items. Run the approved `gh issue create` commands only after the
user confirms. (If the user has explicitly asked for autonomous operation, you
may file directly — but the dry-run preview is the default.)

**Target repo resolution:**
- If the user named a repo, use it (`--repo owner/name`).
- Otherwise auto-detect from the current git remote:
  `gh repo view --json nameWithOwner -q .nameWithOwner` (falls back to parsing
  `git remote get-url origin`).
- If neither resolves, skip issue emission — leave the items as plan text and
  note "issue emission skipped: no target repo" in the handoff doc.

**De-duplicate before filing.** For each drafted title, search the target repo's
open issues so re-running the handoff on the same plan doesn't double-file:

```bash
gh issue list --repo <owner>/<name> --state open --search "<title keywords>" \
  --json number,title
```

If a clear title match exists, drop that item from the batch and reference the
existing issue number in the plan instead of filing a duplicate.

**After filing:** annotate the corresponding plan item with its issue number
(e.g. `- [ ] Track 2 engagement-width follow-up — #201`) so the plan and the
issue tracker stay linked.

**Graceful degradation:** if `gh` is not installed or not authenticated, skip
issue emission, keep the follow-up items as plan text, and note "issue emission
skipped: gh unavailable" in the handoff doc — never block the handoff on it.

### Phase 3: Prepare (next session)

17. **Prepare the next session prompt — ALWAYS, if there is any next work at all** -> `docs/handoffs/session_N+1_prompt.md`

    **PREPARING IT IS PART OF THE HANDOFF. Pointing at a prompt that already exists
    does NOT count** (owner's instruction, 2026-08-04: *"please always prep next
    session prompt if available at all as part of the session handoff"*). A prompt
    written earlier in the SAME session is stale by the end of it — it was drafted
    before the session's later findings, and the receiving session executes it
    trusting that it is current. So:

    - **A prompt already exists?** Re-read it against what the session actually
      learned, and EDIT it. Fold in every gap you would otherwise have written into
      the handoff as "the obvious first move" — as a numbered step, with its inputs.
      Anything left as "whoever picks this up should scope X" belongs to nobody.
    - **Verify the paths and recipes you put in it.** A prompt is executed by
      someone who trusts it. (2026-08-04: a handoff asserted "every card carries the
      funnel's placement" in five documents; the card carried no such thing, and the
      builder stripped it on purpose. The claim survived because nobody ran it.)
    - **Multiple live prompts?** Say which is FIRST and why, and mark any whose
      premise the session moved.

    - **Anything in the prompt that is a QUESTION FOR THE OWNER does not belong in
      the prompt at all** — see step 17b. A next-session prompt is executed by an
      agent; a decision the owner has to make blocks that agent and rots while it
      waits.

17b. **Owner decisions go on a tickable page, not into prose — use `promptback`
     (standing preference, set 2026-08-06).**

    If the session ends with anything only the owner can answer — a shape to
    approve, options to choose between, a ruling to confirm — **do not leave it as
    a bulleted list in the handoff and do not ask it in chat alone.** Both make the
    owner reconstruct structured answers from unstructured reading, usually on a
    phone, and the answer arrives as prose someone then has to interpret.

    Instead: load `promptback` and put the questions on a page they can tick, with
    a button that copies their answers back as one pasteable prompt. If the session
    also produced a `show-and-tell` explainer, the widgets belong IN that page,
    under each question's own context — not in a second document.

    Three things that make the difference between a page that works and one that
    wastes the owner's attention:

    - **Question-specific chips, and the exact token decoded beside them.** A bare
      `[APPROVE]` is ambiguous on a recommendation-shaped question — approve the
      change, or approve the status quo the report defended? The copied prompt must
      carry its own "Meaning of ticks" key naming the literal token.
    - **Every question must still be the owner's to answer when you ship it.**
      Check what parallel sessions hold before writing the page: a tickable question
      that someone else already picked up is worse than no question, because it
      spends attention and produces a decision that collides. If you cannot verify,
      say so on the page.
    - **Verify by driving the widgets, not by reading the HTML.** The copied text is
      assembled at runtime from hand-written attributes; a chip that fails to persist
      looks perfect on screen. A headless harness beats a browser check that may not
      be runnable.

    **Then the handoff and the next-session prompt point AT that page** and say the
    work is blocked on the owner's ticks — rather than restating the questions,
    which creates two places for the answer to land.

    **The one case for skipping (and then SAY so, in the handoff and the summary).**
    A next-session prompt is for carrying *forward-looking work* across a session
    boundary. If the session closed its stream and you would NOT recommend a concrete
    next task — the only "open" items are explicit do-not-build observations,
    tracked-elsewhere backlog, or pure guardrails-for-hypothetical-future-work —
    **do not manufacture one.** A prompt that says "nothing forced here, here's
    accurate state" is overhead the user has asked you not to produce: the handoff
    doc (Phase 1) already captures state, and manufacturing a to-do-less prompt reads
    as dragging the session on. In that case, note in the handoff doc + final summary
    "no next-session prompt — stream closed, no recommended next action" and stop.

    **Write the prompt only when** you would genuinely tell the next session "do X
    next" — a real, scoped, recommended task (or a hard blocker that a future session
    must pick up). Then include:
    - Key context (what's done, what's blocked)
    - Start files to read (include bucket-specific outputs from Phase 2)
    - Priority tasks with specific instructions
    - Research context

    Corollary (user preference — [[feedback_resolve_now_when_context_healthy]]): if
    there IS a recommended next task and the session is still under ~30% context,
    prefer to just DO it now rather than write a prompt and stop. The prompt is for
    work that genuinely can't finish now (context exhaustion, hard blocker, user
    decision needed). Don't drag a closed session on, and don't defer tractable work.

18. **Write parallel session prompts** when upcoming work can be split into independent streams

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

19. **Check for uncommitted changes:**
    ```bash
    git status --short
    git diff --name-only
    git log --oneline origin/BRANCH..HEAD
    ```

20. **Commit all session work** — stage and commit in logical groups:
    - **Code changes first:** feature code, bug fixes, tests (one commit with descriptive message)
    - **Docs second:** handoff doc, next-session prompt, plan updates, lessons (separate commit)
    - If the session already has multiple commits on a feature branch, add docs as a new commit on the same branch — **unless that branch was already squash-merged.** Check first: `gh pr list --head <branch> --state merged`. If it merged, the branch still carries its pre-squash commits (squash-merge never marks them merged locally), so a docs PR from its HEAD shows the WHOLE feature diff and can conflict with parallel streams that touched the same files after the squash. Instead: commit the docs where you are, then rebuild — `git reset --hard origin/main` + `git cherry-pick <docs-sha>...` onto a fresh docs branch (docs files rarely overlap the feature files, so the picks are clean). Verify before pushing — **three dots, not two**:

      ```bash
      git diff --stat origin/main...HEAD                       # only the docs files
      git diff --diff-filter=D --name-only origin/main...HEAD  # must be empty
      ```

      `A..B` compares tip to tip, so everything `main` gained after you branched renders as deletions *you* appear to be making; two dots are right only in the instant after the reset and wrong the moment a parallel session merges — which is exactly the situation this step exists for. `A...B` diffs from the fork point and reproduces what GitHub shows on the PR. Run the deletion line even when the stat looks fine: a branch whose *tree* is stale (a `git reset --soft`, or an old worktree committed with `git add -A`) is still a clean fast-forward reporting 0 commits behind, and the push then replaces `main`'s tree wholesale. Measured: one such PR deleted a 322-line client-facing file while describing itself as a copy fix. This is the one command that sees it.
    - If uncommitted work is on `main`, create a feature branch first: `git checkout -b feat/sN-description`

21. **Push and create PR:**
    ```bash
    git push -u origin <branch-name>
    gh pr create --title "feat(sN): <summary>" --body "<PR body with summary + test plan>"
    ```
    - PR body should include: summary bullets, test plan checklist, line/file counts
    - If the session had no code changes (docs-only), use `docs(sN):` prefix instead of `feat(sN):`

22. **Review + auto-merge for docs-only handoff PRs.** When the PR is purely docs from this skill (handoff doc + next-prompt + maybe a sessions_archive/MEMORY.md edit, no code/tests/deploy), default to: review-with-agent → fix findings → squash-merge. Don't wait for the user to ask. The handoff PR has narrow scope and stalls the loop if it sits open between sessions.

    a. **Launch a review agent** scoped lighter than code review:
       - **Factual accuracy** — cited PR numbers, commit SHAs, issue numbers, tracker IDs all resolve (`gh pr view`, `gh issue view`, `git log <sha> -1`)
       - **Dead-reference check** — every file path / line number / handoff filename mentioned must resolve in current main, OR be explicitly annotated as living on a non-main branch with a `git show <branch>:<path>` recipe. Common trap: predecessor handoff files written on a wip branch that never merged
       - **Internal consistency** — handoff and next-prompt agree on session number, predecessor refs, branch names, what's done vs deferred
       - **Self-contained next-prompt** — receiver can cold-start; no "see above" or unresolved references
       - **Naming convention** — if `b`/`c` suffix used for parallel-session collision, confirm precedent matches and self-references use the suffixed filename

       Use `voltagent-qa-sec:code-reviewer` (or equivalent code-review agent). Request a <250-word report. Surface only HIGH/MEDIUM findings.

    b. **Address findings** via Edit tool. Common patterns:
       - Predecessor refs to files on a wip branch → annotate with `git show <branch>:<path>` recipe (don't delete the reference; the receiver may want to read it)
       - Self-reference bugs (`session_NNN_handoff.md (this)` where the actual filename includes a `b`/`c` suffix)
       - `module.py:NNN` line numbers drift fast — verify against current main or drop the line number

    c. **Refresh the PR body** if findings meaningfully changed the story (note the review-agent pass + what was fixed).

    d. **Squash-merge**: `gh pr merge <N> --squash --delete-branch`. If `--delete-branch` fails with "main is already used by worktree at..." (common when running from a worktree that has main checked out elsewhere), the merge still succeeded — clean up the remote ref via `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>`.

    e. **Sync local main** if possible (`git checkout main && git pull`). Skip silently if the current worktree can't switch (branch checked out elsewhere). Note merge in the final summary table.

    **For non-docs-only PRs** (any code/tests/deploy mixed in): default to leaving the PR open for human review. Only merge if user explicitly asks. Project memory may add a "always run code-reviewer pass before merging PRs" rule — apply that for code PRs.

23. **Quick memory hygiene check:**
    - Any new memory files missing from MEMORY.md?
    - Lesson count accurate?
    - Any ADR number duplicates?

24. **Doc freshness reverse-lint** — catch stale normative guidance in project docs/ after this session's lessons.
    The PostToolUse hook on Edit|Write already fires on memory-file edits, but this explicit pass catches:
    - Lessons added outside a hooked Edit (e.g., via in-memory batch)
    - Consolidated reports surfaced in the handoff doc itself

    The logic is a bundled script, not a snippet here, so it can be executed and tested.
    See `scripts/reverse_lint_step.sh` — while it lived in this file as a fenced block it
    carried two undetected defects that both reported themselves as "clean".

    ```bash
    # THE BOOTSTRAP NEEDS ALL THREE ROOTS. A plugin-scope install creates neither of the
    # first two: CLAUDE_PLUGIN_ROOT is often unset in the shell a step runs in, and
    # ~/.claude/skills/session-handoff/ does not exist at all — the plugin lives under
    # ~/.claude/plugins/cache/<marketplace>/session-handoff/<version>/. Checking only the
    # first two is the same defect this release fixes one level down, so do not trim it.
    FOS="${CLAUDE_PLUGIN_ROOT:+${CLAUDE_PLUGIN_ROOT}/scripts/find_own_script.sh}"
    [ -f "$FOS" ] || FOS="$HOME/.claude/skills/session-handoff/scripts/find_own_script.sh"
    [ -f "$FOS" ] || FOS="$(find -L "$HOME/.claude/plugins/cache" -mindepth 5 -maxdepth 5 \
        -path '*/session-handoff/*/scripts/find_own_script.sh' 2>/dev/null \
      | awk -F/ '{print $(NF-2)"\t"$0}' | sort -V -k1,1 | tail -1 | cut -f2-)"

    # BASE is the SHA this session started from. Substitute a real one. "HEAD~N" is a
    # placeholder, not a revision — the script reports SKIPPED rather than scanning
    # nothing and calling it clean.
    BASE="${SESSION_BASE_SHA:-$(git rev-parse --verify --quiet HEAD~1 || git rev-parse --verify HEAD)}"

    if [ ! -f "$FOS" ]; then
      echo "reverse-lint: SKIPPED — find_own_script.sh not found at any of the three roots"
    elif ! STEP="$(sh "$FOS" reverse_lint_step.sh)"; then
      echo "reverse-lint: SKIPPED — $STEP"
    else
      sh "$STEP" "$BASE"
    fi
    ```

    The script prints exactly one status line, always, in one of three shapes:
    `reverse-lint: clean (N file(s) scanned)` · `reverse-lint: N candidate(s) — see output
    above` · `reverse-lint: SKIPPED — <reason>`. Copy that line into the summary table.

    **Wire behavior:**
    - Zero candidates but N ≥ 1 scanned → "clean (N file(s) scanned)" in the summary table
    - ≥1 candidate → add a **"Stale docs to review"** section to `session_N_handoff.md` with
      `file:line` references and the triggering rule. **Never auto-edit** the flagged docs; the
      human decides what to update.
    - If the resolver fails, or `BASE` is not a real revision (or shares no history with
      `HEAD`), report the step as **skipped** in
      the summary table — **never as clean**. "Clean" and "never ran" must not look alike.
    - **A benign SKIPPED is common and is not a defect — say which kind it is.** The
      lint scans lesson/axiom/feedback files tracked *in the repo*. In a project whose
      memory lives outside the repo (e.g. `~/.claude/projects/<slug>/memory/`), it
      correctly reports `SKIPPED — no lessons/axioms/feedback files changed` even
      after a session writes several memory files. Report that verbatim rather than
      as "clean" (it did not scan them) or as a failure (nothing is wrong).
    - **Never report a bare "not installed."** That is a claim about install state; all you
      actually know is that a lookup missed. Say "not found" and print the roots tried. This
      skill is usually installed as a *plugin*, and a bare "not installed" has already been
      misread by a human as proof of absence when it was installed the whole time.

24b. **Skill freshness audit** (per axiom #21) — if any `SKILL.md` was edited this session, run the freshness check:

    ```bash
    # Same BASE contract as step 24 — a real SHA, never a literal HEAD~N. Re-derive it
    # here if you are running this block on its own rather than straight after step 24.
    BASE="${BASE:-${SESSION_BASE_SHA:-$(git rev-parse --verify --quiet HEAD~1 || git rev-parse --verify HEAD)}}"

    if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
      echo "skill-freshness: SKIPPED — BASE '$BASE' is not a revision"
    elif ! git merge-base "$BASE" HEAD >/dev/null 2>&1; then
      # Three dots need a fork point. No shared history means no answer — say so
      # rather than let an erroring diff read as "no SKILL.md was touched".
      echo "skill-freshness: SKIPPED — BASE '$BASE' shares no history with HEAD"
    elif git diff --name-only "$BASE"...HEAD | grep -qE '(^|/)SKILL\.md$'; then
      # Resolve the bundled script — plugin install first, then git-clone install:
      SFA="${CLAUDE_PLUGIN_ROOT:+${CLAUDE_PLUGIN_ROOT}/scripts/skill_freshness_audit.py}"
      [ -f "$SFA" ] || SFA="$HOME/.claude/skills/session-handoff/scripts/skill_freshness_audit.py"
      [ -f "$SFA" ] || SFA="$(find -L "$HOME/.claude/plugins/cache" -mindepth 5 -maxdepth 5 \
          -path '*/session-handoff/*/scripts/skill_freshness_audit.py' 2>/dev/null \
        | awk -F/ '{print $(NF-2)"\t"$0}' | sort -V -k1,1 | tail -1 | cut -f2-)"

      # Guard the invocation. Without this, SFA holds a non-existent path and python3
      # exits 2 with "can't open file" — the graceful fallback below was unreachable.
      if [ -f "$SFA" ]; then
        python3 "$SFA" --human
      else
        echo "skill_freshness_audit: not found — tried \$CLAUDE_PLUGIN_ROOT/scripts/ and" \
             "\$HOME/.claude/skills/session-handoff/scripts/"
      fi
    fi
    ```

    Flags any skill whose `last_verified` has aged past `staleness_window_days` (default 90), or that opts into the freshness contract without declaring one. **Never auto-bump** `last_verified` — surface candidates for human verification and add them to the "Stale docs to review" section of the handoff doc.

    Skip silently if no SKILL.md was touched. If the audit script resolves at neither location, log
    "skill_freshness_audit: not found — tried &lt;both paths&gt;" and continue, and report the step as
    **skipped** rather than clean. See the naming rule in step 24: never a bare "not installed".

    **WHAT THIS AUDIT DOES NOT LOOK AT: the copy you edited.** It scans the two roots a
    skill is INSTALLED under — `~/.claude/skills/` and `~/.claude/plugins/cache/` — and
    nothing else. A plugin skill's SOURCE repo is a third place: a marketplace checkout
    under `~/.claude/plugins/marketplaces/<marketplace>/`, or a clone anywhere on disk.
    That is the copy **step 24e tells you to edit**, and the audit never opens it. Measured
    2026-08-07 on the author's machine: the audit reported 247 skills and named
    `session-handoff` from
    `~/.claude/plugins/cache/wan-huiyan-session-handoff/session-handoff/1.20.0/SKILL.md`,
    zero results from any `marketplaces/` path, while the source repo being edited was at
    **1.21.0**. It passed, on the wrong file, one version behind. Two more reasons the pass
    means less than it looks: the trigger is `git diff … | grep SKILL.md` in the CURRENT
    repo, so editing a plugin skill in a *separate* repo does not fire the audit at all;
    and the cache copy's age comes from `mtime`, which is the install time, so it reads
    `0d` whatever the file says.

    **So when the SKILL.md you edited is a plugin skill, verify it directly instead.** Two
    things, neither of which this audit can tell you:
    - **The version bumped everywhere that plugin's own repo records it.** Do not trust a
      remembered list — `grep -rn '"version"\|^version:'` the repo and read its manifest
      test. In THIS repo it is five places: `plugins/<skill>/SKILL.md` frontmatter,
      `plugins/<skill>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
      `package.json`, and the newest `## Version History` entry in `README.md`.
      `tests/manifest-consistency.test.mjs` enforces all five — the README entry is the
      one that gets forgotten, and it grew its own check because bumping the manifests
      without the README reads to a user as "that fix isn't in my version".
    - **That repo's own gates ran** — for this one, `npm test` (also enforced by the
      `.githooks/pre-push` hook and the `test-gate` status check).

    **The general form, and it is the more useful half: an audit that reports "all clean"
    without naming what it examined has told you nothing.** Prefer a check that PRINTS ITS
    SCOPE, then compare that scope against the path of the thing you actually changed.
    `skill_freshness_audit.py --human` does print its roots on its first line — read that
    line rather than the "All skills fresh." at the bottom. This is the same failure this
    skill already carries twice — step 24's reverse-lint reported clean while scanning zero
    files (v1.17.0), and this audit reported nothing while scanning one root of two
    (v1.17.0). Green over an empty set is not evidence.

24c. **Persist session usage metrics** — archive this session's cctime output as a structured
    record under `~/.claude/usage-tracking/` for cross-session analytics (Karpathy-style usage tracking).

    **THIS STEP OVERWRITES `$OUT.json` AND `$OUT.md`, AND STEP 24d'S WORK LIVES IN BOTH.**
    Every write below is `>`, not `>>`, so a refresh replaces the file wholesale and nothing
    warns you. The record afterwards looks complete — tokens, models, transcript counts all
    present — it simply has no `review_findings` in it, and the cross-session roll-up those
    findings exist for is gone. This is not a hypothetical re-run: the sanity-check further
    down this step tells you to "redirect its output over the fork's files", and the numbers
    keep moving as a session continues, so refreshing near the end is the normal thing to do.
    Observed 2026-08-07 — a session refreshed its record to pick up later subagents and wiped
    **fifteen merged review findings**, caught only by listing the JSON's top-level keys
    afterwards. **Order: 24c first, then 24d, never the reverse. If you re-run 24c after 24d,
    24d must be re-applied.** The fence carries the JSON half across automatically; the
    Markdown half you re-append by hand (see below).

    **Canonical generator is the cctime FORK, invoked BY ABSOLUTE PATH** (not the bare
    `cctime` name — see the name-collision warning below):

    ```bash
    SID="${CLAUDE_CODE_SESSION_ID:?session id required}"
    OUT="$HOME/.claude/usage-tracking/$(date -u +%Y-%m-%d)_${SID:0:8}_<project-short>"
    CCTIME_FORK="$HOME/.claude/tools/cctime-fork/dist/index.js"

    # Keep the pre-refresh record so step 24d's merged fields survive this overwrite.
    # `-s`, not `-f`: a 0-byte record from a failed earlier run must not replace a good
    # .prev, which is what would then be carried forward.
    [ -s "$OUT.json" ] && cp "$OUT.json" "$OUT.json.prev"

    if [ -f "$CCTIME_FORK" ]; then
      node "$CCTIME_FORK" --session "$SID" --json > "$OUT.json"   # canonical record
      node "$CCTIME_FORK" --session "$SID"        > "$OUT.md"     # human-readable companion
    else
      # Fork not present → in-skill recompute (same message.id dedup + recursive
      # subagent accounting as the fork; tokens only, no cost math).
      # Resolve the bundled script — plugin install first, then git-clone install:
      # Three roots, as everywhere else — a plugin install creates neither of the first two.
      SM="${CLAUDE_PLUGIN_ROOT:+${CLAUDE_PLUGIN_ROOT}/scripts/session_metrics.py}"
      [ -f "$SM" ] || SM="$HOME/.claude/skills/session-handoff/scripts/session_metrics.py"
      # Self-contained third root: $FOS belongs to step 24's fence, and fences do not
      # reliably share a shell.
      [ -f "$SM" ] || SM="$(find -L "$HOME/.claude/plugins/cache" -mindepth 5 -maxdepth 5 \
          -path '*/session-handoff/*/scripts/session_metrics.py' 2>/dev/null \
        | awk -F/ '{print $(NF-2)"\t"$0}' | sort -V -k1,1 | tail -1 | cut -f2-)"

      # GUARD BEFORE REDIRECTING. `> "$OUT.json"` creates and truncates the file before
      # python3 is even exec'd, so an unguarded call leaves a 0-byte record behind that
      # reads as a written record to anything scanning the directory later.
      if [ -n "$SM" ] && [ -f "$SM" ]; then
        python3 "$SM" --session "$SID" --project=<slug-with-leading-dash> --json > "$OUT.json"
        python3 "$SM" --session "$SID" --project=<slug-with-leading-dash> --print-summary > "$OUT.md"
      else
        echo "session metrics: not found — tried \$CLAUDE_PLUGIN_ROOT/scripts/," \
             "\$HOME/.claude/skills/session-handoff/scripts/, and the plugin cache." \
             "No usage record written; report the step as skipped."
      fi
    fi

    # Carry 24d's fields across the overwrite, then PRINT THE TOP-LEVEL KEYS. The print
    # is the verification, not a comment: if a review panel ran this session, that list
    # MUST contain review_findings and review_summary. If it does not, 24d's merge is
    # gone — re-apply it before you report the record written.
    if [ -s "$OUT.json" ]; then
      python3 - "$OUT.json" <<'PY'
    import json, os, sys
    p = sys.argv[1]; prev = p + ".prev"
    d = json.load(open(p))
    if os.path.exists(prev) and os.path.getsize(prev):
        old = json.load(open(prev))
        d.update({k: old[k] for k in ("review_findings", "review_summary") if k in old})
        json.dump(d, open(p, "w"), indent=2)
        os.remove(prev)
    print("top-level keys:", sorted(d))
    PY
    fi
    ```

    **The Markdown companion has no such carry.** 24d appends its findings table to
    `$OUT.md` with `cat >>`; this step's `>` deletes it and there is nothing to recover it
    from. After any 24c refresh, re-run 24d's `cat >> "$OUT.md"` block. Then read the two
    files rather than the exit status — a round trip is the only proof the fields are
    actually there.

    **CRITICAL — invoke the fork by PATH, never the bare `cctime`.** The fork's
    `package.json` keeps the upstream package name `@dioptx/cctime`, so the global
    `cctime` symlink is *ambiguous and unstable*: a `npm link` from the fork points it at
    the fork, but any later `npm install -g @dioptx/cctime` (or a fresh machine) silently
    clobbers it back to the **broken upstream**, and `cctime -V` reports `1.0.0` either way
    so you can't tell them apart. Calling `node ~/.claude/tools/cctime-fork/dist/index.js`
    sidesteps the symlink entirely and is deterministic. (This is the
    `cctime-record-main-loop-inflated-by-stale-binary` failure mode — a stale-upstream
    binary inflates main-loop cost ~1.8–2× via streaming-partial double-count, and the
    wrong number is baked into the stored JSON.)

    Why the fork at all: upstream (a) misattributes overnight-idle gaps to "Claude
    thinking" (background-agent completion events during sleep classified as assistant
    work), and (b) under-counts subagent tokens. Both are fixed in
    [`wan-huiyan/cctime`](https://github.com/wan-huiyan/cctime) (PRs to upstream pending).

    **One-time fork setup** (only if `~/.claude/tools/cctime-fork/dist/index.js` is absent):
    ```bash
    git clone --depth 1 https://github.com/wan-huiyan/cctime ~/.claude/tools/cctime-fork
    cd ~/.claude/tools/cctime-fork && npm install && npm run build
    # No `npm link` needed — the skill calls dist/index.js by path.
    ```

    Sanity check: on a session with an overnight gap, the fork reports "Xh away" as a
    separate top-line beside "active"; upstream merges it into "Claude thinking" at ~98%.

    **Fallback (`session_metrics.py`)** — if cctime isn't installed or the fork isn't available,
    use the bundled Python recompute (resolve the path plugin-first, as above):

    ```bash
    SM="${CLAUDE_PLUGIN_ROOT:+${CLAUDE_PLUGIN_ROOT}/scripts/session_metrics.py}"
    [ -f "$SM" ] || SM="$HOME/.claude/skills/session-handoff/scripts/session_metrics.py"
    [ -f "$SM" ] || SM="$(find -L "$HOME/.claude/plugins/cache" -mindepth 5 -maxdepth 5 \
        -path '*/session-handoff/*/scripts/session_metrics.py' 2>/dev/null \
      | awk -F/ '{print $(NF-2)"\t"$0}' | sort -V -k1,1 | tail -1 | cut -f2-)"
    if [ -f "$SM" ]; then
      python3 "$SM" --session "$SID" --project=<slug-with-leading-dash> --print-summary
    else
      echo "session metrics: not found — tried all three roots"
    fi
    ```

    This script dedupes tokens by `message.id` (whole-file, keeping the max-output chunk) and
    sums main + recursively-discovered subagent JSONLs — the same accounting rules as the fork.
    Tokens only: it does no time/idle-gap analysis and **no cost math** (pricing constants go
    stale; cost estimation is delegated to the cctime fork / token-torch). Slower than cctime,
    but works without it.

    **Subagent token/cost accounting — VERIFY the record, don't trust the fix claims.** Both tools
    were patched 2026-05-29 (fork + `session_metrics.py`, agreeing on the reference session's 17
    transcripts), BUT on 2026-07-16 the fork STILL wrote `enhancedStats.subagent: 0` /
    main-only cost on a session whose only subagents were 82 workflow transcripts (recorded cost
    ~30% of the true total). So after 24c writes the record, ALWAYS sanity-check
    `find <session>/subagents -name 'agent-*.jsonl' | wc -l` (recursive) against it; if transcripts
    exist but subagent spend ≈ 0, re-run the bundled `session_metrics.py` (recursive, produced the correct total)
    and redirect its output over the fork's files so the canonical record is the complete one.
    **That redirect is the overwrite warned about at the top of this step** — it destroys any
    24d merge already in the files, so do it through the same carry-then-print-keys fence, and
    re-append 24d's Markdown table afterwards.
    **Unit-mismatch variant (2026-07-23, same failure family, non-zero this time):** the fork's
    scalar `enhancedStats.subagent` can be non-zero yet ~2× off the itemized truth (1.07M vs a
    workflow's self-reported 2.44M; `session_metrics.py` itemized subagent output 514k + cache
    fields) — the scalar's UNIT is not the itemized sum, so "non-zero" does NOT clear the check.
    Same resolution: the token-itemized `session_metrics.py` record wins; note the fork figure in
    `cost_note`. Three
    traps — relevant if you write your own recompute:
    - **Nesting:** Workflow subagents live one level deeper than foreground ones —
      `<session>/subagents/agent-*.jsonl` (foreground) vs
      `<session>/subagents/workflows/wf_<runid>/agent-*.jsonl` (workflow). RECURSE; a flat
      `glob("agent-*.jsonl")` misses the fleet (tens of % of true cost).
    - **Per-message dedup must keep the HIGHEST-output chunk, not the first.** Streaming chunks share
      a message.id/requestId; the first carries full input/cache but output_tokens≈0, so first-wins
      under-counts OUTPUT ~8x.
    - **Dedup each request ONCE across the whole file, not just consecutive chunks.** An
      order-preserving dedup that flushes its group on every non-assistant row (the cctime parser's
      `deduplicateAssistant`) re-counts a request key that recurs across tool-result boundaries,
      inflating subagent input/cache ~50%. cctime's NEW subagent path uses a whole-file dedup
      (`src/subagents.ts`) instead of routing subagent files through the parser. (The main-loop path
      still uses the order-preserving parser — its over-count is a minor ~1-3% and is left alone
      because phase/time analysis needs message order.)
    See skill `claude-code-workflow-subagent-tokens-nested-undercount`.

    **Heads-up — the bundled `session_metrics.py` prints to stdout only** and never writes files
    on its own, so it cannot clobber the cctime outputs. To persist the record, redirect its
    `--json` output to `$OUT.json` and its `--print-summary` output to `$OUT.md` as shown in the
    step-24c snippet above. Its record is tokens-only (no `$` figures) — if you need cost in the
    archived record, install the cctime fork.

    The step writes a pair of files: `<date>_<8-char-session-id>_<project>.{json,md}`. The JSON is the
    canonical record (schema versioned, accumulatable via `jq -s` across sessions); the Markdown
    is a human-readable companion. See `~/.claude/usage-tracking/README.md` for schema, methodology,
    and cross-session query patterns.

    **Wire behavior:**
    - If `~/.claude/usage-tracking/README.md` doesn't exist, the script doesn't create it — surface
      to the user that they should set up the tracking folder once.
    - If neither cctime nor `session_metrics.py` resolves, log "session metrics: not found — tried &lt;paths&gt;"
      and continue.
    - If both main and subagent JSONLs are missing for the session, skip silently — likely a
      session that didn't go through the regular Claude Code transcript flow.
    - On the FIRST run after a Claude Code update, sanity-check cctime against the Anthropic
      billing dashboard — pricing constants may have moved.
    - **NEW-MODEL sessions** (model id absent from the cctime fork's rate table — grep the fork's
      `dist/index.js` for it): the bundled `session_metrics.py` recompute emits tokens only, so its
      record has no dollars to diverge — but the fork's dollar figure is unreliable when the model
      is unpriced (2026-07-23 `claude-fable-5` instance: dollar figures diverged >2× while token
      counts agreed). Keep the tokens-only `session_metrics.py` record canonical with a `cost_note`,
      recompute dollars when rates are pinned — do NOT keep-the-low.
      See `cctime-record-main-loop-inflated-by-stale-binary` (new-model variant).

24d. **Augment the usage record with review findings** (only when a review panel / code-review
    agent ran this session — same trigger as handoff §7). The cost/token record from 24c answers
    "what did this session cost"; this block answers "what did the review gate **catch**, and which
    perspective caught it" — so accumulating `$OUT.json` across sessions (`jq -s`) reveals, e.g.,
    which reviewer persona/speciality reliably finds which bug class, and the panel's true hit rate.
    Merge a `review_findings` array into the auto-written JSON and append a section to the `.md`.
    Pull from the review report's Action Items + `integration_log.jsonl` — do NOT hand-reconstruct.

    **This step runs AFTER 24c, and 24c must not be run again without re-applying it.** 24c
    writes both files with `>` and will silently replace everything below. If you refresh the
    metrics for any reason, come back here and re-merge.

    ```bash
    # One object per finding the panel RAISED (fixed + documented + rejected).
    python3 - "$OUT.json" <<'PY'
    import json, sys
    p = sys.argv[1]
    d = json.load(open(p))
    d["review_findings"] = [
      # severity: P0|P1|P2|P3 · disposition: fixed|documented|rejected|deferred
      {"severity": "P1",
       "finding": "Client .j2 rendered new negative phrases as 'inconclusive' — contradicted headline",
       "reviewer_persona": "Correctness Hawk",
       "reviewer_speciality": "voltagent-qa-sec:code-reviewer",
       "disposition": "fixed", "ref": "7ae73a0", "epistemic_label": "[VERIFIED]"},
      # ... one row per finding ...
    ]
    # roll-up so cross-session jq stays cheap
    from collections import Counter
    sev = Counter(f["severity"] for f in d["review_findings"])
    disp = Counter(f["disposition"] for f in d["review_findings"])
    d["review_summary"] = {"panel_ran": True, "n_findings": len(d["review_findings"]),
                           "by_severity": dict(sev), "by_disposition": dict(disp),
                           "review_report": "docs/reviews/<dir>/review_panel_report.md"}
    json.dump(d, open(p, "w"), indent=2)
    print("review_findings merged:", d["review_summary"])
    PY
    # human-readable companion — append the same table that's in handoff §7
    cat >> "$OUT.md" <<'MD'

## Review findings (this session)
| Severity | Finding | Caught by (persona · speciality) | Disposition |
|---|---|---|---|
| P1 | … | Correctness Hawk · voltagent-qa-sec:code-reviewer | Fixed `7ae73a0` |
MD
    ```

    - If 24c wrote nothing (metrics tooling absent / no transcript), still record the findings:
      write a minimal `$OUT.json` containing just `review_summary` + `review_findings` so the audit
      trail isn't lost when the cost half is unavailable.
    - If NO review ran, set `"review_summary": {"panel_ran": false}` (or omit) — never fabricate findings.
    - Keep `severity`, `reviewer_persona`, `reviewer_speciality`, `disposition` as the stable keys
      (the cross-session query contract); add free-form fields freely.
    - **Verify by reading the file back, after this step and after any 24c re-run** —
      `python3 -c 'import json,sys; print(sorted(json.load(open(sys.argv[1]))))' "$OUT.json"`.
      `review_findings` and `review_summary` must both be in the printed list, and
      `grep -c '^## Review findings' "$OUT.md"` must be 1. The merge script's own
      "review_findings merged: …" line proves what it wrote, not what is still on disk.

24e. **Improve the skills you USED this session — the ritual, not just the audit.**

    Step 24b checks whether a skill's `last_verified` has gone stale. This is the
    other half and it is the one that compounds: **a skill you just executed end to
    end is a skill you now have evidence about**, and that evidence evaporates when
    the session closes. Standing instruction from the owner, 2026-08-07: *"please
    update any skills you used in this session that you feel like needs an improve
    based on what you learned."*

    For each skill invoked this session, ask the three questions that produce real
    edits rather than nervous ones:

    - **Did a step mislead, or read as clean when it had not run?** That is the
      highest-value fix, because it is invisible from inside the artifacts.
    - **Did you have to work something out that the skill could have told you?**
      A trap you hit, a resolution order you had to discover, a wrong default.
    - **Did a step fire and produce nothing useful?** Say so in the skill, so the
      next session does not read a benign SKIPPED as a defect.

    **Do NOT rewrite a skill because the session merely went well.** No edit is the
    correct outcome most of the time; a skill that grows a paragraph per session
    becomes unreadable, and unreadable is how steps get silently dropped.

    **THE TRAP, and it cost this step its own first attempt: EDIT THE SOURCE, BUT
    DIFF THE CACHE AGAINST IT FIRST — THE CACHE CAN BE AHEAD.** A skill you run
    lives at `~/.claude/plugins/cache/<marketplace>/<skill>/<version>/SKILL.md`,
    which is a *copy*. Its source repo is named in the sibling
    `.claude-plugin/plugin.json` under `repository`. On 2026-08-07 the cache copy of
    THIS skill was **53 lines longer** than the same version in its source repo, and
    the extra 53 lines were an entire step recording a preference the owner had set
    — present in no commit on any branch. Both copies declared `1.18.0`. Publishing
    an edit made against the source would have deleted it, silently.

    So the order is:

    ```bash
    CACHE=~/.claude/plugins/cache/<marketplace>/<skill>/<version>/SKILL.md
    SRC=<source-repo>/plugins/<skill>/SKILL.md          # `repository` in plugin.json
    diff "$SRC" "$CACHE"        # MUST be empty before you edit either one
    ```

    If it is not empty, **reconcile before improving** — rescue whatever the cache
    holds into the source as its own commit, so the rescue is reviewable separately
    from your change. Then edit the source, and re-sync the cache afterwards so the
    two agree and the next session's diff is clean. This is
    `the-artefact-may-not-be-the-one-you-built` at the skill layer: the remedy for
    staleness is exactly where staleness gets created.

    Report each skill edited in the summary table with the version bump, or
    "no change — nothing learned that generalises".

25. **THE TWO CLOSING CHECKS — run them before you say the handoff is done.**

    Both exist because a user had to ask for them. On 2026-08-05 a session
    completed every phase above, reported the wrap-up as finished, and the owner
    asked *"has everything been updated in the tracker about this session's work?
    Can I close and tell the next session to execute the prompt, and it would
    know everything?"* **Both halves of that question found a real gap.** The
    fix is not to remember harder; it is that neither gap is visible from
    inside the artifacts you just wrote — each needs a fact from outside them.

    **(a) Enumerate the session's merged PRs and match them against the cards.**
    Do not eyeball this and do not trust that the field is populated.

    ```bash
    # every PR this session merged, oldest first
    gh pr list --state merged --limit 30 --json number,title,mergedAt \
      --jq '[.[] | select(.mergedAt > "<session-start-ISO>")] | sort_by(.number) | .[] | "\(.number)\t\(.title)"'
    ```

    Then read the tracker/ledger back and assert **every one of those numbers
    appears on some card**.

    **Two things this check reliably turns up, both seen on 2026-08-07.**

    - **A PR belonging to a session that has already wrapped.** #840 merged nine
      minutes after its owning session left the running board, and that session's
      card carried seven of its eight PRs. Nobody was coming back. Before adding the
      chip, confirm which card owns it: check whether the PR added a session card of
      its own (`git show <sha> -- <ledger> | grep '"id": "s-'`), and whether it
      closes a task already listed on an existing card. Attribute on that evidence,
      not on the date.
    - **The fix needs its own chip — TERMINATE THE CHAIN IN ONE PR.** A PR that adds
      a missing chip immediately becomes a merged PR with no chip, and re-running the
      enumeration finds it. Do not iterate: open the PR, read its number, and add
      **both** the number you were fixing and the PR's own, in that same PR, before
      merging. The repo convention that makes this legible is a title of the form
      *"The chip chain terminates here — #842 and this PR"*. A PR that merged after its card was written is
    invisible to that card by construction — this enumeration is the only thing
    that sees it. Add the missing numbers, and if a card's own PR is still open,
    leave `prs_none_reason` and come back.

    **(b) Cold-start the next-session prompt — read it as someone with no
    memory of this session.** You wrote it knowing everything, which is exactly
    why you cannot tell whether it stands alone. Ask three questions of it:

    - **Does it carry the CONTEXT, or only the TASK?** A prompt can be perfectly
      executable and still read as a trivial chore because the reason it matters
      lives only in your head. The 2026-08-05 prompt described a coordinate-
      convention bug flawlessly and never said it was the gate on the owner's
      central ask. **Put the two or three documents to read first at the top,
      plus the handful of findings that frame the work**, so a cold session has
      them even if it reads nothing else.
    - **Does every path, function and line number in it resolve?** You verified
      them when you wrote it; verify again if anything merged since.
    - **Does it say what only the owner can do**, separately from what the
      session can — even when the answer is "nothing"? Saying "nothing here
      needs you" is itself load-bearing information.

    If the answer to the user's question would be *"yes, but they should also
    read X"*, then **X belongs in the prompt** and the answer is currently no.

25c. **VERIFY YOUR OWN WORK STILL EXISTS ON `main` — after the last sibling merge, not when you wrote it.**

    Steps 25a/25b check that the *record* is complete. This checks the *work is
    still there*, and it is a different question with a different answer. **A
    merged, green PR is not evidence your work survived it.**

    On 2026-08-07 a PR built with a stale tree (its parent WAS current `main`, so
    every "am I behind?" check passed) deleted **59 files and 5,081 lines** already
    on `main` — source, tests, analysis pages, prompts and hand-maintained ledger
    entries belonging to **four** sessions. No conflict, PR green, the project's own
    validator passed, the tracker still rendered. One session declared its wrap-up
    complete and reported "all parts updated" **while four of its files and six of
    its ledger entries had already been deleted**, and did not find out for 3½ hours.

    **Why no gate catches it:** a deletion is a valid state of a file. A validator
    reads what is there and cannot know what should be. So this must be an explicit
    step, and it must run **last** — after the final merge of the session, because
    anything merging after you re-checks nothing.

    Three passes, in order — each catches what the previous cannot:

    ```bash
    git fetch origin main

    # 1. FILES exist
    for f in <every file you created or edited>; do
      git cat-file -e origin/main:"$f" 2>/dev/null && echo "OK   $f" || echo "GONE $f"
    done

    # 2. CONTENT survived — a file can exist and be rolled back
    git show origin/main:<file> | grep -c "<a distinctive marker of your change>"

    # 3. LEDGER TEXT, not just ids — parse the ledger at origin/main and at the
    #    commit your PR merged as, and diff story/detail/settled per object
    ```

    **Pass 3 is the one people skip and it is where the silent damage lives.** A
    task can survive by `id` while its `detail` is reverted to pre-session wording
    byte for byte. No id-presence check, and no validator, sees that.

    **If something is missing: splice it back from the last commit where it was
    intact — never `git revert` the offending PR.** Its own content is usually
    legitimate work, and reverting it destroys everything merged since: the same
    failure aimed the other way.

    **Then tell the other sessions.** Losses are per-session and invisible to
    everyone else; the ones belonging to a session that has already wrapped are
    found by nobody. Send a short broadcast with a copy-pasteable `git cat-file -e`
    loop and the three passes above. See `agent-traffic-control`'s
    `pr-from-stale-branch-silently-reverts-newer-main-files` for the detection
    (`git diff --diff-filter=D`) that prevents it at the other end.

25d. **IF THE REPO HAS A PROMPT INDEX, RECONCILE THE ROW AGAINST THE PAGE — the row
     is what gets read first, and it rots on a different clock.**

    Step 26a makes the next prompt *reachable*. This makes it *true*. Many repos keep
    a one-row-per-prompt index (`docs/handoffs/next_session_prompt.md` or similar)
    whose rows carry a summary and a status. **A row and the page it links to are two
    copies of the same claim, maintained by different sessions at different times, and
    the row is the one a fresh session reads first.** Nothing makes them agree.

    Measured on 2026-08-07, both rows on the same index, wrong in **opposite**
    directions while both prompt pages were current:

    | row said | reality | what it cost a reader |
    |---|---|---|
    | "what is left is four files and five ledger entries, verified absent from `main`" | all four present; the page's own foot said *"the file restoration is finished"* | **advertised finished work as the remaining work**, so the actual remainder — a content audit — went unadvertised |
    | "expect `main` to be red for reasons of its own (#839)" | #839 closed, `main` measured green | **pre-authorised the reader to ignore red**, which is how a real failure gets waved through |

    The first is the ordinary direction. **The second is the dangerous one**, because a
    stale "expect it to be broken" does not merely misinform — it disables a check.
    Treat any row that lowers a future reader's guard as load-bearing.

    Three checks, cheap:

    ```bash
    # 1. Does the row's headline claim still hold? Re-derive it, don't re-read it.
    #    "four files are missing" -> list them at origin/main
    #    "main is red"            -> run the suite, or check the issue is still open

    # 2. Does the row AGREE with its own page? A page corrected at its foot while the
    #    row kept the superseded summary is the normal failure, not a rare one.
    grep -n "<the row's key figure>" <the page it links to>

    # 3. Grep the FIGURE across the repo, not just the row you were looking at.
    #    The same sentence is usually pasted into a ledger entry as well.
    grep -rn "<the stale phrase>" docs/ <ledger file>
    ```

    **And when you close an item, the row is part of closing it.** A row still marked
    live for a merged PR sends the next session to a branch that no longer exists —
    the same shape as an issue telling its reader to extend a file that has since been
    deleted. If your session finished something the index advertises, fix the row in
    the same PR, and say what is left instead of deleting the row.

    **Structural version of the same defect, worth one look while you are there: is
    the page's remaining work at the TOP?** A prompt that grows by appending dated
    corrections ends up as a long finished job with the live work in a coda after the
    archive. A reader working top-down re-runs the completed part. If that has
    happened, lead with what is left and demote the finished half to an archive
    section, keeping only the warnings that earned their place.

26. **Final confirmation** to user: list all artifacts produced, grouped by bucket

26a. **Emit the next-session prompt's PATH as a copy-pasteable block — not as prose.**

    The user's next action after reading your summary is to open a fresh session and
    point it at the prompt. If the only mention of that prompt is a prose phrase like
    *"the S386 next-session prompt"* or *"see the next-session prompt"*, they cannot do
    that without going back and grepping `docs/handoffs/` for a filename you already
    knew. This is a **hard requirement**, not a nicety — a prompt that exists but is
    unreachable is a prompt that did not get written.

    Close the summary with a fenced block containing the **repo-relative path**, alone,
    so it can be selected and pasted in one action:

    ```
    docs/handoffs/2026-08-06-s386-next-session-prompt-deferred-recuts.md
    ```

    Rules:
    - **Fenced block, on its own.** Not inline backticks inside a sentence, not a
      markdown link, not a table cell — those are all harder to select cleanly on
      mobile, which is where handoffs are most often read.
    - **Repo-relative**, exactly as it would be typed to a fresh session. Not the
      absolute worktree path (which is wrong in any other checkout), not the bare
      filename (which is not openable).
    - **Verify it resolves before you print it** — `ls <path>` — and, if the session
      committed it, that the commit landed (`git log --oneline -1 -- <path>`). Printing
      a path that 404s is worse than printing none.
    - **More than one prompt?** Print the primary first, labelled, then the parallel
      ones, each in its own block, and say in one line which to start with and why.
    - **No prompt written?** Print, in the same slot, the reason —
      `no next-session prompt — stream closed, no recommended next action` — so the
      absence reads as deliberate rather than forgotten.

    Suggested framing (adapt the wording, keep the shape):

    > **Start your next session with:**
    >
    > ```
    > docs/handoffs/<the-file>.md
    > ```

### Phase 5: Consolidate (when 3+ handoffs exist)

This phase runs automatically when 3+ handoff docs are detected, or when the user
explicitly asks to consolidate. It merges overlapping information from parallel
sessions into a single authoritative plan.

26. **Gather all sources** — read in parallel:
    - All handoff docs (`docs/handoffs/session*_handoff.md`)
    - PR status (`gh pr list --state all --limit 20 --json number,title,state,mergedAt`)
    - Memory files (MEMORY.md, sessions_archive, lessons)
    - Any status/findings docs

27. **Track decision supersession** — build a timeline across sessions:
    - Mark each decision as **OPEN**, **RESOLVED**, or **SUPERSEDED**
    - For superseded decisions, note which later session reversed it and why
    - Use strikethrough + resolution notes for resolved items:
      ```
      ~~Token storage in localStorage?~~ RESOLVED (Session 5). httpOnly cookies for XSS protection.
      ```

28. **Map experiments and identify gaps** — cross-check every "What Needs To Happen Next"
    section from every handoff against what actually happened:
    - Promised work that was never started
    - Planned validations that were skipped
    - Integration items that were deferred and forgotten
    - Branch cleanup that accumulated across sessions

29. **Write consolidated plan** -> `docs/plans/future_sessions_plan.md`
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

30. **Verify all claims are current** — for each claim in the consolidated plan:
    - Is the PR status current? (`gh pr view N --json state`)
    - Are branch references still valid? (`git branch -a`)
    - Have any deferred items been completed without updating the plan?

### Phase 6: User-facing recap — a `show-and-tell` page, then the chat summary

After Phases 0-5 produce the persisted artefacts (handoff doc + buckets + PR),
deliver a **separate, user-facing explanation** of what the session actually did.
This is for the human, not for Claude: handoff docs are written for *a future
session* (dense, technical, complete), and the person reading needs a different
register — what changed, why it matters, what they should check themselves.

30a. **Build a `show-and-tell` page — REQUIRED on any session with substantive
     findings, and it comes BEFORE the chat recap.**

    Standing instruction from the owner, 2026-08-07: *"please make sure for all
    sessions running in this repo, using show and tell to explain a session's
    work is always part of the session-handoff ritual."*

    A chat recap scrolls away and cannot be re-read next week; a handoff doc is
    written in a register the owner has explicitly asked us not to use on him.
    The `show-and-tell` skill produces the third thing: a self-contained HTML
    explainer in plain English, built on one everyday metaphor, with the real
    numbers beside each plain claim, an engineer's-note layer so technical
    readers are not shortchanged, a foregrounded limits box, and a bundled
    fact-verifier that checks every claim back against the source documents.

    - **Load the `show-and-tell` skill and follow it** — do not hand-roll a
      "summary page", which is how the honesty box and the fact-verifier get
      dropped.
    - **Commit it to `docs/deliverables/`** (bucket 7) and register it as an
      artifact in the project tracker, like any other deliverable.
    - **If the session also ends in owner decisions**, put the `promptback`
      widgets INSIDE this page under each question's own context (step 17b) —
      not in a second document.
    - **Run its fact-verifier before shipping.** A plain-English translation is
      exactly where a number drifts: the whole point is re-wording, and re-wording
      is when "9.58 km" quietly becomes "under 10 km" becomes "about 8".

    **Skip only when the session produced nothing a non-specialist would care
    about** — pure repo hygiene, a one-line revert, tracker reconciliation. Then
    say so in one line rather than manufacturing a page.

31-35 below are the CHAT recap, which still happens: the page is what the owner
keeps, the chat is what they read before closing the session. Where the session
shipped user-visible product changes, keep the chat recap framed as "shipped
change → what you'll see"; where it shipped findings rather than features, let
the chat recap be short and point at the page.

31. **Structure the recap as "shipped change → user-visible effect"**, one
    section per merged PR or material change. Skip purely internal work
    (tracker entries, repo hygiene, doc-only PRs) — those don't surface to
    the user.

    For each change, write 2-4 lines covering:
    - **Where to look** (which page / route / drawer / report)
    - **Before vs. after**, framed in what the user actually perceived (not
      class names, not SQL — what they SAW)
    - Optional: any caveat (e.g. "no visible change but cleaner codebase")

32. **Group by venue, not by PR**, when multiple PRs land on the same page.
    If three PRs all changed `/drivers`, write one `/drivers` recap section
    summarising the net visible delta — not three sequential sections that
    force the user to mentally compose.

33. **Mention the baker / pipeline run if you ran one.** "Baked payload
    refreshed on `<job-name>` — the new labels are live now, not waiting
    for the nightly bake." This closes the loop on "did the change
    actually reach my eyes" — without it, the user wonders whether they're
    looking at fresh data.

34. **Flag pre-existing failures as pre-existing.** If a test failed both
    before and after your work, say so explicitly in the recap. Otherwise
    the user assumes you introduced it.

35. **Skip the recap when the work is purely internal.** If the session was
    e.g. memory-hygiene + skill edits + tracker reconciliation with zero
    product-visible changes, just say so in one line: "Session was
    internal-only — no live-dashboard impact." Don't manufacture user-
    facing prose for backend hygiene.

**Template** (use as scaffolding; collapse sections that don't apply):

```markdown
## 🌐 What you'll see in the live dashboard

### <Venue 1, e.g. `/drivers` chevron — `Days Since FAFSA` row>
- **Before:** <what the user used to see>
- **After:** <what the user sees now>
- <optional caveat>

### <Venue 2 — group multiple related PRs on the same page together>
...

### Baker / pipeline run *(only if you ran one)*
<job name> succeeded — <what's now live without waiting>.

### Notes
- <pre-existing failures you verified weren't introduced>
- <anything the user should sanity-check themselves>
```

**Anti-patterns for the recap:**

- ❌ Listing PR numbers + commit SHAs as the structure (that's the handoff doc's job)
- ❌ Quoting class names, function names, or SQL — user doesn't care
- ❌ "We shipped 4 PRs" with no per-PR what-they'll-see — useless
- ❌ Skipping the baker / pipeline run note when one was triggered
- ❌ Manufacturing user-visible prose for internal-only sessions

**Good signal:** the recap reads like release notes for someone who didn't
follow the session — not like a status update for someone who did.

## Output format

Present a bucket-grouped summary table at the end. Leave rows blank ("—") for buckets
the session didn't touch — don't fabricate entries.

| Bucket / artifact | Status |
|---|---|
| `docs/decisions/` (ADRs) | N new (NNNN-NNNN), M updated — or "—" |
| `docs/runbooks/` | N new/updated — or "—" |
| `docs/analysis/` | N new/updated — or "—" |
| `docs/references/` | N new/updated — or "—" |
| `docs/reviews/` | N new/updated — or "—" |
| **Review findings (P0/P1/P2 caught + reviewer)** | **N findings (n fixed / n documented / n rejected) — table in handoff §7 + usage record; or "— (no review ran)"** |
| `docs/handoffs/` | `session_N_handoff.md` (always) + the next-session prompt **written or REFRESHED** — naming which, and never just cited (else note "no next-session prompt — stream closed") (+ parallel prompts if any) |
| **Next-session prompt PATH (step 26a)** | **REQUIRED and NOT blankable — the repo-relative path in its own fenced block, `ls`-verified, so the user can paste it into a fresh session in one action. A prose reference ("the S386 prompt") does NOT satisfy this. If no prompt was written, print the reason in this slot instead.** |
| `docs/deliverables/` | N new artifacts — or "—" |
| **`show-and-tell` explainer (step 30a)** | **REQUIRED and NOT blankable on any session with substantive findings — the committed `docs/deliverables/*.html` path, fact-verifier run, registered as a tracker artifact. Or explicit "— (nothing a non-specialist would care about)". A chat recap does NOT satisfy this: it scrolls away, and the handoff doc is written in the register the owner asked us not to use on him** |
| `docs/plans/future_sessions_plan.md` | Updated / consolidated (if Phase 5) |
| **Project tracker / ledger (step 14)** | **ALL parts of its own ritual + validator green — or explicit "— (no tracker in this repo)". Name the parts that outlive the wrap-up: PR chip pending merge, successor task filed** |
| `memory/lessons.md` | N new (total: M) |
| `memory/sessions_archive.md` | Updated — bucket footprint noted |
| `MEMORY.md` index | Updated |
| **Session usage record (step 24c)** | **REQUIRED — `~/.claude/usage-tracking/<date>_<sid8>_<project>.{json,md}` written (cost $X, N subagents) or explicit "skipped: <reason>"** |
| **Skills improved (step 24e)** | Per skill invoked: version bump + what changed, or "no change — nothing learned that generalises". If a cache/source diff was non-empty, say so and how it was reconciled |
| **Doc-freshness reverse-lint (step 24)** | **REQUIRED and NOT blankable — one of: "clean (N files scanned)" with N ≥ 1 / "N candidates surfaced in handoff doc" / "skipped: `<reason>`". "Clean" asserts the lint RAN and found nothing; if the resolver missed, or BASE was not a revision, or zero files were scanned, it is **skipped**, not clean** |
| PR | `#N` — merged / open for review. **If the tracker card was written before the PR existed, say the chip is still owed and go back for it once it merges** |
| **PR-to-card enumeration (step 25a)** | **REQUIRED — "N PRs merged this session, all N on a card" with the numbers, or the ones you went back and added. Never "the chips look right"** |
| **Own-work survival check (step 25c)** | **REQUIRED and NOT blankable — "N files + M ledger entries re-verified present on `origin/main` after the last merge", naming what you re-checked. "The PR merged green" is NOT this check** |
| **Prompt cold-start check (step 25b)** | **REQUIRED — "reads standalone: context section + verified paths + owner-only section", or "no prompt: <reason>"** |
| Git status | All committed and pushed |

> **Six rows are NOT blankable — the usage record, the next-session prompt PATH, the two closing checks, the reverse-lint, and the `show-and-tell` explainer.**
> The reverse-lint row joined them on 2026-08-06: the step had been dead on every plugin-scope
> install (wrong root) *and* on every install (a literal `HEAD~N` scanned zero files), yet the
> table only offered "Clean / N candidates" — so a step that never ran was written up as clean.
> Steps 25a and 25b exist because on 2026-08-05 a session presented a complete
> wrap-up and the owner's follow-up question — *"is everything in the tracker, and
> would the next session know everything?"* — found a real gap on **both** halves.
> Neither is visible from inside the artifacts you just wrote: a card cannot know
> about a PR that merged after it, and you cannot judge whether a prompt stands
> alone while holding the context it omits. **If either cell is empty when you
> reach this table, go back and run step 25 before presenting.**

> **The "Session usage record" row is NOT blankable** — it is the forcing function for step 24c,
> which is otherwise easy to drop (it's a nested step late in Phase 4, after the PR merge, and the
> Phase 6 recap reads as the "finale" — the classic `multi-agent-skill-silent-phase-compression`
> tail-drop). You must either cite the written record path **or** state "skipped: <reason>". If you
> reach this table and the cell is empty, go back and run step 24c before presenting.

## Anti-patterns

- **Don't concatenate handoff docs** — the value of consolidation is resolving conflicts and surfacing gaps, not appending
- **Don't assume handoff docs are current** — check git/PR status for every claim
- **Don't keep resolved decisions as open** — clutters the decision queue
- **Don't hardcode test counts or line counts** — they go stale immediately; use "as of PR #N" instead
- **Don't skip the lessons scan** — debugging patterns are the most valuable long-term knowledge
- **Don't write "see above" in next-session prompts** — they must be paste-ready with full context
- **Don't refer to the next-session prompt only by nickname.** "The S386 prompt", "the next-session
  prompt", "see the handoff" — none of these is openable. The user's next action is to paste a path
  into a fresh session; if your summary doesn't contain that path in a selectable block, you have
  made them grep `docs/handoffs/` for a filename you already knew. **Naming a prompt is not
  delivering it** (step 26a)

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

## Review findings (panel ran — PR #15)
| Severity | Finding | Caught by (persona · speciality) | Disposition |
|---|---|---|---|
| P1 | Token refresh race under concurrent requests | Correctness Hawk · `voltagent-qa-sec:code-reviewer` | Fixed `a1b2c3d` |
| P2 | Error messages leak the auth provider name | Security Auditor · `voltagent-qa-sec:security-auditor` | Fixed `a1b2c3d` |
| P3 | Suggest extracting the cookie helper | Architecture Critic · `voltagent-qa-sec:architect-reviewer` | Deferred (backlog #31) |

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

**When any queue entry is the OWNER's rather than a future session's, the entry
points at the tickable page instead of restating the question** (step 17b):

```markdown
## Decision Queue

1. **Four shape decisions — waiting on the owner's ticks.**
   `docs/deliverables/<report>.html` — tick on the page, hit "Copy my decisions as
   a prompt", paste the result back. The page carries the case for and against each
   one; do not re-ask them here, or the answer lands in two places.
2. **Should we add WebSocket support?** — OPEN, a future session's to settle.
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
- **Optional (recommended):** the `doc-freshness-reverse-lint` skill. Phase 4 step 24 resolves its
  `reverse_lint.py` at **two** locations, in order:
  1. `$HOME/.claude/skills/doc-freshness-reverse-lint/scripts/reverse_lint.py` — git-clone or
     personal-scope install
  2. `$HOME/.claude/plugins/cache/*/doc-freshness-reverse-lint/*/scripts/reverse_lint.py` — plugin
     install, highest version wins

  Resolution is done by the bundled `scripts/resolve_dep.sh`, not inline: `CLAUDE_PLUGIN_ROOT`
  points at *this* plugin's root and cannot reach a sibling plugin. Both roots are required,
  because a plugin install never creates the `~/.claude/skills/` path — checking only the first
  made an installed plugin report as missing. Version ranking is on the version segment alone,
  so a second marketplace cannot make an older copy win. If neither root resolves, step 24 logs
  the roots it tried, reports the step as **skipped**, and continues. Install from
  `https://github.com/wan-huiyan/claude-ecosystem-hygiene/tree/main/plugins/doc-freshness-reverse-lint`.
- **Taxonomy source of truth:** `memory-hygiene` v3.1+ defines the 7-bucket `docs/` taxonomy.
  Run `memory-hygiene` with `--migrate` if the target project's `docs/` has drifted from the taxonomy
  (loose files at `docs/*`, non-canonical subdirs, `handoff/` + `handoffs/` duplicates, etc.).

### Scope Boundaries

- **Use this skill when** wrapping up a work session or consolidating after parallel sessions
- **Do NOT use for** mid-session progress updates (just use git commits)
- **Hand off to** `memory-hygiene` for deep memory cleanup beyond what Phase 4 covers, and for
  full `docs/` taxonomy audits / migration branches
- **Hand off to** `doc-freshness-reverse-lint` (invoked automatically in Phase 4 step 24) for
  catching stale normative guidance in project docs after memory updates

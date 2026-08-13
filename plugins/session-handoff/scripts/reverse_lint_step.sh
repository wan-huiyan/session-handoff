#!/bin/sh
# Phase 4 step 24 — doc-freshness reverse-lint, as an executable rather than a snippet.
#
#   usage: reverse_lint_step.sh [BASE]
#     BASE  a real commit-ish this session started from. Defaults to $SESSION_BASE_SHA,
#           then HEAD~1, then HEAD.
#
# Prints exactly one status line, always, in one of three shapes:
#   reverse-lint: clean (N file(s) scanned)
#   reverse-lint: N candidate(s) — see output above
#   reverse-lint: SKIPPED — <reason>
#
# WHY THIS IS A SCRIPT AND NOT A SNIPPET IN SKILL.md
#   This logic shipped as a fenced bash block for several releases. Nothing executed it,
#   so it was only ever checked by regex. Two defects lived there undetected:
#     - it reached a sibling plugin's script through a single hardcoded root, so the step
#       was dead on every plugin-scope install, and
#     - it ran `git diff --name-only HEAD~N..HEAD` with N never substituted, so git exited
#       128 and the loop body ran zero times on EVERY install.
#   Both were then reported as "clean". A block that only a human reads is a block whose
#   bugs only a human catches; as a script it is testable, and it is tested.
#
# The clean/skipped distinction is the point. "Clean" asserts the lint RAN and found
# nothing. If it could not run, or scanned nothing, that is SKIPPED — never clean.

set -u

if [ -z "${HOME:-}" ]; then
  echo "reverse-lint: SKIPPED — HOME is not set"
  exit 0
fi

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RESOLVE="$HERE/resolve_dep.sh"

if [ ! -f "$RESOLVE" ]; then
  echo "reverse-lint: SKIPPED — resolve_dep.sh missing beside $0"
  exit 0
fi

if ! RL=$(sh "$RESOLVE" doc-freshness-reverse-lint scripts/reverse_lint.py 2>&1); then
  # $RL holds the resolver's stderr, which names every root it tried.
  echo "reverse-lint: SKIPPED — $RL"
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "reverse-lint: SKIPPED — not a git repository"
  exit 0
fi

BASE="${1:-${SESSION_BASE_SHA:-}}"
if [ -z "$BASE" ]; then
  BASE=$(git rev-parse --verify --quiet HEAD~1 2>/dev/null || git rev-parse --verify HEAD 2>/dev/null || true)
fi

if [ -z "$BASE" ] || ! git rev-parse --verify --quiet "$BASE" >/dev/null 2>&1; then
  echo "reverse-lint: SKIPPED — BASE '$BASE' is not a revision (a literal HEAD~N does this)"
  exit 0
fi

# BASE resolving is not the same as BASE being on this branch's history. Step 20's
# rebuild (reset --hard + cherry-pick) destroys that property outright, and nothing
# here can restore it — so the diff below uses three dots, which asks "what has this
# branch done since the fork point" instead of "how do these two tips differ". The two
# forms are identical whenever BASE IS an ancestor, which is the contracted case; where
# they differ, two dots reports main's own newer files as though this session deleted
# them. Three dots need a fork point to exist at all, so check for one first rather than
# let an erroring diff pass for an empty one.
if ! git merge-base "$BASE" HEAD >/dev/null 2>&1; then
  echo "reverse-lint: SKIPPED — BASE '$BASE' shares no history with HEAD"
  exit 0
fi

# Four sources, because a lessons file written this session may be in any of them:
#   committed since BASE · staged but not committed · modified but not staged ·
#   created and never added.
# The fourth is the most common case for a brand-new lessons.md, and neither form of
# `git diff` lists untracked files. The staged form must also be explicit: plain
# `git diff --name-only` compares the worktree to the index and omits index-only edits.
FILES=$(
  {
    git diff --name-only "$BASE"...HEAD 2>/dev/null
    git diff --cached --name-only 2>/dev/null
    git diff --name-only 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } |
  grep -E '(lessons|axioms|feedback_.*)\.md$' |
  sort -u
)

if [ -z "$FILES" ]; then
  echo "reverse-lint: SKIPPED — no lessons/axioms/feedback files changed since $BASE"
  exit 0
fi

SCANNED=0
CANDIDATES=0
OLD_IFS=$IFS
IFS='
'
for memfile in $FILES; do
  [ -f "$memfile" ] || continue
  SCANNED=$((SCANNED + 1))
  if ! python3 "$RL" "$memfile" --project-root "$(pwd)" --human; then
    CANDIDATES=$((CANDIDATES + 1))
  fi
done
IFS=$OLD_IFS

if [ "$SCANNED" -eq 0 ]; then
  echo "reverse-lint: SKIPPED — every candidate file has since disappeared from the worktree"
elif [ "$CANDIDATES" -gt 0 ]; then
  echo "reverse-lint: $CANDIDATES candidate(s) — see output above"
else
  echo "reverse-lint: clean ($SCANNED file(s) scanned)"
fi
exit 0

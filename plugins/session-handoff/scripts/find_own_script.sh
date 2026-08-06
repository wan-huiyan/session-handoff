#!/bin/sh
# Locate a script bundled with session-handoff ITSELF.
#
#   usage: find_own_script.sh <script-name>
#   e.g.   find_own_script.sh resolve_dep.sh
#
# Prints the absolute path on stdout, exit 0. On failure prints the roots tried to
# stderr, exit 1. Usage error, exit 2.
#
# WHY THIS EXISTS — this is the bootstrap, and it had the same bug as everything else.
#   session-handoff's steps used to locate their own bundled scripts with two checks:
#     ${CLAUDE_PLUGIN_ROOT}/scripts/<name>
#     $HOME/.claude/skills/session-handoff/scripts/<name>
#   On a plugin-scope install CLAUDE_PLUGIN_ROOT is frequently unset in the shell the
#   step actually runs in, and ~/.claude/skills/session-handoff does not exist at all —
#   the plugin lives at ~/.claude/plugins/cache/<mkt>/session-handoff/<version>/. So the
#   lookup missed and the step reported itself skipped.
#
#   That is worth stating plainly: fixing how we find a SIBLING plugin's script
#   (resolve_dep.sh) accomplished nothing while the code that finds resolve_dep.sh
#   carried the identical defect one level up.
#
# This script is the one thing that cannot resolve itself, so callers inline a three-root
# lookup for it. Everything else goes through it, or through resolve_dep.sh.

set -u

if [ $# -ne 1 ]; then
  echo "usage: find_own_script.sh <script-name>" >&2
  exit 2
fi

NAME="$1"

if [ -z "${HOME:-}" ]; then
  echo "find_own_script.sh: HOME must be set" >&2
  exit 2
fi

PLUGIN_ROOT_TRY="${CLAUDE_PLUGIN_ROOT:-}"
if [ -n "$PLUGIN_ROOT_TRY" ] && [ -f "$PLUGIN_ROOT_TRY/scripts/$NAME" ]; then
  printf '%s\n' "$PLUGIN_ROOT_TRY/scripts/$NAME"
  exit 0
fi

PERSONAL="$HOME/.claude/skills/session-handoff/scripts/$NAME"
if [ -f "$PERSONAL" ]; then
  printf '%s\n' "$PERSONAL"
  exit 0
fi

CACHE_ROOT="$HOME/.claude/plugins/cache"
BEST=""
if [ -d "$CACHE_ROOT" ]; then
  BEST=$(
    find -L "$CACHE_ROOT" -mindepth 3 -maxdepth 3 -type d 2>/dev/null |
    while IFS= read -r vdir; do
      parent=${vdir%/*}
      [ "${parent##*/}" = "session-handoff" ] || continue
      [ -f "$vdir/scripts/$NAME" ] || continue
      ver=${vdir##*/}
      key=${ver#v}
      # Leading '(' balances the parens for the $( ) parser; bash rejects the bare
      # "[0-9]*)" form inside a command substitution.
      case $key in
        ([0-9]*) rank=1 ;;
        (*)      rank=0 ;;
      esac
      printf '%s%s\t%s\n' "$rank" "$key" "$vdir/scripts/$NAME"
    done |
    sort -V -k1,1 |
    tail -1 |
    cut -f2-
  )
fi

if [ -n "$BEST" ] && [ -f "$BEST" ]; then
  printf '%s\n' "$BEST"
  exit 0
fi

printf '%s: not found — tried %s, %s, and %s/*/session-handoff/*/scripts/%s\n' \
  "$NAME" \
  "${PLUGIN_ROOT_TRY:+$PLUGIN_ROOT_TRY/scripts/$NAME}${PLUGIN_ROOT_TRY:-\$CLAUDE_PLUGIN_ROOT (unset)}" \
  "$PERSONAL" "$CACHE_ROOT" "$NAME" >&2
exit 1

#!/bin/sh
# Resolve a script that ships inside ANOTHER Claude Code plugin.
#
#   usage: resolve_dep.sh <plugin-name> <relative-path>
#   e.g.   resolve_dep.sh doc-freshness-reverse-lint scripts/reverse_lint.py
#
# Prints the resolved absolute path on stdout, exit 0.
# On failure prints the roots it tried to stderr, exit 1 — never a bare
# "not installed", which is a claim about install state rather than about lookup.
#
# WHY THIS EXISTS
#   CLAUDE_PLUGIN_ROOT points at THIS plugin's own root, so it cannot reach a
#   sibling plugin. A dependency may be installed either of two ways:
#
#     git clone / personal scope : $HOME/.claude/skills/<plugin>/<relpath>
#     plugin marketplace         : $HOME/.claude/plugins/cache/<marketplace>/<plugin>/<version>/<relpath>
#
#   session-handoff checked only the first. On a plugin install the path missed,
#   the caller logged "not installed", and the step silently did nothing while the
#   handoff still read as clean. A human then read that log as proof the skill was
#   absent — it had been installed the whole time.
#
# THREE THINGS THIS GETS RIGHT THAT AN INLINE GLOB DID NOT
#   1. Sorts on the VERSION segment alone. The marketplace directory precedes the
#      version in the path, so `sort -V` over whole paths ranks by marketplace name
#      and lets an older copy win (aaa-mkt/2.5.0 loses to zzz-mkt/1.0.0).
#   2. Uses `find`, not a shell glob. zsh's `nomatch` fails a non-matching glob at
#      expansion time, before `2>/dev/null` can apply, printing a raw shell error.
#   3. Survives spaces in $HOME and in the resolved path.

set -u

if [ $# -ne 2 ]; then
  echo "usage: resolve_dep.sh <plugin-name> <relative-path>" >&2
  exit 2
fi

PLUGIN="$1"
RELPATH="$2"

# Explicit, so the status is ours rather than the shell's: `${HOME:?}` aborts with
# 1 under bash and 2 under dash, and dash is /bin/sh on the Linux CI runner.
if [ -z "${HOME:-}" ]; then
  echo "resolve_dep.sh: HOME must be set" >&2
  exit 2
fi

PERSONAL="$HOME/.claude/skills/$PLUGIN/$RELPATH"
CACHE_ROOT="$HOME/.claude/plugins/cache"

# 1. git-clone / personal-scope install wins when present: it is what a developer
#    working on the dependency has checked out, and it should shadow the cache.
if [ -f "$PERSONAL" ]; then
  printf '%s\n' "$PERSONAL"
  exit 0
fi

# 2. Plugin cache: cache/<marketplace>/<plugin>/<version>/<relpath>.
#    Emit "<version>\t<path>" per candidate, version-sort on field 1, take the max.
BEST=""
if [ -d "$CACHE_ROOT" ]; then
  # -L so a symlinked marketplace/plugin/version segment is still seen: pointing the
  # cache at a local checkout of a dependency is an ordinary thing to do while testing,
  # and without -L that install resolves as "not found".
  BEST=$(
    find -L "$CACHE_ROOT" -mindepth 3 -maxdepth 3 -type d 2>/dev/null |
    while IFS= read -r vdir; do
      parent=${vdir%/*}
      [ "${parent##*/}" = "$PLUGIN" ] || continue
      [ -f "$vdir/$RELPATH" ] || continue
      # Rank digit first so a non-numeric directory ("main", "dev") cannot outrank a
      # release: sort -V puts leading-alphabetic keys AFTER numeric ones, which would
      # otherwise hand the caller an in-development script with no signal. A leading
      # "v" is stripped so the common v1.3.0 tag convention sorts with its peers.
      ver=${vdir##*/}
      key=${ver#v}
      # Leading '(' balances the parens for the $( ) parser; bash rejects the bare
      # "[0-9]*)" form inside a command substitution.
      case $key in
        ([0-9]*) rank=1 ;;
        (*)      rank=0 ;;
      esac
      printf '%s%s\t%s\n' "$rank" "$key" "$vdir/$RELPATH"
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

printf '%s: not found — tried %s and %s/*/%s/*/%s\n' \
  "$PLUGIN" "$PERSONAL" "$CACHE_ROOT" "$PLUGIN" "$RELPATH" >&2
exit 1

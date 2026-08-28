#!/usr/bin/env bash
#
# check-upstreams.sh — report whether the vendored upstreams have new commits
# beyond the baseline recorded in NESTED_REPOS_ORIGINS.txt.
#
# PiP is a flat single repo: the vendored subtrees (pi + plugins) have their
# nested .git removed, so we can't diff against a live clone. Instead we treat
# NESTED_REPOS_ORIGINS.txt as the source of truth for "what commit each vendor
# was flattened from", and compare it against the upstream tip via
# `git ls-remote` (git repos) or the npm registry (pi-web).
#
# Usage:
#   scripts/check-upstreams.sh            # report status
#   scripts/check-upstreams.sh --update   # rewrite the recorded git baselines
#                                         # to the current upstream tips
#
# Nothing here touches the working tree except --update, which only edits
# NESTED_REPOS_ORIGINS.txt (review the diff before committing).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGINS="$ROOT/NESTED_REPOS_ORIGINS.txt"
UPDATE=0
[ "${1:-}" = "--update" ] && UPDATE=1

if [ ! -f "$ORIGINS" ]; then
  echo "error: $ORIGINS not found" >&2
  exit 1
fi

# path -> upstream git URL (branch to check). pi-web is npm, handled separately.
declare -a GIT_ROWS=(
  "./pi|https://github.com/earendil-works/pi.git|main"
  "./plugins/pi-mcp-adapter|https://github.com/nicobailon/pi-mcp-adapter.git|main"
  "./plugins/pi-subagents|https://github.com/nicobailon/pi-subagents.git|main"
  "./plugins/pi-web-access|https://github.com/nicobailon/pi-web-access.git|main"
)

# recorded baseline for a given "./path" prefix in the origins file
recorded_head() {
  local path="$1"
  grep -E "^${path}[[:space:]]" "$ORIGINS" | grep -oE 'head=[^[:space:]]+' | head -1 | sed 's/^head=//'
}

behind=0
updated=0

echo "== vendored git upstreams =="
for row in "${GIT_ROWS[@]}"; do
  IFS='|' read -r path url branch <<< "$row"
  base="$(recorded_head "$path")"
  tip="$(git ls-remote "$url" "refs/heads/$branch" 2>/dev/null | awk '{print $1}')"
  [ -z "$tip" ] && tip="$(git ls-remote "$url" HEAD 2>/dev/null | awk '{print $1}')"

  name="${path##*/}"
  if [ -z "$tip" ]; then
    printf "  %-16s baseline=%s  upstream=UNREACHABLE\n" "$name" "${base:0:10}"
    continue
  fi
  if [ "$tip" = "$base" ]; then
    printf "  %-16s baseline=%s  ✓ up to date\n" "$name" "${base:0:10}"
  else
    printf "  %-16s baseline=%s  ⟳ upstream=%s (new commits)\n" "$name" "${base:0:10}" "${tip:0:10}"
    behind=$((behind+1))
    if [ "$UPDATE" -eq 1 ]; then
      # replace head=<old> on the line starting with this exact path
      tmp="$(mktemp)"
      awk -v p="$path" -v new="$tip" '
        $1==p { sub(/head=[^ \t]+/, "head=" new) }
        { print }
      ' "$ORIGINS" > "$tmp" && mv "$tmp" "$ORIGINS"
      updated=$((updated+1))
    fi
  fi
done

echo
echo "== npm-vendored (pi-web) =="
web_recorded="$(recorded_head "./plugins/pi-web")"   # e.g. "v0.8.11 (npm ...)"
web_ver="$(printf '%s' "$web_recorded" | grep -oE 'v?[0-9]+\.[0-9]+\.[0-9]+' | head -1 | sed 's/^v//')"
web_latest="$(npm view @agegr/pi-web version 2>/dev/null)"
if [ -z "$web_latest" ]; then
  printf "  %-16s vendored=%s  npm=UNREACHABLE\n" "pi-web" "${web_ver:-?}"
elif [ "$web_ver" = "$web_latest" ]; then
  printf "  %-16s vendored=%s  ✓ up to date\n" "pi-web" "$web_ver"
else
  printf "  %-16s vendored=%s  ⟳ npm=%s (newer published)\n" "pi-web" "${web_ver:-?}" "$web_latest"
  behind=$((behind+1))
fi

echo
if [ "$UPDATE" -eq 1 ]; then
  echo "updated $updated git baseline(s) in NESTED_REPOS_ORIGINS.txt — review 'git diff' before committing."
  echo "(note: --update only records that upstream moved; it does NOT re-vendor the code.)"
fi
if [ "$behind" -eq 0 ]; then
  echo "all vendored upstreams are at their recorded baseline."
else
  echo "$behind upstream(s) have moved past the recorded baseline."
fi

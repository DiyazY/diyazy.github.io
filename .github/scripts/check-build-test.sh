#!/usr/bin/env bash
#
# Feeds check-build.sh deliberately bad inputs and asserts it fails with the
# right message, so a check that quietly stopped failing gets noticed. Runs
# against a copy of a real build; the site itself is never modified.
#
# Usage: ./.github/scripts/check-build-test.sh [site_dir]

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="${1:-$REPO/_site}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fails=0
# expect_fail <name> <posts.json content> <abort message check-build must report>
# Matches only check-build's own "FAIL  posts.json invalid: <message>" line, so
# text echoed inside a Ruby error dump can't count as a catch.
expect_fail() {
  rm -rf "$work/site" && cp -R "$SITE" "$work/site"
  printf '%s' "$2" > "$work/site/posts.json"
  if env -u CHECK_ALLOW_FUTURE "$REPO/.github/scripts/check-build.sh" "$work/site" > "$work/out" 2>&1; then
    printf '  FAIL  %s: check-build.sh passed\n' "$1"; fails=$((fails + 1))
  elif grep -F 'FAIL' "$work/out" | grep -qF -- "posts.json invalid: $3"; then
    printf '  ok    %s\n' "$1"
  else
    printf '  FAIL  %s: expected "%s" in:\n' "$1" "$3"; grep 'FAIL' "$work/out" | sed 's/^/          /'
    fails=$((fails + 1))
  fi
}

entry() { # entry <url> <date> [title]
  printf '{"url":"%s","path":"/a.html","title":"%s","description":"d","date":"%s"}' "$1" "${3-A}" "$2"
}
ok_date='2020-01-01T00:00:00+00:00'

echo "Testing check-build.sh against bad posts.json fixtures"
expect_fail "future-dated entry" "[$(entry https://diyaz.dev/a.html 2099-01-01T00:00:00+00:00)]" "entry 0 is future-dated"
expect_fail "unreadable date" "[$(entry https://diyaz.dev/a.html soon)]" "entry 0 date not ISO 8601"
expect_fail "url off-site" "[$(entry https://example.com/a.html "$ok_date")]" "entry 0 url not on https://diyaz.dev/"
expect_fail "missing title" "[$(entry https://diyaz.dev/a.html "$ok_date" '')]" "entry 0 missing title"
expect_fail "not an array" '{}' "not an array"
expect_fail "empty list" '[]' "empty"
eleven="$(for i in 1 2 3 4 5 6 7 8 9 10 11; do entry https://diyaz.dev/a.html "$ok_date"; [ "$i" -lt 11 ] && printf ,; done)"
expect_fail "more than 10 entries" "[$eleven]" "11 entries (max 10)"

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails fixture(s) not caught"
  exit 1
fi
echo "all fixtures caught"

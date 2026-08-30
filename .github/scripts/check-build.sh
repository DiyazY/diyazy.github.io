#!/usr/bin/env bash
#
# Post-build assertions on _site/. Run after `jekyll build`.
#
# A successful build is not enough on its own: Liquid failures in this repo tend
# to be silent. A bad `{{ }}` renders as empty text, and losing the `layout: null`
# front matter on llms.txt wraps a plain-text file in HTML. Both ship green.
#
# Usage: ./.github/scripts/check-build.sh [site_dir]

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="${1:-$REPO/_site}"
PROJECTS_DATA="$REPO/_data/projects.yml"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

fails=0
fail() { printf '  FAIL  %s\n' "$1"; fails=$((fails + 1)); }
pass() { printf '  ok    %s\n' "$1"; }

echo "Checking $SITE"

# --- files exist and are non-empty ---------------------------------------
for f in llms.txt projects.html about.html index.html feed.xml search.json; do
  if [ -s "$SITE/$f" ]; then
    pass "$f exists and is non-empty"
  else
    fail "$f missing or empty"
  fi
done

# --- share images --------------------------------------------------------
# The layout's og:image chain is page.image -> page.background -> og-default.
# A missing default 404s the social preview of every page that has neither,
# and an empty content="" means the chain itself broke.
if [ -s "$SITE/assets/images/og-default.png" ]; then
  pass "og-default.png exists and is non-empty"
else
  fail "og-default.png missing or empty"
fi

if grep -rlE 'property="og:image" content=""' "$SITE" --include='*.html' >"$tmp"; then
  fail "page(s) with an empty og:image:"
  sed 's/^/          /' "$tmp"
else
  pass "no page has an empty og:image"
fi

# Posts synced from Medium carry a cover as `background`; at least one built
# post must surface it as og:image, or the background wiring regressed.
covers=0
for f in "$SITE"/2*/*/*/*.html; do
  [ -f "$f" ] || continue
  if grep -qE 'property="og:image" content="[^"]+"' "$f" \
     && ! grep -qE 'property="og:image" content="[^"]*og-default' "$f"; then
    covers=$((covers + 1))
  fi
done
if [ "$covers" -gt 0 ]; then
  pass "post cover images flow into og:image ($covers post(s))"
else
  fail "no post exposes its cover image as og:image"
fi

# --- llms.txt is plain text, not a rendered page -------------------------
# robots.txt advertises this path via `LLMs-Txt:`, so a wrapped or empty file
# breaks a URL we tell crawlers to fetch.
if [ -f "$SITE/llms.txt" ]; then
  if head -1 "$SITE/llms.txt" | grep -q '^---$'; then
    fail "llms.txt leaks YAML front matter (layout: null lost?)"
  else
    pass "llms.txt has no front matter leak"
  fi

  if grep -qiE '<!doctype|<html|<body' "$SITE/llms.txt"; then
    fail "llms.txt was wrapped in HTML (layout applied?)"
  else
    pass "llms.txt is not HTML-wrapped"
  fi

  for heading in '## Projects' '## Research' '## Areas of Expertise' '## Links'; do
    if grep -qF "$heading" "$SITE/llms.txt"; then
      pass "llms.txt has '$heading'"
    else
      fail "llms.txt missing '$heading'"
    fi
  done

  # Generated bullets must have a name. "- []" or "- :" means an item rendered
  # with a missing field.
  if grep -qE '^- \[\]|^- \[[^]]*\]\(\)|^- :' "$SITE/llms.txt"; then
    fail "llms.txt has a malformed bullet (empty name or empty link)"
  else
    pass "llms.txt bullets are well-formed"
  fi

  # A section heading with nothing under it means a group was scaffolded empty.
  if awk '/^## /{h=$0; getline; if ($0=="") {getline; if ($0=="" || $0 ~ /^## /) print h}}' \
       "$SITE/llms.txt" | grep -q .; then
    fail "llms.txt has a section heading with no content:"
    awk '/^## /{h=$0; getline; if ($0=="") {getline; if ($0=="" || $0 ~ /^## /) print "          "h}}' "$SITE/llms.txt"
  else
    pass "llms.txt has no empty sections"
  fi
fi

# --- projects.html and llms.txt agree with _data/projects.yml ------------
# This is the invariant the whole _data refactor exists to provide: one edit
# updates both outputs. Without this check, deleting projects from the YAML
# still passes CI.
if [ -f "$PROJECTS_DATA" ] && [ -f "$SITE/projects.html" ] && [ -f "$SITE/llms.txt" ]; then
  if ruby -ryaml -e '
      site, data_file = ARGV
      groups = YAML.load_file(data_file)
      page = File.read(File.join(site, "projects.html"))
      llms = File.read(File.join(site, "llms.txt"))
      errs, total, expected_in_llms = [], 0, 0

      groups.each do |g|
        (g["items"] || []).each do |item|
          name = item["name"]
          total += 1
          errs << "#{name.inspect} missing from projects.html" unless page.include?(name)
          if g["llms_section"]
            expected_in_llms += 1
            errs << "#{name.inspect} missing from llms.txt (llms_section: #{g["llms_section"]})" unless llms.include?(name)
          end
        end
      end

      rendered = page.scan(/class="project-card/).size + page.scan(/class="coming-soon-card/).size
      errs << "projects.html rendered #{rendered} card/tile(s) but the data has #{total} item(s)" unless rendered == total

      abort errs.join("\n") unless errs.empty?
      puts "#{total} item(s) on the page, #{expected_in_llms} mirrored in llms.txt"
    ' "$SITE" "$PROJECTS_DATA" >"$tmp" 2>&1; then
    pass "page/llms.txt match _data/projects.yml ($(cat "$tmp"))"
  else
    fail "page/llms.txt disagree with _data/projects.yml:"
    sed 's/^/          /' "$tmp"
  fi
else
  fail "cannot run parity check (missing $PROJECTS_DATA or build output)"
fi

# --- no unrendered Liquid in the files we generate ----------------------
# Scoped to generated files rather than all of _site, because blog posts can
# legitimately contain {{ }} inside code samples.
for f in llms.txt projects.html about.html; do
  [ -f "$SITE/$f" ] || continue
  if grep -qE '\{\{|\{%' "$SITE/$f"; then
    fail "$f contains unrendered Liquid"
    grep -nE '\{\{|\{%' "$SITE/$f" | head -3 | sed 's/^/          /'
  else
    pass "$f has no unrendered Liquid"
  fi
done

# --- an item with image: "" used to emit url('.../projects/') -----------
if [ -f "$SITE/projects.html" ]; then
  if grep -qE "projects/'\)" "$SITE/projects.html"; then
    fail "projects.html has an empty project image URL"
  else
    pass "projects.html has no empty image URLs"
  fi
fi

# --- about.html JSON-LD still parses ------------------------------------
if [ -f "$SITE/about.html" ]; then
  if ruby -rjson -e '
      html = File.read(ARGV[0])
      blocks = html.scan(%r{<script type="application/ld\+json">(.*?)</script>}m).flatten
      abort "no ld+json blocks found" if blocks.empty?
      blocks.each_with_index { |b, i| JSON.parse(b) rescue abort("block #{i} invalid: #{$!.message}") }
      person = blocks.map { |b| JSON.parse(b) }.find { |d| d["knowsAbout"] }
      abort "no Person block with knowsAbout" unless person
      abort "knowsAbout is empty" if person["knowsAbout"].empty?
      puts "#{blocks.size} block(s), knowsAbout=#{person["knowsAbout"].size}"
    ' "$SITE/about.html" >"$tmp" 2>&1; then
    pass "about.html JSON-LD valid ($(cat "$tmp"))"
  else
    fail "about.html JSON-LD invalid: $(cat "$tmp")"
  fi
fi

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed"
  exit 1
fi
echo "all checks passed"

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

# --- custom domain wiring -------------------------------------------------
# The site lives at diyaz.dev; GitHub 301s the old *.github.io URLs to it.
# CNAME must ship in the artifact, and no generated URL may still point at
# the old host — a leaked one would canonicalize a page back to a redirect.
# Case-sensitive on purpose: the giscus embed's repo slug is DiyazY.github.io.
if [ -s "$SITE/CNAME" ] && [ "$(cat "$SITE/CNAME")" = "diyaz.dev" ]; then
  pass "CNAME ships in the artifact with 'diyaz.dev'"
else
  fail "CNAME missing from artifact or has wrong content"
fi

if grep -rlF 'diyazy.github.io' "$SITE" --include='*.html' --include='*.xml' --include='*.txt' --include='*.json' >"$tmp"; then
  fail "built file(s) still reference the old domain:"
  sed 's/^/          /' "$tmp"
else
  pass "no built file references diyazy.github.io"
fi

if [ -f "$SITE/robots.txt" ]; then
  if head -1 "$SITE/robots.txt" | grep -q '^---$'; then
    fail "robots.txt leaks YAML front matter (layout: null lost?)"
  elif grep -q "^Sitemap: https://diyaz.dev/sitemap.xml$" "$SITE/robots.txt"; then
    pass "robots.txt rendered with the live sitemap URL"
  else
    fail "robots.txt sitemap line wrong or missing"
  fi
else
  fail "robots.txt missing from build"
fi

# --- meta attributes are entity-escaped -----------------------------------
# Titles/descriptions flow into content="" attributes through | escape, so a
# bare "& " (escaped form is "&amp; ") means an interpolation lost its filter.
if grep -rlE 'content="[^"]*& ' "$SITE" --include='*.html' >"$tmp"; then
  fail "page(s) with an unescaped ampersand in a meta attribute:"
  sed 's/^/          /' "$tmp"
else
  pass "meta attributes carry no raw ampersands"
fi

# --- document outline: exactly one h1 per page ---------------------------
# The header brand is an h1 only on the homepage; every other page supplies
# its own. Zero means a page lost its heading, two means the banner regressed.
# diy.html is a bare meta-refresh stub with no page chrome, so it's exempt.
bad_h1=0
while IFS= read -r f; do
  n=$(grep -c '<h1' "$f")
  if [ "$n" -ne 1 ]; then
    fail "$(basename "$f"): expected exactly one h1, found $n (${f#"$SITE"/})"
    bad_h1=$((bad_h1 + 1))
  fi
done < <(find "$SITE" -name '*.html' -not -name 'diy.html')
[ "$bad_h1" -eq 0 ] && pass "every page has exactly one h1"

# --- homepage targets the author's name ----------------------------------
# seo_title exists so the homepage <title> can say who this site belongs to
# instead of "Home | diyaz". Losing it silently reverts the front matter win.
if grep -qE '<title>[^<]*Diyaz Yakubov[^<]*</title>' "$SITE/index.html"; then
  pass "homepage <title> contains 'Diyaz Yakubov'"
else
  fail "homepage <title> no longer targets 'Diyaz Yakubov'"
fi

# --- diy.html stays out of the sitemap -----------------------------------
if [ -f "$SITE/sitemap.xml" ] && grep -q 'diy\.html' "$SITE/sitemap.xml"; then
  fail "diy.html (a redirect stub) is back in sitemap.xml"
else
  pass "sitemap.xml omits diy.html"
fi

# --- post-page JSON-LD parses and carries the expected blocks -------------
# The about.html check below predates this one; posts render different blocks
# (BlogPosting with a multi-line excerpt, BreadcrumbList) and once shipped
# invalid JSON for years because nothing parsed them.
post_html=$(find "$SITE" -path "$SITE/2*" -name '*.html' | head -1)
if [ -n "$post_html" ]; then
  if ruby -rjson -e '
      html = File.read(ARGV[0])
      blocks = html.scan(%r{<script type="application/ld\+json">(.*?)</script>}m).flatten
      abort "no ld+json blocks found" if blocks.empty?
      types = blocks.each_with_index.map { |b, i|
        (JSON.parse(b)["@type"] rescue abort("block #{i} invalid: #{$!.message}"))
      }
      %w[BlogPosting BreadcrumbList].each { |t| abort "missing #{t}" unless types.include?(t) }
      puts types.join(", ")
    ' "$post_html" >"$tmp" 2>&1; then
    pass "post JSON-LD valid ($(cat "$tmp")) — ${post_html#"$SITE"/}"
  else
    fail "post JSON-LD invalid (${post_html#"$SITE"/}): $(cat "$tmp")"
  fi
else
  fail "no built post found to JSON-LD-check"
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

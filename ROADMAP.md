# Website Improvement Roadmap

A structured plan to make [diyazy.github.io](https://diyazy.github.io/) more interesting, engaging, and cool.

**Created:** 2025-01-30
**Status:** In Progress

---

## Table of Contents

- [Current State Summary](#current-state-summary)
- [Phase 1: Foundation](#phase-1-foundation)
- [Phase 2: Content & Engagement](#phase-2-content--engagement)
- [Phase 3: About & Brand](#phase-3-about--brand)
- [Phase 4: UX Enhancements](#phase-4-ux-enhancements)
- [Phase 5: Design Modernization](#phase-5-design-modernization)
- [Phase 6: Advanced Features](#phase-6-advanced-features)
- [Content Strategy](#content-strategy)
- [Technical Debt](#technical-debt)

---

## Current State Summary

### Strengths

- [x] Modern CSS Grid layout with glassmorphic effects
- [x] Responsive design foundation (768px breakpoint)
- [x] WebP image optimization with PNG fallbacks
- [x] Clean Jekyll structure
- [x] Medium sync script for content import
- [x] Diverse content topics (tech, DIY, speculative design)

### Key Issues

- [ ] Incomplete homepage with "tbd" placeholder sections
- [ ] Medium dependency (truncated posts linking to Medium)
- [ ] Sparse About page (only 2 paragraphs)
- [ ] Missing blog features (search, comments, sharing)
- [ ] No CSS variables or design system
- [ ] No dark mode support
- [ ] Missing SEO essentials (meta descriptions, Open Graph tags)

---

## Phase 1: Foundation

**Priority:** High
**Goal:** Complete the basics and fix critical gaps
**Status:** COMPLETED

### Tasks

- [x] **Remove/replace "tbd" sections on homepage**
    - Removed Fishing placeholder
    - Removed Science placeholder
    - Removed empty panels
    - Added "Latest Post" and "About Me" sections

- [x] **Add essential meta tags**
    - [x] Meta descriptions for all pages
    - [x] Open Graph tags (og:title, og:description, og:image)
    - [x] Twitter Card tags
    - [x] Canonical URLs

- [x] **Create 404 error page**
    - [x] Design friendly 404 page
    - [x] Add navigation back to home

- [x] **Add sitemap.xml**
    - [x] Install jekyll-sitemap plugin

- [x] **Add robots.txt**
    - [x] Create basic robots.txt file

- [x] **Fix navigation active state**
    - [x] Highlight current page in navigation

### Files Modified

- `index.html` - Redesigned homepage with meaningful content
- `_layouts/default.html` - Added meta tags, OG tags, Twitter cards
- `_includes/header.html` - Added active navigation state
- `_config.yml` - Added site metadata, author info, plugins
- `assets/css/main.css` - Added active nav styles
- `assets/css/index-page.css` - New grid layout and styles
- `about.html` - Added description
- `blog.html` - Added description
- `diy.html` - Added description
- `Gemfile` - Added jekyll-sitemap plugin
- New: `404.html`
- New: `robots.txt`

---

## Phase 2: Content & Engagement

**Priority:** High
**Goal:** Make content more engaging and interactive
**Status:** COMPLETED (Giscus needs configuration)

### Tasks

- [x] **Resolve Medium content strategy**
    - [x] Decision: Site is primary hub, Medium for text content
    - [x] Added "Originally published on Medium" badges with links

- [x] **Add reading time to posts**
    - [x] Calculate words / 200 wpm
    - [x] Display in post header and blog listing

- [x] **Implement comments system**
    - [x] Choose provider: Giscus (GitHub Discussions)
    - [x] Add to post template
    - [x] Style to match site design
    - [ ] **ACTION REQUIRED:** Configure Giscus repo ID and category ID (see setup instructions below)

- [x] **Add social sharing buttons**
    - [x] Twitter/X share
    - [x] LinkedIn share
    - [x] Copy link button

- [x] **Create "Related Posts" section**
    - [x] Show up to 3 posts with matching tags
    - [x] Add to bottom of post template

- [x] **Add post navigation**
    - [x] Previous post link
    - [x] Next post link

- [x] **Display tags on posts**
    - [x] Show tags in post meta section

### Giscus Setup Instructions

To enable comments, you need to:
1. Go to https://giscus.app
2. Enable GitHub Discussions on your repo (Settings > Features > Discussions)
3. Create a "Blog Comments" category in Discussions
4. Fill in the form on giscus.app with your repo details
5. Copy the `data-repo-id` and `data-category-id` values
6. Update `_layouts/post.html` with these values

### Files Modified

- `_layouts/post.html` - Added all Phase 2 features
- `assets/css/post.css` - Styles for new features
- `blog.html` - Added reading time
- `diy.html` - Added reading time

---

## Phase 3: About & Brand

**Priority:** Medium
**Goal:** Establish personal brand and expand About page
**Status:** COMPLETE (awaiting screenshot assets and resume PDF)

### Tasks

- [x] **Expand About page**
    - [x] Professional summary/bio
    - [x] Career timeline or milestones (6 key roles from 2013-2025)
    - [x] Technical skills with categories (condensed from full list)
    - [x] Education (Master's from Tampere, Bachelor's from EKSTU)
    - [x] Interests and hobbies
    - [x] Social media links (GitHub, LinkedIn, Medium, Toptal)
    - [ ] Contact method or form (can add later)

- [x] **Create project showcase**
    - [x] Design project cards
    - [x] Add 3-5 notable projects (TopTop.dev, EuroJackpotStats, iot-edge, + 3 coming soon)
    - [ ] Include screenshots/images (placeholders ready, awaiting assets)
    - [x] Link to repos or live demos

- [x] **Personal branding**
    - [x] Create simple logo or wordmark ("diyaz." with gold accent)
    - [x] Define brand colors (primary: #2a2521, accent: #c9a227 gold)
    - [x] CSS variables design system created
    - [x] Consistent visual identity across pages

- [x] **Add downloadable resume/CV**
    - [ ] Create PDF version (awaiting file from user)
    - [x] Add download button on About page

### Files Modified

- `about.html` - Complete redesign with skills, expertise, experience timeline, education, resume download, social links
- `_config.yml` - Added LinkedIn profile, updated site title to "diyaz"
- `_includes/header.html` - Updated to "diyaz." brand logo
- `_data/navigation.yml` - Added Projects page
- `_layouts/default.html` - Added variables.css
- New: `projects.html` - Projects showcase page
- New: `assets/css/projects.css` - Project cards styling
- New: `assets/css/about.css` - About page styles including timeline, education, resume sections
- New: `assets/css/variables.css` - Brand design system (colors, spacing, typography)
- New: `assets/images/projects/` - Directory for project screenshots

---

## Phase 4: UX Enhancements

**Priority:** Medium
**Goal:** Improve navigation and content discovery
**Status:** COMPLETE

### Tasks

- [x] **Add search functionality**
    - [x] Implement Simple-Jekyll-Search
    - [x] Create search UI component in header
    - [x] Index all posts with search.json

- [x] **Tag filtering UI on blog page**
    - [x] Display all tags as clickable buttons
    - [x] Filter posts client-side

- [x] **Add breadcrumb navigation**
    - [x] Show path: Home > Blog > Post Title
    - [x] Style consistently

- [x] **Improve blog listing**
    - [x] Add post thumbnails/featured images
    - [x] Show tags on listing
    - [x] Better excerpt display
    - [x] Client-side pagination (5 posts per page)

- [x] **Add table of contents for long posts**
    - [x] Auto-generate from h2 headings
    - [x] Collapsible TOC at top of post

- [x] **Keyboard navigation**
    - [x] Arrow keys for prev/next post
    - [x] Slash key to focus search

### Files Modified

- `blog.html` - Tag filter, thumbnails, pagination
- `_layouts/post.html` - Breadcrumbs, TOC, keyboard nav
- `_layouts/default.html` - Search CSS/JS
- `_includes/header.html` - Search component
- `assets/css/blog.css` - Tags, pagination, thumbnails
- `assets/css/main.css` - Breadcrumbs
- `assets/css/post.css` - TOC styles
- New: `_includes/search.html` - Search UI
- New: `_includes/breadcrumbs.html` - Breadcrumb nav
- New: `_includes/toc.html` - Table of contents
- New: `assets/js/search.js` - Search functionality
- New: `assets/css/search.css` - Search styles
- New: `search.json` - Search index

---

## Phase 5: Design Modernization

**Priority:** Medium
**Goal:** Create cohesive, modern design system
**Status:** COMPLETE

### Tasks

- [x] **Create CSS custom properties (variables)**
    - [x] Color palette (primary, secondary, accent, text, background)
    - [x] Spacing scale (4px, 8px, 16px, 24px, 32px, etc.)
    - [x] Typography scale
    - [x] Border radius values
    - [x] Shadow definitions

- [x] **Implement dark mode**
    - [x] Detect system preference with `prefers-color-scheme`
    - [x] Add manual toggle button
    - [x] Store preference in localStorage
    - [x] Dark variants for all colors
    - [x] Giscus comments theme sync

- [x] **Improve typography**
    - [x] Clear heading hierarchy (h1 > h2 > h3)
    - [x] Better line height and letter spacing
    - [x] Consistent font weights
    - [x] Font smoothing for better rendering

- [x] **Add animations and transitions**
    - [x] Hover effects on links, buttons, and cards
    - [x] Smooth scroll behavior
    - [x] Interactive element transitions
    - [x] Focus states for accessibility

- [x] **Responsive improvements**
    - [x] Added tablet breakpoint (~1024px)
    - [x] Improved mobile touch targets (44px minimum)
    - [x] Fixed mobile layouts across all pages
    - [x] Small mobile breakpoint (~480px)

- [x] **Consolidate and organize CSS**
    - [x] Created utility classes (sr-only, text-center, text-muted, font-mono)
    - [x] All files using CSS variables consistently
    - [x] Removed hardcoded colors

### Files Modified

- All CSS files in `assets/css/` updated with variables
- `_layouts/default.html` - Added dark mode toggle script
- `_includes/header.html` - Theme toggle button
- `assets/css/variables.css` - Complete design system
- `assets/js/theme-toggle.js` - Theme switching logic

---

## Phase 6: Advanced Features

**Priority:** Low (nice to have)
**Goal:** Add sophisticated features for growth

### Tasks

- [ ] **Newsletter signup** (deferred)
    - [ ] Choose provider:
        - **Buttondown** (recommended) - Free 100 subs, developer-friendly, Markdown
        - **EmailOctopus** - Free 2,500 subs, generous tier
        - **ConvertKit** - Free 1,000 subs, creator-focused
    - [ ] Sign up and get embed form code
    - [ ] Add form to footer or dedicated section
    - [ ] Example embed:
      ```html
      <form action="https://buttondown.email/api/emails/embed-subscribe/USERNAME" method="post">
        <input type="email" name="email" placeholder="Your email">
        <button type="submit">Subscribe</button>
      </form>
      ```

- [ ] **Analytics** (deferred)
    - [ ] Choose provider:
        - **GoatCounter** (recommended) - Free, simple, no cookie banner needed
        - **Umami** - Free self-host (HomeLab!) or $9/mo cloud
        - **Plausible** - $9/mo or self-host, privacy-friendly
        - **Cloudflare Analytics** - Free if using Cloudflare DNS
    - [ ] Sign up and get tracking script
    - [ ] Add to `_includes/analytics.html` and include in `default.html`
    - [ ] Example (GoatCounter):
      ```html
      <script data-goatcounter="https://YOURSITE.goatcounter.com/count"
              async src="//gc.zgo.at/count.js"></script>
      ```

- [x] **RSS feed improvements**
    - [x] Full content in feed (content:encoded)
    - [x] Feed autodiscovery link in head
    - [x] RSS link in footer with icon

- [x] **Performance optimization**
    - [x] Native lazy loading for images (loading="lazy")
    - [x] Async image decoding (decoding="async")
    - [x] Preload hints for critical CSS and JS
    - [ ] Optimize and compress images (manual task)
    - [ ] Add service worker for offline support (optional)

- [x] **Accessibility audit**
    - [x] Proper alt text handling for decorative images
    - [x] ARIA landmarks (banner, navigation, main, contentinfo)
    - [x] Skip navigation link
    - [x] Focus-visible styles for keyboard navigation
    - [x] Proper button types and labels
    - [ ] Test with screen reader (manual task)
    - [ ] Verify color contrast (manual task)

- [x] **Structured data (SEO)**
    - [x] JSON-LD for WebSite (all pages)
    - [x] JSON-LD for BlogPosting (post pages)
    - [x] Author information included

### Files to Modify

- `_layouts/default.html`
- `_layouts/post.html`
- `_includes/footer.html`
- `_config.yml`
- New: `_includes/newsletter.html`
- New: `_includes/analytics.html`
- New: `feed.xml` (improve existing)

---

## Content Strategy

### Decisions to Make

- [ ] **Primary vs Secondary Platform**
    - Is this site primary or is Medium primary?
    - Should full content live here or on Medium?

- [ ] **Content Pillars** (pick 2-3 focus areas)
    - [ ] Technical tutorials (.NET, C#, React)
    - [ ] DIY/Maker projects
    - [ ] Speculative design
    - [ ] Career/professional insights
    - [ ] Other: _______________

- [ ] **Posting Schedule**
    - [ ] Weekly
    - [ ] Bi-weekly
    - [ ] Monthly
    - [ ] Other: _______________

### Content Ideas

- [ ] Create a "Start Here" or "Best Of" page
- [ ] Write a detailed "About My Setup" post (HomeLab)
- [ ] Create series/collections (e.g., "DIY Furniture Series")
- [ ] Add case studies for projects
- [ ] Write "lessons learned" retrospectives

---

## Technical Debt

### Code Quality

- [ ] **Consolidate layouts**
    - `post.html` duplicates HTML structure from `default.html`
    - Refactor to extend default layout

- [ ] **CSS organization**
    - Multiple CSS files without clear structure
    - Consider SCSS with partials

- [ ] **Remove unused code**
    - Audit for dead CSS
    - Remove placeholder content

### Configuration

- [ ] **Enhance _config.yml**
    - Add author information
    - Add social links
    - Configure plugins
    - Set up collections if needed

- [ ] **Standardize frontmatter**
    - Create template for new posts
    - Document required fields

---

## Progress Log

| Date       | Phase   | Task Completed                | Notes                                      |
|------------|---------|-------------------------------|--------------------------------------------|
| 2025-01-30 | -       | Created roadmap               | Initial planning                           |
| 2025-01-30 | Phase 1 | Homepage redesign             | Removed tbd, added Latest Post & About Me  |
| 2025-01-30 | Phase 1 | Added meta tags               | OG tags, Twitter cards, canonical URLs     |
| 2025-01-30 | Phase 1 | Created 404 page              | Friendly error page with navigation        |
| 2025-01-30 | Phase 1 | Added robots.txt              | Basic robots file with sitemap reference   |
| 2025-01-30 | Phase 1 | Added jekyll-sitemap          | Auto-generates sitemap.xml                 |
| 2025-01-30 | Phase 1 | Fixed navigation active state | Highlights current page in nav             |
| 2025-01-30 | Phase 2 | Added reading time            | Shows on post pages and blog listings      |
| 2025-01-30 | Phase 2 | Added Medium badges           | "Originally on Medium" for synced posts    |
| 2025-01-30 | Phase 2 | Added social sharing          | Twitter, LinkedIn, copy link buttons       |
| 2025-01-30 | Phase 2 | Added related posts           | Shows up to 3 posts with matching tags     |
| 2025-01-30 | Phase 2 | Added post navigation         | Previous/Next post links                   |
| 2025-01-30 | Phase 2 | Added Giscus comments         | Configured with repo ID                    |
| 2025-01-30 | Phase 2 | Cleaned up Medium posts       | Removed redundant "Originally posted" text |
| 2025-01-30 | Phase 2 | Updated medium_to_md.rb       | Script no longer adds redundant links      |
| 2025-01-30 | Phase 3 | Redesigned About page         | Skills, expertise, interests, social links |
| 2025-01-30 | Phase 3 | Added LinkedIn to config      | Social profiles now complete               |
| 2025-01-31 | Phase 3 | Added experience timeline     | 6 key roles from 2013-2025                 |
| 2025-01-31 | Phase 3 | Added education section       | Master's (Tampere), Bachelor's (EKSTU)     |
| 2025-01-31 | Phase 3 | Added Toptal to social links  | Complete social profile links              |
| 2025-01-31 | Phase 3 | Added timeline/education CSS  | Styled timeline and education sections     |
| 2025-01-31 | Phase 3 | Updated timeline              | Removed Toptal projects, added missing roles |
| 2025-01-31 | Phase 3 | Created Projects page         | TopTop.dev, EuroJackpotStats, iot-edge research |
| 2025-01-31 | Phase 3 | Implemented branding          | "diyaz." logo, gold accent color (#c9a227) |
| 2025-01-31 | Phase 3 | Created CSS variables         | Design system with colors, spacing, typography |
| 2025-01-31 | Phase 3 | Added resume download section | Button on About page, awaiting PDF file    |
| 2025-01-31 | Phase 4 | Implemented search            | Header search with / shortcut, search.json |
| 2025-01-31 | Phase 4 | Added tag filtering           | Clickable tags on blog page, client-side   |
| 2025-01-31 | Phase 4 | Added breadcrumb navigation   | Home > Blog > Post Title                   |
| 2025-01-31 | Phase 4 | Improved blog listing         | Thumbnails, tags, pagination (5 per page)  |
| 2025-01-31 | Phase 4 | Added table of contents       | Auto-generated from h2 headings            |
| 2025-01-31 | Phase 4 | Added keyboard navigation     | Arrow keys for posts, / for search         |
| 2025-02-01 | Phase 5 | Implemented dark mode         | Toggle button, localStorage, system pref   |
| 2025-02-01 | Phase 5 | Improved typography           | Heading hierarchy, line heights, weights   |
| 2025-02-01 | Phase 5 | Added animations/transitions  | Hover effects, smooth scroll, focus states |
| 2025-02-01 | Phase 5 | Responsive improvements       | Tablet breakpoint, touch targets, mobile   |
| 2025-02-01 | Phase 5 | CSS consolidation             | Utility classes, consistent variables      |
| 2025-02-02 | Phase 5 | URL-based blog filtering      | ?tag=xxx support, browser history          |
| 2025-02-02 | Phase 5 | Added Art tile to homepage    | New category tile, grid layout update      |
| 2025-02-02 | Phase 6 | Created RSS feed              | Full content, autodiscovery, footer link   |
| 2025-02-02 | Phase 6 | Added structured data         | JSON-LD for WebSite and BlogPosting        |
| 2025-02-02 | Phase 6 | Accessibility improvements    | Skip link, ARIA landmarks, focus styles    |
| 2025-02-02 | Phase 6 | Performance optimization      | Preload hints, lazy loading images         |

---

## Resources

### Tools

- [Lunr.js](https://lunrjs.com/) - Client-side search
- [Giscus](https://giscus.app/) - GitHub-based comments
- [Plausible](https://plausible.io/) - Privacy-friendly analytics
- [Buttondown](https://buttondown.email/) - Simple newsletter

### Inspiration

- [Jekyll Themes](https://jekyllthemes.io/) - Design inspiration
- [Minimal Mistakes](https://mmistakes.github.io/minimal-mistakes/) - Feature-rich Jekyll theme
- [Personal Site Examples](https://github.com/topics/personal-website) - GitHub collection

### Documentation

- [Jekyll Docs](https://jekyllrb.com/docs/)
- [Liquid Template Language](https://shopify.github.io/liquid/)
- [GitHub Pages](https://docs.github.com/en/pages)

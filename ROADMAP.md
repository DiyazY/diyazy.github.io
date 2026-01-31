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

### Tasks

- [ ] **Add search functionality**
    - [ ] Implement Lunr.js or Simple-Jekyll-Search
    - [ ] Create search UI component
    - [ ] Index all posts and pages

- [ ] **Tag filtering UI on blog page**
    - [ ] Display all tags as clickable buttons
    - [ ] Filter posts client-side or create tag pages

- [ ] **Add breadcrumb navigation**
    - [ ] Show path: Home > Blog > Post Title
    - [ ] Style consistently

- [ ] **Improve blog listing**
    - [ ] Add post thumbnails/featured images
    - [ ] Show tags on listing
    - [ ] Better excerpt display
    - [ ] Pagination (replace fixed-height scroll)

- [ ] **Add table of contents for long posts**
    - [ ] Auto-generate from headings
    - [ ] Sticky sidebar or top of post

- [ ] **Keyboard navigation**
    - [ ] Arrow keys for prev/next post
    - [ ] Slash key to focus search

### Files to Modify

- `blog.html`
- `_layouts/post.html`
- `_layouts/default.html`
- `assets/css/blog.css`
- New: `_includes/search.html`
- New: `_includes/breadcrumbs.html`
- New: `_includes/toc.html`
- New: `assets/js/search.js`

---

## Phase 5: Design Modernization

**Priority:** Medium
**Goal:** Create cohesive, modern design system

### Tasks

- [ ] **Create CSS custom properties (variables)**
    - [ ] Color palette (primary, secondary, accent, text, background)
    - [ ] Spacing scale (4px, 8px, 16px, 24px, 32px, etc.)
    - [ ] Typography scale
    - [ ] Border radius values
    - [ ] Shadow definitions

- [ ] **Implement dark mode**
    - [ ] Detect system preference with `prefers-color-scheme`
    - [ ] Add manual toggle button
    - [ ] Store preference in localStorage
    - [ ] Dark variants for all colors

- [ ] **Improve typography**
    - [ ] Clear heading hierarchy (h1 > h2 > h3)
    - [ ] Better line height and letter spacing
    - [ ] Consistent font weights

- [ ] **Add animations and transitions**
    - [ ] Hover effects on links and buttons
    - [ ] Page transition effects
    - [ ] Smooth scroll behavior
    - [ ] Subtle loading animations

- [ ] **Responsive improvements**
    - [ ] Add tablet breakpoint (~1024px)
    - [ ] Test and fix mobile layout issues
    - [ ] Improve touch targets for mobile

- [ ] **Consolidate and organize CSS**
    - [ ] Consider SCSS migration
    - [ ] Remove duplicate styles
    - [ ] Create utility classes

### Files to Modify

- All CSS files in `assets/css/`
- `_layouts/default.html` (add dark mode toggle)
- New: `assets/css/variables.css`
- New: `assets/css/dark-mode.css`
- New: `assets/js/theme-toggle.js`

---

## Phase 6: Advanced Features

**Priority:** Low (nice to have)
**Goal:** Add sophisticated features for growth

### Tasks

- [ ] **Newsletter signup**
    - [ ] Choose provider (Buttondown, ConvertKit, Mailchimp)
    - [ ] Design signup form
    - [ ] Add to homepage and/or post footer
    - [ ] Create welcome email

- [ ] **Analytics**
    - [ ] Choose privacy-friendly option (Plausible, Umami, GoatCounter)
    - [ ] Install tracking code
    - [ ] Set up basic dashboard

- [ ] **RSS feed improvements**
    - [ ] Ensure full content in feed
    - [ ] Add feed autodiscovery link
    - [ ] Create feed icon/link in header

- [ ] **Performance optimization**
    - [ ] Implement lazy loading for images
    - [ ] Extract critical CSS
    - [ ] Add preload hints for key resources
    - [ ] Optimize and compress images
    - [ ] Add service worker for offline support

- [ ] **Accessibility audit**
    - [ ] Add proper alt text to all images
    - [ ] Ensure heading hierarchy
    - [ ] Add skip navigation link
    - [ ] Test with screen reader
    - [ ] Ensure sufficient color contrast

- [ ] **Structured data (SEO)**
    - [ ] Add JSON-LD for Person (About page)
    - [ ] Add JSON-LD for Article (blog posts)
    - [ ] Add JSON-LD for WebSite (homepage)

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

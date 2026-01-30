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

### Tasks

- [ ] **Remove/replace "tbd" sections on homepage**
    - Remove Fishing placeholder
    - Remove Science placeholder
    - Remove empty panels
    - Add meaningful content or reduce grid

- [ ] **Add essential meta tags**
    - [ ] Meta descriptions for all pages
    - [ ] Open Graph tags (og:title, og:description, og:image)
    - [ ] Twitter Card tags
    - [ ] Canonical URLs

- [ ] **Create 404 error page**
    - [ ] Design friendly 404 page
    - [ ] Add navigation back to home

- [ ] **Add sitemap.xml**
    - [ ] Install jekyll-sitemap plugin or create manually

- [ ] **Add robots.txt**
    - [ ] Create basic robots.txt file

- [ ] **Fix navigation active state**
    - [ ] Highlight current page in navigation

### Files to Modify

- `index.html`
- `_layouts/default.html`
- `_includes/header.html`
- `_config.yml`
- New: `404.html`
- New: `sitemap.xml`
- New: `robots.txt`

---

## Phase 2: Content & Engagement

**Priority:** High
**Goal:** Make content more engaging and interactive

### Tasks

- [ ] **Resolve Medium content strategy**
    - [ ] Decision: Primary platform or secondary?
    - [ ] If primary: Import full content from Medium posts
    - [ ] If secondary: Add clear "Originally on Medium" badges with links

- [ ] **Add reading time to posts**
    - [ ] Calculate words / 200 wpm
    - [ ] Display in post header and blog listing

- [ ] **Implement comments system**
    - [ ] Choose provider (Giscus, Utterances, or Disqus)
    - [ ] Add to post template
    - [ ] Style to match site design

- [ ] **Add social sharing buttons**
    - [ ] Twitter/X share
    - [ ] LinkedIn share
    - [ ] Copy link button

- [ ] **Create "Related Posts" section**
    - [ ] Show 2-3 posts with matching tags
    - [ ] Add to bottom of post template

- [ ] **Add post navigation**
    - [ ] Previous post link
    - [ ] Next post link

- [ ] **Standardize post frontmatter**
    - [ ] Consistent date format
    - [ ] Categories field
    - [ ] Tags field
    - [ ] Description/excerpt field
    - [ ] Featured image field

### Files to Modify

- `_layouts/post.html`
- `blog.html`
- `_posts/*.md` (all posts)
- New: `_includes/comments.html`
- New: `_includes/share-buttons.html`
- New: `_includes/related-posts.html`

---

## Phase 3: About & Brand

**Priority:** Medium
**Goal:** Establish personal brand and expand About page

### Tasks

- [ ] **Expand About page**
    - [ ] Professional summary/bio
    - [ ] Career timeline or milestones
    - [ ] Technical skills with categories
    - [ ] Education and certifications
    - [ ] Interests and hobbies
    - [ ] Social media links (GitHub, LinkedIn, Medium, Twitter)
    - [ ] Contact method or form

- [ ] **Create project showcase**
    - [ ] Design project cards
    - [ ] Add 3-5 notable projects
    - [ ] Include screenshots/images
    - [ ] Link to repos or live demos

- [ ] **Personal branding**
    - [ ] Create simple logo or wordmark
    - [ ] Define brand colors (replace generic Bootstrap blue)
    - [ ] Consistent visual identity across pages

- [ ] **Add downloadable resume/CV**
    - [ ] Create PDF version
    - [ ] Add download button on About page

### Files to Modify

- `about.html`
- `assets/css/profile.css`
- New: `projects.html` (optional dedicated page)
- New: `assets/images/projects/` (project screenshots)
- New: `assets/resume.pdf`

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

| Date       | Phase | Task Completed  | Notes            |
|------------|-------|-----------------|------------------|
| 2025-01-30 | -     | Created roadmap | Initial planning |
|            |       |                 |                  |
|            |       |                 |                  |

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

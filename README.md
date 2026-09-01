# [diyaz.dev](https://diyaz.dev/)

A personal portfolio and blog website built with Jekyll, hosted on GitHub Pages. This site serves as a personal space to
share technical blog posts, DIY projects, and personal interests.

## Table of Contents

- [Technologies](#technologies)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Content Management](#content-management)
    - [Creating Blog Posts](#creating-blog-posts)
    - [Syncing from Medium](#syncing-from-medium)
- [Deployment](#deployment)
- [Customization](#customization)
- [TODO](#todo)
- [License](#license)

## Technologies

- **Jekyll** (v4.3.2) - Static site generator
- **Kramdown** - Markdown parser with GitHub Flavored Markdown support
- **Rouge** - Syntax highlighting for code blocks
- **MathJax** - Mathematical notation support
- **Liquid** - Template engine

## Prerequisites

- Ruby (2.7 or higher recommended)
- Bundler gem (`gem install bundler`)
- Git

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DiyazY/diyazy.github.io.git
   cd diyazy.github.io
   ```

2. Install dependencies:
   ```bash
   bundle install
   ```

## Development

### Run the Development Server

```bash
bundle exec jekyll serve
```

This starts a local server at `http://localhost:4000` with auto-reload enabled.

### Build Static Files

```bash
bundle exec jekyll build
```

This generates the static site in the `_site/` directory.

## Project Structure

```
diyazy.github.io/
├── _config.yml          # Jekyll configuration
├── _data/
│   └── navigation.yml   # Navigation menu items
├── _includes/
│   ├── header.html      # Site header component
│   └── footer.html      # Site footer component
├── _layouts/
│   ├── default.html     # Main page layout
│   └── post.html        # Blog post layout
├── _posts/              # Blog posts (Markdown)
├── assets/
│   ├── css/             # Stylesheets
│   │   ├── blog.css     # Blog page styles
│   │   ├── layouts.css  # Layout styles
│   │   ├── panels.css   # Grid panel styles
│   │   ├── posts.css    # Individual post styles
│   │   └── profile.css  # About page styles
│   └── images/          # Images and graphics
├── index.html           # Home page
├── blog.html            # Blog listing page
├── about.html           # About page
├── diy.html             # DIY projects page
├── medium_to_md.rb      # Medium sync script
├── Gemfile              # Ruby dependencies
└── README.md            # This file
```

### Key Files

| File                    | Description                                                              |
|-------------------------|--------------------------------------------------------------------------|
| `_config.yml`           | Jekyll configuration including markdown settings and syntax highlighting |
| `_layouts/default.html` | Base layout with header, content area, and footer                        |
| `_layouts/post.html`    | Template for individual blog posts with title, date, and back link       |
| `_data/navigation.yml`  | Defines the navigation menu structure                                    |
| `medium_to_md.rb`       | Ruby script to sync posts from Medium RSS feed                           |

## Content Management

### Creating Blog Posts

1. Create a new Markdown file in `_posts/` with the naming convention:
   ```
   YYYY-MM-DD-title-of-post.md
   ```

2. Add YAML frontmatter at the top of the file:
   ```yaml
   ---
   layout: post
   title: "Your Post Title"
   tags:
     - tag1
     - tag2
   ---
   ```

3. Write your content in Markdown below the frontmatter.

**Example:**

```markdown
---
layout: post
title: "Getting Started with Jekyll"
tags:
  - web
  - tutorial
---

This is the beginning of my blog post...

## Section Heading

More content here with **bold** and *italic* text.

```javascript
// Code blocks with syntax highlighting
const greeting = "Hello, World!";
console.log(greeting);
```

```

### Syncing from Medium

The `medium_to_md.rb` script fetches posts from a Medium RSS feed and converts them to Jekyll-compatible Markdown files.

**Usage:**
```bash
ruby ./medium_to_md.rb <medium-username> <output-directory>
```

**Example:**

```bash
ruby ./medium_to_md.rb diyaz.yakubov ./_posts
```

**Features:**

- Extracts metadata (title, date, tags, author)
- Converts HTML content to Markdown
- Preserves featured images
- Handles paywall content (uses summary as fallback)
- Includes link to original Medium post

**Dependencies for Medium sync:**

```ruby
gem install feedjira httparty nokogiri reverse_markdown
```

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

**Manual deployment steps:**

1. Build the static site:
   ```bash
   bundle exec jekyll build
   ```
2. Commit and push changes to the `main` branch
3. GitHub Pages will automatically serve the updated content

The live site is available at: https://diyaz.dev/

## Customization

### Styling

CSS files are located in `assets/css/`:

- `layouts.css` - Overall layout and typography
- `panels.css` - Grid-based panel layout (responsive, 3-column on desktop)
- `blog.css` - Blog listing page styles
- `posts.css` - Individual post page styles
- `profile.css` - About page styles

**Responsive breakpoint:** 768px (switches from grid to single column)

### Navigation

Edit `_data/navigation.yml` to modify the navigation menu:

```yaml
- name: Home
  link: /
- name: About
  link: /about.html
- name: Blog
  link: /blog.html
```

### Adding New Pages

1. Create a new HTML file in the root directory
2. Add frontmatter with the layout:
   ```yaml
   ---
   layout: default
   title: "Page Title"
   ---
   ```
3. Add the page to navigation if desired

### Post Filtering

To create a filtered view of posts (like `diy.html`), use Liquid filters:

```liquid
{% for post in site.posts %}
  {% if post.tags contains 'diy' %}
    <!-- Display post -->
  {% endif %}
{% endfor %}
```

## TODO

1. Get tags from Medium automatically
2. Display background image in the post
3. Show original Medium post link
4. Manage to get the content of the posts behind the paywall

## License

This project is released under the [Unlicense](LICENSE) - public domain.

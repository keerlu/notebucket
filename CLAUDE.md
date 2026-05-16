# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Ghost CMS to Eleventy (11ty) static site migration for Lucy Keer's personal blog. The Ghost data export lives at the root; migrated content lives in `src/`.

## Commands

```bash
npm run migrate          # Parse Ghost JSON → src/posts/*.md + src/pages/*.md
npm run migrate --drafts # Include draft posts
npm run build            # Eleventy build → _site/
npm start                # Eleventy dev server with live reload
```

## Architecture

```
eleventy.config.js        # Collections, filters, passthrough config
src/
  index.njk               # Home page (post list)
  feed.njk                # Atom feed → /feed.xml
  _data/site.js           # Global site metadata (title, description, url)
  _includes/layouts/
    base.njk              # Shell: <html>, header, nav, footer
    post.njk              # Single post (extends base)
    page.njk              # Ghost "page" type (extends base)
  posts/
    posts.json            # Default layout + permalink for all posts
    *.md                  # One file per post, named YYYY-MM-DD-slug.md
  pages/
    pages.json            # Default layout + permalink for all pages
    *.md                  # One file per Ghost page (about, etc.)
  tags/
    index.njk             # /tags/ listing page
    tag.njk               # Paginated tag pages → /tags/<slug>/
  css/style.css
scripts/
  migrate.js              # Ghost JSON → Markdown conversion script
```

### Collections (eleventy.config.js)

- `collections.posts` — all published posts, newest first
- `collections.tagList` — sorted array of tag slugs, used to paginate `tag.njk`

### Permalinks

Posts use the Ghost slug directly: `permalink: /{{ slug }}/`. This preserves any existing external links to the old Ghost site.

### Migration script details (`scripts/migrate.js`)

Reads `lucy-keer.ghost.2024-08-05-07-24-57.json`. Key behaviours:
- Strips internal Ghost tags (slugs starting with `hash-`)
- Rewrites `__GHOST_URL__/notebucket/slug/` → `/slug/` and `__GHOST_URL__/` → `/`
- Uses the `html` field (rendered output), not `mobiledoc`/`lexical`
- Pages go to `src/pages/`, posts go to `src/posts/` with a date prefix

### Ghost export schema

The JSON export follows `data.db[0].data` with tables: `posts`, `tags`, `posts_tags`, `users`, `posts_authors`, `settings`. Posts have `type: 'post'` or `type: 'page'`.

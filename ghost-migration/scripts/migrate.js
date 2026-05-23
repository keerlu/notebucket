#!/usr/bin/env node
/**
 * Migrate Ghost JSON export to Eleventy Markdown files.
 *
 * Usage: node ghost-migration/scripts/migrate.js [--drafts]
 *
 * Outputs:
 *   src/posts/YYYY-MM-DD-slug.md  — blog posts
 *   src/pages/slug.md             — Ghost pages (about, notebucket, etc.)
 */

const fs = require('fs');
const path = require('path');

const GHOST_EXPORT = path.resolve(__dirname, '../lucy-keer.ghost.2024-08-05-07-24-57.json');
const POSTS_DIR = path.resolve(__dirname, '../../src/posts');
const PAGES_DIR = path.resolve(__dirname, '../../src/pages');

const includeDrafts = process.argv.includes('--drafts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str) {
  return str; // Ghost slugs are already URL-safe
}

/** Escape YAML special characters in a string value */
function yamlStr(str) {
  if (!str) return '""';
  // Use double-quoted YAML string, escaping backslashes and double-quotes
  const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(fields)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of val) {
        lines.push(`  - ${yamlStr(item)}`);
      }
    } else if (typeof val === 'boolean') {
      lines.push(`${key}: ${val}`);
    } else if (typeof val === 'string') {
      lines.push(`${key}: ${yamlStr(val)}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function isoDate(ts) {
  return new Date(ts).toISOString();
}

function datePrefix(ts) {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Parse export
// ---------------------------------------------------------------------------

const exportData = JSON.parse(fs.readFileSync(GHOST_EXPORT, 'utf8'));
const db = exportData.db[0].data;

// Build lookup maps
const tagsById = Object.fromEntries(db.tags.map(t => [t.id, t]));

function getPostTags(postId) {
  return db.posts_tags
    .filter(pt => pt.post_id === postId)
    .map(pt => tagsById[pt.tag_id])
    .filter(Boolean)
    .filter(t => !t.slug.startsWith('hash-')) // strip Ghost internal tags
    .map(t => t.slug);
}

// ---------------------------------------------------------------------------
// Generate Markdown files
// ---------------------------------------------------------------------------

/**
 * Ghost stored internal links as __GHOST_URL__/notebucket/slug/ — rewrite
 * them to relative paths that work in the Eleventy output.
 */
function rewriteGhostUrls(html) {
  if (!html) return html;
  return html
    .replace(/__GHOST_URL__\/notebucket\//g, '/notebucket/')
    .replace(/__GHOST_URL__\//g, '/');
}

function writePost(post) {
  const tags = getPostTags(post.id);
  const date = isoDate(post.published_at || post.created_at);

  const frontmatter = buildFrontmatter({
    title: post.title,
    date,
    slug: post.slug,
    tags: tags.length ? tags : undefined,
    draft: post.status === 'draft' ? true : undefined,
    featured: post.featured || undefined,
    feature_image: post.feature_image || undefined,
    excerpt: post.custom_excerpt || undefined,
  });

  const html = rewriteGhostUrls(post.html);
  const content = `${frontmatter}\n\n${html || ''}\n`;

  const prefix = datePrefix(post.published_at || post.created_at);
  const filename = `${prefix}-${post.slug}.md`;
  const outPath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(outPath, content, 'utf8');
  return filename;
}

function writePage(page) {
  const date = isoDate(page.published_at || page.created_at);

  const frontmatter = buildFrontmatter({
    title: page.title,
    date,
    slug: page.slug,
    feature_image: page.feature_image || undefined,
    excerpt: page.custom_excerpt || undefined,
  });

  const html = rewriteGhostUrls(page.html);
  const content = `${frontmatter}\n\n${html || ''}\n`;

  const filename = `${page.slug}.md`;
  const outPath = path.join(PAGES_DIR, filename);
  fs.writeFileSync(outPath, content, 'utf8');
  return filename;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.mkdirSync(PAGES_DIR, { recursive: true });

const allPosts = db.posts.filter(p => p.type === 'post');
const allPages = db.posts.filter(p => p.type === 'page');

const postsToWrite = includeDrafts
  ? allPosts
  : allPosts.filter(p => p.status === 'published');

let postCount = 0;
for (const post of postsToWrite) {
  const filename = writePost(post);
  console.log('post:', filename);
  postCount++;
}

let pageCount = 0;
for (const page of allPages.filter(p => p.status === 'published')) {
  const filename = writePage(page);
  console.log('page:', filename);
  pageCount++;
}

console.log(`\nDone. ${postCount} posts, ${pageCount} pages written.`);
if (!includeDrafts) {
  const draftCount = allPosts.filter(p => p.status === 'draft').length;
  if (draftCount) console.log(`(${draftCount} drafts skipped — run with --drafts to include)`);
}

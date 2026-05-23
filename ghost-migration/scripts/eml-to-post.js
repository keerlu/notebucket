#!/usr/bin/env node
/**
 * Convert an Inoreader share .eml file to an Eleventy post in src/posts/.
 *
 * Usage: node ghost-migration/scripts/eml-to-post.js <path-to.eml> [--date YYYY-MM-DD]
 *
 * The post date defaults to the Date: header in the email.
 * Override with --date if the publish date differs from the email date.
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.resolve(__dirname, '../../src/posts');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const emlPath = args.find(a => !a.startsWith('--'));
const dateArgIdx = args.indexOf('--date');
const dateOverride = dateArgIdx !== -1 ? args[dateArgIdx + 1] : null;

if (!emlPath) {
  console.error('Usage: node ghost-migration/scripts/eml-to-post.js <path-to.eml> [--date YYYY-MM-DD]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Decode quoted-printable
// ---------------------------------------------------------------------------
function decodeQP(str) {
  // Remove soft line breaks first
  str = str.replace(/=\r?\n/g, '');
  // Split on runs of =XX sequences, decode each run as a UTF-8 buffer
  // so that multi-byte characters (e.g. =E2=80=99 → ') are handled correctly
  return str.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (run) => {
    const bytes = run.match(/=[0-9A-Fa-f]{2}/g).map(s => parseInt(s.slice(1), 16));
    return Buffer.from(bytes).toString('utf8');
  });
}

// ---------------------------------------------------------------------------
// Parse .eml
// ---------------------------------------------------------------------------
const raw = fs.readFileSync(emlPath, 'utf8');

// Extract Date header
const dateMatch = raw.match(/^Date:\s*(.+)$/m);
const emailDate = dateMatch ? new Date(dateMatch[1].trim()) : new Date();
const postDate = dateOverride ? new Date(dateOverride + 'T12:00:00Z') : emailDate;

// Extract the HTML body (everything after the blank line following headers)
const bodyStart = raw.indexOf('\n\n');
const rawBody = raw.slice(bodyStart + 2);
const html = decodeQP(rawBody);

// ---------------------------------------------------------------------------
// Extract fields from Inoreader HTML
// ---------------------------------------------------------------------------

// Title: the bold <a> link at the top of the content card
const titleMatch = html.match(
  /<a [^>]*href=["']https?:\/\/lucykeer\.com\/[^"']*["'][^>]*style=["'][^"']*font-size:24px[^"']*["'][^>]*>([\s\S]*?)<\/a>/
);
const title = titleMatch
  ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
  : path.basename(emlPath, '.eml');

// URL → slug (strip /notebucket/ prefix Ghost used)
const urlMatch = html.match(/href=["'](https?:\/\/lucykeer\.com\/[^"']+)["'][^>]*style=["'][^"']*font-size:24px/);
const postUrl = urlMatch ? urlMatch[1] : '';
const slug = postUrl
  .replace(/^https?:\/\/lucykeer\.com\/(?:notebucket\/)?/, '')
  .replace(/\/$/, '');

// Article content: inside <div class="article-content" ...>
const contentMatch = html.match(/<div[^>]*class=["']article-content["'][^>]*>([\s\S]*?)<\/div>\s*<\/td>/);
let content = contentMatch ? contentMatch[1].trim() : '';

// Clean up: remove any trailing Inoreader cruft divs
content = content.replace(/<div style=3D"clear:both;"[\s\S]*$/, '').trim();
content = content.replace(/<div[^>]*style=["'][^"']*clear:both[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '').trim();

// Remove the class="p_no_top" attribute Ghost added to first paragraph
content = content.replace(/\s*class="p_no_top"/g, '');

// Rewrite any remaining absolute lucykeer.com links to relative
content = content
  .replace(/https?:\/\/lucykeer\.com\/notebucket\//g, '/notebucket/')
  .replace(/https?:\/\/lucykeer\.com\//g, '/');

// ---------------------------------------------------------------------------
// Build frontmatter
// ---------------------------------------------------------------------------
function yamlStr(str) {
  const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

const isoDate = postDate.toISOString();
const datePrefix = isoDate.slice(0, 10);

const frontmatter = [
  '---',
  `title: ${yamlStr(title)}`,
  `date: ${yamlStr(isoDate)}`,
  `slug: ${yamlStr(slug)}`,
  '---',
].join('\n');

const output = `${frontmatter}\n\n${content}\n`;

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
fs.mkdirSync(POSTS_DIR, { recursive: true });
const filename = `${datePrefix}-${slug}.md`;
const outPath = path.join(POSTS_DIR, filename);
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Written: src/posts/${filename}`);

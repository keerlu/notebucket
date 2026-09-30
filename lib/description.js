/**
 * Builds the meta description for a post.
 *
 * Precedence: `subtitle` → `excerpt` → first prose paragraph of the body → null.
 * A null return lets the template fall back to `site.description`.
 *
 * Post bodies come in two dialects: the 85-odd posts migrated from Ghost are
 * raw HTML, while newer hand-written ones are Markdown. Both are handled.
 */

const TRUNCATE_AT = 160;

// Short leading paragraphs (a one-line opener, a quote attribution) make a
// useless card, so keep taking paragraphs until there's at least this much.
const MIN_PROSE = 40;

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : match;
    });
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Tags out, entities decoded, whitespace collapsed.
function toText(html) {
  return collapse(decodeEntities(html.replace(/<[^>]*>/g, ' ')));
}

function truncate(text, limit = TRUNCATE_AT) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut.slice(0, limit);
  return `${base.replace(/[\s,;:.!?—–-]+$/, '')}…`;
}

/**
 * Takes chunks in order until there's enough text to be worth showing.
 */
function joinUntilSubstantial(chunks) {
  const taken = [];
  for (const chunk of chunks) {
    taken.push(chunk);
    if (taken.join(' ').length >= MIN_PROSE) break;
  }
  return taken.join(' ');
}

/**
 * Walks groups of candidate text best-first, returning the first group that
 * yields something substantial — or, failing that, the first text seen at all.
 */
function pickProse(groups) {
  for (const group of groups) {
    const joined = joinUntilSubstantial(group);
    if (joined.length >= MIN_PROSE) return joined;
  }
  for (const group of groups) {
    if (group.length) return group[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTML bodies
// ---------------------------------------------------------------------------

function textsWithin(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    const text = toText(match[1]);
    if (text) out.push(text);
  }
  return out;
}

function fromHtml(body) {
  const stripped = body
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<(script|style|pre)\b[\s\S]*?<\/\1>/gi, '');

  // A pulled quote isn't the author summarising, so prefer prose outside one —
  // but take the quote over an attribution line or nothing at all.
  const outsideQuotes = stripped.replace(/<blockquote\b[\s\S]*?<\/blockquote>/gi, '');
  return pickProse([textsWithin(outsideQuotes, 'p'), textsWithin(stripped, 'blockquote')]);
}

// ---------------------------------------------------------------------------
// Markdown bodies
// ---------------------------------------------------------------------------

// Headings, quotes, images, tables, lists, footnotes, rules, raw HTML blocks.
const NON_PROSE = /^(?:#|>|!\[|\||[-*+]\s|\d+\.\s|<|\[\^|-{3,}$|={3,}$)/;

function stripInlineMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/~~([^~]*)~~/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2');
}

function fromMarkdown(body) {
  const withoutFences = body
    .replace(/^```[\s\S]*?^```[^\n]*$/gm, '')
    .replace(/^~~~[\s\S]*?^~~~[^\n]*$/gm, '');

  const prose = [];
  for (const block of withoutFences.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed || NON_PROSE.test(trimmed)) continue;
    const text = collapse(decodeEntities(stripInlineMarkdown(trimmed)));
    if (text) prose.push(text);
  }
  return pickProse([prose]);
}

// ---------------------------------------------------------------------------

function extractFromBody(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const body = raw.replace(/<!--[\s\S]*?-->/g, '');
  const text = fromHtml(body) || fromMarkdown(body);
  return text ? truncate(text) : null;
}

function firstText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function postDescription(data = {}) {
  // Authored fields are used as written — the author chose the length.
  const explicit = firstText(data.subtitle) || firstText(data.excerpt);
  if (explicit) return explicit;
  return extractFromBody(data.page && data.page.rawInput);
}

module.exports = { postDescription, extractFromBody, truncate };

'use client';
import React from 'react';

// Read-only renderer for the lightweight markup the RichTextField editor
// writes. Used ONLY by Project Description and Task Description today (see
// RichTextField's own note) — nothing else in the app stores markup.
//
// Deliberately built with zero dependencies and, just as deliberately, with
// NO dangerouslySetInnerHTML anywhere: every formatted piece comes back as a
// real React element, so a description can never inject markup or an
// event handler, no matter what a user (or a client-portal viewer) types.
// That's what makes it safe to render the same field on the external client
// portal as on the internal pages.
//
// Supported markup — see MARKUP_HINT below:
//   # / ## / ### text   → heading (h4/h5/h6 — a description never owns the
//                         page's own H1/H2/H3)
//   **bold**            → <strong>
//   _italic_ / *italic* → <em>
//   - item / * item     → <ul><li>
//   1. item             → <ol><li>
//   [label](url)        → <a>
//   bare https://…, www.…, name@site.com → auto-linked
//   blank line = new paragraph, single newline = line break
//
// App\Support\MarkupText mirrors all of this in PHP for the one surface that
// renders a description outside React (the project-activated email) — keep
// the two in sync.

export const MARKUP_HINT = '## heading  ·  **bold**  ·  _italic_  ·  - list  ·  1. list  ·  [label](url) — plain links are detected automatically';

// Named links: [label](url). The label deliberately can't contain ], and the
// url can't contain whitespace — keeps a stray bracket in prose from
// swallowing the rest of the line. One level of balanced parens inside the
// url is allowed, so both …/wiki/Foo_(bar) and a rejected javascript:alert(1)
// are matched whole (a half-matched url would leave a stray ")" in the text).
const NAMED_LINK_RE = /\[([^\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)/g;
// Bare URLs / emails. Trailing sentence punctuation is trimmed off by
// trimTrailingPunctuation() below rather than being matched loosely here.
const AUTO_LINK_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
const BOLD_RE = /\*\*([^\n]+?)\*\*/;
const ITALIC_RE = /(?:_([^_\n]+?)_|\*([^*\n]+?)\*)/;

const linkStyle: React.CSSProperties = { color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-word' };

// A URL that ends a sentence ("see https://x.com/a.") must not carry the
// full stop into the href. Closing brackets are only dropped when they're
// unbalanced, so links like …/wiki/Foo_(bar) still work.
function trimTrailingPunctuation(url: string): { url: string; trimmed: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if ('.,;:!?"\''.includes(ch)) { end--; continue; }
    if (ch === ')') {
      const slice = url.slice(0, end);
      const opens = (slice.match(/\(/g) ?? []).length;
      const closes = (slice.match(/\)/g) ?? []).length;
      if (closes > opens) { end--; continue; }
    }
    break;
  }
  return { url: url.slice(0, end), trimmed: url.slice(end) };
}

// Only ever produces an http/https/mailto href, and only when the browser's
// own URL parser accepts it — so javascript:, data: and friends can never
// reach an anchor. Anything rejected is rendered as plain text instead.
export function safeHref(raw: string): string | null {
  const candidate = raw.startsWith('www.')
    ? `https://${raw}`
    : (!raw.includes('://') && raw.includes('@') ? `mailto:${raw}` : raw);
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function Anchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onClick={e => e.stopPropagation()}>
      {children}
    </a>
  );
}

// **bold** / _italic_ — applied innermost-first so "**bold _and_ italic**"
// nests correctly.
function renderEmphasis(text: string, keyPrefix: string): React.ReactNode[] {
  const bold = BOLD_RE.exec(text);
  if (bold) {
    return [
      ...renderEmphasis(text.slice(0, bold.index), `${keyPrefix}b0`),
      <strong key={`${keyPrefix}b`}>{renderEmphasis(bold[1], `${keyPrefix}bi`)}</strong>,
      ...renderEmphasis(text.slice(bold.index + bold[0].length), `${keyPrefix}b1`),
    ];
  }
  const italic = ITALIC_RE.exec(text);
  if (italic) {
    return [
      ...renderEmphasis(text.slice(0, italic.index), `${keyPrefix}i0`),
      <em key={`${keyPrefix}i`}>{italic[1] ?? italic[2]}</em>,
      ...renderEmphasis(text.slice(italic.index + italic[0].length), `${keyPrefix}i1`),
    ];
  }
  return text ? [text] : [];
}

function renderAutoLinks(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(AUTO_LINK_RE)) {
    const raw = match[0];
    const at = match.index ?? 0;
    const { url, trimmed } = trimTrailingPunctuation(raw);
    const href = safeHref(url);
    out.push(...renderEmphasis(text.slice(cursor, at), `${keyPrefix}a${at}p`));
    if (href) out.push(<Anchor key={`${keyPrefix}a${at}`} href={href}>{url}</Anchor>);
    else out.push(url);
    if (trimmed) out.push(trimmed);
    cursor = at + raw.length;
  }
  out.push(...renderEmphasis(text.slice(cursor), `${keyPrefix}aEnd`));
  return out;
}

// Named links are resolved first so that a label containing emphasis or a
// URL-looking word can't be re-parsed into a nested anchor.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(NAMED_LINK_RE)) {
    const at = match.index ?? 0;
    out.push(...renderAutoLinks(text.slice(cursor, at), `${keyPrefix}l${at}p`));
    const href = safeHref(match[2]);
    if (href) {
      out.push(
        <Anchor key={`${keyPrefix}l${at}`} href={href}>
          {renderEmphasis(match[1], `${keyPrefix}l${at}t`)}
        </Anchor>,
      );
    } else {
      // Unsupported scheme (javascript:, data:, …) — show the label as plain
      // text rather than silently dropping what the author wrote.
      out.push(...renderEmphasis(match[1], `${keyPrefix}l${at}x`));
    }
    cursor = at + match[0].length;
  }
  out.push(...renderAutoLinks(text.slice(cursor), `${keyPrefix}lEnd`));
  return out;
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] };

const HEADING_RE = /^\s*(#{1,3})\s+(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = HEADING_RE.exec(rawLine);
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
      continue;
    }
    const bullet = BULLET_RE.exec(rawLine);
    const numbered = !bullet ? NUMBERED_RE.exec(rawLine) : null;
    const last = blocks[blocks.length - 1];

    if (bullet) {
      if (last?.kind === 'ul') last.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }
    if (numbered) {
      if (last?.kind === 'ol') last.items.push(numbered[1]);
      else blocks.push({ kind: 'ol', items: [numbered[1]] });
      continue;
    }
    // A blank line closes the current paragraph/list; consecutive text lines
    // stay in one paragraph and are joined with <br>.
    if (!rawLine.trim()) { blocks.push({ kind: 'p', lines: [] }); continue; }
    if (last?.kind === 'p' && last.lines.length) last.lines.push(rawLine);
    else blocks.push({ kind: 'p', lines: [rawLine] });
  }
  return blocks.filter(b => {
    if (b.kind === 'p') return b.lines.length > 0;
    if (b.kind === 'h') return b.text.trim().length > 0;
    return b.items.length > 0;
  });
}

const listStyle: React.CSSProperties = { margin: '4px 0', paddingLeft: 20 };
// Sized in em so a heading scales with whatever fontSize the host page passes
// in, and rendered as h4/h5/h6 — a description sits inside a page that already
// owns its h1/h2/h3.
const HEADING_TAG = { 1: 'h4', 2: 'h5', 3: 'h6' } as const;
const HEADING_SIZE = { 1: '1.25em', 2: '1.12em', 3: '1em' } as const;

export default function RichText({ value, style }: { value?: string | null; style?: React.CSSProperties }) {
  if (!value || !value.trim()) return null;
  const blocks = parseBlocks(value);

  return (
    <div style={{ lineHeight: 1.6, wordBreak: 'break-word', ...style }}>
      {blocks.map((block, i) => {
        if (block.kind === 'p') {
          return (
            <p key={i} style={{ margin: 0, marginBottom: i === blocks.length - 1 ? 0 : 8 }}>
              {block.lines.map((line, li) => (
                <React.Fragment key={li}>
                  {li > 0 && <br />}
                  {renderInline(line, `${i}-${li}-`)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (block.kind === 'h') {
          const level = (block.level === 1 || block.level === 2 ? block.level : 3) as 1 | 2 | 3;
          const HeadingTag = HEADING_TAG[level];
          return (
            <HeadingTag key={i} style={{ fontSize: HEADING_SIZE[level], fontWeight: 700, margin: '10px 0 4px', lineHeight: 1.4 }}>
              {renderInline(block.text, `${i}-h-`)}
            </HeadingTag>
          );
        }
        const ListTag = block.kind === 'ul' ? 'ul' : 'ol';
        return (
          <ListTag key={i} style={listStyle}>
            {block.items.map((item, li) => (
              <li key={li} style={{ marginBottom: 2 }}>{renderInline(item, `${i}-${li}-`)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

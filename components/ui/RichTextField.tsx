'use client';
import React, { useRef, useState } from 'react';
import RichText, { MARKUP_HINT } from './RichText';

// The description editor used by Project Description and Task Description —
// and deliberately nowhere else (every other textarea in the app stays plain
// text, so nothing else ever has to render markup).
//
// No editor package and no document.execCommand: the toolbar just rewrites
// the textarea's own value around the current selection through
// selectionStart/selectionEnd, and the value stays plain text in the same
// `text` DB column. Reading it back is RichText's job.
//
// Two consequences of staying a plain <textarea> that are features, not
// compromises: pasting from Word/Docs can't smuggle in markup or 50KB of
// junk styling, and typing keeps the browser's native undo stack. Undo does
// not cover a toolbar click (React owns the value, so the browser's own undo
// entry for it is lost) — Ctrl+Z after a toolbar click steps back to before
// the click's insertion rather than inside it.

interface Props {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Merged over the built-in textarea style (usually `inp` from the shared styles). */
  style?: React.CSSProperties;
}

const btn: React.CSSProperties = {
  padding: '4px 9px', fontSize: 12, fontWeight: 600, lineHeight: 1.4,
  background: '#fff', color: '#475569', border: '1px solid #e2e8f0',
  borderRadius: 6, cursor: 'pointer',
};

const baseTextarea: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #e2e8f0', borderTopLeftRadius: 0, borderTopRightRadius: 0,
  borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTop: 'none',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  background: '#fff', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
};

// A component rather than a render-time helper function so each handler is
// an event-handler prop — the toolbar handlers read the textarea ref, which
// the react-hooks/refs lint rule (rightly) rejects inside anything called
// during render.
function ToolBtn({ label, title, off, extra, onClick }: {
  label: string; title: string; off: boolean;
  extra?: React.CSSProperties; onClick: () => void;
}) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={off}
      style={{ ...btn, ...extra, opacity: off ? 0.5 : 1, cursor: off ? 'not-allowed' : 'pointer' }}
    >
      {label}
    </button>
  );
}

export default function RichTextField({ value, onChange, rows = 4, placeholder, disabled, style }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  // Puts the caret back where the toolbar action left off — after the value
  // round-trips through React, the DOM selection is otherwise reset to the end.
  const commit = (next: string, selStart: number, selEnd: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const selection = () => {
    const el = ref.current;
    return { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
  };

  // Wraps the selection in markers; with nothing selected, drops the markers
  // in and parks the caret between them so the user can just start typing.
  const wrap = (marker: string, sample: string) => {
    const { start, end } = selection();
    const selected = value.slice(start, end);
    const body = selected || sample;
    const next = `${value.slice(0, start)}${marker}${body}${marker}${value.slice(end)}`;
    const bodyStart = start + marker.length;
    commit(next, bodyStart, bodyStart + body.length);
  };

  // Toggles a line prefix ("## ", "- ", "1. ") on every line the selection
  // touches. Any existing prefix of another kind is replaced, so a line never
  // ends up as "- ## text".
  const prefixLines = (kind: 'h' | 'ul' | 'ol') => {
    const { start, end } = selection();
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndRaw = value.indexOf('\n', end);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const own = kind === 'h' ? /^\s*#{1,3}\s+/ : (kind === 'ul' ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/);
    const anyPrefix = /^\s*(?:#{1,3}|[-*]|\d+[.)])\s+/;
    const allPrefixed = lines.every(l => own.test(l));

    const rewritten = lines.map((line, i) => {
      if (allPrefixed) return line.replace(own, '');
      if (!line.trim()) return line;
      const bare = line.replace(anyPrefix, '');
      return kind === 'h' ? `## ${bare}` : (kind === 'ul' ? `- ${bare}` : `${i + 1}. ${bare}`);
    }).join('\n');

    const next = `${value.slice(0, lineStart)}${rewritten}${value.slice(lineEnd)}`;
    commit(next, lineStart, lineStart + rewritten.length);
  };

  // window.prompt matches how the rest of the app asks for a one-off value
  // (e.g. the Blocked-reason prompt on the task lists) — no modal plumbing
  // for a single field.
  const insertLink = () => {
    const { start, end } = selection();
    const selected = value.slice(start, end);
    const url = window.prompt('Link URL (https://…)', 'https://');
    if (!url || !url.trim() || url.trim() === 'https://') return;
    const label = selected || 'link text';
    const snippet = `[${label}](${url.trim()})`;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    // Selects the label so an unselected insert is immediately typeable over.
    commit(next, start + 1, start + 1 + label.length);
  };

  const off = !!disabled || preview;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '6px 8px', background: '#f8fafc',
        border: '1px solid #e2e8f0', borderTopLeftRadius: 8, borderTopRightRadius: 8,
      }}>
        <ToolBtn label="H" title="Heading (## text)" off={off} extra={{ fontWeight: 800 }} onClick={() => prefixLines('h')} />
        <ToolBtn label="B" title="Bold (**text**)" off={off} extra={{ fontWeight: 800 }} onClick={() => wrap('**', 'bold text')} />
        <ToolBtn label="I" title="Italic (_text_)" off={off} extra={{ fontStyle: 'italic' }} onClick={() => wrap('_', 'italic text')} />
        <ToolBtn label="• List" title="Bullet list" off={off} onClick={() => prefixLines('ul')} />
        <ToolBtn label="1. List" title="Numbered list" off={off} onClick={() => prefixLines('ol')} />
        <ToolBtn label="🔗 Link" title="Insert link" off={off} onClick={insertLink} />
        <button type="button" onClick={() => setPreview(p => !p)}
          style={{ ...btn, marginLeft: 'auto', color: preview ? '#2563eb' : '#475569', borderColor: preview ? '#bfdbfe' : '#e2e8f0' }}>
          {preview ? 'Write' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div style={{
          ...baseTextarea, minHeight: rows * 22 + 18, background: '#fff',
          color: '#475569', overflowY: 'auto', resize: 'none',
        }}>
          {value.trim()
            ? <RichText value={value} style={{ fontSize: 13 }} />
            : <span style={{ color: '#94a3b8' }}>Nothing to preview yet.</span>}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          style={{ ...baseTextarea, ...style, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        />
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{MARKUP_HINT}</div>
    </div>
  );
}

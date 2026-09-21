import { AI_THEME as T } from './theme';

// Tabs are built from whichever category buckets are actually present in
// this client's own suggestion list (see categoryStyle.ts) — never a fixed
// hardcoded set, so a tab never shows with nothing behind it.
export default function CategoryFilter({ categories, active, onChange }: {
  categories: string[];
  active: string;
  onChange: (bucket: string) => void;
}) {
  const tabs = ['All', ...categories];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {tabs.map(tab => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            style={{
              padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${isActive ? T.navy : T.border}`,
              background: isActive ? T.badgeBg : '#fff',
              color: isActive ? T.navy : T.body,
              fontSize: 12.5, fontWeight: 700, transition: 'background .15s, border-color .15s',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = T.badgeBg; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fff'; }}
            onFocus={e => { (e.currentTarget as HTMLElement).style.outline = `2px solid ${T.navy}`; (e.currentTarget as HTMLElement).style.outlineOffset = '2px'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.outline = 'none'; }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

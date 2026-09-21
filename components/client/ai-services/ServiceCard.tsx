import { AiService } from './types';
import { aiServiceCategoryStyle } from './categoryStyle';
import CategoryImage from './CategoryImage';
import { AI_THEME as T } from './theme';

// Thumbnail is a bundled category illustration — see categoryStyle.ts's
// image-selection order (category image, falling back to the generic
// bundled IT-services image) — never a per-request fetch or AI generation.
export default function ServiceCard({ service, requesting, expanded, onToggleExpand, onRequest }: {
  service: AiService;
  requesting: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRequest: (service: AiService) => void;
}) {
  const taken = service.status === 'taken';
  const requested = service.status === 'requested';
  const cat = aiServiceCategoryStyle(service.category);
  const CatIcon = cat.icon;

  return (
    <div
      style={{
        border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', opacity: taken ? 0.65 : 1,
        transition: 'box-shadow .15s, border-color .15s', background: T.cardBg,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(27,46,75,.08)'; (e.currentTarget as HTMLElement).style.borderColor = T.borderHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = T.border; }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: T.imagePlaceholderBg }}>
        <CategoryImage src={cat.image} alt={`${service.category} illustration`} />
        <span style={{
          position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 700, color: T.badgeText, background: T.badgeBg, padding: '3px 9px 3px 7px', borderRadius: 999,
          textTransform: 'uppercase', letterSpacing: '0.03em', boxShadow: '0 1px 3px rgba(27,46,75,.12)',
        }}>
          <CatIcon size={11} />
          {service.category}
        </span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 4 }}>{service.timeline}</div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.25, fontWeight: 800, color: T.heading }}>{service.name}</h3>
        <p style={{
          margin: 0, fontSize: 12, color: T.body, lineHeight: 1.55, flex: 1,
          // Clamped to 3 lines so a grid of cards stays level — same
          // Learn More/Show Less pattern as RecommendedServices.tsx.
          ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
        }}>
          {service.summary}
        </p>

        {taken ? (
          <div style={{ marginTop: 14, width: '100%', textAlign: 'center', borderRadius: 8, padding: '10px 12px', background: T.subtleBg, color: T.subtleText, fontSize: 12, fontWeight: 800 }}>
            ✓ Fulfilled
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            <button
              type="button" onClick={onToggleExpand}
              onFocus={e => { (e.currentTarget as HTMLElement).style.outline = `2px solid ${T.navy}`; (e.currentTarget as HTMLElement).style.outlineOffset = '2px'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.outline = 'none'; }}
              style={{
                flex: '0 0 auto', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${T.navy}`,
                background: 'transparent', color: T.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
              {expanded ? 'Show Less' : 'Learn More'}
            </button>
            <button
              type="button"
              disabled={requesting || requested}
              onClick={() => onRequest(service)}
              onFocus={e => { (e.currentTarget as HTMLElement).style.outline = `2px solid ${T.gold}`; (e.currentTarget as HTMLElement).style.outlineOffset = '2px'; }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.outline = 'none'; }}
              style={{
                flex: 1, border: 'none', borderRadius: 8, padding: '9px 12px',
                background: requested ? T.subtleBg : T.navy, color: requested ? T.subtleText : '#fff',
                fontSize: 12, fontWeight: 800, cursor: requesting || requested ? 'default' : 'pointer',
              }}
            >
              {requesting ? 'Sending...' : requested ? 'Requested' : 'Get Service'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

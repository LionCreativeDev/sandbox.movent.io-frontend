import { HiStar } from 'react-icons/hi2';
import { AiService } from './types';
import { aiServiceCategoryStyle } from './categoryStyle';
import CategoryImage from './CategoryImage';
import { AI_THEME as T } from './theme';
import { serif } from './font';

// The top of this client's own suggestion list — see
// App\Services\AiServiceCatalogService's prompt, which already orders
// suggestions to prioritize whatever most logically extends the client's
// existing projects/purchases, so index 0 IS "most relevant" rather than an
// arbitrary pick made here.
export default function FeaturedServiceCard({ service, requesting, onRequest }: {
  service: AiService;
  requesting: boolean;
  onRequest: (service: AiService) => void;
}) {
  const taken = service.status === 'taken';
  const requested = service.status === 'requested';
  const cat = aiServiceCategoryStyle(service.category);

  return (
    <div className="ai-featured" style={{
      position: 'relative', marginBottom: 18, minHeight: 320,
      border: `1.5px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', background: T.cardBg,
    }}>
      {/* Full-bleed image behind everything — no hard vertical divider. The
          gradient wash on top fades the cream page colour INTO the image so
          the headline sits on readable ground without a boxed-in look. */}
      <div className="ai-featured-image" style={{ position: 'absolute', inset: 0 }}>
        <CategoryImage src={cat.image} alt={`${service.category} illustration`} />
      </div>
      <div className="ai-featured-wash" style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(100deg, ${T.sectionBg} 0%, ${T.sectionBg} 38%, rgba(250,246,238,.82) 52%, rgba(250,246,238,0) 76%)`,
      }} />

      <div className="ai-featured-content" style={{
        position: 'relative', maxWidth: '58%', minWidth: 0, padding: '28px 32px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minHeight: 320,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: T.gold, background: T.goldBg, padding: '3px 9px', borderRadius: 999 }}>
            <HiStar size={10} /> TOP PICK FOR YOU
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.badgeText, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{service.category}</span>
          <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>· {service.timeline}</span>
        </div>
        <h3 className={serif.className} style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.heading }}>{service.name}</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: T.body, lineHeight: 1.6 }}>{service.summary}</p>
        {taken ? (
          <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: T.subtleText }}>✓ Fulfilled</div>
        ) : (
          <button
            type="button"
            disabled={requesting || requested}
            onClick={() => onRequest(service)}
            onFocus={e => { (e.currentTarget as HTMLElement).style.outline = `2px solid ${T.gold}`; (e.currentTarget as HTMLElement).style.outlineOffset = '2px'; }}
            onBlur={e => { (e.currentTarget as HTMLElement).style.outline = 'none'; }}
            style={{
              marginTop: 6, alignSelf: 'flex-start', border: 'none', borderRadius: 9, padding: '10px 22px',
              background: requested ? T.subtleBg : T.navy, color: requested ? T.subtleText : '#fff',
              fontSize: 13, fontWeight: 800, cursor: requesting || requested ? 'default' : 'pointer',
            }}
          >
            {requesting ? 'Sending...' : requested ? 'Requested' : 'Get This Service'}
          </button>
        )}
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          .ai-featured { min-height: 0; }
          .ai-featured-image { position: relative; inset: auto; width: 100%; height: 200px; }
          .ai-featured-wash { display: none; }
          .ai-featured-content { position: relative; max-width: 100%; min-height: 0; padding: 20px; }
        }
      `}</style>
    </div>
  );
}

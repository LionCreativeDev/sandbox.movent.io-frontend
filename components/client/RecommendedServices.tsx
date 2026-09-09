'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clientServicesService, PortalService, PortalServices, ServiceIntent,
} from '@/lib/services/clientServicesService';
import { HiSparkles, HiStar, HiXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';

// "Grow Your Business With Us" — the company's services, on the client's own
// dashboard and on /client/services.
//
// Three lists, resolved server-side (App\Services\ServiceRecommendationService)
// so this component decides nothing:
//
//   Recommended For You  from what this client already has — a website leads
//                        to SEO, maintenance and hosting; an app leads to bug
//                        fixing and QA. Shown with the reason, because "we
//                        suggest this" without a why reads as an advert.
//   Popular Services     the company's own featured picks.
//   All Services         everything else enabled, so nothing is unreachable.
//
// Four actions per service. Three of them raise a request (and a Lead) through
// one endpoint separated by intent; "Contact Support" goes to the support
// ticket flow that already exists, because a support request belongs in the
// support queue, not the sales pipeline.

const INTENT_COPY: Record<ServiceIntent, { button: string; heading: string; blurb: string }> = {
  quote: {
    button: 'Request Quote',
    heading: 'Request a quote',
    blurb: 'Tell us roughly what you need and we will come back with a price.',
  },
  new_project: {
    button: 'Start New Project',
    heading: 'Start a new project',
    blurb: 'Describe what you want built and we will scope it with you.',
  },
  consultation: {
    button: 'Schedule Consultation',
    heading: 'Schedule a consultation',
    blurb: 'Pick a day that suits you and we will confirm a time.',
  },
};

const GREEN = '#10b981';

// A safety net, not a substitute for getting the API right.
//
// PHP arrays with non-sequential keys serialise to a JSON *object*, not an
// array — so a backend collection that was filtered without being re-indexed
// arrives as {"0":{…},"2":{…}} and .map() on it throws. That is a real bug and
// belongs fixed server-side (ServiceRecommendationService re-indexes with
// ->values()), but this is a client-facing page: coping with the shape beats
// showing a paying customer a blank crashed screen.
const asList = <T,>(value: T[] | Record<string, T> | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

function ServiceCard({ service, currency, onAct, expanded, onToggleExpand }: {
  service: PortalService;
  currency: string;
  onAct: (service: PortalService, intent: ServiceIntent) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {service.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.icon_url} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover', border: '1px solid #f1f5f9' }} />
        ) : (
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
            {service.icon_emoji}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{service.name}</span>
            {service.is_featured && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 20, background: '#fffbeb', color: '#b45309', fontSize: 10, fontWeight: 700 }}>
                <HiStar size={9} /> POPULAR
              </span>
            )}
          </div>
          {service.short_description && (
            <p style={{
              margin: '4px 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.5,
              // Collapsed to three lines so a grid of cards stays level; the
              // full text is one click away rather than truncated for good.
              ...(expanded ? {} : {
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
              }),
            }}>
              {service.short_description}
            </p>
          )}
          {service.starting_price !== null && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, marginTop: 6 }}>
              From {currency} {service.starting_price.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
        <button onClick={onToggleExpand} style={{
          padding: '6px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0',
          background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          {expanded ? 'Show Less' : 'Learn More'}
        </button>
        <button onClick={() => onAct(service, 'quote')} style={{
          padding: '6px 12px', borderRadius: 7, border: 'none',
          background: GREEN, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Request Quote
        </button>
        <button onClick={() => onAct(service, 'new_project')} style={{
          padding: '6px 12px', borderRadius: 7, border: '1.5px solid #bbf7d0',
          background: '#f0fdf4', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Start Project
        </button>
        <button onClick={() => onAct(service, 'consultation')} style={{
          padding: '6px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0',
          background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Consultation
        </button>
      </div>
    </div>
  );
}

export default function RecommendedServices({
  currency = 'USD',
  // The dashboard shows a trimmed section with a link through to the full
  // page; /client/services shows everything.
  compact = false,
}: {
  currency?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [data, setData]       = useState<PortalServices | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [dialog, setDialog]   = useState<{ service: PortalService; intent: ServiceIntent } | null>(null);
  const [message, setMessage] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    clientServicesService.list()
      .then(setData)
      // A 403 here just means the company switched this section off for this
      // client — that is not an error worth shouting about, the section simply
      // doesn't render.
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const openDialog = (service: PortalService, intent: ServiceIntent) => {
    setDialog({ service, intent });
    setMessage('');
    setPreferredDate('');
  };

  const submit = async () => {
    if (!dialog) return;
    setSending(true);
    try {
      await clientServicesService.request({
        company_service_id: dialog.service.id,
        intent: dialog.intent,
        message: message.trim() || null,
        preferred_date: dialog.intent === 'consultation' ? (preferredDate || null) : null,
      });
      toast.success(`Request sent — the team will be in touch about ${dialog.service.name}.`);
      setDialog(null);
    } catch (err) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(ex.response?.data?.message ?? 'Could not send your request');
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  const recommended = asList(data?.recommended);
  const featured    = asList(data?.featured);
  const others      = asList(data?.all);
  const basedOn     = asList(data?.based_on);

  // Nothing enabled, or the section is switched off for this client — render
  // nothing at all rather than an empty "Recommended Services" heading.
  if (!data || recommended.length + featured.length + others.length === 0) return null;

  const section = (title: string, subtitle: string | null, services: PortalService[]) => {
    if (services.length === 0) return null;
    const shown = compact ? services.slice(0, 3) : services;
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {shown.map(s => (
            <ServiceCard
              key={s.id}
              service={s}
              currency={currency}
              onAct={openDialog}
              expanded={expanded === s.id}
              onToggleExpand={() => setExpanded(prev => (prev === s.id ? null : s.id))}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <HiSparkles size={18} color={GREEN} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Grow Your Business With Us</h2>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#94a3b8' }}>
        Other things we can take off your hands.
      </p>

      {section(
        'Recommended For You',
        // Says WHY, from what the client already has — a suggestion without a
        // reason reads as an advert.
        basedOn.length > 0
          ? `Based on your ${basedOn.slice(0, 3).join(', ')} work with us.`
          : null,
        recommended,
      )}
      {section('Popular Services', 'What most of our clients ask for.', featured)}
      {section(compact ? 'More Services' : 'All Services', null, others)}

      {compact && (
        <button onClick={() => router.push('/client/services')} style={{
          padding: '9px 18px', borderRadius: 8, border: '1.5px solid #bbf7d0',
          background: '#f0fdf4', color: '#059669', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          See all services →
        </button>
      )}

      {/* Request dialog. One form for all three intents — they differ in what
          the client wants next, not in what we need from them; consultation
          also asks for a date. */}
      {dialog && (
        <div
          onClick={() => setDialog(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {INTENT_COPY[dialog.intent].heading}
              </h3>
              <button onClick={() => setDialog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>
                <HiXMark size={20} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 3 }}>{dialog.service.name}</div>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#94a3b8' }}>{INTENT_COPY[dialog.intent].blurb}</p>

            {dialog.intent === 'consultation' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={e => setPreferredDate(e.target.value)}
                  // Today's date as the floor, matching the server's
                  // after_or_equal:today — a date in the past is a typo, and
                  // it would sit in the queue looking overdue.
                  min={new Date().toISOString().slice(0, 10)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Anything we should know?
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Optional — the more you tell us, the closer our first answer will be."
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {/* Not an intent — a support request belongs in the support
                  queue, so this leaves the sales flow entirely. */}
              <button
                onClick={() => { setDialog(null); router.push('/client/support/create'); }}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer', marginRight: 'auto' }}
              >
                Contact Support instead
              </button>
              <button onClick={() => setDialog(null)} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submit} disabled={sending} style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: sending ? '#cbd5e1' : GREEN, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: sending ? 'wait' : 'pointer',
              }}>
                {sending ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

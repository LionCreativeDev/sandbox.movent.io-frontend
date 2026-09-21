'use client';
import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import { clientService } from '@/lib/services/clientService';
import RecommendedServices from '@/components/client/RecommendedServices';
import { AiService } from '@/components/client/ai-services/types';
import { aiServiceCategoryStyle } from '@/components/client/ai-services/categoryStyle';
import SectionHeader from '@/components/client/ai-services/SectionHeader';
import CategoryFilter from '@/components/client/ai-services/CategoryFilter';
import FeaturedServiceCard from '@/components/client/ai-services/FeaturedServiceCard';
import ServiceCard from '@/components/client/ai-services/ServiceCard';
import { AI_THEME } from '@/components/client/ai-services/theme';

type DashboardStats = {
  total_invoices?: number;
  paid_count?: number;
  paid_amount?: number;
  pending_count?: number;
  pending_amount?: number;
  overdue_count?: number;
  total_projects?: number;
  pending_projects?: number;
  ongoing_projects?: number;
  completed_projects?: number;
};

type DashboardData = {
  stats?: DashboardStats;
  portal_available?: Record<string, boolean>;
  portal_permissions?: Record<string, boolean>;
  ai_services?: AiService[];
};

function fmt(n: number, cur = 'USD') {
  return `${cur} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function StatCard({ label, value, sub, color, href }: { label: string; value: string | number; sub?: string; color?: string; href?: string }) {
  const inner = (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid #e2e8f0', height: '100%', boxSizing: 'border-box', cursor: href ? 'pointer' : 'default', transition: 'box-shadow .15s' }}
      onMouseEnter={e => href && ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)')}
      onMouseLeave={e => href && ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#1e293b' }}>{value}</div>
      {/* Always rendered (invisible when absent) so every card reserves the
          same footer space and matches height, regardless of whether it has
          a sub line — never collapse this to `sub && <div>...` again. */}
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, visibility: sub ? 'visible' : 'hidden' }}>{sub || ' '}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{inner}</Link> : <div style={{ height: '100%' }}>{inner}</div>;
}

export default function ClientDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingService, setRequestingService] = useState<string | null>(null);
  const [serviceMessage, setServiceMessage] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    clientService.dashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading dashboard…</div>
    </div>
  );

  const s = data?.stats || {};

  // Two separate questions, both answered by the backend (see
  // Api\Client\DashboardController) — never re-derived from `modules` here,
  // which is the company-wide purchase list and cannot see the Admin's
  // per-client Portal toggle:
  //   available — does the tile render at all?
  //   allowed   — is the tile clickable, and does its list render?
  // A module the Admin switched off for this client is available but not
  // allowed: the tile still shows its real count, but leads nowhere and its
  // list is withheld. Both default to true so an older API response (no such
  // keys) keeps the previous behaviour instead of blanking the dashboard.
  const avail   = data?.portal_available   || {};
  const allowed = data?.portal_permissions || {};
  const invoicesAvailable = avail.invoices !== false;
  const projectsAvailable = avail.projects !== false;
  const invoicesAllowed   = allowed.invoices !== false;
  const projectsAllowed   = allowed.projects !== false;

  const aiServices: AiService[] = data?.ai_services || [];
  const overdueCount = s.overdue_count ?? 0;

  const requestAiService = async (service: AiService) => {
    setRequestingService(service.key);
    setServiceMessage('');

    try {
      await clientService.requestService({ service_key: service.key });
      // Backend-sourced status now, not local-only state — so this survives
      // a reload instead of resetting, unlike before this feature persisted
      // requests (see Api\Client\DashboardController::requestService()).
      setData(prev => prev && {
        ...prev,
        ai_services: (prev.ai_services || []).map(s => s.key === service.key ? { ...s, status: 'requested' as const } : s),
      });
      setServiceMessage(`${service.name} request sent to admin.`);
    } catch (error: unknown) {
      const apiError = error as AxiosError<{ message?: string }>;
      setServiceMessage(apiError.response?.data?.message || 'Could not send request. Please try again.');
    } finally {
      setRequestingService(null);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Buckets in first-seen order across this client's own suggestion list —
  // never a fixed hardcoded set, so a filter tab never shows with nothing
  // behind it (see CategoryFilter.tsx).
  const aiServiceCategories = Array.from(new Set(aiServices.map(sv => aiServiceCategoryStyle(sv.category).bucket)));

  const featuredService = activeCategory === 'All' ? aiServices[0] : undefined;
  const gridServices = featuredService
    ? aiServices.slice(1)
    : aiServices.filter(sv => aiServiceCategoryStyle(sv.category).bucket === activeCategory);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>Welcome to your client portal</p>

      {/* ── Summary stat widgets — fixed 4-per-row grid, wraps to a new row
          instead of packing however many fit the screen width ── */}
      {/* href is passed only when the module is allowed — StatCard renders a
          plain div (no Link, no pointer cursor, no hover lift) without it, so
          a disabled module's tile still shows its number but goes nowhere. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {invoicesAvailable && (
          <>
            <StatCard
              label="Total Invoices"
              value={s.total_invoices ?? 0}
              color="#1e293b"
              href={invoicesAllowed ? '/client/invoices' : undefined}
            />
            <StatCard
              label="Paid Invoices"
              value={s.paid_count ?? 0}
              sub={fmt(s.paid_amount ?? 0, 'USD')}
              color={AI_THEME.navy}
              href={invoicesAllowed ? '/client/invoices' : undefined}
            />
            <StatCard
              label="Pending Invoices"
              value={s.pending_count ?? 0}
              sub={fmt(s.pending_amount ?? 0, 'USD')}
              color="#d97706"
              href={invoicesAllowed ? '/client/invoices' : undefined}
            />
          </>
        )}
        {projectsAvailable && (
          <>
            <StatCard
              label="Total Projects"
              value={s.total_projects ?? 0}
              color="#1e293b"
              href={projectsAllowed ? '/client/projects' : undefined}
            />
            <StatCard
              label="Pending Projects"
              value={s.pending_projects ?? 0}
              color="#d97706"
              href={projectsAllowed ? '/client/projects' : undefined}
            />
            <StatCard
              label="Ongoing Projects"
              value={s.ongoing_projects ?? 0}
              color="#2563eb"
              href={projectsAllowed ? '/client/projects' : undefined}
            />
            <StatCard
              label="Completed Projects"
              value={s.completed_projects ?? 0}
              color={AI_THEME.navy}
              href={projectsAllowed ? '/client/projects' : undefined}
            />
          </>
        )}
      </div>

      {/* ── Grow Your Business With Us ──
          Directly above "AI Suggested IT Services" so the two offers read as
          one block, this one first: these are the company's own enabled
          services with real prices, and its top list is drawn from what this
          client already has with us. The AI list below is generic suggestion,
          so it reads as the weaker of the two and belongs second.

          Renders nothing at all when the company has enabled no services or
          switched the section off for this client, so it never leaves an empty
          heading — or a gap — behind. `compact` trims each list to three cards
          with a link through to the full page. */}
      <RecommendedServices compact variant="navy" />

      {aiServices.length > 0 && (
        // No boxed/bordered wrapper — the page background is already this
        // section's cream, so a nested card here would be cream-on-cream.
        // Page spacing (this margin) and the hero/cards' own white surfaces
        // do the separating instead.
        <section style={{ marginBottom: 24 }}>
          <SectionHeader
            title="AI Suggested IT Services"
            subtitle="Choose a service and your admin team will receive the request by email."
            right={serviceMessage && (
              <div style={{ fontSize: 12, color: serviceMessage.includes('Could not') ? '#dc2626' : AI_THEME.navy, fontWeight: 700, textAlign: 'right' }}>
                {serviceMessage}
              </div>
            )}
          />

          {aiServiceCategories.length > 1 && (
            <CategoryFilter categories={aiServiceCategories} active={activeCategory} onChange={setActiveCategory} />
          )}

          {featuredService && (
            <FeaturedServiceCard
              service={featuredService}
              requesting={requestingService === featuredService.key}
              onRequest={requestAiService}
            />
          )}

          <div className="ai-services-grid">
            {gridServices.map(service => (
              <ServiceCard
                key={service.key}
                service={service}
                requesting={requestingService === service.key}
                expanded={expandedKeys.has(service.key)}
                onToggleExpand={() => toggleExpand(service.key)}
                onRequest={requestAiService}
              />
            ))}
          </div>
          <style jsx>{`
            .ai-services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
            @media (max-width: 900px) {
              .ai-services-grid { grid-template-columns: repeat(2, 1fr); }
            }
            @media (max-width: 600px) {
              .ai-services-grid { grid-template-columns: 1fr; }
            }
          `}</style>
        </section>
      )}

      {/* ── No invoices yet — empty state. Suppressed when Invoices is off
          for this client: "your invoices will appear here" is a promise the
          portal can no longer keep, and the tiles above already carry the
          real count. ── */}
      {invoicesAvailable && invoicesAllowed && s.total_invoices === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px dashed #e2e8f0', padding: '48px 24px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>No invoices yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Your invoices will appear here once they have been sent to you</div>
        </div>
      )}

      {/* ── Overdue alert banner ── */}
      {overdueCount > 0 && (
        <div style={{ marginTop: 20, padding: '14px 20px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>⚠ {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>Please settle your outstanding balance to avoid service interruption</div>
          </div>
          {/* The count stays — it is a stat, like the tiles — but the CTA is
              dropped when Invoices is off, since it would only lead to the
              "not enabled" screen. */}
          {invoicesAllowed && (
            <Link href="/client/invoices?status=overdue" style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
              View Overdue
            </Link>
          )}
        </div>
      )}

    </div>
  );
}

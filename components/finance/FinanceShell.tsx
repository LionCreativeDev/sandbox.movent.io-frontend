'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getAuthType, hasCompanyModule, FINANCE_MODULE_KEY } from '@/lib/auth';
import {
  financeService, FinanceCapabilities, FinanceCapabilityKey, CompanyOption,
} from '@/lib/services/financeService';
import { NoAccess } from './shared';

/**
 * The frame every Finance screen renders inside: the section tabs, the
 * capability lookup, and the "you may not open this" fallback.
 *
 * Capabilities come from the server (GET /finance/capabilities) rather than
 * from the permission cookie the rest of the app reads. Two reasons: the
 * cookie can be stale until the next /user/me refresh, and the Finance gate
 * is a union of Finance-module and Invoice-module keys that the server
 * already resolves — re-deriving that rule in the browser would give it two
 * places to disagree.
 *
 * It is still only a rendering decision. Every endpoint re-checks the same
 * permission server-side, so a tampered capability map buys nothing but a
 * button that answers 403.
 */

const FINANCE_TABS: { key: FinanceCapabilityKey; label: string; slug: string }[] = [
  { key: 'dashboard.view',      label: 'Dashboard',         slug: '' },
  { key: 'invoices.view',       label: 'Invoices',          slug: 'invoices' },
  { key: 'payments.view',       label: 'Payments',          slug: 'payments' },
  { key: 'payment_details.view', label: 'Payment Details',  slug: 'payment-details' },
  { key: 'reminders.track',     label: 'Invoice Reminders', slug: 'invoice-reminders' },
  { key: 'reports.finance',     label: 'Reports',           slug: 'reports' },
];

// Reminders and Reports each have more than one key that should reveal the
// tab — someone who may only CREATE reminders still needs the tab, and
// someone with only the Revenue report still needs Reports.
const TAB_ALTERNATES: Partial<Record<FinanceCapabilityKey, FinanceCapabilityKey[]>> = {
  'reminders.track':  ['reminders.create', 'reminders.send'],
  'reports.finance':  ['reports.revenue', 'reports.payments'],
};

interface FinanceCtx {
  can: (key: FinanceCapabilityKey) => boolean;
  capabilities: FinanceCapabilities | null;
  companies: CompanyOption[];
  /** '/finance' for staff, '/admin/finance' for a Company Admin. */
  root: string;
  /** '/invoices' for staff, '/admin/invoices' — where the shared invoice screens live. */
  invoiceRoot: string;
  refresh: () => void;
}

const Ctx = createContext<FinanceCtx | null>(null);

export const useFinance = (): FinanceCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFinance must be used inside <FinanceShell>');
  return ctx;
};

export default function FinanceShell({
  title,
  /** The capability this screen needs. Omit for a screen with its own gate. */
  requires,
  requiresAny,
  children,
}: {
  title: string;
  requires?: FinanceCapabilityKey;
  requiresAny?: FinanceCapabilityKey[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [capabilities, setCapabilities] = useState<FinanceCapabilities | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  // Cookie-derived, so it must be state: reading it during the first render
  // would differ between server and client and trip a hydration mismatch —
  // the same reason app/invoices/new/page.tsx keeps isAdmin in state.
  const [isAdmin, setIsAdmin] = useState(false);

  // No Finance module for the active company (never bought, or switched off
  // by the Super Admin) — leave the area entirely, the same way
  // useModuleGuard bounces a module page, rather than render a Finance frame
  // that can never hold anything. A permission the user may still hold is
  // irrelevant here: module entitlement comes first.
  const leaveFinance = () => {
    router.replace(getAuthType() === 'admin' ? '/admin/dashboard' : '/dashboard');
  };

  const load = () => {
    financeService.capabilities()
      .then(d => { setCapabilities(d.capabilities); setCompanies(d.companies ?? []); })
      .catch((err: { response?: { status?: number } }) => {
        setCapabilities(null);
        // 403 from /finance/capabilities means the route's
        // module:finance_dashboard gate refused — the endpoint itself has no
        // permission gate — so this company has no Finance at all. Anything
        // else (network, 5xx) falls through to the NoAccess block below.
        if (err?.response?.status === 403) leaveFinance();
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAdmin(getAuthType() === 'admin');
    load();
    // Fired by DashboardLayout after every /me refresh (mount, 60s poll,
    // company switch). That payload's module list is the active company's,
    // so a Super Admin deactivation or a company switch is caught here
    // without waiting for the next Finance request to 403. Finance
    // permissions are per-company too, so capabilities are re-read as well.
    const onAuthRefreshed = () => {
      if (!hasCompanyModule(FINANCE_MODULE_KEY)) {
        leaveFinance();
        return;
      }
      load();
    };
    window.addEventListener('auth_refreshed', onAuthRefreshed);
    return () => window.removeEventListener('auth_refreshed', onAuthRefreshed);
  }, []);

  const root = isAdmin ? '/admin/finance' : '/finance';
  const invoiceRoot = isAdmin ? '/admin/invoices' : '/invoices';

  const can = (key: FinanceCapabilityKey): boolean => capabilities?.[key] === true;
  const canAnyOf = (keys: FinanceCapabilityKey[]): boolean => keys.some(can);

  const visibleTabs = FINANCE_TABS.filter(t => can(t.key) || canAnyOf(TAB_ALTERNATES[t.key] ?? []));

  const allowed = loading
    || (!requires && !requiresAny)
    || (requires ? can(requires) : false)
    || (requiresAny ? canAnyOf(requiresAny) : false);

  const href = (slug: string) => (slug ? `${root}/${slug}` : root);
  // Exact match wins; otherwise the longest tab href the current path sits
  // under — the same "one winner" rule the sidebar uses, so Dashboard (whose
  // href is a prefix of every other) never lights up alongside a child.
  const activeHref = visibleTabs.map(t => href(t.slug)).includes(pathname)
    ? pathname
    : visibleTabs.map(t => href(t.slug))
        .filter(h => pathname.startsWith(`${h}/`))
        .sort((a, b) => b.length - a.length)[0];

  return (
    <DashboardLayout title={title}>
      <Ctx.Provider value={{ can, capabilities, companies, root, invoiceRoot, refresh: load }}>
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Finance</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              Invoices, payments, reconciliation and reporting for your company
            </p>
          </div>

          {visibleTabs.length > 0 && (
            <div style={{
              display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #f1f5f9',
              overflowX: 'auto', paddingBottom: 1,
            }}>
              {visibleTabs.map(tab => {
                const h = href(tab.slug);
                const active = h === activeHref;
                return (
                  <Link
                    key={tab.slug || 'dashboard'}
                    href={h}
                    style={{
                      padding: '10px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                      color: active ? '#2563eb' : '#64748b',
                      borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
                      textDecoration: 'none', marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          )}

          {loading
            ? <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
            : allowed
              ? children
              : <NoAccess what={title} />}
        </div>
      </Ctx.Provider>
    </DashboardLayout>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import {
  HiSquares2X2, HiFolder, HiDocumentText, HiCreditCard,
  HiArrowDownTray, HiLifebuoy, HiChartBar, HiSparkles, HiUserCircle,
  HiWallet,
} from 'react-icons/hi2';
import clientApi from '@/lib/clientAxios';
import { DASHBOARD_THEME } from './dashboardTheme';

// Module key → nav item map (Dashboard is always visible)
//
// No "Chat" entry — a Client only ever chats within a Project's own Chat tab
// (Api\Client\ProjectChatController). The separate account-level Sales Chat
// was removed outright on 2026-09-11 (page, routes and Api\Client\
// ChatController all deleted): a sales conversation belongs to the LEAD
// stage, where it runs in the CRM's Lead → Sales Chat tab and on the lead's
// own no-login link, and anyone who has become a Client has by definition
// paid — so a Project exists and its chat is the live conversation.
const NAV = [
  { key: null,        label: 'Dashboard', icon: HiSquares2X2,         path: '/client/dashboard' },
  { key: 'projects',  label: 'Projects',  icon: HiFolder,              path: '/client/projects' },
  { key: 'invoices',  label: 'Invoices',  icon: HiDocumentText,        path: '/client/invoices' },
  { key: 'payments',  label: 'Payments',  icon: HiCreditCard,          path: '/client/payments' },
  // No "Payment Assistant" entry (hidden 2026-09-21). The floating AI
  // Assistance widget now does the same job from every portal page —
  // "Pay an Invoice" walks through the same lookup, the same saved cards and
  // the same confirmation, sharing the very same server-side session
  // (payment_assistant_sessions) — so a separate sidebar link was a second
  // door onto one room.
  //
  // The PAGE itself is untouched and still served at
  // /client/payment-assistant, along with all its /client/payment-assistant/*
  // endpoints. Only the nav entry is gone, so anyone with the URL (or an old
  // bookmark, or the "Continue to Payment Assistant" button on the
  // card-added screen) still lands on a working screen.
  { key: 'invoices',  label: 'Payment Methods',   icon: HiWallet,              path: '/client/payment-methods' },
  { key: 'documents', label: 'Documents', icon: HiArrowDownTray,       path: '/client/documents' },
  { key: 'support',   label: 'Support',   icon: HiLifebuoy,            path: '/client/support' },
  { key: 'reports',   label: 'Reports',   icon: HiChartBar,            path: '/client/reports' },
  // The company's own services. Last on purpose: it's an offer, not part of
  // the client's own account, so it sits below everything they came here to do.
  { key: 'services',  label: 'Services',  icon: HiSparkles,            path: '/client/services' },
  // key: null — the client's own details are theirs, not a portal module the
  // company can switch off, so this is never filtered out by permissions.
  { key: null,        label: 'My Profile', icon: HiUserCircle,         path: '/client/profile' },
];

const GREEN   = '#10b981';
const GREENBG = '#ecfdf5';

// `variant="navy"` is passed only from ClientLayout when the current route
// is /client/dashboard — every other portal page renders the default green
// sidebar unchanged. See dashboardTheme.ts for why this exists at all.
export default function ClientSidebar({ variant = 'default' }: { variant?: 'default' | 'navy' }) {
  const pathname = usePathname();
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);
  const [companyName, setCompanyName] = useState('');
  const navy = variant === 'navy';

  useEffect(() => {
    try {
      const info = JSON.parse(Cookies.get('client_info') || '{}');
      setCompanyName(info.company_name || '');
    } catch { /* ignore */ }

    const token = Cookies.get('client_token');
    if (!token) return;

    clientApi.get('/client/permissions')
      .then(r => setPerms(r.data.data || {}))
      .catch(() => setPerms({})); // on error → show all
  }, []);

  const visible = NAV.filter(item => {
    if (item.key === null) return true;      // Dashboard always shown
    if (perms === null) return true;          // still loading → show all
    return perms[item.key] !== false;         // hide only if explicitly false
  });

  return (
    <aside style={{
      width: 240, minHeight: '100vh',
      background: navy ? DASHBOARD_THEME.navy : '#fff',
      borderRight: navy ? 'none' : '1px solid #e2e8f0',
      position: 'fixed', top: 0, left: 0,
      display: 'flex', flexDirection: 'column', zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 14px',
        borderBottom: navy ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: navy ? DASHBOARD_THEME.navyActive : 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: navy ? DASHBOARD_THEME.gold : '#fff', fontWeight: 800, fontSize: 16 }}>C</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: navy ? '#fff' : '#1e293b' }}>Client Portal</div>
            <div style={{ fontSize: 11, color: navy ? 'rgba(255,255,255,0.55)' : '#94a3b8' }}>{companyName || 'Secure Access'}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px' }}>
        {visible.map(({ label, icon: Icon, path }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <Link key={path} href={path} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                background: active ? (navy ? DASHBOARD_THEME.navyActive : GREENBG) : 'transparent',
                color: active ? (navy ? '#fff' : GREEN) : (navy ? 'rgba(255,255,255,0.65)' : '#64748b'),
                fontWeight: active ? 600 : 400, fontSize: 13,
                transition: 'all 0.15s', cursor: 'pointer',
              }}>
                <Icon size={18} />
                {label}
                {active && (
                  <div style={{
                    marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%',
                    background: navy ? DASHBOARD_THEME.gold : GREEN,
                  }} />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: navy ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f1f5f9',
      }}>
        <div style={{ fontSize: 11, color: navy ? 'rgba(255,255,255,0.35)' : '#cbd5e1', textAlign: 'center' }}>
          Client Portal v1.0
        </div>
      </div>
    </aside>
  );
}

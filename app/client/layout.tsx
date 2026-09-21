'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { isClientAuthenticated, getClientUser, getClientInfo, clientLogout } from '@/lib/clientAuth';
import ClientSidebar from '@/components/client/ClientSidebar';
import {
  HiBell, HiChevronDown, HiArrowRightOnRectangle, HiXMark,
} from 'react-icons/hi2';
import clientApi from '@/lib/clientAxios';
import { clientNotificationService, ClientNotification } from '@/lib/services/clientNotificationService';
import toast from 'react-hot-toast';
import { DASHBOARD_THEME } from '@/components/client/dashboardTheme';

// Portal screens reachable WITHOUT a session.
//
// One list, used by all three checks below — the auth redirect, the
// notification poll, and the sidebar wrapper. They were not one list before,
// and that is exactly how /client/forgot-password ended up bouncing straight
// back to the login page: the wrapper knew it was a logged-out screen, but the
// redirect above it only ever exempted /client/login, so an unauthenticated
// visitor was pushed back before the page could render.
//
// Reset is here for the same reason — it is opened from an email link, by
// definition without a session.
const PUBLIC_PORTAL_PATHS = [
  '/client/login',
  '/client/forgot-password',
  '/client/reset-password',
];

const isPublicPortalPath = (pathname: string) => PUBLIC_PORTAL_PATHS.includes(pathname);

// The floating assistant, mounted ONCE here rather than per page.
//
// Two things follow from it living in the layout, and both are the point: it
// is on every portal screen without any page having to know about it, and a
// route change re-renders `children` underneath it without unmounting it — so
// the conversation survives navigating from Invoices to Projects mid-flow.
//
// Loaded on demand (ssr: false) because it is a client-only, cookie-reading
// widget nobody needs in the first paint of a dashboard.
const PortalAssistant = dynamic(
  () => import('@/components/client/assistant/PortalAssistant'),
  { ssr: false },
);

// "3m ago" / "2h ago" / "5d ago" — enough for a portal bell, no date lib needed.
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted]           = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser]                 = useState<{ name: string; email: string } | null>(null);
  const [clientInfo, setClientInfo]     = useState<{ company_name: string } | null>(null);

  // Notifications — mirrors the staff Navbar bell (30s poll, data.link routing)
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifOpen, setNotifOpen]         = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isPublicPortalPath(pathname)) return;
    if (!isClientAuthenticated()) {
      router.push('/client/login');
      return;
    }
    const u = getClientUser();
    const c = getClientInfo();
    if (u) setUser(u);
    if (c) setClientInfo(c);
  }, [router, pathname]);

  useEffect(() => {
    if (isPublicPortalPath(pathname) || !isClientAuthenticated()) return;
    const load = () => {
      clientNotificationService.list()
        .then(res => { setNotifications(res.notifications); setUnreadCount(res.unread_count); })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Defense-in-depth: a stale or mistargeted backend link pointing outside
  // the Client Portal (e.g. a staff route like /projects/{id}/chat) would
  // send this session's requests out with no auth_token cookie — the staff
  // page 401s, and the staff axios interceptor treats that as an invalid
  // session and hard-redirects to the staff /login, stranding the client
  // mid-task. Only ever follow a link that stays inside /client/...
  const linkOf = (n: ClientNotification): string | null => {
    const link = typeof n.data?.link === 'string' ? n.data.link : null;
    return link && link.startsWith('/client/') ? link : null;
  };

  const handleNotifClick = (n: ClientNotification) => {
    if (!n.is_read) {
      clientNotificationService.markRead(n.id).catch(() => {});
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    const link = linkOf(n);
    if (link) {
      setNotifOpen(false);
      router.push(link);
    }
  };

  const markAllRead = () => {
    clientNotificationService.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnreadCount(0);
  };

  const clearOne = (e: React.MouseEvent, n: ClientNotification) => {
    e.stopPropagation();
    clientNotificationService.clear(n.id).catch(() => {});
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    if (!n.is_read) setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleLogout = async () => {
    try { await clientApi.post('/client/logout'); } catch {}
    clientLogout();
    toast.success('Logged out');
    router.push('/client/login');
  };

  if (!mounted) return null;

  // Unauthenticated portal screens: no sidebar/navbar wrapper. A sidebar built
  // from /client/permissions is meaningless on a page reached without a session.
  if (isPublicPortalPath(pathname)) return <>{children}</>;

  // Navy/cream/gold theme applies portal-wide — see dashboardTheme.ts.
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: DASHBOARD_THEME.pageBg }}>
      <ClientSidebar variant="navy" />

      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          height: 60, background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: DASHBOARD_THEME.textPrimary }}>
              {clientInfo?.company_name || 'Client Portal'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                aria-label="Notifications"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                <HiBell size={20} color="#64748b" />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0,
                    minWidth: 16, height: 16, padding: '0 4px',
                    borderRadius: 8, background: '#ef4444', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 200,
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: DASHBOARD_THEME.textPrimary }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: DASHBOARD_THEME.navy, padding: 0 }}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                      No notifications yet
                    </div>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      style={{
                        padding: '10px 14px', borderBottom: '1px solid #f8fafc',
                        cursor: linkOf(n) ? 'pointer' : 'default',
                        background: n.is_read ? '#fff' : DASHBOARD_THEME.badgeBg,
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                      }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700, color: '#1e293b' }}>
                          {n.title ?? 'Notification'}
                        </div>
                        {n.body && (
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{n.body}</div>
                        )}
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                      </div>
                      <button
                        onClick={e => clearOne(e, n)}
                        aria-label="Dismiss"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2, flexShrink: 0 }}>
                        <HiXMark size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 12px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 50, cursor: 'pointer',
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${DASHBOARD_THEME.navyActive}, ${DASHBOARD_THEME.navy})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 12,
                }}>
                  {user?.name?.[0]?.toUpperCase() ?? 'C'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: DASHBOARD_THEME.textPrimary }}>{user?.name ?? 'Client'}</div>
                  <div style={{ fontSize: 10, color: DASHBOARD_THEME.textSecondary }}>Client</div>
                </div>
                <HiChevronDown size={12} color="#94a3b8" />
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  minWidth: 180, zIndex: 200, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{user?.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12, color: '#ef4444', fontWeight: 500,
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <HiArrowRightOnRectangle size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>

      {(dropdownOpen || notifOpen) && (
        <div
          onClick={() => { setDropdownOpen(false); setNotifOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        />
      )}

      {/* Sibling of the page content, not part of it — so it is never inside
          a scroll container or a stacking context that would trap it. */}
      <PortalAssistant navy />
    </div>
  );
}

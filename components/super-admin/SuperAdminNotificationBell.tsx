'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiBell, HiBuildingOffice2, HiXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import {
  superAdminNotificationService,
  SuperAdminNotification,
  SuperAdminNotificationCategoryCount,
} from '@/lib/services/superAdminNotificationService';

// Platform-level bell for the Super Admin console.
//
// What may appear here is decided server-side
// (App\Services\SuperAdminNotificationService::TYPES) — accounts, companies,
// payments, subscriptions, system/compliance alerts, support escalations. A
// tenant's own traffic is filtered out before it ever reaches this component,
// so there is no client-side allow-list to keep in step.

const PURPLE = '#7c3aed';

// Small colour cue per category, so a failed payment doesn't read like a new
// sign-up at a glance.
const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  accounts:      { bg: '#eff6ff', color: '#2563eb' },
  companies:     { bg: '#f5f3ff', color: '#7c3aed' },
  payments:      { bg: '#ecfdf5', color: '#059669' },
  subscriptions: { bg: '#fffbeb', color: '#b45309' },
  system:        { bg: '#fef2f2', color: '#dc2626' },
  compliance:    { bg: '#fef2f2', color: '#b91c1c' },
  support:       { bg: '#fff7ed', color: '#c2410c' },
};

const POLL_MS = 30000;

export default function SuperAdminNotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SuperAdminNotification[]>([]);
  const [categories, setCategories] = useState<SuperAdminNotificationCategoryCount[]>([]);
  const [unread, setUnread] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = (category: string | null) => {
    setLoading(true);
    superAdminNotificationService.list(category ?? undefined)
      .then(res => {
        setItems(res.notifications);
        setCategories(res.categories);
        setUnread(res.unread_count);
      })
      .catch(() => { /* a bell that fails to load stays quiet */ })
      .finally(() => setLoading(false));
  };

  // The dot polls on its own; the list is only fetched when the panel opens,
  // so a console left open all day doesn't pull 30 rows every 30 seconds.
  useEffect(() => {
    const tick = () => superAdminNotificationService.unreadCount().then(setUnread).catch(() => {});
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load(active);
  };

  const pickCategory = (key: string | null) => {
    setActive(key);
    load(key);
  };

  const openItem = async (n: SuperAdminNotification) => {
    if (!n.is_read) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread(c => Math.max(0, c - 1));
      superAdminNotificationService.markRead(n.id).catch(() => {});
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  const clearOne = async (e: React.MouseEvent, n: SuperAdminNotification) => {
    e.stopPropagation();
    setItems(prev => prev.filter(x => x.id !== n.id));
    if (!n.is_read) setUnread(c => Math.max(0, c - 1));
    try {
      await superAdminNotificationService.clear(n.id);
    } catch {
      toast.error('Could not clear that notification');
      load(active);
    }
  };

  const markAllRead = async () => {
    setItems(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnread(0);
    try {
      await superAdminNotificationService.markAllRead();
      load(active);
    } catch { toast.error('Could not mark all as read'); }
  };

  const clearAll = async () => {
    setItems([]);
    setUnread(0);
    try {
      await superAdminNotificationService.clearAll();
      load(active);
    } catch { toast.error('Could not clear notifications'); }
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          cursor: 'pointer', display: 'flex', padding: 4, color: '#64748b',
        }}
      >
        <HiBell size={22} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4,
            minWidth: 17, height: 17, padding: '0 4px',
            background: '#ef4444', color: '#fff',
            borderRadius: 9, border: '2px solid #fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          width: 400, maxWidth: '90vw',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,0.14)', zIndex: 200, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Notifications</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: PURPLE, fontSize: 12, fontWeight: 600, padding: 0,
              }}>Mark all as read</button>
              <button onClick={clearAll} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#94a3b8', fontSize: 12, fontWeight: 600, padding: 0,
              }}>Clear all</button>
            </div>
          </div>

          {/* Category filter — the same grouping the server files each event
              under, so "show me only payments" is one click. */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto',
            borderBottom: '1px solid #f1f5f9',
          }}>
            {[{ key: null, label: 'All', unread }, ...categories].map(c => {
              const isActive = active === c.key;
              return (
                <button
                  key={c.key ?? 'all'}
                  onClick={() => pickCategory(c.key as string | null)}
                  style={{
                    flexShrink: 0, padding: '5px 10px', borderRadius: 20,
                    border: `1px solid ${isActive ? PURPLE : '#e2e8f0'}`,
                    background: isActive ? '#f5f3ff' : '#fff',
                    color: isActive ? PURPLE : '#64748b',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.label}{c.unread > 0 ? ` (${c.unread})` : ''}
                </button>
              );
            })}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Nothing here yet.
              </div>
            ) : (
              items.map(n => {
                const style = CATEGORY_STYLE[n.category ?? ''] ?? { bg: '#f1f5f9', color: '#475569' };
                return (
                  <div
                    key={n.id}
                    onClick={() => openItem(n)}
                    style={{
                      padding: '11px 16px', borderBottom: '1px solid #f8fafc',
                      background: n.is_read ? '#fff' : '#faf5ff',
                      cursor: n.link ? 'pointer' : 'default',
                      display: 'flex', gap: 8, justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{n.title}</span>
                        {n.category_label && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 5,
                            background: style.bg, color: style.color, whiteSpace: 'nowrap',
                          }}>
                            {n.category_label}
                          </span>
                        )}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>{n.body}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                        {n.company_name && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10.5, fontWeight: 600, color: '#7c3aed',
                          }}>
                            <HiBuildingOffice2 size={11} />{n.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => clearOne(e, n)}
                      title="Clear notification"
                      style={{
                        border: 'none', background: 'transparent', color: '#cbd5e1',
                        cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1,
                      }}
                    >
                      <HiXMark size={15} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

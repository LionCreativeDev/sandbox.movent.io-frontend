'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { brandService, Brand, BrandPermissions } from '@/lib/services/brandService';
import { getAuthType } from '@/lib/auth';
import {
  HiPlusCircle, HiPencilSquare, HiTrash, HiMagnifyingGlass, HiEye,
  HiCheckCircle, HiNoSymbol, HiBuildingStorefront,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

// Brands — the trading names a company bills under (Invoice module). One page
// for both portals: /admin/brands re-exports it, and brandService switches
// between the admin and staff APIs. A Company Admin gets every action; a staff
// member only the ones their Invoice-module permissions allow, read from
// /user/brands/permissions so nothing on screen 403s when clicked.
//
// Add and Edit are their own pages (/brands/new, /brands/{id}/edit) rather
// than dialogs — see components/brands/BrandForm.tsx.

const errText = (err: unknown, fallback: string) => {
  const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const fieldErrors = ex.response?.data?.errors;
  if (fieldErrors) return Object.values(fieldErrors).flat().join(' · ');
  return ex.response?.data?.message ?? fallback;
};

const th: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 13, color: '#475569', verticalAlign: 'middle' };

const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
  border: `1.5px solid ${border}`, background: bg, color, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
});

const ADMIN_PERMS: BrandPermissions = { can_view: true, can_create: true, can_edit: true, can_delete: true };

export default function BrandsPage() {
  useAdminGuard();
  const router = useRouter();
  const isAdmin = getAuthType() === 'admin';
  const brandsRoot = isAdmin ? '/admin/brands' : '/brands';

  // can()-style gating reads cookies, absent server-side — hold the first
  // paint until mounted so server and client agree.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [perms, setPerms] = useState<BrandPermissions | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPerms(ADMIN_PERMS);
      return;
    }
    brandService.permissions()
      .then(setPerms)
      .catch(() => setPerms({ can_view: false, can_create: false, can_edit: false, can_delete: false }));
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      setBrands(await brandService.list(query ? { search: query } : undefined));
    } catch (err) {
      toast.error(errText(err, 'Failed to load brands'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (perms?.can_view) load(); else if (perms) setLoading(false); }, [perms, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStatus = async (b: Brand) => {
    setBusyId(b.id);
    try {
      const updated = await brandService.toggleStatus(b.id);
      setBrands(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      toast.success(updated.is_active ? 'Brand activated' : 'Brand deactivated');
    } catch (err) {
      toast.error(errText(err, 'Failed to update brand'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (b: Brand) => {
    if (!window.confirm(`Delete "${b.name}"?\n\nInvoices already raised under this brand keep their details — the brand just stops being offered.`)) return;
    setBusyId(b.id);
    try {
      await brandService.remove(b.id);
      toast.success('Brand deleted');
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to delete brand'));
    } finally {
      setBusyId(null);
    }
  };

  if (!mounted || !perms) {
    return (
      <DashboardLayout title="Brands">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!perms.can_view) {
    return (
      <DashboardLayout title="Brands">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          You don&apos;t have permission to view Brands.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Brands">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Brands</h1>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {perms.view_only
                ? 'The brands assigned to you. You can select these when creating an invoice — only your Company Admin or an Admin can change them.'
                : 'The trading names you bill under. Inactive brands stay on their old invoices but aren’t offered on new ones.'}
            </div>
          </div>
          {perms.can_create && (
            <button onClick={() => router.push(`${brandsRoot}/new`)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
              border: 'none', background: '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
              <HiPlusCircle size={17} /> Add Brand
            </button>
          )}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}
          style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '14px 18px', marginBottom: 14 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <HiMagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, phone, country…"
                style={{ width: '100%', padding: '8px 12px 8px 30px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#f1f5f9', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
            {query && (
              <button type="button" onClick={() => { setSearch(''); setQuery(''); }} style={{ padding: '8px 14px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Clear</button>
            )}
          </div>
        </form>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading brands…</div>
          ) : brands.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🏷️</div>
              <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                {query ? 'No brand matches that search' : perms.view_only ? 'No brands assigned to you' : 'No brands yet'}
              </div>
              {!query && (
                <div style={{ fontSize: 13 }}>
                  {perms.view_only
                    ? 'Ask your Company Admin to assign you a brand.'
                    : 'Add the trading names you invoice under.'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Brand', 'Company', 'Email', 'Phone', 'Country', 'Assigned To', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {brands.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: i < brands.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {b.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid #f1f5f9', background: '#fff' }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              <HiBuildingStorefront size={16} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{b.name}</div>
                            {b.address && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{b.address}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Which company this brand belongs to — an Admin on
                          "All Companies" sees several companies' brands in
                          one list, and a brand can be moved between them. */}
                      <td style={td}>
                        <span style={{
                          display: 'inline-block', padding: '3px 9px', borderRadius: 6,
                          background: '#f1f5f9', color: '#334155', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          🏢 {b.company?.name ?? '—'}
                        </span>
                      </td>
                      <td style={td}>{b.email ?? '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{b.phone ?? '—'}</td>
                      <td style={td}>{b.country ?? '—'}</td>
                      {/* Everyone working this brand, as pills — the same way
                          the Users list shows a person's companies. Changing
                          who is assigned happens on the brand's own page,
                          where there's room for a real picker. */}
                      <td style={td}>
                        {b.assigned_users.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: 12.5 }}>Unassigned</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {b.assigned_users.map(u => (
                              <span key={u.id} title={u.email ?? undefined} style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                                whiteSpace: 'nowrap', background: '#eff6ff', color: '#2563eb',
                              }}>{u.name}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
                          fontSize: 11.5, fontWeight: 600,
                          background: b.is_active ? '#ecfdf5' : '#f1f5f9',
                          color: b.is_active ? '#059669' : '#64748b',
                        }}>
                          {b.is_active ? <HiCheckCircle size={12} /> : <HiNoSymbol size={12} />}
                          {b.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Everything about one brand — details, who works
                              it, and (for an Admin with more than one company)
                              moving it — lives on its own page. */}
                          <button disabled={busyId === b.id} onClick={() => router.push(`${brandsRoot}/${b.id}`)} style={btn('#fff', '#64748b', '#e2e8f0')}>
                            <HiEye size={13} /> View
                          </button>
                          {perms.can_edit && (
                            <>
                              <button disabled={busyId === b.id} onClick={() => router.push(`${brandsRoot}/${b.id}/edit`)} style={btn('#eef2ff', '#4f46e5', '#e0e7ff')}>
                                <HiPencilSquare size={13} /> Edit
                              </button>
                              <button disabled={busyId === b.id} onClick={() => toggleStatus(b)} style={btn(
                                b.is_active ? '#fff' : '#f0fdf4',
                                b.is_active ? '#dc2626' : '#059669',
                                b.is_active ? '#fecaca' : '#bbf7d0',
                              )}>
                                {b.is_active ? <HiNoSymbol size={13} /> : <HiCheckCircle size={13} />}
                                {b.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                          {perms.can_delete && (
                            <button disabled={busyId === b.id} onClick={() => remove(b)} style={btn('#fff', '#dc2626', '#fecaca')}>
                              <HiTrash size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

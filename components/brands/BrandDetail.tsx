'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { brandService, Brand, BrandPermissions, AssignableUser } from '@/lib/services/brandService';
import { getAuthType, setActiveCompany } from '@/lib/auth';
import { handleNotFound } from '@/lib/notFound';
import { lbl, card } from '@/components/admin/projects/shared';
import {
  HiArrowLeft, HiPencilSquare, HiCheckCircle, HiNoSymbol,
  HiBuildingStorefront, HiUserGroup, HiArrowRightCircle,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

// One brand, in full: its details, the team who work it, and — for a brand
// keeper with more than one company — moving it to another of them. The keeper
// is the Company Admin in their own portal, and the Admin role on the staff
// side; there the destination list is the companies they hold brand edit
// rights in, and the switcher follows the brand across after the move.
//
// Assigning is a SET, not a single pick: several Sellers / Lead Managers can
// share one trading name. Only staff holding Invoice create/manage rights in
// this company are offered, and the server re-checks every id on save.

const errText = (err: unknown, fallback: string) => {
  const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const fieldErrors = ex.response?.data?.errors;
  if (fieldErrors) return Object.values(fieldErrors).flat().join(' · ');
  return ex.response?.data?.message ?? fallback;
};

const ADMIN_PERMS: BrandPermissions = { can_view: true, can_create: true, can_edit: true, can_delete: true };

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <label style={lbl}>{label}</label>
      <div style={{ fontSize: 13.5, color: '#0f172a', wordBreak: 'break-word' }}>{value || <span style={{ color: '#94a3b8' }}>—</span>}</div>
    </div>
  );
}

export default function BrandDetail({ brandId }: { brandId: number }) {
  const router = useRouter();
  const isAdmin = getAuthType() === 'admin';
  const brandsRoot = isAdmin ? '/admin/brands' : '/brands';

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  const [brand, setBrand] = useState<Brand | null>(null);
  const [perms, setPerms] = useState<BrandPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  // Assign panel
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  // Transfer panel — the brand keeper with more than one company: a Company
  // Admin across the companies they own, an Admin-role staff member across
  // the ones they hold brand edit rights in.
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [targetCompany, setTargetCompany] = useState<number | ''>('');
  const [transferring, setTransferring] = useState(false);

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

  // Only the brand keeper moves a brand. On the staff side that's the Admin
  // role, which is exactly what `can_edit` means there — an assigned Seller
  // comes back view_only, so this stays false and the panel never renders.
  const canTransfer = isAdmin || !!(perms?.can_edit && !perms?.view_only);

  // Destination companies. Fetched once permissions have confirmed the
  // keeper, so a view-only viewer never calls an endpoint that would 403.
  useEffect(() => {
    if (!canTransfer) return;
    brandService.companyOptions().then(setCompanies).catch(() => setCompanies([]));
  }, [canTransfer]);

  const load = () => {
    setLoading(true);
    brandService.getOne(brandId)
      .then(b => { setBrand(b); setSelected(b.assigned_users.map(u => u.id)); })
      .catch(err => { if (!handleNotFound(err, router)) toast.error(errText(err, 'Failed to load brand')); })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (perms?.can_view) load(); else if (perms) setLoading(false); }, [perms, brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who may be assigned — only fetched when the picker is actually usable.
  useEffect(() => {
    if (!perms?.can_edit) return;
    brandService.assignableUsers(brand?.company_id).then(setAssignees).catch(() => setAssignees([]));
  }, [perms?.can_edit, brand?.company_id]);

  const toggleUser = (id: number) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const saveAssignment = async () => {
    setSavingAssign(true);
    try {
      const updated = await brandService.assign(brandId, selected);
      setBrand(updated);
      setSelected(updated.assigned_users.map(u => u.id));
      toast.success(updated.assigned_users.length ? 'Brand assignment updated' : 'Brand unassigned');
    } catch (err) {
      toast.error(errText(err, 'Failed to update assignment'));
    } finally {
      setSavingAssign(false);
    }
  };

  const doTransfer = async () => {
    if (!targetCompany) return;
    const name = companies.find(c => c.id === targetCompany)?.name ?? 'that company';
    if (!window.confirm(
      `Move "${brand?.name}" to ${name}?\n\n`
      + `Anyone assigned who isn't staff of ${name} will be removed from this brand. `
      + `Invoices already raised under it stay exactly as they are.`
      + (isAdmin ? '' : `\n\nYou will be switched to ${name} — that's where the brand lives from now on.`)
    )) return;
    setTransferring(true);
    try {
      const updated = await brandService.transfer(brandId, Number(targetCompany));
      setBrand(updated);
      setSelected(updated.assigned_users.map(u => u.id));
      setTargetCompany('');
      // Every staff-side read here is scoped to whichever company the topbar
      // switcher is on, and the brand has just left that one — so follow it
      // across rather than leave the page holding a brand it can no longer
      // fetch (a refresh would 404). The Company Admin needs none of this:
      // their API spans every company they own. 'auth_refreshed' is what the
      // topbar listens on to redraw the company it names.
      if (!isAdmin) {
        setActiveCompany(updated.company_id);
        window.dispatchEvent(new Event('auth_refreshed'));
      }
      // The API's own message carries the detail (assignees dropped, invoices
      // left behind), so it's shown rather than a generic line.
      toast.success(`Brand moved to ${name}`, { duration: 5000 });
      brandService.assignableUsers(updated.company_id).then(setAssignees).catch(() => setAssignees([]));
    } catch (err) {
      toast.error(errText(err, 'Failed to move brand'));
    } finally {
      setTransferring(false);
    }
  };

  if (!mounted || !perms || loading) {
    return (
      <DashboardLayout title="Brand">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!perms.can_view || !brand) {
    return (
      <DashboardLayout title="Brand">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          {perms.can_view ? 'Brand not found.' : "You don't have permission to view this brand."}
        </div>
      </DashboardLayout>
    );
  }

  // Someone assigned who has since lost their invoice rights still shows in
  // the list below, flagged — otherwise they'd silently vanish from the
  // picker while still being assigned.
  const staleAssignees = brand.assigned_users.filter(u => !assignees.some(a => a.id === u.id));
  const dirty =
    selected.length !== brand.assigned_users.length ||
    selected.some(id => !brand.assigned_users.some(u => u.id === id));

  return (
    <DashboardLayout title={brand.name}>
      <div style={{ maxWidth: 900 }}>
        <button
          onClick={() => router.push(brandsRoot)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13.5 }}
        >
          <HiArrowLeft size={15} /> Back to Brands
        </button>

        {/* Header */}
        <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #f1f5f9', background: '#fff' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <HiBuildingStorefront size={26} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', margin: 0 }}>{brand.name}</h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
                fontSize: 11.5, fontWeight: 600,
                background: brand.is_active ? '#ecfdf5' : '#f1f5f9',
                color: brand.is_active ? '#059669' : '#64748b',
              }}>
                {brand.is_active ? <HiCheckCircle size={12} /> : <HiNoSymbol size={12} />}
                {brand.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
              {brand.company?.name ?? '—'} · added {fmtDate(brand.created_at)}{brand.created_by ? ` by ${brand.created_by}` : ''}
            </div>
          </div>
          {perms.can_edit && (
            <button onClick={() => router.push(`${brandsRoot}/${brand.id}/edit`)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8,
              border: '1.5px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <HiPencilSquare size={14} /> Edit
            </button>
          )}
        </div>

        {/* Details */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Brand Details</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Field label="Brand Name" value={brand.name} />
            <Field label="Email" value={brand.email} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Field label="Phone Number" value={brand.phone} />
            {/* Stored already carrying a scheme (App\Support\Website), so it
                is safe as an href without normalising here. */}
            <Field label="Website" value={brand.website
              ? <a href={brand.website} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{brand.website}</a>
              : null} />
            <Field label="Country" value={brand.country} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Field label="Address" value={brand.address} />
            <Field label="Company" value={brand.company?.name} />
          </div>
        </div>

        {/* Assigned team */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <HiUserGroup size={16} color="#2563eb" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Assigned Users</h3>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
            Everyone ticked here can raise invoices under this brand. Only staff with Invoice create/manage
            permission in {brand.company?.name ?? 'this company'} can be assigned.
          </div>

          {!perms.can_edit ? (
            brand.assigned_users.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Nobody is assigned to this brand.</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {brand.assigned_users.map(u => (
                  <span key={u.id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
                    {u.name}
                  </span>
                ))}
              </div>
            )
          ) : assignees.length === 0 && staleAssignees.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#b45309' }}>
              Nobody in this company has Invoice create/manage permission yet, so there is no one to assign.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginBottom: 14 }}>
                {assignees.map(u => (
                  <label key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    border: `1.5px solid ${selected.includes(u.id) ? '#2563eb40' : '#e2e8f0'}`,
                    background: selected.includes(u.id) ? '#eff6ff' : '#fafafa',
                  }}>
                    <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUser(u.id)} style={{ accentColor: '#2563eb', width: 15, height: 15 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>{u.role.replace(/_/g, ' ')}</span>
                    </span>
                  </label>
                ))}
                {staleAssignees.map(u => (
                  <label key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    border: '1.5px solid #fde68a', background: '#fffbeb',
                  }}>
                    <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUser(u.id)} style={{ accentColor: '#d97706', width: 15, height: 15 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: '#b45309' }}>no longer has invoice access</span>
                    </span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={saveAssignment}
                  disabled={savingAssign || !dirty}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                    background: savingAssign || !dirty ? '#cbd5e1' : '#2563eb', color: '#fff',
                    cursor: savingAssign || !dirty ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingAssign ? 'Saving…' : 'Save Assignment'}
                </button>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {selected.length} selected{dirty ? ' · unsaved' : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Transfer — brand keeper with more than one company */}
        {canTransfer && companies.length > 1 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <HiArrowRightCircle size={16} color="#d97706" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Transfer to Another Company</h3>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
              Moves this brand to {isAdmin ? 'another company you own' : 'another of your companies where you manage brands'}.
              Assignees who aren&apos;t staff of that company are removed. Invoices already raised under this
              brand are left as they are — they keep showing the same name and logo.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={targetCompany}
                onChange={e => setTargetCompany(e.target.value ? Number(e.target.value) : '')}
                style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', minWidth: 240 }}
              >
                <option value="">Select destination company…</option>
                {companies.filter(c => c.id !== brand.company_id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={doTransfer}
                disabled={!targetCompany || transferring}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
                  background: !targetCompany || transferring ? '#cbd5e1' : '#d97706', color: '#fff',
                  cursor: !targetCompany || transferring ? 'not-allowed' : 'pointer',
                }}
              >
                {transferring ? 'Moving…' : 'Transfer Brand'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { useRouter } from 'next/navigation';
import {
  companyServiceService, CompanyServiceRow, CompanyServiceIndex, ServiceRequestRow,
} from '@/lib/services/companyServiceService';
import {
  HiCheckCircle, HiNoSymbol, HiStar, HiPencilSquare, HiTrash,
  HiPlusCircle, HiMagnifyingGlass, HiArrowUp, HiArrowDown,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

// Services — the IT services this company offers its clients, shown in the
// "Grow Your Business With Us" section of the Client Portal.
//
// Company Admin only (/admin/services re-exports this): what a company sells
// is the owner's call, so there is no staff version of this screen.
//
// The list is the 37 built-in services (App\Services\ServiceCatalog) merged
// with whatever this company has saved — a service the admin has never touched
// arrives with id: null and enabling it is what first creates its row. That's
// why there is no separate "add from catalogue" dialog: the catalogue IS the
// list, and "Add Custom Service" below is only for something the catalogue
// doesn't cover.

const errText = (err: unknown, fallback: string) => {
  const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  const fieldErrors = ex.response?.data?.errors;
  if (fieldErrors) return Object.values(fieldErrors).flat().join(' · ');
  return ex.response?.data?.message ?? fallback;
};

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '1.5px solid #e2e8f0', borderRadius: 7,
  fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: '#475569', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

// One row's editable fields. Held per-service so several cards can be open at
// once without a shared draft leaking between them.
interface Draft {
  name: string;
  short_description: string;
  starting_price: string;
  is_featured: boolean;
  icon: File | null;
}

const REQUEST_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  new:         { bg: '#eff6ff', color: '#2563eb', label: 'New' },
  in_progress: { bg: '#fffbeb', color: '#d97706', label: 'In Progress' },
  closed:      { bg: '#f1f5f9', color: '#64748b', label: 'Closed' },
};

export default function CompanyServicesPage() {
  useAdminGuard();
  const router = useRouter();

  // Two tabs, one screen: what we offer, and what clients asked for. Every
  // request also raises a Lead and notifies the company, so this list is the
  // audit trail rather than the only way to find out — hence the link out to
  // the Lead on each row.
  const [tab, setTab] = useState<'catalog' | 'requests'>('catalog');
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [data, setData]       = useState<CompanyServiceIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [drafts, setDrafts]     = useState<Record<string, Draft>>({});
  const [addingCustom, setAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState<Draft>({
    name: '', short_description: '', starting_price: '', is_featured: false, icon: null,
  });

  const load = () => {
    setLoading(true);
    companyServiceService.list()
      .then(setData)
      .catch(err => toast.error(errText(err, 'Failed to load services')))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const loadRequests = () => {
    setRequestsLoading(true);
    companyServiceService.requests()
      .then(res => { setRequests(res.requests); setNewCount(res.new_count); })
      .catch(err => toast.error(errText(err, 'Failed to load requests')))
      .finally(() => setRequestsLoading(false));
  };

  // The count is wanted on the tab itself even while the catalog tab is open,
  // so it loads once up front rather than only when the tab is first clicked.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRequests(); }, []);

  const setRequestStatus = async (row: ServiceRequestRow, status: string) => {
    try {
      await companyServiceService.updateRequest(row.id, status);
      loadRequests();
    } catch (err) {
      toast.error(errText(err, 'Failed to update request'));
    }
  };

  // A stable key per row: saved rows have an id, catalogue placeholders only a
  // slug. Custom rows always have an id, so the slug branch never collides.
  const keyOf = (s: CompanyServiceRow) => (s.id ? `id:${s.id}` : `slug:${s.slug}`);

  const groups = useMemo(() => {
    const rows = (data?.services ?? [])
      .filter(s => !onlyEnabled || s.is_enabled)
      .filter(s => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return s.name.toLowerCase().includes(q)
          || (s.short_description ?? '').toLowerCase().includes(q)
          || s.group.toLowerCase().includes(q);
      });

    const byGroup = new Map<string, CompanyServiceRow[]>();
    rows.forEach(s => byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]));
    return Array.from(byGroup.entries());
  }, [data, search, onlyEnabled]);

  const draftFor = (s: CompanyServiceRow): Draft => drafts[keyOf(s)] ?? {
    name: s.name,
    short_description: s.short_description ?? '',
    starting_price: s.starting_price !== null ? String(s.starting_price) : '',
    is_featured: s.is_featured,
    icon: null,
  };

  const setDraft = (s: CompanyServiceRow, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [keyOf(s)]: { ...draftFor(s), ...patch } }));

  const closeDraft = (s: CompanyServiceRow) =>
    setDrafts(prev => { const next = { ...prev }; delete next[keyOf(s)]; return next; });

  const payloadFrom = (d: Draft) => ({
    name: d.name.trim(),
    short_description: d.short_description.trim() || null,
    // '' means "no starting price", which is different from 0 ("free") — so an
    // empty box has to send null rather than a number.
    starting_price: d.starting_price.trim() === '' ? null : Number(d.starting_price),
    is_featured: d.is_featured,
    icon: d.icon,
  });

  const saveRow = async (s: CompanyServiceRow) => {
    const d = draftFor(s);
    if (!d.name.trim()) { toast.error('A service needs a name'); return; }

    setBusySlug(keyOf(s));
    try {
      if (s.id) await companyServiceService.update(s.id, payloadFrom(d));
      // First save of a catalogue service — creating the row is also what
      // enables it, since an admin editing a service clearly wants it live.
      else await companyServiceService.save({ ...payloadFrom(d), slug: s.slug, is_enabled: true });
      toast.success('Service saved');
      closeDraft(s);
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to save service'));
    } finally {
      setBusySlug(null);
    }
  };

  const toggle = async (s: CompanyServiceRow) => {
    setBusySlug(keyOf(s));
    try {
      // A catalogue service with no row yet has nothing to toggle — creating
      // it enabled is the same action from the admin's point of view.
      if (!s.id) {
        await companyServiceService.save({
          slug: s.slug,
          name: s.name,
          short_description: s.short_description,
          is_enabled: true,
        });
        toast.success(`${s.name} enabled`);
      } else {
        const updated = await companyServiceService.toggleStatus(s.id);
        toast.success(updated.is_enabled ? `${s.name} enabled` : `${s.name} disabled`);
      }
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to update service'));
    } finally {
      setBusySlug(null);
    }
  };

  const removeRow = async (s: CompanyServiceRow) => {
    if (!s.id) return;
    if (!window.confirm(
      `Remove "${s.name}" from your services?\n\n`
      + 'Clients stop seeing it immediately. Projects tagged with it and requests already raised for it '
      + `keep their history.${s.slug ? '\n\nYou can switch it back on any time — it stays in the standard list.' : ''}`
    )) return;

    setBusySlug(keyOf(s));
    try {
      await companyServiceService.remove(s.id);
      toast.success('Service removed');
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to remove service'));
    } finally {
      setBusySlug(null);
    }
  };

  // Reordering only makes sense among saved rows — a placeholder has no
  // position yet. Sends the whole enabled list so one move is one request.
  const move = async (s: CompanyServiceRow, direction: -1 | 1) => {
    const saved = (data?.services ?? []).filter(x => x.id !== null);
    const index = saved.findIndex(x => x.id === s.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= saved.length) return;

    const reordered = [...saved];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    setBusySlug(keyOf(s));
    try {
      await companyServiceService.reorder(reordered.map(x => x.id as number));
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to reorder'));
    } finally {
      setBusySlug(null);
    }
  };

  const addCustom = async () => {
    if (!customDraft.name.trim()) { toast.error('A service needs a name'); return; }
    setBusySlug('custom');
    try {
      await companyServiceService.save({ ...payloadFrom(customDraft), slug: null, is_enabled: true });
      toast.success('Service added');
      setCustomDraft({ name: '', short_description: '', starting_price: '', is_featured: false, icon: null });
      setAddingCustom(false);
      load();
    } catch (err) {
      toast.error(errText(err, 'Failed to add service'));
    } finally {
      setBusySlug(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Services">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading services…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Services">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Services</h1>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              What your clients are offered in their portal · {data?.enabled_count ?? 0} enabled
            </div>
          </div>
          {tab === 'catalog' && (
            <button onClick={() => setAddingCustom(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
              border: 'none', background: '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
              <HiPlusCircle size={16} /> Add Custom Service
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '2px solid #f1f5f9' }}>
          {([
            ['catalog', 'What We Offer'] as const,
            ['requests', 'Client Requests'] as const,
          ]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700,
                color: tab === key ? '#2563eb' : '#94a3b8',
                borderBottom: `2px solid ${tab === key ? '#2563eb' : 'transparent'}`,
                marginBottom: -2,
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {label}
              {key === 'requests' && newCount > 0 && (
                <span style={{ padding: '1px 7px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontSize: 10.5, fontWeight: 700 }}>
                  {newCount} new
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'requests' && (
          <div>
            {requestsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading requests…</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: 50, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>📥</div>
                <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No client requests yet</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  When a client asks about a service from their portal it appears here — and raises a Lead so
                  it reaches your sales pipeline too.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.map(r => {
                  const st = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.new;
                  return (
                    <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>{r.service_name}</span>
                            <span style={{ padding: '2px 9px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontSize: 10.5, fontWeight: 700 }}>
                              {r.intent_label}
                            </span>
                            <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, ...st }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                            {r.client?.name ?? 'Unknown client'}
                            {r.client?.email && <span style={{ color: '#94a3b8' }}> · {r.client.email}</span>}
                            <span style={{ color: '#94a3b8' }}> · {new Date(r.created_at).toLocaleDateString('en-GB')}</span>
                          </div>
                          {r.preferred_date && (
                            <div style={{ fontSize: 12, color: '#d97706', marginTop: 3 }}>
                              Preferred date: {new Date(r.preferred_date).toLocaleDateString('en-GB')}
                            </div>
                          )}
                          {r.message && (
                            <div style={{ fontSize: 12.5, color: '#475569', marginTop: 6, padding: '8px 11px', background: '#fafafa', borderRadius: 7, whiteSpace: 'pre-wrap' }}>
                              {r.message}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                          {r.lead_id && (
                            <button onClick={() => router.push(`/admin/leads/${r.lead_id}`)} style={{ padding: '5px 11px', borderRadius: 6, border: '1.5px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Open Lead →
                            </button>
                          )}
                          {r.status !== 'in_progress' && r.status !== 'closed' && (
                            <button onClick={() => setRequestStatus(r, 'in_progress')} style={{ padding: '5px 11px', borderRadius: 6, border: '1.5px solid #fde68a', background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                              Mark In Progress
                            </button>
                          )}
                          {r.status !== 'closed' && (
                            <button onClick={() => setRequestStatus(r, 'closed')} style={{ padding: '5px 11px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                              Close
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'catalog' && (
        <>


        {/* The section can't appear in any portal without the Client Portal
            module — better to say so here than leave the admin enabling
            services and wondering why nobody sees them. */}
        {data && !data.portal_module_active && (
          <div style={{ marginBottom: 14, padding: '11px 15px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, fontSize: 13, color: '#92400e' }}>
            ⚠️ Your Client Portal module is off, so clients can&apos;t see these services yet. Everything you set up
            here is saved and will appear as soon as the portal is enabled.
          </div>
        )}

        {data && data.enabled_count === 0 && (
          <div style={{ marginBottom: 14, padding: '11px 15px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, fontSize: 13, color: '#1e3a5f' }}>
            No services are enabled yet, so the &quot;Grow Your Business With Us&quot; section is hidden from your
            clients. Switch on the ones you actually offer — the standard list below is a starting point, and you
            can edit any of the wording.
          </div>
        )}

        {addingCustom && (
          <div style={{ marginBottom: 16, padding: '16px 18px', background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              Add a service the standard list doesn&apos;t cover
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: '1 1 240px' }}>
                <label style={lbl}>Service Name *</label>
                <input style={inp} value={customDraft.name} onChange={e => setCustomDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Drone Videography" />
              </div>
              <div style={{ flex: '0 1 180px' }}>
                <label style={lbl}>Starting Price ({data?.currency})</label>
                <input style={inp} type="number" min={0} value={customDraft.starting_price} onChange={e => setCustomDraft(d => ({ ...d, starting_price: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Short Description</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} maxLength={500} value={customDraft.short_description} onChange={e => setCustomDraft(d => ({ ...d, short_description: e.target.value }))} placeholder="One or two lines a client will actually read." />
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={customDraft.is_featured} onChange={e => setCustomDraft(d => ({ ...d, is_featured: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
                Featured
              </label>
              <label style={{ fontSize: 12, color: '#64748b' }}>
                Icon/banner:{' '}
                <input type="file" accept="image/*" onChange={e => setCustomDraft(d => ({ ...d, icon: e.target.files?.[0] ?? null }))} style={{ fontSize: 12 }} />
              </label>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setAddingCustom(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={addCustom} disabled={busySlug === 'custom'} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {busySlug === 'custom' ? 'Adding…' : 'Add Service'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 340 }}>
            <HiMagnifyingGlass size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services…" style={{ ...inp, padding: '8px 11px 8px 32px' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyEnabled} onChange={e => setOnlyEnabled(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
            Only enabled
          </label>
        </div>

        {groups.length === 0 && (
          <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9' }}>
            Nothing matches that search.
          </div>
        )}

        {groups.map(([group, rows]) => (
          <div key={group} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>
              {group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {rows.map(s => {
                const editing = !!drafts[keyOf(s)];
                const d = draftFor(s);
                const busy = busySlug === keyOf(s);
                return (
                  <div key={keyOf(s)} style={{
                    background: '#fff', borderRadius: 12, padding: '14px 16px',
                    border: `1.5px solid ${s.is_enabled ? '#bbf7d0' : '#f1f5f9'}`,
                    opacity: s.is_enabled ? 1 : 0.78,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      {s.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.icon_url} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', border: '1px solid #f1f5f9' }} />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>
                          {s.icon_emoji}
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>{s.name}</span>
                          {s.is_featured && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 20, background: '#fffbeb', color: '#b45309', fontSize: 10, fontWeight: 700 }}>
                              <HiStar size={9} /> FEATURED
                            </span>
                          )}
                          {s.is_custom && (
                            <span style={{ padding: '1px 7px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontSize: 10, fontWeight: 700 }}>CUSTOM</span>
                          )}
                        </div>
                        {!editing && (
                          <>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                              {s.short_description || <span style={{ color: '#cbd5e1' }}>No description yet</span>}
                            </div>
                            {s.starting_price !== null && (
                              <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                                From {data?.currency} {s.starting_price.toLocaleString()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {editing ? (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 9 }}>
                          <label style={lbl}>Name</label>
                          <input style={inp} value={d.name} onChange={e => setDraft(s, { name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: 9 }}>
                          <label style={lbl}>Short Description</label>
                          <textarea style={{ ...inp, resize: 'vertical' }} rows={2} maxLength={500} value={d.short_description} onChange={e => setDraft(s, { short_description: e.target.value })} />
                          {s.catalog_default && d.short_description !== s.catalog_default.description && (
                            <button onClick={() => setDraft(s, { short_description: s.catalog_default!.description })} style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: '#2563eb', fontSize: 11.5, cursor: 'pointer' }}>
                              Use the standard wording
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                          <div style={{ flex: '0 1 170px' }}>
                            <label style={lbl}>Starting Price ({data?.currency})</label>
                            <input style={inp} type="number" min={0} value={d.starting_price} onChange={e => setDraft(s, { starting_price: e.target.value })} placeholder="Optional" />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label style={lbl}>Icon / Banner</label>
                            <input type="file" accept="image/*" onChange={e => setDraft(s, { icon: e.target.files?.[0] ?? null })} style={{ fontSize: 12 }} />
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151', cursor: 'pointer', marginBottom: 12 }}>
                          <input type="checkbox" checked={d.is_featured} onChange={e => setDraft(s, { is_featured: e.target.checked })} style={{ width: 15, height: 15, accentColor: '#2563eb' }} />
                          Featured — highlighted in &quot;Popular Services&quot;
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => saveRow(s)} disabled={busy} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => closeDraft(s)} style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12.5, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                        <button onClick={() => toggle(s)} disabled={busy} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
                          border: `1.5px solid ${s.is_enabled ? '#fecaca' : '#bbf7d0'}`,
                          background: s.is_enabled ? '#fff' : '#f0fdf4',
                          color: s.is_enabled ? '#dc2626' : '#059669',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        }}>
                          {s.is_enabled ? <HiNoSymbol size={12} /> : <HiCheckCircle size={12} />}
                          {s.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setDraft(s, {})} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          <HiPencilSquare size={12} /> Edit
                        </button>
                        {s.id && (
                          <>
                            <button onClick={() => move(s, -1)} disabled={busy} title="Move earlier" style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>
                              <HiArrowUp size={12} />
                            </button>
                            <button onClick={() => move(s, 1)} disabled={busy} title="Move later" style={{ padding: '5px 8px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>
                              <HiArrowDown size={12} />
                            </button>
                            <button onClick={() => removeRow(s)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                              <HiTrash size={12} /> Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </>
        )}
      </div>
    </DashboardLayout>
  );
}

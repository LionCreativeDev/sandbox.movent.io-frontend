'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { userService } from '@/lib/services/userService';
import { getAvailableModules } from '@/lib/moduleCatalog';
import { SIMPLE_PROJECT_PERMISSIONS, collapseProjectPermissions } from '@/lib/simplifiedProjectPermissions';
import { getRolesDefaultPermissions, rolesFor } from '@/lib/roleUtils';
import { handleNotFound } from '@/lib/notFound';
import { CompanyOption, User } from '@/types';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { getAuthType, isDeputyAdmin } from '@/lib/auth';
import { HiArrowLeft } from 'react-icons/hi2';
import PhoneInput from '@/components/ui/PhoneInput';
import DeleteUserModal from '@/components/users/DeleteUserModal';

// Mirrors the same helper in app/users/new/page.tsx — visible permission
// keys per catalog module (respecting requiresDb/hideIfCatalogKey), so role
// defaults never auto-check something the checkbox UI wouldn't itself show.
function visiblePermsByModule(availMods: ReturnType<typeof getAvailableModules>, rawDb: string[]): Record<string, string[]> {
  const availCatalogKeys = availMods.map(m => m.key);
  const out: Record<string, string[]> = {};
  for (const mod of availMods) {
    out[mod.key] = mod.permissions
      .filter(p => (!p.requiresDb || rawDb.includes(p.requiresDb)) && (!p.hideIfCatalogKey || !availCatalogKeys.includes(p.hideIfCatalogKey)))
      .map(p => p.key);
  }
  return out;
}

// The "N permissions selected" badge must count what's actually checked on
// screen, not raw granular permission keys — mirrors app/users/new/page.tsx's
// identical fix. Project Management shows simplified bundle checkboxes, each
// expanding into several granular keys (e.g. "Manage Projects" = 7 keys) —
// one checked box must count as 1, not 7 (collapseProjectPermissions(), same
// as the checkbox `checked` state uses). A granted key that isn't currently
// visible (module not purchased, or hidden by hideIfCatalogKey) has no
// checkbox to reflect, so it's excluded via the same visiblePermsByModule()
// filtering the checkboxes themselves use.
function visibleSelectedCount(
  companyId: number,
  perms: Record<number, Record<string, string[]>>,
  companies: CompanyOption[],
): number {
  const modPermsFor = perms[companyId] ?? {};
  let total = 0;

  const accountPerms = modPermsFor['account'] ?? [];
  if (accountPerms.includes('canAddUsers')) total += 1;
  if (accountPerms.includes('canManageSettings')) total += 1;
  if (accountPerms.includes('canUseGeneralChat')) total += 1;

  const co = companies.find(c => c.id === companyId);
  const rawDb = co?.modules ?? [];
  const availMods = getAvailableModules(rawDb);
  const visible = visiblePermsByModule(availMods, rawDb);

  for (const mod of availMods) {
    if (mod.key === 'project_management') {
      total += collapseProjectPermissions(modPermsFor.project_management ?? []).length;
      continue;
    }
    const granted = modPermsFor[mod.key] ?? [];
    total += (visible[mod.key] ?? []).filter(k => granted.includes(k)).length;
  }

  return total;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, outline: 'none', background: '#fafafa', color: '#0f172a', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

function EditUserPageContent() {
  useAdminGuard();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params.id);

  // Reachable both as the Company Admin (/admin/users/{id}/edit) and as a
  // staff member holding the User Management Permission (/users/{id}/edit,
  // linked from their own /user-management list). userService routes to
  // whichever API that is; what differs on screen is the permission ceiling
  // below and where Cancel/Back returns to.
  const isAdmin = getAuthType() === 'admin';
  const usersRoot = isAdmin ? '/admin/users' : '/user-management';
  // Same reach as the Company Admin over roles and the User Management
  // Permission — see the note in /users/new and
  // Api\User\UserManagementController::isDeputyAdmin().
  const ownerReach = isAdmin || isDeputyAdmin();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');

  // Basic info
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role_type: '' });
  // Roles PER COMPANY: companyId → roles, primary first.
  //
  // Roles are company-scoped exactly like the permissions below them, and this
  // shape is what keeps them independent: editing, adding or removing a role in
  // one company touches only that company's entry, so a Seller in company A who
  // is a Project Manager in company B keeps both. form.role_type mirrors the
  // PRIMARY company's primary role — it is the legacy single-role column the
  // rest of the app still reads.
  const [rolesByCompany, setRolesByCompany] = useState<Record<number, string[]>>({});
  // A custom role RENAMES the person (users.custom_role_label is one column on
  // the account, not per company), so it stays here at account level while the
  // structural roles are picked per company below.
  const [customRoleMode, setCustomRoleMode] = useState(false);
  const [customRoleLabel, setCustomRoleLabel] = useState('');
  const isCustomRole = customRoleMode;

  const rolesFor_ = (cid: number | null): string[] => (cid === null ? [] : rolesByCompany[cid] ?? []);

  // Permissions: companyId → moduleKey → permKey[]
  const [perms, setPerms]                 = useState<Record<number, Record<string, string[]>>>({});
  const [companies, setCompanies]         = useState<CompanyOption[]>([]);
  const [assignedIds, setAssignedIds]     = useState<number[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);
  const [showAdvancedPM, setShowAdvancedPM] = useState(false);
  const permissionsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([userService.getOne(id), userService.listCompanyOptions()])
      .then(([user, cos]: [User, CompanyOption[]]) => {
        setForm({ name: user.name, email: user.email, password: '', phone: user.phone ?? '', role_type: user.role_type ?? '' });
        setCustomRoleLabel(user.custom_role_label ?? '');
        setCustomRoleMode(!!user.custom_role_label);

        const assignments = user.company_assignments ?? [];
        const ids = assignments.map(a => a.company_id);
        setAssignedIds(ids);
        setActiveCompanyId(ids[0] ?? null);
        setCompanies(cos);

        // Each company keeps its OWN role set. `roles` comes back null when the
        // endpoint did not load them — fall back to the legacy role_type so the
        // picker is never blank for a user who plainly has a role, but only on
        // the FIRST assignment: role_type is a single account-wide column and
        // says nothing about the user's other companies, so copying it into all
        // of them would invent roles nobody assigned.
        const initialRoles: Record<number, string[]> = {};
        assignments.forEach((a, i) => {
          const loaded = a.roles ?? [];
          initialRoles[a.company_id] = loaded.length > 0
            ? loaded
            : (i === 0 && user.role_type ? [user.role_type] : []);
        });
        setRolesByCompany(initialRoles);

        // Load existing permissions into state
        const initialPerms: Record<number, Record<string, string[]>> = {};
        for (const a of assignments) {
          initialPerms[a.company_id] = { ...(a.permissions as Record<string, string[]>) };
        }
        setPerms(initialPerms);
      })
      .catch((err) => { if (!handleNotFound(err, router)) setError('Failed to load user'); })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link from the Users list's "Permissions" action — scroll straight to this section.
  useEffect(() => {
    if (searchParams.get('tab') === 'permissions' && !loading) {
      permissionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePerm = (companyId: number, moduleKey: string, permKey: string) => {
    setPerms(prev => {
      const cur = prev[companyId]?.[moduleKey] ?? [];
      const next = cur.includes(permKey) ? cur.filter(k => k !== permKey) : [...cur, permKey];
      return { ...prev, [companyId]: { ...(prev[companyId] ?? {}), [moduleKey]: next } };
    });
  };

  const toggleModuleAll = (companyId: number, moduleKey: string, allKeys: string[]) => {
    setPerms(prev => {
      const cur = prev[companyId]?.[moduleKey] ?? [];
      const allSel = allKeys.every(k => cur.includes(k));
      return { ...prev, [companyId]: { ...(prev[companyId] ?? {}), [moduleKey]: allSel ? [] : [...allKeys] } };
    });
  };

  // Assign Multiple Companies to User — purely local state, same as every
  // other edit on this page; nothing is persisted until the existing Save
  // button runs its existing per-company loop (userService.
  // updateCompanyPermissions), which already firstOrCreate()s the
  // CompanyUserAssignment row server-side, so no new endpoint is needed.
  const [pickCompanyId, setPickCompanyId] = useState('');
  const unassignedCompanies = companies.filter(c => !assignedIds.includes(c.id));

  const addCompany = () => {
    if (!pickCompanyId) return;
    const cid = Number(pickCompanyId);
    if (assignedIds.includes(cid)) return;

    // A newly added company starts with NO roles — roles are per company, and
    // guessing them from another company's set is exactly the cross-company
    // bleed this screen has to prevent. The admin picks them in the Roles field
    // for this company, which then seeds its permissions.
    setRolesByCompany(prev => ({ ...prev, [cid]: [] }));
    setPerms(prev => ({ ...prev, [cid]: {} }));
    setAssignedIds(prev => [...prev, cid]);
    setActiveCompanyId(cid);
    setPickCompanyId('');
  };

  // Unassign Company from User — reuses the already-existing
  // userService.remove(id, companyId), the same call the Users list page's
  // "Delete" button already makes (bare, without a companyId, for the
  // "remove their only company" case). This is an immediate, destructive
  // API call (unlike Add Company above) — it doesn't wait for the page's
  // own Save button, matching how the list page's delete already behaves.
  // The bare confirm() this used to show couldn't say what the person was
  // actually holding in the company being taken away. DeleteUserModal in
  // 'unassign' mode spells that out and offers to hand it over first; it
  // makes the same userService.remove(id, companyId) call at the end.
  const [unassignCompanyId, setUnassignCompanyId] = useState<number | null>(null);

  // A deputy Admin takes a company away as well — Add Company on this screen
  // was never gated, so leaving Remove behind made the pair one-way. It runs
  // the same DeleteUserModal the Company Admin gets: the Impact Summary and
  // its "reassign first" step now exist on the staff API too.
  const onCompanyUnassigned = (companyId: number) => {
    const remainingIds = assignedIds.filter(cid => cid !== companyId);
    setAssignedIds(remainingIds);
    setPerms(prev => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
    if (activeCompanyId === companyId) setActiveCompanyId(remainingIds[0] ?? null);
    setUnassignCompanyId(null);
  };

  // Changing the role is a meaningful action (it implies "this person's job
  // changed"), so it's confirmed before touching anything, and — unlike Add
  // User, where defaults just pre-fill a blank slate — it REPLACES whatever
  // custom permissions were already saved, across every company this user is
  // assigned to (each filtered to that company's own purchased modules).
  // Re-applies the COMBINED defaults of $next to ONE company.
  //
  // Scoped to $cid deliberately: every other company's roles and permissions
  // are left exactly as they were, so changing what someone does in one company
  // cannot reach into another. Confirmed first, because unlike Add User (which
  // fills a blank slate) this REPLACES that company's saved permissions.
  const applyRolesFor = (cid: number, next: string[]) => {
    const co = companies.find(c => c.id === cid);
    const label = co?.name ?? 'this company';

    if (next.length === 0) {
      setRolesByCompany(prev => ({ ...prev, [cid]: [] }));
      return;
    }

    const proceed = window.confirm(
      next.length > 1
        ? `Apply the combined default permissions of all ${next.length} selected roles for ${label}? This replaces the permissions currently saved for ${label} only — other companies are not affected.`
        : `Apply default permissions for this role in ${label}? This replaces the permissions currently saved for ${label} only — other companies are not affected.`
    );
    if (!proceed) return; // Cancelled -> keep existing permissions AND roles unchanged.

    setRolesByCompany(prev => ({ ...prev, [cid]: next }));

    const rawDb = co?.modules ?? [];
    const availMods = getAvailableModules(rawDb);
    const allPerms = visiblePermsByModule(availMods, rawDb);
    setPerms(prev => ({
      ...prev,
      [cid]: getRolesDefaultPermissions(next, availMods.map(m => m.key), allPerms),
    }));
  };

  const toggleRole = (cid: number, value: string) => {
    const current = rolesFor_(cid);
    applyRolesFor(cid, current.includes(value) ? current.filter(r => r !== value) : [...current, value]);
  };

  const handleSave = async () => {
    if (isCustomRole && !customRoleLabel.trim()) {
      setError('Please enter a name for this custom role.');
      return;
    }
    setSaving(true); setError('');
    try {
      // Update basic info
      // Account-level fields only. No `roles` here on purpose: that endpoint
      // writes roles for ONE company (the account's primary), and the
      // per-company loop below is what actually keeps each company's set
      // independent. role_type is still sent so the legacy column tracks the
      // primary company's primary role.
      const primaryCompanyRoles = rolesFor_(
        assignedIds.find(cid => cid === activeCompanyId) ?? assignedIds[0] ?? null
      );

      await userService.update(id, {
        name:      form.name,
        email:     form.email,
        password:  form.password || undefined,
        phone:     form.phone || null,
        role_type: primaryCompanyRoles[0] || form.role_type || undefined,
        custom_role_label: isCustomRole ? (customRoleLabel.trim() || null) : null,
      });

      // Permissions AND roles, each company with its own set — so saving one
      // company never overwrites another's roles or permissions.
      for (const cid of assignedIds) {
        const companyRoles = rolesFor_(cid);
        await userService.updateCompanyPermissions(
          id, cid, perms[cid] ?? {}, undefined, companyRoles.length > 0 ? companyRoles : undefined
        );
      }

      setToast('Saved successfully');
      setTimeout(() => setToast(''), 2500);
      router.push(usersRoot);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = e.response?.data?.errors;
      if (msgs) setError(Object.values(msgs).flat().join(' · '));
      else setError(e.response?.data?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Edit User">
      <div style={{ width: '100%', maxWidth: 'none' }}>
        <button onClick={() => router.push(usersRoot)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>
          <HiArrowLeft size={16} /> Back to Users
        </button>

        {toast && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 16px', color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {toast}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Account Details ─────────────────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Details</div>
              </div>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lbl}>Full Name *</label>
                  <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>Email *</label>
                  <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>New Password <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>(leave blank to keep)</span></label>
                  <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label style={lbl}>Phone</label>
                  <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                </div>
                {/* Roles themselves are picked per company, in Module
                    Permissions below — they are company-scoped and belong
                    beside the permissions they seed. What stays here is the
                    account-level display name, which is one column on the user
                    and so cannot be per company. */}
                <div>
                  <label style={lbl}>Display Name Override</label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10,
                    border: `1.5px solid ${customRoleMode ? '#bfdbfe' : '#e2e8f0'}`,
                    background: customRoleMode ? '#eff6ff' : '#fafafa', cursor: 'pointer', fontSize: 13,
                  }}>
                    <input
                      type="checkbox"
                      checked={customRoleMode}
                      onChange={() => {
                        const next = !customRoleMode;
                        setCustomRoleMode(next);
                        if (!next) setCustomRoleLabel('');
                      }}
                      style={{ accentColor: '#2563eb', width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: customRoleMode ? 700 : 500, color: customRoleMode ? '#1d4ed8' : '#64748b' }}>
                      Show a custom role name
                    </span>
                  </label>
                </div>
                {isCustomRole && (
                  <div>
                    <label style={lbl}>Custom Role Name *</label>
                    <input style={inp} value={customRoleLabel} onChange={e => setCustomRoleLabel(e.target.value)} placeholder="e.g. Marketing Lead" maxLength={100} />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Display only — shown instead of the role names everywhere. What this user can actually do is set by their roles and permissions per company below.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Permissions ─────────────────────────────────────────────── */}
            <div ref={permissionsSectionRef} style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Module Permissions</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Configure what this user can do in each module.</div>
              </div>

              <div style={{ padding: 24 }}>
                {assignedIds.length === 0 && (
                  <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                    This user has no company assignments — add one below to restore their access.
                  </div>
                )}

                {/* Assign Multiple Companies to User — always available, even
                    (especially) when the user currently has zero companies,
                    so an admin who unassigned someone's last company can
                    give them a new one right here instead of the account
                    being stuck with no way back in. Hidden once the user is
                    already on every company the admin owns. */}
                {unassignedCompanies.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
                    <select value={pickCompanyId} onChange={e => setPickCompanyId(e.target.value)} style={{ ...inp, width: 'auto', flex: '0 1 260px' }}>
                      <option value="">+ Add another company…</option>
                      {unassignedCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCompany}
                      disabled={!pickCompanyId}
                      style={{
                        padding: '10px 18px', borderRadius: 8, border: 'none',
                        background: pickCompanyId ? '#2563eb' : '#cbd5e1', color: '#fff',
                        fontWeight: 600, fontSize: 13, cursor: pickCompanyId ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}

                {assignedIds.length > 0 && (
                  <>
                    {/* Role default-permissions helper text + selected count */}
                    {activeCompanyId !== null && (() => {
                      const totalSelected = visibleSelectedCount(activeCompanyId, perms, companies);
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            Default permissions are selected based on role. You can customize them before saving.
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                              {totalSelected} permission{totalSelected === 1 ? '' : 's'} selected
                            </span>
                            {/* Owner reach only, matching the delegated Users
                                list where Remove is hidden too: taking
                                someone's company away is the one action a
                                DELEGATED User Manager doesn't get. */}
                            {ownerReach && (
                              <button
                                type="button"
                                onClick={() => setUnassignCompanyId(activeCompanyId)}
                                title="Remove this company from this user"
                                style={{
                                  border: 'none', background: 'transparent', color: '#dc2626',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                              >
                                ✕ Remove company
                              </button>
                            )}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Company tabs */}
                    {assignedIds.length > 1 && (
                      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #f1f5f9' }}>
                        {assignedIds.map(cid => {
                          const co = companies.find(c => c.id === cid);
                          const active = cid === activeCompanyId;
                          return (
                            <button key={cid} onClick={() => setActiveCompanyId(cid)} style={{ padding: '9px 18px', borderRadius: '8px 8px 0 0', border: 'none', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#64748b', fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                              {co?.name ?? `Company ${cid}`}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Roles for the SELECTED company — full width, because a
                        multi-role selection needs the room to stay readable.
                        Sits here rather than in Account Details because roles
                        are company-scoped: switching the tab above switches
                        which company's roles this edits, and saving one company
                        leaves every other company's roles and permissions
                        untouched. */}
                    {activeCompanyId !== null && (() => {
                      const cid = activeCompanyId;
                      const selected = rolesFor_(cid);
                      const coName = companies.find(c => c.id === cid)?.name;
                      return (
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>Roles{coName ? ` in ${coName}` : ''} *</span>
                            {selected.length > 1 && (
                              <span style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'none',
                                color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: 999,
                              }}>{selected.length} selected</span>
                            )}
                          </label>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8,
                            width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 12,
                            background: '#fafafa',
                          }}>
                            {rolesFor(ownerReach).map(r => {
                              const on = selected.includes(r.value);
                              return (
                                <label key={r.value} style={{
                                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8,
                                  border: `1.5px solid ${on ? '#bfdbfe' : '#e2e8f0'}`,
                                  background: on ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13,
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleRole(cid, r.value)}
                                    style={{ accentColor: '#2563eb', width: 15, height: 15, flexShrink: 0 }}
                                  />
                                  <span style={{ fontWeight: on ? 700 : 500, color: on ? '#1d4ed8' : '#0f172a' }}>{r.label}</span>
                                  {on && selected[0] === r.value && selected.length > 1 && (
                                    <span style={{
                                      marginLeft: 'auto', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4,
                                      color: '#1d4ed8', background: '#dbeafe', padding: '2px 6px', borderRadius: 999,
                                    }}>PRIMARY</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                            {selected.length > 1
                              ? `Permissions below are the combined total of all ${selected.length} roles — no role cancels another. Applies to ${coName ?? 'this company'} only.`
                              : `Pick one or more. Several roles combine their permissions. Applies to ${coName ?? 'this company'} only — other companies keep their own roles.`}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Add Users — one common toggle per company, not per
                        module. Owner reach only: a DELEGATED manager can
                        neither grant this permission nor take it away, so the
                        box is not offered to them (the server refuses either
                        way, and refuses to open this page at all for someone
                        who already holds it). The Company Admin's deputy both
                        grants and revokes it, exactly as the owner does. */}
                    {ownerReach && activeCompanyId !== null && (() => {
                      const canThisUserAddUsers = (perms[activeCompanyId]?.['account'] ?? []).includes('canAddUsers');
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${canThisUserAddUsers ? '#2563eb40' : '#e2e8f0'}`, background: canThisUserAddUsers ? '#eff6ff' : '#fafafa', marginBottom: 16, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={canThisUserAddUsers}
                            onChange={() => togglePerm(activeCompanyId, 'account', 'canAddUsers')}
                            style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>User Management Permission</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Gives this user their own &quot;Users&quot; page for this company: add, edit, assign roles, manage permissions, suspend/activate and remove staff. Limited to this company, and they can never grant a permission they don&apos;t hold themselves.</div>
                          </div>
                        </label>
                      );
                    })()}

                    {/* Settings Management — same "account module, one common
                        toggle" pattern as Add Users above. Owner reach only:
                        it hands over the company's invoicing identity, bank
                        details and live payment gateway credentials, so a
                        delegated manager can neither grant nor revoke it.

                        Unticking this is the revoke: the staff member's very
                        next request to /api/user/settings/* answers 403 (see
                        Api\User\SettingsController::can(), which reads
                        user_company_permissions live and has no role-based
                        bypass). Their sidebar link can survive until the next
                        /user/me refresh, same as User Management's does, but
                        the page behind it is already closed. */}
                    {ownerReach && activeCompanyId !== null && (() => {
                      const canThisUserManageSettings = (perms[activeCompanyId]?.['account'] ?? []).includes('canManageSettings');
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${canThisUserManageSettings ? '#2563eb40' : '#e2e8f0'}`, background: canThisUserManageSettings ? '#eff6ff' : '#fafafa', marginBottom: 16, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={canThisUserManageSettings}
                            onChange={() => togglePerm(activeCompanyId, 'account', 'canManageSettings')}
                            style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>Settings Management Permission</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Gives this user their own &quot;Settings&quot; page for this company: company profile and logo, invoice defaults, bank details, payment gateway accounts and the deal workflow. Limited to this company — settings for every other company stay untouched and unreachable. Buying modules or seats stays with you.</div>
                          </div>
                        </label>
                      );
                    })()}

                    {/* General Chat — same "account module, one common toggle" pattern as
                        Add Users above; not tied to any purchased module (available across portals). */}
                    {activeCompanyId !== null && (() => {
                      const canThisUserUseChat = (perms[activeCompanyId]?.['account'] ?? []).includes('canUseGeneralChat');
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${canThisUserUseChat ? '#2563eb40' : '#e2e8f0'}`, background: canThisUserUseChat ? '#eff6ff' : '#fafafa', marginBottom: 16, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={canThisUserUseChat}
                            onChange={() => togglePerm(activeCompanyId, 'account', 'canUseGeneralChat')}
                            style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>Use General Chat</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Lets this user send/receive direct and group messages in Chat, separate from any project or lead.</div>
                          </div>
                        </label>
                      );
                    })()}

                    {/* Module permission checkboxes */}
                    {activeCompanyId !== null && (() => {
                      const co          = companies.find(c => c.id === activeCompanyId);
                      const rawDb       = co?.modules ?? [];
                      const availModules = getAvailableModules(rawDb);
                      if (availModules.length === 0) return (
                        <div style={{ color: '#94a3b8', fontSize: 13, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
                          No modules purchased for this company.
                        </div>
                      );
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {availModules.map(mod => {
                            // Project Management: 52 granular permissions are too many to show
                            // Company Admin directly — show 11 simplified permissions instead,
                            // each expanding into its real granular keys, plus a collapsed
                            // "Advanced Permissions" section for the 5 more sensitive ones.
                            if (mod.key === 'project_management') {
                              const granted = perms[activeCompanyId]?.project_management ?? [];
                              const mainPerms = SIMPLE_PROJECT_PERMISSIONS.filter(p => !p.advanced);
                              const advPerms = SIMPLE_PROJECT_PERMISSIONS.filter(p => p.advanced);
                              const isChecked = (p: typeof mainPerms[number]) => p.maps.every(k => granted.includes(k));
                              const allMainSelected = mainPerms.every(isChecked);
                              const someSet = mainPerms.some(p => p.maps.some(k => granted.includes(k))) || advPerms.some(p => p.maps.some(k => granted.includes(k)));

                              const toggleSimple = (p: typeof mainPerms[number]) => {
                                setPerms(prev => {
                                  const cur = prev[activeCompanyId]?.project_management ?? [];
                                  const on = p.maps.every(k => cur.includes(k));
                                  const next = on ? cur.filter(k => !p.maps.includes(k)) : [...new Set([...cur, ...p.maps])];
                                  return { ...prev, [activeCompanyId]: { ...(prev[activeCompanyId] ?? {}), project_management: next } };
                                });
                              };

                              const toggleAllMain = () => {
                                setPerms(prev => {
                                  const cur = prev[activeCompanyId]?.project_management ?? [];
                                  const allKeys = mainPerms.flatMap(p => p.maps);
                                  const allSelected = mainPerms.every(p => p.maps.every(k => cur.includes(k)));
                                  const next = allSelected ? cur.filter(k => !allKeys.includes(k)) : [...new Set([...cur, ...allKeys])];
                                  return { ...prev, [activeCompanyId]: { ...(prev[activeCompanyId] ?? {}), project_management: next } };
                                });
                              };

                              const renderSimpleRow = (p: typeof mainPerms[number]) => (
                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked(p)}
                                    onChange={() => toggleSimple(p)}
                                    style={{ accentColor: mod.color, width: 14, height: 14 }}
                                  />
                                  <span style={{ fontSize: 13, color: '#475569' }}>{p.label}</span>
                                </label>
                              );

                              return (
                                <div key={mod.key} style={{ border: `1.5px solid ${someSet ? mod.color + '40' : '#e2e8f0'}`, borderRadius: 10, overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: someSet ? mod.color + '10' : '#fafafa', gap: 10 }}>
                                    <span style={{ fontWeight: 700, color: someSet ? mod.color : '#475569', fontSize: 13 }}>{mod.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
                                        <input type="checkbox" checked={allMainSelected} onChange={toggleAllMain} style={{ accentColor: mod.color }} />
                                        Select All
                                      </label>
                                    </div>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 2, padding: '10px 14px' }}>
                                    {mainPerms.map(renderSimpleRow)}
                                  </div>
                                  <div style={{ padding: '0 14px 10px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setShowAdvancedPM(v => !v)}
                                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                      {showAdvancedPM ? '▾' : '▸'} Advanced Permissions
                                    </button>
                                    {showAdvancedPM && (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 2, marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
                                        {advPerms.map(renderSimpleRow)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Filter by requiresDb AND hide perms whose catalog module is also available
                            const availCatalogKeys = availModules.map(m => m.key);
                            const visiblePerms = mod.permissions.filter(
                              p => (!p.requiresDb || rawDb.includes(p.requiresDb))
                                && (!p.hideIfCatalogKey || !availCatalogKeys.includes(p.hideIfCatalogKey))
                            );
                            const modPerms = perms[activeCompanyId]?.[mod.key] ?? [];
                            const allKeys  = visiblePerms.map(p => p.key);
                            const allSel   = allKeys.length > 0 && allKeys.every(k => modPerms.includes(k));
                            const someSet  = allKeys.some(k => modPerms.includes(k));
                            return (
                              <div key={mod.key} style={{ border: `1.5px solid ${someSet ? mod.color + '40' : '#e2e8f0'}`, borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: someSet ? mod.color + '10' : '#fafafa', gap: 10 }}>
                                  <span style={{ fontWeight: 700, color: someSet ? mod.color : '#475569', fontSize: 13 }}>{mod.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
                                      <input type="checkbox" checked={allSel} onChange={() => toggleModuleAll(activeCompanyId, mod.key, allKeys)} style={{ accentColor: mod.color }} />
                                      Select All
                                    </label>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 2, padding: '10px 14px' }}>
                                  {visiblePerms.map(perm => (
                                    <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={modPerms.includes(perm.key)}
                                        onChange={() => togglePerm(activeCompanyId, mod.key, perm.key)}
                                        style={{ accentColor: mod.color, width: 14, height: 14 }}
                                      />
                                      <span style={{ fontSize: 13, color: '#475569' }}>{perm.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* ── Actions ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => router.push(usersRoot)} style={{ padding: '11px 26px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '11px 36px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Unassigning a company is destructive for everything the person is
          carrying in it, so the same Impact Summary the Users list uses runs
          here too — only the final action differs. */}
      {unassignCompanyId !== null && (
        <DeleteUserModal
          userId={id}
          userName={form.name || 'this user'}
          companyId={unassignCompanyId}
          mode="unassign"
          onCancel={() => setUnassignCompanyId(null)}
          onDone={() => onCompanyUnassigned(unassignCompanyId)}
        />
      )}
    </DashboardLayout>
  );
}

export default function EditUserPage() {
  return (
    <Suspense fallback={<DashboardLayout title="Edit User"><div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>}>
      <EditUserPageContent />
    </Suspense>
  );
}

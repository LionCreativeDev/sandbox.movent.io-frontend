'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { userService } from '@/lib/services/userService';
import { roleDisplayLabel } from '@/lib/roleUtils';
import { MODULE_CATALOG } from '@/lib/moduleCatalog';
import { User, CompanyAssignment } from '@/types';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { getActiveCompany } from '@/lib/auth';
import { HiUserPlus, HiCheckCircle, HiClipboard, HiArrowPath, HiNoSymbol, HiPlay, HiPencilSquare, HiEye, HiKey, HiTrash } from 'react-icons/hi2';
import DeleteUserModal from '@/components/users/DeleteUserModal';
import DeleteCompanyPicker from '@/components/users/DeleteCompanyPicker';

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#059669', bg: '#ecfdf5', label: 'Active'    },
  invited:   { color: '#d97706', bg: '#fffbeb', label: 'Invited'   },
  suspended: { color: '#dc2626', bg: '#fef2f2', label: 'Suspended' },
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'invited')   return <HiArrowPath size={13} />;
  if (status === 'suspended') return <HiNoSymbol size={13} />;
  return <HiCheckCircle size={13} />;
}

/** Merge permissions across all of this user's (already company-scoped) assignments. */
function mergedPermissions(user: User): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const a of user.company_assignments ?? []) {
    for (const [mod, keys] of Object.entries(a.permissions)) {
      if (!merged[mod]) merged[mod] = [];
      for (const k of keys) {
        if (!merged[mod].includes(k)) merged[mod].push(k);
      }
    }
  }
  return merged;
}

/** Module keys with at least one granted permission, mapped to display names. */
function getActiveModules(user: User): string[] {
  const merged = mergedPermissions(user);
  return Object.entries(merged)
    // 'account' is the common "can add users" capability, not a work module — shown separately.
    .filter(([modKey, keys]) => modKey !== 'account' && keys.length > 0)
    .map(([modKey]) => MODULE_CATALOG.find(m => m.key === modKey)?.name ?? modKey);
}

/** Whether this user has been granted the common "can add other users" capability. */
function canAddUsers(user: User): boolean {
  return mergedPermissions(user)['account']?.includes('canAddUsers') ?? false;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UsersPage() {
  useAdminGuard();
  const router = useRouter();
  const [users, setUsers]           = useState<User[]>([]);
  const [used, setUsed]             = useState(0);
  const [limit, setLimit]           = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [copiedId, setCopiedId]     = useState<number | null>(null);
  const [resetInfo, setResetInfo]   = useState<{ name: string; password: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  // Which company the topbar switcher is on — 'all' means the admin is
  // looking at every company at once, so "suspend" has no single obvious
  // target and has to be asked (see handleToggleStatus below). Read in an
  // effect, not during render: the cookie isn't there during SSR, and a
  // render-time read would hydrate to a different value.
  const [activeCompany, setActiveCompany] = useState<number | 'all' | null>(null);
  // The user whose company the admin is being asked to pick, once the
  // "All Companies" case can't resolve one on its own.
  const [companyPickFor, setCompanyPickFor] = useState<User | null>(null);
  // Delete runs in stages: for a multi-company user, "which company?" first
  // (same question Suspend asks), then the Impact Summary for that company,
  // then the confirmation. Nothing is deleted before the last step.
  const [deletePickFor, setDeletePickFor] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    user: User;
    companyId?: number;
    // Removing their last company ends the account; while they still belong
    // somewhere else, this only unassigns them from the one chosen.
    mode: 'delete' | 'unassign';
  } | null>(null);

  const load = async () => {
    try {
      const data = await userService.list();
      setUsers(data.users);
      setUsed(data.used);
      setLimit(data.limit);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveCompany(getActiveCompany()); }, []);

  const atLimit = limit !== null && used >= limit;

  const assignmentsOf = (user: User): CompanyAssignment[] => user.company_assignments ?? [];

  // Suspension is per company on the server (CompanyUserAssignment.status;
  // users.status is only a rollup — "suspended" there means suspended
  // EVERYWHERE). So while one company is selected, this row must report that
  // company's own state: otherwise suspending a user who also belongs to
  // another company left the row still reading "Active" with a "Suspend"
  // button, as if the click had done nothing. Under "All Companies" the
  // rollup is the honest answer, and the per-company detail is in the
  // Companies column's pills and the picker dialog.
  const statusFor = (user: User): string => {
    if (typeof activeCompany !== 'number') return user.status ?? 'active';
    const assignment = assignmentsOf(user).find(a => a.company_id === activeCompany);
    return assignment?.status ?? user.status ?? 'active';
  };

  const handleResend = async (user: User) => {
    setActionBusy(user.id);
    try {
      const updated = await userService.resendInvite(user.id);
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
    } catch { alert('Failed to resend invite'); }
    finally { setActionBusy(null); }
  };

  // The one place the status call is made. companyId is always passed
  // explicitly — left out, the server falls back to whichever
  // CompanyUserAssignment row it finds first (see
  // Api\Admin\UserController::resolveCompanyId()), which for a
  // multi-company user is an arbitrary company, not the one the admin meant.
  const applyToggle = async (user: User, companyId: number | undefined, newStatus: 'active' | 'suspended') => {
    setActionBusy(user.id);
    try {
      const updated = await userService.toggleStatus(user.id, newStatus, companyId);
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
      setCompanyPickFor(null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      alert(message || 'Failed to update status');
    }
    finally { setActionBusy(null); }
  };

  const handleToggleStatus = async (user: User) => {
    const assignments = assignmentsOf(user);

    // A company is selected in the topbar and this user genuinely belongs to
    // it → act immediately: no company dialog, no confirm either. The admin
    // has already said which company they are working in, and the row's own
    // button flips to the opposite action right after.
    //
    // The assignment has to actually exist: an unassigned user is listed
    // whatever the filter says (see UserController::index()'s orphan
    // handling), and sending a company they hold no row for would update
    // nothing and look like a dead click.
    if (typeof activeCompany === 'number' && assignments.some(a => a.company_id === activeCompany)) {
      await applyToggle(user, activeCompany, statusFor(user) === 'active' ? 'suspended' : 'active');
      return;
    }

    // Nothing to pick from — an unassigned user has no company row to scope
    // this to, so the server's own fallback is the only possible answer.
    // Confirm rather than open an empty dialog.
    if (assignments.length === 0) {
      const newStatus = (user.status ?? 'active') === 'active' ? 'suspended' : 'active';
      if (!confirm(`${newStatus === 'suspended' ? 'Suspend' : 'Reactivate'} ${user.name}?`)) return;
      await applyToggle(user, undefined, newStatus);
      return;
    }

    // "All Companies" (or a filter this user isn't part of): ask which
    // company's access is being changed, rather than silently picking one.
    setCompanyPickFor(user);
  };

  // Stage 1. Two or more companies → ask which one, exactly as Suspend does:
  // every figure the Impact Summary shows is scoped to a single company, so
  // choosing it up front is what makes that summary mean anything.
  //
  // One company (or an unassigned user with none) → nothing to pick, so go
  // straight to the summary. That is also the case where the removal ends
  // the account, since there is no other company left to keep it alive.
  const handleDelete = (user: User) => {
    const assignments = assignmentsOf(user);

    if (assignments.length > 1) {
      setDeletePickFor(user);
      return;
    }

    setDeleteTarget({ user, companyId: assignments[0]?.company_id, mode: 'delete' });
  };

  const handleResetPassword = async (user: User) => {
    if (!confirm(`Reset ${user.name}'s password? A new temporary password will be generated.`)) return;
    setActionBusy(user.id);
    try {
      const { password } = await userService.resetPassword(user.id);
      setResetInfo({ name: user.name, password });
      setResetCopied(false);
    } catch { alert('Failed to reset password'); }
    finally { setActionBusy(null); }
  };

  const copyLink = (user: User) => {
    if (!user.invite_url) return;
    navigator.clipboard.writeText(user.invite_url).then(() => {
      setCopiedId(user.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <DashboardLayout title="Users & Permissions">
      <div style={{ width: '100%', maxWidth: 'none' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Users & Permissions</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
              {used}{limit ? ` / ${limit}` : ''} seats used
              {atLimit && <span style={{ color: '#dc2626', fontWeight: 600 }}> — Limit reached</span>}
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/users/new')}
            disabled={atLimit}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: atLimit ? '#e2e8f0' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: atLimit ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 600, cursor: atLimit ? 'not-allowed' : 'pointer' }}
          >
            <HiUserPlus size={17} /> Add User
          </button>
        </div>

        {atLimit && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
            You have reached your user limit ({limit} seats). Upgrade your plan to invite more users.
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Reset password result — shown once, matching the create-user "copy credentials" pattern */}
        {resetInfo && (
          <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>
              Password reset for {resetInfo.name}
            </div>
            <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 10 }}>
              Share this temporary password with them now — it will not be shown again.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 13px', fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>
                {resetInfo.password}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(resetInfo.password);
                  setResetCopied(true);
                  setTimeout(() => setResetCopied(false), 2000);
                }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: resetCopied ? '#ecfdf5' : '#fff', color: resetCopied ? '#059669' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                {resetCopied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => setResetInfo(null)} style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6, fontSize: 15 }}>No team members yet</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>Add your first team member to get started</div>
              <button onClick={() => router.push('/admin/users/new')} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Add Someone
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                    {['Name', 'Role', 'Companies', 'Active Modules', 'Status', 'Last Login', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => {
                    const status  = statusFor(user);
                    const st      = STATUS_CFG[status] ?? STATUS_CFG['active'];
                    const busy    = actionBusy === user.id;
                    const modules = getActiveModules(user);

                    return (
                      <tr key={user.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8fafc' : 'none', opacity: busy ? 0.6 : 1 }}>

                        {/* Name + email */}
                        <td style={{ padding: '14px 16px', minWidth: 180 }}>
                          <button onClick={() => router.push(`/admin/users/${user.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{user.name}</div>
                          </button>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{user.email}</div>
                        </td>

                        {/* Role — just the role_type label, nothing else */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 50, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#2563eb', whiteSpace: 'nowrap' }}>
                            {roleDisplayLabel(user)}
                          </span>
                        </td>

                        {/* Companies — every company this user is assigned to
                            within this admin's org (not just whichever is
                            currently active in the top-of-page filter). */}
                        <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                          {(user.company_assignments ?? []).length > 0 ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(user.company_assignments ?? []).map(a => (
                                <span
                                  key={a.company_id}
                                  title={a.status === 'suspended' ? 'Suspended' : undefined}
                                  style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap',
                                    background: a.status === 'suspended' ? '#fef2f2' : '#eff6ff',
                                    color: a.status === 'suspended' ? '#dc2626' : '#2563eb',
                                  }}
                                >
                                  {a.company_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span
                              title="Not assigned to any company yet — they'll see an empty state until you assign one"
                              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap', background: '#fffbeb', color: '#b45309' }}
                            >
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Active modules */}
                        <td style={{ padding: '14px 16px', maxWidth: 220 }}>
                          {modules.length > 0 || canAddUsers(user) ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {modules.map(m => (
                                <span key={m} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                  {m}
                                </span>
                              ))}
                              {canAddUsers(user) && (
                                <span title="Can create/invite other users" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#eff6ff', color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  + Add Users
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                            <StatusIcon status={status} /> {st.label}
                          </span>
                        </td>

                        {/* Last login */}
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {fmtDate(user.last_login_at)}
                        </td>

                        {/* Created date */}
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {fmtDate(user.created_at)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => router.push(`/admin/users/${user.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <HiEye size={13} /> View
                            </button>
                            <button onClick={() => router.push(`/admin/users/${user.id}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e0e7ff', background: '#eef2ff', color: '#4f46e5', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <HiPencilSquare size={13} /> Edit / Permissions
                            </button>
                            {user.status === 'invited' ? (
                              <>
                                {user.invite_url && (
                                  <button onClick={() => copyLink(user)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: copiedId === user.id ? '#ecfdf5' : '#fff', color: copiedId === user.id ? '#059669' : '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    <HiClipboard size={13} /> {copiedId === user.id ? 'Copied' : 'Copy Link'}
                                  </button>
                                )}
                                <button onClick={() => handleResend(user)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #fde68a', background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <HiArrowPath size={13} /> Resend
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Reads `status` (this company's own, while
                                    one is selected — see statusFor()), not the
                                    global rollup: that's what makes Activate
                                    actually appear after a suspend on a user
                                    who also belongs to another company. */}
                                <button onClick={() => handleToggleStatus(user)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1.5px solid ${status === 'active' ? '#fecaca' : '#bbf7d0'}`, background: status === 'active' ? '#fff' : '#f0fdf4', color: status === 'active' ? '#dc2626' : '#059669', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  {status === 'active' ? <HiNoSymbol size={13} /> : <HiPlay size={13} />}
                                  {status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                                <button onClick={() => handleResetPassword(user)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  <HiKey size={13} /> Reset Password
                                </button>
                              </>
                            )}
                            {/* Delete opens the Impact Summary rather than
                                deleting on the spot — the objection that kept
                                this button off the list page was that the
                                consequences weren't spelled out anywhere near
                                it. Now they are, and the work can be handed
                                over before the account goes. */}
                            <button onClick={() => handleDelete(user)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <HiTrash size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Which company? — only reached with "All Companies" selected AND the
          user belonging to more than one, i.e. the one case where "suspend"
          has no single obvious target. Each row carries its own state and its
          own action, so activating one company again is a click away too. */}
      {companyPickFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                Which company?
              </h3>
              <button onClick={() => setCompanyPickFor(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 16px' }}>
              Access is suspended per company. Pick the company to change for{' '}
              <strong style={{ color: '#334155' }}>{companyPickFor.name}</strong> — their access
              everywhere else stays exactly as it is.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assignmentsOf(companyPickFor).map(a => {
                const suspended = a.status === 'suspended';
                return (
                  <div key={a.company_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', border: '1.5px solid #f1f5f9', borderRadius: 10, background: '#fafafa' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{a.company_name}</div>
                      <div style={{ fontSize: 11.5, color: suspended ? '#dc2626' : '#059669', fontWeight: 600, marginTop: 2 }}>
                        {suspended ? 'Suspended here' : 'Active here'}
                      </div>
                    </div>
                    <button
                      onClick={() => applyToggle(companyPickFor, a.company_id, suspended ? 'active' : 'suspended')}
                      disabled={actionBusy === companyPickFor.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '6px 12px', borderRadius: 7,
                        border: `1.5px solid ${suspended ? '#bbf7d0' : '#fecaca'}`,
                        background: suspended ? '#f0fdf4' : '#fff',
                        color: suspended ? '#059669' : '#dc2626',
                        fontSize: 12, fontWeight: 600, cursor: actionBusy === companyPickFor.id ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {suspended ? <HiPlay size={13} /> : <HiNoSymbol size={13} />}
                      {suspended ? 'Activate' : 'Suspend'}
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setCompanyPickFor(null)} style={{ marginTop: 16, width: '100%', padding: '10px', background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13.5, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stage 1 — which company are they being deleted from? Only reached
          when they belong to more than one. */}
      {deletePickFor && (
        <DeleteCompanyPicker
          userId={deletePickFor.id}
          userName={deletePickFor.name}
          onCancel={() => setDeletePickFor(null)}
          onPick={(companyId, remaining) => {
            setDeleteTarget({
              user: deletePickFor,
              companyId,
              // Still a company left afterwards → this is an unassign, and
              // the account survives there. Nothing left → the account goes.
              mode: remaining > 0 ? 'unassign' : 'delete',
            });
            setDeletePickFor(null);
          }}
        />
      )}

      {/* Stage 2 and 3 — the dependency summary for that company, optional
          reassignment, then the final confirmation that actually deletes. */}
      {deleteTarget && (
        <DeleteUserModal
          userId={deleteTarget.user.id}
          userName={deleteTarget.user.name}
          companyId={deleteTarget.companyId}
          mode={deleteTarget.mode}
          onCancel={() => setDeleteTarget(null)}
          onDone={() => { setDeleteTarget(null); load(); }}
        />
      )}
    </DashboardLayout>
  );
}

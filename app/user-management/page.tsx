'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { staffUserService } from '@/lib/services/staffUserService';
import { userService } from '@/lib/services/userService';
import { can, getAuthUser, getActiveCompany, isDeputyAdmin } from '@/lib/auth';
import { User, CompanyOption } from '@/types';
import { roleDisplayLabel } from '@/lib/roleUtils';
import {
  HiUserPlus, HiPencilSquare, HiNoSymbol, HiPlay,
  HiCheckCircle, HiArrowPath, HiLockClosed, HiEye, HiClipboard, HiKey,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

// Delegated User Management — the Company Admin's own Users screen, handed to
// a staff member who was granted the "User Management Permission"
// (account.canAddUsers). Add and Edit are the SAME pages the Company Admin
// uses (/users/new and /users/{id}/edit): userService switches to the
// /user/users/* API for a staff caller, so there is one set of screens rather
// than a second, drifting copy.
//
// Every action is bound to the companies this person is actually assigned to —
// the server decides that scope (UserManagementController::
// manageableCompanyIds()) and the company picker below is literally built
// from what it hands back.
//
// Two things a DELEGATED manager can never do, enforced on both sides:
//   • grant the User Management Permission to anyone (no minting more managers)
//   • touch someone who already holds it — those rows are listed by name only,
//     so the roster stays complete, and nothing else.
//
// Neither cap applies to the Admin role, which is the Company Admin's deputy
// here: it administers the whole roster, other Admins and other User Managers
// included. Api\User\UserManagementController::isDeputyAdmin() is the gate,
// and it spells out what still holds (nobody edits their own account, and the
// owner's own CompanyAdmin login is unreachable from this API either way).

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#059669', bg: '#ecfdf5', label: 'Active'    },
  invited:   { color: '#d97706', bg: '#fffbeb', label: 'Invited'   },
  suspended: { color: '#dc2626', bg: '#fef2f2', label: 'Suspended' },
};

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const errText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const th: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 13, color: '#475569', verticalAlign: 'top' };

const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
  border: `1.5px solid ${border}`, background: bg, color, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
});

export default function UserManagementPage() {
  const router = useRouter();
  const me = getAuthUser() as { id?: number } | null;

  // can() reads cookies, which don't exist server-side — hold the gate behind
  // `mounted` so the first paint matches on both sides.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  const allowed = can('account', 'canAddUsers');
  // A deputy Admin administers peers too, so no row is locked for them.
  const deputy = isDeputyAdmin();

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [seats, setSeats] = useState<{ used: number; limit: number | null }>({ used: 0, limit: null });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (mounted && !allowed) router.replace('/dashboard');
  }, [mounted, allowed, router]);

  // This screen has no company picker of its own — scope follows the one
  // company switcher in the topbar (active_company_id), so the roster here
  // matches every other page the manager was just looking at. The cookie is
  // still validated against the manageable list: a manager assigned to a
  // company they hold no User Management Permission in falls back to the
  // first company the server actually handed back.
  useEffect(() => {
    if (!allowed) return;
    staffUserService.companyOptions()
      .then(list => {
        setCompanies(list);
        const active = getActiveCompany();
        const scoped = list.find(c => c.id === active)?.id ?? list[0]?.id ?? null;
        setCompanyId(prev => prev ?? scoped);
      })
      .catch(() => toast.error('Failed to load your companies'));
  }, [allowed]);

  const load = async (cid: number | null) => {
    setLoading(true);
    try {
      const data = await staffUserService.list(cid ?? undefined);
      setUsers(data.users);
      setSeats({ used: data.used, limit: data.limit });
    } catch (err) {
      toast.error(errText(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (allowed && companyId !== null) load(companyId); }, [allowed, companyId]);

  const assignmentsOf = (u: User) => u.company_assignments ?? [];

  // Already a manager themselves — a peer a DELEGATED manager doesn't
  // administer. Read off the permissions the list already carries (scoped to
  // this manager's own companies), and refused server-side as well. A deputy
  // has no peers in this sense: it manages managers too, so this is never
  // true for them and no row locks.
  const isPeerManager = (u: User) =>
    !deputy
    && assignmentsOf(u).some(a => ((a.permissions?.account as string[] | undefined) ?? []).includes('canAddUsers'));

  // While one company is selected a row must report THAT company's status —
  // users.status is a rollup across every company, so someone suspended here
  // but active elsewhere would otherwise read "Active" with a Suspend button
  // that looked like it did nothing.
  const statusFor = (u: User): 'active' | 'invited' | 'suspended' => {
    if (u.status === 'invited') return 'invited';
    const here = assignmentsOf(u).find(a => a.company_id === companyId);
    return here ? here.status : u.status;
  };

  const toggleStatus = async (u: User) => {
    const next = statusFor(u) === 'active' ? 'suspended' : 'active';
    const companyName = companies.find(c => c.id === companyId)?.name ?? 'this company';
    if (!window.confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} ${u.name} in ${companyName}?`)) return;
    setBusyId(u.id);
    try {
      const updated = await staffUserService.toggleStatus(u.id, next, companyId ?? undefined);
      setUsers(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      toast.success(next === 'suspended' ? 'User suspended' : 'User reactivated');
    } catch (err) {
      toast.error(errText(err, 'Failed to update status'));
    } finally {
      setBusyId(null);
    }
  };

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyInviteLink = async (u: User) => {
    if (!u.invite_url) return;
    try {
      await navigator.clipboard.writeText(u.invite_url);
      setCopiedId(u.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const resendInvite = async (u: User) => {
    setBusyId(u.id);
    try {
      const updated = await userService.resendInvite(u.id);
      setUsers(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      toast.success('Invite link refreshed');
    } catch (err) {
      toast.error(errText(err, 'Failed to resend the invite'));
    } finally {
      setBusyId(null);
    }
  };

  // The new password is shown once and never again, so it goes in a prompt the
  // deputy has to copy out of — same as the Company Admin's own list.
  const resetPassword = async (u: User) => {
    if (!window.confirm(`Reset ${u.name}'s password? They'll have to set a new one on their next login.`)) return;
    setBusyId(u.id);
    try {
      const { password } = await userService.resetPassword(u.id);
      window.prompt(`New password for ${u.name} — copy it now, it will not be shown again:`, password);
      toast.success('Password reset');
    } catch (err) {
      toast.error(errText(err, 'Failed to reset the password'));
    } finally {
      setBusyId(null);
    }
  };

  if (!mounted) {
    return (
      <DashboardLayout title="Users">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }
  if (!allowed) return null;

  const seatText = seats.limit === null ? `${seats.used} users` : `${seats.used} of ${seats.limit} seats used`;

  return (
    <DashboardLayout title="Users">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Users</h1>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Staff of {companies.find(c => c.id === companyId)?.name ?? 'your company'} · {seatText}
            </div>
          </div>
          {/* The Company Admin's own Add User wizard — same three steps, same
              permission editor, just capped to what this manager may grant. */}
          <button onClick={() => router.push('/users/new')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
            border: 'none', background: '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            <HiUserPlus size={16} /> Add User
          </button>
        </div>

        {/* No company-scope picker here on purpose — the topbar's company
            switcher is the single place company scope is chosen, and this
            page reads it (see the companyOptions effect above). The header
            line already names the company the roster belongs to. */}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No users in this company yet</div>
              <div style={{ fontSize: 13 }}>Add one to get started.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['User', 'Role', 'Companies', 'Status', 'Added', 'Actions'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const status = statusFor(u);
                    const cfg = STATUS_CFG[status] ?? STATUS_CFG.active;
                    const isSelf = u.id === me?.id;
                    const peer = isPeerManager(u);
                    const locked = isSelf || peer;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8fafc' : 'none', background: locked ? '#fcfcfd' : undefined }}>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                            {u.name}
                            {isSelf && <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginLeft: 6 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{u.email}</div>
                        </td>
                        <td style={td}>
                          {roleDisplayLabel(u)}
                          {peer && !isSelf && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, padding: '2px 7px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: 10.5, fontWeight: 600 }}>
                              <HiLockClosed size={10} /> User Manager
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {assignmentsOf(u).map(a => (
                              <span key={a.company_id} title={a.status === 'suspended' ? 'Suspended here' : undefined} style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap',
                                background: a.status === 'suspended' ? '#fef2f2' : '#eff6ff',
                                color: a.status === 'suspended' ? '#dc2626' : '#2563eb',
                              }}>{a.company_name}</span>
                            ))}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
                            fontSize: 11.5, fontWeight: 600, background: cfg.bg, color: cfg.color,
                          }}>
                            {status === 'suspended' ? <HiNoSymbol size={12} /> : status === 'invited' ? <HiArrowPath size={12} /> : <HiCheckCircle size={12} />}
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>{fmtDate(u.created_at)}</td>
                        <td style={td}>
                          {/* Own account, and anyone who is a User Manager
                              themselves, are listed but not actionable — only
                              the Company Admin changes those. */}
                          {locked ? (
                            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                              {isSelf ? 'Ask your Company Admin' : 'Managed by Company Admin'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {/* View — the read-only detail page, including
                                  the person's activity log. Deputy only: its
                                  activity route has no delegated-manager
                                  equivalent. */}
                              {deputy && (
                                <button disabled={busy} onClick={() => router.push(`/users/${u.id}`)} style={btn('#fff', '#64748b', '#e2e8f0')}>
                                  <HiEye size={13} /> View
                                </button>
                              )}
                              {/* Same Edit User page the Company Admin gets —
                                  basic info, role and the per-company
                                  permission editor all live there, and for a
                                  deputy so does "✕ Remove company". */}
                              <button disabled={busy} onClick={() => router.push(`/users/${u.id}/edit`)} style={btn('#eef2ff', '#4f46e5', '#e0e7ff')}>
                                <HiPencilSquare size={13} /> Edit &amp; Permissions
                              </button>
                              {status === 'invited' ? (
                                // Pending invite: the same two actions the
                                // Company Admin's list offers. Deputy only —
                                // resend-invite is one of the deputy routes.
                                deputy && (
                                  <>
                                    {u.invite_url && (
                                      <button disabled={busy} onClick={() => copyInviteLink(u)} style={btn(
                                        copiedId === u.id ? '#ecfdf5' : '#fff',
                                        copiedId === u.id ? '#059669' : '#64748b',
                                        '#e2e8f0',
                                      )}>
                                        <HiClipboard size={13} /> {copiedId === u.id ? 'Copied' : 'Copy Link'}
                                      </button>
                                    )}
                                    <button disabled={busy} onClick={() => resendInvite(u)} style={btn('#fffbeb', '#d97706', '#fde68a')}>
                                      <HiArrowPath size={13} /> Resend
                                    </button>
                                  </>
                                )
                              ) : (
                                <>
                                  <button disabled={busy} onClick={() => toggleStatus(u)} style={btn(
                                    status === 'active' ? '#fff' : '#f0fdf4',
                                    status === 'active' ? '#dc2626' : '#059669',
                                    status === 'active' ? '#fecaca' : '#bbf7d0',
                                  )}>
                                    {status === 'active' ? <HiNoSymbol size={13} /> : <HiPlay size={13} />}
                                    {status === 'active' ? 'Suspend' : 'Activate'}
                                  </button>
                                  {deputy && (
                                    <button disabled={busy} onClick={() => resetPassword(u)} style={btn('#fff', '#64748b', '#e2e8f0')}>
                                      <HiKey size={13} /> Reset Password
                                    </button>
                                  )}
                                </>
                              )}
                              {/* No Remove here, matching the Company Admin's
                                  own list — that screen keeps its Delete row
                                  action switched off (SHOW_DELETE_ACTION) and
                                  removal lives on Edit User instead, behind
                                  the Impact Summary. Suspend covers
                                  day-to-day offboarding and is reversible. */}
                            </div>
                          )}
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
    </DashboardLayout>
  );
}

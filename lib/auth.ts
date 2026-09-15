import Cookies from 'js-cookie';
import { User, Admin, SuperAdmin, CompanyAssignment } from '@/types';

const AUTH_USER_STORAGE_KEY = 'auth_user';

export const setAuthData = (
  token: string,
  user: User | Admin | SuperAdmin,
  type: 'user' | 'admin' | 'super_admin'
) => {
  Cookies.set('auth_token', token, { expires: 7 });
  Cookies.set('auth_type', type, { expires: 7 });
  Cookies.remove('auth_user');
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  }
};

export const getAuthUser = (): User | Admin | null => {
  const user = typeof window !== 'undefined'
    ? window.localStorage.getItem(AUTH_USER_STORAGE_KEY) ?? Cookies.get('auth_user')
    : Cookies.get('auth_user');

  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

export const getAuthType = () => Cookies.get('auth_type') || null;

// The Admin role is the Company Admin's deputy on the staff side: in the user
// management screens it manages the whole roster (other Admins and other User
// Managers included), assigns any role including Admin, and hands out the User
// Management Permission — everything the tenant owner does. An ordinary
// delegated manager (canAddUsers on some other role) does none of those four.
//
// This mirrors Api\User\UserManagementController::isDeputyAdmin(), which is
// the real gate; here it only decides which controls are worth rendering.
export const isDeputyAdmin = (): boolean =>
  getAuthType() === 'user' && (getAuthUser() as User | null)?.role_type === 'admin';
export const getToken    = () => Cookies.get('auth_token') || null;
export const isAuthenticated = () => !!Cookies.get('auth_token');

// ── Active company (Rule 8: sidebar and permissions based on selected company) ──
// 'all' is the Company Admin-only "All Companies" sentinel (set exclusively
// by CompanySelector.tsx) — staff/user sessions never write it, since their
// equivalent picker (/select-company) only ever calls setActiveCompany with
// a real company id.

export const setActiveCompany = (id: number | 'all') => {
  Cookies.set('active_company_id', String(id), { expires: 7 });
};

export const getActiveCompany = (): number | 'all' | null => {
  const id = Cookies.get('active_company_id');
  if (!id) return null;
  if (id === 'all') return 'all';
  const parsed = parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const clearActiveCompany = () => {
  Cookies.remove('active_company_id');
};

// ── Permission helpers ────────────────────────────────────────────────────────

// Returns the permission keys a sub-user has for a given module key, scoped to
// the company they are currently working in. Admins always get all permissions
// (returns ['*']).
//
// A permission granted in one company MUST NOT apply in another. That is not a
// convenience filter, it is the tenancy boundary, so the three rules below are
// deliberately strict:
//
//  1. ACTIVE ASSIGNMENTS ONLY. UserResource serialises every
//     company_user_assignments row including suspended ones, permissions and
//     all, so a suspended member used to keep their whole UI. /select-company
//     already refuses to auto-select a suspended assignment and
//     User::scopeOfCompany() already requires status='active' — this now agrees
//     with both.
//  2. STRICT COMPANY MATCH. When an active company is set, only that company's
//     assignment counts.
//  3. NO GUESSING WHEN AMBIGUOUS. With no active company set, this used to fall
//     back to *every* assignment and return the first one holding any
//     permission for the module — an arbitrary OTHER company's grants, applied
//     wherever the user happened to be. One unambiguous active assignment is
//     still honoured (that is the ordinary single-company session, which
//     /select-company sets the cookie for anyway); beyond that we return
//     nothing and let the user pick a company. Denying here is safe — the
//     server re-checks every call against its own company_id.
export const getUserModulePermissions = (moduleKey: string): string[] => {
  if (getAuthType() === 'admin') return ['*'];

  const u        = getAuthUser() as User | null;
  const activeId = getActiveCompany();
  const active   = (u?.company_assignments ?? []).filter(a => a.status === 'active');

  // 'all' is the Company Admin-only sentinel and is never valid for a staff
  // session, so it is not a number here and falls through to the single-
  // assignment case below rather than unlocking every company.
  let scoped: CompanyAssignment[];
  if (typeof activeId === 'number') {
    scoped = active.filter(a => a.company_id === activeId);
  } else if (active.length === 1) {
    scoped = active;
  } else {
    return [];
  }

  // Union, never first-match. Today there is one assignment row per company so
  // this usually merges a single entry, but returning early on the first hit
  // silently discarded everything after it — which is exactly how a second
  // grant (a duplicate assignment row, or a user holding more than one role in
  // the same company) would lose its permissions. Merging keeps the rule that
  // grants only ever add up: nothing a user has been given can be taken away
  // by something else they have.
  const merged = new Set<string>();
  for (const a of scoped) {
    for (const key of a.permissions?.[moduleKey] ?? []) merged.add(key);
  }

  return [...merged];
};

// canView/Create/EditClients are granted identically whether the company
// purchased the Client module or the Sales module ("basic client access
// included with Sales") — a permission saved under either bucket must work
// when checked against the other.
const SHARED_CLIENT_KEYS = ['canViewClients', 'canCreateClients', 'canEditClients'];

// Returns true if the current user has the given permission key for a module.
// Admins always return true.
export const can = (moduleKey: string, permKey: string): boolean => {
  const perms = getUserModulePermissions(moduleKey);
  if (perms.includes('*') || perms.includes(permKey)) return true;

  if (SHARED_CLIENT_KEYS.includes(permKey) && (moduleKey === 'client' || moduleKey === 'sales')) {
    const otherModule = moduleKey === 'client' ? 'sales' : 'client';
    const otherPerms = getUserModulePermissions(otherModule);
    return otherPerms.includes('*') || otherPerms.includes(permKey);
  }

  return false;
};

// ── Role-based post-login redirect ───────────────────────────────────────────
// Picks the first existing staff dashboard route the user's permissions
// unlock. Roles with no dedicated dashboard yet (HR, Compliance, Finance,
// Viewer) fall through to '/dashboard', which already adapts its content to
// whatever modules the user has.
const STAFF_REDIRECT_RULES: { module: string; permAny: string[]; path: string }[] = [
  { module: 'project_management', permAny: ['canViewProjectDashboard', 'canViewProjects', 'canCreateTasks', 'canAssignTasks'], path: '/projects/dashboard' },
  { module: 'project_management', permAny: ['canViewTasks'], path: '/tasks' },
  { module: 'sales',   permAny: ['canViewSalesDashboard', 'canViewLeads'], path: '/sales' },
  { module: 'invoice', permAny: ['canViewInvoiceDashboard', 'canViewInvoices'], path: '/invoices' },
  { module: 'finance', permAny: ['canViewFinanceDashboard', 'canViewRevenueDashboard'], path: '/invoices' },
];

export const resolveStaffRedirect = (assignment?: CompanyAssignment): string => {
  const perms = assignment?.permissions ?? {};
  for (const rule of STAFF_REDIRECT_RULES) {
    const modulePerms = perms[rule.module] ?? [];
    if (modulePerms.includes('*') || rule.permAny.some(p => modulePerms.includes(p))) return rule.path;
  }
  return '/dashboard';
};

export const logout = () => {
  Cookies.remove('auth_token');
  Cookies.remove('auth_user');
  Cookies.remove('auth_type');
  Cookies.remove('active_company_id');
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
};

export interface Admin {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string | null;
  subscription_status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  is_active?: boolean;
  companies: Company[];
  modules?: string[];
  max_users_per_company?: number | null;
  max_companies?: number | null;
  // Set on My Profile — authoritative for every invoice this admin issues,
  // across any of their companies (see Company::invoicingProfile()).
  currency?: string;
}

export type DataScope = 'own' | 'assigned' | 'all' | 'view_only' | 'no_access';

export interface CompanyAssignment {
  company_id: number;
  company_name: string;
  status: 'active' | 'suspended';
  permissions: Record<string, string[]>; // moduleKey → permissionKey[]
  data_scopes?: Record<string, DataScope>; // moduleKey → data scope (enforced for project_management; descriptive only elsewhere so far)
}

export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  own: 'Own records',
  assigned: 'Assigned records',
  all: 'All company records',
  view_only: 'View only',
  no_access: 'No access',
};

export interface CompanyOption {
  id: number;
  name: string;
  modules: string[]; // purchased module keys
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_type: string;
  // Display-only override for a "Custom Role" — takes priority over the
  // generic ROLE_LABELS[role_type] name wherever a role is shown; the real
  // permission/behavior bucket stays role_type. See roleUtils.roleDisplayLabel().
  custom_role_label?: string | null;
  phone?: string;
  avatar_path?: string;
  avatar_url?: string | null;
  is_active: boolean;
  is_online: boolean;
  status: 'active' | 'invited' | 'suspended';
  last_login_at?: string | null;
  created_at?: string;
  created_by?: { id: number; name: string } | null;
  invite_url?: string | null;
  company?: Company | null;
  permissions?: Permission[];
  company_assignments?: CompanyAssignment[];
}

export interface Company {
  id: number;
  name: string;
  timezone?: string;
  currency?: string;
  logo_path?: string;
  is_active?: boolean;
  // admin.currency is the tenant's Settings-configured currency —
  // authoritative for invoice creation, unlike the sibling `currency` above
  // (legacy, pre-tenant-refactor, per-Company column — see
  // Company::invoicingProfile() on the backend).
  admin?: { id: number; name: string; currency?: string } | null;
}

export interface Permission {
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

// ─── Client / Invoice / Payment types ────────────────────────────────────────

export interface Client {
  id: number;
  company_id: number;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  country?: string;
  portal_access: boolean;
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  created_at: string;
  company?: Company;
  user?: { id: number; email: string; is_active: boolean };
  // Only present on GET /user/clients/{id} for a user holding
  // canEnableClientPortal/canDisableClientPortal — see
  // Api\User\ClientController::show().
  portal_permissions?: Record<string, { label: string; is_enabled: boolean; purchased: boolean }>;
  // Same gate — whether this client's company has the real Client Portal
  // module purchased. Only present alongside portal_permissions above.
  has_portal_module?: boolean;
  // Set once this client has a Project — its chat conversation has moved
  // there (see App\Services\PaymentProjectStartService::
  // migrateChatHistory()); the frontend uses this to point Sales Chat at
  // Project Chat instead of the old, now-abandoned Client-anchored thread.
  chat_project_id?: number | null;
}

// GET /{admin|user}/clients/{id}/delete-summary — every record a delete would
// take. Deleting a client is permanent and cascades, so the confirmation modal
// puts these numbers in front of the admin first. See
// App\Services\ClientDeletionService.
export interface ClientDeleteSummary {
  client: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    status: string;
    has_portal_login: boolean;
    portal_email: string | null;
  };
  projects: { total: number; ongoing: number; completed: number; cancelled: number };
  invoices: { total: number; paid: number; unpaid: number; overdue: number; cancelled: number };
  payments: {
    total: number;
    // One entry per currency — a client billed in more than one can't be
    // summed into a single figure.
    received: { currency: string; amount: string }[];
  };
  other: {
    tasks: number;
    timesheets: number;
    deliverables: number;
    compliance_cases: number;
    chat_threads: number;
    portal_permissions: number;
  };
}

// GET /admin/users/{id}/delete-impact — everything a user holds inside one
// company, what a permanent account delete would do to each of it, and what
// must be handed over first. See App\Services\UserDeletionService.
export interface UserImpactSection {
  key: string;
  label: string;
  total: number;
  note: string | null;
  items: { id: number; name: string; meta: string | null }[];
  /** Rows beyond the names listed in `items`. */
  more: number;
  /** 'unassigned' = the record survives without them; 'deleted' = it goes too. */
  on_delete: 'unassigned' | 'deleted';
  /** Which reassignment bucket can clear this section, if any. */
  reassign_key: string | null;
  /** Active work that should be handed over before deleting. */
  blocking_count: number;
}

// GET /admin/users/{id}/company-workload — one row per company the admin can
// act on, so the "delete them from which company?" picker isn't blind.
export interface UserCompanyWorkload {
  company_id: number;
  company_name: string;
  status: string;
  projects: number;
  leads: number;
  tasks: number;
  clients: number;
  tickets: number;
  team: number;
  total: number;
}

export interface UserDeleteImpact {
  user: {
    id: number;
    name: string;
    email: string;
    role_type: string;
    custom_role_label: string | null;
    status: string;
    is_active: boolean;
    company_id: number;
    company_name: string | null;
    companies: { id: number; name: string; status: string }[];
  };
  sections: UserImpactSection[];
  role_extra: { role_type: string; rows: { label: string; value: number }[] } | null;
  blockers: { key: string; label: string; count: number; reassign_key: string | null }[];
  reassignable: string[];
  candidates: { id: number; name: string; email: string; role_type: string }[];
  /** False when the account also belongs to another organisation. */
  can_delete: boolean;
  block_reason: string | null;
}

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order?: number;
}

export interface InvoicePayment {
  id: number;
  amount: number;
  currency?: string | null;
  converted_amount?: number | null;
  converted_currency?: string | null;
  exchange_rate?: number | null;
  method?: string;
  gateway?: string;
  status: string;
  payment_date?: string;
  notes?: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  company_id: number;
  client_id: number;
  lead_id?: number | null;
  project_id?: number | null;
  invoice_number: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  due_date?: string;
  notes?: string;
  sent_at?: string;
  created_at: string;
  payment_token?: string | null;
  token_expires_at?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  client?: Client;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  gateway_account_ids?: number[];
  // Deal-facing fields — what this invoice is for, even before a Project exists.
  invoice_purpose?: string | null;
  payment_type?: string | null;
  required_payment_amount?: number | null;
  counts_toward_project_activation?: boolean;
  // The real linked project, once one exists. "New Project" mode invoices
  // (project_title set, no project yet) only have project_title until a
  // qualifying payment auto-creates the project and backfills project_id.
  project?: { id: number; name: string } | null;
  project_title?: string | null;
  lead?: {
    id: number;
    deal_reference?: string | null;
    proposed_project_title?: string | null;
    fulfillment_status?: string | null;
  } | null;
  // Every project this invoice's Deal (Lead) has ever spun off — completed,
  // previous and latest — mirroring the Client Portal's own project list.
  project_history?: {
    id: number;
    name: string;
    status: string;
    start_date?: string | null;
    deadline?: string | null;
    created_at: string;
    progress: number;
    project_manager?: { id: number; name: string } | null;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// ─── Public / Landing types ───────────────────────────────────────────────────

export interface PublicPackage {
  id: number;
  name: string;
  tier: string;
  price_pkr: number;
  price_usd: number;
  trial_days: number;
  is_popular: boolean;
  features: string[];
  modules: string[];
}

export interface RegistrationData {
  company_name: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  package_id: number;
  selected_modules: string[];
  currency: 'USD';
  start_type: 'trial' | 'paid';
  timezone: string;
}

// ─── Super Admin types ────────────────────────────────────────────────────────

export interface SuperAdmin {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

export interface PackageModuleItem {
  id: number;
  module_key: string;
  is_enabled: boolean;
}

export interface Package {
  id: number;
  name: string;
  tier: 'basic' | 'professional' | 'enterprise' | 'custom';
  price: number | string;
  price_pkr: number | null;
  price_usd: number | null;
  billing_cycle: 'monthly' | 'yearly';
  trial_days: number | null;
  max_companies: number | null;
  max_users_per_company: number | null;
  description: string | null;
  is_active: boolean;
  is_visible: boolean;
  is_popular: boolean;
  features: string[] | null;
  modules: PackageModuleItem[];
  company_admins_count?: number;
}

export interface AdminFull {
  id: number;
  name: string;
  email: string;
  phone?: string;
  subscription_status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  is_active: boolean;
  package: Package | null;
  companies?: Company[];
  companies_count?: number;
}

export interface CompanyFull {
  id: number;
  name: string;
  industry?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  users_count: number;
  created_at: string;
  admin: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface DashboardStats {
  total_packages: number;
  total_admins: number;
  total_companies: number;
  active_subscriptions: number;
  recent_admins: AdminFull[];
  recent_companies: CompanyFull[];
}

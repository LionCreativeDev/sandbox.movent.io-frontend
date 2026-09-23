import api from '@/lib/axios';
import { getAuthType } from '@/lib/auth';

/**
 * Finance Area API client.
 *
 * One service for both portals. The backend registers the identical Finance
 * route list under /admin and /user (see routes/api.php's $financeRoutes),
 * so the only difference here is the prefix — the same role-based switch
 * app/reports/page.tsx and salesExtrasService already use.
 */
const base = () => (getAuthType() === 'admin' ? '/admin' : '/user');

// ── Shapes ────────────────────────────────────────────────────────────────
// These mirror App\Services\Finance\FinancePresenter exactly. That class is
// an allow-list, so what is typed here is the whole of what the server will
// ever send — in particular there is no card, CVV or gateway-credential
// field to type, because none is ever serialised.

export interface FinanceCapabilities {
  'dashboard.view': boolean;
  'revenue_dashboard.view': boolean;
  'invoices.view': boolean;
  'invoices.create': boolean;
  'invoices.update': boolean;
  'invoices.export': boolean;
  'payments.view': boolean;
  'payments.record': boolean;
  'payments.reconcile': boolean;
  'payment_details.view': boolean;
  'payment_details.reconcile': boolean;
  'payment_details.export': boolean;
  'reminders.create': boolean;
  'reminders.send': boolean;
  'reminders.track': boolean;
  'reports.finance': boolean;
  'reports.finance.export': boolean;
  'reports.revenue': boolean;
  'reports.revenue.export': boolean;
  'reports.payments': boolean;
  'reports.payments.export': boolean;
  'scope.all_company': boolean;
}

export type FinanceCapabilityKey = keyof FinanceCapabilities;

export interface CompanyOption { id: number; name: string }

export interface FinanceInvoiceRow {
  id: number;
  invoice_number: string;
  company_id: number;
  company_name: string | null;
  client_id: number | null;
  customer_name: string;
  customer_company: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
  payment_status: string;
  payment_percentage: number;
  is_overdue: boolean;
  project_id: number | null;
  project_name: string | null;
  lead_id: number | null;
  created_by: string | null;
  created_at: string | null;
}

export interface FinancePaymentRow {
  id: number;
  reference: string;
  receipt_number: string | null;
  invoice_id: number;
  invoice_number: string | null;
  company_id: number | null;
  company_name: string | null;
  client_id: number | null;
  customer_name: string;
  amount: number;
  currency: string | null;
  method: string | null;
  gateway: string | null;
  gateway_name: string | null;
  transaction_id: string | null;
  status: string;
  payment_date: string | null;
  recorded_by: string | null;
  reconciliation_status: 'unreconciled' | 'reconciled' | 'disputed';
  reconciled_at: string | null;
  reconciled_by: string | null;
  reconciliation_note: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface FinancePaymentDetail extends FinancePaymentRow {
  gateway_mode: string | null;
  converted_amount: number | null;
  converted_currency: string | null;
  exchange_rate: number | null;
  invoice: {
    id: number;
    invoice_number: string;
    status: string;
    payment_status: string;
    currency: string | null;
    total_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    invoice_date: string | null;
    due_date: string | null;
    purpose: string | null;
  } | null;
  comparison: {
    payment_amount: number;
    invoice_total: number;
    invoice_paid: number;
    invoice_outstanding: number;
    currency_matches: boolean;
    covers_full_invoice: boolean;
    invoice_settled: boolean;
    overpaid: boolean;
  } | null;
  related: {
    client: { id: number; name: string; company_name: string | null; email: string | null } | null;
    lead: { id: number; name: string } | null;
    project: { id: number; name: string; status: string } | null;
  };
}

export interface FinanceReminderRow {
  id: number;
  invoice_id: number;
  invoice_number: string | null;
  company_id: number | null;
  company_name: string | null;
  client_id: number | null;
  customer_name: string;
  type: string;
  reminder_date: string | null;
  due_date: string | null;
  subject: string | null;
  message: string | null;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  sent_to: string | null;
  sent_by: string | null;
  failure_reason: string | null;
  created_by: string | null;
  created_at: string | null;
  invoice_currency: string | null;
  invoice_total: number | null;
  invoice_outstanding: number | null;
  invoice_status: string | null;
}

export interface CurrencyAmount { currency: string; [metric: string]: string | number }

export interface FinanceDashboard {
  overview: {
    counts: { total: number; draft: number; paid: number; pending: number; overdue: number; cancelled: number };
    by_currency: {
      currency: string;
      total_invoiced: number;
      total_paid: number;
      total_outstanding: number;
      overdue_amount: number;
      invoice_count: number;
    }[];
    by_status: { status: string; count: number; by_currency: { currency: string; amount: number }[] }[];
  };
  payments: {
    counts: {
      total: number; confirmed: number; pending: number; failed: number;
      refunded: number; reconciled: number; unreconciled: number; disputed: number;
    };
    by_currency: { currency: string; total_received: number; count: number }[];
    by_method: Breakdown[];
    by_gateway: Breakdown[];
  };
  revenue_trend: MonthlyTrend;
  recent_invoices: FinanceInvoiceRow[];
  recent_payments: FinancePaymentRow[];
  top_clients: TopClient[];
  currencies: string[];
  companies: CompanyOption[];
  generated_at: string;
}

export interface Breakdown {
  key: string;
  count: number;
  by_currency: { currency: string; amount: number }[];
}

export interface MonthlyTrend {
  year: number;
  months: { month: number; by_currency: { currency: string; invoiced: number; received: number }[] }[];
}

export interface TopClient {
  client_id: number;
  name: string;
  company: string | null;
  count: number;
  by_currency: { currency: string; invoiced?: number; paid?: number; outstanding?: number; revenue?: number }[];
}

export interface FinanceReport {
  invoices?: FinanceDashboard['overview'];
  payments?: FinanceDashboard['payments'];
  summary?: unknown;
  reconciliation?: {
    reconciled: number;
    unreconciled: number;
    disputed: number;
    pending_amount_by_currency: { currency: string; amount: number }[];
  };
  by_method?: Breakdown[];
  by_gateway?: Breakdown[];
  by_client?: TopClient[];
  top_clients?: TopClient[];
  monthly?: MonthlyTrend;
  filters?: Record<string, string | number>;
  generated_at: string;
}

export interface RevenueSummaryEntry {
  currency: string;
  revenue: number;
  invoiced: number;
  collection_rate: number;
  payment_count: number;
}

/**
 * What every Finance list endpoint returns alongside its rows.
 *
 * The rows themselves are under a per-endpoint key (`invoices`, `payments`,
 * `reminders`) rather than a generic `data`, matching the controllers, so
 * this carries only the parts that are identical everywhere.
 */
export interface Paginated {
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  capabilities: FinanceCapabilities;
  filters: Record<string, unknown>;
}

export type FinanceFilters = Record<string, string | number | boolean | undefined>;

// Empty/undefined values are stripped so a blank filter box never becomes
// `?status=` — which the backend's filled() checks would ignore anyway, but
// which would show up in the audit log's recorded filter set as noise.
const clean = (params?: FinanceFilters): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    out[k] = String(v);
  }
  return out;
};

/**
 * Download a CSV the server streams.
 *
 * Goes through the same authenticated axios instance as everything else, so
 * the export carries the bearer token and the active-company header exactly
 * as the on-screen list did — an export URL is never a way around either.
 * Same blob+anchor mechanism salesExtrasService.downloadLeadsCsv() uses.
 */
const download = async (path: string, params: FinanceFilters | undefined, filename: string): Promise<void> => {
  const res = await api.get(`${base()}${path}`, { params: clean(params), responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const financeService = {
  capabilities: async (): Promise<{ capabilities: FinanceCapabilities; companies: CompanyOption[] }> =>
    (await api.get(`${base()}/finance/capabilities`)).data.data,

  dashboard: async (params?: FinanceFilters): Promise<{ dashboard: FinanceDashboard; capabilities: FinanceCapabilities }> =>
    (await api.get(`${base()}/finance/dashboard`, { params: clean(params) })).data.data,

  // ── Invoices ────────────────────────────────────────────────────────────
  invoices: async (params?: FinanceFilters): Promise<Paginated & {
    invoices: FinanceInvoiceRow[];
    create_endpoint: string;
    update_endpoint: string;
  }> => (await api.get(`${base()}/finance/invoices`, { params: clean(params) })).data.data,

  invoice: async (id: number) => (await api.get(`${base()}/finance/invoices/${id}`)).data.data,

  exportInvoices: (params?: FinanceFilters) =>
    download('/finance/invoices/export', params, 'finance-invoices.csv'),

  // ── Payments ────────────────────────────────────────────────────────────
  payments: async (params?: FinanceFilters): Promise<Paginated & { payments: FinancePaymentRow[] }> =>
    (await api.get(`${base()}/finance/payments`, { params: clean(params) })).data.data,

  payment: async (id: number): Promise<{ payment: FinancePaymentDetail; capabilities: FinanceCapabilities }> =>
    (await api.get(`${base()}/finance/payments/${id}`)).data.data,

  recordPayment: async (invoiceId: number, body: {
    amount: number; method: string; payment_date?: string; notes?: string; gateway?: string; gateway_ref?: string;
  }) => (await api.post(`${base()}/finance/invoices/${invoiceId}/payments`, body)).data,

  reconcilePayment: async (id: number, body?: { status?: 'reconciled' | 'disputed'; note?: string }) =>
    (await api.patch(`${base()}/finance/payments/${id}/reconcile`, body ?? {})).data,

  unreconcilePayment: async (id: number, note?: string) =>
    (await api.delete(`${base()}/finance/payments/${id}/reconcile`, { data: { note } })).data,

  exportPayments: (params?: FinanceFilters) =>
    download('/finance/payments/export', params, 'finance-payments.csv'),

  // ── Payment Details ─────────────────────────────────────────────────────
  paymentDetails: async (params?: FinanceFilters): Promise<Paginated & { payments: FinancePaymentDetail[] }> =>
    (await api.get(`${base()}/finance/payment-details`, { params: clean(params) })).data.data,

  paymentDetail: async (id: number): Promise<{ payment: FinancePaymentDetail; capabilities: FinanceCapabilities }> =>
    (await api.get(`${base()}/finance/payment-details/${id}`)).data.data,

  reconcilePaymentDetail: async (id: number, body?: { status?: 'reconciled' | 'disputed'; note?: string }) =>
    (await api.patch(`${base()}/finance/payment-details/${id}/reconcile`, body ?? {})).data,

  exportPaymentDetails: (params?: FinanceFilters) =>
    download('/finance/payment-details/export', params, 'finance-payment-details.csv'),

  // ── Invoice Reminders ───────────────────────────────────────────────────
  reminders: async (params?: FinanceFilters): Promise<Paginated & { reminders: FinanceReminderRow[] }> =>
    (await api.get(`${base()}/finance/invoice-reminders`, { params: clean(params) })).data.data,

  // No invoice_id → the list of invoices worth chasing. With one → that
  // invoice, who the reminder would reach, and any warnings.
  verifyReminder: async (invoiceId?: number) =>
    (await api.get(`${base()}/finance/invoice-reminders/verify`, {
      params: invoiceId ? { invoice_id: invoiceId } : {},
    })).data.data,

  createReminder: async (body: {
    invoice_id: number; type?: string; reminder_date?: string;
    subject?: string; message?: string; send_now?: boolean;
  }) => (await api.post(`${base()}/finance/invoice-reminders`, body)).data,

  sendReminder: async (id: number) =>
    (await api.post(`${base()}/finance/invoice-reminders/${id}/send`)).data,

  cancelReminder: async (id: number) =>
    (await api.patch(`${base()}/finance/invoice-reminders/${id}/cancel`)).data,

  // ── Reports ─────────────────────────────────────────────────────────────
  report: async (kind: 'finance' | 'revenue' | 'payments', params?: FinanceFilters): Promise<{ report: FinanceReport; capabilities: FinanceCapabilities }> =>
    (await api.get(`${base()}/finance/reports/${kind}`, { params: clean(params) })).data.data,

  exportReport: (kind: 'finance' | 'revenue' | 'payments', params?: FinanceFilters) =>
    download(`/finance/reports/${kind}/export`, params, `finance-${kind}-report.csv`),
};

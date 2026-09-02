import api from '@/lib/axios';
import { getAuthType } from '@/lib/auth';

export interface SalesTarget {
  period_start: string;
  period_end: string;
  target_value: number | null;
  target_deals: number | null;
  achieved_value: number;
  achieved_deals: number;
  can_update: boolean;
}

// One row in the team/company-wide targets list — Lead Manager
// (GET /user/sales/targets/team) and Company Admin (GET /admin/sales/targets)
// both return this same shape.
export interface TeamSalesTarget {
  user_id: number;
  user_name: string;
  role_type: string;
  period_start: string;
  period_end: string;
  target_value: number | null;
  target_deals: number | null;
  achieved_value: number;
  achieved_deals: number;
}

export interface LeadReport {
  by_status: Record<string, { status: string; count: number; value: number }>;
  by_source: Record<string, number>;
  total: number;
}

export interface ConversionReport {
  monthly: { month: number; total: number; won: number; lost: number }[];
  overall_win_rate: number;
  year: number;
}

export interface PerformanceReport {
  leads: { total: number; won: number; lost: number; won_value: number };
  invoices?: { created_from_sales: number; sent_from_sales: number; paid_from_sales: number; total_value: number; total_paid: number };
  projects?: { linked_from_leads: number };
}

export const salesTargetService = {
  get: async (): Promise<SalesTarget> => (await api.get('/user/sales/targets')).data.data,
  update: async (payload: { target_value?: number | null; target_deals?: number | null }): Promise<void> => {
    await api.put('/user/sales/targets', payload);
  },
  // Lead Manager only (canManageSalesTargets) — every Seller/Lead Manager's
  // target, not just the caller's own.
  team: {
    list: async (): Promise<TeamSalesTarget[]> => (await api.get('/user/sales/targets/team')).data.data,
    update: async (userId: number, payload: { target_value?: number | null; target_deals?: number | null }): Promise<void> => {
      await api.put(`/user/sales/targets/team/${userId}`, payload);
    },
  },
};

// Company Admin — every Seller/Lead Manager's target, always available
// (not module-gated). See Api\Admin\SalesTargetController.
export const adminSalesTargetService = {
  list: async (): Promise<TeamSalesTarget[]> => (await api.get('/admin/sales/targets')).data.data,
  update: async (userId: number, payload: { target_value?: number | null; target_deals?: number | null }): Promise<void> => {
    await api.put(`/admin/sales/targets/${userId}`, payload);
  },
};

// Company Admin gets its own /admin/sales/reports/* endpoints (company-wide
// data, no permission check — see Api\Admin\SalesReportController) instead
// of the Seller-facing /user/... ones, which always 403'd for Admin: their
// canViewSalesReports check reads $user->company_id, a column CompanyAdmin
// doesn't have. Same role-based prefix switch as frontend/app/reports/page.tsx.
const salesReportsBase = () => (getAuthType() === 'admin' ? '/admin' : '/user');

export const salesReportService = {
  leadReport: async (): Promise<LeadReport> => (await api.get(`${salesReportsBase()}/sales/reports/leads`)).data.data,
  conversionReport: async (year?: number): Promise<ConversionReport> =>
    (await api.get(`${salesReportsBase()}/sales/reports/conversion`, { params: year ? { year } : {} })).data.data,
  performanceReport: async (): Promise<PerformanceReport> => (await api.get(`${salesReportsBase()}/sales/reports/performance`)).data.data,
  downloadLeadsCsv: async (): Promise<void> => {
    const res = await api.get(`${salesReportsBase()}/sales/reports/leads/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-leads-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

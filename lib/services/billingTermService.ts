import api from '@/lib/axios';

export interface BillingTerm {
  id: number;
  name: string;
  months: number;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingTermPayload {
  name: string;
  months: number;
  discount_percent: number;
  is_active?: boolean;
}

export const billingTermService = {
  getAll: async (): Promise<BillingTerm[]> => {
    const res = await api.get('/super-admin/billing-terms');
    return res.data.data;
  },

  create: async (data: BillingTermPayload): Promise<BillingTerm> => {
    const res = await api.post('/super-admin/billing-terms', data);
    return res.data.data;
  },

  update: async (id: number, data: BillingTermPayload): Promise<BillingTerm> => {
    const res = await api.put(`/super-admin/billing-terms/${id}`, data);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/super-admin/billing-terms/${id}`);
  },

  toggle: async (id: number): Promise<{ is_active: boolean }> => {
    const res = await api.patch(`/super-admin/billing-terms/${id}/toggle`);
    return res.data.data;
  },
};

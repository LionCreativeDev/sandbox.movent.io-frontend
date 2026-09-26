import api from '@/lib/axios';
import { Client, ClientDeleteSummary } from '@/types';
import { CompanyUser } from './adminLeadService';
import { AiServiceBatchItem } from './adminInvoiceService';

export interface ClientPayload {
  company_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  address?: string | null;
  country?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive' | 'blocked';
  enable_portal?: boolean;
  portal_email?: string | null;
  portal_password?: string | null;
}

export interface ClientCompany { id: number; name: string; currency: string; }

export interface ManagedCompany {
  id: number;
  name: string;
  currency: string;
  is_active: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
}

/**
 * A generated receipt for one confirmed payment of this client's.
 *
 * Every figure is read live off the invoice and payment rows server-side (the
 * same facts the receipt image itself is rendered from), so a card can never
 * describe a payment differently from the receipt it shows.
 */
export interface InvoiceReceipt {
  id: number;
  invoice_id: number;
  invoice_number: string;
  invoice_status: string;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  invoice_amount: number;
  /** This payment. `total_paid` is everything confirmed against the invoice. */
  paid_amount: number;
  total_paid: number;
  balance_due: number;
  payment_id: number;
  payment_status: string;
  payment_date: string | null;
  receipt_number: string | null;
  method: string | null;
  gateway: string | null;
  /** The gateway's own transaction reference, when the gateway gave one. */
  reference: string | null;
  /** Set only when the gateway was charged in a currency other than the invoice's. */
  converted: string | null;
  brand_name: string | null;
  company_name: string | null;
  is_brand: boolean;
  client_name: string | null;
  client_company: string | null;
  /** API-relative path to the receipt image. Authenticated — no public URL exists. */
  image_endpoint: string;
  document_id: number | null;
  file_name: string | null;
  generated_at: string;
}

export const adminClientService = {
  companies: async (): Promise<ClientCompany[]> => {
    const res = await api.get('/admin/companies');
    return res.data.data;
  },

  // GET /admin/companies/manage — the company-management screen's own list,
  // deliberately separate from companies() above: that one is shared with
  // every picker/switcher in the app and stays filtered to operational
  // companies only, while this one must still show a suspended company (to
  // reactivate it).
  manageCompanies: async (): Promise<ManagedCompany[]> => {
    const res = await api.get('/admin/companies/manage');
    return res.data.data;
  },

  suspendCompany: async (id: number, reason: string): Promise<ManagedCompany> => {
    const res = await api.patch(`/admin/companies/${id}/suspend`, { reason });
    return res.data.data;
  },

  reactivateCompany: async (id: number): Promise<{ company: ManagedCompany; fully_active: boolean; remaining_restriction: string | null }> => {
    const res = await api.patch(`/admin/companies/${id}/reactivate`);
    return res.data.data;
  },

  list: async (params?: Record<string, string>): Promise<{ clients: Client[]; seat: unknown }> => {
    const res = await api.get('/admin/clients', { params });
    return res.data.data;
  },

  getOne: async (id: number): Promise<{
    client: Client;
    permissions: Record<string, { label: string; is_enabled: boolean }>;
    seat: unknown;
    has_portal_module: boolean;
  }> => {
    const res = await api.get(`/admin/clients/${id}`);
    return res.data.data;
  },

  create: async (payload: ClientPayload): Promise<Client> => {
    const res = await api.post('/admin/clients', payload);
    return res.data.data;
  },

  update: async (id: number, payload: Partial<ClientPayload>): Promise<Client> => {
    const res = await api.put(`/admin/clients/${id}`, payload);
    return res.data.data;
  },

  // What a delete would destroy. Read this and show DeleteClientModal before
  // ever calling remove() — the delete is permanent and cascades.
  deleteSummary: async (id: number): Promise<ClientDeleteSummary> => {
    const res = await api.get(`/admin/clients/${id}/delete-summary`);
    return res.data.data;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/admin/clients/${id}`);
  },

  enablePortal: async (id: number, email: string, password: string): Promise<void> => {
    await api.post(`/admin/clients/${id}/enable-portal`, { portal_email: email, portal_password: password });
  },

  // Outstanding (not yet 'taken') AI-suggested services for this client —
  // powers the "Link to AI-Suggested Service" dropdown on Create Invoice.
  aiServiceBatchItems: async (id: number): Promise<{ batch_id: number | null; items: AiServiceBatchItem[] }> => {
    const res = await api.get(`/admin/clients/${id}/ai-service-batch-items`);
    return res.data.data;
  },

  disablePortal: async (id: number): Promise<void> => {
    await api.post(`/admin/clients/${id}/disable-portal`);
  },

  updatePermissions: async (id: number, permissions: Record<string, boolean>): Promise<void> => {
    await api.put(`/admin/clients/${id}/permissions`, { permissions });
  },

  transfer: async (id: number, toUserId: number, reason?: string): Promise<Client> => {
    const res = await api.post(`/admin/clients/${id}/transfer`, { to_user_id: toUserId, reason: reason || null });
    return res.data.data;
  },

  // Receipts for this client's confirmed payments — the Invoice Receipts tab.
  invoiceReceipts: async (id: number): Promise<InvoiceReceipt[]> => {
    const res = await api.get(`/admin/clients/${id}/invoice-receipts`);
    return res.data.data.receipts;
  },

  // The receipt image, as an object URL for an <img>. Fetched through axios
  // rather than pointed at directly because receipts live on the private disk
  // behind an authenticated endpoint — an <img src> carries no bearer token.
  // Callers own the returned URL and must revokeObjectURL it on unmount.
  receiptImageUrl: async (endpoint: string): Promise<string> => {
    const res = await api.get(endpoint, { responseType: 'blob' });
    // Re-typed rather than used as received: the browser renders an <img> by
    // the blob's own type, so stating it here means the thumbnail cannot go
    // blank because of what a proxy or the file server put on Content-Type.
    return URL.createObjectURL(new Blob([res.data], { type: 'image/svg+xml' }));
  },

  // Picker list for the Transfer Client modal — active Sellers only.
  companyUsers: async (companyId: number): Promise<CompanyUser[]> => {
    const res = await api.get('/admin/clients/company-users', { params: { company_id: companyId } });
    return res.data.data;
  },
};

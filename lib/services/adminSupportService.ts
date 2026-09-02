import api from '@/lib/axios';

export interface SupportTicket {
  id: number;
  company_id: number;
  // The backend eager-loads `raisedBy`/`assignedTo` relations, which
  // snake-case to the SAME JSON keys as these raw FK columns — Eloquent's
  // relation serialization overwrites the raw value, so these always hold
  // the {id, name} object (or null) once loaded, never a plain id.
  raised_by: { id: number; name: string } | null;
  assigned_to: { id: number; name: string } | null;
  subject: string;
  category: 'project_support' | 'billing_payments' | 'technical_issue' | 'general_inquiry'
    | 'account_login' | 'file_document_request' | 'revision_request' | 'bug_report'
    | 'feature_request' | 'other';
  description?: string | null;
  status: 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_url?: string | null;
  project_id?: number | null;
  // Eager-loaded relation — same shadow-the-FK-column pattern as raised_by/assigned_to.
  project?: { id: number; name: string; status?: string } | null;
  invoice_id?: number | null;
  invoice?: { id: number; invoice_number: string; total_amount: string; status: string } | null;
  payment_reference?: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const TICKET_CATEGORIES: { value: SupportTicket['category']; label: string }[] = [
  { value: 'project_support', label: 'Project Support' },
  { value: 'billing_payments', label: 'Billing & Payments' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'general_inquiry', label: 'General Inquiry' },
  { value: 'account_login', label: 'Account & Login' },
  { value: 'file_document_request', label: 'File / Document Request' },
  { value: 'revision_request', label: 'Revision Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

export const TICKET_STATUSES: { value: SupportTicket['status']; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const TICKET_PRIORITIES: { value: SupportTicket['priority']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export interface SupportTicketReply {
  id: number;
  ticket_id: number;
  // Same relation/attribute key collision as SupportTicket.raised_by/assigned_to —
  // the eager-loaded repliedBy relation shadows this raw FK column, so it always
  // holds the {id, name, role_type} object (or null) once loaded, never a plain id.
  replied_by: { id: number; name: string; role_type?: string } | null;
  replied_by_admin_id: number | null;
  // repliedByAdmin relation snake-cases to this key (no collision — the raw
  // FK column is replied_by_admin_id, a different name).
  replied_by_admin?: { id: number; name: string } | null;
  message: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_url?: string | null;
  created_at: string;
}

export const adminSupportService = {
  list: async (params?: Record<string, string>): Promise<SupportTicket[]> => {
    const res = await api.get('/admin/support', { params });
    return res.data.data;
  },

  get: async (id: number): Promise<{ ticket: SupportTicket; replies: SupportTicketReply[] }> => {
    const res = await api.get(`/admin/support/${id}`);
    return res.data.data;
  },

  reply: async (id: number, message: string, attachment?: File | null): Promise<SupportTicketReply> => {
    const form = new FormData();
    form.append('message', message);
    if (attachment) form.append('attachment', attachment);
    const res = await api.post(`/admin/support/${id}/reply`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  assign: async (id: number, userId: number | null): Promise<SupportTicket> => {
    const res = await api.patch(`/admin/support/${id}/assign`, { user_id: userId });
    return res.data.data;
  },

  updateStatus: async (id: number, status: string): Promise<SupportTicket> => {
    const res = await api.patch(`/admin/support/${id}/status`, { status });
    return res.data.data;
  },
};

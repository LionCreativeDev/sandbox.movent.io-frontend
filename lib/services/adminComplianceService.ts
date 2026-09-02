import api from '@/lib/axios';

export type ComplianceCaseStatus = 'not_started' | 'pending' | 'under_review' | 'compliant' | 'on_hold' | 'rejected';
export type ComplianceDocumentStatus = 'pending_review' | 'approved' | 'rejected' | 'resubmission_requested' | 'expired';
export type ComplianceRequirementStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resubmission_requested' | 'expired' | 'waived';

export interface ComplianceDashboard {
  total: number;
  by_status: Record<ComplianceCaseStatus, number>;
  unassigned_officer: number;
}

export interface ComplianceClientListItem {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  total_projects: number;
  compliant: number;
  pending: number;
  under_review: number;
  on_hold: number;
  rejected: number;
}

export interface ComplianceClientProject {
  id: number;
  name: string;
  reference: string | null;
  status: string;
  project_manager: { id: number; name: string } | null;
  seller: { id: number; name: string } | null;
  compliance_status: ComplianceCaseStatus;
  compliance_officer: { id: number; name: string } | null;
  requirements_total: number;
  requirements_approved: number;
  requirements_pending: number;
  requirements_rejected: number;
  deadline: string | null;
}

export interface ComplianceClientDetail {
  client: { id: number; name: string; email: string | null; phone: string | null };
  projects: ComplianceClientProject[];
}

export interface ComplianceRequirement {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  is_mandatory: boolean;
  status: ComplianceRequirementStatus;
  requires_expiry: boolean;
  expires_at: string | null;
  sort_order: number;
  source?: string | null;
}

export interface ComplianceDocumentVersion {
  id: number;
  version_number: number;
  is_current: boolean;
  status: ComplianceDocumentStatus;
  created_at: string;
}

export interface ComplianceDocument {
  id: number;
  original_name: string;
  file_type: string | null;
  file_size: number | null;
  status: ComplianceDocumentStatus;
  expires_at: string | null;
  compliance_requirement_id: number | null;
  versions: ComplianceDocumentVersion[];
}

export interface ComplianceCase {
  id: number;
  status: ComplianceCaseStatus;
  project: {
    id: number;
    name: string;
    reference: string | null;
    status: string;
    client_id: number | null;
    project_manager_id: number | null;
    seller_id: number | null;
    seller: { id: number; name: string; email: string } | null;
  };
  client: { id: number; name: string; email: string | null; phone: string | null } | null;
  compliance_officer: { id: number; name: string; email: string } | null;
  template: { id: number; name: string } | null;
  requirements: ComplianceRequirement[];
  documents?: ComplianceDocument[];
}

export interface ComplianceCaseListItem {
  id: number;
  status: ComplianceCaseStatus;
  project: { id: number; name: string; reference: string | null; status: string };
  client: { id: number; name: string } | null;
  compliance_officer: { id: number; name: string } | null;
  requirements_count: number;
}

export interface ComplianceChecklistItem {
  id: number;
  label: string;
  description: string | null;
  is_checked: boolean;
  checked_at: string | null;
  compliance_requirement_id: number | null;
  sort_order: number;
}

export interface ComplianceComment {
  id: number;
  body: string;
  created_at: string;
  author_admin: { id: number; name: string } | null;
  author_user: { id: number; name: string } | null;
}

export interface ComplianceActivityItem {
  id: number;
  action: string;
  description: string;
  created_at: string;
  actor_admin: { id: number; name: string } | null;
  actor_user: { id: number; name: string } | null;
  old_value?: string | null;
  new_value?: string | null;
}

export interface ComplianceTemplate {
  id: number;
  name: string;
  is_default?: boolean;
}

export interface ComplianceRequirementPayload {
  name: string;
  description?: string | null;
  category?: string | null;
  is_mandatory?: boolean;
  requires_expiry?: boolean;
  expires_at?: string | null;
  sort_order?: number;
}

interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

// ── Read-only project context (Chat/Attachments/Tasks/Deliverables) ────────
// Surfaces data owned by other features inside the Compliance case view —
// see Api\Admin\ComplianceController's projectClientChat/projectAttachments/
// projectTasks/projectDeliverables for the backing endpoints.

export interface ComplianceChatMessage {
  id: number;
  content: string;
  sent_at: string;
  attachment_name?: string | null;
  guest_sender_name?: string | null;
  sender: { id: number; name: string } | null;
  sender_admin: { id: number; name: string } | null;
}

export interface ComplianceProjectAttachment {
  id: number;
  original_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by_admin: { id: number; name: string } | null;
  uploaded_by_user: { id: number; name: string } | null;
}

export type ComplianceTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'ready_for_production' | 'in_production' | 'review' | 'completed' | 'cancelled';

export interface ComplianceProjectTask {
  id: number;
  title: string;
  status: ComplianceTaskStatus;
  priority: string;
  due_date: string | null;
  progress: number;
  assigned_to: { id: number; name: string } | null;
}

export type ComplianceDeliverableStatus = 'draft' | 'submitted' | 'delivered' | 'approved' | 'revision_requested' | 'rejected';

export interface ComplianceDeliverable {
  id: number;
  title: string;
  file_name: string;
  status: ComplianceDeliverableStatus;
  version: number;
  created_at: string;
  uploaded_by: { id: number; name: string } | null;
  task: { id: number; title: string } | null;
}

export interface ComplianceDeliverySubmission {
  id: number;
  file_name: string;
  file_size: number | null;
  delivered_at: string;
  delivered_by_admin: { id: number; name: string } | null;
}

export interface ComplianceTaskComment {
  id: number;
  body: string;
  created_at: string;
  author_admin: { id: number; name: string } | null;
  author_user: { id: number; name: string } | null;
}

export interface ComplianceTaskActivityItem {
  id: number;
  type: string;
  description: string;
  causer_name: string | null;
  created_at: string;
}

export type ComplianceInvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface ComplianceInvoicePayment {
  id: number;
  amount: string;
  currency: string;
  method: string;
  status: string;
  payment_date: string | null;
}

export interface ComplianceInvoice {
  id: number;
  invoice_number: string;
  status: ComplianceInvoiceStatus;
  currency: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  paid_amount: string;
  due_date: string | null;
  sent_at: string | null;
  payments: ComplianceInvoicePayment[];
}

export interface ComplianceTeamMember {
  id: number;
  role_in_project: string;
  user: { id: number; name: string; email: string; role_type: string } | null;
}

export interface ComplianceTimesheet {
  id: number;
  log_date: string;
  hours_logged: string;
  status: string;
  notes: string | null;
  task: { id: number; title: string } | null;
  user: { id: number; name: string } | null;
}

export interface ComplianceProjectComment {
  id: number;
  body: string;
  created_at: string;
  author_admin: { id: number; name: string } | null;
  author_user: { id: number; name: string } | null;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface ComplianceFollowUp {
  id: number;
  type: string;
  scheduled_at: string;
  completed_at: string | null;
  notes: string | null;
  status: string;
  assigned_to: { id: number; name: string } | null;
}

export interface ComplianceLead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: string;
  status: LeadStatus;
  priority: string;
  estimated_value: string | null;
  deal_reference: string | null;
  fulfillment_status: string | null;
  won_at: string | null;
  converted_at: string | null;
  lost_reason: string | null;
  notes: string | null;
  assigned_to: { id: number; name: string; email: string } | null;
  follow_ups: ComplianceFollowUp[];
}

export const adminComplianceService = {
  dashboard: {
    get: async (): Promise<ComplianceDashboard> => {
      const res = await api.get('/admin/compliance/dashboard');
      return res.data.data;
    },
  },

  clients: {
    list: async (params?: { search?: string; status?: string }): Promise<ComplianceClientListItem[]> => {
      const res = await api.get('/admin/compliance/clients', { params });
      return res.data.data;
    },
    get: async (clientId: number): Promise<ComplianceClientDetail> => {
      const res = await api.get(`/admin/compliance/clients/${clientId}`);
      return res.data.data;
    },
  },

  cases: {
    list: async (params?: { status?: string; compliance_officer_id?: number; per_page?: number }): Promise<Paginated<ComplianceCaseListItem>> => {
      const res = await api.get('/admin/compliance/cases', { params });
      return res.data.data;
    },
    get: async (id: number): Promise<ComplianceCase> => {
      const res = await api.get(`/admin/compliance/cases/${id}`);
      return res.data.data;
    },
    getByProject: async (projectId: number): Promise<ComplianceCase> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/case`);
      return res.data.data;
    },
    assignOfficer: async (id: number, complianceOfficerId: number | null): Promise<ComplianceCase> => {
      const res = await api.patch(`/admin/compliance/cases/${id}/officer`, { compliance_officer_id: complianceOfficerId });
      return res.data.data;
    },
    updateStatus: async (id: number, action: 'mark_under_review' | 'on_hold' | 'resume' | 'reject', reason?: string): Promise<ComplianceCase> => {
      const res = await api.patch(`/admin/compliance/cases/${id}/status`, { action, reason });
      return res.data.data;
    },
  },

  requirements: {
    add: async (caseId: number, payload: ComplianceRequirementPayload): Promise<ComplianceRequirement> => {
      const res = await api.post(`/admin/compliance/cases/${caseId}/requirements`, payload);
      return res.data.data;
    },
    update: async (id: number, payload: Partial<ComplianceRequirementPayload>): Promise<ComplianceRequirement> => {
      const res = await api.put(`/admin/compliance/requirements/${id}`, payload);
      return res.data.data;
    },
    remove: async (id: number): Promise<void> => {
      await api.delete(`/admin/compliance/requirements/${id}`);
    },
  },

  documents: {
    upload: async (caseId: number, file: File, complianceRequirementId?: number | null): Promise<ComplianceDocument> => {
      const form = new FormData();
      form.append('file', file);
      if (complianceRequirementId) form.append('compliance_requirement_id', String(complianceRequirementId));
      const res = await api.post(`/admin/compliance/cases/${caseId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    addVersion: async (documentId: number, file: File): Promise<ComplianceDocument> => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/admin/compliance/documents/${documentId}/versions`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    download: async (documentId: number, fileName: string): Promise<void> => {
      const res = await api.get(`/admin/compliance/documents/${documentId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    review: async (documentId: number, action: 'approve' | 'reject' | 'request_resubmission' | 'set_expiry', opts?: { reason?: string; expires_at?: string }): Promise<ComplianceDocument> => {
      const res = await api.patch(`/admin/compliance/documents/${documentId}/review`, { action, ...opts });
      return res.data.data;
    },
  },

  checklist: {
    list: async (caseId: number): Promise<ComplianceChecklistItem[]> => {
      const res = await api.get(`/admin/compliance/cases/${caseId}/checklist`);
      return res.data.data;
    },
    generate: async (caseId: number): Promise<ComplianceChecklistItem[]> => {
      const res = await api.post(`/admin/compliance/cases/${caseId}/checklist/generate`);
      return res.data.data;
    },
    add: async (caseId: number, payload: { label: string; description?: string; sort_order?: number }): Promise<ComplianceChecklistItem> => {
      const res = await api.post(`/admin/compliance/cases/${caseId}/checklist`, payload);
      return res.data.data;
    },
    toggle: async (itemId: number): Promise<ComplianceChecklistItem> => {
      const res = await api.patch(`/admin/compliance/checklist-items/${itemId}/toggle`);
      return res.data.data;
    },
  },

  comments: {
    list: async (caseId: number): Promise<ComplianceComment[]> => {
      const res = await api.get(`/admin/compliance/cases/${caseId}/comments`);
      return res.data.data;
    },
    add: async (caseId: number, body: string): Promise<ComplianceComment> => {
      const res = await api.post(`/admin/compliance/cases/${caseId}/comments`, { body });
      return res.data.data;
    },
    remove: async (commentId: number): Promise<void> => {
      await api.delete(`/admin/compliance/comments/${commentId}`);
    },
  },

  activity: {
    list: async (caseId: number): Promise<ComplianceActivityItem[]> => {
      const res = await api.get(`/admin/compliance/cases/${caseId}/activity`);
      return res.data.data;
    },
  },

  templates: {
    list: async (): Promise<ComplianceTemplate[]> => {
      const res = await api.get('/admin/compliance/templates');
      return res.data.data;
    },
    create: async (payload: { name: string }): Promise<ComplianceTemplate> => {
      const res = await api.post('/admin/compliance/templates', payload);
      return res.data.data;
    },
    update: async (id: number, payload: { name?: string }): Promise<ComplianceTemplate> => {
      const res = await api.put(`/admin/compliance/templates/${id}`, payload);
      return res.data.data;
    },
    remove: async (id: number): Promise<void> => {
      await api.delete(`/admin/compliance/templates/${id}`);
    },
    setDefault: async (id: number): Promise<ComplianceTemplate> => {
      const res = await api.patch(`/admin/compliance/templates/${id}/default`);
      return res.data.data;
    },
  },

  project: {
    chat: async (projectId: number): Promise<{ messages: ComplianceChatMessage[] }> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/client-chat`);
      return res.data.data;
    },
    chatExport: async (projectId: number): Promise<void> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/client-chat/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-project-${projectId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    attachments: async (projectId: number): Promise<ComplianceProjectAttachment[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/attachments`);
      return res.data.data;
    },
    attachmentDownload: async (attachmentId: number, fileName: string): Promise<void> => {
      const res = await api.get(`/admin/compliance/attachments/${attachmentId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    tasks: async (projectId: number): Promise<ComplianceProjectTask[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/tasks`);
      return res.data.data;
    },
    taskDetail: async (taskId: number): Promise<{ comments: ComplianceTaskComment[]; activities: ComplianceTaskActivityItem[] }> => {
      const res = await api.get(`/admin/compliance/tasks/${taskId}/detail`);
      return res.data.data;
    },
    deliverables: async (projectId: number): Promise<{ deliverables: ComplianceDeliverable[]; delivery_history: ComplianceDeliverySubmission[] }> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/deliverables`);
      return res.data.data;
    },
    deliveryDownload: async (deliveryId: number, fileName: string): Promise<void> => {
      const res = await api.get(`/admin/compliance/deliveries/${deliveryId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    billing: async (projectId: number): Promise<ComplianceInvoice[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/billing`);
      return res.data.data;
    },
    team: async (projectId: number): Promise<ComplianceTeamMember[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/team`);
      return res.data.data;
    },
    comments: async (projectId: number): Promise<ComplianceProjectComment[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/comments`);
      return res.data.data;
    },
    timesheets: async (projectId: number): Promise<ComplianceTimesheet[]> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/timesheets`);
      return res.data.data;
    },
    lead: async (projectId: number): Promise<ComplianceLead | null> => {
      const res = await api.get(`/admin/compliance/projects/${projectId}/lead`);
      return res.data.data;
    },
  },
};

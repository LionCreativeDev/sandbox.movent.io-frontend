import api from '@/lib/axios';

// The IT services a company offers its portal clients.
//
// Company Admin only — what a company sells is the owner's decision, so unlike
// brands there is no /user/* counterpart and no base() switch here.

export interface CompanyServiceRow {
  // null for a catalogue service this company has never saved — the screen
  // shows all 37 built-ins as switched-off placeholders, and the first save
  // creates the row (see Api\Admin\CompanyServiceController::index()).
  id: number | null;
  slug: string | null;
  name: string;
  short_description: string | null;
  icon_url: string | null;
  /** The catalogue's own emoji, used whenever no icon has been uploaded. */
  icon_emoji: string;
  group: string;
  starting_price: number | null;
  is_enabled: boolean;
  is_featured: boolean;
  display_order: number;
  is_custom: boolean;
  catalog_default: { name: string; description: string } | null;
}

export interface CompanyServiceIndex {
  services: CompanyServiceRow[];
  enabled_count: number;
  currency: string;
  /** False when the company never bought Client Portal — nothing will show. */
  portal_module_active: boolean;
}

export interface CompanyServicePayload {
  slug?: string | null;
  name: string;
  short_description?: string | null;
  starting_price?: number | null;
  is_enabled?: boolean;
  is_featured?: boolean;
  display_order?: number;
  icon?: File | null;
}

// multipart because of the icon. Booleans go over as 1/0 — PHP reads the
// string "false" as truthy, so sending the raw word would flip every disabled
// service back on. Same handling as brandService.
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const toFormData = (payload: CompanyServicePayload): FormData => {
  const fd = new FormData();
  fd.append('name', payload.name);
  if (payload.slug) fd.append('slug', payload.slug);
  if (payload.short_description !== undefined) fd.append('short_description', payload.short_description ?? '');
  if (payload.starting_price !== undefined && payload.starting_price !== null) {
    fd.append('starting_price', String(payload.starting_price));
  }
  if (payload.is_enabled !== undefined) fd.append('is_enabled', payload.is_enabled ? '1' : '0');
  if (payload.is_featured !== undefined) fd.append('is_featured', payload.is_featured ? '1' : '0');
  if (payload.display_order !== undefined) fd.append('display_order', String(payload.display_order));
  if (payload.icon) fd.append('icon', payload.icon);
  return fd;
};

const list = async (companyId?: number): Promise<CompanyServiceIndex> => {
  const res = await api.get('/admin/services', { params: companyId ? { company_id: companyId } : {} });
  return res.data.data;
};

// Creates the row, or updates it when this company already saved that
// catalogue slug — the server resolves which, so the screen's "enable" click
// works whichever state the service was in.
const save = async (payload: CompanyServicePayload, companyId?: number): Promise<CompanyServiceRow> => {
  const fd = toFormData(payload);
  if (companyId) fd.append('company_id', String(companyId));
  const res = await api.post('/admin/services', fd, MULTIPART);
  return res.data.data;
};

const update = async (id: number, payload: CompanyServicePayload): Promise<CompanyServiceRow> => {
  const res = await api.post(`/admin/services/${id}`, toFormData(payload), MULTIPART);
  return res.data.data;
};

const toggleStatus = async (id: number): Promise<CompanyServiceRow> => {
  const res = await api.patch(`/admin/services/${id}/toggle-status`);
  return res.data.data;
};

const remove = async (id: number): Promise<void> => {
  await api.delete(`/admin/services/${id}`);
};

// The whole list in one call, so dragging one card doesn't fire a request per
// row it moved past.
const reorder = async (order: number[], companyId?: number): Promise<void> => {
  await api.put('/admin/services/reorder', { order, ...(companyId ? { company_id: companyId } : {}) });
};

export interface ServiceRequestRow {
  id: number;
  client: { id: number; name: string; email: string | null } | null;
  service_name: string;
  intent: 'quote' | 'new_project' | 'consultation';
  intent_label: string;
  message: string | null;
  preferred_date: string | null;
  status: 'new' | 'in_progress' | 'closed';
  lead_id: number | null;
  created_at: string;
}

const requests = async (status?: string): Promise<{ requests: ServiceRequestRow[]; new_count: number }> => {
  const res = await api.get('/admin/service-requests', { params: status ? { status } : {} });
  return res.data.data;
};

const updateRequest = async (id: number, status: string): Promise<void> => {
  await api.patch(`/admin/service-requests/${id}`, { status });
};

export const companyServiceService = {
  list, save, update, toggleStatus, remove, reorder, requests, updateRequest,
};

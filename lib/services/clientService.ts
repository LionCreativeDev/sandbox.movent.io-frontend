import clientApi from '@/lib/clientAxios';

export interface ClientProfile {
  name: string;
  company_name?: string | null;
  /** Contact email — editable. Saving a new one also becomes the login email. */
  email: string;
  phone?: string | null;
  address?: string | null;
  /** Login email (users.email). Read-only: it follows the contact email. */
  login_email: string;
}

export interface ClientProfilePayload {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  /** Required only when `email` differs from the current login email. */
  current_password?: string;
}

// ── Payment Assistant ────────────────────────────────────────────────────────
// The rule-based invoice payment chat. Every call returns the WHOLE assistant
// state rebuilt server-side — the browser holds no company, invoice or amount
// of its own, because none of those may be decided here.

export interface AssistantInvoice {
  id: number;
  invoice_number: string;
  company_name?: string | null;
  currency?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  total_amount: number;
  paid_amount: number;
  amount_due: number;
  status: string;
  is_payable: boolean;
}

export interface AssistantCompany {
  company_id: number;
  client_id: number;
  company_name?: string | null;
  unpaid_count: number;
}

export interface AssistantState {
  state:
    | 'company_selection'
    | 'waiting_for_invoice'
    | 'invoice_found'
    | 'confirming'
    | 'processing'
    | 'payment_success'
    | 'payment_failed';
  company: { id: number; name?: string | null } | null;
  companies: AssistantCompany[];
  invoice: AssistantInvoice | null;
  message: string | null;
  already_paid?: boolean;
  payment?: { amount: number; paid_at?: string | null; reference?: string | null } | null;
  /** Present after confirm(): the invoice to run the EXISTING checkout against. */
  checkout_invoice_id?: number;
  amount_due?: number;
  /** Cards already on file for this company. Absent when there are none. */
  saved_methods?: { id: number; label: string; is_default: boolean }[];
  /** Present after pay-saved: whether the charge settled. */
  paid?: boolean;
}

export interface SavedCard {
  id: number;
  company_id: number;
  gateway: string;
  /** "Visa •••• 4242" — the only description of a card that ever leaves the API. */
  label: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  is_default: boolean;
  is_expired: boolean;
}

export interface SavedCardCompany {
  company_id: number;
  company_name?: string | null;
  /** False when this company's gateway cannot vault a card — hides the Add button. */
  can_add: boolean;
  /**
   * True when the card can be added without leaving the portal. False falls
   * back to the gateway's hosted page — which is what every company did before
   * inline setup existed, so it is a fallback, not a failure.
   */
  can_add_inline?: boolean;
  payment_methods: SavedCard[];
}

export const clientService = {
  login: async (email: string, password: string) => {
    const res = await clientApi.post('/client/login', { email, password });
    return res.data.data;
  },
  logout: async () => {
    await clientApi.post('/client/logout');
  },
  me: async () => {
    const res = await clientApi.get('/client/me');
    return res.data.data;
  },
  dashboard: async () => {
    const res = await clientApi.get('/client/dashboard');
    return res.data.data;
  },
  assistant: {
    open: async (): Promise<AssistantState> =>
      (await clientApi.get('/client/payment-assistant')).data.data,
    selectCompany: async (companyId: number): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/company', { company_id: companyId })).data.data,
    changeCompany: async (): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/change-company')).data.data,
    send: async (text: string): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/message', { text })).data.data,
    selectInvoice: async (invoiceId: number): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/invoice', { invoice_id: invoiceId })).data.data,
    // Explicit consent step. Does NOT charge — it returns the invoice to run the
    // existing gateway checkout against.
    confirm: async (): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/confirm')).data.data,
    // The one call that moves money. Separate and explicit by design — confirm()
    // above only offers the card.
    payWithSaved: async (paymentMethodId: number): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/pay-saved', { payment_method_id: paymentMethodId })).data.data,
    reset: async (): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/reset')).data.data,
    // Clear History — a conversation RESET, not a delete. The server rotates
    // this session's conversation id; the permanent activity trail
    // (system_audit_logs, action payment_assistant.*) is untouched, as are
    // invoices, payments, receipts and documents. Returns the state a fresh
    // conversation starts in, which this page renders into an empty thread.
    clearHistory: async (): Promise<AssistantState> =>
      (await clientApi.post('/client/payment-assistant/clear')).data.data,
    unpaid: async (): Promise<{ invoices: AssistantInvoice[] }> =>
      (await clientApi.get('/client/payment-assistant/unpaid')).data.data,
  },

  paymentMethods: {
    list: async (): Promise<{ companies: SavedCardCompany[] }> =>
      (await clientApi.get('/client/payment-methods')).data.data,
    // Opens the gateway's hosted card page. Charges nothing.
    startSetup: async (companyId: number): Promise<{ navigation: 'redirect' | 'post_form'; action: string; fields?: Record<string, string> }> =>
      (await clientApi.post('/client/payment-methods/setup', { company_id: companyId })).data.data,
    complete: async (companyId: number, sessionId: string): Promise<{ payment_method: SavedCard }> =>
      (await clientApi.post('/client/payment-methods/complete', { company_id: companyId, session_id: sessionId })).data.data,

    // ── Adding a card without leaving the portal ─────────────────────────────
    //
    // Same end state as startSetup/complete above — a card vaulted against this
    // client's gateway customer, chargeable later — but the fields are Stripe
    // Elements' own cross-origin iframe instead of Stripe's hosted page.
    //
    // What comes back from inlineSetup() is a PUBLISHABLE key and a single-use
    // client secret: enough for that iframe to collect and authorise one card,
    // and not enough to charge anything. The card number is typed into Stripe's
    // frame and submitted by Stripe's script — it never enters this app's DOM,
    // its JavaScript or its network traffic, and nothing here ever holds it.
    inlineSetup: async (companyId: number): Promise<{
      publishable_key: string;
      client_secret: string;
      setup_intent_id: string;
    }> =>
      (await clientApi.post('/client/payment-methods/inline-setup', { company_id: companyId })).data.data,

    // Saves the card the setup left on file. The server asks Stripe whether the
    // setup actually succeeded before storing anything, so this call reports an
    // outcome rather than deciding one.
    inlineComplete: async (companyId: number, setupIntentId: string): Promise<{ payment_method: SavedCard }> =>
      (await clientApi.post('/client/payment-methods/inline-complete', {
        company_id: companyId,
        setup_intent_id: setupIntentId,
      })).data.data,

    setDefault: async (id: number) =>
      (await clientApi.post(`/client/payment-methods/${id}/default`)).data,
    remove: async (id: number) =>
      (await clientApi.delete(`/client/payment-methods/${id}`)).data,
  },

  /**
   * A document's file as an object URL, for showing a payment receipt on screen
   * instead of only downloading it.
   *
   * Reuses the Documents module's OWN download endpoint — there is no second
   * API for this — and re-types the blob to image/svg+xml so the browser is
   * told exactly what it is rather than depending on what the file server
   * guessed or on the attachment disposition that endpoint sends. Callers own
   * the returned URL and must revokeObjectURL it.
   */
  documentImageUrl: async (documentId: number): Promise<string> => {
    const res = await clientApi.get(`/client/documents/${documentId}/download`, { responseType: 'blob' });
    return URL.createObjectURL(new Blob([res.data], { type: 'image/svg+xml' }));
  },

  profile: async (): Promise<ClientProfile> => {
    const res = await clientApi.get('/client/profile');
    return res.data.data;
  },
  // Saving a changed `email` moves the LOGIN email with it, which is why
  // current_password is required in that case — see
  // Api\Client\ProfileController::update().
  updateProfile: async (data: ClientProfilePayload) => {
    const res = await clientApi.put('/client/profile', data);
    return res.data as { message?: string; data: ClientProfile & { email_changed: boolean } };
  },
  requestService: async (data: { service_key: string; notes?: string }) => {
    const res = await clientApi.post('/client/dashboard/request-service', data);
    return res.data;
  },
  projects: async (params?: Record<string, string>) => {
    const res = await clientApi.get('/client/projects', { params });
    return res.data.data;
  },
  project: async (id: number) => {
    const res = await clientApi.get(`/client/projects/${id}`);
    return res.data.data;
  },
  downloadProjectDelivery: async (id: number, fileName: string) => {
    const res = await clientApi.get(`/client/projects/${id}/delivery/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  invoices: async (params?: Record<string, string>) => {
    const res = await clientApi.get('/client/invoices', { params });
    return res.data.data;
  },
  invoice: async (id: number) => {
    const res = await clientApi.get(`/client/invoices/${id}`);
    return res.data.data;
  },
  invoiceGateways: async (id: number) => {
    const res = await clientApi.get(`/client/invoices/${id}/gateways`);
    return res.data.data;
  },
  payInvoice: async (id: number, data: { method: string; gateway_ref?: string; notes?: string }) => {
    const res = await clientApi.post(`/client/invoices/${id}/pay`, data);
    return res.data;
  },
  initiateGatewayCheckout: async (id: number, gateway: string) => {
    const res = await clientApi.post(`/client/invoices/${id}/gateways/${gateway}/initiate`);
    return res.data.data as { navigation: 'redirect' | 'post_form'; action: string; fields: Record<string, string> };
  },
  gatewayReturnStatus: async (id: number, gateway: string, query: string) => {
    const res = await clientApi.get(`/client/invoices/${id}/gateways/${gateway}/return${query}`);
    return res.data.data as { status: string };
  },
  payments: async () => {
    const res = await clientApi.get('/client/payments');
    return res.data.data;
  },
  documents: async (params?: Record<string, string>) => {
    const res = await clientApi.get('/client/documents', { params });
    return res.data.data;
  },
  documentDownloadUrl: (id: number) => {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    return `${base}/client/documents/${id}/download`;
  },
  // Project "Files" tab — a document (Client\DocumentController), a project
  // attachment (Client\AttachmentController), and a delivery submission
  // (Client\ProjectController::downloadDeliverySubmission — one row per
  // time the project's final package was delivered, see
  // ProjectDeliverySubmission) live on different tables/routes but are
  // merged into one `files` list by Client\ProjectController::show() /
  // Client\DocumentController::index(), each tagged with which it is.
  downloadProjectFile: async (source: 'document' | 'attachment' | 'delivery', id: number, fileName: string) => {
    const path = source === 'document' ? `/client/documents/${id}/download`
      : source === 'delivery' ? `/client/delivery-submissions/${id}/download`
      : `/client/attachments/${id}/download`;
    const res = await clientApi.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  // The account-level Sales Chat (chatMessages/chatReply) was removed on
  // 2026-09-11 along with Api\Client\ChatController and the /client/chat page:
  // a sales conversation belongs to the LEAD stage, and by the time someone is
  // a Client they have a Project, whose own chat below is the one that matters.
  //
  // Per-PROJECT chat — a separate conversation for each project, between the
  // client, that project's own Seller and Company Admin (see
  // Api\Client\ProjectChatController). Unrelated to the account-level Sales
  // Chat above.
  projectChat: async (projectId: number) => {
    const res = await clientApi.get(`/client/projects/${projectId}/chat`);
    return res.data.data;
  },
  // `data` carries content/file plus any mentions[] entries — see
  // Api\Client\ProjectChatController::store().
  projectChatSend: async (projectId: number, data: FormData) => {
    const res = await clientApi.post(`/client/projects/${projectId}/chat`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  projectChatAttachment: async (projectId: number, messageId: number, fileName: string) => {
    const res = await clientApi.get(`/client/projects/${projectId}/chat/${messageId}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },
  // Own message only — enforced server-side too.
  projectChatDelete: async (projectId: number, messageId: number) => {
    await clientApi.delete(`/client/projects/${projectId}/chat/${messageId}`);
  },
  support: async () => {
    const res = await clientApi.get('/client/support');
    return res.data.data;
  },
  createTicket: async (data: FormData) => {
    const res = await clientApi.post('/client/support', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  ticket: async (id: number) => {
    const res = await clientApi.get(`/client/support/${id}`);
    return res.data.data;
  },
  ticketReply: async (id: number, data: FormData) => {
    const res = await clientApi.post(`/client/support/${id}/reply`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  // Authenticated blob download for BOTH storage types — a Drive-backed
  // attachment (large file, company had Google Drive connected) has no
  // public attachment_url at all, same pattern as downloadProjectFile() above.
  ticketAttachmentDownload: async (id: number, fileName: string) => {
    const res = await clientApi.get(`/client/support/${id}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },
  ticketReplyAttachmentDownload: async (id: number, replyId: number, fileName: string) => {
    const res = await clientApi.get(`/client/support/${id}/replies/${replyId}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },
  reportProjects: async () => {
    const res = await clientApi.get('/client/reports/projects');
    return res.data.data;
  },
  reportInvoices: async () => {
    const res = await clientApi.get('/client/reports/invoices');
    return res.data.data;
  },
};

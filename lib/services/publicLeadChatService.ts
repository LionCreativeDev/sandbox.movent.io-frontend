import axios from 'axios';

// The Lead-facing Sales Chat page (frontend/app/sales-chat/[token]/page.tsx),
// opened straight from the invite email with no login. Plain axios with the
// token baked into the URL — same pattern as publicInvoiceChatService, since
// there is no Sanctum session or cookie to attach here either.
//
// The token is the only credential, and it never identifies a lead to the
// client: the backend resolves token -> lead -> that lead's own conversation
// and returns nothing else. See app/Http/Controllers/Api/PublicLeadChatController.php.
const base = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface LeadChatMessage {
  id: number;
  content: string | null;
  sent_at: string;
  sender_name: string;
  /** True for the Lead's own messages — the only ones they may delete. */
  is_guest: boolean;
  attachment_name?: string | null;
}

export interface LeadChatResponse {
  lead_name: string;
  company_name: string;
  seller_name: string | null;
  messages: LeadChatMessage[];
}

export const publicLeadChatService = {
  get: async (token: string): Promise<LeadChatResponse> => {
    const res = await axios.get(`${base}/public/sales-chat/${token}`);
    return res.data.data;
  },

  send: async (token: string, content: string, file?: File | null): Promise<LeadChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      form.append('file', file);
      const res = await axios.post(`${base}/public/sales-chat/${token}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await axios.post(`${base}/public/sales-chat/${token}/messages`, { content });
    return res.data.data;
  },

  deleteMessage: async (token: string, messageId: number): Promise<void> => {
    await axios.delete(`${base}/public/sales-chat/${token}/messages/${messageId}`);
  },

  downloadAttachment: async (token: string, messageId: number, fileName: string): Promise<void> => {
    const res = await axios.get(`${base}/public/sales-chat/${token}/messages/${messageId}/attachment`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

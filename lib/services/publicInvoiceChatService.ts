import axios from 'axios';

// "Chat with Seller" on the public, no-login invoice payment page
// (frontend/app/pay/invoice/[token]/page.tsx) — plain axios with the token
// baked into the URL, same pattern that page already uses for its own
// public/invoices/{token} calls (no Sanctum/session, nothing to attach).
const base = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface PublicChatMessage {
  id: number;
  content: string | null;
  sent_at: string;
  sender_name: string;
  is_guest: boolean;
  attachment_name?: string | null;
}

export interface PublicChatResponse {
  available: boolean;
  seller_name: string | null;
  messages: PublicChatMessage[];
}

export const publicInvoiceChatService = {
  get: async (token: string): Promise<PublicChatResponse> => {
    const res = await axios.get(`${base}/public/invoices/${token}/chat`);
    return res.data.data;
  },
  send: async (token: string, content: string, file?: File | null): Promise<PublicChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      form.append('file', file);
      const res = await axios.post(`${base}/public/invoices/${token}/chat/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await axios.post(`${base}/public/invoices/${token}/chat/messages`, { content });
    return res.data.data;
  },
  deleteMessage: async (token: string, messageId: number): Promise<void> => {
    await axios.delete(`${base}/public/invoices/${token}/chat/messages/${messageId}`);
  },
  downloadAttachment: async (token: string, messageId: number, fileName: string): Promise<void> => {
    const res = await axios.get(`${base}/public/invoices/${token}/chat/messages/${messageId}/attachment`, { responseType: 'blob' });
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

import clientApi from '@/lib/clientAxios';

// ── Client <-> Seller direct conversation ────────────────────────────────────
//
// The CLIENT end of the app's existing per-client Direct Chat
// (chat_threads.thread_type='client'). The seller reads and replies to the very
// same rows from their Client detail page — this is not a separate inbox.
//
// AI Assistance only opens the conversation; from then on these endpoints serve
// it and the assistant is not a participant. Nothing here decides who may read
// what: every call is re-authorized server-side against the portal session
// (see Api\Client\SellerChatController).

/** Who the client is talking to. Never "AI Assistance", never "Unknown". */
export interface SellerChatPerson {
  id: number;
  name: string;
  /** "Seller", "Project Manager", or a custom label from the CRM. */
  role: string;
}

export interface SellerChatMessage {
  id: number;
  content: string;
  /** True when the client sent it — drives which side of the thread it sits on. */
  mine: boolean;
  sender: string | null;
  sender_role: string | null;
  /** The one-time opener the conversation starts with. Still a seller message. */
  automated: boolean;
  sent_at: string | null;
}

export interface SellerChatSummary {
  thread_id: number;
  company_name?: string | null;
  with: SellerChatPerson[];
  title: string;
  role: string;
  last_message_at: string | null;
  unread: number;
}

export interface SellerChatThread {
  thread_id: number;
  title: string;
  role: string;
  company_name?: string | null;
  with: SellerChatPerson[];
  messages: SellerChatMessage[];
}

export const clientSellerChatService = {
  /** Every conversation this login has, newest activity first. */
  list: async (): Promise<{ conversations: SellerChatSummary[] }> =>
    (await clientApi.get('/client/seller-chat')).data.data,

  /** One conversation. Opening it also marks it read server-side. */
  show: async (threadId: number): Promise<SellerChatThread> =>
    (await clientApi.get(`/client/seller-chat/${threadId}`)).data.data,

  send: async (threadId: number, content: string): Promise<{ message: SellerChatMessage }> =>
    (await clientApi.post(`/client/seller-chat/${threadId}/messages`, { content })).data.data,
};

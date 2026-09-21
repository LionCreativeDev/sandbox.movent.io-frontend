import api from '@/lib/axios';
import { getAuthType } from '@/lib/auth';

// ── "AI Assistance" → Client Messages, staff and Company Admin side ──────────
//
// Reading and replying deliberately go through the EXISTING direct-chat
// endpoints — the ones that already serve the Direct Chat panel on the Client
// detail page (Api\User\ClientChatController / Api\Admin\ClientChatController).
// The widget is a second door onto that conversation, never a second inbox
// with its own storage or its own rules.
//
// Only the "which conversations are mine" lookup is new, and it is what decides
// whether the widget renders at all: a seller who has never been contacted gets
// visible:false and sees no floating button.
//
// One service for both portals: the two backends return the same shapes and
// only the prefix differs, chosen from the session's own auth_type rather than
// passed in by a caller.

export interface StaffConversation {
  thread_id: number;
  client_id: number;
  client_name: string;
  company_name?: string | null;
  unread: number;
  last_message?: string | null;
  last_at?: string | null;
}

export interface StaffConversationList {
  /** False → render nothing. No client has started a conversation with this user. */
  visible: boolean;
  conversations: StaffConversation[];
  unread_total: number;
}

/** A message as the existing direct-chat endpoints return it. */
export interface StaffChatMessage {
  id: number;
  sender_id: number | null;
  sender_admin_id: number | null;
  content: string;
  message_type: string;
  sent_at: string | null;
  sender?: { id: number; name: string } | null;
  senderAdmin?: { id: number; name: string } | null;
}

const isAdmin = () => getAuthType() === 'admin';
const prefix = () => (isAdmin() ? '/admin' : '/user');

export const staffAssistantService = {
  /** Which client-initiated conversations this session may see. */
  conversations: async (): Promise<StaffConversationList> =>
    (await api.get(`${prefix()}/assistant/conversations`)).data.data,

  /**
   * Clear the unread badge, and get the refreshed list back in the same call.
   *
   * Staff only: a Company Admin has no chat_participants row, so there is no
   * last_read_at to write and no unread number on that side to clear. Calling
   * it from an Admin session is a no-op that resolves to the current list.
   */
  markRead: async (threadId?: number): Promise<StaffConversationList> => {
    if (isAdmin()) {
      return (await api.get('/admin/assistant/conversations')).data.data;
    }

    return (await api.post('/user/assistant/read', threadId ? { thread_id: threadId } : {})).data.data;
  },

  /** The existing direct-chat read endpoint — same rows the Client page shows. */
  messages: async (clientId: number, threadId: number): Promise<StaffChatMessage[]> =>
    (await api.get(`${prefix()}/clients/${clientId}/direct-chat/${threadId}/messages`)).data.data,

  /** The existing direct-chat reply endpoint, which also notifies the client. */
  reply: async (clientId: number, threadId: number, content: string): Promise<StaffChatMessage> =>
    (await api.post(`${prefix()}/clients/${clientId}/direct-chat/${threadId}/reply`, { content })).data.data,

  /** True when the signed-in session is a Company Admin — drives "mine" on a bubble. */
  isAdminSession: isAdmin,
};

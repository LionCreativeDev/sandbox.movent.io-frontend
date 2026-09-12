import api from '@/lib/axios';
import { ChatMessage } from './adminProjectService';

export interface ProjectMessengerParticipant {
  user_id: number;
  name: string | null;
  role: string | null;
  // Only present on the User-guard show() — exactly who send()'s
  // isProjectPmUser() would treat as this project's PM (not a role_type
  // guess). Drives a Seller's @mention suggestions (PM only).
  is_project_pm?: boolean;
  // User-guard show() only. can_message_client: this participant's plain,
  // untagged message reaches the project's client (see
  // Api\User\ProjectMessengerController::sellerMayAddressClient()).
  // can_manage: whether the CALLER may toggle that or remove them — false for
  // everyone an Upseller didn't add themselves (the PM, the team, the client);
  // always true for a PM/overseer, who is unrestricted.
  can_message_client?: boolean;
  can_manage?: boolean;
}

export interface ProjectMessengerThread {
  id: number;
  visibility: 'internal' | 'seller_facing' | 'client_facing' | null;
  participants: ProjectMessengerParticipant[];
  // Only present on the User-guard show() (Admin has no chat_participants
  // row of its own to compare a mute state against).
  is_muted?: boolean;
}

export interface ProjectMessengerEligibleUser {
  id: number;
  name: string;
  role_type: string;
  is_seller: boolean;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// User-side project chat — ONE thread per project (no more groups/direct
// chats — see Api\User\ProjectMessengerController and ProjectChatService).
export const userProjectMessengerService = {
  // is_upseller — this project's own Seller managing its chat roster. Their
  // picker offers company Sellers only, and only they get the per-Seller
  // "can message client" toggle (see setParticipantClientAccess below).
  show: async (projectId: number): Promise<{ is_pm: boolean; is_literal_pm: boolean; can_manage_participants: boolean; is_upseller: boolean; thread: ProjectMessengerThread }> =>
    (await api.get(`/user/projects/${projectId}/messenger`)).data.data,

  eligibleParticipants: async (projectId: number): Promise<ProjectMessengerEligibleUser[]> =>
    (await api.get(`/user/projects/${projectId}/messenger/eligible-participants`)).data.data,

  // This project's own Seller only — every active Project Manager at the
  // company, whether or not they're already tied to this project (see
  // Api\User\ProjectMessengerController::eligiblePms()).
  eligiblePms: async (projectId: number): Promise<{ id: number; name: string }[]> =>
    (await api.get(`/user/projects/${projectId}/messenger/eligible-pms`)).data.data,

  // Adds the PM to the project's team AND this chat, and notifies them of
  // both — see Api\User\ProjectMessengerController::invitePm().
  invitePm: async (projectId: number, userId: number): Promise<void> => {
    await api.post(`/user/projects/${projectId}/messenger/invite-pm`, { user_id: userId });
  },

  // canMessageClient is only honoured when the caller is this project's
  // Upseller adding a Seller — ignored otherwise (see addParticipant()).
  addParticipant: async (projectId: number, userId: number, canMessageClient = false): Promise<void> => {
    await api.post(`/user/projects/${projectId}/messenger/participants`, {
      user_id: userId, can_message_client: canMessageClient,
    });
  },
  removeParticipant: async (projectId: number, userId: number): Promise<void> => {
    await api.delete(`/user/projects/${projectId}/messenger/participants/${userId}`);
  },
  // Grants/revokes one brought-in Seller's ability to message the project's
  // client, without removing them from the chat. Upseller-only, and only for
  // Sellers they added themselves.
  setParticipantClientAccess: async (projectId: number, userId: number, canMessageClient: boolean): Promise<{ can_message_client: boolean }> =>
    (await api.patch(
      `/user/projects/${projectId}/messenger/participants/${userId}/client-access`,
      { can_message_client: canMessageClient },
    )).data.data,
  toggleMute: async (projectId: number): Promise<{ is_muted: boolean }> =>
    (await api.patch(`/user/projects/${projectId}/messenger/mute`)).data.data,

  messages: async (projectId: number): Promise<{ messages: ChatMessage[] }> =>
    (await api.get(`/user/projects/${projectId}/messenger/messages`)).data.data,

  // Whether the message ends up visible to the project's Client is computed
  // server-side from who's sending and whether they @mentioned anyone (see
  // Api\User\ProjectMessengerController::send()) — there's no client-side
  // toggle for it.
  send: async (
    projectId: number, content: string, mentions: number[], file?: File | null
  ): Promise<ChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      mentions.forEach(id => form.append('mentions[]', String(id)));
      form.append('file', file);
      const res = await api.post(`/user/projects/${projectId}/messenger/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await api.post(`/user/projects/${projectId}/messenger/messages`, { content, mentions });
    return res.data.data;
  },

  updateMessage: async (projectId: number, messageId: number, content: string): Promise<ChatMessage> => {
    const res = await api.patch(`/user/projects/${projectId}/messenger/messages/${messageId}`, { content });
    return res.data.data;
  },

  deleteMessage: async (projectId: number, messageId: number): Promise<void> => {
    await api.delete(`/user/projects/${projectId}/messenger/messages/${messageId}`);
  },

  downloadAttachment: async (projectId: number, messageId: number, fileName: string): Promise<void> => {
    const res = await api.get(`/user/projects/${projectId}/messenger/messages/${messageId}/attachment`, { responseType: 'blob' });
    downloadBlob(res.data, fileName);
  },
};

// Admin-side project chat — ONE thread per project. Admin has no
// chat_participants row and sees/manages every project's chat, unrestricted.
// See Api\Admin\ProjectMessengerController.
export const adminProjectMessengerService = {
  show: async (projectId: number): Promise<{ thread: ProjectMessengerThread }> =>
    (await api.get(`/admin/projects/${projectId}/messenger`)).data.data,

  eligibleParticipants: async (projectId: number): Promise<ProjectMessengerEligibleUser[]> =>
    (await api.get(`/admin/projects/${projectId}/messenger/eligible-participants`)).data.data,

  addParticipant: async (projectId: number, userId: number): Promise<void> => {
    await api.post(`/admin/projects/${projectId}/messenger/participants`, { user_id: userId });
  },
  removeParticipant: async (projectId: number, userId: number): Promise<void> => {
    await api.delete(`/admin/projects/${projectId}/messenger/participants/${userId}`);
  },
  muteParticipant: async (projectId: number, userId: number): Promise<{ is_muted: boolean }> =>
    (await api.patch(`/admin/projects/${projectId}/messenger/participants/${userId}/mute`)).data.data,

  messages: async (projectId: number): Promise<{ messages: ChatMessage[] }> =>
    (await api.get(`/admin/projects/${projectId}/messenger/messages`)).data.data,

  // Whether the message ends up visible to the project's Client is computed
  // server-side from whether Company Admin @mentioned anyone (see
  // Api\Admin\ProjectMessengerController::send()) — there's no client-side
  // toggle for it.
  send: async (
    projectId: number, content: string, mentions: number[], file?: File | null
  ): Promise<ChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      mentions.forEach(id => form.append('mentions[]', String(id)));
      form.append('file', file);
      const res = await api.post(`/admin/projects/${projectId}/messenger/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await api.post(`/admin/projects/${projectId}/messenger/messages`, { content, mentions });
    return res.data.data;
  },

  updateMessage: async (projectId: number, messageId: number, content: string): Promise<ChatMessage> => {
    const res = await api.patch(`/admin/projects/${projectId}/messenger/messages/${messageId}`, { content });
    return res.data.data;
  },

  deleteMessage: async (projectId: number, messageId: number): Promise<void> => {
    await api.delete(`/admin/projects/${projectId}/messenger/messages/${messageId}`);
  },

  downloadAttachment: async (projectId: number, messageId: number, fileName: string): Promise<void> => {
    const res = await api.get(`/admin/projects/${projectId}/messenger/messages/${messageId}/attachment`, { responseType: 'blob' });
    downloadBlob(res.data, fileName);
  },
};

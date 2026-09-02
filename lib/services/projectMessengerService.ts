import api from '@/lib/axios';
import { ChatMessage } from './adminProjectService';

export interface ProjectMessengerParticipant {
  user_id: number;
  name: string | null;
  role: string | null;
}

export interface ProjectMessengerLastMessage {
  content: string | null;
  message_type: 'text' | 'file' | 'image' | 'system';
  sender_name: string;
  sent_at: string;
}

export interface ProjectMessengerThread {
  id: number;
  thread_type: 'project_group' | 'project_direct';
  visibility: 'internal' | 'seller_facing' | 'client_facing' | null;
  title: string;
  participants: ProjectMessengerParticipant[];
  last_message_at: string | null;
  last_message?: ProjectMessengerLastMessage | null;
  // Only present on the User-guard list (Admin has no chat_participants row
  // to compare a last-read timestamp against).
  is_muted?: boolean;
  unread_count?: number;
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

// User-side project-wise messenger — groups + direct chats scoped to a
// single project. See Api\User\ProjectMessengerController. Distinct from the
// older, dormant single-thread projectService.chat.* methods.
export const userProjectMessengerService = {
  list: async (projectId: number): Promise<{ is_pm: boolean; threads: ProjectMessengerThread[] }> =>
    (await api.get(`/user/projects/${projectId}/messenger`)).data.data,

  eligibleParticipants: async (projectId: number): Promise<ProjectMessengerEligibleUser[]> =>
    (await api.get(`/user/projects/${projectId}/messenger/eligible-participants`)).data.data,

  createGroup: async (
    projectId: number, title: string, visibility: 'internal' | 'seller_facing' | 'client_facing', participantUserIds: number[]
  ): Promise<{ thread_id: number }> =>
    (await api.post(`/user/projects/${projectId}/messenger/group`, { title, visibility, participant_user_ids: participantUserIds })).data.data,

  createDirect: async (projectId: number, recipientUserId: number): Promise<{ thread_id: number }> =>
    (await api.post(`/user/projects/${projectId}/messenger/direct`, { recipient_user_id: recipientUserId })).data.data,

  addParticipant: async (projectId: number, threadId: number, userId: number): Promise<void> => {
    await api.post(`/user/projects/${projectId}/messenger/${threadId}/participants`, { user_id: userId });
  },
  removeParticipant: async (projectId: number, threadId: number, userId: number): Promise<void> => {
    await api.delete(`/user/projects/${projectId}/messenger/${threadId}/participants/${userId}`);
  },
  toggleMute: async (projectId: number, threadId: number): Promise<{ is_muted: boolean }> =>
    (await api.patch(`/user/projects/${projectId}/messenger/${threadId}/mute`)).data.data,

  messages: async (projectId: number, threadId: number): Promise<{ thread: Partial<ProjectMessengerThread>; messages: ChatMessage[] }> =>
    (await api.get(`/user/projects/${projectId}/messenger/${threadId}/messages`)).data.data,

  send: async (projectId: number, threadId: number, content: string, mentions: number[], file?: File | null): Promise<ChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      mentions.forEach(id => form.append('mentions[]', String(id)));
      form.append('file', file);
      const res = await api.post(`/user/projects/${projectId}/messenger/${threadId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await api.post(`/user/projects/${projectId}/messenger/${threadId}/messages`, { content, mentions });
    return res.data.data;
  },

  updateMessage: async (projectId: number, threadId: number, messageId: number, content: string): Promise<ChatMessage> => {
    const res = await api.patch(`/user/projects/${projectId}/messenger/${threadId}/messages/${messageId}`, { content });
    return res.data.data;
  },

  deleteMessage: async (projectId: number, threadId: number, messageId: number): Promise<void> => {
    await api.delete(`/user/projects/${projectId}/messenger/${threadId}/messages/${messageId}`);
  },

  deleteThread: async (projectId: number, threadId: number): Promise<void> => {
    await api.delete(`/user/projects/${projectId}/messenger/${threadId}`);
  },

  downloadAttachment: async (projectId: number, threadId: number, messageId: number, fileName: string): Promise<void> => {
    const res = await api.get(`/user/projects/${projectId}/messenger/${threadId}/messages/${messageId}/attachment`, { responseType: 'blob' });
    downloadBlob(res.data, fileName);
  },
};

// Admin-side project-wise messenger — Admin has no chat_participants row and
// sees/manages every thread for a project it owns, unrestricted. See
// Api\Admin\ProjectMessengerController.
export const adminProjectMessengerService = {
  list: async (projectId: number): Promise<ProjectMessengerThread[]> =>
    (await api.get(`/admin/projects/${projectId}/messenger`)).data.data,

  eligibleParticipants: async (projectId: number): Promise<ProjectMessengerEligibleUser[]> =>
    (await api.get(`/admin/projects/${projectId}/messenger/eligible-participants`)).data.data,

  createGroup: async (
    projectId: number, title: string, visibility: 'internal' | 'seller_facing' | 'client_facing', participantUserIds: number[]
  ): Promise<{ thread_id: number }> =>
    (await api.post(`/admin/projects/${projectId}/messenger/group`, { title, visibility, participant_user_ids: participantUserIds })).data.data,

  createDirect: async (projectId: number, recipientUserId: number): Promise<{ thread_id: number }> =>
    (await api.post(`/admin/projects/${projectId}/messenger/direct`, { recipient_user_id: recipientUserId })).data.data,

  addParticipant: async (projectId: number, threadId: number, userId: number): Promise<void> => {
    await api.post(`/admin/projects/${projectId}/messenger/${threadId}/participants`, { user_id: userId });
  },
  removeParticipant: async (projectId: number, threadId: number, userId: number): Promise<void> => {
    await api.delete(`/admin/projects/${projectId}/messenger/${threadId}/participants/${userId}`);
  },
  muteParticipant: async (projectId: number, threadId: number, userId: number): Promise<{ is_muted: boolean }> =>
    (await api.patch(`/admin/projects/${projectId}/messenger/${threadId}/participants/${userId}/mute`)).data.data,

  messages: async (projectId: number, threadId: number): Promise<{ thread: Partial<ProjectMessengerThread>; messages: ChatMessage[] }> =>
    (await api.get(`/admin/projects/${projectId}/messenger/${threadId}/messages`)).data.data,

  send: async (projectId: number, threadId: number, content: string, mentions: number[], file?: File | null): Promise<ChatMessage> => {
    if (file) {
      const form = new FormData();
      if (content) form.append('content', content);
      mentions.forEach(id => form.append('mentions[]', String(id)));
      form.append('file', file);
      const res = await api.post(`/admin/projects/${projectId}/messenger/${threadId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    }
    const res = await api.post(`/admin/projects/${projectId}/messenger/${threadId}/messages`, { content, mentions });
    return res.data.data;
  },

  updateMessage: async (projectId: number, threadId: number, messageId: number, content: string): Promise<ChatMessage> => {
    const res = await api.patch(`/admin/projects/${projectId}/messenger/${threadId}/messages/${messageId}`, { content });
    return res.data.data;
  },

  deleteMessage: async (projectId: number, threadId: number, messageId: number): Promise<void> => {
    await api.delete(`/admin/projects/${projectId}/messenger/${threadId}/messages/${messageId}`);
  },

  deleteThread: async (projectId: number, threadId: number): Promise<void> => {
    await api.delete(`/admin/projects/${projectId}/messenger/${threadId}`);
  },

  downloadAttachment: async (projectId: number, threadId: number, messageId: number, fileName: string): Promise<void> => {
    const res = await api.get(`/admin/projects/${projectId}/messenger/${threadId}/messages/${messageId}/attachment`, { responseType: 'blob' });
    downloadBlob(res.data, fileName);
  },
};

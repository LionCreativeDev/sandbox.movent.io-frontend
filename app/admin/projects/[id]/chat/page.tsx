'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import ProjectTabs from '@/components/admin/projects/ProjectTabs';
import { inp, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB, fmtFileSize } from '@/components/admin/projects/shared';
import {
  adminProjectMessengerService, ProjectMessengerThread, ProjectMessengerEligibleUser,
} from '@/lib/services/projectMessengerService';
import { adminProjectService, ChatMessage } from '@/lib/services/adminProjectService';

const AVATAR_PALETTE = [
  { bg: '#e0e7ff', fg: '#4338ca' }, { bg: '#dcfce7', fg: '#15803d' }, { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#fef3c7', fg: '#b45309' }, { bg: '#e0f2fe', fg: '#0369a1' }, { bg: '#f3e8ff', fg: '#7e22ce' },
];
function avatarColors(seed: number) {
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
}
function fmtShort(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}
function lastMessagePreview(lm: ProjectMessengerThread['last_message']): string {
  if (!lm) return 'No messages yet';
  if (lm.content) return lm.content;
  return lm.message_type === 'image' ? '📷 Photo' : '📎 Attachment';
}
const VISIBILITY_LABEL: Record<string, string> = {
  internal: 'Internal', seller_facing: 'Seller-facing', client_facing: 'Client-facing',
};

export default function AdminProjectChatPage() {
  useModuleGuard('projects');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(id);

  const [projectName, setProjectName] = useState('');
  const [threads, setThreads] = useState<ProjectMessengerThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const [eligibleUsers, setEligibleUsers] = useState<ProjectMessengerEligibleUser[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupVisibility, setGroupVisibility] = useState<'internal' | 'seller_facing' | 'client_facing'>('internal');
  const [groupParticipants, setGroupParticipants] = useState<number[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [addParticipantId, setAddParticipantId] = useState<string>('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<number[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = () => {
    setLoadingThreads(true);
    adminProjectMessengerService.list(projectId)
      .then(setThreads)
      .catch(() => toast.error('Failed to load project chat'))
      .finally(() => setLoadingThreads(false));
  };

  const loadMessages = (threadId: number) => {
    adminProjectMessengerService.messages(projectId, threadId).then(r => setMessages(r.messages)).catch(() => {});
  };

  useEffect(() => {
    loadThreads();
    adminProjectMessengerService.eligibleParticipants(projectId).then(setEligibleUsers).catch(() => {});
    adminProjectService.getOne(projectId).then(p => setProjectName(p.name)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeThreadId) return;
    loadMessages(activeThreadId);
    const interval = setInterval(() => loadMessages(activeThreadId), 8000);
    return () => clearInterval(interval);
  }, [activeThreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const activeThread = threads.find(t => t.id === activeThreadId) ?? null;

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || groupParticipants.length === 0) { toast.error('Enter a title and select at least one participant'); return; }
    try {
      const { thread_id } = await adminProjectMessengerService.createGroup(projectId, groupTitle.trim(), groupVisibility, groupParticipants);
      setShowNewGroup(false);
      setGroupTitle('');
      setGroupParticipants([]);
      loadThreads();
      setActiveThreadId(thread_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create group');
    }
  };

  const startDirect = async (userId: number) => {
    try {
      const { thread_id } = await adminProjectMessengerService.createDirect(projectId, userId);
      setShowNewDirect(false);
      loadThreads();
      setActiveThreadId(thread_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start direct chat');
    }
  };

  const addParticipant = async () => {
    if (!activeThreadId || !addParticipantId) return;
    try {
      await adminProjectMessengerService.addParticipant(projectId, activeThreadId, Number(addParticipantId));
      setAddParticipantId('');
      loadThreads();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add participant');
    }
  };

  const removeParticipant = async (userId: number) => {
    if (!activeThreadId) return;
    if (!confirm('Remove this participant from the chat?')) return;
    try {
      await adminProjectMessengerService.removeParticipant(projectId, activeThreadId, userId);
      loadThreads();
    } catch { toast.error('Failed to remove participant'); }
  };

  const deleteThread = async () => {
    if (!activeThreadId || !activeThread) return;
    if (!confirm(`Delete "${activeThread.title}" permanently? This removes the whole chat and all its messages.`)) return;
    try {
      await adminProjectMessengerService.deleteThread(projectId, activeThreadId);
      setActiveThreadId(null);
      loadThreads();
    } catch { toast.error('Failed to delete chat'); }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId) return;
    if (!text.trim() && !file) return;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) { toast.error(`${file.name}: file type not allowed`); return; }
      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) { toast.error(`${file.name}: exceeds ${MAX_ATTACHMENT_MB}MB limit`); return; }
    }
    setSending(true);
    try {
      await adminProjectMessengerService.send(projectId, activeThreadId, text.trim(), selectedMentions, file);
      setText('');
      setFile(null);
      setSelectedMentions([]);
      loadMessages(activeThreadId);
      loadThreads();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send message');
    } finally { setSending(false); }
  };

  const deleteMessage = async (messageId: number) => {
    if (!activeThreadId) return;
    if (!confirm('Delete this message?')) return;
    try {
      await adminProjectMessengerService.deleteMessage(projectId, activeThreadId, messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch { toast.error('Failed to delete message'); }
  };

  const startEdit = (m: ChatMessage) => {
    setEditingMessageId(m.id);
    setEditText(m.content ?? '');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const saveEdit = async (messageId: number) => {
    if (!activeThreadId || !editText.trim()) return;
    try {
      const updated = await adminProjectMessengerService.updateMessage(projectId, activeThreadId, messageId, editText.trim());
      setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      cancelEdit();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update message');
    }
  };

  const downloadAttachment = async (m: ChatMessage) => {
    if (!activeThreadId || !m.attachment_name) return;
    try { await adminProjectMessengerService.downloadAttachment(projectId, activeThreadId, m.id, m.attachment_name); }
    catch { toast.error('Download failed'); }
  };

  const onTextChange = (v: string) => {
    setText(v);
    const at = v.lastIndexOf('@');
    setMentionQuery(at !== -1 && (at === 0 || v[at - 1] === ' ') ? v.slice(at + 1) : null);
  };

  const pickMention = (userId: number, name: string) => {
    const at = text.lastIndexOf('@');
    setText(text.slice(0, at) + `@${name} `);
    setSelectedMentions(prev => prev.includes(userId) ? prev : [...prev, userId]);
    setMentionQuery(null);
  };

  return (
    <DashboardLayout title="Project Chat">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push(`/admin/projects/${id}`)} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Chat{projectName && ` — ${projectName}`}</h2>
      </div>

      <ProjectTabs projectId={projectId} active="chat" />

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 260px)', minHeight: 420 }}>
        <div style={{ width: 300, flexShrink: 0, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowNewGroup(v => { if (!v && !groupTitle) setGroupTitle(projectName); return !v; }); setShowNewDirect(false); }} style={{ flex: 1, padding: '8px 10px', borderRadius: 20, border: 'none', background: '#2563eb', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>+ Group</button>
            <button onClick={() => { setShowNewDirect(v => !v); setShowNewGroup(false); }} style={{ flex: 1, padding: '8px 10px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>+ New Chat</button>
          </div>

          {showNewGroup && (
            <form onSubmit={createGroup} style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
              <input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} placeholder="Group name" style={{ ...inp, marginBottom: 8, fontSize: 12.5 }} />
              <select value={groupVisibility} onChange={e => setGroupVisibility(e.target.value as any)} style={{ ...inp, marginBottom: 8, fontSize: 12.5 }}>
                <option value="internal">Internal</option>
                <option value="seller_facing">Seller-facing</option>
                <option value="client_facing">Client-facing</option>
              </select>
              <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
                {eligibleUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={groupParticipants.includes(u.id)}
                      onChange={e => setGroupParticipants(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                    {u.name} {u.is_seller && <span style={{ color: '#d97706', fontSize: 10.5 }}>(Seller)</span>}
                  </label>
                ))}
              </div>
              <button type="submit" style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create Group</button>
            </form>
          )}

          {showNewDirect && (
            <div style={{ padding: 12, borderBottom: '1px solid #f1f5f9', maxHeight: 220, overflowY: 'auto' }}>
              {eligibleUsers.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No eligible users found.</div>
              ) : eligibleUsers.map(u => (
                <div key={u.id} onClick={() => startDirect(u.id)} style={{ padding: '7px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: '#334155' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  {u.name} {u.is_seller && <span style={{ color: '#d97706', fontSize: 10.5 }}>(Seller)</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingThreads ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
            ) : threads.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No project chat yet.</div>
            ) : threads.map(t => {
              const colors = avatarColors(t.id);
              return (
                <div key={t.id} onClick={() => setActiveThreadId(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                  background: t.id === activeThreadId ? '#eff6ff' : 'transparent',
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: colors.bg, color: colors.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                    {t.thread_type === 'project_group' ? '👥' : t.title.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ fontSize: 10.5, color: '#94a3b8', flexShrink: 0 }}>{fmtShort(t.last_message_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.last_message?.sender_name ? `${t.last_message.sender_name}: ` : ''}{lastMessagePreview(t.last_message)}
                      </span>
                      {t.visibility && <span style={{ fontSize: 9.5, color: '#94a3b8', flexShrink: 0 }}>{VISIBILITY_LABEL[t.visibility]}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>Select a conversation</div>
          ) : (
            <>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColors(activeThread.id).bg, color: avatarColors(activeThread.id).fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {activeThread.thread_type === 'project_group' ? '👥' : activeThread.title.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{activeThread.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{activeThread.participants.map(p => p.name).filter(Boolean).join(', ')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setShowParticipants(v => !v)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 11.5, color: '#64748b', cursor: 'pointer' }}>Participants</button>
                  <button onClick={deleteThread} style={{ border: '1px solid #fecaca', background: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 11.5, color: '#dc2626', cursor: 'pointer' }}>Delete Chat</button>
                </div>
              </div>

              {showParticipants && (
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {activeThread.participants.map(p => (
                      <span key={p.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '3px 10px', fontSize: 11.5, color: '#334155' }}>
                        {p.name}
                        <button onClick={() => removeParticipant(p.user_id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={addParticipantId} onChange={e => setAddParticipantId(e.target.value)} style={{ ...inp, fontSize: 12 }}>
                      <option value="">Add participant…</option>
                      {eligibleUsers.filter(u => !activeThread.participants.some(p => p.user_id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.name}{u.is_seller ? ' (Seller)' : ''}</option>
                      ))}
                    </select>
                    <button onClick={addParticipant} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Add</button>
                  </div>
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f7f8fa', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 20 }}>No messages yet. Say hello 👋</div>
                ) : messages.map(m => {
                  const isMine = m.sender_admin_id != null;
                  const senderName = m.sender_admin?.name ?? m.sender?.name ?? '—';
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 8 }}>
                      {!isMine && (
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 16 }}>
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                        {!isMine && activeThread.thread_type === 'project_group' && (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 3, marginLeft: 4 }}>{senderName}</div>
                        )}
                        <div style={{
                          padding: '9px 13px',
                          borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isMine ? '#2563eb' : '#fff',
                          color: isMine ? '#fff' : '#1e293b',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          border: isMine ? 'none' : '1px solid #f1f5f9',
                        }}>
                          {editingMessageId === m.id ? (
                            <div>
                              <input value={editText} onChange={e => setEditText(e.target.value)} style={{ ...inp, fontSize: 13, marginBottom: 6, color: '#0f172a' }} autoFocus />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => saveEdit(m.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                <button onClick={cancelEdit} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11.5, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.content && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                              {m.attachment_name && (
                                <button onClick={() => downloadAttachment(m)} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: m.content ? 6 : 0, padding: '4px 10px',
                                  borderRadius: 6, border: `1px solid ${isMine ? 'rgba(255,255,255,0.3)' : '#e2e8f0'}`,
                                  background: isMine ? 'rgba(255,255,255,0.1)' : '#f8fafc', color: isMine ? '#fff' : '#2563eb',
                                  fontSize: 12, cursor: 'pointer', width: 'fit-content',
                                }}>📎 {m.attachment_name}</button>
                              )}
                            </>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, marginLeft: isMine ? 0 : 4, marginRight: isMine ? 4 : 0 }}>
                          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtShort(m.sent_at)}{m.edited_at && ' (edited)'}</span>
                          {isMine && editingMessageId !== m.id && m.message_type === 'text' && (
                            <button onClick={() => startEdit(m)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Edit</button>
                          )}
                          {editingMessageId !== m.id && (
                            <button onClick={() => deleteMessage(m.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={send} style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fff', position: 'relative' }}>
                {mentionQuery !== null && activeThread.participants.filter(p => p.name?.toLowerCase().includes(mentionQuery.toLowerCase())).length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: 6, maxHeight: 160, overflowY: 'auto', minWidth: 180 }}>
                    {activeThread.participants.filter(p => p.name?.toLowerCase().includes(mentionQuery.toLowerCase())).map(p => (
                      <div key={p.user_id} onClick={() => pickMention(p.user_id, p.name ?? '')} style={{ padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', color: '#334155' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
                {file && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#334155' }}>
                    <span>📎 {file.name} <span style={{ color: '#94a3b8' }}>({fmtFileSize(file.size)})</span></span>
                    <button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ padding: '9px 12px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center' }}>
                    📎
                    <input type="file" style={{ display: 'none' }} accept={ALLOWED_ATTACHMENT_TYPES.map(t => `.${t}`).join(',')}
                      onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                  </label>
                  <input value={text} onChange={e => onTextChange(e.target.value)} placeholder="Type a message… use @ to mention" style={{ ...inp, borderRadius: 20, flex: 1 }} />
                  <button type="submit" disabled={sending} style={{ padding: '9px 20px', borderRadius: 20, border: 'none', background: sending ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'wait' : 'pointer' }}>Send</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

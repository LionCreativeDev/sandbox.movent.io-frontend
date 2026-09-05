'use client';
import { useEffect, useRef, useState } from 'react';
import { HiXMark, HiPaperAirplane } from 'react-icons/hi2';
import { publicInvoiceChatService, PublicChatMessage } from '@/lib/services/publicInvoiceChatService';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB, fmtFileSize } from '@/components/admin/projects/shared';

interface Props {
  token: string;
  sellerName: string | null;
  open: boolean;
  onClose: () => void;
  // Reports the freshly-fetched message list back to the parent every poll,
  // so it can keep the closed-button's unread badge in sync even while this
  // drawer is the one doing the fetching (see the page-level poll in
  // frontend/app/pay/invoice/[token]/page.tsx for the closed-state badge).
  onMessages?: (messages: PublicChatMessage[]) => void;
}

// Right-side drawer on desktop, full-screen panel on mobile (see the
// injected <style> media query below — this codebase has no shared
// responsive-drawer primitive to reuse, and every other page here handles
// one-off breakpoints the same self-contained way, e.g. app/Responsive.global.css).
// Polls every 8s while open, matching every other chat surface in this app
// (e.g. frontend/app/projects/[id]/chat/page.tsx) — no websockets anywhere here.
export default function ChatWithSellerDrawer({ token, sellerName, open, onClose, onMessages }: Props) {
  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [content, setContent]   = useState('');
  const [file, setFile]         = useState<File | null>(null);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = () => {
      publicInvoiceChatService.get(token)
        .then(res => { setMessages(res.messages); onMessages?.(res.messages); })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [open, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if ((!text && !file) || sending) return;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) { setError(`${file.name}: file type not allowed`); return; }
      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) { setError(`${file.name}: exceeds ${MAX_ATTACHMENT_MB}MB limit`); return; }
    }
    setSending(true); setError('');
    try {
      const msg = await publicInvoiceChatService.send(token, text, file);
      setMessages(prev => [...prev, msg]);
      setContent('');
      setFile(null);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setError(ex.response?.data?.message ?? 'Failed to send message');
    } finally { setSending(false); }
  };

  const downloadAttachment = (m: PublicChatMessage) => {
    if (!m.attachment_name) return;
    publicInvoiceChatService.downloadAttachment(token, m.id, m.attachment_name).catch(() => setError('Failed to download attachment'));
  };

  const deleteMessage = (messageId: number) => {
    if (!confirm('Delete this message?')) return;
    publicInvoiceChatService.deleteMessage(token, messageId)
      .then(() => setMessages(prev => prev.filter(m => m.id !== messageId)))
      .catch(() => setError('Failed to delete message'));
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 998 }} />
      <div className="chat-with-seller-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100%',
        background: '#fff', zIndex: 999, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 24px rgba(15,23,42,0.16)',
      }}>
        <style>{`
          @media (max-width: 640px) {
            .chat-with-seller-drawer { width: 100% !important; }
          }
        `}</style>

        <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Chat</div>
            {sellerName && <div style={{ fontSize: 12, color: '#94a3b8' }}>{sellerName}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 6, display: 'flex' }}>
            <HiXMark size={20} />
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40 }}>No messages yet. Ask your question below 👋</div>
          ) : messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: m.is_guest ? 'row-reverse' : 'row' }}>
              <div style={{
                maxWidth: '80%', padding: '9px 13px', borderRadius: 12,
                background: m.is_guest ? '#2563eb' : '#f1f5f9',
                color: m.is_guest ? '#fff' : '#0f172a', fontSize: 13,
              }}>
                {!m.is_guest && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: '#2563eb' }}>{m.sender_name}</div>}
                {m.content && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>}
                {m.attachment_name && (
                  <button onClick={() => downloadAttachment(m)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: m.content ? 6 : 0, padding: '4px 10px',
                    borderRadius: 6, border: `1px solid ${m.is_guest ? 'rgba(255,255,255,0.35)' : '#e2e8f0'}`,
                    background: m.is_guest ? 'rgba(255,255,255,0.12)' : '#fff', color: m.is_guest ? '#fff' : '#2563eb',
                    fontSize: 12, cursor: 'pointer',
                  }}>📎 {m.attachment_name}</button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{new Date(m.sent_at).toLocaleString()}</div>
                  {m.is_guest && (
                    <button onClick={() => deleteMessage(m.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textDecoration: 'underline',
                    }}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#dc2626', flexShrink: 0 }}>{error}</div>}

        {file && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', margin: '0 14px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#334155' }}>📎 {file.name} <span style={{ color: '#94a3b8' }}>({fmtFileSize(file.size)})</span></span>
            <button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
          </div>
        )}

        <form onSubmit={send} style={{ padding: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, borderRadius: 8, border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
            📎
            <input
              type="file" style={{ display: 'none' }}
              accept={ALLOWED_ATTACHMENT_TYPES.map(t => `.${t}`).join(',')}
              onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </label>
          <input value={content} onChange={e => setContent(e.target.value)} maxLength={2000} placeholder="Type your message…"
            style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a' }} />
          <button type="submit" disabled={sending || (!content.trim() && !file)} style={{
            padding: '9px 14px', borderRadius: 8, border: 'none',
            background: sending || (!content.trim() && !file) ? '#93c5fd' : '#2563eb', color: '#fff',
            cursor: sending || (!content.trim() && !file) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HiPaperAirplane size={16} />
          </button>
        </form>
      </div>
    </>
  );
}

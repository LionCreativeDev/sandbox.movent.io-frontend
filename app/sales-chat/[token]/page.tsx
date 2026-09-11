'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { HiPaperAirplane } from 'react-icons/hi2';
import { publicLeadChatService, LeadChatMessage, LeadChatResponse } from '@/lib/services/publicLeadChatService';
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_MB, fmtFileSize } from '@/components/admin/projects/shared';

// The Lead-facing Sales Chat, opened straight from the invite email
// (App\Mail\LeadSalesChatInviteMail) with no login at all.
//
// Deliberately NOT wrapped in DashboardLayout and importing nothing that
// touches auth: there is no session here, no sidebar, no nav to anywhere else
// in the app. The whole page is one conversation, which is also the whole of
// what the token grants — the backend exposes no invoices, projects, clients
// or CRM data through it (see Api\PublicLeadChatController).
//
// Polls every 8s, matching every other chat surface in this app (there are no
// websockets anywhere here).
const POLL_MS = 8000;

export default function LeadSalesChatPage() {
  const params = useParams();
  const token = String(params?.token ?? '');

  const [data, setData]       = useState<LeadChatResponse | null>(null);
  const [messages, setMessages] = useState<LeadChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // Set when the token is unknown or revoked — a distinct state from a
  // transient network failure, which must not wipe an open conversation.
  const [invalid, setInvalid] = useState(false);
  const [content, setContent] = useState('');
  const [file, setFile]       = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A missing token needs no state of its own — the render below treats it
    // as an invalid link directly, which also keeps this effect free of a
    // synchronous setState.
    if (!token) return;

    let cancelled = false;

    const load = () => {
      publicLeadChatService.get(token)
        .then(res => {
          if (cancelled) return;
          setData(res);
          setMessages(res.messages);
          setInvalid(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // Only a 404 means the link itself is dead. Anything else (offline,
          // 500, throttled) leaves whatever is already on screen alone rather
          // than telling the lead their link is invalid when it isn't.
          if ((err as { response?: { status?: number } }).response?.status === 404) setInvalid(true);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

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
      const msg = await publicLeadChatService.send(token, text, file);
      setMessages(prev => [...prev, msg]);
      setContent('');
      setFile(null);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setError(ex.response?.data?.message ?? 'Failed to send message');
    } finally { setSending(false); }
  };

  const downloadAttachment = (m: LeadChatMessage) => {
    if (!m.attachment_name) return;
    publicLeadChatService.downloadAttachment(token, m.id, m.attachment_name)
      .catch(() => setError('Failed to download attachment'));
  };

  const deleteMessage = (messageId: number) => {
    if (!confirm('Delete this message?')) return;
    publicLeadChatService.deleteMessage(token, messageId)
      .then(() => setMessages(prev => prev.filter(m => m.id !== messageId)))
      .catch(() => setError('Failed to delete message'));
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>{children}</div>
    </div>
  );

  // Checked before `loading`: with no token the effect above never runs, so
  // loading would otherwise stay true forever on a spinner that resolves to
  // nothing.
  if (loading && token) {
    return shell(
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading conversation…</div>
    );
  }

  if (!token || invalid || !data) {
    return shell(
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🔗</div>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>This conversation link is no longer valid</h1>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>
          The link may have expired or been replaced. Please get in touch with the team you were speaking to and ask them to send you a new one.
        </p>
      </div>
    );
  }

  const canSend = Boolean(content.trim() || file);

  return shell(
    <>
      {/* Branding is the sending company's own name — per-company, so an
          account running several companies has each one's leads land on a page
          badged with the right identity. */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb' }}>
          {data.company_name}
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Sales Conversation</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 420 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{data.lead_name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {data.seller_name ? `You're speaking with ${data.seller_name}` : `${data.company_name} sales team`}
          </div>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40, lineHeight: 1.6 }}>
              No messages yet.<br />Send the first one below and the team will get back to you 👋
            </div>
          ) : messages.map(m => (
            <div key={m.id} style={{ display: 'flex', flexDirection: m.is_guest ? 'row-reverse' : 'row' }}>
              <div style={{
                maxWidth: '78%', padding: '9px 13px', borderRadius: 12,
                background: m.is_guest ? '#2563eb' : '#f1f5f9',
                color: m.is_guest ? '#fff' : '#0f172a', fontSize: 13.5,
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
                  {/* Only the lead's own messages are deletable — the backend
                      enforces the same rule, this just hides the control. */}
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

        {error && <div style={{ padding: '0 18px 8px', fontSize: 12, color: '#dc2626', flexShrink: 0 }}>{error}</div>}

        {file && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', margin: '0 16px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#334155' }}>📎 {file.name} <span style={{ color: '#94a3b8' }}>({fmtFileSize(file.size)})</span></span>
            <button type="button" onClick={() => setFile(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
          </div>
        )}

        <form onSubmit={send} style={{ padding: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, borderRadius: 8, border: '1.5px dashed #cbd5e1', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 }}>
            📎
            <input
              type="file" style={{ display: 'none' }}
              accept={ALLOWED_ATTACHMENT_TYPES.map(t => `.${t}`).join(',')}
              onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </label>
          <input
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={2000}
            placeholder="Type your message…"
            style={{ flex: 1, minWidth: 0, padding: '10px 13px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13.5, outline: 'none', background: '#fafafa', color: '#0f172a' }}
          />
          <button type="submit" disabled={sending || !canSend} style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            background: sending || !canSend ? '#93c5fd' : '#2563eb', color: '#fff',
            cursor: sending || !canSend ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HiPaperAirplane size={16} />
          </button>
        </form>
      </div>

      <p style={{ margin: '12px 2px 0', fontSize: 11.5, color: '#94a3b8', lineHeight: 1.6 }}>
        This link is personal to you — please don&apos;t forward it, as it opens your conversation with {data.company_name}.
      </p>
    </>
  );
}

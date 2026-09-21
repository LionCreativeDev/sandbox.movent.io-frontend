'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HiChatBubbleLeftRight, HiXMark, HiPaperAirplane, HiArrowLeft,
  HiArrowsPointingOut, HiArrowsPointingIn,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { getAuthUser } from '@/lib/auth';
import {
  staffAssistantService,
  StaffChatMessage,
  StaffConversation,
} from '@/lib/services/staffAssistantService';

// The staff / Company Admin portal's OWN palette, straight from
// styles/globals.css (:root) — --primary #2563eb, --primary-dark #1d4ed8,
// --primary-light #dbeafe — and the same 135deg blue gradient the Sidebar logo
// uses. Not the Client Portal's green: each portal keeps its own branding.
const PRIMARY = 'var(--primary)';
const PRIMARY_DARK = 'var(--primary-dark)';
const PRIMARY_LIGHT = 'var(--primary-light)';
const INK = 'var(--text-primary)';
const MUTED = 'var(--text-secondary)';
const LINE = '#e2e8f0';
const THEIR_BUBBLE = '#f1f5f9';

/** Per requirement: the widget is AI Assistance, its contents are Client Messages. */
const ASSISTANT_NAME = 'AI Assistance';
const PANEL_SUBTITLE = 'Client Messages';

const CLOSE_ANIMATION_MS = 160;
const NEAR_BOTTOM_PX = 72;

/**
 * Refresh cadence. This app has no broadcast layer (no Pusher/Reverb/Echo in
 * composer.json or package.json) and its chat screens poll — 10s is the
 * interval the portal's project chat already uses. The list is checked less
 * often than an open conversation, because it only has to notice a NEW client.
 */
const THREAD_POLL_MS = 10000;
const LIST_POLL_MS = 60000;

type OpenThread = {
  threadId: number;
  clientId: number;
  clientName: string;
  companyName?: string | null;
  messages: StaffChatMessage[];
};

/**
 * Client Messages for staff (including the Seller Portal) and Company Admin.
 *
 * NOT A GLOBAL CHATBOT. It renders nothing — no floating button, no panel —
 * unless the backend says this session has at least one CLIENT-INITIATED
 * conversation. A seller who has never been contacted, one contacted by
 * somebody else's client, and anyone in another company all get `visible:false`
 * and see no widget at all. The role of the signed-in user is never consulted
 * here; only what the backend returns.
 *
 * Hiding the button is not what makes this private. Every endpoint behind it is
 * independently authorized — a thread id typed into the URL resolves only for a
 * participant (staff) or an owned company (Admin), and 404s otherwise.
 *
 * There is no assistant to talk to on this side: the panel opens straight onto
 * the client's own words. AI Assistance connected the two of them; it does not
 * sit between them afterwards.
 */
export default function StaffAssistant() {
  const [available, setAvailable] = useState(false);
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [thread, setThread] = useState<OpenThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  // The signed-in identity's own id — a `users` id for staff, a company_admins
  // id for an Admin session. It is the only thing that decides which side of
  // the thread a message sits on, so it is read once and read honestly.
  const [myId, setMyId] = useState<number | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(true);
  const grewRef = useRef(0);

  useEffect(() => {
    queueMicrotask(() => setMyId((getAuthUser() as { id?: number } | null)?.id ?? null));
  }, []);

  /**
   * The visibility check, and the list in one call.
   *
   * Runs on mount (not on open) because its answer decides whether the launcher
   * exists at all. Repeated on a slow timer so a client who reaches out while
   * the seller is mid-session makes the widget appear without a reload.
   */
  const loadList = useCallback(async () => {
    try {
      const res = await staffAssistantService.conversations();
      setAvailable(res.visible);
      setConversations(res.conversations ?? []);
      setUnreadTotal(res.unread_total ?? 0);
    } catch {
      // A failed check must never make the widget appear — if we cannot
      // confirm this session is entitled to it, it stays hidden.
      setAvailable(false);
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    // The first check is deferred out of the effect body for the same reason
    // the interval is: this synchronises with the server, it does not set state
    // the effect already knows.
    const first = setTimeout(() => void loadList(), 0);
    const timer = setInterval(() => void loadList(), LIST_POLL_MS);

    return () => { clearTimeout(first); clearInterval(timer); };
  }, [loadList]);

  /**
   * Mark everything (or one conversation) read, and take the refreshed counts
   * from the same response.
   *
   * Never surfaces an error: failing to clear a badge is not worth a toast, and
   * the next list poll will correct whatever this missed.
   */
  const markRead = useCallback(async (threadId?: number) => {
    try {
      const res = await staffAssistantService.markRead(threadId);
      setConversations(res.conversations ?? []);
      setUnreadTotal(res.unread_total ?? 0);
      setAvailable(res.visible);
    } catch { /* the badge corrects itself on the next poll */ }
  }, []);

  /** Open one conversation — the real one, on the existing endpoints. */
  const openThread = useCallback(async (c: StaffConversation) => {
    setLoading(true);
    setThread({
      threadId: c.thread_id,
      clientId: c.client_id,
      clientName: c.client_name,
      companyName: c.company_name,
      messages: [],
    });

    // Cleared locally first so the badge goes the instant they tap, then
    // confirmed server-side.
    setConversations(prev => prev.map(x => (x.thread_id === c.thread_id ? { ...x, unread: 0 } : x)));

    try {
      const messages = await staffAssistantService.messages(c.client_id, c.thread_id);
      setThread(prev => (prev && prev.threadId === c.thread_id ? { ...prev, messages } : prev));
      void markRead(c.thread_id);
    } catch {
      setThread(null);
      toast.error('Could not open that conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [markRead]);

  /** Keep an open conversation current. Stops the moment it is closed. */
  useEffect(() => {
    if (!open || !thread) return;

    const { threadId, clientId } = thread;

    const timer = setInterval(() => {
      staffAssistantService.messages(clientId, threadId)
        .then(messages => setThread(prev => (
          prev && prev.threadId === threadId ? { ...prev, messages } : prev
        )))
        .catch(() => { /* a dropped poll is not worth interrupting anyone for */ });
    }, THREAD_POLL_MS);

    return () => clearInterval(timer);
  }, [open, thread?.threadId, thread?.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    const size = thread ? thread.messages.length : conversations.length;
    const grew = size > grewRef.current;
    grewRef.current = size;

    if (!grew || !pinnedRef.current) return;

    // scrollTo on the element, never scrollIntoView — the latter also scrolls
    // every scrollable ancestor and would drag the page under the widget.
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [thread, conversations, open]);

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !thread) return;

    const { threadId, clientId } = thread;
    setBusy(true);
    setInput('');

    try {
      const message = await staffAssistantService.reply(clientId, threadId, text);
      setThread(prev => (
        prev && prev.threadId === threadId ? { ...prev, messages: [...prev.messages, message] } : prev
      ));
      void loadList();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      // Put the text back rather than losing what they wrote.
      setInput(text);
      toast.error(ex.response?.data?.message ?? 'Your reply could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const close = useCallback(() => {
    if (closeTimerRef.current) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setOpen(false);
      launcherRef.current?.focus();
    }, CLOSE_ANIMATION_MS);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  /**
   * Opening the widget IS having seen what was waiting, so the badge clears
   * here rather than only when an individual conversation is tapped.
   *
   * Deferred out of the effect body for the same reason as the list poll: this
   * synchronises with the server, it is not state the effect already knows.
   */
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void markRead(), 0);
    return () => clearTimeout(timer);
  }, [open, markRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open && thread) queueMicrotask(() => inputRef.current?.focus());
  }, [open, thread]);

  // The single most important line in this file: no entitlement, no widget.
  if (!available) return null;

  const isAdminSession = staffAssistantService.isAdminSession();

  /**
   * Which side of the thread a message sits on.
   *
   * Compared against this session's OWN id rather than guessed from a role:
   * a staff message carries sender_id, a Company Admin's carries
   * sender_admin_id, and the client's carries their portal sender_id. So
   * anything that is not mine is the other party's — including a Project
   * Manager the seller looped in, who is correctly shown named on the left.
   */
  const isMine = (m: StaffChatMessage) => (
    isAdminSession
      ? m.sender_admin_id !== null && m.sender_admin_id === myId
      : m.sender_admin_id === null && m.sender_id !== null && m.sender_id === myId
  );

  return (
    <>
      <style>{`
        /* ONE launcher, always mounted while the widget is entitled: closed it
           opens the panel, open it becomes the X that closes it. Above the
           panel so it stays clickable either way. */
        .sa-launcher {
          position: fixed; right: 24px; bottom: 24px; z-index: 1002;
          width: 54px; height: 54px; border-radius: 50%;
          border: none; cursor: pointer; color: #fff;
          background: linear-gradient(135deg, ${PRIMARY}, #60a5fa);
          box-shadow: 0 10px 28px rgba(37,99,235,.32), 0 2px 6px rgba(15,23,42,.12);
          display: flex; align-items: center; justify-content: center;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .sa-launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 14px 34px rgba(37,99,235,.4); }
        .sa-launcher:focus-visible { outline: 3px solid ${PRIMARY_DARK}; outline-offset: 3px; }
        .sa-launcher-icon { display: flex; animation: sa-turn .22s ease-out; }
        @keyframes sa-turn {
          from { opacity: 0; transform: rotate(-90deg) scale(.6); }
          to   { opacity: 1; transform: none; }
        }
        .sa-badge {
          position: absolute; top: -2px; right: -2px;
          min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
          background: #ef4444; color: #fff; border: 2px solid #fff;
          font-size: 10.5px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }

        .sa-panel {
          position: fixed; right: 24px; bottom: 92px; z-index: 1001;
          width: 384px; height: min(580px, calc(100vh - 140px));
          background: #fff; border: 1px solid ${LINE}; border-radius: var(--radius-card);
          box-shadow: var(--shadow-dropdown);
          display: flex; flex-direction: column; overflow: hidden;
          animation: sa-in .18s ease-out;
        }
        .sa-panel.sa-expanded { width: 540px; height: min(760px, calc(100vh - 120px)); }
        .sa-panel.sa-closing { animation: sa-out .16s ease-in forwards; pointer-events: none; }
        @keyframes sa-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes sa-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px); } }

        /* Header in the portal's own blue, matching the Sidebar logo gradient. */
        .sa-header {
          display: flex; align-items: center; gap: 10;
          padding: 12px 14px; flex-shrink: 0; color: #fff;
          background: linear-gradient(135deg, ${PRIMARY}, #60a5fa);
        }
        .sa-header-btn {
          background: rgba(255,255,255,.16); border: none; padding: 5px;
          border-radius: 7px; color: #fff; cursor: pointer;
          display: flex; align-items: center; transition: background .15s;
        }
        .sa-header-btn:hover { background: rgba(255,255,255,.3); }
        .sa-header-btn:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }

        .sa-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .sa-bubble {
          max-width: 82%; padding: 10px 13px; border-radius: 14px;
          font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
        }

        /* One row per client in the list. */
        .sa-row {
          width: 100%; text-align: left; cursor: pointer;
          border: 1px solid ${LINE}; border-radius: var(--radius-input);
          background: #fff; padding: 11px 13px; transition: all .15s;
        }
        .sa-row:hover { border-color: ${PRIMARY}; background: ${PRIMARY_LIGHT}; }
        .sa-row:focus-visible { outline: 2px solid ${PRIMARY_DARK}; outline-offset: 2px; }

        .sa-send:focus-visible, .sa-input:focus-visible { outline: 2px solid ${PRIMARY_DARK}; outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .sa-panel, .sa-panel.sa-closing, .sa-launcher-icon { animation: none; }
          .sa-launcher { transition: none; }
        }

        /* Phones: a near-full-screen sheet, stopping short of the bottom so the
           launcher — now the close button — never covers the reply box. */
        @media (max-width: 640px) {
          .sa-panel, .sa-panel.sa-expanded {
            right: 8px; left: 8px; bottom: 74px; top: 8px;
            width: auto; height: auto;
          }
          .sa-launcher { right: 16px; bottom: 14px; width: 50px; height: 50px; }
          .sa-bubble { max-width: 88%; }
        }
      `}</style>

      <button
        ref={launcherRef}
        className="sa-launcher"
        onClick={() => {
          if (open) { close(); return; }
          // Cleared here so the badge goes on the press itself; the effect
          // above then confirms it server-side.
          setUnreadTotal(0);
          setOpen(true);
        }}
        aria-label={open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME} — ${PANEL_SUBTITLE}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={open ? `Close ${ASSISTANT_NAME}` : `${ASSISTANT_NAME} — ${PANEL_SUBTITLE}`}
        style={{ position: 'fixed' }}
      >
        <span className="sa-launcher-icon" key={open ? 'close' : 'chat'} aria-hidden>
          {open ? <HiXMark size={25} /> : <HiChatBubbleLeftRight size={23} />}
        </span>
        {!open && unreadTotal > 0 && (
          <span className="sa-badge" aria-label={`${unreadTotal} unread`}>
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <section
          className={`sa-panel${expanded ? ' sa-expanded' : ''}${closing ? ' sa-closing' : ''}`}
          role="dialog"
          aria-label={thread ? `Conversation with ${thread.clientName}` : `${ASSISTANT_NAME} — ${PANEL_SUBTITLE}`}
        >
          <header className="sa-header" style={{ gap: 10 }}>
            {thread && (
              <button
                onClick={() => { setThread(null); grewRef.current = 0; pinnedRef.current = true; }}
                aria-label="Back to Client Messages"
                title="Back to Client Messages"
                className="sa-header-btn"
              >
                <HiArrowLeft size={17} aria-hidden />
              </button>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {thread ? thread.clientName : ASSISTANT_NAME}
              </div>
              <div style={{ fontSize: 11, opacity: .85, fontWeight: 600 }}>
                {thread ? (thread.companyName ?? 'Client') : PANEL_SUBTITLE}
              </div>
            </div>

            <button
              onClick={() => setExpanded(v => !v)}
              aria-label={expanded ? `Shrink ${ASSISTANT_NAME}` : `Expand ${ASSISTANT_NAME}`}
              aria-pressed={expanded}
              className="sa-header-btn"
            >
              {expanded ? <HiArrowsPointingIn size={15} aria-hidden /> : <HiArrowsPointingOut size={15} aria-hidden />}
            </button>
            <button onClick={close} aria-label={`Close ${ASSISTANT_NAME}`} className="sa-header-btn">
              <HiXMark size={17} aria-hidden />
            </button>
          </header>

          <div
            className="sa-body"
            ref={threadRef}
            onScroll={onThreadScroll}
            aria-live="polite"
            aria-busy={loading}
            style={{ background: thread ? '#fff' : 'var(--bg-page)' }}
          >
            {/* The list. No AI suggestions, no assistant turn — the clients who
                have written, and nothing else. */}
            {!thread && conversations.map(c => (
              <button key={c.thread_id} className="sa-row" onClick={() => void openThread(c)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>
                    {c.client_name}
                  </span>
                  {c.unread > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                      background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.company_name && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{c.company_name}</div>
                )}
                {c.last_message && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 5, lineHeight: 1.45 }}>
                    {c.last_message}
                  </div>
                )}
              </button>
            ))}

            {!thread && conversations.length === 0 && (
              <div style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', padding: '18px 8px' }}>
                No client messages right now.
              </div>
            )}

            {/* The conversation itself. */}
            {thread && loading && thread.messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', padding: '12px 0' }}>
                Opening the conversation…
              </div>
            )}

            {thread && thread.messages.map(m => {
              const mine = isMine(m);
              const who = m.sender?.name ?? m.senderAdmin?.name ?? thread.clientName;

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: mine ? 'flex-end' : 'flex-start',
                  }}
                >
                  {!mine && (
                    <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, margin: '0 0 3px 4px' }}>
                      {who}
                    </div>
                  )}
                  <div
                    className="sa-bubble"
                    style={{
                      background: mine ? PRIMARY : THEIR_BUBBLE,
                      color: mine ? '#fff' : INK,
                      borderBottomRightRadius: mine ? 4 : 14,
                      borderBottomLeftRadius: mine ? 14 : 4,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply box — only inside a conversation. */}
          {thread && (
            <form
              onSubmit={send}
              style={{
                padding: 12, borderTop: `1px solid ${LINE}`, flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <input
                ref={inputRef}
                className="sa-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your message…"
                disabled={busy}
                aria-label={`Reply to ${thread.clientName}`}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 14px',
                  border: `1.5px solid ${LINE}`, borderRadius: 999,
                  fontSize: 13.5, color: INK, outline: 'none',
                  background: busy ? '#f8fafc' : '#fff',
                }}
              />
              <button
                type="submit"
                className="sa-send"
                disabled={busy || !input.trim()}
                aria-label="Send reply"
                style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none',
                  background: busy || !input.trim() ? THEIR_BUBBLE : PRIMARY,
                  color: busy || !input.trim() ? '#94a3b8' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                <HiPaperAirplane size={16} style={{ transform: 'rotate(-45deg)' }} aria-hidden />
              </button>
            </form>
          )}

          {!thread && (
            <div style={{
              padding: '9px 12px', borderTop: `1px solid ${LINE}`, flexShrink: 0,
              fontSize: 11, color: MUTED, textAlign: 'center',
            }}>
              Only clients who have messaged you appear here.
            </div>
          )}
        </section>
      )}
    </>
  );
}

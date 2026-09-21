'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  HiChatBubbleLeftRight, HiXMark, HiPaperAirplane,
  HiArrowsPointingOut, HiArrowsPointingIn, HiOutlineTrash, HiArrowLeft,
} from 'react-icons/hi2';
import { RiRobot2Fill } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { getClientUser } from '@/lib/clientAuth';
import { clientService, SavedCard } from '@/lib/services/clientService';
import AddCardInline from '@/components/client/AddCardInline';
import {
  clientAssistantService,
  AssistantAction,
  AssistantInvoiceCard,
  AssistantProjectCard,
  AssistantTurn,
} from '@/lib/services/clientAssistantService';
import {
  clientSellerChatService,
  SellerChatMessage,
} from '@/lib/services/clientSellerChatService';

// The portal's own palette — same green the sidebar, dashboard and every
// primary action already use. Deliberately not the reference screenshot's
// colours: the widget has to read as part of THIS portal.
const GREEN = '#10b981';
const GREEN_DARK = '#059669';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const BOT_BUBBLE = '#f1f5f9';
const CLIENT_BUBBLE = '#ecfdf5';

// The whole widget — launcher AND the open conversation panel — follows the
// dashboard's navy theme when `navy` is true (passed from ClientLayout for
// /client/dashboard only). Every other portal page keeps the green palette
// above unchanged.
const NAVY = '#081B2D';
const NAVY_ACTIVE = '#203750';

/**
 * What the assistant is called, everywhere it is visible.
 *
 * Mirrors Api\Client\AssistantController::ASSISTANT_NAME, which is what it
 * answers with when a client asks its name. Kept as a constant rather than
 * written out in six places so the header, the tooltips, the aria labels and
 * the screen-reader announcement can never drift apart from each other.
 */
const ASSISTANT_NAME = 'AI Assistance';

/** Matches the .pa-w-closing animation below — the panel unmounts after it. */
const CLOSE_ANIMATION_MS = 160;

/** How close to the bottom still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 72;

/**
 * Where the gateway drops the client after adding a card. The widget waits a
 * beat there before resuming a payment, because that page is still saving the
 * card when it first paints.
 */
const CARD_RETURN_PATH = '/client/payment-methods/added';

/** Carries a half-finished payment across the trip to the gateway and back. */
const RESUME_KEY = 'assistant_resume_invoice';

/**
 * How often an OPEN seller conversation is refreshed.
 *
 * This app has no websocket layer — no Pusher, Reverb, Echo or Ably in either
 * composer.json or package.json — and its existing chat screens poll. Ten
 * seconds is the interval the portal's own project chat already uses
 * (app/client/projects/[id]/page.tsx), so this matches rather than inventing a
 * second cadence. Only ever runs while a conversation is actually on screen.
 */
const SELLER_CHAT_POLL_MS = 10000;

/**
 * Deep link from a "New message from …" notification.
 *
 * The staff and Admin sides write /client/dashboard?assistant_chat={threadId}
 * when they reply (Api\User\ClientChatController, Api\Admin\ClientChatController)
 * — the portal's bell only follows links that stay inside /client/..., and this
 * opens the widget straight onto the conversation without needing a page of its
 * own.
 */
const CHAT_DEEP_LINK_PARAM = 'assistant_chat';

/** The conversation the widget is currently showing, if any. */
type SellerChat = {
  threadId: number;
  name: string;
  role: string;
  messages: SellerChatMessage[];
};

type Bubble = {
  id: number;
  who: 'client' | 'bot';
  text: string;
  suggestions?: string[];
  actions?: AssistantAction[];
  invoice?: AssistantInvoiceCard;
  project?: AssistantProjectCard;
};

/**
 * The Client Portal's floating assistant.
 *
 * Mounted once, in the portal LAYOUT — so it is on every page, and a route
 * change does not unmount it or lose the conversation. A full refresh does not
 * lose it either: the thread is stored server-side and replayed on open.
 *
 * It decides nothing. Every reply — the wording, the chips, the buttons and
 * what each button is allowed to do — is composed by Api\Client\
 * AssistantController against the authenticated session. This component sends
 * what the client typed or pressed and renders what comes back, which is what
 * keeps the browser out of any decision that ends in money.
 */
export default function PortalAssistant({ navy = false }: { navy?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  // Held true for one animation frame-set while the panel plays its exit, so
  // closing is not an abrupt disappearance. See close().
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [booted, setBooted] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // Separate from `busy`: `busy` also covers handing the browser to the
  // gateway, where nothing is being composed and a "typing" bubble would be a
  // lie. This is only ever true while a reply is genuinely on its way.
  const [thinking, setThinking] = useState(false);
  const [clientName, setClientName] = useState('');
  // Non-null while the widget is showing a real conversation with a person
  // rather than the assistant. These are two different contexts and the UI says
  // so: different header, different avatars, no chips, no action buttons.
  const [sellerChat, setSellerChat] = useState<SellerChat | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  // Non-null while the client is adding a card. The fields are Stripe's own
  // iframe inside the thread — see AddCardInline — so this never holds, and
  // cannot hold, any card detail.
  const [cardForm, setCardForm] = useState<{ companyId: number } | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while the client is reading the newest messages. An empty thread is
  // already at its bottom, so it starts true.
  const pinnedRef = useRef(true);
  const grewRef = useRef(0);
  // Strict Mode runs effects twice in development; opening twice would double
  // the welcome message.
  const bootedRef = useRef(false);

  // Monotonic and never reused, so a bubble keeps its key for life even as
  // others are added around it.
  const nextId = useRef(0);
  const push = useCallback((b: Omit<Bubble, 'id'>) => {
    setBubbles(prev => [...prev, { ...b, id: ++nextId.current }]);
  }, []);

  // ── Applying a server turn ────────────────────────────────────────────────

  /**
   * Hand the browser to the gateway's hosted card page.
   *
   * Reuses the existing /client/payment-methods/setup endpoint and the same
   * `pm_company_id` handoff the Payment Methods screen already uses, so the
   * return page (/client/payment-methods/added) completes the save exactly as
   * it does today. No card detail passes through the widget, ever.
   *
   * Declared before apply() because apply() calls it — the hooks lint rejects
   * reaching forward to a `const` that may be reassigned between renders.
   */
  const startCardSetup = useCallback(async (companyId: number) => {
    setBusy(true);
    try {
      const res = await clientService.paymentMethods.startSetup(companyId);

      try {
        sessionStorage.setItem('pm_company_id', String(companyId));
      } catch { /* private mode */ }

      if (res.navigation === 'redirect') {
        window.location.assign(res.action);
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = res.action;
      Object.entries(res.fields ?? {}).forEach(([k, v]) => {
        const i = document.createElement('input');
        i.type = 'hidden';
        i.name = k;
        i.value = String(v);
        form.appendChild(i);
      });
      document.body.appendChild(form);
      form.submit();
    } catch {
      push({ who: 'bot', text: 'I could not open the secure payment page just now. Please try again in a moment.' });
      setBusy(false);
    }
  }, [push]);

  /**
   * Switch the panel into a real conversation with a person.
   *
   * The handoff, made visible: from here the widget is no longer the assistant
   * talking. It renders the seller's own messages, sends to the seller-chat
   * endpoints, and never adds a line of its own.
   */
  const openSellerChat = useCallback(async (threadId: number, name?: string, role?: string) => {
    setChatLoading(true);
    // Set optimistically so the header shows who this is while the messages
    // load, rather than flashing an empty bar.
    setSellerChat(prev => (prev?.threadId === threadId ? prev : {
      threadId,
      name: name ?? 'Your seller',
      role: role ?? 'Seller',
      messages: [],
    }));

    try {
      const thread = await clientSellerChatService.show(threadId);
      setSellerChat({
        threadId: thread.thread_id,
        name: thread.title,
        role: thread.role,
        messages: thread.messages,
      });
    } catch {
      setSellerChat(null);
      push({
        who: 'bot',
        text: 'I could not open that conversation just now. Please try again in a moment.',
      });
    } finally {
      setChatLoading(false);
    }
  }, [push]);

  /**
   * Render one reply, then carry out whatever it asked the browser to do.
   *
   * The side-channels are deliberate and narrow: `open_seller_chat` switches
   * into the EXISTING per-client Direct Chat, and `open_card_setup` starts the
   * EXISTING hosted card flow. Neither invents a destination — both are
   * server-supplied and server-authorized.
   */
  const apply = useCallback((turn: AssistantTurn) => {
    if (turn.message) {
      push({
        who: 'bot',
        text: turn.message,
        suggestions: turn.suggestions,
        actions: turn.actions,
        invoice: turn.invoice,
        project: turn.project,
      });
    }

    if (turn.open_seller_chat?.thread_id) {
      void openSellerChat(
        turn.open_seller_chat.thread_id,
        turn.open_seller_chat.name,
        turn.open_seller_chat.role,
      );
    }

    if (turn.open_chat?.url) {
      // Kept open on purpose — the client asked to be taken somewhere, not to
      // have the assistant vanish on them mid-sentence.
      router.push(turn.open_chat.url);
    }

    // The normal path: the card fields open inside the chat.
    if (turn.open_card_form?.company_id) {
      setCardForm({ companyId: turn.open_card_form.company_id });
      // Nothing is navigating away, so the "resume after the gateway" marker
      // pressAction set is stale — left behind it would re-open this payment
      // on the next full page load.
      try { sessionStorage.removeItem(RESUME_KEY); } catch { /* private mode */ }
    }

    // Fallback, for a gateway that can only vault a card on its own page.
    if (turn.open_card_setup?.company_id) {
      void startCardSetup(turn.open_card_setup.company_id);
    }
  }, [push, router, startCardSetup, openSellerChat]);

  /** Every request goes through here, so the dots are never left behind. */
  const run = useCallback(async (fn: () => Promise<AssistantTurn>) => {
    setBusy(true);
    setThinking(true);
    try {
      apply(await fn());
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      push({
        who: 'bot',
        text: ex.response?.data?.message
          ?? 'Something went wrong on my side. Please try that again in a moment.',
      });
    } finally {
      // Cleared in the same tick the reply is applied, so the indicator is gone
      // by the time the answer paints — never both on screen at once.
      setThinking(false);
      setBusy(false);
    }
  }, [apply, push]);

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // getClientUser() reads cookies; setting state synchronously inside an
    // effect body is what the compiler lint objects to. Same pattern as
    // app/client/payment-assistant/page.tsx.
    queueMicrotask(() => setClientName(getClientUser()?.name ?? ''));
  }, []);

  useEffect(() => {
    if (!open || bootedRef.current) return;
    bootedRef.current = true;

    setThinking(true);
    clientAssistantService.open()
      .then(turn => {
        // A conversation already in progress comes back as it was, buttons
        // included — only the newest turn's buttons stay live (see the render).
        if (turn.transcript?.length) {
          setBubbles(turn.transcript.map(row => ({
            id: ++nextId.current,
            who: row.role === 'client' ? 'client' : 'bot',
            text: row.content,
            suggestions: row.payload?.suggestions,
            actions: row.payload?.actions,
            invoice: row.payload?.invoice,
            project: row.payload?.project,
          })));
          return;
        }
        apply(turn);
      })
      .catch(() => push({
        who: 'bot',
        text: 'The assistant is unavailable right now. Please try again shortly.',
      }))
      .finally(() => { setThinking(false); setBooted(true); });
  }, [open, apply, push]);

  /**
   * Resume a payment interrupted by the trip to the gateway.
   *
   * On the gateway's return page the card is still being saved when this first
   * runs, so the resume is deferred there — otherwise the assistant would look
   * at the card list a moment too early and say there isn't one.
   */
  useEffect(() => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(RESUME_KEY); } catch { return; }
    if (!pending) return;

    const invoiceId = Number(pending);
    if (!invoiceId) return;

    const timer = setTimeout(
      () => {
        // Consumed HERE, not when the effect runs.
        //
        // React Strict Mode mounts, unmounts and remounts in development. If
        // the key were cleared up front, the first run would consume it, its
        // cleanup would cancel the timer, and the second run would find
        // nothing — so the resume silently never happened in dev. Clearing it
        // inside the timer that actually fires means whichever run survives is
        // the one that consumes it, exactly once.
        try { sessionStorage.removeItem(RESUME_KEY); } catch { /* private mode */ }

        setOpen(true);
        void run(() => clientAssistantService.act('pay_invoice', { invoice_id: invoiceId }));
      },
      pathname === CARD_RETURN_PATH ? 2500 : 300,
    );

    return () => clearTimeout(timer);
    // Once per mount — a cancelled run leaves the key for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keep an open conversation current.
   *
   * Polling, not websockets — this app has no broadcast layer, and its existing
   * chat screens poll at this same interval. Runs only while a conversation is
   * actually on screen: closing the panel or going back to the assistant stops
   * it, so a portal left open on the dashboard makes no requests.
   *
   * Replaces the message list wholesale rather than appending, so a message the
   * staff side deleted or hid disappears here too instead of lingering.
   */
  useEffect(() => {
    if (!open || !sellerChat) return;

    const threadId = sellerChat.threadId;

    const tick = () => {
      clientSellerChatService.show(threadId)
        .then(thread => setSellerChat(prev => (
          prev && prev.threadId === threadId
            ? { ...prev, name: thread.title, role: thread.role, messages: thread.messages }
            : prev
        )))
        .catch(() => { /* a dropped poll is not worth interrupting the client for */ });
    };

    const timer = setInterval(tick, SELLER_CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [open, sellerChat?.threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * "New message from …" in the portal bell lands here.
   *
   * The link carries ?assistant_chat={threadId}; the widget opens itself onto
   * that conversation and then strips the parameter, so a refresh or a back
   * navigation does not reopen it a second time.
   */
  useEffect(() => {
    const raw = searchParams?.get(CHAT_DEEP_LINK_PARAM);
    const threadId = raw ? Number(raw) : 0;
    if (!threadId) return;

    // Deferred out of the effect body: opening the panel and loading a thread
    // are a reaction to the URL, not state this effect is synchronising, and
    // setting them inline is what the hooks lint objects to.
    const timer = setTimeout(() => {
      setOpen(true);
      void openSellerChat(threadId);
    }, 0);

    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.delete(CHAT_DEEP_LINK_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/client/dashboard'));

    return () => clearTimeout(timer);
  }, [searchParams, pathname, router, openSellerChat]);

  // ── Scrolling ─────────────────────────────────────────────────────────────

  /**
   * Follow the conversation — the THREAD, not the page.
   *
   * scrollTo() on the element rather than scrollIntoView(), which also scrolls
   * every scrollable ancestor and would drag the portal page underneath the
   * widget. Only fires when the thread actually GREW, and never when the client
   * has scrolled up to re-read something.
   */
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    const size = sellerChat
      ? sellerChat.messages.length
      : bubbles.length + (thinking ? 1 : 0);
    const grew = size > grewRef.current;
    grewRef.current = size;

    if (!grew || !pinnedRef.current) return;

    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [bubbles, thinking, open, sellerChat]);

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  // ── Interactions ──────────────────────────────────────────────────────────

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    // In a seller conversation the message goes to the PERSON, not the
    // assistant. No classification, no AI, no reply generated on their behalf.
    if (sellerChat) {
      void sendToSeller(text);
      return;
    }

    push({ who: 'client', text });
    setInput('');
    void run(() => clientAssistantService.send(text));
  };

  /**
   * Send into the open conversation.
   *
   * The sent message is appended from the server's own response rather than
   * echoed optimistically, so what the client sees is what was actually stored
   * — and the next poll cannot produce a duplicate of a locally-added bubble.
   */
  const sendToSeller = async (text: string) => {
    if (!sellerChat) return;

    const threadId = sellerChat.threadId;
    setBusy(true);
    setInput('');

    try {
      const { message } = await clientSellerChatService.send(threadId, text);
      setSellerChat(prev => (
        prev && prev.threadId === threadId
          ? { ...prev, messages: [...prev.messages, message] }
          : prev
      ));
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      // Put the text back so a failed send does not lose what they wrote.
      setInput(text);
      toast.error(ex.response?.data?.message ?? 'Your message could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Leave the conversation, back to the assistant. The thread is not closed. */
  const leaveSellerChat = () => {
    setSellerChat(null);
    grewRef.current = 0;
    pinnedRef.current = true;
  };

  const sendSuggestion = (label: string) => {
    if (busy) return;
    push({ who: 'client', text: label });
    void run(() => clientAssistantService.send(label));
  };

  const pressAction = (action: AssistantAction) => {
    if (busy) return;

    // Remember which invoice we were paying before the browser leaves for the
    // gateway, so the flow can pick itself up on the way back.
    if (action.action === 'start_card_setup') {
      const invoiceId = lastInvoiceId();
      if (invoiceId) {
        try { sessionStorage.setItem(RESUME_KEY, String(invoiceId)); } catch { /* ignore */ }
      }
    }

    push({ who: 'client', text: action.label });
    void run(() => clientAssistantService.act(action.action, action.payload ?? {}, action.label));
  };

  /** The invoice currently in view, read back off the thread. */
  const lastInvoiceId = (): number | null => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const id = bubbles[i].invoice?.id;
      if (id) return id;
    }
    return null;
  };

  /**
   * A card was just saved from inside the chat.
   *
   * Picks the payment back up where it was interrupted: with an invoice still
   * in view, the card list is re-requested so the new card is there to choose;
   * otherwise the saved-cards answer is re-run so the client sees it listed.
   * Both go back through the server rather than being assembled here — the
   * card list is an authorization decision, not a local one.
   */
  const onCardSaved = (card: SavedCard) => {
    setCardForm(null);
    push({ who: 'client', text: `Saved ${card.label}` });

    const invoiceId = lastInvoiceId();

    void run(() => (invoiceId
      ? clientAssistantService.act('pay_invoice', { invoice_id: invoiceId })
      : clientAssistantService.send('Add / Manage Payment Method')));
  };

  const clearHistory = () => {
    if (busy) return;
    setBubbles([]);
    grewRef.current = 0;
    void run(() => clientAssistantService.clear());
  };

  /**
   * Close the panel — animated, so it is held mounted for one short beat.
   *
   * The conversation is NOT touched: `bubbles` stays exactly as it is, so
   * reopening shows the same thread rather than a fresh greeting. Guarded
   * against a second press while the animation runs, which would otherwise
   * stack timers.
   */
  const close = useCallback(() => {
    if (closeTimerRef.current) return;

    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setOpen(false);
      // Focus goes back to the launcher, which is still there — it has just
      // turned back into the chat icon. A keyboard user is never dropped at
      // the top of the document.
      openButtonRef.current?.focus();
    }, CLOSE_ANIMATION_MS);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Focus the composer when the panel opens, once it exists.
  useEffect(() => {
    if (open && booted) queueMicrotask(() => inputRef.current?.focus());
  }, [open, booted]);

  // The widget belongs to the signed-in portal, not to the login screens.
  if (pathname?.startsWith('/client/login')
    || pathname?.startsWith('/client/forgot-password')
    || pathname?.startsWith('/client/reset-password')) {
    return null;
  }

  const initials = (() => {
    const parts = clientName.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'ME';
  })();

  const launcherFrom = navy ? NAVY_ACTIVE : GREEN;
  const launcherTo = navy ? NAVY : GREEN_DARK;
  const launcherShadowRgb = navy ? '8,27,45' : '16,185,129';
  const accent = navy ? NAVY_ACTIVE : GREEN;
  const accentDark = navy ? NAVY : GREEN_DARK;
  const clientBubbleBg = navy ? '#e9edf2' : CLIENT_BUBBLE;
  const clientBubbleText = navy ? '#15283c' : '#065f46';
  const headerWash = navy ? '#edf1f5' : '#f0fdf4';

  const money = (n: number, ccy?: string | null) =>
    `${ccy ? ccy + ' ' : ''}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Only the newest assistant turn keeps live buttons. Older ones stay in the
  // transcript as text — a "Confirm Payment" button from six messages ago is a
  // trap, not a convenience.
  const liveBubbleId = (() => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].who === 'bot') return bubbles[i].id;
    }
    return -1;
  })();

  return (
    <>
      <style>{`
        /* ONE launcher, always mounted. It does not disappear when the panel
           opens — it becomes the close control, which is why its z-index sits
           ABOVE the panel rather than below it. Two buttons swapping places
           would animate as a flicker and lose keyboard focus; one button
           changing its icon does neither. */
        .pa-w-launcher {
          position: fixed; right: 24px; bottom: 24px; z-index: 1002;
          width: 56px; height: 56px; border-radius: 50%;
          border: none; cursor: pointer;
          background: linear-gradient(135deg, ${launcherFrom}, ${launcherTo});
          color: #fff;
          box-shadow: 0 10px 28px rgba(${launcherShadowRgb},.34), 0 2px 6px rgba(15,23,42,.12);
          display: flex; align-items: center; justify-content: center;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .pa-w-launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 14px 34px rgba(${launcherShadowRgb},.42); }
        .pa-w-launcher:focus-visible { outline: 3px solid ${launcherTo}; outline-offset: 3px; }
        /* The icon itself turns over rather than being cut to the other one —
           subtle, and it reads as the same control changing job. */
        .pa-w-launcher-icon { display: flex; animation: pa-w-turn .22s ease-out; }
        @keyframes pa-w-turn {
          from { opacity: 0; transform: rotate(-90deg) scale(.6); }
          to   { opacity: 1; transform: none; }
        }

        .pa-w-panel {
          position: fixed; right: 24px; bottom: 96px; z-index: 1001;
          width: 396px; height: min(620px, calc(100vh - 140px));
          background: #fff; border: 1px solid ${LINE}; border-radius: 16px;
          box-shadow: 0 24px 60px rgba(15,23,42,.18);
          display: flex; flex-direction: column; overflow: hidden;
          animation: pa-w-in .18s ease-out;
        }
        .pa-w-panel.pa-w-expanded { width: 560px; height: min(800px, calc(100vh - 120px)); }
        /* Closing is animated too, which is why the panel stays mounted for a
           beat after the press — see closeTimerRef in the component. */
        .pa-w-panel.pa-w-closing { animation: pa-w-out .16s ease-in forwards; pointer-events: none; }
        @keyframes pa-w-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pa-w-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px); } }

        .pa-w-thread { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .pa-w-bubble { max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }

        .pa-w-chip {
          border: 1px solid ${LINE}; background: #fff; color: ${MUTED};
          border-radius: 999px; padding: 7px 13px; font-size: 12.5px; font-weight: 600;
          cursor: pointer; transition: all .15s;
        }
        .pa-w-chip:hover:enabled { border-color: ${accent}; color: ${accent}; background: ${headerWash}; }
        .pa-w-chip:disabled { opacity: .55; cursor: not-allowed; }
        .pa-w-chip:focus-visible, .pa-w-act:focus-visible { outline: 2px solid ${accentDark}; outline-offset: 2px; }

        .pa-w-act {
          border: 1.5px solid ${accent}; background: #fff; color: ${accentDark};
          border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer; text-align: left; transition: all .15s;
        }
        .pa-w-act:hover:enabled { background: ${accent}; color: #fff; }
        .pa-w-act.pa-w-quiet { border-color: ${LINE}; color: ${MUTED}; }
        .pa-w-act.pa-w-quiet:hover:enabled { background: #f8fafc; color: ${INK}; border-color: #cbd5e1; }
        .pa-w-act:disabled { opacity: .55; cursor: not-allowed; }

        /* Three dots lifting in sequence — the shape people already read as
           "a reply is coming". */
        .pa-w-typing { display: inline-flex; align-items: center; gap: 5px; }
        .pa-w-typing i { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; display: block; animation: pa-w-dot 1.3s infinite ease-in-out; }
        .pa-w-typing i:nth-child(2) { animation-delay: .18s; }
        .pa-w-typing i:nth-child(3) { animation-delay: .36s; }
        @keyframes pa-w-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30%           { transform: translateY(-4px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pa-w-typing i { animation: none; opacity: .6; }
          .pa-w-panel, .pa-w-panel.pa-w-closing, .pa-w-launcher-icon { animation: none; }
          .pa-w-launcher { transition: none; }
        }

        /* Phones: a near-full-screen sheet rather than a floating card. The
           sheet stops short of the bottom so the launcher — now the close
           button — sits clear of it instead of covering the composer. */
        @media (max-width: 640px) {
          .pa-w-panel, .pa-w-panel.pa-w-expanded {
            right: 8px; left: 8px; bottom: 76px; top: 8px;
            width: auto; height: auto; border-radius: 14px;
          }
          .pa-w-launcher { right: 16px; bottom: 14px; width: 52px; height: 52px; }
          .pa-w-bubble { max-width: 88%; }
        }
      `}</style>

      {/* One button, two jobs. Closed it opens the panel; open it closes it.
          Never unmounted, so focus and the icon transition both survive. */}
      <button
        ref={openButtonRef}
        className="pa-w-launcher"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={open ? `Close ${ASSISTANT_NAME}` : `Need help? Ask ${ASSISTANT_NAME}`}
      >
        <span className="pa-w-launcher-icon" key={open ? 'close' : 'chat'} aria-hidden>
          {open ? <HiXMark size={26} /> : <HiChatBubbleLeftRight size={24} />}
        </span>
      </button>

      {open && (
        <section
          className={`pa-w-panel${expanded ? ' pa-w-expanded' : ''}${closing ? ' pa-w-closing' : ''}`}
          role="dialog"
          aria-label={sellerChat ? `Conversation with ${sellerChat.name}` : ASSISTANT_NAME}
        >
          {/* Header. Two contexts, two headers — the client should never be
              unsure whether they are talking to the assistant or to a person. */}
          <header style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderBottom: `1px solid ${LINE}`,
            background: sellerChat ? '#fff' : `linear-gradient(135deg, ${headerWash}, #ffffff)`,
            flexShrink: 0,
          }}>
            {sellerChat ? (
              <>
                <button
                  onClick={leaveSellerChat}
                  aria-label={`Back to ${ASSISTANT_NAME}`}
                  title={`Back to ${ASSISTANT_NAME}`}
                  style={iconBtn(false)}
                >
                  <HiArrowLeft size={18} aria-hidden />
                </button>
                {/* The seller's initials, not a robot — this is a person. */}
                <div aria-hidden style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: `linear-gradient(135deg, #0ea5e9, #0369a1)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}>
                  {personInitials(sellerChat.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: INK,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sellerChat.name}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{sellerChat.role}</div>
                </div>
              </>
            ) : (
              <>
                <div aria-hidden style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <RiRobot2Fill size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{ASSISTANT_NAME}</div>
                  <div style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>Invoices · Projects · Your seller</div>
                </div>

                <button
                  onClick={clearHistory}
                  disabled={busy || bubbles.length === 0}
                  aria-label="Start a new conversation"
                  title="Start a new conversation"
                  style={iconBtn(busy || bubbles.length === 0)}
                >
                  <HiOutlineTrash size={16} aria-hidden />
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              aria-label={expanded ? `Shrink ${ASSISTANT_NAME}` : `Expand ${ASSISTANT_NAME}`}
              aria-pressed={expanded}
              style={iconBtn(false)}
            >
              {expanded
                ? <HiArrowsPointingIn size={16} aria-hidden />
                : <HiArrowsPointingOut size={16} aria-hidden />}
            </button>
            {/* The header X and the floating X do the same thing — both call
                close(), so neither can leave the other out of step. */}
            <button onClick={close} aria-label={`Close ${ASSISTANT_NAME}`} style={iconBtn(false)}>
              <HiXMark size={18} aria-hidden />
            </button>
          </header>

          {/* Conversation */}
          <div
            className="pa-w-thread"
            ref={threadRef}
            onScroll={onThreadScroll}
            aria-live="polite"
            aria-busy={thinking || chatLoading}
          >
            {/* A real conversation with a person. No chips, no action buttons,
                no assistant avatar — none of those belong in someone else's
                thread, and the client is no longer talking to the assistant. */}
            {sellerChat && (
              <>
                {chatLoading && sellerChat.messages.length === 0 && (
                  <div style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', padding: '12px 0' }}>
                    Opening your conversation…
                  </div>
                )}

                {sellerChat.messages.map(m => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      flexDirection: m.mine ? 'row-reverse' : 'row',
                    }}
                  >
                    <div aria-hidden style={{
                      width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                      background: m.mine ? accentDark : 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10.5, fontWeight: 700,
                    }}>
                      {m.mine ? initials : personInitials(m.sender ?? sellerChat.name)}
                    </div>

                    <div style={{ maxWidth: '82%' }}>
                      {!m.mine && (m.sender || m.sender_role) && (
                        <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, margin: '0 0 3px 4px' }}>
                          {m.sender}{m.sender_role ? ` · ${m.sender_role}` : ''}
                        </div>
                      )}
                      <div
                        className="pa-w-bubble"
                        style={{
                          maxWidth: '100%',
                          background: m.mine ? clientBubbleBg : '#eff6ff',
                          color: m.mine ? clientBubbleText : '#1e3a5f',
                          borderTopLeftRadius: m.mine ? 14 : 4,
                          borderTopRightRadius: m.mine ? 4 : 14,
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {!sellerChat && bubbles.map(b => (
              <div key={b.id}>
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  flexDirection: b.who === 'client' ? 'row-reverse' : 'row',
                }}>
                  {b.who === 'bot' ? <BotAvatar accent={accent} accentDark={accentDark} /> : (
                    <div aria-hidden style={{
                      width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                      background: accentDark, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10.5, fontWeight: 700,
                    }}>{initials}</div>
                  )}
                  <div
                    className="pa-w-bubble"
                    style={{
                      background: b.who === 'client' ? clientBubbleBg : BOT_BUBBLE,
                      color: b.who === 'client' ? clientBubbleText : INK,
                      borderTopLeftRadius: b.who === 'client' ? 14 : 4,
                      borderTopRightRadius: b.who === 'client' ? 4 : 14,
                    }}
                  >
                    {b.text}
                  </div>
                </div>

                {b.invoice && <InvoiceCard invoice={b.invoice} money={money} accentDark={accentDark} />}
                {b.project && <ProjectCard project={b.project} accent={accent} />}

                {/* Buttons and chips only under the newest reply. */}
                {b.who === 'bot' && b.id === liveBubbleId && !!b.actions?.length && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 0 36px' }}>
                    {b.actions.map((a, i) => (
                      <button
                        key={`${a.action}-${i}`}
                        className={`pa-w-act${a.action === 'cancel' ? ' pa-w-quiet' : ''}`}
                        disabled={busy}
                        onClick={() => pressAction(a)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}

                {b.who === 'bot' && b.id === liveBubbleId && !!b.suggestions?.length && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 0 36px' }}>
                    {b.suggestions.map(s => (
                      <button key={s} className="pa-w-chip" disabled={busy} onClick={() => sendSuggestion(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Adding a card, in place. Stripe's own iframe — this component
                never sees a card number. */}
            {!sellerChat && cardForm && (
              <div style={{
                margin: '4px 0 0 36px', background: '#fff',
                border: `1px solid ${LINE}`, borderRadius: 12, padding: 12,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 8 }}>
                  Add a card
                </div>
                <AddCardInline
                  companyId={cardForm.companyId}
                  compact
                  onSaved={onCardSaved}
                  onCancel={() => {
                    setCardForm(null);
                    void run(() => clientAssistantService.act('cancel'));
                  }}
                />
              </div>
            )}

            {thinking && !sellerChat && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <BotAvatar accent={accent} accentDark={accentDark} />
                <div className="pa-w-bubble" style={{ background: BOT_BUBBLE, borderTopLeftRadius: 4 }}>
                  <span className="pa-w-typing" aria-hidden><i /><i /><i /></span>
                  {/* Read out instead of the dots, which mean nothing aloud. */}
                  <span style={{
                    position: 'absolute', width: 1, height: 1,
                    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
                  }}>
                    {ASSISTANT_NAME} is typing
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Composer. No paperclip: the assistant takes no attachments, and an
              icon that does nothing is worse than none. */}
          <form
            onSubmit={submit}
            style={{
              padding: 12, borderTop: `1px solid ${LINE}`, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={sellerChat
                ? `Message ${sellerChat.name}…`
                : 'Ask about an invoice, project or payment…'}
              disabled={busy}
              aria-label={sellerChat ? `Message ${sellerChat.name}` : `Message ${ASSISTANT_NAME}`}
              style={{
                flex: 1, minWidth: 0, padding: '10px 14px',
                border: `1.5px solid ${LINE}`, borderRadius: 999,
                fontSize: 13.5, color: INK, outline: 'none',
                background: busy ? '#f8fafc' : '#fff',
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
              style={{
                width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none',
                background: busy || !input.trim() ? BOT_BUBBLE : accent,
                color: busy || !input.trim() ? '#94a3b8' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <HiPaperAirplane size={16} style={{ transform: 'rotate(-45deg)' }} aria-hidden />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

/** "Sara Khan" -> "SK". Falls back to a neutral mark rather than "?" or "Unknown". */
function personInitials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '··';
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', padding: 4, borderRadius: 6,
    color: disabled ? '#cbd5e1' : MUTED,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center',
  };
}

/**
 * A bot mark rather than a photo of a person — the assistant is automated and
 * should say so honestly. An icon, so it scales cleanly and loads nothing.
 */
function BotAvatar({ accent = GREEN, accentDark = GREEN_DARK }: { accent?: string; accentDark?: string }) {
  return (
    <div aria-hidden style={{
      width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
      background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <RiRobot2Fill size={15} />
    </div>
  );
}

/** The invoice detail the reply referred to. Rendered from the server's values only. */
function InvoiceCard({
  invoice, money, accentDark = GREEN_DARK,
}: { invoice: AssistantInvoiceCard; money: (n: number, c?: string | null) => string; accentDark?: string }) {
  return (
    <div style={{
      margin: '8px 0 0 36px', background: '#fff', border: `1px solid ${LINE}`,
      borderRadius: 12, padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>
        Invoice #{invoice.invoice_number}
      </div>
      <Row label="Total" value={money(invoice.total_amount, invoice.currency)} />
      <Row label="Already paid" value={money(invoice.paid_amount, invoice.currency)} />
      {invoice.due_date && <Row label="Due date" value={invoice.due_date} />}
      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 6 }}>
        <Row label="Amount due" value={money(invoice.amount_due, invoice.currency)} strong accentDark={accentDark} />
      </div>
    </div>
  );
}

function ProjectCard({ project, accent = GREEN }: { project: AssistantProjectCard; accent?: string }) {
  return (
    <div style={{
      margin: '8px 0 0 36px', background: '#fff', border: `1px solid ${LINE}`,
      borderRadius: 12, padding: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>{project.name}</div>
      <Row label="Status" value={project.status.replace(/_/g, ' ')} />
      {project.deadline && <Row label="Deadline" value={project.deadline} />}
      {project.manager && <Row label="Looked after by" value={project.manager} />}
      <div
        role="progressbar"
        aria-valuenow={project.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${project.name} progress`}
        style={{ height: 6, borderRadius: 3, background: BOT_BUBBLE, marginTop: 8, overflow: 'hidden' }}
      >
        <div style={{ width: `${project.progress}%`, height: '100%', background: accent }} />
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{project.progress}% complete</div>
    </div>
  );
}

function Row({ label, value, strong, accentDark = GREEN_DARK }: { label: string; value: string; strong?: boolean; accentDark?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '3px 0' }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ color: strong ? accentDark : INK, fontWeight: strong ? 700 : 600, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

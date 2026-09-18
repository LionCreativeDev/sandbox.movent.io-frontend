"use client";

import { useEffect, useRef, useState } from "react";
import {
  HiCheckCircle,
  HiOutlineTrash,
  HiPaperAirplane,
} from "react-icons/hi2";
import { RiRobot2Fill } from "react-icons/ri";
import { getClientUser } from "@/lib/clientAuth";
import {
  clientService,
  AssistantState,
  AssistantInvoice,
} from "@/lib/services/clientService";
import toast from "react-hot-toast";

const GREEN = "#10b981";

// ── Assistant chat palette ───────────────────────────────────────────────────
// A blue conversation surface, matching the agreed design: one rounded,
// blue-bordered container, tinted bubbles either side, dark-navy avatar for the
// client. GREEN above stays the portal's action colour so the buttons still
// read as the Client Portal's, not a second brand.
const BLUE = "#0aa473"; // container border + send control
const BUBBLE = "#e7f0fd"; // message background, both speakers
const INK = "#14284a"; // message text
const LINE = "#dbe7f8"; // hairlines on the blue surface
const NAVY = "#0aa473"; // client avatar

/**
 * How close to the bottom still counts as "reading the latest".
 *
 * Generous enough to survive the sub-pixel rounding a smooth scroll lands on,
 * tight enough that someone who has genuinely scrolled up to re-read an invoice
 * is not dragged back down.
 */
const NEAR_BOTTOM_PX = 80;

/**
 * Every bubble carries its own id.
 *
 * Not the array index: bubbles are REMOVED from the middle of the thread (the
 * "Please confirm the payment" ask retires once the payment lands), which
 * shifts every index after it. With index keys React then matches the wrong
 * old node to the wrong new bubble and repaints the tail of the conversation —
 * the flicker where messages appeared to jump or briefly show the wrong text.
 */
type Bubble = { id: number } & BubbleBody;

type BubbleBody =
  // `tag` marks a bubble the conversation may need to find again later.
  // "confirm-prompt" is the "Please confirm the payment" ask: once the payment
  // actually goes through, that line is stale and misleading, so it is removed
  // rather than left sitting above the result. Matching on a tag instead of on
  // the message text means a reworded prompt cannot quietly stop being found.
  | { who: "bot"; text: string; tag?: "confirm-prompt" | "success" }
  | { who: "client"; text: string }
  | { who: "bot"; card: AssistantInvoice };

/**
 * The Client Portal Payment Assistant.
 *
 * A thin view over the server's state machine. It holds no company, invoice or
 * amount of its own: every action returns the whole assistant state and this
 * renders it. That is deliberate — nothing the browser believes may influence
 * a charge.
 *
 * The final step
 *
 *
 *  is a handoff, not a charge. Confirm asks the server to
 * re-validate and hand back an invoice id; the actual payment then runs through
 * the EXISTING gateway endpoints the Pay page already uses, so the card is
 * entered on the gateway's own hosted page and settlement, receipts,
 * notifications and automatic project creation all happen exactly as they do
 * for the public invoice link.
 */
export default function PaymentAssistantPage() {
  const [state, setState] = useState<AssistantState | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Separate from `busy` on purpose: `busy` also covers handing the browser to
  // the gateway's hosted page, where the assistant is not composing anything
  // and a "typing" bubble would be a lie. This is only ever true while a reply
  // is actually being prepared.
  //
  // Starts true because the first thing this page does is ask the server for
  // the opening state — so the dots are already there on mount, with no
  // setState in the effect body for the compiler lint to object to.
  const [thinking, setThinking] = useState(true);
  const [unpaid, setUnpaid] = useState<AssistantInvoice[] | null>(null);
  const [needsPaymentMethod, setNeedsPaymentMethod] = useState(false);
  // Only for the avatar initials — read once on mount so this component never
  // touches storage during render.
  const [clientUser, setClientUser] = useState<{ name?: string } | null>(null);
  // The conversation's own scroll container (.pa-thread). All auto-scrolling
  // happens on this element and nowhere else — the page itself is never moved.
  const threadRef = useRef<HTMLDivElement>(null);
  // True while the client is reading the newest messages. Starts true: an
  // empty thread is already at its bottom.
  const pinnedToBottomRef = useRef(true);
  // What the thread held on the previous render, so the effect below can tell
  // an addition from any other state change.
  const threadContentRef = useRef({
    bubbles: 0,
    unpaid: false,
    needsPaymentMethod: false,
    thinking: false,
  });
  // Opened once per mount — see the note in the mount effect below.
  const openedRef = useRef(false);

  // Monotonic, never reused — so a bubble keeps the same key for its whole
  // life even as others are added or removed around it.
  const nextBubbleId = useRef(0);
  const say = (b: BubbleBody) =>
    setBubbles((prev) => [...prev, { ...b, id: ++nextBubbleId.current }]);

  /** Apply a server response: its message, and its invoice card when one is in view. */
  const apply = (next: AssistantState, showCard = true) => {
    setState(next);
    if (next.message)
      say({
        who: "bot",
        text: next.message,
        // A message that arrives alongside saved cards IS the confirm ask —
        // tagged here, at the one place the whole response is in hand, so the
        // success path below can retire it without matching on its wording.
        tag: next.saved_methods?.length ? "confirm-prompt" : undefined,
      });
    if (showCard && next.invoice) say({ who: "bot", card: next.invoice });
    if (next.already_paid && next.payment) {
      const when = next.payment.paid_at ? ` on ${next.payment.paid_at}` : "";
      const ref = next.payment.reference
        ? ` · Ref ${next.payment.reference}`
        : "";
      say({ who: "bot", text: `Paid ${next.payment.amount}${when}${ref}` });
    }
  };

  useEffect(() => {
    // queueMicrotask: getClientUser() reads storage, and setting state
    // synchronously inside an effect is rejected by the compiler lint. Same
    // pattern as frontend/app/invoices/new/page.tsx.
    queueMicrotask(() =>
      setClientUser(getClientUser() as { name?: string } | null),
    );

    // React StrictMode runs every effect twice in development. Without this
    // guard the assistant opened TWICE on load: two GET requests (two audit
    // rows), and the welcome message rendered twice — the duplicate messages
    // and repeated API calls this page was showing.
    if (openedRef.current) return;
    openedRef.current = true;

    clientService.assistant
      .open()
      .then((s) => apply(s))
      .catch(() =>
        say({
          who: "bot",
          text: "The Payment Assistant is unavailable right now. Please try again shortly.",
        }),
      )
      .finally(() => setThinking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keep the thread following the conversation — the THREAD, not the page.
   *
   * This used to be `endRef.scrollIntoView()`, which was the bug: scrollIntoView
   * scrolls EVERY scrollable ancestor, so alongside the thread it also scrolled
   * the document to bring that element into the viewport. The whole page jumped.
   * `el.scrollTo()` moves only the element it is called on.
   *
   * It also fired on any of [bubbles, unpaid, panels, thinking] changing —
   * and run() resets panels on every request — so a single message triggered
   * three or four competing smooth page-scrolls. Now it fires
   * only when the thread's content actually GREW, and never when the typing
   * indicator disappears or a panel closes.
   *
   * And it respects the reader: if the client has scrolled up to re-read
   * something, nothing drags them back down.
   */
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;

    const prev = threadContentRef.current;
    const now = {
      bubbles: bubbles.length,
      unpaid: unpaid !== null,
      needsPaymentMethod,
      thinking,
    };
    threadContentRef.current = now;

    // Each trigger is a real addition to the thread, never a generic state
    // change: a message arrived, a panel opened, or the assistant started
    // composing. A panel closing or the dots vanishing is not one of them.
    const grew =
      now.bubbles > prev.bubbles ||
      (now.unpaid && !prev.unpaid) ||
      (now.needsPaymentMethod && !prev.needsPaymentMethod) ||
      (now.thinking && !prev.thinking);

    if (!grew || !pinnedToBottomRef.current) return;

    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [bubbles, unpaid, needsPaymentMethod, thinking]);

  /**
   * Whether the client is still reading the newest part of the conversation.
   *
   * Held in a ref and updated from the thread's own scroll event: it must not
   * re-render the thread (a state update per scroll frame would be its own
   * source of jank), and the effect above only ever reads it.
   *
   * Content growing does not fire a scroll event, so the value the effect reads
   * is the one from BEFORE the new message was added — which is exactly the
   * question being asked: was the client at the bottom when it arrived?
   */
  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;

    pinnedToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  const run = async (fn: () => Promise<AssistantState>, showCard = true) => {
    setBusy(true);
    setThinking(true);
    setUnpaid(null);
    setNeedsPaymentMethod(false);
    try {
      apply(await fn(), showCard);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      say({
        who: "bot",
        text:
          ex.response?.data?.message ||
          "Something went wrong. Please try again.",
      });
    } finally {
      // Cleared in the same tick the reply is applied, so the indicator is
      // gone by the time the answer paints — never both on screen at once.
      setThinking(false);
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    say({ who: "client", text });
    setInput("");
    run(() => clientService.assistant.send(text));
  };

  /**
   * Clear History — empties the visible thread and starts a new conversation.
   *
   * Nothing is deleted. The thread only ever existed here, in `bubbles`; the
   * server's permanent activity trail is untouched and simply continues under a
   * new conversation id, which is why this is a POST rather than a DELETE. The
   * local state is cleared first so the screen empties immediately, then the
   * server's fresh welcome lands in the empty thread.
   */
  const clearHistory = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Clear this conversation? Your messages will be removed from this screen. Your invoices, payments and receipts are not affected.",
      )
    )
      return;

    setBusy(true);
    setThinking(true);
    setBubbles([]);
    setUnpaid(null);
    setNeedsPaymentMethod(false);
    try {
      apply(await clientService.assistant.clearHistory());
    } catch {
      say({
        who: "bot",
        text: "Could not clear the conversation. Please try again.",
      });
    } finally {
      setThinking(false);
      setBusy(false);
    }
  };

  const showUnpaid = async () => {
    setBusy(true);
    setThinking(true);
    setNeedsPaymentMethod(false);
    try {
      const res = await clientService.assistant.unpaid();
      setUnpaid(res.invoices);
      if (res.invoices.length === 0)
        say({
          who: "bot",
          text: "You have no unpaid invoices for this company.",
        });
    } catch {
      say({ who: "bot", text: "Could not load your unpaid invoices." });
    } finally {
      setThinking(false);
      setBusy(false);
    }
  };

  /**
   * Opens hosted setup for a saved payment method. This stores a card token for
   * later saved-card payment; it does not pay the invoice.
   */
  const startPaymentMethodSetup = async () => {
    const companyId = state?.company?.id;
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await clientService.paymentMethods.startSetup(companyId);

      try {
        sessionStorage.setItem("pm_company_id", String(companyId));
      } catch {
        /* private mode */
      }

      if (res.navigation === "redirect") {
        window.location.assign(res.action);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = res.action;
      Object.entries(res.fields ?? {}).forEach(([k, v]) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = String(v);
        form.appendChild(i);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(
        ex.response?.data?.message ||
          "Could not open the payment method setup page.",
      );
      setBusy(false);
    }
  };

  /**
   * Confirm → re-validate server-side → charge saved card or ask for one.
   */
  const confirm = async () => {
    setBusy(true);
    setThinking(true);
    setUnpaid(null);
    try {
      const next = await clientService.assistant.confirm();
      apply(next, false);

      if (!next.checkout_invoice_id) return; // already paid, or nothing in view

      // A card already on file? Then the client confirms against that instead
      // of going back through the hosted page. Still not a charge — that is
      // payWithSaved() below, a separate press.
      if (next.saved_methods && next.saved_methods.length > 0) return;

      setNeedsPaymentMethod(true);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      say({
        who: "bot",
        text:
          ex.response?.data?.message ||
          "Could not start the payment. Please try again.",
      });
    } finally {
      setThinking(false);
      setBusy(false);
    }
  };

  /** The explicit final step for a saved card — this is what charges. */
  const payWithSaved = async (methodId: number) => {
    setBusy(true);
    setThinking(true);
    try {
      const next = await clientService.assistant.payWithSaved(methodId);

      if (next.paid) {
        // The money moved. Whatever wording the server sent back, the client
        // needs one unambiguous line here — and the "Please confirm the
        // payment" ask above it is now false, so it is retired rather than
        // left on screen contradicting the result.
        setState(next);
        setNeedsPaymentMethod(false);
        setBubbles((prev) =>
          prev.filter((b) => !("tag" in b && b.tag === "confirm-prompt")),
        );
        say({ who: "bot", text: "Payment Successful", tag: "success" });

        if (next.payment?.reference) {
          say({
            who: "bot",
            text: `Transaction ID: ${next.payment.reference}`,
          });
        }
      } else {
        // Declined or blocked — the server's own reason is the useful message.
        apply(next, false);
      }
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      say({
        who: "bot",
        text:
          ex.response?.data?.message ||
          "Your payment could not be completed. Please try another method.",
      });
    } finally {
      setThinking(false);
      setBusy(false);
    }
  };

  const money = (n: number, ccy?: string | null) =>
    `${ccy ? ccy + " " : ""}${Number(n).toLocaleString()}`;

  // Panels that sit inside the conversation (invoice card, unpaid list,
  // payment panels). White on the tinted thread so they read as content the
  // assistant produced rather than as another message.
  const card: React.CSSProperties = {
    background: "#fff",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: 16,
  };

  const btn = (primary = false): React.CSSProperties => ({
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? "not-allowed" : "pointer",
    border: primary ? "none" : `1.5px solid ${LINE}`,
    background: primary ? GREEN : "#fff",
    color: primary ? "#fff" : "#475569",
    opacity: busy ? 0.6 : 1,
  });

  // Initials for the client's own avatar, from the signed-in portal user.
  const initials = (() => {
    const name = (clientUser?.name ?? "").trim();
    if (!name) return "ME";
    const parts = name.split(/\s+/).filter(Boolean);

    return (
      ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "ME"
    );
  })();

  return (
    <div style={{ maxWidth: "100%" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 4,
        }}
      >
        Payment Assistant
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Enter an invoice number to review and pay it.
        {state?.company?.name ? ` You're paying ${state.company.name}.` : ""}
      </p>

      {/* One rounded, blue-bordered container holding the whole conversation —
          the shape from the agreed design. Percentage widths and wrapping
          throughout, plus the media query below, keep it usable down to a
          phone. */}
      <style>{`
        .pa-shell { border-radius: 10px; border: 2px solid ${BLUE}; background: #fff; overflow: hidden; }
        .pa-thread { padding: 24px; min-height: 320px; max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
        .pa-bubble { max-width: 78%; }
        .pa-avatar { width: 44px; height: 44px; flex-shrink: 0; }
        /* Typing indicator — three dots lifting in sequence, the shape people
           already read as "a reply is coming". */
        .pa-typing { display: inline-flex; align-items: center; gap: 5px; padding: 4px 2px; }
        .pa-typing i { width: 7px; height: 7px; border-radius: 50%; background: #7f97b8; display: block; animation: pa-dot 1.3s infinite ease-in-out; }
        .pa-typing i:nth-child(2) { animation-delay: .18s; }
        .pa-typing i:nth-child(3) { animation-delay: .36s; }
        @keyframes pa-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30%           { transform: translateY(-4px); opacity: 1; }
        }
        /* Motion is decoration here — the bubble alone still says "working". */
        @media (prefers-reduced-motion: reduce) {
          .pa-typing i { animation: none; opacity: .6; }
        }
        @media (max-width: 560px) {
          .pa-thread { padding: 16px; gap: 14px; }
          .pa-bubble { max-width: 100%; }
          .pa-avatar { width: 34px; height: 34px; }
          .pa-shell { border-radius: 16px; }
        }
      `}</style>

      <div className="pa-shell">
        {/* Conversation */}
        <div className="pa-thread" ref={threadRef} onScroll={onThreadScroll}>
          {bubbles.map((b) =>
            "card" in b ? (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <BotAvatar />
                <div style={{ ...card, flex: 1, maxWidth: "78%" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15,
                      color: INK,
                      marginBottom: 10,
                    }}
                  >
                    Invoice #{b.card.invoice_number}
                  </div>
                  <Row label="Company" value={b.card.company_name ?? "—"} />
                  <Row
                    label="Invoice Date"
                    value={b.card.invoice_date ?? "—"}
                  />
                  <Row label="Due Date" value={b.card.due_date ?? "—"} />
                  <Row
                    label="Total"
                    value={money(b.card.total_amount, b.card.currency)}
                  />
                  <Row
                    label="Already Paid"
                    value={money(b.card.paid_amount, b.card.currency)}
                  />
                  <div
                    style={{
                      borderTop: `1px solid ${LINE}`,
                      marginTop: 8,
                      paddingTop: 8,
                    }}
                  >
                    <Row
                      label="Amount Due"
                      value={money(b.card.amount_due, b.card.currency)}
                      strong
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Bot on the left with its avatar, client on the right with
              // theirs — the layout from the design. Both bubbles share the
              // same tint; who is speaking is shown by side and avatar rather
              // than by two competing colours.
              <div
                key={b.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  flexDirection: b.who === "client" ? "row-reverse" : "row",
                  justifyContent: "flex-start",
                }}
              >
                {b.who === "client" ? (
                  <div
                    className="pa-avatar"
                    aria-hidden
                    style={{
                      borderRadius: "50%",
                      background: NAVY,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    {initials}
                  </div>
                ) : (
                  <BotAvatar />
                )}

                <div
                  className="pa-bubble"
                  style={{
                    padding: "14px 20px",
                    // Slightly squared on the side the avatar sits, so the
                    // bubble points at its speaker.
                    borderRadius: 18,
                    borderTopLeftRadius: b.who === "client" ? 18 : 6,
                    borderTopRightRadius: b.who === "client" ? 6 : 18,
                    fontSize: "tag" in b && b.tag === "success" ? 16 : 15,
                    lineHeight: 1.6,
                    // The one outcome the client came here for gets its own
                    // colour. Every other bubble keeps the shared tint, so
                    // this reads as a result rather than as another message.
                    background:
                      "tag" in b && b.tag === "success" ? "#ecfdf5" : BUBBLE,
                    color: "tag" in b && b.tag === "success" ? "#047857" : INK,
                    fontWeight: "tag" in b && b.tag === "success" ? 700 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {"tag" in b && b.tag === "success" && (
                    <HiCheckCircle size={20} style={{ flexShrink: 0 }} />
                  )}
                  {b.text}
                </div>
              </div>
            ),
          )}

          {/* Company picker (more than one company) */}
          {state?.state === "company_selection" &&
            state.companies.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {state.companies.map((c) => (
                  <button
                    key={c.company_id}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        clientService.assistant.selectCompany(c.company_id),
                      )
                    }
                    style={btn()}
                  >
                    {c.company_name ?? `Company ${c.company_id}`}
                    {c.unpaid_count > 0 && (
                      <span style={{ color: GREEN }}>
                        {" "}
                        · {c.unpaid_count} unpaid
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

          {/* Unpaid list */}
          {unpaid && unpaid.length > 0 && (
            <div style={{ ...card }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                UNPAID INVOICES
              </div>
              {unpaid.map((i) => (
                <button
                  key={i.id}
                  disabled={busy}
                  onClick={() =>
                    run(() => clientService.assistant.selectInvoice(i.id))
                  }
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    alignItems: "center",
                    padding: "9px 0",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "none",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    #{i.invoice_number}
                  </span>
                  <span style={{ color: GREEN, fontWeight: 700 }}>
                    {money(i.amount_due, i.currency)} due
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Saved card confirmation. The client sees exactly what will be
              charged and to which card before the one press that does it. */}
          {state?.saved_methods && state.saved_methods.length > 0 && (
            <div style={{ ...card }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                PAYMENT DETAILS
              </div>
              {state.invoice && (
                <>
                  <Row
                    label="Invoice"
                    value={`#${state.invoice.invoice_number}`}
                  />
                  <Row
                    label="Amount"
                    value={money(
                      state.amount_due ?? state.invoice.amount_due,
                      state.invoice.currency,
                    )}
                    strong
                  />
                </>
              )}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {state.saved_methods.map((m) => (
                  <button
                    key={m.id}
                    disabled={busy}
                    onClick={() => payWithSaved(m.id)}
                    style={{ ...btn(true), textAlign: "left" }}
                  >
                    Confirm Payment · {m.label}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={startPaymentMethodSetup}
                  style={btn()}
                >
                  Add or change payment method
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
                Your card is held securely by the payment provider. We never
                store your card number.
              </div>
            </div>
          )}

          {/* Payment method setup — no direct one-off checkout here. */}
          {needsPaymentMethod && (
            <div style={{ ...card }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 4,
                }}
              >
                PAYMENT METHOD REQUIRED
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                {state?.invoice && (
                  <>
                    Paying{" "}
                    <strong style={{ color: INK }}>
                      {money(
                        state.amount_due ?? state.invoice.amount_due,
                        state.invoice.currency,
                      )}
                    </strong>{" "}
                    for invoice #{state.invoice.invoice_number}.{" "}
                  </>
                )}
                Add a payment method first. After it is saved, return here and
                pay with the saved card.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  disabled={busy}
                  onClick={startPaymentMethodSetup}
                  style={btn(true)}
                >
                  Add Payment Method
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
                No charge is made while adding a payment method.
              </div>
            </div>
          )}

          {/* Typing indicator — on screen only while a reply is being
              prepared, and gone in the same tick the reply is applied, so the
              two are never both visible. It sits last in the thread so the
              dots appear exactly where the answer will. */}
          {thinking && (
            <div
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              aria-live="polite"
            >
              <BotAvatar />
              <div
                className="pa-bubble"
                style={{
                  padding: "14px 20px",
                  borderRadius: 18,
                  borderTopLeftRadius: 6,
                  background: BUBBLE,
                }}
              >
                <span className="pa-typing" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {/* Read out instead of the dots, which mean nothing aloud. */}
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Payment Assistant is typing
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {state?.state === "invoice_found" && state.invoice?.is_payable && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "14px 20px",
              borderTop: `1px solid ${LINE}`,
              flexWrap: "wrap",
            }}
          >
            <button disabled={busy} onClick={confirm} style={btn(true)}>
              Pay Invoice
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => clientService.assistant.reset())}
              style={btn()}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Composer — the rounded input from the design, with the send control
            as a circular button inside it. No paperclip: the assistant takes
            no attachments, and an icon that does nothing is worse than none. */}
        {state && state.state !== "company_selection" && (
          <div style={{ padding: "16px 20px 20px" }}>
            <form
              onSubmit={submit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 6px 6px 18px",
                border: `1.5px solid ${LINE}`,
                borderRadius: 30,
                background: "#fff",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your invoice number, e.g. INV-1025"
                disabled={busy}
                aria-label="Message the Payment Assistant"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 0",
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  color: INK,
                  background: "transparent",
                }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                style={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "none",
                  background: busy || !input.trim() ? BUBBLE : BLUE,
                  color: busy || !input.trim() ? "#8fb3e6" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                }}
              >
                <HiPaperAirplane
                  size={18}
                  style={{ transform: "rotate(-45deg)" }}
                />
              </button>
            </form>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              {/* The two conversation actions, paired behind one hairline so
                  they read as a single quiet control group rather than two
                  competing buttons. Clear History is deliberately the muted
                  one: it is the less common action and undoes what is on
                  screen, so it should not compete with the primary link. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={showUnpaid}
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    color: BLUE,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  View unpaid invoices
                </button>

                <span
                  aria-hidden
                  style={{ width: 1, height: 14, background: LINE }}
                />

                <button
                  type="button"
                  disabled={busy || bubbles.length === 0}
                  onClick={clearHistory}
                  title="Clear this conversation from your screen"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    border: "none",
                    background: "none",
                    padding: 0,
                    color: bubbles.length === 0 ? "#cbd5e1" : "#8296b4",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor:
                      busy || bubbles.length === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <HiOutlineTrash size={14} />
                  Clear history
                </button>
              </div>

              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                You&apos;ll always see the amount and confirm before anything is
                charged.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The assistant's avatar — a bot mark rather than a photo of a person.
 *
 * A stock face would imply someone is reading and replying, which is not what
 * happens here: the assistant is rule-based and answers deterministically. A
 * robot says "automated" honestly and scales cleanly at any size, so it is an
 * icon rather than a raster image (nothing to load, nothing to go blurry).
 *
 * Solid BLUE rather than a gradient so it follows the palette constant if that
 * is ever retuned, instead of drifting against a hardcoded second colour.
 */
function BotAvatar() {
  return (
    <div
      className="pa-avatar"
      aria-hidden
      style={{
        borderRadius: "50%",
        background: BLUE,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <RiRobot2Fill size={22} />
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        fontSize: 14,
        padding: "4px 0",
      }}
    >
      <span style={{ color: "#6b7f9e" }}>{label}</span>
      <span
        style={{
          color: strong ? GREEN : INK,
          fontWeight: strong ? 700 : 600,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

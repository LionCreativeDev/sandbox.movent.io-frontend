// One rule for "who sent this chat message", used by every chat screen.
//
// A ChatMessage has three possible senders and they are mutually exclusive:
//   sender_admin_id  → a Company Admin
//   sender_id        → a staff User (or a client-portal login)
//   guest_sender_name→ an unregistered customer writing through the public
//                      invoice link ("Chat with Seller")
//
// That third case is why this helper exists: the guest messages created
// around invoice payment get migrated into the project's own thread (see
// PaymentProjectStartService::migrateChatHistory()), so the same
// conversation surfaces on Sales Chat, the project chat and the client
// portal. Each of those screens used to re-implement this logic on its own —
// fourteen copies, six of which never checked guest_sender_name at all — so
// the same message read as the real name on some screens and "Unknown" / "—"
// / "Client" on others.
//
// The fallback below is genuinely unreachable while any of the three fields
// is set. It is not a "we couldn't be bothered to look" value: it only shows
// when the sender record is really gone.

import { roleDisplayLabel } from './roleUtils';

export interface ChatSenderLike {
  sender?: { name?: string | null } | null;
  sender_admin?: { name?: string | null } | null;
  guest_sender_name?: string | null;
}

export interface ChatSenderOptions {
  /** Render a Company Admin as "Name (Admin)" — distinguishes staff from the
   *  client in client-facing conversations. */
  adminSuffix?: boolean;
  /** Render a guest as "Name (via invoice link)" — marks messages that came
   *  in through the public invoice page rather than from a real account. */
  guestSuffix?: boolean;
  /** Shown only when no sender record exists at all. */
  fallback?: string;
}

export function chatSenderName(
  message: ChatSenderLike,
  { adminSuffix = false, guestSuffix = false, fallback = 'Deleted user' }: ChatSenderOptions = {},
): string {
  const adminName = message.sender_admin?.name;
  if (adminName) {
    return adminSuffix ? `${adminName} (Admin)` : adminName;
  }

  const userName = message.sender?.name;
  if (userName) {
    return userName;
  }

  const guestName = message.guest_sender_name;
  if (guestName) {
    return guestSuffix ? `${guestName} (via invoice link)` : guestName;
  }

  return fallback;
}

// ── Client portal ───────────────────────────────────────────────────────────
// The portal labels a conversation differently from every internal screen: the
// client is the viewer, so their own name is noise, and the staff member's
// personal name is more than the client needs — what matters is which side of
// the company they're hearing from. So: own messages read "You", staff
// messages read their role ("Admin" / "Seller" / "Lead Manager").

export interface ClientPortalSenderLike extends ChatSenderLike {
  sender?: {
    name?: string | null;
    role_type?: string | null;
    custom_role_label?: string | null;
  } | null;
}

/**
 * Is this message the viewing client's own?
 *
 * Two shapes count, and missing the second is a real bug: a message with no
 * sender/sender_admin but a guest_sender_name IS the client's own, written
 * through the public invoice page's "Chat with Seller" before they had portal
 * access (PublicInvoiceChatController sets guest_sender_name from the
 * invoice's own client/customer name) and later moved into this thread by
 * PaymentProjectStartService::migrateChatHistory(). Treating it as somebody
 * else's put the client's own words on the stranger's side of the thread.
 */
export function isOwnClientMessage(message: ClientPortalSenderLike): boolean {
  if (message.sender_admin) return false;
  if (message.sender) return message.sender.role_type === 'client';
  return !!message.guest_sender_name;
}

/**
 * Display name for one message inside the client portal.
 *
 * Deliberately shows no staff personal name — a role is what the client is
 * told. `roleDisplayLabel` is reused so a user on a custom role shows that
 * custom label rather than the generic bucket it inherits behaviour from, and
 * so these strings stay identical to the roles shown everywhere else.
 */
export function clientPortalSenderName(message: ClientPortalSenderLike): string {
  if (isOwnClientMessage(message)) return 'You';

  // A Company Admin is not a `users` row and so has no role_type to look up.
  if (message.sender_admin?.name || message.sender_admin) return 'Admin';

  if (message.sender) {
    const label = roleDisplayLabel(message.sender);
    // roleDisplayLabel returns '—' for a sender with no role at all; the
    // person's name is a better answer than a dash.
    if (label && label !== '—') return label;
    return message.sender.name || 'Deleted user';
  }

  return 'Deleted user';
}

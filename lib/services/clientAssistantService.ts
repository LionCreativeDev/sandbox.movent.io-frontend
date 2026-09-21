import clientApi from '@/lib/clientAxios';

// ── "AI Assistance" — the Client Portal's floating assistant ─────────────────
//
// A thin transport over /client/assistant. It holds no state and makes no
// decisions: every reply is composed server-side, already authorized, and this
// only carries it. Nothing here may ever decide which invoice, which card or
// which company — those are re-resolved against the session on every request
// (see Api\Client\AssistantController).

/** A transactional button. Distinct from `suggestions`, which are plain chips. */
export interface AssistantAction {
  type: 'button';
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

/** The invoice card the widget renders inline. Brand-safe values only. */
export interface AssistantInvoiceCard {
  id: number;
  invoice_number: string;
  company_name?: string | null;
  currency?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  total_amount: number;
  paid_amount: number;
  amount_due: number;
  status: string;
  is_payable: boolean;
}

export interface AssistantProjectCard {
  id: number;
  name: string;
  status: string;
  company_name?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  manager?: string | null;
  progress: number;
  open_tasks: number;
}

export interface AssistantSavedMethod {
  id: number;
  label: string;
  is_default: boolean;
}

/**
 * One assistant turn.
 *
 * `message`/`suggestions`/`actions` are what the brief calls for. The rest are
 * render hints and side-channel instructions the widget acts on:
 *   - open_chat       → navigate into the existing project conversation
 *   - open_card_setup → start the existing hosted card-setup flow
 */
export interface AssistantTurn {
  message?: string;
  suggestions?: string[];
  actions?: AssistantAction[];
  conversation_id?: string;
  invoice?: AssistantInvoiceCard;
  project?: AssistantProjectCard;
  payment_methods?: AssistantSavedMethod[];
  summary?: {
    paid_count: number;
    due_count: number;
    total_due: number;
    currency?: string | null;
  };
  open_chat?: { project_id: number; url: string };
  /**
   * Add a card INSIDE the widget — Stripe Elements in place, no redirect.
   * This is the normal path; open_card_setup below is the fallback for a
   * gateway that can only vault a card through its own hosted page.
   */
  open_card_form?: { company_id: number };
  open_card_setup?: { company_id: number };
  /**
   * The seller hand-off. From here the widget shows a real conversation with a
   * person — see clientSellerChatService. The assistant is not in that thread.
   */
  open_seller_chat?: { thread_id: number; name?: string; role?: string };
  paid?: boolean;
  cleared?: boolean;
  resumed?: boolean;
  transcript?: AssistantTranscriptRow[];
}

/** A stored bubble, replayed when the widget remounts or the tab is refreshed. */
export interface AssistantTranscriptRow {
  id: number;
  role: 'client' | 'assistant';
  content: string;
  payload?: Omit<AssistantTurn, 'message' | 'transcript'> | null;
}

export const clientAssistantService = {
  /** Opens the widget. Returns a stored thread when one is in progress. */
  open: async (): Promise<AssistantTurn> =>
    (await clientApi.get('/client/assistant')).data.data,

  /** Free text the client typed. */
  send: async (text: string): Promise<AssistantTurn> =>
    (await clientApi.post('/client/assistant/message', { text })).data.data,

  /**
   * A button press. `label` is only the wording echoed into the transcript as
   * the client's own turn — it never selects behaviour, which comes from
   * `action` and is matched against a fixed list server-side.
   */
  act: async (
    action: string,
    payload: Record<string, unknown> = {},
    label?: string,
  ): Promise<AssistantTurn> =>
    (await clientApi.post('/client/assistant/action', { action, payload, label })).data.data,

  /** Start a fresh conversation. Deletes nothing — see the controller. */
  clear: async (): Promise<AssistantTurn> =>
    (await clientApi.post('/client/assistant/clear')).data.data,
};

/**
 * The one definition of WHAT a payment receipt shows.
 *
 * Client Portal → Documents and Admin → Clients → Invoice Receipts both read
 * this, so neither can end up more (or less) detailed than the other — only the
 * container around these fields differs. It is also kept in step with the
 * receipt image itself, which App\Services\PaymentReceiptService renders from
 * the same facts in the same order.
 *
 * A field with no value is omitted rather than rendered as "—": a receipt row
 * reading "Transaction ID: —" tells nobody anything.
 */

export interface ReceiptFacts {
  invoice_number: string;
  invoice_status: string;
  currency?: string | null;
  paid_amount: number;
  payment_status?: string | null;
  payment_date?: string | null;
  method?: string | null;
  gateway?: string | null;
  reference?: string | null;
  converted?: string | null;
  client_name?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  card: 'Card',
  cheque: 'Cheque',
  gateway: 'Online Payment',
};

/** "Card · Stripe" — whichever of the two the payment row actually carries. */
export const receiptMethodLabel = (r: ReceiptFacts): string | null => {
  const method = r.method ? (METHOD_LABELS[r.method] ?? r.method) : null;
  const gateway = r.gateway ? r.gateway.charAt(0).toUpperCase() + r.gateway.slice(1) : null;

  return [method, gateway].filter(Boolean).join(' · ') || null;
};

export const receiptMoney = (amount: number, currency?: string | null): string =>
  `${currency ? currency + ' ' : ''}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export interface ReceiptField {
  label: string;
  value: string;
  /** The headline figure — rendered larger/greener by both callers. */
  strong?: boolean;
  /** A gateway reference, shown in a monospace face so it can be read back. */
  mono?: boolean;
}

/**
 * The three facts that identify a receipt at a glance: which invoice, how much,
 * when. For places that list receipts among other things — the Client Portal's
 * Documents table — where the full set was simply too much to read in a row.
 *
 * Everything else is one click away on the receipt itself, so nothing is lost
 * by leaving it out here.
 */
export function receiptSummary(r: ReceiptFacts): string[] {
  return [
    `Invoice #${r.invoice_number}`,
    receiptMoney(r.paid_amount, r.currency),
    r.payment_date ?? '',
  ].filter(Boolean);
}

/**
 * The receipt's fields, in reading order. Invoice number leads because it is
 * what anyone scanning a list of receipts is looking for.
 */
export function receiptFields(r: ReceiptFacts): ReceiptField[] {
  const rows: (ReceiptField | null)[] = [
    { label: 'Invoice Number', value: `#${r.invoice_number}` },
    r.client_name ? { label: 'Client Name', value: r.client_name } : null,
    { label: 'Paid Amount', value: receiptMoney(r.paid_amount, r.currency), strong: true },
    r.payment_date ? { label: 'Payment Date', value: r.payment_date } : null,
    (() => {
      const method = receiptMethodLabel(r);
      return method ? { label: 'Payment Method', value: method } : null;
    })(),
    r.reference ? { label: 'Transaction ID', value: r.reference, mono: true } : null,
    r.payment_status
      ? { label: 'Payment Status', value: r.payment_status.charAt(0).toUpperCase() + r.payment_status.slice(1) }
      : null,
    // Only when the gateway was charged in a currency other than the invoice's.
    r.converted ? { label: 'Charged As', value: r.converted } : null,
  ];

  return rows.filter((f): f is ReceiptField => f !== null);
}

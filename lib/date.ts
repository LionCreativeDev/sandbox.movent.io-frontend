// Short numeric format — Admin & Staff portals (internal, dense tables).
export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
}

// Long, named-month format — Client Portal & the public invoice pay page.
// Kept deliberately distinct from fmtDate() above: a numeric D/M/Y is
// ambiguous to a US-convention reader (reads as M/D/Y), which matters for a
// customer-facing screen in a way it doesn't for an internal admin table.
// Was previously copy-pasted 3 times (Client project list, Client project
// detail, public pay page) — unified here as one source of truth.
export function fmtDateLong(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

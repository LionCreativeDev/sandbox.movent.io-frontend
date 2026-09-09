'use client';
import { InvoiceBranding } from '@/types';

// The issuer block — whose name and logo an invoice goes out under.
//
// One component for every screen that shows it (staff/admin detail, the Send
// preview, the client portal) because the whole point of the feature is that
// a single invoice can never appear as the company on one screen and as a
// brand on another. The backend already resolves the identity once
// (Invoice::brandingProfile()); this renders that answer and decides nothing
// itself — there is deliberately no branch on invoice_type here beyond the
// badge, since a Company Invoice simply arrives carrying the company's own
// name, logo and contact details.
//
// Not used by the public share link or the emailed copy: those are laid out
// as a full "Billed From" column next to "Billed To", and the email has to be
// table-based HTML to survive Outlook. They read the same resolved fields.
export default function InvoiceIssuer({
  branding,
  // Staff-facing screens show "BRAND INVOICE" / "COMPANY INVOICE" so whoever
  // raised it can confirm at a glance which identity went out. The client
  // portal leaves it off: that is our internal taxonomy, and a client only
  // needs to know who is billing them.
  showBadge = false,
  showWebsite = true,
}: {
  branding: InvoiceBranding;
  showBadge?: boolean;
  showWebsite?: boolean;
}) {
  const isBrand = branding.invoice_type === 'brand';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #f1f5f9',
    }}>
      {branding.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logo_url}
          alt=""
          style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', border: '1px solid #f1f5f9', background: '#fff' }}
        />
      ) : (
        // No logo on file — the initial keeps the row the same height so the
        // header doesn't jump between a branded and an unbranded invoice.
        <div style={{
          width: 44, height: 44, borderRadius: 9, background: '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontWeight: 800,
        }}>
          {(branding.name ?? '?').charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{branding.name}</span>
          {showBadge && (
            <span style={{
              padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em',
              background: isBrand ? '#eef2ff' : '#f1f5f9',
              color: isBrand ? '#4f46e5' : '#64748b',
            }}>
              {isBrand ? 'BRAND INVOICE' : 'COMPANY INVOICE'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
          {branding.email && <span style={{ fontSize: 11.5, color: '#64748b' }}>{branding.email}</span>}
          {branding.phone && <span style={{ fontSize: 11.5, color: '#64748b' }}>{branding.phone}</span>}
          {/* Brand-only: companies have no website field, so this is null on
              a Company Invoice. Stored already carrying a scheme
              (App\Support\Website), so it is safe straight as an href. */}
          {showWebsite && branding.website && (
            <a
              href={branding.website}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11.5, color: '#2563eb', textDecoration: 'none' }}
            >
              {branding.website}
            </a>
          )}
          {branding.address && <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{branding.address}</span>}
          {branding.country && <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{branding.country}</span>}
        </div>
      </div>
    </div>
  );
}

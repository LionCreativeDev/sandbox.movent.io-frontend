'use client';
import { useEffect, useRef, useState } from 'react';
import type { InvoiceReceipt } from '@/lib/services/adminClientService';
import { receiptSummary } from '@/lib/receiptFields';
import ReceiptViewer from '@/components/ui/ReceiptViewer';

/**
 * The payment receipts half of Compliance → Client Files.
 *
 * Presentational and guard-agnostic on purpose: the Admin and User compliance
 * modals each hand it their OWN service's loaders, so one copy of the
 * blob-fetch / object-URL / revoke handling serves both instead of the two
 * modals drifting apart.
 *
 * A receipt image is fetched through axios rather than pointed at with an
 * <img src>, because receipts sit on the private disk behind an authenticated
 * endpoint and an <img> tag carries no bearer token.
 */
export default function ReceiptFilesSection({
  load,
  loadImage,
  downloadable = true,
}: {
  load: () => Promise<InvoiceReceipt[]>;
  loadImage: (endpoint: string) => Promise<string>;
  /** False hides Download inside the viewer — see ReceiptViewer's own note. */
  downloadable?: boolean;
}) {
  // `receipts === null` IS the loading state, so there is no separate flag to
  // set synchronously inside an effect (which the compiler lint rejects).
  const [receipts, setReceipts] = useState<InvoiceReceipt[] | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  const [viewing, setViewing] = useState<{ url: string; title: string; fileName?: string | null } | null>(null);
  const imagesRef = useRef<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => { if (!cancelled) setReceipts(list); })
      // An empty list on failure: the section says "no receipts" rather than
      // spinning forever, and the axios interceptor has already surfaced why.
      .catch(() => { if (!cancelled) setReceipts([]); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Depends ONLY on `receipts`: setImages() does not change `receipts`, so
  // storing one image can never re-run this effect and cancel the fetches
  // still in flight for the others.
  useEffect(() => {
    if (!receipts) return;
    let cancelled = false;

    receipts.filter((r) => !(r.id in imagesRef.current)).forEach((r) => {
      // Claimed up front so a re-render mid-flight cannot start a second
      // fetch for the same receipt.
      imagesRef.current[r.id] = '';
      loadImage(r.image_endpoint)
        .then((url) => {
          if (cancelled) { URL.revokeObjectURL(url); return; }
          imagesRef.current[r.id] = url;
          setImages((prev) => ({ ...prev, [r.id]: url }));
        })
        .catch(() => { delete imagesRef.current[r.id]; });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts]);

  // Revoked once, on unmount — from the ref rather than from state, because a
  // cleanup keyed on the state object would revoke URLs still on screen every
  // time another image lands.
  useEffect(() => () => {
    Object.values(imagesRef.current).forEach(URL.revokeObjectURL);
  }, []);

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
        color: '#64748b', marginBottom: 4,
      }}>
        Payment Receipts
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>
        Generated automatically when the client&apos;s payment is confirmed.
      </div>

      {receipts === null ? (
        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Loading receipts…</div>
      ) : receipts.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No payments recorded for this project yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {receipts.map((r) => (
            <button
              key={r.id}
              onClick={() => images[r.id] && setViewing({
                url: images[r.id],
                title: `Receipt · Invoice #${r.invoice_number}`,
                fileName: r.file_name,
              })}
              title="View full receipt"
              style={{
                display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', width: '100%',
                padding: 8, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff',
                cursor: images[r.id] ? 'zoom-in' : 'default',
              }}
            >
              <span style={{
                // The receipt's own 460×386 aspect, so the thumbnail shows
                // the whole thing rather than cropping it.
                width: 92, aspectRatio: '460 / 386', flexShrink: 0, overflow: 'hidden',
                borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {images[r.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[r.id]}
                    alt={`Payment receipt for invoice ${r.invoice_number}`}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: 10, color: '#cbd5e1' }}>…</span>
                )}
              </span>

              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  #{r.invoice_number}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {receiptSummary(r).slice(1).join('  ·  ')}
                </span>
                {r.reference && (
                  <span style={{
                    display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 2,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.reference}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <ReceiptViewer
          url={viewing.url}
          title={viewing.title}
          fileName={viewing.fileName}
          downloadable={downloadable}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

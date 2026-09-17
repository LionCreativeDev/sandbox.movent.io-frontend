'use client';
import { useEffect } from 'react';

/**
 * Full-size viewer for a generated payment receipt.
 *
 * Shared by the Admin client's Invoice Receipts tab and the Client Portal's
 * Documents list — the same picture, opened the same way, so the two cannot
 * drift apart.
 *
 * THE LAYOUT RULE THAT MATTERS: the receipt is a tall portrait image (820×1016)
 * and is almost always taller than the viewport. The shell is a flex column
 * capped at the screen height, and the body is `flex: 1` with `minHeight: 0` —
 * without that `minHeight` a flex child refuses to shrink below its content, so
 * the image pushed straight through the bottom of the overlay and the lower half
 * of the receipt became unreachable.
 *
 * The image then fits ITSELF inside that box (`maxHeight/maxWidth: 100%` +
 * `objectFit: contain`) rather than filling it, so the whole receipt is visible
 * at once. Scaling down costs nothing here: it is an SVG, so it stays sharp at
 * any size.
 *
 * `url` is an object URL the caller owns — this component never fetches or
 * revokes it.
 */
export default function ReceiptViewer({
  url,
  title,
  fileName,
  downloadable = true,
  onClose,
}: {
  url: string;
  title: string;
  fileName?: string | null;
  /**
   * False hides the Download action. Compliance uses this: a reviewer without
   * `canDownloadComplianceData` may READ the record on screen but must not
   * take a copy away, which is the same line that module's attachment list
   * already draws.
   */
  downloadable?: boolean;
  onClose: () => void;
}) {
  // Escape closes, and the page behind stops scrolling while this is open —
  // both are what makes it behave like a dialog rather than a floating div.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const action: React.CSSProperties = {
    background: 'rgba(255,255,255,0.14)',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15,23,42,0.78)',
        display: 'flex',
        // Scales with the screen: a phone cannot afford 24px of gutter on
        // every side of an already-narrow picture.
        padding: 'clamp(10px, 3vw, 28px)',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          // Sized to the receipt (460 wide), not to a document page — an
          // 880px shell left the compact receipt floating in empty white.
          maxWidth: 600,
          // `margin: auto` centres the shell in both axes without
          // `alignItems: center`, which would clip the top of a shell taller
          // than the overlay instead of just capping it.
          margin: 'auto',
          maxHeight: '100%',
          minHeight: 0,
        }}
      >
        {/* Header — never shrinks, never scrolls away. */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              // A long document title truncates rather than pushing the
              // buttons off the edge.
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {/* The object URL downloads directly — no second request, and no
                dependence on the viewer being able to read the image at the
                size it is shown here. */}
            {downloadable && (
              <a href={url} download={fileName || 'payment-receipt.svg'} style={action} onClick={e => e.stopPropagation()}>
                Download
              </a>
            )}
            <button onClick={onClose} style={action}>Close</button>
          </div>
        </div>

        {/* Body — `flex: 1` + `minHeight: 0` is what lets this shrink to the
            space that is actually left, instead of growing to the image's own
            1016px and overflowing the screen. */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            background: '#fff',
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={title}
            style={{
              // Fills the shell up to a comfortable reading size and no
              // further. Scaling an SVG up costs nothing — it stays sharp —
              // but a receipt blown across a 27" monitor reads as a poster.
              width: '100%',
              maxWidth: 540,
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { clientService } from '@/lib/services/clientService';
import clientApi from '@/lib/clientAxios';
import toast from 'react-hot-toast';
import PortalModuleDisabled from '@/components/client/PortalModuleDisabled';
import ReceiptViewer from '@/components/ui/ReceiptViewer';
import { receiptSummary } from '@/lib/receiptFields';

const GREEN = '#10b981';
const TYPE_OPTS = ['', 'pdf', 'spreadsheet', 'word', 'image', 'other'];

export default function ClientDocumentsPage() {
  const [docs, setDocs]       = useState<any[]>([]);
  const [type, setType]       = useState('');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [dlId, setDlId]       = useState<number | null>(null);
  const [notEnabled, setNotEnabled] = useState(false);

  // Payment receipts are pictures, so they are shown as pictures: a thumbnail
  // in the row and a full-size view on click. Fetched through the Documents
  // module's own authenticated download endpoint (an <img src> carries no
  // bearer token) and held as object URLs, revoked on unmount from a ref so a
  // later arrival never revokes one still on screen.
  const [thumbs, setThumbs]   = useState<Record<number, string>>({});
  const [viewing, setViewing] = useState<{ url: string; title: string; fileName?: string | null } | null>(null);
  const thumbsRef = useRef<Record<number, string>>({});

  useEffect(() => () => {
    Object.values(thumbsRef.current).forEach(URL.revokeObjectURL);
  }, []);

  // One fetch per receipt row, once. Receipts never change after they are
  // issued, so there is nothing to re-poll.
  useEffect(() => {
    let cancelled = false;

    docs.filter(d => d.receipt && !thumbsRef.current[d.id]).forEach(d => {
      // Claimed up front so a re-render mid-flight cannot start a second fetch
      // for the same row.
      thumbsRef.current[d.id] = '';
      clientService.documentImageUrl(d.id)
        .then(url => {
          if (cancelled) { URL.revokeObjectURL(url); return; }
          thumbsRef.current[d.id] = url;
          setThumbs(prev => ({ ...prev, [d.id]: url }));
        })
        .catch(() => { delete thumbsRef.current[d.id]; });
    });

    return () => { cancelled = true; };
  }, [docs]);

  const load = (t: string, s?: string) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (t) params.type = t;
    if (s) params.search = s;
    clientService.documents(Object.keys(params).length ? params : undefined)
      .then(setDocs)
      .catch((err: any) => { if (err?.response?.status === 403) setNotEnabled(true); else setDocs([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(''); }, []);

  const download = async (id: number, fileName: string, source: string) => {
    setDlId(id);
    try {
      const path = source === 'attachment' ? `/client/attachments/${id}/download`
        : source === 'delivery' ? `/client/delivery-submissions/${id}/download`
        : `/client/documents/${id}/download`;
      const res = await clientApi.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDlId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Documents</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>Files shared with you by the team</p>
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(type, search)}
          placeholder="Search file name…"
          style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f8fafc', width: 200 }}
        />
        <div style={{ width: 1, height: 28, background: '#e2e8f0' }} />
        {TYPE_OPTS.map(t => (
          <button key={t} onClick={() => { setType(t); load(t, search); }} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1px solid',
            borderColor: type === t ? GREEN : '#e2e8f0',
            background: type === t ? '#ecfdf5' : '#fff',
            color: type === t ? GREEN : '#64748b',
          }}>{t || 'All'}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : notEnabled ? (
          <PortalModuleDisabled feature="Documents" />
        ) : docs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No documents shared with you yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['File Name', 'Type', 'Size', 'Project', 'Uploaded By', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
                <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc: any) => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                    {/* Payment receipts are ordinary documents — same table,
                        same download action. A receipt is a picture, so it is
                        shown as one: a thumbnail that opens full size. The
                        payment detail beside it says which invoice it settles
                        (sent with the row by Api\Client\DocumentController). */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {doc.receipt && (
                        <button
                          onClick={() => thumbs[doc.id] && setViewing({ url: thumbs[doc.id], title: doc.title, fileName: doc.file_name })}
                          title="View receipt"
                          style={{
                            // The receipt's own 460×386 aspect, so the
                            // thumbnail shows the whole thing rather than
                            // cropping it.
                            width: 84, aspectRatio: '460 / 386', flexShrink: 0, padding: 0, overflow: 'hidden',
                            borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc',
                            cursor: thumbs[doc.id] ? 'zoom-in' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          {thumbs[doc.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbs[doc.id]} alt={`Receipt for invoice ${doc.receipt.invoice_number}`}
                              style={{ width: '100%', height: 'auto', display: 'block' }} />
                          ) : (
                            <span style={{ fontSize: 9, color: '#cbd5e1', alignSelf: 'center' }}>…</span>
                          )}
                        </button>
                      )}

                      <div style={{ minWidth: 0 }}>
                        {doc.title}
                        {/* Just enough to tell one receipt from another —
                            which invoice, how much, when. The labelled full
                            set was too much to read inside a table row; it is
                            all on the receipt itself, one click away. */}
                        {doc.receipt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                              padding: '2px 7px', borderRadius: 5, background: '#ecfdf5', color: GREEN,
                            }}>Receipt</span>
                            <span style={{ fontSize: 11.5, color: '#64748b' }}>
                              {receiptSummary(doc.receipt).join('  ·  ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>{doc.type || '—'}</td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                    {doc.file_size_bytes ? `${Math.round(doc.file_size_bytes / 1024)} KB` : '—'}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>
                    {doc.linked_to_type === 'project' ? `Project #${doc.linked_to_id}` : '—'}
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{doc.uploaded_by?.name || '—'}</td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{doc.created_at?.split('T')[0] || '—'}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {doc.receipt && thumbs[doc.id] && (
                      <button
                        onClick={() => setViewing({ url: thumbs[doc.id], title: doc.title, fileName: doc.file_name })}
                        style={{
                          fontSize: 12, color: '#475569', fontWeight: 600, background: 'none',
                          border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px',
                          cursor: 'pointer', marginRight: 6,
                        }}>
                        View
                      </button>
                    )}
                    <button
                      onClick={() => download(doc.id, doc.file_name || doc.title, doc.source)}
                      disabled={dlId === doc.id}
                      style={{
                        fontSize: 12, color: dlId === doc.id ? '#94a3b8' : GREEN, fontWeight: 600,
                        background: 'none', border: `1px solid ${dlId === doc.id ? '#e2e8f0' : '#a7f3d0'}`,
                        borderRadius: 6, padding: '4px 12px', cursor: dlId === doc.id ? 'not-allowed' : 'pointer',
                      }}>
                      {dlId === doc.id ? '…' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Full-size receipt. The image is already in memory as an object URL, so
          opening it costs nothing and needs no second request. */}
      {viewing && (
        <ReceiptViewer
          url={viewing.url}
          title={viewing.title}
          fileName={viewing.fileName}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

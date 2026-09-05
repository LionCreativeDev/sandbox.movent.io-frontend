'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientService } from '@/lib/services/clientService';
import { TICKET_CATEGORIES } from '@/lib/services/adminSupportService';
import toast from 'react-hot-toast';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

const GREEN = '#10b981';

interface ClientProject { id: number; name: string; status: string; }
interface ClientInvoice { id: number; invoice_number: string; total_amount: string; status: string; }

export default function ClientCreateTicketPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    subject: '', category: 'general_inquiry', priority: 'medium', description: '',
    project_id: '', invoice_id: '', payment_reference: '',
  });
  const [file, setFile]           = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [projects, setProjects]   = useState<ClientProject[]>([]);
  const [invoices, setInvoices]   = useState<ClientInvoice[]>([]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const isProjectSupport = form.category === 'project_support';
  const isBilling        = form.category === 'billing_payments';
  const isAttachmentHint = form.category === 'technical_issue' || form.category === 'bug_report';

  useEffect(() => {
    if (isProjectSupport && projects.length === 0) {
      clientService.projects().then(setProjects).catch(() => setProjects([]));
    }
  }, [isProjectSupport]);

  useEffect(() => {
    if (isBilling && invoices.length === 0) {
      clientService.invoices().then(setInvoices).catch(() => setInvoices([]));
    }
  }, [isBilling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Guards a double-click/Enter re-submit before the disabled prop re-renders.
    if (isProjectSupport && !form.project_id) {
      toast.error('Please select a project for Project Support tickets.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('subject',     form.subject);
      fd.append('category',    form.category);
      fd.append('priority',    form.priority);
      fd.append('description', form.description);
      if (isProjectSupport && form.project_id) fd.append('project_id', form.project_id);
      if (isBilling && form.invoice_id) fd.append('invoice_id', form.invoice_id);
      if (isBilling && form.payment_reference) fd.append('payment_reference', form.payment_reference);
      if (file) fd.append('attachment', file);
      await clientService.createTicket(fd);
      toast.success('Ticket raised successfully!');
      router.push('/client/support');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{ width: '100%' }}>
      <LoadingOverlay show={loading} message="Submitting Ticket…" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Raise Support Ticket</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 28 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Subject *</label>
            <input value={form.subject} onChange={e => set('subject', e.target.value)} required placeholder="Briefly describe your issue" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <select value={form.category} onChange={e => { set('category', e.target.value); set('project_id', ''); set('invoice_id', ''); }} style={{ ...inputStyle, background: '#fff' }}>
                {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority *</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {isProjectSupport && (
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Project *</label>
              <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {projects.length === 0 && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Loading your projects…</p>
              )}
            </div>
          )}

          {isBilling && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={labelStyle}>Related Invoice (optional)</label>
                <select value={form.invoice_id} onChange={e => set('invoice_id', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">None</option>
                  {invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.total_amount}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Payment Reference (optional)</label>
                <input value={form.payment_reference} onChange={e => set('payment_reference', e.target.value)} placeholder="e.g. bank transfer ref #" style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={5}
              placeholder="Describe your issue in detail…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>
              {isAttachmentHint ? 'Attach Screenshot / File (recommended)' : 'Attachment (optional)'}
            </label>
            <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13, color: '#64748b' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <SubmitButton
              loading={loading} loadingText="Submitting Ticket…"
              style={{
                padding: '10px 24px', background: loading ? '#a7f3d0' : GREEN,
                color: '#fff', fontWeight: 600, fontSize: 14,
                border: 'none', borderRadius: 8,
              }}>
              Raise Ticket
            </SubmitButton>
            <button
              type="button" onClick={() => router.back()}
              style={{
                padding: '10px 20px', background: '#fff', color: '#64748b',
                border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer',
              }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

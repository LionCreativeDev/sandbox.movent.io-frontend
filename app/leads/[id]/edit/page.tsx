'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { adminLeadService, userLeadService } from '@/lib/services/adminLeadService';
import { adminClientService, ClientCompany } from '@/lib/services/adminClientService';
import { getAuthType, can } from '@/lib/auth';
import { handleNotFound } from '@/lib/notFound';
import { HiArrowLeft } from 'react-icons/hi2';
import PhoneInput from '@/components/ui/PhoneInput';

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

export default function EditLeadPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const leadId  = Number(params.id);
  const isAdmin = getAuthType() === 'admin';
  const isUser  = getAuthType() === 'user';

  useEffect(() => {
    if (!isAdmin && !isUser) { router.replace('/admin/login'); return; }
    if (isUser && !can('sales', 'canEditLeads')) router.replace(`/leads/${leadId}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [loading, setSaving_]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [companyName, setCompanyName] = useState('');
  const [source, setSource]           = useState('');
  const [status, setStatus]           = useState('new');
  // The status this lead ACTUALLY had when loaded — not `status` itself,
  // since that becomes the dropdown's live value. Drives the one-way Won
  // lock (mirrors the lead detail page's pipeline bar): once won, this form
  // must not be a backdoor to revert it to an earlier stage.
  const [originalStatus, setOriginalStatus] = useState('new');
  // Once a lead has an invoice, its status is driven only by
  // LeadDealService::markWonFromPayment() on payment — mirrors the lead
  // detail page's pipeline lock.
  const [hasInvoice, setHasInvoice] = useState(false);
  const [priority, setPriority]       = useState('medium');
  const [estValue, setEstValue]       = useState('');
  const [notes, setNotes]             = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupTime, setFollowupTime] = useState('');

  // Company (admin only) — lets an Admin fix a lead created under the wrong
  // Company (the CompanySelector dropdown was on the wrong one at the time).
  // Only shown once the Admin's own company list is known to have >1 entry;
  // moving is blocked server-side once the lead has an invoice/project.
  const [companies, setCompanies]     = useState<ClientCompany[]>([]);
  const [companyId, setCompanyId]     = useState(0);
  const [originalCompanyId, setOriginalCompanyId] = useState(0);
  const [hasProject, setHasProject]   = useState(false);

  useEffect(() => {
    const svc = isAdmin ? adminLeadService : userLeadService;
    svc.getOne(leadId).then(lead => {
      setName(lead.name);
      setEmail(lead.email ?? '');
      setPhone(lead.phone ?? '');
      setCompanyName(lead.company_name ?? '');
      setSource(lead.source ?? '');
      setStatus(lead.status);
      setOriginalStatus(lead.status);
      setHasInvoice(!!lead.has_invoice);
      setHasProject(!!lead.chat_project_id);
      setPriority(lead.priority);
      setEstValue(lead.estimated_value > 0 ? String(lead.estimated_value) : '');
      setNotes(lead.notes ?? '');
      setFollowupDate(lead.next_followup_date ?? '');
      setFollowupTime(lead.next_followup_time ?? '');
      setCompanyId(lead.company_id);
      setOriginalCompanyId(lead.company_id);
    }).catch((err) => { if (!handleNotFound(err, router)) setError('Failed to load lead'); }).finally(() => setSaving_(false));

    if (isAdmin) {
      adminClientService.companies().then(setCompanies).catch(() => {});
    }
  }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (isAdmin && companyId !== originalCompanyId) {
        await adminLeadService.updateCompany(leadId, companyId);
      }
      const payload = {
        name:               name.trim(),
        email:              email.trim() || null,
        phone:              phone.trim() || null,
        company_name:       companyName.trim() || null,
        source:             source || null,
        status,
        priority,
        estimated_value:    estValue ? parseFloat(estValue) : null,
        notes:              notes.trim() || null,
        next_followup_date: followupDate || null,
        next_followup_time: followupTime || null,
      };
      if (isAdmin) await adminLeadService.update(leadId, payload);
      else await userLeadService.update(leadId, payload);
      router.push(`${isAdmin ? '/admin' : ''}/leads/${leadId}`);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = ex.response?.data?.errors;
      if (msgs) setError(Object.values(msgs).flat().join(' · '));
      else setError(ex.response?.data?.message ?? 'Failed to update lead');
    } finally { setSaving(false); }
  };

  if (loading) return <DashboardLayout title="Edit Lead"><div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>;

  // A Won lead is a closed deal — the entire form is locked, not just
  // status. Mirrors the same guard now enforced server-side in
  // Api\*\LeadController::update().
  const isLocked = originalStatus === 'won';

  return (
    <DashboardLayout title="Edit Lead">
      <div style={{ width: '100%', maxWidth: 'none' }}>
        <button onClick={() => router.push(`${isAdmin ? '/admin' : ''}/leads/${leadId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>
          <HiArrowLeft size={16} /> Back to Lead
        </button>

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Edit Lead</h2>
          </div>
          {isLocked && (
            <div style={{ margin: 24, marginBottom: 0, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
              🔒 This lead has already been won and can no longer be edited.
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            {error && <div style={{ marginBottom: 16, padding: '9px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, color: '#dc2626', fontSize: 13 }}>{error}</div>}
            <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>

            {isAdmin && companies.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>Company</label>
                {(hasInvoice || hasProject) ? (
                  <>
                    <select style={{ ...inp, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }} value={companyId} disabled>
                      <option value={companyId}>{companies.find(c => c.id === companyId)?.name ?? `Company #${companyId}`}</option>
                    </select>
                    <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      🔒 This lead has an invoice or project and can no longer be moved to another company.
                    </p>
                  </>
                ) : (
                  <select style={inp} value={companyId} onChange={e => setCompanyId(Number(e.target.value))}>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div><label style={lbl}>Full Name *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} required /></div>
              <div><label style={lbl}>Company / Organisation</label><input style={inp} value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
              <div><label style={lbl}>Email</label><input type="email" style={inp} value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><label style={lbl}>Phone</label><PhoneInput value={phone} onChange={setPhone} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Source</label>
                <select style={inp} value={source} onChange={e => setSource(e.target.value)}>
                  <option value="">— None —</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="social">Social Media</option>
                  <option value="event">Event</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                {/* Once Won, status is locked entirely from this form — a
                    deal can never be walked back to an earlier stage here
                    (mirrors the lead detail page's pipeline lock). Once an
                    invoice exists, status locks too — only an invoice payment
                    (LeadDealService::markWonFromPayment()) can move it to Won
                    from here on. */}
                <select style={(originalStatus === 'won' || hasInvoice) ? { ...inp, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : inp}
                  value={status} onChange={e => setStatus(e.target.value)} disabled={originalStatus === 'won' || hasInvoice}>
                  {(originalStatus === 'won' || hasInvoice) ? (
                    <option value={originalStatus}>{originalStatus.charAt(0).toUpperCase() + originalStatus.slice(1)}</option>
                  ) : (
                    <>
                      {/* No "Won" option here either — same guard as the New
                          Lead form, enforced server-side too. */}
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="proposal">Proposal</option>
                      <option value="negotiation">Negotiation</option>
                      <option value="lost">Lost</option>
                    </>
                  )}
                </select>
                {originalStatus === 'won' && (
                  <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    This lead has already been won and can&apos;t be moved back to an earlier stage.
                  </p>
                )}
                {originalStatus !== 'won' && hasInvoice && (
                  <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>
                    🔒 This lead has an invoice — status changes automatically once it&apos;s paid in full.
                  </p>
                )}
              </div>
              <div>
                <label style={lbl}>Priority</label>
                <select style={inp} value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Est. Value</label>
                <input type="number" min={0} step="0.01" style={inp} value={estValue} onChange={e => setEstValue(e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Next Follow-up Date</label>
                <input type="date" style={inp} value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Next Follow-up Time</label>
                <input type="time" style={inp} value={followupTime} onChange={e => setFollowupTime(e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, height: 96, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </fieldset>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => router.push(`${isAdmin ? '/admin' : ''}/leads/${leadId}`)} style={{ padding: '10px 22px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>{isLocked ? 'Back' : 'Cancel'}</button>
              {!isLocked && (
              <button type="submit" disabled={saving} style={{ padding: '10px 28px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

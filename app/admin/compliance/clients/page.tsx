'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminComplianceService, ComplianceClientListItem } from '@/lib/services/adminComplianceService';
import { CASE_STATUS_SC } from '@/components/admin/compliance/shared';

const STATUS_OPTIONS = ['not_started', 'pending', 'under_review', 'compliant', 'on_hold', 'rejected'];

export default function ComplianceClientsPage() {
  useModuleGuard('compliance');
  const router = useRouter();
  const [clients, setClients] = useState<ComplianceClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: { search?: string; status?: string } = {};
      if (search) params.search = search;
      if (statusF) params.status = statusF;
      const list = await adminComplianceService.clients.list(params);
      setClients(list);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout title="Compliance Clients">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/admin/compliance')} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Compliance Clients</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>Client-level compliance summary across their projects</p>
        </div>
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Search name, email…"
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 220 }}
        />
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 180, background: '#fff' }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={load} style={{
          padding: '8px 18px', background: '#2563eb', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Search</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No clients found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Email', 'Phone', 'Total Projects', 'Compliant', 'Pending', 'Under Review', 'On Hold', 'Rejected'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/compliance/clients/${c.id}`)}
                  style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{c.email ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{c.phone ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#1e293b', fontWeight: 600 }}>{c.total_projects}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: CASE_STATUS_SC.compliant.color, fontWeight: 600 }}>{c.compliant}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: CASE_STATUS_SC.pending.color, fontWeight: 600 }}>{c.pending}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: CASE_STATUS_SC.under_review.color, fontWeight: 600 }}>{c.under_review}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: CASE_STATUS_SC.on_hold.color, fontWeight: 600 }}>{c.on_hold}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: CASE_STATUS_SC.rejected.color, fontWeight: 600 }}>{c.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminSupportService, SupportTicket, TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/services/adminSupportService';
import { adminProjectService } from '@/lib/services/adminProjectService';

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(TICKET_CATEGORIES.map(c => [c.value, c.label]));

const SC: Record<string, { bg: string; color: string }> = {
  open:        { bg: '#eff6ff', color: '#2563eb' },
  in_progress: { bg: '#fffbeb', color: '#d97706' },
  on_hold:     { bg: '#fef3c7', color: '#92400e' },
  resolved:    { bg: '#ecfdf5', color: '#059669' },
  closed:      { bg: '#f1f5f9', color: '#64748b' },
};

const PRIORITY_C: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#dc2626', urgent: '#7c2d12',
};

const STATUS_OPTS = ['', ...TICKET_STATUSES.map(s => s.value)];

export default function AdminSupportPage() {
  // 'client_portal' is the real purchasable module_key backing the Client
  // module — 'clients' was never a real CompanyModule row (see
  // ModuleSeeder.php), which made this guard always redirect away.
  useModuleGuard('client_portal');
  const [tickets, setTickets]   = useState<SupportTicket[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch]     = useState('');

  const load = (filters: { status?: string; category?: string; priority?: string; project_id?: string; search?: string }) => {
    setLoading(true);
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    adminSupportService.list(Object.keys(params).length ? params : undefined)
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load({}); }, []);
  useEffect(() => { adminProjectService.list().then(p => setProjects(p.map(pr => ({ id: pr.id, name: pr.name })))).catch(() => setProjects([])); }, []);

  const applyFilters = (overrides: Partial<{ status: string; category: string; priority: string; project_id: string; search: string }> = {}) => {
    const next = { status, category, priority, project_id: projectId, search, ...overrides };
    load(next);
  };

  return (
    <DashboardLayout title="Support Tickets">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Client Support Tickets</h2>
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap',
      }}>
        {STATUS_OPTS.map(s => (
          <button key={s} onClick={() => { setStatus(s); applyFilters({ status: s }); }} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            border: '1px solid',
            borderColor: status === s ? '#2563eb' : '#e2e8f0',
            background: status === s ? '#eff6ff' : '#fff',
            color: status === s ? '#2563eb' : '#64748b',
            textTransform: 'capitalize',
          }}>{s ? s.replace(/_/g, ' ') : 'All'}</button>
        ))}
      </div>

      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyFilters({ search }); }}
          onBlur={() => applyFilters({ search })}
          placeholder="Search by subject…"
          style={{ flex: '1 1 200px', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none' }}
        />
        <select value={category} onChange={e => { setCategory(e.target.value); applyFilters({ category: e.target.value }); }}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, background: '#fff' }}>
          <option value="">All Categories</option>
          {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={priority} onChange={e => { setPriority(e.target.value); applyFilters({ priority: e.target.value }); }}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, background: '#fff' }}>
          <option value="">All Priorities</option>
          {TICKET_PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={projectId} onChange={e => { setProjectId(e.target.value); applyFilters({ project_id: e.target.value }); }}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, background: '#fff' }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No support tickets yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Ticket #', 'Subject', 'Raised By', 'Assigned To', 'Category', 'Project', 'Priority', 'Status', 'Created'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
                <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => {
                const sc = SC[t.status] || { bg: '#f1f5f9', color: '#64748b' };
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px 18px', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>#{t.id}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{t.subject}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{t.raised_by?.name || '—'}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{t.assigned_to?.name || '—'}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{CATEGORY_LABEL[t.category] || t.category}</td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{t.project?.name || '—'}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_C[t.priority] || '#64748b', textTransform: 'capitalize' }}>{t.priority}</span>
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 500 }}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#64748b' }}>{t.created_at?.split('T')[0]}</td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <Link href={`/admin/support/${t.id}`} style={{
                        fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none',
                        padding: '4px 12px', border: '1px solid #bfdbfe', borderRadius: 6,
                      }}>View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

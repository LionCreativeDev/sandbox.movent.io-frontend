'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import { adminProjectService, Project, TeamMember } from '@/lib/services/adminProjectService';
import { TEAM_ROLE_LABEL } from '@/components/admin/projects/shared';
import { ROLE_LABELS } from '@/lib/roleUtils';

// A team member's actual job (role_type, e.g. "Seller") is more useful here
// than the generic 4-value project role_in_project — fall back to the
// latter only if the user has no role_type set. Same pattern as
// frontend/app/projects/team/page.tsx and frontend/app/admin/projects/[id]/
// team/page.tsx — this page previously showed role_in_project raw, so a
// Seller self-managing their own project (role_in_project defaults to
// 'project_manager' — see Api\User\ProjectController::store()) showed as
// "Project Manager" here instead of their real role, "Seller".
const memberRoleLabel = (m: TeamMember): string =>
  (m.user?.role_type && ROLE_LABELS[m.user.role_type]) || TEAM_ROLE_LABEL[m.role_in_project];

export default function TeamOverviewPage() {
  useModuleGuard('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    adminProjectService.list()
      .then(setProjects)
      .catch(() => toast.error('Failed to load team overview'))
      .finally(() => setLoading(false));
  }, []);

  // Keyed by userId -> projectId, so a Seller sourced from projects.seller_id
  // below can overwrite (never duplicate) a stale/cosmetic team_members
  // entry for the same project — seller_id is the authoritative fact and is
  // always immediately correct on reassignment, unlike a team row nobody
  // maintains.
  // Role lives on the USER, not on each project entry: memberRoleLabel()
  // resolves to the person's account role (e.g. "Seller"), which is the same
  // on every project they're on — so it's captured once and rendered once,
  // under their name, instead of repeating down a Role column.
  type ProjectEntry = { id: number; name: string; company: string };
  const byUser = new Map<number, { name: string; role: string; projects: Map<number, ProjectEntry> }>();
  const upsert = (userId: number, name: string, role: string, project: ProjectEntry) => {
    const row = byUser.get(userId) ?? { name, role, projects: new Map() };
    row.projects.set(project.id, project);
    byUser.set(userId, row);
  };

  projects.forEach(p => {
    // An Admin owning several companies sees every one of them here at once,
    // so the project name alone doesn't say which company it belongs to.
    const company = p.company?.name ?? '—';
    (p.team_members ?? []).forEach(m => {
      if (!m.user) return;
      upsert(m.user.id, m.user.name, memberRoleLabel(m), { id: p.id, name: p.name, company });
    });
    // A Seller with no project_team_members row at all (assign()/reassign()
    // never creates one — see ProjectSellerAssignmentService::assign()) must
    // still show up here, so read projects.seller_id directly rather than
    // relying solely on team_members.
    if (p.seller) {
      const sellerRole = (p.seller.role_type && ROLE_LABELS[p.seller.role_type]) || 'Seller';
      upsert(p.seller.id, p.seller.name, sellerRole, { id: p.id, name: p.name, company });
    }
  });
  const rows = Array.from(byUser.entries()).map(([userId, row]) => ({
    userId,
    name: row.name,
    role: row.role,
    projects: Array.from(row.projects.values()),
  }));

  return (
    <DashboardLayout title="Team / Resources">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Team / Resources</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Who is assigned to which project</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No team members assigned to any project yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Team Member', 'Project', 'Company'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => r.projects.map((p, i) => (
                <tr key={`${r.userId}-${p.id}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                  {/* One row per project, with the member's name (and their
                      role, shown once beneath it) spanning their whole block —
                      the role is the same on every project they're on, so a
                      separate Role column only repeated it. */}
                  {i === 0 && (
                    <td rowSpan={r.projects.length} style={{ padding: '12px 16px', verticalAlign: 'top', borderRight: '1px solid #f8fafc' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginTop: 2 }}>({r.role})</div>
                    </td>
                  )}
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/admin/projects/${p.id}/team`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>{p.name}</Link>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{p.company}</td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

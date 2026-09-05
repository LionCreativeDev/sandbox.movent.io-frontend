'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { userProjectService } from '@/lib/services/userProjectService';
import { Task } from '@/lib/services/adminProjectService';
import { can, getAuthUser } from '@/lib/auth';
import { roleDisplayLabel, canRoleReassignTasks } from '@/lib/roleUtils';
import { card, inp, lbl, asRelation } from '@/components/admin/projects/shared';
import toast from 'react-hot-toast';
import { handleNotFound } from '@/lib/notFound';
import SubmitButton from '@/components/ui/SubmitButton';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import RichTextField from '@/components/ui/RichTextField';

// Only a Client portal account can never be a task assignee — mirrors
// Api\User\TaskController::assignedToRule(). A Project Manager genuinely on
// the project's team CAN be one, and so can any Seller of the company since
// 2026-09-04 (they come from their own list, never from team_members).
const NEVER_TASK_ASSIGNEE_ROLES = ['client'];

interface AssigneeOption { id: number; name: string; role_type?: string; custom_role_label?: string | null }

// Laravel serializes the date-cast columns as full ISO timestamps
// ("2026-09-02T00:00:00.000000Z"); <input type="date"> needs YYYY-MM-DD.
const toDateInput = (v: string | null | undefined): string => (v ? String(v).slice(0, 10) : '');

export default function EditTaskPage() {
  useAdminGuard();
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);
  const taskId = Number(params.taskId);
  const me = getAuthUser() as { id: number; role_type?: string } | null;
  const meId = me?.id;

  // "Edit Tasks" is its own assignable/revocable permission (pm_edit_tasks →
  // canEditTasks in frontend/lib/simplifiedProjectPermissions.ts) with no
  // PM-tier bypass, exactly like Api\User\TaskController::update()'s
  // $canEdit — so a Project Manager whose Task Edit was revoked by Company
  // Admin gets bounced right back out of this page.
  const canEditTasks = can('project_management', 'canEditTasks');
  // Reassignment stays on its own permission (Assign Tasks). Any role also
  // gets it on their OWN task, and any team member of this project may
  // reassign any of its tasks — mirrors update()'s
  // $canAssign/$isOwnTask/$isTeamMember paths.
  const canAssignTasks = can('project_management', 'canAssignTasks');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [teamOptions, setTeamOptions] = useState<AssigneeOption[]>([]);
  // Any Seller of the company is assignable (2026-09-04) and none of them has
  // a project_team_members row, so they can't come from teamOptions above.
  const [sellerOptions, setSellerOptions] = useState<AssigneeOption[]>([]);
  const [task, setTask] = useState<Task | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');

  const assignableTeamUsers = teamOptions.filter(u => !NEVER_TASK_ASSIGNEE_ROLES.includes(u.role_type ?? ''));

  useEffect(() => {
    if (!canEditTasks) {
      toast.error("You don't have permission to edit tasks");
      router.replace(`/projects/${projectId}/tasks/${taskId}`);
      return;
    }
    (async () => {
      try {
        const project = await userProjectService.getOne(projectId);
        // Same rule the server enforces (Project::isLocked()) — everything
        // else (including a completed project) stays editable.
        if (project.status === 'closed' || project.status === 'approved_locked') {
          toast.error('This project is locked. Ask an Admin to reopen it before making changes.');
          router.replace(`/projects/${projectId}/tasks/${taskId}`);
          return;
        }
        setProjectName(project.name);
        setTeamOptions((project.team_members ?? []).map(m => m.user).filter((u): u is AssigneeOption => !!u));
        // Silent on failure — the rest of the picker still works, it just
        // won't offer Sellers.
        userProjectService.tasks.assignableSellers().then(setSellerOptions).catch(() => {});

        const found = (await userProjectService.tasks.list(projectId)).find(t => t.id === taskId) ?? null;
        if (!found) {
          toast.error('Task not found or not accessible');
          router.replace(`/projects/${projectId}`);
          return;
        }
        setTask(found);
        setTitle(found.title ?? '');
        setDescription(found.description ?? '');
        setNotes(found.notes ?? '');
        setAssignee(String(asRelation(found.assigned_to)?.id ?? found.assigned_to ?? ''));
        setPriority(found.priority ?? 'medium');
        setStartDate(toDateInput(found.start_date));
        setDueDate(toDateInput(found.due_date));
        setEstimatedHours(found.estimated_hours != null ? String(found.estimated_hours) : '');
      } catch (err) {
        if (!handleNotFound(err, router)) {
          toast.error('Task not found or not accessible');
          router.replace(`/projects/${projectId}`);
        }
      } finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentAssigneeId = asRelation(task?.assigned_to)?.id ?? (typeof task?.assigned_to === 'number' ? task.assigned_to : null);
  const isOwnTask = currentAssigneeId != null && currentAssigneeId === meId;
  const isProjectTeamMember = teamOptions.some(u => u.id === meId);
  // The isOwnTask/isProjectTeamMember paths are permission-free, so the role
  // check has to come first for the roles that may never reassign at all —
  // mirrors Api\User\TaskController::NON_REASSIGNING_ROLES.
  const canChangeAssignee = canRoleReassignTasks(me?.role_type)
    && (canAssignTasks || isOwnTask || isProjectTeamMember);
  // A Seller normally has no project_team_members row, but a cosmetic one
  // does exist on some projects — drop those so they aren't listed twice.
  const sellerOnlyOptions = sellerOptions.filter(s => !teamOptions.some(t => t.id === s.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Guards a double-click/Enter re-submit before the disabled prop re-renders.
    if (!title.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    try {
      await userProjectService.tasks.update(projectId, taskId, {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        // Only sent when it actually changed — an unchanged assigned_to would
        // otherwise be a no-op write, and update() logs/notifies purely off
        // the value differing from the current one.
        ...(canChangeAssignee && (assignee ? Number(assignee) : null) !== currentAssigneeId
          ? { assigned_to: assignee ? Number(assignee) : null }
          : {}),
      });
      toast.success('Task updated');
      router.push(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update task');
    } finally { setSaving(false); }
  };

  if (loading) return (<DashboardLayout title="Edit Task"><div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div></DashboardLayout>);
  if (!task) return null;

  return (
    <DashboardLayout title="Edit Task">
      <LoadingOverlay show={saving} message="Saving Task…" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push(`/projects/${projectId}/tasks/${taskId}`)} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          Edit Task{task.task_number ? ` — ${task.task_number}` : ''}{projectName && ` — ${projectName}`}
        </h2>
      </div>

      <form onSubmit={submit} style={{ width: '100%' }}>
        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required style={inp} placeholder="e.g. Homepage Design" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Assigned To</label>
              {canChangeAssignee ? (
                <select value={assignee} onChange={e => setAssignee(e.target.value)} style={inp}>
                  <option value="">Unassigned</option>
                  {assignableTeamUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.role_type ? ` (${roleDisplayLabel(u)})` : ''}</option>
                  ))}
                  {/* Grouped separately because these are company-wide, not
                      this project's team — see sellerOptions above. */}
                  {sellerOnlyOptions.length > 0 && (
                    <optgroup label="Sellers (company-wide)">
                      {sellerOnlyOptions.map(u => (
                        <option key={`seller-${u.id}`} value={u.id}>{u.name} ({roleDisplayLabel(u)})</option>
                      ))}
                    </optgroup>
                  )}
                  {/* Keeps an existing assignee showing correctly even if
                      they've since left the project team — a fallback entry,
                      not a normal re-pickable choice. */}
                  {currentAssigneeId != null
                    && !assignableTeamUsers.some(u => u.id === currentAssigneeId)
                    && !sellerOnlyOptions.some(u => u.id === currentAssigneeId) && (
                    <option value={String(currentAssigneeId)}>{asRelation(task.assigned_to)?.name ?? `User #${currentAssigneeId}`}</option>
                  )}
                </select>
              ) : (
                <>
                  <div style={{ ...inp, background: '#f8fafc', color: '#64748b' }}>
                    {asRelation(task.assigned_to)?.name ?? 'Unassigned'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {canRoleReassignTasks(me?.role_type)
                      ? 'Reassigning needs the "Assign Tasks" permission.'
                      : 'Your role works the tasks assigned to it — it cannot hand one to someone else.'}
                  </div>
                </>
              )}
              {teamOptions.length === 0 && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>No team members on this project yet.</div>
              )}
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} style={inp}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Description</label>
            <RichTextField value={description} onChange={setDescription} rows={3} placeholder="Optional" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Optional" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Estimated Hours</label>
              <input type="number" min={0} step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} style={inp} placeholder="Optional" />
            </div>
          </div>

          {/* Status is deliberately not editable here — it has its own actor
              rules (App\Services\TaskStatusService) and its own dropdown on
              the project's task list / task detail page. */}
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14 }}>
            Status and attachments are managed from the task detail page.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <SubmitButton loading={saving} loadingText="Saving Task…" style={{
            padding: '11px 28px', background: saving ? '#93c5fd' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600,
          }}>Save Changes</SubmitButton>
          <button type="button" onClick={() => router.push(`/projects/${projectId}/tasks/${taskId}`)} disabled={saving} style={{
            padding: '11px 22px', background: '#fff', color: '#64748b',
            border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </form>
    </DashboardLayout>
  );
}

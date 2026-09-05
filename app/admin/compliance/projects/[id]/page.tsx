'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { useModuleGuard } from '@/hooks/useModuleGuard';
import {
  adminComplianceService, ComplianceCase,
  ComplianceActivityItem, ComplianceCaseStatus,
  ComplianceChatMessage, ComplianceProjectAttachment,
  ComplianceProjectTask, ComplianceDeliverable, ComplianceDeliverySubmission,
  ComplianceTaskComment, ComplianceTaskActivityItem, ComplianceInvoice,
  ComplianceTeamMember, ComplianceProjectComment, ComplianceLead, ComplianceTimesheet, ComplianceHistoryEvent,
  ComplianceGeneralChatThread, ComplianceDocument, ComplianceChecklistItem, ComplianceComment,
} from '@/lib/services/adminComplianceService';
import { adminProjectService, ProjectUserOption } from '@/lib/services/adminProjectService';
import SubmitButton from '@/components/ui/SubmitButton';
import {
  card, lbl, inp, Badge, CASE_STATUS_SC,
  TASK_SC, DELIVERABLE_SC, INVOICE_SC, LEAD_SC, FOLLOWUP_SC, TIMESHEET_SC,
  DOCUMENT_STATUS_SC, REQUIREMENT_STATUS_SC, fmtDate, fmtFileSize, errorMessage,
  paymentMethodText,
} from '@/components/admin/compliance/shared';
import { handleNotFound } from '@/lib/notFound';

// Temporarily hidden — Requirements/Documents/Checklist UI isn't needed yet.
// Flip back to true to re-enable; Compliance Comments stays on regardless.
const SHOW_CASE_WORKFLOW_SECTIONS = false;

export default function ProjectComplianceDetailPage() {
  useModuleGuard('compliance');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(id);

  const [caseData, setCaseData] = useState<ComplianceCase | null>(null);
  const [loading, setLoading] = useState(true);

  // Officer assignment
  const [officers, setOfficers] = useState<ProjectUserOption[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officerSelectId, setOfficerSelectId] = useState('');
  const [officerBusy, setOfficerBusy] = useState(false);

  // Case-level status actions
  const [statusAction, setStatusAction] = useState<'on_hold' | 'reject' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusBusy, setStatusBusy] = useState<ComplianceCaseStatus | 'mark_under_review' | 'on_hold' | 'resume' | 'reject' | null>(null);

  // Compliance Requirements (sourced from caseData.requirements)
  const [reqBusy, setReqBusy] = useState(false);
  const [showAddReq, setShowAddReq] = useState(false);
  const [newReq, setNewReq] = useState({ name: '', category: '', is_mandatory: false });

  // Compliance Documents (sourced from caseData.documents)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadReqId, setUploadReqId] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [docActionBusy, setDocActionBusy] = useState<number | null>(null);

  // Compliance Checklist
  const [checklist, setChecklist] = useState<ComplianceChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');

  // Compliance Comments (distinct from the general Project Comments card)
  const [complianceComments, setComplianceComments] = useState<ComplianceComment[]>([]);
  const [complianceCommentsLoading, setComplianceCommentsLoading] = useState(true);
  const [newComplianceComment, setNewComplianceComment] = useState('');
  const [complianceCommentBusy, setComplianceCommentBusy] = useState(false);

  // Activity
  const [activity, setActivity] = useState<ComplianceActivityItem[]>([]);

  // Read-only project context (Chat/Attachments/Tasks/Deliverables)
  const [chatMessages, setChatMessages] = useState<ComplianceChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [generalChatThreads, setGeneralChatThreads] = useState<ComplianceGeneralChatThread[]>([]);
  const [generalChatLoading, setGeneralChatLoading] = useState(true);
  const [projectAttachments, setProjectAttachments] = useState<ComplianceProjectAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [projectTasks, setProjectTasks] = useState<ComplianceProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState<number | null>(null);
  const [taskDetailCache, setTaskDetailCache] = useState<Record<number, { comments: ComplianceTaskComment[]; activities: ComplianceTaskActivityItem[] }>>({});
  const [deliverables, setDeliverables] = useState<ComplianceDeliverable[]>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<ComplianceDeliverySubmission[]>([]);
  const [deliverablesLoading, setDeliverablesLoading] = useState(true);
  const [invoices, setInvoices] = useState<ComplianceInvoice[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<ComplianceTimesheet[]>([]);
  const [timesheetsLoading, setTimesheetsLoading] = useState(true);
  const [history, setHistory] = useState<ComplianceHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectTeam, setProjectTeam] = useState<ComplianceTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [projectComments, setProjectComments] = useState<ComplianceProjectComment[]>([]);
  const [projectCommentsLoading, setProjectCommentsLoading] = useState(true);
  const [lead, setLead] = useState<ComplianceLead | null>(null);
  const [leadLoading, setLeadLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const c = await adminComplianceService.cases.getByProject(projectId);
      setCaseData(c);
      setOfficerSelectId(c.compliance_officer ? String(c.compliance_officer.id) : '');
      setOfficersLoading(true);
      adminProjectService.getOne(c.project.id)
        .then(p => adminProjectService.projectUsers(p.company_id))
        .then(d => setOfficers(d.compliance_officers ?? []))
        .catch(() => setOfficers([]))
        .finally(() => setOfficersLoading(false));
    } catch (err) {
      if (!handleNotFound(err, router)) toast.error('Failed to load compliance case');
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async (caseId: number) => {
    try { setActivity(await adminComplianceService.activity.list(caseId)); }
    catch { /* silent — activity is a nice-to-have feed */ }
  };

  const loadChat = async (pid: number) => {
    setChatLoading(true);
    try { setChatMessages((await adminComplianceService.project.chat(pid)).messages); }
    catch { /* silent — chat may not have started yet */ }
    finally { setChatLoading(false); }
  };

  const loadGeneralChat = async (pid: number) => {
    setGeneralChatLoading(true);
    try { setGeneralChatThreads(await adminComplianceService.project.generalChat(pid)); }
    catch { /* silent */ }
    finally { setGeneralChatLoading(false); }
  };

  const loadProjectAttachments = async (pid: number) => {
    setAttachmentsLoading(true);
    try { setProjectAttachments(await adminComplianceService.project.attachments(pid)); }
    catch { /* silent */ }
    finally { setAttachmentsLoading(false); }
  };

  const loadProjectTasks = async (pid: number) => {
    setTasksLoading(true);
    try { setProjectTasks(await adminComplianceService.project.tasks(pid)); }
    catch { /* silent */ }
    finally { setTasksLoading(false); }
  };

  const loadDeliverables = async (pid: number) => {
    setDeliverablesLoading(true);
    try {
      const d = await adminComplianceService.project.deliverables(pid);
      setDeliverables(d.deliverables);
      setDeliveryHistory(d.delivery_history);
    } catch { /* silent */ }
    finally { setDeliverablesLoading(false); }
  };

  const loadBilling = async (pid: number) => {
    setBillingLoading(true);
    try { setInvoices(await adminComplianceService.project.billing(pid)); }
    catch { /* silent */ }
    finally { setBillingLoading(false); }
  };

  const loadTimesheets = async (pid: number) => {
    setTimesheetsLoading(true);
    try { setTimesheets(await adminComplianceService.project.timesheets(pid)); }
    catch { /* silent */ }
    finally { setTimesheetsLoading(false); }
  };

  const loadHistory = async (pid: number) => {
    setHistoryLoading(true);
    try { setHistory(await adminComplianceService.project.history(pid)); }
    catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  const loadProjectTeam = async (pid: number) => {
    setTeamLoading(true);
    try { setProjectTeam(await adminComplianceService.project.team(pid)); }
    catch { /* silent */ }
    finally { setTeamLoading(false); }
  };

  const loadProjectComments = async (pid: number) => {
    setProjectCommentsLoading(true);
    try { setProjectComments(await adminComplianceService.project.comments(pid)); }
    catch { /* silent */ }
    finally { setProjectCommentsLoading(false); }
  };

  const loadLead = async (pid: number) => {
    setLeadLoading(true);
    try { setLead(await adminComplianceService.project.lead(pid)); }
    catch { /* silent */ }
    finally { setLeadLoading(false); }
  };

  const loadChecklist = async (caseId: number) => {
    setChecklistLoading(true);
    try { setChecklist(await adminComplianceService.checklist.list(caseId)); }
    catch { /* silent */ }
    finally { setChecklistLoading(false); }
  };

  const loadComplianceComments = async (caseId: number) => {
    setComplianceCommentsLoading(true);
    try { setComplianceComments(await adminComplianceService.comments.list(caseId)); }
    catch { /* silent */ }
    finally { setComplianceCommentsLoading(false); }
  };

  const downloadProjectAttachment = async (a: ComplianceProjectAttachment) => {
    try { await adminComplianceService.project.attachmentDownload(a.id, a.original_name); }
    catch { toast.error('Download failed'); }
  };

  const exportChat = async () => {
    try { await adminComplianceService.project.chatExport(projectId); }
    catch { toast.error('Export failed'); }
  };

  const downloadDelivery = async (d: ComplianceDeliverySubmission) => {
    try { await adminComplianceService.project.deliveryDownload(d.id, d.file_name); }
    catch { toast.error('Download failed'); }
  };

  const toggleTaskExpand = async (taskId: number) => {
    if (expandedTaskId === taskId) { setExpandedTaskId(null); return; }
    setExpandedTaskId(taskId);
    if (taskDetailCache[taskId]) return;
    setTaskDetailLoading(taskId);
    try {
      const detail = await adminComplianceService.project.taskDetail(taskId);
      setTaskDetailCache(prev => ({ ...prev, [taskId]: detail }));
    } catch { toast.error('Failed to load task details'); }
    finally { setTaskDetailLoading(null); }
  };

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!caseData) return;
    loadActivity(caseData.id);
    loadChat(caseData.project.id);
    loadGeneralChat(caseData.project.id);
    loadProjectAttachments(caseData.project.id);
    loadProjectTasks(caseData.project.id);
    loadDeliverables(caseData.project.id);
    loadBilling(caseData.project.id);
    loadTimesheets(caseData.project.id);
    loadHistory(caseData.project.id);
    loadProjectTeam(caseData.project.id);
    loadProjectComments(caseData.project.id);
    loadLead(caseData.project.id);
    loadChecklist(caseData.id);
    loadComplianceComments(caseData.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.id]);

  if (loading) {
    return (
      <DashboardLayout title="Project Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!caseData) {
    return (
      <DashboardLayout title="Project Compliance">
        <div style={{ padding: 60, textAlign: 'center', color: '#dc2626' }}>Compliance case not found.</div>
      </DashboardLayout>
    );
  }

  const assignOfficer = async () => {
    setOfficerBusy(true);
    try {
      const updated = await adminComplianceService.cases.assignOfficer(caseData.id, officerSelectId ? Number(officerSelectId) : null);
      setCaseData(prev => prev ? { ...prev, compliance_officer: updated.compliance_officer } : prev);
      toast.success('Officer updated');
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update officer'));
    } finally {
      setOfficerBusy(false);
    }
  };

  const runStatusAction = async (action: 'mark_under_review' | 'on_hold' | 'resume' | 'reject') => {
    if ((action === 'on_hold' || action === 'reject') && !statusReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setStatusBusy(action);
    try {
      const updated = await adminComplianceService.cases.updateStatus(caseData.id, action, statusReason.trim() || undefined);
      setCaseData(prev => prev ? { ...prev, status: updated.status } : prev);
      toast.success('Status updated');
      setStatusAction(null);
      setStatusReason('');
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update status'));
    } finally {
      setStatusBusy(null);
    }
  };

  const addRequirement = async () => {
    if (!newReq.name.trim()) { toast.error('Name is required'); return; }
    setReqBusy(true);
    try {
      await adminComplianceService.requirements.add(caseData.id, {
        name: newReq.name.trim(),
        category: newReq.category.trim() || undefined,
        is_mandatory: newReq.is_mandatory,
      });
      toast.success('Requirement added');
      setNewReq({ name: '', category: '', is_mandatory: false });
      setShowAddReq(false);
      load();
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to add requirement'));
    } finally {
      setReqBusy(false);
    }
  };

  const removeRequirement = async (id: number) => {
    if (!window.confirm('Remove this requirement?')) return;
    try {
      await adminComplianceService.requirements.remove(id);
      toast.success('Requirement removed');
      load();
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove requirement'));
    }
  };

  const uploadDocument = async () => {
    if (!uploadFile) { toast.error('Choose a file first'); return; }
    setUploadBusy(true);
    try {
      await adminComplianceService.documents.upload(caseData.id, uploadFile, uploadReqId ? Number(uploadReqId) : undefined);
      toast.success('Document uploaded');
      setUploadFile(null);
      setUploadReqId('');
      load();
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploadBusy(false);
    }
  };

  const reviewDocument = async (
    docId: number,
    action: 'approve' | 'reject' | 'request_resubmission' | 'set_expiry',
    extra?: { reason?: string; expires_at?: string },
  ) => {
    setDocActionBusy(docId);
    try {
      await adminComplianceService.documents.review(docId, action, extra);
      toast.success('Document updated');
      load();
      loadActivity(caseData.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update document'));
    } finally {
      setDocActionBusy(null);
    }
  };

  const downloadComplianceDocument = async (d: ComplianceDocument) => {
    try { await adminComplianceService.documents.download(d.id, d.original_name); }
    catch { toast.error('Download failed'); }
  };

  const generateChecklist = async () => {
    setChecklistBusy(true);
    try {
      setChecklist(await adminComplianceService.checklist.generate(caseData.id));
      toast.success('Checklist generated');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to generate checklist'));
    } finally {
      setChecklistBusy(false);
    }
  };

  const addChecklistItem = async () => {
    if (!newChecklistLabel.trim()) return;
    setChecklistBusy(true);
    try {
      const item = await adminComplianceService.checklist.add(caseData.id, { label: newChecklistLabel.trim() });
      setChecklist(prev => [...prev, item]);
      setNewChecklistLabel('');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to add item'));
    } finally {
      setChecklistBusy(false);
    }
  };

  const toggleChecklistItem = async (itemId: number) => {
    try {
      const updated = await adminComplianceService.checklist.toggle(itemId);
      setChecklist(prev => prev.map(i => (i.id === itemId ? updated : i)));
    } catch {
      toast.error('Failed to update item');
    }
  };

  const addComplianceComment = async () => {
    if (!newComplianceComment.trim()) return;
    setComplianceCommentBusy(true);
    try {
      const c = await adminComplianceService.comments.add(caseData.id, newComplianceComment.trim());
      setComplianceComments(prev => [...prev, c]);
      setNewComplianceComment('');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to add comment'));
    } finally {
      setComplianceCommentBusy(false);
    }
  };

  const removeComplianceComment = async (id: number) => {
    try {
      await adminComplianceService.comments.remove(id);
      setComplianceComments(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error('Failed to remove comment');
    }
  };

  const activityText = (item: ComplianceActivityItem) => {
    const actor = item.actor_admin?.name ?? item.actor_user?.name ?? 'System';
    return `${actor} ${item.description}`;
  };


  return (
    <DashboardLayout title="Project Compliance">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748b',
        }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>{caseData.project.name}</h2>
            <Badge label={caseData.status} sc={CASE_STATUS_SC[caseData.status]} />
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
            {caseData.project.reference ?? `Project #${caseData.project.id}`} · {caseData.client?.name ?? 'No client linked'}
          </p>
        </div>
      </div>

      {/* Officer + case actions */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260 }}>
            <label style={lbl}>Compliance Officer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={officerSelectId} onChange={e => setOfficerSelectId(e.target.value)} disabled={officersLoading} style={inp}>
                <option value="">Unassigned</option>
                {officers.map(o => <option key={o.user_id} value={o.user_id}>{o.name} ({o.email})</option>)}
              </select>
              <SubmitButton loading={officerBusy} loadingText="Saving…" onClick={assignOfficer} style={{
                padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>Save</SubmitButton>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label style={lbl}>Case Actions</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SubmitButton loading={statusBusy === 'mark_under_review'} loadingText="…" onClick={() => runStatusAction('mark_under_review')} style={{
                padding: '8px 14px', background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              }}>Mark Under Review</SubmitButton>
              <button onClick={() => { setStatusAction(statusAction === 'on_hold' ? null : 'on_hold'); setStatusReason(''); }} style={{
                padding: '8px 14px', background: '#fff', color: '#d97706', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>Place On Hold</button>
              <button onClick={() => { setStatusAction(statusAction === 'reject' ? null : 'reject'); setStatusReason(''); }} style={{
                padding: '8px 14px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>Reject</button>
              <SubmitButton loading={statusBusy === 'resume'} loadingText="…" onClick={() => runStatusAction('resume')} style={{
                padding: '8px 14px', background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              }}>Resume</SubmitButton>
            </div>
            {statusAction && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="Reason (required)" style={{ ...inp, flex: 1 }} />
                <SubmitButton loading={statusBusy === statusAction} loadingText="Saving…" onClick={() => runStatusAction(statusAction)} style={{
                  padding: '9px 16px', background: statusAction === 'reject' ? '#dc2626' : '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                }}>Confirm</SubmitButton>
                <button onClick={() => { setStatusAction(null); setStatusReason(''); }} style={{ padding: '9px 14px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {SHOW_CASE_WORKFLOW_SECTIONS && (
      <>
      {/* Compliance Requirements */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Compliance Requirements</h3>
          <button onClick={() => setShowAddReq(v => !v)} style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe',
          }}>{showAddReq ? 'Cancel' : '+ Add Requirement'}</button>
        </div>
        {showAddReq && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Requirement name" value={newReq.name} onChange={e => setNewReq({ ...newReq, name: e.target.value })} style={{ ...inp, flex: 1, minWidth: 160 }} />
            <input placeholder="Category (optional)" value={newReq.category} onChange={e => setNewReq({ ...newReq, category: e.target.value })} style={{ ...inp, width: 160 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
              <input type="checkbox" checked={newReq.is_mandatory} onChange={e => setNewReq({ ...newReq, is_mandatory: e.target.checked })} /> Mandatory
            </label>
            <SubmitButton loading={reqBusy} loadingText="Saving…" onClick={addRequirement} style={{
              padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}>Add</SubmitButton>
          </div>
        )}
        {caseData.requirements.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No requirements yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {caseData.requirements.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.name}</span>
                  {r.is_mandatory && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginLeft: 6 }}>MANDATORY</span>}
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {r.category ?? 'Uncategorized'}{r.expires_at ? ` · Expires ${fmtDate(r.expires_at)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge label={r.status} sc={REQUIREMENT_STATUS_SC[r.status]} />
                  <button onClick={() => removeRequirement(r.id)} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                  }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Documents */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Compliance Documents</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
          <select value={uploadReqId} onChange={e => setUploadReqId(e.target.value)} style={inp}>
            <option value="">Link to requirement (optional)</option>
            {caseData.requirements.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <SubmitButton loading={uploadBusy} loadingText="Uploading…" onClick={uploadDocument} style={{
            padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>Upload</SubmitButton>
        </div>
        {(caseData.documents ?? []).length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No documents uploaded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(caseData.documents ?? []).map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{d.original_name}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    v{d.versions?.length ?? 1}{d.expires_at ? ` · Expires ${fmtDate(d.expires_at)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={d.status} sc={DOCUMENT_STATUS_SC[d.status]} />
                  <button onClick={() => downloadComplianceDocument(d)} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                  }}>Download</button>
                  <button disabled={docActionBusy === d.id} onClick={() => reviewDocument(d.id, 'approve')} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 6,
                  }}>Approve</button>
                  <button disabled={docActionBusy === d.id} onClick={() => {
                    const reason = window.prompt('Reason for rejection:');
                    if (reason) reviewDocument(d.id, 'reject', { reason });
                  }} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                  }}>Reject</button>
                  <button disabled={docActionBusy === d.id} onClick={() => {
                    const reason = window.prompt('Reason for resubmission:');
                    if (reason) reviewDocument(d.id, 'request_resubmission', { reason });
                  }} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#d97706', border: '1px solid #fde68a', borderRadius: 6,
                  }}>Resubmit</button>
                  <button disabled={docActionBusy === d.id} onClick={() => {
                    const date = window.prompt('Expiry date (YYYY-MM-DD):', d.expires_at ?? '');
                    if (date) reviewDocument(d.id, 'set_expiry', { expires_at: date });
                  }} style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6,
                  }}>Set Expiry</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Checklist */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Compliance Checklist</h3>
          <button disabled={checklistBusy} onClick={generateChecklist} style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe',
          }}>Generate from Requirements</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Custom checklist item" value={newChecklistLabel} onChange={e => setNewChecklistLabel(e.target.value)} style={{ ...inp, flex: 1 }} />
          <SubmitButton loading={checklistBusy} loadingText="Saving…" onClick={addChecklistItem} style={{
            padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>Add</SubmitButton>
        </div>
        {checklistLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : checklist.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No checklist items yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {checklist.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
                <input type="checkbox" checked={item.is_checked} onChange={() => toggleChecklistItem(item.id)} />
                <span style={{ fontSize: 13, color: item.is_checked ? '#94a3b8' : '#334155', textDecoration: item.is_checked ? 'line-through' : 'none' }}>{item.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Compliance Comments (distinct from Project Comments below) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Compliance Comments</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Add a comment…" value={newComplianceComment} onChange={e => setNewComplianceComment(e.target.value)} style={{ ...inp, flex: 1 }} />
          <SubmitButton loading={complianceCommentBusy} loadingText="Posting…" onClick={addComplianceComment} style={{
            padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>Post</SubmitButton>
        </div>
        {complianceCommentsLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : complianceComments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No comments yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {complianceComments.map(c => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{c.author_admin?.name ?? c.author_user?.name ?? 'Unknown'}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDate(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                <button onClick={() => removeComplianceComment(c.id)} style={{
                  marginTop: 4, padding: 0, background: 'none', border: 'none', color: '#dc2626', fontSize: 10.5, cursor: 'pointer',
                }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seller & Client Info */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Seller &amp; Client Information</h3>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <label style={lbl}>Seller</label>
            <div style={{ fontSize: 13, color: '#334155' }}>{caseData.project.seller?.name ?? 'Unassigned'}</div>
            {caseData.project.seller?.email && <div style={{ fontSize: 12, color: '#94a3b8' }}>{caseData.project.seller.email}</div>}
          </div>
          <div style={{ minWidth: 220 }}>
            <label style={lbl}>Client</label>
            <div style={{ fontSize: 13, color: '#334155' }}>{caseData.client?.name ?? 'No client linked'}</div>
            {caseData.client?.email && <div style={{ fontSize: 12, color: '#94a3b8' }}>{caseData.client.email}</div>}
          </div>
        </div>
      </div>

      {/* Originating Lead (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Originating Lead</h3>
        {leadLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : !lead ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>This project isn&apos;t linked to a lead.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{lead.name}</span>
              <Badge label={lead.status} sc={LEAD_SC[lead.status]} />
              {lead.deal_reference && <span style={{ fontSize: 11, color: '#94a3b8' }}>{lead.deal_reference}</span>}
            </div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <label style={lbl}>Source</label>
                <div style={{ fontSize: 13, color: '#334155', textTransform: 'capitalize' }}>{lead.source ? lead.source.replace(/_/g, ' ') : '—'}</div>
              </div>
              <div style={{ minWidth: 160 }}>
                <label style={lbl}>Priority</label>
                <div style={{ fontSize: 13, color: '#334155', textTransform: 'capitalize' }}>{lead.priority}</div>
              </div>
              <div style={{ minWidth: 160 }}>
                <label style={lbl}>Estimated Value</label>
                <div style={{ fontSize: 13, color: '#334155' }}>{lead.estimated_value ?? '—'}</div>
              </div>
              <div style={{ minWidth: 160 }}>
                <label style={lbl}>Assigned To</label>
                <div style={{ fontSize: 13, color: '#334155' }}>{lead.assigned_to?.name ?? 'Unassigned'}</div>
              </div>
              <div style={{ minWidth: 160 }}>
                <label style={lbl}>Won / Converted</label>
                <div style={{ fontSize: 13, color: '#334155' }}>{lead.converted_at ? fmtDate(lead.converted_at) : '—'}</div>
              </div>
            </div>
            {lead.notes && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: '#64748b', whiteSpace: 'pre-wrap' }}>{lead.notes}</div>
            )}

            <label style={{ ...lbl, marginTop: 18 }}>Follow-ups</label>
            {lead.follow_ups.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>No follow-ups scheduled.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lead.follow_ups.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>{f.type}</span>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {fmtDate(f.scheduled_at)}{f.assigned_to ? ` · ${f.assigned_to.name}` : ''}
                      </div>
                      {f.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{f.notes}</div>}
                    </div>
                    <Badge label={f.status} sc={FOLLOWUP_SC[f.status]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Project Team (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Project Team</h3>
        {teamLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : projectTeam.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No team members assigned.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {projectTeam.map(m => (
              <div key={m.id} style={{ minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{m.user?.name ?? 'Unknown'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {m.role_in_project.replace(/_/g, ' ')}{m.user?.email ? ` · ${m.user.email}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seller-Client Chat History (read-only) */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>Project Chat History</h3>
          {chatMessages.length > 0 && (
            <button onClick={exportChat} style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
              background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', flexShrink: 0,
            }}>Export</button>
          )}
        </div>
        {chatLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : chatMessages.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No chat started yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
            {chatMessages.map(m => (
              <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{m.sender?.name ?? m.sender_admin?.name ?? m.guest_sender_name ?? 'Unknown'}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDate(m.sent_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                {m.attachment_name && <div style={{ fontSize: 11.5, color: '#2563eb', marginTop: 2 }}>📎 {m.attachment_name}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* General Chat (read-only, company-wide — not tied to this project) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>General Chat</h3>
        {generalChatLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : generalChatThreads.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No General Chat threads yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {generalChatThreads.map(t => (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.title || 'Untitled'}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{t.last_message_at ? fmtDate(t.last_message_at) : ''}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {t.participants.map(p => p.name).filter(Boolean).join(', ')}
                </div>
                {t.last_message && (
                  <div style={{ fontSize: 12.5, color: '#334155', marginTop: 4 }}>
                    <span style={{ fontWeight: 600 }}>{t.last_message.sender_name}:</span> {t.last_message.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Attachments/Files (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Project Attachments / Files</h3>
        {attachmentsLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : projectAttachments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No attachments uploaded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projectAttachments.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.original_name}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {fmtFileSize(a.file_size)} · {a.uploaded_by_admin?.name ?? a.uploaded_by_user?.name ?? 'Unknown'} · {fmtDate(a.created_at)}
                  </div>
                </div>
                <button onClick={() => downloadProjectAttachment(a)} style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                  background: '#2563eb', color: '#fff', border: 'none', flexShrink: 0,
                }}>Download</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relevant Task Status (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Relevant Task Status</h3>
        {tasksLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : projectTasks.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No tasks on this project.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projectTasks.map(t => (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.title}</span>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {t.assigned_to?.name ?? 'Unassigned'}{t.due_date ? ` · Due ${fmtDate(t.due_date)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge label={t.status} sc={TASK_SC[t.status]} />
                    <button onClick={() => toggleTaskExpand(t.id)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      background: '#fff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, whiteSpace: 'nowrap',
                    }}>{expandedTaskId === t.id ? 'Hide' : 'Comments & History'}</button>
                  </div>
                </div>

                {expandedTaskId === t.id && (
                  <div style={{ marginTop: 8, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    {taskDetailLoading === t.id ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>Loading…</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Comments</div>
                        {(taskDetailCache[t.id]?.comments.length ?? 0) === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>No comments.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                            {taskDetailCache[t.id]?.comments.map(c => (
                              <div key={c.id} style={{ fontSize: 12, color: '#334155' }}>
                                <span style={{ fontWeight: 600 }}>{c.author_admin?.name ?? c.author_user?.name ?? 'Unknown'}</span>{' '}
                                <span style={{ color: '#94a3b8', fontSize: 10.5 }}>{fmtDate(c.created_at)}</span>
                                <div>{c.body}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>History</div>
                        {(taskDetailCache[t.id]?.activities.length ?? 0) === 0 ? (
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>No activity yet.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {taskDetailCache[t.id]?.activities.map(a => (
                              <div key={a.id} style={{ fontSize: 11.5, color: '#64748b' }}>
                                {a.description} <span style={{ color: '#94a3b8', fontSize: 10.5 }}>· {fmtDate(a.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uploaded Deliverables (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Uploaded Deliverables</h3>
        {deliverablesLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {deliverables.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>No deliverables uploaded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                {deliverables.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{d.title}</span>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        v{d.version} · {d.uploaded_by?.name ?? 'Unknown'}{d.task ? ` · ${d.task.title}` : ''}
                      </div>
                    </div>
                    <Badge label={d.status} sc={DELIVERABLE_SC[d.status]} />
                  </div>
                ))}
              </div>
            )}
            <label style={lbl}>Final Delivery History</label>
            {deliveryHistory.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Not yet delivered to client.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {deliveryHistory.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#334155', padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span>{h.file_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: '#94a3b8' }}>{h.delivered_by_admin?.name ?? 'Unknown'} · {fmtDate(h.delivered_at)}</span>
                      <button onClick={() => downloadDelivery(h)} style={{
                        padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        background: '#2563eb', color: '#fff', border: 'none', flexShrink: 0,
                      }}>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Project Timesheets (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Project Timesheets</h3>
        {timesheetsLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : timesheets.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No time logged on this project.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {timesheets.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.task?.title ?? 'Untitled task'}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {t.user?.name ?? 'Unknown'} · {t.hours_logged}h · {fmtDate(t.log_date)}
                  </div>
                  {t.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t.notes}</div>}
                </div>
                <Badge label={t.status} sc={TIMESHEET_SC[t.status]} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing / Invoicing (read-only) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Billing / Invoicing</h3>
        {billingLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : invoices.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No invoices for this project.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {invoices.map(inv => (
              <div key={inv.id} style={{ padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{inv.invoice_number}</span>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {inv.currency} {inv.total_amount} total · {inv.currency} {inv.paid_amount} paid
                      {inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''}
                    </div>
                  </div>
                  <Badge label={inv.status} sc={INVOICE_SC[inv.status]} />
                </div>
                {inv.payments.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {inv.payments.map(p => (
                      <div key={p.id} style={{ fontSize: 11.5, color: '#64748b' }}>
                        {p.currency} {p.amount} via {paymentMethodText(p)} — {p.status}{p.payment_date ? ` · ${fmtDate(p.payment_date)}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Comments (read-only, general project discussion) */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Project Comments</h3>
        {projectCommentsLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : projectComments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No project-level comments.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projectComments.map(c => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{c.author_admin?.name ?? c.author_user?.name ?? 'Unknown'}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{fmtDate(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Project History (read-only) — created/updated/status
          changes, task status changes, invoice created/paid, merged from
          every project lifecycle action, not just Compliance actions. */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Project History</h3>
        {historyLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No history yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
            {history.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{item.description}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {item.source}{item.causer_name ? ` · ${item.causer_name}` : ''} · {fmtDate(item.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div style={{ ...card, marginBottom: 0 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Activity Log</h3>
        {activity.length === 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{activityText(item)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtDate(item.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

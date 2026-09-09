"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    userComplianceService,
    ComplianceCase,
    ComplianceCaseStatus,
    Paginated,
} from "@/lib/services/userComplianceService";
import {
    Badge, IconStatCard, CASE_STATUS_SC, PROJECT_STATUS_SC, inp, blobErrorMessage,
} from "@/components/compliance/shared";
import { can } from "@/lib/auth";
import toast from "react-hot-toast";
import ChatModal from "@/components/compliance/ChatModal";
import CommentsModal from "@/components/compliance/CommentsModal";
import TaskAttachmentsModal from "@/components/compliance/TaskAttachmentsModal";
import ProjectAttachmentsModal from "@/components/compliance/ProjectAttachmentsModal";
import ClientAttachmentsModal from "@/components/compliance/ClientAttachmentsModal";
import InvoicesModal from "@/components/compliance/InvoicesModal";
import FinalDeliveryModal from "@/components/compliance/FinalDeliveryModal";
import ProjectOverviewModal from "@/components/compliance/ProjectOverviewModal";
import {
    HiOutlineFolderOpen, HiOutlineDocument, HiOutlineClock, HiOutlineMagnifyingGlass,
    HiOutlineCheckCircle, HiOutlinePauseCircle, HiOutlineXCircle,
    HiOutlinePaperClip, HiOutlineUserCircle, HiOutlineBanknotes,
    HiOutlineChatBubbleBottomCenterText, HiOutlineChatBubbleLeftRight,
    HiOutlineArchiveBox, HiOutlineArrowDownTray,
} from "react-icons/hi2";

// One color+icon per action, so each button reads at a glance instead of
// every column showing the same indigo pill with only a tiny header label
// (and an emoji, which doesn't render as a distinct glyph in every
// environment/font) to tell them apart. Mirrors
// components/admin/compliance/ProjectsListing.tsx's ROW_ACTIONS/RowAction.
const ROW_ACTIONS = {
    taskFiles: { icon: HiOutlinePaperClip, label: "Task Files", color: "#4f46e5", bg: "#eef2ff", border: "#e0e7ff" },
    projectFiles: { icon: HiOutlineFolderOpen, label: "Project Files", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    clientFiles: { icon: HiOutlineUserCircle, label: "Client Files", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
    invoices: { icon: HiOutlineBanknotes, label: "Invoices", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    comments: { icon: HiOutlineChatBubbleBottomCenterText, label: "Comments", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    chat: { icon: HiOutlineChatBubbleLeftRight, label: "Chat", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    delivery: { icon: HiOutlineArchiveBox, label: "Delivery", color: "#e11d48", bg: "#fff1f2", border: "#fecdd3" },
    zip: { icon: HiOutlineArrowDownTray, label: "Download ZIP", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
} as const;

// A row's action button — icon + visible label + count, colored per action
// (see ROW_ACTIONS) so "which button is this" never depends on reading the
// column header or squinting at an emoji.
function RowAction({
    action, count, onClick, disabled, title, labelOverride,
}: {
    action: keyof typeof ROW_ACTIONS;
    count?: number;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    labelOverride?: string;
}) {
    const { icon: Icon, label: defaultLabel, color, bg, border } = ROW_ACTIONS[action];
    const label = labelOverride ?? defaultLabel;
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title ?? (count !== undefined ? `${label}: ${count}` : label)}
            style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 9px", borderRadius: 7, border: `1.5px solid ${border}`, background: bg,
                color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
            }}
        >
            <Icon size={13} />
            <span>{label}</span>
            {count !== undefined && <span style={{ opacity: 0.7 }}>({count})</span>}
        </button>
    );
}

const STATUS_LABEL: Record<ComplianceCaseStatus, string> = {
    not_started: "Not Started",
    pending: "Pending",
    under_review: "Under Review",
    compliant: "Compliant",
    on_hold: "On Hold",
    rejected: "Rejected",
};

const STATUS_CARDS: { status: ComplianceCaseStatus; icon: React.ReactNode }[] = [
    { status: "not_started", icon: <HiOutlineDocument /> },
    { status: "pending", icon: <HiOutlineClock /> },
    { status: "under_review", icon: <HiOutlineMagnifyingGlass /> },
    { status: "compliant", icon: <HiOutlineCheckCircle /> },
    { status: "on_hold", icon: <HiOutlinePauseCircle /> },
    { status: "rejected", icon: <HiOutlineXCircle /> },
];

// The "Project Compliance Listing" table + stat cards — shared between the
// standalone /compliance page (all projects) and a client's own compliance
// page (scoped via clientId). Caller owns DashboardLayout/guards; this only
// renders the content.
export default function ProjectsListing({
    clientId,
    title = "Project Compliance Listing",
    subtitle = "Manage and track compliance requirements across all projects.",
    showClientLink = true,
    zipFileNamePrefix = "all",
}: {
    clientId?: number;
    title?: string;
    subtitle?: string;
    showClientLink?: boolean;
    zipFileNamePrefix?: string;
}) {
    const router = useRouter();
    // Client-scoped view (rendered inside a client's own compliance page) —
    // Project ID/Compliance Officer are dropped in favor of Project
    // Manager/Seller, which are more useful once every row is already known
    // to belong to this one client.
    const embedded = !!clientId;

    const canView = can("compliance", "canViewCompliance");
    const canDownload = can("compliance", "canDownloadComplianceData");

    // can() reads cookies, unavailable during server-side rendering, so the
    // server always sees these as false while the client's pre-hydration
    // render sees the real cookie — a hydration mismatch. Hold every
    // permission-gated branch behind `mounted` so the first paint matches.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [page, setPage] = useState<Paginated<ComplianceCase> | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [pageNum, setPageNum] = useState(1);
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [finalDeliveryModalProject, setFinalDeliveryModalProject] = useState<{ id: number; name: string } | null>(null);
    const [overviewModalProjectId, setOverviewModalProjectId] = useState<number | null>(null);
    const [chatModalProject, setChatModalProject] = useState<{ id: number; name: string } | null>(null);
    const [commentsModalProject, setCommentsModalProject] = useState<{ id: number; projectName: string } | null>(null);
    const [taskAttachmentsModalProject, setTaskAttachmentsModalProject] = useState<{ id: number; name: string } | null>(null);
    const [projectAttachmentsModalProject, setProjectAttachmentsModalProject] = useState<{ id: number; name: string } | null>(null);
    const [clientAttachmentsModalProject, setClientAttachmentsModalProject] = useState<{ id: number; name: string } | null>(null);
    const [invoicesModalProject, setInvoicesModalProject] = useState<{ id: number; name: string } | null>(null);

    const cases = page?.data ?? [];
    const perPage = page?.per_page ?? 20;
    const from = page && page.total > 0 ? (pageNum - 1) * perPage + 1 : 0;
    const to = page ? Math.min(pageNum * perPage, page.total) : 0;

    // Stat counts sourced from the dashboard endpoint (real per-status
    // totals across every visible case, optionally scoped to clientId),
    // kept separate from the paginated table load below.
    const [counts, setCounts] = useState<Record<string, number> | null>(null);
    const [total, setTotal] = useState(0);

    const loadCounts = async () => {
        try {
            const dashboard = await userComplianceService.dashboard.get(clientId);
            setCounts(dashboard.by_status as unknown as Record<string, number>);
            setTotal(dashboard.total);
        } catch { /* stat cards just stay blank on failure — table still loads */ }
    };

    const load = async (targetPage = 1) => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(targetPage), per_page: "20" };
            if (search) params.search = search;
            if (status) params.status = status;
            if (clientId) params.client_id = String(clientId);
            const res = await userComplianceService.cases.list(params);
            setPage(res);
            setPageNum(res.current_page);
        } catch (err: unknown) {
            const s = (err as { response?: { status?: number } })?.response?.status;
            if (s === 403) setForbidden(true);
            else toast.error("Failed to load compliance projects");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(1); loadCounts(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        load(1);
    };

    const downloadProjectZip = async (projectId: number, projectName: string) => {
        setDownloadingId(projectId);
        try {
            await userComplianceService.cases.downloadProjectZip(projectId, `${projectName}-compliance-documents.zip`);
        } catch (err: unknown) {
            toast.error(await blobErrorMessage(err, "Failed to download documents"));
        } finally {
            setDownloadingId(null);
        }
    };

    const downloadAllZip = async () => {
        setDownloadingAll(true);
        try {
            await userComplianceService.cases.downloadAllZip(`${zipFileNamePrefix}-compliance-documents.zip`, clientId);
        } catch (err: unknown) {
            toast.error(await blobErrorMessage(err, "Failed to download documents"));
        } finally {
            setDownloadingAll(false);
        }
    };

    return (
        <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                        {subtitle}
                        {showClientLink && (
                            <>
                                {" "}
                                <button onClick={() => router.push("/compliance/clients")} style={{ background: "none", border: "none", padding: 0, color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                    View by Client →
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {!mounted ? (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
            ) : !canView ? (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9" }}>
                    You don&apos;t have permission to view Compliance.
                </div>
            ) : forbidden ? (
                <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9" }}>
                    You don&apos;t have permission to view this.
                </div>
            ) : (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
                        <IconStatCard icon={<HiOutlineFolderOpen />} label="Total Projects" value={String(total)} bg="#dbeafe" color="#2563eb" />
                        {STATUS_CARDS.map(({ status: s, icon }) => (
                            <IconStatCard key={s} icon={icon} label={STATUS_LABEL[s]} value={String(counts?.[s] ?? 0)} bg={CASE_STATUS_SC[s].bg} color={CASE_STATUS_SC[s].color} />
                        ))}
                    </div>

                    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #f1f5f9" }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                                Compliance Projects {page ? `(${page.total})` : ""}
                            </h2>
                            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search projects..."
                                    style={{ ...inp, width: 220 }}
                                />
                                <select value={status} onChange={(e) => { setStatus(e.target.value); }} style={{ ...inp, width: 160 }}>
                                    <option value="">All Statuses</option>
                                    {STATUS_CARDS.map(({ status: s }) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                </select>
                                <button type="submit" style={{
                                    padding: "9px 16px", borderRadius: 8, border: "none", background: "#f1f5f9",
                                    color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                                }}>
                                    Search
                                </button>
                            </form>
                        </div>

                        {loading ? (
                            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
                        ) : cases.length === 0 ? (
                            <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
                                <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
                                <div style={{ fontWeight: 600, color: "#64748b", marginBottom: 4 }}>No compliance projects found</div>
                                <div style={{ fontSize: 13 }}>Try adjusting your search or status filter</div>
                            </div>
                        ) : (
                            <div className="hide-scrollbar" style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "#f8fafc" }}>
                                            {(embedded
                                                ? ["#", "Project", "Task Files", "Project Files", "Client Files", "Invoices", "Comments", "Chat", "Delivery", "Download"]
                                                : ["#", "ID", "Project", "Task Files", "Project Files", "Client Files", "Invoices", "Comments", "Chat", "Delivery", "Download"]
                                            ).map(h => (
                                                <th key={h} style={{
                                                    padding: "9px 6px", textAlign: "left", fontSize: 10.5, fontWeight: 700,
                                                    color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap",
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cases.map((c, i) => (
                                            <tr key={c.id} style={{ borderBottom: i < cases.length - 1 ? "1px solid #f8fafc" : "none" }}>
                                                <td style={{ padding: "9px 8px", color: "#94a3b8", fontSize: 12 }}>{from + i}</td>
                                                {!embedded && (
                                                    <td style={{ padding: "9px 8px", color: "#64748b", fontSize: 12 }}>
                                                        {c.project.reference ?? `#${c.project.id}`}
                                                    </td>
                                                )}
                                                <td
                                                    style={{ padding: "9px 8px", cursor: "pointer", maxWidth: 220 }}
                                                    onClick={() => setOverviewModalProjectId(c.project.id)}
                                                >
                                                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{c.project.name}</div>
                                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", maxWidth: 220 }}>
                                                        <span>{c.client?.name ?? "—"}</span>
                                                        <span>·</span>
                                                        <Badge label={c.project.status} sc={PROJECT_STATUS_SC[c.project.status]} />
                                                    </div>
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="taskFiles"
                                                        count={c.task_attachments_count ?? 0}
                                                        onClick={() => setTaskAttachmentsModalProject({ id: c.project.id, name: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="projectFiles"
                                                        count={c.project_attachments_count ?? 0}
                                                        onClick={() => setProjectAttachmentsModalProject({ id: c.project.id, name: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="clientFiles"
                                                        count={c.client_attachments_count ?? 0}
                                                        onClick={() => setClientAttachmentsModalProject({ id: c.project.id, name: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="invoices"
                                                        count={c.invoices_count ?? 0}
                                                        onClick={() => setInvoicesModalProject({ id: c.project.id, name: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="comments"
                                                        count={c.comments_count ?? 0}
                                                        onClick={() => setCommentsModalProject({ id: c.project.id, projectName: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="chat"
                                                        onClick={() => setChatModalProject({ id: c.project.id, name: c.project.name })}
                                                        title="Open Chat"
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }} onClick={e => e.stopPropagation()}>
                                                    <RowAction
                                                        action="delivery"
                                                        count={c.final_delivery_count ?? 0}
                                                        onClick={() => setFinalDeliveryModalProject({ id: c.project.id, name: c.project.name })}
                                                    />
                                                </td>
                                                <td style={{ padding: "9px 8px" }}>
                                                    {canDownload ? (
                                                        <RowAction
                                                            action="zip"
                                                            onClick={() => downloadProjectZip(c.project.id, c.project.name)}
                                                            disabled={downloadingId === c.project.id}
                                                            labelOverride={downloadingId === c.project.id ? "Preparing…" : undefined}
                                                            title={downloadingId === c.project.id ? "Preparing download…" : "Download all compliance documents as a ZIP"}
                                                        />
                                                    ) : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {page && page.total > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: "#64748b" }}>
                                Showing {from} to {to} of {page.total} project{page.total === 1 ? "" : "s"}
                            </span>
                            {page.last_page > 1 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button
                                        onClick={() => load(pageNum - 1)}
                                        disabled={pageNum <= 1}
                                        style={{
                                            padding: "7px 12px", borderRadius: 7, border: "1.5px solid #e2e8f0",
                                            background: pageNum <= 1 ? "#f8fafc" : "#fff", color: pageNum <= 1 ? "#cbd5e1" : "#475569",
                                            fontSize: 14, cursor: pageNum <= 1 ? "default" : "pointer",
                                        }}
                                    >
                                        ‹
                                    </button>
                                    <span style={{
                                        padding: "6px 13px", borderRadius: 7, background: "#2563eb", color: "#fff",
                                        fontSize: 13, fontWeight: 700,
                                    }}>
                                        {pageNum}
                                    </span>
                                    <button
                                        onClick={() => load(pageNum + 1)}
                                        disabled={pageNum >= page.last_page}
                                        style={{
                                            padding: "7px 12px", borderRadius: 7, border: "1.5px solid #e2e8f0",
                                            background: pageNum >= page.last_page ? "#f8fafc" : "#fff", color: pageNum >= page.last_page ? "#cbd5e1" : "#475569",
                                            fontSize: 14, cursor: pageNum >= page.last_page ? "default" : "pointer",
                                        }}
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {chatModalProject && (
                <ChatModal
                    projectId={chatModalProject.id}
                    projectName={chatModalProject.name}
                    onClose={() => setChatModalProject(null)}
                />
            )}

            {commentsModalProject && (
                <CommentsModal
                    projectId={commentsModalProject.id}
                    projectName={commentsModalProject.projectName}
                    onClose={() => setCommentsModalProject(null)}
                />
            )}

            {taskAttachmentsModalProject && (
                <TaskAttachmentsModal
                    projectId={taskAttachmentsModalProject.id}
                    projectName={taskAttachmentsModalProject.name}
                    onClose={() => setTaskAttachmentsModalProject(null)}
                />
            )}

            {projectAttachmentsModalProject && (
                <ProjectAttachmentsModal
                    projectId={projectAttachmentsModalProject.id}
                    projectName={projectAttachmentsModalProject.name}
                    onClose={() => setProjectAttachmentsModalProject(null)}
                />
            )}

            {clientAttachmentsModalProject && (
                <ClientAttachmentsModal
                    projectId={clientAttachmentsModalProject.id}
                    projectName={clientAttachmentsModalProject.name}
                    onClose={() => setClientAttachmentsModalProject(null)}
                />
            )}

            {invoicesModalProject && (
                <InvoicesModal
                    projectId={invoicesModalProject.id}
                    projectName={invoicesModalProject.name}
                    onClose={() => setInvoicesModalProject(null)}
                />
            )}

            {finalDeliveryModalProject && (
                <FinalDeliveryModal
                    projectId={finalDeliveryModalProject.id}
                    projectName={finalDeliveryModalProject.name}
                    onClose={() => setFinalDeliveryModalProject(null)}
                />
            )}

            {overviewModalProjectId !== null && (
                <ProjectOverviewModal
                    projectId={overviewModalProjectId}
                    onClose={() => setOverviewModalProjectId(null)}
                />
            )}
        </div>
    );
}

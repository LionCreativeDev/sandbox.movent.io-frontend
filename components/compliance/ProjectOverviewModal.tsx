"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { userComplianceService, ComplianceProjectOverview } from "@/lib/services/userComplianceService";
import { Badge, PRIORITY_SC, fmtDate } from "@/components/compliance/shared";
import toast from "react-hot-toast";

// Popup shown from clicking a project's name on the listing — a quick
// overview (budget, dates, client, team, description) without leaving the
// table. "View Full Details →" still opens the full detail page.
export default function ProjectOverviewModal({
    projectId,
    onClose,
}: {
    projectId: number;
    onClose: () => void;
}) {
    const router = useRouter();
    const [project, setProject] = useState<ComplianceProjectOverview | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userComplianceService.project.overview(projectId)
            .then((res) => { if (!cancelled) setProject(res); })
            .catch(() => { if (!cancelled) toast.error("Failed to load project overview"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520,
                    maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
                }}
            >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{project?.name ?? "Project Overview"}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#94a3b8", cursor: "pointer" }}>×</button>
                </div>

                <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                    ) : !project ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>Project not found.</div>
                    ) : (
                        <>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                                <Badge label={project.status} />
                                <Badge label={project.priority} sc={PRIORITY_SC[project.priority]} />
                            </div>

                            {project.reference && (
                                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{project.reference}</div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Budget</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{project.budget ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Client</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{project.client?.name ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Company</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{project.company?.name ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Start Date</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{fmtDate(project.start_date)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Deadline</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{fmtDate(project.deadline)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Project Manager</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{project.project_manager?.name ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Seller</div>
                                    <div style={{ fontSize: 13, color: "#1e293b" }}>{project.seller?.name ?? "—"}</div>
                                </div>
                            </div>

                            {project.description && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Description</div>
                                    <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{project.description}</div>
                                </div>
                            )}

                            <button
                                onClick={() => router.push(`/compliance/projects/${project.id}`)}
                                style={{
                                    width: "100%", padding: "10px 16px", borderRadius: 8, border: "none",
                                    background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                View Full Details →
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

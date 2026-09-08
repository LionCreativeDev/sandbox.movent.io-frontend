"use client";
import { useEffect, useState } from "react";
import { userComplianceService, ComplianceProjectComment } from "@/lib/services/userComplianceService";
import { fmtDate } from "@/components/compliance/shared";
import toast from "react-hot-toast";

// Popup shown from the Project Compliance Listing's "Comments" column —
// general Project Comments (same as the detail page's "Project Comments"
// card), NOT the separate, much-less-used "Compliance Comments" feature.
// Read-only, same as ChatModal.tsx.
export default function CommentsModal({
    projectId,
    projectName,
    onClose,
}: {
    projectId: number;
    projectName: string;
    onClose: () => void;
}) {
    const [comments, setComments] = useState<ComplianceProjectComment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userComplianceService.project.comments(projectId)
            .then((res) => { if (!cancelled) setComments(res); })
            .catch(() => { if (!cancelled) toast.error("Failed to load comments"); })
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
                    background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560,
                    maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
                }}
            >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Comments — {projectName}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#94a3b8", cursor: "pointer" }}>×</button>
                </div>

                <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                    ) : comments.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No comments yet.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {comments.map((c) => (
                                <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{c.author_admin?.name ?? c.author_user?.name ?? "Unknown"}</span>
                                        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{fmtDate(c.created_at)}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#1e293b", marginTop: 2, whiteSpace: "pre-wrap" }}>{c.body}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

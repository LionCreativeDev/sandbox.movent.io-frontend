"use client";
import { useEffect, useState } from "react";
import { userComplianceService, ComplianceProjectAttachment } from "@/lib/services/userComplianceService";
import { fmtDate, fmtFileSize } from "@/components/compliance/shared";
import { can } from "@/lib/auth";
import toast from "react-hot-toast";

// Popup shown from the Project Compliance Listing's "Project Attachments"
// column — same list as the project detail page's "Project Attachments /
// Files" card. Read-only besides Download, same as TaskAttachmentsModal.tsx.
export default function ProjectAttachmentsModal({
    projectId,
    projectName,
    onClose,
}: {
    projectId: number;
    projectName: string;
    onClose: () => void;
}) {
    const canDownload = can("compliance", "canDownloadComplianceData");

    const [attachments, setAttachments] = useState<ComplianceProjectAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userComplianceService.project.attachments(projectId)
            .then((res) => { if (!cancelled) setAttachments(res); })
            .catch(() => { if (!cancelled) toast.error("Failed to load attachments"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    const download = async (a: ComplianceProjectAttachment) => {
        setDownloadingId(a.id);
        try { await userComplianceService.project.attachmentDownload(a.id, a.original_name); }
        catch { toast.error("Download failed"); }
        finally { setDownloadingId(null); }
    };

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
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Project Attachments — {projectName}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#94a3b8", cursor: "pointer" }}>×</button>
                </div>

                <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                    ) : attachments.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No attachments uploaded.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {attachments.map((a) => (
                                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                                    <div>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{a.original_name}</span>
                                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                            {fmtFileSize(a.file_size)} · {a.uploaded_by_admin?.name ?? a.uploaded_by_user?.name ?? "Unknown"} · {fmtDate(a.created_at)}
                                        </div>
                                    </div>
                                    {canDownload && (
                                        <button onClick={() => download(a)} disabled={downloadingId === a.id} style={{
                                            padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: downloadingId === a.id ? "default" : "pointer",
                                            background: "#2563eb", color: "#fff", border: "none", flexShrink: 0,
                                        }}>{downloadingId === a.id ? "…" : "Download"}</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

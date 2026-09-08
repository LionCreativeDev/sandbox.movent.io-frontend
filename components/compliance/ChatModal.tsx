"use client";
import { useEffect, useState } from "react";
import { userComplianceService, ComplianceChatMessage } from "@/lib/services/userComplianceService";
import { fmtDate, errorMessage, inp } from "@/components/compliance/shared";
import { can } from "@/lib/auth";
import toast from "react-hot-toast";

// Popup shown from the Project Compliance Listing's "Open Chat" button —
// same read-only chat history + date filter + export as the project detail
// page's "Project Chat History" card, just without navigating away.
export default function ChatModal({
    projectId,
    projectName,
    onClose,
}: {
    projectId: number;
    projectName: string;
    onClose: () => void;
}) {
    const canDownload = can("compliance", "canDownloadComplianceData");

    const [messages, setMessages] = useState<ComplianceChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userComplianceService.project.chat(projectId)
            .then((res) => { if (!cancelled) setMessages(res.messages); })
            .catch(() => { if (!cancelled) toast.error("Failed to load chat"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    const filtered = messages.filter((m) => {
        const sentAt = new Date(m.sent_at);
        if (startDate && sentAt < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && sentAt > new Date(`${endDate}T23:59:59`)) return false;
        return true;
    });

    const handleExport = async () => {
        setExporting(true);
        try {
            await userComplianceService.project.chatExport(projectId, {
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            });
        } catch (err: unknown) {
            toast.error(errorMessage(err, "Export failed"));
        } finally {
            setExporting(false);
        }
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
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Chat — {projectName}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#94a3b8", cursor: "pointer" }}>×</button>
                </div>

                <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 11.5, color: "#64748b" }}>From</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inp, width: 140, padding: "5px 8px" }} />
                    <label style={{ fontSize: 11.5, color: "#64748b" }}>To</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...inp, width: 140, padding: "5px 8px" }} />
                    {(startDate || endDate) && (
                        <button onClick={() => { setStartDate(""); setEndDate(""); }} style={{
                            padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                            background: "#fff", color: "#64748b", border: "1px solid #e2e8f0",
                        }}>Clear</button>
                    )}
                    {canDownload && messages.length > 0 && (
                        <button onClick={handleExport} disabled={exporting} style={{
                            marginLeft: "auto", padding: "4px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                            cursor: exporting ? "default" : "pointer", background: "#fff", color: "#2563eb", border: "1px solid #bfdbfe",
                        }}>{exporting ? "Exporting…" : "Export"}</button>
                    )}
                </div>

                <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                    ) : messages.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No chat started yet.</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No messages in the selected date range.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {filtered.map((m) => (
                                <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{m.sender?.name ?? m.sender_admin?.name ?? m.guest_sender_name ?? "Unknown"}</span>
                                        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{fmtDate(m.sent_at)}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#1e293b", marginTop: 2, whiteSpace: "pre-wrap" }}>{m.content}</div>
                                    {m.attachment_name && <div style={{ fontSize: 11.5, color: "#2563eb", marginTop: 2 }}>📎 {m.attachment_name}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

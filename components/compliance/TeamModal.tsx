"use client";
import { useEffect, useState } from "react";
import { userComplianceService, ComplianceTeamMember } from "@/lib/services/userComplianceService";
import toast from "react-hot-toast";

// Popup shown from the Project Compliance Listing's "Team" column —
// read-only list, same as ChatModal.tsx/CommentsModal.tsx.
export default function TeamModal({
    projectId,
    projectName,
    onClose,
}: {
    projectId: number;
    projectName: string;
    onClose: () => void;
}) {
    const [team, setTeam] = useState<ComplianceTeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        userComplianceService.project.team(projectId)
            .then((res) => { if (!cancelled) setTeam(res); })
            .catch(() => { if (!cancelled) toast.error("Failed to load team"); })
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
                    background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
                    maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
                }}
            >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Team — {projectName}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "#94a3b8", cursor: "pointer" }}>×</button>
                </div>

                <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                    ) : team.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>No team members assigned.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {team.map((m) => (
                                <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{m.user?.name ?? "Unknown"}</div>
                                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                        {m.role_in_project.replace(/_/g, " ")}{m.user?.email ? ` · ${m.user.email}` : ""}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useModuleGuard } from "@/hooks/useModuleGuard";
import {
    userComplianceService,
    ComplianceClientDetail,
} from "@/lib/services/userComplianceService";
import { can } from "@/lib/auth";
import { Badge, CASE_STATUS_SC, card, fmtDate } from "@/components/compliance/shared";
import { handleNotFound } from "@/lib/notFound";
import toast from "react-hot-toast";

export default function ComplianceClientDetailPage() {
    useAdminGuard();
    useModuleGuard("compliance");
    const router = useRouter();
    const params = useParams();
    const id = Number(params.id);

    const canView = can("compliance", "canViewCompliance");

    // can() reads cookies, unavailable during server-side rendering, so the
    // server always sees canView=false while the client's pre-hydration
    // render sees the real cookie — a hydration mismatch. Hold the
    // permission-gated branch behind `mounted` (false on both the server
    // and the client's first render) so the first paint matches, then let
    // the real value take over once mounted flips true post-hydration.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [detail, setDetail] = useState<ComplianceClientDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setDetail(await userComplianceService.clients.get(id));
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            if (status === 403) {
                setForbidden(true);
            } else if (!handleNotFound(err, router)) {
                toast.error("Client not found or not accessible");
                router.replace("/compliance/clients");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canView) load();
        else setLoading(false);
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <DashboardLayout title="Compliance">
            <div style={{ width: "100%", maxWidth: "none" }}>
                <button
                    onClick={() => router.push("/compliance/clients")}
                    style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        marginBottom: 8,
                        cursor: "pointer",
                        color: "#64748b",
                        fontSize: 13,
                    }}
                >
                    ← Back to Clients
                </button>

                {!mounted ? (
                    <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
                        Loading…
                    </div>
                ) : !canView ? (
                    <div
                        style={{
                            padding: 48,
                            textAlign: "center",
                            color: "#94a3b8",
                            background: "#fff",
                            borderRadius: 14,
                            border: "1px solid #f1f5f9",
                        }}
                    >
                        You don&apos;t have permission to view Compliance.
                    </div>
                ) : forbidden ? (
                    <div
                        style={{
                            padding: 48,
                            textAlign: "center",
                            color: "#94a3b8",
                            background: "#fff",
                            borderRadius: 14,
                            border: "1px solid #f1f5f9",
                        }}
                    >
                        You don&apos;t have permission to view this.
                    </div>
                ) : loading ? (
                    <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
                        Loading…
                    </div>
                ) : !detail ? null : (
                    <>
                        <div style={card}>
                            <h1
                                style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: "#0f172a",
                                    margin: "0 0 12px",
                                }}
                            >
                                {detail.client.name}
                            </h1>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 24,
                                    flexWrap: "wrap",
                                    fontSize: 13,
                                    color: "#64748b",
                                }}
                            >
                                <span>
                                    Email:{" "}
                                    <strong style={{ color: "#334155" }}>
                                        {(detail.client.email as string) ?? "—"}
                                    </strong>
                                </span>
                                <span>
                                    Phone:{" "}
                                    <strong style={{ color: "#334155" }}>
                                        {(detail.client.phone as string) ?? "—"}
                                    </strong>
                                </span>
                            </div>
                        </div>

                        <div
                            style={{
                                background: "#fff",
                                borderRadius: 14,
                                border: "1px solid #f1f5f9",
                                overflow: "hidden",
                            }}
                        >
                            {detail.projects.length === 0 ? (
                                <div
                                    style={{
                                        padding: 48,
                                        textAlign: "center",
                                        color: "#94a3b8",
                                    }}
                                >
                                    No projects for this client yet.
                                </div>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table
                                        style={{ width: "100%", borderCollapse: "collapse" }}
                                    >
                                        <thead>
                                            <tr style={{ background: "#f8fafc" }}>
                                                {[
                                                    "Name",
                                                    "Reference",
                                                    "Status",
                                                    "PM",
                                                    "Seller",
                                                    "Compliance Status",
                                                    "Officer",
                                                    "Requirements",
                                                    "Deadline",
                                                ].map((h) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            padding: "12px 16px",
                                                            textAlign: "left",
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            color: "#94a3b8",
                                                            textTransform: "uppercase",
                                                            letterSpacing: "0.05em",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.projects.map((p, i) => (
                                                <tr
                                                    key={p.id}
                                                    onClick={() =>
                                                        router.push(`/compliance/projects/${p.id}`)
                                                    }
                                                    style={{
                                                        borderBottom:
                                                            i < detail.projects.length - 1
                                                                ? "1px solid #f8fafc"
                                                                : "none",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontWeight: 600,
                                                            color: "#0f172a",
                                                            fontSize: 14,
                                                        }}
                                                    >
                                                        {p.name}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {p.reference ?? "—"}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                            textTransform: "capitalize",
                                                        }}
                                                    >
                                                        {p.status.replace(/_/g, " ")}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {p.project_manager?.name ?? "—"}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {p.seller?.name ?? "—"}
                                                    </td>
                                                    <td style={{ padding: "14px 16px" }}>
                                                        <Badge
                                                            label={p.compliance_status}
                                                            sc={CASE_STATUS_SC[p.compliance_status]}
                                                        />
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {p.compliance_officer?.name ?? "Unassigned"}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#0f172a",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {p.requirements_approved}/{p.requirements_total}{" "}
                                                        approved
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {fmtDate(p.deadline)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

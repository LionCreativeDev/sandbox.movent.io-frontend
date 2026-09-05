"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useModuleGuard } from "@/hooks/useModuleGuard";
import {
    userComplianceService,
    ComplianceClientListItem,
} from "@/lib/services/userComplianceService";
import { can } from "@/lib/auth";
import { inp } from "@/components/compliance/shared";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "not_started", label: "Not Started" },
    { value: "pending", label: "Pending" },
    { value: "under_review", label: "Under Review" },
    { value: "compliant", label: "Compliant" },
    { value: "on_hold", label: "On Hold" },
    { value: "rejected", label: "Rejected" },
];

export default function ComplianceClientsPage() {
    useAdminGuard();
    useModuleGuard("compliance");
    const router = useRouter();

    const canView = can("compliance", "canViewCompliance");

    // can() reads cookies, unavailable during server-side rendering, so the
    // server always sees canView=false while the client's pre-hydration
    // render sees the real cookie — a hydration mismatch. Hold the
    // permission-gated branch behind `mounted` (false on both the server
    // and the client's first render) so the first paint matches, then let
    // the real value take over once mounted flips true post-hydration.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [clients, setClients] = useState<ComplianceClientListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (status) params.status = status;
            setClients(await userComplianceService.clients.list(params));
        } catch (err: unknown) {
            const s = (err as { response?: { status?: number } })?.response
                ?.status;
            if (s === 403) setForbidden(true);
            else toast.error("Failed to load compliance clients");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        load();
    };

    return (
        <DashboardLayout title="Compliance">
            <div style={{ width: "100%" }}>
                <div style={{ marginBottom: 20 }}>
                    <h1
                        style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: "#0f172a",
                            margin: 0,
                        }}
                    >
                        Compliance — Clients
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                        {clients.length} client{clients.length === 1 ? "" : "s"}
                    </p>
                </div>

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
                ) : (
                    <>
                        <form
                            onSubmit={handleSearch}
                            style={{ display: "flex", gap: 10, marginBottom: 20 }}
                        >
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, email, phone..."
                                style={{ ...inp, flex: 1 }}
                            />
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                style={{ ...inp, width: 200 }}
                            >
                                {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                style={{
                                    padding: "9px 20px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Search
                            </button>
                        </form>

                        <div
                            style={{
                                background: "#fff",
                                borderRadius: 14,
                                border: "1px solid #f1f5f9",
                                overflow: "hidden",
                            }}
                        >
                            {loading ? (
                                <div
                                    style={{
                                        padding: 48,
                                        textAlign: "center",
                                        color: "#94a3b8",
                                    }}
                                >
                                    Loading…
                                </div>
                            ) : clients.length === 0 ? (
                                <div
                                    style={{
                                        padding: 48,
                                        textAlign: "center",
                                        color: "#94a3b8",
                                    }}
                                >
                                    No clients found.
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
                                                    "Email",
                                                    "Phone",
                                                    "Total Projects",
                                                    "Compliant",
                                                    "Pending",
                                                    "Under Review",
                                                    "On Hold",
                                                    "Rejected",
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
                                            {clients.map((c, i) => (
                                                <tr
                                                    key={c.id}
                                                    onClick={() =>
                                                        router.push(`/compliance/clients/${c.id}`)
                                                    }
                                                    style={{
                                                        borderBottom:
                                                            i < clients.length - 1
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
                                                        {c.name}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {c.email ?? "—"}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#475569",
                                                        }}
                                                    >
                                                        {c.phone ?? "—"}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#0f172a",
                                                        }}
                                                    >
                                                        {c.total_projects}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#059669",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {c.compliant}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#b45309",
                                                        }}
                                                    >
                                                        {c.pending}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#2563eb",
                                                        }}
                                                    >
                                                        {c.under_review}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#ea580c",
                                                        }}
                                                    >
                                                        {c.on_hold}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: "14px 16px",
                                                            fontSize: 13,
                                                            color: "#dc2626",
                                                        }}
                                                    >
                                                        {c.rejected}
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

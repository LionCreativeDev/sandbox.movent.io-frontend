"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useModuleGuard } from "@/hooks/useModuleGuard";
import {
    userComplianceService,
    ComplianceDashboard,
    ComplianceCaseStatus,
} from "@/lib/services/userComplianceService";
import { StatCard, CASE_STATUS_SC } from "@/components/compliance/shared";
import { can } from "@/lib/auth";
import toast from "react-hot-toast";

const STATUS_LABEL: Record<ComplianceCaseStatus, string> = {
    not_started: "Not Started",
    pending: "Pending",
    under_review: "Under Review",
    compliant: "Compliant",
    on_hold: "On Hold",
    rejected: "Rejected",
};

// Reuses CASE_STATUS_SC's { bg, color } pairs but StatCard only takes a
// single accent color — always the darker `color` half of the pair.
const STATUS_ORDER: ComplianceCaseStatus[] = [
    "not_started",
    "pending",
    "under_review",
    "compliant",
    "on_hold",
    "rejected",
];

export default function ComplianceDashboardPage() {
    useAdminGuard();
    useModuleGuard("compliance");
    const router = useRouter();

    const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);

    const canView = can("compliance", "canViewComplianceCases");

    // can() reads cookies, unavailable during server-side rendering, so the
    // server always sees canView=false while the client's pre-hydration
    // render sees the real cookie — a hydration mismatch. Hold the
    // permission-gated branch behind `mounted` (false on both the server
    // and the client's first render) so the first paint matches, then let
    // the real value take over once mounted flips true post-hydration.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const load = async () => {
        setLoading(true);
        try {
            setDashboard(await userComplianceService.dashboard.get());
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            if (status === 403) {
                setForbidden(true);
            } else {
                toast.error("Failed to load compliance dashboard");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <DashboardLayout title="Compliance">
            <div style={{ width: "100%" }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 20,
                        flexWrap: "wrap",
                        gap: 12,
                    }}
                >
                    <div>
                        <h1
                            style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: "#0f172a",
                                margin: 0,
                            }}
                        >
                            Compliance Dashboard
                        </h1>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                            Overview of every compliance case across your clients&apos;
                            projects
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/compliance/clients")}
                        style={{
                            padding: "10px 20px",
                            borderRadius: 9,
                            border: "none",
                            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        View Clients →
                    </button>
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
                ) : loading ? (
                    <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
                        Loading…
                    </div>
                ) : dashboard ? (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                                gap: 16,
                                marginBottom: 20,
                            }}
                        >
                            <StatCard
                                label="Total Cases"
                                value={String(dashboard.total)}
                                color="#0f172a"
                            />
                            {STATUS_ORDER.map((s) => (
                                <StatCard
                                    key={s}
                                    label={STATUS_LABEL[s]}
                                    value={String(dashboard.by_status?.[s] ?? 0)}
                                    color={CASE_STATUS_SC[s].color}
                                />
                            ))}
                            <StatCard
                                label="Unassigned Officer"
                                value={String(dashboard.unassigned_officer)}
                                color="#ea580c"
                                sub="Cases with no compliance officer"
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </DashboardLayout>
    );
}

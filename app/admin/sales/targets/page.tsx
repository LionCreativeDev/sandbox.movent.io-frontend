"use client";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
    adminSalesTargetService,
    TeamSalesTarget,
} from "@/lib/services/salesExtrasService";
import TeamTargetsTable from "@/components/sales/TeamTargetsTable";
import toast from "react-hot-toast";

// Company Admin's own targets page — always reachable (see the Sidebar's
// ungated "Target" nav item and Api\Admin\SalesTargetController, itself
// registered outside any `module:` route middleware). Every Seller/Lead
// Manager's current-month target, editable here; a Seller can only ever
// view their own (frontend/app/sales/targets/page.tsx).
export default function AdminSalesTargetsPage() {
    const [targets, setTargets] = useState<TeamSalesTarget[]>([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        adminSalesTargetService
            .list()
            .then(setTargets)
            .catch(() => toast.error("Failed to load targets"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const save = async (
        userId: number,
        payload: { target_value?: number | null; target_deals?: number | null },
    ) => {
        try {
            await adminSalesTargetService.update(userId, payload);
            toast.success("Target updated");
            load();
        } catch (err: any) {
            toast.error(
                err?.response?.data?.message || "Failed to update target",
            );
        }
    };

    return (
        <DashboardLayout title="Sales Targets">
            <div style={{ width: "100%" }}>
                <h1
                    style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "#0f172a",
                        margin: "0 0 4px",
                    }}
                >
                    Sales Targets
                </h1>
                <p
                    style={{
                        margin: "0 0 20px",
                        fontSize: 13,
                        color: "#94a3b8",
                    }}
                >
                    Set this month&apos;s deal value / deal count target for
                    each Seller and Lead Manager.
                </p>

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
                ) : (
                    <TeamTargetsTable targets={targets} onSave={save} />
                )}
            </div>
        </DashboardLayout>
    );
}

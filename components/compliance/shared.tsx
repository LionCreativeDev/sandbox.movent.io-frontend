import React from "react";
export { fmtDate } from "@/lib/date";

// Own copy for the User (non-admin) portal — a parallel agent may be building
// the equivalent frontend/components/admin/compliance/shared.tsx for the
// Admin portal at the same time, and this codebase's convention is that a
// non-admin page never imports from components/admin/... . Content mirrors
// that file deliberately (same Badge, same status→color maps) rather than
// sharing an import, so the two portals stay independently buildable.

export const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "24px 28px",
    marginBottom: 20,
};

export const inp: React.CSSProperties = {
    padding: "9px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
};

export const lbl: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    display: "block",
    marginBottom: 5,
};

export const sectionTitle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 12px",
};

// Compliance Case statuses — not_started, pending, under_review, compliant,
// on_hold, rejected.
export const CASE_STATUS_SC: Record<string, { bg: string; color: string }> = {
    not_started: { bg: "#f1f5f9", color: "#64748b" },
    pending: { bg: "#fffbeb", color: "#b45309" },
    under_review: { bg: "#eff6ff", color: "#2563eb" },
    compliant: { bg: "#ecfdf5", color: "#059669" },
    on_hold: { bg: "#fff7ed", color: "#ea580c" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
};

// The PROJECT's own status (planning/active/on_hold/completed/cancelled) —
// independent of the ComplianceCase status above (a project can be
// Completed while its compliance review is still Pending, and vice versa).
// Same colors as components/admin/projects/shared.tsx's STATUS_SC.
export const PROJECT_STATUS_SC: Record<string, { bg: string; color: string }> = {
    planning: { bg: "#eff6ff", color: "#2563eb" },
    active: { bg: "#ecfdf5", color: "#059669" },
    on_hold: { bg: "#fffbeb", color: "#d97706" },
    completed: { bg: "#f0fdf4", color: "#16a34a" },
    cancelled: { bg: "#fef2f2", color: "#dc2626" },
};

// Project priority — see App\Models\Project's 'priority' enum. Same colors
// as components/admin/projects/shared.tsx's PRIORITY_SC.
export const PRIORITY_SC: Record<string, { bg: string; color: string }> = {
    low: { bg: "#eff6ff", color: "#2563eb" },
    medium: { bg: "#fff7ed", color: "#d97706" },
    high: { bg: "#fef2f2", color: "#dc2626" },
    urgent: { bg: "#7f1d1d", color: "#fca5a5" },
};

// Compliance Document statuses — pending_review, approved, rejected,
// resubmission_requested, expired.
export const DOCUMENT_STATUS_SC: Record<string, { bg: string; color: string }> = {
    pending_review: { bg: "#fffbeb", color: "#b45309" },
    approved: { bg: "#ecfdf5", color: "#059669" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
    resubmission_requested: { bg: "#eff6ff", color: "#2563eb" },
    expired: { bg: "#f1f5f9", color: "#64748b" },
};

// Compliance Requirement statuses — a superset of the document ones (adds
// pending/submitted/waived), so requirement rows get sensible colors too.
export const REQUIREMENT_STATUS_SC: Record<
    string,
    { bg: string; color: string }
> = {
    pending: { bg: "#f1f5f9", color: "#64748b" },
    submitted: { bg: "#fffbeb", color: "#b45309" },
    under_review: { bg: "#eff6ff", color: "#2563eb" },
    approved: { bg: "#ecfdf5", color: "#059669" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
    resubmission_requested: { bg: "#eff6ff", color: "#2563eb" },
    expired: { bg: "#f1f5f9", color: "#64748b" },
    waived: { bg: "#f5f3ff", color: "#7c3aed" },
};

// Task statuses — see App\Models\Task::ALL_STATUSES. Local copy, same
// rationale as the other maps above (this portal never imports from
// components/admin/...).
export const TASK_SC: Record<string, { bg: string; color: string }> = {
    todo: { bg: "#f1f5f9", color: "#64748b" },
    in_progress: { bg: "#eff6ff", color: "#2563eb" },
    blocked: { bg: "#fef2f2", color: "#dc2626" },
    ready_for_production: { bg: "#fffbeb", color: "#b45309" },
    in_production: { bg: "#eff6ff", color: "#2563eb" },
    review: { bg: "#f5f3ff", color: "#7c3aed" },
    completed: { bg: "#ecfdf5", color: "#059669" },
    cancelled: { bg: "#f1f5f9", color: "#64748b" },
};

// Deliverable statuses — see App\Models\Deliverable.
export const DELIVERABLE_SC: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f1f5f9", color: "#64748b" },
    submitted: { bg: "#fffbeb", color: "#b45309" },
    delivered: { bg: "#eff6ff", color: "#2563eb" },
    approved: { bg: "#ecfdf5", color: "#059669" },
    revision_requested: { bg: "#fff7ed", color: "#ea580c" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
};

// Invoice statuses — see invoices.status enum.
export const INVOICE_SC: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f1f5f9", color: "#64748b" },
    sent: { bg: "#eff6ff", color: "#2563eb" },
    partially_paid: { bg: "#fffbeb", color: "#b45309" },
    paid: { bg: "#ecfdf5", color: "#059669" },
    overdue: { bg: "#fef2f2", color: "#dc2626" },
    cancelled: { bg: "#f1f5f9", color: "#64748b" },
};

// Lead statuses — see leads.status enum.
export const LEAD_SC: Record<string, { bg: string; color: string }> = {
    new: { bg: "#f1f5f9", color: "#64748b" },
    contacted: { bg: "#eff6ff", color: "#2563eb" },
    qualified: { bg: "#f5f3ff", color: "#7c3aed" },
    proposal: { bg: "#fffbeb", color: "#b45309" },
    negotiation: { bg: "#fff7ed", color: "#ea580c" },
    won: { bg: "#ecfdf5", color: "#059669" },
    lost: { bg: "#fef2f2", color: "#dc2626" },
};

// Timesheet statuses — see App\Models\Timesheet.
export const TIMESHEET_SC: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#fffbeb", color: "#b45309" },
    approved: { bg: "#ecfdf5", color: "#059669" },
    rejected: { bg: "#fef2f2", color: "#dc2626" },
};

// Follow-up statuses — see App\Models\FollowUp.
export const FOLLOWUP_SC: Record<string, { bg: string; color: string }> = {
    pending: { bg: "#fffbeb", color: "#b45309" },
    completed: { bg: "#ecfdf5", color: "#059669" },
    missed: { bg: "#fef2f2", color: "#dc2626" },
    cancelled: { bg: "#f1f5f9", color: "#64748b" },
};

// Human labels for payments.method — the API sends the raw enum slug.
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    card: "Card",
    cheque: "Cheque",
    gateway: "Online Gateway",
};

// The "via …" text for one payment row: the method, plus the gateway account
// name whenever the charge actually went through a gateway.
export function paymentMethodText(p: {
    method: string | null;
    gateway_name?: string | null;
}): string {
    const method = p.method
        ? (PAYMENT_METHOD_LABEL[p.method] ?? p.method)
        : "—";
    return p.gateway_name ? `${method} (${p.gateway_name})` : method;
}

export function Badge({
    label,
    sc,
}: {
    label: string;
    sc?: { bg: string; color: string };
}) {
    const s = sc ?? { bg: "#f1f5f9", color: "#64748b" };
    const text = label.replace(/_/g, " ");
    return (
        <span
            style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: s.bg,
                color: s.color,
                fontWeight: 500,
                textTransform: "capitalize",
                whiteSpace: "nowrap",
            }}
        >
            {text}
        </span>
    );
}

export function StatCard({
    label,
    value,
    sub,
    color,
}: {
    label: string;
    value: string;
    sub?: string;
    color: string;
}) {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "18px 20px",
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                }}
            >
                {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 5 }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

// Circular icon badge + label/value — the "Project Compliance Listing"
// screenshot's stat-card style. A separate component from StatCard() above
// (which many other compliance pages already use) so this doesn't change
// their look.
export function IconStatCard({
    icon,
    label,
    value,
    bg,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    bg: string;
    color: string;
}) {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
            }}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: bg,
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                }}
            >
                {icon}
            </div>
            <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>{value}</div>
            </div>
        </div>
    );
}

export function fmtFileSize(bytes?: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function errorMessage(err: unknown, fallback: string): string {
    const ex = err as { response?: { data?: { message?: string } } };
    return ex.response?.data?.message ?? fallback;
}

// errorMessage() above can't see the real backend message on a
// responseType:'blob' request (e.g. ZIP/file downloads) — axios hands back
// the error body as an unparsed Blob instead of JSON, so
// response.data.message is always undefined and callers silently fall back
// to a generic message. This reads that Blob (when it's actually JSON) to
// recover the real message before falling back.
export async function blobErrorMessage(err: unknown, fallback: string): Promise<string> {
    const ex = err as { response?: { data?: unknown } };
    const data = ex.response?.data;
    if (data instanceof Blob && data.type.includes("json")) {
        try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message) return parsed.message;
        } catch { /* fall through to errorMessage()/fallback below */ }
    }
    return errorMessage(err, fallback);
}

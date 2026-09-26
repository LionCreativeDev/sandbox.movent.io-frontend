"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HiSquares2X2,
  HiUserGroup,
  HiUsers,
  HiBanknotes,
  HiFolderOpen,
  HiCheckCircle,
  HiBriefcase,
  HiClock,
  HiDocumentText,
  HiShieldCheck,
  HiChatBubbleLeftRight,
  HiCog6Tooth,
  HiArrowRightOnRectangle,
  HiChartBar,
  HiCurrencyDollar,
  HiCalendarDays,
  HiFlag,
  HiBuildingStorefront,
  HiBuildingOffice2,
  HiSparkles,
} from "react-icons/hi2";
import { useAuth } from "@/hooks/useAuth";
import {
  getAuthType,
  getAuthUser,
  getActiveCompany,
  can,
  getCompanyModules,
  FINANCE_MODULE_KEY,
} from "@/lib/auth";
import { Admin, User } from "@/types";
import { notificationService } from "@/lib/services/notificationService";
import { adminNotificationService } from "@/lib/services/adminNotificationService";

// Nav groups for company admin (all under /admin/)
const ADMIN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", icon: HiSquares2X2, label: "Dashboard" },
    ],
  },
  {
    label: "Sales Module",
    items: [
      {
        href: "/admin/sales",
        icon: HiChartBar,
        label: "Sales Dashboard",
        module: "leads",
      },
      {
        href: "/admin/pipeline",
        icon: HiSquares2X2,
        label: "Pipeline",
        module: "leads",
      },
      {
        href: "/admin/leads",
        icon: HiUserGroup,
        label: "Leads",
        module: "leads",
      },
      {
        href: "/admin/follow-ups",
        icon: HiCalendarDays,
        label: "Follow-ups",
        module: "leads",
      },
      {
        href: "/admin/sales/reports",
        icon: HiChartBar,
        label: "Sales Reports",
        module: "leads",
      },
      {
        href: "/admin/sales/targets",
        icon: HiFlag,
        label: "Target",
        module: "leads",
      },
      // A "Basic Clients" admin nav item pointing at /admin/clients used to
      // live here, but every AdminClientController route requires the real
      // Client module (routes/api.php's `module:client_portal` gate) — it
      // would 403 for a Sales-only company, so removed rather than left dead.
      // Company Admin sub-users still get the equivalent, permission-gated
      // "Basic Clients" access via the User-guard routes (ungated by module —
      // see routes/api.php's client management comment).
    ],
  },
  {
    label: "Client Module",
    items: [
      {
        href: "/admin/clients",
        icon: HiUsers,
        label: "Clients",
        module: "client_portal",
      },
      {
        href: "/admin/support",
        icon: HiChatBubbleLeftRight,
        label: "Support Tickets",
        module: "client_portal",
      },
      // The IT services offered in the Client Portal's "Grow Your Business
      // With Us" section, and what clients have asked for. Rides the same
      // client_portal purchase gate as the rest of this group — the section
      // has nowhere to appear without the portal.
      {
        href: "/admin/services",
        icon: HiSparkles,
        label: "Services",
        module: "client_portal",
      },
    ],
  },
  {
    label: "Invoice",
    items: [
      {
        href: "/admin/invoices",
        icon: HiBanknotes,
        label: "Invoices",
        module: "invoices",
      },
      {
        href: "/admin/payments",
        icon: HiCurrencyDollar,
        label: "Payments",
        module: "invoices",
      },
      // Trading names this company bills under — part of the Invoice module,
      // so it rides the same purchase gate as Invoices above.
      {
        href: "/admin/brands",
        icon: HiBuildingStorefront,
        label: "Brands",
        module: "invoices",
      },
    ],
  },
  {
    // Finance Area. The whole group requires the Finance module itself
    // (`entitlement`) — the backend closes every /finance/* route behind
    // module:finance_dashboard, so an Invoice-only company has nothing here
    // to open. Each item then ALSO rides the granular company_modules key its
    // own backend section is gated on (see routes/api.php's $financeRoutes).
    // Company Admin needs no permission of its own — the admin guard is the
    // gate — so unlike the staff group below these carry no permAny.
    label: "Finance",
    items: [
      {
        href: "/admin/finance",
        icon: HiBanknotes,
        label: "Finance Overview",
        module: "finance_dashboard",
        entitlement: FINANCE_MODULE_KEY,
      },
      {
        href: "/admin/finance/invoices",
        icon: HiDocumentText,
        label: "Finance Invoices",
        module: "invoices",
        entitlement: FINANCE_MODULE_KEY,
      },
      {
        href: "/admin/finance/payments",
        icon: HiCurrencyDollar,
        label: "Finance Payments",
        module: "payments",
        entitlement: FINANCE_MODULE_KEY,
      },
      {
        href: "/admin/finance/payment-details",
        icon: HiCurrencyDollar,
        label: "Payment Details",
        module: "payment_details",
        entitlement: FINANCE_MODULE_KEY,
      },
      {
        href: "/admin/finance/invoice-reminders",
        icon: HiCalendarDays,
        label: "Invoice Reminders",
        module: "invoice_reminders",
        entitlement: FINANCE_MODULE_KEY,
      },
      {
        href: "/admin/finance/reports",
        icon: HiChartBar,
        label: "Finance Reports",
        moduleAny: ["finance_reports", "revenue_reports", "payments_report"],
        entitlement: FINANCE_MODULE_KEY,
      },
    ],
  },
  {
    label: "Project Module",
    items: [
      {
        href: "/admin/projects/dashboard",
        icon: HiSquares2X2,
        label: "Project Dashboard",
        module: "projects",
      },
      {
        href: "/admin/projects",
        icon: HiFolderOpen,
        label: "Projects",
        module: "projects",
        badgeKey: "projects",
      },
      {
        href: "/admin/tasks",
        icon: HiCheckCircle,
        label: "Tasks",
        module: "tasks",
        badgeKey: "tasks",
      },
      {
        href: "/admin/timesheets",
        icon: HiClock,
        label: "Timesheets",
        module: "timesheets",
      },
      {
        href: "/admin/projects/team",
        icon: HiUserGroup,
        label: "Team / Resources",
        module: "projects",
      },
      {
        href: "/admin/projects/reports",
        icon: HiChartBar,
        label: "Project Reports",
        module: "projects",
      },
    ],
  },
  {
    label: "HR",
    items: [
      // Each item is gated on its own real granular company_modules key —
      // 'hr' itself is never a real module_key (only employees/attendance/
      // leaves/payroll/recruitment are), so gating everything on 'hr' meant
      // this whole section could never appear for any company. HR Dashboard/
      // Documents/Reports ride on 'employees' (the base HR sub-module), same
      // pattern Project Reports rides on 'projects'.
      {
        href: "/admin/hr",
        icon: HiSquares2X2,
        label: "HR Dashboard",
        module: "employees",
      },
      {
        href: "/admin/employees",
        icon: HiBriefcase,
        label: "Employees",
        module: "employees",
      },
      {
        href: "/admin/departments",
        icon: HiBuildingOffice2,
        label: "Departments",
        module: "employees",
      },
      {
        href: "/admin/shifts",
        icon: HiClock,
        label: "Shifts",
        module: "employees",
      },
      {
        href: "/admin/recruitment",
        icon: HiUsers,
        label: "Recruitment",
        module: "recruitment",
      },
      {
        href: "/admin/attendance",
        icon: HiCalendarDays,
        label: "Attendance",
        module: "attendance",
      },
      {
        href: "/admin/attendance/monthly-report",
        icon: HiChartBar,
        label: "Monthly Report",
        module: "attendance",
      },
      {
        href: "/admin/leaves",
        icon: HiCalendarDays,
        label: "Leave",
        module: "leaves",
      },
      {
        href: "/admin/payroll",
        icon: HiBanknotes,
        label: "Payroll",
        module: "payroll",
      },
      {
        href: "/admin/hr/documents",
        icon: HiDocumentText,
        label: "HR Documents",
        module: "employees",
      },
      {
        href: "/admin/hr/reports",
        icon: HiChartBar,
        label: "HR Reports",
        module: "employees",
      },
    ],
  },
  {
    label: "Files",
    items: [
      {
        href: "/admin/documents",
        icon: HiDocumentText,
        label: "Documents",
        module: "documents",
      },
      {
        href: "/admin/compliance",
        icon: HiShieldCheck,
        label: "Compliance",
        module: "compliance",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        href: "/admin/reports",
        icon: HiChartBar,
        label: "Reports",
        moduleAny: ["invoices", "reports", "finance"],
      },
    ],
  },
  {
    label: "Communication",
    items: [
      // Company-wide oversight of General Chat — always available to Company
      // Admin (not gated by a purchasable module or permission, same as
      // Settings/Users below).
      { href: "/admin/chat", icon: HiChatBubbleLeftRight, label: "Chat" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", icon: HiCog6Tooth, label: "Settings" },
      { href: "/admin/users", icon: HiUserGroup, label: "Users" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/plan", icon: HiSquares2X2, label: "My Plan" },
      { href: "/admin/companies", icon: HiBriefcase, label: "Companies" },
    ],
  },
];

// Nav groups for sub users (root-level URLs)
const USER_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", icon: HiSquares2X2, label: "Dashboard" }],
  },
  {
    label: "Sales Module",
    items: [
      {
        href: "/sales",
        icon: HiChartBar,
        label: "Sales Dashboard",
        module: "leads",
        permAny: ["canViewSalesDashboard", "canViewLeads"],
      },
      {
        href: "/leads/pipeline",
        icon: HiSquares2X2,
        label: "Pipeline",
        module: "leads",
        permAny: ["canViewLeads", "canManagePipeline"],
      },
      {
        href: "/leads",
        icon: HiUserGroup,
        label: "Leads",
        module: "leads",
        permAny: ["canViewLeads"],
      },
      {
        href: "/leads/follow-ups",
        icon: HiCalendarDays,
        label: "Follow-ups",
        module: "leads",
        permAny: ["canViewLeads"],
      },
      // Visible only when Sales is purchased but full Client module is NOT
      {
        href: "/clients",
        icon: HiUsers,
        label: "Clients",
        module: "leads",
        hideIfModule: "clients",
        permAny: ["canViewClients"],
      },
      // "Sales Invoices" used to be a second nav item here pointing at the
      // exact same '/invoices' route as the Invoice group's "Invoices" below
      // — same href, same module gate, same permission — so anyone with both
      // (a Seller, most commonly) saw two identical tabs. Removed; "Invoices"
      // in the Invoice group already covers it.
      {
        href: "/sales/targets",
        icon: HiCurrencyDollar,
        label: "Targets",
        module: "leads",
        permAny: ["canViewSalesTargets"],
      },
      {
        href: "/sales/reports",
        icon: HiChartBar,
        label: "Sales Reports",
        module: "leads",
        permAny: ["canViewSalesReports"],
      },
    ],
  },
  {
    label: "Client Module",
    items: [
      {
        href: "/clients",
        icon: HiUsers,
        label: "Clients",
        module: "clients",
        permAny: ["canViewClients"],
      },
      {
        href: "/support",
        icon: HiChatBubbleLeftRight,
        label: "Support Tickets",
        module: "clients",
        permAny: ["canViewClientSupport", "canManageClientSupport"],
      },
    ],
  },
  {
    label: "Invoice",
    items: [
      {
        href: "/invoices",
        icon: HiBanknotes,
        label: "Invoices",
        module: "invoices",
        permAny: ["canViewInvoices"],
      },
      // Gated on its own Invoice-module permission, not canViewInvoices —
      // maintaining the brand list and raising invoices are separate jobs and
      // Company Admin grants them separately.
      {
        href: "/brands",
        icon: HiBuildingStorefront,
        label: "Brands",
        module: "invoices",
        permAny: ["canViewBrands"],
      },
    ],
  },
  {
    // Finance Area — staff side. Every item is gated on the Finance
    // permission that its own backend endpoint checks, so a user granted
    // only "View Payments" sees exactly one Finance link. The links are a
    // courtesy: each endpoint re-checks the same permission, and
    // FinanceShell re-reads capabilities from the server on load, so a link
    // that outlives a revoke (permAny reads the session cookie) lands on a
    // "no access" panel rather than data.
    //
    // Two gates, in this order — module first, permission second:
    //
    //  • `entitlement` — the active company must hold the Finance module
    //    (user.company.modules from /user/me). A Finance permission left over
    //    on a user never unlocks Finance for a company that has not bought
    //    it, or whose Finance the Super Admin switched off.
    //  • `module: 'finance'` + permAny — enabledModules is derived from which
    //    permission BUCKETS a user holds (see CATALOG_TO_SIDEBAR below), so
    //    it contains 'finance' only when they hold at least one finance-bucket
    //    key. That matters because canViewPayments/canRecordPayments exist in
    //    the Invoice module too — without it, every Seller in a Finance
    //    company would see a lone "Finance Payments" link.
    label: "Finance",
    items: [
      {
        href: "/finance",
        icon: HiBanknotes,
        label: "Finance Dashboard",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: ["canViewFinanceDashboard", "canViewRevenueDashboard"],
      },
      {
        href: "/finance/invoices",
        icon: HiDocumentText,
        label: "Finance Invoices",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: ["canViewFinanceInvoices"],
      },
      {
        href: "/finance/payments",
        icon: HiCurrencyDollar,
        label: "Finance Payments",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: ["canViewPayments"],
      },
      {
        href: "/finance/payment-details",
        icon: HiCurrencyDollar,
        label: "Payment Details",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: ["canViewPaymentDetails"],
      },
      {
        href: "/finance/invoice-reminders",
        icon: HiCalendarDays,
        label: "Invoice Reminders",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: [
          "canCreateInvoiceReminders",
          "canSendInvoiceReminders",
          "canTrackInvoiceReminders",
        ],
      },
      {
        href: "/finance/reports",
        icon: HiChartBar,
        label: "Finance Reports",
        module: "finance",
        entitlement: FINANCE_MODULE_KEY,
        permAny: [
          "canViewFinanceReports",
          "canViewRevenueReports",
          "canViewPaymentReports",
        ],
      },
    ],
  },
  {
    // Item visibility here is computed per-permission-key (not the coarse
    // module tag used elsewhere) — see the `permAny` handling in
    // `visibleGroups` below, so a Production User and a PM/Admin see
    // different subsets purely from which permission keys they were granted.
    label: "Project Module",
    items: [
      {
        href: "/projects/dashboard",
        icon: HiSquares2X2,
        label: "Project Dashboard",
        permAny: ["canViewProjectDashboard"],
      },
      {
        href: "/projects",
        icon: HiFolderOpen,
        label: "Projects",
        permAny: ["canViewProjects", "canViewLinkedProjects"],
        badgeKey: "projects",
      },
      {
        href: "/tasks",
        icon: HiCheckCircle,
        label: "Tasks",
        permAny: ["canViewTasks"],
        fallbackLabel: "My Tasks",
        badgeKey: "tasks",
      },
      {
        href: "/timesheets",
        icon: HiClock,
        label: "Timesheets",
        permAny: ["canViewTimesheets"],
      },
      {
        href: "/projects/team",
        icon: HiUserGroup,
        label: "Team / Resources",
        permAny: [
          "canViewTeamResources",
          "canAssignTeamResources",
          "canAddUsers",
        ],
      },
      {
        href: "/projects/reports",
        icon: HiChartBar,
        label: "Project Reports",
        permAny: ["canViewProjectReports", "canViewTaskReports"],
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        href: "/compliance",
        icon: HiShieldCheck,
        label: "Compliance",
        module: "compliance",
        permAny: ["canViewCompliance"],
      },
    ],
  },
  {
    // module: 'hr' matches CATALOG_TO_SIDEBAR's hr → ['hr'] mapping below
    // (any granted permission under the 'hr' catalog module turns this on).
    // Each item then narrows further by its own real permission key, same
    // pattern as Project Module above — a staff member with only
    // canViewEmployees sees Employees but not Payroll, etc.
    label: "HR",
    items: [
      {
        href: "/hr",
        icon: HiSquares2X2,
        label: "HR Dashboard",
        module: "hr",
        permAny: ["canViewHRDashboard"],
      },
      {
        href: "/employees",
        icon: HiBriefcase,
        label: "Employees",
        module: "hr",
        permAny: ["canViewEmployees"],
      },
      {
        href: "/departments",
        icon: HiBuildingOffice2,
        label: "Departments",
        module: "hr",
        permAny: ["canManageDepartments"],
      },
      {
        href: "/shifts",
        icon: HiClock,
        label: "Shifts",
        module: "hr",
        permAny: ["canManageShifts"],
      },
      {
        href: "/recruitment",
        icon: HiUsers,
        label: "Recruitment",
        module: "hr",
        permAny: ["canViewRecruitment"],
      },
      {
        href: "/attendance",
        icon: HiCalendarDays,
        label: "Attendance",
        module: "hr",
        permAny: ["canViewAttendance"],
      },
      {
        href: "/attendance/monthly-report",
        icon: HiChartBar,
        label: "Monthly Report",
        module: "hr",
        permAny: ["canViewAttendance"],
      },
      {
        href: "/leaves",
        icon: HiCalendarDays,
        label: "Leave",
        module: "hr",
        permAny: ["canViewLeave"],
      },
      {
        href: "/payroll",
        icon: HiBanknotes,
        label: "Payroll",
        module: "hr",
        permAny: ["canViewPayroll"],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        href: "/reports",
        icon: HiChartBar,
        label: "Reports",
        moduleAny: ["invoices", "reports", "finance"],
      },
    ],
  },
  {
    // Standalone General Chat — separate from Project/Sales Chat, gated on
    // the 'account' module's canUseGeneralChat (same pattern as canAddUsers
    // below), never on a purchased module.
    label: "Communication",
    items: [
      {
        href: "/chat",
        icon: HiChatBubbleLeftRight,
        label: "Chat",
        permAny: ["canUseGeneralChat"],
      },
    ],
  },
  {
    // Company-wide, not project-scoped — separate from "Team / Resources"
    // (which is per-project). Gated on the common 'account' module's
    // canAddUsers permission, same as the "User Management Permission"
    // checkbox on the Company Admin's Add/Edit User screen. Labeled "Users"
    // to match the Company Admin sidebar's own '/admin/users' nav item.
    label: "Users",
    items: [
      {
        href: "/user-management",
        icon: HiUserGroup,
        label: "Users",
        permAny: ["canAddUsers"],
      },
    ],
  },
  {
    // Per-company Settings for a staff member the Company Admin granted the
    // Settings Management Permission. Gated on the common 'account' module's
    // canManageSettings, same pattern as canAddUsers above, and never on a
    // purchased module. Points at '/settings', which serves the Company
    // Admin's own Settings screen in staff mode (it talks to
    // /api/user/settings/* instead of /api/admin/settings/*) so both sides
    // stay one page.
    //
    // permAny reads the session cookie, so this link can outlive a revoke
    // until the next /user/me refresh — the endpoints behind it already
    // answer 403, and the page itself re-checks on load.
    label: "System",
    items: [
      {
        href: "/settings",
        icon: HiCog6Tooth,
        label: "Settings",
        permAny: ["canManageSettings"],
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logoutUser } = useAuth();
  const [authType, setAuthType] = useState<"user" | "admin" | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  // null = not yet loaded (show everything, same convention as enabledModules)
  // — populated inside refreshModules() (post-mount only) so permAny-gated
  // nav items never read cookies during the initial render, which previously
  // caused a server/client hydration mismatch (the server has no cookies and
  // always saw "no permissions", while the client's first render already had
  // them, producing mismatched nav items).
  // Holds every permission key granted across ALL modules (not just Project
  // Management) so permAny gating works uniformly for Sales/Client/Invoice
  // nav items too, on top of their coarser `module` purchase gate.
  const [projectMgmtPerms, setProjectMgmtPerms] = useState<string[] | null>(
    null,
  );
  // Distinct from projectMgmtPerms above (which merges every module's keys
  // together for permAny matching) — this tracks the project_management
  // module specifically, since the "My Tasks" fallback below must mirror
  // frontend/app/tasks/page.tsx's own guard (getUserModulePermissions
  // ('project_management').length === 0 → redirect to /dashboard). A
  // single-module staff role like Compliance/HR/Finance User has permissions
  // under its own module only, so the old "any permission in any module"
  // check wrongly showed "My Tasks" and then bounced them straight back out.
  const [projectMgmtOwnPerms, setProjectMgmtOwnPerms] = useState<
    string[] | null
  >(null);
  const [navBadges, setNavBadges] = useState<{
    tasks: number;
    projects: number;
  }>({ tasks: 0, projects: 0 });
  // Drives the `hideForSeller` nav flag below. No item carries it today —
  // Tasks did until 2026-09-04, when Sellers became assignable and got their
  // own-assigned-tasks view — but the mechanism stays for the next
  // Seller-hidden link.
  const [isSeller, setIsSeller] = useState(false);
  // What the active company has actually bought (getCompanyModules()) — read
  // by the `entitlement` nav flag. Unlike enabledModules this has NO "not
  // loaded yet, show everything" state: an entitlement-gated item stays
  // hidden until the company is known to hold the module.
  const [companyModules, setCompanyModules] = useState<string[]>([]);

  const refreshModules = () => {
    const type = getAuthType() as "user" | "admin" | null;
    setAuthType(type);
    const entitled = getCompanyModules();
    setCompanyModules(entitled);
    const financeEntitled = entitled.includes(FINANCE_MODULE_KEY);
    if (type === "admin") {
      setProjectMgmtPerms(["*"]);
      setProjectMgmtOwnPerms(["*"]);
      setIsSeller(false);
    } else {
      const user = getAuthUser() as User | null;
      setIsSeller(user?.role_type === "seller");
      const allAssignments = user?.company_assignments ?? [];
      const activeId = getActiveCompany();
      const assignments = activeId
        ? allAssignments.filter((a) => a.company_id === activeId)
        : allAssignments;
      const keys = new Set<string>();
      const ownKeys = new Set<string>();
      for (const a of assignments) {
        for (const [moduleKey, permKeys] of Object.entries(
          a.permissions ?? {},
        )) {
          (permKeys as string[]).forEach((k) => {
            keys.add(k);
            if (moduleKey === "project_management") ownKeys.add(k);
          });
        }
      }
      setProjectMgmtPerms([...keys]);
      setProjectMgmtOwnPerms([...ownKeys]);
    }
    if (type === "admin") {
      const admin = getAuthUser() as Admin | null;
      setEnabledModules(admin?.modules ?? null);
    } else if (type === "user") {
      const user = getAuthUser() as User | null;
      const allAssignments = user?.company_assignments ?? [];
      // Rule 8: use only the active company's permissions for sidebar
      const activeId = getActiveCompany();
      const assignments = activeId
        ? allAssignments.filter((a) => a.company_id === activeId)
        : allAssignments;
      if (assignments.length > 0) {
        // Map catalog module keys → sidebar module keys
        const CATALOG_TO_SIDEBAR: Record<string, string[]> = {
          client: ["clients"],
          sales: ["leads"],
          invoice: ["invoices"],
          hr: ["hr"],
          project_management: ["projects", "tasks", "timesheets"],
          compliance: ["compliance"],
          // 'finance' is listed as itself as well as 'reports' so the
          // Finance Area nav group can gate on it — see the note on that
          // group above for why a permission-key check alone is not enough
          // there (canViewPayments lives in two modules).
          finance: ["reports", "finance"],
        };
        const sidebarModules = new Set<string>();
        for (const a of assignments) {
          for (const [catalogKey, permKeys] of Object.entries(a.permissions)) {
            // Finance permissions count for nothing in a company without the
            // Finance module — module entitlement comes before permission.
            if (catalogKey === "finance" && !financeEntitled) continue;
            if ((permKeys as string[]).length > 0) {
              (CATALOG_TO_SIDEBAR[catalogKey] ?? [catalogKey]).forEach((k) =>
                sidebarModules.add(k),
              );
            }
          }
        }
        // Reports: only if admin granted canViewInvoiceReports (or finance reports) permission
        if (
          can("invoice", "canViewInvoiceReports") ||
          (financeEntitled && can("finance", "canViewFinanceReports"))
        ) {
          sidebarModules.add("reports");
        }
        // If no permissions resolved, fall back to null (show all) so the user
        // isn't locked out while permissions are still being configured.
        setEnabledModules(sidebarModules.size > 0 ? [...sidebarModules] : null);
      } else {
        // Fallback to old-style permissions
        const modules =
          user?.permissions
            ?.filter((p) => p.can_view)
            .map((p) => p.module_key) ?? null;
        setEnabledModules(modules);
      }
    } else {
      setEnabledModules(null);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshModules();
    window.addEventListener("auth_refreshed", refreshModules);
    return () => window.removeEventListener("auth_refreshed", refreshModules);
  }, []);

  // Red dots on Tasks/Projects — mirrors Navbar's own 30s notification poll,
  // kept independent since the badge counts (per-category, uncapped) come
  // from a different endpoint than the bell's top-30 feed.
  useEffect(() => {
    const type = getAuthType() as "user" | "admin" | null;
    if (!type) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNavBadges({ tasks: 0, projects: 0 });
      return;
    }

    const loadBadges = () => {
      const svc =
        type === "admin" ? adminNotificationService : notificationService;
      svc
        .unreadCounts()
        .then((counts) => setNavBadges(counts))
        .catch(() => {});
    };

    loadBadges();
    const interval = setInterval(loadBadges, 30000);
    // Dispatched by the Tasks/Projects pages right after they mark their
    // category read, so the dot disappears immediately instead of waiting
    // up to 30s for the next poll.
    window.addEventListener("nav_badges_refresh", loadBadges);
    return () => {
      clearInterval(interval);
      window.removeEventListener("nav_badges_refresh", loadBadges);
    };
  }, [authType]);

  const isModuleEnabled = (moduleKey?: string) => {
    if (!moduleKey) return true;
    if (enabledModules === null) return true; // still loading — show everything
    return enabledModules.includes(moduleKey);
  };

  const NAV_GROUPS = authType === "admin" ? ADMIN_NAV_GROUPS : USER_NAV_GROUPS;

  // projectMgmtPerms === null means "not yet loaded" — show everything, same
  // convention as enabledModules, to avoid a hydration mismatch.
  const hasPermAny = (keys: string[]) =>
    projectMgmtPerms === null ||
    projectMgmtPerms.includes("*") ||
    keys.some((k) => projectMgmtPerms.includes(k));
  const hasAnyProjectManagementPerm =
    projectMgmtOwnPerms === null || projectMgmtOwnPerms.length > 0;

  type NavItem = {
    href: string;
    icon: typeof HiSquares2X2;
    label: string;
    module?: string;
    moduleAny?: string[];
    // Parent-module gate: the active company must hold this company_modules
    // key, checked before and independently of module/permAny (see
    // companyModules above).
    entitlement?: string;
    hideIfModule?: string;
    permAny?: string[];
    fallbackLabel?: string;
    badgeKey?: "tasks" | "projects";
    hideForSeller?: boolean;
  };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: (group.items as NavItem[]).reduce((acc: NavItem[], item) => {
      if (item.entitlement && !companyModules.includes(item.entitlement))
        return acc;
      if (item.module && !isModuleEnabled(item.module)) return acc;
      if (item.moduleAny && !item.moduleAny.some((m) => isModuleEnabled(m)))
        return acc;
      if (item.hideIfModule && isModuleEnabled(item.hideIfModule)) return acc;
      if (item.hideForSeller && isSeller) return acc;
      if (item.permAny) {
        if (hasPermAny(item.permAny)) {
          acc.push(item);
        } else if (item.fallbackLabel && hasAnyProjectManagementPerm) {
          // A Seller reaches "My Tasks" through this fallback too (2026-09-04:
          // a PM can assign them a task, and they hold no canViewTasks) — the
          // page and every endpoint behind it hard-scope them to their own
          // assigned tasks, so there is nothing left to hide by dropping the
          // link. Was `&& !isSeller` while Tasks were retired for the role.
          acc.push({ ...item, label: item.fallbackLabel });
        }
        return acc;
      }
      acc.push(item);
      return acc;
    }, []),
  })).filter((group) => group.items.length > 0);

  // Exactly one nav item is ever "active" at a time. A naive per-item check
  // (pathname === href || pathname.startsWith(href + '/')) lets a parent
  // item (e.g. '/admin/projects') and a sibling whose own href happens to
  // start with it (e.g. '/admin/projects/dashboard') both match at once —
  // same issue recurs for HR Dashboard/Documents/Reports, Sales Dashboard/
  // Targets/Reports, and Leads/Pipeline/Follow-ups. Resolve it by picking a
  // single winner across every visible href: an exact match always wins
  // outright; otherwise the longest (most specific) href whose pathname is
  // one of its sub-paths wins.
  const allHrefs = visibleGroups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = allHrefs.includes(pathname)
    ? pathname
    : allHrefs
        .filter((href) => pathname.startsWith(href + "/"))
        .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="sidebar">
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, #2563eb, #60a5fa)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 16,
          }}
        >
          🏢
        </div>
        <div>
          <div
            style={{
              color: "#f1f5f9",
              fontWeight: 700,
              fontSize: "15px",
              letterSpacing: "-0.2px",
            }}
          >
            Movent
          </div>
          <div
            style={{ color: "#475569", fontSize: "10.5px", marginTop: "-1px" }}
          >
            Management System
          </div>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="sidebar-nav">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <span className="nav-section-label">{group.label}</span>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === activeHref;
              const badgeCount = item.badgeKey ? navBadges[item.badgeKey] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  style={{ position: "relative" }}
                >
                  <Icon size={17} className="nav-icon" />
                  {item.label}
                  {badgeCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 7,
                        left: 14,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#ef4444",
                        border: "2px solid #0f172a",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div
        style={{
          padding: "12px 12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => logoutUser(authType || "user")}
          className="nav-item"
          style={{
            background: "transparent",
            border: "none",
            width: "100%",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <HiArrowRightOnRectangle size={17} className="nav-icon" />
          Logout
        </button>
      </div>
    </div>
  );
}

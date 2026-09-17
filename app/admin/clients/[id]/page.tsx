"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/axios";
import toast from "react-hot-toast";
import { handleNotFound } from "@/lib/notFound";
import { adminSalesChatService } from "@/lib/services/salesChatService";
import {
  adminClientService,
  InvoiceReceipt,
} from "@/lib/services/adminClientService";
import { ChatMessage } from "@/lib/services/adminProjectService";
import { CompanyUser } from "@/lib/services/adminLeadService";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_MB,
  fmtFileSize,
} from "@/components/admin/projects/shared";
import PhoneInput from "@/components/ui/PhoneInput";
import { ALL_COUNTRIES } from "@/lib/countries";
import { chatSenderName } from "@/lib/chatSender";
import ReceiptViewer from "@/components/ui/ReceiptViewer";
import { receiptFields } from "@/lib/receiptFields";

interface ClientData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  country: string | null;
  notes: string | null;
  portal_access: boolean;
  status: string;
  created_at: string;
  user: { id: number; email: string; is_active: boolean } | null;
  company: { id: number; name: string } | null;
  // Who created this client, and who currently owns it — see
  // Api\Admin\ClientController::show()/transfer().
  creator?: { id: number; name: string; type: "user" | "admin" } | null;
  account_manager?: number | null;
  accountManager?: { id: number; name: string } | null;
}
interface ModulePerm {
  label: string;
  is_enabled: boolean;
  purchased: boolean;
}
interface Seat {
  limit: number | null;
  users_used: number;
  clients_total: number;
  can_add: boolean;
}

const MODULES = [
  {
    key: "projects",
    label: "Projects",
    desc: "View projects, tasks, progress",
  },
  {
    key: "invoices",
    label: "Invoices",
    desc: "View invoices and request payments",
  },
  {
    key: "payments",
    label: "Payment History",
    desc: "Read-only payment record",
  },
  { key: "documents", label: "Documents", desc: "Download shared files" },
  { key: "support", label: "Support Tickets", desc: "Raise and track issues" },
  { key: "reports", label: "Reports", desc: "Project and invoice reports" },
];

const STATUS_C: Record<string, { bg: string; color: string }> = {
  active: { bg: "#ecfdf5", color: "#059669" },
  inactive: { bg: "#f1f5f9", color: "#64748b" },
  blocked: { bg: "#fef2f2", color: "#dc2626" },
};

// Invoice status colours on a receipt card. Same palette as STATUS_C above,
// keyed on invoices.status rather than clients.status.
const RECEIPT_STATUS: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#ecfdf5", color: "#059669" },
  partially_paid: { bg: "#fffbeb", color: "#d97706" },
  overdue: { bg: "#fef2f2", color: "#dc2626" },
  sent: { bg: "#eff6ff", color: "#2563eb" },
};

function ReceiptFact({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: strong ? 14 : 12.5,
          fontWeight: strong ? 700 : 600,
          color: strong ? "#059669" : "#334155",
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};
const lbl: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 5,
};
const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  padding: "24px 28px",
  marginBottom: 20,
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [perms, setPerms] = useState<Record<string, ModulePerm>>({});
  const [seat, setSeat] = useState<Seat | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "info" | "portal" | "permissions" | "chat" | "receipts" | "messages"
  >("info");
  // Deep-link support (e.g. /admin/clients/21?tab=messages from the Project
  // Chat page's "Chat with Client" button). Read via window.location instead
  // of useSearchParams so this page doesn't need a Suspense boundary.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested &&
      [
        "info",
        "portal",
        "permissions",
        "chat",
        "receipts",
        "messages",
      ].includes(requested)
    ) {
      setTab(requested as typeof tab);
    }
  }, []);

  // Sales Chat
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [sendingChat, setSendingChat] = useState(false);

  // Invoice Receipts — the receipts generated for this client's confirmed
  // payments. Loaded only when the tab is opened (each card pulls an image),
  // and never polled: a receipt never changes once issued.
  const [receipts, setReceipts] = useState<InvoiceReceipt[] | null>(null);
  const [receiptImgs, setReceiptImgs] = useState<Record<number, string>>({});
  const [viewingReceipt, setViewingReceipt] = useState<{
    url: string;
    title: string;
    fileName?: string | null;
  } | null>(null);
  // `receipts === null` IS the loading state — no separate flag to set
  // synchronously inside the effect, which the compiler lint rejects.
  const receiptImgsRef = useRef<Record<number, string>>({});

  // Client Messages (restricted Direct Chat — see Client Communication Rules)
  const [dmThreads, setDmThreads] = useState<any[]>([]);
  const [dmActiveThread, setDmActiveThread] = useState<any>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmText, setDmText] = useState("");
  const [sendingDm, setSendingDm] = useState(false);

  // Edit form
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    address: "",
    country: "",
    notes: "",
    status: "active",
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  // Portal fields
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPwd, setPortalPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPortal, setSavingPortal] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [loginUrlCopied, setLoginUrlCopied] = useState(false);

  // Transfer Client modal — see Api\Admin\ClientController::transfer().
  const [transferModal, setTransferModal] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    setLoginUrl(`${window.location.origin}/client/login`);
  }, []);

  const copyLoginUrl = () => {
    navigator.clipboard.writeText(loginUrl).then(() => {
      setLoginUrlCopied(true);
      setTimeout(() => setLoginUrlCopied(false), 2000);
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/clients/${id}`);
      const { client: c, permissions, seat: s } = res.data.data;
      setClient(c);
      setSeat(s);
      setForm({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        company_name: c.company_name ?? "",
        address: c.address ?? "",
        country: c.country ?? "",
        notes: c.notes ?? "",
        status: c.status,
      });
      setPortalEmail(c.user?.email ?? c.email ?? "");
      setPerms(permissions as Record<string, ModulePerm>);
    } catch (err) {
      if (!handleNotFound(err, router)) toast.error("Failed to load client");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const loadChat = () => {
    adminSalesChatService
      .clientMessages(Number(id))
      .then(setChat)
      .catch(() => {});
  };

  useEffect(() => {
    loadChat();
    const interval = setInterval(loadChat, 8000);
    return () => clearInterval(interval);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() && !chatFile) return;
    if (chatFile) {
      const ext = chatFile.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_ATTACHMENT_TYPES.includes(ext)) {
        toast.error(`${chatFile.name}: file type not allowed`);
        return;
      }
      if (chatFile.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        toast.error(`${chatFile.name}: exceeds ${MAX_ATTACHMENT_MB}MB limit`);
        return;
      }
    }
    setSendingChat(true);
    try {
      await adminSalesChatService.sendClientMessage(
        Number(id),
        chatText.trim(),
        chatFile,
      );
      setChatText("");
      setChatFile(null);
      loadChat();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const downloadChatAttachment = async (m: ChatMessage) => {
    if (!m.attachment_name) return;
    try {
      await adminSalesChatService.downloadClientAttachment(
        Number(id),
        m.id,
        m.attachment_name,
      );
    } catch {
      toast.error("Download failed");
    }
  };

  // The list, once, when the tab is first opened. A ref rather than a
  // `receipts === null` guard in the dependency array: depending on `receipts`
  // here would make this effect's own setReceipts() re-run it, and the cleanup
  // that fires in between would cancel the image fetches started alongside —
  // which is exactly why the thumbnails never appeared.
  const receiptsLoadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (tab !== "receipts" || receiptsLoadedFor.current === String(id)) return;
    receiptsLoadedFor.current = String(id);

    let cancelled = false;

    adminClientService
      .invoiceReceipts(Number(id))
      .then((list) => {
        if (!cancelled) setReceipts(list);
      })
      // An empty list on failure: the tab says "no receipts yet" rather than
      // spinning forever, and the axios interceptor has already surfaced why.
      // The ref is released so reopening the tab retries.
      .catch(() => {
        if (cancelled) return;
        receiptsLoadedFor.current = null;
        setReceipts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [id, tab]);

  // One image fetch per receipt, once. The endpoint is authenticated — an
  // <img src> carries no bearer token — so each arrives as a blob and is held
  // as an object URL.
  //
  // Depends ONLY on `receipts`: setReceiptImgs() below does not change
  // `receipts`, so storing one image can never re-run this effect and cancel
  // the fetches still in flight for the others.
  useEffect(() => {
    if (!receipts) return;

    let cancelled = false;

    receipts
      .filter((r) => !(r.id in receiptImgsRef.current))
      .forEach((r) => {
        // Claimed up front so a re-render mid-flight cannot start a second
        // fetch for the same receipt.
        receiptImgsRef.current[r.id] = "";
        adminClientService
          .receiptImageUrl(r.image_endpoint)
          .then((url) => {
            // An image that lands after the page is gone still has its blob
            // revoked rather than left behind.
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            receiptImgsRef.current[r.id] = url;
            setReceiptImgs((prev) => ({ ...prev, [r.id]: url }));
          })
          .catch(() => {
            delete receiptImgsRef.current[r.id];
          });
      });

    return () => {
      cancelled = true;
    };
  }, [receipts]);

  // Revoked once, on unmount — from the ref rather than from state, because a
  // cleanup keyed on the state object would revoke URLs the cards are still
  // showing every time another image lands.
  useEffect(
    () => () => {
      Object.values(receiptImgsRef.current).forEach(URL.revokeObjectURL);
    },
    [],
  );

  // Client Messages — the client's own restricted Direct Chat.
  const loadDmThreads = () => {
    api
      .get(`/admin/clients/${id}/direct-chat`)
      .then((res) => {
        const data = res.data.data;
        setDmThreads(data);
        if (data.length > 0 && !dmActiveThread) selectDmThread(data[0]);
      })
      .catch(() => {});
  };

  const selectDmThread = (thread: any) => {
    setDmActiveThread(thread);
    api
      .get(`/admin/clients/${id}/direct-chat/${thread.id}/messages`)
      .then((res) => setDmMessages(res.data.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (tab !== "messages") return;
    loadDmThreads();
    const interval = setInterval(loadDmThreads, 8000);
    return () => clearInterval(interval);
  }, [id, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim() || !dmActiveThread) return;
    setSendingDm(true);
    try {
      await api.post(
        `/admin/clients/${id}/direct-chat/${dmActiveThread.id}/reply`,
        { content: dmText.trim() },
      );
      setDmText("");
      const res = await api.get(
        `/admin/clients/${id}/direct-chat/${dmActiveThread.id}/messages`,
      );
      setDmMessages(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send message");
    } finally {
      setSendingDm(false);
    }
  };

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ── Save info ──────────────────────────────────────────────────────────────
  const saveInfo = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await api.put(`/admin/clients/${id}`, form);
      toast.success("Client updated");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed");
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Save permissions ───────────────────────────────────────────────────────
  const savePerms = async () => {
    setSavingPerms(true);
    try {
      const mapped: Record<string, boolean> = {};
      Object.entries(perms).forEach(([k, v]) => {
        if (v.purchased) mapped[k] = v.is_enabled;
      });
      await api.put(`/admin/clients/${id}/permissions`, {
        permissions: mapped,
      });
      toast.success("Permissions saved");
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSavingPerms(false);
    }
  };

  const togglePerm = (key: string) => {
    const p = perms[key];
    if (!p?.purchased) return;
    setPerms((prev) => ({
      ...prev,
      [key]: { ...p, is_enabled: !p.is_enabled },
    }));
  };

  // ── Portal enable ──────────────────────────────────────────────────────────
  const enablePortal = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setSavingPortal(true);
    try {
      await api.post(`/admin/clients/${id}/enable-portal`, {
        portal_email: portalEmail,
        portal_password: portalPwd,
      });
      toast.success("Portal access enabled");
      setPortalPwd("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed");
    } finally {
      setSavingPortal(false);
    }
  };

  const disablePortal = async () => {
    if (!confirm("Disable portal access?")) return;
    try {
      await api.post(`/admin/clients/${id}/disable-portal`);
      toast.success("Portal disabled");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const openTransferModal = () => {
    setTransferModal(true);
    setTransferError("");
    if (companyUsers.length > 0 || !client?.company) return;
    adminClientService
      .companyUsers(client.company.id)
      .then(setCompanyUsers)
      .catch(() => setTransferError("Failed to load users"));
  };

  const handleTransfer = async () => {
    if (!transferToUserId) {
      setTransferError("Select a user to transfer to");
      return;
    }
    setTransferring(true);
    setTransferError("");
    try {
      await adminClientService.transfer(
        Number(id),
        Number(transferToUserId),
        transferReason.trim() || undefined,
      );
      toast.success("Client transferred");
      setTransferModal(false);
      setTransferToUserId("");
      setTransferReason("");
      load();
    } catch (err: any) {
      setTransferError(
        err?.response?.data?.message ?? "Failed to transfer client",
      );
    } finally {
      setTransferring(false);
    }
  };

  if (loading)
    return (
      <DashboardLayout title="Client">
        <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
          Loading…
        </div>
      </DashboardLayout>
    );

  if (!client)
    return (
      <DashboardLayout title="Client">
        <div style={{ padding: 60, textAlign: "center", color: "#dc2626" }}>
          Client not found.
        </div>
      </DashboardLayout>
    );

  const sc = STATUS_C[client.status] || { bg: "#f1f5f9", color: "#64748b" };
  // Only ever counts keys still in MODULES — perms can carry stray entries
  // (e.g. the retired 'chat' toggle) the backend still returns but this page
  // no longer renders a row for, which previously inflated these counts
  // past the number of toggles actually shown.
  const moduleKeys = new Set(MODULES.map((m) => m.key));
  const visiblePerms = Object.entries(perms)
    .filter(([k]) => moduleKeys.has(k))
    .map(([, v]) => v);
  const enabledCount = visiblePerms.filter(
    (p) => p.purchased && p.is_enabled,
  ).length;
  const purchasedCount = visiblePerms.filter((p) => p.purchased).length;

  return (
    <DashboardLayout title={client.name}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => router.push("/admin/clients")}
          style={{
            background: "#f1f5f9",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          ← Clients
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#1e293b",
                margin: 0,
              }}
            >
              {client.name}
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 20,
                background: sc.bg,
                color: sc.color,
                fontWeight: 500,
                textTransform: "capitalize",
              }}
            >
              {client.status}
            </span>
            {client.portal_access ? (
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#ecfdf5",
                  color: "#059669",
                  fontWeight: 600,
                }}
              >
                ✓ Portal Active
              </span>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#f1f5f9",
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                Portal Disabled
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>
            {client.company?.name}{" "}
            {client.company_name ? `· ${client.company_name}` : ""}
          </p>
          {/* Account Manager is not shown here — it served no purpose on this
              header. The field itself still exists (clients.account_manager)
              and the Transfer Client action still reads and reassigns it. */}
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>
            Created By:{" "}
            <strong style={{ color: "#475569" }}>
              {client.creator?.name ?? "—"}
            </strong>
          </p>
        </div>

        <button
          onClick={openTransferModal}
          style={{
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            color: "#475569",
          }}
        >
          ⇄ Transfer
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 20,
          background: "#f1f5f9",
          borderRadius: 10,
          padding: 4,
          width: "fit-content",
        }}
      >
        {/* 'messages' (Client Messages) is deliberately not a clickable tab
            here — not needed as a general-purpose tab on this page. Still
            reachable via the deep link from the Project Chat page's "Chat
            with Client" button (?tab=messages), which sets `tab` state
            directly — the content block below still renders for that case. */}
        {(["info", "portal", "permissions", "chat", "receipts"] as const).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#1e293b" : "#64748b",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                textTransform: "capitalize",
              }}
            >
              {t === "permissions"
                ? `Permissions (${enabledCount}/${MODULES.length})`
                : t === "portal"
                  ? "Portal Login"
                  : t === "chat"
                    ? "Sales Chat"
                    : t === "receipts"
                      ? "Invoice Receipts"
                      : "Details"}
            </button>
          ),
        )}
      </div>

      {/* ── Tab: Info ─────────────────────────────────────────────────────── */}
      {tab === "info" && (
        <form onSubmit={saveInfo}>
          <div style={card}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 18px",
              }}
            >
              Client Details
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div>
                <label style={lbl}>Client Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setF("name", e.target.value)}
                  required
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setF("status", e.target.value)}
                  style={inp}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div>
                <label style={lbl}>Contact Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setF("email", e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => setF("phone", v)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Business Name</label>
              <input
                value={form.company_name}
                onChange={(e) => setF("company_name", e.target.value)}
                placeholder="Client's company / business name"
                style={inp}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div>
                <label style={lbl}>Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setF("address", e.target.value)}
                  style={inp}
                />
              </div>
              <div>
                <label style={lbl}>Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setF("country", e.target.value)}
                  style={inp}
                >
                  <option value="">— Select —</option>
                  {ALL_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={lbl}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setF("notes", e.target.value)}
                rows={3}
                style={{ ...inp, resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={savingInfo}
              style={{
                padding: "10px 24px",
                background: savingInfo ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: savingInfo ? "not-allowed" : "pointer",
              }}
            >
              {savingInfo ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ── Tab: Portal Login ─────────────────────────────────────────────── */}
      {tab === "portal" && (
        <div style={card}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 6px",
            }}
          >
            Portal Login
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
            Share this link with the client so they know where to log in.
          </p>

          {/* Login URL — always shown, whether or not the portal is active yet,
              so it can be copied/shared ahead of enabling it. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <input
              readOnly
              value={loginUrl}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 7,
                fontSize: 12,
                background: "#f8fafc",
                color: "#1e293b",
                outline: "none",
              }}
            />
            <button
              onClick={copyLoginUrl}
              style={{
                padding: "9px 14px",
                borderRadius: 7,
                border: "none",
                background: loginUrlCopied ? "#059669" : "#2563eb",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loginUrlCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          {/* Current status */}
          {client.portal_access && client.user && (
            <div
              style={{
                padding: "12px 16px",
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}
                >
                  Portal Active
                </div>
                <div style={{ fontSize: 12, color: "#16a34a" }}>
                  Login: {client.user.email}
                </div>
              </div>
              <button
                onClick={disablePortal}
                style={{
                  padding: "6px 14px",
                  background: "#fff",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Disable Portal
              </button>
            </div>
          )}

          <form onSubmit={enablePortal}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {/* Not editable here. The login email is the client's Contact
                  Email — Api\Client\ProfileController keeps the two in step
                  whenever the client edits their own details, so an address
                  typed in independently on this screen would be silently
                  overwritten the next time they touch their profile. Change it
                  on the Details tab instead.

                  Safe to disable: the value is already pre-filled (from the
                  portal user's email, else the contact email) and this form
                  submits `portalEmail` from state, not from the input, so a
                  disabled field still sends it. */}
              <div>
                <label style={lbl}>Login Email</label>
                <input
                  type="email"
                  value={portalEmail}
                  disabled
                  placeholder="client@example.com"
                  style={{
                    ...inp,
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {portalEmail
                    ? "Same as the Contact Email. Change it on the Details tab."
                    : "Set a Contact Email on the Details tab first — it becomes the login email."}
                </div>
              </div>
              <div>
                <label style={lbl}>
                  {client.portal_access ? "New Password" : "Password"} *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={portalPwd}
                    onChange={(e) => setPortalPwd(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    style={{ ...inp, paddingRight: 52 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      fontSize: 11,
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {showPwd ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>

            {!seat?.can_add && !client.portal_access && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fef2f2",
                  color: "#dc2626",
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                Seat limit reached ({seat?.users_used}/{seat?.limit}). Cannot
                enable portal for more clients.
              </div>
            )}

            {/* Blocked rather than left to fail on save: the login email field
                above is disabled, so an empty one cannot be fixed from this
                tab and the request would just come back 422. */}
            {!portalEmail && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                This client has no Contact Email yet. Add one on the Details tab
                — that address becomes their login.
              </div>
            )}

            <button
              type="submit"
              disabled={
                savingPortal ||
                !portalEmail ||
                (!seat?.can_add && !client.portal_access)
              }
              style={{
                padding: "10px 24px",
                background:
                  savingPortal || !portalEmail ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  savingPortal || !portalEmail ? "not-allowed" : "pointer",
              }}
            >
              {savingPortal
                ? "Saving…"
                : client.portal_access
                  ? "Update Login"
                  : "Enable Portal"}
            </button>
          </form>
        </div>
      )}

      {/* ── Tab: Permissions ──────────────────────────────────────────────── */}
      {tab === "permissions" && (
        <div>
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#1e293b",
                    margin: 0,
                  }}
                >
                  Portal Permissions
                </h3>
                <p
                  style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}
                >
                  Control which sections <strong>{client.name}</strong> can see
                  in their portal
                </p>
              </div>
              {purchasedCount > 0 && (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  <strong style={{ color: "#1e293b" }}>{enabledCount}</strong> /{" "}
                  {purchasedCount} enabled
                </div>
              )}
            </div>

            {purchasedCount === 0 ? (
              <div
                style={{
                  padding: "28px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px dashed #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  No portal modules in your current plan.
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {MODULES.filter((m) => perms[m.key]?.purchased).map((m) => {
                    const on = perms[m.key]?.is_enabled === true;
                    return (
                      <div
                        key={m.key}
                        onClick={() => togglePerm(m.key)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 16px",
                          borderRadius: 10,
                          cursor: "pointer",
                          background: on ? "#eff6ff" : "#f8fafc",
                          border: `1px solid ${on ? "#bfdbfe" : "#e2e8f0"}`,
                          userSelect: "none",
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.boxShadow =
                            "0 2px 8px rgba(0,0,0,.06)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.boxShadow =
                            "none")
                        }
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: on ? "#1d4ed8" : "#64748b",
                            }}
                          >
                            {m.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#94a3b8",
                              marginTop: 2,
                            }}
                          >
                            {m.desc}
                          </div>
                        </div>
                        <div
                          style={{
                            width: 40,
                            height: 22,
                            borderRadius: 11,
                            flexShrink: 0,
                            background: on ? "#2563eb" : "#cbd5e1",
                            position: "relative",
                            transition: "background .18s",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 3,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,.2)",
                              left: on ? 21 : 3,
                              transition: "left .18s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Shortcuts */}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPerms((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([k, v]) => [
                            k,
                            { ...v, is_enabled: v.purchased },
                          ]),
                        ),
                      )
                    }
                    style={{
                      padding: "6px 14px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPerms((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).map(([k, v]) => [
                            k,
                            { ...v, is_enabled: false },
                          ]),
                        ),
                      )
                    }
                    style={{
                      padding: "6px 14px",
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Disable All
                  </button>
                </div>

                {/* Locked modules note */}
                {Object.values(perms).some((p) => !p.purchased) && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: "10px 14px",
                      background: "#fffbeb",
                      borderRadius: 8,
                      border: "1px solid #fde68a",
                      fontSize: 12,
                      color: "#92400e",
                    }}
                  >
                    {Object.values(perms).filter((p) => !p.purchased).length}{" "}
                    module(s) not available in your current plan. Upgrade to
                    unlock Projects, Documents, Chat, and more.
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={savePerms}
            disabled={savingPerms || purchasedCount === 0}
            style={{
              padding: "11px 28px",
              background: savingPerms ? "#93c5fd" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor:
                savingPerms || purchasedCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            {savingPerms ? "Saving…" : "Save Permissions"}
          </button>
        </div>
      )}

      {/* ── Tab: Sales Chat ───────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div style={card}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 14px",
            }}
          >
            Sales Chat
          </h3>
          {chat.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
              No messages yet.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 320,
                overflowY: "auto",
                marginBottom: 14,
              }}
            >
              {chat.map((m) => (
                <div key={m.id}>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}
                  >
                    {chatSenderName(m, {
                      adminSuffix: true,
                      guestSuffix: true,
                    })}
                  </div>
                  {m.content && (
                    <div style={{ fontSize: 13, color: "#475569" }}>
                      {m.content}
                    </div>
                  )}
                  {m.attachment_name && (
                    <button
                      onClick={() => downloadChatAttachment(m)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 4,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        color: "#2563eb",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      📎 {m.attachment_name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {chatFile && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 12px",
                marginBottom: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "#334155" }}>
                📎 {chatFile.name}{" "}
                <span style={{ color: "#94a3b8" }}>
                  ({fmtFileSize(chatFile.size)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => setChatFile(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Remove
              </button>
            </div>
          )}
          <form onSubmit={sendChat} style={{ display: "flex", gap: 8 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                borderRadius: 8,
                border: "1.5px dashed #cbd5e1",
                background: "#fff",
                color: "#64748b",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              📎
              <input
                type="file"
                style={{ display: "none" }}
                accept={ALLOWED_ATTACHMENT_TYPES.map((t) => `.${t}`).join(",")}
                onChange={(e) => {
                  setChatFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Message about this client…"
              style={{ ...inp, flex: 1 }}
            />
            <button
              type="submit"
              disabled={sendingChat}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: sendingChat ? "wait" : "pointer",
                opacity: sendingChat ? 0.7 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ── Tab: Invoice Receipts ─────────────────────────────────────────── */}
      {/* One card per receipt generated for a confirmed payment. The whole card
          is the link: it routes to the EXISTING invoice detail page
          (/admin/invoices/{id}) rather than opening anything of its own, so
          there is one invoice screen in this app and this is another way in. */}
      {tab === "receipts" && (
        <div style={card}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1e293b",
                margin: 0,
              }}
            >
              Invoice Receipts
            </h3>
            {receipts && receipts.length > 0 && (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {receipts.length} receipt{receipts.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 18px" }}>
            Generated automatically when a payment is confirmed. Click a receipt
            to open its invoice.
          </p>

          {receipts === null ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              Loading receipts…
            </div>
          ) : receipts.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              No paid invoices yet. A receipt appears here as soon as a payment
              is confirmed.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {receipts.map((r) => {
                const st = RECEIPT_STATUS[r.invoice_status] ?? {
                  bg: "#f1f5f9",
                  color: "#475569",
                };

                return (
                  <div
                    key={r.id}
                    role="link"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/admin/invoices/${r.invoice_id}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/admin/invoices/${r.invoice_id}`);
                      }
                    }}
                    style={{
                      display: "flex",
                      gap: 18,
                      alignItems: "stretch",
                      cursor: "pointer",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 16,
                      background: "#fff",
                    }}
                  >
                    {/* Receipt thumbnail — the generated image itself, not an
                        icon. Clicking it opens the receipt full size rather
                        than following the card to the invoice, so both actions
                        are reachable from one card. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (receiptImgs[r.id])
                          setViewingReceipt({
                            url: receiptImgs[r.id],
                            title: `Receipt · Invoice #${r.invoice_number}`,
                            fileName: r.file_name,
                          });
                      }}
                      title="View full receipt"
                      style={{
                        // 460×386 — the receipt's own aspect, so the whole
                        // thing shows in the thumbnail instead of being
                        // cropped by a box shaped for the old tall sheet.
                        width: 168,
                        aspectRatio: "460 / 386",
                        flexShrink: 0,
                        padding: 0,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        cursor: receiptImgs[r.id] ? "zoom-in" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {receiptImgs[r.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={receiptImgs[r.id]}
                          alt={`Payment receipt for invoice ${r.invoice_number}`}
                          style={{
                            width: "100%",
                            height: "auto",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#cbd5e1",
                            alignSelf: "center",
                          }}
                        >
                          Receipt
                        </span>
                      )}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* The invoice number leads — it is the thing an admin
                          scans this list for. */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#1e293b",
                          }}
                        >
                          #{r.invoice_number}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: st.bg,
                            color: st.color,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          {r.invoice_status.replace("_", " ")}
                        </span>
                        {r.receipt_number && (
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                            {r.receipt_number}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
                          marginBottom: 12,
                        }}
                      >
                        {r.is_brand && r.brand_name ? `${r.brand_name} · ` : ""}
                        {r.company_name}
                        {r.client_name ? ` · ${r.client_name}` : ""}
                      </div>

                      {/* The same fields the Client Portal row shows and the
                          receipt image itself carries — one definition, in
                          lib/receiptFields, so neither surface can end up more
                          detailed than the other. Invoice totals and running
                          balances deliberately stay on the invoice page, which
                          is one click away on this card. */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "10px 18px",
                        }}
                      >
                        {receiptFields(r).map((f) => (
                          <ReceiptFact
                            key={f.label}
                            label={f.label}
                            value={f.value}
                            strong={f.strong}
                            mono={f.mono}
                          />
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "#cbd5e1",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      ›
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Client Messages ──────────────────────────────────────────── */}
      {tab === "messages" && (
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              width: 200,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f1f5f9",
                fontSize: 12,
                fontWeight: 600,
                color: "#64748b",
              }}
            >
              Conversations
            </div>
            {dmThreads.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: "#94a3b8" }}>
                No messages yet.
              </div>
            ) : (
              dmThreads.map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => selectDmThread(t)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f8fafc",
                    background:
                      dmActiveThread?.id === t.id ? "#eff6ff" : "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    color: dmActiveThread?.id === t.id ? "#2563eb" : "#1e293b",
                  }}
                >
                  {t.title || `Thread #${t.id}`}
                </div>
              ))
            )}
          </div>
          <div style={{ ...card, flex: 1, margin: 0 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 14px",
              }}
            >
              Client Messages
            </h3>
            {!dmActiveThread ? (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                No conversation selected.
              </div>
            ) : (
              <>
                {dmMessages.length === 0 ? (
                  <div
                    style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}
                  >
                    No messages yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                      marginBottom: 14,
                    }}
                  >
                    {dmMessages.map((m: any) => (
                      <div key={m.id}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1e293b",
                          }}
                        >
                          {chatSenderName(m, {
                            adminSuffix: true,
                            guestSuffix: true,
                          })}
                        </div>
                        {m.content && (
                          <div style={{ fontSize: 13, color: "#475569" }}>
                            {m.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={sendDm} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={dmText}
                    onChange={(e) => setDmText(e.target.value)}
                    placeholder="Reply to client…"
                    style={{ ...inp, flex: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={sendingDm}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: sendingDm ? "wait" : "pointer",
                      opacity: sendingDm ? 0.7 : 1,
                    }}
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full-size receipt. Already in memory as an object URL, so opening it
          costs no second request. */}
      {viewingReceipt && (
        <ReceiptViewer
          url={viewingReceipt.url}
          title={viewingReceipt.title}
          fileName={viewingReceipt.fileName}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* Transfer Client modal — see Api\Admin\ClientController::transfer(). */}
      {transferModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: 420,
              maxWidth: "95vw",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>
              Transfer Client
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#94a3b8" }}>
              Currently assigned to {client.accountManager?.name ?? "no one"}.
            </p>
            {transferError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "#fef2f2",
                  borderRadius: 7,
                  color: "#dc2626",
                  fontSize: 12,
                }}
              >
                {transferError}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Transfer To *</label>
              <select
                style={inp}
                value={transferToUserId}
                onChange={(e) => setTransferToUserId(e.target.value)}
              >
                <option value="">Select user…</option>
                {companyUsers
                  .filter((u) => u.id !== client.account_manager)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Reason (optional)</label>
              <textarea
                style={{ ...inp, height: 64, resize: "vertical" }}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Why is this client being transferred?"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setTransferModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "none",
                  background: transferring ? "#93c5fd" : "#2563eb",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: transferring ? "not-allowed" : "pointer",
                }}
              >
                {transferring ? "Transferring…" : "Transfer Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

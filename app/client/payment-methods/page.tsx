"use client";

import { useCallback, useEffect, useState } from "react";
import { clientService, SavedCardCompany } from "@/lib/services/clientService";
import AddCardInline from "@/components/client/AddCardInline";
import toast from "react-hot-toast";

const GREEN = "#081B2D";

/**
 * The client's saved cards.
 *
 * No card detail is ever handled by this screen and none is shown. "Add
 * Payment Method" now opens the provider's card fields IN PLACE — Stripe
 * Elements' own cross-origin iframe, which this page cannot read — so the
 * client no longer leaves the portal to save a card. A company whose gateway
 * cannot do that still falls back to the hosted page, exactly as before.
 *
 * Either way what comes back is a token this app stores and can only hand back
 * to that gateway. A card is described here as "Visa •••• 4242" and nothing
 * more, because that is all the API returns.
 */
export default function ClientPaymentMethodsPage() {
  const [companies, setCompanies] = useState<SavedCardCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Which company's inline card form is open, if any.
  const [addingFor, setAddingFor] = useState<number | null>(null);

  const load = useCallback(() => {
    return clientService.paymentMethods
      .list()
      .then((res) => setCompanies(res.companies))
      .catch(() => toast.error("Could not load your payment methods."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCard = async (companyId: number) => {
    setBusy(true);
    try {
      const res = await clientService.paymentMethods.startSetup(companyId);

      // Remember which company this card is being added for — the return page
      // needs it, and it must not be guessed there.
      try {
        sessionStorage.setItem("pm_company_id", String(companyId));
      } catch {
        /* private mode */
      }

      if (res.navigation === "redirect") {
        window.location.assign(res.action);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = res.action;
      Object.entries(res.fields ?? {}).forEach(([k, v]) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = String(v);
        form.appendChild(i);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(
        ex.response?.data?.message || "Could not open the card entry page.",
      );
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(done);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      toast.error(
        ex.response?.data?.message || "That did not work. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: "#94a3b8", fontSize: 14 }}>
        Loading your payment methods…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "100%" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 4,
        }}
      >
        Payment Methods
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        Cards saved for faster payments. Your card details are held by the
        payment provider — we never store your card number.
      </p>

      {companies.length === 0 && (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          No companies are available for your account.
        </div>
      )}

      {companies.map((c) => (
        <div
          key={c.company_id}
          style={{
            background: "#fff",
            border: "1px solid #f1f5f9",
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 14,
            }}
          >
            {c.company_name ?? `Company ${c.company_id}`}
          </div>

          {c.payment_methods.length === 0 && (
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>
              No saved cards yet.
            </div>
          )}

          {c.payment_methods.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "12px 0",
                borderBottom: "1px solid #f8fafc",
              }}
            >
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: m.is_expired ? "#94a3b8" : "#0f172a",
                }}
              >
                {m.label}
              </span>
              {m.exp_month && m.exp_year && (
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  exp {String(m.exp_month).padStart(2, "0")}/{m.exp_year}
                </span>
              )}
              {m.is_default && !m.is_expired && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#1d4ed8",
                    background: "#dbeafe",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  DEFAULT
                </span>
              )}
              {m.is_expired && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#b45309",
                    background: "#fef3c7",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  EXPIRED
                </span>
              )}

              <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                {!m.is_default && !m.is_expired && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => clientService.paymentMethods.setDefault(m.id),
                        "Default updated.",
                      )
                    }
                    style={{
                      border: "none",
                      background: "none",
                      color: GREEN,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Use this card
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Remove ${m.label}?`))
                      act(
                        () => clientService.paymentMethods.remove(m.id),
                        "Payment method removed.",
                      );
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#dc2626",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}

          {/* Inline: the provider's card fields, right here. */}
          {c.can_add && addingFor === c.company_id && (
            <div style={{ marginTop: 16 }}>
              <AddCardInline
                companyId={c.company_id}
                onSaved={(card) => {
                  setAddingFor(null);
                  toast.success(`${card.label} added.`);
                  load();
                }}
                onCancel={() => setAddingFor(null)}
              />
            </div>
          )}

          {c.can_add && addingFor !== c.company_id ? (
            <button
              disabled={busy}
              onClick={() =>
                // Inline where the gateway supports it; the hosted page only
                // for one that cannot, which is what every company did before.
                c.can_add_inline
                  ? setAddingFor(c.company_id)
                  : addCard(c.company_id)
              }
              style={{
                marginTop: 14,
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: busy ? "#203750" : GREEN,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13.5,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              + Add Payment Method
            </button>
          ) : !c.can_add ? (
            <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
              Saving a card isn&apos;t available for this company. You can still
              pay each invoice through the Payment Assistant.
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

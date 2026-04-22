import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const fmt = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "—";

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ width: 34, height: 34, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const STATUS = {
  complete: { label: "Complete",  color: "#22C55E", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)"  },
  refunded: { label: "Reversed",  color: "#F87171", bg: "#3B0D0D",               border: "rgba(248,113,113,0.3)" },
  voided:   { label: "Voided",    color: "#FBBF24", bg: "#3B1F0D",               border: "rgba(251,191,36,0.3)"  },
};

export default function SalesHistory({ t, user, onBack }) {
  const today      = new Date().toISOString().slice(0, 10);
  const firstOfMon = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [sales, setSales]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dateFrom, setDateFrom]   = useState(firstOfMon);
  const [dateTo, setDateTo]       = useState(today);
  const [statusFilter, setStatus] = useState("all");
  const [search, setSearch]       = useState("");
  const [detail, setDetail]       = useState(null);   // sale being previewed
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm]     = useState(null);   // sale pending reversal
  const [reversing, setReversing] = useState(false);
  const [toast, setToast]         = useState(null);
  const [settings, setSettings]   = useState({ pharmacy_name: "PharmaPro Enterprise" });

  const isAdmin = ["admin", "super admin"].includes((user?.role || "").toLowerCase());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { date_from: dateFrom, date_to: dateTo };
    if (statusFilter !== "all") params.status = statusFilter;
    Promise.all([api.getSalesHistory(params), api.getSettings()])
      .then(([s, st]) => { setSales(s); setSettings(st); })
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (sale) => {
    setDetailLoading(true);
    setDetail({ loading: true, ...sale });
    try {
      const full = await api.getSaleDetail(sale.id);
      setDetail(full);
    } catch (e) { showToast(e.message, "error"); setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const handleReverse = async () => {
    if (!confirm) return;
    setReversing(true);
    try {
      const result = await api.reverseSale(confirm.id);
      showToast(`✅ ${result.sale_ref} reversed — stock restored, ${fmt(result.total_refunded)} refunded`);
      setConfirm(null);
      setDetail(null);
      load();
    } catch (e) { showToast(e.message, "error"); }
    finally { setReversing(false); }
  };

  const filtered = sales.filter(s =>
    s.sale_ref.toLowerCase().includes(search.toLowerCase()) ||
    (s.cashier_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_phone || "").includes(search)
  );

  const totalRevenue   = filtered.filter(s => s.status === "complete").reduce((a, s) => a + Number(s.total), 0);
  const totalReversed  = filtered.filter(s => s.status === "refunded").reduce((a, s) => a + Number(s.total), 0);
  const netRevenue     = totalRevenue - totalReversed;

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };
  const thStyle   = { padding: "12px 16px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "left", background: t.surface3, whiteSpace: "nowrap" };
  const tdStyle   = (extra) => ({ padding: "13px 16px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}`, ...extra });

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bg }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 600, background: toast.type === "error" ? "#3B0D0D" : "#0F2A1F", border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 14, padding: "14px 22px", fontSize: 14, fontWeight: 600, color: toast.type === "error" ? "#F87171" : "#22C55E", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          {toast.msg}
        </div>
      )}

      {/* ── Sticky Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent }}>🧾 Sales History & Reversals</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{settings.pharmacy_name} · {isAdmin ? "Admin — can reverse transactions" : "View only"}</div>
        </div>
        {!isAdmin && (
          <div style={{ fontSize: 12, background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "5px 14px", fontWeight: 600 }}>
            ⚠️ Admin access required to reverse
          </div>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Filters ── */}
        <div style={{ ...cardStyle, padding: "18px 22px", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 14, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "10px 13px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "10px 13px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>Status</label>
              <select value={statusFilter} onChange={e => setStatus(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "10px 13px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="all">All Statuses</option>
                <option value="complete">Complete</option>
                <option value="refunded">Reversed</option>
                <option value="voided">Voided</option>
              </select>
            </div>
            <button onClick={load} style={{ background: t.primary, border: "none", borderRadius: 10, padding: "11px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow, whiteSpace: "nowrap" }}>
              🔍 Search
            </button>
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "9px 14px" }}>
            <span style={{ color: t.textMuted }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice, cashier or phone…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 13, fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 14 }}>✕</button>}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
          {[
            { icon: "🧾", label: "Total Transactions", value: filtered.length,   color: t.accent,  bg: t.accent + "12"  },
            { icon: "💰", label: "Gross Revenue",      value: fmt(totalRevenue),  color: "#22C55E", bg: "rgba(34,197,94,0.1)"  },
            { icon: "↩️", label: "Total Reversed",     value: fmt(totalReversed), color: "#F87171", bg: "#3B0D0D" },
            { icon: "✅", label: "Net Revenue",         value: fmt(netRevenue),    color: t.accent,  bg: t.accent + "12"  },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}25`, borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, opacity: 0.85 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── Sales Table ── */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Transactions <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({filtered.length} records)</span></span>
            <span style={{ fontSize: 12, color: t.textMuted }}>Click a row to view details</span>
          </div>

          {loading ? <Spinner t={t} /> : filtered.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🧾</div>
              <p style={{ fontSize: 14 }}>No transactions found for this period</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Invoice", "Date & Time", "Cashier", "Items", "Total", "Payment", "Status", ""].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const st = STATUS[s.status] || STATUS.complete;
                    return (
                      <tr key={s.id}
                        onClick={() => openDetail(s)}
                        style={{ cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={tdStyle({ color: t.accent, fontFamily: "monospace", fontWeight: 700 })}>{s.sale_ref}</td>
                        <td style={tdStyle()}>
                          <div style={{ fontWeight: 600 }}>{fmtDate(s.created_at)}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{fmtTime(s.created_at)}</div>
                        </td>
                        <td style={tdStyle({ fontWeight: 500 })}>{s.cashier_name || "—"}</td>
                        <td style={tdStyle({ textAlign: "center", fontFamily: "monospace" })}>{s.item_count}</td>
                        <td style={tdStyle({ fontFamily: "monospace", fontWeight: 700, color: s.status === "refunded" ? "#F87171" : t.accent })}>
                          {s.status === "refunded" && <span style={{ fontSize: 10, color: "#F87171" }}>REVERSED </span>}
                          {fmt(s.total)}
                        </td>
                        <td style={tdStyle()}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: t.surface3, color: t.textSub, borderRadius: 20, padding: "2px 10px" }}>{s.payment_method}</span>
                        </td>
                        <td style={tdStyle()}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: 20, padding: "3px 12px" }}>{st.label}</span>
                        </td>
                        <td style={tdStyle({ textAlign: "center" })}>
                          <span style={{ fontSize: 16, color: t.textMuted }}>›</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail / Reversal Drawer ── */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(520px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", animation: "slideIn 0.25s ease" }}>

            {/* Drawer header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{detail.sale_ref}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{fmtDate(detail.created_at)} · {fmtTime(detail.created_at)}</div>
              </div>
              <button onClick={() => setDetail(null)}
                style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "7px 14px", color: t.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                ✕ Close
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {detail.loading ? <Spinner t={t} /> : (
                <>
                  {/* Status banner */}
                  {detail.status === "refunded" && (
                    <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#F87171", fontWeight: 600 }}>
                      ↩️ Reversed by {detail.reversed_by_name || "Admin"} on {fmtDate(detail.reversed_at)} — Stock has been restored
                    </div>
                  )}

                  {/* Sale info grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Cashier",  value: detail.cashier_name || "—" },
                      { label: "Payment",  value: detail.payment_method },
                      { label: "Status",   value: (STATUS[detail.status] || STATUS.complete).label },
                      { label: "Customer", value: detail.customer_phone || "Walk-in" },
                    ].map((f, i) => (
                      <div key={i} style={{ background: t.surface3, borderRadius: 10, padding: "11px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Items */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Items Sold</div>
                  <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                    {(detail.items || []).map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < detail.items.length - 1 ? `1px solid ${t.border}` : "none" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{item.drug_name || "Deleted drug"}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>
                            {item.batch_number ? `Batch: ${item.batch_number} · ` : ""}{fmt(item.unit_price)} × {item.quantity} {item.unit}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: t.accent }}>{fmt(item.subtotal)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderTop: `2px solid ${t.border}`, background: t.surface2 }}>
                      <strong style={{ color: t.text, fontSize: 15 }}>Total</strong>
                      <strong style={{ fontFamily: "monospace", fontSize: 16, color: t.accent }}>{fmt(detail.total)}</strong>
                    </div>
                  </div>

                  {/* Reverse button — admin only, only for complete sales */}
                  {isAdmin && detail.status === "complete" && (
                    <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "16px 18px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#F87171", marginBottom: 6 }}>⚠️ Reverse This Transaction</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
                        This will refund the full amount of <strong style={{ color: "#F87171" }}>{fmt(detail.total)}</strong> and restore all stock quantities back to what they were before this sale. This action is logged and cannot itself be undone.
                      </div>
                      <button
                        onClick={() => setConfirm(detail)}
                        style={{ width: "100%", background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 10, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
                        ↩️ Reverse Transaction
                      </button>
                    </div>
                  )}

                  {!isAdmin && detail.status === "complete" && (
                    <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 16px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                      🔒 Only admins can reverse transactions
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reversal Confirm Dialog ── */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 22, padding: "36px 36px 30px", width: "min(480px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp 0.2s ease" }}>
            {/* Icon */}
            <div style={{ width: 68, height: 68, borderRadius: 20, background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 22px" }}>↩️</div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: t.text, textAlign: "center", marginBottom: 10 }}>Confirm Reversal</h3>
            <p style={{ fontSize: 14, color: t.textSub, textAlign: "center", lineHeight: 1.65, marginBottom: 20 }}>
              You are about to reverse <strong style={{ color: "#F87171" }}>{confirm.sale_ref}</strong>.<br />
              <strong style={{ color: "#F87171" }}>{fmt(confirm.total)}</strong> will be refunded and all stock quantities will be restored to their pre-sale levels.
            </p>

            {/* Items summary */}
            <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 24, maxHeight: 180, overflowY: "auto" }}>
              {(confirm.items || []).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: i < (confirm.items || []).length - 1 ? `1px solid ${t.border}` : "none" }}>
                  <span style={{ color: t.text }}>{item.drug_name} <span style={{ color: t.textMuted }}>×{item.quantity}</span></span>
                  <span style={{ color: "#F87171", fontFamily: "monospace" }}>+{item.quantity} stock back</span>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 22, fontSize: 12, color: "#F59E0B" }}>
              ⚠️ This reversal is permanent and will be logged under your admin account.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setConfirm(null)} disabled={reversing}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleReverse} disabled={reversing}
                style={{ flex: 1, background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: reversing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: reversing ? 0.7 : 1, boxShadow: "0 4px 16px rgba(239,68,68,0.35)" }}>
                {reversing ? "Reversing…" : "↩️ Yes, Reverse It"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

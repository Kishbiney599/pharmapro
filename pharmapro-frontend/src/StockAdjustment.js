import { useState, useEffect, useCallback } from "react";
import { Spinner, Toast } from "./components";
import { api } from "./api";

const ADJUSTMENT_TYPES = [
  {
    id: "add_stock",
    icon: "📦",
    label: "Add Stock",
    desc: "New delivery received from supplier",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.3)",
    sign: "+",
  },
  {
    id: "write_off",
    icon: "🗑️",
    label: "Write Off",
    desc: "Damaged, expired or lost stock",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.3)",
    sign: "−",
  },
  {
    id: "stock_count",
    icon: "🔢",
    label: "Stock Count",
    desc: "Manual count correction — set exact quantity",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.3)",
    sign: "=",
  },
  {
    id: "transfer_in",
    icon: "📥",
    label: "Transfer In",
    desc: "Stock received from another branch",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.3)",
    sign: "+",
  },
  {
    id: "transfer_out",
    icon: "📤",
    label: "Transfer Out",
    desc: "Stock sent to another branch",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.3)",
    sign: "−",
  },
];

const WRITE_OFF_REASONS = [
  "Expired stock", "Damaged / broken", "Spilled / contaminated",
  "Stolen / missing", "Quality failure", "Manufacturer recall", "Other",
];
const ADD_REASONS = [
  "New delivery from supplier", "Purchase order received",
  "Donation received", "Return from customer", "Other",
];
const TRANSFER_IN_REASONS  = ["From main branch", "From warehouse", "Emergency transfer", "Other"];
const TRANSFER_OUT_REASONS = ["To branch", "To warehouse", "Emergency supply", "Other"];
const COUNT_REASONS = ["Monthly stock count", "Quarterly audit", "Spot check", "Discrepancy found", "Other"];

function reasonsFor(type) {
  if (type === "write_off")     return WRITE_OFF_REASONS;
  if (type === "add_stock")     return ADD_REASONS;
  if (type === "transfer_in")   return TRANSFER_IN_REASONS;
  if (type === "transfer_out")  return TRANSFER_OUT_REASONS;
  if (type === "stock_count")   return COUNT_REASONS;
  return [];
}

const fmtDT = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export default function StockAdjustment({ t, user }) {
  const [tab, setTab]           = useState("adjust"); // "adjust" | "history" | "report"
  const [drugs, setDrugs]       = useState([]);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });
  const [batches, setBatches]   = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState(null);
  const [drugSearch, setDrugSearch] = useState("");
  const [showDrugList, setShowDrugList] = useState(false);

  // Form state
  const [adjType, setAdjType]   = useState("add_stock");
  const [selDrug, setSelDrug]   = useState(null);
  const [selBatch, setSelBatch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason]     = useState("");
  const [notes, setNotes]       = useState("");
  const [success, setSuccess]   = useState(null);

  // History filters
  const today    = new Date().toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [hFrom, setHFrom] = useState(weekAgo);
  const [hTo, setHTo]     = useState(today);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.getAdjustmentDrugs().then(setDrugs).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (selDrug) {
      api.getAdjustmentBatches(selDrug.id).then(setBatches).catch(() => {});
      setSelBatch("");
    } else {
      setBatches([]);
    }
  }, [selDrug]);

  const loadHistory = useCallback(() => {
    setLoading(true);
    api.getStockMovements({ date_from: hFrom, date_to: hTo, limit: 150 })
      .then(setMovements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hFrom, hTo]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const reset = () => {
    setSelDrug(null); setSelBatch(""); setQuantity("");
    setReason(""); setNotes(""); setDrugSearch("");
  };

  const handleSubmit = async () => {
    if (!selDrug)   return showToast("Please select a drug", "error");
    if (!quantity || Number(quantity) <= 0) return showToast("Enter a valid quantity", "error");
    if (!reason)    return showToast("Please select a reason", "error");
    if (adjType === "stock_count" && !selBatch) return showToast("Select a batch for stock count", "error");

    setSubmitting(true);
    try {
      const res = await api.submitAdjustment({
        drug_id:         selDrug.id,
        batch_id:        selBatch || null,
        adjustment_type: adjType,
        quantity:        Number(quantity),
        reason,
        notes,
      });
      setSuccess(res);
      reset();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSubmitting(false); }
  };

  const selectedType  = ADJUSTMENT_TYPES.find(a => a.id === adjType);
  const filteredDrugs = drugs.filter(d =>
    d.name.toLowerCase().includes(drugSearch.toLowerCase())
  );

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };
  const inputStyle = {
    width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`,
    borderRadius: 11, padding: "10px 14px", color: t.text, fontSize: 14,
    outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
  };

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "9px 22px", borderRadius: 10, border: "none", cursor: "pointer",
      fontFamily: "inherit", fontSize: 14, fontWeight: tab === id ? 700 : 500,
      background: tab === id ? t.accent : "transparent",
      color: tab === id ? "#fff" : t.textMuted,
      display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
    }}>
      {icon} {label}
    </button>
  );

  const movTypeColor = (type) => ({
    in:         { color: "#22C55E", label: "In",        bg: "rgba(34,197,94,0.1)"  },
    out:        { color: "#EF4444", label: "Out",       bg: "rgba(239,68,68,0.1)"  },
    adjustment: { color: "#F59E0B", label: "Adjust",    bg: "rgba(245,158,11,0.1)" },
  }[type] || { color: t.textMuted, label: type, bg: t.surface3 });

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 600, background: toast.type === "error" ? "#3B0D0D" : "#0F2A1F", border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 14, padding: "14px 22px", fontSize: 14, fontWeight: 600, color: toast.type === "error" ? "#F87171" : "#22C55E", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>📦 Stock Adjustment</div>
        <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Add stock, write off damaged goods, do stock counts and transfers</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: t.surface3, borderRadius: 14, padding: 6, width: "fit-content" }}>
        <TabBtn id="adjust"  icon="⚙️" label="Make Adjustment" />
        <TabBtn id="history" icon="📋" label="Movement History" />
        <TabBtn id="report"  icon="📊" label="Adjustment Report" />
      </div>

      {/* ══ ADJUSTMENT TAB ══ */}
      {tab === "adjust" && (
        <>
          {/* Success state */}
          {success && (
            <div style={{ ...cardStyle, padding: "36px", textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, marginBottom: 8 }}>Adjustment Saved!</div>
              <p style={{ fontSize: 14, color: t.textSub, marginBottom: 22 }}>{success.message}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setSuccess(null)}
                  style={{ background: t.primary, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
                  ➕ Another Adjustment
                </button>
                <button onClick={() => { setSuccess(null); setTab("history"); loadHistory(); }}
                  style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 22px", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  📋 View History
                </button>
              </div>
            </div>
          )}

          {!success && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 22 }}>

              {/* Left — Type Selector */}
              <div>
                <div style={{ ...cardStyle, padding: "22px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Adjustment Type</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {ADJUSTMENT_TYPES.map(type => {
                      const active = adjType === type.id;
                      return (
                        <div key={type.id} onClick={() => { setAdjType(type.id); setReason(""); }}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, cursor: "pointer", background: active ? type.bg : "transparent", border: `1.5px solid ${active ? type.border : t.border}`, transition: "all 0.15s", userSelect: "none" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 11, background: active ? type.bg : t.surface3, border: `1px solid ${active ? type.border : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                            {type.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: active ? 700 : 600, color: active ? type.color : t.text }}>{type.label}</div>
                            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{type.desc}</div>
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: active ? type.color : "transparent", border: `2px solid ${active ? type.color : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right — Form */}
              <div style={{ ...cardStyle, padding: "24px 26px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{selectedType?.icon}</span>
                  {selectedType?.label}
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: selectedType?.color, background: selectedType?.bg, border: `1px solid ${selectedType?.border}`, borderRadius: 20, padding: "2px 10px" }}>
                    {selectedType?.sign} Stock
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Drug Search */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Drug / Product *</label>
                    <div style={{ position: "relative" }}>
                      <input
                        value={selDrug ? selDrug.name : drugSearch}
                        onChange={e => { setDrugSearch(e.target.value); setSelDrug(null); setShowDrugList(true); }}
                        onFocus={() => setShowDrugList(true)}
                        placeholder="Search drug name..."
                        style={{ ...inputStyle, paddingRight: selDrug ? 36 : 14 }}
                        onBlur={() => setTimeout(() => setShowDrugList(false), 180)}
                      />
                      {selDrug && (
                        <button onClick={() => { setSelDrug(null); setDrugSearch(""); setSelBatch(""); setBatches([]); }}
                          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                      )}
                      {showDrugList && !selDrug && filteredDrugs.length > 0 && (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 100, maxHeight: 220, overflowY: "auto" }}>
                          {filteredDrugs.slice(0, 12).map(d => (
                            <div key={d.id}
                              onMouseDown={() => { setSelDrug(d); setDrugSearch(""); setShowDrugList(false); }}
                              style={{ padding: "10px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}` }}
                              onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                              <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>{d.name}</span>
                              <span style={{ fontSize: 11, color: d.total_stock <= 0 ? "#F87171" : t.textMuted, fontFamily: "monospace" }}>
                                {d.total_stock} {d.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selDrug && (
                      <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: t.textMuted }}>
                        <span>Category: <strong style={{ color: t.textSub }}>{selDrug.category}</strong></span>
                        <span>Current stock: <strong style={{ color: selDrug.total_stock <= 0 ? "#F87171" : t.accent }}>{selDrug.total_stock} {selDrug.unit}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Batch selector — optional except for stock_count */}
                  {selDrug && batches.length > 0 && (
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>
                        Batch {adjType === "stock_count" ? "*" : "(optional)"}
                      </label>
                      <select value={selBatch} onChange={e => setSelBatch(e.target.value)} style={inputStyle}>
                        <option value="">— {adjType === "stock_count" ? "Select batch" : "All batches (FIFO)"} —</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batch_number || "No batch no."} — {b.quantity} units{b.expiry_date ? ` — Exp: ${new Date(b.expiry_date).toLocaleDateString()}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Quantity */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>
                      {adjType === "stock_count" ? "New Exact Quantity *" : "Quantity *"}
                    </label>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                      placeholder={adjType === "stock_count" ? "Enter the actual counted quantity" : "Enter quantity"}
                      style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }}
                      onFocus={e => e.target.style.borderColor = selectedType?.color || t.accent}
                      onBlur={e => e.target.style.borderColor = t.border} />
                    {adjType === "stock_count" && selDrug && quantity && (
                      <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: Number(quantity) >= selDrug.total_stock ? "#22C55E" : "#F87171" }}>
                        {Number(quantity) > selDrug.total_stock
                          ? `▲ +${Number(quantity) - selDrug.total_stock} units will be added`
                          : Number(quantity) < selDrug.total_stock
                          ? `▼ −${selDrug.total_stock - Number(quantity)} units will be removed`
                          : "✓ No change"}
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Reason *</label>
                    <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
                      <option value="">— Select reason —</option>
                      {reasonsFor(adjType).map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Additional Notes (optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Add any extra details..."
                      style={{ ...inputStyle, resize: "vertical", minHeight: 70, lineHeight: 1.5 }} />
                  </div>

                  {/* Submit */}
                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    <button onClick={reset}
                      style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Clear
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                      style={{ flex: 3, background: submitting ? t.surface3 : `linear-gradient(135deg,${selectedType?.color},${selectedType?.color}cc)`, border: "none", borderRadius: 12, padding: "13px 0", color: submitting ? t.textMuted : "#fff", fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: submitting ? "none" : `0 4px 16px ${selectedType?.color}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {submitting
                        ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Saving…</>
                        : `${selectedType?.icon} Save ${selectedType?.label}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ HISTORY TAB ══ */}
      {tab === "history" && (
        <>
          {/* Filters */}
          <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>From</label>
                <input type="date" value={hFrom} onChange={e => setHFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>To</label>
                <input type="date" value={hTo} onChange={e => setHTo(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={loadHistory}
                style={{ background: t.primary, border: "none", borderRadius: 11, padding: "11px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
                🔍 Filter
              </button>
            </div>
          </div>

          {/* Movement table */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Stock Movements <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({movements.length})</span></span>
            </div>
            {loading ? <Spinner t={t} /> : movements.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: t.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📋</div>
                <p>No movements found for this period</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: t.surface3 }}>
                      {["Date & Time", "Drug", "Type", "Qty", "Batch", "Reason", "By"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m, i) => {
                      const mt = movTypeColor(m.movement_type);
                      return (
                        <tr key={m.id} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}
                          onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "20"}>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: t.textMuted, fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmtDT(m.created_at)}</td>
                          <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: t.text }}>{m.drug_name || "—"} <span style={{ fontSize: 10, color: t.textMuted }}>({m.unit})</span></td>
                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: mt.bg, color: mt.color, border: `1px solid ${mt.color}25`, borderRadius: 20, padding: "3px 10px" }}>
                              {m.movement_type === "in" ? "▲" : "▼"} {mt.label}
                            </span>
                          </td>
                          <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: m.movement_type === "in" ? "#22C55E" : "#F87171" }}>
                            {m.movement_type === "in" ? "+" : "−"}{m.quantity}
                          </td>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: t.textMuted, fontFamily: "monospace" }}>{m.batch_number || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, color: t.textSub, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.reason || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, color: t.textMuted, whiteSpace: "nowrap" }}>{m.user_name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {/* ══ REPORT TAB ══ */}
      {tab === "report" && (
        <StockAdjustmentReport t={t} settings={settings} />
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  STOCK ADJUSTMENT REPORT COMPONENT
// ══════════════════════════════════════════════════════════════
function StockAdjustmentReport({ t, settings }) {
  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [dateFrom, setDateFrom]   = useState(monthAgo);
  const [dateTo, setDateTo]       = useState(today);
  const [searched, setSearched]   = useState(false);

  const inputStyle = {
    background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 11,
    padding: "10px 14px", color: t.text, fontSize: 13, outline: "none",
    fontFamily: "inherit", width: "100%",
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStockMovements({ date_from: dateFrom, date_to: dateTo, limit: 500 });
      setMovements(data);
      setSearched(true);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Analytics ─────────────────────────────────────────────
  const totalIn       = movements.filter(m => m.movement_type === "in").reduce((s, m) => s + m.quantity, 0);
  const totalOut      = movements.filter(m => m.movement_type === "out").reduce((s, m) => s + m.quantity, 0);
  const adjustments   = movements.filter(m => m.movement_type === "adjustment");
  const writeOffs     = movements.filter(m => m.movement_type === "out" && (m.reason||"").includes("write_off"));
  const deliveries    = movements.filter(m => m.movement_type === "in"  && (m.reason||"").includes("add_stock"));
  const transfers     = movements.filter(m => (m.reason||"").includes("transfer"));

  // Top drugs by movement
  const drugTotals = {};
  movements.forEach(m => {
    if (!m.drug_name) return;
    if (!drugTotals[m.drug_name]) drugTotals[m.drug_name] = { in: 0, out: 0, count: 0 };
    if (m.movement_type === "in")  drugTotals[m.drug_name].in  += m.quantity;
    if (m.movement_type === "out") drugTotals[m.drug_name].out += m.quantity;
    drugTotals[m.drug_name].count++;
  });
  const topDrugs = Object.entries(drugTotals)
    .map(([name, v]) => ({ name, ...v, total: v.in + v.out }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Movement by type breakdown
  const byType = {};
  movements.forEach(m => {
    const key = (m.reason || "").split(":")[0].trim() || m.movement_type;
    byType[key] = (byType[key] || 0) + 1;
  });

  // Daily movement trend
  const dailyMap = {};
  movements.forEach(m => {
    const d = (m.created_at || "").slice(0, 10);
    if (!d) return;
    if (!dailyMap[d]) dailyMap[d] = { in: 0, out: 0 };
    if (m.movement_type === "in")  dailyMap[d].in  += m.quantity;
    if (m.movement_type === "out") dailyMap[d].out += m.quantity;
  });
  const dailyTrend = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));

  // ── PDF Print ─────────────────────────────────────────────
  const handlePrint = () => {
    const now        = new Date().toLocaleString("en-GH");
    const printedBy  = JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin";
    const pharmName  = settings.pharmacy_name || "PharmaPro Enterprise";
    const contact    = [
      settings.phone   && "📞 " + settings.phone,
      settings.email   && "✉️ " + settings.email,
      settings.address && "📍 " + settings.address + (settings.city ? ", " + settings.city : ""),
    ].filter(Boolean).join("  ·  ");

    const movRows = movements.map((m, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
        <td style="color:#64748b;font-size:10px;white-space:nowrap">${new Date(m.created_at).toLocaleString("en-GH")}</td>
        <td><strong>${m.drug_name || "—"}</strong></td>
        <td style="text-align:center">
          <span style="background:${m.movement_type === "in" ? "#dcfce7" : "#fee2e2"};color:${m.movement_type === "in" ? "#15803d" : "#dc2626"};border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700">
            ${m.movement_type === "in" ? "▲ IN" : "▼ OUT"}
          </span>
        </td>
        <td style="text-align:center;font-weight:800;font-family:monospace;font-size:13px;color:${m.movement_type === "in" ? "#16a34a" : "#dc2626"}">
          ${m.movement_type === "in" ? "+" : "−"}${m.quantity}
        </td>
        <td style="font-family:monospace;font-size:10px;color:#64748b">${m.batch_number || "—"}</td>
        <td style="font-size:10px;color:#475569;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.reason || "—"}</td>
        <td style="font-size:10px;color:#64748b">${m.user_name || "—"}</td>
      </tr>`).join("");

    const topDrugRows = topDrugs.map((d, i) => {
      const max = topDrugs[0]?.total || 1;
      const pct = Math.round((d.total / max) * 100);
      return `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
          <td>${i + 1}</td>
          <td><strong>${d.name}</strong></td>
          <td style="text-align:center;color:#16a34a;font-weight:700;font-family:monospace">+${d.in}</td>
          <td style="text-align:center;color:#dc2626;font-weight:700;font-family:monospace">−${d.out}</td>
          <td style="text-align:center;font-family:monospace">${d.count}</td>
          <td style="min-width:100px">
            <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden">
              <div style="background:linear-gradient(90deg,#22c55e,#16a34a);height:100%;width:${pct}%;border-radius:4px"></div>
            </div>
          </td>
        </tr>`;
    }).join("");

    const css = `
      @page { size: A4; margin: 13mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; font-size: 11px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; margin-bottom:18px; border-bottom:3px solid #14b8a6; }
      .logo-row { display:flex; align-items:center; gap:12px; }
      .logo-box { width:48px;height:48px;background:linear-gradient(135deg,#14b8a6,#0891b2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px; }
      .pharmacy-name { font-size:20px;font-weight:800;color:#0f172a;margin:0 0 2px; }
      .report-tag { font-size:11px;color:#64748b;margin:0; }
      .report-meta { text-align:right;font-size:10px;color:#64748b;line-height:1.7; }
      .report-meta strong { color:#0f172a; }
      .stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px; }
      .stat-card { border-radius:10px;padding:11px 14px; }
      .stat-val { font-size:22px;font-weight:800;font-family:monospace; }
      .stat-lbl { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px; }
      h3 { font-size:13px;font-weight:700;color:#0f172a;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0; }
      table { width:100%;border-collapse:collapse;font-size:10px;margin-bottom:18px; }
      thead tr { background:#14b8a6; }
      thead th { color:#fff;font-weight:700;padding:8px 8px;text-align:left;white-space:nowrap; }
      tbody td { padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle; }
      .footer { margin-top:14px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:7px; }
      .section { margin-bottom:20px; }
      @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
    `;

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Stock Adjustment Report — ${pharmName}</title>
      <style>${css}</style>
    </head><body>

    <div class="header">
      <div class="logo-row">
        <div class="logo-box">📦</div>
        <div>
          <div class="pharmacy-name">${pharmName}</div>
          <div class="report-tag">Stock Adjustment Report · ${dateFrom} to ${dateTo}</div>
          ${contact ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${contact}</div>` : ""}
        </div>
      </div>
      <div class="report-meta">
        <strong>STOCK ADJUSTMENT REPORT</strong><br/>
        Period: ${dateFrom} to ${dateTo}<br/>
        Generated: ${now}<br/>
        Printed by: ${printedBy}<br/>
        Total movements: ${movements.length}
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="stats-grid">
      <div class="stat-card" style="background:#f0fdf4;border:1px solid #bbf7d0">
        <div class="stat-val" style="color:#16a34a">${totalIn}</div>
        <div class="stat-lbl" style="color:#16a34a">Total Units In</div>
      </div>
      <div class="stat-card" style="background:#fef2f2;border:1px solid #fecaca">
        <div class="stat-val" style="color:#dc2626">${totalOut}</div>
        <div class="stat-lbl" style="color:#dc2626">Total Units Out</div>
      </div>
      <div class="stat-card" style="background:#eff6ff;border:1px solid #bfdbfe">
        <div class="stat-val" style="color:#2563eb">${deliveries.length}</div>
        <div class="stat-lbl" style="color:#2563eb">Deliveries</div>
      </div>
      <div class="stat-card" style="background:#fff7ed;border:1px solid #fed7aa">
        <div class="stat-val" style="color:#ea580c">${writeOffs.length}</div>
        <div class="stat-lbl" style="color:#ea580c">Write-offs</div>
      </div>
      <div class="stat-card" style="background:#f5f3ff;border:1px solid #ddd6fe">
        <div class="stat-val" style="color:#7c3aed">${adjustments.length}</div>
        <div class="stat-lbl" style="color:#7c3aed">Stock Counts</div>
      </div>
      <div class="stat-card" style="background:#ecfdf5;border:1px solid #a7f3d0">
        <div class="stat-val" style="color:#059669">${transfers.length}</div>
        <div class="stat-lbl" style="color:#059669">Transfers</div>
      </div>
      <div class="stat-card" style="background:#f8fafc;border:1px solid #e2e8f0">
        <div class="stat-val" style="color:#475569">${movements.length}</div>
        <div class="stat-lbl" style="color:#475569">Total Movements</div>
      </div>
      <div class="stat-card" style="background:#f8fafc;border:1px solid #e2e8f0">
        <div class="stat-val" style="color:#475569">${totalIn - totalOut}</div>
        <div class="stat-lbl" style="color:${totalIn - totalOut >= 0 ? "#16a34a" : "#dc2626"}">Net Change</div>
      </div>
    </div>

    <!-- Top Drugs -->
    <div class="section">
      <h3>📊 Top 10 Most Adjusted Drugs</h3>
      <table>
        <thead><tr>
          <th>#</th><th>Drug Name</th>
          <th style="text-align:center">Units In</th>
          <th style="text-align:center">Units Out</th>
          <th style="text-align:center">Movements</th>
          <th>Activity</th>
        </tr></thead>
        <tbody>${topDrugRows}</tbody>
      </table>
    </div>

    <!-- Full Movement Log -->
    <div class="section">
      <h3>📋 Full Movement Log (${movements.length} entries)</h3>
      <table>
        <thead><tr>
          <th>Date & Time</th><th>Drug</th><th style="text-align:center">Type</th>
          <th style="text-align:center">Qty</th><th>Batch</th><th>Reason</th><th>By</th>
        </tr></thead>
        <tbody>${movRows}</tbody>
      </table>
    </div>

    <div class="footer">
      <span>${pharmName} — Confidential Stock Report</span>
      <span>Report ID: SAR-${Date.now()}</span>
      <span>${new Date().toLocaleDateString("en-GH")}</span>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };
  const inputStyle2 = {
    background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 11,
    padding: "10px 14px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit",
  };
  const maxActivity = topDrugs[0]?.total || 1;

  return (
    <div>
      {/* Date filter */}
      <div style={{ ...cardStyle, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle2} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle2} />
          </div>
          <button onClick={load} disabled={loading}
            style={{ background: t.primary, border: "none", borderRadius: 11, padding: "11px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow, display: "flex", alignItems: "center", gap: 7 }}>
            {loading ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Loading…</> : "🔍 Generate"}
          </button>
          {searched && movements.length > 0 && (
            <button onClick={handlePrint}
              style={{ background: "linear-gradient(135deg,#14B8A6,#0891b2)", border: "none", borderRadius: 11, padding: "11px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(20,184,166,0.35)", display: "flex", alignItems: "center", gap: 7 }}>
              🖨️ Download PDF
            </button>
          )}
        </div>
      </div>

      {!searched && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.4 }}>📊</div>
          <p style={{ fontSize: 14 }}>Select a date range and click Generate to see the report</p>
        </div>
      )}

      {searched && movements.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.4 }}>📦</div>
          <p style={{ fontSize: 14 }}>No stock movements found for this period</p>
        </div>
      )}

      {searched && movements.length > 0 && (
        <>
          {/* ── Summary Analytics Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
            {[
              { icon: "▲", label: "Total Units In",   value: totalIn,          color: "#22C55E", bg: "rgba(34,197,94,0.1)"    },
              { icon: "▼", label: "Total Units Out",  value: totalOut,         color: "#EF4444", bg: "rgba(239,68,68,0.1)"    },
              { icon: "📦", label: "Deliveries",       value: deliveries.length, color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
              { icon: "🗑️", label: "Write-offs",       value: writeOffs.length, color: "#F59E0B", bg: "rgba(245,158,11,0.1)"  },
              { icon: "🔢", label: "Stock Counts",     value: adjustments.length,color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
              { icon: "🔄", label: "Transfers",        value: transfers.length, color: "#14B8A6", bg: "rgba(20,184,166,0.1)"   },
              { icon: "📋", label: "Total Movements",  value: movements.length, color: t.accent,  bg: t.accent + "12"         },
              { icon: "⚖️", label: "Net Change",       value: (totalIn - totalOut >= 0 ? "+" : "") + (totalIn - totalOut), color: totalIn - totalOut >= 0 ? "#22C55E" : "#EF4444", bg: totalIn - totalOut >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}25`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* ── Top Drugs chart ── */}
          <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
              📊 Most Adjusted Drugs <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400 }}>(top 10)</span>
            </div>
            {topDrugs.map((d, i) => {
              const pct = Math.round((d.total / maxActivity) * 100);
              return (
                <div key={d.name} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", width: 18 }}>#{i+1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "monospace" }}>
                      <span style={{ color: "#22C55E", fontWeight: 700 }}>+{d.in}</span>
                      <span style={{ color: "#EF4444", fontWeight: 700 }}>−{d.out}</span>
                      <span style={{ color: t.textMuted }}>{d.count} moves</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: t.surface3, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,#22C55E,#14B8A6)`, borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Daily Trend ── */}
          {dailyTrend.length > 1 && (
            <div style={{ ...cardStyle, padding: "22px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                📈 Daily Movement Trend
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minWidth: dailyTrend.length * 44, height: 100 }}>
                  {dailyTrend.map(([date, vals]) => {
                    const maxVal = Math.max(...dailyTrend.map(([,v]) => Math.max(v.in, v.out)), 1);
                    const inH  = Math.round((vals.in  / maxVal) * 80);
                    const outH = Math.round((vals.out / maxVal) * 80);
                    return (
                      <div key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1, minWidth: 36 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                          <div title={`In: ${vals.in}`} style={{ width: 14, height: inH || 2, background: "#22C55E", borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                          <div title={`Out: ${vals.out}`} style={{ width: 14, height: outH || 2, background: "#EF4444", borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                        </div>
                        <div style={{ fontSize: 8, color: t.textMuted, transform: "rotate(-45deg)", transformOrigin: "top left", whiteSpace: "nowrap", marginLeft: 4 }}>
                          {new Date(date).toLocaleDateString("en-GH", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 24, fontSize: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 12, background: "#22C55E", borderRadius: 3 }} /><span style={{ color: t.textMuted }}>Stock In</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 12, height: 12, background: "#EF4444", borderRadius: 3 }} /><span style={{ color: t.textMuted }}>Stock Out</span></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

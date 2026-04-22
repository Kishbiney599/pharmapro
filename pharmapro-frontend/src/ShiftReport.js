import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const fmt = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtDT = (d) => d ? new Date(d).toLocaleString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const durHrs = (open, close) => {
  if (!open || !close) return "—";
  const ms = new Date(close) - new Date(open);
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <div style={{ width: 30, height: 30, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ShiftReport({ t, onBack, user }) {
  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [shifts, setShifts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo]     = useState(today);
  const [status, setStatus]     = useState("");
  const [detail, setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });

  const load = useCallback(() => {
    setLoading(true);
    const params = { date_from: dateFrom, date_to: dateTo };
    if (status) params.status = status;
    Promise.all([api.getShifts(params), api.getSettings()])
      .then(([s, st]) => { setShifts(s); setSettings(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, status]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (shift) => {
    setDetailLoading(true);
    setDetail({ ...shift, loading: true });
    try {
      const full = await api.getShift(shift.id);
      setDetail(full);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  // Summary stats
  const closed   = shifts.filter(s => s.status === "closed");
  const open     = shifts.filter(s => s.status === "open");
  const totalRev = closed.reduce((s, sh) => s + Number(sh.total_revenue || 0), 0);
  const variance = closed.reduce((s, sh) => s + Number(sh.cash_variance || 0), 0);

  const handlePrint = () => {
    if (!detail) return;
    const now = new Date().toLocaleString("en-GH");
    const pharmName = settings.pharmacy_name || "PharmaPro Enterprise";

    const saleRows = (detail.sales || []).map((s, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
        <td style="font-family:monospace;font-size:10px">${s.sale_ref}</td>
        <td style="font-size:10px;color:#64748b">${fmtDT(s.created_at)}</td>
        <td>${s.payment_method}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700;color:${s.status === "refunded" ? "#dc2626" : "#16a34a"}">${fmt(s.total)}</td>
        <td style="text-align:center"><span style="background:${s.status === "complete" ? "#dcfce7" : "#fee2e2"};color:${s.status === "complete" ? "#16a34a" : "#dc2626"};border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700">${s.status}</span></td>
      </tr>`).join("");

    const pmRows = (detail.breakdown || []).map(b => `
      <tr>
        <td><strong>${b.payment_method}</strong></td>
        <td style="text-align:center">${b.count}</td>
        <td style="text-align:right;font-family:monospace;color:#16a34a;font-weight:700">${fmt(b.revenue)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">${fmt(b.refunds || 0)}</td>
      </tr>`).join("");

    const varColor = Number(detail.cash_variance) >= 0 ? "#16a34a" : "#dc2626";

    const css = `
      @page { size: A4; margin: 13mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; font-size: 11px; }
      .hdr { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; margin-bottom:16px; border-bottom:3px solid #22c55e; }
      .logo-box { width:46px;height:46px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px; }
      .pname { font-size:19px;font-weight:800;color:#0f172a;margin:0 0 2px; }
      .rtag { font-size:11px;color:#64748b;margin:0; }
      .rmeta { text-align:right;font-size:10px;color:#64748b;line-height:1.7; }
      .rmeta strong { color:#0f172a; }
      .kpis { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0; }
      .kpi  { border-radius:10px;padding:10px 14px; }
      .kv   { font-size:18px;font-weight:800;font-family:monospace; }
      .kl   { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px; }
      h3    { font-size:12px;font-weight:700;color:#0f172a;margin:14px 0 8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0; }
      table { width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px; }
      thead tr { background:#22c55e; }
      thead th { color:#fff;font-weight:700;padding:7px 8px;text-align:left; }
      tbody td { padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle; }
      .footer { margin-top:12px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px; }
      @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
    `;

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>Shift Report — ${detail.shift_ref}</title>
      <style>${css}</style>
    </head><body>
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="logo-box">🏁</div>
        <div>
          <div class="pname">${pharmName}</div>
          <div class="rtag">Shift Report · ${detail.shift_ref}</div>
        </div>
      </div>
      <div class="rmeta">
        <strong>SHIFT RECONCILIATION REPORT</strong><br/>
        Cashier: ${detail.user_name || "—"}<br/>
        Opened: ${fmtDT(detail.opened_at)}<br/>
        Closed: ${fmtDT(detail.closed_at)}<br/>
        Duration: ${durHrs(detail.opened_at, detail.closed_at)}<br/>
        Generated: ${now}
      </div>
    </div>

    <div class="kpis">
      <div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0">
        <div class="kv" style="color:#16a34a">${detail.total_sales || 0}</div>
        <div class="kl" style="color:#16a34a">Transactions</div>
      </div>
      <div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe">
        <div class="kv" style="color:#2563eb">${fmt(detail.total_revenue)}</div>
        <div class="kl" style="color:#2563eb">Total Revenue</div>
      </div>
      <div class="kpi" style="background:#fef9c3;border:1px solid #fde047">
        <div class="kv" style="color:#ca8a04">${fmt(detail.opening_float)}</div>
        <div class="kl" style="color:#ca8a04">Opening Float</div>
      </div>
      <div class="kpi" style="background:${Number(detail.cash_variance) >= 0 ? "#f0fdf4" : "#fef2f2"};border:1px solid ${Number(detail.cash_variance) >= 0 ? "#bbf7d0" : "#fecaca"}">
        <div class="kv" style="color:${varColor}">${Number(detail.cash_variance) >= 0 ? "+" : ""}${fmt(detail.cash_variance)}</div>
        <div class="kl" style="color:${varColor}">Cash Variance</div>
      </div>
    </div>

    <h3>💳 Payment Method Breakdown</h3>
    <table>
      <thead><tr><th>Method</th><th style="text-align:center">Sales</th><th style="text-align:right">Revenue</th><th style="text-align:right">Refunds</th></tr></thead>
      <tbody>${pmRows}</tbody>
    </table>

    <h3>📋 Sales Log (${(detail.sales || []).length} transactions)</h3>
    <table>
      <thead><tr><th>Ref</th><th>Time</th><th>Payment</th><th style="text-align:right">Amount</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${saleRows}</tbody>
    </table>

    <div class="footer">
      <span>${pharmName} — Shift Report ${detail.shift_ref}</span>
      <span>Printed: ${now}</span>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };
  const th = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", background: t.surface3, whiteSpace: "nowrap" };
  const td = { padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}` };

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bg }}>

      {/* Header */}
      <div style={{ background: t.cardBg, borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent }}>🏁 Shift Management</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Shift history, reconciliation and cash variance</div>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
          {[
            { icon: "📋", label: "Total Shifts",    value: shifts.length,   color: t.accent  },
            { icon: "🟢", label: "Open Shifts",     value: open.length,     color: "#22C55E" },
            { icon: "💰", label: "Total Revenue",   value: fmt(totalRev),   color: "#3B82F6" },
            { icon: "⚖️", label: "Total Variance",  value: (variance >= 0 ? "+" : "") + fmt(variance), color: variance >= 0 ? "#22C55E" : "#EF4444" },
          ].map((c,i) => (
            <div key={i} style={{ background: c.color + "12", border: `1px solid ${c.color}25`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            {[["From", dateFrom, setDateFrom], ["To", dateTo, setDateTo]].map(([label, val, setter]) => (
              <div key={label}>
                <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>{label}</label>
                <input type="date" value={val} onChange={e => setter(e.target.value)}
                  style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 13px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 13px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <button onClick={load} style={{ background: t.primary, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>🔍 Filter</button>
          </div>
        </div>

        {/* Shifts table */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          {loading ? <Spinner t={t} /> : shifts.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🏁</div>
              <p>No shifts found for this period</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Shift Ref","Cashier","Opened","Closed","Duration","Sales","Revenue","Float","Cash Counted","Variance","Status",""].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {shifts.map(s => {
                  const vc = Number(s.cash_variance);
                  return (
                    <tr key={s.id} style={{ cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ ...td, color: t.accent, fontFamily: "monospace", fontWeight: 700 }}>{s.shift_ref}</td>
                      <td style={td}>{s.user_name || s.cashier_name}</td>
                      <td style={{ ...td, fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>{fmtDT(s.opened_at)}</td>
                      <td style={{ ...td, fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>{fmtDT(s.closed_at)}</td>
                      <td style={{ ...td, fontSize: 11, color: t.textMuted }}>{durHrs(s.opened_at, s.closed_at)}</td>
                      <td style={{ ...td, textAlign: "center", fontFamily: "monospace" }}>{s.total_sales || 0}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: t.accent }}>{fmt(s.total_revenue)}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: t.textMuted }}>{fmt(s.opening_float)}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: t.textMuted }}>{s.closing_cash != null ? fmt(s.closing_cash) : "—"}</td>
                      <td style={td}>
                        {s.status === "closed" ? (
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: vc === 0 ? "#22C55E" : vc > 0 ? "#22C55E" : "#EF4444" }}>
                            {vc >= 0 ? "+" : ""}{fmt(vc)}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: s.status === "open" ? "rgba(34,197,94,0.1)" : t.surface3, color: s.status === "open" ? "#22C55E" : t.textMuted, border: `1px solid ${s.status === "open" ? "rgba(34,197,94,0.3)" : t.border}`, borderRadius: 20, padding: "3px 10px" }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={td}>
                        <button onClick={() => openDetail(s)}
                          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "5px 12px", color: "#3B82F6", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shift Detail Drawer */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(600px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: t.accent }}>{detail.shift_ref}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{detail.user_name} · {detail.status}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!detail.loading && detail.status === "closed" && (
                  <button onClick={handlePrint}
                    style={{ background: "linear-gradient(135deg,#22C55E,#16a34a)", border: "none", borderRadius: 9, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    🖨️ Print Report
                  </button>
                )}
                <button onClick={() => setDetail(null)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 14px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
            {detailLoading ? <Spinner t={t} /> : (
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                {/* Info grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                  {[
                    ["Opened",        fmtDT(detail.opened_at)],
                    ["Closed",        fmtDT(detail.closed_at)],
                    ["Duration",      durHrs(detail.opened_at, detail.closed_at)],
                    ["Opening Float", fmt(detail.opening_float)],
                    ["Total Sales",   detail.total_sales || 0],
                    ["Total Revenue", fmt(detail.total_revenue)],
                    ["Cash Counted",  detail.closing_cash != null ? fmt(detail.closing_cash) : "—"],
                    ["Expected Cash", detail.expected_cash != null ? fmt(detail.expected_cash) : "—"],
                  ].map(([k,v]) => (
                    <div key={k} style={{ background: t.surface3, borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Variance */}
                {detail.status === "closed" && (
                  <div style={{ background: Number(detail.cash_variance) >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${Number(detail.cash_variance) >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Cash Variance</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: Number(detail.cash_variance) >= 0 ? "#22C55E" : "#EF4444" }}>
                      {Number(detail.cash_variance) >= 0 ? "+" : ""}{fmt(detail.cash_variance)}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                      {Number(detail.cash_variance) === 0 ? "✅ Exact match" : Number(detail.cash_variance) > 0 ? "▲ Cash surplus" : "▼ Cash shortage"}
                    </div>
                  </div>
                )}

                {/* Payment breakdown */}
                {(detail.breakdown || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>💳 Payment Breakdown</div>
                    <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
                      {detail.breakdown.map((b, i) => (
                        <div key={b.payment_method} style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", borderBottom: i < detail.breakdown.length - 1 ? `1px solid ${t.border}` : "none" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{b.payment_method}</span>
                          <div style={{ display: "flex", gap: 16, fontSize: 12, fontFamily: "monospace" }}>
                            <span style={{ color: t.textMuted }}>{b.count} sales</span>
                            <span style={{ color: "#22C55E", fontWeight: 700 }}>{fmt(b.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Sales log */}
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>🧾 Sales ({(detail.sales || []).length})</div>
                <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                  {(detail.sales || []).length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>No sales in this shift</div>
                  ) : (detail.sales || []).map((s, i) => (
                    <div key={s.sale_ref} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < detail.sales.length - 1 ? `1px solid ${t.border}` : "none" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.accent, fontFamily: "monospace" }}>{s.sale_ref}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{fmtDT(s.created_at)} · {s.payment_method}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: s.status === "refunded" ? "#F87171" : "#22C55E" }}>
                        {s.status === "refunded" ? "−" : ""}{fmt(s.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

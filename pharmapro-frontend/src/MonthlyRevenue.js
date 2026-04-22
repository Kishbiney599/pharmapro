import { useState, useEffect, useRef } from "react";
import { api } from "./api";

const fmt = (n) => `GH\u20B5 ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (t) => t ? t.slice(0, 5) : "";

function Spinner({ color = "#22C55E" }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 32, height: 32, border: `3px solid #334155`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const methodColor = { Cash: "#10b981", MoMo: "#8b5cf6", POS: "#3b82f6" };
const GRAD = "linear-gradient(135deg,#22C55E,#4ade80)";

export default function MonthlyRevenue({ t, onBack }) {
  // ─── State ─────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [selectedUser, setSelectedUser] = useState("all");
  const [staffList, setStaffList] = useState([]);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise", email: "", phone: "", address: "", city: "", tagline: "" });
  const printRef = useRef(null);

  // Load staff list and settings on mount
  useEffect(() => {
    api.getStaff().then(setStaffList).catch(() => {});
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  // Fetch report
  const fetchReport = async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      if (selectedUser !== "all") params.user_id = selectedUser;

      const [detailRows, summaryData] = await Promise.all([
        api.getMonthlyReport(params),
        api.getMonthlySummary(params),
      ]);
      setRows(detailRows);
      setSummary(summaryData.summary);
      setDaily(summaryData.daily);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── PDF Print ─────────────────────────────────────────────
  const handlePrint = () => {
    const staffName = selectedUser === "all"
      ? "All Staff"
      : staffList.find(s => String(s.id) === String(selectedUser))?.name || "Staff";

    const css = `
      @page { size: A4; margin: 18mm 14mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #22C55E; padding-bottom: 14px; margin-bottom: 20px; }
      .logo-area { display: flex; align-items: center; gap: 12px; }
      .logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg,#22C55E,#4ade80); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 26px; }
      .logo-text h1 { font-size: 20px; font-weight: 800; color: #22C55E; margin: 0 0 2px; }
      .logo-text p { font-size: 11px; color: #64748b; margin: 0; }
      .report-info { text-align: right; }
      .report-info h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
      .report-info p { font-size: 11px; color: #64748b; margin: 0; line-height: 1.6; }
      .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
      .summary-card { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
      .summary-card .sc-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
      .summary-card .sc-value { font-size: 18px; font-weight: 800; color: #22C55E; font-family: monospace; }
      .summary-card .sc-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
      thead tr { background: linear-gradient(135deg,#22C55E,#16a34a); }
      thead th { color: #fff; font-weight: 700; padding: 9px 10px; text-align: left; letter-spacing: 0.4px; }
      tbody tr:nth-child(even) { background: #f8faff; }
      tbody tr:nth-child(odd) { background: #ffffff; }
      tbody td { padding: 8px 10px; color: #1e293b; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .tfoot-row td { background: #0f172a; color: #fff; font-weight: 700; padding: 10px; font-size: 12px; }
      .tfoot-row td.total-val { color: #22C55E; font-size: 14px; font-family: monospace; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; }
      .badge-cash { background: #d1fae5; color: #065f46; }
      .badge-momo { background: #ede9fe; color: #4c1d95; }
      .badge-pos { background: #dbeafe; color: #1e40af; }
      .daily-section { margin-top: 18px; }
      .daily-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px; border-left: 4px solid #22C55E; padding-left: 8px; }
      .daily-table th { background: #0f172a; color: #fff; }
      .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
      .watermark { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 6px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;

    const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
    const totalAmt = rows.reduce((s, r) => s + Number(r.subtotal), 0);

    const tableRows = rows.map(r => `
      <tr>
        <td>${fmtDate(r.sale_date)}<br/><span style="color:#94a3b8;font-size:9px">${fmtTime(r.sale_time)}</span></td>
        <td><strong>${r.sale_ref}</strong></td>
        <td>${r.staff_name || "—"}</td>
        <td>${r.drug_name}</td>
        <td style="color:#64748b">${r.category || "—"}</td>
        <td style="text-align:center">${r.quantity}</td>
        <td style="font-family:monospace">GH₵${Number(r.unit_price).toFixed(2)}</td>
        <td style="font-family:monospace;font-weight:700;color:#00a882">GH₵${Number(r.subtotal).toFixed(2)}</td>
        <td><span class="badge badge-${(r.payment_method||'').toLowerCase().replace('/','')}">${r.payment_method}</span></td>
      </tr>
    `).join("");

    const dailyRows = daily.map(d => `
      <tr>
        <td>${fmtDate(d.date)}</td>
        <td style="text-align:center">${d.transactions}</td>
        <td style="font-family:monospace;font-weight:700;color:#00a882">GH₵${Number(d.revenue).toFixed(2)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sales Report</title><style>${css}</style></head>
<body>
  <div class="header">
    <div class="logo-area">
      <div class="logo-icon">💊</div>
      <div class="logo-text">
        <h1>${settings.pharmacy_name}</h1>
        <p>${settings.tagline || 'Pharmacy Management System'}</p>
            <p style="font-size:10px;color:#64748b;margin-top:2px">${[settings.phone && '📞 ' + settings.phone, settings.email && '✉️ ' + settings.email, settings.address && '📍 ' + settings.address].filter(Boolean).join('  ·  ')}</p>
      </div>
    </div>
    <div class="report-info">
      <h2>Sales Revenue Report</h2>
      <p>Period: ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}</p>
      <p>Staff: ${staffName}</p>
      <p>Generated: ${new Date().toLocaleString("en-GH")}</p>
      <p>Printed by: ${JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin"}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="sc-label">Total Revenue</div>
      <div class="sc-value">GH₵${Number(summary?.total_revenue || 0).toFixed(2)}</div>
      <div class="sc-sub">${summary?.days_active || 0} active days</div>
    </div>
    <div class="summary-card">
      <div class="sc-label">Transactions</div>
      <div class="sc-value">${summary?.total_transactions || 0}</div>
      <div class="sc-sub">Avg GH₵${Number(summary?.avg_sale || 0).toFixed(2)} each</div>
    </div>
    <div class="summary-card">
      <div class="sc-label">Total Qty Sold</div>
      <div class="sc-value">${totalQty.toLocaleString()}</div>
      <div class="sc-sub">Items dispensed</div>
    </div>
    <div class="summary-card">
      <div class="sc-label">Line Items</div>
      <div class="sc-value">${rows.length}</div>
      <div class="sc-sub">Across ${summary?.staff_count || 0} staff</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date / Time</th>
        <th>Invoice</th>
        <th>Staff</th>
        <th>Drug / Item</th>
        <th>Category</th>
        <th style="text-align:center">Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
        <th>Payment</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="5"><strong>TOTAL</strong></td>
        <td style="text-align:center;color:#fbbf24;font-size:13px"><strong>${totalQty}</strong></td>
        <td></td>
        <td class="total-val">GH₵${totalAmt.toFixed(2)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  ${daily.length > 0 ? `
  <div class="daily-section">
    <div class="daily-title">Daily Revenue Breakdown</div>
    <table class="daily-table">
      <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
      <tbody>${dailyRows}</tbody>
    </table>
  </div>` : ""}

  <div class="footer">
    <span>${settings.pharmacy_name} — Confidential Report</span>
    <span>Report ID: RPT-${Date.now()}</span>
    <span>${new Date().toLocaleDateString("en-GH")}</span>
  </div>
  <div class="watermark">Generated by ${settings.pharmacy_name}</div>
</body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  // ─── Computed totals ───────────────────────────────────────
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
  const totalAmt = rows.reduce((s, r) => s + Number(r.subtotal), 0);
  const maxDaily = Math.max(...daily.map(d => Number(d.revenue)), 1);

  // ─── Styles ────────────────────────────────────────────────
  const card = { background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 20, padding: "22px 26px", marginBottom: 20 };
  const th = { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 0.8, background: "linear-gradient(135deg,#22C55E,#16a34a)", whiteSpace: "nowrap" };
  const td = (extra) => ({ padding: "11px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}`, verticalAlign: "top", ...extra });

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bgGradient || t.bg }}>

      {/* ── Sticky Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "16px 32px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#22C55E" }}>
            Monthly Revenue Report
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Filter by date range and staff · export as PDF</div>
        </div>
        {hasSearched && rows.length > 0 && (
          <button onClick={handlePrint} style={{ background: GRAD, border: "none", borderRadius: 12, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(34,197,94,0.3)" }}>
            🖨️ Print / Download PDF
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Filter Panel ── */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            🔍 Select Report Filters
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr auto", gap: 16, alignItems: "flex-end" }}>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 14px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#22C55E"}
                onBlur={e => e.target.style.borderColor = t.border} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 14px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                onFocus={e => e.target.style.borderColor = "#22C55E"}
                onBlur={e => e.target.style.borderColor = t.border} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Staff Member</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 14px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                <option value="all">All Staff Members</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
              </select>
            </div>

            <button onClick={fetchReport} disabled={loading || !dateFrom || !dateTo}
              style={{ background: GRAD, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.8 : 1, boxShadow: "0 4px 16px rgba(34,197,94,0.3)", whiteSpace: "nowrap" }}>
              {loading ? "Loading…" : "Generate Report"}
            </button>
          </div>

          {/* Quick date range shortcuts */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, alignSelf: "center" }}>Quick:</span>
            {[
              { label: "Today", fn: () => { setDateFrom(today); setDateTo(today); } },
              { label: "This Week", fn: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1); setDateFrom(mon.toISOString().slice(0, 10)); setDateTo(today); } },
              { label: "This Month", fn: () => { setDateFrom(firstOfMonth); setDateTo(today); } },
              { label: "Last Month", fn: () => { const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth() - 1, 1); const l = new Date(d.getFullYear(), d.getMonth(), 0); setDateFrom(f.toISOString().slice(0, 10)); setDateTo(l.toISOString().slice(0, 10)); } },
              { label: "Last 30 Days", fn: () => { const d = new Date(); const p = new Date(); p.setDate(d.getDate() - 30); setDateFrom(p.toISOString().slice(0, 10)); setDateTo(today); } },
              { label: "Last 90 Days", fn: () => { const d = new Date(); const p = new Date(); p.setDate(d.getDate() - 90); setDateFrom(p.toISOString().slice(0, 10)); setDateTo(today); } },
            ].map(q => (
              <button key={q.label} onClick={q.fn} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 20, padding: "5px 14px", color: t.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={e => { e.target.style.borderColor = "#22C55E"; e.target.style.color = "#22C55E"; }}
                onMouseLeave={e => { e.target.style.borderColor = t.border; e.target.style.color = t.textSub; }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={card}>
            <Spinner />
            <p style={{ textAlign: "center", color: t.textMuted, fontSize: 13, paddingBottom: 16 }}>Fetching data from database…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ ...card, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <p style={{ color: "#ef4444", fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>⚠️ {error}</p>
          </div>
        )}

        {/* ── Empty state before search ── */}
        {!loading && !hasSearched && (
          <div style={{ ...card, textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.5 }}>📅</div>
            <p style={{ color: t.textMuted, fontSize: 15, fontWeight: 500 }}>Select a date range and click Generate Report</p>
            <p style={{ color: t.textMuted, fontSize: 13, marginTop: 6 }}>You can filter by a specific staff member or view all staff together</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && hasSearched && !error && (
          <>
            {/* Summary Cards */}
            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { icon: "💰", label: "Total Revenue", value: fmt(summary.total_revenue), grad: GRAD },
                  { icon: "🧾", label: "Transactions", value: Number(summary.total_transactions).toLocaleString(), grad: "linear-gradient(135deg,#3b82f6,#60a5fa)" },
                  { icon: "📦", label: "Total Qty Sold", value: totalQty.toLocaleString(), grad: "linear-gradient(135deg,#8b5cf6,#a78bfa)" },
                  { icon: "⚖️", label: "Avg per Sale", value: fmt(summary.avg_sale), grad: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
                ].map((c, i) => (
                  <div key={i} style={{ background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 18, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, background: c.grad, opacity: 0.1, borderRadius: "50%", filter: "blur(24px)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: c.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 12 }}>{c.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{c.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#22C55E", fontFamily: "monospace" }}>{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Bar Chart */}
            {daily.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>📉 Daily Revenue Breakdown</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {daily.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: t.textMuted, width: 100, flexShrink: 0, fontFamily: "monospace" }}>{fmtDate(d.date)}</span>
                      <div style={{ flex: 1, height: 20, background: t.surface3, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${(Number(d.revenue) / maxDaily) * 100}%`, background: GRAD, borderRadius: 4, transition: "width 0.6s ease", display: "flex", alignItems: "center", paddingLeft: 8, minWidth: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#22C55E", fontFamily: "monospace", fontWeight: 700, width: 110, textAlign: "right", flexShrink: 0 }}>{fmt(d.revenue)}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, width: 60, flexShrink: 0 }}>{d.transactions} txns</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Detail Table */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {/* Table header bar */}
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                    Detailed Sales Report
                    <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E30", borderRadius: 20, padding: "2px 10px" }}>
                      {rows.length} line items
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                    {fmtDate(dateFrom)} — {fmtDate(dateTo)} ·{" "}
                    {selectedUser === "all" ? "All Staff" : staffList.find(s => String(s.id) === String(selectedUser))?.name || "Staff"}
                  </div>
                </div>
              </div>

              {rows.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🔍</div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>No sales found for this period</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Try a wider date range or check if sales were recorded</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Date", "Time", "Invoice", "Staff", "Drug / Item", "Category", "Qty", "Unit Price", "Amount", "Payment"].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}
                          onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "40"}
                          style={{ background: i % 2 === 0 ? "transparent" : t.surface2 + "40", transition: "background 0.1s" }}>
                          <td style={td({ whiteSpace: "nowrap" })}>{fmtDate(r.sale_date)}</td>
                          <td style={td({ color: t.textMuted, fontFamily: "monospace", fontSize: 12 })}>{fmtTime(r.sale_time)}</td>
                          <td style={td({ color: "#22C55E", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" })}>{r.sale_ref}</td>
                          <td style={td({ fontWeight: 600, whiteSpace: "nowrap" })}>{r.staff_name || "—"}</td>
                          <td style={td({ fontWeight: 500 })}>{r.drug_name}</td>
                          <td style={td({ color: t.textMuted })}>{r.category || "—"}</td>
                          <td style={td({ textAlign: "center", fontFamily: "monospace", fontWeight: 700 })}>{r.quantity}</td>
                          <td style={td({ fontFamily: "monospace" })}>{fmt(r.unit_price)}</td>
                          <td style={td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(r.subtotal)}</td>
                          <td style={td()}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", background: (methodColor[r.payment_method] || "#64748b") + "18", color: methodColor[r.payment_method] || "#64748b", border: `1px solid ${(methodColor[r.payment_method] || "#64748b")}30` }}>
                              {r.payment_method}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Totals footer */}
                    <tfoot>
                      <tr style={{ background: "linear-gradient(135deg,#0f1a2e,#162030)" }}>
                        <td colSpan={6} style={{ padding: "14px 14px", fontSize: 14, fontWeight: 800, color: "#f0f6ff" }}>TOTAL</td>
                        <td style={{ padding: "14px", fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "#fbbf24", textAlign: "center" }}>{totalQty}</td>
                        <td style={{ padding: "14px" }}></td>
                        <td style={{ padding: "14px", fontFamily: "monospace", fontWeight: 800, fontSize: 16, color: "#22C55E" }}>{fmt(totalAmt)}</td>
                        <td style={{ padding: "14px" }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { Spinner } from "./components";
import { api } from "./api";

const fmt     = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtPct  = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const marginColor = (pct) => {
  if (pct >= 40) return "#22C55E";
  if (pct >= 20) return "#F59E0B";
  if (pct >= 0)  return "#EF4444";
  return "#7f1d1d";
};

export default function ProfitLoss({ t, onBack }) {
  const today      = new Date().toISOString().slice(0, 10);
  const firstOfMon = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMon);
  const [dateTo, setDateTo]     = useState(today);
  const [data, setData]         = useState(null);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });
  const [sortDrug, setSortDrug] = useState({ key: "profit", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setSearched(false);
    try {
      const [summary, lineItems, s] = await Promise.all([
        api.getPLSummary(dateFrom, dateTo),
        api.getPLItems(dateFrom, dateTo),
        api.getSettings(),
      ]);
      setData(summary);
      setItems(lineItems);
      setSettings(s);
      setSearched(true);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  // Sort drug table
  const sortedDrugs = [...(data?.top_drugs || [])].sort((a, b) => {
    const dir = sortDrug.dir === "asc" ? 1 : -1;
    return dir * (Number(a[sortDrug.key]) - Number(b[sortDrug.key]));
  });

  const toggleSort = (key) => {
    setSortDrug(s => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
  };

  const sortIcon = (key) => sortDrug.key === key ? (sortDrug.dir === "desc" ? " ▼" : " ▲") : "";

  // ── PDF Print ─────────────────────────────────────────────
  const handlePrint = () => {
    if (!data) return;
    const s        = data.summary;
    const now      = new Date().toLocaleString("en-GH");
    const printedBy = JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin";
    const pharmName = settings.pharmacy_name || "PharmaPro Enterprise";
    const contact  = [
      settings.phone   && "📞 " + settings.phone,
      settings.email   && "✉️ " + settings.email,
      settings.address && "📍 " + settings.address + (settings.city ? ", " + settings.city : ""),
    ].filter(Boolean).join("  ·  ");

    const mcColor = (pct) => pct >= 40 ? "#16a34a" : pct >= 20 ? "#d97706" : "#dc2626";

    const drugRows = sortedDrugs.slice(0, 30).map((d, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
        <td>${i + 1}</td>
        <td><strong>${d.name}</strong><br/><span style="font-size:10px;color:#64748b">${d.category || "—"}</span></td>
        <td style="text-align:center;font-family:monospace">${d.qty}</td>
        <td style="text-align:right;font-family:monospace">${fmt(d.revenue)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">${fmt(d.cost)}</td>
        <td style="text-align:right;font-family:monospace;font-weight:800;color:${mcColor(d.margin)}">${fmt(d.profit)}</td>
        <td style="text-align:center">
          <span style="background:${d.margin >= 40 ? "#dcfce7" : d.margin >= 20 ? "#fef3c7" : "#fee2e2"};
                       color:${mcColor(d.margin)};border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700">
            ${fmtPct(d.margin)}
          </span>
        </td>
      </tr>`).join("");

    const catRows = (data.by_category || []).map((c, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
        <td><strong>${c.category}</strong></td>
        <td style="text-align:right;font-family:monospace">${fmt(c.revenue)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">${fmt(c.cost)}</td>
        <td style="text-align:right;font-family:monospace;font-weight:800;color:${mcColor(c.margin)}">${fmt(c.profit)}</td>
        <td style="text-align:center">
          <span style="background:${c.margin >= 40 ? "#dcfce7" : c.margin >= 20 ? "#fef3c7" : "#fee2e2"};
                       color:${mcColor(c.margin)};border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700">
            ${fmtPct(c.margin)}
          </span>
        </td>
      </tr>`).join("");

    const dailyRows = (data.daily_trend || []).map((d, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
        <td>${fmtDate(d.date)}</td>
        <td style="text-align:right;font-family:monospace">${fmt(d.revenue)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">${fmt(d.cost)}</td>
        <td style="text-align:right;font-family:monospace;font-weight:800;color:${mcColor(d.margin)}">${fmt(d.profit)}</td>
        <td style="text-align:center;font-size:10px;color:${mcColor(d.margin)};font-weight:700">${fmtPct(d.margin)}</td>
      </tr>`).join("");

    const css = `
      @page { size: A4; margin: 13mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; font-size: 11px; }
      .hdr { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; margin-bottom:16px; border-bottom:3px solid #22c55e; }
      .logo-row { display:flex; align-items:center; gap:12px; }
      .logo-box { width:48px;height:48px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px; }
      .pname { font-size:20px;font-weight:800;color:#0f172a;margin:0 0 2px; }
      .rtag  { font-size:11px;color:#64748b;margin:0; }
      .rmeta { text-align:right;font-size:10px;color:#64748b;line-height:1.7; }
      .rmeta strong { color:#0f172a; }
      .kpis  { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px; }
      .kpi   { border-radius:10px;padding:11px 14px; }
      .kv    { font-size:20px;font-weight:800;font-family:monospace; }
      .kl    { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px; }
      h3     { font-size:12px;font-weight:700;color:#0f172a;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0; }
      table  { width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px; }
      thead tr { background:#22c55e; }
      thead th { color:#fff;font-weight:700;padding:7px 8px;text-align:left;white-space:nowrap; }
      tbody td { padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle; }
      .footer { margin-top:12px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px; }
      @media print { body { -webkit-print-color-adjust:exact;print-color-adjust:exact; } }
    `;

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>P&L Report — ${pharmName}</title>
      <style>${css}</style>
    </head><body>

    <div class="hdr">
      <div class="logo-row">
        <div class="logo-box">💰</div>
        <div>
          <div class="pname">${pharmName}</div>
          <div class="rtag">Profit & Loss Report · ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}</div>
          ${contact ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${contact}</div>` : ""}
        </div>
      </div>
      <div class="rmeta">
        <strong>PROFIT & LOSS REPORT</strong><br/>
        Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}<br/>
        Generated: ${now}<br/>
        Printed by: ${printedBy}<br/>
        Total Sales: ${s.total_sales}
      </div>
    </div>

    <div class="kpis">
      <div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0">
        <div class="kv" style="color:#16a34a">${fmt(s.total_revenue)}</div>
        <div class="kl" style="color:#16a34a">Total Revenue</div>
      </div>
      <div class="kpi" style="background:#fef2f2;border:1px solid #fecaca">
        <div class="kv" style="color:#dc2626">${fmt(s.total_cost)}</div>
        <div class="kl" style="color:#dc2626">Total Cost (COGS)</div>
      </div>
      <div class="kpi" style="background:${s.total_profit >= 0 ? "#f0fdf4" : "#fef2f2"};border:1px solid ${s.total_profit >= 0 ? "#bbf7d0" : "#fecaca"}">
        <div class="kv" style="color:${s.total_profit >= 0 ? "#16a34a" : "#dc2626"}">${fmt(s.total_profit)}</div>
        <div class="kl" style="color:${s.total_profit >= 0 ? "#16a34a" : "#dc2626"}">Gross Profit</div>
      </div>
      <div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe">
        <div class="kv" style="color:${mcColor(s.profit_margin)}">${fmtPct(s.profit_margin)}</div>
        <div class="kl" style="color:#2563eb">Profit Margin</div>
      </div>
    </div>

    <h3>📊 Profit by Drug (Top 30)</h3>
    <table>
      <thead><tr>
        <th>#</th><th>Drug / Product</th><th style="text-align:center">Qty</th>
        <th style="text-align:right">Revenue</th><th style="text-align:right">Cost</th>
        <th style="text-align:right">Profit</th><th style="text-align:center">Margin</th>
      </tr></thead>
      <tbody>${drugRows}</tbody>
    </table>

    <h3>🗂️ Profit by Category</h3>
    <table>
      <thead><tr>
        <th>Category</th><th style="text-align:right">Revenue</th>
        <th style="text-align:right">Cost</th><th style="text-align:right">Profit</th>
        <th style="text-align:center">Margin</th>
      </tr></thead>
      <tbody>${catRows}</tbody>
    </table>

    <h3>📅 Daily P&L Trend</h3>
    <table>
      <thead><tr>
        <th>Date</th><th style="text-align:right">Revenue</th>
        <th style="text-align:right">Cost</th><th style="text-align:right">Profit</th>
        <th style="text-align:center">Margin</th>
      </tr></thead>
      <tbody>${dailyRows}</tbody>
    </table>

    <div class="footer">
      <span>${pharmName} — Confidential Financial Report</span>
      <span>Report ID: PL-${Date.now()}</span>
      <span>${new Date().toLocaleDateString("en-GH")}</span>
    </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const cardStyle  = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };
  const inputStyle = { background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 11, padding: "10px 14px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" };
  const thStyle    = (key) => ({
    padding: "11px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: 0.7, textAlign: key === "name" || key === "category" ? "left" : "right",
    background: t.surface3, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
  });

  const s = data?.summary;
  const maxDrugProfit = sortedDrugs[0]?.profit || 1;

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
      fontFamily: "inherit", fontSize: 13, fontWeight: activeTab === id ? 700 : 500,
      background: activeTab === id ? t.accent : "transparent",
      color: activeTab === id ? "#fff" : t.textMuted, transition: "all 0.15s",
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bg }}>

      {/* Header */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent }}>💰 Profit & Loss Report</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Gross profit, margins, and cost analysis from sales data</div>
        </div>
        {searched && data && (
          <button onClick={handlePrint}
            style={{ background: "linear-gradient(135deg,#22C55E,#16a34a)", border: "none", borderRadius: 12, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(34,197,94,0.3)", display: "flex", alignItems: "center", gap: 7 }}>
            🖨️ Download PDF
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Filters */}
        <div style={{ ...cardStyle, padding: "16px 22px", marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 14, alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            {/* Quick presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Quick</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[["This Month", () => { const n = new Date(); setDateFrom(new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10)); setDateTo(today); }],
                  ["Last Month", () => { const n = new Date(); const f = new Date(n.getFullYear(),n.getMonth()-1,1); const l = new Date(n.getFullYear(),n.getMonth(),0); setDateFrom(f.toISOString().slice(0,10)); setDateTo(l.toISOString().slice(0,10)); }],
                  ["This Year",  () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(today); }],
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn}
                    style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 10px", color: t.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={load} disabled={loading}
              style={{ background: loading ? t.surface3 : t.primary, border: "none", borderRadius: 11, padding: "11px 24px", color: loading ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: loading ? "none" : t.glow, display: "flex", alignItems: "center", gap: 7 }}>
              {loading ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Loading…</> : "🔍 Generate Report"}
            </button>
          </div>
        </div>

        {!searched && !loading && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: t.textMuted }}>
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.4 }}>💰</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Select a date range and generate your P&L report</p>
            <p style={{ fontSize: 13 }}>Requires purchase prices to be set on drug batches for accurate cost calculations</p>
          </div>
        )}

        {loading && <Spinner t={t} />}

        {searched && !loading && data && (
          <>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16, marginBottom: 22 }}>
              {[
                { icon: "💰", label: "Total Revenue",  value: fmt(s.total_revenue),   color: "#22C55E", bg: "rgba(34,197,94,0.1)"   },
                { icon: "💸", label: "Total Cost (COGS)", value: fmt(s.total_cost),   color: "#EF4444", bg: "rgba(239,68,68,0.1)"   },
                { icon: "📈", label: "Gross Profit",   value: fmt(s.total_profit),     color: s.total_profit >= 0 ? "#22C55E" : "#EF4444", bg: s.total_profit >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" },
                { icon: "🎯", label: "Profit Margin",  value: fmtPct(s.profit_margin), color: marginColor(s.profit_margin), bg: marginColor(s.profit_margin) + "15" },
                { icon: "🧾", label: "Total Sales",    value: s.total_sales,            color: "#3B82F6", bg: "rgba(59,130,246,0.1)"  },
                { icon: "💊", label: "Items Sold",     value: s.total_items,            color: "#8B5CF6", bg: "rgba(139,92,246,0.1)"  },
                { icon: "📦", label: "Avg per Sale",   value: fmt(s.total_sales > 0 ? s.total_revenue / s.total_sales : 0), color: "#14B8A6", bg: "rgba(20,184,166,0.1)" },
                { icon: "⚠️", label: "Missing Cost Data", value: items.filter(i => Number(i.purchase_price) === 0).length + " items", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
              ].map((c,i) => (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}25`, borderRadius: 16, padding: "16px 18px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Missing purchase price warning */}
            {items.filter(i => Number(i.purchase_price) === 0).length > 0 && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "13px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <strong style={{ color: "#F59E0B" }}>{items.filter(i => Number(i.purchase_price) === 0).length} sale items</strong>
                  <span style={{ color: t.textMuted }}> have no purchase price set — their cost shows as GH₵0.00, making profit appear higher than it is. Set purchase prices when adding stock batches.</span>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: t.surface3, borderRadius: 12, padding: 5, width: "fit-content" }}>
              <TabBtn id="overview"   label="📊 Overview"       />
              <TabBtn id="drugs"      label="💊 By Drug"        />
              <TabBtn id="categories" label="🗂️ By Category"   />
              <TabBtn id="daily"      label="📅 Daily Trend"   />
              <TabBtn id="items"      label="📋 Line Items"     />
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
                {/* Revenue vs Cost vs Profit bar */}
                <div style={{ ...cardStyle, padding: "22px 24px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 18 }}>💰 Revenue vs Cost vs Profit</div>
                  {[
                    { label: "Revenue",     value: s.total_revenue, color: "#22C55E", pct: 100 },
                    { label: "Cost (COGS)", value: s.total_cost,    color: "#EF4444", pct: s.total_revenue > 0 ? (s.total_cost/s.total_revenue)*100 : 0 },
                    { label: "Gross Profit",value: s.total_profit,  color: marginColor(s.profit_margin), pct: s.total_revenue > 0 ? Math.max(0,(s.total_profit/s.total_revenue)*100) : 0 },
                  ].map(bar => (
                    <div key={bar.label} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: t.textSub, fontWeight: 500 }}>{bar.label}</span>
                        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: bar.color }}>{fmt(bar.value)}</span>
                      </div>
                      <div style={{ height: 10, background: t.surface3, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(0,Math.min(100,bar.pct))}%`, background: bar.color, borderRadius: 6, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 20, borderTop: `1px solid ${t.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.textMuted }}>Overall Profit Margin</span>
                    <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", color: marginColor(s.profit_margin) }}>{fmtPct(s.profit_margin)}</span>
                  </div>
                </div>

                {/* Payment method breakdown */}
                <div style={{ ...cardStyle, padding: "22px 24px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 18 }}>💳 Profit by Payment Method</div>
                  {(data.by_payment || []).map((p, i) => {
                    const pct = s.total_profit > 0 ? (p.profit / s.total_profit) * 100 : 0;
                    const colors = ["#22C55E", "#8B5CF6", "#3B82F6", "#F59E0B"];
                    const c = colors[i % colors.length];
                    return (
                      <div key={p.method} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{p.method}</span>
                          <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 700, color: c }}>{fmt(p.profit)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.textMuted, marginBottom: 6 }}>
                          <span>Revenue: {fmt(p.revenue)}</span>
                          <span>Margin: {p.revenue > 0 ? fmtPct((p.profit/p.revenue)*100) : "—"}</span>
                        </div>
                        <div style={{ height: 6, background: t.surface2, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(0,Math.min(100,pct))}%`, background: c, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── BY DRUG TAB ── */}
            {activeTab === "drugs" && (
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Profit by Drug <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({sortedDrugs.length} products)</span></span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>Click column headers to sort</span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ ...thStyle("name"), textAlign: "left" }} onClick={() => toggleSort("name")}>#  Drug{sortIcon("name")}</th>
                        <th style={thStyle("qty")}     onClick={() => toggleSort("qty")}>Qty{sortIcon("qty")}</th>
                        <th style={thStyle("revenue")} onClick={() => toggleSort("revenue")}>Revenue{sortIcon("revenue")}</th>
                        <th style={thStyle("cost")}    onClick={() => toggleSort("cost")}>Cost{sortIcon("cost")}</th>
                        <th style={thStyle("profit")}  onClick={() => toggleSort("profit")}>Profit{sortIcon("profit")}</th>
                        <th style={thStyle("margin")}  onClick={() => toggleSort("margin")}>Margin{sortIcon("margin")}</th>
                        <th style={{ ...thStyle("bar"), textAlign: "left", minWidth: 100 }}>Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDrugs.map((d, i) => {
                        const barPct = Math.max(0, Math.min(100, (d.profit / maxDrugProfit) * 100));
                        const mc     = marginColor(d.margin);
                        return (
                          <tr key={d.name} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}
                            onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "20"}>
                            <td style={{ padding: "11px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", width: 22 }}>#{i+1}</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.name}</div>
                                  <div style={{ fontSize: 10, color: t.textMuted }}>{d.category}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13, color: t.textSub }}>{d.qty}</td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13, color: "#22C55E", fontWeight: 600 }}>{fmt(d.revenue)}</td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13, color: "#EF4444" }}>{fmt(d.cost)}</td>
                            <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 14, fontWeight: 800, color: mc }}>{fmt(d.profit)}</td>
                            <td style={{ padding: "11px 14px", textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, background: mc + "15", color: mc, border: `1px solid ${mc}30`, borderRadius: 20, padding: "3px 10px" }}>{fmtPct(d.margin)}</span>
                            </td>
                            <td style={{ padding: "11px 14px", minWidth: 100 }}>
                              <div style={{ height: 8, background: t.surface3, borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${barPct}%`, background: mc, borderRadius: 4 }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── BY CATEGORY TAB ── */}
            {activeTab === "categories" && (
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Profit by Category</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: t.surface3 }}>
                        {["Category","Qty Sold","Revenue","Cost","Gross Profit","Margin","Contribution"].map(h => (
                          <th key={h} style={{ padding: "11px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: h === "Category" ? "left" : "right" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.by_category || []).map((c, i) => {
                        const contrib = s.total_profit > 0 ? (c.profit / s.total_profit) * 100 : 0;
                        const mc = marginColor(c.margin);
                        return (
                          <tr key={c.category} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}
                            onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "20"}>
                            <td style={{ padding: "13px 14px", fontSize: 14, fontWeight: 700, color: t.text }}>{c.category}</td>
                            <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "monospace", color: t.textSub }}>{c.qty}</td>
                            <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "monospace", color: "#22C55E", fontWeight: 600 }}>{fmt(c.revenue)}</td>
                            <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "monospace", color: "#EF4444" }}>{fmt(c.cost)}</td>
                            <td style={{ padding: "13px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: mc }}>{fmt(c.profit)}</td>
                            <td style={{ padding: "13px 14px", textAlign: "right" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, background: mc + "15", color: mc, border: `1px solid ${mc}30`, borderRadius: 20, padding: "3px 10px" }}>{fmtPct(c.margin)}</span>
                            </td>
                            <td style={{ padding: "13px 14px", textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                                <div style={{ width: 60, height: 6, background: t.surface3, borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.max(0,Math.min(100,contrib))}%`, background: mc, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace" }}>{fmtPct(contrib)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── DAILY TREND TAB ── */}
            {activeTab === "daily" && (
              <div style={{ ...cardStyle, padding: "22px 24px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 20 }}>📅 Daily Profit & Loss Trend</div>
                {(data.daily_trend || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: t.textMuted }}>No daily data for this period</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: t.surface3 }}>
                          {["Date","Revenue","Cost","Profit","Margin","Trend"].map(h => (
                            <th key={h} style={{ padding: "11px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: h === "Date" || h === "Trend" ? "left" : "right" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(data.daily_trend || []).map((d, i) => {
                          const mc = marginColor(d.margin);
                          const maxProfit = Math.max(...(data.daily_trend || []).map(x => x.profit), 0.01);
                          const barPct = Math.max(0, (d.profit / maxProfit) * 100);
                          return (
                            <tr key={d.date} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}
                              onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "20"}>
                              <td style={{ padding: "11px 14px", fontSize: 13, color: t.textSub }}>{fmtDate(d.date)}</td>
                              <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", color: "#22C55E", fontWeight: 600 }}>{fmt(d.revenue)}</td>
                              <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", color: "#EF4444" }}>{fmt(d.cost)}</td>
                              <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: mc }}>{fmt(d.profit)}</td>
                              <td style={{ padding: "11px 14px", textAlign: "right" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: mc }}>{fmtPct(d.margin)}</span>
                              </td>
                              <td style={{ padding: "11px 14px", minWidth: 120 }}>
                                <div style={{ height: 8, background: t.surface3, borderRadius: 4, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${barPct}%`, background: mc, borderRadius: 4 }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── LINE ITEMS TAB ── */}
            {activeTab === "items" && (
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Sale Line Items <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({items.length} rows · capped at 500)</span></span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0 }}>
                      <tr style={{ background: t.surface3 }}>
                        {["Sale Ref","Date","Drug","Category","Qty","Unit Price","Cost Price","Revenue","Cost","Profit","Margin"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const mc  = marginColor(Number(item.margin_pct));
                        const noPurchase = Number(item.purchase_price) === 0;
                        return (
                          <tr key={i} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}
                            onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "20"}>
                            <td style={{ padding: "9px 12px", fontSize: 11, color: t.accent, fontFamily: "monospace", fontWeight: 700 }}>{item.sale_ref}</td>
                            <td style={{ padding: "9px 12px", fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>{fmtDate(item.created_at)}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: t.text }}>{item.drug_name || "—"}</td>
                            <td style={{ padding: "9px 12px", fontSize: 11, color: t.textMuted }}>{item.category || "—"}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "right", color: t.textSub }}>{item.quantity}</td>
                            <td style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", textAlign: "right", color: t.textSub }}>{fmt(item.unit_price)}</td>
                            <td style={{ padding: "9px 12px", fontSize: 11, fontFamily: "monospace", textAlign: "right", color: noPurchase ? "#F59E0B" : t.textMuted }}>
                              {noPurchase ? "⚠️ —" : fmt(item.purchase_price)}
                            </td>
                            <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "right", color: "#22C55E", fontWeight: 600 }}>{fmt(item.revenue)}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "right", color: "#EF4444" }}>{fmt(item.cost)}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: "monospace", textAlign: "right", fontWeight: 700, color: mc }}>{fmt(item.profit)}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: mc, background: mc + "15", border: `1px solid ${mc}25`, borderRadius: 20, padding: "2px 8px" }}>{fmtPct(item.margin_pct)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

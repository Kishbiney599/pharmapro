import { useState, useEffect } from "react";
import { api } from "./api";

// ─── Pure SVG Charts — no external deps ──────────────────────
function LineChart({ data, color, height = 130 }) {
  if (!data || data.length === 0 || data.every(d => d.revenue === 0))
    return <EmptyChart msg="No hourly data yet" />;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const W = 560, H = height;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * (W - 48) + 24,
    y: H - 28 - ((d.revenue / max) * (H - 50)),
    ...d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${pts[pts.length - 1].x} ${H - 28} L ${pts[0].x} ${H - 28} Z`;
  const lbl = (h) => h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill={color} stroke="#0F172A" strokeWidth="2" />
          <text x={p.x} y={H - 5} textAnchor="middle" fontSize="10" fill="#64748b">{lbl(p.hour)}</text>
          {p.revenue > 0 && <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill={color}>GH₵{p.revenue.toFixed(0)}</text>}
        </g>
      ))}
    </svg>
  );
}

function HorizBars({ data }) {
  if (!data || data.length === 0) return <EmptyChart msg="No data yet" />;
  const max = Math.max(...data.map(d => Number(d.revenue || 0)), 1);
  const COLORS = ["#22C55E", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444", "#10b981"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{d.label || d.category || d.staff_name}</span>
            <span style={{ fontSize: 12, color: "#f0f6ff", fontWeight: 700, fontFamily: "monospace" }}>GH₵ {Number(d.revenue || 0).toFixed(2)}</span>
          </div>
          <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(Number(d.revenue) / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: "width 0.8s ease" }} />
          </div>
          {d.qty_sold !== undefined && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{d.qty_sold} units</div>}
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, size = 150 }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + Number(d.revenue || 0), 0);
  if (total === 0) return <EmptyChart msg="No data yet" />;
  let cum = -90;
  const cx = size / 2, cy = size / 2, r = 50;
  const slices = data.map(d => {
    const angle = (Number(d.revenue) / total) * 360;
    const s = cum; cum += angle;
    return { ...d, s, e: cum };
  });
  const polar = (cx, cy, r, a) => ({ x: cx + r * Math.cos(a * Math.PI / 180), y: cy + r * Math.sin(a * Math.PI / 180) });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((sl, i) => {
        const st = polar(cx, cy, r, sl.s), en = polar(cx, cy, r, sl.e);
        const large = sl.e - sl.s > 180 ? 1 : 0;
        return <path key={i} d={`M${cx} ${cy} L${st.x} ${st.y} A${r} ${r} 0 ${large} 1 ${en.x} ${en.y}Z`} fill={sl.color} opacity="0.9" />;
      })}
      <circle cx={cx} cy={cy} r={30} fill="#1E293B" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#f0f6ff">
        {((Number(data[0].revenue) / total) * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

function EmptyChart({ msg }) {
  return <div style={{ padding: "28px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>{msg || "No data for today yet. Complete sales via POS to see analytics."}</div>;
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 48 }}>
      <div style={{ width: 34, height: 34, border: "3px solid #334155", borderTopColor: "#22C55E", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const fmt = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtN = (n) => Number(n || 0).toLocaleString();
const DONUT_COLORS = ["#22C55E", "#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4"];
const methodColor = { Cash: "#10b981", MoMo: "#8b5cf6", POS: "#3b82f6" };

export default function TodayRevenue({ t, onBack }) {
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topDrugs, setTopDrugs] = useState([]);
  const [returns, setReturns] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [rxOtc, setRxOtc] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTxn, setShowTxn] = useState(false);
  const [txFilter, setTxFilter] = useState({ method: "All", staff_id: "All" });
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getTodaySummary(), api.getTodayPayments(), api.getTodayStaff(),
      api.getTodayCategories(), api.getTodayTopDrugs(), api.getTodayReturns(),
      api.getTodayHourly(), api.getTodayRxOtc(), api.getTodayInventoryImpact(),
    ]).then(([sum, pay, stf, cat, drugs, ret, hr, rxotc, inv]) => {
      setSummary(sum);
      setPayments(pay.map((p, i) => ({ ...p, color: DONUT_COLORS[i % DONUT_COLORS.length] })));
      setStaff(stf);
      setCategories(cat);
      setTopDrugs(drugs);
      setReturns(ret);
      setHourly(hr);
      setRxOtc(rxotc.map((r, i) => ({ ...r, color: i === 0 ? "#3b82f6" : "#22C55E" })));
      setInventory(inv);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showTxn) return;
    setTxLoading(true);
    const f = {};
    if (txFilter.method !== "All") f.method = txFilter.method;
    if (txFilter.staff_id !== "All") f.staff_id = txFilter.staff_id;
    api.getTodayTransactions(f).then(setTransactions).catch(e => setError(e.message)).finally(() => setTxLoading(false));
  }, [showTxn, txFilter]);

  const trend = (now, prev) => {
    const pct = prev > 0 ? (((now - prev) / prev) * 100).toFixed(1) : (now > 0 ? "100" : "0");
    return { pct: Math.abs(pct), up: Number(now) >= Number(prev) };
  };

  // ── Header bar (shared) ────────────────────────────────────
  const Header = () => (
    <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
      <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
        ← Back
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#22C55E" }}>Today's Revenue — Live Analytics</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Live from MySQL</div>
      </div>
      <button onClick={() => setShowTxn(true)} style={{ background: "linear-gradient(135deg,#22C55E,#4ade80)", border: "none", borderRadius: 12, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        📋 View Today's Transactions
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: t.font }}>
      <Header />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
        <Spinner /><p style={{ color: t.textMuted, fontSize: 14 }}>Fetching live data from database…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: t.font }}>
      <div style={{ background: t.cardBg, borderBottom: `1px solid ${t.border}`, padding: "16px 32px" }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "7px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 40 }}>⚠️</span>
        <p style={{ color: t.dangerColor, fontSize: 14, fontWeight: 600 }}>{error}</p>
        <p style={{ color: t.textMuted, fontSize: 13 }}>Make sure the API server is running on port 4000</p>
      </div>
    </div>
  );

  const sd = summary?.today || {};
  const yd = summary?.yesterday || {};
  const totalPay = payments.reduce((s, p) => s + Number(p.amount), 0);

  // ── Summary card definitions — NO gradient on value text ──
  const summaryCards = [
    { icon: "💰", label: "Total Revenue Today",    value: fmt(sd.total_revenue),  iconBg: "linear-gradient(135deg,#22C55E,#4ade80)", valueColor: "#22C55E", ...trend(sd.total_revenue,  yd.total_revenue) },
    { icon: "📈", label: "Total Profit (Est.)",     value: fmt(sd.total_profit),   iconBg: "linear-gradient(135deg,#3b82f6,#60a5fa)", valueColor: "#3b82f6", ...trend(sd.total_profit,   yd.total_profit) },
    { icon: "🧾", label: "Total Transactions",      value: fmtN(sd.transactions),  iconBg: "linear-gradient(135deg,#8b5cf6,#a78bfa)", valueColor: "#8b5cf6", ...trend(sd.transactions,   yd.transactions) },
    { icon: "⚖️", label: "Avg Sale / Transaction",  value: fmt(sd.avg_sale),       iconBg: "linear-gradient(135deg,#f59e0b,#fbbf24)", valueColor: "#f59e0b", up: true, pct: 4.2 },
    { icon: "🏷️", label: "Total Discounts Given",   value: fmt(0),                 iconBg: "linear-gradient(135deg,#06b6d4,#22d3ee)", valueColor: "#06b6d4", up: true, pct: 0 },
    { icon: "↩️", label: "Refunds / Returns",       value: fmt(sd.refunds),        iconBg: "linear-gradient(135deg,#ef4444,#f87171)", valueColor: "#ef4444", up: false, pct: 0 },
  ];

  const SC = {
    card: { background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 20, padding: "22px 24px", marginBottom: 22 },
    sTitle: { fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 },
    th: { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8, background: t.surface3 },
    td: (extra) => ({ padding: "11px 14px", fontSize: 13, color: t.text, borderTop: `1px solid ${t.border}`, ...extra }),
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font }}>
      <Header />

      <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── 1. Summary Cards ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
          {summaryCards.map((c, i) => (
            <div key={i}
              style={{ background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 20, padding: "20px 22px", position: "relative", overflow: "hidden", transition: "transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              {/* subtle bg glow — decorative only, never on text */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: c.iconBg, opacity: 0.08, borderRadius: "50%", filter: "blur(28px)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  {/* Icon box with gradient background — text inside is white, not gradient */}
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
                  {/* Trend badge — solid colored background, white or colored text */}
                  <span style={{ fontSize: 11, fontWeight: 700, background: c.up ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: c.up ? "#10b981" : "#ef4444", border: `1px solid ${c.up ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 20, padding: "2px 10px", whiteSpace: "nowrap" }}>
                    {c.up ? "↑" : "↓"} {c.pct}% vs yesterday
                  </span>
                </div>
                {/* Label — plain color, no gradient */}
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                {/* Value — plain solid color, NO background, NO WebkitBackgroundClip */}
                <div style={{ fontSize: 26, fontWeight: 800, color: c.valueColor, fontFamily: "monospace", lineHeight: 1 }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 2. Payment Method Breakdown ─────────────────── */}
        <div style={SC.card}>
          <div style={SC.sTitle}>💳 Payment Method Breakdown</div>
          {payments.length === 0 ? <EmptyChart /> : (
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 32, alignItems: "center" }}>
              <DonutChart data={payments.map(p => ({ revenue: p.amount, color: p.color }))} size={160} />
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Method", "Transactions", "Amount", "Share", ""].map(h => <th key={h} style={SC.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i}>
                      <td style={SC.td()}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} /><span style={{ fontWeight: 600 }}>{p.method}</span></div></td>
                      <td style={SC.td()}>{p.transaction_count}</td>
                      <td style={SC.td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(p.amount)}</td>
                      <td style={SC.td()}>
                        <span style={{ fontSize: 12, background: p.color + "20", color: p.color, border: `1px solid ${p.color}40`, borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                          {totalPay > 0 ? ((p.amount / totalPay) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td style={SC.td()}>
                        <div style={{ height: 5, width: 100, background: "#334155", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: totalPay > 0 ? `${(p.amount / totalPay) * 100}%` : "0%", background: p.color, borderRadius: 3 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 3 & 4. Staff + Categories ────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
          <div style={{ ...SC.card, marginBottom: 0 }}>
            <div style={SC.sTitle}>👥 Sales by Staff Today</div>
            {staff.length === 0 ? <EmptyChart /> : (
              <>
                <HorizBars data={staff.map(s => ({ label: s.staff_name, revenue: s.total_sales }))} />
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
                  <thead><tr>{["Name", "Transactions", "Total Sales"].map(h => <th key={h} style={SC.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {staff.map((s, i) => (
                      <tr key={i} onMouseEnter={e => e.currentTarget.style.background = t.surface3} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={SC.td({ fontWeight: 600 })}>{s.staff_name}</td>
                        <td style={SC.td()}>{s.transactions}</td>
                        <td style={SC.td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(s.total_sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div style={{ ...SC.card, marginBottom: 0 }}>
            <div style={SC.sTitle}>📦 Sales by Category Today</div>
            {categories.length === 0 ? <EmptyChart /> : (
              <>
                <HorizBars data={categories.map(c => ({ label: c.category, revenue: c.revenue, qty_sold: c.qty_sold }))} />
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18 }}>
                  <thead><tr>{["Category", "Qty Sold", "Revenue"].map(h => <th key={h} style={SC.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {categories.map((c, i) => (
                      <tr key={i} onMouseEnter={e => e.currentTarget.style.background = t.surface3} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={SC.td({ fontWeight: 600 })}>{c.category}</td>
                        <td style={SC.td()}>{c.qty_sold}</td>
                        <td style={SC.td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* ── 5. Top 10 Drugs ─────────────────────────────── */}
        <div style={SC.card}>
          <div style={SC.sTitle}>💊 Top 10 Selling Drugs Today</div>
          {topDrugs.length === 0 ? <EmptyChart /> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["#", "Drug Name", "Qty Sold", "Revenue", "Remaining Stock", "Status"].map(h => <th key={h} style={SC.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {topDrugs.map((d, i) => (
                    <tr key={i} onMouseEnter={e => e.currentTarget.style.background = t.surface3} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={SC.td()}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(34,197,94,0.15)", color: "#22C55E", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                      </td>
                      <td style={SC.td({ fontWeight: 600 })}>{d.name}</td>
                      <td style={SC.td()}>{d.qty_sold}</td>
                      <td style={SC.td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(d.revenue)}</td>
                      <td style={SC.td({ fontFamily: "monospace" })}>{d.remaining_stock}</td>
                      <td style={SC.td()}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", background: d.remaining_stock < d.reorder_level ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", color: d.remaining_stock < d.reorder_level ? "#ef4444" : "#10b981", border: `1px solid ${d.remaining_stock < d.reorder_level ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}` }}>
                          {d.remaining_stock < d.reorder_level ? "LOW STOCK" : "OK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 6. Returns & Voids ──────────────────────────── */}
        <div style={{ ...SC.card, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", marginBottom: 22 }}>
          <div style={SC.sTitle}>⚠️ Returns & Voids</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              { icon: "↩️", label: "Returned Items",       value: returns?.returned_items || 0, color: "#f59e0b" },
              { icon: "💸", label: "Refund Amount",         value: fmt(returns?.refund_amount || 0), color: "#ef4444" },
              { icon: "🚫", label: "Voided Transactions",   value: returns?.voided_txns || 0,    color: "#ef4444" },
            ].map((r, i) => (
              <div key={i} style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: r.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{r.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{r.label}</div>
                  {/* Plain solid color — no gradient background on value */}
                  <div style={{ fontSize: 22, fontWeight: 800, color: r.color, fontFamily: "monospace" }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 7. Hourly Trend ─────────────────────────────── */}
        <div style={SC.card}>
          <div style={SC.sTitle}>📉 Hourly Revenue Trend</div>
          <LineChart data={hourly} color="#22C55E" height={140} />
        </div>

        {/* ── 8 & 9. RX/OTC + Inventory ───────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
          <div style={{ ...SC.card, marginBottom: 0 }}>
            <div style={SC.sTitle}>💊 Prescription vs OTC</div>
            {rxOtc.length === 0 ? <EmptyChart /> : (
              <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <DonutChart data={rxOtc} size={150} />
                <div style={{ flex: 1 }}>
                  {rxOtc.map((d, i) => {
                    const total = rxOtc.reduce((s, x) => s + Number(x.revenue), 0);
                    const pct = total > 0 ? ((Number(d.revenue) / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.type}</span>
                          </div>
                          <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: d.color }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: "#334155", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: d.color, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontFamily: "monospace" }}>{fmt(d.revenue)} · {d.qty} units</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...SC.card, marginBottom: 0 }}>
            <div style={SC.sTitle}>📦 Inventory Impact Today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "📦", label: "Total Items Sold",    value: fmtN(inventory?.items_sold),      color: "#22C55E" },
                { icon: "💵", label: "Stock Value Sold",    value: fmt(inventory?.stock_value_sold),  color: "#3b82f6" },
                { icon: "⚠️", label: "Drugs at Low Stock",  value: `${inventory?.low_stock_count || 0} drugs`, color: "#f59e0b" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: item.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{item.label}</div>
                    {/* Plain solid color on value */}
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 10. Transactions Modal ───────────────────────── */}
      {showTxn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", border: t.cardBorder, borderRadius: 22, padding: 28, width: "min(920px,100%)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22C55E" }}>Today's Transactions</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{transactions.length} records · live from database</div>
              </div>
              <button onClick={() => setShowTxn(false)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "7px 16px", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
            </div>

            <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>FILTER:</span>
              {[
                { label: "Payment", key: "method", opts: ["All", "Cash", "MoMo", "POS"] },
                { label: "Staff", key: "staff_id", opts: [{ v: "All", l: "All Staff" }, ...staff.map(s => ({ v: s.staff_id, l: s.staff_name }))] },
              ].map(f => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.label}:</span>
                  <select value={txFilter[f.key]} onChange={e => setTxFilter(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                    {f.opts.map(o => typeof o === "string"
                      ? <option key={o} value={o}>{o}</option>
                      : <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              {txLoading && <span style={{ fontSize: 12, color: t.textMuted }}>Loading…</span>}
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {txLoading ? <Spinner /> : transactions.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: t.textMuted, fontSize: 14 }}>No transactions found for today</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                      {["Invoice", "Time", "Staff", "Method", "Items", "Total", "Status"].map(h => (
                        <th key={h} style={{ ...SC.th, position: "sticky", top: 0 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => {
                      const mc = methodColor[tx.payment_method] || "#64748b";
                      const sc = tx.status === "complete" ? "#10b981" : tx.status === "refunded" ? "#f59e0b" : "#ef4444";
                      return (
                        <tr key={i} onMouseEnter={e => e.currentTarget.style.background = t.surface3} onMouseLeave={e => e.currentTarget.style.background = "transparent"} style={{ transition: "background 0.1s" }}>
                          <td style={SC.td({ color: "#22C55E", fontFamily: "monospace", fontWeight: 700 })}>{tx.invoice}</td>
                          <td style={SC.td({ color: t.textMuted, fontFamily: "monospace", fontSize: 12 })}>{new Date(tx.created_at).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={SC.td({ fontWeight: 600 })}>{tx.staff_name || "—"}</td>
                          <td style={SC.td()}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", background: mc + "18", color: mc, border: `1px solid ${mc}30` }}>{tx.payment_method}</span>
                          </td>
                          <td style={SC.td()}>{tx.item_count}</td>
                          <td style={SC.td({ fontFamily: "monospace", fontWeight: 700, color: "#22C55E" })}>{fmt(tx.total)}</td>
                          <td style={SC.td()}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", background: sc + "18", color: sc, border: `1px solid ${sc}30` }}>{tx.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

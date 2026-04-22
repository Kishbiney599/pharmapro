import { useState, useEffect } from "react";
import { api } from "./api";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 14 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${t.border}`, borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13, color: t.textMuted }}>Loading from database…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const URGENCY = {
  //         label         text       icon        bg         border
  expired:  { label: "EXPIRED",   color: "#F87171", iconColor: "#EF4444", bg: "#3B0D0D", border: "rgba(248,113,113,0.3)",  icon: "💀" },
  critical: { label: "CRITICAL",  color: "#FBBF24", iconColor: "#F59E0B", bg: "#3B1F0D", border: "rgba(251,191,36,0.3)",   icon: "🚨" },
  warning:  { label: "WARNING",   color: "#FACC15", iconColor: "#EAB308", bg: "#1E293B", border: "rgba(250,204,21,0.3)",   icon: "⚠️" },
  soon:     { label: "EXPIRING",  color: "#34D399", iconColor: "#10B981", bg: "#0F2A1F", border: "rgba(52,211,153,0.3)",   icon: "⏰" },
  ok:       { label: "OK",        color: "#22C55E", iconColor: "#16a34a", bg: "#0F2A1F", border: "rgba(34,197,94,0.3)",    icon: "✅" },
};

export default function ExpiringItems({ t, onBack }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | expired | critical | warning | soon
  const [sortKey, setSortKey] = useState("days_until_expiry");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    Promise.all([api.getExpiryFull(), api.getSettings()])
      .then(([d, s]) => { setData(d); setSettings(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const allBatches = data?.batches || [];

  const filtered = allBatches
    .filter(b => {
      const matchSearch =
        b.drug_name.toLowerCase().includes(search.toLowerCase()) ||
        (b.batch_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (b.category || "").toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all"
        ? b.urgency !== "ok"
        : b.urgency === filter;
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });

  // ── PDF Generation ─────────────────────────────────────────
  const handlePrint = () => {
    const printedBy = JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin";
    const now = new Date().toLocaleString("en-GH");
    const s = data?.summary || {};

    const tableRows = filtered.map((b, i) => {
      const u = URGENCY[b.urgency] || URGENCY.ok;
      const days = Number(b.days_until_expiry);
      const daysDisplay = days < 0 ? `${Math.abs(days)} days ago` : days === 0 ? "Today" : `${days} days`;
      return `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
          <td style="text-align:center">${i + 1}</td>
          <td><strong>${b.drug_name}</strong><br/><span style="color:#64748b;font-size:10px">${b.barcode || "—"} · ${b.unit || ""}</span></td>
          <td>${b.category || "—"}</td>
          <td style="font-family:monospace;font-weight:600">${b.batch_number || "—"}</td>
          <td style="text-align:center;font-family:monospace;font-weight:700;font-size:14px;color:${u.color}">${b.quantity}</td>
          <td style="font-family:monospace;text-align:center;color:${days < 0 ? "#F87171" : days <= 30 ? "#FBBF24" : days <= 60 ? "#FACC15" : "#34D399"}">${fmtDate(b.expiry_date)}</td>
          <td style="text-align:center;font-family:monospace;font-weight:700;color:${u.color}">${daysDisplay}</td>
          <td>${b.supplier_name || "—"}</td>
          <td style="text-align:center"><span style="background:${u.bg};color:${u.color};border:1px solid ${u.border};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">${u.label}</span></td>
        </tr>`;
    }).join("");

    const summaryCards = [
      { label: "Expired",       value: s.expired,  color: "#F87171", bg: "#3B0D0D", border: "rgba(248,113,113,0.4)" },
      { label: "Critical (≤30d)", value: s.critical, color: "#FBBF24", bg: "#3B1F0D", border: "rgba(251,191,36,0.4)"  },
      { label: "Warning (≤60d)",  value: s.warning,  color: "#FACC15", bg: "#1E293B", border: "rgba(250,204,21,0.4)"  },
      { label: "Expiring (≤90d)", value: s.soon,     color: "#34D399", bg: "#0F2A1F", border: "rgba(52,211,153,0.4)"  },
    ].map(c => `
      <div style="flex:1;background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:12px 16px">
        <div style="font-size:22px;font-weight:800;color:${c.color};font-family:monospace">${c.value}</div>
        <div style="font-size:10px;font-weight:700;color:${c.color};text-transform:uppercase;letter-spacing:1px;margin-top:3px">${c.label}</div>
      </div>`).join("");

    const css = `
      @page { size: A4 landscape; margin: 14mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 3px solid #ef4444; }
      .logo-row { display: flex; align-items: center; gap: 14px; }
      .logo-box { width: 52px; height: 52px; background: linear-gradient(135deg,#ef4444,#f87171); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
      .ph-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 2px; }
      .report-tag { font-size: 12px; color: #64748b; margin: 0; }
      .meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.8; }
      .meta strong { color: #0f172a; }
      .sum-row { display: flex; gap: 12px; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      thead tr { background: linear-gradient(135deg,#ef4444,#f87171); }
      thead th { color: #fff; font-weight: 700; padding: 9px 8px; text-align: left; white-space: nowrap; }
      tbody td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
      tfoot td { background: #1e293b; color: #fff; padding: 10px 8px; font-weight: 700; font-size: 12px; }
      .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      .notice { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 11px; color: #991b1b; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Expiry Report — ${settings.pharmacy_name}</title>
      <style>${css}</style></head><body>

      <div class="header">
        <div class="logo-row">
          <div class="logo-box">⏰</div>
          <div>
            <div class="ph-name">${settings.pharmacy_name}</div>
            <div class="report-tag">Drug Expiry Alert Report · Pharmacy Management System</div>
              <div style="font-size:10px;color:#64748b;margin-top:3px">${[settings.phone && '📞 ' + settings.phone, settings.email && '✉️ ' + settings.email, settings.address && '📍 ' + settings.address + (settings.city ? ', ' + settings.city : '')].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
        <div class="meta">
          <strong>EXPIRY REPORT</strong><br/>
          Generated: ${now}<br/>
          Printed by: ${printedBy}<br/>
          Filter: ${filter === "all" ? "All Alerts" : URGENCY[filter]?.label || filter}<br/>
          Items shown: ${filtered.length}
        </div>
      </div>

      ${s.expired > 0 ? `<div class="notice">⚠️ <strong>${s.expired} expired batch(es)</strong> detected. These must be removed from shelves and disposed of immediately per regulatory requirements.</div>` : ""}

      <div class="sum-row">${summaryCards}</div>

      <table>
        <thead>
          <tr>
            <th style="text-align:center;width:30px">#</th>
            <th>Drug Name</th>
            <th>Category</th>
            <th>Batch Number</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:center">Expiry Date</th>
            <th style="text-align:center">Days Left</th>
            <th>Supplier</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="color:#f0f6ff">TOTAL — ${filtered.length} batch records</td>
            <td style="text-align:center;color:#fbbf24;font-size:14px">${filtered.reduce((s, b) => s + Number(b.quantity), 0)}</td>
            <td colspan="4" style="color:#94a3b8;font-size:11px">Total quantity flagged for attention</td>
          </tr>
        </tfoot>
      </table>

      <div class="footer">
        <span>${settings.pharmacy_name} — Confidential Expiry Report</span>
        <span>Report ID: EXP-${Date.now()}</span>
        <span>${new Date().toLocaleDateString("en-GH")}</span>
      </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  // ── Sort helper ─────────────────────────────────────────────
  const SortIcon = ({ col }) => (
    <span style={{ marginLeft: 4, opacity: sortKey === col ? 1 : 0.3, fontSize: 10 }}>
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
    </span>
  );

  const TH = ({ col, children, center }) => (
    <th onClick={() => handleSort(col)} style={{
      textAlign: center ? "center" : "left", padding: "12px 16px",
      fontSize: 11, fontWeight: 700, color: "#fff",
      background: "linear-gradient(135deg,#ef4444,#f87171)",
      cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
      letterSpacing: 0.7,
    }}>
      {children}<SortIcon col={col} />
    </th>
  );

  const cardStyle = { background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 20 };
  const s = data?.summary || {};

  // ── Days pill colors ────────────────────────────────────────
  const daysColor = (days) => {
    if (days < 0)   return { text: "#F87171", bg: "#3B0D0D", border: "rgba(248,113,113,0.3)" };
    if (days <= 30) return { text: "#FBBF24", bg: "#3B1F0D", border: "rgba(251,191,36,0.3)"  };
    if (days <= 60) return { text: "#FACC15", bg: "#1E293B", border: "rgba(250,204,21,0.3)"  };
    return               { text: "#34D399", bg: "#0F2A1F", border: "rgba(52,211,153,0.3)"  };
  };

  const daysLabel = (days) => {
    if (days < 0)   return `${Math.abs(days)}d ago (EXPIRED)`;
    if (days === 0) return "Expires TODAY";
    return `${days} days left`;
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bgGradient || t.bg }}>

      {/* ── Sticky Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: "1px solid #334155", padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#ef4444" }}>⏰ Drug Expiry Report</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{settings.pharmacy_name} · Live from database</div>
        </div>
        {!loading && data && filtered.length > 0 && (
          <button onClick={handlePrint} style={{ background: "linear-gradient(135deg,#ef4444,#f87171)", border: "none", borderRadius: 12, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(239,68,68,0.35)" }}>
            🖨️ Download PDF Report
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>

        {/* ── Pharmacy Banner ── */}
        <div style={{ ...cardStyle, padding: "20px 26px", marginBottom: 22, display: "flex", alignItems: "center", gap: 18, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.05)" }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(135deg,#ef4444,#f87171)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 4px 16px rgba(239,68,68,0.35)", flexShrink: 0 }}>⏰</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{settings.pharmacy_name}</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>Drug Expiry Monitoring — Batches requiring attention</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Report Date</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        {loading ? <Spinner t={t} /> : error ? (
          <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
            <p style={{ color: t.dangerColor, fontSize: 14 }}>⚠️ {error}</p>
          </div>
        ) : (
          <>
            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
              {[
                { icon: "💀", label: "Expired",          value: s.expired,   ...URGENCY.expired,  filterVal: "expired"  },
                { icon: "🚨", label: "Critical (≤30d)",  value: s.critical,  ...URGENCY.critical, filterVal: "critical" },
                { icon: "⚠️", label: "Warning (≤60d)",   value: s.warning,   ...URGENCY.warning,  filterVal: "warning"  },
                { icon: "⏰", label: "Expiring (≤90d)",  value: s.soon,      ...URGENCY.soon,     filterVal: "soon"     },
              ].map((c, i) => {
                const isActive = filter === c.filterVal;
                return (
                <div key={i}
                  onClick={() => setFilter(c.filterVal)}
                  style={{
                    background: c.bg,
                    border: isActive ? `2px solid ${c.color}` : `1px solid ${c.border}`,
                    borderRadius: 18, padding: "20px 22px",
                    cursor: "pointer", transition: "all 0.2s",
                    position: "relative", overflow: "hidden",
                    boxShadow: isActive ? `0 0 20px ${c.border}` : "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                  {/* decorative glow blob */}
                  <div style={{ position: "absolute", top: -24, right: -24, width: 90, height: 90, background: c.iconColor, opacity: 0.15, borderRadius: "50%", filter: "blur(22px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    {/* icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconColor + "22", border: `1px solid ${c.iconColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{c.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, opacity: 0.85 }}>{c.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: c.color, fontFamily: "monospace", lineHeight: 1 }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: c.color, marginTop: 8, opacity: 0.6 }}>Click to filter</div>
                  </div>
                </div>
              );})}
            </div>

            {/* Expired warning banner */}
            {s.expired > 0 && (
              <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🚫</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F87171" }}>Action Required: {s.expired} Expired Batch{s.expired > 1 ? "es" : ""}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Expired drugs must be removed from shelves and quarantined immediately. Generate the PDF report and follow disposal procedures.</div>
                </div>
              </div>
            )}

            {/* ── Filter + Search Bar ── */}
            <div style={{ ...cardStyle, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, color: t.textMuted }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by drug name, batch number or category…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit", minWidth: 200 }} />
              {search && <button onClick={() => setSearch("")} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "3px 10px", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Clear</button>}
              <div style={{ borderLeft: `1px solid ${t.border}`, paddingLeft: 12, display: "flex", gap: 6 }}>
                {[
                  { v: "all",      l: "All",       activeColor: "#22C55E", activeBg: "#0F2A1F" },
                  { v: "expired",  l: "Expired",   activeColor: "#F87171", activeBg: "#3B0D0D" },
                  { v: "critical", l: "Critical",  activeColor: "#FBBF24", activeBg: "#3B1F0D" },
                  { v: "warning",  l: "Warning",   activeColor: "#FACC15", activeBg: "#1E293B" },
                  { v: "soon",     l: "Expiring",  activeColor: "#34D399", activeBg: "#0F2A1F" },
                ].map((btn) => (
                  <button key={btn.v} onClick={() => setFilter(btn.v)} style={{
                    background: filter === btn.v ? btn.activeBg : t.surface3,
                    border: `1.5px solid ${filter === btn.v ? btn.activeColor : t.border}`,
                    borderRadius: 20, padding: "5px 14px",
                    color: filter === btn.v ? btn.activeColor : t.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}>
                    {btn.l}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 12, color: t.textMuted, paddingLeft: 8, borderLeft: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{filtered.length} records</span>
            </div>

            {/* ── Main Table ── */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Expiry Details</span>
                  <span style={{ marginLeft: 10, fontSize: 12, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                    {filtered.length} batches
                  </span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Click column headers to sort</div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.4 }}>✅</div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: t.textMuted }}>
                    {allBatches.filter(b => b.urgency !== "ok").length === 0 ? "All drugs are within safe expiry dates!" : "No items match your filter or search"}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <TH col="#">#</TH>
                        <TH col="drug_name">Drug Name</TH>
                        <TH col="category">Category</TH>
                        <TH col="batch_number">Batch Number</TH>
                        <TH col="quantity" center>Quantity</TH>
                        <TH col="expiry_date" center>Expiry Date</TH>
                        <TH col="days_until_expiry" center>Days Left</TH>
                        <TH col="received_date" center>Received Date</TH>
                        <TH col="supplier_name">Supplier</TH>
                        <TH col="urgency" center>Status</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b, i) => {
                        const u = URGENCY[b.urgency] || URGENCY.ok;
                        const days = Number(b.days_until_expiry);
                        const dc = daysColor(days);
                        const isExpired = days < 0;

                        return (
                          <tr key={`${b.drug_id}-${b.batch_id}`}
                            style={{ background: isExpired ? "#3B0D0D" : i % 2 === 0 ? "transparent" : t.surface2 + "20", transition: "background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                            onMouseLeave={e => e.currentTarget.style.background = isExpired ? "#3B0D0D" : i % 2 === 0 ? "transparent" : t.surface2 + "20"}>

                            {/* # */}
                            <td style={{ padding: "13px 16px", fontSize: 12, color: t.textMuted }}>{i + 1}</td>

                            {/* Drug Name */}
                            <td style={{ padding: "13px 16px" }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{b.drug_name}</div>
                              <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", marginTop: 2 }}>
                                {b.barcode || "No barcode"} · {b.unit}
                              </div>
                            </td>

                            {/* Category */}
                            <td style={{ padding: "13px 16px" }}>
                              <span style={{ fontSize: 12, background: t.accent + "15", color: t.accent, border: `1px solid ${t.accent}25`, borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
                                {b.category || "—"}
                              </span>
                            </td>

                            {/* Batch Number */}
                            <td style={{ padding: "13px 16px" }}>
                              <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: t.text, background: t.surface3, borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                                {b.batch_number || "N/A"}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td style={{ padding: "13px 16px", textAlign: "center" }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: u.color, fontFamily: "monospace", lineHeight: 1 }}>{b.quantity}</div>
                              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{b.unit}</div>
                            </td>

                            {/* Expiry Date */}
                            <td style={{ padding: "13px 16px", textAlign: "center" }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: days <= 0 ? "#F87171" : days <= 30 ? "#FBBF24" : days <= 60 ? "#FACC15" : "#34D399", fontFamily: "monospace" }}>
                                {fmtDate(b.expiry_date)}
                              </div>
                            </td>

                            {/* Days Left — visual pill */}
                            <td style={{ padding: "13px 16px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: isExpired ? 14 : 22, fontWeight: 800, color: dc.text, fontFamily: "monospace", lineHeight: 1 }}>
                                  {isExpired ? "EXPIRED" : days === 0 ? "TODAY" : days}
                                </span>
                                {!isExpired && days !== 0 && (
                                  <span style={{ fontSize: 10, color: t.textMuted }}>days left</span>
                                )}
                                {/* Mini countdown bar */}
                                {!isExpired && (
                                  <div style={{ height: 4, width: 60, background: t.border, borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                                    <div style={{ height: "100%", width: `${Math.max(5, Math.min(100, (days / 90) * 100))}%`, background: u.iconColor || dc.text, borderRadius: 2 }} />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Received Date */}
                            <td style={{ padding: "13px 16px", textAlign: "center", fontSize: 12, color: t.textMuted, fontFamily: "monospace" }}>
                              {fmtDate(b.received_date)}
                            </td>

                            {/* Supplier */}
                            <td style={{ padding: "13px 16px", fontSize: 13, color: t.textSub }}>{b.supplier_name || "—"}</td>

                            {/* Status Badge */}
                            <td style={{ padding: "13px 16px", textAlign: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, background: u.bg, color: u.color, border: `1px solid ${u.border}`, borderRadius: 20, padding: "5px 13px", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", letterSpacing: 0.5 }}>
                                <span style={{ color: u.iconColor, fontSize: 13 }}>{u.icon}</span>{u.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Footer totals */}
                    <tfoot>
                      <tr style={{ background: t.surface3, borderTop: `2px solid ${t.border}` }}>
                        <td colSpan={4} style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: t.text }}>
                          TOTAL — {filtered.length} batch records shown
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 15, fontWeight: 800, color: "#ef4444", fontFamily: "monospace" }}>
                          {filtered.reduce((s, b) => s + Number(b.quantity), 0)}
                        </td>
                        <td colSpan={5} style={{ padding: "12px 16px", fontSize: 12, color: t.textMuted }}>
                          Total units affected ·{" "}
                          {s.expired > 0 && <span style={{ color: "#F87171", fontWeight: 700 }}>{s.expired} expired · </span>}
                          {s.critical > 0 && <span style={{ color: "#FBBF24", fontWeight: 700 }}>{s.critical} critical · </span>}
                          {s.warning > 0 && <span style={{ color: "#FACC15", fontWeight: 700 }}>{s.warning} warning · </span>}
                          {s.soon > 0 && <span style={{ color: "#34D399", fontWeight: 700 }}>{s.soon} expiring soon</span>}
                        </td>
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

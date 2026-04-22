import { useState, useEffect } from "react";
import { api } from "./api";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 14 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${t.border}`, borderTopColor: "#EF4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13, color: t.textMuted }}>Loading critical alerts…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function CriticalAlerts({ t, onBack }) {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("days_until_expiry");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    Promise.all([api.getExpiryFull(), api.getSettings()])
      .then(([data, s]) => {
        // Only expired + critical (≤30 days)
        const critical = data.batches.filter(
          b => b.urgency === "expired" || b.urgency === "critical"
        );
        setItems(critical);
        setSettings(s);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = items
    .filter(d =>
      d.drug_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.batch_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.category || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const expired = items.filter(i => i.urgency === "expired");
  const critical = items.filter(i => i.urgency === "critical");

  // ── PDF ─────────────────────────────────────────────────────
  const handlePrint = () => {
    const printedBy = JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin";
    const now = new Date().toLocaleString("en-GH");

    const rows = filtered.map((b, i) => {
      const days = Number(b.days_until_expiry);
      const isExp = days < 0;
      const rowBg = isExp ? "#3B0D0D" : i % 2 === 0 ? "#fff" : "#fff7f7";
      const textColor = isExp ? "#F87171" : "#FBBF24";
      const daysText = days < 0 ? `EXPIRED ${Math.abs(days)}d ago` : days === 0 ? "EXPIRES TODAY" : `${days} days left`;
      return `
        <tr style="background:${rowBg}">
          <td style="text-align:center">${i + 1}</td>
          <td><strong style="color:${isExp ? "#DC2626" : "#0f172a"}">${b.drug_name}</strong><br/>
              <span style="color:#64748b;font-size:10px">${b.barcode || "—"} · ${b.unit || ""}</span></td>
          <td>${b.category || "—"}</td>
          <td style="font-family:monospace;font-weight:700">${b.batch_number || "—"}</td>
          <td style="text-align:center;font-family:monospace;font-weight:800;color:${textColor};font-size:14px">${b.quantity}</td>
          <td style="text-align:center;font-family:monospace;color:${isExp ? "#DC2626" : "#b45309"}">${fmtDate(b.expiry_date)}</td>
          <td style="text-align:center;font-weight:800;color:${textColor}">${daysText}</td>
          <td>${b.supplier_name || "—"}</td>
        </tr>`;
    }).join("");

    const css = `
      @page { size: A4 landscape; margin: 14mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background:#fff; color:#0f172a; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; margin-bottom:18px; border-bottom:3px solid #EF4444; }
      .logo-row { display:flex; align-items:center; gap:14px; }
      .logo-box { width:52px; height:52px; background:linear-gradient(135deg,#EF4444,#f87171); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:28px; }
      .ph-name { font-size:22px; font-weight:800; margin:0 0 2px; }
      .report-tag { font-size:12px; color:#64748b; margin:0; }
      .meta { text-align:right; font-size:11px; color:#64748b; line-height:1.8; }
      .meta strong { color:#0f172a; }
      .notice { background:#3B0D0D; border:1px solid rgba(248,113,113,0.4); border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:12px; color:#F87171; font-weight:600; }
      .sum-row { display:flex; gap:12px; margin-bottom:18px; }
      .sum-card { flex:1; border-radius:10px; padding:12px 16px; }
      .sum-val { font-size:24px; font-weight:800; font-family:monospace; }
      .sum-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-top:3px; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      thead tr { background:linear-gradient(135deg,#EF4444,#f87171); }
      thead th { color:#fff; font-weight:700; padding:9px 8px; text-align:left; white-space:nowrap; }
      tbody td { padding:8px 8px; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
      tfoot td { background:#1e293b; color:#fff; padding:10px 8px; font-weight:700; }
      .footer { margin-top:16px; display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Critical Alerts — ${settings.pharmacy_name}</title>
      <style>${css}</style></head><body>
      <div class="header">
        <div class="logo-row">
          <div class="logo-box">🚨</div>
          <div>
            <div class="ph-name">${settings.pharmacy_name}</div>
            <div class="report-tag">Critical Drug Alerts Report · Pharmacy Management System</div>
              <div style="font-size:10px;color:#64748b;margin-top:3px">${[settings.phone && '📞 ' + settings.phone, settings.email && '✉️ ' + settings.email, settings.address && '📍 ' + settings.address + (settings.city ? ', ' + settings.city : '')].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
        <div class="meta">
          <strong>CRITICAL ALERTS REPORT</strong><br/>
          Generated: ${now}<br/>
          Printed by: ${printedBy}<br/>
          Items flagged: ${filtered.length}
        </div>
      </div>
      <div class="notice">⚠️ URGENT: ${expired.length} expired and ${critical.length} critical batch(es) require immediate attention. Remove expired drugs from shelves now.</div>
      <div class="sum-row">
        <div class="sum-card" style="background:#3B0D0D;border:1px solid rgba(248,113,113,0.3)">
          <div class="sum-val" style="color:#F87171">${expired.length}</div>
          <div class="sum-label" style="color:#F87171">Expired</div>
        </div>
        <div class="sum-card" style="background:#3B1F0D;border:1px solid rgba(251,191,36,0.3)">
          <div class="sum-val" style="color:#FBBF24">${critical.length}</div>
          <div class="sum-label" style="color:#FBBF24">Critical (≤30 days)</div>
        </div>
        <div class="sum-card" style="background:#1E293B;border:1px solid rgba(239,68,68,0.2)">
          <div class="sum-val" style="color:#EF4444">${items.length}</div>
          <div class="sum-label" style="color:#EF4444">Total Flagged</div>
        </div>
        <div class="sum-card" style="background:#1E293B;border:1px solid rgba(239,68,68,0.2)">
          <div class="sum-val" style="color:#EF4444">${filtered.reduce((s,b)=>s+Number(b.quantity),0)}</div>
          <div class="sum-label" style="color:#EF4444">Total Units Affected</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:center">#</th>
          <th>Drug Name</th><th>Category</th><th>Batch Number</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:center">Expiry Date</th>
          <th style="text-align:center">Status</th>
          <th>Supplier</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="4">TOTAL — ${filtered.length} records</td>
          <td style="text-align:center;color:#fbbf24">${filtered.reduce((s,b)=>s+Number(b.quantity),0)}</td>
          <td colspan="3" style="color:#94a3b8">Units requiring immediate action</td>
        </tr></tfoot>
      </table>
      <div class="footer">
        <span>${settings.pharmacy_name} — Confidential Critical Alerts Report</span>
        <span>Report ID: CAR-${Date.now()}</span>
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
      background: "linear-gradient(135deg,#EF4444,#f87171)",
      cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", letterSpacing: 0.7,
    }}>
      {children}<SortIcon col={col} />
    </th>
  );

  const cardStyle = {
    background: t.cardBg,
    border: t.cardBorder,
    borderRadius: 20,
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bg }}>

      {/* ── Sticky Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#EF4444" }}>🚨 Critical Alerts</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{settings.pharmacy_name} · Expired & expiring within 30 days</div>
        </div>
        {!loading && items.length > 0 && (
          <button onClick={handlePrint} style={{ background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 12, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(239,68,68,0.35)" }}>
            🖨️ Download PDF Report
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>

        {/* ── Pharmacy Banner ── */}
        <div style={{ ...cardStyle, padding: "20px 26px", marginBottom: 22, display: "flex", alignItems: "center", gap: 18, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(135deg,#EF4444,#f87171)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 4px 16px rgba(239,68,68,0.35)", flexShrink: 0 }}>🚨</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{settings.pharmacy_name}</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>Critical Drug Alert — Items expired or expiring within 30 days</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Report Date</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        {loading ? <Spinner t={t} /> : error ? (
          <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
            <p style={{ color: "#EF4444", fontSize: 14 }}>⚠️ {error}</p>
          </div>
        ) : items.length === 0 ? (
          /* ── No critical alerts ── */
          <div style={{ ...cardStyle, padding: "80px 40px", textAlign: "center", border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.04)" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#22C55E", marginBottom: 8 }}>All Clear!</div>
            <div style={{ fontSize: 15, color: t.textMuted }}>No expired or critically expiring drugs found in the system.</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>All batches are within safe expiry dates.</div>
          </div>
        ) : (
          <>
            {/* ── Summary Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16, marginBottom: 22 }}>
              {[
                { icon: "💀", label: "Expired Batches",   value: expired.length,  color: "#F87171", iconColor: "#EF4444", bg: "#3B0D0D", border: "rgba(248,113,113,0.3)" },
                { icon: "🚨", label: "Critical (≤30d)",   value: critical.length, color: "#FBBF24", iconColor: "#F59E0B", bg: "#3B1F0D", border: "rgba(251,191,36,0.3)" },
                { icon: "📦", label: "Total Units At Risk", value: items.reduce((s,i)=>s+Number(i.quantity),0), color: "#EF4444", iconColor: "#DC2626", bg: "#3B0D0D", border: "rgba(239,68,68,0.3)" },
                { icon: "💊", label: "Drugs Affected",     value: new Set(items.map(i=>i.drug_id)).size, color: "#FBBF24", iconColor: "#F59E0B", bg: "#3B1F0D", border: "rgba(251,191,36,0.3)" },
              ].map((c, i) => (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 18, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: c.iconColor, opacity: 0.12, borderRadius: "50%", filter: "blur(20px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: c.iconColor + "25", border: `1px solid ${c.iconColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{c.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, opacity: 0.85 }}>{c.label}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: c.color, fontFamily: "monospace", lineHeight: 1 }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Urgent Action Banner ── */}
            {expired.length > 0 && (
              <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚫</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#F87171" }}>Urgent Action Required — {expired.length} Expired Batch{expired.length > 1 ? "es" : ""}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>These drugs must be removed from shelves immediately and quarantined. Do not dispense expired medications.</div>
                </div>
              </div>
            )}

            {/* ── Search ── */}
            <div style={{ ...cardStyle, padding: "11px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, color: t.textMuted }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by drug name, batch number or category…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit" }} />
                {search && <button onClick={() => setSearch("")} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "3px 10px", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Clear</button>}
                <span style={{ fontSize: 12, color: t.textMuted, paddingLeft: 8, borderLeft: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{filtered.length} records</span>
              </div>
            </div>

            {/* ── Main Table ── */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Critical Batch Details</span>
                  <span style={{ marginLeft: 10, fontSize: 12, background: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                    {filtered.length} batches
                  </span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Click column headers to sort</div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TH col="#">#</TH>
                      <TH col="drug_name">Drug Name</TH>
                      <TH col="category">Category</TH>
                      <TH col="batch_number">Batch Number</TH>
                      <TH col="quantity" center>Qty</TH>
                      <TH col="expiry_date" center>Expiry Date</TH>
                      <TH col="days_until_expiry" center>Days Left</TH>
                      <TH col="supplier_name">Supplier</TH>
                      <TH col="urgency" center>Status</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => {
                      const days = Number(b.days_until_expiry);
                      const isExp = days < 0;
                      const rowColor = isExp
                        ? { text: "#F87171", iconColor: "#EF4444", bg: "#3B0D0D", label: "EXPIRED",   badge_bg: "rgba(248,113,113,0.15)", badge_border: "rgba(248,113,113,0.3)" }
                        : { text: "#FBBF24", iconColor: "#F59E0B", bg: "#3B1F0D", label: "CRITICAL",  badge_bg: "rgba(251,191,36,0.15)",  badge_border: "rgba(251,191,36,0.3)"  };

                      return (
                        <tr key={`${b.drug_id}-${b.batch_id}`}
                          style={{ background: isExp ? "#3B0D0D" : i % 2 === 0 ? "transparent" : t.surface2 + "20", transition: "background 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                          onMouseLeave={e => e.currentTarget.style.background = isExp ? "#3B0D0D" : i % 2 === 0 ? "transparent" : t.surface2 + "20"}>

                          <td style={{ padding: "13px 16px", fontSize: 12, color: t.textMuted }}>{i + 1}</td>

                          <td style={{ padding: "13px 16px" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{b.drug_name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", marginTop: 2 }}>{b.barcode || "—"} · {b.unit}</div>
                          </td>

                          <td style={{ padding: "13px 16px" }}>
                            <span style={{ fontSize: 12, background: "#3B82F615", color: "#3B82F6", border: "1px solid #3B82F625", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
                              {b.category || "—"}
                            </span>
                          </td>

                          <td style={{ padding: "13px 16px" }}>
                            <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: t.text, background: t.surface3, borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                              {b.batch_number || "N/A"}
                            </span>
                          </td>

                          <td style={{ padding: "13px 16px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: rowColor.text, fontFamily: "monospace", lineHeight: 1 }}>{b.quantity}</div>
                            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{b.unit}</div>
                          </td>

                          <td style={{ padding: "13px 16px", textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: rowColor.text, fontFamily: "monospace" }}>
                              {fmtDate(b.expiry_date)}
                            </div>
                          </td>

                          <td style={{ padding: "13px 16px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: isExp ? 13 : 20, fontWeight: 800, color: rowColor.text, fontFamily: "monospace", lineHeight: 1 }}>
                                {isExp ? `${Math.abs(days)}d ago` : days === 0 ? "TODAY" : days}
                              </span>
                              {!isExp && days !== 0 && <span style={{ fontSize: 10, color: t.textMuted }}>days left</span>}
                              {/* Countdown bar */}
                              {!isExp && (
                                <div style={{ height: 4, width: 52, background: t.border, borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                                  <div style={{ height: "100%", width: `${Math.max(5, Math.min(100, (days / 30) * 100))}%`, background: rowColor.iconColor, borderRadius: 2 }} />
                                </div>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: "13px 16px", fontSize: 13, color: t.textSub }}>{b.supplier_name || "—"}</td>

                          <td style={{ padding: "13px 16px", textAlign: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: rowColor.badge_bg, color: rowColor.text, border: `1px solid ${rowColor.badge_border}`, borderRadius: 20, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                              {isExp ? "💀" : "🚨"} {rowColor.label}
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
                        TOTAL — {filtered.length} batch records
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 16, fontWeight: 800, color: "#EF4444", fontFamily: "monospace" }}>
                        {filtered.reduce((s, b) => s + Number(b.quantity), 0)}
                      </td>
                      <td colSpan={4} style={{ padding: "12px 16px", fontSize: 12, color: t.textMuted }}>
                        Total units requiring immediate action ·{" "}
                        <span style={{ color: "#F87171", fontWeight: 700 }}>{expired.length} expired</span>{" · "}
                        <span style={{ color: "#FBBF24", fontWeight: 700 }}>{critical.length} critical</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

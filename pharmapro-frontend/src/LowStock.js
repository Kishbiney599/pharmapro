import { useState, useEffect } from "react";
import { api } from "./api";

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 14 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13, color: t.textMuted }}>Loading from database…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function LowStock({ t, onBack }) {
  const [drugs, setDrugs] = useState([]);
  const [settings, setSettings] = useState({ pharmacy_name: "PharmaPro Enterprise" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("total_stock");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    Promise.all([api.getLowStock(), api.getSettings()])
      .then(([d, s]) => { setDrugs(d); setSettings(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = drugs
    .filter(d => d.drug_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.barcode || "").includes(search))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const outOfStock = drugs.filter(d => d.total_stock <= 0).length;
  const critical = drugs.filter(d => d.total_stock > 0 && d.total_stock <= d.reorder_level * 0.5).length;
  const low = drugs.filter(d => d.total_stock > d.reorder_level * 0.5 && d.total_stock <= d.reorder_level).length;

  // ── PDF Generation ─────────────────────────────────────────
  const handlePrint = () => {
    const now = new Date().toLocaleString("en-GH");
    const printedBy = JSON.parse(localStorage.getItem("pharmapro_user") || "{}").name || "Admin";

    const statusLabel = (d) => {
      if (d.total_stock <= 0) return { label: "OUT OF STOCK", bg: "#fee2e2", color: "#991b1b" };
      if (d.total_stock <= d.reorder_level * 0.5) return { label: "CRITICAL", bg: "#fff7ed", color: "#9a3412" };
      return { label: "LOW STOCK", bg: "#fef9c3", color: "#854d0e" };
    };

    const rows = filtered.map((d, i) => {
      const s = statusLabel(d);
      const days = daysUntil(d.nearest_expiry);
      return `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"}">
          <td>${i + 1}</td>
          <td><strong>${d.drug_name}</strong><br/><span style="color:#64748b;font-size:10px">${d.barcode || "—"}</span></td>
          <td>${d.category || "—"}</td>
          <td>${d.batch_details || "—"}</td>
          <td style="text-align:center;font-weight:800;color:${d.total_stock <= 0 ? "#dc2626" : d.total_stock <= d.reorder_level * 0.5 ? "#ea580c" : "#d97706"};font-family:monospace;font-size:14px">${d.total_stock}</td>
          <td style="text-align:center;font-family:monospace">${d.reorder_level}</td>
          <td style="text-align:center;font-family:monospace;color:${days !== null && days <= 30 ? "#dc2626" : "#64748b"}">${fmtDate(d.nearest_expiry)}${days !== null && days <= 90 ? `<br/><span style="font-size:9px;color:${days <= 0 ? '#dc2626' : days <= 30 ? '#dc2626' : '#d97706'}">${days <= 0 ? "EXPIRED" : days + "d left"}</span>` : ""}</td>
          <td>${d.supplier_name || "—"}</td>
          <td style="text-align:center"><span style="background:${s.bg};color:${s.color};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700">${s.label}</span></td>
        </tr>`;
    }).join("");

    const css = `
      @page { size: A4 landscape; margin: 14mm 12mm; }
      * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { background: #fff; color: #0f172a; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 20px; border-bottom: 3px solid #f59e0b; }
      .logo-row { display: flex; align-items: center; gap: 14px; }
      .logo-box { width: 52px; height: 52px; background: linear-gradient(135deg,#f59e0b,#fbbf24); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
      .pharmacy-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 2px; }
      .report-tag { font-size: 12px; color: #64748b; margin: 0; }
      .report-meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.7; }
      .report-meta strong { color: #0f172a; }
      .summary-row { display: flex; gap: 12px; margin-bottom: 18px; }
      .sum-card { flex: 1; border-radius: 10px; padding: 12px 16px; }
      .sum-card .sv { font-size: 22px; font-weight: 800; font-family: monospace; }
      .sum-card .sl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      thead tr { background: #f59e0b; }
      thead th { color: #fff; font-weight: 700; padding: 9px 8px; text-align: left; white-space: nowrap; }
      tbody td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
      .footer { margin-top: 18px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Low Stock Report — ${settings.pharmacy_name}</title>
      <style>${css}</style></head><body>

      <div class="header">
        <div class="logo-row">
          <div class="logo-box">⚠️</div>
          <div>
            <div class="pharmacy-name">${settings.pharmacy_name}</div>
            <div class="report-tag">Low Stock Alert Report · Pharmacy Management System</div>
              <div style="font-size:10px;color:#64748b;margin-top:3px">${[settings.phone && '📞 ' + settings.phone, settings.email && '✉️ ' + settings.email, settings.address && '📍 ' + settings.address + (settings.city ? ', ' + settings.city : '')].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
        <div class="report-meta">
          <strong>LOW STOCK REPORT</strong><br/>
          Generated: ${now}<br/>
          Printed by: ${printedBy}<br/>
          Total items flagged: ${filtered.length}
        </div>
      </div>

      <div class="summary-row">
        <div class="sum-card" style="background:#fef2f2;border:1px solid #fecaca">
          <div class="sv" style="color:#dc2626">${outOfStock}</div>
          <div class="sl" style="color:#dc2626">Out of Stock</div>
        </div>
        <div class="sum-card" style="background:#fff7ed;border:1px solid #fed7aa">
          <div class="sv" style="color:#ea580c">${critical}</div>
          <div class="sl" style="color:#ea580c">Critical (≤50% reorder)</div>
        </div>
        <div class="sum-card" style="background:#fef9c3;border:1px solid #fde047">
          <div class="sv" style="color:#ca8a04">${low}</div>
          <div class="sl" style="color:#ca8a04">Low Stock</div>
        </div>
        <div class="sum-card" style="background:#f0fdf4;border:1px solid #bbf7d0">
          <div class="sv" style="color:#16a34a">${drugs.length}</div>
          <div class="sl" style="color:#16a34a">Total Items Flagged</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Drug Name</th>
            <th>Category</th>
            <th>Batches</th>
            <th style="text-align:center">Stock Qty</th>
            <th style="text-align:center">Reorder Level</th>
            <th style="text-align:center">Nearest Expiry</th>
            <th>Supplier</th>
            <th style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        <span>${settings.pharmacy_name} — Confidential Stock Report</span>
        <span>Report ID: LSR-${Date.now()}</span>
        <span>${new Date().toLocaleDateString("en-GH")}</span>
      </div>
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  // ── Status helpers ─────────────────────────────────────────
  const statusBadge = (d) => {
    if (d.total_stock <= 0) return { label: "OUT OF STOCK", color: t.dangerColor, bg: t.dangerColor + "15" };
    if (d.total_stock <= d.reorder_level * 0.5) return { label: "CRITICAL", color: "#ea580c", bg: "rgba(234,88,12,0.12)" };
    return { label: "LOW STOCK", color: t.warnColor, bg: t.warnColor + "15" };
  };

  const SortIcon = ({ col }) => (
    <span style={{ marginLeft: 4, opacity: sortKey === col ? 1 : 0.3, fontSize: 10 }}>
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
    </span>
  );

  const TH = ({ col, children, center }) => (
    <th onClick={() => handleSort(col)} style={{
      textAlign: center ? "center" : "left", padding: "12px 14px",
      fontSize: 11, fontWeight: 700, color: "#fff",
      background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
      cursor: "pointer", whiteSpace: "nowrap", userSelect: "none",
      letterSpacing: 0.7,
    }}>
      {children}<SortIcon col={col} />
    </th>
  );

  const cardStyle = { background: t.cardBg, backdropFilter: "blur(16px)", border: t.cardBorder, borderRadius: 20 };

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bgGradient || t.bg }}>

      {/* ── Sticky Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "16px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.warnColor }}>⚠️ Low Stock Report</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{settings.pharmacy_name} · Live from database</div>
        </div>
        {!loading && drugs.length > 0 && (
          <button onClick={handlePrint} style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", border: "none", borderRadius: 12, padding: "10px 22px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
            🖨️ Download PDF Report
          </button>
        )}
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>

        {/* ── Pharmacy Name Banner ── */}
        <div style={{ ...cardStyle, padding: "22px 28px", marginBottom: 22, display: "flex", alignItems: "center", gap: 18, border: `1px solid ${t.warnColor}30`, background: t.warnColor + "08" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 4px 16px rgba(245,158,11,0.3)", flexShrink: 0 }}>💊</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{settings.pharmacy_name}</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>Low Stock Alert — Items requiring immediate restocking attention</div>
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
                { icon: "🚫", label: "Out of Stock", value: outOfStock, color: t.dangerColor, bg: t.dangerColor + "12", border: t.dangerColor + "25" },
                { icon: "🔴", label: "Critical (≤50%)", value: critical, color: "#ea580c", bg: "rgba(234,88,12,0.1)", border: "rgba(234,88,12,0.25)" },
                { icon: "⚠️", label: "Low Stock", value: low, color: t.warnColor, bg: t.warnColor + "12", border: t.warnColor + "25" },
                { icon: "📦", label: "Total Items Flagged", value: drugs.length, color: t.accent, bg: t.accent + "12", border: t.accent + "25" },
              ].map((c, i) => (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 18, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: c.color, opacity: 0.1, borderRadius: "50%", filter: "blur(20px)" }} />
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* ── Search Bar ── */}
            <div style={{ ...cardStyle, padding: "12px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, color: t.textMuted }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by drug name, category or barcode…"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit" }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "3px 10px", color: t.textMuted, fontSize: 12, cursor: "pointer" }}>Clear</button>
                )}
                <span style={{ fontSize: 12, color: t.textMuted, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>{filtered.length} items</span>
              </div>
            </div>

            {/* ── Main Table ── */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              {/* Table caption */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Stock Alert Details</span>
                  <span style={{ marginLeft: 10, fontSize: 12, background: t.warnColor + "15", color: t.warnColor, border: `1px solid ${t.warnColor}30`, borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                    {filtered.length} items
                  </span>
                </div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Click column headers to sort</div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
                  <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.4 }}>✅</div>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>
                    {drugs.length === 0 ? "No low stock items — all drugs are well stocked!" : "No items match your search"}
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
                        <TH col="batch_details">Batch Details</TH>
                        <TH col="total_stock" center>Stock Qty</TH>
                        <TH col="reorder_level" center>Reorder Level</TH>
                        <TH col="batch_count" center>Batches</TH>
                        <TH col="nearest_expiry" center>Nearest Expiry</TH>
                        <TH col="supplier_name">Supplier</TH>
                        <TH col="status" center>Status</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d, i) => {
                        const s = statusBadge(d);
                        const days = daysUntil(d.nearest_expiry);
                        const deficit = d.reorder_level - d.total_stock;
                        const pct = Math.max(0, Math.min(100, (d.total_stock / d.reorder_level) * 100));

                        return (
                          <tr key={d.id}
                            style={{ background: i % 2 === 0 ? "transparent" : t.surface2 + "30", transition: "background 0.1s" }}
                            onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "30"}>

                            {/* # */}
                            <td style={{ padding: "13px 14px", fontSize: 12, color: t.textMuted }}>{i + 1}</td>

                            {/* Drug Name */}
                            <td style={{ padding: "13px 14px" }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{d.drug_name}</div>
                              <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", marginTop: 2 }}>{d.barcode || "No barcode"} · {d.unit}</div>
                            </td>

                            {/* Category */}
                            <td style={{ padding: "13px 14px" }}>
                              <span style={{ fontSize: 12, background: t.accent + "15", color: t.accent, border: `1px solid ${t.accent}25`, borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>
                                {d.category || "—"}
                              </span>
                            </td>

                            {/* Batch Details */}
                            <td style={{ padding: "13px 14px", fontSize: 12, color: t.textMuted, maxWidth: 200 }}>
                              {d.batch_details ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {d.batch_details.split(" | ").map((b, bi) => (
                                    <span key={bi} style={{ background: t.surface3, borderRadius: 6, padding: "2px 8px", fontSize: 11, color: t.textSub, fontFamily: "monospace" }}>{b}</span>
                                  ))}
                                </div>
                              ) : <span style={{ color: t.textMuted }}>No batches</span>}
                            </td>

                            {/* Stock Qty with mini bar */}
                            <td style={{ padding: "13px 14px", textAlign: "center" }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "monospace", lineHeight: 1 }}>{d.total_stock}</div>
                              <div style={{ height: 4, background: t.border, borderRadius: 2, marginTop: 6, overflow: "hidden", width: 60, margin: "6px auto 0" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3 }}>Need {deficit} more</div>
                            </td>

                            {/* Reorder Level */}
                            <td style={{ padding: "13px 14px", textAlign: "center", fontSize: 14, fontWeight: 700, color: t.textSub, fontFamily: "monospace" }}>{d.reorder_level}</td>

                            {/* Batches */}
                            <td style={{ padding: "13px 14px", textAlign: "center", fontSize: 13, color: t.textMuted }}>{d.batch_count}</td>

                            {/* Nearest Expiry */}
                            <td style={{ padding: "13px 14px", textAlign: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: days !== null && days <= 30 ? t.dangerColor : days !== null && days <= 90 ? t.warnColor : t.text, fontFamily: "monospace" }}>
                                {fmtDate(d.nearest_expiry)}
                              </div>
                              {days !== null && (
                                <div style={{ fontSize: 10, marginTop: 3, color: days <= 0 ? t.dangerColor : days <= 30 ? t.dangerColor : days <= 90 ? t.warnColor : t.textMuted, fontWeight: 600 }}>
                                  {days <= 0 ? "⚠️ EXPIRED" : `${days}d remaining`}
                                </div>
                              )}
                            </td>

                            {/* Supplier */}
                            <td style={{ padding: "13px 14px", fontSize: 13, color: t.textSub }}>{d.supplier_name || "—"}</td>

                            {/* Status Badge */}
                            <td style={{ padding: "13px 14px", textAlign: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.color}30`, borderRadius: 20, padding: "4px 12px", display: "inline-block", whiteSpace: "nowrap" }}>
                                {s.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Footer totals */}
                    <tfoot>
                      <tr style={{ background: t.surface3, borderTop: `2px solid ${t.border}` }}>
                        <td colSpan={4} style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: t.text }}>
                          SUMMARY — {filtered.length} items shown
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 14, fontWeight: 800, color: t.warnColor, fontFamily: "monospace" }}>
                          {filtered.reduce((s, d) => s + Number(d.total_stock), 0)}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 14, fontWeight: 800, color: t.textSub, fontFamily: "monospace" }}>
                          {filtered.reduce((s, d) => s + Number(d.reorder_level), 0)}
                        </td>
                        <td colSpan={4} style={{ padding: "12px 14px", fontSize: 12, color: t.textMuted }}>
                          Deficit: <strong style={{ color: t.dangerColor }}>
                            {filtered.reduce((s, d) => s + Math.max(0, d.reorder_level - d.total_stock), 0)} units needed
                          </strong>
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

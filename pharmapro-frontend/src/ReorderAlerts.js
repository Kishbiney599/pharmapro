import { useState, useEffect } from "react";
import { api } from "./api";

const fmt = (n) => `GH₵ ${Number(n||0).toFixed(2)}`;

export default function ReorderAlerts({ t, onBack }) {
  const [drugs, setDrugs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api.getSettings().then(setSettings).catch(()=>{});
    api.getReorderAlerts().then(setDrugs).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const outOfStock = drugs.filter(d => Number(d.total_stock) <= 0);
  const critical   = drugs.filter(d => Number(d.total_stock) > 0 && Number(d.total_stock) <= Number(d.reorder_level) * 0.5);
  const low        = drugs.filter(d => Number(d.total_stock) > Number(d.reorder_level) * 0.5);

  const statusOf = (d) => {
    const stock = Number(d.total_stock);
    const lvl   = Number(d.reorder_level);
    if (stock <= 0)           return { label:"OUT OF STOCK", color:"#EF4444", bg:"rgba(239,68,68,0.1)" };
    if (stock <= lvl * 0.5)  return { label:"CRITICAL",     color:"#F59E0B", bg:"rgba(245,158,11,0.1)" };
    return                           { label:"LOW STOCK",    color:"#F97316", bg:"rgba(249,115,22,0.1)" };
  };

  const handlePrint = () => {
    const pharmName = settings.pharmacy_name || "PharmaPro Enterprise";
    const now = new Date().toLocaleString("en-GH");

    const rows = drugs.map((d,i) => {
      const st = statusOf(d);
      return `<tr style="background:${i%2===0?"#fff":"#f8faff"}">
        <td>${i+1}</td>
        <td><strong>${d.name}</strong></td>
        <td>${d.category||"—"}</td>
        <td style="text-align:center;font-family:monospace;font-weight:800;color:${st.color}">${d.total_stock}</td>
        <td style="text-align:center;font-family:monospace">${d.reorder_level}</td>
        <td>${d.supplier_name||"—"}</td>
        <td style="text-align:center">
          <span style="background:${st.bg};color:${st.color};border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700">${st.label}</span>
        </td>
      </tr>`;
    }).join("");

    const css = `@page{size:A4 landscape;margin:13mm 12mm}*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}body{background:#fff;color:#0f172a;font-size:11px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;margin-bottom:16px;border-bottom:3px solid #f59e0b}.logo-box{width:48px;height:48px;background:linear-gradient(135deg,#f59e0b,#fbbf24);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px}.pname{font-size:20px;font-weight:800;margin:0 0 2px}.rtag{font-size:11px;color:#64748b}.rmeta{text-align:right;font-size:10px;color:#64748b;line-height:1.7}.rmeta strong{color:#0f172a}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.kpi{border-radius:10px;padding:11px 14px}.kv{font-size:22px;font-weight:800;font-family:monospace}.kl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#f59e0b}thead th{color:#fff;padding:8px;font-weight:700;text-align:left}tbody td{padding:7px 8px;border-bottom:1px solid #f1f5f9}.footer{margin-top:14px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reorder Alerts</title><style>${css}</style></head><body>
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="logo-box">⚠️</div>
        <div><div class="pname">${pharmName}</div><div class="rtag">Drug Reorder Alert Report · ${new Date().toLocaleDateString("en-GH")}</div></div>
      </div>
      <div class="rmeta"><strong>REORDER ALERT REPORT</strong><br/>Generated: ${now}<br/>Items flagged: ${drugs.length}</div>
    </div>
    <div class="kpis">
      <div class="kpi" style="background:#fef2f2;border:1px solid #fecaca"><div class="kv" style="color:#dc2626">${outOfStock.length}</div><div class="kl" style="color:#dc2626">Out of Stock</div></div>
      <div class="kpi" style="background:#fff7ed;border:1px solid #fed7aa"><div class="kv" style="color:#ea580c">${critical.length}</div><div class="kl" style="color:#ea580c">Critical</div></div>
      <div class="kpi" style="background:#fef9c3;border:1px solid #fde047"><div class="kv" style="color:#ca8a04">${low.length}</div><div class="kl" style="color:#ca8a04">Low Stock</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Drug Name</th><th>Category</th><th style="text-align:center">Current Stock</th><th style="text-align:center">Reorder Level</th><th>Supplier</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer"><span>${pharmName} — Reorder Report</span><span>ROR-${Date.now()}</span><span>${new Date().toLocaleDateString("en-GH")}</span></div>
    </body></html>`;

    const win = window.open("","_blank"); win.document.write(html); win.document.close(); win.focus();
    setTimeout(()=>win.print(), 600);
  };

  const handleExport = () => {
    const token = localStorage.getItem("pharmapro_token");
    const a = document.createElement("a");
    a.href = `http://localhost:4000/api/export/inventory`;
    a.click();
  };

  const cardStyle = { background:t.cardBg, border:t.cardBorder, borderRadius:18 };

  return (
    <div style={{ height:"100%", overflowY:"auto", fontFamily:t.font, background:t.bg }}>
      <div style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}`, padding:"15px 32px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:t.surface3, border:`1px solid ${t.border}`, borderRadius:10, padding:"8px 16px", color:t.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:19, fontWeight:800, color:"#F59E0B" }}>⚠️ Drug Reorder Alerts</div>
          <div style={{ fontSize:12, color:t.textMuted }}>{drugs.length} drugs need reordering</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleExport} style={{ background:"linear-gradient(135deg,#22C55E,#16a34a)", border:"none", borderRadius:11, padding:"10px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📥 Export CSV</button>
          {drugs.length > 0 && <button onClick={handlePrint} style={{ background:"linear-gradient(135deg,#F59E0B,#fbbf24)", border:"none", borderRadius:11, padding:"10px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🖨️ Print PDF</button>}
        </div>
      </div>

      <div style={{ padding:"24px 32px" }}>
        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:14, marginBottom:22 }}>
          {[
            { icon:"🔴", label:"Out of Stock",  value:outOfStock.length, color:"#EF4444", bg:"rgba(239,68,68,0.1)"   },
            { icon:"🟠", label:"Critical (<50% reorder)", value:critical.length, color:"#F59E0B", bg:"rgba(245,158,11,0.1)" },
            { icon:"🟡", label:"Low Stock",     value:low.length,        color:"#F97316", bg:"rgba(249,115,22,0.1)"  },
          ].map((c,i) => (
            <div key={i} style={{ background:c.bg, border:`1px solid ${c.color}25`, borderRadius:14, padding:"16px 18px", display:"flex", alignItems:"center", gap:16 }}>
              <span style={{ fontSize:36 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:c.color, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{c.label}</div>
                <div style={{ fontSize:32, fontWeight:800, color:c.color, fontFamily:"monospace" }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Drugs table */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:t.textMuted }}>
            <div style={{ width:30, height:30, border:`3px solid ${t.border}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : drugs.length === 0 ? (
          <div style={{ ...cardStyle, padding:"60px 20px", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:700, color:t.accent, marginBottom:8 }}>All stocks are adequate!</div>
            <p style={{ color:t.textMuted, fontSize:14 }}>No drugs are below their reorder levels.</p>
          </div>
        ) : (
          <div style={{ ...cardStyle, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:t.surface3 }}>
                  {["Drug Name","Category","Current Stock","Reorder Level","Supplier","Status","Action"].map(h=>(
                    <th key={h} style={{ padding:"11px 16px", fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:0.7, textAlign:"left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drugs.map((d,i) => {
                  const st = statusOf(d);
                  return (
                    <tr key={d.id} style={{ borderTop:`1px solid ${t.border}`, background:i%2===0?"transparent":t.surface2+"20" }}
                      onMouseEnter={e=>e.currentTarget.style.background=t.surface3}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":t.surface2+"20"}>
                      <td style={{ padding:"13px 16px", fontSize:14, fontWeight:600, color:t.text }}>{d.name}</td>
                      <td style={{ padding:"13px 16px", fontSize:12, color:t.textMuted }}>{d.category||"—"}</td>
                      <td style={{ padding:"13px 16px", fontFamily:"monospace", fontWeight:800, fontSize:16, color:st.color }}>
                        {d.total_stock} <span style={{ fontSize:11, color:t.textMuted, fontFamily:"inherit" }}>{d.unit}</span>
                      </td>
                      <td style={{ padding:"13px 16px", fontFamily:"monospace", fontSize:13, color:t.textMuted }}>{d.reorder_level}</td>
                      <td style={{ padding:"13px 16px", fontSize:13, color:t.textSub }}>{d.supplier_name||"—"}</td>
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ fontSize:11, fontWeight:700, background:st.bg, color:st.color, border:`1px solid ${st.color}25`, borderRadius:20, padding:"3px 10px" }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ fontSize:12, color:st.color, fontWeight:600 }}>
                          Need {Math.max(0, Number(d.reorder_level)*2 - Number(d.total_stock))} {d.unit}
                        </span>
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
  );
}

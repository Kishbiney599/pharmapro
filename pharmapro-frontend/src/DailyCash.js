import { useState, useEffect } from "react";
import { Spinner } from "./components";
import { api } from "./api";

const fmt     = (n) => `GH₵ ${Number(n||0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day:"2-digit", month:"short", year:"numeric" }) : "—";

export default function DailyCash({ t, onBack }) {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate]     = useState(today);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    api.getSettings().then(setSettings).catch(()=>{});
    load(today);
  }, []);

  const load = (d) => {
    setLoading(true);
    api.getDailyCash(d).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  };

  const handlePrint = () => {
    if (!data) return;
    const s = data.summary;
    const pharmName = settings.pharmacy_name || "PharmaPro Enterprise";
    const now = new Date().toLocaleString("en-GH");
    const printedBy = JSON.parse(localStorage.getItem("pharmapro_user")||"{}").name || "Admin";

    const payRows = (data.by_payment||[]).map((p,i) => `
      <tr style="background:${i%2===0?"#fff":"#f8faff"}">
        <td>${p.payment_method}</td>
        <td style="text-align:center;font-family:monospace">${p.count}</td>
        <td style="text-align:right;font-family:monospace;color:#16a34a">GH₵${Number(p.revenue||0).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">GH₵${Number(p.refunds||0).toFixed(2)}</td>
      </tr>`).join("");

    const drugRows = (data.top_drugs||[]).map((d,i) => `
      <tr style="background:${i%2===0?"#fff":"#f8faff"}">
        <td>${i+1}</td><td><strong>${d.name}</strong></td>
        <td style="text-align:center;font-family:monospace">${d.qty}</td>
        <td style="text-align:right;font-family:monospace;color:#16a34a">GH₵${Number(d.revenue||0).toFixed(2)}</td>
      </tr>`).join("");

    const css = `@page{size:A4;margin:13mm 12mm}*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}body{background:#fff;color:#0f172a;font-size:11px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;margin-bottom:16px;border-bottom:3px solid #3b82f6}.logo-row{display:flex;align-items:center;gap:12px}.logo-box{width:48px;height:48px;background:linear-gradient(135deg,#3b82f6,#60a5fa);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px}.pname{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 2px}.rtag{font-size:11px;color:#64748b;margin:0}.rmeta{text-align:right;font-size:10px;color:#64748b;line-height:1.7}.rmeta strong{color:#0f172a}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.kpi{border-radius:10px;padding:11px 14px}.kv{font-size:22px;font-weight:800;font-family:monospace}.kl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px}h3{font-size:13px;font-weight:700;color:#0f172a;margin:14px 0 8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}thead tr{background:#3b82f6}thead th{color:#fff;font-weight:700;padding:7px 8px;text-align:left}tbody td{padding:6px 8px;border-bottom:1px solid #f1f5f9}.footer{margin-top:14px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Cash Report</title><style>${css}</style></head><body>
    <div class="hdr">
      <div class="logo-row">
        <div class="logo-box">💵</div>
        <div><div class="pname">${pharmName}</div><div class="rtag">Daily Cash Summary · ${fmtDate(date)}</div></div>
      </div>
      <div class="rmeta"><strong>DAILY CASH REPORT</strong><br/>Date: ${fmtDate(date)}<br/>Generated: ${now}<br/>By: ${printedBy}</div>
    </div>
    <div class="kpis">
      <div class="kpi" style="background:#f0fdf4;border:1px solid #bbf7d0"><div class="kv" style="color:#16a34a">GH₵${Number(s.gross_revenue||0).toFixed(2)}</div><div class="kl" style="color:#16a34a">Gross Revenue</div></div>
      <div class="kpi" style="background:#fef2f2;border:1px solid #fecaca"><div class="kv" style="color:#dc2626">GH₵${Number(s.total_refunded||0).toFixed(2)}</div><div class="kl" style="color:#dc2626">Total Refunds</div></div>
      <div class="kpi" style="background:#eff6ff;border:1px solid #bfdbfe"><div class="kv" style="color:#2563eb">GH₵${Number(s.net_revenue||0).toFixed(2)}</div><div class="kl" style="color:#2563eb">Net Revenue</div></div>
      <div class="kpi" style="background:#f8fafc;border:1px solid #e2e8f0"><div class="kv" style="color:#475569">${s.total_sales||0}</div><div class="kl" style="color:#475569">Total Sales</div></div>
    </div>
    <h3>💳 By Payment Method</h3>
    <table><thead><tr><th>Method</th><th style="text-align:center">Count</th><th style="text-align:right">Revenue</th><th style="text-align:right">Refunds</th></tr></thead><tbody>${payRows}</tbody></table>
    <h3>💊 Top Selling Drugs Today</h3>
    <table><thead><tr><th>#</th><th>Drug</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${drugRows}</tbody></table>
    <div class="footer"><span>${pharmName} — Confidential</span><span>DCR-${Date.now()}</span><span>${new Date().toLocaleDateString("en-GH")}</span></div>
    </body></html>`;

    const win = window.open("","_blank"); win.document.write(html); win.document.close(); win.focus();
    setTimeout(()=>win.print(), 600);
  };

  const s = data?.summary;
  const cardStyle = { background:t.cardBg, border:t.cardBorder, borderRadius:18 };
  const inp = { background:t.surface2, border:`1.5px solid ${t.border}`, borderRadius:10, padding:"10px 14px", color:t.text, fontSize:13, outline:"none", fontFamily:"inherit" };

  return (
    <div style={{ height:"100%", overflowY:"auto", fontFamily:t.font, background:t.bg }}>
      <div style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}`, padding:"15px 32px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:t.surface3, border:`1px solid ${t.border}`, borderRadius:10, padding:"8px 16px", color:t.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:19, fontWeight:800, color:t.accent }}>💵 Daily Cash Summary</div>
          <div style={{ fontSize:12, color:t.textMuted }}>End-of-day cash reconciliation report</div>
        </div>
        {data && <button onClick={handlePrint} style={{ background:"linear-gradient(135deg,#3B82F6,#60a5fa)", border:"none", borderRadius:11, padding:"10px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🖨️ Print PDF</button>}
      </div>

      <div style={{ padding:"24px 32px" }}>
        <div style={{ ...cardStyle, padding:"16px 22px", marginBottom:22, display:"flex", gap:14, alignItems:"flex-end" }}>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:7 }}>Date</label>
            <input type="date" value={date} onChange={e=>{ setDate(e.target.value); load(e.target.value); }} style={inp} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[["Today", new Date().toISOString().slice(0,10)], ["Yesterday", new Date(Date.now()-86400000).toISOString().slice(0,10)]].map(([label,d]) => (
              <button key={label} onClick={()=>{ setDate(d); load(d); }}
                style={{ background:date===d?t.accent:t.surface3, border:`1px solid ${date===d?t.accent:t.border}`, borderRadius:9, padding:"10px 16px", color:date===d?"#fff":t.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Spinner t={t} /> : !data ? null : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:14, marginBottom:22 }}>
              {[
                { icon:"💰", label:"Gross Revenue", value:fmt(s.gross_revenue),   color:"#22C55E" },
                { icon:"↩️", label:"Refunds",       value:fmt(s.total_refunded),   color:"#EF4444" },
                { icon:"✅", label:"Net Revenue",   value:fmt(s.net_revenue),      color:t.accent  },
                { icon:"🧾", label:"Total Sales",   value:s.total_sales||0,        color:"#3B82F6" },
              ].map((c,i) => (
                <div key={i} style={{ background:c.color+"12", border:`1px solid ${c.color}25`, borderRadius:14, padding:"16px 18px" }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{c.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:c.color, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:c.color, fontFamily:"monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:22 }}>
              {/* Payment breakdown */}
              <div style={{ ...cardStyle, padding:"22px 24px" }}>
                <div style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:16 }}>💳 By Payment Method</div>
                {(data.by_payment||[]).map((p,i) => {
                  const total = (data.by_payment||[]).reduce((s,x)=>s+Number(x.revenue||0),0)||1;
                  const pct   = Math.round((Number(p.revenue||0)/total)*100);
                  const colors = ["#22C55E","#8B5CF6","#3B82F6","#F59E0B"];
                  return (
                    <div key={p.payment_method} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:t.text }}>{p.payment_method}</span>
                        <span style={{ fontSize:13, fontFamily:"monospace", fontWeight:700, color:colors[i%colors.length] }}>{fmt(p.revenue)}</span>
                      </div>
                      <div style={{ height:8, background:t.surface3, borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:colors[i%colors.length], borderRadius:4 }} />
                      </div>
                      <div style={{ fontSize:10, color:t.textMuted, marginTop:3 }}>{p.count} transactions</div>
                    </div>
                  );
                })}
              </div>

              {/* Top drugs */}
              <div style={{ ...cardStyle, padding:"22px 24px" }}>
                <div style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:16 }}>💊 Top Selling Drugs</div>
                {(data.top_drugs||[]).slice(0,8).map((d,i) => (
                  <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, color:t.textMuted, fontFamily:"monospace", width:18 }}>#{i+1}</span>
                      <span style={{ fontSize:13, color:t.text }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color:"#22C55E" }}>{fmt(d.revenue)}</div>
                      <div style={{ fontSize:10, color:t.textMuted }}>{d.qty} units</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

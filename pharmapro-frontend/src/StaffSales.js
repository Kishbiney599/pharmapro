import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const fmt     = (n) => `GH₵ ${Number(n||0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH") : "—";

export default function StaffSales({ t, onBack }) {
  const today      = new Date().toISOString().slice(0,10);
  const firstOfMon = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const [dateFrom, setDateFrom] = useState(firstOfMon);
  const [dateTo, setDateTo]     = useState(today);
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => { api.getSettings().then(setSettings).catch(()=>{}); }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.getSalesByStaff(dateFrom, dateTo).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, []);

  const totalRevenue = data.reduce((s,r)=>s+Number(r.total_revenue||0), 0);

  const handlePrint = () => {
    const pharmName = settings.pharmacy_name || "PharmaPro Enterprise";
    const now = new Date().toLocaleString("en-GH");
    const rows = data.map((r,i) => `
      <tr style="background:${i%2===0?"#fff":"#f8faff"}">
        <td>${i+1}</td>
        <td><strong>${r.staff_name}</strong><br/><span style="font-size:9px;color:#64748b">${r.role}</span></td>
        <td style="text-align:center;font-family:monospace">${r.total_sales||0}</td>
        <td style="text-align:right;font-family:monospace;color:#16a34a">GH₵${Number(r.total_revenue||0).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">${r.refund_count||0}</td>
        <td style="text-align:right;font-family:monospace;font-size:9px">${fmtDate(r.first_sale)}</td>
        <td style="text-align:right;font-family:monospace;font-size:9px">${fmtDate(r.last_sale)}</td>
      </tr>`).join("");

    const css = `@page{size:A4 landscape;margin:13mm 12mm}*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}body{background:#fff;color:#0f172a;font-size:11px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;margin-bottom:16px;border-bottom:3px solid #8b5cf6}.logo-box{width:48px;height:48px;background:linear-gradient(135deg,#8b5cf6,#a78bfa);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px}.pname{font-size:20px;font-weight:800;margin:0 0 2px}.rtag{font-size:11px;color:#64748b}.rmeta{text-align:right;font-size:10px;color:#64748b;line-height:1.7}.rmeta strong{color:#0f172a}table{width:100%;border-collapse:collapse;font-size:11px}thead tr{background:#8b5cf6}thead th{color:#fff;padding:8px;text-align:left;font-weight:700}tbody td{padding:7px 8px;border-bottom:1px solid #f1f5f9}.footer{margin-top:14px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sales by Staff</title><style>${css}</style></head><body>
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="logo-box">👥</div>
        <div><div class="pname">${pharmName}</div><div class="rtag">Sales by Staff · ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}</div></div>
      </div>
      <div class="rmeta"><strong>STAFF SALES REPORT</strong><br/>Generated: ${now}<br/>Total Revenue: GH₵${totalRevenue.toFixed(2)}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Staff Member</th><th style="text-align:center">Sales</th><th style="text-align:right">Revenue</th><th style="text-align:right">Refunds</th><th style="text-align:right">First Sale</th><th style="text-align:right">Last Sale</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer"><span>${pharmName}</span><span>SSR-${Date.now()}</span><span>${new Date().toLocaleDateString("en-GH")}</span></div>
    </body></html>`;

    const win = window.open("","_blank"); win.document.write(html); win.document.close(); win.focus();
    setTimeout(()=>win.print(), 600);
  };

  const inp = { background:t.surface2, border:`1.5px solid ${t.border}`, borderRadius:10, padding:"10px 14px", color:t.text, fontSize:13, outline:"none", fontFamily:"inherit" };
  const cardStyle = { background:t.cardBg, border:t.cardBorder, borderRadius:18 };

  return (
    <div style={{ height:"100%", overflowY:"auto", fontFamily:t.font, background:t.bg }}>
      <div style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}`, padding:"15px 32px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:t.surface3, border:`1px solid ${t.border}`, borderRadius:10, padding:"8px 16px", color:t.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:19, fontWeight:800, color:t.accent }}>👥 Sales by Staff</div>
          <div style={{ fontSize:12, color:t.textMuted }}>Track performance per cashier or pharmacist</div>
        </div>
        {data.length > 0 && <button onClick={handlePrint} style={{ background:"linear-gradient(135deg,#8B5CF6,#a78bfa)", border:"none", borderRadius:11, padding:"10px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🖨️ Print PDF</button>}
      </div>

      <div style={{ padding:"24px 32px" }}>
        <div style={{ ...cardStyle, padding:"16px 22px", marginBottom:22 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:14, alignItems:"flex-end" }}>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:7 }}>From</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize:10, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:7 }}>To</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inp} />
            </div>
            <button onClick={load} disabled={loading}
              style={{ background:loading?t.surface3:t.primary, border:"none", borderRadius:11, padding:"11px 22px", color:loading?t.textMuted:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              🔍 Generate
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:t.textMuted }}>
            <div style={{ width:30, height:30, border:`3px solid ${t.border}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:t.textMuted }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.4 }}>👥</div>
            <p>No sales data for this period</p>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:14, marginBottom:20 }}>
              {[
                { icon:"💰", label:"Total Revenue", value:fmt(totalRevenue),                    color:"#22C55E" },
                { icon:"🧾", label:"Total Sales",   value:data.reduce((s,r)=>s+Number(r.total_sales||0),0), color:"#3B82F6" },
                { icon:"👥", label:"Active Staff",  value:data.filter(r=>r.total_sales>0).length, color:"#8B5CF6" },
              ].map((c,i) => (
                <div key={i} style={{ background:c.color+"12", border:`1px solid ${c.color}25`, borderRadius:14, padding:"16px 18px" }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:c.color, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontSize:24, fontWeight:800, color:c.color, fontFamily:"monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, overflow:"hidden" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:t.surface3 }}>
                    {["#","Staff Member","Role","Sales","Revenue","Refunds","First Sale","Last Sale"].map(h=>(
                      <th key={h} style={{ padding:"11px 16px", fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:0.7, textAlign:h==="Revenue"?"right":"left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r,i) => (
                    <tr key={r.user_id} style={{ borderTop:`1px solid ${t.border}`, background:i%2===0?"transparent":t.surface2+"20" }}
                      onMouseEnter={e=>e.currentTarget.style.background=t.surface3}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":t.surface2+"20"}>
                      <td style={{ padding:"12px 16px", color:t.textMuted, fontSize:12 }}>#{i+1}</td>
                      <td style={{ padding:"12px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:t.primary, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff" }}>
                            {r.staff_name?.slice(0,2).toUpperCase()}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:t.text }}>{r.staff_name}</div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:t.textMuted }}>{r.role}</td>
                      <td style={{ padding:"12px 16px", fontSize:14, fontFamily:"monospace", fontWeight:700, color:t.accent }}>{r.total_sales||0}</td>
                      <td style={{ padding:"12px 16px", fontSize:14, fontFamily:"monospace", fontWeight:700, color:"#22C55E", textAlign:"right" }}>{fmt(r.total_revenue)}</td>
                      <td style={{ padding:"12px 16px", fontSize:12, color:"#F87171", textAlign:"center" }}>{r.refund_count||0}</td>
                      <td style={{ padding:"12px 16px", fontSize:11, color:t.textMuted }}>{fmtDate(r.first_sale)}</td>
                      <td style={{ padding:"12px 16px", fontSize:11, color:t.textMuted }}>{fmtDate(r.last_sale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

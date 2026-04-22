import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const LEVEL_COLOR = {
  ERROR: { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   text: "#F87171", icon: "❌" },
  WARN:  { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  text: "#F59E0B", icon: "⚠️" },
  INFO:  { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)",  text: "#60A5FA", icon: "ℹ️" },
};

function fmtTime(t) {
  if (!t) return "—";
  return new Date(t).toLocaleString("en-GH", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

export default function ErrorLog({ t, onBack }) {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("ALL");
  const [logPath, setLogPath]   = useState("");
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getErrorLog(), api.getLogPath()])
      .then(([data, pathData]) => {
        setEntries(data.entries || []);
        setLogPath(pathData.log_file || "");
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const handleClear = async () => {
    if (!window.confirm("Clear all error logs? This cannot be undone.")) return;
    setClearing(true);
    try { await api.clearErrorLog(); setEntries([]); } catch(_) {}
    setClearing(false);
  };

  const filtered = filter === "ALL" ? entries : entries.filter(e => e.level === filter);
  const counts   = { ERROR: entries.filter(e=>e.level==="ERROR").length, WARN: entries.filter(e=>e.level==="WARN").length, INFO: entries.filter(e=>e.level==="INFO").length };

  const card = { background: t.cardBg, border: t.cardBorder, borderRadius: 16 };

  return (
    <div style={{ height:"100%", overflowY:"auto", fontFamily:t.font, background:t.bg }}>
      {/* Header */}
      <div style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}`, padding:"14px 28px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:50 }}>
        <button onClick={onBack} style={{ background:t.surface3, border:`1px solid ${t.border}`, borderRadius:10, padding:"7px 16px", color:t.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#F87171" }}>🔴 Error Log</div>
          <div style={{ fontSize:11, color:t.textMuted, fontFamily:"monospace" }}>{logPath || "Loading..."}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={() => setAutoRefresh(v => !v)}
            style={{ background:autoRefresh?"rgba(34,197,94,0.15)":t.surface3, border:`1px solid ${autoRefresh?"rgba(34,197,94,0.4)":t.border}`, borderRadius:9, padding:"7px 14px", color:autoRefresh?"#22C55E":t.textMuted, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {autoRefresh ? "⏸ Auto-refresh ON" : "▶ Auto-refresh"}
          </button>
          <button onClick={load}
            style={{ background:t.surface3, border:`1px solid ${t.border}`, borderRadius:9, padding:"7px 14px", color:t.text, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            🔄 Refresh
          </button>
          <button onClick={handleClear} disabled={clearing || entries.length===0}
            style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:9, padding:"7px 14px", color:"#F87171", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:entries.length===0?0.5:1 }}>
            🗑️ Clear Log
          </button>
        </div>
      </div>

      <div style={{ padding:"20px 28px" }}>
        {/* Summary cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12, marginBottom:20 }}>
          {[["❌","Errors","ERROR","#EF4444"],["⚠️","Warnings","WARN","#F59E0B"],["ℹ️","Info","INFO","#3B82F6"]].map(([icon,label,level,color]) => (
            <button key={level} onClick={() => setFilter(filter===level?"ALL":level)}
              style={{ background:filter===level?`${color}20`:card.background, border:`2px solid ${filter===level?color:t.border}`, borderRadius:14, padding:"14px 18px", textAlign:"left", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
              <div style={{ fontSize:10, fontWeight:700, color, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:28, fontWeight:800, color, fontFamily:"monospace" }}>{counts[level]}</div>
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {["ALL","ERROR","WARN","INFO"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ background:filter===f?t.accent:t.surface3, border:`1px solid ${filter===f?t.accent:t.border}`, borderRadius:20, padding:"5px 14px", color:filter===f?"#fff":t.textMuted, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {f} {f!=="ALL" && `(${counts[f]})`}
            </button>
          ))}
          <span style={{ fontSize:12, color:t.textMuted, marginLeft:"auto", alignSelf:"center" }}>
            Showing {filtered.length} entries
          </span>
        </div>

        {/* Log entries */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:t.textMuted }}>
            <div style={{ width:28, height:28, border:`3px solid ${t.border}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Loading logs...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, padding:"60px 20px", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:700, color:t.accent, marginBottom:8 }}>
              {filter === "ALL" ? "No errors logged!" : `No ${filter} entries`}
            </div>
            <p style={{ color:t.textMuted, fontSize:14 }}>The system is running cleanly.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map((entry, i) => {
              const cfg  = LEVEL_COLOR[entry.level] || LEVEL_COLOR.INFO;
              const isExp = expanded === i;
              return (
                <div key={i}
                  onClick={() => setExpanded(isExp ? null : i)}
                  style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:12, padding:"12px 16px", cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{cfg.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ fontSize:11, fontWeight:800, color:cfg.text, background:cfg.bg, border:`1px solid ${cfg.border}`, borderRadius:6, padding:"2px 7px" }}>{entry.level}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:t.textSub }}>[{entry.module || "?"}]</span>
                          <span style={{ fontSize:13, color:t.text, fontWeight:500 }}>{entry.msg}</span>
                        </div>
                        <span style={{ fontSize:11, color:t.textMuted, flexShrink:0, fontFamily:"monospace" }}>{fmtTime(entry.time)}</span>
                      </div>

                      {/* Expanded details */}
                      {isExp && (
                        <div style={{ marginTop:10, padding:"10px 14px", background:t.surface2, borderRadius:8, fontSize:12 }}>
                          {entry.error && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontWeight:700, color:"#F87171", marginBottom:4 }}>Error:</div>
                              <div style={{ color:t.text, fontFamily:"monospace", fontSize:11 }}>{entry.error.message}</div>
                              {entry.error.stack && (
                                <div style={{ color:t.textMuted, fontFamily:"monospace", fontSize:10, marginTop:6, whiteSpace:"pre-wrap" }}>
                                  {entry.error.stack}
                                </div>
                              )}
                            </div>
                          )}
                          {entry.method && (
                            <div style={{ color:t.textSub }}>
                              <strong>Request:</strong> {entry.method} {entry.path} — {entry.status} ({entry.ms}ms)
                              {entry.user && <span> — by <strong>{entry.user}</strong></span>}
                            </div>
                          )}
                          {entry.user && !entry.method && (
                            <div style={{ color:t.textSub }}><strong>User:</strong> {entry.user}</div>
                          )}
                          <div style={{ color:t.textMuted, marginTop:6, fontFamily:"monospace", fontSize:10 }}>
                            {JSON.stringify(entry, null, 2)}
                          </div>
                        </div>
                      )}
                    </div>
                    <span style={{ color:t.textMuted, fontSize:12, flexShrink:0 }}>{isExp ? "▲" : "▼"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

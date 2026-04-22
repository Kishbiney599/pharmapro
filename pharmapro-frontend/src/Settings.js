import { useState, useEffect } from "react";
import { Spinner, Field } from "./components";
import { api } from "./api";
import ErrorLog from "./ErrorLog";

const ACTION_META = {
  LOGIN:            { label: "Login",            color: "#22C55E", icon: "🔑", bg: "rgba(34,197,94,0.1)"    },
  SALE_COMPLETE:    { label: "Sale Completed",   color: "#3B82F6", icon: "🛒", bg: "rgba(59,130,246,0.1)"   },
  SALE_REVERSED:    { label: "Sale Reversed",    color: "#F87171", icon: "↩️", bg: "#3B0D0D"                },
  DRUG_ADDED:       { label: "Drug Added",       color: "#14B8A6", icon: "💊", bg: "rgba(20,184,166,0.1)"   },
  DRUG_DELETED:     { label: "Drug Deleted",     color: "#EF4444", icon: "🗑️", bg: "rgba(239,68,68,0.1)"   },
  BULK_IMPORT:      { label: "Bulk Import",      color: "#8b5cf6", icon: "📥", bg: "rgba(139,92,246,0.1)"   },
  SETTINGS_UPDATED: { label: "Settings Updated", color: "#F59E0B", icon: "⚙️", bg: "rgba(245,158,11,0.1)"  },
  BACKUP_CREATED:   { label: "Backup Created",  color: "#22C55E", icon: "💾", bg: "rgba(34,197,94,0.1)"    },
  PASSWORD_CHANGED: { label: "Password Changed", color: "#3B82F6", icon: "🔒", bg: "rgba(59,130,246,0.1)"  },
  PASSWORD_RESET:   { label: "Password Reset",   color: "#F59E0B", icon: "🔑", bg: "rgba(245,158,11,0.1)"  },
  STOCK_ADJUSTED:   { label: "Stock Adjusted",  color: "#14B8A6", icon: "📦", bg: "rgba(20,184,166,0.1)"  },
  PO_CREATED:       { label: "PO Created",      color: "#3B82F6", icon: "📋", bg: "rgba(59,130,246,0.1)"  },
  PO_UPDATED:       { label: "PO Updated",      color: "#F59E0B", icon: "📋", bg: "rgba(245,158,11,0.1)"  },
  GRN_CREATED:      { label: "GRN Created",     color: "#22C55E", icon: "📦", bg: "rgba(34,197,94,0.1)"   },
  PROFIT_LOSS_VIEWED: { label: "P&L Report",    color: "#22C55E", icon: "💰", bg: "rgba(34,197,94,0.1)"   },
  PARTIAL_RETURN:    { label: "Partial Return",  color: "#F59E0B", icon: "↩️", bg: "rgba(245,158,11,0.1)" },
  CUSTOMER_ADDED:    { label: "Customer Added",  color: "#14B8A6", icon: "👥", bg: "rgba(20,184,166,0.1)"  },
  SHIFT_OPENED:     { label: "Shift Opened",   color: "#22C55E", icon: "🏁", bg: "rgba(34,197,94,0.1)"   },
  SHIFT_CLOSED:     { label: "Shift Closed",   color: "#8B5CF6", icon: "🏁", bg: "rgba(139,92,246,0.1)" },
  PERMISSIONS_UPDATED: { label: "Permissions",  color: "#8B5CF6", icon: "🔐", bg: "rgba(139,92,246,0.1)" },
  BACKUP_RESTORED:  { label: "Backup Restored", color: "#F59E0B", icon: "🔄", bg: "rgba(245,158,11,0.1)"  },
  DEFAULT:          { label: "Activity",        color: "#94A3B8", icon: "📋", bg: "rgba(148,163,184,0.1)"  },
};

function fmtDT(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) +
         " " + dt.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}

// ── Activity Log Tab ──────────────────────────────────────────
function ActivityLog({ t }) {
  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [logs, setLogs]       = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date_from: weekAgo, date_to: today, user_id: "", action: "", limit: "200" });
  const [search, setSearch]   = useState("");

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to)   params.date_to   = filters.date_to;
    if (filters.user_id)   params.user_id   = filters.user_id;
    if (filters.action)    params.action    = filters.action;
    params.limit = filters.limit;
    Promise.all([api.getActivityLogs(params), api.getActivityUsers()])
      .then(([l, u]) => { setLogs(l); setUsers(u); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const f = (key) => (e) => setFilters(p => ({ ...p, [key]: e.target.value }));
  const inputStyle = { width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 13px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" };

  const filtered = logs.filter(l =>
    !search ||
    (l.description || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.user_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.action || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:    logs.length,
    logins:   logs.filter(l => l.action === "LOGIN").length,
    sales:    logs.filter(l => l.action === "SALE_COMPLETE").length,
    reversed: logs.filter(l => l.action === "SALE_REVERSED").length,
  };

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
        {[
          { icon: "📋", label: "Total Events",    value: stats.total,    color: t.accent  },
          { icon: "🔑", label: "Logins",          value: stats.logins,   color: "#22C55E" },
          { icon: "🛒", label: "Sales Completed", value: stats.sales,    color: "#3B82F6" },
          { icon: "↩️", label: "Sales Reversed",  value: stats.reversed, color: "#F87171" },
        ].map((c,i) => (
          <div key={i} style={{ background: c.color + "12", border: `1px solid ${c.color}25`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
          {[["From","date_from","date"],["To","date_to","date"]].map(([lbl,key,type]) => (
            <div key={key}>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>{lbl}</label>
              <input type={type} value={filters[key]} onChange={f(key)} style={inputStyle} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>User</label>
            <select value={filters.user_id} onChange={f("user_id")} style={inputStyle}>
              <option value="">All Users</option>
              {users.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name} ({u.user_role})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Action</label>
            <select value={filters.action} onChange={f("action")} style={inputStyle}>
              <option value="">All Actions</option>
              {Object.entries(ACTION_META).filter(([k]) => k !== "DEFAULT").map(([k,v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <button onClick={load} style={{ background: t.primary, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow, whiteSpace: "nowrap" }}>
            🔍 Filter
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 13px" }}>
          <span style={{ color: t.textMuted }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description, user, or action..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 13, fontFamily: "inherit" }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>✕</button>}
        </div>
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Activity Log <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({filtered.length} events)</span></span>
          <span style={{ fontSize: 11, color: t.textMuted }}>Newest first</span>
        </div>
        {loading ? <Spinner t={t} /> : filtered.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: t.textMuted }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📋</div>
            <p>No activity found for this period</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0 }}>
                <tr style={{ background: t.surface3 }}>
                  {["Date & Time","User","Role","Action","Module","Description"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => {
                  const meta = ACTION_META[log.action] || ACTION_META.DEFAULT;
                  return (
                    <tr key={log.id} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "30" }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : t.surface2 + "30"}>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: t.textMuted, fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmtDT(log.created_at)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>{log.user_name || "System"}</td>
                      <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: t.surface3, borderRadius: 20, padding: "2px 9px" }}>{log.user_role || "—"}</span></td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}25`, borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: t.textMuted }}>{log.module || "—"}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: t.textSub, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.description || "—"}</td>
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

// ── Main Settings Component ───────────────────────────────────
export default function Settings({ t, user }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);
  const [tab, setTab]           = useState("general");

  const isAdmin = ["admin", "super admin"].includes((user?.role || "").toLowerCase());

  useEffect(() => {
    api.getSettings()
      .then(s => { setSettings(s); setForm(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      // pharmacy_name is NOT sent — it's read-only from .env
      const { pharmacy_name, ...rest } = form;
      const result = await api.updateSettings(rest);
      setSettings(result.settings);
      setForm(result.settings);
      // Cache full settings including logo for receipt use
      localStorage.setItem('pharmapro_settings', JSON.stringify(result.settings));
      if (result.settings.pharmacy_name) {
        localStorage.setItem('pharmapro_name', result.settings.pharmacy_name);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const inputStyle = {
    width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`,
    borderRadius: 12, padding: "11px 15px", color: isAdmin ? t.text : t.textMuted,
    fontSize: 14, outline: "none", fontFamily: "inherit",
    cursor: isAdmin ? "text" : "not-allowed",
  };
  const textareaStyle = { ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.5 };
  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 20, padding: "26px 28px", marginBottom: 20 };

  const TabBtn = ({ id, label, icon }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer",
      fontFamily: "inherit", fontSize: 14, fontWeight: tab === id ? 700 : 500,
      background: tab === id ? t.accent : "transparent",
      color: tab === id ? "#fff" : t.textMuted,
      display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
    }}>
      <span>{icon}</span>{label}
    </button>
  );

  if (loading) return <div style={{ padding: "32px 36px", fontFamily: t.font }}><Spinner t={t} /></div>;

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>⚙️ Settings</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Contact information and activity monitoring</p>
        </div>
        {tab === "general" && isAdmin && (
          <button onClick={handleSave} disabled={saving}
            style={{ background: saving ? t.surface3 : t.primary, border: "none", borderRadius: 14, padding: "13px 28px", color: saving ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : t.glow, display: "flex", alignItems: "center", gap: 8 }}>
            {saving ? "Saving…" : saved ? "✅ Saved!" : "💾 Save Changes"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: t.surface3, borderRadius: 14, padding: 6, width: "fit-content" }}>
        <TabBtn id="general"  label="Contact Info"  icon="📞" />
        <TabBtn id="activity" label="Activity Log"  icon="📋" />
      </div>

      {/* Alerts */}
      {error && <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 18, color: "#F87171", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
      {saved && <div style={{ background: "#0F2A1F", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 18, color: "#22C55E", fontSize: 13, fontWeight: 600 }}>✅ Settings saved.</div>}

      {/* ══ GENERAL TAB ══ */}
      {tab === "general" && (
        <>
          {!isAdmin && (
            <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24" }}>View Only</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Only Admins can edit settings.</div>
              </div>
            </div>
          )}

          {/* Pharmacy name — read-only, from .env */}
          <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 16, padding: "16px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: t.glow }}>💊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Pharmacy / Branch Name</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.accent }}>{settings?.pharmacy_name || "PharmaPro Enterprise"}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>Set in the backend <code style={{ background: t.surface2, padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>.env</code> file — contact your system administrator to change.</div>
            </div>
            <div style={{ background: t.accent + "15", border: `1px solid ${t.accent}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: t.accent, flexShrink: 0 }}>🔒 Fixed</div>
          </div>

          {/* Contact Info */}
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>📞 Contact Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Email Address">
                <input type="email" value={form.email || ""} onChange={f("email")} disabled={!isAdmin}
                  placeholder="info@yourpharmacy.com" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <Field label="Phone Number">
                <input value={form.phone || ""} onChange={f("phone")} disabled={!isAdmin}
                  placeholder="+233 XX XXX XXXX" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <Field label="Website">
                <input value={form.website || ""} onChange={f("website")} disabled={!isAdmin}
                  placeholder="www.yourpharmacy.com" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <Field label="City / Town">
                <input value={form.city || ""} onChange={f("city")} disabled={!isAdmin}
                  placeholder="Kumasi" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <Field label="Country">
                <input value={form.country || "Ghana"} onChange={f("country")} disabled={!isAdmin}
                  placeholder="Ghana" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <Field label="Tagline / Slogan">
                <input value={form.tagline || ""} onChange={f("tagline")} disabled={!isAdmin}
                  placeholder="e.g. Your health is our priority" style={inputStyle}
                  onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                  onBlur={e => e.target.style.borderColor = t.border} />
              </Field>
              <div style={{ gridColumn: "1/-1" }}>
                <Field label="Full Address">
                  <textarea value={form.address || ""} onChange={f("address")} disabled={!isAdmin}
                    placeholder="Street address, district..." style={textareaStyle}
                    onFocus={e => { if (isAdmin) e.target.style.borderColor = t.accent; }}
                    onBlur={e => e.target.style.borderColor = t.border} />
                </Field>
              </div>

              {/* Logo Upload */}
              <div style={{ gridColumn: "1/-1" }}>
                <Field label="Pharmacy Logo (printed on receipts)">
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                    {form.logo_base64 ? (
                      <div style={{ position: "relative" }}>
                        <img src={form.logo_base64} alt="Logo"
                          style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 12, background: "#fff", border: `1px solid ${t.border}`, padding: 4 }} />
                        {isAdmin && (
                          <button onClick={() => setForm(f => ({ ...f, logo_base64: "" }))}
                            style={{ position: "absolute", top: -6, right: -6, background: t.dangerColor, border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 12, background: t.surface2, border: `2px dashed ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        🏥
                      </div>
                    )}
                    <div>
                      {isAdmin && (
                        <label style={{ display: "inline-block", background: t.primary, border: "none", borderRadius: 10, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          📁 Upload Logo
                          <input type="file" accept="image/*" style={{ display: "none" }}
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              if (file.size > 500000) { alert("Logo must be under 500KB"); return; }
                              const reader = new FileReader();
                              reader.onload = ev => setForm(f => ({ ...f, logo_base64: ev.target.result }));
                              reader.readAsDataURL(file);
                            }} />
                        </label>
                      )}
                      <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
                        PNG or JPG · Max 500KB · Appears on all printed receipts
                      </p>
                    </div>
                  </div>
                </Field>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ background: saving ? t.surface3 : t.primary, border: "none", borderRadius: 14, padding: "13px 28px", color: saving ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : t.glow }}>
                {saving ? "Saving..." : saved ? "✅ Saved!" : "💾 Save Changes"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ══ ACTIVITY LOG TAB ══ */}
      {tab === "error_log" && (
        <ErrorLog t={t} onBack={() => setTab("general")} />
      )}

      {tab === "activity" && (
        isAdmin
          ? <ActivityLog t={t} user={user} />
          : (
            <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 16, padding: "48px 40px", textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#FBBF24", marginBottom: 8 }}>Admin Access Required</div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>Only Admins can view the activity log.</div>
            </div>
          )
      )}
    </div>
  );
}

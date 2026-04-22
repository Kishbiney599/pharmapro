import { useState, useEffect } from "react";
import { Spinner, Modal } from "./components";
import { api } from "./api";

const fmt = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function Customers({ t, user }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [form, setForm]           = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  const isAdmin = ["admin", "super admin"].includes((user?.role || "").toLowerCase());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    setLoading(true);
    api.getCustomers().then(setCustomers).catch(e => showToast(e.message, "error")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!form.name.trim()) return showToast("Name is required", "error");
    setSaving(true);
    try {
      if (form.id) {
        await api.updateCustomer(form.id, form);
        showToast("Customer updated");
      } else {
        await api.createCustomer(form);
        showToast("Customer added");
      }
      setShowAdd(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  const inp = { width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" };
  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 18 };

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 600, background: toast.type === "error" ? "#3B0D0D" : "#0F2A1F", border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 14, padding: "14px 22px", fontSize: 14, fontWeight: 600, color: toast.type === "error" ? "#F87171" : "#22C55E", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: t.accent, marginBottom: 4 }}>👥 Customers</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>{customers.length} customers registered</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowAdd(true); }}
            style={{ background: t.primary, border: "none", borderRadius: 12, padding: "11px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
            + Add Customer
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
        {[
          { icon: "👥", label: "Total Customers",  value: customers.length,                                           color: t.accent  },
          { icon: "💰", label: "Total Spent",       value: fmt(customers.reduce((s,c)=>s+Number(c.total_spent||0),0)), color: "#22C55E" },
          { icon: "🛒", label: "Total Purchases",   value: customers.reduce((s,c)=>s+Number(c.total_purchases||0),0),  color: "#3B82F6" },
          { icon: "⭐", label: "Active (30 days)",  value: customers.filter(c=>c.last_purchase && new Date(c.last_purchase) > new Date(Date.now()-30*86400000)).length, color: "#F59E0B" },
        ].map((c,i) => (
          <div key={i} style={{ background: c.color+"12", border: `1px solid ${c.color}25`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ ...cardStyle, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: t.textMuted, fontSize: 16 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit" }} />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>}
      </div>

      {/* Table */}
      {loading ? <Spinner t={t} /> : (
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>👥</div>
              <p>{search ? "No customers found" : "No customers yet. Add your first one."}</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.surface3 }}>
                  {["Customer", "Phone", "Email", "Purchases", "Total Spent", "Last Visit", ""].map(h => (
                    <th key={h} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${t.border}`, background: i%2===0?"transparent":t.surface2+"20" }}
                    onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                    onMouseLeave={e => e.currentTarget.style.background = i%2===0?"transparent":t.surface2+"20"}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>
                          {c.name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: 11, color: t.textMuted }}>{c.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: t.textSub }}>{c.phone || "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: t.textSub }}>{c.email || "—"}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontFamily: "monospace", textAlign: "center", fontWeight: 700, color: t.accent }}>{c.total_purchases || 0}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#22C55E" }}>{fmt(c.total_spent)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: t.textMuted }}>{fmtDate(c.last_purchase)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setSelected(c)}
                          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "5px 10px", color: "#3B82F6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          View
                        </button>
                        {isAdmin && (
                          <button onClick={() => { setForm({ ...c }); setShowAdd(true); }}
                            style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 10px", color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 22, padding: "34px", width: "min(500px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp .2s ease" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 22 }}>
              {form.id ? "✏️ Edit Customer" : "👥 Add Customer"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Full Name *","name","text","John Mensah"],["Phone Number","phone","tel","+233 XX XXX XXXX"],["Email","email","email","john@example.com"],["Address","address","text","Kumasi, Ashanti"]].map(([label,key,type,ph]) => (
                <div key={key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>{label}</label>
                  <input type={type} value={form[key]||""} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                    style={inp} onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes..." rows={2}
                  style={{ ...inp, resize: "vertical" }}
                  onFocus={e=>e.target.style.borderColor=t.accent} onBlur={e=>e.target.style.borderColor=t.border}>
                </textarea>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 11, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: saving?t.surface3:t.primary, border: "none", borderRadius: 11, padding: "12px 0", color: saving?t.textMuted:"#fff", fontSize: 14, fontWeight: 700, cursor: saving?"not-allowed":"pointer", fontFamily: "inherit", boxShadow: saving?"none":t.glow }}>
                {saving ? "Saving..." : "💾 Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(520px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{selected.phone || "No phone"}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 12px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[["Total Purchases", selected.total_purchases||0, "#3B82F6"],["Total Spent", fmt(selected.total_spent), "#22C55E"],["Last Visit", fmtDate(selected.last_purchase), t.accent],["Member Since", fmtDate(selected.created_at), t.textMuted]].map(([k,v,c]) => (
                  <div key={k} style={{ background: t.surface3, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.purchases?.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Purchase History</div>
                  <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden" }}>
                    {selected.purchases.map((p, i) => (
                      <div key={p.id} style={{ padding: "11px 16px", borderBottom: i<selected.purchases.length-1?`1px solid ${t.border}`:"none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.accent, fontFamily: "monospace" }}>{p.sale_ref}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{fmtDate(p.created_at)} · {p.payment_method}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", fontFamily: "monospace" }}>{fmt(p.total)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Spinner, Modal } from "./components";
import { api } from "./api";

const fmt = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_COLORS = {
  draft:      { color: "#94A3B8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" },
  sent:       { color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
  partial:    { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
  received:   { color: "#22C55E", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  cancelled:  { color: "#EF4444", bg: "#3B0D0D",               border: "rgba(239,68,68,0.3)"   },
  confirmed:  { color: "#22C55E", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  active:     { color: "#22C55E", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
  inactive:   { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 10px", textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

export default function Suppliers({ t, user }) {
  const [tab, setTab] = useState("suppliers");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isAdmin = ["admin", "super admin"].includes((user?.role || "").toLowerCase());

  const TabBtn = ({ id, icon, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
      fontFamily: "inherit", fontSize: 14, fontWeight: tab === id ? 700 : 500,
      background: tab === id ? t.accent : "transparent",
      color: tab === id ? "#fff" : t.textMuted,
      display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
    }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 600, background: toast.type === "error" ? "#3B0D0D" : "#0F2A1F", border: `1px solid ${toast.type === "error" ? "rgba(248,113,113,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 14, padding: "14px 22px", fontSize: 14, fontWeight: 600, color: toast.type === "error" ? "#F87171" : "#22C55E", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>🏭 Supplier Management</div>
        <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Manage suppliers, create purchase orders and record deliveries</p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: t.surface3, borderRadius: 14, padding: 6, width: "fit-content" }}>
        <TabBtn id="suppliers" icon="🏭" label="Suppliers"        />
        <TabBtn id="orders"    icon="📋" label="Purchase Orders"  />
        <TabBtn id="grn"       icon="📦" label="GRN"              />
      </div>

      {tab === "suppliers" && <SuppliersList t={t} isAdmin={isAdmin} showToast={showToast} />}
      {tab === "orders"    && <PurchaseOrders t={t} isAdmin={isAdmin} showToast={showToast} />}
      {tab === "grn"       && <GRNList t={t} isAdmin={isAdmin} showToast={showToast} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SUPPLIERS LIST
// ══════════════════════════════════════════════════════════════
function SuppliersList({ t, isAdmin, showToast }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ name: "", contact: "", email: "", address: "" });
  const [saving, setSaving]       = useState(false);

  const load = () => {
    setLoading(true);
    api.getSuppliers().then(setSuppliers).catch(e => showToast(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!form.name) return showToast("Name is required", "error");
    setSaving(true);
    try {
      await api.addSupplier(form);
      showToast(`${form.name} added`);
      setShowAdd(false);
      setForm({ name: "", contact: "", email: "", address: "" });
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const gradients = [t.primary, t.success, t.purple, t.info, t.warning, t.danger];
  const inp = { width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 11, padding: "10px 14px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)}
            style={{ background: t.primary, border: "none", borderRadius: 12, padding: "11px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
            + Add Supplier
          </button>
        )}
      </div>

      {loading ? <Spinner t={t} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20 }}>
          {suppliers.map((s, i) => {
            const grad = gradients[i % gradients.length];
            return (
              <div key={s.id} style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 18, padding: "24px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: grad, borderRadius: "18px 18px 0 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
                      {s.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{s.drug_count || 0} drugs supplied</div>
                    </div>
                  </div>
                  <StatusBadge status={s.status || "active"} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {[["📞", s.contact], ["✉️", s.email], ["📍", s.address]].filter(([,v]) => v).map(([icon, val]) => (
                    <div key={icon} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: t.textSub }}>
                      <span>{icon}</span><span>{val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 12, color: t.textMuted }}>
                  <span>Last order: {fmtDate(s.last_order)}</span>
                  <span style={{ color: t.accent, fontWeight: 600 }}>{s.drug_count} products</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 22, padding: "34px", width: "min(460px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp .2s ease" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 20 }}>🏭 Add Supplier</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Company Name *","name","PharmaCo Ltd"],["Phone Number","contact","+233 XX XXX XXXX"],["Email","email","orders@company.com"],["Address","address","City, Region"]].map(([label, key, ph]) => (
                <div key={key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>{label}</label>
                  <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 11, padding: "11px 0", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, background: saving ? t.surface3 : t.primary, border: "none", borderRadius: 11, padding: "11px 0", color: saving ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : t.glow }}>
                {saving ? "Saving…" : "💾 Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  PURCHASE ORDERS
// ══════════════════════════════════════════════════════════════
function PurchaseOrders({ t, isAdmin, showToast }) {
  const [orders, setOrders]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [drugs, setDrugs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewPO, setViewPO]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ supplier_id: "", order_date: today, expected_date: "", notes: "", items: [] });

  const load = () => {
    setLoading(true);
    Promise.all([api.getPurchaseOrders(), api.getSuppliers(), api.getAdjustmentDrugs()])
      .then(([o, s, d]) => { setOrders(o); setSuppliers(s); setDrugs(d); })
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { drug_id: "", drug_name: "", quantity: "", unit_price: "" }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i) }));
  const updateItem = (i, key, val) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [key]: val };
    if (key === "drug_id") {
      const d = drugs.find(d => d.id == val);
      if (d) items[i].drug_name = d.name;
    }
    return { ...f, items };
  });

  const handleCreate = async () => {
    if (!form.supplier_id) return showToast("Select a supplier", "error");
    if (!form.items.length || form.items.every(i => !i.drug_name)) return showToast("Add at least one item", "error");
    const validItems = form.items.filter(i => i.drug_name && i.quantity > 0);
    if (!validItems.length) return showToast("Fill in drug name and quantity for each item", "error");
    setSaving(true);
    try {
      await api.createPurchaseOrder({ ...form, items: validItems });
      showToast("Purchase order created!");
      setShowCreate(false);
      setForm({ supplier_id: "", order_date: today, expected_date: "", notes: "", items: [] });
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const totalVal = form.items.reduce((s, i) => s + (Number(i.quantity||0) * Number(i.unit_price||0)), 0);

  const inp  = { background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 13px", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%" };
  const th   = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", background: t.surface3 };
  const td   = { padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}` };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        {isAdmin && (
          <button onClick={() => { setShowCreate(true); setForm({ supplier_id: "", order_date: today, expected_date: "", notes: "", items: [{ drug_id: "", drug_name: "", quantity: "", unit_price: "" }] }); }}
            style={{ background: t.primary, border: "none", borderRadius: 12, padding: "11px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
            + New Purchase Order
          </button>
        )}
      </div>

      {loading ? <Spinner t={t} /> : (
        <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 18, overflow: "hidden" }}>
          {orders.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
              <p>No purchase orders yet. Create your first one.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["PO Number","Supplier","Order Date","Expected","Items","Total","Status",""].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ ...td, color: t.accent, fontFamily: "monospace", fontWeight: 700 }}>{o.po_number}</td>
                    <td style={td}>{o.supplier_name}</td>
                    <td style={{ ...td, color: t.textMuted }}>{fmtDate(o.order_date)}</td>
                    <td style={{ ...td, color: t.textMuted }}>{fmtDate(o.expected_date)}</td>
                    <td style={{ ...td, textAlign: "center", fontFamily: "monospace" }}>{o.item_count}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: t.accent }}>{fmt(o.total_amount)}</td>
                    <td style={td}><StatusBadge status={o.status} /></td>
                    <td style={td}>
                      <button onClick={() => api.getPurchaseOrder(o.id).then(setViewPO)}
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "5px 12px", color: "#3B82F6", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create PO Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(700px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>📋 New Purchase Order</div>
              <button onClick={() => setShowCreate(false)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 14px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Supplier *</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} style={inp}>
                    <option value="">— Select Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Order Date *</label>
                  <input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Expected Delivery</label>
                  <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." style={inp} />
                </div>
              </div>

              {/* Items */}
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Order Items</span>
                <button onClick={addItem} style={{ background: t.accent + "15", border: `1px solid ${t.accent}30`, borderRadius: 8, padding: "5px 12px", color: t.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add Item</button>
              </div>

              <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, padding: "12px 14px", borderBottom: i < form.items.length - 1 ? `1px solid ${t.border}` : "none", alignItems: "center" }}>
                    <div>
                      <select value={item.drug_id} onChange={e => updateItem(i, "drug_id", e.target.value)} style={{ ...inp, fontSize: 12 }}>
                        <option value="">— Drug / Product —</option>
                        {drugs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      {!item.drug_id && (
                        <input value={item.drug_name} onChange={e => updateItem(i, "drug_name", e.target.value)} placeholder="Or type name manually..." style={{ ...inp, marginTop: 6, fontSize: 12 }} />
                      )}
                    </div>
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="Qty" style={{ ...inp, fontSize: 12 }} />
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} placeholder="Unit cost" style={{ ...inp, fontSize: 12 }} />
                    <button onClick={() => removeItem(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "7px 10px", color: "#F87171", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ background: t.surface3, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Estimated Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: t.accent }}>{fmt(totalVal)}</span>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 11, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 2, background: saving ? t.surface3 : t.primary, border: "none", borderRadius: 11, padding: "12px 0", color: saving ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : t.glow }}>
                {saving ? "Creating…" : "📋 Create Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View PO Drawer */}
      {viewPO && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(560px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{viewPO.po_number}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{viewPO.supplier_name}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusBadge status={viewPO.status} />
                <button onClick={() => setViewPO(null)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 12px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[["Order Date", fmtDate(viewPO.order_date)], ["Expected", fmtDate(viewPO.expected_date)], ["Supplier Contact", viewPO.supplier_contact || "—"], ["Supplier Email", viewPO.supplier_email || "—"], ["Created By", viewPO.created_by_name || "—"], ["Total Value", fmt(viewPO.total_amount)]].map(([k,v]) => (
                  <div key={k} style={{ background: t.surface3, borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{v}</div>
                  </div>
                ))}
              </div>
              {viewPO.notes && <div style={{ background: t.surface3, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: t.textSub }}>{viewPO.notes}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Items Ordered</div>
              <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden" }}>
                {(viewPO.items || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < viewPO.items.length - 1 ? `1px solid ${t.border}` : "none" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.drug_name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>Received: {item.received_qty || 0} / {item.quantity}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: t.accent }}>{fmt(item.total_price)}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{item.quantity} × {fmt(item.unit_price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  GRN — GOODS RECEIVED NOTES
// ══════════════════════════════════════════════════════════════
function GRNList({ t, isAdmin, showToast }) {
  const [grns, setGrns]           = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders]       = useState([]);
  const [drugs, setDrugs]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewGRN, setViewGRN]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [poItems, setPOItems]     = useState([]);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ po_id: "", supplier_id: "", received_date: today, notes: "", items: [] });

  const load = () => {
    setLoading(true);
    Promise.all([api.getGRNs(), api.getSuppliers(), api.getPurchaseOrders(), api.getAdjustmentDrugs()])
      .then(([g, s, o, d]) => { setGrns(g); setSuppliers(s); setOrders(o.filter(o => o.status !== "cancelled" && o.status !== "received")); setDrugs(d); })
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // When PO selected, pre-fill items from PO
  const handlePOSelect = async (poId) => {
    setForm(f => ({ ...f, po_id: poId, items: [] }));
    setPOItems([]);
    if (!poId) return;
    const po = await api.getPurchaseOrder(poId);
    setForm(f => ({ ...f, po_id: poId, supplier_id: po.supplier_id,
      items: (po.items || []).map(i => ({
        drug_id: i.drug_id || "", drug_name: i.drug_name,
        po_item_id: i.id, ordered_qty: i.quantity,
        remaining: i.quantity - (i.received_qty || 0),
        received_qty: Math.max(0, i.quantity - (i.received_qty || 0)),
        batch_number: "", expiry_date: "", purchase_price: i.unit_price || "",
      }))
    }));
    setPOItems(po.items || []);
  };

  const addGRNItem = () => setForm(f => ({ ...f, items: [...f.items, { drug_id: "", drug_name: "", ordered_qty: 0, received_qty: "", batch_number: "", expiry_date: "", purchase_price: "" }] }));
  const removeGRNItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i) }));
  const updateGRNItem = (i, key, val) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [key]: val };
    if (key === "drug_id") {
      const d = drugs.find(d => d.id == val);
      if (d) items[i].drug_name = d.name;
    }
    return { ...f, items };
  });

  const handleCreate = async () => {
    if (!form.supplier_id) return showToast("Select a supplier", "error");
    const validItems = form.items.filter(i => i.drug_name && Number(i.received_qty) > 0);
    if (!validItems.length) return showToast("Add at least one received item with quantity > 0", "error");
    setSaving(true);
    try {
      await api.createGRN({ ...form, items: validItems });
      showToast("GRN created — stock updated!");
      setShowCreate(false);
      setForm({ po_id: "", supplier_id: "", received_date: today, notes: "", items: [] });
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const inp = { background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 12px", color: t.text, fontSize: 12, outline: "none", fontFamily: "inherit", width: "100%" };
  const th  = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left", background: t.surface3 };
  const td  = { padding: "12px 14px", fontSize: 13, color: t.text, borderBottom: `1px solid ${t.border}` };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
        {isAdmin && (
          <button onClick={() => { setShowCreate(true); setForm({ po_id: "", supplier_id: "", received_date: today, notes: "", items: [{ drug_id: "", drug_name: "", ordered_qty: 0, received_qty: "", batch_number: "", expiry_date: "", purchase_price: "" }] }); setPOItems([]); }}
            style={{ background: t.primary, border: "none", borderRadius: 12, padding: "11px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
            + Record Delivery (GRN)
          </button>
        )}
      </div>

      {loading ? <Spinner t={t} /> : (
        <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 18, overflow: "hidden" }}>
          {grns.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📦</div>
              <p>No deliveries recorded yet. Record your first GRN.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["GRN Number","Supplier","PO Ref","Received Date","Items","Status",""].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {grns.map(g => (
                  <tr key={g.id}
                    onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ ...td, color: t.accent, fontFamily: "monospace", fontWeight: 700 }}>{g.grn_number}</td>
                    <td style={td}>{g.supplier_name}</td>
                    <td style={{ ...td, color: t.textMuted, fontFamily: "monospace" }}>{g.po_number || "—"}</td>
                    <td style={{ ...td, color: t.textMuted }}>{fmtDate(g.received_date)}</td>
                    <td style={{ ...td, textAlign: "center", fontFamily: "monospace" }}>{g.item_count}</td>
                    <td style={td}><StatusBadge status={g.status} /></td>
                    <td style={td}>
                      <button onClick={() => api.getGRN(g.id).then(setViewGRN)}
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "5px 12px", color: "#3B82F6", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create GRN Drawer */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(760px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>📦 Record Delivery — GRN</div>
              <button onClick={() => setShowCreate(false)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 14px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ Close</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 12, color: "#22C55E" }}>
                ✅ Confirming this GRN will <strong>automatically add the received stock</strong> to your inventory.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Link to Purchase Order (optional)</label>
                  <select value={form.po_id} onChange={e => handlePOSelect(e.target.value)} style={{ ...inp, fontSize: 13 }}>
                    <option value="">— No PO (standalone delivery) —</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Supplier *</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} style={{ ...inp, fontSize: 13 }}>
                    <option value="">— Select Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Received Date *</label>
                  <input type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} style={{ ...inp, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Delivery notes..." style={{ ...inp, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Items Received</span>
                <button onClick={addGRNItem} style={{ background: t.accent + "15", border: `1px solid ${t.accent}30`, borderRadius: 8, padding: "5px 12px", color: t.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add Item</button>
              </div>

              <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${t.border}` }}>
                  {["Drug","Ordered","Received","Batch No.","Expiry",""].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</div>
                  ))}
                </div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 8, padding: "10px 14px", borderBottom: i < form.items.length - 1 ? `1px solid ${t.border}` : "none", alignItems: "center" }}>
                    <div>
                      {item.po_item_id ? (
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.drug_name}</div>
                      ) : (
                        <select value={item.drug_id} onChange={e => updateGRNItem(i, "drug_id", e.target.value)} style={inp}>
                          <option value="">— Select Drug —</option>
                          {drugs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, fontFamily: "monospace", textAlign: "center" }}>{item.ordered_qty || "—"}</div>
                    <input type="number" min="0" value={item.received_qty} onChange={e => updateGRNItem(i, "received_qty", e.target.value)} placeholder="0" style={{ ...inp, fontWeight: 700 }} />
                    <input value={item.batch_number} onChange={e => updateGRNItem(i, "batch_number", e.target.value)} placeholder="BATCH-001" style={inp} />
                    <input type="date" value={item.expiry_date} onChange={e => updateGRNItem(i, "expiry_date", e.target.value)} style={inp} />
                    <button onClick={() => removeGRNItem(i)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "7px 10px", color: "#F87171", fontSize: 13, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 11, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ flex: 2, background: saving ? t.surface3 : t.primary, border: "none", borderRadius: 11, padding: "12px 0", color: saving ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : t.glow }}>
                {saving ? "Saving…" : "📦 Confirm Delivery & Update Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View GRN Drawer */}
      {viewGRN && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ width: "min(540px,100%)", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>{viewGRN.grn_number}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>{viewGRN.supplier_name} · {viewGRN.po_number ? `PO: ${viewGRN.po_number}` : "No PO"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusBadge status={viewGRN.status} />
                <button onClick={() => setViewGRN(null)} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 12px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[["Received Date", fmtDate(viewGRN.received_date)], ["Created By", viewGRN.created_by_name || "—"]].map(([k,v]) => (
                  <div key={k} style={{ background: t.surface3, borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{v}</div>
                  </div>
                ))}
              </div>
              {viewGRN.notes && <div style={{ background: t.surface3, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: t.textSub }}>{viewGRN.notes}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Items Received</div>
              <div style={{ background: t.surface3, borderRadius: 12, overflow: "hidden" }}>
                {(viewGRN.items || []).map((item, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderBottom: i < viewGRN.items.length - 1 ? `1px solid ${t.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{item.drug_name}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: t.accent }}>{item.received_qty} units</span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, display: "flex", gap: 14 }}>
                      {item.batch_number && <span>Batch: {item.batch_number}</span>}
                      {item.expiry_date && <span>Exp: {fmtDate(item.expiry_date)}</span>}
                      {item.purchase_price > 0 && <span>Cost: {fmt(item.purchase_price)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

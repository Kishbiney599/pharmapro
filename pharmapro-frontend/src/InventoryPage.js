import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import { fmt, daysUntil } from "./themes";
import { GlassCard, Badge, Spinner, Toast, useToast, Field, Input, Sel, Modal, Btn } from "./components";
import StockImport from "./StockImport";

function DrugForm({ form, setForm, suppliers, modalMode, t }) {
  const CATS  = ["Antibiotics", "Analgesics", "Antidiabetics", "Cardiovascular", "Antimalarials", "Antacids", "Other"];
  const UNITS = ["Tabs", "Caps", "Syrup", "Injection", "Cream", "Drops"];
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Drug name — full width */}
      <div style={{ gridColumn: "1/-1" }}>
        <Field label="Drug Name *">
          <Input t={t} value={form.name} onChange={f("name")} placeholder="e.g. Amoxicillin 500mg" />
        </Field>
      </div>

      <Field label="Category">
        <Sel t={t} value={form.category} onChange={f("category")}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </Sel>
      </Field>

      <Field label="Unit">
        <Sel t={t} value={form.unit} onChange={f("unit")}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </Sel>
      </Field>

      <Field label="Unit Price (GH₵) *">
        <Input t={t} type="number" value={form.price} onChange={f("price")} placeholder="0.00" />
      </Field>

      <Field label="Reorder Level">
        <Input t={t} type="number" value={form.reorder_level} onChange={f("reorder_level")} />
      </Field>

      <Field label="Barcode">
        <Input t={t} value={form.barcode} onChange={f("barcode")} placeholder="GH001234" />
      </Field>

      <Field label="Supplier">
        <Sel t={t} value={form.supplier_id} onChange={f("supplier_id")}>
          <option value="">— None —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Sel>
      </Field>

      {/* Batch number — shown always */}
      <Field label={modalMode === "edit" ? "Batch Number (optional — add new batch)" : "Batch Number"}>
        <Input t={t} value={form.batch_number} onChange={f("batch_number")} placeholder="BATCH-001" />
      </Field>

      <Field label={modalMode === "edit" ? "Quantity (optional — add new batch)" : "Quantity *"}>
        <Input t={t} type="number" value={form.quantity} onChange={f("quantity")} placeholder="0" />
      </Field>

      <Field label={modalMode === "edit" ? "Expiry Date (optional — add new batch)" : "Expiry Date *"}>
        <Input t={t} type="date" value={form.expiry_date} onChange={f("expiry_date")} />
      </Field>

      <Field label="Purchase Price (GH₵)">
        <Input t={t} type="number" value={form.purchase_price} onChange={f("purchase_price")} placeholder="0.00" />
      </Field>

      {/* Edit mode notice */}
      {modalMode === "edit" && (
        <div style={{ gridColumn: "1/-1", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "11px 15px" }}>
          <p style={{ fontSize: 12, color: "#60a5fa", margin: 0 }}>
            ℹ️ Filling batch fields adds a new stock batch. Leave blank to only update drug details.
          </p>
        </div>
      )}
    </div>
  );
}

// == Confirmation dialog — also outside Inventory ==============
function ConfirmDialog({ confirm, setConfirm, t }) {
  if (!confirm) return null;
  const styles = {
    success: { accent: t.accent,  bg: t.accent + "15",       border: t.accent + "40",       icon: "✅" },
    warning: { accent: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", icon: "⚠️" },
    danger:  { accent: "#EF4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  icon: "🗑️" },
  };
  const c = styles[confirm.type] || styles.warning;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 22, padding: "36px 36px 30px", width: "min(480px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", animation: "fadeUp 0.2s ease" }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, background: c.bg, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 22px" }}>
          {c.icon}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: t.text, textAlign: "center", marginBottom: 12 }}>{confirm.title}</h3>
        <p style={{ fontSize: 14, color: t.textSub, textAlign: "center", lineHeight: 1.65, marginBottom: 28 }}>{confirm.message}</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setConfirm(null)}
            style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
            onMouseEnter={e => e.target.style.background = t.surface2}
            onMouseLeave={e => e.target.style.background = t.surface3}>
            Cancel
          </button>
          <button
            onClick={async () => { const fn = confirm.onConfirm; setConfirm(null); await fn(); }}
            style={{ flex: 1, background: c.accent, border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 4px 14px ${c.border}`, transition: "opacity 0.15s" }}
            onMouseEnter={e => e.target.style.opacity = "0.88"}
            onMouseLeave={e => e.target.style.opacity = "1"}>
            {confirm.type === "danger" ? "Yes, Delete" : "Yes, Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inventory({ t, user }) {
  const BLANK = { name: "", category: "Antibiotics", unit: "Tabs", price: "", reorder_level: 50, barcode: "", supplier_id: "", batch_number: "", quantity: "", expiry_date: "", purchase_price: "" };

  const [drugs, setDrugs]         = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDrugs, setTotalDrugs] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const LIMIT = 50;
  const [saving, setSaving]       = useState(false);
  const [toast, showToast]        = useToast();
  const [modalMode, setModalMode] = useState(null);
  const [editDrug, setEditDrug]   = useState(null);
  const [form, setForm]           = useState(BLANK);
  const [confirm, setConfirm]     = useState(null);
  const [loadingDrug, setLoadingDrug] = useState(false);
  const [showImport, setShowImport]   = useState(false);

  const CATEGORIES = ["Antibiotics","Analgesics","Antimalaria","Antifungals","Vitamins",
    "Antihistamines","Cardiovascular","Diabetes","Gastrointestinal","Respiratory",
    "Dermatology","Eye/Ear","OTC","Prescription","Other"];

  const load = useCallback((pg = page, srch = search, cat = category) => {
    setLoading(true);
    Promise.all([
      api.getDrugs({ page: pg, limit: LIMIT, search: srch, category: cat }),
      api.getSuppliers()
    ])
      .then(([res, s]) => {
        // Handle both old array response and new paginated response
        if (Array.isArray(res)) {
          setDrugs(res);
          setTotalDrugs(res.length);
          setTotalPages(1);
          setLowStockCount(res.filter(d => d.total_stock <= d.reorder_level).length);
        } else {
          setDrugs(res.drugs || []);
          setTotalDrugs(res.total || 0);
          setTotalPages(res.pages || 1);
          setLowStockCount((res.drugs||[]).filter(d => d.total_stock <= d.reorder_level).length);
        }
        setSuppliers(s);
      })
      .catch(e => showToast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [page, search, category]);

  useEffect(() => { load(1, search, category); }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search, category); }, 400);
    return () => clearTimeout(t);
  }, [search, category]);

  const openAdd = () => { setForm(BLANK); setEditDrug(null); setModalMode("add"); };
  const closeModal = () => { setModalMode(null); setEditDrug(null); setForm(BLANK); };

  // Open edit — fetch full drug data from DB to populate all fields
  const openEdit = async (drug) => {
    setLoadingDrug(true);
    setModalMode("edit");
    setEditDrug(drug);
    try {
      const full = await api.getDrug(drug.id);
      // Get most recent batch for pre-filling batch fields
      const latestBatch = full.batches && full.batches.length > 0
        ? full.batches[full.batches.length - 1]
        : null;
      setForm({
        name:           full.name          || "",
        category:       full.category      || "Antibiotics",
        unit:           full.unit          || "Tabs",
        price:          full.price         || "",
        reorder_level:  full.reorder_level || 50,
        barcode:        full.barcode       || "",
        supplier_id:    full.supplier_id   || "",
        batch_number:   latestBatch?.batch_number  || "",
        quantity:       "",  // blank — user fills if adding new batch
        expiry_date:    latestBatch?.expiry_date?.slice(0,10) || "",
        purchase_price: latestBatch?.purchase_price || "",
      });
    } catch (e) {
      showToast("Failed to load drug details: " + e.message, "error");
      setModalMode(null);
    } finally { setLoadingDrug(false); }
  };

  const showConfirmDialog = (title, message, onConfirm, type = "warning") => {
    setConfirm({ title, message, onConfirm, type });
  };

  // == Add ===================================================
  const handleAdd = () => {
    if (!form.name || !form.price || !form.quantity || !form.expiry_date)
      return showToast("Name, price, quantity and expiry date are required", "error");
    showConfirmDialog(
      "Add New Drug",
      `Add "${form.name}" to the inventory? This will be saved to the database.`,
      async () => {
        setSaving(true);
        try {
          await api.addDrug(form);
          showToast(`"${form.name}" added to inventory`);
          closeModal(); load();
        } catch (e) { showToast(e.message, "error"); }
        finally { setSaving(false); }
      },
      "success"
    );
  };

  // == Edit ==================================================
  const handleEdit = () => {
    if (!form.name || !form.price)
      return showToast("Name and price are required", "error");
    showConfirmDialog(
      "Save Changes",
      `Save changes to "${form.name}"? The updated details will be written to the database.`,
      async () => {
        setSaving(true);
        try {
          // Update drug master record
          await api.updateDrug(editDrug.id, {
            name:          form.name,
            category:      form.category,
            unit:          form.unit,
            price:         form.price,
            reorder_level: form.reorder_level,
            barcode:       form.barcode,
            supplier_id:   form.supplier_id || null,
          });
          // If batch fields filled in, add a new batch too
          if (form.quantity && form.expiry_date) {
            await api.addBatch(editDrug.id, {
              batch_number:   form.batch_number || null,
              quantity:       form.quantity,
              expiry_date:    form.expiry_date,
              purchase_price: form.purchase_price || null,
            });
          }
          showToast(`"${form.name}" updated successfully`);
          closeModal(); load();
        } catch (e) { showToast(e.message, "error"); }
        finally { setSaving(false); }
      },
      "warning"
    );
  };

  // == Delete ================================================
  const handleDelete = (drug) => {
    showConfirmDialog(
      "Delete Drug",
      `Permanently delete "${drug.name}"? All batches and stock records will be removed. Sales history will be preserved but the drug link will be cleared. This cannot be undone.`,
      async () => {
        try {
          await api.deleteDrug(drug.id);
          showToast(`"${drug.name}" deleted`);
          load();
        } catch (e) { showToast(e.message, "error"); }
      },
      "danger"
    );
  };

  const filtered = drugs; // Server-side filtering via pagination

  if (showImport)
    return <StockImport t={t} user={user} onBack={() => { setShowImport(false); load(); }} />;

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>
      <Toast msg={toast?.msg} type={toast?.type} t={t} />
      <ConfirmDialog confirm={confirm} setConfirm={setConfirm} t={t} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>Inventory Management</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>{totalDrugs} products · {lowStockCount} low stock this page</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowImport(true)}
            style={{ background: "linear-gradient(135deg,#3B82F6,#60a5fa)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(59,130,246,0.3)", display: "flex", alignItems: "center", gap: 8, fontFamily: t.font }}>
            📥 Import CSV
          </button>
          <button onClick={openAdd} style={{ background: t.primary, border: "none", borderRadius: 14, padding: "13px 26px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: t.glow, display: "flex", alignItems: "center", gap: 8, fontFamily: t.font }}>
            ➕ Add New Drug
          </button>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <GlassCard padding="14px 20px" hover={false} t={t} style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, color: t.textMuted }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or barcode…"
            style={{ flex: 1, minWidth: 180, background: "transparent", border: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: t.font }} />
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "6px 12px", color: category ? t.accent : t.textMuted, fontSize: 13, outline: "none", fontFamily: t.font, cursor: "pointer" }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || category) && (
            <button onClick={() => { setSearch(""); setCategory(""); }}
              style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: t.font }}>
              ✕ Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: t.textMuted, paddingLeft: 12, borderLeft: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
            {totalDrugs} total · Page {page}/{totalPages}
          </span>
        </div>
      </GlassCard>

      {/* ── Table ── */}
      {loading ? <Spinner t={t} /> : (
        <GlassCard padding="0" hover={false} t={t} style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.surface3 }}>
                  {["Product", "Category", "Stock", "Price", "Supplier", "Expiry", "Status", "Actions"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "14px 18px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const days = d.nearest_expiry ? daysUntil(d.nearest_expiry) : null;
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${t.border}`, transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, fontFamily: t.mono }}>{d.barcode || "—"}</div>
                      </td>
                      <td style={{ padding: "14px 18px" }}><Badge label={d.category || "—"} t={t} /></td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: d.total_stock <= 0 ? t.dangerColor : d.total_stock <= d.reorder_level ? t.warnColor : t.emerald, fontFamily: t.mono }}>{d.total_stock}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>{d.unit}</span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: t.mono, color: t.accent }}>{fmt(d.price)}</span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 13, color: t.textSub }}>{d.supplier_name || "—"}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: days !== null && days <= 30 ? t.dangerColor : days !== null && days <= 90 ? t.warnColor : t.text, fontFamily: t.mono }}>
                          {d.nearest_expiry ? d.nearest_expiry.slice(0, 10) : "—"}
                        </span>
                        {days !== null && days <= 90 && <span style={{ fontSize: 10, marginLeft: 6, color: days <= 0 ? t.dangerColor : t.warnColor }}>({days <= 0 ? "expired" : days + "d"})</span>}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {days !== null && days <= 0 ? <Badge label="EXPIRED" gradient={t.danger} /> :
                          d.total_stock <= d.reorder_level ? <Badge label="LOW STOCK" gradient={t.warning} /> :
                            <Badge label="IN STOCK" gradient={t.success} />}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => openEdit(d)}
                            style={{ background: t.accent + "18", border: `1px solid ${t.accent}35`, borderRadius: 8, padding: "6px 13px", color: t.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: t.font, transition: "all 0.15s", whiteSpace: "nowrap" }}
                            onMouseEnter={e => { e.currentTarget.style.background = t.accent + "30"; e.currentTarget.style.borderColor = t.accent; }}
                            onMouseLeave={e => { e.currentTarget.style.background = t.accent + "18"; e.currentTarget.style.borderColor = t.accent + "35"; }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleDelete(d)}
                            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 13px", color: "#EF4444", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: t.font, transition: "all 0.15s", whiteSpace: "nowrap" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; }}>
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "52px 18px", textAlign: "center", color: t.textMuted, fontSize: 14 }}>
                    <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>🔍</div>No products found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ── Add / Edit Modal ── */}
      {modalMode && (
        <Modal
          title={modalMode === "add" ? "Add New Drug" : `Edit Drug`}
          subtitle={modalMode === "add"
            ? "Fill in the drug details. You will confirm before saving."
            : `Editing: ${editDrug?.name} — Data loaded from database`}
          t={t} wide onClose={closeModal}
        >
          {loadingDrug ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 14px" }} />
              <p style={{ color: t.textMuted, fontSize: 13 }}>Loading drug data…</p>
            </div>
          ) : (
            <DrugForm form={form} setForm={setForm} suppliers={suppliers} modalMode={modalMode} t={t} />
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <Btn t={t} variant="ghost" onClick={closeModal}>Cancel</Btn>
            <Btn t={t} onClick={modalMode === "add" ? handleAdd : handleEdit} disabled={saving || loadingDrug}>
              {saving ? "Saving…" : modalMode === "add" ? "💾 Add Drug" : "💾 Save Changes"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20, paddingBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => { setPage(1); load(1, search, category); }} disabled={page === 1}
            style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 12px", color: page===1?t.textMuted:t.text, fontSize: 12, cursor: page===1?"not-allowed":"pointer", fontFamily: t.font }}>
            « First
          </button>
          <button onClick={() => { const p = page-1; setPage(p); load(p, search, category); }} disabled={page === 1}
            style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 14px", color: page===1?t.textMuted:t.text, fontSize: 13, cursor: page===1?"not-allowed":"pointer", fontFamily: t.font }}>
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const pg = start + i;
            return pg <= totalPages ? (
              <button key={pg} onClick={() => { setPage(pg); load(pg, search, category); }}
                style={{ background: pg===page?t.accent:t.surface3, border: `1px solid ${pg===page?t.accent:t.border}`, borderRadius: 8, padding: "7px 13px", color: pg===page?"#fff":t.text, fontSize: 13, fontWeight: pg===page?700:400, cursor: "pointer", fontFamily: t.font, minWidth: 36 }}>
                {pg}
              </button>
            ) : null;
          })}
          <button onClick={() => { const p = page+1; setPage(p); load(p, search, category); }} disabled={page === totalPages}
            style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 14px", color: page===totalPages?t.textMuted:t.text, fontSize: 13, cursor: page===totalPages?"not-allowed":"pointer", fontFamily: t.font }}>
            Next ›
          </button>
          <button onClick={() => { setPage(totalPages); load(totalPages, search, category); }} disabled={page === totalPages}
            style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 12px", color: page===totalPages?t.textMuted:t.text, fontSize: 12, cursor: page===totalPages?"not-allowed":"pointer", fontFamily: t.font }}>
            Last »
          </button>
          <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 8 }}>
            {(page-1)*LIMIT+1}–{Math.min(page*LIMIT, totalDrugs)} of {totalDrugs} drugs
          </span>
        </div>
      )}
    </div>
  );
}

export default Inventory;

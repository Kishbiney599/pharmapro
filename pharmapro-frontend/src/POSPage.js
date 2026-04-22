import { useState, useEffect, useRef } from "react";
import { api } from "./api";
import { fmt } from "./themes";
import { Badge, Toast, useToast, Spinner, GlassCard, Field, Input, Btn } from "./components";;

function POS({ t, user, posCart, setPosCart, posPayment, setPosPayment, posDiscount, setPosDiscount, posDiscountType, setPosDiscountType, posPhone, setPosPhone, autoPrint, toggleAutoPrint }) {
  const [drugs, setDrugs]             = useState([]);
  // Cart persisted via props from App
  const cart    = posCart    || [];
  const setCart = setPosCart || (() => {});
  const [search, setSearch]           = useState("");
  const payment    = posPayment    || "Cash";
  const setPayment = setPosPayment || (() => {});
  const phone    = posPhone    || "";
  const setPhone = setPosPhone || (() => {});
  const [receipt, setReceipt]         = useState(null);
  const [saving, setSaving]           = useState(false);
  const [toast, showToast]            = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [qtyDraft, setQtyDraft]       = useState({});
  const [searching, setSearching]     = useState(false);
  const [barcodeMode, setBarcodeMode]     = useState(false);
  const searchRef = useRef(null);
  const discount         = posDiscount     || "";
  const setDiscount      = setPosDiscount  || (() => {});
  const discountType     = posDiscountType || "percent";
  const setDiscountType  = setPosDiscountType || (() => {});


  // Server-side drug search with debounce
  useEffect(() => {
    // Load all drugs on startup (up to 50), then filter as user types
    api.getDrugs({ limit: 50 })
      .then(res => setDrugs(Array.isArray(res) ? res : (res.drugs || [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      // Show all drugs when search is empty
      api.getDrugs({ limit: 50 })
        .then(res => setDrugs(Array.isArray(res) ? res : (res.drugs || [])))
        .catch(() => {});
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api.getDrugs({ search: search.trim(), limit: 20 })
        .then(res => setDrugs(Array.isArray(res) ? res : (res.drugs || [])))
        .catch(e => showToast(e.message, "error"))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadDrugs = () => {
    api.getDrugs({ search: search.trim() || "", limit: 50 })
      .then(res => setDrugs(Array.isArray(res) ? res : (res.drugs || [])))
      .catch(() => {});
  };

  useEffect(() => {
    let buffer = "";
    let timer  = null;
    const handler = (e) => {
      if (!barcodeMode) return;
      if (e.key === "Enter" && buffer.length > 2) {
        api.getDrugByBarcode(buffer.trim())
          .then(drug => {
            if (drug.total_stock <= 0) showToast(`${drug.name} is out of stock`, "error");
            else { addToCart(drug); showToast(`Added ${drug.name} via barcode`); }
          })
          .catch(() => showToast(`No drug found for barcode: ${buffer}`, "error"));
        buffer = ""; clearTimeout(timer); return;
      }
      if (e.key.length === 1) { buffer += e.key; clearTimeout(timer); timer = setTimeout(() => { buffer = ""; }, 300); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearTimeout(timer); };
  }, [barcodeMode, drugs]);





  const results  = drugs.filter(d => search.length > 1 && (d.name.toLowerCase().includes(search.toLowerCase()) || (d.barcode && d.barcode.includes(search))) && d.total_stock > 0);
  const subtotal    = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmt = discount
    ? discountType === "percent"
      ? (subtotal * Math.min(100, Math.max(0, Number(discount))) / 100)
      : Math.min(subtotal, Math.max(0, Number(discount)))
    : 0;
  const finalTotal  = subtotal - discountAmt;

  const addToCart = (drug) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === drug.id);
      return ex ? prev.map(c => c.id === drug.id ? { ...c, qty: Math.min(c.qty + 1, drug.total_stock) } : c) : [...prev, { ...drug, qty: 1 }];
    });
    setSearch("");
  };

  const handleQtyChange = (id, raw) => {
    setQtyDraft(prev => ({ ...prev, [id]: raw }));
    const num = parseInt(raw, 10);
    if (isNaN(num) || num <= 0) return;
    const drug = drugs.find(d => d.id === id);
    const max  = drug ? drug.total_stock : 9999;
    setCart(p => p.map(x => x.id === id ? { ...x, qty: Math.min(num, max) } : x));
  };

  const handleQtyBlur = (id) => {
    setQtyDraft(prev => {
      const draft = prev[id];
      const num   = parseInt(draft, 10);
      if (!draft || isNaN(num) || num <= 0) setCart(p => p.map(x => x.id === id ? { ...x, qty: 1 } : x));
      const next = { ...prev }; delete next[id]; return next;
    });
  };

  const stepQty = (id, delta) => {
    const drug = drugs.find(d => d.id === id);
    const max  = drug ? drug.total_stock : 9999;
    setCart(p => p.map(x => x.id === id ? { ...x, qty: Math.max(1, Math.min(x.qty + delta, max)) } : x).filter(x => x.qty > 0));
  };

  const requestCompleteSale = () => { if (!cart.length) return; setShowConfirm(true); };

  const printReceipt = (receiptData) => {
    const settings  = JSON.parse(localStorage.getItem("pharmapro_settings") || "{}");
    const pharmName = settings.pharmacy_name || localStorage.getItem("pharmapro_name") || "PharmaPro Enterprise";
    const phone     = settings.phone    || "";
    const email     = settings.email    || "";
    const address   = settings.address  || "";
    const city      = settings.city     || "";
    const tagline   = settings.tagline  || "Your health is our priority";
    const logoB64   = settings.logo_base64 || "";
    const now       = new Date();
    const dateStr   = now.toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr   = now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });

    const itemRows = receiptData.items.map(i => {
      const name = i.name.length > 22 ? i.name.slice(0, 22) + "..." : i.name;
      return `<tr><td colspan="3" style="padding:2px 0;font-size:12px;font-weight:600">${name}</td></tr>
              <tr><td style="font-size:11px;color:#555">x${i.qty} @ GH&#8373;${Number(i.price).toFixed(2)}</td><td></td>
                  <td style="text-align:right;font-size:12px;font-weight:700">GH&#8373;${(Number(i.price)*Number(i.qty)).toFixed(2)}</td></tr>`;
    }).join("");

    const contactLines = [
      phone   && `📞 ${phone}`,
      email   && `✉ ${email}`,
      address && `📍 ${address}${city ? ", " + city : ""}`,
    ].filter(Boolean).map(l => `<div class="center small">${l}</div>`).join("");

    const discountRow = receiptData.discount > 0
      ? `<tr><td class="small">Discount:</td><td></td><td class="small" style="text-align:right;color:#e53e3e">-GH&#8373;${Number(receiptData.discount).toFixed(2)}</td></tr>`
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${receiptData.sale_ref}</title>
      <style>
        @page{size:80mm auto;margin:0}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Courier New',monospace;font-size:12px;color:#000;width:80mm;padding:4mm 5mm 8mm;background:#fff}
        .center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}.small{font-size:10px;color:#444}
        .divider{border:none;border-top:1px dashed #000;margin:5px 0}
        .divider-solid{border:none;border-top:2px solid #000;margin:5px 0}
        table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}
        .total-row td{font-size:15px;font-weight:bold;padding-top:5px}
        .total-row td:last-child{text-align:right}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>

      ${logoB64 ? `<div class="center" style="margin-bottom:6px"><img src="${logoB64}" style="max-width:120px;max-height:60px;object-fit:contain" /></div>` : ""}
      <div class="center bold large" style="margin-bottom:3px;font-size:17px">${pharmName}</div>
      <div class="center small" style="margin-bottom:2px;font-style:italic">${tagline}</div>
      ${contactLines}
      <hr class="divider-solid" style="margin-top:6px">

      <table style="margin:5px 0">
        <tr><td class="small">Receipt#:</td><td class="small bold" style="text-align:right">${receiptData.sale_ref}</td></tr>
        <tr><td class="small">Date:</td><td class="small" style="text-align:right">${dateStr}</td></tr>
        <tr><td class="small">Time:</td><td class="small" style="text-align:right">${timeStr}</td></tr>
        <tr><td class="small">Cashier:</td><td class="small" style="text-align:right">${receiptData.cashier || JSON.parse(localStorage.getItem("pharmapro_user")||"{}").name || "—"}</td></tr>
        <tr><td class="small">Payment:</td><td class="small bold" style="text-align:right">${receiptData.payment}</td></tr>
      </table>
      <hr class="divider">

      <table style="margin-bottom:5px">
        <tr><td class="small bold">ITEM</td><td></td><td class="small bold" style="text-align:right">AMOUNT</td></tr>
        <tr><td colspan="3"><hr class="divider"></td></tr>
        ${itemRows}
      </table>
      <hr class="divider">

      <table style="margin-bottom:6px">
        <tr><td class="small">Subtotal:</td><td></td><td class="small" style="text-align:right">GH&#8373;${Number(receiptData.total).toFixed(2)}</td></tr>
        ${discountRow}
        <tr class="total-row"><td>TOTAL</td><td></td><td>GH&#8373;${Number(receiptData.finalTotal || receiptData.total).toFixed(2)}</td></tr>
      </table>
      <hr class="divider-solid">

      <div class="center small" style="margin-top:8px">Goods sold are not returnable without receipt</div>
      <div class="center bold small" style="margin-top:4px">*** Thank You — Come Again! ***</div>
      <div class="center small" style="margin-top:6px;color:#999">${pharmName}</div>
      </body></html>`;

    const win = window.open("", "_blank", "width=320,height=600");
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
  };

  const completeSale = async () => {
    setShowConfirm(false); setSaving(true);
    try {
      const items  = cart.map(c => ({ drug_id: c.id, qty: c.qty, unit_price: c.price }));
      const result = await api.createSale({ items, payment_method: payment, customer_phone: phone || null });
      const receiptData = { ...result, items: cart, payment, total: subtotal, discount: discountAmt, finalTotal };
      setReceipt(receiptData); setCart([]); setPhone(""); setDiscount(""); loadDrugs();
      showToast(`Sale ${result.sale_ref} saved`);
      if (autoPrint) printReceipt(receiptData);
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const payOpts = [
    { id: "Cash", icon: "💵", label: "Cash" },
    { id: "MoMo", icon: "📱", label: "Mobile Money" },
    { id: "POS",  icon: "💳", label: "POS / Card" },
  ];

  if (receipt) {
    return (
      <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>
        <Toast msg={toast?.msg} type={toast?.type} t={t} />
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <GlassCard padding="36px" t={t} hover={false}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.accent, marginBottom: 4 }}>Sale Complete!</div>
              <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 4 }}>{receipt.sale_ref}</p>
              <p style={{ color: t.textMuted, fontSize: 12, marginBottom: 24 }}>Saved to database · Stock updated · Receipt printed</p>
              <div style={{ background: t.surface3, borderRadius: 14, padding: 18, textAlign: "left", marginBottom: 24 }}>
                {receipt.items.map(i => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: t.text }}>{i.name} <span style={{ color: t.textMuted }}>x{i.qty}</span></span>
                    <span style={{ fontSize: 13, fontFamily: t.mono, color: t.textSub }}>{fmt(i.price * i.qty)}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ color: t.text }}>Total</strong>
                  <span style={{ fontFamily: t.mono, fontSize: 18, fontWeight: 800, color: t.accent }}>{fmt(receipt.total)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => printReceipt(receipt)}
                  style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "11px 0", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  Reprint
                </button>
                <Btn t={t} onClick={() => setReceipt(null)} style={{ flex: 1 }}>New Sale</Btn>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: t.font, overflow: "hidden" }}>
      <Toast msg={toast?.msg} type={toast?.type} t={t} />

      {/* Left — Drug Search & Cart */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px 20px", overflowY: "auto" }}>



        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search drugs by name or barcode..." autoFocus
                style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 16 }}>x</button>
              )}
            </div>
            {searching && (
              <div style={{ display:"flex", alignItems:"center", padding:"0 8px", color:t.textMuted, fontSize:11 }}>
                <div style={{ width:14, height:14, border:`2px solid ${t.border}`, borderTopColor:t.accent, borderRadius:"50%", animation:"spin .6s linear infinite", marginRight:5 }} />
                Searching...
              </div>
            )}
            <button onClick={() => setBarcodeMode(b => !b)}
              title={barcodeMode ? "Barcode scanner: ON" : "Click to enable barcode scanner"}
              style={{ background: barcodeMode ? "rgba(59,130,246,0.15)" : t.surface3, border: `1px solid ${barcodeMode ? "rgba(59,130,246,0.4)" : t.border}`, borderRadius: 8, padding: "5px 12px", color: barcodeMode ? "#3B82F6" : t.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span>📷</span> {barcodeMode ? "Barcode: ON" : "Barcode: OFF"}
            </button>
            <button onClick={toggleAutoPrint}
              title={autoPrint ? "Auto-print is ON — click to disable" : "Auto-print is OFF — click to enable"}
              style={{ background: autoPrint ? "rgba(34,197,94,0.15)" : t.surface3, border: `1px solid ${autoPrint ? "rgba(34,197,94,0.4)" : t.border}`, borderRadius: 8, padding: "5px 12px", color: autoPrint ? "#22C55E" : t.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span>🖨️</span> {autoPrint ? "Print: ON" : "Print: OFF"}
            </button>
          </div>
          {results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 40, background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 100, maxHeight: 280, overflowY: "auto" }}>
              {results.map(d => (
                <div key={d.id} onClick={() => addToCart(d)}
                  style={{ padding: "11px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${t.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{d.category} · {d.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, fontFamily: t.mono }}>{fmt(d.price)}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>{d.total_stock} in stock</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        {cart.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🛒</div>
            <p style={{ fontSize: 14 }}>No drugs found — try a different search</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cart.map(c => {
              const maxQty  = drugs.find(d => d.id === c.id)?.total_stock || 9999;
              const draftVal = qtyDraft[c.id] !== undefined ? qtyDraft[c.id] : String(c.qty);
              return (
                <GlassCard key={c.id} padding="16px 18px" t={t}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{fmt(c.price)} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => stepQty(c.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, background: t.surface3, border: `1px solid ${t.border}`, color: t.text, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                      <input type="number" min="1" max={maxQty} value={draftVal}
                        onChange={e => handleQtyChange(c.id, e.target.value)}
                        onBlur={() => handleQtyBlur(c.id)}
                        style={{ width: 50, textAlign: "center", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 4px", color: t.text, fontSize: 14, fontFamily: "monospace", fontWeight: 700, outline: "none" }} />
                      <button onClick={() => stepQty(c.id, 1)} disabled={c.qty >= maxQty} style={{ width: 28, height: 28, borderRadius: 8, background: c.qty >= maxQty ? t.surface3 : t.accent, border: "none", color: "#fff", fontSize: 16, cursor: c.qty >= maxQty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: c.qty >= maxQty ? 0.4 : 1 }}>+</button>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: t.accent, fontFamily: t.mono, minWidth: 80, textAlign: "right" }}>{fmt(c.price * c.qty)}</div>
                    <button onClick={() => setCart(p => p.filter(x => x.id !== c.id))} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", color: "#F87171", fontSize: 12, cursor: "pointer" }}>✕</button>
                  </div>
                  {c.qty >= maxQty && (
                    <div style={{ marginTop: 6, fontSize: 11, color: t.warnColor, display: "flex", alignItems: "center", gap: 4 }}>
                      Max stock reached ({maxQty} {c.unit})
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Right — Checkout */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(16px)", borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", width: 320, flexShrink: 0, height: "100%", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, marginBottom: 16 }}>Checkout</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>

        <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: t.textMuted, fontSize: 14 }}>Items</span>
            <span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>{cart.reduce((s, c) => s + c.qty, 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
            <span style={{ color: t.text, fontWeight: 700, fontSize: 15 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: t.mono, color: t.accent }}>{fmt(subtotal)}</span>
          </div>
        </div>

        {/* Discount */}
        <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Discount (optional)</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
              {["percent", "fixed"].map(type => (
                <button key={type} onClick={() => setDiscountType(type)}
                  style={{ padding: "7px 12px", border: "none", background: discountType === type ? t.accent : "transparent", color: discountType === type ? "#fff" : t.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {type === "percent" ? "%" : "GH₵"}
                </button>
              ))}
            </div>
            <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
              placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 5.00"}
              style={{ flex: 1, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 12px", color: t.text, fontSize: 14, fontFamily: "monospace", fontWeight: 700, outline: "none" }} />
          </div>
          {discountAmt > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#22C55E", fontWeight: 600 }}>
              Saving: {fmt(discountAmt)} — New total: {fmt(finalTotal)}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Payment Method</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {payOpts.map(p => (
              <button key={p.id} onClick={() => setPayment(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 15px", borderRadius: 12,
                  border: `1.5px solid ${payment === p.id ? t.accent : t.border}`,
                  background: payment === p.id ? t.accent + "15" : "transparent",
                  cursor: "pointer", transition: "all 0.2s", fontFamily: t.font }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${payment === p.id ? t.accent : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {payment === p.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent }} />}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: payment === p.id ? t.accent : t.textSub }}>{p.icon} {p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {payment === "MoMo" && (
          <div style={{ marginBottom: 20 }}>
            <Field label="Customer Phone">
              <Input t={t} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233 XX XXX XXXX" />
            </Field>
          </div>
        )}

        <button onClick={requestCompleteSale} disabled={saving || !cart.length}
          style={{ background: cart.length ? t.primary : t.surface3, border: "none",
            borderRadius: 14, padding: 16, color: cart.length ? "#fff" : t.textMuted,
            fontSize: 15, fontWeight: 800, cursor: cart.length ? "pointer" : "not-allowed",
            boxShadow: cart.length ? t.glow : "none", transition: "all 0.2s", fontFamily: t.font, width: "100%", marginTop: 8 }}>
          {saving ? "Processing..." : cart.length ? `Complete Sale · ${fmt(finalTotal)}` : "Add items to checkout"}
        </button>
        </div>{/* end scrollable */}
      </div>

      {/* Confirm Sale Dialog */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 20, padding: "32px", width: "min(420px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", animation: "fadeUp .2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: t.text, marginBottom: 8 }}>Confirm Sale</div>
              <p style={{ fontSize: 13, color: t.textMuted }}>{cart.length} item(s) · Total: <strong style={{ color: t.accent }}>{fmt(finalTotal)}</strong>{discountAmt > 0 ? ` (Disc: ${fmt(discountAmt)})` : ''} · {payment}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirm(false)}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={completeSale}
                style={{ flex: 2, background: t.primary, border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================
//  SUPPLIERS
// ==============================
// Suppliers is now imported from Suppliers.js

// ==============================
//  STAFF
// ==============================
export default POS;

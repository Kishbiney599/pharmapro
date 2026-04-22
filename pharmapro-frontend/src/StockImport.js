import { useState, useRef } from "react";
import { api } from "./api";

// ── CSV template columns ──────────────────────────────────────
const TEMPLATE_HEADERS = [
  "name", "category", "unit", "price", "reorder_level",
  "barcode", "supplier", "batch_number", "quantity",
  "expiry_date", "purchase_price"
];

const TEMPLATE_EXAMPLE_ROWS = [
  ["Amoxicillin 500mg", "Antibiotics", "Caps", "5.50", "50", "GH001234", "MedSupply Ltd", "BATCH-001", "200", "2026-12-31", "3.20"],
  ["Paracetamol 500mg", "Analgesics",  "Tabs", "2.00", "100","GH001235", "PharmaCo",      "BATCH-002", "500", "2027-06-30", "1.10"],
  ["Metformin 500mg",   "Antidiabetics","Tabs","8.00", "30", "",         "",               "BATCH-003", "150", "2026-09-15", "5.00"],
];

const REQUIRED = ["name", "price", "quantity", "expiry_date"];

const CATEGORIES = ["Antibiotics","Analgesics","Antidiabetics","Cardiovascular","Antimalarials","Antacids","Other"];
const UNITS      = ["Tabs","Caps","Syrup","Injection","Cream","Drops"];

// ── Parse CSV string ──────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("File must have a header row and at least one data row");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase()
    .replace(/ /g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (vals[i] || "").replace(/^"|"$/g, "").trim();
      });
      return obj;
    });
}

// ── Download CSV template ─────────────────────────────────────
function downloadTemplate() {
  const header = TEMPLATE_HEADERS.join(",");
  const rows   = TEMPLATE_EXAMPLE_ROWS.map(r => r.join(","));
  const csv    = [header, ...rows].join("\r\n");
  const blob   = new Blob([csv], { type: "text/csv" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href = url; a.download = "pharmapro_stock_import_template.csv";
  a.click(); URL.revokeObjectURL(url);
}

// ── Validate a single row ─────────────────────────────────────
function validateRow(row, i) {
  const errors = [];
  const name = (row.name || row["drug_name"] || "").trim();
  if (!name) errors.push("Drug name required");
  const price = parseFloat(row.price || row["unit_price"] || 0);
  if (!price || price <= 0) errors.push("Valid price required");
  const qty = parseInt(row.quantity || 0, 10);
  if (!qty || qty <= 0) errors.push("Valid quantity required");
  const exp = (row.expiry_date || row.expiry || "").trim();
  if (!exp) errors.push("Expiry date required");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) errors.push("Expiry must be YYYY-MM-DD");
  return errors;
}

export default function StockImport({ t, user, onBack }) {
  const [step, setStep]           = useState(1); // 1=upload 2=preview 3=result
  const [rows, setRows]           = useState([]);
  const [fileName, setFileName]   = useState("");
  const [parseError, setParseError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef();

  const isAuthorised = ["admin","super admin","pharmacist"].includes((user?.role||"").toLowerCase());

  // ── File processing ───────────────────────────────────────
  const processFile = (file) => {
    setParseError(null);
    setRows([]);
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv","txt"].includes(ext))
      return setParseError("Only CSV files are supported. Download the template to get started.");

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        if (parsed.length === 0) return setParseError("No data rows found in file.");
        setRows(parsed);
        setStep(2);
      } catch (err) { setParseError(err.message); }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  // ── Import ────────────────────────────────────────────────
  const handleImport = async () => {
    const valid = rows.filter((r, i) => validateRow(r, i).length === 0);
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const res = await api.bulkImportDrugs(valid);
      setResult(res);
      setStep(3);
    } catch (e) {
      setResult({ success: false, message: e.message, errors: [{ error: e.message }] });
      setStep(3);
    } finally { setImporting(false); }
  };

  // ── Styles ────────────────────────────────────────────────
  const card   = { background: t.cardBg, border: t.cardBorder, borderRadius: 20 };
  const th     = { padding: "11px 14px", fontSize: 11, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#22C55E,#16a34a)", textAlign: "left", whiteSpace: "nowrap", letterSpacing: 0.7 };
  const td     = (c) => ({ padding: "11px 14px", fontSize: 12, color: t.text, borderBottom: `1px solid ${t.border}`, ...c });

  const validRows   = rows.filter((r,i) => validateRow(r,i).length === 0);
  const invalidRows = rows.filter((r,i) => validateRow(r,i).length > 0);

  // ── Step indicators ───────────────────────────────────────
  const Step = ({ n, label, active, done }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? t.accent : active ? t.accent : t.surface3, border: `2px solid ${done || active ? t.accent : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: done || active ? "#fff" : t.textMuted, flexShrink: 0 }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: done || active ? t.text : t.textMuted }}>{label}</span>
    </div>
  );
  const StepLine = () => <div style={{ flex: 1, height: 2, background: t.border, margin: "0 8px" }} />;

  return (
    <div style={{ height: "100%", overflowY: "auto", fontFamily: t.font, background: t.bg }}>

      {/* ── Header ── */}
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}`, padding: "15px 32px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={onBack} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 16px", color: t.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: t.accent }}>📥 Import Stock via CSV</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Upload a CSV file to add or update multiple drugs at once</div>
        </div>
        <button onClick={downloadTemplate}
          style={{ background: "linear-gradient(135deg,#3B82F6,#60a5fa)", border: "none", borderRadius: 12, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(59,130,246,0.3)" }}>
          ⬇️ Download Template
        </button>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Unauthorised notice ── */}
        {!isAuthorised && (
          <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }}>🔒</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#FBBF24" }}>Access Restricted</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>Only Admins, Super Admins and Pharmacists can import stock. Contact your administrator.</div>
            </div>
          </div>
        )}

        {/* ── Step Indicator ── */}
        <div style={{ ...card, padding: "20px 28px", marginBottom: 24, display: "flex", alignItems: "center" }}>
          <Step n={1} label="Upload File" active={step === 1} done={step > 1} />
          <StepLine />
          <Step n={2} label="Review & Validate" active={step === 2} done={step > 2} />
          <StepLine />
          <Step n={3} label="Import Complete" active={step === 3} done={false} />
        </div>

        {/* ══════════ STEP 1 — Upload ══════════ */}
        {step === 1 && (
          <>
            {/* Instructions card */}
            <div style={{ ...card, padding: "24px 28px", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>📋 How to Import</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { step: "1", icon: "⬇️", title: "Download Template",    desc: "Click the Download Template button above to get the correct CSV format with example data." },
                  { step: "2", icon: "✏️", title: "Fill in Your Data",    desc: "Open the file in Excel or Google Sheets. Fill in your drug data following the column format." },
                  { step: "3", icon: "📤", title: "Upload & Import",      desc: "Upload the filled CSV here. Review the preview, fix any errors, then click Import." },
                ].map(s => (
                  <div key={s.step} style={{ background: t.surface3, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accent + "20", border: `1px solid ${t.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 5 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.55 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Column reference */}
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>Column Reference</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {[
                  { col: "name",           req: true,  desc: "Drug name (e.g. Amoxicillin 500mg)" },
                  { col: "price",          req: true,  desc: "Selling price per unit in GH₵" },
                  { col: "quantity",       req: true,  desc: "Quantity for this batch" },
                  { col: "expiry_date",    req: true,  desc: "Format: YYYY-MM-DD (e.g. 2026-12-31)" },
                  { col: "category",       req: false, desc: `${CATEGORIES.join(", ")}` },
                  { col: "unit",           req: false, desc: `${UNITS.join(", ")}` },
                  { col: "reorder_level",  req: false, desc: "Min qty before low stock alert (default 50)" },
                  { col: "barcode",        req: false, desc: "Barcode / product code" },
                  { col: "supplier",       req: false, desc: "Exact supplier name as in system" },
                  { col: "batch_number",   req: false, desc: "Batch / lot number" },
                  { col: "purchase_price", req: false, desc: "Cost price in GH₵" },
                ].map(c => (
                  <div key={c.col} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: t.surface3, borderRadius: 10, padding: "10px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: c.req ? t.accent : t.infoColor, background: (c.req ? t.accent : t.infoColor) + "15", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>{c.col}</span>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: c.req ? t.accent : t.textMuted, marginRight: 6 }}>{c.req ? "REQUIRED" : "optional"}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{c.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDrop={isAuthorised ? handleFileDrop : undefined}
              onDragOver={e => { e.preventDefault(); if (isAuthorised) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => isAuthorised && fileRef.current.click()}
              style={{
                ...card,
                padding: "60px 40px", textAlign: "center", cursor: isAuthorised ? "pointer" : "not-allowed",
                border: `2px dashed ${dragOver ? t.accent : t.border}`,
                background: dragOver ? t.accent + "08" : t.cardBg,
                transition: "all 0.2s",
                opacity: isAuthorised ? 1 : 0.5,
              }}>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: "none" }} />
              <div style={{ fontSize: 52, marginBottom: 16 }}>{dragOver ? "📂" : "📤"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                {isAuthorised ? "Drop your CSV file here" : "Authorised users only"}
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
                or click to browse · CSV format only
              </div>
              {isAuthorised && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.accent, border: "none", borderRadius: 12, padding: "11px 24px", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  📁 Browse File
                </div>
              )}
              {parseError && (
                <div style={{ marginTop: 20, background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "12px 18px", color: "#F87171", fontSize: 13 }}>
                  ⚠️ {parseError}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ STEP 2 — Preview ══════════ */}
        {step === 2 && (
          <>
            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { icon: "📄", label: "Total Rows",     value: rows.length,         color: t.accent,  bg: t.accent + "12"          },
                { icon: "✅", label: "Ready to Import", value: validRows.length,    color: "#22C55E", bg: "rgba(34,197,94,0.1)"    },
                { icon: "⚠️", label: "Rows with Errors",value: invalidRows.length, color: "#F59E0B", bg: "rgba(245,158,11,0.1)"   },
              ].map((c,i) => (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}25`, borderRadius: 16, padding: "18px 22px" }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Error list */}
            {invalidRows.length > 0 && (
              <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24", marginBottom: 12 }}>⚠️ {invalidRows.length} row(s) have errors and will be skipped:</div>
                {rows.map((r, i) => {
                  const errs = validateRow(r, i);
                  if (!errs.length) return null;
                  return (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: "#FBBF24", fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>Row {i + 2}:</span>
                      <span style={{ color: "#94A3B8" }}>{r.name || "(unnamed)"} — {errs.join(", ")}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Preview table */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview — {fileName}</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>Showing all {rows.length} rows · green = valid · red = will be skipped</span>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>#</th>
                      {TEMPLATE_HEADERS.map(h => <th key={h} style={th}>{h}</th>)}
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const errs = validateRow(r, i);
                      const ok   = errs.length === 0;
                      return (
                        <tr key={i} style={{ background: ok ? "transparent" : "rgba(239,68,68,0.05)" }}>
                          <td style={td({ color: t.textMuted })}>{i + 2}</td>
                          {TEMPLATE_HEADERS.map(h => (
                            <td key={h} style={td({ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: REQUIRED.includes(h) && !r[h] ? "#F87171" : t.text })}>
                              {r[h] || <span style={{ color: t.textMuted, fontStyle: "italic" }}>—</span>}
                            </td>
                          ))}
                          <td style={td()}>
                            {ok
                              ? <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "3px 10px" }}>✓ Valid</span>
                              : <span title={errs.join(", ")} style={{ fontSize: 11, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#F87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "3px 10px", cursor: "help" }}>⚠ {errs[0]}</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setStep(1); setRows([]); setFileName(""); }}
                style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 24px", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ← Re-upload
              </button>
              <button onClick={handleImport} disabled={importing || validRows.length === 0}
                style={{ background: validRows.length > 0 ? t.primary : t.surface3, border: "none", borderRadius: 12, padding: "12px 28px", color: validRows.length > 0 ? "#fff" : t.textMuted, fontSize: 14, fontWeight: 700, cursor: validRows.length > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: validRows.length > 0 ? t.glow : "none", display: "flex", alignItems: "center", gap: 8 }}>
                {importing
                  ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Importing...</>
                  : `📥 Import ${validRows.length} Item${validRows.length !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          </>
        )}

        {/* ══════════ STEP 3 — Result ══════════ */}
        {step === 3 && result && (
          <div style={{ ...card, padding: "52px 40px", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>{result.success ? "✅" : "❌"}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: result.success ? t.accent : "#EF4444", marginBottom: 10 }}>
              {result.success ? "Import Successful!" : "Import Failed"}
            </div>
            <div style={{ fontSize: 15, color: t.textSub, marginBottom: 28, lineHeight: 1.6 }}>{result.message}</div>

            {result.success && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 500, margin: "0 auto 32px" }}>
                {[
                  { label: "Imported",   value: result.success, color: t.accent  },
                  { label: "Skipped",    value: result.skipped, color: "#F59E0B" },
                  { label: "Total Rows", value: rows.length,    color: t.textSub },
                ].map((c,i) => (
                  <div key={i} style={{ background: t.surface3, borderRadius: 14, padding: "16px" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, fontWeight: 600 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {result.errors?.length > 0 && (
              <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left", maxWidth: 600, margin: "0 auto 24px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24", marginBottom: 10 }}>Skipped rows:</div>
                {result.errors.slice(0, 8).map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>• Row {e.row}: {e.drug ? `${e.drug} — ` : ""}{e.error}</div>
                ))}
                {result.errors.length > 8 && <div style={{ fontSize: 12, color: "#64748B" }}>+{result.errors.length - 8} more...</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setStep(1); setRows([]); setFileName(""); setResult(null); }}
                style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 24px", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Import Another File
              </button>
              <button onClick={onBack}
                style={{ background: t.primary, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: t.glow }}>
                Back to Inventory →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

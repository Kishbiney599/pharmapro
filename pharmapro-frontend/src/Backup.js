import { useState, useEffect, useRef } from "react";
import { Spinner, Toast, Modal } from "./components";
import { api } from "./api";

const fmtSize = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
};

const fmtDT = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

export default function Backup({ t, user }) {
  const [backups, setBackups]         = useState([]);
  const [autoStatus, setAutoStatus]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [restoring, setRestoring]     = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [toast, setToast]             = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const fileRef = useRef();

  const isAdmin = ["admin", "super admin"].includes((user?.role || "").toLowerCase());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [list, auto] = await Promise.all([api.getBackupList(), api.getAutoStatus()]);
      setBackups(list.backups || []);
      setAutoStatus(auto);
    } catch(e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Create backup ─────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.createBackup();
      showToast(`✅ Backup created: ${res.filename} (${fmtSize(res.size)})`);
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setCreating(false); }
  };

  // ── Download backup ───────────────────────────────────────
  const handleDownload = (filename) => {
    const url = api.getBackupDownloadUrl(filename);
    const a   = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  // ── Delete backup ─────────────────────────────────────────
  const handleDelete = async (filename) => {
    setDeletingId(filename);
    try {
      await api.deleteBackup(filename);
      showToast("Backup deleted");
      setConfirmDelete(null);
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setDeletingId(null); }
  };

  // ── Upload & parse backup file ────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".pharmabackup") && !file.name.endsWith(".json")) {
      return showToast("Please select a valid .pharmabackup file", "error");
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.tables || !data.version)
          return showToast("Invalid backup file format", "error");
        setRestorePreview(data);
        setConfirmRestore(data);
      } catch { showToast("Could not read backup file — file may be corrupted", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Restore ───────────────────────────────────────────────
  const handleRestore = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    try {
      const res = await api.restoreBackup(confirmRestore);
      showToast(`✅ Database restored successfully from backup`);
      setConfirmRestore(null);
      setRestorePreview(null);
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setRestoring(false); }
  };

  const cardStyle = { background: t.cardBg, border: t.cardBorder, borderRadius: 20, padding: "24px 28px", marginBottom: 20 };

  const manualBackups = backups.filter(b => !b.filename.includes("_AUTO_"));
  const autoBackups   = backups.filter(b =>  b.filename.includes("_AUTO_"));

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>
      <Toast msg={toast?.msg} type={toast?.type} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>💾 Backup & Restore</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Protect your data — backups save to <code style={{ background: t.surface3, padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>Documents/PharmaPro Backups</code></p>
        </div>
        {isAdmin && (
          <button onClick={handleCreate} disabled={creating}
            style={{ background: creating ? t.surface3 : t.primary, border: "none", borderRadius: 14, padding: "13px 24px", color: creating ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: creating ? "none" : t.glow, display: "flex", alignItems: "center", gap: 8 }}>
            {creating
              ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Creating…</>
              : "💾 Create Backup Now"}
          </button>
        )}
      </div>

      {!isAdmin && (
        <div style={{ background: "#3B1F0D", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FBBF24" }}>Admin Access Required</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Only Admins can create or restore backups.</div>
          </div>
        </div>
      )}

      {/* ── Status Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
        {[
          { icon: "💾", label: "Total Backups",   value: backups.length,        color: t.accent  },
          { icon: "✋", label: "Manual Backups",   value: manualBackups.length,  color: "#3B82F6" },
          { icon: "⏰", label: "Auto Backups",     value: autoBackups.length,    color: "#8B5CF6" },
          { icon: "📅", label: "Last Auto Backup", value: autoStatus?.last_auto ? "Done" : "Pending", color: "#22C55E" },
        ].map((c, i) => (
          <div key={i} style={{ background: c.color + "12", border: `1px solid ${c.color}25`, borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Auto Backup Info ── */}
      <div style={{ ...cardStyle, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>⏰</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 3 }}>Automatic Daily Backup</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>
              The system automatically backs up your database every day at <strong style={{ color: "#8B5CF6" }}>2:00 AM</strong>.
              Backups are kept for <strong style={{ color: "#8B5CF6" }}>30 days</strong> then the oldest are removed.
              Saved to: <code style={{ background: t.surface3, padding: "1px 7px", borderRadius: 5, fontSize: 11 }}>{autoStatus?.backup_dir || "Documents/PharmaPro Backups"}</code>
            </div>
          </div>
          <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: "#22C55E", flexShrink: 0 }}>
            ✅ Active
          </div>
        </div>
      </div>

      {/* ── Restore Section ── */}
      {isAdmin && (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>🔄 Restore from Backup File</div>
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
            Upload a <code style={{ background: t.surface3, padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>.pharmabackup</code> file to restore your database.
            <strong style={{ color: "#F87171" }}> Warning: this will overwrite all current data.</strong>
          </p>
          <input ref={fileRef} type="file" accept=".pharmabackup,.json" onChange={handleFileSelect} style={{ display: "none" }} />
          <button onClick={() => fileRef.current.click()}
            style={{ background: "linear-gradient(135deg,#3B82F6,#60a5fa)", border: "none", borderRadius: 12, padding: "11px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(59,130,246,0.3)" }}>
            📁 Choose Backup File
          </button>
        </div>
      )}

      {/* ── Manual Backups List ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          ✋ Manual Backups <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({manualBackups.length})</span>
        </div>
        {loading ? <Spinner t={t} /> : manualBackups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 20px", color: t.textMuted }}>
            <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>💾</div>
            <p style={{ fontSize: 13 }}>No manual backups yet. Click "Create Backup Now" to create one.</p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.surface3 }}>
                  {["Filename", "Created", "Size", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manualBackups.map((b, i) => (
                  <tr key={b.filename} style={{ borderTop: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : t.surface2 + "20" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: t.accent, fontFamily: "monospace", fontWeight: 600 }}>{b.filename}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: t.textMuted }}>{fmtDT(b.created)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: t.textSub }}>{fmtSize(b.size)}</td>
                    <td style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
                      <button onClick={() => handleDownload(b.filename)}
                        style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: "6px 12px", color: "#3B82F6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        ⬇️ Download
                      </button>
                      {isAdmin && (
                        <button onClick={() => setConfirmDelete(b.filename)}
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 12px", color: "#F87171", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Auto Backups List ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          ⏰ Automatic Backups <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400 }}>({autoBackups.length} — last 30 kept)</span>
        </div>
        {loading ? <Spinner t={t} size={22} /> : autoBackups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 20px", color: t.textMuted, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>⏰</div>
            Auto-backups run at 2 AM daily. None created yet.
          </div>
        ) : (
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0 }}>
                <tr style={{ background: t.surface3 }}>
                  {["Filename", "Created", "Size", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.7, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {autoBackups.map((b, i) => (
                  <tr key={b.filename} style={{ borderTop: `1px solid ${t.border}`, background: i === 0 ? "rgba(34,197,94,0.05)" : "transparent" }}>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: i === 0 ? t.accent : t.textSub, fontFamily: "monospace" }}>
                      {b.filename} {i === 0 && <span style={{ fontSize: 9, background: t.accent + "20", color: t.accent, borderRadius: 10, padding: "1px 7px", marginLeft: 6, fontFamily: "inherit" }}>LATEST</span>}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: t.textMuted }}>{fmtDT(b.created)}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: t.textMuted }}>{fmtSize(b.size)}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <button onClick={() => handleDownload(b.filename)}
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, padding: "5px 10px", color: "#3B82F6", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        ⬇️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Restore Confirm Modal ── */}
      {confirmRestore && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 22, padding: "36px", width: "min(520px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp .2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F87171", marginBottom: 8 }}>Confirm Database Restore</div>
              <p style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7 }}>
                This will <strong style={{ color: "#F87171" }}>overwrite ALL current data</strong> with the backup from:<br />
                <strong style={{ color: t.text }}>{fmtDT(confirmRestore.created_at)}</strong>
              </p>
            </div>

            {/* Backup contents summary */}
            <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Backup Contains</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(confirmRestore.row_counts || {}).map(([table, count]) => (
                  <div key={table} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: t.textMuted }}>{table}</span>
                    <span style={{ color: t.accent, fontFamily: "monospace", fontWeight: 700 }}>{count} rows</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "11px 15px", marginBottom: 22, fontSize: 12, color: "#F87171" }}>
              ⚠️ This action cannot be undone. Make sure to create a current backup first before restoring.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setConfirmRestore(null); setRestorePreview(null); }} disabled={restoring}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleRestore} disabled={restoring}
                style={{ flex: 1, background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 12, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: restoring ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: restoring ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {restoring
                  ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Restoring…</>
                  : "🔄 Yes, Restore Database"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 20, padding: "32px", width: "min(420px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", animation: "fadeUp .2s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 8 }}>Delete Backup?</div>
              <p style={{ fontSize: 12, color: t.textMuted, fontFamily: "monospace", background: t.surface3, padding: "8px 12px", borderRadius: 8 }}>{confirmDelete}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 10, padding: "11px 0", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deletingId === confirmDelete}
                style={{ flex: 1, background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 10, padding: "11px 0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

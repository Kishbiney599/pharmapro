import { useState } from "react";

const isElectron = typeof window !== "undefined" && window.electron?.isElectron;

export default function DBSetup({ onComplete }) {
  const [form, setForm] = useState({
    host: "localhost",
    port: "3306",
    user: "root",
    password: "",
    database: "pharmapro",
    pharmacyName: "",
  });

  const [step, setStep]         = useState("form");   // form | testing | restarting | done | error
  const [testResult, setTestResult] = useState(null);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  const handleTest = async () => {
    setStep("testing"); setError(""); setTestResult(null);
    try {
      const res = await window.electron.testDBConnection(form);
      setTestResult(res);
      setStep("form");
    } catch(e) {
      setError(e.message);
      setStep("form");
    }
  };

  const handleSave = async () => {
    if (!form.pharmacyName.trim()) return setError("Please enter your pharmacy name");
    if (!form.password && form.user === "root") {
      const ok = window.confirm("You have left the password blank. Is your MySQL root user really passwordless?");
      if (!ok) return;
    }

    setStep("restarting"); setError("");
    try {
      // Save config permanently
      const saveRes = await window.electron.saveDBConfig(form);
      if (!saveRes.ok) throw new Error(saveRes.error);

      // Restart backend with new config
      const restartRes = await window.electron.restartBackend();
      if (!restartRes.ok) throw new Error(restartRes.error || "Backend failed to restart");

      setStep("done");
      // Give backend 1 extra second to settle then reload
      setTimeout(() => { onComplete(); }, 1500);
    } catch(e) {
      setError(e.message);
      setStep("form");
    }
  };

  const t = {
    bg: "#0F172A", cardBg: "#1E293B", border: "1px solid #334155",
    text: "#F1F5F9", textMuted: "#64748B", accent: "#22C55E",
    primary: "linear-gradient(135deg,#22C55E,#16a34a)",
  };

  const inp = {
    width: "100%", background: "#0F172A", border: "1.5px solid #334155",
    borderRadius: 10, padding: "11px 14px", color: "#F1F5F9",
    fontSize: 14, outline: "none", fontFamily: "inherit",
  };

  const Label = ({ children }) => (
    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>
      {children}
    </label>
  );

  if (step === "testing") return (
    <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ textAlign: "center", color: t.text }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🔌</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.accent }}>Testing connection...</div>
        <div style={{ color: t.textMuted, marginTop: 8 }}>Connecting to {form.host}:{form.port}</div>
      </div>
    </div>
  );

  if (step === "restarting") return (
    <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ textAlign: "center", color: t.text }}>
        <div style={{ fontSize: 52, marginBottom: 20, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.accent }}>Saving & restarting...</div>
        <div style={{ color: t.textMuted, marginTop: 8 }}>Connecting PharmaPro to your database</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (step === "done") return (
    <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ textAlign: "center", color: t.text }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: t.accent }}>Connected!</div>
        <div style={{ color: t.textMuted, marginTop: 8 }}>Loading PharmaPro...</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20 }}>
      <div style={{ width: "min(560px, 100%)" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 60, marginBottom: 14 }}>💊</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: t.accent, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            PharmaPro Enterprise
          </h1>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>
            Connect to your MySQL database to get started.<br />
            <strong style={{ color: "#F59E0B" }}>You only need to do this once.</strong>
          </p>
        </div>

        <div style={{ background: t.cardBg, border: t.border, borderRadius: 20, padding: "32px 36px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
            🗄️ MySQL Database Settings
          </div>

          {/* Test result banner */}
          {testResult && (
            <div style={{ background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "11px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, color: testResult.ok ? "#22C55E" : "#F87171" }}>
              {testResult.ok ? "✅ MySQL is reachable at this address!" : `❌ ${testResult.error}`}
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "11px 16px", marginBottom: 20, fontSize: 13, color: "#F87171" }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Pharmacy Name */}
            <div>
              <Label>Pharmacy / Branch Name *</Label>
              <input value={form.pharmacyName} onChange={f("pharmacyName")}
                placeholder="e.g. Kumasi Main Branch"
                style={{ ...inp, borderColor: form.pharmacyName ? "#22C55E50" : "#334155" }}
                onFocus={e => e.target.style.borderColor = "#22C55E"}
                onBlur={e => e.target.style.borderColor = form.pharmacyName ? "#22C55E50" : "#334155"} />
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>This name appears on all receipts and reports</div>
            </div>

            <div style={{ height: 1, background: "#334155", margin: "4px 0" }} />

            {/* Host & Port */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <div>
                <Label>MySQL Host</Label>
                <input value={form.host} onChange={f("host")} placeholder="localhost" style={inp}
                  onFocus={e => e.target.style.borderColor = "#22C55E"}
                  onBlur={e => e.target.style.borderColor = "#334155"} />
              </div>
              <div>
                <Label>Port</Label>
                <input value={form.port} onChange={f("port")} placeholder="3306" style={inp}
                  onFocus={e => e.target.style.borderColor = "#22C55E"}
                  onBlur={e => e.target.style.borderColor = "#334155"} />
              </div>
            </div>

            {/* Username & Password */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Label>Username</Label>
                <input value={form.user} onChange={f("user")} placeholder="root" style={inp}
                  onFocus={e => e.target.style.borderColor = "#22C55E"}
                  onBlur={e => e.target.style.borderColor = "#334155"} />
              </div>
              <div>
                <Label>Password</Label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={f("password")}
                    placeholder="MySQL password" style={{ ...inp, paddingRight: 56 }}
                    onFocus={e => e.target.style.borderColor = "#22C55E"}
                    onBlur={e => e.target.style.borderColor = "#334155"} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {showPw ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>
            </div>

            {/* Database name */}
            <div>
              <Label>Database Name</Label>
              <input value={form.database} onChange={f("database")} placeholder="pharmapro" style={inp}
                onFocus={e => e.target.style.borderColor = "#22C55E"}
                onBlur={e => e.target.style.borderColor = "#334155"} />
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                Will be created automatically if it doesn't exist
              </div>
            </div>

            {/* Info box */}
            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: "#93C5FD", lineHeight: 1.7 }}>
              💡 <strong>These credentials are saved permanently on this PC.</strong><br />
              You won't be asked again unless you click <em>PharmaPro → Database Settings</em> in the menu.
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button onClick={handleTest}
                style={{ flex: 1, background: "transparent", border: "1.5px solid #334155", borderRadius: 12, padding: "12px 0", color: "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={e => { e.target.style.borderColor = "#22C55E"; e.target.style.color = "#22C55E"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#334155"; e.target.style.color = "#94A3B8"; }}>
                🔌 Test Connection
              </button>
              <button onClick={handleSave}
                style={{ flex: 2, background: t.primary, border: "none", borderRadius: 12, padding: "13px 0", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(34,197,94,0.35)", letterSpacing: "-0.2px" }}>
                💾 Save & Connect
              </button>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: t.textMuted }}>
          Make sure MySQL is installed and running before connecting.
        </div>
      </div>
    </div>
  );
}

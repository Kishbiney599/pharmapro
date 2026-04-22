import { useState, useEffect } from "react";
import { api, saveToken, saveUser } from "./api";
import { GLOBAL_CSS, THEMES, daysUntil } from "./themes";
import { GlassCard, Field, Input, useToast, Modal } from "./components";;

function Login({ onLogin, t }) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState("");
  const [pharmName, setPharmName] = useState(
    localStorage.getItem('pharmapro_name') || 'PharmaPro Enterprise'
  );

  const [activated, setActivated]         = useState(null); // null=checking, true, false
  const [showActivate, setShowActivate]   = useState(false);
  const [actCode, setActCode]             = useState("");
  const [actLoading, setActLoading]       = useState(false);
  const [actError, setActError]           = useState("");
  const [actSuccess, setActSuccess]       = useState("");
  const [actExpires, setActExpires]       = useState("");
  const [daysLeft, setDaysLeft]           = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem('pharmapro_name');
    if (cached) setPharmName(cached);
    checkActivation();
    // Re-check every 30 minutes
    const interval = setInterval(checkActivation, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkActivation = async (retries = 8) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await Promise.race([
          api.checkActivation(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        setActivated(res.activated);
        if (res.expires) {
          setActExpires(res.expires);
          const expDate = new Date(res.expires);
          const today   = new Date();
          today.setHours(0,0,0,0);
          const diff = Math.ceil((expDate - today) / 86400000);
          setDaysLeft(diff);
        }
        return; // success
      } catch {
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1500)); // wait 1.5s then retry
        } else {
          setActivated(false); // after all retries fail, show activation screen
        }
      }
    }
  };

  const handleActivate = async () => {
    if (!actCode.trim()) return setActError("Please enter an activation code");
    setActLoading(true); setActError(""); setActSuccess("");
    try {
      const res = await api.activate(actCode);
      setActSuccess(res.message);
      if (res.expires) setActExpires(res.expires);
      setTimeout(() => {
        setActivated(true);
        setShowActivate(false);
        setActCode("");
        setActSuccess("");
      }, 1800);
    } catch (e) { setActError(e.message); }
    finally { setActLoading(false); }
  };

  // Format activation code input as XXXXXX-XXXXXX-XXXXXX-XXXXXX
  const handleActCodeChange = (val) => {
    const raw = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 24);
    const parts = [];
    for (let i = 0; i < raw.length; i += 6) parts.push(raw.slice(i, i + 6));
    setActCode(parts.join('-'));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!activated) return;
    setLoading(true); setError("");
    try {
      const { token, user } = await api.login(email, password);
      saveToken(token); saveUser(user); onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const isLocked = activated === false;
  const isChecking = activated === null;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 20px 20px", fontFamily: t.font, overflowY: "auto" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Activation Modal ── */}
      {showActivate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 24, padding: "40px 40px 34px", width: "min(480px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp 0.25s ease" }}>
            {/* Icon */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>App Activation</div>
              <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
                Enter the monthly activation code provided by your administrator to unlock PharmaPro Enterprise.
              </p>
            </div>

            {/* Code input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Activation Code</label>
              <input
                value={actCode}
                onChange={e => handleActCodeChange(e.target.value)}
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                maxLength={27}
                style={{
                  width: "100%", background: t.surface2, border: `2px solid ${actSuccess ? t.accent : actError ? t.dangerColor : t.border}`,
                  borderRadius: 12, padding: "14px 16px", color: t.text,
                  fontSize: 18, fontFamily: "monospace", fontWeight: 700,
                  outline: "none", letterSpacing: 2, textAlign: "center",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = actSuccess ? t.accent : actError ? t.dangerColor : t.border}
              />
            </div>

            {/* Status messages */}
            {actError && (
              <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "8px 12px", color: "#F87171", fontSize: 13, marginBottom: 14 }}>
                ⚠️ {actError}
              </div>
            )}
            {actSuccess && (
              <div style={{ background: "#0F2A1F", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "8px 12px", color: "#22C55E", fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                ✅ {actSuccess}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => { setShowActivate(false); setActCode(""); setActError(""); setActSuccess(""); }}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleActivate} disabled={actLoading || actCode.length < 27}
                style={{ flex: 1.5, background: actCode.length >= 27 ? t.primary : t.surface3, border: "none", borderRadius: 12, padding: "12px 0", color: actCode.length >= 27 ? "#fff" : t.textMuted, fontSize: 14, fontWeight: 700, cursor: actCode.length >= 27 ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: actCode.length >= 27 ? t.glow : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {actLoading
                  ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Verifying…</>
                  : "🔓 Activate"}
              </button>
            </div>

            <p style={{ fontSize: 11, color: t.textMuted, textAlign: "center", marginTop: 16 }}>
              Contact your system administrator for a monthly activation code.
            </p>
          </div>
        </div>
      )}

      {/* ── Login Form ── */}
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 32, marginBottom: 6, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>💊</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>{pharmName}</div>
          <p style={{ color: t.textMuted, fontSize: 12 }}>Sign in to your workspace</p>
        </div>

        <GlassCard padding="24px 28px 20px" hover={false} t={t}>
          {/* Activation status banner */}
          {isChecking && (
            <div style={{ textAlign: "center", padding: "12px 0 20px", color: t.textMuted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ width: 16, height: 16, border: `2px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              Checking activation...
              <button onClick={() => { setActivated(null); checkActivation(); }}
                style={{ marginLeft: 8, background: "none", border: "none", color: t.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                Retry
              </button>
            </div>
          )}

          {isLocked && (
            <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F87171" }}>App Not Activated</div>
                <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>Contact your administrator for a monthly code.</p>
              </div>
              <button onClick={() => setShowActivate(true)}
                style={{ background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}>
                🔐 Activate
              </button>
            </div>
          )}

          {!isLocked && !isChecking && actExpires && (
            <div style={{ background: daysLeft !== null && daysLeft <= 5 ? "rgba(245,158,11,0.1)" : t.accent + "12", border: `1px solid ${daysLeft !== null && daysLeft <= 5 ? "#F59E0B40" : t.accent + "30"}`, borderRadius: 10, padding: "9px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: daysLeft !== null && daysLeft <= 5 ? "#F59E0B" : t.accent, fontWeight: 600 }}>
                {daysLeft !== null && daysLeft <= 5 ? "⚠️" : "✅"} Activated
              </span>
              <span style={{ fontSize: 11, color: t.textMuted }}>
                {daysLeft !== null
                  ? daysLeft <= 0
                    ? "⚠️ Expires today!"
                    : daysLeft === 1
                      ? "⚠️ Expires tomorrow!"
                      : daysLeft <= 5
                        ? `⚠️ ${daysLeft} days left — renew soon`
                        : `${daysLeft} days remaining`
                  : `Until: ${actExpires}`}
              </span>
              <button onClick={() => setShowActivate(true)} style={{ fontSize: 11, color: t.textMuted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Renew</button>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="✉️  Email Address">
              <Input t={t} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" disabled={isLocked || isChecking} />
            </Field>
            <Field label="🔒  Password">
              <div style={{ position: "relative" }}>
                <Input t={t} type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 60 }} disabled={isLocked || isChecking} />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{showPass ? "HIDE" : "SHOW"}</button>
              </div>
            </Field>
            {error && (
              <div style={{ background: t.dangerColor + "15", border: `1px solid ${t.dangerColor}30`, borderRadius: 12, padding: "11px 16px", color: t.dangerColor, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                ⚠️ {error}
              </div>
            )}
            <button type="submit" disabled={loading || isLocked || isChecking}
              style={{ background: isLocked || isChecking ? t.surface3 : t.primary, border: "none", borderRadius: 14, padding: 16, color: isLocked || isChecking ? t.textMuted : "#fff", fontSize: 15, fontWeight: 700, cursor: isLocked || isChecking ? "not-allowed" : "pointer", opacity: loading ? 0.8 : 1, boxShadow: isLocked || isChecking ? "none" : t.glow, fontFamily: t.font, transition: "all 0.2s", padding: "12px" }}>
              {loading ? "Authenticating…" : isChecking ? "Checking…" : isLocked ? "🔒 Activate to Sign In" : "Sign In →"}
            </button>
          </form>

          {/* Activation button at bottom when not locked */}
          {!isLocked && !isChecking && (
            <div style={{ textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
              <button onClick={() => setShowActivate(true)}
                style={{ background: "none", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}
                onMouseEnter={e => e.currentTarget.style.color = t.accent}
                onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
                🔐 Enter Activation Code
              </button>
            </div>
          )}
        </GlassCard>

        {/* Developer Footer */}
        <div style={{ textAlign: "center", marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${t.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
            Developed by
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: t.accent, marginBottom: 6 }}>
            Stiles_Tech
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <a href="tel:+233247063292" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = t.accent}
              onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
              📞 +233 247 063 292
            </a>
            <a href="tel:+233202866313" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = t.accent}
              onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
              📞 +233 202 866 313
            </a>
            <a href="mailto:netbiney59@gmail.com" style={{ fontSize: 12, color: t.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = t.accent}
              onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
              ✉️ netbiney59@gmail.com
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==============================
//  DASHBOARD
// ==============================
export default Login;

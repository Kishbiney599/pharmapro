import { useState } from "react";
import { api } from "./api";
import { Field, Input, Modal, Btn } from "./components";

function ChangePasswordModal({ t, onClose }) {
  const [current,  setCurrent]  = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const strength = (pw) => {
    if (!pw) return { label: "", color: t.border, width: 0 };
    let score = 0;
    if (pw.length >= 6)  score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const map = [
      { label: "Too short", color: "#EF4444", width: 20  },
      { label: "Weak",      color: "#F87171", width: 35  },
      { label: "Fair",      color: "#F59E0B", width: 55  },
      { label: "Good",      color: "#22C55E", width: 75  },
      { label: "Strong",    color: "#10B981", width: 100 },
    ];
    return map[Math.min(score, 4)];
  };

  const str = strength(newPw);

  const handleSubmit = async () => {
    setError("");
    if (!current) return setError("Current password is required");
    if (!newPw)   return setError("New password is required");
    if (newPw.length < 6) return setError("New password must be at least 6 characters");
    if (newPw !== confirm) return setError("Passwords do not match");
    if (newPw === current)  return setError("New password must be different from current");
    setLoading(true);
    try {
      await api.changePassword(current, newPw);
      setSuccess(true);
      setTimeout(() => { onClose(); }, 2000);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inputBox = (val, set, show, setShow, placeholder) => (
    <div style={{ position: "relative" }}>
      <Input t={t} type={show ? "text" : "password"} value={val}
        onChange={e => set(e.target.value)} placeholder={placeholder}
        style={{ paddingRight: 60 }} />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        {show ? "HIDE" : "SHOW"}
      </button>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: t.cardBg, border: t.cardBorder, borderRadius: 22, padding: "36px 36px 30px", width: "min(460px,100%)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)", animation: "fadeUp 0.22s ease" }}>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.accent, marginBottom: 8 }}>Password Changed!</div>
            <p style={{ fontSize: 13, color: t.textMuted }}>Your password has been updated successfully.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>🔒 Change Password</div>
                <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>Choose a strong password to keep your account secure</p>
              </div>
              <button onClick={onClose} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 12px", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Current Password">
                {inputBox(current, setCurrent, showCur, setShowCur, "Enter current password")}
              </Field>

              <Field label="New Password">
                {inputBox(newPw, setNewPw, showNew, setShowNew, "At least 6 characters")}
                {newPw && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 4, background: t.surface3, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ height: "100%", width: `${str.width}%`, background: str.color, borderRadius: 4, transition: "all 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: str.color, fontWeight: 700 }}>{str.label}</span>
                  </div>
                )}
              </Field>

              <Field label="Confirm New Password">
                {inputBox(confirm, setConfirm, showCon, setShowCon, "Repeat new password")}
                {confirm && newPw && (
                  <div style={{ fontSize: 11, marginTop: 5, color: confirm === newPw ? "#22C55E" : "#F87171", fontWeight: 600 }}>
                    {confirm === newPw ? "✅ Passwords match" : "❌ Passwords do not match"}
                  </div>
                )}
              </Field>
            </div>

            {error && (
              <div style={{ background: "#3B0D0D", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "11px 15px", marginTop: 16, color: "#F87171", fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={onClose}
                style={{ flex: 1, background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 0", color: t.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex: 2, background: loading ? t.surface3 : t.primary, border: "none", borderRadius: 12, padding: "12px 0", color: loading ? t.textMuted : "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: loading ? "none" : t.glow, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading
                  ? <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} /> Saving…</>
                  : "🔒 Update Password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ChangePasswordModal;

// PharmaPro Enterprise — Shared UI Components
import { useState, useEffect } from "react";
import { api } from "./api";

function GlassCard({ children, hover = true, padding = "24px", onClick, style, t }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hover && setHov(true)}
      onMouseLeave={() => hover && setHov(false)}
      style={{
        background: t.cardBg, backdropFilter: "blur(16px)",
        border: t.cardBorder, borderRadius: 24, padding,
        boxShadow: hov ? t.cardHoverShadow : t.cardShadow,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.35s cubic-bezier(0.175,0.885,0.32,1.1)",
        cursor: onClick ? "pointer" : "default",
        position: "relative", overflow: "hidden", ...style,
      }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: t.primary, opacity: hov ? 0.08 : 0.03, borderRadius: "50%", filter: "blur(40px)", pointerEvents: "none", transition: "opacity 0.4s" }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function GradientText({ children, gradient, style, color }) {
  return (
    <span style={{
      background: gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      display: "inline-block",
      lineHeight: 1.2,
      ...style
    }}>
      {children}
    </span>
  );
}

function Badge({ label, gradient, color, t, size = "sm" }) {
  const pad = size === "lg" ? "5px 14px" : size === "sm" ? "3px 10px" : "2px 7px";
  const fs = size === "lg" ? 12 : size === "sm" ? 11 : 10;
  if (gradient) return (
    <span style={{ background: gradient, color: "#fff", borderRadius: 100, padding: pad, fontSize: fs, fontWeight: 700, letterSpacing: 0.5, display: "inline-block" }}>{label}</span>
  );
  const c = color || (t ? t.accent : "#22C55E");
  return (
    <span style={{ background: c + "18", color: c, border: `1px solid ${c}30`, borderRadius: 100, padding: pad, fontSize: fs, fontWeight: 700, letterSpacing: 0.5, display: "inline-block" }}>{label}</span>
  );
}

function Spinner({ t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 18 }}>
      <div style={{ width: 44, height: 44, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 14, fontWeight: 500, color: t.accent }}>Loading from database…</span>
    </div>
  );
}

function Toast({ msg, type, t }) {
  if (!msg) return null;
  const bg = type === "error" ? "#3B0D0D" : type === "warning" ? "#2D1E00" : "#0F2A1F";
  const bc = type === "error" ? "rgba(248,113,113,0.3)" : type === "warning" ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)";
  const tc = type === "error" ? "#F87171" : type === "warning" ? "#F59E0B" : "#22C55E";
  const grad = tc;
  const icon = type === "error" ? "❌" : type === "warning" ? "⚠️" : "✅";
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, background: grad, color: "#fff", borderRadius: 100, padding: "14px 26px", fontSize: 14, fontWeight: 600, boxShadow: "0 16px 48px rgba(0,0,0,0.3)", animation: "slideIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55)", display: "flex", alignItems: "center", gap: 10 }}>
      <span>{icon}</span>{msg}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };
  return [toast, show];
}

function ProgressBar({ value, max = 100, gradient, t }) {
  return (
    <div style={{ height: 7, background: t.surface3, borderRadius: 7, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / max) * 100)}%`, background: gradient || t.primary, borderRadius: 7, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
    </div>
  );
}

function DBStatus({ t }) {
  const [status, setStatus] = useState("checking");
  useEffect(() => { api.health().then(() => setStatus("ok")).catch(() => setStatus("error")); }, []);
  const cfg = { ok: { label: "● LIVE", grad: "#22C55E" }, error: { label: "● OFFLINE", grad: "#EF4444" }, checking: { label: "● CHECKING", grad: "#F59E0B" } };
  return <Badge label={cfg[status].label} gradient={cfg[status].grad} size="lg" />;
}

// === Field / Input / Select ===================================
function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ t, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input {...props}
      onFocus={e => { setFocused(true); props.onFocus && props.onFocus(e); }}
      onBlur={e => { setFocused(false); props.onBlur && props.onBlur(e); }}
      style={{ width: "100%", background: t.surface2, border: `1.5px solid ${focused ? t.accent : t.border}`, borderRadius: 12, padding: "11px 15px", color: t.text, fontSize: 14, outline: "none", transition: "border-color 0.2s", boxShadow: focused ? t.glow : "none", fontFamily: t.font, ...props.style }} />
  );
}

function Sel({ t, children, ...props }) {
  return (
    <select {...props} style={{ width: "100%", background: t.surface2, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 15px", color: t.text, fontSize: 14, outline: "none", fontFamily: t.font, ...props.style }}>
      {children}
    </select>
  );
}

function Modal({ title, subtitle, onClose, children, t, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: t.cardBg, backdropFilter: "blur(20px)", border: t.cardBorder, borderRadius: 24, padding: 36, width: wide ? 580 : 460, maxHeight: "90vh", overflowY: "auto", boxShadow: t.cardShadow, animation: "fadeUp 0.3s ease" }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.accent, marginBottom: 4 }}>{title}</div>
          {subtitle && <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", t, disabled, small }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: variant === "primary" ? t.primary : variant === "danger" ? t.dangerColor + "18" : t.surface3,
        border: variant === "primary" ? "none" : variant === "danger" ? `1px solid ${t.dangerColor}30` : `1px solid ${t.border}`,
        color: variant === "primary" ? "#fff" : variant === "danger" ? t.dangerColor : t.textSub,
        borderRadius: 12, padding: small ? "7px 16px" : "11px 24px",
        fontSize: small ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1, fontFamily: t.font, whiteSpace: "nowrap",
        transition: "all 0.2s", transform: hov && !disabled ? "scale(1.02)" : "scale(1)",
        boxShadow: variant === "primary" && hov ? t.glow : "none",
      }}>{children}</button>
  );
}

// ==============================
//  STAT CARD
// ==============================
function StatCard({ icon, label, value, sub, gradient, t, onClick, hint }) {
  const [hov, setHov] = useState(false);
  // Determine font size based on value length to prevent overflow
  const valStr = String(value);
  const valLen = valStr.length;
  const valueFontSize = valLen > 14 ? 16 : valLen > 10 ? 18 : valLen > 7 ? 20 : 22;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
      style={{
        background: t.cardBg,
        border: hov && onClick ? `1px solid ${t.accent}60` : t.cardBorder,
        borderRadius: 20,
        padding: "20px 18px",
        boxShadow: hov ? t.cardHoverShadow : t.cardShadow,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.25s ease",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}>
      {/* Decorative glow blob — never on text */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: gradient || t.primary, opacity: hov ? 0.1 : 0.05, borderRadius: "50%", filter: "blur(30px)", pointerEvents: "none", transition: "opacity 0.3s" }} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Icon row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
          {hint && (
            <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, opacity: hov ? 1 : 0, transition: "opacity 0.25s", display: "flex", alignItems: "center", gap: 3, background: t.accent + "15", borderRadius: 20, padding: "3px 8px", whiteSpace: "nowrap" }}>
              → {hint}
            </div>
          )}
        </div>

        {/* Label */}
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 6, lineHeight: 1.3 }}>{label}</div>

        {/* Value — adaptive font size, single line, no wrap */}
        <div style={{
          fontSize: valueFontSize,
          fontWeight: 800,
          color: t.accent,
          fontFamily: t.mono,
          lineHeight: 1.2,
          marginBottom: sub ? 10 : 0,
          wordBreak: "break-all",
          overflowWrap: "anywhere",
          marginTop: "auto",
        }}>{value}</div>

        {/* Sub text */}
        {sub && (
          <div style={{ fontSize: 11, color: t.textMuted, paddingTop: 8, borderTop: `1px solid ${t.border}`, marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ==============================
//  LOGIN

export { GlassCard, GradientText, Badge, Spinner, Toast, useToast,
         ProgressBar, DBStatus, Field, Input, Sel, Modal, Btn, StatCard };

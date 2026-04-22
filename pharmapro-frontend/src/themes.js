// PharmaPro Enterprise — Themes & Utilities
export const fmt      = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
export const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

export const THEMES = {
  dark: {
    // == Backgrounds ==========================================
    bg:           "#0F172A",
    bgGradient:   "#0F172A",
    surface:      "#1E293B",
    surface2:     "#243044",
    surface3:     "#2d3a50",
    sidebarBg:    "#020617",
    // == Borders ==============================================
    border:       "#334155",
    borderHover:  "#22C55E",
    // == Text =================================================
    text:         "#F1F5F9",
    textSub:      "#94A3B8",
    textMuted:    "#64748B",
    // == Accent Colors ========================================
    accent:       "#22C55E",
    accentHover:  "#16a34a",
    infoColor:    "#3B82F6",
    highlight:    "#14B8A6",
    emerald:      "#22C55E",
    // == Alert Colors =========================================
    dangerColor:  "#EF4444",
    expiredColor: "#DC2626",
    warnColor:    "#F59E0B",
    successColor: "#22C55E",
    // == Gradient Strings (for icons/charts, NOT text values) =
    primary: "linear-gradient(135deg, #22C55E 0%, #16a34a 100%)",
    info:    "linear-gradient(135deg, #3B82F6 0%, #60a5fa 100%)",
    warning: "linear-gradient(135deg, #F59E0B 0%, #fbbf24 100%)",
    danger:  "linear-gradient(135deg, #EF4444 0%, #f87171 100%)",
    success: "linear-gradient(135deg, #22C55E 0%, #4ade80 100%)",
    purple:  "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
    // == Cards ================================================
    cardBg:          "#1E293B",
    cardBorder:      "1px solid #334155",
    cardShadow:      "0 4px 24px rgba(0,0,0,0.4)",
    cardHoverShadow: "0 8px 32px rgba(34,197,94,0.15)",
    glow:            "0 0 20px rgba(34,197,94,0.25)",
    // == Typography ===========================================
    font: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  light: {
    bg: "#f0f6ff",
    bgGradient: "radial-gradient(ellipse at 10% 0%, #dbeafe 0%, #f0f6ff 60%)",
    surface: "rgba(255,255,255,0.9)",
    surface2: "rgba(241,245,249,0.95)",
    surface3: "rgba(226,232,240,0.6)",
    border: "rgba(100,116,139,0.15)",
    borderHover: "rgba(10,143,115,0.3)",
    primary: "linear-gradient(135deg, #0a8f73 0%, #0dbf9b 100%)",
    info: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    warning: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    danger: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
    success: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    purple: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
    accent: "#0a8f73",
    accentHover: "#0dbf9b",
    dangerColor: "#dc2626",
    warnColor: "#d97706",
    infoColor: "#2563eb",
    emerald: "#059669",
    text: "#0f172a",
    textSub: "#334155",
    textMuted: "#64748b",
    cardBg: "rgba(255,255,255,0.9)",
    cardBorder: "1px solid rgba(100,116,139,0.12)",
    cardShadow: "0 8px 40px rgba(15,23,42,0.08)",
    cardHoverShadow: "0 16px 50px rgba(10,143,115,0.15)",
    glow: "0 0 24px rgba(10,143,115,0.2)",
    font: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', monospace",
    sidebarBg: "#0f172a",
  },
};

// === Utilities (exported at top of file) =======================

export const GLOBAL_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
input, select, button, textarea { font-family: inherit; }

@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideIn { from { transform:translateX(120%) scale(0.9); opacity:0; } to { transform:translateX(0) scale(1); opacity:1; } }
@keyframes float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
@keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

/* Hide number input spin buttons in POS quantity fields */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }

/* ── Responsive Dashboard Grid ───────────────────────── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.bottom-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
}
/* Narrow browser / small screen */
@media (max-width: 1100px) {
  .stat-grid  { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bottom-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .stat-grid  { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}

/* ── App shell ────────────────────────────────────────── */
.app-shell { display: flex; height: 100vh; overflow: hidden; }

/* ── Sidebar collapse at narrow widths ────────────────── */
.sidebar { width: 240px; flex-shrink: 0; transition: width 0.25s ease; overflow: hidden; }
@media (max-width: 1000px) {
  .sidebar { width: 70px; }
  .sidebar .nav-label-text { display: none !important; }
  .sidebar .logo-text-area { display: none !important; }
  .sidebar .user-details   { display: none !important; }
  .sidebar .theme-toggle-label { display: none !important; }
}
@media (max-width: 640px) {
  .sidebar { width: 56px; }
}
`;


// === Permissions ================================================
const ADMIN_ROLES = ["admin", "super admin"];

export function getAllowedPages(user) {
  if (!user) return [];
  if (ADMIN_ROLES.includes((user.role || "").toLowerCase())) {
    return ["dashboard","inventory","pos","suppliers","staff","reports","monthly_revenue",
            "sales_history","settings","backup","stock_adjust","profit_loss","customers",
            "daily_cash","staff_sales","reorder_alerts","shift_report"];
  }
  return user.permissions || [];
}

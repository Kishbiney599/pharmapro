import { useState, useEffect } from "react";
import { api, saveUser, savedUser, clearToken } from "./api";
import { THEMES, GLOBAL_CSS, getAllowedPages } from "./themes";
import { DBStatus, Modal } from "./components";;
import Login from "./Login";
import Dashboard from "./Dashboard";
import InventoryPage from "./InventoryPage";
import POSPage from "./POSPage";
import StaffPage from "./StaffPage";
import ReportsPage from "./ReportsPage";
import Settings from "./Settings";
import Backup from "./Backup";
import Suppliers from "./Suppliers";
import StockAdjustment from "./StockAdjustment";
import Customers from "./Customers";
import ChangePasswordModal from "./ChangePasswordModal";

// All pages that can be permission-controlled
const ALL_PAGES = [
  { id: "dashboard",       icon: "📊", label: "Dashboard"         },
  { id: "inventory",       icon: "💊", label: "Inventory"         },
  { id: "pos",             icon: "🛒", label: "POS Sales"         },
  { id: "suppliers",       icon: "🏭", label: "Suppliers"         },
  { id: "staff",           icon: "👥", label: "Staff"             },
  { id: "reports",         icon: "📈", label: "Reports"           },
  { id: "monthly_revenue", icon: "💰", label: "Monthly Revenue"   },
  { id: "sales_history",   icon: "🧾", label: "Sales History"     },
  { id: "settings",        icon: "⚙️", label: "Settings"         },
  { id: "backup",          icon: "💾", label: "Backup"            },
  { id: "stock_adjust",    icon: "📦", label: "Stock Adjustment"  },
  { id: "profit_loss",     icon: "💰", label: "Profit & Loss"     },
  { id: "customers",       icon: "👥", label: "Customers"         },
  { id: "daily_cash",      icon: "💵", label: "Daily Cash"        },
  { id: "staff_sales",     icon: "📊", label: "Sales by Staff"    },
  { id: "reorder_alerts",  icon: "⚠️", label: "Reorder Alerts"   },
];

const NAV = [
  { id: "dashboard",   icon: "📊", label: "Dashboard"    },
  { id: "inventory",   icon: "💊", label: "Inventory"    },
  { id: "pos",         icon: "🛒", label: "POS Sales"    },
  { id: "suppliers",   icon: "🏭", label: "Suppliers"    },
  { id: "staff",       icon: "👥", label: "Staff"        },
  { id: "reports",     icon: "📈", label: "Reports"      },
  { id: "settings",    icon: "⚙️", label: "Settings"    },
  { id: "backup",      icon: "💾", label: "Backup"       },
  { id: "stock_adjust",icon: "📦", label: "Stock Adjust" },
  { id: "customers",   icon: "👥", label: "Customers"    },
];

const PAGES = {
  dashboard:   Dashboard,
  inventory:   InventoryPage,
  pos:         POSPage,
  suppliers:   Suppliers,
  staff:       StaffPage,
  reports:     ReportsPage,
  settings:    Settings,
  backup:      Backup,
  stock_adjust:StockAdjustment,
  customers:   Customers,
};

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('pharmapro_theme');
    return saved !== null ? saved === 'dark' : true;
  });
  const [page, setPage] = useState("dashboard");
  const [showChangePw, setShowChangePw] = useState(false);
  // Auto-print receipt toggle (persisted)
  const [autoPrint, setAutoPrint] = useState(
    () => localStorage.getItem("pharmapro_autoprint") !== "false"
  );
  const toggleAutoPrint = () => {
    setAutoPrint(v => {
      localStorage.setItem("pharmapro_autoprint", String(!v));
      return !v;
    });
  };

  // Persist cart across page changes
  const [posCart, setPosCart]         = useState([]);
  const [posPayment, setPosPayment]   = useState("Cash");
  const [posDiscount, setPosDiscount] = useState("");
  const [posDiscountType, setPosDiscountType] = useState("percent");
  const [posPhone, setPosPhone]       = useState("");
  const [posRx, setPosRx]             = useState("");         // prescription number
  const [posInsurance, setPosInsurance] = useState("cash");   // cash | nhis | insurance
  const [posInsuranceId, setPosInsuranceId] = useState("");
  const [user, setUser] = useState(savedUser());
  const [pharmName, setPharmName] = useState(
    () => localStorage.getItem('pharmapro_name') || 'PharmaPro Enterprise'
  );
  const t = dark ? THEMES.dark : THEMES.light;

  const SESSION_MS = 3 * 60 * 60 * 1000; // 3 hours in ms

  // Logout helper — clears everything
  const doLogout = () => {
    clearToken();
    setUser(null);
  };

  // == Re-check activation while logged in =====================
  // Checks every hour AND at the next midnight so the app locks
  // immediately when a new month starts and no renewal code exists.
  useEffect(() => {
    if (!user) return;

    const checkLicense = async () => {
      try {
        const res = await api.checkActivation();
        if (!res.activated) {
          doLogout(); // Code expired — force re-activation screen
        }
      } catch { /* network issue — don't lock out */ }
    };

    // Immediate check on login
    checkLicense();

    // Hourly check
    const hourly = setInterval(checkLicense, 60 * 60 * 1000);

    // Midnight check — fires 10s after the month rolls over
    const now          = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 10);
    const msToMidnight = nextMidnight - now;
    const midTimer     = setTimeout(checkLicense, msToMidnight);

    return () => { clearInterval(hourly); clearTimeout(midTimer); };
  }, [user]);

  // == Desktop Notifications ====================================
  useEffect(() => {
    if (!user) return;

    // Request notification permission once
    const requestPermission = async () => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    };
    requestPermission();

    const sendNotification = (title, body, icon = "💊", tag = null) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: tag || title,
        requireInteraction: false,
      });
      n.onclick = () => { window.focus(); n.close(); };
      setTimeout(() => n.close(), 8000);
    };

    const checkAlerts = async () => {
      try {
        // Low stock / reorder alerts
        const reorder = await api.getReorderAlerts();
        const outOfStock = reorder.filter(d => Number(d.total_stock) <= 0);
        const lowStock   = reorder.filter(d => Number(d.total_stock) > 0);

        if (outOfStock.length > 0) {
          sendNotification(
            `🔴 ${outOfStock.length} Drug(s) Out of Stock`,
            outOfStock.slice(0, 3).map(d => d.name).join(", ") +
              (outOfStock.length > 3 ? ` +${outOfStock.length - 3} more` : ""),
            "💊",
            "out-of-stock"
          );
        } else if (lowStock.length > 0) {
          sendNotification(
            `⚠️ ${lowStock.length} Drug(s) Running Low`,
            lowStock.slice(0, 3).map(d => `${d.name} (${d.total_stock} left)`).join(", "),
            "💊",
            "low-stock"
          );
        }

        // Expiring drugs
        const expiry = await api.getExpiryReport();
        const expired  = expiry.filter(e => e.days_until_expiry <= 0);
        const expiring = expiry.filter(e => e.days_until_expiry > 0 && e.days_until_expiry <= 30);

        if (expired.length > 0) {
          sendNotification(
            `🚨 ${expired.length} Drug(s) Have EXPIRED`,
            expired.slice(0, 3).map(d => d.name).join(", ") +
              (expired.length > 3 ? ` +${expired.length - 3} more` : ""),
            "💊",
            "expired"
          );
        } else if (expiring.length > 0) {
          sendNotification(
            `⏰ ${expiring.length} Drug(s) Expiring Within 30 Days`,
            expiring.slice(0, 3).map(d => `${d.name} (${d.days_until_expiry}d)`).join(", "),
            "💊",
            "expiring-soon"
          );
        }

      } catch(_) { /* silently fail */ }
    };

    // Check on login
    setTimeout(checkAlerts, 3000);

    // Check every 2 hours
    const interval = setInterval(checkAlerts, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // == Auto-logout after 3 hours of inactivity ==================
  useEffect(() => {
    if (!user) return;
    let logoutTimer;

    const resetTimer = () => {
      clearTimeout(logoutTimer);
      // Update login_time on activity so the 3h resets from last action
      localStorage.setItem('pharmapro_login_time', Date.now().toString());
      logoutTimer = setTimeout(() => {
        doLogout();
      }, SESSION_MS);
    };

    // Check immediately if session already expired
    const loginTime = parseInt(localStorage.getItem('pharmapro_login_time') || '0', 10);
    if (loginTime && Date.now() - loginTime > SESSION_MS) {
      doLogout();
      return;
    }

    // Start timer + listen for user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer

    return () => {
      clearTimeout(logoutTimer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  // Fetch pharmacy name on load and whenever user logs in
  useEffect(() => {
    if (!user) return;
    api.getSettings()
      .then(s => {
        if (s.pharmacy_name) {
          setPharmName(s.pharmacy_name);
          localStorage.setItem('pharmapro_name', s.pharmacy_name);
          localStorage.setItem('pharmapro_settings', JSON.stringify(s));
        }
      })
      .catch(() => {});
  }, [user]);

  // Listen for settings changes made in the Settings page
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'pharmapro_name' && e.newValue) {
        setPharmName(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('pharmapro_theme', dark ? 'dark' : 'light');
    document.body.style.background = dark ? '#0F172A' : THEMES.light.bg;
  }, [dark]);

  const allowedPages = getAllowedPages(user);

  // If current page is not allowed, fall back to first allowed page
  const effectivePage = allowedPages.includes(page) ? page : (allowedPages[0] || "dashboard");
  const Page = PAGES[effectivePage] || Dashboard;

  // Only show nav items the user has access to
  const visibleNav = NAV.filter(n => allowedPages.includes(n.id));

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "??";
  // Redirect to allowed page if current is blocked
  useEffect(() => {
    if (user && !allowedPages.includes(page) && allowedPages.length > 0) {
      setPage(allowedPages[0]);
    }
  }, [user, page]);

  if (!user) return <Login onLogin={u => setUser(u)} t={t} />;

  return (
    <div className="app-shell" style={{ background: t.bg, fontFamily: t.font }}>
      <style>{GLOBAL_CSS}</style>

      {/* Change Password Modal */}
      {showChangePw && <ChangePasswordModal t={t} onClose={() => setShowChangePw(false)} />}

      {/* Sidebar */}
      <div className="sidebar" style={{ background: t.sidebarBg, display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #1e293b", transition: "width 0.2s ease", height: "100%", overflow: "hidden" }}>
        {/* Logo */}
        <div style={{ padding: "28px 22px 22px", borderBottom: "1px solid #334155", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: t.glow }}>💊</div>
            <div className="logo-text-area">
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.3px", color: "#22C55E" }}>{pharmName}</div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700 }}>ENTERPRISE</div>
            </div>
          </div>
        </div>

        {/* Nav section label */}
        <div style={{ padding: "20px 22px 8px", flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "2px" }}>Main Menu</span>
        </div>

        {/* Nav — scrollable */}
        <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", overflowX: "hidden" }}>
          {visibleNav.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "none", cursor: "pointer",
                background: active ? t.primary : "transparent",
                color: active ? "#fff" : "#64748b",
                fontSize: 14, fontWeight: active ? 700 : 500,
                textAlign: "left", width: "100%", transition: "all 0.2s", fontFamily: t.font,
                boxShadow: active ? t.glow : "none", flexShrink: 0,
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{n.icon}</span>
                <span className="nav-label-text">{n.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div style={{ padding: "8px 10px", flexShrink: 0 }}>
          <button onClick={() => setDark(d => !d)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, padding: "10px 14px", color: "#64748b", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, fontFamily: t.font }}>
            <span>{dark ? "☀️" : "🌙"}</span>
            <span className="nav-label-text">{dark ? "Switch to Light" : "Switch to Dark"}</span>
          </button>
        </div>

        {/* User */}
        <div style={{ padding: "8px 10px 20px", flexShrink: 0 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #334155", borderRadius: 14, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: t.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials}</div>
              <div className="user-details" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{user.role}</div>
              </div>
            </div>
            <button onClick={() => setShowChangePw(true)}
              style={{ width: "100%", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 9, padding: "7px 0", color: t.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: t.font, marginBottom: 6, transition: "background 0.15s" }}
              onMouseEnter={e => e.target.style.background = t.surface3}
              onMouseLeave={e => e.target.style.background = "transparent"}>
              🔒 Change Password
            </button>
            <button onClick={() => { clearToken(); setUser(null); }} style={{ width: "100%", background: "transparent", border: `1px solid ${t.dangerColor}35`, borderRadius: 9, padding: "7px 0", color: t.dangerColor, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: t.font, transition: "background 0.15s" }}
              onMouseEnter={e => e.target.style.background = t.dangerColor + "15"}
              onMouseLeave={e => e.target.style.background = "transparent"}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>


      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ height: 58, background: t.cardBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "0 32px", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.accent }}>{NAV.find(n => n.id === page)?.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setPage("settings")} title="Pharmacy Settings"
              style={{ width: 34, height: 34, borderRadius: 10, background: page === "settings" ? t.accent + "20" : t.surface3, border: `1px solid ${page === "settings" ? t.accent + "50" : t.border}`, color: page === "settings" ? t.accent : t.textMuted, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = t.accent + "20"; e.currentTarget.style.borderColor = t.accent + "50"; e.currentTarget.style.color = t.accent; }}
              onMouseLeave={e => { if (page !== "settings") { e.currentTarget.style.background = t.surface3; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; } }}>
              ⚙️
            </button>
            <DBStatus t={t} />
            <div style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: t.textSub }}>
              {new Date().toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
            <button onClick={() => { clearToken(); setUser(null); }}
              title="Sign Out"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "6px 14px", color: "#F87171", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: t.font, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; }}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Page */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Page t={t} user={user}
            posCart={posCart} setPosCart={setPosCart}
            posPayment={posPayment} setPosPayment={setPosPayment}
            posDiscount={posDiscount} setPosDiscount={setPosDiscount}
            posDiscountType={posDiscountType} setPosDiscountType={setPosDiscountType}
            posPhone={posPhone} setPosPhone={setPosPhone}
            posRx={posRx} setPosRx={setPosRx}
            posInsurance={posInsurance} setPosInsurance={setPosInsurance}
            posInsuranceId={posInsuranceId} setPosInsuranceId={setPosInsuranceId}
            autoPrint={autoPrint} toggleAutoPrint={toggleAutoPrint}
          />
        </div>
      </div>
    </div>
  );
}

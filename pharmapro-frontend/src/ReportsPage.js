import { useState, useEffect } from "react";;
import { api } from "./api";
import { GlassCard, Badge, StatCard, Spinner, ProgressBar } from "./components";;
import { getAllowedPages, fmt } from "./themes";;
import SalesHistory from "./SalesHistory";
import ProfitLoss from "./ProfitLoss";
import DailyCash from "./DailyCash";
import StaffSales from "./StaffSales";
import ReorderAlerts from "./ReorderAlerts";

function Reports({ t, user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState(null);

  useEffect(() => { api.getDashboard().then(setData).finally(() => setLoading(false)); }, []);

  if (subPage === "sales_history" && getAllowedPages(user).includes("sales_history"))
    return <SalesHistory t={t} user={user} onBack={() => setSubPage(null)} />;

  if (subPage === "profit_loss" && getAllowedPages(user).includes("profit_loss"))
    return <ProfitLoss t={t} onBack={() => setSubPage(null)} />;

  if (subPage === "daily_cash")
    return <DailyCash t={t} onBack={() => setSubPage(null)} />;

  if (subPage === "reorder_alerts")
    return <ReorderAlerts t={t} onBack={() => setSubPage(null)} />;

  if (subPage === "staff_sales")
    return <StaffSales t={t} onBack={() => setSubPage(null)} />;

  if (subPage === "shift_report" && getAllowedPages(user).includes("shift_report"))
    return <ShiftReport t={t} user={user} onBack={() => setSubPage(null)} />;

  if (subPage === "today_revenue")
    return <TodayRevenue t={t} onBack={() => setSubPage(null)} />;

  if (subPage === "monthly_revenue" && getAllowedPages(user).includes("monthly_revenue"))
    return <MonthlyRevenue t={t} onBack={() => setSubPage(null)} />;

  if (loading) return <Spinner t={t} />;

  const payOpts = [
    { method: "Cash", icon: "💵", grad: t.success },
    { method: "MoMo", icon: "📱", grad: t.purple },
    { method: "POS",  icon: "💳", grad: t.info   },
  ];

  return (
    <div style={{ padding: "32px 36px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>Reports & Analytics</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Live data from your MySQL database</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
        {getAllowedPages(user).includes("shift_report") && (
          <button onClick={() => setSubPage("shift_report")}
            style={{ background: "linear-gradient(135deg,#8B5CF6,#a78bfa)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(139,92,246,0.3)" }}>
            🏁 Shift Report
          </button>
        )}
        <button onClick={() => setSubPage("reorder_alerts")}
          style={{ background: "linear-gradient(135deg,#F59E0B,#fbbf24)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8 }}>
          ⚠️ Reorder Alerts
        </button>
        {getAllowedPages(user).includes("daily_cash") && (
          <button onClick={() => setSubPage("daily_cash")}
            style={{ background: "linear-gradient(135deg,#3B82F6,#60a5fa)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8 }}>
            💵 Daily Cash
          </button>
        )}
        {getAllowedPages(user).includes("staff_sales") && (
          <button onClick={() => setSubPage("staff_sales")}
            style={{ background: "linear-gradient(135deg,#8B5CF6,#a78bfa)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8 }}>
            👥 Staff Sales
          </button>
        )}
        {getAllowedPages(user).includes("profit_loss") && (
          <button onClick={() => setSubPage("profit_loss")}
            style={{ background: "linear-gradient(135deg,#22C55E,#16a34a)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(34,197,94,0.3)" }}>
            💰 Profit & Loss
          </button>
        )}
        {getAllowedPages(user).includes("sales_history") && (
          <button
            onClick={() => setSubPage("sales_history")}
            style={{ background: "linear-gradient(135deg,#EF4444,#f87171)", border: "none", borderRadius: 14, padding: "13px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: t.font, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
            ↩️ Sales History &amp; Reversals
          </button>
        )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 28 }}>
        {[
          { icon: "💰", label: "Today's Revenue",    value: fmt(data?.today?.revenue || 0),  gradient: t.primary, onClick: () => setSubPage("today_revenue"),   hint: "Click for details" },
          { icon: "📅", label: "Monthly Revenue",    value: fmt(data?.monthly_revenue || 0), gradient: t.info,    onClick: getAllowedPages(user).includes("monthly_revenue") ? () => setSubPage("monthly_revenue") : null, hint: getAllowedPages(user).includes("monthly_revenue") ? "Click for details" : null },
          { icon: "🧾", label: "Transactions Today", value: data?.today?.transactions || 0,   gradient: t.success },
        ].map(c => <StatCard key={c.label} {...c} t={t} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <GlassCard padding="28px" t={t} hover={false}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 22, display: "flex", alignItems: "center", gap: 8 }}>📊 Daily Sales History</h3>
          {!data?.daily_chart?.length ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: t.textMuted, fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>Complete sales via POS to see history
            </div>
          ) : data.daily_chart.map((day, i) => {
            const pct = (day.total_revenue / data.daily_chart[0].total_revenue) * 100;
            return (
              <div key={i} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: t.textSub }}>{day.sale_date}</span>
                  <span style={{ fontSize: 13, fontFamily: t.mono, fontWeight: 700, color: t.accent }}>{fmt(day.total_revenue)}</span>
                </div>
                <ProgressBar value={pct} gradient={t.primary} t={t} />
              </div>
            );
          })}
        </GlassCard>

        <GlassCard padding="28px" t={t} hover={false}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 22, display: "flex", alignItems: "center", gap: 8 }}>💳 Payment Breakdown</h3>
          {payOpts.map(p => (
            <div key={p.method} style={{ background: t.surface3, border: `1px solid ${t.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: p.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{p.method}</div>
                <div style={{ fontSize: 12, color: t.textMuted }}>Payment channel</div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: t.mono, color: t.accent }}>—</span>
            </div>
          ))}
          <p style={{ fontSize: 12, color: t.textMuted, textAlign: "center", marginTop: 8 }}>Complete sales to see payment data</p>
        </GlassCard>
      </div>
    </div>
  );
}
// ==============================
//  MAIN APP
// ==============================

// All pages that can be permission-controlled
const ALL_PAGES = [
  { id: "dashboard",       icon: "📊", label: "Dashboard"            },
  { id: "inventory",       icon: "💊", label: "Inventory"            },
  { id: "pos",             icon: "🛒", label: "POS Sales"            },
  { id: "suppliers",       icon: "🏭", label: "Suppliers"            },
  { id: "staff",           icon: "👥", label: "Staff"                },
  { id: "reports",         icon: "📈", label: "Reports"              },
  { id: "monthly_revenue", icon: "💰", label: "Monthly Revenue"      },
  { id: "sales_history",   icon: "🧾", label: "Sales History"        },
  { id: "settings",        icon: "⚙️", label: "Settings"            },
  { id: "backup",          icon: "💾", label: "Backup"               },
  { id: "stock_adjust",    icon: "📦", label: "Stock Adjustment"    },
  { id: "profit_loss",     icon: "💰", label: "Profit & Loss"       },
  { id: "customers",       icon: "👥", label: "Customers"            },
  { id: "daily_cash",      icon: "💵", label: "Daily Cash"           },
  { id: "staff_sales",     icon: "📊", label: "Sales by Staff"       },
  { id: "reorder_alerts",  icon: "⚠️", label: "Reorder Alerts"       },
  { id: "shift_report",    icon: "🏁", label: "Shift Report"        },
];

// Admin/Super Admin always get all pages regardless of permissions
const ADMIN_ROLES = ["admin", "super admin"];

// Get pages a user is allowed to see
export default Reports;

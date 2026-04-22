import { useState, useEffect } from "react";
import { api } from "./api";
import { fmt , getAllowedPages } from "./themes";
import { GlassCard, Badge, Spinner, useToast, ProgressBar, StatCard } from "./components";
import TodayRevenue from "./TodayRevenue";
import MonthlyRevenue from "./MonthlyRevenue";
import LowStock from "./LowStock";
import ExpiringItems from "./ExpiringItems";
import CriticalAlerts from "./CriticalAlerts";

function Dashboard({ t, user }) {
  const [data, setData] = useState(null);
  const [expiry, setExpiry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState(null);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getExpiryReport()])
      .then(([d, e]) => { setData(d); setExpiry(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Subpage routing — AFTER all hooks
  if (subPage === "today_revenue") return <TodayRevenue t={t} onBack={() => setSubPage(null)} />;
  if (subPage === "monthly_revenue" && getAllowedPages(user).includes("monthly_revenue")) return <MonthlyRevenue t={t} onBack={() => setSubPage(null)} />;
  if (subPage === "low_stock") return <LowStock t={t} onBack={() => setSubPage(null)} />;
  if (subPage === "expiring") return <ExpiringItems t={t} onBack={() => setSubPage(null)} />;
  if (subPage === "critical_alerts") return <CriticalAlerts t={t} onBack={() => setSubPage(null)} />;

  if (loading) return <Spinner t={t} />;
  if (!data) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
      <span style={{ fontSize: 48 }}>⚡</span>
      <p style={{ color: t.dangerColor, fontSize: 15, fontWeight: 600 }}>Cannot reach API. Make sure the backend is running on port 4000.</p>
    </div>
  );

  const stats = [
    { icon: "💰", label: "Today's Revenue", value: fmt(data.today.revenue), sub: `${data.today.transactions} transactions`, gradient: t.primary, onClick: () => setSubPage("today_revenue"), hint: "Click for details" },
    { icon: "📊", label: "Monthly Revenue", value: fmt(data.monthly_revenue), sub: "This month total", gradient: t.info, onClick: getAllowedPages(user).includes("monthly_revenue") ? () => setSubPage("monthly_revenue") : null, hint: getAllowedPages(user).includes("monthly_revenue") ? "Click for details" : null },
    { icon: "⚠️", label: "Low Stock", value: data.low_stock, sub: "Below reorder level", gradient: t.warning, onClick: () => setSubPage("low_stock"), hint: "Click to manage" },
    { icon: "⏰", label: "Expiring Soon", value: data.expiring_soon, sub: "Within 90 days", gradient: t.danger, onClick: () => setSubPage("expiring"), hint: "Click to view" },
  ];

  const critical = expiry.filter(e => e.days_until_expiry <= 30);
  const warnings = expiry.filter(e => e.days_until_expiry > 30 && e.days_until_expiry <= 90);

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", fontFamily: t.font, animation: "fadeUp 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: t.accent, marginBottom: 4 }}>Dashboard Overview</div>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>Welcome back! Here's your pharmacy performance.</p>
        </div>
        <Badge label="● LIVE DATA" gradient={t.primary} size="lg" />
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {stats.map(s => <StatCard key={s.label} {...s} t={t} onClick={s.onClick} hint={s.hint} />)}
      </div>

      {/* Critical Alert Banner — only shown when there are critical/expired items */}
      {critical.length > 0 && (
        <div
          onClick={() => setSubPage("critical_alerts")}
          style={{
            background: "linear-gradient(135deg,#7f1d1d,#991b1b)",
            border: "1px solid rgba(248,113,113,0.35)",
            borderRadius: 18, padding: "16px 22px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 16,
            boxShadow: "0 6px 28px rgba(239,68,68,0.3)",
            cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 36px rgba(239,68,68,0.45)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(239,68,68,0.3)"; }}
        >
          {/* Pulsing icon */}
          <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, animation: "pulse 2s infinite" }}>🚨</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
              Critical Alerts — {critical.length} item{critical.length > 1 ? "s" : ""} need immediate attention
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {critical.map(a => `${a.name} (${a.days_until_expiry <= 0 ? "EXPIRED" : a.days_until_expiry + "d left"})`).join("  ·  ")}
            </div>
          </div>

          {/* Click to view arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 30, padding: "7px 18px", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>View All</span>
            <span style={{ color: "#fff", fontSize: 16 }}>→</span>
          </div>
        </div>
      )}

      {/* Bottom Grid */}
      <div className="bottom-grid">
        {/* Expiry Alerts */}
        <GlassCard padding="28px" t={t} hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔔</span> Expiry Alerts
            </h3>
            <Badge label={String(expiry.length)} gradient={t.primary} size="lg" />
          </div>
          {expiry.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: t.textMuted, fontSize: 13 }}>✅ No expiry alerts</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {expiry.slice(0, 8).map((item, i) => {
                const d = item.days_until_expiry;
                const grad = d <= 0 ? t.danger : d <= 30 ? t.danger : t.warning;
                const lbl = d <= 0 ? "EXPIRED" : d <= 30 ? "CRITICAL" : "WARNING";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: i < Math.min(expiry.length, 8) - 1 ? `1px solid ${t.border}` : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 3 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted, display: "flex", gap: 10 }}>
                        <span>Batch: {item.batch_number || "—"}</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <Badge label={lbl} gradient={grad} size="lg" />
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Top Performers */}
        <GlassCard padding="28px" t={t} hover={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📈</span> Top Performers
            </h3>
            <Badge label="Revenue" gradient={t.primary} size="lg" />
          </div>
          {data.top_drugs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: t.textMuted, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🛒</div>
              Complete sales to see data
            </div>
          ) : data.top_drugs.map((drug, i) => {
            const colors = [t.primary, t.info, t.purple, t.warning, t.success];
            return (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, background: t.surface3, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.textMuted }}>#{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{drug.name}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: t.mono, color: t.accent }}>{fmt(drug.revenue)}</span>
                </div>
                <ProgressBar value={100 - i * 16} gradient={colors[i % colors.length]} t={t} />
              </div>
            );
          })}
        </GlassCard>
      </div>
    </div>
  );
}

// ==============================
//  INVENTORY
// ==============================
// == Drug form rendered OUTSIDE Inventory so React never remounts it ==
// This fixes the "must click field twice" bug caused by DrugForm being
// defined inside Inventory and recreated on every render.
export default Dashboard;

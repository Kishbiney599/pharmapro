import { useState, useEffect } from "react";
import { api } from "./api";
import { fmt, getAllowedPages } from "./themes";
const ADMIN_ROLES = ["admin", "super admin"];
import { GlassCard, Badge, Spinner, Toast, useToast, Field, Input, Sel, Modal, Btn } from "./components";

function Staff({ t, user }) {
  const [staff, setStaff]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [editTarget, setEditTarget]     = useState(null); // user being permission-edited
  const [form, setForm]                 = useState({ name: "", email: "", password: "", role_id: 3, shift: "Morning", permissions: [] });
  const [saving, setSaving]             = useState(false);
  const [toast, showToast]              = useToast();
  const [resetTarget, setResetTarget]   = useState(null);
  const [newPw, setNewPw]               = useState("");
  const [showNewPw, setShowNewPw]       = useState(false);
  const [resetting, setResetting]       = useState(false);

  const isAdmin = ADMIN_ROLES.includes((user?.role || "").toLowerCase());

  const load = () => {
    setLoading(true);
    const loader = isAdmin ? api.getStaffWithPermissions() : api.getStaff();
    loader.then(setStaff).catch(e => showToast(e.message, "error")).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // == Add staff ==============================================
  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) return showToast("Name, email and password required", "error");
    setSaving(true);
    try {
      const result = await api.addStaff({ name: form.name, email: form.email, password: form.password, role_id: form.role_id, shift: form.shift });
      // Save permissions for non-admin roles
      const roleLabel = [{ v:1,l:"Super Admin"},{v:2,l:"Admin"},{v:3,l:"Pharmacist"},{v:4,l:"Cashier"},{v:5,l:"Store Manager"},{v:6,l:"Auditor"}].find(r=>r.v==form.role_id)?.l||"";
      if (!ADMIN_ROLES.includes(roleLabel.toLowerCase())) {
        await api.setUserPermissions(result.id || result.insertId, form.permissions);
      }
      showToast(`${form.name} added`);
      setShowAdd(false);
      setForm({ name:"", email:"", password:"", role_id:3, shift:"Morning", permissions:[] });
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  // == Save permissions =======================================
  const handleSavePermissions = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.setUserPermissions(editTarget.id, editTarget.permissions);
      showToast(`Permissions updated for ${editTarget.name}`);
      setEditTarget(null);
      load();
    } catch(e) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  };

  // == Reset password =========================================
  const handleResetPw = async () => {
    if (!newPw) return showToast("Password is required", "error");
    if (newPw.length < 6) return showToast("Password must be at least 6 characters", "error");
    setResetting(true);
    try {
      await api.resetUserPassword(resetTarget.id, newPw);
      showToast(`✅ Password reset for ${resetTarget.name}`);
      setResetTarget(null); setNewPw("");
    } catch(e) { showToast(e.message, "error"); }
    finally { setResetting(false); }
  };

  const toggleFormPerm = (pageId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(pageId)
        ? f.permissions.filter(p => p !== pageId)
        : [...f.permissions, pageId],
    }));
  };

  const toggleEditPerm = (pageId) => {
    setEditTarget(e => ({
      ...e,
      permissions: e.permissions.includes(pageId)
        ? e.permissions.filter(p => p !== pageId)
        : [...e.permissions, pageId],
    }));
  };

  const roleGrad  = (r) => ({ Admin:"#EF4444","Super Admin":"#EF4444",Pharmacist:t.primary,Cashier:t.success,"Store Manager":t.warning,Auditor:t.purple }[r]||t.info);
  const shiftGrad = (s) => ({ Morning:t.warning,Afternoon:t.info,Evening:t.purple }[s]||t.primary);
  const ROLES = [{v:1,l:"Super Admin"},{v:2,l:"Admin"},{v:3,l:"Pharmacist"},{v:4,l:"Cashier"},{v:5,l:"Store Manager"},{v:6,l:"Auditor"}];

  // Permission checkbox grid component
  const PermGrid = ({ selected, onToggle, isAdminRole }) => (
    <div>
      <label style={{ display:"block", fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>
        Page Access Permissions
      </label>
      {isAdminRole ? (
        <div style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#22C55E", fontWeight:600 }}>
          ✅ Admins and Super Admins automatically have access to all pages.
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {ALL_PAGES.map(p => {
            const checked = selected.includes(p.id);
            return (
              <div key={p.id}
                onClick={() => onToggle(p.id)}
                style={{ display:"flex", alignItems:"center", gap:10, background: checked ? t.accent+"15" : t.surface3, border:`1.5px solid ${checked ? t.accent+"50" : t.border}`, borderRadius:10, padding:"9px 14px", cursor:"pointer", transition:"all 0.15s", userSelect:"none" }}>
                <div style={{ width:18, height:18, borderRadius:5, background: checked ? t.accent : "transparent", border:`2px solid ${checked ? t.accent : t.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                  {checked && <span style={{ color:"#fff", fontSize:12, fontWeight:800, lineHeight:1 }}>✓</span>}
                </div>
                <span style={{ fontSize:13 }}>{p.icon}</span>
                <span style={{ fontSize:13, fontWeight: checked ? 700 : 500, color: checked ? t.text : t.textMuted }}>{p.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const selectedRoleLabel = ROLES.find(r => r.v == form.role_id)?.l || "";
  const isAdminFormRole   = ADMIN_ROLES.includes(selectedRoleLabel.toLowerCase());

  return (
    <div style={{ padding:"32px 36px", overflowY:"auto", height:"100%", fontFamily:t.font, animation:"fadeUp 0.4s ease" }}>
      <Toast msg={toast?.msg} type={toast?.type} t={t} />

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <div>
          <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.5px", color:t.accent, marginBottom:4 }}>Staff Management</div>
          <p style={{ color:t.textMuted, fontSize:14, margin:0 }}>{staff.length} staff members</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} style={{ background:t.primary, border:"none", borderRadius:14, padding:"13px 26px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:t.glow, fontFamily:t.font }}>
            + Add Staff
          </button>
        )}
      </div>

      {/* Staff table */}
      {loading ? <Spinner t={t} /> : (
        <GlassCard padding="0" hover={false} t={t} style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:t.surface3 }}>
                {["Staff Member","Role","Shift","Status","Last Login","Permissions",""].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"15px 20px", fontSize:11, fontWeight:700, color:t.textMuted, textTransform:"uppercase", letterSpacing:0.8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => {
                const isAdminUser = ADMIN_ROLES.includes((s.role||"").toLowerCase());
                const permCount   = isAdminUser ? "All" : (s.permissions?.length || 0);
                return (
                  <tr key={s.id} style={{ borderTop:`1px solid ${t.border}`, transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = t.surface3}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding:"14px 20px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:38, height:38, borderRadius:12, background:roleGrad(s.role), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>
                          {s.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:t.text }}>{s.name}</div>
                          <div style={{ fontSize:11, color:t.textMuted }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"14px 20px" }}><Badge label={s.role} gradient={roleGrad(s.role)} /></td>
                    <td style={{ padding:"14px 20px" }}><Badge label={s.shift} gradient={shiftGrad(s.shift)} /></td>
                    <td style={{ padding:"14px 20px" }}><Badge label={s.status} gradient={s.status==="active"?t.success:t.warning} /></td>
                    <td style={{ padding:"14px 20px", fontSize:12, color:t.textMuted, fontFamily:t.mono }}>{s.last_login ? new Date(s.last_login).toLocaleString() : "Never"}</td>
                    <td style={{ padding:"14px 20px" }}>
                      <span style={{ fontSize:12, fontWeight:700, color: isAdminUser ? t.accent : (s.permissions?.length > 0 ? "#3B82F6" : "#F87171"), background: isAdminUser ? t.accent+"15" : (s.permissions?.length > 0 ? "rgba(59,130,246,0.1)" : "rgba(239,68,68,0.1)"), border:`1px solid ${isAdminUser ? t.accent+"30" : (s.permissions?.length > 0 ? "rgba(59,130,246,0.25)" : "rgba(239,68,68,0.25)")}`, borderRadius:20, padding:"3px 10px" }}>
                        {isAdminUser ? "✅ Full Access" : `${permCount} page${permCount===1?"":"s"}`}
                      </span>
                    </td>
                    <td style={{ padding:"14px 20px" }}>
                      {isAdmin && (
                        <div style={{ display:"flex", gap:6 }}>
                          {!isAdminUser && (
                            <button onClick={() => setEditTarget({ id:s.id, name:s.name, role:s.role, permissions:[...(s.permissions||[])] })}
                              style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:8, padding:"6px 10px", color:"#3B82F6", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                              🔐 Permissions
                            </button>
                          )}
                          <button onClick={() => { setResetTarget({id:s.id,name:s.name}); setNewPw(""); }}
                            style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:8, padding:"6px 10px", color:"#F59E0B", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                            🔑 Reset PW
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* ── Add Staff Modal ── */}
      {showAdd && (
        <Modal title="Add Staff Member" subtitle="New account with page access control" t={t} onClose={() => setShowAdd(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Field label="Full Name *"><Input t={t} value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Dr. Kofi Mensah" /></Field>
            <Field label="Email Address *"><Input t={t} type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="kofi@pharmacy.com" /></Field>
            <Field label="Password *"><Input t={t} type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••" /></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Role">
                <Sel t={t} value={form.role_id} onChange={e => setForm(p=>({...p,role_id:e.target.value}))}>
                  {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </Sel>
              </Field>
              <Field label="Shift">
                <Sel t={t} value={form.shift} onChange={e => setForm(p=>({...p,shift:e.target.value}))}>
                  {["Morning","Afternoon","Evening","Night"].map(s => <option key={s}>{s}</option>)}
                </Sel>
              </Field>
            </div>
            {/* Permission grid */}
            <PermGrid selected={form.permissions} onToggle={toggleFormPerm} isAdminRole={isAdminFormRole} />
          </div>
          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            <Btn t={t} variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn t={t} onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "💾 Save Staff"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── Edit Permissions Modal ── */}
      {editTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:t.cardBg, border:t.cardBorder, borderRadius:22, padding:"34px", width:"min(540px,100%)", boxShadow:"0 32px 80px rgba(0,0,0,0.6)", animation:"fadeUp 0.2s ease", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:19, fontWeight:800, color:t.text, marginBottom:4 }}>🔐 Page Permissions</div>
              <p style={{ fontSize:13, color:t.textMuted, margin:0 }}>
                Select which pages <strong style={{ color:t.accent }}>{editTarget.name}</strong> can access.
              </p>
            </div>

            <PermGrid selected={editTarget.permissions} onToggle={toggleEditPerm} isAdminRole={ADMIN_ROLES.includes((editTarget.role||"").toLowerCase())} />

            {editTarget.permissions.length === 0 && !ADMIN_ROLES.includes((editTarget.role||"").toLowerCase()) && (
              <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"10px 14px", marginTop:14, fontSize:12, color:"#F87171" }}>
                ⚠️ No pages selected — this user will only see a blank screen after login.
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginTop:22 }}>
              <button onClick={() => setEditTarget(null)}
                style={{ flex:1, background:t.surface3, border:`1px solid ${t.border}`, borderRadius:12, padding:"12px 0", color:t.textSub, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
              <button onClick={handleSavePermissions} disabled={saving}
                style={{ flex:2, background:saving?t.surface3:t.primary, border:"none", borderRadius:12, padding:"12px 0", color:saving?"#aaa":"#fff", fontSize:14, fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit", boxShadow:saving?"none":t.glow, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {saving
                  ? <><span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }}/> Saving…</>
                  : "✅ Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:t.cardBg, border:t.cardBorder, borderRadius:22, padding:"34px", width:"min(440px,100%)", boxShadow:"0 32px 80px rgba(0,0,0,0.6)", animation:"fadeUp 0.2s ease" }}>
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:19, fontWeight:800, color:t.text, marginBottom:4 }}>🔑 Reset Password</div>
              <p style={{ fontSize:13, color:t.textMuted, margin:0 }}>Set a new password for <strong style={{ color:t.accent }}>{resetTarget.name}</strong></p>
            </div>
            <Field label="New Password">
              <div style={{ position:"relative" }}>
                <Input t={t} type={showNewPw?"text":"password"} value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="Minimum 6 characters" style={{ paddingRight:60 }} />
                <button type="button" onClick={() => setShowNewPw(s=>!s)}
                  style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:t.textMuted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {showNewPw?"HIDE":"SHOW"}
                </button>
              </div>
            </Field>
            <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:10, padding:"10px 14px", margin:"14px 0", fontSize:12, color:"#F59E0B" }}>
              ⚠️ The user will need to use this new password on their next login.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setResetTarget(null); setNewPw(""); }}
                style={{ flex:1, background:t.surface3, border:`1px solid ${t.border}`, borderRadius:12, padding:"12px 0", color:t.textSub, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
              <button onClick={handleResetPw} disabled={resetting||newPw.length<6}
                style={{ flex:2, background:newPw.length>=6?t.primary:t.surface3, border:"none", borderRadius:12, padding:"12px 0", color:newPw.length>=6?"#fff":t.textMuted, fontSize:14, fontWeight:700, cursor:newPw.length>=6?"pointer":"not-allowed", fontFamily:"inherit", boxShadow:newPw.length>=6?t.glow:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {resetting
                  ? <><span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }}/> Resetting…</>
                  : "🔑 Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==============================
//  REPORTS
// ==============================
export default Staff;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Files, UserPlus, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { api, dataOf } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

export function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([api.get("/api/admin/users"), api.get("/api/admin/appeals")]).then(([u,a]) => { setUsers(dataOf(u).users || []); setAppeals(dataOf(a).appeals || []); }).catch(e => setError(e.message)); }, []);
  const reviewers = users.filter(u => u.role === "REVIEWER").length;
  const open = appeals.filter(a => !["RESOLVED", "REJECTED"].includes(a.status)).length;
  return <>
    <PageHeader eyebrow="ADMINISTRATION" title="Admin overview" description="Monitor appeal activity and manage portal users." />
    <Alert>{error}</Alert>
    <div className="stat-grid"><Stat label="Registered users" value={users.length} icon={<Users />} tone="blue" /><Stat label="Total appeals" value={appeals.length} icon={<Files />} tone="green" /><Stat label="Open appeals" value={open} icon={<RefreshCw />} tone="amber" /><Stat label="Reviewers" value={reviewers} icon={<ShieldCheck />} tone="purple" /></div>
    <section className="content-card"><div className="section-heading"><div><h2>Latest appeals</h2><p>Recently submitted appeals across the institution.</p></div><Link to="/admin/appeals" className="text-link">Manage appeals <ArrowRight size={15} /></Link></div><AdminAppealTable appeals={appeals.slice(0, 6)} /></section>
    <div className="info-banner"><div className="info-banner-icon"><UserPlus /></div><div><strong>Manage portal access</strong><p>Create reviewer accounts, manage student accounts and update account status.</p></div><Link to="/admin/users" className="btn btn-outline-primary">Manage users</Link></div>
  </>;
}
function Stat({ label, value, icon, tone }) { return <div className="stat-card"><div><span>{label}</span><strong>{value}</strong></div><div className={`stat-icon ${tone}`}>{icon}</div></div>; }

export function AdminAppealTable({ appeals, onAssign, reviewers = [] }) {
  if (!appeals?.length) return <div className="empty-state"><div className="empty-icon"><Files /></div><strong>No appeals found</strong><p>Submitted appeals will appear here.</p></div>;
  return <div className="table-responsive"><table className="table portal-table align-middle"><thead><tr><th>Appeal</th><th>Student</th><th>Department</th><th>Category</th><th>Status</th>{onAssign && <th>Assign reviewer</th>}</tr></thead><tbody>{appeals.map(a => <tr key={a.appeal_id}><td><strong>#{a.appeal_id}</strong><div className="table-subtitle">{a.title}</div></td><td>{a.student_name}</td><td>{a.department_name}</td><td>{a.category_name}</td><td><StatusBadge status={a.status} /></td>{onAssign && <td><div className="assign-inline"><select className="form-select form-select-sm" defaultValue="" id={`reviewer-${a.appeal_id}`}><option value="">Select reviewer</option>{reviewers.map(r => <option key={r.user_id} value={r.user_id}>{r.name}</option>)}</select><button className="btn btn-sm btn-outline-primary" onClick={() => onAssign(a.appeal_id, document.getElementById(`reviewer-${a.appeal_id}`).value)}>Assign</button></div></td>}</tr>)}</tbody></table></div>;
}

export function AdminAppeals() {
  const { csrfToken } = useAuth();
  const [appeals, setAppeals] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [a,u] = await Promise.all([api.get("/api/admin/appeals"), api.get("/api/admin/users")]);
      setAppeals(dataOf(a).appeals || []);
      setReviewers((dataOf(u).users || []).filter(x => x.role === "REVIEWER" && x.account_status === "ACTIVE"));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function assign(appealId, reviewerId) {
    if (!reviewerId) { setError("Select a reviewer first."); return; }
    setBusy(true); setError(""); setNotice("");
    try { await api.post(`/api/admin/appeals/${appealId}/assignments`, { reviewer_id: Number(reviewerId) }, { "X-CSRF-Token": csrfToken }); setNotice(`Reviewer assigned to appeal #${appealId}.`); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); load(); }
  }
  return <><PageHeader eyebrow="CASE MANAGEMENT" title="All appeals" description="View submissions and assign active reviewers." action={<button className="btn btn-light" onClick={load}><RefreshCw size={16} /> Refresh</button>} /><Alert>{error}</Alert><Alert type="success">{notice}</Alert>{busy && <div className="small text-muted mb-2">Saving assignment…</div>}<section className="content-card"><AdminAppealTable appeals={appeals} reviewers={reviewers} onAssign={assign} /></section></>;
}

export function AdminUsers() {
  const { csrfToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "REVIEWER", department_id: "" });
  async function load() {
    try { const [u,d] = await Promise.all([api.get("/api/admin/users"), api.get("/api/admin/departments")]); setUsers(dataOf(u).users || []); setDepartments(dataOf(d).departments || []); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function createUser(e) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api.post("/api/admin/users", { ...form, department_id: form.department_id ? Number(form.department_id) : null }, { "X-CSRF-Token": csrfToken });
      setNotice("User account created."); setForm({ name: "", email: "", password: "", role: "REVIEWER", department_id: "" }); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function updateStatus(userId, status) {
    setError(""); setNotice("");
    try { await api.patch(`/api/admin/users/${userId}/status`, { account_status: status }, { "X-CSRF-Token": csrfToken }); setNotice("Account status updated."); await load(); }
    catch (e) { setError(e.message); }
  }
  return <>
    <PageHeader eyebrow="ACCESS CONTROL" title="User management" description="Create portal accounts and manage account status." />
    <Alert>{error}</Alert><Alert type="success">{notice}</Alert>
    <section className="content-card mb-4"><div className="section-heading"><div><h2>Create a user</h2><p>Public self-registration is restricted to student accounts.</p></div></div>
      <form onSubmit={createUser} className="portal-form"><div className="row g-3">
        <div className="col-md-6"><label className="form-label">Full name</label><input className="form-control" required maxLength="150" value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
        <div className="col-md-6"><label className="form-label">Email</label><input type="email" className="form-control" required value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
        <div className="col-md-4"><label className="form-label">Temporary password</label><input type="password" minLength="10" className="form-control" required value={form.password} onChange={e => setForm({...form,password:e.target.value})} /></div>
        <div className="col-md-4"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="REVIEWER">Reviewer</option><option value="STUDENT">Student</option><option value="ADMIN">Admin</option></select></div>
        <div className="col-md-4"><label className="form-label">Department</label><select className="form-select" value={form.department_id} onChange={e => setForm({...form,department_id:e.target.value})}><option value="">No department</option>{departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}</select></div>
      </div><div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button></div></form>
    </section>
    <section className="content-card"><div className="section-heading"><div><h2>Registered users</h2><p>{users.length} accounts in the system.</p></div></div>
      {!users.length ? <div className="empty-state">No users found.</div> : <div className="table-responsive"><table className="table portal-table align-middle"><thead><tr><th>User</th><th>Role</th><th>Department ID</th><th>Status</th><th>Account action</th></tr></thead><tbody>{users.map(u => <tr key={u.user_id}><td><strong>{u.name}</strong><div className="table-subtitle">{u.email}</div></td><td>{u.role}</td><td>{u.department_id ?? "—"}</td><td><StatusBadge status={u.account_status} /></td><td><select className="form-select form-select-sm status-select" value={u.account_status} onChange={e => updateStatus(u.user_id,e.target.value)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="SUSPENDED">SUSPENDED</option></select></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

export function AdminReferenceData() {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([api.get("/api/admin/departments"),api.get("/api/admin/categories")]).then(([d,c]) => { setDepartments(dataOf(d).departments || []); setCategories(dataOf(c).categories || []); }).catch(e => setError(e.message)); }, []);
  return <><PageHeader eyebrow="REFERENCE DATA" title="Departments & categories" description="View the department and appeal category options currently configured in PostgreSQL." /><Alert>{error}</Alert><div className="two-column"><section className="content-card"><div className="section-heading"><div><h2>Departments</h2><p>{departments.length} configured</p></div></div>{departments.map(d => <div className="reference-row" key={d.department_id}><div><strong>{d.department_name}</strong><small>{d.description || "No description"}</small></div><span>#{d.department_id}</span></div>)}</section><section className="content-card"><div className="section-heading"><div><h2>Appeal categories</h2><p>{categories.length} configured</p></div></div>{categories.map(c => <div className="reference-row" key={c.category_id}><div><strong>{c.category_name}</strong><small>{c.description || "No description"}</small></div><span>#{c.category_id}</span></div>)}</section></div><div className="notice-box mt-3">This backend currently exposes read-only endpoints for departments and categories. Editing or creating reference data is not included because the supplied API does not provide those operations.</div></>;
}
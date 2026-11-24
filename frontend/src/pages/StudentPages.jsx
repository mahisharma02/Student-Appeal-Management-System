import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, FilePlus2, Files, Clock3, CheckCircle2, Upload, Download, ArrowLeft, UserRound } from "lucide-react";
import { api, dataOf } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

export function StudentDashboard() {
  const [appeals, setAppeals] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.get("/api/student/appeals"), api.get("/api/student/profile")])
      .then(([a, p]) => { setAppeals(dataOf(a).appeals || []); setProfile(dataOf(p)); })
      .catch(e => setError(e.message));
  }, []);
  const counts = useMemo(() => ({
    total: appeals.length,
    pending: appeals.filter(a => ["SUBMITTED", "UNDER_REVIEW"].includes(a.status)).length,
    resolved: appeals.filter(a => a.status === "RESOLVED").length
  }), [appeals]);
  return <>
    <PageHeader eyebrow="STUDENT WORKSPACE" title={`Hello${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}`} description="Here is an overview of your submitted appeals." action={<Link className="btn btn-primary" to="/student/new-appeal"><FilePlus2 size={17} /> New appeal</Link>} />
    <Alert>{error}</Alert>
    <div className="stat-grid">
      <StatCard label="Total appeals" value={counts.total} icon={<Files />} tone="blue" />
      <StatCard label="In progress" value={counts.pending} icon={<Clock3 />} tone="amber" />
      <StatCard label="Resolved" value={counts.resolved} icon={<CheckCircle2 />} tone="green" />
    </div>
    <section className="content-card">
      <div className="section-heading"><div><h2>Recent appeals</h2><p>Your latest submissions and their status.</p></div><Link to="/student/appeals" className="text-link">View all <ArrowRight size={15} /></Link></div>
      <AppealTable appeals={appeals.slice(0, 5)} empty="You haven't submitted an appeal yet." />
    </section>
    <section className="info-banner"><div className="info-banner-icon"><UserRound /></div><div><strong>Need to raise a concern?</strong><p>Submit an appeal with the relevant details and supporting documents. You can follow its progress here.</p></div><Link to="/student/new-appeal" className="btn btn-outline-primary">Get started</Link></section>
  </>;
}

function StatCard({ label, value, icon, tone }) {
  return <div className="stat-card"><div><span>{label}</span><strong>{value}</strong></div><div className={`stat-icon ${tone}`}>{icon}</div></div>;
}

export function AppealTable({ appeals, empty }) {
  if (!appeals?.length) return <div className="empty-state"><div className="empty-icon"><Files /></div><strong>No appeals yet</strong><p>{empty}</p></div>;
  return <div className="table-responsive"><table className="table portal-table align-middle"><thead><tr><th>Appeal</th><th>Category</th><th>Department</th><th>Submitted</th><th>Status</th><th /></tr></thead><tbody>{appeals.map(a => <tr key={a.appeal_id}><td><strong>#{a.appeal_id}</strong><div className="table-subtitle">{a.title}</div></td><td>{a.category_name || "—"}</td><td>{a.department_name || "—"}</td><td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td><td><StatusBadge status={a.status} /></td><td><Link className="icon-link" to={`/student/appeals/${a.appeal_id}`} aria-label="View appeal"><ArrowRight size={17} /></Link></td></tr>)}</tbody></table></div>;
}

export function StudentAppeals() {
  const [appeals, setAppeals] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/api/student/appeals").then(p => setAppeals(dataOf(p).appeals || [])).catch(e => setError(e.message)); }, []);
  return <><PageHeader eyebrow="YOUR RECORDS" title="My appeals" description="Review the status and details of every appeal you have submitted." action={<Link to="/student/new-appeal" className="btn btn-primary"><FilePlus2 size={17} /> New appeal</Link>} /><Alert>{error}</Alert><section className="content-card"><AppealTable appeals={appeals} empty="Your submitted appeals will appear here." /></section></>;
}

export function NewAppeal() {
  const { user, csrfToken } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ department_id: user?.department_id || "", category_id: "", title: "", description: "" });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([api.get("/api/meta/departments"), api.get("/api/meta/categories")])
      .then(([d, c]) => { setDepartments(d.departments || []); setCategories(c.categories || []); })
      .catch(e => setError(e.message));
  }, []);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const payload = await api.post("/api/student/appeals", {
        ...form, department_id: Number(form.department_id), category_id: Number(form.category_id)
      }, { "X-CSRF-Token": csrfToken });
      const appeal = dataOf(payload).appeal;
      if (file && appeal?.appeal_id) {
        const fd = new FormData(); fd.append("file", file);
        await api.post(`/api/student/appeals/${appeal.appeal_id}/attachments`, fd, { "X-CSRF-Token": csrfToken });
      }
      navigate(`/student/appeals/${appeal.appeal_id}`, { state: { notice: "Your appeal has been submitted." } });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeader eyebrow="NEW SUBMISSION" title="Submit an appeal" description="Provide clear information so your appeal can be reviewed." />
    <div className="form-layout">
      <section className="content-card form-card">
        <Alert>{error}</Alert>
        <form onSubmit={submit} className="portal-form">
          <div className="form-section-title">Appeal information</div>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label">Department <span>*</span></label><select className="form-select" required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}><option value="">Choose department</option>{departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}</select><small className="field-help">Your registered department is selected by default.</small></div>
            <div className="col-md-6"><label className="form-label">Appeal category <span>*</span></label><select className="form-select" required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value="">Choose category</option>{categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}</select></div>
            <div className="col-12"><label className="form-label">Title <span>*</span></label><input className="form-control" required maxLength="200" placeholder="Briefly describe your appeal" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-12"><label className="form-label">Detailed explanation <span>*</span></label><textarea className="form-control" rows="7" required maxLength="10000" placeholder="Explain the situation, relevant dates, and the outcome you are requesting…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><div className="character-count">{form.description.length}/10000</div></div>
          </div>
          <div className="form-section-title mt-4">Supporting document <small>(optional)</small></div>
          <label className="upload-zone"><Upload size={23} /><strong>{file ? file.name : "Choose a supporting file"}</strong><span>PDF, PNG or JPG · Maximum 10 MB</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0] || null)} hidden /></label>
          <div className="form-actions"><Link to="/dashboard" className="btn btn-light">Cancel</Link><button className="btn btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit appeal"} <ArrowRight size={16} /></button></div>
        </form>
      </section>
      <aside className="side-info-card"><div className="info-card-icon"><FilePlus2 /></div><h3>Before you submit</h3><ul><li>Use a clear, specific title.</li><li>Include important dates and facts.</li><li>Explain what resolution you are requesting.</li><li>Attach relevant supporting evidence.</li></ul><div className="notice-box">After submission, your appeal status and review history will be available in your dashboard.</div></aside>
    </div>
  </>;
}

export function StudentAppealDetail() {
  const { appealId } = useParams();
  const { csrfToken } = useAuth();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  const [busyFile, setBusyFile] = useState(null);
  useEffect(() => { api.get(`/api/student/appeals/${appealId}`).then(p => setRecord(dataOf(p))).catch(e => setError(e.message)); }, [appealId]);
  async function upload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusyFile(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      await api.post(`/api/student/appeals/${appealId}/attachments`, fd, { "X-CSRF-Token": csrfToken });
      const updated = await api.get(`/api/student/appeals/${appealId}`); setRecord(dataOf(updated));
    } catch (err) { setError(err.message); }
    finally { setBusyFile(false); e.target.value = ""; }
  }
  const appeal = record?.appeal;
  return <>
    <PageHeader eyebrow={`APPEAL #${appealId}`} title="Appeal details" description="Review your submission, supporting files and status history." action={<Link to="/student/appeals" className="btn btn-light"><ArrowLeft size={16} /> Back to appeals</Link>} />
    <Alert>{error}</Alert>
    {!appeal ? <div className="content-card">{error ? "Unable to load this appeal." : "Loading appeal…"}</div> : <div className="detail-grid">
      <div className="detail-main">
        <section className="content-card">
          <div className="detail-title-row"><div><div className="eyebrow">SUBMISSION</div><h2>{appeal.title}</h2><p>Submitted {new Date(appeal.created_at).toLocaleString()}</p></div><StatusBadge status={appeal.status} /></div>
          <div className="detail-meta"><div><span>Department</span><strong>{appeal.department_name}</strong></div><div><span>Category</span><strong>{appeal.category_name}</strong></div><div><span>Last updated</span><strong>{new Date(appeal.updated_at).toLocaleString()}</strong></div></div>
          <div className="description-block"><h3>Explanation</h3><p>{appeal.description}</p></div>
        </section>
        <section className="content-card">
          <div className="section-heading"><div><h2>Appeal history</h2><p>Recorded actions for this submission.</p></div></div>
          <div className="timeline">{(record.events || []).map(ev => <div className="timeline-item" key={ev.event_id}><div className="timeline-dot" /><div><strong>{(ev.action || "").replaceAll("_", " ")}</strong><p>{ev.remarks || "Status updated"}{ev.actor_name ? ` · ${ev.actor_name}` : ""}</p><small>{new Date(ev.created_at).toLocaleString()}</small></div><StatusBadge status={ev.new_status} /></div>)}</div>
        </section>
      </div>
      <aside className="detail-aside">
        <section className="content-card"><div className="section-heading"><div><h2>Documents</h2><p>Supporting files</p></div></div>
          {(record.attachments || []).map(a => <div className="attachment-row" key={a.attachment_id}><div className="file-icon"><Files /></div><div className="attachment-name"><strong>{a.file_name}</strong><small>{a.file_size ? `${Math.ceil(a.file_size / 1024)} KB` : ""}</small></div><button className="icon-button" onClick={() => api.download(`/api/appeals/attachments/${a.attachment_id}/download`, a.file_name).catch(e => setError(e.message))}><Download size={17} /></button></div>)}
          <label className="btn btn-outline-primary w-100 upload-more"><Upload size={16} /> {busyFile ? "Uploading…" : "Add document"}<input type="file" hidden disabled={busyFile} accept=".pdf,.png,.jpg,.jpeg" onChange={upload} /></label>
          <small className="field-help">PDF, PNG or JPG. Maximum 10 MB.</small>
        </section>
      </aside>
    </div>}
  </>;
}

export function StudentProfile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/api/student/profile").then(p => setProfile(dataOf(p))).catch(e => setError(e.message)); }, []);
  return <><PageHeader eyebrow="ACCOUNT" title="My profile" description="Your registered student account information." /><Alert>{error}</Alert><section className="content-card profile-card">{profile ? <><div className="profile-avatar">{profile.name?.slice(0, 1)}</div><h2>{profile.name}</h2><p>{profile.email}</p><div className="profile-details"><div><span>Department</span><strong>{profile.department_name || "Not assigned"}</strong></div><div><span>Account role</span><strong>{profile.role}</strong></div><div><span>Account status</span><strong><StatusBadge status={profile.account_status} /></strong></div><div><span>Member since</span><strong>{new Date(profile.created_at).toLocaleDateString()}</strong></div></div></> : "Loading profile…"}</section></>;
}
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, ClipboardCheck, Clock3, CheckCircle2, ArrowLeft, Download,
  Search, FileText, CalendarDays, UserRound, Building2, FolderOpen,
  ShieldCheck, AlertCircle, Check, X, RefreshCw, MessageSquareText
} from "lucide-react";
import { api, dataOf } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";

const isClosed = (status) => ["RESOLVED", "REJECTED"].includes(status);
const dateLabel = (value, withTime = false) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
};

export function ReviewerDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try { setAssignments(dataOf(await api.get("/api/reviewer/assignments")).assignments || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const active = assignments.filter(a => a.assignment_status === "ACTIVE" && !isClosed(a.status));
  const pending = active.filter(a => a.status === "SUBMITTED");
  const inReview = active.filter(a => a.status === "UNDER_REVIEW");
  const completed = assignments.filter(a => a.assignment_status === "COMPLETED" || isClosed(a.status));
  const recent = [...assignments].sort((a,b) => new Date(b.assigned_at || 0) - new Date(a.assigned_at || 0)).slice(0,5);

  return <div className="reviewer-workspace">
    <PageHeader eyebrow="REVIEW WORKSPACE" title="Reviewer dashboard" description="A focused workspace for examining assigned student appeals and recording fair, traceable decisions."
      action={<button className="btn btn-outline-primary" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>} />
    <Alert>{error}</Alert>
    <div className="reviewer-welcome"><div className="reviewer-welcome-icon"><ShieldCheck size={22}/></div><div><strong>Your review queue</strong><p>Review each assigned case carefully. Decisions and remarks are retained in the appeal history.</p></div><Link to="/reviewer/assignments" className="text-link">Open review queue <ArrowRight size={15}/></Link></div>
    <div className="stat-grid reviewer-stat-grid">
      <Stat label="Total assignments" value={loading ? "—" : assignments.length} icon={<ClipboardCheck />} tone="blue" helper="All cases assigned to you" />
      <Stat label="Awaiting review" value={loading ? "—" : pending.length} icon={<Clock3 />} tone="amber" helper="Submitted cases" />
      <Stat label="Under review" value={loading ? "—" : inReview.length} icon={<FileText />} tone="purple" helper="In progress" />
      <Stat label="Completed" value={loading ? "—" : completed.length} icon={<CheckCircle2 />} tone="green" helper="Final decisions recorded" />
    </div>
    <section className="content-card reviewer-table-card">
      <div className="section-heading"><div><h2>Recent assigned appeals</h2><p>Your latest assignments, with their current review status.</p></div><Link to="/reviewer/assignments" className="text-link">View all appeals <ArrowRight size={15}/></Link></div>
      {loading ? <div className="reviewer-loading"><span className="spinner-border spinner-border-sm"/> Loading your assignments…</div> : <AssignmentTable assignments={recent} />}
    </section>
    <div className="reviewer-guidance"><div className="reviewer-guidance-icon"><MessageSquareText size={19}/></div><div><strong>Keep every decision explainable</strong><p>Use the remarks field to document the reasoning behind a decision. The recorded action becomes part of the appeal's history.</p></div></div>
  </div>;
}

function Stat({ label, value, icon, tone, helper }) {
  return <div className="stat-card reviewer-stat-card"><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><div className={`stat-icon ${tone}`}>{icon}</div></div>;
}

export function AssignmentTable({ assignments }) {
  if (!assignments?.length) return <div className="empty-state"><div className="empty-icon"><ClipboardCheck /></div><strong>No assignments found</strong><p>New appeals assigned by the administrator will appear here.</p></div>;
  return <div className="table-responsive"><table className="table portal-table align-middle reviewer-table"><thead><tr><th>Appeal</th><th>Student</th><th>Category</th><th>Assigned</th><th>Assignment</th><th>Appeal status</th><th><span className="visually-hidden">Open</span></th></tr></thead><tbody>{assignments.map(a => <tr key={a.assignment_id}>
    <td><strong className="reviewer-appeal-id">#{a.appeal_id}</strong><div className="table-subtitle">{a.title}</div></td>
    <td><span className="reviewer-student-name">{a.student_name}</span></td><td>{a.category_name}</td><td>{dateLabel(a.assigned_at)}</td>
    <td><StatusBadge status={a.assignment_status} /></td><td><StatusBadge status={a.status} /></td>
    <td><Link className="reviewer-open-link" to={`/reviewer/appeals/${a.appeal_id}`} aria-label={`Review appeal ${a.appeal_id}`}>Review <ArrowRight size={15}/></Link></td>
  </tr>)}</tbody></table></div>;
}

export function ReviewerAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  async function load() {
    setLoading(true); setError("");
    try { setAssignments(dataOf(await api.get("/api/reviewer/assignments")).assignments || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => assignments.filter(a => {
    const term = query.trim().toLowerCase();
    const matches = !term || [a.appeal_id, a.title, a.student_name, a.category_name].some(v => String(v || "").toLowerCase().includes(term));
    const matchesFilter = filter === "ALL" || (filter === "PENDING" && a.status === "SUBMITTED" && a.assignment_status === "ACTIVE") || (filter === "UNDER_REVIEW" && a.status === "UNDER_REVIEW" && a.assignment_status === "ACTIVE") || (filter === "COMPLETED" && (a.assignment_status === "COMPLETED" || isClosed(a.status)));
    return matches && matchesFilter;
  }), [assignments, query, filter]);
  return <div className="reviewer-workspace">
    <PageHeader eyebrow="REVIEW QUEUE" title="Assigned appeals" description="Search your assigned cases, check their current status and open a case to review it." action={<button className="btn btn-outline-primary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>} />
    <Alert>{error}</Alert>
    <section className="content-card reviewer-queue-card">
      <div className="reviewer-queue-toolbar"><div><h2>My assigned cases</h2><p>{assignments.length} total assignment{assignments.length === 1 ? "" : "s"}</p></div><div className="reviewer-queue-controls">
        <div className="reviewer-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search appeal, student or category" aria-label="Search assigned appeals"/></div>
        <select className="form-select reviewer-filter" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter appeals"><option value="ALL">All cases</option><option value="PENDING">Awaiting review</option><option value="UNDER_REVIEW">Under review</option><option value="COMPLETED">Completed</option></select>
      </div></div>
      {loading ? <div className="reviewer-loading"><span className="spinner-border spinner-border-sm"/> Loading assignments…</div> : <AssignmentTable assignments={filtered}/>}
    </section>
  </div>;
}

export function ReviewerAppealDetail() {
  const { appealId } = useParams();
  const { csrfToken } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [decision, setDecision] = useState("start_review");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try { setRecord(dataOf(await api.get(`/api/reviewer/appeals/${appealId}`))); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [appealId]);
  const appeal = record?.appeal;
  const closed = isClosed(appeal?.status);
  const canStart = appeal?.status === "SUBMITTED";

  async function submitDecision(e) {
    e.preventDefault();
    if (decision === "reject" && !remarks.trim()) { setError("Please add remarks explaining why this appeal is being rejected."); return; }
    if (decision === "approve" && !remarks.trim()) { setError("Please add a short rationale before approving this appeal."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await api.post(`/api/reviewer/appeals/${appealId}/decision`, { decision, remarks: remarks.trim(), version: appeal.version }, { "X-CSRF-Token": csrfToken });
      setNotice("Your action has been recorded in the appeal history.");
      setRemarks("");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="reviewer-workspace reviewer-case-workspace">
    <div className="reviewer-back-row"><button className="reviewer-back-link" onClick={() => navigate("/reviewer/assignments")}><ArrowLeft size={16}/> Back to assigned appeals</button><button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh case</button></div>
    <PageHeader eyebrow={`CASE REVIEW  /  APPEAL #${appealId}`} title={appeal?.title || "Appeal review"} description="Examine the student's submission and supporting documents before recording your decision." />
    <Alert>{error}</Alert><Alert type="success">{notice}</Alert>
    {loading && !appeal ? <section className="content-card reviewer-loading"><span className="spinner-border spinner-border-sm"/> Loading appeal details…</section> : !appeal ? <section className="content-card"><div className="empty-state"><div className="empty-icon"><AlertCircle/></div><strong>Appeal could not be loaded</strong><p>Check your assignment or return to the review queue.</p></div></section> : <>
      <div className="reviewer-case-banner"><div className="reviewer-case-banner-main"><span className="eyebrow">CURRENT CASE STATUS</span><div className="reviewer-case-status"><StatusBadge status={appeal.status}/><span>Appeal #{appeal.appeal_id}</span></div><p>Submitted {dateLabel(appeal.created_at, true)}</p></div><div className="reviewer-case-banner-meta"><div><span>Last updated</span><strong>{dateLabel(appeal.updated_at || appeal.created_at, true)}</strong></div><div><span>Record version</span><strong>v{appeal.version}</strong></div></div></div>
      <div className="reviewer-case-grid">
        <main className="reviewer-case-main">
          <section className="content-card reviewer-case-card">
            <div className="section-heading"><div><h2>Student and appeal information</h2><p>Details provided with the original submission.</p></div><div className="reviewer-section-icon"><UserRound size={18}/></div></div>
            <div className="reviewer-student-panel"><div className="reviewer-student-avatar">{(appeal.student_name || "S").slice(0,1).toUpperCase()}</div><div><strong>{appeal.student_name}</strong><span>{appeal.student_email || "Student account"}</span></div></div>
            <div className="reviewer-facts-grid"><Fact icon={<Building2/>} label="Department" value={appeal.department_name}/><Fact icon={<FolderOpen/>} label="Appeal category" value={appeal.category_name}/><Fact icon={<CalendarDays/>} label="Submitted on" value={dateLabel(appeal.created_at)}/><Fact icon={<FileText/>} label="Appeal reference" value={`#${appeal.appeal_id}`}/></div>
            <div className="reviewer-description"><div className="reviewer-description-heading"><FileText size={17}/><h3>Student's explanation</h3></div><p>{appeal.description || "No explanation was provided."}</p></div>
          </section>
          <section className="content-card reviewer-case-card">
            <div className="section-heading"><div><h2>Supporting documents</h2><p>Files attached to this appeal by the student.</p></div><div className="reviewer-section-icon"><FolderOpen size={18}/></div></div>
            {(record.attachments || []).length ? <div className="reviewer-attachment-list">{record.attachments.map(a => <div className="reviewer-attachment" key={a.attachment_id}><div className="reviewer-attachment-icon"><FileText size={19}/></div><div className="reviewer-attachment-info"><strong>{a.file_name}</strong><span>{a.file_size ? `${Math.max(1, Math.ceil(a.file_size / 1024))} KB` : "Attachment"}</span></div><button className="btn btn-outline-primary btn-sm" onClick={() => api.download(`/api/appeals/attachments/${a.attachment_id}/download`, a.file_name).catch(e => setError(e.message))}><Download size={14}/> Download</button></div>)}</div> : <div className="reviewer-no-attachments"><FolderOpen size={20}/><span>No supporting documents were attached to this appeal.</span></div>}
          </section>
          <section className="content-card reviewer-case-card">
            <div className="section-heading"><div><h2>Appeal activity</h2><p>Chronological record of actions taken on this case.</p></div><div className="reviewer-section-icon"><Clock3 size={18}/></div></div>
            {(record.events || []).length ? <div className="reviewer-timeline">{record.events.map((ev, index) => <div className="reviewer-timeline-item" key={ev.event_id}><div className="reviewer-timeline-marker">{index === record.events.length - 1 ? <span/> : null}</div><div className="reviewer-timeline-content"><div className="reviewer-event-heading"><strong>{(ev.action || "UPDATE").replaceAll("_", " ")}</strong><StatusBadge status={ev.new_status}/></div><p>{ev.remarks || "No additional remarks recorded."}</p><span>{ev.actor_name} · {dateLabel(ev.created_at, true)}</span></div></div>)}</div> : <p className="muted-text">No activity has been recorded yet.</p>}
          </section>
        </main>
        <aside className="reviewer-case-aside">
          <section className="content-card reviewer-decision-panel">
            <div className="reviewer-decision-heading"><div className="reviewer-decision-icon"><ClipboardCheck size={19}/></div><div><h2>Review decision</h2><p>Record the outcome of your assessment.</p></div></div>
            {closed ? <div className="reviewer-closed-state"><div className="reviewer-closed-icon"><CheckCircle2 size={21}/></div><strong>Final decision recorded</strong><p>This appeal is {appeal.status.toLowerCase()}. Its active reviewer assignment has been completed and no further decision can be submitted.</p></div> : <form onSubmit={submitDecision} className="portal-form reviewer-decision-form">
              <label className="form-label">Select an action</label>
              <div className="reviewer-decision-options">
                {canStart && <DecisionOption value="start_review" current={decision} onSelect={setDecision} icon={<Clock3 size={18}/>} title="Start review" detail="Move this case into review." tone="blue"/>}
                <DecisionOption value="approve" current={decision} onSelect={setDecision} icon={<Check size={18}/>} title="Approve appeal" detail="Resolve the appeal in the student's favour." tone="green"/>
                <DecisionOption value="reject" current={decision} onSelect={setDecision} icon={<X size={18}/>} title="Reject appeal" detail="Reject the submitted appeal." tone="red"/>
              </div>
              <div className="reviewer-remarks-label"><label className="form-label" htmlFor="reviewer-remarks">Reviewer remarks {decision !== "start_review" && <span>*</span>}</label><span>{remarks.length}/5000</span></div>
              <textarea id="reviewer-remarks" className="form-control reviewer-remarks" rows="6" maxLength="5000" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={decision === "start_review" ? "Add an optional note about starting the review…" : "Explain the reasoning for your decision…"}/>
              <small className="field-help">{decision === "start_review" ? "Remarks are saved in the appeal activity record." : "A clear explanation is required for a final decision."}</small>
              <button className={`btn w-100 reviewer-submit reviewer-submit-${decision}`} disabled={busy}>{busy ? "Recording action…" : decision === "start_review" ? "Start review" : decision === "approve" ? "Confirm approval" : "Confirm rejection"}<ArrowRight size={16}/></button>
              <div className="reviewer-integrity-note"><ShieldCheck size={15}/><span>Your action is securely recorded in the appeal history.</span></div>
            </form>}
          </section>
          <section className="reviewer-process-note"><div><AlertCircle size={17}/><strong>Before you submit</strong></div><p>Verify the appeal details and review all available attachments. Final decisions close the active reviewer assignments.</p></section>
        </aside>
      </div>
    </>}
  </div>;
}

function Fact({ icon, label, value }) { return <div className="reviewer-fact"><div className="reviewer-fact-icon">{icon}</div><div><span>{label}</span><strong>{value || "—"}</strong></div></div>; }
function DecisionOption({ value, current, onSelect, icon, title, detail, tone }) {
  const selected = current === value;
  return <button type="button" className={`reviewer-decision-option ${selected ? "selected" : ""} ${tone}`} onClick={() => onSelect(value)} aria-pressed={selected}><span className="reviewer-option-icon">{icon}</span><span className="reviewer-option-copy"><strong>{title}</strong><small>{detail}</small></span><span className="reviewer-option-radio">{selected && <span/>}</span></button>;
}

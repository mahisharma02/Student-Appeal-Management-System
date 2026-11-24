import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, dataOf } from "../services/api";
import { registerRequest } from "../services/auth";
import Alert from "../components/Alert";

function AuthFrame({ title, subtitle, children, footer }) {
  return <div className="auth-page">
    <div className="auth-decoration"><div className="auth-decoration-orb orb-one" /><div className="auth-decoration-orb orb-two" /><div className="auth-brand"><div className="brand-mark"><GraduationCap size={25} /></div><span>Appeal Portal</span></div><div className="auth-message"><div className="eyebrow light">STUDENT SERVICES</div><h1>Your voice matters.<br />We're here to listen.</h1><p>A clear, secure way to submit and follow up on academic appeals.</p></div><div className="auth-footnote">Student Appeal Management System</div></div>
    <div className="auth-main"><div className="auth-card"><div className="auth-card-heading"><div className="auth-mini-mark"><GraduationCap /></div><h2>{title}</h2><p>{subtitle}</p></div>{children}<div className="auth-footer">{footer}</div></div></div>
  </div>;
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await login(form.email, form.password); navigate("/dashboard", { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="Welcome back" subtitle="Sign in to continue to your account." footer={<>New student? <Link to="/register">Create an account</Link></>}>
    <Alert>{error}</Alert>
    <form onSubmit={submit} className="auth-form">
      <label>Email address</label><div className="input-icon"><Mail size={18} /><input type="email" required autoComplete="username" placeholder="you@university.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <label>Password</label><div className="input-icon"><LockKeyhole size={18} /><input type="password" required autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
      <button className="btn btn-primary w-100 auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="auth-hint">Use the account credentials provided or registered with your institution.</div>
  </AuthFrame>;
}

export function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", department_id: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/api/meta/departments").then(p => setDepartments(p.departments || dataOf(p).departments || [])).catch(e => setError(e.message)); }, []);
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      await registerRequest({ ...form, department_id: Number(form.department_id) });
      navigate("/login", { state: { notice: "Your student account has been created. Please sign in." } });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="Create student account" subtitle="Register to submit and track academic appeals." footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
    <Alert>{error}</Alert>
    <form onSubmit={submit} className="auth-form">
      <label>Full name</label><div className="input-icon"><UserRound size={18} /><input required maxLength="150" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <label>Email address</label><div className="input-icon"><Mail size={18} /><input type="email" required placeholder="you@university.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <label>Department</label><select className="form-select auth-select" required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}><option value="">Select your department</option>{departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}</select>
      <label>Password</label><div className="input-icon"><LockKeyhole size={18} /><input type="password" required minLength="8" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
      <button className="btn btn-primary w-100 auth-submit" disabled={busy || !departments.length}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    <div className="auth-hint">Public registration creates a STUDENT account only.</div>
  </AuthFrame>;
}
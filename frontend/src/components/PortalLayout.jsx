import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, FilePlus2, Files, UserRound, Users, ClipboardList,
  LogOut, Menu, X, GraduationCap, ShieldCheck, ClipboardCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const menus = {
  STUDENT: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/student/new-appeal", label: "Submit an appeal", icon: FilePlus2 },
    { to: "/student/appeals", label: "My appeals", icon: Files },
    { to: "/student/profile", label: "My profile", icon: UserRound }
  ],
  REVIEWER: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/reviewer/assignments", label: "Assigned appeals", icon: ClipboardCheck }
  ],
  ADMIN: [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/appeals", label: "All appeals", icon: Files },
    { to: "/admin/users", label: "User management", icon: Users },
    { to: "/admin/reference-data", label: "Departments & categories", icon: ClipboardList }
  ],
};

const roleLabels = { STUDENT: "Student", REVIEWER: "Reviewer", ADMIN: "Administrator" };

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const items = menus[user?.role] || [];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="portal-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={23} /></div>
          <div><strong>Appeal Portal</strong><small>Student services</small></div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note"><ShieldCheck size={17} /><span>Your account is protected by secure sessions.</span></div>
          <button className="side-link logout-link" onClick={handleLogout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      {open && <button className="mobile-overlay" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="topbar-label">Student Appeal Management System</div>
          <div className="user-chip">
            <div className="avatar">{(user?.name || "U").slice(0, 1).toUpperCase()}</div>
            <div><strong>{user?.name}</strong><small>{roleLabels[user?.role] || user?.role}</small></div>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
        <footer className="page-footer">Student Appeal Management System <span>•</span> Secure academic support</footer>
      </main>
    </div>
  );
}
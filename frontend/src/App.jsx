import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PortalLayout from "./components/PortalLayout";
import LoadingScreen from "./components/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import { Login, Register } from "./pages/AuthPages";
import { StudentDashboard, StudentAppeals, NewAppeal, StudentAppealDetail, StudentProfile } from "./pages/StudentPages";
import { ReviewerDashboard, ReviewerAssignments, ReviewerAppealDetail } from "./pages/ReviewerPages";
import { AdminDashboard, AdminAppeals, AdminUsers, AdminReferenceData } from "./pages/AdminPages";

function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "STUDENT") return <StudentDashboard />;
  if (user.role === "REVIEWER") return <ReviewerDashboard />;
  if (user.role === "ADMIN") return <AdminDashboard />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute roles={["STUDENT","REVIEWER","ADMIN"]} />}>
      <Route element={<PortalLayout />}>
        <Route path="/dashboard" element={<DashboardRedirect />} />
        <Route element={<ProtectedRoute roles={["STUDENT"]} />}>
          <Route path="/student/new-appeal" element={<NewAppeal />} />
          <Route path="/student/appeals" element={<StudentAppeals />} />
          <Route path="/student/appeals/:appealId" element={<StudentAppealDetail />} />
          <Route path="/student/profile" element={<StudentProfile />} />
        </Route>
        <Route element={<ProtectedRoute roles={["REVIEWER"]} />}>
          <Route path="/reviewer/assignments" element={<ReviewerAssignments />} />
          <Route path="/reviewer/appeals/:appealId" element={<ReviewerAppealDetail />} />
        </Route>
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/admin/appeals" element={<AdminAppeals />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/reference-data" element={<AdminReferenceData />} />
        </Route>
      </Route>
    </Route>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
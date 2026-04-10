import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <p className="eyebrow">Mission Control</p>
        <h1>Dashboard</h1>
        <p className="dashboard-copy">
          Welcome back,{" "}
          <span className="welcome-name">{user?.username || user?.email}</span>.
          Your CEFR workspace is ready for the next session.
        </p>
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </section>
    </main>
  );
}

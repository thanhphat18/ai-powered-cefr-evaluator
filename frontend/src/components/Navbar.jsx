import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_AVATAR_URL } from "../lib/avatar";
import { useAuth } from "../context/useAuth";

export default function Navbar(){
    const navigate = useNavigate();
    const { user, loading, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return(
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/dashboard" className="navbar-brand">
                    ETest
                </Link>
                <div>
                    <Link to="/dashboard" className="navbar-link">
                        Home
                    </Link>
                    {user?.role === "admin" ? (
                        <Link to="/admin" className="navbar-link">
                            Admin
                        </Link>
                    ) : null}
                </div>
            </div>
            <div className="navbar-auth">
                {loading ? null : user ? (
                    <>
                        <Link to="/profile" className="navbar-user navbar-user-link" title={user.email}>
                            <img
                                className="navbar-avatar"
                                src={user.avatarUrl || DEFAULT_AVATAR_URL}
                                alt={`${user.username || user.email} avatar`}
                            />
                            <span>{user.username || user.email}</span>
                            <span className="navbar-role-badge">
                                {user.role || "student"}
                            </span>
                        </Link>
                        <button type="button" className="navbar-logout" onClick={handleLogout}>
                            Log Out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="navbar-link">
                            Log In
                        </Link>
                        <Link to="/register" className="navbar-link navbar-link-accent">
                            Register
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}

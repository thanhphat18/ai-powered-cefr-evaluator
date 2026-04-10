import { Link } from "react-router-dom";

export default function Navbar(){

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
                </div>
            </div>
            <div className="navbar-auth">
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
            </div>
        </nav>
    );
}
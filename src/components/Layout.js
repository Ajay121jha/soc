import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";
import "../styles/Layout.css";

const protectedRoutes = [
  "/dashboard",
  "/shifts",
  "/knowledge_base",
  "/operation_runbook",
  "/advisory_system"
];

function Layout() {
  const { isAuthenticated, logout, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = () => {
    login();
    navigate("/login");
  };

  const handleRegister = () => {
    navigate("/register");
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!isAuthenticated && protectedRoutes.includes(location.pathname)) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    if (isAuthenticated && location.pathname === "/") {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <div className="container">
      <header className="navbar">
        <div className="logo-container">
          <img src="/logo.png" className="logo-image" alt="Logo" />
          <h1 className="logo-text">Grant Thornton</h1>
        </div>
        <nav>
          <ul className="nav-links">
            {!isAuthenticated ? (
              <>
                <li>
                  <button onClick={handleRegister} className="register-btn">Register</button>
                </li>
                <li>
                  <button onClick={handleLogin} className="login-btn">Login</button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""}>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/shifts" className={location.pathname === "/shifts" ? "active" : ""}>
                    Shifts
                  </Link>
                </li>
                <li>
                  <Link to="/knowledge_base" className={location.pathname === "/knowledge_base" ? "active" : ""}>
                    Knowledge Base
                  </Link>
                </li>
                <li>
                  <Link to="/operation_runbook" className={location.pathname === "/operation_runbook" ? "active" : ""}>
                    Operation Runbook
                  </Link>
                </li>
                <li>
                  <Link to="/advisory_system" className={location.pathname === "/advisory_system" ? "active" : ""}>
                    Advisory System
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} className="logout-btn">Logout</button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>
      
      <main className="content">
        <Outlet />
      </main>
      
      <footer className="footer">
        <p>© 2025 Grant Thornton Bharat LLP - All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default Layout;

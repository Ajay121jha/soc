import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

import "../styles/Layout.css";

const protectedRoutes = [
  "/dashboard",
  "/roster",
  "/shift_handover",
  "/knowledge_base",
  "/operation_runbook",
  "/advisory_system"
];


function Layout() {
  const { isAuthenticated, logout, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navbarColor, setNavbarColor] = useState("#121212");
  

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

  useEffect(() => {
    // Set navbar color based on route
    if (location.pathname === "/") {
      setNavbarColor("#121212"); // dark for landing page
    } else if (location.pathname === "/login" || location.pathname === "/register") {
      setNavbarColor("#333333"); // white for login/register
    } else {
      setNavbarColor("#003854"); // light gray or any color for other pages
    }
  }, [location.pathname]);


  return (
    <div className="container">
      <header className="navbar" style={{ backgroundColor: navbarColor }}>
        <div className="logo-container">
          <img src="/logo.png" className="logo-image" alt="Logo" />
          <h1 className="logo-text">Grant Thornton</h1>
        </div>
        <nav>
          <ul className="nav-links">
            {!isAuthenticated ? (
              <>
                <li>
                  <button onClick={handleRegister} className="button"><span>Register</span></button>
                </li>
                <li>
                  <button onClick={handleLogin} className="button"><span>Login</span></button>
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
                  <Link to="/roster" className={location.pathname === "/roster" ? "active" : ""}>
                    Roster
                  </Link>
                </li>
                <li>
                  <Link to="/shift_handover" className={location.pathname === "/shift_handover" ? "active" : ""}>
                    Shift Handover
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

      <footer className="footer" style={{ backgroundColor: navbarColor }}>
        <p>© 2025 Grant Thornton Bharat LLP - All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default Layout;

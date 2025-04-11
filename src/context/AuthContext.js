import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://192.168.1.47:5000/api/validate", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("authToken");
          localStorage.removeItem("username");
          localStorage.removeItem("user_id");
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Token validation error:", error);
        localStorage.removeItem("authToken");
        localStorage.removeItem("username");
        localStorage.removeItem("user_id");
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch("http://192.168.1.47:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        // Save everything from response
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("user_id", data.user_id);
        setIsAuthenticated(true);
        return true;
      } else {
        console.error("Login failed:", data.error);
        return false;
      }
    } catch (error) {
      console.error("Error logging in:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    setIsAuthenticated(false);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

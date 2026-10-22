
import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AuthPage from "./AuthPage";
import Dashboard from "./Dashboard";
import api from "./api";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const token = localStorage.getItem("token");

      if (!token) {
        setChecking(false);
        return;
      }

      try {
        await api.get("/auth/me");
        setAuthenticated(true);
      } catch {
        localStorage.removeItem("token");
        setAuthenticated(false);
      } finally {
        setChecking(false);
      }
    }

    verifySession();
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    setAuthenticated(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Checking your session...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AuthPage onLogin={() => setAuthenticated(true)} />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard onLogout={handleLogout} />}
      />

      <Route
        path="/consumption"
        element={<Dashboard onLogout={handleLogout} />}
      />

      <Route
        path="/forecast"
        element={<Dashboard onLogout={handleLogout} />}
      />

      <Route
        path="/settings"
        element={<Dashboard onLogout={handleLogout} />}
      />

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}

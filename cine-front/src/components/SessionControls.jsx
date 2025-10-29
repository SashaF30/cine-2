import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SessionControls({ className = "" }) {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className={className} style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
        Hola, {user?.nombre || user?.email}
      </span>
      <button type="button" onClick={logout} className="btn btn-outline" style={{ cursor: "pointer" }}>
        Cerrar sesión
      </button>
    </div>
  );
}

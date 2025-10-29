// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import PeliculasScreen from "./screens/PeliculasScreen";
import PeliculaDetalle from "./screens/PeliculaDetalle";
import LoginScreen from "./screens/LoginScreen";
import SeleccionButacas from "./screens/SeleccionButacas";
import PaySimScreen from "./screens/PaySimScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  // Mantengo AuthProvider aquí como lo tenías
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<PeliculasScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/pelicula/:id" element={<PeliculaDetalle />} />
        <Route
          path="/reserva/:id/seleccion"
          element={
            <PrivateRoute>
              <SeleccionButacas />
            </PrivateRoute>
          }
        />
        <Route
          path="/pago/:id"
          element={
            <PrivateRoute>
              <PaySimScreen />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

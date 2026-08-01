import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import App from "./App.jsx";
import Pantalla from "./screens/Pantalla.jsx";
import Turno from "./screens/Turno.jsx";
import Zona from "./screens/Zona.jsx";
import Totem from "./screens/Totem.jsx";
import { AuthProvider } from "./auth.jsx";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

// Rutas PÚBLICAS (sin login):
//   /pantalla → tablero de estado para los clientes
//   /turno    → el cliente saca su número (destino del QR)
//   /zona     → monitor del dueño de área (?s=Lácteos)
const path =
  typeof window !== "undefined"
    ? window.location.pathname.replace(/\/+$/, "").toLowerCase()
    : "";
const publicScreen = path.endsWith("/pantalla")
  ? <Pantalla />
  : path.endsWith("/turno")
    ? <Turno />
    : path.endsWith("/zona")
      ? <Zona />
      : path.endsWith("/totem")
        ? <Totem />
        : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {publicScreen || (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
    <Analytics />
  </React.StrictMode>
);

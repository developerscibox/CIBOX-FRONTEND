import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import { hydrateBrand } from "./brand.js";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

const mount = () =>
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
      <Analytics />
    </React.StrictMode>
  );

// Identidad de Cibox: los datos legales y de contacto viven en el backend
// (GET /api/config/brand). Se piden antes de montar; hydrateBrand nunca lanza,
// así que si el backend no responde el panel arranca igual con los tokens
// visuales de brand.js.
hydrateBrand().then(mount);

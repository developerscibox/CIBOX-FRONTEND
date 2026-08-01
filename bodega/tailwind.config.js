/** Tailwind SOLO para el Dashboard Gerencial 360° (screens/DashboardGerencial360.jsx).
 *  - content: únicamente ese archivo → se generan solo sus utilidades (JIT).
 *  - preflight OFF: sin reset global, para no tocar los estilos del panel (index.css).
 *  El resto del panel sigue con su CSS propio; no usar clases Tailwind fuera del dashboard. */
export default {
  content: ["./src/screens/DashboardGerencial360.jsx"],
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};

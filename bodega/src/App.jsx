import { useEffect, useRef, useState } from "react";
import { Sidebar, Topbar, NAV_PERMS, NAV_MODS, NAV, BottomNav } from "./ui.jsx";
import { api, useLoad, usingMock, streamUrl } from "./api.js";
import { useAuth, HOME_BY_ROLE, PREVIEW_ROLES } from "./auth.jsx";
import Login from "./screens/Login.jsx";
import { ORDERS_TO_PREPARE } from "./data.js";
import Dashboard from "./screens/Dashboard.jsx";
import Cobranza from "./screens/Cobranza.jsx";
import Clientes from "./screens/Clientes.jsx";
import Gerencia from "./screens/Gerencia.jsx";
import DashboardGerencial360 from "./screens/DashboardGerencial360.jsx";
import Reportes from "./screens/Reportes.jsx";
import CierreZ from "./screens/CierreZ.jsx";
import FEFO from "./screens/FEFO.jsx";
import Pedidos from "./screens/Pedidos.jsx";
import Calendario from "./screens/Calendario.jsx";
import Picking from "./screens/Picking.jsx";
import Inventario from "./screens/Inventario.jsx";
import Lotes from "./screens/Lotes.jsx";
import Kardex from "./screens/Kardex.jsx";
import Sectores from "./screens/Sectores.jsx";
import Ajustes from "./screens/Ajustes.jsx";
import Recepcion from "./screens/Recepcion.jsx";
import Reposicion from "./screens/Reposicion.jsx";
import Conteo from "./screens/Conteo.jsx";
import Ventas from "./screens/Ventas.jsx";
import VentaManual from "./screens/VentaManual.jsx";
import VentaSala from "./screens/VentaSala.jsx";
import MisMetricas from "./screens/MisMetricas.jsx";
import Historial from "./screens/Historial.jsx";
import Impresion from "./screens/Impresion.jsx";
import Retiro from "./screens/Retiro.jsx";
import Caja from "./screens/Caja.jsx";
import Productos from "./screens/Productos.jsx";
import Precios from "./screens/Precios.jsx";
import ConsultaPrecios from "./screens/ConsultaPrecios.jsx";
import PriceScanOverlay from "./components/PriceScanOverlay.jsx";
import Contenido from "./screens/Contenido.jsx";
import Refunds from "./screens/Refunds.jsx";
import Documentos from "./screens/Documentos.jsx";
import Modulos from "./screens/Modulos.jsx";
import Turnos from "./screens/Turnos.jsx";
import Usuarios from "./screens/Usuarios.jsx";
import Autorizaciones from "./screens/Autorizaciones.jsx";
import Actividad from "./screens/Actividad.jsx";
import Desempeno from "./screens/Desempeno.jsx";
import Incentivos from "./screens/Incentivos.jsx";
import Pickers from "./screens/Pickers.jsx";
import Pantallas from "./screens/Pantallas.jsx";
import Onboarding, { tourSeen } from "./screens/Onboarding.jsx";

const TITLES = {
  gerencia: { title: "Centro de mando", sub: "Radiografía del negocio · ventas, equipo, productos y operación · datos reales" },
  dashboard360: { title: "Dashboard Gerencial 360°", sub: "Resumen ejecutivo de la operación · maqueta demo" },
  actividad: { title: "Actividad en vivo", sub: "Quién está conectado, qué prepara cada uno y quién está en tiempo muerto · en tiempo real" },
  desempeno: { title: "Desempeño por áreas", sub: "Metas del día, cumplimiento y ranking de cada área con sus miembros · en vivo" },
  incentivos: { title: "Incentivos", sub: "Plan de puntos de los vendedores · ranking del periodo y detalle por persona" },
  pantallas: { title: "Centro de pantallas", sub: "Todas las pantallas del local (pública, turno, monitores de zona) con acceso directo y QR" },
  dashboard: { title: "Resumen de bodega", sub: "Estado operativo del día · Bodega 12 Lo Espejo" },
  reportes: { title: "Reportes", sub: "Diario · semanal · mensual · trimestral · con exportación a CSV/Excel/PDF" },
  cobranza: { title: "Cobranza", sub: "Cuentas por cobrar · aging, a quién llamar y cheques por vencer" },
  clientes: { title: "Clientes con crédito", sub: "Línea, facturas y cobranza por cliente" },
  autorizaciones: { title: "Autorizaciones", sub: "anulaciones y excepciones de precio — aprueba o rechaza en vivo" },
  cierrez: { title: "Cierre Z de caja", sub: "Total del día por método de pago + arqueo de efectivo" },
  fefo: { title: "FEFO · por vencer", sub: "Despacha primero lo que vence antes" },
  ventas: { title: "Ventas · Negocio", sub: "KPIs de ventas, inventario en cajas y top productos" },
  pedidos: { title: "Pedidos", sub: "Seguimiento completo · retiro en bodega con fecha comprometida" },
  calendario: { title: "Calendario de retiros", sub: "Agenda de despachos · vista mensual, semanal, diaria y lista" },
  "venta-sala": { title: "Tomar pedido en sala", sub: "Atiende el turno · arma el pedido con stock en vivo · se imprime en el computador central" },
  "mis-metricas": { title: "Mis métricas", sub: "Cuánto vendiste, personas atendidas y tu progreso del mes" },
  historial: { title: "Mi historial", sub: "Todas tus ventas registradas a tu nombre" },
  impresion: { title: "Impresión central", sub: "Computador del local: imprime cada boleta del relay automáticamente" },
  turnos: { title: "Turnos / Fila", sub: "QR para sacar número + fila de atención en vivo (llamar, atender, cerrar)" },
  caja: { title: "Caja", sub: "Escanea la boleta · cobra (efectivo con vuelto / tarjeta / transferencia) · cuadre de caja" },
  "venta-manual": { title: "Venta manual", sub: "Registrar venta presencial → pasa a preparación (Picking) y luego retiro" },
  picking: { title: "Picking de pedidos", sub: "Toma los pedidos pendientes, prepáralos y verifícalos por escaneo" },
  retiro: { title: "Retiro / Mostrador", sub: "Entrega los pedidos listos y márcalos como retirados · cierra el relay" },
  inventario: { title: "Inventario", sub: "Panorama gráfico del stock en bodega" },
  lotes: { title: "Lotes", sub: "Trazabilidad por lote · costo de compra histórico · valor del inventario a costo y vencimientos" },
  kardex: { title: "Movimientos", sub: "Movimientos de stock auditados" },
  sectores: { title: "Sectores / Zonas", sub: "Recorrido del picking · cada zona tiene su monitor (/zona?s=Nombre)" },
  pickers: { title: "Pickers y niveles", sub: "Define la experiencia de cada bodeguero (nuevo/experto) y su PIN del tótem · la regla se aplica sola" },
  ajustes: { title: "Ajuste de stock", sub: "Ingresos y mermas con motivo obligatorio" },
  recepcion: { title: "Recepción de mercadería", sub: "Ingreso masivo de un cargamento por escaneo" },
  reposicion: { title: "Reposición", sub: "Productos bajo su mínimo · arma la lista de compra y envíala a Recepción" },
  conteo: { title: "Conteo físico", sub: "Cuenta el stock real por sector/categoría · al cerrar, el stock queda igual a lo contado" },
  productos: { title: "Productos", sub: "Catálogo: alta y edición de productos por caja" },
  precios: { title: "Precios y márgenes", sub: "Define el margen objetivo, fija precios desde el costo y mira la rentabilidad por producto y categoría" },
  "consulta-precios": { title: "Consulta de precios", sub: "Dispara la pistola sobre un producto y ve su precio y stock al instante" },
  contenido: { title: "Contenido de la tienda", sub: "Home de la tienda web: hero, banners, tarjetas y textos (CMS)" },
  devoluciones: { title: "Devoluciones", sub: "Aprobar o rechazar reembolsos · logística inversa" },
  documentos: { title: "Documentos tributarios", sub: "Boletas / facturas emitidas (SII)" },
  modulos: { title: "Módulos de atención", sub: "Mostradores/cajas donde se atiende la fila" },
  usuarios: { title: "Usuarios", sub: "Gestión de cuentas y roles del equipo" },
};

// Vistas que capturan el disparo de la pistola por su cuenta (campo enfocado o
// pantalla dedicada): en ellas se apaga el escáner global de precios.
const SCAN_OWN_VIEWS = new Set([
  "consulta-precios", "venta-sala", "venta-manual", "caja", "productos",
  "recepcion", "conteo", "ajustes", "picking",
]);

// Fallback de vista permitida: el orden del propio menú (las 25 vistas) para que
// el redirect caiga en la primera vista válida del rol, no en una lista parcial.
const VIEW_ORDER = NAV.map((n) => n.key);

export default function App() {
  const { user, can, logout, roleLabel, initials, effectiveRole, viewAs, setViewAs, canSwitchView, previewLabel } = useAuth();
  const [view, setView] = useState("dashboard");
  const [tourOpen, setTourOpen] = useState(false);
  // Aterrizaje por rol una sola vez por sesión: cada rol cae en su cola.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!user) { landedRef.current = false; return; }
    if (!landedRef.current) {
      landedRef.current = true;
      setView(HOME_BY_ROLE[user.role] || "dashboard");
    }
  }, [user]);
  // "Ver como": al previsualizar un rol, aterriza en la home de ese rol.
  useEffect(() => {
    if (viewAs) setView(HOME_BY_ROLE[viewAs] || "dashboard");
  }, [viewAs]);
  // Notificación de trabajo pendiente: pedidos por preparar = paid (recién
  // vendidos, por TOMAR) + preparing (en proceso). Auto-refresca cada 20s para
  // avisar (casi) en tiempo real cuando entra una venta nueva.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    // Tiempo real: el SSE del relay bumpea el tick al instante (cola, badges) ante
    // cualquier cambio; el intervalo de 20s queda de respaldo.
    let es = null;
    try {
      const u = streamUrl();
      if (u) { es = new EventSource(u); es.addEventListener("change", () => setTick((n) => n + 1)); }
    } catch { /* sin SSE → sigue el polling */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);
  const prep = useLoad(
    () => api.pendingToPrepare(),
    { orders: ORDERS_TO_PREPARE.filter((o) => o.status === "paid" || o.status === "preparing") },
    [view, tick],
  );
  const porPreparar = (prep.data?.orders || []).length;
  // El badge "late" unos segundos cuando el pendiente sube (llegó trabajo nuevo).
  const prevPrepRef = useRef(0);
  const [prepBump, setPrepBump] = useState(false);
  useEffect(() => {
    if (porPreparar > prevPrepRef.current && prevPrepRef.current >= 0) {
      setPrepBump(true);
      const id = setTimeout(() => setPrepBump(false), 4000);
      prevPrepRef.current = porPreparar;
      return () => clearTimeout(id);
    }
    prevPrepRef.current = porPreparar;
  }, [porPreparar]);

  // Autorizaciones pendientes (anulación/precio): badge para el jefe en el menú.
  // Solo se consulta si tiene users.manage; reusa el mismo tick del SSE/poll.
  const auths = useLoad(
    () => (can("users.manage") ? api.autorizaciones("pendiente") : Promise.resolve({ items: [], pendientes: 0 })),
    { items: [], pendientes: 0 },
    [view, tick],
  );
  const pendAuth = Number(auths.data?.pendientes) || 0;

  // Cola de atención: clientes que sacaron turno y esperan ser atendidos.
  // Surge como badge en "Venta manual" para avisar al vendedor.
  const fila = useLoad(() => api.turnoBoard(), { waiting: [] }, [view, tick]);
  const enEspera = (fila.data?.waiting || []).length;
  const prevFilaRef = useRef(0);
  const [filaBump, setFilaBump] = useState(false);
  useEffect(() => {
    if (enEspera > prevFilaRef.current) {
      setFilaBump(true);
      const id = setTimeout(() => setFilaBump(false), 4000);
      prevFilaRef.current = enEspera;
      return () => clearTimeout(id);
    }
    prevFilaRef.current = enEspera;
  }, [enEspera]);

  // Módulos comerciales contratados (GET /config/modules, público). Best-effort:
  // si falla o estamos en demo, quedan los 4 habilitados.
  const ALL_MODS = ["web", "bodega", "sala", "gerencia"];
  const [mods, setMods] = useState(ALL_MODS);
  useEffect(() => {
    if (!user || usingMock) return undefined;
    let alive = true;
    fetch((import.meta.env.VITE_API_URL || "") + "/config/modules")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data ?? j;
        if (alive && Array.isArray(d?.enabled) && d.enabled.length) setMods(d.enabled);
      })
      .catch(() => { /* sin respuesta → default: todos */ });
    return () => { alive = false; };
  }, [user]);
  // DEMO COMERCIAL: "ver plan Tienda Web" — muestra SOLO el módulo web tal
  // como lo vería un cliente que compra únicamente la página. Es un override
  // local (localStorage), no cambia nada del backend ni de la instalación.
  const [planDemo, setPlanDemoState] = useState(() => {
    try { return localStorage.getItem("b12_plan_demo") || null; } catch { return null; }
  });
  const setPlanDemo = (v) => {
    setPlanDemoState(v);
    try { v ? localStorage.setItem("b12_plan_demo", v) : localStorage.removeItem("b12_plan_demo"); } catch { /* sin storage */ }
  };
  const modsEff = planDemo ? [planDemo] : mods;

  const modOn = (k) => !NAV_MODS[k] || modsEff.includes(NAV_MODS[k]);

  // Si la vista activa no está permitida para el rol o su módulo está apagado,
  // caer al home del rol (o a la primera vista válida).
  useEffect(() => {
    if (user && (!can(NAV_PERMS[view]) || !modOn(view))) {
      const ok = (k) => k && can(NAV_PERMS[k]) && modOn(k);
      const home = HOME_BY_ROLE[user.role];
      setView(ok(home) ? home : VIEW_ORDER.find(ok) || "dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view, can, mods, planDemo]);

  // Primer login del usuario: mostrar el tutorial automáticamente una sola vez.
  useEffect(() => {
    if (user && !tourSeen(user)) setTourOpen(true);
  }, [user]);

  // Sin sesión → pantalla de login.
  if (!user) return <Login />;

  const allowed = can(NAV_PERMS[view]);
  const isVendedor = effectiveRole === "vendedor"; // app-like: menú inferior, sin sidebar

  return (
    <div className={"app" + (isVendedor ? " vendedor" : "")}>
      <Sidebar active={view} onNav={setView} pills={{ pick: porPreparar, fila: enEspera, auth: pendAuth }} bump={[prepBump && "pick", filaBump && "fila"].filter(Boolean)} can={can} role={effectiveRole} mods={modsEff} />
      <main className="main">
        <Topbar
          title={TITLES[view].title}
          sub={TITLES[view].sub}
          user={user}
          roleLabel={roleLabel}
          initials={initials}
          onLogout={logout}
          onTour={() => setTourOpen(true)}
          canSwitchView={canSwitchView}
          viewAs={viewAs}
          onViewAs={setViewAs}
          previewRoles={PREVIEW_ROLES}
          planDemo={planDemo}
          onPlanDemo={canSwitchView ? setPlanDemo : undefined}
        />
        <div className="content">
          {planDemo ? (
            <div className="banner-mock" style={{ background: "#eef2ff", color: "#3730a3", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>Demo comercial — plan <b>Tienda Web</b>: esto es exactamente lo que recibe un cliente que compra solo la página web (menú y pantallas del módulo A).</span>
              <button
                onClick={() => setPlanDemo(null)}
                style={{ border: "1px solid #3730a3", background: "#fff", color: "#3730a3", borderRadius: 8, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
              >
                Volver al panel completo
              </button>
            </div>
          ) : null}
          {viewAs ? (
            <div className="banner-mock" style={{ background: "#fce7f3", color: "#9B007A", display: "flex", alignItems: "center", gap: 10 }}>
              <span>Estás viendo el panel <b>como {previewLabel}</b> (previsualización; tus permisos reales no cambian).</span>
              <button
                onClick={() => setViewAs(null)}
                style={{ border: "1px solid var(--magenta)", background: "#fff", color: "var(--magenta)", borderRadius: 8, padding: "4px 10px", fontWeight: 700, cursor: "pointer" }}
              >
                Volver a mi vista
              </button>
            </div>
          ) : null}
          {usingMock ? (
            <div className="banner-mock">
              🟡 Modo demostración — datos de ejemplo. Configura <b>VITE_API_URL</b> para conectarlo al backend Bodega 12 real.
            </div>
          ) : null}
          {!allowed ? (
            <div className="card" style={{ padding: 24, color: "var(--muted)" }}>
              No tienes permiso para ver esta sección.
            </div>
          ) : (
            <>
              {view === "dashboard" && <Dashboard onNav={setView} />}
              {view === "gerencia" && <Gerencia onNav={setView} />}
              {view === "dashboard360" && <DashboardGerencial360 onNav={setView} />}
              {view === "actividad" && <Actividad />}
              {view === "desempeno" && <Desempeno />}
              {view === "incentivos" && <Incentivos />}
              {view === "pantallas" && <Pantallas />}
              {view === "reportes" && <Reportes />}
              {view === "cobranza" && <Cobranza onNav={setView} />}
              {view === "clientes" && <Clientes />}
              {view === "autorizaciones" && <Autorizaciones />}
              {view === "cierrez" && <CierreZ />}
              {view === "fefo" && <FEFO />}
              {view === "ventas" && <Ventas />}
              {view === "pedidos" && <Pedidos />}
              {view === "calendario" && <Calendario />}
              {view === "venta-sala" && <VentaSala />}
              {view === "mis-metricas" && <MisMetricas />}
              {view === "historial" && <Historial />}
              {view === "impresion" && <Impresion />}
              {view === "caja" && <Caja />}
              {view === "venta-manual" && <VentaManual />}
              {view === "picking" && <Picking />}
              {view === "retiro" && <Retiro />}
              {view === "inventario" && <Inventario onNav={setView} />}
              {view === "lotes" && <Lotes />}
              {view === "kardex" && <Kardex />}
              {view === "sectores" && <Sectores />}
              {view === "pickers" && <Pickers />}
              {view === "ajustes" && <Ajustes />}
              {view === "recepcion" && <Recepcion />}
              {view === "reposicion" && <Reposicion onNav={setView} />}
              {view === "conteo" && <Conteo />}
              {view === "productos" && <Productos />}
              {view === "precios" && <Precios />}
              {view === "consulta-precios" && <ConsultaPrecios />}
              {view === "contenido" && <Contenido />}
              {view === "devoluciones" && <Refunds />}
              {view === "documentos" && <Documentos />}
              {view === "modulos" && <Modulos />}
              {view === "turnos" && <Turnos />}
              {view === "usuarios" && <Usuarios />}
            </>
          )}
        </div>
      </main>
      {isVendedor && <BottomNav active={view} onNav={setView} />}
      {/* Escaneo GLOBAL de precios con la pistola: activo salvo en las vistas que ya
          usan el disparo para su propia acción (para no robarles el código). */}
      <PriceScanOverlay enabled={!SCAN_OWN_VIEWS.has(view)} />
      <Onboarding open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}

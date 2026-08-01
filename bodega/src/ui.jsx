import { useState } from "react";
import { ORDER_STATUS } from "./theme.js";

export function Logo() {
  return (
    <div className="brand">
      <img src="/logo-bodega12.png" alt="Bodega 12" className="brand-logo" />
      <div className="nm">Bodega <i>12</i><small>WMS · Lo Espejo</small></div>
    </div>
  );
}

// Orden por FLUJO de trabajo, en 4 grupos: Inicio·gestión (dashboards) →
// Relay de sala (pipeline de 4 roles, en orden) → Inventario → Reportes·admin.
// El Sidebar dibuja el nombre del grupo y respeta este orden.
// `mod` = módulo comercial contratado (docs/MODULOS-COMERCIALES.md):
//   "web" (A · Tienda Web, base) · "bodega" (B · Bodega Pro) ·
//   "sala" (C · Venta en Sala) · "gerencia" (D · Gerencia).
export const NAV = [
  // Inicio · gestión — consola del gerente/dueño
  { key: "gerencia", ic: "🎯", label: "Centro de mando", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "dashboard360", ic: "🎛️", label: "Dashboard 360°", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "actividad", ic: "🟢", label: "Actividad en vivo", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "desempeno", ic: "🎯", label: "Desempeño por áreas", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "incentivos", ic: "🏅", label: "Incentivos", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "pantallas", ic: "🖥️", label: "Centro de pantallas", perm: "reports.read", mod: "bodega", group: "Inicio · gestión" },
  { key: "dashboard", ic: "📊", label: "Resumen", perm: "orders.read", mod: "bodega", group: "Inicio · gestión" },
  { key: "reportes", ic: "📑", label: "Reportes", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "cobranza", ic: "💸", label: "Cobranza", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "clientes", ic: "🤝", label: "Clientes · Crédito", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "autorizaciones", ic: "🔐", label: "Autorizaciones", pillKey: "auth", perm: "users.manage", mod: "sala", group: "Inicio · gestión" },

  // Módulo VENTA EN SALA — el vendedor: toma pedidos, ve sus métricas e historial;
  // y la impresión central de las boletas de la sala.
  { key: "venta-sala", ic: "🛒", label: "Tomar pedido", pillKey: "fila", perm: "orders.take", mod: "sala", group: "Venta en sala" },
  { key: "mis-metricas", ic: "📈", label: "Mis métricas", perm: "orders.take", mod: "sala", group: "Venta en sala" },
  { key: "historial", ic: "📜", label: "Mi historial", perm: "orders.take", mod: "sala", group: "Venta en sala" },
  { key: "impresion", ic: "🖨️", label: "Impresión central", perm: "orders.pay", mod: "sala", group: "Venta en sala" },
  { key: "turnos", ic: "🎫", label: "Turnos / Fila", perm: "orders.take", mod: "sala", group: "Venta en sala" },

  // Relay de sala — cajera / bodega (se modularizará después: caja, picking/packing…)
  { key: "caja", ic: "💵", label: "Caja", perm: "orders.pay", mod: "sala", group: "Relay de sala" },
  { key: "picking", ic: "🧺", label: "Picking", pillKey: "pick", perm: "orders.prepare", mod: "bodega", group: "Relay de sala" },
  { key: "retiro", ic: "🤝", label: "Retiro / Mostrador", perm: "orders.deliver", mod: "web", group: "Relay de sala" },
  { key: "pedidos", ic: "📋", label: "Pedidos", perm: "orders.read", mod: "web", group: "Relay de sala" },
  { key: "calendario", ic: "🗓️", label: "Calendario retiros", perm: "orders.read", mod: "web", group: "Relay de sala" },
  { key: "cierrez", ic: "🧮", label: "Cierre Z", perm: "reports.read", mod: "sala", group: "Relay de sala" },
  { key: "venta-manual", ic: "🧾", label: "Venta manual", pillKey: "fila", perm: "orders.prepare", mod: "sala", group: "Relay de sala" },

  // Inventario · Catálogo
  { key: "productos", ic: "📦", label: "Productos", perm: "products.manage", mod: "web", group: "Inventario · Catálogo" },
  { key: "precios", ic: "🏷️", label: "Precios y márgenes", perm: "products.manage", mod: "web", group: "Inventario · Catálogo" },
  { key: "consulta-precios", ic: "🔍", label: "Consulta de precios", perm: "inventory.read", mod: "bodega", group: "Inventario · Catálogo" },
  { key: "contenido", ic: "🖼️", label: "Contenido de la tienda", perm: "products.manage", mod: "web", group: "Inventario · Catálogo" },

  // Inventario · Movimiento
  { key: "recepcion", ic: "📥", label: "Recepción", perm: "inventory.adjust", mod: "web", group: "Inventario · Movimiento" },
  { key: "reposicion", ic: "🛟", label: "Reposición", perm: "inventory.read", mod: "bodega", group: "Inventario · Movimiento" },
  { key: "conteo", ic: "🔢", label: "Conteo físico", perm: "inventory.adjust", mod: "bodega", group: "Inventario · Movimiento" },
  { key: "ajustes", ic: "⚖️", label: "Ajuste de stock", perm: "inventory.adjust", mod: "web", group: "Inventario · Movimiento" },

  // Inventario · Control
  { key: "inventario", ic: "🗃️", label: "Inventario", perm: "inventory.read", mod: "web", group: "Inventario · Control" },
  { key: "fefo", ic: "⏰", label: "FEFO · por vencer", perm: "inventory.read", mod: "bodega", group: "Inventario · Control" },
  { key: "lotes", ic: "🧫", label: "Lotes y costos", perm: "inventory.read", mod: "bodega", group: "Inventario · Control" },
  { key: "kardex", ic: "📒", label: "Movimientos", perm: "inventory.read", mod: "bodega", group: "Inventario · Control" },
  { key: "sectores", ic: "🗺️", label: "Sectores / Zonas", perm: "products.manage", mod: "bodega", group: "Inventario · Control" },
  { key: "pickers", ic: "🎖️", label: "Pickers y niveles", perm: "users.manage", mod: "bodega", group: "Inventario · Control" },

  // Reportes · admin
  { key: "ventas", ic: "💰", label: "Ventas", perm: "reports.read", mod: "gerencia", group: "Reportes · admin" },
  { key: "documentos", ic: "📄", label: "Documentos SII", perm: "reports.read", mod: "gerencia", group: "Reportes · admin" },
  { key: "devoluciones", ic: "↩️", label: "Devoluciones", perm: "orders.cancel", mod: "gerencia", group: "Reportes · admin" },
  { key: "modulos", ic: "🪟", label: "Módulos", perm: "users.manage", mod: "gerencia", group: "Reportes · admin" },
  { key: "usuarios", ic: "👥", label: "Usuarios", perm: "users.manage", mod: "web", group: "Reportes · admin" },
];

// Permiso requerido por cada vista (para filtrar nav y proteger la vista activa).
export const NAV_PERMS = Object.fromEntries(NAV.map((n) => [n.key, n.perm]));
// Módulo comercial de cada vista (para ocultar menús no contratados y proteger
// la vista activa cuando el módulo está apagado).
export const NAV_MODS = Object.fromEntries(NAV.map((n) => [n.key, n.mod]));

// === Modo "solo pedidos por internet" (beta) ===
// Se ocultan del MENÚ los módulos que no aplican sin venta presencial: venta
// manual, módulos de atención (fila), documentos SII (deshabilitado) y los
// reportes/movimientos/devoluciones (secundarios). Las pantallas siguen
// existiendo en el código; para restaurar el menú completo, vaciar este set.
export const HIDDEN_NAV = new Set([
  "venta-manual", // el relay (Tomar pedido) lo reemplaza
  "documentos",   // SII no operativo aún
  "turnos",       // ocultas a pedido del CEO (2026-07-03): menos ruido en el
  "cierrez",      // menú mientras se presenta el producto. Para restaurar,
  "conteo",       // basta sacar la key de este set.
]);

// Alcance por rol del relay: cada rol operativo ve SOLO sus pantallas (el spec
// pide "cada rol ve únicamente su interfaz"). Los roles ausentes aquí
// (admin/manager) ven todo el menú permitido. Se afina por fase.
export const ROLE_SCOPE = {
  vendedor: new Set(["venta-sala", "mis-metricas", "historial"]),
  cashier: new Set(["caja", "retiro", "impresion"]),
  operator: new Set(["picking", "recepcion", "reposicion", "conteo", "fefo", "inventario", "lotes", "ajustes", "kardex", "consulta-precios"]),
  pantalla: new Set(["dashboard"]),
  // Gerente/dueño: consola EJECUTIVA exclusiva. Ve el negocio y supervisa, sin las
  // herramientas de estación (tomar pedido, caja, picking…). El admin
  // (superusuario) no tiene scope → ve todo el panel.
  manager: new Set([
    "gerencia", "dashboard360", "incentivos", "reportes", "ventas", "cobranza", "clientes", "autorizaciones", "cierrez",
    "pedidos", "retiro", "impresion", "turnos", "devoluciones",
    "productos", "precios", "consulta-precios", "contenido", "inventario", "lotes", "kardex", "fefo",
    "reposicion", "conteo", "ajustes", "recepcion", "sectores", "usuarios",
  ]),
};

// Barra de navegación INFERIOR estilo app (para el vendedor en el celular).
// Reemplaza el menú lateral con botones grandes, como un e-commerce móvil.
const VENDEDOR_TABS = [
  { key: "venta-sala", ic: "🛒", label: "Vender" },
  { key: "mis-metricas", ic: "📈", label: "Métricas" },
  { key: "historial", ic: "📜", label: "Historial" },
];
export function BottomNav({ active, onNav }) {
  return (
    <nav className="bottomnav" aria-label="Navegación del vendedor">
      {VENDEDOR_TABS.map((t) => (
        <button key={t.key} className={"bn-item" + (active === t.key ? " on" : "")} onClick={() => onNav(t.key)}>
          <span className="bn-ic">{t.ic}</span>
          <span className="bn-lb">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Sidebar({ active, onNav, pills = {}, bump = null, can = () => true, role = null, mods = null }) {
  const scope = ROLE_SCOPE[String(role || "").toLowerCase()];
  // `mods` = módulos comerciales contratados (GET /config/modules). null → todos.
  const modOn = (n) => !mods || !n.mod || mods.includes(n.mod);
  const items = NAV.filter(
    (n) => !HIDDEN_NAV.has(n.key) && can(n.perm) && (!scope || scope.has(n.key)) && modOn(n),
  );

  // Agrupar por área preservando el orden de NAV.
  const groups = [];
  for (const n of items) {
    let g = groups.find((x) => x.name === n.group);
    if (!g) { g = { name: n.group, items: [] }; groups.push(g); }
    g.items.push(n);
  }

  // Estado plegado por grupo (persistido). Default: todo expandido.
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("b12_nav_collapsed") || "{}"); } catch { return {}; }
  });
  const toggle = (name) => setCollapsed((c) => {
    const next = { ...c, [name]: !c[name] };
    try { localStorage.setItem("b12_nav_collapsed", JSON.stringify(next)); } catch { /* sin storage */ }
    return next;
  });

  return (
    <aside className="sidebar">
      <Logo />
      <nav className="nav">
        {groups.map((g) => {
          const isCol = !!collapsed[g.name];
          // Suma de pendientes del grupo (visible aunque esté plegado).
          const groupPill = g.items.reduce(
            (a, n) => a + (n.pillKey && pills[n.pillKey] ? Number(pills[n.pillKey]) || 0 : 0),
            0,
          );
          const isBump = (key) => key && (Array.isArray(bump) ? bump.includes(key) : key === bump);
          const groupBump = g.items.some((n) => isBump(n.pillKey));
          return (
            <div key={g.name} className={"nav-grp" + (isCol ? " collapsed" : "")}>
              <button className="grp-h" onClick={() => toggle(g.name)} aria-expanded={!isCol} title={isCol ? "Mostrar" : "Ocultar"}>
                <span className="grp-name">{g.name}</span>
                {groupPill > 0 ? <span className={"grp-pill" + (groupBump ? " pill-bump" : "")}>{groupPill}</span> : null}
                <span className="grp-chev">{isCol ? "▸" : "▾"}</span>
              </button>
              <div className="grp-items">
                {g.items.map((n) => (
                  <button
                    key={n.key}
                    className={active === n.key ? "active" : ""}
                    onClick={() => onNav(n.key)}
                  >
                    <span className="ic">{n.ic}</span>
                    <span className="txt">{n.label}</span>
                    {n.pillKey && pills[n.pillKey] ? <span className={"pill" + (isBump(n.pillKey) ? " pill-bump" : "")}>{pills[n.pillKey]}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="sb-foot">
        <span className="dot" style={{ background: "#22c55e" }} />
        Lo Espejo · Santiago
      </div>
    </aside>
  );
}

export function Topbar({
  title, sub, user, roleLabel, initials = "B12", onLogout, onTour,
  canSwitchView = false, viewAs = null, onViewAs, previewRoles = [],
  planDemo = null, onPlanDemo,
}) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="spacer" />
      <div className="user">
        {canSwitchView ? (
          <select
            value={viewAs || ""}
            onChange={(e) => onViewAs && onViewAs(e.target.value || null)}
            title="Ver el panel como otro rol (solo previsualización; tus permisos reales no cambian)"
            style={{
              marginRight: 8, border: "1px solid var(--border)",
              background: viewAs ? "var(--magenta)" : "#fff", color: viewAs ? "#fff" : "var(--magenta)",
              borderRadius: 10, padding: "8px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <option value="">Ver como… (mi vista)</option>
            {previewRoles.map((r) => (
              <option key={r.role} value={r.role}>Ver como: {r.label}</option>
            ))}
          </select>
        ) : null}
        {onPlanDemo ? (
          <button
            onClick={() => onPlanDemo(planDemo ? null : "web")}
            title="Demo comercial: muestra SOLO lo que incluye el plan Tienda Web (módulo A). No cambia nada real."
            className="tb-secondary"
            style={{
              marginRight: 8, border: "1px solid " + (planDemo ? "#3730a3" : "var(--border)"),
              background: planDemo ? "#3730a3" : "#fff", color: planDemo ? "#fff" : "#3730a3",
              borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {planDemo ? "Plan: Tienda Web" : "Demo Tienda Web"}
          </button>
        ) : null}
        <a
          href="/pantalla"
          target="_blank"
          rel="noreferrer"
          className="tb-secondary"
          title="Pantalla pública de retiros (para los clientes)"
          style={{
            marginRight: 4, border: "1px solid var(--border)", background: "#fff",
            borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600,
            color: "var(--magenta)", cursor: "pointer", textDecoration: "none",
          }}
        >
          Pantalla
        </a>
        {onTour ? (
          <button
            onClick={onTour}
            title="Ver el tutorial"
            className="tb-secondary"
            style={{
              marginRight: 4, border: "1px solid var(--border)", background: "#fff",
              borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600,
              color: "var(--magenta)", cursor: "pointer",
            }}
          >
            Tutorial
          </button>
        ) : null}
        <div className="tb-userinfo" style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name || "Usuario"}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{roleLabel || "Bodega"}</div>
        </div>
        <div className="av">{initials}</div>
        {onLogout ? (
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            style={{
              marginLeft: 12, border: "1px solid var(--border)", background: "#fff",
              borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600,
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            Salir
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const m = ORDER_STATUS[status] || { label: status, bg: "#f3f4f6", text: "#374151" };
  return <span className="badge" style={{ background: m.bg, color: m.text }}>{m.label}</span>;
}

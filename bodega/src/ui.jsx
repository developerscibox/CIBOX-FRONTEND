import { useState } from "react";
import { ORDER_STATUS } from "./theme.js";
import { brand } from "./brand.js";

export function Logo() {
  return (
    <div className="brand">
      <img src={brand.logo} alt={brand.name} className="brand-logo" />
      <div className="nm">{brand.name}<small>Operaciones</small></div>
    </div>
  );
}

// Orden por FLUJO de trabajo, en 4 grupos: Inicio·gestión (dashboards) →
// Pedidos (del pago a la entrega) → Inventario → Reportes·admin.
// El Sidebar dibuja el nombre del grupo y respeta este orden.
// `mod` = módulo comercial habilitado por MODULES_ENABLED (backend/src/config/env.js):
//   "web" (tienda y catálogo) · "bodega" (operación e inventario) · "gerencia" (reportes).
export const NAV = [
  // Inicio · gestión — consola del gerente/dueño
  { key: "gerencia", ic: "🎯", label: "Centro de mando", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "dashboard360", ic: "🎛️", label: "Dashboard 360°", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "dashboard", ic: "📊", label: "Resumen", perm: "orders.read", mod: "bodega", group: "Inicio · gestión" },
  { key: "reportes", ic: "📑", label: "Reportes", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "cobranza", ic: "💸", label: "Cobranza", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },
  { key: "clientes", ic: "🤝", label: "Clientes · Crédito", perm: "reports.read", mod: "gerencia", group: "Inicio · gestión" },

  // Pedidos — del pago a la entrega
  { key: "pedidos", ic: "📋", label: "Pedidos", perm: "orders.read", mod: "web", group: "Pedidos" },
  { key: "picking", ic: "🧺", label: "Preparación", pillKey: "pick", perm: "orders.prepare", mod: "bodega", group: "Pedidos" },
  { key: "calendario", ic: "🗓️", label: "Calendario entregas", perm: "orders.read", mod: "web", group: "Pedidos" },

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

  // Reportes · admin
  { key: "ventas", ic: "💰", label: "Ventas", perm: "reports.read", mod: "gerencia", group: "Reportes · admin" },
  { key: "documentos", ic: "📄", label: "Documentos SII", perm: "reports.read", mod: "gerencia", group: "Reportes · admin" },
  { key: "devoluciones", ic: "↩️", label: "Devoluciones", perm: "orders.cancel", mod: "gerencia", group: "Reportes · admin" },
  { key: "usuarios", ic: "👥", label: "Usuarios", perm: "users.manage", mod: "web", group: "Reportes · admin" },
];

// Permiso requerido por cada vista (para filtrar nav y proteger la vista activa).
export const NAV_PERMS = Object.fromEntries(NAV.map((n) => [n.key, n.perm]));
// Módulo comercial de cada vista (para ocultar menús no contratados y proteger
// la vista activa cuando el módulo está apagado).
export const NAV_MODS = Object.fromEntries(NAV.map((n) => [n.key, n.mod]));

// Vistas ocultas del MENÚ sin borrarlas del código. Para restaurar una, basta
// sacar su key de este set.
export const HIDDEN_NAV = new Set([
  "documentos", // SII no operativo aún
  "conteo",
]);

// Alcance por rol: operaciones ve SOLO sus pantallas. Los roles ausentes aquí
// (admin) ven todo el menú permitido.
export const ROLE_SCOPE = {
  operator: new Set([
    "picking", "pedidos", "recepcion", "reposicion", "conteo", "fefo",
    "inventario", "lotes", "ajustes", "kardex", "consulta-precios",
  ]),
  // Gerente/dueño: consola EJECUTIVA. Ve el negocio y supervisa; el admin
  // (superusuario) no tiene scope → ve todo el panel.
  manager: new Set([
    "gerencia", "dashboard360", "reportes", "ventas", "cobranza", "clientes",
    "pedidos", "calendario", "devoluciones",
    "productos", "precios", "consulta-precios", "contenido", "inventario", "lotes", "kardex", "fefo",
    "reposicion", "conteo", "ajustes", "recepcion", "usuarios",
  ]),
};

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
    try { return JSON.parse(localStorage.getItem("cibox_nav_collapsed") || "{}"); } catch { return {}; }
  });
  const toggle = (name) => setCollapsed((c) => {
    const next = { ...c, [name]: !c[name] };
    try { localStorage.setItem("cibox_nav_collapsed", JSON.stringify(next)); } catch { /* sin storage */ }
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
        {[brand.address.comuna, brand.address.ciudad].filter(Boolean).join(" · ")}
      </div>
    </aside>
  );
}

export function Topbar({
  title, sub, user, roleLabel, initials = "CB", onLogout, onTour,
  canSwitchView = false, viewAs = null, onViewAs, previewRoles = [],
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
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{roleLabel || "Operaciones"}</div>
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

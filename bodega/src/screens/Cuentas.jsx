import { useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Kpi } from "../components/Ui.jsx";

/**
 * CUENTAS REGISTRADAS — quién se creó cuenta en la tienda.
 *
 * QUÉ PROBLEMA RESUELVE
 * "Usuarios" es la pantalla de administración: sirve para cambiar roles y
 * activar o desactivar gente, y por eso mezcla al equipo con los clientes en
 * una sola tabla ordenada por nada en particular. Lo que falta es lo otro: ver
 * si la tienda está captando cuentas nuevas y quiénes son. Esta pantalla no
 * administra nada — solo mira.
 *
 * POR QUÉ CLIENTES Y EQUIPO VAN SEPARADOS
 * Hoy 6 de las 7 cuentas son del equipo. Mezcladas, el total dice "7 cuentas" y
 * suena a que hay clientes registrados; separadas queda claro que hay uno. El
 * crecimiento que interesa es el de clientes, y el equipo solo se muestra para
 * que cuadren los números.
 *
 * ADVERTENCIA QUE NO SE PUEDE OMITIR
 * Los pedidos de la tienda se hacen como invitado y NO quedan enlazados a una
 * cuenta (order.user_id viene en null). Contar pedidos por usuario daría 0 para
 * todos, así que esta pantalla no lo intenta: muestra quién se REGISTRÓ, no
 * quién compró. El aviso va en pantalla, no solo en este comentario, porque
 * leerlo como "clientes que compran" cambia por completo la conclusión.
 */

// Etiquetas y colores de rol. Espejo de Usuarios.jsx y del enum ROLES del
// backend (customer, vendor, admin, manager, operator).
const ROLE_LABEL = {
  customer: "Cliente",
  vendor: "Proveedor",
  admin: "Administrador",
  manager: "Gerente",
  operator: "Bodeguero",
};

const ROLE_BADGE = {
  customer: { bg: "#dcfce7", text: "#166534" },
  vendor: { bg: "#e0f2fe", text: "#0369a1" },
  admin: { bg: "#E6F0F5", text: "#003D49" },
  manager: { bg: "#ede9fe", text: "#6d28d9" },
  operator: { bg: "#e0e7ff", text: "#3730a3" },
};

// Cuentas de ejemplo para el modo demostración (sin backend). El backend
// responde { items, pagination }; el cliente de api.js documenta `users`, así
// que más abajo se leen las dos claves.
const MOCK_CUENTAS = {
  items: [
    { _id: "u1", name: "Gabriel Farías", email: "g.fariaslisboa@gmail.com", role: "admin", email_verified: false, is_active: true, created_at: "2026-09-20T12:00:00Z" },
    { _id: "u2", name: "Carla Soto", email: "carla.soto@cibox.cl", role: "manager", email_verified: false, is_active: true, created_at: "2026-09-12T09:30:00Z" },
    { _id: "u3", name: "Diego Muñoz", email: "diego.munoz@cibox.cl", role: "operator", email_verified: false, is_active: true, created_at: "2026-08-30T15:10:00Z" },
    { _id: "u4", name: "Cliente Demo", email: "cliente@correo.cl", role: "customer", email_verified: true, is_active: true, created_at: "2026-09-26T18:45:00Z" },
  ],
  pagination: { page: 1, limit: 100, total: 4, total_pages: 1 },
};

const DIA_MS = 86400000;

/** Fecha de alta legible en es-CL. */
const fechaLarga = (iso) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
};

/** Antigüedad en texto corto: "recién", "hace 3 días", "hace 2 meses". */
const desdeHace = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "recién";
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(ms / DIA_MS);
  if (d < 30) return `hace ${d} día${d === 1 ? "" : "s"}`;
  const m = Math.floor(d / 30);
  if (m < 12) return `hace ${m} mes${m === 1 ? "" : "es"}`;
  const a = Math.floor(d / 365);
  return `hace ${a} año${a === 1 ? "" : "s"}`;
};

/** Días transcurridos desde el alta, o null si la fecha no sirve. */
const diasDesde = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / DIA_MS;
};

function RolBadge({ role }) {
  const c = ROLE_BADGE[role] || { bg: "#EEF1F4", text: "#003D49" };
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {ROLE_LABEL[role] || role || "Sin rol"}
    </span>
  );
}

function FilaCuenta({ u }) {
  const cuando = desdeHace(u.created_at);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 18px",
        borderTop: "1px solid var(--border-soft)",
      }}
    >
      <div style={{ minWidth: 200, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>
          {u.name || <span style={{ color: "var(--muted)", fontWeight: 400 }}>Sin nombre</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", wordBreak: "break-all" }}>
          {u.email || "Sin correo"}
        </div>
      </div>

      <div style={{ minWidth: 150, fontSize: 12.5 }}>
        <div>{fechaLarga(u.created_at)}</div>
        {cuando ? <div style={{ color: "var(--muted)" }}>{cuando}</div> : null}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span
          className="badge"
          style={
            u.email_verified
              ? { background: "#dcfce7", color: "#166534" }
              : { background: "#fef3c7", color: "#92400e" }
          }
          title={
            u.email_verified
              ? "El correo fue confirmado por la persona"
              : "La persona nunca abrió el enlace de confirmación"
          }
        >
          {u.email_verified ? "Correo verificado" : "Sin verificar"}
        </span>
        {u.is_active === false ? (
          <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            Desactivada
          </span>
        ) : null}
        <RolBadge role={u.role} />
      </div>
    </div>
  );
}

function Seccion({ titulo, bajada, cuentas, vacio }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2>{titulo}</h2>
        <span className="badge" style={{ background: "#E6F0F5", color: "#003D49" }}>
          {cuentas.length}
        </span>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{bajada}</span>
      </div>
      {cuentas.length === 0 ? (
        <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--muted)" }}>{vacio}</div>
      ) : (
        <div>
          {cuentas.map((u) => (
            <FilaCuenta key={u._id || u.email} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Cuentas() {
  const { can } = useAuth();
  const puedeVer = can("users.manage");

  const [busqueda, setBusqueda] = useState("");
  const [tick, setTick] = useState(0);

  // Firma de useLoad: (fetcher, valorEnModoDemo, deps). Devuelve { data, loading,
  // error } — no trae `reload`, así que refrescar es subir `tick`.
  // Sin permiso NO se llama al endpoint: se resuelve vacío y se muestra el aviso.
  // limit 100 es el techo que acepta el validador del backend; con 7 cuentas
  // entra todo en una página y el buscador puede filtrar en el cliente, sin
  // mandar el parámetro `search` (y sin una consulta por cada tecla).
  const { data, loading, error } = useLoad(
    () =>
      puedeVer
        ? api.adminUsers({ page: 1, limit: 100 })
        : Promise.resolve({ items: [], pagination: { total: 0 } }),
    MOCK_CUENTAS,
    [tick, puedeVer],
  );

  // El controlador devuelve `items`; el comentario de api.js dice `users`. Se
  // leen las dos para no depender de cuál quede: Usuarios.jsx hace lo mismo.
  const cuentas = useMemo(() => {
    const lista = data?.users || data?.items;
    return Array.isArray(lista) ? lista : [];
  }, [data]);

  // Total real informado por el backend: la lista topa en `limit`, y si algún
  // día pasan de 100 hay que decirlo en vez de mostrar un número corto.
  const totalBackend = data?.pagination?.total ?? cuentas.length;
  const hayMasQueLoQueSeMuestra = totalBackend > cuentas.length;

  // Indicadores sobre TODAS las cuentas traídas, no sobre el filtro: son la foto
  // general y no deberían moverse mientras alguien escribe en el buscador.
  const resumen = useMemo(() => {
    const clientes = cuentas.filter((u) => u.role === "customer");
    const recientes = cuentas.filter((u) => {
      const d = diasDesde(u.created_at);
      return d != null && d <= 7;
    });
    return {
      total: cuentas.length,
      clientes: clientes.length,
      equipo: cuentas.length - clientes.length,
      recientes: recientes.length,
    };
  }, [cuentas]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter((u) => `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q));
  }, [cuentas, busqueda]);

  // El backend ya ordena por created_at descendente; se reordena igual para que
  // el orden no dependa de eso y se mantenga al filtrar.
  const ordenar = (lista) =>
    [...lista].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );

  const clientes = ordenar(filtradas.filter((u) => u.role === "customer"));
  const equipo = ordenar(filtradas.filter((u) => u.role !== "customer"));

  const primeraCarga = loading && cuentas.length === 0;

  if (!puedeVer) {
    return (
      <div className="card" style={{ padding: "16px 20px", fontSize: 13.5, color: "var(--muted)" }}>
        Tu rol no puede ver las cuentas registradas. Este listado incluye datos personales de los
        clientes, así que queda reservado a quien administra usuarios.
      </div>
    );
  }

  return (
    <div>
      <div className="kpis">
        <Kpi label="Cuentas en total" value={primeraCarga ? "…" : resumen.total} sub="Clientes y equipo juntos" />
        <Kpi label="Clientes" value={primeraCarga ? "…" : resumen.clientes} sub="Rol cliente de la tienda" />
        <Kpi label="Del equipo" value={primeraCarga ? "…" : resumen.equipo} sub="Administración, gerencia y bodega" />
        <Kpi label="Nuevas en 7 días" value={primeraCarga ? "…" : resumen.recientes} sub="Altas de la última semana" />
      </div>

      <div className="filters">
        <div className="field grow">
          <label>Buscar cuenta</label>
          <input
            type="text"
            placeholder="Nombre o correo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button
            className="btn btn-ghost"
            style={{ padding: "10px 16px" }}
            disabled={loading}
            onClick={() => setTick((n) => n + 1)}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Aviso honesto: sin esto el CEO puede leer "1 cliente registrado" como
          "1 cliente que compró", y son cosas distintas. */}
      <div
        className="card"
        style={{
          padding: "11px 16px",
          fontSize: 12.5,
          color: "var(--muted)",
          borderLeft: "3px solid var(--warn)",
          lineHeight: 1.5,
        }}
      >
        Los pedidos de la tienda se pueden hacer como invitado y no quedan enlazados a una cuenta.
        Esta pantalla muestra <strong>quién se registró</strong>, no quién compró: una persona puede
        haber comprado varias veces sin aparecer acá, y alguien de esta lista puede no haber comprado
        nunca.
      </div>

      {error ? (
        <div
          className="card"
          style={{ padding: "12px 18px", color: "var(--danger)", fontWeight: 600, fontSize: 13.5 }}
        >
          No se pudo leer las cuentas: {error}
          {cuentas.length > 0 ? " — abajo quedan los últimos datos que sí llegaron." : ""}
        </div>
      ) : null}

      {primeraCarga ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)" }}>Cargando las cuentas…</div>
      ) : cuentas.length === 0 && !error ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)", fontSize: 13.5 }}>
          Todavía no hay ninguna cuenta registrada.
        </div>
      ) : (
        <>
          <Seccion
            titulo="Clientes"
            bajada="Personas que se crearon cuenta en la tienda"
            cuentas={clientes}
            vacio={
              busqueda.trim()
                ? "Ningún cliente coincide con la búsqueda."
                : "Todavía nadie se ha creado una cuenta de cliente. No es un error: la tienda permite comprar como invitado, así que se puede vender sin que nadie se registre."
            }
          />
          <Seccion
            titulo="Equipo"
            bajada="Cuentas internas con acceso al panel"
            cuentas={equipo}
            vacio={
              busqueda.trim()
                ? "Ninguna cuenta del equipo coincide con la búsqueda."
                : "No hay cuentas internas cargadas."
            }
          />
        </>
      )}

      {hayMasQueLoQueSeMuestra ? (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 2px 8px" }}>
          Se muestran {cuentas.length} de {totalBackend} cuentas: el listado trae hasta 100 por
          consulta.
        </div>
      ) : null}

      {usingMock ? (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 2px 8px" }}>
          Modo demostración: las cuentas de arriba son datos de ejemplo, no las reales.
        </div>
      ) : null}
    </div>
  );
}

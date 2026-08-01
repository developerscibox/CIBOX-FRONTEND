import { useEffect, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { t } from "../theme.js";
import { useAuth } from "../auth.jsx";

// Roles asignables (espejo de ROLES del backend).
const ROLES = ["customer", "vendor", "admin", "manager", "vendedor", "cashier", "operator", "pantalla"];

const ROLE_LABEL = {
  customer: "Cliente",
  vendor: "Proveedor",
  admin: "Administrador",
  manager: "Gerente",
  vendedor: "Vendedor de sala",
  cashier: "Cajera",
  operator: "Bodeguero",
  pantalla: "Pantalla (kiosko)",
};

// Color del .badge por rol.
const ROLE_BADGE = {
  customer: { bg: "#eef4e7", text: "#2E6116" },
  vendor:   { bg: "#e0f2fe", text: "#0369a1" },
  admin:    { bg: "#e9f3da", text: "#6B8F4E" },
  manager:  { bg: "#ede9fe", text: "#6d28d9" },
  vendedor: { bg: "#e0e7ff", text: "#3730a3" },
  cashier:  { bg: "#fef3c7", text: "#92400e" },
  operator: { bg: "#dcfce7", text: "#166534" },
  pantalla: { bg: "#f3f4f6", text: "#374151" },
};

// Usuarios de ejemplo para el modo demostración (sin backend).
const MOCK_USERS = {
  users: [
    { _id: "u1", name: "Gabriel Farías",  email: "g.fariaslisboa@gmail.com", role: "admin",    is_active: true },
    { _id: "u2", name: "Carla Soto",      email: "carla.soto@cibox.cl",   role: "manager",  is_active: true },
    { _id: "u3", name: "Diego Muñoz",     email: "diego.munoz@cibox.cl",  role: "operator", is_active: true },
    { _id: "u4", name: "Valentina Rojas", email: "vale.rojas@cibox.cl",   role: "cashier",  is_active: true },
    { _id: "u5", name: "Pedro Vendedor",  email: "pedro@proveedor.cl",       role: "vendor",   is_active: false },
    { _id: "u6", name: "Cliente Demo",    email: "cliente@correo.cl",        role: "customer", is_active: true },
  ],
  pagination: { total: 6 },
};

function RoleBadge({ role }) {
  const c = ROLE_BADGE[role] || { bg: "#eef4e7", text: t.morado };
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {ROLE_LABEL[role] || role}
    </span>
  );
}

export default function Usuarios() {
  const { user: actual, effectiveRole } = useAuth();
  // Solo un admin puede asignar el rol admin (el backend responde 403 al gerente).
  const assignableRoles = effectiveRole === "admin" ? ROLES : ROLES.filter((r) => r !== "admin");
  const [filters, setFilters] = useState({ search: "", role: "", is_active: "" });
  // Buscador con debounce (300ms) y sin búsquedas de solo espacios (400 del backend).
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      const q = searchInput.trim();
      setFilters((f) => (f.search === q ? f : { ...f, search: q }));
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  const [busyId, setBusyId] = useState(null);
  const [actionErr, setActionErr] = useState("");
  const [nonce, setNonce] = useState(0);

  const params = {
    page: 1,
    limit: 100,
    search: filters.search,
    role: filters.role,
    is_active: filters.is_active,
  };
  const res = useLoad(
    () => api.adminUsers(params),
    MOCK_USERS,
    [filters.search, filters.role, filters.is_active, nonce]
  );

  const users = res.data?.users || res.data?.items || [];
  // Total real reportado por el backend (la lista topa en `limit`).
  const total = res.data?.pagination?.total ?? users.length;

  const refresh = () => setNonce((n) => n + 1);

  async function runAction(id, fn) {
    setBusyId(id);
    setActionErr("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionErr(e.message || "No se pudo completar la acción.");
    } finally {
      setBusyId(null);
    }
  }

  const changeRole = (u, role) => {
    if (role === u.role) return;
    runAction(u._id, () => api.setUserRole(u._id, role));
  };
  const toggleActive = (u) =>
    runAction(u._id, () => api.setUserActive(u._id, !u.is_active));

  return (
    <div>
      <div className="filters">
        <div className="field grow">
          <label>Buscar</label>
          <input
            type="text"
            placeholder="Nombre o correo…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Rol</label>
          <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
            <option value="">Todos</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={filters.is_active} onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      {actionErr ? (
        <div className="card" style={{ padding: "12px 16px", color: t.danger, marginBottom: 14 }}>
          {actionErr}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-h">
          <h2>Usuarios</h2>
          <span className="badge" style={{ background: "#e9f3da", color: "#6B8F4E" }}>
            {res.loading ? "Cargando…" : `${total} ${total === 1 ? "usuario" : "usuarios"}`}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Cambiar rol</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {res.loading ? (
              <tr><td colSpan="6" style={{ color: "var(--muted)", padding: 22 }}>Cargando usuarios…</td></tr>
            ) : res.error ? (
              <tr><td colSpan="6" style={{ color: "var(--danger)", padding: 22 }}>Error: {res.error}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="6" style={{ color: "var(--muted)", padding: 22 }}>Sin usuarios para los filtros actuales.</td></tr>
            ) : (
              users.map((u) => {
                const busy = busyId === u._id;
                const self = String(u._id) === String(actual?._id || actual?.id);
                return (
                  <tr key={u._id} style={busy ? { opacity: 0.55 } : undefined}>
                    <td style={{ fontWeight: 600 }}>
                      {u.name || u.fullName || <span style={{ color: "var(--muted)", fontWeight: 400 }}>Sin nombre</span>}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{u.email || "Sin correo"}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <span className="badge" style={u.is_active
                        ? { background: "#dcfce7", color: "#166534" }
                        : { background: "#fee2e2", color: "#b91c1c" }}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        disabled={busy || self}
                        title={self ? "No puedes cambiar tu propio rol" : undefined}
                        onChange={(e) => changeRole(u, e.target.value)}
                      >
                        {/* Si el usuario YA es admin, se muestra su rol actual aunque no sea asignable. */}
                        {(u.role === "admin" && !assignableRoles.includes("admin") ? ["admin", ...assignableRoles] : assignableRoles).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className={u.is_active ? "btn btn-ghost" : "btn btn-primary"}
                        style={{ padding: "7px 14px", fontSize: 13 }}
                        disabled={busy || self}
                        title={self ? "No puedes desactivar tu propia cuenta" : undefined}
                        onClick={() => toggleActive(u)}
                      >
                        {busy ? "…" : u.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {usingMock ? (
          <div style={{ padding: "10px 16px", fontSize: 12, color: t.muted }}>
            Modo demostración: cambios de rol y estado no se persisten.
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, getStoredUser } from "./api.js";

// Permisos por rol — espejo (solo para UI) de ROLE_PERMISSIONS del backend.
// La autorización REAL siempre la valida el backend; esto solo decide qué
// se muestra/oculta en el panel.
const ROLE_PERMS = {
  admin: ["*"],
  manager: [
    "orders.read", "orders.take", "orders.pay", "orders.prepare", "orders.deliver", "orders.cancel",
    "inventory.read", "inventory.adjust", "products.manage", "reports.read", "users.manage",
  ],
  vendedor: ["orders.read", "orders.take", "inventory.read"],
  cashier: ["orders.read", "orders.pay", "orders.deliver"],
  operator: ["orders.read", "orders.prepare", "inventory.read", "inventory.adjust"],
  pantalla: ["orders.read"],
};

const ROLE_LABEL = {
  admin: "Administrador",
  manager: "Gerente de bodega",
  vendedor: "Vendedor de sala",
  cashier: "Cajera",
  operator: "Bodeguero / Pickeador",
  pantalla: "Pantalla (kiosko)",
};

// Roles con acceso al panel de bodega.
export const WMS_ROLES = ["admin", "manager", "vendedor", "cashier", "operator", "pantalla"];

// Home por rol: cada uno aterriza en SU cola al entrar (principio "home = tu cola").
export const HOME_BY_ROLE = {
  vendedor: "venta-sala", // vendedor: cola de turnos + toma de pedido (relay)
  cashier: "caja",          // cajera: escanear boleta + cobrar + sesión de caja
  operator: "picking",      // bodeguero: directo a preparar
  pantalla: "dashboard",
  manager: "gerencia",
  admin: "gerencia",
};

// Roles que admin/gerente puede previsualizar con "ver como".
export const PREVIEW_ROLES = ["vendedor", "cashier", "operator", "pantalla", "manager"].map(
  (r) => ({ role: r, label: ROLE_LABEL[r] }),
);

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "B12";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  // "Ver como": admin/gerente previsualizan el panel con los permisos de otro rol.
  // Solo afecta la UI; el backend sigue validando con el token (rol real).
  const [viewAs, setViewAsState] = useState(null);
  // Marca que la sesión se cerró por token vencido (para avisar en el login).
  const [sessionExpired, setSessionExpired] = useState(false);

  const realRole = user ? String(user.role || "").trim().toLowerCase() : null;
  const canSwitchView = realRole === "admin" || realRole === "manager";
  const effectiveRole = canSwitchView && viewAs ? viewAs : realRole;

  const login = useCallback(async (email, password) => {
    const u = await authApi.login(email, password);
    const role = String(u.role || "").trim().toLowerCase();
    if (!WMS_ROLES.includes(role)) {
      authApi.logout();
      throw new Error("Esta cuenta no tiene acceso al panel de bodega.");
    }
    setViewAsState(null);
    setSessionExpired(false);
    const normalized = { ...u, role };
    setUser(normalized);
    return normalized;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setViewAsState(null);
    setUser(null);
  }, []);

  const setViewAs = useCallback(
    (role) => {
      if (!canSwitchView) return;
      const r = role ? String(role).toLowerCase() : null;
      setViewAsState(r && r !== realRole ? r : null);
    },
    [canSwitchView, realRole],
  );

  // Si una llamada autenticada devuelve 401 y el refresh falla, cerrar sesión y
  // avisar (el login muestra "tu sesión expiró"). Antes se caía a login sin explicar.
  useEffect(() => {
    const onUnauth = () => { setViewAsState(null); setUser(null); setSessionExpired(true); };
    window.addEventListener("b12-unauth", onUnauth);
    return () => window.removeEventListener("b12-unauth", onUnauth);
  }, []);

  const can = useCallback(
    (perm) => {
      if (!user) return false;
      const perms = ROLE_PERMS[effectiveRole] || [];
      return perms.includes("*") || perms.includes(perm);
    },
    [user, effectiveRole],
  );

  const value = {
    user,
    login,
    logout,
    can,
    viewAs,
    setViewAs,
    canSwitchView,
    effectiveRole,
    sessionExpired,
    roleLabel: realRole ? ROLE_LABEL[realRole] || realRole : "",
    previewLabel: viewAs ? ROLE_LABEL[viewAs] || viewAs : null,
    initials: user ? initials(user.name) : "B12",
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

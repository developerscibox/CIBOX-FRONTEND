import { getToken } from "./api.js";

// Helper local para /turnos/admin/call-next CON FILA (tipo). Vive aparte de api.js
// (archivo con trabajo en curso de otra feature) — mismo patrón que Turno.jsx.
// tipo: "compra" = fila de tienda (T-…) · "retiro" = fila de pedidos internet (P-…).
const BASE = import.meta.env.VITE_API_URL || "";

async function authReq(path, body) {
  const res = await fetch(BASE + path, {
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
  return json?.data ?? json;
}

/** Llama al siguiente de UNA fila. → { turno } (null si la fila está vacía). */
export const llamarSiguienteTurno = ({ module, tipo } = {}) =>
  authReq("/turnos/admin/call-next", { ...(module ? { module } : {}), ...(tipo ? { tipo } : {}) });

/** Pedidos web activos de un RUT, versión AUTENTICADA para la caja (el endpoint
 *  público del kiosko comparte rate-limit de invitados y bloquearía a la cajera). */
export const pedidosPorRutCaja = (rut) =>
  authReq(`/turnos/admin/pedidos-por-rut/${encodeURIComponent(rut)}`);

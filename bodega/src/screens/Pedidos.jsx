import { useEffect, useState, Fragment } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { ORDERS_ADMIN_RES } from "../data.js";
import { ORDER_STATUS, clp, t } from "../theme.js";
import { StatusBadge } from "../ui.jsx";
import { useAuth } from "../auth.jsx";

import { brand } from "../brand.js";
// "Hoy" en zona Santiago (no UTC: toISOString corre el día desde las ~20-21h de Chile).
const HOY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// committed_date (ISO o fecha pura) → YMD en zona Santiago (mismo helper que Calendario).
// Si viene como 'YYYY-MM-DD' se usa tal cual: new Date('YYYY-MM-DD') la interpreta
// como UTC y, al formatear en Santiago, corre el día hacia atrás.
const ymdOf = (iso) => {
  if (!iso) return null;
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};

// Fecha/hora local es-CL a partir de un ISO o YYYY-MM-DD.
function fmtDateTime(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ymd) {
  if (!ymd) return "Sin fecha";
  // YYYY-MM-DD se interpreta como medianoche local para evitar corrimiento de día.
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const PAY_LABEL = {
  webpay: "Webpay",
  transfer: "Transferencia",
  cash: "Efectivo",
  cash_on_pickup: "Efectivo al retirar",
};

// Orden de los grupos según el flujo de trabajo de la bodega (cola de trabajo
// arriba, completados al final). Los pedidos se agrupan por estado.
const STATUS_ORDER = ["pending", "paid", "preparing", "ready", "shipped", "delivered", "cancelled", "refunded"];
// Grupos cerrados por defecto: los completados, para reducir ruido.
const DEFAULT_COLLAPSED = ["delivered", "cancelled", "refunded"];

// Acción siguiente según estado y MÉTODO de pago (contexto retiro en bodega).
// Efectivo: se prepara ANTES de cobrar; el cobro ocurre al entregar.
// Transferencia/Webpay: requiere pago confirmado antes de preparar.
// Acción siguiente gateada por estado, MÉTODO de pago y ROL (espeja
// canRoleSetStatus del backend, así no se muestran botones que darían 403):
// preparar/listo → orders.prepare; entregar/cobrar → orders.deliver;
// aprobar pago (pending→paid) → admin/gerente (proxy: orders.cancel).
function nextAction(order, can) {
  const st = order.status;
  const isCash = order.payment?.method === "cash_on_pickup";
  const isTransfer = order.payment?.method === "transfer";
  const paid = order.payment?.status === "approved";
  const canPrepare = can("orders.prepare");
  const canDeliver = can("orders.deliver");
  const canApprovePay = can("orders.cancel");

  if (st === "pending") {
    if (isCash) return canPrepare ? { to: "preparing", label: "Pasar a preparación" } : null;
    if (!canApprovePay) return null;
    // Transferencia: no se puede aprobar sin comprobante subido.
    if (isTransfer && !order.payment?.transfer_receipt_url) {
      return { to: "paid", label: "Esperando comprobante", disabled: true, hint: "El cliente aún no sube el comprobante de transferencia." };
    }
    return {
      to: "paid",
      label: isTransfer ? "Aprobar comprobante y marcar pagada" : "Marcar pagada",
      note: isTransfer ? "Comprobante de transferencia aprobado" : null,
    };
  }
  if (st === "paid") return canPrepare ? { to: "preparing", label: "Pasar a preparación" } : null;
  if (st === "preparing") return canPrepare ? { to: "ready", label: "Marcar lista" } : null;
  if (st === "ready") {
    if (isCash && !paid) return canDeliver ? { cash: true, label: "Cobrar y entregar" } : null;
    return canDeliver ? { to: "delivered", label: "Marcar retirada", note: "Retirado en bodega" } : null;
  }
  return null;
}

export default function Pedidos() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ status: "", delivery_method: "", committed_date: "", search: "" });
  // Buscador con debounce (300ms): el input responde al tiro, el fetch espera.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }));
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [err, setErr] = useState("");
  // Orden en proceso de cobro en efectivo (abre el modal de cuadre de caja).
  const [cashOrder, setCashOrder] = useState(null);

  const params = {
    status: filters.status,
    delivery_method: filters.delivery_method,
    committed_date: filters.committed_date,
    search: filters.search,
    limit: 100,
  };
  const ord = useLoad(
    () => api.orders(params),
    ORDERS_ADMIN_RES,
    [filters.status, filters.delivery_method, filters.committed_date, filters.search, nonce]
  );

  // El backend puede devolver items o orders.
  const orders = ord.data?.items || ord.data?.orders || [];
  // Total real reportado por el backend (la lista topa en `limit`, así que
  // orders.length no refleja el total cuando hay más resultados).
  const total = ord.data?.pagination?.total ?? orders.length;
  const selected = orders.find((o) => o._id === selId) || null;

  // Grupos plegables por estado (vacíos no se muestran). Defensivo: estados
  // desconocidos caen en "Otros".
  const [collapsed, setCollapsed] = useState(() => new Set(DEFAULT_COLLAPSED));
  const toggleGroup = (k) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const known = new Set(STATUS_ORDER);
  const groups = STATUS_ORDER
    .map((k) => ({ key: k, meta: ORDER_STATUS[k] || { label: k, text: "#374151" }, rows: orders.filter((o) => o.status === k) }))
    .filter((g) => g.rows.length > 0);
  const otros = orders.filter((o) => !known.has(o.status));
  if (otros.length) groups.push({ key: "otros", meta: { label: "Otros", text: "#374151", bg: "#eee" }, rows: otros });

  const refresh = () => setNonce((n) => n + 1);

  // Fila de pedido (compartida por todos los grupos).
  function renderRow(o) {
    const cd = ymdOf(o.pickup?.committed_date);
    const closed = o.status === "delivered" || o.status === "cancelled" || o.status === "refunded";
    const vencido = cd && cd < HOY && !closed;
    const esHoy = cd && cd === HOY;
    return (
      <tr key={o._id} onClick={() => setSelId(o._id === selId ? null : o._id)} className={o._id === selId ? "row-sel" : ""} style={{ cursor: "pointer" }}>
        <td className="mono" style={{ fontWeight: 700 }}>#{String(o._id).slice(-6)}</td>
        <td>
          <div style={{ fontWeight: 600 }}>{o.customer?.fullName || <span style={{ color: "var(--muted)", fontWeight: 400 }}>Sin nombre</span>}</div>
          {o.customer?.email ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{o.customer.email}</div> : null}
        </td>
        <td style={{ fontSize: 13 }}>{fmtDateTime(o.created_at)}</td>
        <td>
          <div>{cd ? fmtDate(cd) : <span style={{ color: "var(--muted)" }}>Sin fecha</span>}</div>
          {vencido ? <span className="badge tag-venc">VENCIDO</span> : esHoy ? <span className="badge tag-hoy">HOY</span> : null}
        </td>
        <td style={{ fontWeight: 700 }}>{clp(o.total)}</td>
        <td style={{ fontSize: 13 }}>{PAY_LABEL[o.payment?.method] || o.payment?.method || <span style={{ color: "var(--muted)" }}>Sin registro</span>}</td>
        <td><StatusBadge status={o.status} /></td>
      </tr>
    );
  }

  async function changeStatus(id, to, note) {
    setBusy(true);
    setErr("");
    try {
      await api.setOrderStatus(id, to, note);
      refresh();
    } catch (e) {
      setErr(`No se pudo cambiar el estado: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Marcar pagada una orden de efectivo: en vez de cambiar estado directo, abre
  // el modal de cuadre (monto recibido → vuelto). Webpay/transferencia siguen
  // el flujo directo de changeStatus.
  function startPay(order) {
    setErr("");
    if (order.payment?.method === "cash_on_pickup") {
      setCashOrder(order);
    } else {
      changeStatus(order._id, "paid");
    }
  }

  async function deleteOrder(id) {
    if (!window.confirm("¿Eliminar este pedido? Se libera el stock que tuviera reservado/comprometido. Esta acción no se puede deshacer.")) return;
    setBusy(true);
    setErr("");
    try {
      await api.deleteOrder(id);
      setSelId(null);
      refresh();
    } catch (e) {
      setErr(`No se pudo eliminar el pedido: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash(amountReceived) {
    if (!cashOrder) return;
    setBusy(true);
    setErr("");
    // 1) Cobro: si falla, NO se registró nada — el modal queda abierto para reintentar.
    try {
      await api.markPaidCash(cashOrder._id, { amount_received: amountReceived });
    } catch (e) {
      setErr(`No se pudo registrar el cobro: ${e.message}. No se entregó el pedido; corrige y vuelve a intentar.`);
      setBusy(false);
      return;
    }
    // 2) Entrega (cobro al retiro, orden ya lista): si falla acá, el cobro SÍ quedó registrado.
    try {
      if (cashOrder.status === "ready") {
        await api.setOrderStatus(cashOrder._id, "delivered", "Retirado en bodega");
      }
      setCashOrder(null);
      refresh();
    } catch (e) {
      setCashOrder(null);
      setErr(`Cobro registrado pero no se pudo cerrar la entrega: ${e.message}. Reintenta "Marcar retirada" sin volver a cobrar.`);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="filters">
        <div className="field">
          <label>Estado</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Entrega</label>
          <select value={filters.delivery_method} onChange={(e) => setFilters({ ...filters, delivery_method: e.target.value })}>
            <option value="">Todos</option>
            <option value="pickup">Retiro en bodega</option>
            <option value="delivery">Despacho</option>
          </select>
        </div>
        <div className="field">
          <label>Retiro comprometido</label>
          <input type="date" value={filters.committed_date} onChange={(e) => setFilters({ ...filters, committed_date: e.target.value })} />
        </div>
        <div className="field grow">
          <label>Buscar cliente</label>
          <input type="text" placeholder="Nombre, correo o teléfono…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      {err ? (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "var(--danger)", padding: "11px 16px", borderRadius: 12, fontWeight: 600, fontSize: 13.5, marginBottom: 16 }}>
          {err}
        </div>
      ) : null}

      <div className={selected ? "ped-grid open" : "ped-grid"}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-h">
            <h2>Pedidos</h2>
            <span className="badge" style={{ background: "#e9f3da", color: "var(--magenta-d)" }}>
              {ord.loading ? "…" : `${total} pedidos`}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>N°</th><th>Cliente</th><th>Creado</th><th>Retiro comprometido</th>
                <th>Total</th><th>Pago</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ord.loading ? (
                <tr><td colSpan="7" style={{ color: "var(--muted)", padding: 22 }}>Cargando pedidos…</td></tr>
              ) : ord.error ? (
                <tr><td colSpan="7" style={{ color: "var(--danger)", padding: 22 }}>Error: {ord.error}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="7" style={{ color: "var(--muted)", padding: 22 }}>Sin pedidos para los filtros actuales.</td></tr>
              ) : (
                groups.map((g) => {
                  const isCollapsed = collapsed.has(g.key);
                  return (
                    <Fragment key={g.key}>
                      <tr className="ped-group" onClick={() => toggleGroup(g.key)} style={{ cursor: "pointer", background: "#faf5f8" }}>
                        <td colSpan="7" style={{ padding: "9px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s", fontSize: 11, color: "var(--muted)", width: 12 }}>▼</span>
                            <span style={{ width: 9, height: 9, borderRadius: 999, background: g.meta.text, display: "inline-block" }} />
                            <b style={{ color: g.meta.text }}>{g.meta.label}</b>
                            <span className="badge" style={{ background: g.meta.bg || "#eee", color: g.meta.text }}>{g.rows.length}</span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && g.rows.map((o) => renderRow(o))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selected ? (
          <OrderDetail order={selected} busy={busy} can={can} onClose={() => setSelId(null)} onChange={changeStatus} onPay={startPay} onDelete={deleteOrder} onAssigned={refresh} />
        ) : null}
      </div>

      {cashOrder ? (
        <CashModal order={cashOrder} busy={busy} error={err} onClose={() => { setCashOrder(null); setErr(""); }} onConfirm={confirmCash} />
      ) : null}
    </div>
  );
}

// Modal de cobro en efectivo: pide el monto recibido, muestra el total a cobrar
// y calcula el vuelto en vivo. Confirma con api.markPaidCash(id, {amount_received}).
function CashModal({ order, busy, error, onClose, onConfirm }) {
  const total = Number(order.total || 0);
  const [received, setReceived] = useState("");
  const recNum = Number(received);
  const valid = received !== "" && Number.isFinite(recNum) && recNum >= total;
  const change = valid ? recNum - total : 0;

  // Atajos de monto sugerido (efectivo justo + redondeos comunes).
  const suggestions = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000])]
    .filter((n) => n >= total)
    .slice(0, 4);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 420, maxWidth: "100%", marginBottom: 0 }}
      >
        <div className="card-h">
          <h2>Cobro en efectivo</h2>
          <div className="spacer" />
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "4px 2px" }}>
          <div style={{ fontSize: 13, color: t.muted }}>Pedido #{String(order._id).slice(-6)} · {order.customer?.fullName || "Sin nombre"}</div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "14px 0" }}>
            <span style={{ fontSize: 14, color: t.muted, fontWeight: 600 }}>Total a cobrar</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{clp(total)}</span>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>Monto recibido</label>
          <input
            type="number"
            min={total}
            inputMode="numeric"
            autoFocus
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder={String(total)}
            style={{ width: "100%", padding: "10px 12px", fontSize: 16, border: `1px solid ${t.border}`, borderRadius: 8, boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setReceived(String(s))}
                style={{ border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 600, fontSize: 12.5, padding: "5px 10px", borderRadius: 999, cursor: "pointer" }}
              >
                {clp(s)}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0 4px", padding: "12px 14px", borderRadius: 10, background: change > 0 ? "#dcfce7" : "#f7eef4" }}>
            <span style={{ fontSize: 14, color: t.muted, fontWeight: 600 }}>Vuelto</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: change > 0 ? "var(--ok)" : t.text }}>{clp(change)}</span>
          </div>

          {received !== "" && !valid ? (
            <div style={{ color: t.danger, fontSize: 13, marginTop: 6 }}>El monto recibido debe ser igual o mayor al total.</div>
          ) : null}

          {error ? (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "var(--danger)", padding: "9px 12px", borderRadius: 9, fontSize: 13, marginTop: 10 }}>{error}</div>
          ) : null}

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 14 }}
            disabled={busy || !valid}
            onClick={() => onConfirm(recNum)}
          >
            {busy ? "Registrando…" : "Confirmar pago y marcar pagada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Asignación manual de picking (súper-admin/gerente): reserva el pedido para una
// persona específica. El FIFO del backend respeta assigned_to (solo el asignado
// puede tomarlo). POST /orders/admin/:id/asignar { user_id|null }.
function AssignPicker({ order, onAssigned }) {
  const [pickers, setPickers] = useState(null);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (usingMock) { setPickers([]); return; }
    api.pickers()
      .then((d) => setPickers(Array.isArray(d) ? d : d?.pickers || d?.items || d?.users || []))
      .catch((e) => { setPickers([]); setErr(e.message); });
  }, []);

  async function guardar(userId) {
    setBusy(true); setErr("");
    try {
      await api.asignarPedido(order._id, userId);
      setSel("");
      onAssigned && onAssigned();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="ped-data" style={{ marginTop: 16, fontSize: 13 }}>
      <div className="ped-sec-t">Asignar picking</div>
      {order.assigned_to?.user_id ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span>Asignado a <b>{order.assigned_to.label || "Sin nombre"}</b></span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} disabled={busy} onClick={() => guardar(null)}>Quitar</button>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.border}` }}>
          <option value="">Asignar a…</option>
          {(pickers || []).map((p) => (
            <option key={p._id} value={p._id}>{p.name || p.email}</option>
          ))}
        </select>
        <button className="btn btn-primary" style={{ padding: "8px 14px" }} disabled={busy || !sel} onClick={() => guardar(sel)}>
          {busy ? "…" : "Asignar"}
        </button>
      </div>
      {pickers && pickers.length === 0 && !err ? <div style={{ color: t.muted, marginTop: 6 }}>No hay bodegueros activos para asignar.</div> : null}
      {err ? <div style={{ color: t.danger, marginTop: 6 }}>{err}</div> : null}
    </div>
  );
}

function OrderDetail({ order, busy, can, onClose, onChange, onPay, onDelete, onAssigned }) {
  const action = nextAction(order, can);
  const history = (order.status_history || []).slice().sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

  // Seguimiento en el software externo (Fase 6). Hoy responde el adapter de log
  // del backend; cuando se enchufe el proveedor real, esta vista no cambia.
  const [ext, setExt] = useState(null);
  const [extBusy, setExtBusy] = useState(false);
  const [extMsg, setExtMsg] = useState("");
  useEffect(() => {
    let alive = true;
    setExt(null); setExtMsg("");
    if (usingMock) return undefined;
    api.seguimientoExterno(order._id)
      .then((r) => { if (alive) setExt(r); })
      .catch(() => { if (alive) setExt(null); });
    return () => { alive = false; };
  }, [order._id]);

  async function accionExterna(fn, okMsg) {
    setExtBusy(true); setExtMsg("");
    try {
      await fn(order._id);
      setExt(await api.seguimientoExterno(order._id));
      setExtMsg(okMsg);
    } catch (e) {
      setExtMsg(e.message || "No se pudo contactar al proveedor.");
    } finally { setExtBusy(false); }
  }

  return (
    <div className="card ped-detail" style={{ marginBottom: 0 }}>
      <div className="card-h">
        <h2>Pedido #{String(order._id).slice(-6)}</h2>
        <StatusBadge status={order.status} />
        <div className="spacer" />
        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
      </div>

      <div className="ped-body">
        <section className="ped-cols">
          <div>
            <div className="ped-sec-t">Cliente</div>
            <div className="ped-data">
              <div style={{ fontWeight: 700 }}>{order.customer?.fullName || <span style={{ color: "var(--muted)", fontWeight: 400 }}>Sin nombre</span>}</div>
              {order.customer?.email ? <div style={{ color: "var(--muted)", fontSize: 13 }}>{order.customer.email}</div> : null}
              {order.customer?.phone ? <div style={{ color: "var(--muted)", fontSize: 13 }}>{order.customer.phone}</div> : null}
            </div>
            <div className="ped-sec-t" style={{ marginTop: 14 }}>Retiro</div>
            <div className="ped-data" style={{ fontSize: 13 }}>
              <div>{order.pickup?.location || brand.address.one_line || "—"}</div>
              <div style={{ color: "var(--muted)" }}>Comprometido: {fmtDate(ymdOf(order.pickup?.committed_date))}</div>
            </div>
          </div>
          <div>
            <div className="ped-sec-t">Productos</div>
            <div className="ped-items">
              {(order.items || []).map((it, i) => (
                <div className="ped-item" key={it.product_id || i} style={{ flexWrap: "wrap" }}>
                  <span className="q">{(it.quantity ?? it.qty ?? 1)}×</span>
                  <span className="n">{it.name}</span>
                  <span className="p">{clp((it.price || 0) * (it.quantity ?? it.qty ?? 1))}</span>
                  {Array.isArray(it.batches) && it.batches.length ? (
                    <div style={{ flexBasis: "100%", marginTop: 3, marginLeft: 26, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {it.batches.map((b, j) => (
                        <span
                          key={b.batch_id || j}
                          title="Lote consumido (trazabilidad)"
                          style={{ fontSize: 11.5, fontWeight: 600, color: "var(--magenta-d)", background: "#e9f3da", borderRadius: 999, padding: "2px 8px" }}
                        >
                          Lote {b.lot_code || "s/código"} · {b.qty} u
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="ped-item tot">
                <span className="n" style={{ fontWeight: 800 }}>Total</span>
                <span className="p" style={{ fontWeight: 800 }}>{clp(order.total)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="ped-sec-t" style={{ marginTop: 18 }}>Historial</div>
        <ul className="timeline">
          {history.length === 0 ? (
            <li style={{ color: "var(--muted)" }}>Sin historial.</li>
          ) : (
            history.map((h, i) => {
              const m = ORDER_STATUS[h.status] || { label: h.status, text: "#374151" };
              const who = h.changed_by?.label || h.changed_by?.role || "Sin registro";
              return (
                <li className="tl-item" key={i}>
                  <span className="tl-dot" style={{ background: m.text }} />
                  <div className="tl-body">
                    <div className="tl-top">
                      <b style={{ color: m.text }}>{m.label}</b>
                      <span className="tl-when">{fmtDateTime(h.changed_at)}</span>
                    </div>
                    <div className="tl-who">{who}</div>
                    {h.note ? <div className="tl-note">{h.note}</div> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* ── Seguimiento externo ─────────────────────────────────────── */}
        {ext ? (
          <>
            <div className="ped-sec-t" style={{ marginTop: 18 }}>
              Seguimiento externo
              <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}> · proveedor: {ext.proveedor}</span>
            </div>
            <div className="ped-data" style={{ fontSize: 13 }}>
              {ext.externo?.ref_externa ? (
                <>
                  <div>
                    Referencia <b className="mono">{ext.externo.ref_externa}</b>
                    {ext.externo.estado ? <> · estado <b>{ext.externo.estado}</b></> : null}
                  </div>
                  {ext.externo.ultimo_evento_at ? (
                    <div style={{ color: "var(--muted)" }}>Último evento: {fmtDateTime(ext.externo.ultimo_evento_at)}</div>
                  ) : null}
                  {(ext.externo.eventos || []).slice(-3).reverse().map((e, i) => (
                    <div key={i} style={{ color: "var(--muted)", fontSize: 12.5 }}>
                      {fmtDateTime(e.at)} · {e.estado}{e.detalle ? ` — ${e.detalle}` : ""}
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: "var(--muted)" }}>
                  Este pedido todavía no se envió al proveedor de seguimiento.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {can("orders.deliver") ? (
                  <button className="btn btn-ghost" disabled={extBusy} onClick={() => accionExterna(api.enviarASeguimiento, "Pedido enviado al proveedor.")}>
                    {ext.externo?.ref_externa ? "Reenviar" : "Enviar al proveedor"}
                  </button>
                ) : null}
                {ext.externo?.ref_externa ? (
                  <button className="btn btn-ghost" disabled={extBusy} onClick={() => accionExterna(api.sincronizarSeguimiento, "Estado sincronizado.")}>
                    Sincronizar estado
                  </button>
                ) : null}
              </div>
              {extMsg ? <div style={{ marginTop: 6, color: "var(--muted)" }}>{extMsg}</div> : null}
            </div>
          </>
        ) : null}

        {order.payment?.method === "transfer" ? (
          <div className="ped-data" style={{ marginTop: 16, fontSize: 13 }}>
            <div className="ped-sec-t">Comprobante de transferencia</div>
            {order.payment?.transfer_receipt_url ? (
              <a href={order.payment.transfer_receipt_url} target="_blank" rel="noreferrer" style={{ color: "var(--magenta-d)", fontWeight: 700 }}>
                Ver comprobante subido ↗
              </a>
            ) : (
              <div style={{ color: "var(--muted)" }}>El cliente aún no sube el comprobante.</div>
            )}
          </div>
        ) : null}

        {can("users.manage") && (order.status === "paid" || order.status === "preparing") ? (
          <AssignPicker order={order} onAssigned={onAssigned} />
        ) : null}

        {order.payment?.amount_received != null ? (
          <div className="ped-data" style={{ marginTop: 16, fontSize: 13 }}>
            <div className="ped-sec-t">Cuadre de caja</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Recibido</span>
              <b>{clp(order.payment.amount_received)}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Vuelto</span>
              <b>{clp(order.payment.change || 0)}</b>
            </div>
          </div>
        ) : null}

        {action ? (
          action.cash ? (
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={busy} onClick={() => onPay(order)}>
              {busy ? "Actualizando…" : action.label}
            </button>
          ) : (
            <>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={busy || action.disabled} onClick={() => onChange(order._id, action.to, action.note)}>
                {busy ? "Actualizando…" : action.label}
              </button>
              {action.hint ? <div className="hint" style={{ marginTop: 6 }}>{action.hint}</div> : null}
            </>
          )
        ) : (
          <div className="hint" style={{ marginTop: 16 }}>Tu rol no tiene una acción disponible para este pedido en su estado actual.</div>
        )}

        {can("orders.cancel") && onDelete ? (
          <button
            className="btn"
            style={{ width: "100%", marginTop: 10, color: t.danger, border: `1px solid ${t.danger}`, background: "#fff" }}
            disabled={busy}
            onClick={() => onDelete(order._id)}
          >
            Eliminar pedido
          </button>
        ) : null}
      </div>
    </div>
  );
}

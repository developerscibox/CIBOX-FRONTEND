import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";
import { llamarSiguienteTurno, pedidosPorRutCaja } from "../turnosApi.js";
import { useAuth } from "../auth.jsx";
import { imprimirComprobantePago } from "../print.js";

// CAJERA (relay etapa 2) — escanea la boleta, cobra (efectivo con vuelto automático,
// tarjeta/transferencia o CRÉDITO a cliente con línea) y maneja la sesión de caja
// con cuadre. Alto contraste, mínimos toques. Al cobrar, el pedido pasa a picking.
// La venta a crédito NO exige plata en caja (no entra al cajón) y genera una
// factura por pagar (FCR-…) que se cobra después en Clientes · Crédito.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

// ── RUT: limpieza, formato en vivo (12.345.678-9) y validación módulo 11 ─────
const cleanRut = (s) => String(s || "").replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
function formatRut(raw) {
  const s = cleanRut(raw);
  if (s.length <= 1) return s;
  return s.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + s.slice(-1);
}
// Forma normalizada del backend: "12345678-9" (sin puntos).
const rutNorm = (raw) => {
  const s = cleanRut(raw);
  return s.length > 1 ? s.slice(0, -1) + "-" + s.slice(-1) : s;
};
function rutValido(raw) {
  const s = cleanRut(raw);
  if (s.length < 7) return false;
  const body = s.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const dv = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return s.slice(-1) === dv;
}

const SEM_COLOR = { verde: "var(--ok)", amarillo: "var(--warn)", rojo: "var(--danger)" };
const METODOS = [
  ["efectivo", "Efectivo"],
  ["tarjeta", "Tarjeta"],
  ["transferencia", "Transferencia"],
  ["credito", "Crédito"],
];
// Meta diaria REFERENCIAL (no viene del backend). Ajustar aquí o dejar en 0 para ocultar la barra.
const META_DIA = 1200000;
const ESTADO = { pending: "POR PAGAR", paid: "Pagada", preparing: "Preparando", ready: "Lista", delivered: "Entregada", cancelled: "Anulada" };

export default function Caja() {
  const { user } = useAuth();
  // Solo admin/manager pueden autorizar una venta a crédito rechazada (override).
  const isSupervisor = ["admin", "manager"].includes(String(user?.role || "").toLowerCase());
  const [sesion, setSesion] = useState(null); // {sesion, monto_esperado, ventas_efectivo, cobros}
  const [miDia, setMiDia] = useState(null);   // {hoy, mes, porMetodo}
  const [code, setCode] = useState("");
  const [order, setOrder] = useState(null);
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errCarga, setErrCarga] = useState(false); // error de red ≠ "caja cerrada"
  // Venta a crédito: RUT del cliente + verificación (buscar-rut) + rechazo 409.
  const [rutCred, setRutCred] = useState("");
  const [cliCred, setCliCred] = useState(null); // { cliente:{_id,razon_social,rut}, estado } verificado
  const [verifBusy, setVerifBusy] = useState(false);
  const [errCred, setErrCred] = useState(null); // mensaje 409 del backend (con motivo y números)
  const inputRef = useRef(null);
  // Autorizaciones anti-robo: anular boleta / excepción de precio requieren OK
  // del jefe (bandeja Autorizaciones, desde el celular). Aquí solo se SOLICITA
  // y se espera la resolución EN VIVO (SSE + poll 10s).
  const [autz, setAutz] = useState(null); // autorización más reciente del pedido abierto
  const [solicitando, setSolicitando] = useState(null); // null | "anulacion"
  const [motivo, setMotivo] = useState("");
  const [autzBusy, setAutzBusy] = useState(false);
  // Excepción de PRECIO por ítem: la cajera edita el precio unitario EN LA LÍNEA
  // del producto; se acumulan propuestas y se envía UNA solicitud al jefe.
  const [propuestas, setPropuestas] = useState({}); // { product_id: "nuevoPrecioUnit" }
  const [editItem, setEditItem] = useState(null); // product_id en edición
  const [motivoP, setMotivoP] = useState("");
  const autzPrevRef = useRef(null);
  const loadedCodeRef = useRef(""); // código con el que se trajo el pedido (para refrescarlo)
  // ── Turnos en caja: DOS FILAS (T-… tienda / P-… pedidos internet) ───────────
  const [turnosActivos, setTurnosActivos] = useState([]); // waiting/calling/attending de hoy
  const [atendiendo, setAtendiendo] = useState(null);     // turno llamado desde ESTA caja
  const [pedidosTurno, setPedidosTurno] = useState(null); // pedidos web del RUT del turno
  const [turnoMsg, setTurnoMsg] = useState("");
  const [turnoBusy, setTurnoBusy] = useState(false);
  const atendiendoIdRef = useRef(null);   // turno vigente (descarta respuestas obsoletas de pedidos-por-rut)
  const turnosCerradosRef = useRef(new Set()); // recién cerrados (un poll en vuelo no debe re-adoptarlos)

  const resetCredito = () => { setRutCred(""); setCliCred(null); setErrCred(null); };

  const loadTurnos = () => {
    if (usingMock) return;
    api.turnosAdmin().then((d) => setTurnosActivos(d.items || [])).catch(() => { /* transitorio */ });
  };
  useEffect(() => {
    if (usingMock) return undefined;
    loadTurnos();
    const id = setInterval(loadTurnos, 7000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filaTienda = turnosActivos.filter((tn) => tn.status === "waiting" && (tn.tipo || "compra") === "compra");
  const filaWeb = turnosActivos.filter((tn) => tn.status === "waiting" && tn.tipo === "retiro");

  // Trae los pedidos web del RUT del turno vigente (guard: si al llegar la respuesta
  // ya se cambió/cerró el turno, se descarta — no pintar datos del cliente anterior).
  const cargarPedidosDe = (tn) => {
    setPedidosTurno(null);
    if (!tn.rut) return;
    const tid = tn._id;
    pedidosPorRutCaja(tn.rut)
      .then((r) => { if (atendiendoIdRef.current === tid) setPedidosTurno(r.pedidos || []); })
      .catch(() => { if (atendiendoIdRef.current === tid) setPedidosTurno([]); });
  };

  // Llama al siguiente de UNA fila. El turno queda "calling" (la Pantalla lo anuncia).
  const llamarFila = async (tipo) => {
    if (turnoBusy || usingMock) return;
    setTurnoBusy(true); setTurnoMsg("");
    try {
      const d = await llamarSiguienteTurno({ module: "Caja", tipo });
      if (!d.turno) {
        setTurnoMsg(tipo === "retiro" ? "No hay clientes de pedidos internet en espera." : "No hay clientes de tienda en espera.");
      } else {
        atendiendoIdRef.current = d.turno._id;
        setAtendiendo(d.turno);
        cargarPedidosDe(d.turno);
      }
      loadTurnos();
    } catch (e) { setTurnoMsg(e.message || "No se pudo llamar al siguiente"); }
    finally { setTurnoBusy(false); }
  };

  // Si la cajera RECARGA la página con un turno llamado, lo re-adopta desde el poll
  // (quedaría "llamando" en la Pantalla para siempre y sin botones para cerrarlo).
  useEffect(() => {
    if (atendiendo || usingMock) return;
    const tn = turnosActivos.find((x) => (x.status === "calling" || x.status === "attending")
      && x.module === "Caja" && !turnosCerradosRef.current.has(x._id));
    if (tn) { atendiendoIdRef.current = tn._id; setAtendiendo(tn); cargarPedidosDe(tn); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnosActivos, atendiendo]);

  // Cierra el turno en atención (best-effort) y limpia el panel.
  const cerrarTurno = async (accion) => {
    const tn = atendiendo;
    if (tn) turnosCerradosRef.current.add(tn._id); // un poll en vuelo no lo re-adopta
    atendiendoIdRef.current = null;
    setAtendiendo(null); setPedidosTurno(null); setTurnoMsg("");
    if (!tn || usingMock) return;
    try { await (accion === "cancel" ? api.cancelTurno(tn._id) : api.doneTurno(tn._id)); } catch { /* noop */ }
    loadTurnos();
  };

  // Trae el pedido del folio (el mismo camino que el escaneo de boleta).
  const traerFolio = async (folio) => {
    setMsg(null); setOrder(null); resetCredito(); setCode(folio);
    try {
      const r = await api.findByScan(folio);
      setOrder(r.order);
      loadedCodeRef.current = folio;
    } catch (e2) { setMsg(e2.message || "No se encontró el pedido"); }
  };

  const refreshSesion = () => {
    if (usingMock) {
      setSesion({ sesion: { monto_inicial: 50000 }, ventas_efectivo: 128400, monto_esperado: 178400, cobros: 7 });
      setMiDia({ hoy: { total: 128400, count: 7 }, mes: { total: 3240000, count: 182 }, porMetodo: { cash_on_pickup: { total: 90400, count: 5 }, card: { total: 38000, count: 2 } } });
      return;
    }
    // Ante error de red NO pisar el estado con "sin sesión": se muestra aviso reintentable.
    api.cajaActual().then((r) => { setSesion(r); setErrCarga(false); }).catch(() => setErrCarga(true));
    api.cajaMiDia().then(setMiDia).catch(() => setErrCarga(true));
  };
  useEffect(() => { refreshSesion(); inputRef.current?.focus(); }, []);

  const abierta = !!sesion?.sesion;

  // Resumen del día por método (porMetodo = { metodo: {total, count} }).
  const pm = miDia?.porMetodo || {};
  const sumaMetodo = (...keys) => keys.reduce((a, k) => ({ total: a.total + (pm[k]?.total || 0), count: a.count + (pm[k]?.count || 0) }), { total: 0, count: 0 });
  const efectivoDia = sumaMetodo("cash_on_pickup", "efectivo");
  const tarjetaDia = sumaMetodo("card", "tarjeta");
  const transferDia = sumaMetodo("transfer", "transferencia");
  const creditoDia = sumaMetodo("credito");
  const debeHaber = abierta ? sesion.monto_esperado : null; // fondo + ventas efectivo = lo que debe tener la caja al cierre

  const buscar = async (e) => {
    e?.preventDefault?.();
    const c = code.trim();
    if (!c) return;
    setMsg(null); setOrder(null); resetCredito();
    try {
      if (usingMock) {
        setOrder({ _id: c, total: 24800, customer: { fullName: "Cliente Demo" }, status: "pending",
          items: [{ name: "Arroz 1kg", quantity: 2, subtotal: 2580, sector: "Abarrotes" }, { name: "Leche 1L", quantity: 1, subtotal: 990, sector: "Lácteos y refrigerados" }] });
      } else {
        const r = await api.findByScan(c);
        setOrder(r.order);
      }
      loadedCodeRef.current = c;
    } catch (e2) { setMsg(e2.message || "No se encontró el pedido"); }
  };

  const total = order?.total || 0;
  const vuelto = useMemo(() => Math.max(0, Math.round(Number(recibido) || 0) - total), [recibido, total]);

  // ── Autorizaciones del pedido abierto (anulación / precio) ──────────────────
  // Re-trae el pedido tal como quedó en el backend (ej. cancelled tras aprobar
  // la anulación) usando el mismo código con el que se escaneó.
  const refrescarPedido = async () => {
    const c = loadedCodeRef.current;
    if (usingMock || !c) return;
    try { const r = await api.findByScan(c); setOrder(r.order); } catch { /* mantener el actual */ }
  };
  const checkAutz = async () => {
    if (!order || usingMock) return;
    try {
      const r = await api.autorizacionDePedido(order._id);
      const a = r?.autorizacion || null;
      const prev = autzPrevRef.current;
      autzPrevRef.current = a;
      setAutz(a);
      // Se resolvió EN VIVO (pendiente → aprobada/rechazada): refrescar el pedido
      // (una anulación aprobada lo deja cancelled).
      if (prev && prev.estado === "pendiente" && a && String(a._id) === String(prev._id) && a.estado !== "pendiente") {
        refrescarPedido();
      }
    } catch { /* transitorio: reintenta el próximo tick */ }
  };
  // Al abrir/cambiar el pedido: estado inicial + SSE (evento change) + poll 10s.
  useEffect(() => {
    autzPrevRef.current = null;
    setAutz(null); setSolicitando(null); setMotivo("");
    if (!order || usingMock) return undefined;
    checkAutz();
    const id = setInterval(checkAutz, 10000);
    let es = null;
    try {
      const u = streamUrl();
      if (u) { es = new EventSource(u); es.addEventListener("change", checkAutz); }
    } catch { /* sin SSE → queda el poll */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id]);

  const solicitarAutz = async () => {
    const det = motivo.trim();
    if (!det) { setMsg("El motivo es obligatorio — queda registrado con tu usuario"); return; }
    if (!order || !solicitando) return;
    setAutzBusy(true); setMsg(null);
    try {
      if (usingMock) {
        const fake = { _id: "demo-autz", tipo: solicitando, folio: String(order._id).slice(-6).toUpperCase(), monto: total, detalle: det, estado: "pendiente", created_at: new Date().toISOString() };
        autzPrevRef.current = fake; setAutz(fake);
      } else {
        const r = await api.solicitarAutorizacion(order._id, solicitando, det);
        autzPrevRef.current = r.autorizacion; setAutz(r.autorizacion);
      }
      setSolicitando(null); setMotivo("");
    } catch (e) {
      if (e.status === 409) {
        // Ya hay una pendiente de este pedido+tipo → mostrar su estado actual.
        try {
          const r = await api.autorizacionDePedido(order._id);
          autzPrevRef.current = r?.autorizacion || null; setAutz(r?.autorizacion || null);
        } catch { /* noop */ }
        setSolicitando(null); setMotivo("");
        setMsg("Ya hay una solicitud pendiente para este pedido — abajo se ve su estado.");
      } else setMsg(e.message || "No se pudo enviar la solicitud");
    } finally { setAutzBusy(false); }
  };

  // Enviar la excepción de PRECIO armada línea por línea (propuestas por ítem).
  const enviarPropuesta = async () => {
    const det = motivoP.trim();
    if (!det) { setMsg("El motivo es obligatorio — queda registrado con tu usuario"); return; }
    const cambios = Object.entries(propuestas)
      .filter(([, v]) => Number(v) > 0)
      .map(([pid, v]) => ({ product_id: pid, precio_propuesto: Math.round(Number(v)) }));
    if (!order || cambios.length === 0) return;
    setAutzBusy(true); setMsg(null);
    try {
      if (usingMock) {
        const fake = { _id: "demo-autz", tipo: "precio", folio: String(order._id).slice(-6).toUpperCase(), monto: total, detalle: det, estado: "pendiente", created_at: new Date().toISOString(), cambios };
        autzPrevRef.current = fake; setAutz(fake);
      } else {
        const r = await api.solicitarAutorizacion(order._id, "precio", det, cambios);
        autzPrevRef.current = r.autorizacion; setAutz(r.autorizacion);
      }
      setPropuestas({}); setEditItem(null); setMotivoP("");
    } catch (e) {
      if (e.status === 409) {
        try {
          const r = await api.autorizacionDePedido(order._id);
          autzPrevRef.current = r?.autorizacion || null; setAutz(r?.autorizacion || null);
        } catch { /* noop */ }
        setMsg("Ya hay una solicitud pendiente para este pedido — abajo se ve su estado.");
      } else setMsg(e.message || "No se pudo enviar la propuesta");
    } finally { setAutzBusy(false); }
  };

  // Al cambiar de pedido, se descartan las propuestas a medio armar.
  useEffect(() => { setPropuestas({}); setEditItem(null); setMotivoP(""); }, [order?._id]);

  // Verificar el RUT contra el maestro de clientes (gate orders.pay): muestra la
  // card con semáforo y disponible vs total antes de cobrar a crédito.
  const verificarCliente = async () => {
    setErrCred(null); setCliCred(null);
    if (!rutValido(rutCred)) { setMsg("RUT inválido: revisa el dígito verificador"); return; }
    setVerifBusy(true); setMsg(null);
    try {
      if (usingMock) {
        setCliCred({ cliente: { _id: "demo", razon_social: "Minimarket La Esquina", rut: rutNorm(rutCred) },
          estado: { saldo: 180000, disponible: 320000, uso_pct: 36, max_mora_dias: 0, semaforo: "verde", puede_comprar: true, motivo_rechazo: null } });
      } else {
        setCliCred(await api.buscarClienteRut(rutNorm(rutCred)));
      }
    } catch (e) {
      setMsg(e.status === 404 ? "No existe un cliente con ese RUT — créalo en Clientes · Crédito" : (e.message || "No se pudo verificar el cliente"));
    } finally { setVerifBusy(false); }
  };

  // override=true SOLO desde el botón de autorización (admin/manager) tras un 409.
  const cobrar = async (override = false) => {
    if (!order) return;
    if (metodo === "efectivo" && !abierta) { setMsg("Abre la caja para cobrar efectivo"); return; }
    if (metodo === "efectivo" && Math.round(Number(recibido) || 0) < total) { setMsg("El efectivo recibido es menor al total"); return; }
    if (metodo === "credito" && !cliCred) { setMsg("Verifica el RUT del cliente antes de cobrar a crédito"); return; }
    setBusy(true); setMsg(null); if (!override) setErrCred(null);
    const snap = order, recibidoN = Math.round(Number(recibido) || 0), vueltoN = vuelto;
    try {
      if (!usingMock) {
        const payload = { metodo };
        if (metodo === "efectivo") payload.amount_received = recibidoN;
        if (metodo === "credito") {
          payload.cliente_rut = cliCred.cliente.rut;
          if (override) payload.override = true; // queda auditado (credito.override)
        }
        await api.cobrar(order._id, payload);
        refreshSesion();
      }
      // Timbrar la boleta: imprime el comprobante PAGADO en el computador de la caja.
      // (Las etiquetas de zona salen recién en Picking, al tomar el pedido.)
      try { imprimirComprobantePago(snap, { metodo, recibido: recibidoN, vuelto: vueltoN, cajera: sesion?.sesion?.cajera_label || "" }); } catch { /* la impresión nunca rompe el cobro */ }
      setMsg(`✅ Cobrado ${clp(total)} (${metodo === "credito" ? `crédito · ${cliCred?.cliente?.razon_social || ""}` : metodo})${metodo === "efectivo" ? ` · vuelto ${clp(vueltoN)}` : ""}. Boleta timbrada → a picking.`);
      if (atendiendo) cerrarTurno("done"); // cobrado → el turno llamado queda finalizado
      setOrder(null); setCode(""); setRecibido(""); setMetodo("efectivo"); resetCredito(); inputRef.current?.focus();
    } catch (e) {
      // 409 en crédito = rechazo con motivo (crédito insuficiente / bloqueado / mora):
      // se muestra destacado y, si el usuario es admin/manager, permite override.
      if (metodo === "credito" && e.status === 409) setErrCred(e.message || "Venta a crédito rechazada");
      else setMsg(e.message || "No se pudo cobrar");
    }
    finally { setBusy(false); }
  };

  const keypad = (d) => setRecibido((r) => (d === "C" ? "" : d === "←" ? r.slice(0, -1) : String(r) + d));

  // Pedido WEB en efectivo ya preparado/listo (payment.status ≠ approved): la cajera
  // cobra al retiro con pay-cash — no toca el status del pedido, solo registra el pago.
  const cobrarWebEfectivo = async () => {
    if (!order) return;
    if (!abierta) { setMsg("Abre la caja para cobrar efectivo"); return; }
    const recibidoN = Math.round(Number(recibido) || 0);
    if (recibidoN < total) { setMsg("El efectivo recibido es menor al total"); return; }
    setBusy(true); setMsg(null);
    const snap = order, vueltoN = vuelto;
    try {
      if (!usingMock) {
        await api.markPaidCash(order._id, { amount_received: recibidoN });
        refreshSesion();
      }
      try { imprimirComprobantePago(snap, { metodo: "efectivo", recibido: recibidoN, vuelto: vueltoN, cajera: sesion?.sesion?.cajera_label || "" }); } catch { /* la impresión nunca rompe el cobro */ }
      setMsg(`✅ Cobrado ${clp(total)} (efectivo) · vuelto ${clp(vueltoN)}. Pago registrado.`);
      if (atendiendo) cerrarTurno("done"); // cobrado → el turno llamado queda finalizado
      setOrder(null); setCode(""); setRecibido(""); inputRef.current?.focus();
    } catch (e) { setMsg(e.message || "No se pudo cobrar"); }
    finally { setBusy(false); }
  };

  // ── Sesión de caja ──────────────────────────────────────────────
  const [inicial, setInicial] = useState("");
  const [contado, setContado] = useState("");
  const [cuadre, setCuadre] = useState(null);
  const abrir = async () => {
    if (usingMock) { setSesion({ sesion: { monto_inicial: Number(inicial) || 0 }, ventas_efectivo: 0, monto_esperado: Number(inicial) || 0 }); return; }
    try { await api.abrirCaja(Math.round(Number(inicial) || 0)); refreshSesion(); } catch (e) { setMsg(e.message); }
  };
  const cerrar = async () => {
    if (String(contado).trim() === "") { setMsg("Ingresa el efectivo contado antes de cerrar la caja"); return; }
    const contadoN = Math.round(Number(contado) || 0);
    if (!window.confirm(`¿Cerrar la caja con ${clp(contadoN)} contados? Se termina la sesión y se registra el cuadre.`)) return;
    try {
      if (usingMock) { const esp = sesion?.monto_esperado || 0; setCuadre({ estado: (contadoN - esp) === 0 ? "cuadra" : (contadoN > esp ? "sobrante" : "faltante"), diferencia: contadoN - esp }); return; }
      const r = await api.cerrarCaja(contadoN);
      setCuadre(r.arqueo); refreshSesion();
    } catch (e) { setMsg(e.message); }
  };

  // Cobro por payment.status REAL (no por status del pedido): un web efectivo en
  // preparing/ready sigue impago y la cajera debe poder cobrarlo al retiro.
  const pagado = order?.payment?.status === "approved";
  const cobrableWeb = !!order && !pagado && ["preparing", "ready"].includes(order.status);

  // Keypad de efectivo + vuelto (compartido: cobro de sala y cobro web al retiro).
  const keypadUI = (
    <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 200px" }}>
        <div style={sm}>Efectivo recibido</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{clp(recibido || 0)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 6, maxWidth: 240 }}>
          {["1","2","3","4","5","6","7","8","9","C","0","←"].map((d) => (
            <button key={d} onClick={() => keypad(d)} style={{ padding: 14, fontSize: 18, fontWeight: 700, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer" }}>{d}</button>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 140 }}>
        <div style={sm}>Vuelto</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: "var(--ok)" }}>{clp(vuelto)}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Resumen de caja del día — vendido, por método, vouchers y cuánto debe tener la caja al cierre */}
      {miDia && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Caja del día</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(128px,1fr))", gap: 14 }}>
            <Box label="Vendido hoy" val={clp(miDia.hoy.total)} sub={`${miDia.hoy.count} cobros`} c="#1c2a36" />
            <Box label="Efectivo" val={clp(efectivoDia.total)} sub={`${efectivoDia.count} pagos`} c="var(--ok)" />
            <Box label="Tarjeta" val={clp(tarjetaDia.total)} sub={`${tarjetaDia.count} pagos`} c="var(--muted)" />
            <Box label="Transferencia" val={clp(transferDia.total)} sub={`${transferDia.count} pagos`} c="var(--warn)" />
            <Box label="Crédito" val={clp(creditoDia.total)} sub={`${creditoDia.count} ventas · no entra al cajón`} c="var(--muted)" />
            <Box label="Vouchers tarjeta" val={String(tarjetaDia.count)} sub="vouchers a tener" c="var(--muted)" />
            <Box label="Debe tener la caja" val={debeHaber != null ? clp(debeHaber) : "—"} sub={debeHaber != null ? "fondo + efectivo (cierre)" : "caja cerrada — ábrela para verlo"} c="var(--magenta-d)" />
          </div>
          {META_DIA > 0 && <Meta label="Meta del día (referencial)" val={miDia.hoy.total} meta={META_DIA} />}
        </div>
      )}

      {/* Error de carga: no es lo mismo que "caja cerrada" — aviso reintentable */}
      {errCarga && (
        <div className="card" style={{ padding: 14, marginBottom: 16, background: "#fee2e2", color: "var(--danger)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <b>⚠️ No se pudo cargar el estado de la caja</b>
          <span style={{ fontSize: 13 }}>(problema de red o de sesión)</span>
          <button onClick={refreshSesion} style={btn("var(--danger)")}>Reintentar</button>
        </div>
      )}

      {/* Barra de sesión (solo cuando el estado real ya cargó) */}
      {sesion && (
      <div className="card" style={{ padding: 14, marginBottom: 16, background: abierta ? "#f3eef6" : "#fff7e6" }}>
        {!abierta ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <b>Caja cerrada.</b>
            <span>Fondo inicial:</span>
            <input value={inicial} onChange={(e) => setInicial(e.target.value)} inputMode="numeric" placeholder="$"
              style={{ width: 120, padding: "8px 10px", fontSize: 16, borderRadius: 8, border: "1px solid var(--border)" }} />
            <button onClick={abrir} style={btn("var(--ok)")}>Abrir caja</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div><div style={sm}>Fondo</div><b>{clp(sesion.sesion.monto_inicial)}</b></div>
            <div><div style={sm}>Ventas efectivo</div><b>{clp(sesion.ventas_efectivo)}</b></div>
            <div><div style={sm}>Debe haber</div><b style={{ color: "var(--ok)" }}>{clp(sesion.monto_esperado)}</b></div>
            <div style={{ flex: 1 }} />
            <input value={contado} onChange={(e) => setContado(e.target.value)} inputMode="numeric" placeholder="Contado $"
              style={{ width: 130, padding: "8px 10px", fontSize: 16, borderRadius: 8, border: "1px solid var(--border)" }} />
            <button onClick={cerrar} style={btn("var(--magenta-d)")}>Cerrar caja (cuadre)</button>
          </div>
        )}
        {cuadre && (
          <div style={{ marginTop: 8, fontWeight: 700, color: cuadre.estado === "cuadra" ? "var(--ok)" : "var(--danger)" }}>
            {cuadre.estado === "cuadra" ? "✅ Cuadra" : cuadre.estado === "sobrante" ? `▲ Sobrante ${clp(cuadre.diferencia)}` : `▼ Faltante ${clp(-cuadre.diferencia)}`}
          </div>
        )}
      </div>
      )}

      {/* ── Turnos en caja: DOS FILAS de números (tienda / pedidos internet) ── */}
      {!usingMock && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Atención por número</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {/* Fila pedidos de internet (P-…): pagar o retirar pedidos web */}
            <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ color: "#1d4ed8" }}>Pedidos internet</b>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{filaWeb.length} en espera</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                {filaWeb.slice(0, 6).map((tn) => (
                  <span key={tn._id} style={{ background: "#fff", border: "1px solid #bfdbfe", borderRadius: 999, padding: "2px 10px", fontSize: 12.5, fontFamily: "ui-monospace,monospace", fontWeight: 700, color: "#1d4ed8" }}>{tn.code}</span>
                ))}
                {filaWeb.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Sin clientes esperando.</span> : null}
              </div>
              <button onClick={() => llamarFila("retiro")} disabled={turnoBusy || !!atendiendo} style={{ ...btn("#1d4ed8"), width: "100%", opacity: turnoBusy || atendiendo ? 0.55 : 1 }}>
                Llamar siguiente (internet)
              </button>
            </div>
            {/* Fila tienda (T-…): compra presencial */}
            <div style={{ border: "1px solid var(--border)", background: "#faf7fb", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b>Tienda</b>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{filaTienda.length} en espera</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                {filaTienda.slice(0, 6).map((tn) => (
                  <span key={tn._id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 10px", fontSize: 12.5, fontFamily: "ui-monospace,monospace", fontWeight: 700, color: "var(--magenta-d)" }}>{tn.code}</span>
                ))}
                {filaTienda.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Sin clientes esperando.</span> : null}
              </div>
              <button onClick={() => llamarFila("compra")} disabled={turnoBusy || !!atendiendo} style={{ ...btn("var(--magenta-d)"), width: "100%", opacity: turnoBusy || atendiendo ? 0.55 : 1 }}>
                Llamar siguiente (tienda)
              </button>
            </div>
          </div>

          {turnoMsg ? <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--muted)", fontWeight: 600 }}>{turnoMsg}</div> : null}

          {/* Turno llamado: nombre + sus pedidos web (si sacó número con RUT) */}
          {atendiendo ? (
            <div style={{ marginTop: 12, border: "2px solid " + (atendiendo.tipo === "retiro" ? "#1d4ed8" : "var(--magenta-d)"), borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 26, fontWeight: 800, color: atendiendo.tipo === "retiro" ? "#1d4ed8" : "var(--magenta-d)" }}>{atendiendo.code}</span>
                <b style={{ fontSize: 16 }}>{atendiendo.name}</b>
                <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: atendiendo.tipo === "retiro" ? "#dbeafe" : "#f3f4f6", color: atendiendo.tipo === "retiro" ? "#1d4ed8" : "#374151" }}>
                  {atendiendo.tipo === "retiro" ? "Pedido internet" : "Compra en tienda"}
                </span>
                <span style={{ flex: 1 }} />
                <button onClick={() => cerrarTurno("cancel")} style={{ background: "#fff", color: "var(--danger)", border: "1px solid #fca5a5", borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>No se presentó</button>
                <button onClick={() => cerrarTurno("done")} style={{ ...btn("var(--muted)"), padding: "7px 12px", fontSize: 13 }}>Terminar atención</button>
              </div>
              {atendiendo.tipo === "retiro" ? (
                pedidosTurno === null ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>{atendiendo.rut ? "Buscando sus pedidos…" : "Sacó el número sin RUT: pídele el folio de su pedido y escríbelo abajo."}</div>
                ) : pedidosTurno.length === 0 ? (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>Sin pedidos web activos con su RUT — pídele el folio y escríbelo abajo.</div>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {pedidosTurno.map((p) => (
                      <div key={p.folio} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border-soft)", borderRadius: 10, padding: "8px 12px", flexWrap: "wrap" }}>
                        <b style={{ fontFamily: "ui-monospace,monospace", fontSize: 16 }}>#{p.folio}</b>
                        <span style={{ fontSize: 13, color: "var(--muted)" }}>{p.estado_label || p.estado}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "2px 10px", background: p.pagado ? "#dcfce7" : "#fef3c7", color: p.pagado ? "#15803d" : "#b45309" }}>{p.pagado ? "Pagado" : "Por pagar"}</span>
                        <span style={{ flex: 1 }} />
                        <b style={{ fontSize: 14 }}>{clp(p.total)}</b>
                        <button onClick={() => traerFolio(p.folio)} style={{ ...btn("var(--ok)"), padding: "7px 14px", fontSize: 13 }}>Traer pedido</button>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Trae el pedido, cóbralo si está por pagar (o confírmalo si ya pagó) — al cobrarlo salta solo a picking y el turno se cierra.</div>
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Escaneo de boleta */}
      <form onSubmit={buscar} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Escanea la boleta o escribe el código…"
          style={{ flex: 1, padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "2px solid var(--magenta-d)" }} />
        <button type="submit" style={btn("var(--magenta-d)")}>Traer pedido</button>
      </form>

      {/* Detalle + cobro */}
      {order && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <b>#{String(order._id).slice(-6).toUpperCase()} · {order.customer?.fullName || "Mostrador"}</b>
            <span style={{ color: order.status === "cancelled" ? "var(--danger)" : order.status === "pending" ? "var(--warn)" : "var(--ok)" }}>{ESTADO[order.status] || order.status}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 10 }}>
            <tbody>
              {(order.items || []).map((it, i) => {
                const pid = String(it.product_id);
                const editable = order.status === "pending" && autz?.estado !== "pendiente";
                const prop = propuestas[pid];
                const propNum = Number(prop) > 0 ? Math.round(Number(prop)) : null;
                const nuevoSub = propNum != null ? propNum * it.quantity : null;
                return (
                  <Fragment key={i}>
                    <tr style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "5px 0", width: 40 }}>{it.quantity}×</td>
                      <td>{it.name} <span style={{ color: "#999", fontSize: 12 }}>· {it.sector || "Sin sector"}</span></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {nuevoSub != null ? (
                          <>
                            <span style={{ textDecoration: "line-through", color: "#999", marginRight: 6, fontSize: 12.5 }}>{clp(it.subtotal)}</span>
                            <b style={{ color: "var(--warn)" }}>{clp(nuevoSub)}</b>
                          </>
                        ) : clp(it.subtotal)}
                        {editable ? (
                          <button
                            onClick={() => setEditItem(editItem === pid ? null : pid)}
                            title="Proponer otro precio (requiere autorización del jefe)"
                            style={{ marginLeft: 8, border: "1px solid var(--border)", background: editItem === pid ? "#fef3c7" : "#fff", borderRadius: 7, padding: "2px 7px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                          >Editar</button>
                        ) : null}
                      </td>
                    </tr>
                    {editable && editItem === pid ? (
                      <tr>
                        <td colSpan={3} style={{ padding: "6px 0 10px", background: "#fffbeb" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "0 8px" }}>
                            <span style={{ fontSize: 12.5, color: "var(--warn)" }}>Unitario actual: <b>{clp(it.price)}</b> → nuevo:</span>
                            <input
                              type="number" min="1" autoFocus value={prop ?? ""}
                              onChange={(e) => setPropuestas((p) => ({ ...p, [pid]: e.target.value }))}
                              placeholder={String(it.price)}
                              style={{ width: 110, padding: "7px 10px", fontSize: 15, borderRadius: 8, border: "1px solid var(--border)" }}
                            />
                            <span style={{ fontSize: 12.5, color: "var(--warn)" }}>c/u{propNum != null ? <> · línea: <b>{clp(nuevoSub)}</b></> : null}</span>
                            {prop != null ? (
                              <button onClick={() => { setPropuestas((p) => { const n = { ...p }; delete n[pid]; return n; }); setEditItem(null); }}
                                style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>quitar</button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 800, borderTop: "2px solid #000", paddingTop: 8 }}>
            <span>TOTAL</span><span>{clp(total)}</span>
          </div>

          {/* Propuesta de precios armada línea a línea → UNA solicitud al jefe */}
          {(() => {
            const cambios = Object.entries(propuestas).filter(([, v]) => Number(v) > 0);
            if (!cambios.length || order.status !== "pending" || autz?.estado === "pendiente") return null;
            const nuevoTotal = (order.items || []).reduce((a, it) => {
              const p = propuestas[String(it.product_id)];
              return a + (Number(p) > 0 ? Math.round(Number(p)) * it.quantity : it.subtotal);
            }, 0);
            return (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid var(--warn)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, color: "var(--warn)" }}>
                  <span>Nuevo total propuesto ({cambios.length} ítem{cambios.length > 1 ? "s" : ""})</span>
                  <span>{clp(nuevoTotal)} <span style={{ fontSize: 12.5, fontWeight: 600 }}>(antes {clp(total)})</span></span>
                </div>
                <textarea
                  value={motivoP} onChange={(e) => setMotivoP(e.target.value)} maxLength={300} rows={2}
                  placeholder="Motivo (obligatorio) — Ej: precio del cartel / acuerdo con el cliente"
                  style={{ width: "100%", marginTop: 8, padding: "10px 12px", fontSize: 14, borderRadius: 8, border: "1px solid var(--border)", resize: "vertical", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={enviarPropuesta} disabled={autzBusy || !motivoP.trim()} style={{ ...btn("var(--warn)"), opacity: autzBusy || !motivoP.trim() ? 0.55 : 1 }}>
                    {autzBusy ? "Enviando…" : "Enviar al jefe para autorizar"}
                  </button>
                  <button onClick={() => { setPropuestas({}); setEditItem(null); setMotivoP(""); }} disabled={autzBusy} style={btn("var(--muted)")}>Descartar</button>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--warn)" }}>
                  Al aprobarse, los precios se aplican al pedido automáticamente. Queda registrado con tu usuario — no se puede borrar.
                </div>
              </div>
            );
          })()}

          {order.status === "pending" ? (
            <>
              <div style={{ display: "flex", gap: 8, margin: "14px 0", flexWrap: "wrap" }}>
                {METODOS.map(([m, lb]) => (
                  <button key={m} onClick={() => { setMetodo(m); setErrCred(null); setMsg(null); }} style={{ flex: "1 1 110px", padding: "10px", borderRadius: 8, border: "1px solid var(--border)", background: metodo === m ? "var(--magenta-d)" : "#fff", color: metodo === m ? "#fff" : "#444", fontWeight: 700, cursor: "pointer" }}>{lb}</button>
                ))}
              </div>
              {metodo === "efectivo" && keypadUI}
              {metodo === "credito" && (
                <div style={{ marginBottom: 12 }}>
                  {/* Crédito: sin keypad de vuelto — no entra plata al cajón */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={rutCred}
                      onChange={(e) => { setRutCred(formatRut(e.target.value)); setCliCred(null); setErrCred(null); }}
                      placeholder="RUT del cliente (12.345.678-9)"
                      style={{ flex: 1, padding: "10px 12px", fontSize: 16, borderRadius: 8, border: "1px solid " + (rutCred && !rutValido(rutCred) ? "var(--danger)" : "var(--border)") }}
                    />
                    <button onClick={verificarCliente} disabled={verifBusy || !rutValido(rutCred)} style={{ ...btn("var(--magenta-d)"), opacity: verifBusy || !rutValido(rutCred) ? 0.55 : 1 }}>
                      {verifBusy ? "…" : "Verificar"}
                    </button>
                  </div>
                  {cliCred && (
                    <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-soft)", background: "#faf7fb", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: SEM_COLOR[cliCred.estado?.semaforo] || SEM_COLOR.verde, fontSize: 16, lineHeight: 1 }}>●</span>
                      <b>{cliCred.cliente?.razon_social}</b>
                      <span style={{ color: "var(--muted)", fontSize: 13, fontFamily: "ui-monospace,monospace" }}>{cliCred.cliente?.rut}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 13 }}>Disponible <b>{clp(cliCred.estado?.disponible)}</b> · pedido <b>{clp(total)}</b></span>
                      {(cliCred.estado?.puede_comprar !== false && (cliCred.estado?.disponible ?? 0) >= total) ? (
                        <span style={{ fontWeight: 800, color: "var(--ok)" }}>✔ alcanza</span>
                      ) : (
                        <span style={{ fontWeight: 800, color: "var(--danger)" }}>✖ no alcanza</span>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    La venta a crédito genera una factura por pagar (vence según la condición del cliente) y no entra al cajón.
                  </div>
                </div>
              )}
              <button onClick={() => cobrar()} disabled={busy || (metodo === "efectivo" && !abierta) || (metodo === "credito" && !cliCred)} style={{ ...btn("var(--ok)"), width: "100%", fontSize: 18, padding: 14, opacity: (metodo === "efectivo" && !abierta) || (metodo === "credito" && !cliCred) ? 0.55 : 1 }}>
                {busy ? "Cobrando…" : `Cobrar ${clp(total)} → a picking`}
              </button>
              {metodo === "efectivo" && !abierta && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>Abre la caja para cobrar efectivo (tarjeta/transferencia/crédito sí se permiten).</div>
              )}
              {metodo === "credito" && !cliCred && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>Verifica el RUT del cliente para habilitar el cobro a crédito.</div>
              )}
              {metodo === "credito" && errCred && (
                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, background: "#fee2e2", border: "1px solid #fca5a5", color: "var(--danger)" }}>
                  <div style={{ fontWeight: 800 }}>⛔ {errCred}</div>
                  {isSupervisor ? (
                    <button onClick={() => cobrar(true)} disabled={busy} style={{ ...btn("var(--warn)"), marginTop: 8 }}>
                      Autorizar de todos modos (queda registrado)
                    </button>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600 }}>Solo un administrador o gerente puede autorizar esta venta como excepción.</div>
                  )}
                </div>
              )}
            </>
          ) : order.status === "cancelled" ? (
            <div style={{ marginTop: 12, color: "var(--danger)", fontWeight: 700 }}>Pedido anulado. No se puede cobrar.</div>
          ) : cobrableWeb ? (
            <>
              <div style={{ margin: "14px 0 10px", fontSize: 13.5, color: "var(--warn)", fontWeight: 600 }}>
                Pedido web sin pago registrado ({ESTADO[order.status] || order.status}). Cobra el efectivo al retiro:
              </div>
              {keypadUI}
              <button onClick={cobrarWebEfectivo} disabled={busy || !abierta} style={{ ...btn("var(--ok)"), width: "100%", fontSize: 18, padding: 14, opacity: !abierta ? 0.55 : 1 }}>
                {busy ? "Cobrando…" : `Cobrar efectivo ${clp(total)}`}
              </button>
              {!abierta && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>Abre la caja para cobrar efectivo.</div>
              )}
            </>
          ) : (
            <div style={{ marginTop: 12, color: pagado ? "var(--ok)" : "var(--warn)", fontWeight: 700 }}>
              {pagado ? "Este pedido ya fue cobrado." : "Este pedido no tiene pago registrado y su estado no permite cobrarlo desde caja."}
            </div>
          )}

          {/* ── Autorizaciones del jefe: anular boleta / excepción de precio ── */}
          <div style={{ marginTop: 16, borderTop: "1px dashed var(--border-soft)", paddingTop: 12 }}>
            {autz?.estado === "pendiente" ? (
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fef3c7", border: "1px solid var(--warn)", color: "var(--warn)" }}>
                <div style={{ fontWeight: 800 }}>⏳ Esperando autorización del jefe… ({autz.tipo === "anulacion" ? "anulación" : "excepción de precio"})</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>“{autz.detalle}” — se actualiza en vivo, no cierres esta pantalla.</div>
                {(autz.cambios || []).length ? (
                  <div style={{ fontSize: 12.5, marginTop: 6 }}>
                    {autz.cambios.map((c, i) => (
                      <div key={i}>{c.name}: <s>{clp(c.precio_actual)}</s> → <b>{clp(c.precio_propuesto)}</b> c/u × {c.cantidad}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : autz?.estado === "aprobada" ? (
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "#dcfce7", border: "1px solid #86efac", color: "#166534", fontWeight: 700 }}>
                {autz.tipo === "anulacion"
                  ? <>✅ Anulación autorizada por {autz.resuelto_por?.label || "el jefe"} — pedido anulado.</>
                  : <>✅ Excepción de precio autorizada por {autz.resuelto_por?.label || "el jefe"} — los precios ya se aplicaron al pedido.</>}
                {autz.nota_resolucion ? <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Nota: {autz.nota_resolucion}</div> : null}
              </div>
            ) : autz?.estado === "rechazada" ? (
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fee2e2", border: "1px solid #fca5a5", color: "var(--danger)", fontWeight: 700 }}>
                ⛔ {autz.tipo === "anulacion" ? "Anulación" : "Excepción de precio"} rechazada por {autz.resuelto_por?.label || "el jefe"}.
                {autz.nota_resolucion ? <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Nota: {autz.nota_resolucion}</div> : null}
              </div>
            ) : null}

            {order.status !== "cancelled" && autz?.estado !== "pendiente" && (
              solicitando ? (
                <div style={{ marginTop: autz ? 10 : 0 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Solicitar anulación — motivo (obligatorio):
                  </div>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="Ej: cliente se arrepintió, boleta ya emitida"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 8, border: "1px solid var(--border)", resize: "vertical", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={solicitarAutz} disabled={autzBusy || !motivo.trim()} style={{ ...btn(solicitando === "anulacion" ? "var(--danger)" : "var(--warn)"), opacity: autzBusy || !motivo.trim() ? 0.55 : 1 }}>
                      {autzBusy ? "Enviando…" : "Enviar solicitud al jefe"}
                    </button>
                    <button onClick={() => { setSolicitando(null); setMotivo(""); }} disabled={autzBusy} style={{ ...btn("var(--muted)") }}>Cancelar</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                    Se notifica al supervisor en la bandeja Autorizaciones y queda registrado con su usuario — no se puede borrar.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: autz ? 10 : 0 }}>
                  <button onClick={() => { setSolicitando("anulacion"); setMotivo(""); }} style={{ background: "#fff", color: "var(--danger)", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    Solicitar anulación
                  </button>
                  {order.status === "pending" ? (
                    <span style={{ alignSelf: "center", fontSize: 12.5, color: "var(--muted)" }}>
                      ¿Descuento? Edita el precio con el botón "Editar" en la línea del producto.
                    </span>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {msg && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "#222", color: "#fff" }}>{msg}</div>}
    </div>
  );
}

const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 15, cursor: "pointer" });
const sm = { fontSize: 12, color: "var(--muted)" };

function Box({ label, val, sub, c }) {
  return (
    <div style={{ borderLeft: `4px solid ${c}`, paddingLeft: 10 }}>
      <div style={sm}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 2, lineHeight: 1.1 }}>{val}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}

function Meta({ label, val, meta }) {
  const pct = Math.min(100, Math.round(((Number(val) || 0) / meta) * 100));
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)" }}>
        <span>{label}</span><span>{pct}% · meta {clp(meta)}</span>
      </div>
      <div style={{ height: 10, background: "#eee", borderRadius: 6, overflow: "hidden", marginTop: 3 }}>
        <div style={{ width: pct + "%", height: "100%", background: pct >= 100 ? "var(--ok)" : "var(--magenta-d)" }} />
      </div>
    </div>
  );
}

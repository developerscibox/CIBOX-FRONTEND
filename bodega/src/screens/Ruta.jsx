import { useEffect, useState } from "react";
import { api, useLoad, usingMock, streamUrl } from "../api.js";
import { ORDERS_RES } from "../data.js";
import { clp } from "../theme.js";
import { useAuth } from "../auth.jsx";

/**
 * EN RUTA — la hoja de reparto del día.
 *
 * QUÉ PROBLEMA RESUELVE
 * El estado "en camino" ya existía y se podía marcar desde Pedidos, pero
 * quedaba mezclado entre todos los estados: para saber qué hay que cargar en el
 * auto y a dónde hay que ir, había que filtrar a mano y abrir pedido por pedido
 * para ver la dirección. Esta pantalla responde de un vistazo las dos únicas
 * preguntas del reparto: qué sale ahora y qué anda dando vueltas.
 *
 * POR QUÉ DOS COLUMNAS Y NO SOLO "EN CAMINO"
 * Quien reparte necesita ver PRIMERO lo que tiene que cargar (pedidos listos y
 * con despacho), y recién después lo que ya salió. Una pantalla con solo los
 * despachados obliga a volver a Pedidos para armar la carga, que es justo el
 * paseo que esto viene a evitar.
 *
 * POR QUÉ AGRUPADO POR COMUNA
 * La ruta se arma por zona, no por orden de llegada. Agrupar por comuna hace
 * evidente "estos cuatro son de Machalí, van juntos" sin que nadie lo piense.
 *
 * El retiro en bodega NO aparece acá: no hay reparto que hacer. Esos pedidos se
 * entregan desde Pedidos con "Marcar retirada".
 */

/** Hace cuánto que el pedido está en su estado actual, en texto corto. */
const desdeHace = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
};

/** Momento en que el pedido entró al estado que tiene ahora. */
const entroAlEstado = (o) => {
  const h = Array.isArray(o.status_history) ? o.status_history : [];
  for (let i = h.length - 1; i >= 0; i -= 1) {
    if (h[i]?.status === o.status) return h[i].changed_at || null;
  }
  return o.updated_at || o.created_at || null;
};

const folio = (o) => String(o._id || "").slice(-6).toUpperCase();

/** Dirección en una línea, sin los "null" que deja el modelo. */
const direccion = (o) => {
  const s = o.shipping || {};
  return [s.address, s.addressLine2].filter(Boolean).join(", ") || "Sin dirección";
};

const comunaDe = (o) => (o.shipping?.city || "").trim() || "Sin comuna";

/** Solo dígitos, con código de país, para los enlaces de WhatsApp. */
const soloDigitos = (fono) => {
  const d = String(fono || "").replace(/\D/g, "");
  if (!d) return null;
  return d.startsWith("56") ? d : `56${d.replace(/^0+/, "")}`;
};

function Tarjeta({ o, accion, onAccion, busy }) {
  const s = o.shipping || {};
  const wa = soloDigitos(o.customer?.phone);
  const cuando = desdeHace(entroAlEstado(o));

  return (
    <div
      className="card"
      style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: ".5px" }}>#{folio(o)}</span>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{o.customer?.fullName || "Sin nombre"}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>{clp(o.total)}</span>
      </div>

      <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
        📍 {direccion(o)}
        {s.reference ? (
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>Referencia: {s.reference}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
        {o.customer?.phone ? (
          <>
            <a href={`tel:${o.customer.phone}`} style={{ color: "var(--magenta,#004568)", fontWeight: 700 }}>
              📞 {o.customer.phone}
            </a>
            {wa ? (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, le escribimos de Cibox por su pedido #${folio(o)}.`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#128C7E", fontWeight: 700 }}
              >
                WhatsApp
              </a>
            ) : null}
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>Sin teléfono</span>
        )}
        {cuando ? <span style={{ color: "var(--muted)" }}>· {cuando}</span> : null}
        {o.packing?.bultos ? (
          <span style={{ color: "var(--muted)" }}>· {o.packing.bultos} bulto{o.packing.bultos === 1 ? "" : "s"}</span>
        ) : null}
      </div>

      {o.notes ? (
        <div style={{ fontSize: 12.5, color: "var(--warn,#92400e)", background: "#fffbeb", borderRadius: 6, padding: "6px 8px" }}>
          Nota del cliente: {o.notes}
        </div>
      ) : null}

      {accion ? (
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onAccion(o, accion)}
          style={{ alignSelf: "flex-start" }}
        >
          {busy ? "Aplicando…" : accion.label}
        </button>
      ) : null}
    </div>
  );
}

function Columna({ titulo, subtitulo, pedidos, accion, onAccion, busyId, vacio }) {
  // Agrupadas por comuna y ordenadas por cantidad: la zona con más paradas
  // primero, que es por donde conviene partir.
  const porComuna = pedidos.reduce((acc, o) => {
    const c = comunaDe(o);
    (acc[c] = acc[c] || []).push(o);
    return acc;
  }, {});
  const comunas = Object.keys(porComuna).sort((a, b) => porComuna[b].length - porComuna[a].length);

  return (
    <div style={{ flex: "1 1 340px", minWidth: 300 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{titulo}</h3>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            borderRadius: 999,
            padding: "2px 10px",
            background: pedidos.length ? "#e0f2fe" : "#f1f5f9",
            color: pedidos.length ? "#0369a1" : "var(--muted)",
          }}
        >
          {pedidos.length}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{subtitulo}</div>

      {pedidos.length === 0 ? (
        <div className="card" style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
          {vacio}
        </div>
      ) : (
        comunas.map((c) => (
          <div key={c} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: "var(--muted)",
                margin: "0 0 6px 2px",
              }}
            >
              {c} · {porComuna[c].length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {porComuna[c].map((o) => (
                <Tarjeta
                  key={o._id}
                  o={o}
                  accion={accion}
                  onAccion={onAccion}
                  busy={busyId === String(o._id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Ruta() {
  const { can } = useAuth();
  const puedeDespachar = can("orders.deliver");
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  // Refresco en vivo, igual que Preparación: si otra persona marca un pedido
  // desde su pantalla, esta se entera sin que nadie recargue. El intervalo
  // queda de respaldo por si el canal en vivo se cae.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    let es = null;
    try {
      const u = streamUrl();
      if (u) {
        es = new EventSource(u);
        es.addEventListener("change", () => setTick((n) => n + 1));
      }
    } catch {
      /* si no hay canal en vivo, queda el intervalo */
    }
    return () => {
      clearInterval(id);
      try {
        es && es.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  // Firma de useLoad: (fetcher, valorEnModoDemo, deps). Devuelve { data,
  // loading, error } — no trae `reload`, así que refrescar es subir `tick`.
  const { data, loading, error: errCarga } = useLoad(
    async () => {
      const [listos, enCamino] = await Promise.all([
        api.orders({ status: "ready", limit: 100 }).catch(() => ({ orders: [] })),
        api.orders({ status: "shipped", limit: 100 }).catch(() => ({ orders: [] })),
      ]);
      return { orders: [...(listos.orders || []), ...(enCamino.orders || [])] };
    },
    { orders: ORDERS_RES.orders || [] },
    [tick],
  );

  const todos = data?.orders || [];
  // El retiro en bodega no se reparte: no tiene nada que hacer en esta pantalla.
  const conDespacho = todos.filter((o) => o.delivery_method !== "pickup");
  const porSalir = conDespacho.filter((o) => o.status === "ready");
  const enCamino = conDespacho.filter((o) => o.status === "shipped");

  const aplicar = async (o, accion) => {
    setBusyId(String(o._id));
    setErr("");
    try {
      if (!usingMock) await api.setOrderStatus(o._id, accion.to, accion.note);
      setTick((n) => n + 1);
    } catch (e) {
      setErr(e.message || "No se pudo cambiar el estado del pedido");
    } finally {
      setBusyId(null);
    }
  };

  const accionSalir = puedeDespachar ? { to: "shipped", label: "Marcar en camino", note: "Salió a reparto" } : null;
  const accionEntregar = puedeDespachar ? { to: "delivered", label: "Marcar entregada", note: "Entregado al cliente" } : null;

  return (
    <div>
      {!puedeDespachar ? (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "var(--muted)" }}>
          Puedes ver la ruta, pero tu rol no puede marcar pedidos en camino ni entregados.
        </div>
      ) : null}

      {err || errCarga ? (
        <div
          className="card"
          style={{ padding: "10px 14px", marginBottom: 12, color: "var(--danger)", fontWeight: 600, fontSize: 13.5 }}
        >
          {err || errCarga}
        </div>
      ) : null}

      {loading && todos.length === 0 ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)" }}>Cargando la ruta…</div>
      ) : (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Columna
            titulo="Por salir"
            subtitulo="Empacados y esperando que alguien los cargue"
            pedidos={porSalir}
            accion={accionSalir}
            onAccion={aplicar}
            busyId={busyId}
            vacio="Nada esperando salida. Los pedidos aparecen acá al marcarlos listos en Preparación."
          />
          <Columna
            titulo="En camino"
            subtitulo="Ya salieron. El cliente los ve así en su seguimiento."
            pedidos={enCamino}
            accion={accionEntregar}
            onAccion={aplicar}
            busyId={busyId}
            vacio="Ningún pedido en la calle ahora mismo."
          />
        </div>
      )}
    </div>
  );
}

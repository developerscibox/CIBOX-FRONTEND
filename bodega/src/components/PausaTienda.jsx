import { useEffect, useState } from "react";
import { usingMock, getToken } from "../api.js";

/**
 * APAGADO DE EMERGENCIA DE LA TIENDA ONLINE.
 *
 * Pausa la venta al público: el cliente ve una página de mantención con el
 * mensaje que se escriba aquí, y el checkout queda BLOQUEADO en el servidor
 * (no es cosmético: `assertTiendaAbierta` rechaza la creación del pedido).
 * La preparación, la caja y el panel siguen funcionando normal.
 *
 * POR QUÉ VIVE EN SU PROPIO ARCHIVO
 * Nació dentro de la pantalla "Contenido de la tienda", que es de marketing y
 * además está oculta en el menú: el interruptor de emergencia quedaba
 * inalcanzable justo cuando hace falta. Al sacarlo aquí se monta en el Resumen
 * —la pantalla donde el equipo aterriza— sin duplicar el código ni mantener
 * dos versiones que se desincronizan.
 *
 * El cambio tarda hasta ~1 minuto en verse: el backend cachea el estado 15s y
 * la tienda lo vuelve a consultar cada 60s. Por eso el mensaje de confirmación
 * lo dice en vez de prometer un corte instantáneo.
 */

export default function PausaTienda() {
  const BASE = import.meta.env.VITE_API_URL || "";
  const [st, setSt] = useState(null);       // { paused, message } | null = cargando
  const [err, setErr] = useState(false);    // el GET falló: NO asumir "ACTIVA"
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgP, setMsgP] = useState(null);   // { ok, text }

  const cargar = () => {
    if (usingMock) { setSt({ paused: false, message: "" }); return; }
    setErr(false); setSt(null);
    fetch(`${BASE}/content/store-status`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((j) => { if (!j?.data) throw new Error("sin data"); setSt(j.data); setMensaje(j.data.message || ""); })
      .catch(() => setErr(true));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  const cambiar = async (objetivo) => {
    if (busy || !st) return;
    const aviso = objetivo
      ? "¿PAUSAR la tienda online?\n\nLos clientes verán una página de mantención y no podrán comprar hasta que la reanudes. La venta presencial y el panel siguen funcionando."
      : "¿Reanudar la tienda online?\n\nLos clientes vuelven a comprar de inmediato.";
    if (!window.confirm(aviso)) return;
    setBusy(true); setMsgP(null);
    try {
      if (usingMock) { setSt({ paused: objetivo, message: mensaje }); setMsgP({ ok: true, text: "Modo demostración: sin backend." }); return; }
      const r = await fetch(`${BASE}/content/store-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ paused: objetivo, message: mensaje.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      // 401 = token de acceso vencido (esta llamada no tiene el auto-refresh de api.js).
      if (r.status === 401) throw new Error("Sesión vencida: recarga la página o vuelve a iniciar sesión.");
      if (!r.ok) throw new Error(j?.message || j?.error || r.statusText);
      setSt(j.data);
      setMsgP({ ok: true, text: objetivo
        ? "⏸ Tienda PAUSADA. Los clientes lo ven en menos de 1 minuto."
        : "▶ Tienda reactivada. Los clientes ya pueden comprar." });
    } catch (e) { setMsgP({ ok: false, text: e.message || "No se pudo cambiar el estado" }); }
    finally { setBusy(false); }
  };

  const pausada = !!st?.paused;
  return (
    <div className="card" style={{ borderLeft: `4px solid ${pausada ? "var(--danger)" : "var(--ok)"}` }}>
      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tienda online</h3>
          <span style={{ fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: "3px 12px",
            background: err ? "#fef3c7" : pausada ? "#fee2e2" : "#ecfdf5",
            color: err ? "#92400e" : pausada ? "var(--danger)" : "#166534" }}>
            {err ? "SIN CONFIRMAR" : st === null ? "Cargando…" : pausada ? "EN PAUSA" : "ACTIVA"}
          </span>
          <div style={{ flex: 1 }} />
          {err ? (
            <button className="btn" onClick={cargar}>Reintentar</button>
          ) : st !== null ? (
            <button className="btn btn-primary" onClick={() => cambiar(!pausada)} disabled={busy}
              style={pausada ? { background: "var(--ok)", borderColor: "var(--ok)" } : { background: "var(--danger)", borderColor: "var(--danger)" }}>
              {busy ? "Aplicando…" : pausada ? "▶ Reanudar tienda" : "⏸ Pausar tienda"}
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 10px", lineHeight: 1.5 }}>
          Al pausar, los clientes ven una página de mantención y <b>no pueden comprar</b> (el checkout
          queda bloqueado). La venta presencial, la caja y el picking siguen funcionando normal.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Mensaje para los clientes (opcional):</span>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value.slice(0, 200))}
            placeholder="Ej: Volvemos a las 15:00 — estamos haciendo inventario"
            style={{ flex: "1 1 280px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13.5 }} />
        </div>
        {msgP ? (
          <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: msgP.ok ? "var(--ok)" : "var(--danger)" }}>{msgP.text}</div>
        ) : null}
      </div>
    </div>
  );
}

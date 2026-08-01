import { useEffect, useState } from "react";
import { api, useLoad, usingMock, streamUrl } from "../api.js";
import { Tabla } from "../components/Ui.jsx";
import { clp } from "../theme.js";

// AUTORIZACIONES (anti-robo) — bandeja del jefe, usable desde el celular.
// La cajera solicita anular una boleta o una excepción de precio desde Caja;
// aquí el dueño/jefe aprueba o rechaza EN VIVO (SSE + poll 10s). El registro es
// inmutable: nunca se borra ni se edita el detalle, solo se resuelve.

const TIPO = {
  anulacion: { label: "Anulación de boleta", color: "#b91c1c" },
  precio: { label: "Excepción de precio", color: "#b45309" },
};
const ESTADO = {
  pendiente: { label: "Pendiente", bg: "#fef3c7", text: "#92400e" },
  aprobada: { label: "Aprobada", bg: "#dcfce7", text: "#166534" },
  rechazada: { label: "Rechazada", bg: "#fee2e2", text: "#b91c1c" },
};

const MOCK = {
  items: [
    { _id: "a1", tipo: "anulacion", order_id: "650f1a2b3c4d5e6f7a8b9c01", folio: "9C0B01", monto: 24800, detalle: "Cliente se arrepintió, boleta ya emitida", solicitante: { label: "Carla (Caja 1)", role: "cashier" }, estado: "pendiente", created_at: new Date(Date.now() - 4 * 60000).toISOString() },
    { _id: "a2", tipo: "precio", order_id: "650f1a2b3c4d5e6f7a8b9c02", folio: "9C0B02", monto: 45900, detalle: "Aceite 12un a $1.100 c/u (precio de la semana pasada en el cartel)", solicitante: { label: "María (Caja 2)", role: "cashier" }, estado: "aprobada", resuelto_por: { label: "Don Pedro" }, resuelto_en: new Date(Date.now() - 60 * 60000).toISOString(), created_at: new Date(Date.now() - 65 * 60000).toISOString() },
  ],
  pendientes: 1,
};

function fmt(iso) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return isNaN(d) ? "Sin fecha" : d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function haceCuanto(iso) {
  const ms = Date.now() - new Date(iso || 0).getTime();
  if (isNaN(ms) || ms < 0) return "recién";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h ${min % 60 ? (min % 60) + " min" : ""}`.trim();
  return `hace ${Math.floor(h / 24)} día(s)`;
}

export default function Autorizaciones() {
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // EN VIVO: el SSE del relay avisa de cada solicitud/resolución (type:"auth");
  // el poll de 10s queda de respaldo si el stream se cae.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10000);
    let es = null;
    try {
      const u = streamUrl();
      if (u) { es = new EventSource(u); es.addEventListener("change", () => setTick((n) => n + 1)); }
    } catch { /* sin SSE → sigue el polling */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  // Una sola consulta: "todas" trae pendientes + histórico (máx 50, desc).
  const res = useLoad(() => api.autorizaciones("todas"), MOCK, [tick]);
  const items = res.data?.items || [];
  const pendientes = items.filter((a) => a.estado === "pendiente");
  const historico = items.filter((a) => a.estado !== "pendiente");

  const resolver = async (a, aprobar) => {
    setErr(null); setMsg(null);
    if (aprobar && a.tipo === "anulacion") {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`¿Aprobar la ANULACIÓN de la boleta #${a.folio} por ${clp(a.monto)}? El pedido queda anulado y se libera el stock.`)) return;
    }
    let nota = "";
    if (!aprobar) {
      // eslint-disable-next-line no-alert
      const n = window.prompt("Motivo del rechazo (opcional):", "");
      if (n === null) return; // canceló
      nota = n.trim();
    }
    setBusyId(a._id);
    try {
      if (usingMock) { setMsg("Acción simulada · demo."); return; }
      await api.resolverAutorizacion(a._id, aprobar, nota || undefined);
      setMsg(aprobar
        ? (a.tipo === "anulacion" ? `Anulación de #${a.folio} aprobada — pedido anulado.` : `Excepción de precio de #${a.folio} aprobada — la cajera aplica el ajuste y queda registrado.`)
        : `Solicitud de #${a.folio} rechazada.`);
    } catch (e) {
      // 409 = ya la resolvió otro jefe (o desde otro dispositivo): solo refrescar.
      setErr(e.status === 409 ? "Esta solicitud ya fue resuelta (se actualizó la lista)." : (e.message || "No se pudo resolver la solicitud"));
    } finally {
      setBusyId(null);
      setTick((n) => n + 1);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {msg ? <div className="ok-msg" style={{ marginTop: 0, marginBottom: 14 }}>{msg}</div> : null}
      {err ? <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "11px 16px", borderRadius: 12, fontWeight: 600, fontSize: 13.5, marginBottom: 14 }}>{err}</div> : null}

      {/* ── Pendientes: cards grandes, botones de pulgar (celular) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Pendientes de tu autorización</h2>
        <span className="badge" style={{ background: pendientes.length ? "#fef3c7" : "#dcfce7", color: pendientes.length ? "#92400e" : "#166534" }}>
          {res.loading && !res.data ? "…" : pendientes.length}
        </span>
      </div>

      {pendientes.length === 0 ? (
        <div className="card" style={{ padding: "26px 22px", marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ok, #166534)", marginBottom: 4 }}>Sin solicitudes pendientes</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5, fontWeight: 600 }}>
            Cuando una cajera pida anular una boleta o una excepción de precio, aparecerá aquí al instante.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          {pendientes.map((a) => {
            const t = TIPO[a.tipo] || { label: a.tipo, color: "#374151" };
            const busy = busyId === a._id;
            return (
              <div key={a._id} className="card" style={{ padding: 16, borderLeft: `5px solid ${t.color}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 16 }}>{t.label}</b>
                  <span className="mono" style={{ fontWeight: 700 }}>#{a.folio}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{clp(a.monto)}</span>
                </div>
                {a.detalle ? (
                  <div style={{ margin: "10px 0", padding: "10px 12px", background: "#faf7fb", borderRadius: 8, fontSize: 14.5 }}>
                    “{a.detalle}”
                  </div>
                ) : null}
                {(a.cambios || []).length ? (
                  <div style={{ margin: "0 0 10px", padding: "10px 12px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 13.5 }}>
                    {a.cambios.map((c, i) => {
                      const dcto = c.precio_actual > 0 ? Math.round((1 - c.precio_propuesto / c.precio_actual) * 100) : 0;
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <span>{c.name} <span style={{ color: "var(--muted)" }}>× {c.cantidad}</span></span>
                          <span><s style={{ color: "var(--muted)" }}>{clp(c.precio_actual)}</s> → <b>{clp(c.precio_propuesto)}</b> c/u
                            {dcto !== 0 ? <b style={{ color: dcto > 0 ? "var(--danger)" : "var(--ok)", marginLeft: 6 }}>({dcto > 0 ? "-" : "+"}{Math.abs(dcto)}%)</b> : null}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 6, fontSize: 12, color: "#92400e" }}>Al aprobar, los precios se aplican al pedido automáticamente.</div>
                  </div>
                ) : null}
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                  Solicita <b style={{ color: "var(--text, #2a1022)" }}>{a.solicitante?.label || "Sin registro"}</b>
                  {a.solicitante?.role ? ` (${a.solicitante.role})` : ""} · {haceCuanto(a.created_at)}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => resolver(a, true)}
                    disabled={busy}
                    style={{ flex: "1 1 160px", padding: "14px 16px", fontSize: 16, fontWeight: 800, borderRadius: 10, border: "none", background: "#0a7d33", color: "#fff", cursor: "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? "…" : "Aprobar"}
                  </button>
                  <button
                    onClick={() => resolver(a, false)}
                    disabled={busy}
                    style={{ flex: "1 1 160px", padding: "14px 16px", fontSize: 16, fontWeight: 800, borderRadius: 10, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer", opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? "…" : "Rechazar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Histórico (inmutable): quién pidió qué y quién lo resolvió ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-h">
          <h2>Histórico</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Registro inmutable · últimas {items.length}</span>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          {res.error && !items.length ? (
            <div style={{ padding: 14, color: "var(--danger)" }}>Error: {res.error}</div>
          ) : (
            <Tabla
              head={["Fecha", "Tipo", "Folio", "Monto", "Solicitante", "Estado", "Resuelto por"]}
              aligns={["l", "l", "l", "r", "l", "l", "l"]}
              empty="Aún no hay solicitudes resueltas."
              rows={historico.map((a) => {
                const t = TIPO[a.tipo] || { label: a.tipo };
                const e = ESTADO[a.estado] || { label: a.estado, bg: "#f3f4f6", text: "#374151" };
                return [
                  fmt(a.created_at),
                  t.label,
                  <span key="f" className="mono" style={{ fontWeight: 700 }}>#{a.folio}</span>,
                  clp(a.monto),
                  a.solicitante?.label || <span key="s" style={{ color: "var(--muted)" }}>Sin registro</span>,
                  <span key="e" className="badge" style={{ background: e.bg, color: e.text }}>{e.label}</span>,
                  <span key="r" title={a.nota_resolucion || ""}>
                    {a.resuelto_por?.label || <span style={{ color: "var(--muted)" }}>Sin registro</span>}
                    {a.nota_resolucion ? <span style={{ color: "var(--muted)" }}> · con nota</span> : null}
                  </span>,
                ];
              })}
            />
          )}
        </div>
        {usingMock ? <div style={{ padding: "0 16px 12px", fontSize: 12, color: "var(--muted)" }}>Modo demostración: las acciones no se persisten.</div> : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";
import { buildBoletaHtml, imprimirEnIframe } from "../print.js";
import { imprimirBoletaTermica, puenteVivo, imprimirPruebaTermica } from "../escpos.js";
import { clp } from "../theme.js";

// ESTACIÓN DE IMPRESIÓN CENTRAL. El computador del local muestra la COLA de pedidos
// tomados en sala (por pagar). El operador puede PREVISUALIZAR la boleta (ver qué va
// a salir) y apretar IMPRIMIR. Se refresca en vivo por SSE; no imprime solo.

const LS_KEY = "b12_boletas_impresas";
const loadPrinted = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); } catch { return new Set(); } };
const savePrinted = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify([...s].slice(-800))); } catch { /* noop */ } };
const hora = (x) => { try { return new Date(x).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const folio = (id) => String(id || "").slice(-6).toUpperCase();

export default function Impresion() {
  const [conectado, setConectado] = useState(false);
  const [cola, setCola] = useState([]);
  const [preview, setPreview] = useState(null); // { order, html }
  const [verImpresas, setVerImpresas] = useState(false); // sección plegable de ya impresas
  const [printing, setPrinting] = useState(null); // _id en impresión (evita doble click = doble boleta)
  const [aviso, setAviso] = useState(null); // by-scan falló: la boleta puede salir incompleta
  const [, force] = useState(0);
  const sectoresRef = useRef({});
  const printed = useRef(loadPrinted());
  // Modo TÉRMICO (RPP02N por el puente local). Se recuerda por estación.
  const [termica, setTermica] = useState(() => { try { return localStorage.getItem("b12_print_termica") === "1"; } catch { return false; } });
  const [puente, setPuente] = useState(null); // null=sin probar · true/false = puente vivo
  const toggleTermica = (v) => { setTermica(v); try { localStorage.setItem("b12_print_termica", v ? "1" : "0"); } catch { /* noop */ } };

  // Con modo térmico activo, chequea que el puente esté corriendo (cada 8s).
  useEffect(() => {
    if (!termica) { setPuente(null); return undefined; }
    let alive = true;
    const check = () => puenteVivo().then((ok) => { if (alive) setPuente(ok); });
    check();
    const iv = setInterval(check, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [termica]);

  const cargarCola = () => {
    // Solo boletas de SALA (relay): los pedidos web pending (webpay/transfer sin pagar)
    // no llevan codigo_escaneo ni vendedor y NO van a esta cola.
    api.orders({ status: "pending", limit: 50 })
      .then((r) => setCola((r.orders || []).filter((o) => o.codigo_escaneo || o.seller?.id)))
      .catch(() => {});
  };

  useEffect(() => {
    if (usingMock) return;
    api.sectores().then((r) => { const m = {}; (r.sectores || []).forEach((s) => { m[s.nombre] = s.orden; }); sectoresRef.current = m; }).catch(() => {});
    cargarCola();
  }, []);

  useEffect(() => {
    const url = streamUrl();
    if (!url) return undefined;
    const es = new EventSource(url);
    es.onopen = () => setConectado(true);
    es.onerror = () => setConectado(false);
    es.addEventListener("change", () => cargarCola());
    const iv = setInterval(cargarCola, 20000);
    return () => { es.close(); clearInterval(iv); };
  }, []);

  // Trae el pedido completo (ítems con cajas/sector) para armar la boleta exacta.
  // Si by-scan falla se avisa: la boleta saldría con los datos parciales de la lista.
  const fullOrder = async (o) => {
    try { const r = await api.findByScan(o._id); return r?.order || r?.data?.order || o; }
    catch { setAviso(`No se pudo traer el detalle de #${folio(o._id)}: la boleta puede salir incompleta.`); return o; }
  };

  const previsualizar = async (o) => {
    setAviso(null);
    const order = await fullOrder(o);
    const html = await buildBoletaHtml(order, sectoresRef.current);
    setPreview({ order, html });
  };

  const imprimir = async (o, cerrar = false) => {
    if (printing) return; // ya hay una impresión en curso
    setPrinting(String(o._id)); setAviso(null);
    try {
      const order = await fullOrder(o);
      // Térmica primero (RPP02N por el puente); si falla, cae al navegador.
      let ok = false;
      if (termica) ok = await imprimirBoletaTermica(order);
      if (!ok) {
        const html = await buildBoletaHtml(order, sectoresRef.current);
        imprimirEnIframe(html);
        if (termica) setAviso("No se pudo imprimir en la térmica (¿puente apagado?). Salió por el navegador.");
      }
      // Persistir printed_at en el backend (best-effort); localStorage queda como
      // fallback visual si el PATCH falla o mientras refresca la cola.
      api.marcarImpresa(o._id).then(() => cargarCola()).catch(() => {});
      printed.current.add(String(o._id));
      savePrinted(printed.current);
      force((n) => n + 1);
      if (cerrar) setPreview(null);
    } finally { setPrinting(null); }
  };

  if (usingMock) {
    return <div className="card" style={{ padding: 18, color: "var(--muted)" }}>La estación de impresión necesita el backend en vivo (VITE_API_URL) para recibir los pedidos del relay.</div>;
  }

  // "Ya impresa" = printed_at del backend (fuente de verdad); localStorage solo
  // como fallback visual (impresiones cuyo PATCH falló o aún no refresca).
  const yaImpresa = (o) => o.printed_at != null || printed.current.has(String(o._id));
  const pendientes = cola.filter((o) => !yaImpresa(o));
  const impresas = cola.filter(yaImpresa);
  const porImprimir = pendientes.length;

  const Fila = (o) => {
    const ya = yaImpresa(o);
    const enCurso = printing === String(o._id);
    return (
      <div key={o._id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: ya ? 0.75 : 1 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800 }}>#{folio(o._id)} · {clp(o.total)}{ya ? <span className="badge" style={{ background: "color-mix(in srgb, var(--ok) 14%, #fff)", color: "var(--ok)", marginLeft: 8 }}>Impresa</span> : null}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {[o.customer?.fullName || "Mostrador", `${(o.items || []).length} ítems`, o.seller?.nombre ? `vendedor: ${o.seller.nombre}` : "sin vendedor", hora(o.created_at)].filter(Boolean).join(" · ")}
          </div>
        </div>
        <button onClick={() => previsualizar(o)} style={btn("#fff", "var(--magenta-d)", "#e3d5e8")}>Previsualizar</button>
        <button onClick={() => imprimir(o)} disabled={enCurso} style={{ ...btn(ya ? "var(--muted)" : "var(--magenta-d)", "#fff", ya ? "var(--muted)" : "var(--magenta-d)"), opacity: enCurso ? 0.6 : 1 }}>{enCurso ? "Imprimiendo…" : ya ? "Reimprimir" : "Imprimir"}</button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="card" style={{ padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: conectado ? "var(--ok)" : "var(--danger)", display: "inline-block", flexShrink: 0 }} />
        <b>{conectado ? "Conectada · en vivo" : "Reconectando…"}</b>
        <span style={{ color: "var(--muted)" }}>· {porImprimir} por imprimir</span>
        <div style={{ flex: 1 }} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }} title="Imprime directo en la RPP02N por el puente local, sin diálogo">
          <input type="checkbox" checked={termica} onChange={(e) => toggleTermica(e.target.checked)} />
          Impresora térmica
        </label>
        {termica ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: puente ? "var(--ok)" : "var(--danger)" }}>
              {puente == null ? "probando…" : puente ? "● puente OK" : "● puente sin conexión"}
            </span>
            <button onClick={() => imprimirPruebaTermica()} style={btn("#fff", "var(--magenta-d)", "#e3d5e8")}>Probar</button>
          </>
        ) : null}
        <button onClick={cargarCola} style={btn("#fff", "var(--muted)", "var(--border)")}>Actualizar</button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
        Cada pedido tomado en sala aparece aquí. Previsualice la boleta y presione <b>Imprimir</b>. Mantenga esta pantalla abierta en el computador conectado a la impresora.
      </div>

      {aviso && (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 12, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>{aviso}</div>
      )}

      {/* Por imprimir — la lista activa, que baja a medida que imprimes. */}
      {pendientes.length === 0 ? (
        <div className="card" style={{ padding: 26, color: "var(--muted)", textAlign: "center" }}>
          {cola.length === 0 ? "Sin pedidos por imprimir. Esperando que la sala tome el primero…" : "Todo impreso. No queda nada pendiente."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {pendientes.map(Fila)}
        </div>
      )}

      {/* Ya impresas — plegable, para reimprimir si hace falta. */}
      {impresas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setVerImpresas((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)", background: verImpresas ? "#f3eef6" : "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit", color: "var(--text)" }}>
            <span>Ya impresas ({impresas.length})</span>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{verImpresas ? "ocultar ▲" : "ver ▼"}</span>
          </button>
          {verImpresas && <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{impresas.map(Fila)}</div>}
        </div>
      )}

      {/* Previsualización de la boleta */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(20,10,18,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 16, maxWidth: 380, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b style={{ fontSize: 16 }}>Previsualización · #{folio(preview.order._id)}</b>
              <button onClick={() => setPreview(null)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
            </div>
            <iframe title="boleta" srcDoc={preview.html} style={{ width: "100%", height: "55vh", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPreview(null)} style={{ ...btn("#fff", "var(--muted)", "var(--border)"), flex: 1, padding: 13 }}>Cerrar</button>
              <button onClick={() => imprimir(preview.order, true)} disabled={!!printing} style={{ ...btn("var(--magenta-d)", "#fff", "var(--magenta-d)"), flex: 2, padding: 13, fontSize: 15, opacity: printing ? 0.6 : 1 }}>{printing ? "Imprimiendo…" : "Imprimir esta boleta"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = (bg, color, border) => ({ padding: "9px 14px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

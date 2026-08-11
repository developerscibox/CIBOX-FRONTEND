import { useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";

// Apartado de PRECIOS Y MÁRGENES (gerente/dueño): calculadora costo→precio por
// margen objetivo, margen real por producto con semáforo, productos bajo el
// objetivo y rentabilidad por categoría. El costo solo lo ve products.manage.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

// Helpers de precio (consistentes con Productos.jsx).
const boxTier = (p) => {
  const t = (p?.pricing?.tiers || []).filter((x) => (x.min_qty || 1) > 1);
  return t.length ? t.reduce((a, b) => ((b.min_qty || 0) > (a.min_qty || 0) ? b : a)) : null;
};
const unitTier = (p) => (p?.pricing?.tiers || []).find((x) => (x.min_qty || 1) === 1) || (p?.pricing?.tiers || [])[0] || null;
const sellPrice = (p) => { const b = boxTier(p); if (b) return Number(b.price || 0); const u = unitTier(p); return u ? Number(u.price || 0) : 0; };
const marginPct = (cost, sell) => (cost > 0 && sell > 0 ? Math.round(((sell - cost) / sell) * 100) : null);
// Precio sugerido para alcanzar un margen objetivo (margen sobre venta).
const precioPara = (cost, objetivo) => (cost > 0 && objetivo < 100 ? Math.round(cost / (1 - objetivo / 100)) : 0);

const colorMargen = (m, obj) => (m == null ? "var(--muted)" : m < 0 ? "var(--danger)" : m < obj ? "var(--warn)" : "var(--ok)");

// Reconstruye los tiers de un producto para dejar el precio de venta (el de caja)
// en el margen objetivo, respetando tiers descendentes. Devuelve null si no aplica
// (sin costo, sin tiers). Reutilizado por "Fijar" individual y por lote.
const buildTiers = (f) => {
  if (!(f.cost > 0) || !f.tiers.length) return null;
  const tiers = f.tiers.map((t) => ({
    min_qty: t.min_qty || 1,
    price: Math.round(t.price),
    label: t.label || ((t.min_qty || 1) === 1 ? "Unidad" : `Caja ${t.min_qty} un`),
  }));
  const box = tiers.filter((t) => t.min_qty > 1).sort((a, b) => b.min_qty - a.min_qty)[0];
  const unit = tiers.find((t) => t.min_qty === 1) || tiers[0];
  if (box) { box.price = f.sugerido; if (unit && unit.price <= f.sugerido) unit.price = Math.round(f.sugerido * 1.15); }
  else if (unit) { unit.price = f.sugerido; }
  tiers.sort((a, b) => a.min_qty - b.min_qty);
  return tiers;
};
// Un producto es "fijable" en grupo si tiene costo y una estructura de precio
// simple (1-2 tiers) — la misma condición del botón "Fijar" individual.
const esFijable = (f) => f.cost > 0 && f.tiers.length > 0 && f.tiers.length <= 2;

const MOCK = {
  items: [
    { _id: "1", name: "Arroz Grado 1 1kg", cost_price: 700, category_id: "c1", pricing: { tiers: [{ min_qty: 1, price: 1490 }, { min_qty: 12, price: 1032 }] } },
    { _id: "2", name: "Aceite Vegetal 1L", cost_price: 1190, category_id: "c1", pricing: { tiers: [{ min_qty: 1, price: 1790 }, { min_qty: 12, price: 1590 }] } },
    { _id: "3", name: "Bebida 1.5L", cost_price: 690, category_id: "c2", pricing: { tiers: [{ min_qty: 1, price: 990 }, { min_qty: 6, price: 790 }] } },
    { _id: "4", name: "Detergente 5kg", cost_price: 5200, category_id: "c3", pricing: { tiers: [{ min_qty: 1, price: 5990 }] } },
    { _id: "5", name: "Fideos 400g", cost_price: 520, category_id: "c1", pricing: { tiers: [{ min_qty: 1, price: 890 }, { min_qty: 20, price: 690 }] } },
    { _id: "6", name: "Salsa de soya 1L", cost_price: 2100, category_id: "c1", pricing: { tiers: [{ min_qty: 1, price: 2390 }] } },
    { _id: "7", name: "Té verde 20u", cost_price: 0, category_id: "c2", pricing: { tiers: [{ min_qty: 1, price: 2490 }] } },
  ],
};
const MOCK_CATS = { items: [{ _id: "c1", name: "Abarrotes" }, { _id: "c2", name: "Bebidas" }, { _id: "c3", name: "Limpieza" }] };

function Kpi({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: color || "inherit" }}>{value}</div>
    </div>
  );
}

export default function Precios() {
  const [objetivo, setObjetivo] = useState(25); // margen objetivo %
  const [calcCosto, setCalcCosto] = useState("");
  const [nonce, setNonce] = useState(0);
  const [fijando, setFijando] = useState(null);
  const [q, setQ] = useState("");           // búsqueda por nombre
  const [catFiltro, setCatFiltro] = useState("all"); // filtro/agrupación por categoría
  const [bulkBusy, setBulkBusy] = useState(false);   // fijación por lote en curso
  // Selección UNO A UNO (checkbox por fila) para fijar un grupo personalizado.
  // Se guarda por id, así sobrevive a cambios de búsqueda/categoría.
  const [sel, setSel] = useState(() => new Set());
  const res = useLoad(() => api.products({ limit: 100, include_inactive: "false" }), MOCK, [nonce]);
  const cats = useLoad(() => api.categories({ limit: 100 }), MOCK_CATS, []);
  // Solicitudes de cambio de precio pendientes de aprobación (Telegram).
  const pend = useLoad(() => (usingMock ? Promise.resolve({ items: [] }) : api.priceApprovals("pendiente")), { items: [] }, [nonce]);

  const productos = res.data?.items || [];
  const categorias = cats.data?.items || cats.data?.categories || [];
  const catName = useMemo(() => Object.fromEntries(categorias.map((c) => [c._id, c.name])), [categorias]);

  // Mapa product_id → id de solicitud pendiente (para chips y "Cancelar").
  const pendByProduct = useMemo(() => {
    const m = {};
    for (const a of pend.data?.items || []) for (const c of a.cambios || []) m[String(c.product_id)] = a._id;
    return m;
  }, [pend.data]);

  const filas = useMemo(() => productos.map((p) => {
    const cost = Number(p.cost_price || 0);
    const sell = sellPrice(p);
    const m = marginPct(cost, sell);
    const tiers = p.pricing?.tiers || [];
    return { id: p._id, name: p.name, cat: catName[p.category?.id] || p.category?.name || "Sin categoría", cost, sell, m, sugerido: precioPara(cost, objetivo), tiers };
  }).sort((a, b) => (a.m == null ? 999 : a.m) - (b.m == null ? 999 : b.m)), [productos, catName, objetivo]);

  // Solicita aprobación del cambio de precio (NO lo aplica). El precio se queda
  // como está hasta que un aprobador toque "Aceptar" en el grupo de Telegram.
  const fijarPrecio = async (f) => {
    if (usingMock) { alert("Conecta el backend para cambiar precios."); return; }
    const tiers = buildTiers(f);
    if (!tiers) return;
    if (pendByProduct[f.id]) { alert("Ya hay una solicitud pendiente para este producto."); return; }
    if (!window.confirm(`Solicitar aprobación de "${f.name}" a margen ${objetivo}% → ${clp(f.sugerido)}?\nSe enviará una alerta al grupo de Telegram; el precio no cambia hasta que la aprueben.`)) return;
    try {
      setFijando(f.id);
      await api.solicitarCambioPrecio([{ product_id: f.id, tiers_propuestos: tiers }], `Margen objetivo ${objetivo}%`);
      setNonce((n) => n + 1);
    } catch (e) { alert("No se pudo enviar la solicitud: " + e.message); }
    finally { setFijando(null); }
  };

  // Solicitud por lote: manda UNA sola alerta al grupo con todos los productos.
  // Solo incluye los "fijables" que no tengan ya una solicitud pendiente.
  const fijarMuchos = async (lista, etiqueta) => {
    if (usingMock) { alert("Conecta el backend para cambiar precios."); return false; }
    const objetivos = lista.filter(esFijable).filter((f) => !pendByProduct[f.id]);
    if (!objetivos.length) { alert(`No hay productos fijables (con costo y precio simple) sin solicitud pendiente en ${etiqueta}.`); return false; }
    if (!window.confirm(`Solicitar aprobación de ${objetivos.length} producto(s) de ${etiqueta} a margen ${objetivo}%?\nSe enviará UNA alerta al grupo de Telegram; los precios no cambian hasta que la aprueben.`)) return false;
    setBulkBusy(true);
    try {
      const items = objetivos.map((f) => ({ product_id: f.id, tiers_propuestos: buildTiers(f) })).filter((x) => x.tiers_propuestos);
      await api.solicitarCambioPrecio(items, `Margen objetivo ${objetivo}% · ${etiqueta}`);
      alert(`Solicitud enviada al grupo de Telegram: ${items.length} producto(s). Esperando aprobación.`);
      setNonce((n) => n + 1);
      return true;
    } catch (e) { alert("No se pudo enviar la solicitud: " + e.message); return false; }
    finally { setBulkBusy(false); }
  };

  // Cancela una solicitud pendiente (la puede cancelar quien la pidió o un gerente).
  const cancelarSolicitud = async (approvalId) => {
    if (!window.confirm("¿Cancelar esta solicitud pendiente?")) return;
    try { await api.cancelPriceApproval(approvalId); setNonce((n) => n + 1); }
    catch (e) { alert("No se pudo cancelar: " + e.message); }
  };

  // Fijar SOLO los seleccionados uno a uno; al terminar, limpia la selección.
  const fijarSeleccion = async () => {
    const hecho = await fijarMuchos(seleccionadas, `tu selección (${seleccionadas.length})`);
    if (hecho) setSel(new Set());
  };

  const conCosto = filas.filter((f) => f.m != null);
  const margenProm = conCosto.length ? Math.round(conCosto.reduce((a, f) => a + f.m, 0) / conCosto.length) : 0;
  const bajoObjetivo = conCosto.filter((f) => f.m < objetivo).length;
  const sinCosto = filas.length - conCosto.length;

  // Agrupación/búsqueda: categorías disponibles y filas visibles según filtro.
  const catOptions = useMemo(() => Array.from(new Set(filas.map((f) => f.cat))).sort((a, b) => a.localeCompare(b)), [filas]);
  const filasFiltradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return filas.filter((f) => (catFiltro === "all" || f.cat === catFiltro) && (!needle || f.name.toLowerCase().includes(needle)));
  }, [filas, q, catFiltro]);
  const fijablesFiltrados = filasFiltradas.filter(esFijable).length;

  // Selección personalizada: solo cuentan los productos fijables (con costo y
  // precio simple). La selección cruza filtros: puedes marcar 2 de Abarrotes,
  // buscar otro y sumarlo.
  const seleccionadas = filas.filter((f) => sel.has(f.id) && esFijable(f));
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visiblesFijables = filasFiltradas.filter(esFijable);
  const todasVisiblesMarcadas = visiblesFijables.length > 0 && visiblesFijables.every((f) => sel.has(f.id));
  const toggleTodasVisibles = () => setSel((s) => {
    const n = new Set(s);
    if (todasVisiblesMarcadas) visiblesFijables.forEach((f) => n.delete(f.id));
    else visiblesFijables.forEach((f) => n.add(f.id));
    return n;
  });

  // Rentabilidad por categoría (margen promedio).
  const porCat = useMemo(() => {
    const g = {};
    for (const f of conCosto) { (g[f.cat] = g[f.cat] || []).push(f.m); }
    return Object.entries(g).map(([cat, ms]) => ({ cat, margen: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length), n: ms.length }))
      .sort((a, b) => a.margen - b.margen);
  }, [conCosto]);

  const calc = Number(calcCosto) > 0 ? {
    precio: precioPara(Number(calcCosto), objetivo),
    markup: Math.round(((precioPara(Number(calcCosto), objetivo) - Number(calcCosto)) / Number(calcCosto)) * 100),
  } : null;

  return (
    <div>
      {/* KPIs + objetivo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13.5, fontWeight: 600 }}>Margen objetivo:</label>
        <input type="range" min="5" max="60" value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value))} style={{ width: 180 }} />
        <span style={{ fontWeight: 800, color: "var(--magenta)", fontSize: 18 }}>{objetivo}%</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <Kpi label="Margen promedio" value={`${margenProm}%`} color={colorMargen(margenProm, objetivo)} />
        <Kpi label={`Bajo el objetivo (${objetivo}%)`} value={bajoObjetivo} color={bajoObjetivo ? "var(--warn)" : "var(--ok)"} />
        <Kpi label="Sin costo cargado" value={sinCosto} color={sinCosto ? "var(--danger)" : "var(--ok)"} />
        <Kpi label="Productos" value={res.data?.pagination?.total ?? filas.length} />
      </div>

      {sinCosto > conCosto.length ? (
        <div className="card" style={{ padding: "10px 14px", marginBottom: 14, background: "#fff7e6", color: "#92400e", fontSize: 13 }}>
          Hay <b>{sinCosto}</b> productos sin costo cargado (de {filas.length}). Carga el <b>costo de compra</b> en <b>Productos</b> para ver su margen y precio sugerido.
        </div>
      ) : null}

      {/* Buscar producto · agrupar por categoría · fijar el margen en grupo */}
      <div className="card" style={{ padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto por nombre…"
          style={{ flex: "1 1 220px", minWidth: 180, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13.5, boxSizing: "border-box" }}
        />
        <select
          value={catFiltro}
          onChange={(e) => setCatFiltro(e.target.value)}
          title="Agrupar por categoría"
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13.5, background: "#fff", cursor: "pointer" }}
        >
          <option value="all">Todas las categorías</option>
          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{filasFiltradas.length} de {filas.length}</span>
        {(q || catFiltro !== "all") ? (
          <button onClick={() => { setQ(""); setCatFiltro("all"); }}
            style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--muted)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Limpiar</button>
        ) : null}
        {seleccionadas.length > 0 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f9f0f7", border: "1px solid #e9cfe3", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--magenta-d)" }}>
            {seleccionadas.length} seleccionado{seleccionadas.length === 1 ? "" : "s"}
            <button onClick={() => setSel(new Set())} title="Quitar la selección"
              style={{ border: "none", background: "none", color: "var(--muted)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>×</button>
          </span>
        ) : null}
        <button
          onClick={() => (seleccionadas.length > 0
            ? fijarSeleccion()
            : fijarMuchos(filasFiltradas, catFiltro === "all" ? (q ? "la búsqueda actual" : "todo el catálogo") : `la categoría ${catFiltro}`))}
          disabled={bulkBusy || (seleccionadas.length === 0 && !fijablesFiltrados)}
          title={seleccionadas.length > 0 ? "Solicita aprobación SOLO de los productos que marcaste (una alerta al grupo)" : "Solicita aprobación del precio de todos los productos filtrados (una alerta al grupo)"}
          style={{ marginLeft: "auto", border: "none", background: (seleccionadas.length || fijablesFiltrados) && !bulkBusy ? "var(--magenta-d)" : "var(--border-soft)", color: (seleccionadas.length || fijablesFiltrados) && !bulkBusy ? "#fff" : "var(--muted)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: (seleccionadas.length || fijablesFiltrados) && !bulkBusy ? "pointer" : "default" }}
        >
          {bulkBusy ? "Enviando…" : seleccionadas.length > 0 ? `Solicitar ${seleccionadas.length} seleccionado${seleccionadas.length === 1 ? "" : "s"} al ${objetivo}%` : `Solicitar ${fijablesFiltrados} al ${objetivo}%`}
        </button>
      </div>

      {/* 520px de mínimo, no 340: la tabla de márgenes tiene 6 columnas y con
          340 entraban dos tarjetas por fila, dejándole ~470px. La tabla se
          comprimía por debajo de su ancho natural y el texto de las celdas se
          encimaba con los botones. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 16, marginBottom: 18 }}>
        {/* Tabla de márgenes */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6", borderBottom: "1px solid var(--border-soft)" }}>Margen por producto <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>· peor margen primero</span></div>
          <div style={{ maxHeight: 460, overflow: "auto" }}>
            {/* minWidth para que la tabla nunca se comprima por debajo de lo que
                necesita: si no cabe, el contenedor scrollea en vez de encimar
                el contenido de las celdas. */}
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                  <th style={{ padding: "8px 6px 8px 12px", width: 30 }}>
                    <input
                      type="checkbox"
                      checked={todasVisiblesMarcadas}
                      onChange={toggleTodasVisibles}
                      disabled={!visiblesFijables.length}
                      title="Marcar / desmarcar todos los visibles"
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ padding: "8px 12px" }}>Producto</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Costo</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Precio</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Margen</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Sug. {objetivo}%</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f) => (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--border-soft)", background: sel.has(f.id) ? "#fdf4fa" : undefined }}>
                    <td style={{ padding: "8px 6px 8px 12px" }}>
                      <input
                        type="checkbox"
                        checked={sel.has(f.id)}
                        onChange={() => toggleSel(f.id)}
                        disabled={!esFijable(f)}
                        title={esFijable(f) ? "Incluir en la selección para fijar" : "Sin costo cargado o precio con más de 2 tramos: no se puede fijar en grupo"}
                        style={{ cursor: esFijable(f) ? "pointer" : "not-allowed" }}
                      />
                    </td>
                    <td style={{ padding: "8px 12px" }}>{f.name}<div style={{ fontSize: 11, color: "var(--muted)" }}>{f.cat}</div></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{f.cost > 0 ? clp(f.cost) : <span style={{ color: "var(--muted)", fontSize: 11.5 }}>Sin costo</span>}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{clp(f.sell)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: colorMargen(f.m, objetivo) }}>{f.m == null ? <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11.5 }}>N/D</span> : `${f.m}%`}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--magenta)", whiteSpace: "nowrap" }}>
                      {f.cost > 0 ? (
                        <>
                          {clp(f.sugerido)}
                          {pendByProduct[f.id] ? (
                            <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <span title="Esperando aprobación en el grupo de Telegram" style={{ background: "#fff7e6", color: "#92400e", border: "1px solid #f5d9a8", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>⏳ Pendiente</span>
                              <button
                                onClick={() => cancelarSolicitud(pendByProduct[f.id])}
                                title="Cancelar la solicitud pendiente"
                                style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--muted)", borderRadius: 7, padding: "2px 7px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : f.tiers.length > 0 && f.tiers.length <= 2 ? (
                            <button
                              onClick={() => fijarPrecio(f)}
                              disabled={fijando === f.id}
                              title={`Solicitar aprobación del precio para margen ${objetivo}% (se envía al grupo de Telegram)`}
                              style={{ marginLeft: 8, border: "1px solid var(--magenta)", background: "#fff", color: "var(--magenta)", borderRadius: 7, padding: "2px 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                            >
                              {fijando === f.id ? "…" : "Solicitar"}
                            </button>
                          ) : null}
                        </>
                      ) : <span style={{ color: "var(--muted)", fontSize: 11.5 }}>N/D</span>}
                    </td>
                  </tr>
                ))}
                {!filasFiltradas.length ? (
                  <tr><td colSpan={6} style={{ padding: "24px 14px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    {res.loading ? "Cargando productos…" : filas.length ? "Ningún producto coincide con el filtro." : "No hay productos activos para analizar."}
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculadora + rentabilidad por categoría */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Calculadora de precio</div>
            <label style={{ fontSize: 12.5, color: "var(--muted)" }}>Costo de compra (CLP)</label>
            <input
              type="number" value={calcCosto} onChange={(e) => setCalcCosto(e.target.value)} placeholder="ej: 1200"
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", margin: "4px 0 10px", fontSize: 15, boxSizing: "border-box" }}
            />
            {calc ? (
              <div style={{ background: "#f9f0f7", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Precio para margen {objetivo}%</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--magenta)" }}>{clp(calc.precio)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Ganancia {clp(calc.precio - Number(calcCosto))} · markup {calc.markup}%</div>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Ingresa el costo para ver el precio sugerido.</div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6", borderBottom: "1px solid var(--border-soft)" }}>Rentabilidad por categoría</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {porCat.map((c) => {
                  const catFilas = filas.filter((f) => f.cat === c.cat);
                  const nf = catFilas.filter(esFijable).length;
                  return (
                    <tr key={c.cat} style={{ borderTop: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "8px 14px" }}>{c.cat} <span style={{ color: "var(--muted)", fontSize: 11 }}>({c.n})</span></td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, color: colorMargen(c.margen, objetivo) }}>{c.margen}%</td>
                      <td style={{ padding: "6px 14px", textAlign: "right" }}>
                        <button onClick={() => fijarMuchos(catFilas, `la categoría ${c.cat}`)} disabled={bulkBusy || !nf}
                          title={`Solicitar aprobación de los ${nf} producto(s) fijables de ${c.cat} al margen ${objetivo}%`}
                          style={{ border: "1px solid var(--magenta)", background: "#fff", color: nf ? "var(--magenta)" : "var(--muted)", borderRadius: 7, padding: "2px 10px", fontSize: 11.5, fontWeight: 700, cursor: nf && !bulkBusy ? "pointer" : "default", opacity: nf ? 1 : 0.5 }}>
                          Solicitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!porCat.length ? <tr><td colSpan={3} style={{ padding: "18px 14px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Carga costos de compra para ver la rentabilidad por categoría.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Define el margen objetivo y usa <b>Solicitar</b> para pedir el cambio de precio. <b>El precio no cambia de inmediato</b>: se envía una alerta al <b>grupo de Telegram</b> y un aprobador debe tocar <b>Aceptar</b>. Mientras espera, la fila muestra <b>⏳ Pendiente</b> y puedes <b>Cancelar</b>. Puedes <b>buscar</b>, <b>filtrar por categoría</b>, <b>marcar uno a uno</b> o <b>solicitar todo un grupo</b> en una sola alerta. El costo solo es visible para administración.
      </div>
    </div>
  );
}

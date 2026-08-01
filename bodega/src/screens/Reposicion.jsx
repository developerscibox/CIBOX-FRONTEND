import { useMemo, useState } from "react";
import { api, useLoad, usingMock, setRecepcionDraft } from "../api.js";
import { imprimirListaCompra } from "../print.js";
import { t } from "../theme.js";

// Reposición — productos bajo su mínimo (GET /inventory/reorder). El operador/
// gerente revisa qué falta, ajusta cajas y arma la compra: imprime la lista o la
// envía a Recepción (borrador one-shot en sessionStorage → Recepción la siembra).

// Datos demo de respaldo (solo sin backend).
const MOCK = {
  count: 3,
  items: [
    { _id: "r1", name: "Coca-Cola 1.5L", sku: "CC15", barcode: "7790001",
      stock: 0, min_stock: 24, target_stock: 96, suggested_qty: 96, box_qty: 6, suggested_boxes: 16,
      urgency: "critico", vendor: { id: "v1", name: "Embonor" } },
    { _id: "r2", name: "Arroz grado 1 · 1kg", sku: "AR1", barcode: "7790002",
      stock: 8, min_stock: 20, target_stock: 0, suggested_qty: 32, box_qty: 10, suggested_boxes: 4,
      urgency: "alto", vendor: { id: "v2", name: "Tucapel" } },
    { _id: "r3", name: "Detergente 3kg", sku: "DET3", barcode: "7790003",
      stock: 14, min_stock: 18, target_stock: 36, suggested_qty: 22, box_qty: 4, suggested_boxes: 6,
      urgency: "medio", vendor: { id: "v3", name: "Unilever" } },
  ],
};

// Badge de urgencia (crítico rojo / alto naranja / medio amarillo).
const URGENCIA = {
  critico: { label: "Crítico", bg: "#fee2e2", text: "#b91c1c" },
  alto:    { label: "Alto",    bg: "#ffedd5", text: "#9a3412" },
  medio:   { label: "Medio",   bg: "#fef3c7", text: "#92400e" },
};
const URG_RANK = { critico: 0, alto: 1, medio: 2 };

export default function Reposicion({ onNav }) {
  const { data, loading, error } = useLoad(() => api.reorderList(), MOCK, []);
  const src = usingMock ? MOCK : (data || { items: [] });
  const items = useMemo(
    () => [...(src.items || [])].sort(
      (a, b) => (URG_RANK[a.urgency] ?? 9) - (URG_RANK[b.urgency] ?? 9),
    ),
    [src],
  );

  // Selección + cajas editables por fila (default suggested_boxes).
  const [sel, setSel] = useState({});       // { [_id]: true }
  const [cajas, setCajas] = useState({});    // { [_id]: number }

  const cajasDe = (p) => {
    const v = cajas[p._id];
    return v != null ? v : (p.suggested_boxes || 0);
  };
  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
  const setCajasFila = (id, val) => {
    const n = Math.max(0, Math.floor(Number(val) || 0));
    setCajas((c) => ({ ...c, [id]: n }));
    // Editar cajas implica intención de pedir: auto-selecciona la fila.
    setSel((s) => (s[id] ? s : { ...s, [id]: true }));
  };

  // Selección normalizada a la forma que consumen print/draft.
  const seleccion = useMemo(
    () => items
      .filter((p) => sel[p._id])
      .map((p) => ({
        product_id: p._id,
        barcode: p.barcode,
        name: p.name,
        box_qty: p.box_qty,
        cajas: cajasDe(p),
        vendor: p.vendor,
        location: p.location,
      }))
      .filter((p) => p.cajas > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, sel, cajas],
  );
  const haySeleccion = seleccion.length > 0;

  // KPIs.
  const bajoMin = items.length;
  const criticos = items.filter((p) => (p.stock ?? 0) <= 0).length;
  const proveedores = new Set(
    items.map((p) => p.vendor?.id || p.vendor?.name).filter(Boolean),
  ).size;

  const enviarARecepcion = () => {
    setRecepcionDraft(seleccion);
    onNav?.("recepcion");
  };

  if (loading) return <div className="card" style={{ padding: 24, color: t.muted }}>Cargando reposición…</div>;

  const kpis = [
    { ic: "🛟", bg: "#fde7f1", v: bajoMin, l: "Productos bajo mínimo" },
    { ic: "🚨", bg: "#fee2e2", v: criticos, l: "Críticos (stock 0)" },
    { ic: "🚚", bg: "#e0f2fe", v: proveedores, l: "Proveedores" },
  ];

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>Reposición · stock mínimo</h2>
      <div style={{ color: t.muted, fontSize: 13, marginBottom: 16 }}>
        Productos por debajo de su punto de reorden. Selecciona, ajusta las cajas y arma la compra.
      </div>

      {error ? (
        <div className="card" style={{ padding: 14, marginBottom: 14, background: "#fef3c7", color: "#92400e", fontSize: 13 }}>
          No se pudo actualizar: {error}
        </div>
      ) : null}

      <div className="kpis">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="ic" style={{ background: k.bg }}>{k.ic}</div>
            <div className="v">{k.v}</div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </div>

      {!items.length ? (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Todo abastecido</div>
          <div style={{ color: t.muted, fontSize: 13 }}>Ningún producto está por debajo de su stock mínimo.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr style={{ background: "#f3eef6", textAlign: "left" }}>
                  <th style={{ ...th, width: 36 }}></th>
                  <th style={th}>Producto</th>
                  <th style={{ ...th, textAlign: "center" }}>Stock</th>
                  <th style={{ ...th, textAlign: "center" }}>Mínimo</th>
                  <th style={th}>Sugerido</th>
                  <th style={{ ...th, textAlign: "center" }}>Cajas a pedir</th>
                  <th style={th}>Proveedor</th>
                  <th style={{ ...th, textAlign: "center" }}>Urgencia</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const u = URGENCIA[p.urgency] || URGENCIA.medio;
                  const checked = !!sel[p._id];
                  return (
                    <tr key={p._id} style={{ borderTop: "1px solid #ece4f0", background: checked ? "#fdf2f8" : undefined }}>
                      <td style={{ ...td, textAlign: "center" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(p._id)}
                          style={{ width: 17, height: 17, cursor: "pointer" }} />
                      </td>
                      <td style={td}>
                        <b style={{ color: t.text }}>{p.name}</b>
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, color: (p.stock ?? 0) <= 0 ? t.danger : t.text }}>
                        {p.stock ?? 0}
                      </td>
                      <td style={{ ...td, textAlign: "center", color: t.muted }}>{p.min_stock}</td>
                      <td style={td}>
                        <b>{p.suggested_boxes}</b> {p.suggested_boxes === 1 ? "caja" : "cajas"}
                        <span style={{ color: t.muted }}> ({p.suggested_qty} u)</span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <input type="number" min={0} value={cajasDe(p)}
                          onChange={(e) => setCajasFila(p._id, e.target.value)}
                          style={{ width: 62, padding: "5px 8px", borderRadius: 8, border: `1px solid ${t.border}`, textAlign: "center", fontWeight: 700 }} />
                      </td>
                      <td style={{ ...td, fontSize: 13 }}>
                        {p.vendor?.name || <span style={{ color: t.muted }}>Sin proveedor</span>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span className="badge" style={{ background: u.bg, color: u.text, fontWeight: 700 }}>{u.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: t.muted, fontSize: 13, marginRight: "auto" }}>
              {seleccion.length} seleccionado{seleccion.length === 1 ? "" : "s"}
            </span>
            <button className="btn" disabled={!haySeleccion}
              onClick={() => imprimirListaCompra(seleccion)}>
              Imprimir lista de compra
            </button>
            <button className="btn btn-primary" disabled={!haySeleccion}
              onClick={enviarARecepcion}>
              Enviar a Recepción
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const th = { padding: "10px 14px", fontWeight: 700, color: "#5b4a55" };
const td = { padding: "10px 14px" };

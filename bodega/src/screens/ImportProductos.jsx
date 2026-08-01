import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api, usingMock } from "../api.js";
import { Tabla, Skel } from "../components/Ui.jsx";
import { clp } from "../theme.js";

import { brand } from "../brand.js";
// Importador masivo de productos desde Excel/CSV (POST /products/import-bulk).
// 3 pasos: (1) plantilla + archivo → (2) preview con validación local + dry_run
// del backend → (3) importación real con reporte por fila. Máx 500 filas.

const MAX_FILAS = 500;
// Espejo de SALE_UNITS del backend (validators/productValidators.js).
const SALE_UNITS = ["unidad", "kg", "g", "l", "ml", "pack", "caja", "bandeja", "docena"];
const CAMPOS = [
  "sku", "barcode", "name", "brand", "category_name", "subcategory_name",
  "sale_unit", "content_value", "content_unit",
  "price", "iva_afecto", "pack_size", "pack_price",
  "cost_price", "stock_inicial", "min_stock", "target_stock", "description",
];
const NUMERICOS = new Set(["price", "pack_size", "pack_price", "content_value", "cost_price", "stock_inicial", "min_stock", "target_stock"]);

const EJEMPLOS = [
  { sku: "CIB-001", barcode: "7801000000017", name: "Aceite vegetal 900ml", brand: "Los Silos", category_name: "Abarrotes", subcategory_name: "Aceites", sale_unit: "unidad", content_value: 900, content_unit: "ml", price: 1449, iva_afecto: "si", pack_size: 12, pack_price: 15480, cost_price: 980, stock_inicial: 120, min_stock: 24, target_stock: 48, description: "Aceite vegetal maravilla 900ml" },
  { sku: "", barcode: "7801000000024", name: "Spaghetti N°5 400g", brand: "Lucchetti", category_name: "Abarrotes", subcategory_name: "Pastas", sale_unit: "unidad", content_value: 400, content_unit: "g", price: 890, iva_afecto: "si", pack_size: "", pack_price: "", cost_price: 610, stock_inicial: 200, min_stock: 40, target_stock: 80, description: "" },
];

// Normaliza una cabecera: minúsculas, sin tildes, espacios/guiones → "_".
const normHeader = (h) =>
  String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s.-]+/g, "_");

// Convierte una fila cruda de sheet_to_json a la forma del contrato: solo
// campos conocidos, numéricos como Number (NaN se detecta en la validación).
function parseFila(r) {
  const row = {};
  for (const [k, v] of Object.entries(r)) {
    const nk = normHeader(k);
    if (!CAMPOS.includes(nk)) continue;
    if (v === "" || v == null) continue;
    if (NUMERICOS.has(nk)) {
      row[nk] = Number(String(v).replace(/\$/g, "").replace(/\s/g, "").replace(",", "."));
    } else {
      const s = String(v).trim();
      if (s) row[nk] = s;
    }
  }
  return row;
}

// Validación local previa al dry_run: name obligatorio, numéricos válidos,
// price > 0 si la fila probablemente crea un producto (sin sku ni barcode).
function validarLocal(row) {
  if (!row.name || String(row.name).trim().length < 2) return "Falta el nombre (columna name, mín. 2 caracteres).";
  for (const f of NUMERICOS) {
    if (f in row && !Number.isFinite(row[f])) return `Valor no numérico en la columna "${f}".`;
  }
  if ("price" in row && !(row.price > 0)) return "price debe ser mayor que 0.";
  if ("sale_unit" in row && !SALE_UNITS.includes(String(row.sale_unit).toLowerCase())) {
    return `sale_unit debe ser uno de: ${SALE_UNITS.join(", ")}.`;
  }
  if ("pack_size" in row && row.pack_size > 1 && "pack_price" in row && row.pack_price > 0 && "price" in row) {
    if (row.pack_price >= row.price * row.pack_size) return "El pack debe costar menos que las unidades sueltas.";
  }
  if (!row.sku && !row.barcode && !(row.price > 0)) return "Fila sin sku ni barcode (se crearía): requiere price mayor que 0.";
  return "";
}

const BADGE = {
  crear: { background: "#dcfce7", color: "#166534" },
  actualizar: { background: "#fef3c7", color: "#92400e" },
  error: { background: "#fee2e2", color: "#b91c1c" },
};
const ACCION_LABEL = { crear: "Crear", actualizar: "Actualizar", error: "Error" };

function AccionBadge({ accion }) {
  return (
    <span className="badge" style={{ ...(BADGE[accion] || { background: "#f3f4f6", color: "var(--muted)" }), whiteSpace: "nowrap" }}>
      {ACCION_LABEL[accion] || accion || "—"}
    </span>
  );
}

export default function ImportProductos({ onClose }) {
  const fileRef = useRef(null);
  // fase: inicio (plantilla + archivo) | preview (dry_run) | resultado (import real)
  const [fase, setFase] = useState("inicio");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState(""); // archivo con más de 500 filas
  // items: [{ fila, row, localError, dry:{accion,detalle}|null, final:{accion,detalle}|null }]
  const [items, setItems] = useState(null);
  const [resumen, setResumen] = useState(null); // { total, creados, actualizados, errores }

  const aCrear = items ? items.filter((i) => i.dry?.accion === "crear").length : 0;
  const aActualizar = items ? items.filter((i) => i.dry?.accion === "actualizar").length : 0;
  const conError = items ? items.filter((i) => i.localError || i.dry?.accion === "error").length : 0;
  const importables = items ? items.filter((i) => !i.localError && (i.dry?.accion === "crear" || i.dry?.accion === "actualizar")) : [];

  function descargarPlantilla() {
    const aoa = [CAMPOS, ...EJEMPLOS.map((e) => CAMPOS.map((c) => e[c] ?? ""))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Productos");
    XLSX.writeFile(wb, `Plantilla-Productos-${brand.name}.xlsx`);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-subir el mismo archivo
    if (!file) return;
    setErr("");
    setAviso("");
    setItems(null);
    setResumen(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
      let parsed = raw.map(parseFila).filter((r) => Object.keys(r).length > 0);
      if (!parsed.length) {
        setErr("El archivo no tiene filas con columnas reconocibles. Descarga la plantilla y úsala como base.");
        setBusy(false);
        return;
      }
      if (parsed.length > MAX_FILAS) {
        setAviso(`El archivo trae ${parsed.length} filas y el máximo por importación es ${MAX_FILAS}. Se usarán solo las primeras ${MAX_FILAS}; el resto se ignora (puedes importarlas en otra pasada).`);
        parsed = parsed.slice(0, MAX_FILAS);
      }
      const list = parsed.map((row, i) => ({ fila: i + 1, row, localError: validarLocal(row), dry: null, final: null }));
      await dryRun(list);
    } catch (e2) {
      setErr(`No se pudo leer el archivo: ${e2.message || e2}`);
      setBusy(false);
    }
  }

  // dry_run contra el backend para saber la acción prevista por fila.
  async function dryRun(list) {
    const validos = list.filter((i) => !i.localError);
    try {
      if (validos.length) {
        if (usingMock) {
          validos.forEach((i) => { i.dry = { accion: "crear", detalle: "demo (sin backend)" }; });
        } else {
          const res = await api.importProducts(validos.map((i) => i.row), true);
          const rs = res?.resultados || [];
          validos.forEach((i, j) => {
            i.dry = rs.find((r) => Number(r.fila) === j + 1) || rs[j] || { accion: "error", detalle: "El backend no devolvió resultado para esta fila." };
          });
        }
      }
    } catch (e2) {
      setErr(`No se pudo validar contra el backend (dry run): ${e2.message}. Se muestra solo la validación local.`);
    } finally {
      setItems(list);
      setFase("preview");
      setBusy(false);
    }
  }

  async function importar() {
    if (!importables.length || busy) return;
    setBusy(true);
    setErr("");
    try {
      let rs, sum;
      if (usingMock) {
        rs = importables.map((i, j) => ({ fila: j + 1, accion: i.dry.accion, detalle: "demo (no persistido)" }));
        sum = { total: importables.length, creados: aCrear, actualizados: aActualizar, errores: 0 };
      } else {
        const res = await api.importProducts(importables.map((i) => i.row), false);
        rs = res?.resultados || [];
        sum = { total: res?.total ?? importables.length, creados: res?.creados ?? 0, actualizados: res?.actualizados ?? 0, errores: res?.errores ?? 0 };
      }
      importables.forEach((i, j) => {
        i.final = rs.find((r) => Number(r.fila) === j + 1) || rs[j] || { accion: "error", detalle: "Sin resultado del backend para esta fila." };
      });
      setItems((prev) => [...prev]);
      setResumen(sum);
      setFase("resultado");
    } catch (e2) {
      setErr(`Falló la importación: ${e2.message}. No se aplicó ningún cambio de esta pasada, corrige y reintenta.`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFase("inicio");
    setItems(null);
    setResumen(null);
    setErr("");
    setAviso("");
  }

  const hintStyle = { fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <div className="card" style={{ width: 1020, maxWidth: "100%", marginBottom: 0, maxHeight: "94vh", overflowY: "auto" }}>
        <div className="card-h">
          <h2>Importar productos · CSV / Excel</h2>
          <div className="spacer" />
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={onFile} />

        {err ? <div style={{ padding: "10px 4px 0", color: "var(--danger)", fontSize: 13 }}>{err}</div> : null}
        {aviso ? <div style={{ padding: "10px 4px 0", color: "var(--warn)", fontSize: 13 }}>{aviso}</div> : null}

        {busy && !items ? (
          <div style={{ padding: "14px 4px", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Analizando archivo y validando contra el backend…</div>
            <Skel h={28} /><Skel h={28} /><Skel h={28} />
          </div>
        ) : null}

        {/* ── Paso 1: plantilla + archivo ─────────────────────────────────── */}
        {fase === "inicio" && !busy ? (
          <div style={{ padding: "10px 4px 6px" }}>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.55 }}>
              Sube un Excel (.xlsx / .xls) o CSV con hasta {MAX_FILAS} productos. Si la fila trae un <b>sku</b> o
              <b> barcode</b> que ya existe en el catálogo, ese producto se <b>actualiza</b>; si no, se <b>crea</b>.
              Antes de importar verás una vista previa con la acción prevista para cada fila.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={descargarPlantilla}>Descargar plantilla</button>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Subir archivo…</button>
            </div>
            <div style={hintStyle}>
              Columnas aceptadas: {CAMPOS.join(", ")}. Solo <b>name</b> es obligatoria (con sku/barcode para actualizar,
              o price para crear). Las cabeceras toleran mayúsculas, tildes y espacios.
            </div>
          </div>
        ) : null}

        {/* ── Paso 2: preview con dry_run ─────────────────────────────────── */}
        {fase === "preview" && items ? (
          <div style={{ padding: "10px 4px 6px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span className="badge" style={BADGE.crear}>{aCrear} a crear</span>
              <span className="badge" style={BADGE.actualizar}>{aActualizar} a actualizar</span>
              <span className="badge" style={BADGE.error}>{conError} con error</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>· {items.length} filas leídas — nada se ha guardado todavía.</span>
            </div>
            <Tabla
              head={["#", "SKU", "Código", "Nombre", "Precio", "Acción", "Detalle"]}
              aligns={["r", "l", "l", "l", "r", "l", "l"]}
              rows={items.map((i) => [
                i.fila,
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{i.row.sku || "—"}</span>,
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{i.row.barcode || "—"}</span>,
                i.row.name || "—",
                Number.isFinite(i.row.price) ? clp(i.row.price) : "—",
                <AccionBadge accion={i.localError ? "error" : i.dry?.accion} />,
                i.localError
                  ? <span style={{ color: "var(--danger)" }}>{i.localError}</span>
                  : i.dry?.accion === "error"
                    ? <span style={{ color: "var(--danger)" }}>{i.dry?.detalle || "Error"}</span>
                    : <span style={{ color: "var(--muted)" }}>{i.dry?.detalle || "—"}</span>,
              ])}
              empty="Sin filas."
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
              <button className="btn btn-primary" disabled={!importables.length || busy} onClick={importar}>
                {busy ? "Importando…" : `Importar ${importables.length} producto${importables.length === 1 ? "" : "s"}`}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>Elegir otro archivo</button>
              <button className="btn btn-ghost" disabled={busy} onClick={reset}>Volver al paso 1</button>
              {conError ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Las filas con error se omiten de la importación.</span> : null}
            </div>
          </div>
        ) : null}

        {/* ── Paso 3: resultado final ─────────────────────────────────────── */}
        {fase === "resultado" && items ? (
          <div style={{ padding: "10px 4px 6px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span className="badge" style={BADGE.crear}>✓ {resumen?.creados ?? 0} creados</span>
              <span className="badge" style={BADGE.actualizar}>↻ {resumen?.actualizados ?? 0} actualizados</span>
              <span className="badge" style={BADGE.error}>✕ {resumen?.errores ?? 0} con error</span>
              {usingMock ? <span style={{ fontSize: 12, color: "var(--muted)" }}>· modo demostración, nada se persistió</span> : null}
            </div>
            <Tabla
              head={["#", "SKU", "Código", "Nombre", "Resultado", "Detalle"]}
              aligns={["r", "l", "l", "l", "l", "l"]}
              rows={importables.map((i) => [
                i.fila,
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{i.final?.sku || i.row.sku || "—"}</span>,
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{i.final?.barcode || i.row.barcode || "—"}</span>,
                i.final?.name || i.row.name || "—",
                <AccionBadge accion={i.final?.accion} />,
                i.final?.accion === "error"
                  ? <span style={{ color: "var(--danger)" }}>{i.final?.detalle || "Error"}</span>
                  : <span style={{ color: "var(--muted)" }}>{i.final?.detalle || "—"}</span>,
              ])}
              empty="No se importó ninguna fila."
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={onClose}>Volver a Productos</button>
              <button className="btn btn-ghost" onClick={reset}>Importar otro archivo</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

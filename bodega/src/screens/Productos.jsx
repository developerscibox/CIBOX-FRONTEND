import { useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { t, clp } from "../theme.js";
import BarcodeScanner from "../components/BarcodeScanner.jsx";
import FichaProducto from "./FichaProducto.jsx";
import ImportProductos from "./ImportProductos.jsx";

import { brand } from "../brand.js";
// Catálogo de ejemplo para el modo demostración (sin backend).
const MOCK_PRODUCTS = {
  items: [
    {
      _id: "p1", name: "Aceite vegetal 900ml", brand: "Los Silos",
      category: { id: "c1", name: "Abarrotes" }, stock: 120, is_active: true,
      barcode: "7801000001", sku: "B12-R01",
      pricing: { tiers: [
        { min_qty: 1, price: 1449, label: "Unidad" },
        { min_qty: 12, price: 1290, label: "Caja 12 un" },
      ] },
    },
    {
      _id: "p2", name: "Spaghetti N5 400g", brand: "Lucchetti",
      category: { id: "c1", name: "Abarrotes" }, stock: 0, is_active: false,
      barcode: "7801000002", sku: "B12-001",
      pricing: { tiers: [
        { min_qty: 1, price: 890, label: "Unidad" },
        { min_qty: 20, price: 790, label: "Caja 20 un" },
      ] },
    },
  ],
  pagination: { total: 2 },
};

const MOCK_CATEGORIES = {
  items: [
    { _id: "c1", name: "Abarrotes" },
    { _id: "c2", name: "Lácteos" },
    { _id: "c3", name: "Bebidas" },
  ],
};

// El tier "caja" es el de mayor min_qty (> 1). Devuelve null si solo hay unidad.
function boxTier(p) {
  const tiers = p?.pricing?.tiers || [];
  const boxes = tiers.filter((x) => (x.min_qty || 1) > 1);
  if (!boxes.length) return null;
  return boxes.reduce((a, b) => ((b.min_qty || 0) > (a.min_qty || 0) ? b : a));
}
function unitTier(p) {
  const tiers = p?.pricing?.tiers || [];
  return tiers.find((x) => (x.min_qty || 1) === 1) || tiers[0] || null;
}
// Precio total de la caja = precio unit. mayorista × unidades por caja.
function boxPrice(p) {
  const b = boxTier(p);
  if (!b) return null;
  return Number(b.price || 0) * Number(b.min_qty || 0);
}
// Precio de venta POR UNIDAD al comprar la caja (= price del tier caja).
// Si no hay tier caja, cae al precio unitario.
function boxUnitSellPrice(p) {
  const b = boxTier(p);
  if (b) return Number(b.price || 0);
  const u = unitTier(p);
  return u ? Number(u.price || 0) : 0;
}
// Margen % sobre el precio por caja unitario. null si no hay costo cargado.
function marginPct(p) {
  const cost = Number(p?.cost_price || 0);
  const sell = boxUnitSellPrice(p);
  if (!(cost > 0) || !(sell > 0)) return null;
  return Math.round(((sell - cost) / sell) * 100);
}

// Separador de sección del formulario (agrupa los campos por tema).
function Sec({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", borderTop: "1px solid var(--border-soft)", paddingTop: 12, margin: "6px 2px 0" }}>
      {children}
    </div>
  );
}

const EMPTY_FORM = {
  id: null,
  name: "",
  category_id: "",
  imageUrl: "", // foto del producto (la que ve el cliente en la tienda)
  unitPrice: "",
  boxUnitPrice: "",
  unitsPerBox: "",
  stock: "0",
  minStock: "0",
  targetStock: "0",
  barcode: "",
  description: "",
  costPrice: "",
  expiryDate: "",
};

export default function Productos() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [nonce, setNonce] = useState(0);

  const [form, setForm] = useState(null); // null = panel cerrado
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [done, setDone] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const [dupWarn, setDupWarn] = useState(""); // aviso si el código ya es de otro producto
  const [fichaId, setFichaId] = useState(null); // producto con la ficha técnica abierta
  const [importOpen, setImportOpen] = useState(false); // importador masivo CSV/Excel
  const [upFoto, setUpFoto] = useState(false); // subiendo la foto del producto

  const params = {
    page: 1,
    limit: 100, // máximo permitido por el backend (listProductsSchema)
    search: search.trim(),
    include_inactive: showInactive ? "true" : undefined,
  };

  const res = useLoad(
    () => api.products(params),
    MOCK_PRODUCTS,
    [search, showInactive, nonce],
  );
  const cats = useLoad(() => api.categories({ limit: 100 }), MOCK_CATEGORIES, []);

  const products = res.data?.items || [];
  const categories = cats.data?.items || cats.data?.categories || [];

  const catById = useMemo(() => {
    const m = {};
    for (const c of categories) m[c._id] = c;
    return m;
  }, [categories]);

  const refresh = () => setNonce((n) => n + 1);

  function openNew() {
    setSaveErr("");
    setDone("");
    setDupWarn("");
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(p) {
    setSaveErr("");
    setDone("");
    setDupWarn("");
    const u = unitTier(p);
    const b = boxTier(p);
    setForm({
      id: p._id,
      name: p.name || "",
      category_id: p.category?.id || "",
      imageUrl: p.thumbnail || p.images?.[0] || "",
      unitPrice: String(u?.price ?? ""),
      boxUnitPrice: b ? String(b.price) : "",
      unitsPerBox: b ? String(b.min_qty) : "",
      stock: String(p.stock ?? 0),
      _origStock: Number(p.stock ?? 0),
      minStock: String(p.min_stock ?? 0),
      targetStock: String(p.target_stock ?? 0),
      barcode: p.barcode || "",
      description: p.description || "",
      costPrice: p.cost_price != null ? String(p.cost_price) : "",
      expiryDate: p.expiry_date ? String(p.expiry_date).slice(0, 10) : "",
    });
  }

  function closeForm() {
    setForm(null);
    setCamOpen(false);
    setDupWarn("");
  }

  function setF(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  // Sube la foto del producto (Cloudinary vía /uploads/image) y deja la URL en
  // el formulario; se persiste recién al Guardar (images + thumbnail).
  async function subirFoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setSaveErr("El archivo debe ser una imagen (JPG/PNG/WebP)."); return; }
    setSaveErr("");
    if (usingMock) { setF({ imageUrl: URL.createObjectURL(file) }); return; }
    setUpFoto(true);
    try {
      const up = await api.uploadImage(file);
      const raw = up?.url || up?.data?.url;
      if (!raw) throw new Error("La subida no devolvió URL");
      // El driver disk (dev) devuelve una ruta relativa (/uploads/…): se
      // absolutiza contra el origen del backend para que el preview, el
      // validador (.url) y la tienda reciban siempre una URL completa.
      const base = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "");
      const url = /^https?:\/\//i.test(raw) ? raw : new URL(raw, base).href;
      setF({ imageUrl: url });
    } catch (e2) {
      setSaveErr(`No se pudo subir la foto: ${e2.message}`);
    } finally {
      setUpFoto(false);
    }
  }

  // Escaneo del código (cámara): lo fija y avisa si ya pertenece a otro producto.
  async function onScanBarcode(code) {
    const c = String(code || "").trim();
    if (!c) return;
    setF({ barcode: c });
    setDupWarn("");
    setCamOpen(false);
    if (usingMock) return;
    try {
      const existing = await api.byBarcode(c);
      if (existing && (!form?.id || String(existing._id) !== String(form.id))) {
        setDupWarn(`Ojo: el código ${c} ya es de "${existing.name}". Si lo creas, quedará duplicado.`);
      }
    } catch {
      /* no existe en el catálogo → libre para crear */
    }
  }

  // Validación de negocio del formulario antes de armar el payload.
  function validate(f) {
    if (!f.barcode.trim()) return "El código de barras es obligatorio. Escanéalo o escríbelo.";
    if (!f.name.trim() || f.name.trim().length < 2) return "El nombre es obligatorio (mín. 2 caracteres).";
    if (!f.category_id) return "Selecciona una categoría.";
    const unit = Number(f.unitPrice);
    if (!Number.isFinite(unit) || unit <= 0) return "Ingresa un precio unitario válido.";
    const stock = Number(f.stock);
    if (!Number.isInteger(stock) || stock < 0) return "El stock inicial debe ser un entero ≥ 0.";
    const upb = Number(f.unitsPerBox);
    if (f.unitsPerBox !== "" && upb > 1) {
      const boxUnit = Number(f.boxUnitPrice);
      if (!Number.isInteger(upb) || upb < 2) return "Las unidades por caja deben ser un entero ≥ 2.";
      if (!Number.isFinite(boxUnit) || boxUnit <= 0) return "Ingresa el precio unitario por caja.";
      if (boxUnit >= unit) return "El precio por caja por unidad debe ser MENOR que el precio unitario.";
    }
    return "";
  }

  function buildTiers(f) {
    const unit = Number(f.unitPrice);
    const tiers = [{ min_qty: 1, price: unit, label: "Unidad" }];
    const upb = Number(f.unitsPerBox);
    if (f.unitsPerBox !== "" && upb > 1) {
      tiers.push({
        min_qty: upb,
        price: Number(f.boxUnitPrice),
        label: `Caja ${upb} un`,
      });
    }
    return tiers;
  }

  async function save(e) {
    e.preventDefault();
    const err = validate(form);
    if (err) {
      setSaveErr(err);
      return;
    }
    setBusy(true);
    setSaveErr("");
    setDone("");

    const cat = catById[form.category_id];
    const category = { id: form.category_id, name: cat?.name || "" };
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || `${form.name.trim()} — ${brand.name}.`,
      category,
      pricing: { tiers: buildTiers(form) },
      ...(form.id ? {} : { stock: Number(form.stock) }),
      min_stock: Number(form.minStock) || 0,
      target_stock: Number(form.targetStock) || 0,
      ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
      ...(String(form.costPrice).trim() !== "" ? { cost_price: Number(form.costPrice) } : {}),
      expiry_date: form.expiryDate ? form.expiryDate : null,
      // Foto de la tienda: con URL → portada + galería; sin URL → se quita.
      // (Las blob: del modo demo no viajan: no son URLs persistibles.)
      ...(form.imageUrl && !form.imageUrl.startsWith("blob:")
        ? { thumbnail: form.imageUrl, images: [form.imageUrl] }
        : form.id ? { thumbnail: "", images: [] } : {}),
    };

    try {
      if (usingMock) {
        setDone(form.id ? "Producto actualizado · demo." : "Producto creado · demo.");
      } else if (form.id) {
        // El stock NO viaja en el PUT: se mueve solo por Recepción o Ajustes
        // (transaccional + kardex). Aquí solo se editan datos del producto.
        await api.updateProduct(form.id, payload);
        setDone("Producto actualizado.");
      } else {
        await api.createProduct(payload);
        setDone("Producto creado.");
      }
      closeForm();
      refresh();
    } catch (e2) {
      setSaveErr(e2.message || "No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p) {
    setSaveErr("");
    try {
      if (usingMock) {
        setDone("Estado cambiado · demo.");
        return;
      }
      await api.updateProduct(p._id, { is_active: !p.is_active });
      setDone(p.is_active ? "Producto desactivado." : "Producto activado.");
      refresh();
    } catch (e2) {
      setSaveErr(e2.message || "No se pudo cambiar el estado.");
    }
  }

  // Precio por caja en vivo dentro del formulario.
  const formBoxTotal = form && Number(form.unitsPerBox) > 1 && Number(form.boxUnitPrice) > 0
    ? Number(form.boxUnitPrice) * Number(form.unitsPerBox)
    : null;

  return (
    <div>
      <div className="filters">
        <div className="field grow">
          <label>Buscar</label>
          <input
            type="text"
            placeholder="Nombre, marca o categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Inactivos</label>
          <select value={showInactive ? "true" : "false"} onChange={(e) => setShowInactive(e.target.value === "true")}>
            <option value="true">Mostrar todos</option>
            <option value="false">Solo activos</option>
          </select>
        </div>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-end", whiteSpace: "nowrap" }} onClick={() => setImportOpen(true)}>
          Importar CSV/Excel
        </button>
        <button className="btn btn-primary" style={{ alignSelf: "flex-end", whiteSpace: "nowrap" }} onClick={openNew}>
          Nuevo producto
        </button>
      </div>

      {done ? <div className="ok-msg" style={{ marginBottom: 14, marginTop: 0 }}>✓ {done}</div> : null}
      {saveErr && !form ? (
        <div className="card" style={{ padding: "12px 16px", color: t.danger, marginBottom: 14 }}>{saveErr}</div>
      ) : null}

      {/* ── Formulario crear/editar ─────────────────────────────────────────── */}
      {form ? (
        <div className="card" style={{ maxWidth: 760 }}>
          <div className="card-h">
            <h2>{form.id ? "Editar producto" : "Nuevo producto"}</h2>
            <div className="spacer" />
            <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }} onClick={closeForm}>
              Cerrar
            </button>
          </div>
          <form className="form" style={{ padding: 20, maxWidth: "none" }} onSubmit={save}>
            {/* ── Foto de la tienda ─────────────────────────────────────── */}
            <div className="field">
              <label>Foto del producto</label>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Foto del producto" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                ) : (
                  <div style={{ width: 96, height: 96, borderRadius: 10, border: "1px dashed var(--border)", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" }}>Sin foto</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className="btn btn-ghost" style={{ cursor: "pointer", textAlign: "center" }}>
                    {upFoto ? "Subiendo…" : form.imageUrl ? "Cambiar foto" : "Subir foto"}
                    <input
                      type="file" accept="image/*" style={{ display: "none" }} disabled={upFoto}
                      onChange={(e) => { subirFoto(e.target.files?.[0]); e.target.value = ""; }}
                    />
                  </label>
                  {form.imageUrl ? (
                    <button type="button" className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setF({ imageUrl: "" })}>
                      Quitar foto
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="hint">Esta foto es la que ven tus clientes en la página web. Ideal cuadrada, mínimo 600×600 px.</div>
            </div>

            <Sec>Identificación</Sec>
            <div className="field">
              <label>Código de barras <span style={{ color: "var(--danger)" }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => { setF({ barcode: e.target.value }); setDupWarn(""); }}
                  placeholder="Escanea o escribe el EAN-13"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => setCamOpen(true)}>
                  Escanear
                </button>
              </div>
              {dupWarn
                ? <div className="hint" style={{ color: t.danger, fontWeight: 600 }}>{dupWarn}</div>
                : <div className="hint">Es el identificador principal del producto. Va siempre primero.</div>}
            </div>

            <div className="field">
              <label>Nombre <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" value={form.name} onChange={(e) => setF({ name: e.target.value })} placeholder="Ej: Aceite vegetal 900ml" />
            </div>

            <div className="field">
              <label>Categoría <span style={{ color: "var(--danger)" }}>*</span></label>
              <select value={form.category_id} onChange={(e) => setF({ category_id: e.target.value })} disabled={cats.loading}>
                <option value="">{cats.loading ? "Cargando…" : "Seleccionar categoría…"}</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <Sec>Precios</Sec>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 160px" }}>
                <label>Precio unitario · CLP <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="number" min="1" value={form.unitPrice} onChange={(e) => setF({ unitPrice: e.target.value })} placeholder="Ej: 1449" />
              </div>
              <div className="field" style={{ flex: "1 1 140px" }}>
                <label>Unidades por caja</label>
                <input type="number" min="0" value={form.unitsPerBox} onChange={(e) => setF({ unitsPerBox: e.target.value })} placeholder="Ej: 12" />
              </div>
              {Number(form.unitsPerBox) > 1 ? (
                <div className="field" style={{ flex: "1 1 200px" }}>
                  <label>Precio unitario por caja · CLP <span style={{ color: "var(--danger)" }}>*</span></label>
                  <input type="number" min="1" value={form.boxUnitPrice} onChange={(e) => setF({ boxUnitPrice: e.target.value })} placeholder="Menor que el unitario" />
                  <div className="hint">
                    Por unidad al llevar la caja (mayorista).
                    {formBoxTotal ? <> Caja: <b>{clp(formBoxTotal)}</b> ({form.unitsPerBox} un).</> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <Sec>Stock y reposición</Sec>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 140px" }}>
                <label>{form.id ? "Stock actual" : "Stock inicial"}</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setF({ stock: e.target.value })}
                  readOnly={!!form.id}
                  disabled={!!form.id}
                  style={form.id ? { background: "#f3f4f6", color: t.muted } : undefined}
                />
                {form.id ? <div className="hint">Se mueve por Recepción o Ajustes.</div> : null}
              </div>
              <div className="field" style={{ flex: "1 1 160px" }}>
                <label>Stock mínimo · punto de reorden</label>
                <input type="number" min="0" value={form.minStock} onChange={(e) => setF({ minStock: e.target.value })} placeholder="0 = no se repone" />
                <div className="hint">Bajo este nivel aparece en Reposición. 0 lo deja fuera.</div>
              </div>
              <div className="field" style={{ flex: "1 1 160px" }}>
                <label>Nivel objetivo · al reponer</label>
                <input type="number" min="0" value={form.targetStock} onChange={(e) => setF({ targetStock: e.target.value })} placeholder="0 = 2× el mínimo" />
                <div className="hint">Cuánto dejar al reponer. 0 usa el doble del mínimo.</div>
              </div>
            </div>

            <Sec>Otros datos</Sec>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 180px" }}>
                <label>Costo de compra · CLP</label>
                <input type="number" min="0" value={form.costPrice} onChange={(e) => setF({ costPrice: e.target.value })} placeholder="Ej: 980" />
                <div className="hint">Costo unitario al que compras. Se usa para calcular el margen. Opcional.</div>
              </div>
              <div className="field" style={{ flex: "1 1 180px" }}>
                <label>Vencimiento</label>
                <input type="date" value={form.expiryDate} onChange={(e) => setF({ expiryDate: e.target.value })} />
                <div className="hint">Fecha de vencimiento del lote. Opcional.</div>
              </div>
            </div>

            <div className="field">
              <label>Descripción · opcional</label>
              <textarea rows="2" value={form.description} onChange={(e) => setF({ description: e.target.value })} placeholder="Descripción visible en la tienda" />
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Guardando…" : form.id ? "Guardar cambios" : "Crear producto"}
            </button>

            {saveErr ? (
              <div className="ok-msg" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "var(--danger)" }}>
                {saveErr}
              </div>
            ) : null}
          </form>
        </div>
      ) : null}

      {/* ── Tabla de productos ──────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-h">
          <h2>Productos</h2>
          <span className="badge" style={{ background: "#e9f3da", color: "var(--magenta-d)" }}>
            {res.loading ? "…" : products.length === 1 ? "1 producto" : `${products.length} productos`}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Producto</th><th>Categoría</th><th>Precio por caja</th><th>Margen</th><th>Disponible</th><th>Activo</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {res.loading ? (
              <tr><td colSpan="8" style={{ color: "var(--muted)", padding: 22 }}>Cargando productos…</td></tr>
            ) : res.error ? (
              <tr><td colSpan="8" style={{ color: "var(--danger)", padding: 22 }}>Error: {res.error}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="8" style={{ color: "var(--muted)", padding: "28px 22px", textAlign: "center" }}>No hay productos para los filtros actuales. Ajusta la búsqueda o crea un producto nuevo.</td></tr>
            ) : (
              products.map((p) => {
                const bp = boxPrice(p);
                const b = boxTier(p);
                const margin = marginPct(p);
                const marginColor = margin == null ? t.muted
                  : margin < 0 ? t.danger
                  : margin < 15 ? t.warn
                  : t.ok;
                return (
                  <tr key={p._id} style={p.is_active ? undefined : { opacity: 0.6 }}>
                    <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5, color: t.muted, whiteSpace: "nowrap" }}>
                      {p.barcode || <span style={{ fontFamily: "inherit", fontStyle: "italic" }}>Sin código</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.brand ? <div style={{ fontSize: 12, color: t.muted, fontWeight: 400 }}>{p.brand}</div> : null}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>{p.category?.name || <span style={{ fontStyle: "italic" }}>Sin categoría</span>}</td>
                    <td style={{ fontWeight: 600 }}>
                      {bp != null ? clp(bp) : <span style={{ color: t.muted, fontWeight: 400 }}>solo unidad</span>}
                      {b ? <div style={{ fontSize: 12, color: t.muted, fontWeight: 400 }}>{b.min_qty} un · {clp(b.price)} c/u</div> : null}
                    </td>
                    <td>
                      {margin == null ? (
                        <span style={{ color: t.muted, fontSize: 12.5, fontStyle: "italic" }}>sin costo</span>
                      ) : (
                        <span style={{ fontWeight: 700, color: marginColor }}>{margin}%</span>
                      )}
                      {Number(p.cost_price) > 0 ? (
                        <div style={{ fontSize: 12, color: t.muted, fontWeight: 400 }}>costo {clp(p.cost_price)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="badge" style={(p.available ?? p.stock ?? 0) > 0
                        ? { background: "#dcfce7", color: "var(--ok)" }
                        : { background: "#fee2e2", color: "var(--danger)" }}>
                        {p.available ?? p.stock ?? 0}
                      </span>
                      {(p.allocated || 0) > 0 ? (
                        <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>
                          físico {p.stock ?? 0} · comp. {p.allocated}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className="badge" style={p.is_active
                        ? { background: "#dcfce7", color: "var(--ok)" }
                        : { background: "#fee2e2", color: "var(--danger)" }}>
                        {p.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13, marginRight: 6 }} onClick={() => setFichaId(p._id)}>
                        Ficha
                      </button>
                      <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13, marginRight: 6 }} onClick={() => openEdit(p)}>
                        Editar
                      </button>
                      <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }} onClick={() => toggleActive(p)}>
                        {p.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {usingMock ? (
          <div style={{ padding: "10px 16px", fontSize: 12, color: t.muted }}>
            Modo demostración: alta y edición de productos no se persisten.
          </div>
        ) : null}
      </div>

      {camOpen ? (
        <BarcodeScanner
          title="Escanear producto"
          onDetected={onScanBarcode}
          onClose={() => setCamOpen(false)}
        />
      ) : null}

      {fichaId ? <FichaProducto productId={fichaId} onClose={() => setFichaId(null)} /> : null}
      {importOpen ? (
        <ImportProductos
          onClose={() => {
            setImportOpen(false);
            refresh(); // la importación puede haber creado/actualizado productos
          }}
        />
      ) : null}
    </div>
  );
}

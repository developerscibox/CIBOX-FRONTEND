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

// Unidades de venta admitidas (espejo de SALE_UNITS del backend).
const SALE_UNITS = ["unidad", "kg", "g", "l", "ml", "pack", "caja", "bandeja", "docena"];

const EMPTY_FORM = {
  id: null,
  sku: "",
  name: "",
  brand: "",
  category_id: "",
  subcategory_id: "",
  saleUnit: "unidad",
  contentValue: "",
  contentUnit: "",
  imageUrls: [], // fotos del producto (la primera es la portada)
  unitPrice: "",
  packPrice: "",
  unitsPerBox: "",
  ivaAfecto: true,
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
  const [fCategoria, setFCategoria] = useState("");
  const [fSubcategoria, setFSubcategoria] = useState("");
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
    category: fCategoria || undefined,
    subcategory: fSubcategoria || undefined,
    include_inactive: showInactive ? "true" : undefined,
  };

  const res = useLoad(
    () => api.products(params),
    MOCK_PRODUCTS,
    [search, fCategoria, fSubcategoria, showInactive, nonce],
  );
  const cats = useLoad(() => api.categories({ limit: 100 }), MOCK_CATEGORIES, []);

  const products = res.data?.items || [];
  const categories = cats.data?.items || cats.data?.categories || [];

  const catById = useMemo(() => {
    const m = {};
    for (const c of categories) m[c._id] = c;
    return m;
  }, [categories]);

  // Categorías raíz (sin padre) y subcategorías por padre: el catálogo de
  // supermercado es de dos niveles (categoría → subcategoría).
  const categoriesRaiz = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );
  const subcategoriasDe = (parentId) =>
    parentId ? categories.filter((c) => String(c.parent_id || "") === String(parentId)) : [];

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
      sku: p.sku || "",
      name: p.name || "",
      brand: p.brand || "",
      category_id: p.category?.id || "",
      subcategory_id: p.subcategory?.id || "",
      saleUnit: p.sale_unit || "unidad",
      contentValue: p.unit_content?.value ? String(p.unit_content.value) : "",
      contentUnit: p.unit_content?.unit || "",
      imageUrls: p.images?.length ? [...p.images] : (p.thumbnail ? [p.thumbnail] : []),
      unitPrice: String(p.price ?? u?.price ?? ""),
      packPrice: p.pack_price ? String(p.pack_price) : (b ? String(Number(b.price) * Number(b.min_qty)) : ""),
      unitsPerBox: p.pack_size ? String(p.pack_size) : (b ? String(b.min_qty) : ""),
      ivaAfecto: p.tax?.afecto !== false,
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

  // Sube FOTOS del producto (Cloudinary vía /uploads/image) y las agrega a la
  // galería del formulario; se persisten recién al Guardar (images + thumbnail).
  // La primera de la lista es la portada.
  const MAX_FOTOS = 8;

  async function subirFotos(files) {
    const lista = Array.from(files || []);
    if (!lista.length) return;
    if (lista.some((f) => !/^image\//.test(f.type))) {
      setSaveErr("Todos los archivos deben ser imágenes (JPG/PNG/WebP).");
      return;
    }
    setSaveErr("");
    const cupo = MAX_FOTOS - (form?.imageUrls?.length || 0);
    if (cupo <= 0) { setSaveErr(`Máximo ${MAX_FOTOS} fotos por producto.`); return; }
    const aSubir = lista.slice(0, cupo);

    if (usingMock) {
      setF({ imageUrls: [...(form.imageUrls || []), ...aSubir.map((f) => URL.createObjectURL(f))] });
      return;
    }
    setUpFoto(true);
    try {
      // El driver disk (dev) devuelve una ruta relativa (/uploads/…): se
      // absolutiza contra el origen del backend para que el preview, el
      // validador (.url) y la tienda reciban siempre una URL completa.
      const base = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "");
      const urls = [];
      for (const file of aSubir) {
        const up = await api.uploadImage(file);
        const raw = up?.url || up?.data?.url;
        if (!raw) throw new Error("La subida no devolvió URL");
        urls.push(/^https?:\/\//i.test(raw) ? raw : new URL(raw, base).href);
      }
      setF({ imageUrls: [...(form.imageUrls || []), ...urls] });
      if (lista.length > cupo) setSaveErr(`Se subieron ${cupo}: el máximo es ${MAX_FOTOS} fotos.`);
    } catch (e2) {
      setSaveErr(`No se pudieron subir las fotos: ${e2.message}`);
    } finally {
      setUpFoto(false);
    }
  }

  const quitarFoto = (url) => setF({ imageUrls: (form.imageUrls || []).filter((u) => u !== url) });
  const hacerPortada = (url) => setF({ imageUrls: [url, ...(form.imageUrls || []).filter((u) => u !== url)] });

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
      const packTotal = Number(f.packPrice);
      if (!Number.isInteger(upb) || upb < 2) return "Las unidades por pack deben ser un entero ≥ 2.";
      if (f.packPrice !== "") {
        if (!Number.isFinite(packTotal) || packTotal <= 0) return "Ingresa un precio de pack válido.";
        if (packTotal >= unit * upb) return `El pack debe costar menos que ${upb} unidades sueltas.`;
      }
    }
    return "";
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
    const sub = catById[form.subcategory_id];
    const upb = Number(form.unitsPerBox);
    // Solo viajan las fotos persistibles (las blob: del modo demo no son URLs).
    const fotos = (form.imageUrls || []).filter((u) => u && !u.startsWith("blob:"));
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || `${form.name.trim()} — ${brand.name}.`,
      category,
      ...(form.subcategory_id ? { subcategory: { id: form.subcategory_id, name: sub?.name || "" } } : {}),
      // El precio de venta es UNO. Los tramos por cantidad los deriva el backend.
      price: Number(form.unitPrice),
      sale_unit: form.saleUnit || "unidad",
      unit_content: {
        value: Number(form.contentValue) || 0,
        unit: form.contentUnit.trim(),
      },
      pack_size: form.unitsPerBox !== "" && upb > 1 ? upb : 0,
      pack_price: form.packPrice !== "" ? Number(form.packPrice) : 0,
      tax: { afecto: form.ivaAfecto !== false },
      ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
      ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
      ...(form.id ? {} : { stock: Number(form.stock) }),
      min_stock: Number(form.minStock) || 0,
      target_stock: Number(form.targetStock) || 0,
      ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
      ...(String(form.costPrice).trim() !== "" ? { cost_price: Number(form.costPrice) } : {}),
      expiry_date: form.expiryDate ? form.expiryDate : null,
      // Fotos: la primera es la portada (thumbnail). Sin fotos, se quitan.
      ...(fotos.length ? { thumbnail: fotos[0], images: fotos } : form.id ? { thumbnail: "", images: [] } : {}),
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

  // Ahorro del pack en vivo dentro del formulario.
  const packUnidades = form ? Number(form.unitsPerBox) : 0;
  const packSuelto = form && packUnidades > 1 ? Number(form.unitPrice) * packUnidades : null;
  const packTotal = form && form.packPrice !== "" ? Number(form.packPrice) : null;

  return (
    <div>
      <div className="filters">
        <div className="field grow">
          <label>Buscar</label>
          <input
            type="text"
            placeholder="Nombre, SKU, código, marca o categoría…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Categoría</label>
          <select
            value={fCategoria}
            onChange={(e) => { setFCategoria(e.target.value); setFSubcategoria(""); }}
            disabled={cats.loading}
          >
            <option value="">Todas</option>
            {categoriesRaiz.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Subcategoría</label>
          <select
            value={fSubcategoria}
            onChange={(e) => setFSubcategoria(e.target.value)}
            disabled={!fCategoria || cats.loading}
          >
            <option value="">{fCategoria ? "Todas" : "—"}</option>
            {subcategoriasDe(fCategoria).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
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
            {/* ── Fotos de la tienda ────────────────────────────────────── */}
            <div className="field">
              <label>Fotos del producto</label>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                {(form.imageUrls || []).map((url, i) => (
                  <div key={url} style={{ position: "relative" }}>
                    <img
                      src={url}
                      alt={i === 0 ? "Portada" : `Foto ${i + 1}`}
                      style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: i === 0 ? "2px solid var(--magenta)" : "1px solid var(--border)" }}
                    />
                    {i === 0 ? (
                      <span style={{ position: "absolute", top: 4, left: 4, background: "var(--magenta)", color: "#fff", fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", letterSpacing: ".04em" }}>Portada</span>
                    ) : (
                      <button type="button" title="Usar como portada" onClick={() => hacerPortada(url)}
                        style={{ position: "absolute", top: 4, left: 4, background: "rgba(255,255,255,.92)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "2px 6px", cursor: "pointer" }}>
                        Portada
                      </button>
                    )}
                    <button type="button" title="Quitar" onClick={() => quitarFoto(url)}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, border: "none", background: "rgba(0,0,0,.55)", color: "#fff", fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                ))}
                {(form.imageUrls || []).length < MAX_FOTOS ? (
                  <label className="btn btn-ghost" style={{ cursor: "pointer", width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", borderStyle: "dashed", fontSize: 12 }}>
                    {upFoto ? "Subiendo…" : "+ Agregar"}
                    <input
                      type="file" accept="image/*" multiple style={{ display: "none" }} disabled={upFoto}
                      onChange={(e) => { subirFotos(e.target.files); e.target.value = ""; }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="hint">La primera foto es la portada que ven tus clientes. Hasta {MAX_FOTOS} fotos, ideal cuadradas, mínimo 600×600 px.</div>
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

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 200px" }}>
                <label>SKU</label>
                <input type="text" value={form.sku} onChange={(e) => setF({ sku: e.target.value })} placeholder="Se genera solo si lo dejas vacío" />
                <div className="hint">Código interno del catálogo. Único.</div>
              </div>
              <div className="field" style={{ flex: "1 1 200px" }}>
                <label>Marca</label>
                <input type="text" value={form.brand} onChange={(e) => setF({ brand: e.target.value })} placeholder="Ej: Chef" />
              </div>
            </div>

            <div className="field">
              <label>Nombre <span style={{ color: "var(--danger)" }}>*</span></label>
              <input type="text" value={form.name} onChange={(e) => setF({ name: e.target.value })} placeholder="Ej: Aceite vegetal 900ml" />
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label>Categoría <span style={{ color: "var(--danger)" }}>*</span></label>
                <select value={form.category_id} onChange={(e) => setF({ category_id: e.target.value })} disabled={cats.loading}>
                  <option value="">{cats.loading ? "Cargando…" : "Seleccionar categoría…"}</option>
                  {categoriesRaiz.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 220px" }}>
                <label>Subcategoría</label>
                <select value={form.subcategory_id} onChange={(e) => setF({ subcategory_id: e.target.value })} disabled={cats.loading || !form.category_id}>
                  <option value="">{form.category_id ? "Sin subcategoría" : "Elige primero la categoría"}</option>
                  {subcategoriasDe(form.category_id).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <Sec>Formato de venta</Sec>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 160px" }}>
                <label>Unidad de venta <span style={{ color: "var(--danger)" }}>*</span></label>
                <select value={form.saleUnit} onChange={(e) => setF({ saleUnit: e.target.value })}>
                  {SALE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 120px" }}>
                <label>Contenido</label>
                <input type="number" min="0" step="any" value={form.contentValue} onChange={(e) => setF({ contentValue: e.target.value })} placeholder="Ej: 900" />
              </div>
              <div className="field" style={{ flex: "1 1 100px" }}>
                <label>Medida</label>
                <input type="text" value={form.contentUnit} onChange={(e) => setF({ contentUnit: e.target.value })} placeholder="ml, g, un" />
                <div className="hint">Informativo: va en la ficha del producto.</div>
              </div>
            </div>

            <Sec>Precio</Sec>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 180px" }}>
                <label>Precio de venta · CLP <span style={{ color: "var(--danger)" }}>*</span></label>
                <input type="number" min="1" value={form.unitPrice} onChange={(e) => setF({ unitPrice: e.target.value })} placeholder="Ej: 1449" />
                <div className="hint">Lo que paga el cliente, con IVA incluido.</div>
              </div>
              <div className="field" style={{ flex: "1 1 140px" }}>
                <label>IVA</label>
                <select value={form.ivaAfecto ? "afecto" : "exento"} onChange={(e) => setF({ ivaAfecto: e.target.value === "afecto" })}>
                  <option value="afecto">Afecto (19%)</option>
                  <option value="exento">Exento</option>
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 140px" }}>
                <label>Unidades por pack</label>
                <input type="number" min="0" value={form.unitsPerBox} onChange={(e) => setF({ unitsPerBox: e.target.value })} placeholder="0 = solo unitario" />
              </div>
              {packUnidades > 1 ? (
                <div className="field" style={{ flex: "1 1 200px" }}>
                  <label>Precio del pack completo · CLP</label>
                  <input type="number" min="1" value={form.packPrice} onChange={(e) => setF({ packPrice: e.target.value })} placeholder={packSuelto ? `Menos de ${packSuelto}` : "Total del pack"} />
                  <div className="hint">
                    {packSuelto ? <>Suelto: <b>{clp(packSuelto)}</b>.</> : null}
                    {packTotal > 0 && packSuelto > packTotal ? <> Ahorro: <b>{clp(packSuelto - packTotal)}</b>.</> : null}
                    {" "}Déjalo vacío si el pack no tiene descuento.
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
              <th>SKU</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Margen</th><th>Disponible</th><th>Activo</th><th>Acción</th>
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
                      {p.sku || <span style={{ fontFamily: "inherit", fontStyle: "italic" }}>—</span>}
                      {p.barcode ? <div style={{ fontSize: 11.5, opacity: 0.8 }}>{p.barcode}</div> : null}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.brand ? <div style={{ fontSize: 12, color: t.muted, fontWeight: 400 }}>{p.brand}</div> : null}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--muted)" }}>
                      {p.category?.name || <span style={{ fontStyle: "italic" }}>Sin categoría</span>}
                      {p.subcategory?.name ? <div style={{ fontSize: 12, opacity: 0.85 }}>{p.subcategory.name}</div> : null}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {clp(p.price ?? unitTier(p)?.price ?? 0)}
                      <div style={{ fontSize: 12, color: t.muted, fontWeight: 400 }}>
                        por {p.sale_unit || "unidad"}
                        {p.pack_size > 1 ? <> · pack {p.pack_size}: {clp(p.pack_price || (p.price || 0) * p.pack_size)}</> : null}
                      </div>
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

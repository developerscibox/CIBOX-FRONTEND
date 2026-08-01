import { useEffect, useRef, useState } from "react";
import { api, useLoad, usingMock, getToken } from "../api.js";
import { Skel } from "../components/Ui.jsx";

// CONTENIDO DE LA TIENDA — editor de la portada que ve el cliente final.
// Pensado para una persona NO técnica: cada bloque muestra su nombre, para qué
// sirve, el tamaño de imagen recomendado y cuántas letras caben. Las imágenes
// se previsualizan ANTES de subir en dos rectángulos con la proporción real
// (web y celular). Nada se publica hasta apretar "💾 Publicar cambios"
// (PUT completo de slots — no merge). El GET es público y se cachea 60s en el
// backend, por eso el aviso "aparece en ~1 minuto".

// Specs de respaldo (mismas formas que contentController.SPECS): se usan en
// modo demo y como fallback si el GET no las trae.
const MOCK_SPECS = {
  hero: {
    nombre: "Banner principal (hero)",
    descripcion: "Imagen grande de bienvenida con título, bajada y botón de acción. Es lo primero que ve el cliente.",
    tamano: "1600×500 px (web) · se recorta a 16:9 en móvil",
    ratio_web: "16:5",
    ratio_movil: "16:9",
    campos: { title: { max: 60 }, subtitle: { max: 120 }, cta: { max: 25 }, image_url: {} },
  },
  banner_1: {
    nombre: "Banner secundario 1",
    descripcion: "Franja promocional bajo el hero. Ideal para ofertas o liquidación.",
    tamano: "1200×300 px", ratio_web: "4:1", ratio_movil: "2:1",
    campos: { title: { max: 50 }, image_url: {}, link: { max: 120 } },
  },
  banner_2: {
    nombre: "Banner secundario 2",
    descripcion: "Segunda franja promocional. Ideal para categorías destacadas.",
    tamano: "1200×300 px", ratio_web: "4:1", ratio_movil: "2:1",
    campos: { title: { max: 50 }, image_url: {}, link: { max: 120 } },
  },
  banner_3: {
    nombre: "Banner secundario 3",
    descripcion: "Tercera franja promocional. Ideal para novedades o temporada.",
    tamano: "1200×300 px", ratio_web: "4:1", ratio_movil: "2:1",
    campos: { title: { max: 50 }, image_url: {}, link: { max: 120 } },
  },
  cards: {
    nombre: "Tarjetas de la home",
    descripcion: "Hasta 6 tarjetas con ícono/imagen, título y bajada (beneficios, servicios, categorías).",
    tamano: "512×512 px (ícono/imagen)", ratio_web: "1:1", ratio_movil: "1:1",
    max_items: 6,
    campos: { title: { max: 35 }, subtitle: { max: 80 }, image_url: {} },
  },
  textos: {
    nombre: "Textos generales",
    descripcion: "Textos sueltos de la home: bienvenida y nota del pie de página.",
    campos: { welcome_title: { max: 70 }, welcome_subtitle: { max: 140 }, footer_note: { max: 200 } },
  },
};
const MOCK_CONTENT = { slots: null, specs: MOCK_SPECS, updated_at: null };

// Nombres amables de cada campo (para que no aparezca "cta" o "footer_note").
const FIELD_LABELS = {
  title: "Título",
  subtitle: "Bajada (texto secundario)",
  cta: "Texto del botón",
  link: "Enlace al tocar el banner (opcional)",
  welcome_title: "Título de bienvenida",
  welcome_subtitle: "Bajada de bienvenida",
  footer_note: "Nota del pie de página",
};

const EMPTY_SLOTS = {
  hero: { title: "", subtitle: "", cta: "", image_url: "" },
  banner_1: { title: "", image_url: "", link: "" },
  banner_2: { title: "", image_url: "", link: "" },
  banner_3: { title: "", image_url: "", link: "" },
  cards: [],
  textos: { welcome_title: "", welcome_subtitle: "", footer_note: "" },
};

const uid = () => Math.random().toString(36).slice(2, 10);
// "16:5" → "16 / 5" (CSS aspect-ratio)
const cssRatio = (r) => (r && /^\d+:\d+$/.test(r) ? r.replace(":", " / ") : "16 / 9");
const fmtFecha = (d) => {
  if (!d) return null;
  try { return new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return String(d); }
};

// slots del backend (o null) → estado editable completo (cards con _uid local
// para reordenar/quitar sin depender del índice).
const hydrateSlots = (s) => ({
  hero: { ...EMPTY_SLOTS.hero, ...(s?.hero || {}) },
  banner_1: { ...EMPTY_SLOTS.banner_1, ...(s?.banner_1 || {}) },
  banner_2: { ...EMPTY_SLOTS.banner_2, ...(s?.banner_2 || {}) },
  banner_3: { ...EMPTY_SLOTS.banner_3, ...(s?.banner_3 || {}) },
  cards: (s?.cards || []).map((c) => ({ _uid: uid(), title: "", subtitle: "", image_url: "", ...c })),
  textos: { ...EMPTY_SLOTS.textos, ...(s?.textos || {}) },
});

// ── Piezas de UI ──────────────────────────────────────────────────────────────

function Nota({ spec }) {
  if (!spec?.tamano) return null;
  return (
    <div style={{ fontSize: 12.5, background: "#f8f6fa", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 12px", margin: "8px 0 14px", color: "var(--muted)", lineHeight: 1.5 }}>
<b>Tamaño recomendado:</b> {spec.tamano}.{" "}
      En computador se muestra en proporción {spec.ratio_web} y en celular en {spec.ratio_movil}.
    </div>
  );
}

function CampoTexto({ label, value, onChange, max, placeholder }) {
  const len = (value || "").length;
  return (
    <div className="field" style={{ maxWidth: 560, marginBottom: 12 }}>
      <label>
        {label}
        <span style={{ float: "right", fontWeight: 600, fontSize: 12, fontVariantNumeric: "tabular-nums", color: len >= max ? "var(--danger)" : "var(--muted)" }}>
          {len}/{max}
        </span>
      </label>
      <input value={value || ""} maxLength={max} placeholder={placeholder || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PreviewBox({ titulo, ratio, url, width }) {
  return (
    <div style={{ width, maxWidth: "100%" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
      <div style={{ aspectRatio: cssRatio(ratio), background: "#f3f4f6", border: "1px dashed var(--border-soft)", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url
          ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ fontSize: 12, color: "var(--muted)" }}>Sin imagen</span>}
      </div>
    </div>
  );
}

// Selector + previsualización de imagen de un slot. La foto elegida se ve AL
// TIRO en los dos rectángulos (proporción real web/celular) usando una URL
// local (URL.createObjectURL); recién al apretar "Usar esta imagen" se sube.
function ImagenSlot({ spec, keyId, currentUrl, pend, uploading, onPick, onConfirm, onCancel }) {
  const p = pend[keyId];
  const url = p?.url || currentUrl || "";
  const busy = !!uploading[keyId];
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Imagen</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <PreviewBox titulo="Así se verá en la web" ratio={spec.ratio_web} url={url} width={340} />
        <PreviewBox titulo="Así se verá en el celular" ratio={spec.ratio_movil} url={url} width={180} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
          {url ? "Cambiar imagen" : "Subir imagen"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(keyId, f); e.target.value = ""; }}
          />
        </label>
        {p ? (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => onConfirm(keyId)}>
              {busy ? "Subiendo…" : "Usar esta imagen"}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => onCancel(keyId)}>Cancelar</button>
            <span style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600 }}>
              Vista previa local — aún no se sube
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SlotCard({ spec, children }) {
  return (
    <div className="card">
      <div className="card-h"><h2>{spec.nombre}</h2></div>
      <div style={{ padding: "14px 20px 18px" }}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{spec.descripcion}</div>
        <Nota spec={spec} />
        {children}
      </div>
    </div>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function Contenido() {
  const [tick, setTick] = useState(0);
  const load = useLoad(() => api.contentHome(), MOCK_CONTENT, [tick]);
  const specs = load.data?.specs || MOCK_SPECS;

  const [slots, setSlots] = useState(null); // null = aún sin hidratar
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [pend, setPend] = useState({});       // { key: { file, url } } imagen elegida sin subir
  const [uploading, setUploading] = useState({}); // { key: true } subida en curso
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);       // { ok, text }

  // Hidratar el formulario cuando llega el contenido (solo si el usuario aún
  // no editó nada, para no pisar su trabajo con un refetch).
  const touchedRef = useRef(false);
  useEffect(() => {
    if (!load.data) return;
    if (!touchedRef.current) setSlots(hydrateSlots(load.data.slots));
    setUpdatedAt(load.data.updated_at || null);
  }, [load.data]);

  // Liberar las URLs locales de previsualización al salir de la pantalla.
  const pendRef = useRef(pend);
  pendRef.current = pend;
  useEffect(() => () => {
    Object.values(pendRef.current).forEach((p) => { try { URL.revokeObjectURL(p.url); } catch { /* noop */ } });
  }, []);

  const patch = (fn) => { touchedRef.current = true; setSlots((s) => fn(structuredClone(s))); };
  const setCampo = (slot, campo, v) => patch((s) => { s[slot][campo] = v; return s; });
  const setCardCampo = (u, campo, v) => patch((s) => { const c = s.cards.find((x) => x._uid === u); if (c) c[campo] = v; return s; });

  // ── Imágenes ────────────────────────────────────────────────────────────────
  function onPick(key, file) {
    setMsg(null);
    setPend((p) => {
      if (p[key]) { try { URL.revokeObjectURL(p[key].url); } catch { /* noop */ } }
      return { ...p, [key]: { file, url: URL.createObjectURL(file) } };
    });
  }
  function onCancel(key) {
    setPend((p) => {
      if (p[key]) { try { URL.revokeObjectURL(p[key].url); } catch { /* noop */ } }
      const { [key]: _drop, ...rest } = p;
      return rest;
    });
  }
  // Sube la imagen elegida y deja la URL definitiva en el slot correspondiente.
  async function onConfirm(key, apply) {
    const p = pend[key];
    if (!p) return;
    setUploading((u) => ({ ...u, [key]: true }));
    setMsg(null);
    try {
      let url;
      if (usingMock) {
        url = p.url; // demo: se mantiene la vista previa local (no hay backend)
      } else {
        const r = await api.uploadImage(p.file);
        url = r?.url;
        if (!url) throw new Error("El servidor no devolvió la URL de la imagen");
        try { URL.revokeObjectURL(p.url); } catch { /* noop */ }
      }
      apply(url);
      setPend((prev) => { const { [key]: _drop, ...rest } = prev; return rest; });
      setMsg({ ok: true, text: "Imagen subida. Recuerda publicar los cambios para que se vea en la tienda." });
    } catch (e) {
      setMsg({ ok: false, text: `No se pudo subir la imagen: ${e.message}` });
    } finally {
      setUploading((u) => { const { [key]: _drop, ...rest } = u; return rest; });
    }
  }

  // ── Tarjetas ────────────────────────────────────────────────────────────────
  const maxCards = specs.cards?.max_items || 6;
  const addCard = () => patch((s) => {
    if (s.cards.length < maxCards) s.cards.push({ _uid: uid(), title: "", subtitle: "", image_url: "" });
    return s;
  });
  const removeCard = (u) => {
    onCancel(u); // descartar preview pendiente de esa tarjeta si la hay
    patch((s) => { s.cards = s.cards.filter((c) => c._uid !== u); return s; });
  };
  const moveCard = (u, dir) => patch((s) => {
    const i = s.cards.findIndex((c) => c._uid === u);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.cards.length) return s;
    [s.cards[i], s.cards[j]] = [s.cards[j], s.cards[i]];
    return s;
  });

  // ── Publicar ────────────────────────────────────────────────────────────────
  async function publicar() {
    if (!slots) return;
    if (Object.keys(pend).length) {
      setMsg({ ok: false, text: "Hay imágenes seleccionadas sin confirmar: confirma “Usar esta imagen” (o Cancelar) en cada una antes de publicar." });
      return;
    }
    if (!window.confirm("¿Publicar los cambios en la tienda?\nTodos los clientes los verán en aproximadamente 1 minuto.")) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        hero: { ...slots.hero },
        banner_1: { ...slots.banner_1 },
        banner_2: { ...slots.banner_2 },
        banner_3: { ...slots.banner_3 },
        cards: slots.cards.map(({ _uid, ...c }) => c),
        textos: { ...slots.textos },
      };
      if (usingMock) {
        setMsg({ ok: true, text: "Modo demostración: sin backend configurado, los cambios no se guardan." });
      } else {
        const r = await api.saveContentHome(payload);
        setUpdatedAt(r?.updated_at || new Date().toISOString());
        setUpdatedBy(r?.updated_by?.label || null);
        setMsg({ ok: true, text: "✅ Publicado. Los cambios aparecen en la tienda en ~1 minuto." });
      }
    } catch (e) {
      setMsg({ ok: false, text: `No se pudo publicar: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  // ── Estados de carga / error ────────────────────────────────────────────────
  if (load.loading && !slots) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <Skel h={22} w={280} />
        <div style={{ height: 14 }} />
        <Skel h={120} />
        <div style={{ height: 14 }} />
        <Skel h={120} />
      </div>
    );
  }
  if (load.error && !slots) {
    return (
      <div className="card">
        <div className="empty">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No se pudo cargar el contenido de la tienda</div>
          <div style={{ fontSize: 13, color: "var(--danger)", margin: "8px 0 14px" }}>{load.error}</div>
          <button className="btn btn-primary" onClick={() => setTick((n) => n + 1)}>Reintentar</button>
        </div>
      </div>
    );
  }
  if (!slots) return null;

  const imgProps = { pend, uploading, onPick, onCancel };
  const banners = ["banner_1", "banner_2", "banner_3"];

  return (
    <div>
      {/* Cabecera: qué es esta pantalla + publicar */}
      <div className="card">
        <div className="card-h">
          <h2>Contenido de la tienda</h2>
          <div className="spacer" />
          {updatedAt ? (
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Última edición: {fmtFecha(updatedAt)}{updatedBy ? ` · por ${updatedBy}` : ""}
            </span>
          ) : null}
          <button className="btn btn-primary" onClick={publicar} disabled={saving}>
            {saving ? "Publicando…" : "Publicar cambios"}
          </button>
        </div>
        <div style={{ padding: "12px 20px 16px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
          Aquí editas la <b>portada de la tienda</b> que ven tus clientes: el banner grande, las franjas
          promocionales, las tarjetas y los textos de bienvenida. Nada se publica hasta que aprietes
          <b> “Publicar cambios”</b>; después de publicar, los cambios aparecen en la tienda en <b>~1 minuto</b>.
          {usingMock ? <div style={{ marginTop: 8, color: "var(--warn)", fontWeight: 600 }}>Modo demostración: sin backend, los cambios no se guardan.</div> : null}
        </div>
        {msg ? (
          <div style={{ padding: "0 20px 14px", fontSize: 13.5, fontWeight: 600, color: msg.ok ? "var(--ok)" : "var(--danger)" }}>
            {msg.text}
          </div>
        ) : null}
      </div>

      {/* Pausar / reanudar la tienda online */}
      <PausaTienda />

      {/* Hero */}
      <SlotCard spec={specs.hero}>
        <CampoTexto label={FIELD_LABELS.title} value={slots.hero.title} max={specs.hero.campos.title.max} placeholder="Ej: Bienvenido a Bodega 12" onChange={(v) => setCampo("hero", "title", v)} />
        <CampoTexto label={FIELD_LABELS.subtitle} value={slots.hero.subtitle} max={specs.hero.campos.subtitle.max} placeholder="Ej: Precios de mayorista, atención de barrio" onChange={(v) => setCampo("hero", "subtitle", v)} />
        <CampoTexto label={FIELD_LABELS.cta} value={slots.hero.cta} max={specs.hero.campos.cta.max} placeholder="Ej: Ver ofertas" onChange={(v) => setCampo("hero", "cta", v)} />
        <ImagenSlot spec={specs.hero} keyId="hero" currentUrl={slots.hero.image_url} onConfirm={(k) => onConfirm(k, (url) => setCampo("hero", "image_url", url))} {...imgProps} />
      </SlotCard>

      {/* Banners 1-3 */}
      {banners.map((b) => (
        <SlotCard key={b} spec={specs[b]}>
          <CampoTexto label={FIELD_LABELS.title} value={slots[b].title} max={specs[b].campos.title.max} placeholder="Ej: Liquidación de temporada" onChange={(v) => setCampo(b, "title", v)} />
          <CampoTexto label={FIELD_LABELS.link} value={slots[b].link} max={specs[b].campos.link.max} placeholder="Ej: /products?categoria=aseo" onChange={(v) => setCampo(b, "link", v)} />
          <ImagenSlot spec={specs[b]} keyId={b} currentUrl={slots[b].image_url} onConfirm={(k) => onConfirm(k, (url) => setCampo(b, "image_url", url))} {...imgProps} />
        </SlotCard>
      ))}

      {/* Tarjetas */}
      <SlotCard spec={specs.cards}>
        {slots.cards.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Aún no hay tarjetas. Agrega la primera con el botón de abajo.</div>
        ) : null}
        {slots.cards.map((c, i) => (
          <div key={c._uid} style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <b style={{ fontSize: 13.5 }}>Tarjeta {i + 1}</b>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" title="Subir" disabled={i === 0} onClick={() => moveCard(c._uid, -1)}>↑</button>
                <button className="btn btn-ghost" title="Bajar" disabled={i === slots.cards.length - 1} onClick={() => moveCard(c._uid, +1)}>↓</button>
                <button className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => removeCard(c._uid)}>Quitar</button>
              </div>
            </div>
            <CampoTexto label={FIELD_LABELS.title} value={c.title} max={specs.cards.campos.title.max} placeholder="Ej: Retiro en bodega" onChange={(v) => setCardCampo(c._uid, "title", v)} />
            <CampoTexto label={FIELD_LABELS.subtitle} value={c.subtitle} max={specs.cards.campos.subtitle.max} placeholder="Ej: Compra hoy y retira el mismo día" onChange={(v) => setCardCampo(c._uid, "subtitle", v)} />
            <ImagenSlot spec={specs.cards} keyId={c._uid} currentUrl={c.image_url} onConfirm={(k) => onConfirm(k, (url) => setCardCampo(c._uid, "image_url", url))} {...imgProps} />
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addCard} disabled={slots.cards.length >= maxCards}>
          + Agregar tarjeta ({slots.cards.length}/{maxCards})
        </button>
      </SlotCard>

      {/* Textos generales */}
      <SlotCard spec={specs.textos}>
        <CampoTexto label={FIELD_LABELS.welcome_title} value={slots.textos.welcome_title} max={specs.textos.campos.welcome_title.max} placeholder="Ej: ¡Hola! Esta es tu bodega" onChange={(v) => setCampo("textos", "welcome_title", v)} />
        <CampoTexto label={FIELD_LABELS.welcome_subtitle} value={slots.textos.welcome_subtitle} max={specs.textos.campos.welcome_subtitle.max} placeholder="Ej: Todo por caja, más barato" onChange={(v) => setCampo("textos", "welcome_subtitle", v)} />
        <CampoTexto label={FIELD_LABELS.footer_note} value={slots.textos.footer_note} max={specs.textos.campos.footer_note.max} placeholder="Ej: Horario: lunes a sábado 9:00–19:00" onChange={(v) => setCampo("textos", "footer_note", v)} />
      </SlotCard>

      {/* Publicar también al final (la página es larga) */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", marginBottom: 24 }}>
        {msg ? <span style={{ fontSize: 13.5, fontWeight: 600, color: msg.ok ? "var(--ok)" : "var(--danger)" }}>{msg.text}</span> : null}
        <button className="btn btn-primary" onClick={publicar} disabled={saving}>
          {saving ? "Publicando…" : "Publicar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── PAUSAR / REANUDAR LA TIENDA ONLINE ───────────────────────────────────────
// Interruptor de mantención: al pausar, los clientes ven una página "Estamos
// haciendo mejoras" (con mensaje opcional) y el backend bloquea el checkout.
// El personal interno (admin/gerente/vendedor) sigue navegando la tienda igual.
// Endpoints propios (/content/store-status) con fetch local: api.js tiene trabajo
// en curso de otra tanda — mismo patrón que turnosApi.js.
function PausaTienda() {
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

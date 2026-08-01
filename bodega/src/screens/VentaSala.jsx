import { useEffect, useMemo, useState } from "react";
import { api, usingMock, streamUrl } from "../api.js";
import { imprimirBoleta } from "../print.js";

// VENDEDOR DE SALA (relay etapa 1) — vista móvil, una mano. Atiende el turno,
// arma el pedido con stock en vivo, ve el resumen agrupado por sector y al
// finalizar deja el pedido POR PAGAR + imprime la boleta para la caja.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

const MOCK_CATALOGO = [
  { _id: "m1", name: "Arroz Grado 1 1kg", stock: 240, reserved: 0, allocated: 0, location: { sector: "Abarrotes" }, pricing: { tiers: [{ min_qty: 1, price: 1290 }, { min_qty: 12, price: 1100 }] } },
  { _id: "m2", name: "Aceite Vegetal 1L", stock: 120, reserved: 0, allocated: 0, location: { sector: "Abarrotes" }, pricing: { tiers: [{ min_qty: 1, price: 1990 }, { min_qty: 12, price: 1790 }] } },
  { _id: "m3", name: "Leche Entera 1L", stock: 80, reserved: 0, allocated: 0, location: { sector: "Lácteos y refrigerados" }, pricing: { tiers: [{ min_qty: 1, price: 990 }, { min_qty: 12, price: 880 }] } },
  { _id: "m4", name: "Bebida Cola 1.5L", stock: 60, reserved: 0, allocated: 0, location: { sector: "Bebidas y licores" }, pricing: { tiers: [{ min_qty: 1, price: 1490 }, { min_qty: 6, price: 1290 }] } },
  { _id: "m5", name: "Detergente 5kg", stock: 30, reserved: 0, allocated: 0, location: { sector: "Limpieza y aseo" }, pricing: { tiers: [{ min_qty: 1, price: 8990 }, { min_qty: 4, price: 8490 }] } },
  { _id: "m6", name: "Galletas surtidas", stock: 5, reserved: 0, allocated: 0, location: { sector: "Snacks y confites" }, pricing: { tiers: [{ min_qty: 1, price: 690 }, { min_qty: 24, price: 590 }] } },
];

const cajaTierDe = (p) => {
  const tiers = p?.pricing?.tiers || [];
  return tiers.reduce((a, t) => (t.min_qty > (a?.min_qty || 0) ? t : a), null) || { min_qty: 1, price: p?.price || 0 };
};
// Sin tier válido el producto se mostraría a $0 y el backend rechaza TODO el pedido.
const vendible = (p) => (p?.pricing?.tiers || []).some((t) => Number(t?.price) > 0);
const CART_KEY = "b12_venta_cart"; // el carrito sobrevive el cambio de tab (la pantalla se desmonta)
const boxQtyDe = (p) => cajaTierDe(p).min_qty || 1;
const precioCajaDe = (p) => (cajaTierDe(p).price || 0) * boxQtyDe(p);
const dispUnidades = (p) => Math.max(0, Number(p.stock || 0) - Number(p.reserved || 0) - Number(p.allocated || 0));
const maxCajas = (p) => Math.floor(dispUnidades(p) / boxQtyDe(p));

export default function VentaSala() {
  const [catalogo, setCatalogo] = useState(usingMock ? MOCK_CATALOGO : []);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState(null);
  const [sectoresOrden, setSectoresOrden] = useState({});
  const [q, setQ] = useState("");
  const [cart, setCart] = useState(() => { // id → { product, cajas } — hidratado de sessionStorage (H4)
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || "{}") || {}; } catch { return {}; }
  });
  const [turno, setTurno] = useState(null); // { id, code, name }
  const [enEspera, setEnEspera] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [verDetalle, setVerDetalle] = useState(false);
  const [openCats, setOpenCats] = useState({}); // categorías desplegadas (al navegar sin buscar)

  useEffect(() => {
    if (usingMock) { setSectoresOrden({ "Lácteos y refrigerados": 1, Abarrotes: 2, "Bebidas y licores": 3, "Limpieza y aseo": 4, "Snacks y confites": 5 }); return; }
    cargarCatalogo();
    api.sectores().then((r) => {
      const m = {}; (r.sectores || []).forEach((s) => { m[s.nombre] = s.orden; }); setSectoresOrden(m);
    }).catch(() => {});
    refreshTurnos();
  }, []);

  // Catálogo completo: hasta 3 páginas de 500 (el filtro/lector es client-side).
  const cargarCatalogo = async (silencioso = false) => {
    if (!silencioso) { setCatLoading(true); setCatError(null); }
    try {
      let items = []; let page = 1; let hasNext = true;
      while (hasNext && page <= 3) {
        const r = await api.products({ limit: 500, page });
        items = items.concat(r.items || []);
        hasNext = !!r.pagination?.hasNext;
        page += 1;
      }
      setCatalogo(items.filter(vendible));
    } catch (e) {
      if (!silencioso) setCatError(e.message || "Error de red");
    } finally {
      if (!silencioso) setCatLoading(false);
    }
  };

  // Carrito persistente (H4): guarda en sessionStorage; al finalizar OK, setCart({}) lo limpia.
  useEffect(() => {
    try {
      if (Object.keys(cart).length) sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
      else sessionStorage.removeItem(CART_KEY);
    } catch { /* noop */ }
  }, [cart]);

  // Toast auto-cierra a los 3s (H11).
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  // "En espera" en vivo: SSE + poll 20s (mismo patrón que Retiro) (H7).
  useEffect(() => {
    if (usingMock) return undefined;
    const id = setInterval(refreshTurnos, 20000);
    let es = null;
    try { const u = streamUrl(); if (u) { es = new EventSource(u); es.addEventListener("change", refreshTurnos); } } catch { /* polling */ }
    return () => { clearInterval(id); try { es && es.close(); } catch { /* noop */ } };
  }, []);

  const refreshTurnos = () => {
    if (usingMock) { setEnEspera(3); return; }
    api.turnoBoard().then((b) => setEnEspera((b.waiting || []).length)).catch(() => {});
  };

  const llamarSiguiente = async () => {
    if (usingMock) { setTurno({ id: null, code: "T-042", name: "Cliente Demo", tipo: "compra", rut: null }); setEnEspera((n) => Math.max(0, n - 1)); return; }
    try {
      const t = await api.callNextTurno();
      const tt = t.turno || t;
      if (tt && (tt._id || tt.code)) setTurno({ id: tt._id || null, code: tt.code || tt.number, name: tt.name || "", tipo: tt.tipo || "compra", rut: tt.rut || null });
      else setMsg("No hay clientes en espera");
      refreshTurnos();
    } catch (e) { setMsg(e.message); }
  };

  // El cliente llamado no compró: libera el turno para que no quede colgado en el tablero (H3).
  const noCompro = async () => {
    if (!turno) return;
    if (usingMock || !turno.id) { setTurno(null); refreshTurnos(); return; }
    try {
      await api.cancelTurno(turno.id);
      setTurno(null);
      refreshTurnos();
    } catch (e) { setMsg(e.message || "No se pudo cancelar el turno"); }
  };

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalogo;
    return catalogo.filter((p) =>
      p.name.toLowerCase().includes(s) ||
      (p.barcode || "").toLowerCase().includes(s) ||
      (p.sku || "").toLowerCase().includes(s) ||
      (p.location?.code || "").toLowerCase().includes(s)
    );
  }, [q, catalogo]);

  const add = (p) => {
    const cur = cart[p._id]?.cajas || 0;
    if (cur + 1 > maxCajas(p)) { setMsg(`Sin stock: ${p.name}`); return; }
    setMsg(null);
    setCart((c) => ({ ...c, [p._id]: { product: p, cajas: (c[p._id]?.cajas || 0) + 1 } }));
  };

  // Enter del buscador/lector: 1 match agrega; varios piden precisión; sin match
  // local hace fallback a búsqueda server-side (el código puede no estar cargado) (H2/H11).
  const buscarEnter = async () => {
    const code = q.trim();
    if (!code) return;
    if (filtrados.length === 1) { add(filtrados[0]); setQ(""); return; }
    if (filtrados.length > 1) { setMsg(`${filtrados.length} coincidencias — precisa más`); return; }
    if (usingMock) { setMsg(`Sin resultados para “${code}”`); return; }
    try {
      const r = await api.products({ search: code, limit: 5 });
      const items = r.items || [];
      const vend = items.filter(vendible);
      if (!vend.length) { setMsg(items.length ? "Producto sin precio configurado" : `Sin resultados para “${code}”`); return; }
      setCatalogo((c) => {
        const ids = new Set(c.map((p) => p._id));
        return [...c, ...vend.filter((p) => !ids.has(p._id))];
      });
      if (vend.length === 1) { add(vend[0]); setQ(""); }
      else setMsg(`${vend.length} coincidencias — precisa más`);
    } catch (e) { setMsg(e.message || "No se pudo buscar el producto"); }
  };
  const sub = (id) => setCart((c) => {
    const cur = c[id]?.cajas || 0;
    if (cur <= 1) { const { [id]: _, ...rest } = c; return rest; }
    return { ...c, [id]: { ...c[id], cajas: cur - 1 } };
  });

  // Agrupado por categoría (para navegar ordenado, en secciones desplegables).
  const categorias = useMemo(() => {
    const m = new Map();
    for (const p of filtrados) {
      const c = p.category?.name || "Sin categoría";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(p);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados]);

  // Tarjeta de un producto (reutilizada en la búsqueda plana y en las categorías).
  const renderProducto = (p) => {
    const max = maxCajas(p); const cajas = cart[p._id]?.cajas || 0; const sinStock = max <= 0;
    return (
      <div key={p._id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, opacity: sinStock ? 0.5 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {p.location?.sector || "Sin sector"} · caja {boxQtyDe(p)} un · {clp(precioCajaDe(p))} · {sinStock ? "sin stock" : `${max} cajas disp.`}
            {p.barcode || p.sku ? <span style={{ color: "var(--muted)", opacity: 0.75 }}> · cód {p.barcode || p.sku}</span> : null}
          </div>
        </div>
        {cajas > 0 && <button onClick={() => sub(p._id)} style={btnStep}>−</button>}
        {cajas > 0 && <b style={{ minWidth: 22, textAlign: "center" }}>{cajas}</b>}
        <button onClick={() => add(p)} disabled={sinStock || cajas >= max} style={{ ...btnStep, background: "var(--magenta-d)", color: "#fff", borderColor: "var(--magenta-d)" }}>＋</button>
      </div>
    );
  };

  const lineas = Object.values(cart);
  const total = lineas.reduce((a, l) => a + l.cajas * precioCajaDe(l.product), 0);
  const totalCajas = lineas.reduce((a, l) => a + l.cajas, 0);

  // Resumen agrupado por sector (mientras arma el pedido).
  const porSector = useMemo(() => {
    const m = new Map();
    for (const l of lineas) {
      const s = l.product.location?.sector || "Sin sector";
      if (!m.has(s)) m.set(s, []);
      m.get(s).push(l);
    }
    const ord = (s) => (s === "Sin sector" ? Infinity : sectoresOrden[s] ?? Infinity);
    return [...m.entries()].sort((a, b) => ord(a[0]) - ord(b[0]) || a[0].localeCompare(b[0], "es"));
  }, [cart, sectoresOrden]);

  const finalizar = async () => {
    if (!lineas.length) return;
    setBusy(true); setMsg(null);
    const customer = { name: turno?.name || "Cliente mostrador" };
    try {
      if (usingMock) {
        // En demo sí imprimimos en el teléfono para mostrar el formato de la boleta.
        const order = {
          _id: "DEMO" + Date.now(), codigo_escaneo: "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          total, turno_numero: turno?.code || null,
          customer: { fullName: customer.name }, seller: { nombre: "Vendedor demo" },
          items: lineas.map((l) => ({ name: l.product.name, quantity: l.cajas * boxQtyDe(l.product), cajas: l.cajas, box_qty: boxQtyDe(l.product), subtotal: l.cajas * precioCajaDe(l.product), sector: l.product.location?.sector || "" })),
        };
        await imprimirBoleta(order, sectoresOrden);
        setMsg("✅ Pedido listo (demo). Boleta impresa.");
      } else {
        // Real: el pedido se manda a caja y se imprime en el COMPUTADOR CENTRAL (no en el teléfono).
        const payload = {
          items: lineas.map((l) => ({ product_id: l.product._id, cajas: l.cajas })),
          customer,
          turno_id: turno?.id || undefined,
        };
        await api.takeOrder(payload);
        // refrescar stock del catálogo (quedó asignado)
        cargarCatalogo(true);
        setMsg("✅ Pedido enviado · quedó en cola de impresión central.");
      }
      setCart({}); setTurno(null); refreshTurnos();
    } catch (e) { setMsg(e.message || "No se pudo finalizar"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 24 }}>
      {/* Turno */}
      <div className="card" style={{ padding: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          {turno ? (
            <div>
              <b style={{ fontSize: 18 }}>{turno.code}</b> · {turno.name || "Cliente"}
              <span style={{
                marginLeft: 8, fontSize: 12, fontWeight: 800, borderRadius: 8, padding: "2px 8px", whiteSpace: "nowrap",
                background: turno.tipo === "retiro" ? "#f3eef6" : "#f3f4f6",
                color: turno.tipo === "retiro" ? "var(--magenta-d)" : "var(--muted)",
              }}>
                {turno.tipo === "retiro" ? "Retiro" : "Compra"}
              </span>
              {turno.tipo === "retiro" && turno.rut ? (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  RUT {turno.rut} · pedido de internet — paga/retira en caja
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ color: "var(--muted)" }}>En espera: <b>{enEspera}</b></div>
          )}
        </div>
        {turno && <button onClick={noCompro} style={btn("var(--danger)")}>✕ No compró</button>}
        <button onClick={llamarSiguiente} style={btn("var(--ok)")}>Llamar siguiente</button>
      </div>

      {/* Buscador — por nombre o código (barcode/SKU/ubicación). Enter agrega si hay 1 resultado (lector). */}
      <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" enterKeyHint="search"
        onKeyDown={(e) => { if (e.key === "Enter") buscarEnter(); }}
        placeholder="Buscar por nombre o código…"
        style={{ width: "100%", padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1px solid var(--border-soft)", marginBottom: 10 }} />

      {/* Catálogo: al buscar (código/nombre) → resultados planos; al navegar → por categoría desplegable. */}
      {catLoading ? (
        <div className="card" style={{ padding: 14, color: "var(--muted)" }}>Cargando catálogo…</div>
      ) : catError ? (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ color: "var(--danger)", marginBottom: 10 }}>No se pudo cargar el catálogo: {catError}</div>
          <button onClick={() => cargarCatalogo()} style={btn("var(--magenta-d)")}>Reintentar</button>
        </div>
      ) : q.trim() ? (
        <div style={{ display: "grid", gap: 8 }}>
          {filtrados.length === 0
            ? <div className="card" style={{ padding: 14, color: "var(--muted)" }}>Sin resultados para “{q.trim()}”.</div>
            : filtrados.slice(0, 60).map(renderProducto)}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {categorias.length === 0 && (
            <div className="card" style={{ padding: 14, color: "var(--muted)", textAlign: "center" }}>
              No hay productos vendibles en el catálogo.
            </div>
          )}
          {categorias.map(([cat, prods]) => {
            const abierta = !!openCats[cat];
            const enCarro = prods.reduce((n, p) => n + (cart[p._id]?.cajas ? 1 : 0), 0);
            return (
              <div key={cat}>
                <button onClick={() => setOpenCats((s) => ({ ...s, [cat]: !s[cat] }))}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "13px 14px", borderRadius: 10, border: "1px solid var(--border-soft)", background: abierta ? "#f3eef6" : "#fff", cursor: "pointer", fontWeight: 800, fontSize: 15, fontFamily: "inherit", color: "var(--text)" }}>
                  <span>{cat}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontWeight: 600, fontSize: 13 }}>
                    {enCarro > 0 ? <span style={{ background: "var(--magenta-d)", color: "#fff", borderRadius: 999, padding: "1px 8px", fontWeight: 800 }}>{enCarro}</span> : null}
                    {prods.length} <span style={{ fontSize: 11 }}>{abierta ? "▲" : "▼"}</span>
                  </span>
                </button>
                {abierta && <div style={{ display: "grid", gap: 8, margin: "8px 0 4px 8px" }}>{prods.map(renderProducto)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Spacer: reserva el alto de la barra fija (+ menú inferior del vendedor) */}
      {lineas.length > 0 && <div style={{ height: 110 }} />}

      {/* Barra de cobro FIJA — se eleva sobre el menú inferior del vendedor (--bn-h). */}
      {lineas.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "var(--bn-h, 0px)", zIndex: 55, background: "#fff", borderTop: "2px solid var(--magenta-d)", boxShadow: "0 -6px 16px rgba(0,0,0,.12)" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: 12 }}>
            {verDetalle && (
              <div style={{ maxHeight: "45vh", overflowY: "auto", marginBottom: 10 }}>
                {porSector.map(([sector, ls]) => (
                  <div key={sector} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--magenta-d)", textTransform: "uppercase", letterSpacing: 0.4 }}>{sector}</div>
                    {ls.map((l) => (
                      <div key={l.product._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span>{l.cajas}× {l.product.name}</span><span>{clp(l.cajas * precioCajaDe(l.product))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setVerDetalle((v) => !v)}
                style={{ background: "#f3eef6", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "10px 12px", fontWeight: 800, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1.1 }}>
                {verDetalle ? "▾" : "▴"} {totalCajas} {totalCajas === 1 ? "caja" : "cajas"} · {clp(total)}
              </button>
              <button onClick={finalizar} disabled={busy} style={{ ...btn("var(--magenta-d)"), flex: 1, fontSize: 16, padding: 14, opacity: busy ? 0.7 : 1 }}>
                {busy ? "Enviando…" : "Finalizar → boleta"}
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "8px 14px", borderRadius: 8, zIndex: 50, fontSize: 14 }}>{msg}</div>}
    </div>
  );
}

const btn = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" });
const btnStep = { width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border-soft)", background: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", lineHeight: 1 };

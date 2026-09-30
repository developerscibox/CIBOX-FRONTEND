import { useEffect, useMemo, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { LOW_STOCK_RES } from "../data.js";
import { clp } from "../theme.js";
import { useAuth } from "../auth.jsx";
import { Seg } from "../components/Ui.jsx";

/**
 * BAJO STOCK — qué está por quebrarse y qué ya se quebró.
 *
 * QUÉ PROBLEMA RESUELVE
 * El Dashboard muestra un número ("N en stock crítico") y manda a Inventario,
 * que es una pantalla de búsqueda producto por producto. Para saber QUÉ hay que
 * comprar había que mirar el contador, entrar a Inventario y buscar a mano. Acá
 * está la lista completa, ordenada por gravedad, en una sola pantalla.
 *
 * POR QUÉ TRES GRUPOS Y NO UNA TABLA ORDENADA
 * "Se acabó" y "quedan 8" no son el mismo problema: lo primero es plata que se
 * está perdiendo ahora mismo, lo segundo es una compra que conviene planificar.
 * Una tabla ordenada por stock los deja pegados y obliga a leer el número de
 * cada fila para saber cuál es cuál; los grupos con color separan la urgencia
 * antes de leer.
 *
 * SOBRE EL PUNTO DE REORDEN (min_stock)
 * El backend sabe calcular alertas contra el min_stock de cada producto, pero
 * hoy NINGÚN producto del catálogo lo tiene definido. Cualquier vista armada
 * sobre min_stock saldría vacía, así que acá se agrupa por el stock disponible
 * y el corte lo pone el umbral general. Cuando se carguen los puntos de reorden
 * reales, el campo `nivel` que ya trae el endpoint pasa a ser más fino que este
 * corte y conviene usarlo.
 */

/**
 * Umbrales ofrecidos. Es ajustable a propósito: con umbral 10 se marcan 27 de
 * los 57 productos activos — casi la mitad del catálogo — y una alerta que
 * apunta a la mitad del catálogo deja de ser una alerta, nadie la mira. Con 5
 * queda la lista corta de "hay que comprar esto ya"; con 20 se usa para
 * planificar la compra de la semana. Por defecto 10, que es el mismo valor con
 * el que el Dashboard cuenta el stock crítico (así los dos números coinciden).
 */
const UMBRALES = [5, 10, 20];
const UMBRAL_INICIAL = 10;

/**
 * Disponible real para vender: el backend ya lo calcula (físico menos reservado
 * por carritos menos comprometido a pedidos) y lo manda en `disponible`. Los
 * datos de ejemplo del modo demostración solo traen `stock`, de ahí el respaldo.
 */
const disponibleDe = (p) => Number(p.disponible ?? p.stock ?? 0);

/** Ubicación en bodega, solo si está cargada. */
const ubicacionDe = (p) => String(p.location?.code || "").trim();

/**
 * Los tres grupos, en orden de urgencia. El corte de "críticos" en 3 unidades
 * no es arbitrario: un pedido mayorista promedio se lleva más que eso, así que
 * con 3 o menos el producto se puede quebrar con la próxima venta.
 */
const GRUPOS = [
  {
    id: "agotados",
    titulo: "Agotados",
    detalle: () => "Sin nada disponible: la tienda no los puede vender.",
    vacio: "Ningún producto en cero. Así debería estar siempre.",
    texto: "#b91c1c",
    fondo: "#fee2e2",
    entra: (n) => n <= 0,
  },
  {
    id: "criticos",
    titulo: "Críticos",
    detalle: () => "Entre 1 y 3 unidades: se quiebran con la próxima venta.",
    vacio: "Nada entre 1 y 3 unidades.",
    texto: "#9a3412",
    fondo: "#ffedd5",
    entra: (n) => n >= 1 && n <= 3,
  },
  {
    id: "bajos",
    titulo: "Bajos",
    detalle: (umbral) => `De 4 unidades hasta el umbral de ${umbral}: conviene reponer sin apuro.`,
    vacio: "Nada en este rango con el umbral elegido.",
    texto: "#92400e",
    fondo: "#fef3c7",
    // Todo lo que no es quiebre ni crítico. El endpoint puede devolver algo por
    // sobre el umbral (cuando el producto tiene punto de reorden cargado); si
    // llegó a la lista de alertas, se muestra igual en vez de desaparecer.
    entra: (n) => n >= 4,
  },
];

/** Una fila compacta por producto. Solo campos que el endpoint realmente trae. */
function Fila({ p, texto, fondo }) {
  const disp = disponibleDe(p);
  const fisico = Number(p.stock ?? 0);
  const ubic = ubicacionDe(p);
  // El físico solo se menciona cuando NO coincide con el disponible; si no,
  // sería el mismo número dos veces y agrega ruido.
  const hayComprometido = fisico !== disp;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        borderTop: "1px solid var(--border-soft)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.3 }}>
          {p.name || "Producto sin nombre"}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 2,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {p.category ? <span>{p.category}</span> : null}
          {p.sku ? <span className="mono">SKU {p.sku}</span> : null}
          {ubic ? <span>Ubicación {ubic}</span> : null}
          {p.vendor?.name ? <span>{p.vendor.name}</span> : null}
        </div>
      </div>

      {Number(p.price) > 0 ? (
        <div className="mono" style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
          {clp(p.price)}
        </div>
      ) : null}

      <div style={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 96 }}>
        <span
          className="mono"
          style={{
            display: "inline-block",
            fontWeight: 800,
            fontSize: 15,
            borderRadius: 999,
            padding: "3px 12px",
            background: fondo,
            color: texto,
          }}
        >
          {disp}
        </span>
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
          {p.sale_unit && p.sale_unit !== "unidad" ? p.sale_unit : "disponible"}
          {hayComprometido ? ` · ${fisico} físico` : ""}
        </div>
      </div>
    </div>
  );
}

function Grupo({ grupo, items, umbral }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2 style={{ color: grupo.texto }}>{grupo.titulo}</h2>
        <span className="badge" style={{ background: grupo.fondo, color: grupo.texto }}>
          {items.length}
        </span>
        <div className="spacer" />
        <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
          {grupo.detalle(umbral)}
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--muted)" }}>{grupo.vacio}</div>
      ) : (
        <div>
          {items.map((p) => (
            <Fila key={p._id || p.sku || p.name} p={p} texto={grupo.texto} fondo={grupo.fondo} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BajoStock() {
  const { can } = useAuth();
  const puedeVer = can("inventory.read");

  const [umbral, setUmbral] = useState(UMBRAL_INICIAL);
  const [busqueda, setBusqueda] = useState("");
  const [tick, setTick] = useState(0);

  // Refresco automático cada 60 s: el stock cambia con cada venta de la tienda y
  // esta pantalla se deja abierta mientras se arma la compra. Un minuto alcanza
  // para no trabajar sobre números viejos sin castigar al backend.
  useEffect(() => {
    if (!puedeVer) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [puedeVer]);

  // Firma de useLoad: (fetcher, valorEnModoDemo, deps). Devuelve { data, loading,
  // error } — no trae `reload`, así que refrescar es subir `tick`.
  // Sin permiso NO se llama al endpoint: se resuelve vacío y se muestra el aviso.
  const { data, loading, error } = useLoad(
    () => (puedeVer ? api.lowStock(umbral, 500) : Promise.resolve({ items: [], count: 0 })),
    LOW_STOCK_RES,
    [umbral, tick, puedeVer],
  );

  const items = Array.isArray(data?.items) ? data.items : [];

  // El buscador filtra en el cliente: la lista topa en unas decenas de productos
  // y filtrar acá evita una consulta por cada tecla.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      `${p.name || ""} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase().includes(q),
    );
  }, [items, busqueda]);

  const porGrupo = useMemo(
    () =>
      GRUPOS.map((g) => ({
        grupo: g,
        items: filtrados
          .filter((p) => g.entra(disponibleDe(p)))
          .sort((a, b) => disponibleDe(a) - disponibleDe(b)),
      })),
    [filtrados],
  );

  // La primera carga es la única que puede tapar la lista; los refrescos de cada
  // minuto mantienen lo que hay en pantalla para no hacerla parpadear.
  const primeraCarga = loading && items.length === 0;

  if (!puedeVer) {
    return (
      <div className="card" style={{ padding: "16px 20px", fontSize: 13.5, color: "var(--muted)" }}>
        Tu rol no tiene acceso al inventario, así que esta pantalla no puede mostrar el stock.
        Pídele a un administrador el permiso de lectura de inventario.
      </div>
    );
  }

  return (
    <div>
      <div className="filters">
        <div className="field grow">
          <label>Buscar producto</label>
          <input
            type="text"
            placeholder="Nombre, SKU o código de barras…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Umbral de stock bajo</label>
          <Seg
            options={UMBRALES.map((u) => ({ value: u, label: `≤ ${u}` }))}
            value={umbral}
            onChange={setUmbral}
          />
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button
            className="btn btn-ghost"
            style={{ padding: "10px 16px" }}
            disabled={loading}
            onClick={() => setTick((n) => n + 1)}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{ padding: "12px 18px", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
      >
        <span className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
          {primeraCarga ? "…" : filtrados.length}
        </span>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {filtrados.length === 1 ? "producto" : "productos"} con {umbral} unidades o menos
          {busqueda.trim() ? " (con el filtro aplicado)" : ""}
        </span>
        <div style={{ flex: 1 }} />
        {porGrupo.map(({ grupo, items: gi }) => (
          <span key={grupo.id} className="badge" style={{ background: grupo.fondo, color: grupo.texto }}>
            {gi.length} {grupo.titulo.toLowerCase()}
          </span>
        ))}
      </div>

      {error ? (
        <div
          className="card"
          style={{ padding: "12px 18px", color: "var(--danger)", fontWeight: 600, fontSize: 13.5 }}
        >
          No se pudo leer el inventario: {error}
          {items.length > 0 ? " — abajo quedan los últimos datos que sí llegaron." : ""}
        </div>
      ) : null}

      {primeraCarga ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)" }}>Cargando el inventario…</div>
      ) : items.length === 0 && !error ? (
        <div className="card" style={{ padding: 20, color: "var(--muted)", fontSize: 13.5 }}>
          Ningún producto activo está bajo las {umbral} unidades. Si esperabas ver algo, probá con un
          umbral más alto.
        </div>
      ) : (
        porGrupo.map(({ grupo, items: gi }) => (
          <Grupo key={grupo.id} grupo={grupo} items={gi} umbral={umbral} />
        ))
      )}

      {usingMock ? (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 2px 8px" }}>
          Modo demostración: los productos de arriba son datos de ejemplo, no el inventario real.
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { api, usingMock } from "../api.js";
import { useBarcodeWedge, preciosDe } from "../scanner.js";

// CONSULTA DE PRECIOS — verificador de precios para la pistola/lector. Escaneas
// un producto y aparece grande su nombre, precio (unidad y caja) y stock. El
// campo queda con foco para disparar en serie sin tocar el mouse. También hay
// respaldo por lector global (por si el foco se pierde) y tecleo manual.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
const num = (n) => (Number(n) || 0).toLocaleString("es-CL");

export default function ConsultaPrecios() {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [res, setRes] = useState(null);      // { producto } | { noEncontrado: code }
  const [loading, setLoading] = useState(false);
  const [hist, setHist] = useState([]);        // últimas consultas (para volver a verlas)

  const enfocar = useCallback(() => { try { inputRef.current?.focus(); } catch { /* noop */ } }, []);
  useEffect(() => { enfocar(); }, [enfocar]);

  const consultar = useCallback(async (raw) => {
    const q = String(raw || "").trim();
    setCode("");
    enfocar();
    if (!q) return;
    if (usingMock) { setRes({ noEncontrado: q, mock: true }); return; }
    setLoading(true);
    try {
      // by-barcode: match exacto por código, devuelve precio (tiers) + stock.
      const p = await api.byBarcode(q);
      if (p && (p._id || p.name)) {
        setRes({ producto: p });
        try { navigator.vibrate?.(80); } catch { /* sin vibración */ }
        const k = (x) => x._id || x.barcode;
        setHist((h) => [p, ...h.filter((x) => k(x) !== k(p))].slice(0, 8));
      } else {
        setRes({ noEncontrado: q });
      }
    } catch (e) {
      // 404 = código sin producto; el resto = error real de red/servidor.
      if (e.status === 404 || e.status === 403) setRes({ noEncontrado: q });
      else setRes({ error: e.message || "No se pudo consultar" });
    } finally {
      setLoading(false);
      enfocar();
    }
  }, [enfocar]);

  // Respaldo: lector global por si el foco no está en el campo (no dispara doble,
  // porque cuando el input tiene foco este hook lo ignora).
  useBarcodeWedge(consultar, { captureInInputs: false });

  const p = res?.producto;
  const pr = p ? preciosDe(p) : null;

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Campo de disparo — siempre enfocado */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); consultar(code); } }}
          onBlur={() => setTimeout(enfocar, 150)}
          placeholder="Dispara con la pistola o escribe el código y presiona Enter"
          inputMode="numeric"
          autoFocus
          style={{ flex: "1 1 260px", minWidth: 200, border: "1.5px solid var(--magenta)", borderRadius: 10, padding: "12px 14px", fontSize: 16 }}
        />
        <button onClick={() => consultar(code)} className="btn btn-primary" style={{ padding: "11px 18px", fontSize: 14, fontWeight: 700 }}>
          Consultar
        </button>
      </div>

      {/* Resultado grande */}
      <div className="card" style={{ padding: 22, minHeight: 190 }}>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 15 }}>Buscando…</div>
        ) : res?.error ? (
          <div style={{ color: "var(--danger)", fontWeight: 600 }}>{res.error}</div>
        ) : res?.noEncontrado ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--danger)" }}>Sin resultados para “{res.noEncontrado}”</div>
            <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6 }}>
              {res.mock ? "Conéctalo al backend (VITE_API_URL) para consultar precios reales." : "Revisa el código o dalo de alta en Productos."}
            </div>
          </div>
        ) : p ? (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {p.thumbnail ? (
              <img src={p.thumbnail} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border-soft)", flexShrink: 0 }} />
            ) : null}
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {p.barcode ? `Código ${p.barcode}` : "Sin código"}{p.sku ? ` · SKU ${p.sku}` : ""}{p.category?.name ? ` · ${p.category.name}` : ""}
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 16, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700 }}>Precio unidad</div>
                  <div style={{ fontSize: 40, fontWeight: 800, color: "var(--magenta)", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{pr.unidad ? clp(pr.unidad) : "—"}</div>
                </div>
                {pr.caja > 0 ? (
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700 }}>Precio caja{pr.cajaQty ? ` (${pr.cajaQty} un)` : ""}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{clp(pr.caja)}</div>
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5 }}>
                Stock: <b style={{ color: (p.stock || 0) <= 0 ? "var(--danger)" : (p.stock || 0) < 10 ? "var(--warn)" : "var(--ok)" }}>{num(p.stock || 0)}</b>
                {p.location?.code ? <span style={{ color: "var(--muted)" }}> · ubicación {p.location.code}</span> : null}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 15, display: "flex", alignItems: "center", minHeight: 140 }}>
            Apunta la pistola a un producto para ver su precio al instante. El resultado aparece aquí y queda listo para el siguiente disparo.
          </div>
        )}
      </div>

      {/* Historial de la sesión */}
      {hist.length ? (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
          <div style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid var(--border-soft)", color: "var(--muted)" }}>Últimas consultas</div>
          {hist.map((h) => {
            const hp = preciosDe(h);
            return (
              <button key={h._id} onClick={() => setRes({ producto: h })}
                style={{ display: "flex", width: "100%", textAlign: "left", justifyContent: "space-between", gap: 12, padding: "9px 14px", border: "none", borderTop: "1px solid var(--border-soft)", background: "#fff", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                <b style={{ color: "var(--magenta-d)", whiteSpace: "nowrap" }}>{hp.unidad ? clp(hp.unidad) : "—"}</b>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

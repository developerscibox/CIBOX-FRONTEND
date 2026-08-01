import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useBarcodeWedge, preciosDe } from "../scanner.js";

// Escaneo GLOBAL de precios: en cualquier pantalla, si disparas la pistola SIN
// estar escribiendo en un campo, aparece una tarjeta flotante con el precio del
// producto. Se desactiva (prop `enabled=false`) en las pantallas que ya usan el
// escaneo para su propia acción (Caja, Venta en sala, Productos, inventario…),
// para no robarles el disparo.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

export default function PriceScanOverlay({ enabled = true }) {
  const [toast, setToast] = useState(null); // { producto } | { noEncontrado }
  const timer = useRef(null);

  const mostrar = useCallback((data) => {
    setToast(data);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const onScan = useCallback(async (raw) => {
    const q = String(raw || "").trim();
    if (!q) return;
    try {
      const p = await api.byBarcode(q); // match exacto por código de barras
      if (p && (p._id || p.name)) { try { navigator.vibrate?.(80); } catch { /* noop */ } mostrar({ producto: p }); }
      else mostrar({ noEncontrado: q });
    } catch { mostrar({ noEncontrado: q }); }
  }, [mostrar]);

  useBarcodeWedge(onScan, { enabled });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!toast) return null;
  const p = toast.producto;
  const pr = p ? preciosDe(p) : null;

  return (
    <div
      onClick={() => setToast(null)}
      style={{ position: "fixed", right: 18, bottom: 18, zIndex: 1200, width: 300, maxWidth: "calc(100vw - 36px)", cursor: "pointer" }}
      title="Clic para cerrar"
    >
      <div className="card" style={{ padding: 14, borderLeft: "4px solid var(--magenta)", boxShadow: "0 10px 30px rgba(0,0,0,.18)", marginBottom: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Precio escaneado</div>
        {p ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25 }}>{p.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: "var(--magenta)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{pr.unidad ? clp(pr.unidad) : "—"}</span>
              {pr.caja > 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>caja {clp(pr.caja)}{pr.cajaQty ? ` · ${pr.cajaQty} un` : ""}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              Stock <b style={{ color: (p.stock || 0) <= 0 ? "var(--danger)" : "var(--text)" }}>{(p.stock || 0).toLocaleString("es-CL")}</b>{p.barcode ? ` · ${p.barcode}` : ""}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: "var(--danger)", fontWeight: 600 }}>Sin resultados para “{toast.noEncontrado}”</div>
        )}
      </div>
    </div>
  );
}

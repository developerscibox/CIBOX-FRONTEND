import { useState } from "react";
import { api, useLoad, usingMock } from "../api.js";

// Cierre Z de caja: total del día por método de pago + arqueo (esperado vs
// contado). Lógica de cuadre en backend (cuadreZ); arqueo client-side.
// Datos demo de respaldo si no hay ventas del día.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");

const MOCK = {
  date: "2026-06-25",
  total: 1284500,
  count: 37,
  byMethod: { efectivo: 742000, transferencia: 542500 },
  byCajero: [
    { cajero: "Cajero Retiro", total: 820000, count: 24 },
    { cajero: "Gerente de Bodega", total: 464500, count: 13 },
  ],
};

const META = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };

// Fecha local YYYY-MM-DD (toISOString es UTC y corre el día en la tarde-noche de Chile).
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function CierreZ() {
  const [fecha, setFecha] = useState(hoyLocal());
  const { data, loading, error } = useLoad(() => api.cierreZ(fecha), MOCK, [fecha]);
  const [contado, setContado] = useState("");

  if (loading) return <div className="card" style={{ padding: 20 }}>Cargando…</div>;

  // Demo solo SIN backend. Con backend se muestran las cifras reales (aunque el
  // día esté en 0); nunca datos inventados sobre un día real sin ventas.
  const z = usingMock ? MOCK : (data || { date: "", total: 0, count: 0, byMethod: {}, byCajero: [] });
  const sinVentas = !usingMock && (z.count || 0) === 0;
  const efectivoEsperado = z.byMethod?.efectivo || 0;
  const dif = contado === "" ? null : Math.round(Number(contado) || 0) - efectivoEsperado;

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>Cierre Z de caja</h2>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span>Día {z.date || fecha} · {z.count} ventas · total <b>{clp(z.total)}</b></span>
        <input type="date" value={fecha} max={hoyLocal()} onChange={(e) => e.target.value && setFecha(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 13 }} />
        {fecha !== hoyLocal() && (
          <button onClick={() => setFecha(hoyLocal())} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}>Hoy</button>
        )}
      </div>
      {error && !usingMock ? (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderLeft: "3px solid var(--danger)", color: "var(--danger)", fontWeight: 600 }}>No se pudo cargar el cierre: {error}</div>
      ) : null}
      {sinVentas ? (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: "var(--muted)" }}>Sin ventas registradas ese día. El cuadre aparecerá cuando la caja registre cobros.</div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
        {Object.entries(z.byMethod || {}).map(([m, v]) => (
          <div key={m} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{META[m] || m}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{clp(v)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6" }}>Por cajero</div>
          {(z.byCajero || []).length === 0 ? (
            <div style={{ padding: "14px", fontSize: 13, color: "var(--muted)" }}>Sin cobros por cajero ese día.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <tbody>
                {(z.byCajero || []).map((c) => (
                  <tr key={c.cajero} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={td}>{c.cajero} <span style={{ color: "var(--muted)" }}>· {c.count} ventas</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{clp(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Arqueo de efectivo</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Ventas en efectivo del día: <b>{clp(efectivoEsperado)}</b></div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Solo ventas del día, <b>sin fondo de caja</b>: al contar el cajón, resta el fondo inicial antes de comparar.</div>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>Efectivo contado</label>
          <input
            type="number"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            placeholder="Ingresa lo contado"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", marginTop: 4, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box" }}
          />
          {dif !== null && (
            <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: dif === 0 ? "var(--ok)" : dif > 0 ? "var(--warn)" : "var(--danger)" }}>
              {dif === 0 ? "Cuadra" : dif > 0 ? `Sobrante ${clp(dif)}` : `Faltante ${clp(Math.abs(dif))}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const td = { padding: "9px 14px" };

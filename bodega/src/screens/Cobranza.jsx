import { useState } from "react";
import { api, useLoad, getToken, usingMock } from "../api.js";

// Cobranza / aging de cuentas por cobrar (F2.5) — el dolor nº1 del feriante.
// Consume /cobranza/resumen (lógica pura cobranza/aging.js). En modo demo
// muestra datos de ejemplo.

const clp = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CL");
// Fecha chilena dd/mm/aaaa desde un ISO (yyyy-mm-dd).
const fmtCL = (iso) => { const s = String(iso || "").slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : (iso || ""); };

// PATCH /cobranza/deudas/:id/abono { monto } → { deuda }. api.js no exporta su
// helper `req` (y no se edita aquí), así que copiamos mínimamente su patrón de
// base URL + Authorization Bearer.
const API_BASE = import.meta.env.VITE_API_URL || "";
async function patchAbono(id, monto) {
  const res = await fetch(`${API_BASE}/cobranza/deudas/${id}/abono`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ monto }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `${res.status} ${res.statusText}`);
  return json?.data ?? json;
}

const MOCK = {
  hoy: "2026-06-25",
  aging: {
    total: 3630000,
    buckets: { vigente: 320000, "0-30": 750000, "31-60": 880000, "61-90": 430000, "+90": 1250000 },
  },
  llamarHoy: [
    { cliente: "Kiosco Central", documento: "F-1006", monto: 1250000, diasVencida: 130 },
    { cliente: "Distribuidora Sur", documento: "F-1004", monto: 880000, diasVencida: 48 },
    { cliente: "Minimarket La Esquina", documento: "F-1002", monto: 540000, diasVencida: 12 },
    { cliente: "Almacén Doña Rosa", documento: "F-1005", monto: 430000, diasVencida: 80 },
    { cliente: "Botillería El Sol", documento: "F-1003", monto: 210000, diasVencida: 25 },
  ],
  chequesPorVencer: [
    { cliente: "Minimarket La Esquina", numero: "CH-7781", banco: "BancoEstado", monto: 540000, diasParaVencer: 2 },
    { cliente: "Distribuidora Sur", numero: "CH-9032", banco: "Santander", monto: 880000, diasParaVencer: 6 },
  ],
};

const TRAMOS = [
  { key: "vigente", label: "Vigente", color: "var(--ok)" },
  { key: "0-30", label: "0-30 días", color: "var(--magenta-d)" },
  { key: "31-60", label: "31-60 días", color: "var(--warn)" },
  { key: "61-90", label: "61-90 días", color: "#ea580c" },
  { key: "+90", label: "+90 días", color: "var(--danger)" },
];

const SEM_COLOR = { verde: "var(--ok)", amarillo: "var(--warn)", rojo: "var(--danger)" };

// Mock de GET /clientes para el "Top deudores" en modo demostración.
const MOCK_CLIENTES = {
  items: [
    { _id: "c3", razon_social: "Kiosco Central", rut: "78555111-6", credito: { habilitado: true, condicion_dias: 30 }, estado: { saldo: 390000, max_mora_dias: 21, semaforo: "rojo" } },
    { _id: "c2", razon_social: "Almacén Doña Rosa", rut: "77987654-3", credito: { habilitado: true, condicion_dias: 15 }, estado: { saldo: 285000, max_mora_dias: 3, semaforo: "amarillo" } },
    { _id: "c1", razon_social: "Minimarket La Esquina", rut: "76123456-0", credito: { habilitado: true, condicion_dias: 30 }, estado: { saldo: 180000, max_mora_dias: 0, semaforo: "verde" } },
  ],
  count: 3,
};

export default function Cobranza({ onNav }) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useLoad(() => api.cobranzaResumen(), MOCK, [reloadKey]);
  // Top deudores: se arma desde el maestro de clientes con crédito (GET /clientes,
  // estado = estadoCredito por cliente), ordenado por saldo descendente.
  const cli = useLoad(() => api.clientes(), MOCK_CLIENTES, [reloadKey]);

  if (loading) return <div className="card" style={{ padding: 20 }}>Cargando…</div>;
  if (error) return <div className="card" style={{ padding: 20, color: "var(--danger)" }}>No se pudo cargar: {error}</div>;

  const aging = data?.aging || { total: 0, buckets: {} };
  const llamar = data?.llamarHoy || [];
  const cheques = data?.chequesPorVencer || [];
  const vencidoTotal = (aging.total || 0) - (aging.buckets?.vigente || 0);
  const deudores = (cli.data?.items || [])
    .filter((c) => (c.estado?.saldo || 0) > 0)
    .sort((a, b) => (b.estado?.saldo || 0) - (a.estado?.saldo || 0))
    .slice(0, 10);

  // Puente sin router hacia la pantalla Clientes: se deja el _id del cliente en
  // sessionStorage "b12_cliente_open" (Clientes.jsx lo lee UNA vez al montar,
  // borra la clave y abre la ficha) y se navega con onNav("clientes").
  const abrirCliente = (c) => {
    if (!c?._id) return;
    try { sessionStorage.setItem("b12_cliente_open", String(c._id)); } catch { /* sin storage */ }
    onNav?.("clientes");
  };

  const registrarAbono = async (d) => {
    if (usingMock || !d._id) { alert("Modo demostración: conecta el backend para registrar abonos."); return; }
    const raw = window.prompt(`Abono para ${d.cliente} (${d.documento}) — deuda ${clp(d.monto)}.\nMonto del abono:`);
    if (raw == null) return;
    const monto = Math.round(Number(String(raw).replace(/[$.\s]/g, "").replace(",", ".")));
    if (!(monto > 0)) { alert("Monto inválido."); return; }
    try {
      await patchAbono(d._id, monto);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert("No se pudo registrar el abono: " + e.message);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>Cobranza · cuentas por cobrar</h2>
      <div className="card" style={{ padding: "10px 14px", marginBottom: 12, borderLeft: "4px solid var(--warn)", background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 600 }}>
        Las deudas se generan automáticamente desde las ventas a crédito registradas en Caja.
      </div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        Saldo por cobrar al {fmtCL(data?.hoy)}. Total por cobrar <b>{clp(aging.total)}</b> · vencido <b style={{ color: "var(--danger)" }}>{clp(vencidoTotal)}</b>
      </div>

      {/* Aging por tramo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
        {TRAMOS.map((t) => (
          <div key={t.key} className="card" style={{ padding: 14, borderTop: `4px solid ${t.color}` }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1c2a36", marginTop: 4 }}>
              {clp(aging.buckets?.[t.key] || 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Top deudores — desde el maestro de clientes con crédito */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6" }}>
          Top deudores <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 12.5 }}>· clic para abrir la ficha del cliente</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={th}>Cliente</th>
              <th style={{ ...th, textAlign: "right" }}>Saldo</th>
              <th style={{ ...th, textAlign: "center" }}>Mora máx</th>
              <th style={{ ...th, textAlign: "center" }}>Docs</th>
            </tr>
          </thead>
          <tbody>
            {deudores.map((c) => {
              const e = c.estado || {};
              const mora = Number(e.max_mora_dias) || 0;
              return (
                <tr key={c._id} onClick={() => abrirCliente(c)} title="Abrir la ficha del cliente" style={{ borderTop: "1px solid var(--border-soft)", cursor: "pointer" }}>
                  <td style={td}>
                    <span style={{ color: SEM_COLOR[e.semaforo] || SEM_COLOR.verde, marginRight: 6 }}>●</span>
                    <b>{c.razon_social}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>· {c.rut}</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{clp(e.saldo)}</td>
                  <td style={{ ...td, textAlign: "center", color: mora > 0 ? (mora > 7 ? "var(--danger)" : "var(--warn)") : "var(--muted)", fontWeight: 600 }}>{mora} d</td>
                  <td style={{ ...td, textAlign: "center", color: "var(--muted)" }}>{e.n_docs ?? e.docs ?? ""}</td>
                </tr>
              );
            })}
            {deudores.length === 0 && (
              <tr><td style={{ ...td, color: "var(--muted)", textAlign: "center", padding: "18px 14px" }} colSpan={4}>Sin deudas de clientes con crédito. Se generan al cobrar con crédito en Caja.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        {/* A quién llamar hoy */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6" }}>A quién llamar hoy</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>Cliente</th>
                <th style={{ ...th, textAlign: "center" }}>Días</th>
                <th style={{ ...th, textAlign: "right" }}>Monto</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {llamar.map((d) => (
                <tr key={d.documento} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={td}>{d.cliente} <span style={{ color: "var(--muted)" }}>· {d.documento}</span></td>
                  <td style={{ ...td, textAlign: "center", color: d.diasVencida > 90 ? "var(--danger)" : "var(--warn)", fontWeight: 600 }}>{d.diasVencida}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{clp(d.monto)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => registrarAbono(d)} title="Registrar un abono a esta deuda"
                      style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border-soft)", background: "#fff", color: "var(--magenta-d)", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Registrar abono
                    </button>
                  </td>
                </tr>
              ))}
              {llamar.length === 0 && (
                <tr><td style={{ ...td, color: "var(--muted)", textAlign: "center", padding: "18px 14px" }} colSpan={4}>Sin deudas vencidas por cobrar hoy.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cheques por vencer */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", fontWeight: 700, background: "#f3eef6" }}>Cheques por vencer (10 días)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>Cliente / cheque</th>
                <th style={{ ...th, textAlign: "center" }}>Vence en</th>
                <th style={{ ...th, textAlign: "right" }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.numero} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={td}>{c.cliente}<div style={{ color: "var(--muted)", fontSize: 12 }}>{c.numero} · {c.banco}</div></td>
                  <td style={{ ...td, textAlign: "center", color: c.diasParaVencer <= 3 ? "var(--danger)" : "var(--warn)", fontWeight: 600 }}>{c.diasParaVencer} d</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{clp(c.monto)}</td>
                </tr>
              ))}
              {cheques.length === 0 && (
                <tr><td style={{ ...td, color: "var(--muted)", textAlign: "center", padding: "18px 14px" }} colSpan={3}>Sin cheques próximos a vencer.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "8px 14px", fontWeight: 600 };
const td = { padding: "9px 14px" };

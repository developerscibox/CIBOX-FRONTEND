import { useEffect, useState } from "react";
import { api, useLoad, usingMock } from "../api.js";
import { Kpi, Tabla, Skel } from "../components/Ui.jsx";
import { clp } from "../theme.js";

// Clientes · Crédito — maestro de clientes con línea de crédito, ficha con
// estado de cuenta (documentos abiertos + abonos FIFO) y alta/edición.
// Regla del dominio: TODO cliente nuevo parte al contado; el crédito se
// habilita aquí (línea + condición en días + días de gracia). La fecha de
// vencimiento se fija al emitir y no cambia con abonos; el bloqueo automático
// (mora > gracia o saldo+venta > línea) lo calcula el backend (estadoCredito).
//
// Puente Cobranza → Clientes (sin router): Cobranza escribe el _id del cliente
// en sessionStorage("b12_cliente_open"); esta pantalla lo lee UNA vez al montar
// (y borra la clave) para abrir la ficha de ese cliente directamente.
export const CLIENTE_OPEN_KEY = "b12_cliente_open";

// ── RUT: limpieza, formato en vivo (12.345.678-9) y validación módulo 11 ─────
const cleanRut = (s) => String(s || "").replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
function formatRut(raw) {
  const s = cleanRut(raw);
  if (s.length <= 1) return s;
  return s.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + s.slice(-1);
}
// Forma normalizada que guarda el backend: "12345678-9" (sin puntos).
const rutNorm = (raw) => {
  const s = cleanRut(raw);
  return s.length > 1 ? s.slice(0, -1) + "-" + s.slice(-1) : s;
};
function rutValido(raw) {
  const s = cleanRut(raw);
  if (s.length < 7) return false;
  const body = s.slice(0, -1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const dv = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return s.slice(-1) === dv;
}

const SEM_COLOR = { verde: "var(--ok, #16a34a)", amarillo: "var(--warn, #d97706)", rojo: "var(--danger, #b00020)" };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const diasPara = (ymd) => (ymd ? Math.ceil((new Date(ymd + "T00:00:00") - new Date(hoyISO() + "T00:00:00")) / 86400000) : null);
const fecha = (ymd) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).slice(0, 10).split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
};

const inp = { padding: "9px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #d9d2dc", width: "100%", boxSizing: "border-box" };
const lbl = { fontSize: 11.5, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 };
const btnP = { background: "var(--magenta, #E6007E)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const btnG = { background: "#fff", color: "var(--magenta-d, #9B007A)", border: "1px solid #d9d2dc", borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const noAplica = <span style={{ color: "var(--muted)", fontSize: 12.5 }}>no aplica</span>;

function Sem({ s, size = 13 }) {
  return <span title={`Semáforo: ${s || "verde"}`} style={{ color: SEM_COLOR[s] || SEM_COLOR.verde, fontSize: size, lineHeight: 1 }}>●</span>;
}

// Barra de línea usada: verde <80%, ámbar 80-99%, rojo ≥100%.
function UsoBar({ pct }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const color = p >= 100 ? "var(--danger, #b00020)" : p >= 80 ? "var(--warn, #d97706)" : "var(--ok, #16a34a)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 96 }}>
      <span style={{ flex: 1, minWidth: 56, height: 6, background: "#eee", borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: p + "%", height: "100%", background: color }} />
      </span>
      <span style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{p}%</span>
    </span>
  );
}

function MoraBadge({ diasMora, vencimiento }) {
  const dm = Number(diasMora) || 0;
  if (dm > 0) return <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c", whiteSpace: "nowrap" }}>vencida · {dm} d</span>;
  const dp = diasPara(vencimiento);
  if (dp != null && dp <= 7) return <span className="badge" style={{ background: "#fef3c7", color: "#92400e", whiteSpace: "nowrap" }}>vence en {dp} d</span>;
  return <span className="badge" style={{ background: "#dcfce7", color: "#166534", whiteSpace: "nowrap" }}>al día</span>;
}

// ── Mocks (modo demostración, mismas formas que el backend) ──────────────────
const MOCK_ITEMS = [
  { _id: "c1", razon_social: "Minimarket La Esquina", rut: "76123456-0",
    contacto: { nombre: "Rosa Pérez", telefono: "+56 9 1234 5678", email: "" },
    credito: { habilitado: true, linea: 500000, condicion_dias: 30, dias_gracia: 7, bloqueado: false, bloqueo_motivo: "" },
    estado: { saldo: 180000, disponible: 320000, uso_pct: 36, max_mora_dias: 0, semaforo: "verde", puede_comprar: true, motivo_rechazo: null } },
  { _id: "c2", razon_social: "Almacén Doña Rosa", rut: "77987654-3", contacto: {},
    credito: { habilitado: true, linea: 300000, condicion_dias: 15, dias_gracia: 5, bloqueado: false, bloqueo_motivo: "" },
    estado: { saldo: 285000, disponible: 15000, uso_pct: 95, max_mora_dias: 3, semaforo: "amarillo", puede_comprar: true, motivo_rechazo: null } },
  { _id: "c3", razon_social: "Kiosco Central", rut: "78555111-6", contacto: {},
    credito: { habilitado: true, linea: 400000, condicion_dias: 30, dias_gracia: 7, bloqueado: true, bloqueo_motivo: "Mora reiterada" },
    estado: { saldo: 390000, disponible: 10000, uso_pct: 98, max_mora_dias: 21, semaforo: "rojo", puede_comprar: false, motivo_rechazo: "bloqueado" } },
  { _id: "c4", razon_social: "Botillería El Sol", rut: "12345678-5", contacto: {},
    credito: { habilitado: false, linea: 0, condicion_dias: 30, dias_gracia: 7, bloqueado: false, bloqueo_motivo: "" },
    estado: { saldo: 0, disponible: 0, uso_pct: 0, max_mora_dias: 0, semaforo: "verde", puede_comprar: false, motivo_rechazo: "deshabilitado" } },
];
const MOCK_CUENTA = {
  cliente: MOCK_ITEMS[0],
  estado: MOCK_ITEMS[0].estado,
  documentos: [
    { _id: "d1", documento: "FCR-A1B2C3", order_id: "o1", fecha_emision: "2026-06-05", fecha_vencimiento: "2026-07-05", dias_mora: 0, monto_original: 120000, abonado: 40000, saldo: 80000, estado: "pendiente" },
    { _id: "d2", documento: "FCR-D4E5F6", order_id: "o2", fecha_emision: "2026-06-20", fecha_vencimiento: "2026-07-20", dias_mora: 0, monto_original: 100000, abonado: 0, saldo: 100000, estado: "pendiente" },
  ],
  abonos_recientes: [
    { fecha: "2026-06-28", monto: 40000, documento: "FCR-A1B2C3", by_label: "María (caja)" },
  ],
};

// ── Modal de abono: monto + medio + referencia → distribución FIFO ───────────
function ModalAbono({ clienteId, onClose, onDone }) {
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const registrar = async () => {
    setErr(null);
    const m = Math.round(Number(String(monto).replace(/[$.\s]/g, "").replace(",", ".")) || 0);
    if (!(m > 0)) { setErr("Ingresa un monto mayor a 0."); return; }
    setBusy(true);
    try {
      let r;
      if (usingMock) {
        const a1 = Math.min(m, 80000);
        const a2 = Math.min(Math.max(0, m - 80000), 100000);
        r = { aplicaciones: [{ deuda_id: "d1", documento: "FCR-A1B2C3", aplicado: a1 }, ...(a2 > 0 ? [{ deuda_id: "d2", documento: "FCR-D4E5F6", aplicado: a2 }] : [])], sobrante: Math.max(0, m - 180000), total_aplicado: Math.min(m, 180000) };
      } else {
        r = await api.abonoCliente(clienteId, { monto: m, medio, referencia: referencia.trim() || undefined });
      }
      onDone(r);
    } catch (e) { setErr(e.message || "No se pudo registrar el abono"); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 400, maxWidth: "100%", padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Registrar abono</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
          Se aplica FIFO: primero al documento más antiguo. El vencimiento de cada factura no cambia.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={lbl}>Monto del abono (CLP)</div>
            <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="$" autoFocus style={inp} />
          </div>
          <div>
            <div style={lbl}>Medio de pago</div>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} style={inp}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <div style={lbl}>Referencia (opcional)</div>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nº operación / cheque…" style={inp} />
          </div>
        </div>
        {err && <div style={{ marginTop: 10, color: "var(--danger, #b00020)", fontWeight: 600, fontSize: 13 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnG}>Cancelar</button>
          <button onClick={registrar} disabled={busy} style={{ ...btnP, opacity: busy ? 0.6 : 1 }}>{busy ? "Registrando…" : "Registrar abono"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Ficha del cliente (overlay grande, patrón FichaProducto) ─────────────────
function FichaCliente({ clienteId, onClose, onEdit }) {
  const [reload, setReload] = useState(0);
  const res = useLoad(() => api.estadoCuenta(clienteId), MOCK_CUENTA, [clienteId, reload]);
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [fifo, setFifo] = useState(null); // última distribución FIFO devuelta

  const d = res.data;
  const c = d?.cliente || {};
  const e = d?.estado || {};
  const cr = c.credito || {};
  const docs = d?.documentos || [];
  const abonos = d?.abonos_recientes || [];
  const gracia = cr.dias_gracia ?? 7;
  const moraColor = (Number(e.max_mora_dias) || 0) > gracia ? "var(--danger, #b00020)" : (Number(e.max_mora_dias) || 0) > 0 ? "var(--warn, #d97706)" : "var(--ok, #16a34a)";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <div onClick={(ev) => ev.stopPropagation()} className="card" style={{ width: 880, maxWidth: "100%", marginBottom: 0, maxHeight: "94vh", overflowY: "auto" }}>
        <div className="card-h">
          <h2>Ficha del cliente</h2>
          <div className="spacer" />
          {onEdit ? <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => onEdit(c)}>Editar</button> : null}
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>

        {res.loading ? (
          <div style={{ padding: "12px 4px", display: "grid", gap: 12 }}>
            <Skel h={64} />
            <Skel h={100} />
            <Skel h={180} />
          </div>
        ) : res.error && !d ? (
          <div style={{ padding: "16px 4px", color: "var(--danger)" }}>No se pudo cargar el estado de cuenta: {res.error}</div>
        ) : (
          <div style={{ padding: "6px 4px 4px" }}>
            {/* Cabecera: semáforo + datos */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Sem s={e.semaforo} size={22} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{c.razon_social || "Sin razón social"}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, fontFamily: "ui-monospace,monospace" }}>{c.rut || "RUT no registrado"}</div>
                {c.contacto?.nombre || c.contacto?.telefono ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {[c.contacto?.nombre, c.contacto?.telefono, c.contacto?.email].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
              {cr.bloqueado ? (
                <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>Bloqueado{cr.bloqueo_motivo ? ` · ${cr.bloqueo_motivo}` : ""}</span>
              ) : !cr.habilitado ? (
                <span className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>Solo contado</span>
              ) : (
                <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>Crédito activo</span>
              )}
              <button onClick={() => setAbonoOpen(true)} disabled={!docs.length} style={{ ...btnP, opacity: docs.length ? 1 : 0.5 }} title={docs.length ? "Registrar un abono (se aplica FIFO)" : "Sin documentos abiertos"}>
                Registrar abono
              </button>
            </div>

            {/* Resultado del último abono: la distribución FIFO devuelta */}
            {fifo ? (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: 13.5, fontWeight: 600 }}>
                Abono aplicado (FIFO): {clp(fifo.total_aplicado)} → {(fifo.aplicaciones || []).map((a) => `${a.documento} ${clp(a.aplicado)}`).join(" · ") || "sin aplicaciones"}
                {Number(fifo.sobrante) > 0 ? ` · sobrante ${clp(fifo.sobrante)} (no aplicado)` : ""}
              </div>
            ) : null}

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
              <Kpi label="Saldo deudor" value={clp(e.saldo)} sub={`${docs.length} documento${docs.length === 1 ? "" : "s"} abierto${docs.length === 1 ? "" : "s"}`} />
              <Kpi label="Disponible" value={cr.habilitado ? clp(e.disponible) : "Contado"} sub={cr.habilitado ? <UsoBar pct={e.uso_pct} /> : "crédito deshabilitado"} />
              <Kpi label="Mora máxima" value={<span style={{ color: moraColor }}>{Number(e.max_mora_dias) || 0} días</span>} sub={`gracia ${gracia} d`} />
              <Kpi label="Condición" value={cr.habilitado ? `${cr.condicion_dias ?? 30} días` : "Contado"} sub={cr.habilitado ? `línea ${clp(cr.linea)}` : "habilita el crédito al editar"} />
            </div>

            {/* Documentos abiertos */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "18px 2px 8px" }}>
              Documentos abiertos · {docs.length} (más antiguo primero)
            </div>
            <Tabla
              head={["Folio", "Emisión", "Vencimiento", "Mora", "Original", "Abonado", "Saldo"]}
              aligns={["l", "l", "l", "l", "r", "r", "r"]}
              rows={docs.map((doc) => [
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{doc.documento}</span>,
                fecha(doc.fecha_emision),
                fecha(doc.fecha_vencimiento),
                <MoraBadge diasMora={doc.dias_mora} vencimiento={doc.fecha_vencimiento} />,
                clp(doc.monto_original),
                clp(doc.abonado),
                <b>{clp(doc.saldo)}</b>,
              ])}
              empty="Sin documentos abiertos. Las facturas a crédito se generan al cobrar en Caja."
            />

            {/* Abonos recientes */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "18px 2px 8px" }}>
              Abonos recientes · últimos {abonos.length}
            </div>
            <Tabla
              head={["Fecha", "Documento", "Monto", "Registrado por"]}
              aligns={["l", "l", "r", "l"]}
              rows={abonos.map((a) => [
                fecha(a.fecha),
                <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{a.documento || "sin folio"}</span>,
                clp(a.monto),
                a.by_label || <span style={{ color: "var(--muted)" }}>no registrado</span>,
              ])}
              empty="Sin abonos registrados."
            />
          </div>
        )}

        {abonoOpen ? (
          <ModalAbono
            clienteId={clienteId}
            onClose={() => setAbonoOpen(false)}
            onDone={(r) => { setFifo(r); setAbonoOpen(false); setReload((k) => k + 1); }}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Form crear/editar (overlay) ───────────────────────────────────────────────
function FormCliente({ inicial, onClose, onSaved }) {
  const editando = !!inicial?._id;
  const [f, setF] = useState(() => ({
    razon_social: inicial?.razon_social || "",
    rut: inicial?.rut ? formatRut(inicial.rut) : "",
    nombre: inicial?.contacto?.nombre || "",
    telefono: inicial?.contacto?.telefono || "",
    email: inicial?.contacto?.email || "",
    habilitado: !!inicial?.credito?.habilitado,
    linea: inicial?.credito?.linea ?? 0,
    condicion_dias: inicial?.credito?.condicion_dias ?? 30,
    dias_gracia: inicial?.credito?.dias_gracia ?? 7,
    bloqueado: !!inicial?.credito?.bloqueado,
    bloqueo_motivo: inicial?.credito?.bloqueo_motivo || "",
  }));
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setB = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.checked }));

  const guardar = async () => {
    setErr(null);
    if (!f.razon_social.trim()) { setErr("La razón social es obligatoria."); return; }
    if (!rutValido(f.rut)) { setErr("RUT inválido: revisa el dígito verificador."); return; }
    if (f.bloqueado && !f.bloqueo_motivo.trim()) { setErr("Indica el motivo del bloqueo manual."); return; }
    const payload = {
      razon_social: f.razon_social.trim(),
      contacto: { nombre: f.nombre.trim(), telefono: f.telefono.trim(), email: f.email.trim() },
      credito: {
        habilitado: f.habilitado,
        linea: Math.max(0, Math.round(Number(f.linea) || 0)),
        condicion_dias: Number(f.condicion_dias) || 30,
        dias_gracia: Math.max(0, Math.round(Number(f.dias_gracia) || 0)),
        bloqueado: f.bloqueado,
        bloqueo_motivo: f.bloqueado ? f.bloqueo_motivo.trim() : "",
      },
    };
    const rn = rutNorm(f.rut);
    // El RUT se manda al crear siempre; al editar, solo si cambió (evita 409 contra sí mismo).
    if (!editando || rn !== inicial.rut) payload.rut = rn;
    setBusy(true);
    try {
      if (!usingMock) {
        if (editando) await api.patchCliente(inicial._id, payload);
        else await api.crearCliente(payload);
      }
      onSaved();
    } catch (e) {
      setErr(e.status === 409 ? "Ya existe un cliente con ese RUT." : (e.message || "No se pudo guardar"));
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(42,16,34,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1050, padding: 16, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: "100%", marginBottom: 0, maxHeight: "94vh", overflowY: "auto" }}>
        <div className="card-h">
          <h2>{editando ? "Editar cliente" : "Nuevo cliente"}</h2>
          <div className="spacer" />
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "6px 4px 4px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={lbl}>Razón social *</div>
              <input value={f.razon_social} onChange={set("razon_social")} placeholder="Minimarket La Esquina SpA" style={inp} autoFocus />
            </div>
            <div>
              <div style={lbl}>RUT *</div>
              <input
                value={f.rut}
                onChange={(e) => setF((s) => ({ ...s, rut: formatRut(e.target.value) }))}
                placeholder="12.345.678-9"
                style={{ ...inp, borderColor: f.rut && !rutValido(f.rut) ? "var(--danger, #b00020)" : "#d9d2dc" }}
              />
              {f.rut && !rutValido(f.rut) ? <div style={{ fontSize: 11.5, color: "var(--danger, #b00020)", marginTop: 3 }}>Dígito verificador incorrecto</div> : null}
            </div>
            <div>
              <div style={lbl}>Contacto</div>
              <input value={f.nombre} onChange={set("nombre")} placeholder="Nombre" style={inp} />
            </div>
            <div>
              <div style={lbl}>Teléfono</div>
              <input value={f.telefono} onChange={set("telefono")} placeholder="+56 9 …" style={inp} />
            </div>
            <div>
              <div style={lbl}>Email</div>
              <input value={f.email} onChange={set("email")} placeholder="correo@…" style={inp} />
            </div>
          </div>

          {/* Sección CRÉDITO */}
          <div style={{ border: "1px solid var(--border-soft, #ece4f0)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <b style={{ fontSize: 14 }}>Crédito</b>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={f.habilitado} onChange={setB("habilitado")} /> habilitado
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
              Todo cliente nuevo parte al contado; el crédito se habilita aquí (línea + condición + días de gracia).
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, opacity: f.habilitado ? 1 : 0.5 }}>
              <div>
                <div style={lbl}>Línea (CLP)</div>
                <input value={f.linea} onChange={set("linea")} inputMode="numeric" placeholder="$" style={inp} disabled={!f.habilitado} />
              </div>
              <div>
                <div style={lbl}>Condición</div>
                <select value={f.condicion_dias} onChange={set("condicion_dias")} style={inp} disabled={!f.habilitado}>
                  {[7, 15, 30, 60, 90].map((n) => <option key={n} value={n}>{n} días</option>)}
                </select>
              </div>
              <div>
                <div style={lbl}>Días de gracia</div>
                <input value={f.dias_gracia} onChange={set("dias_gracia")} inputMode="numeric" style={inp} disabled={!f.habilitado} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", color: f.bloqueado ? "var(--danger, #b00020)" : "inherit" }}>
                <input type="checkbox" checked={f.bloqueado} onChange={setB("bloqueado")} /> Bloqueo manual (no puede comprar a crédito)
              </label>
              {f.bloqueado ? (
                <input value={f.bloqueo_motivo} onChange={set("bloqueo_motivo")} placeholder="Motivo del bloqueo (obligatorio, queda auditado)" style={{ ...inp, marginTop: 6 }} />
              ) : null}
            </div>
          </div>

          {err && <div style={{ color: "var(--danger, #b00020)", fontWeight: 600, fontSize: 13 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={btnG}>Cancelar</button>
            <button onClick={guardar} disabled={busy} style={{ ...btnP, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Guardando…" : editando ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function Clientes() {
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useLoad(() => api.clientes(), { items: MOCK_ITEMS, count: MOCK_ITEMS.length }, [reload]);
  const [form, setForm] = useState(null);     // undefined-cerrado: null | {} (crear) | cliente (editar)
  const [fichaId, setFichaId] = useState(null);

  // Puente desde Cobranza: abre la ficha del cliente pedido (una sola vez).
  useEffect(() => {
    try {
      const id = sessionStorage.getItem(CLIENTE_OPEN_KEY);
      if (id) { sessionStorage.removeItem(CLIENTE_OPEN_KEY); setFichaId(id); }
    } catch { /* sin storage */ }
  }, []);

  const items = data?.items || [];

  if (loading && !data) {
    return <div style={{ display: "grid", gap: 12 }}><Skel h={52} /><Skel h={260} /></div>;
  }

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b style={{ fontSize: 16 }}>Clientes · Crédito</b>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Todo cliente nuevo parte <b>al contado</b>; el crédito se habilita por cliente (línea, condición y gracia).
            Clic en una fila abre la ficha con su estado de cuenta.
          </div>
        </div>
        <button onClick={() => setForm({})} style={btnP}>Nuevo cliente</button>
      </div>

      {error && <div className="card" style={{ padding: 12, marginBottom: 12, color: "var(--danger, #b00020)", fontWeight: 600 }}>No se pudo cargar: {error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <Tabla
          head={["", "Cliente", "RUT", "Línea usada", "Saldo", "Disponible", "Mora máx", "Condición", "Estado", ""]}
          aligns={["l", "l", "l", "l", "r", "r", "r", "l", "l", "r"]}
          rows={items.map((c) => {
            const e = c.estado || {};
            const cr = c.credito || {};
            const mora = Number(e.max_mora_dias) || 0;
            return [
              <Sem s={e.semaforo} />,
              <b>{c.razon_social}</b>,
              <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5 }}>{c.rut}</span>,
              cr.habilitado ? <UsoBar pct={e.uso_pct} /> : noAplica,
              clp(e.saldo),
              cr.habilitado ? clp(e.disponible) : noAplica,
              mora > 0
                ? <span style={{ color: mora > (cr.dias_gracia ?? 7) ? "var(--danger, #b00020)" : "var(--warn, #d97706)", fontWeight: 700 }}>{mora} d</span>
                : <span style={{ color: "var(--muted)" }}>0 d</span>,
              cr.habilitado ? `${cr.condicion_dias ?? 30} d` : "contado",
              cr.bloqueado
                ? <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>Bloqueado</span>
                : cr.habilitado
                  ? <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>Activo</span>
                  : <span className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>Sin crédito</span>,
              <button
                onClick={(ev) => { ev.stopPropagation(); setForm(c); }}
                title="Editar datos y crédito"
                style={{ ...btnG, padding: "5px 10px", fontSize: 12 }}
              >
                Editar
              </button>,
            ];
          })}
          onRowClick={(ri) => setFichaId(items[ri]._id)}
          empty="Sin clientes aún. Crea el primero con el botón Nuevo cliente."
        />
      </div>

      {form ? (
        <FormCliente
          inicial={form._id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); setReload((k) => k + 1); }}
        />
      ) : null}

      {fichaId ? (
        <FichaCliente
          clienteId={fichaId}
          onClose={() => { setFichaId(null); setReload((k) => k + 1); }}
          onEdit={(c) => { setFichaId(null); setForm(c); }}
        />
      ) : null}
    </div>
  );
}

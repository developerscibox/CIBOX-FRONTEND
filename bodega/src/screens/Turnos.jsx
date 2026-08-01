import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, usingMock } from "../api.js";
import { t } from "../theme.js";

// Panel del vendedor: muestra el QR para imprimir (el cliente lo escanea y saca
// su número) y la fila de atención con "Llamar siguiente" + atender/listo/anular.
export default function Turnos() {
  const turnoUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/turno";
  const [qr, setQr] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    QRCode.toDataURL(turnoUrl, { width: 260, margin: 1, color: { dark: "#9B007A", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [turnoUrl]);

  async function refresh() {
    if (usingMock) return;
    try { const d = await api.turnosAdmin(); setItems(d.items || []); setErr(""); }
    catch (e) { setErr(e.message); }
  }

  useEffect(() => {
    refresh();
    if (usingMock) return;
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function llamarSiguiente() {
    if (busy || usingMock) return;
    setBusy(true); setMsg(""); setErr("");
    let mod;
    try { mod = localStorage.getItem("b12_modulo") || undefined; } catch { mod = undefined; }
    try {
      const d = await api.callNextTurno(mod);
      setMsg(
        d.turno
          ? `Llamaste a ${d.turno.code} · ${d.turno.name}${d.turno.module ? ` (${d.turno.module})` : ""}`
          : "No hay turnos en espera.",
      );
      await refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function act(fn, id, label) {
    if (busy || usingMock) return;
    setBusy(true); setMsg(""); setErr("");
    try { await fn(id); setMsg(label); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const enEspera = items.filter((i) => i.status === "waiting");
  const enAtencion = items.filter((i) => i.status === "calling" || i.status === "attending");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      {/* ── QR para imprimir ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, textAlign: "center", flex: "1 1 260px", maxWidth: 340 }}>
        <div className="card-h" style={{ justifyContent: "center", border: 0, padding: 0, marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>QR de turnos</h2>
        </div>
        {qr ? (
          <img src={qr} alt="QR para sacar turno" style={{ width: 220, height: 220, borderRadius: 12, border: "1px solid var(--border)" }} />
        ) : (
          <div style={{ width: 220, height: 220, margin: "0 auto", display: "grid", placeItems: "center", color: t.muted }}>Generando QR…</div>
        )}
        <div style={{ fontSize: 13, color: t.muted, marginTop: 12, lineHeight: 1.5 }}>
          Imprímelo y pégalo en la entrada o el mostrador. El cliente lo escanea,
          escribe su nombre y recibe su número.
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 8, wordBreak: "break-all" }}>{turnoUrl}</div>
        <a href="/pantalla" target="_blank" rel="noreferrer" style={{
          display: "inline-block", marginTop: 12, textDecoration: "none", color: t.magenta,
          border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 600,
        }}>Abrir pantalla pública</a>
      </div>

      {/* ── Fila de atención ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, flex: "999 1 380px", minWidth: 0 }}>
        <div className="card-h" style={{ border: 0, padding: 0, marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Fila de atención</h2>
          <button className="btn btn-primary" style={{ fontSize: 15 }} onClick={llamarSiguiente} disabled={busy || usingMock}>
            Llamar siguiente
          </button>
        </div>

        {usingMock ? (
          <div className="hint">Disponible al conectar el backend real (modo demostración no tiene turnos en vivo).</div>
        ) : null}
        {msg ? <div className="ok-msg" style={{ marginTop: 0, marginBottom: 12 }}>{msg}</div> : null}
        {err ? (
          <div
            className="ok-msg"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, white)",
              borderColor: "color-mix(in srgb, var(--danger) 35%, white)",
              color: "var(--danger)",
              marginBottom: 12,
            }}
          >
            {err}
          </div>
        ) : null}

        {/* En atención ahora */}
        <div style={sectionTitleS}>EN ATENCIÓN</div>
        {enAtencion.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "6px 0 12px" }}>Nadie llamado aún.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {enAtencion.map((tn) => (
              <div key={tn._id} style={rowS(tn.status === "calling" ? "color-mix(in srgb, var(--ok) 7%, white)" : "color-mix(in srgb, var(--warn) 9%, white)")}>
                <span style={codeS}>{tn.code}</span>
                <span style={{ flex: 1, minWidth: 120, fontWeight: 600 }}>{tn.name}</span>
                {tn.tipo ? <span style={tipoChipS(tn.tipo)}>{tn.tipo === "retiro" ? "Retiro" : "Compra"}</span> : null}
                {tn.tipo === "retiro" && tn.rut ? (
                  <span style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap" }}>RUT {tn.rut}</span>
                ) : null}
                <span style={{ fontSize: 12, color: t.muted, marginRight: 8 }}>
                  {tn.status === "calling" ? "llamado" : "atendiendo"}
                </span>
                {tn.status === "calling" ? (
                  <button className="btn" style={btnS} onClick={() => act(api.attendTurno, tn._id, `${tn.code} en atención`)} disabled={busy}>Atender</button>
                ) : null}
                <button className="btn" style={{ ...btnS, color: t.ok }} onClick={() => act(api.doneTurno, tn._id, `${tn.code} finalizado`)} disabled={busy}>Listo</button>
                <button className="btn" style={{ ...btnS, color: t.danger }} onClick={() => act(api.cancelTurno, tn._id, `${tn.code} anulado`)} disabled={busy}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* En espera */}
        <div style={sectionTitleS}>EN ESPERA · {enEspera.length}</div>
        {enEspera.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "6px 0" }}>La fila está vacía.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {enEspera.map((tn) => (
              <div key={tn._id} style={rowS("#fff")}>
                <span style={codeS}>{tn.code}</span>
                <span style={{ flex: 1, minWidth: 120, fontWeight: 600 }}>{tn.name}</span>
                {tn.tipo ? <span style={tipoChipS(tn.tipo)}>{tn.tipo === "retiro" ? "Retiro" : "Compra"}</span> : null}
                {tn.tipo === "retiro" && tn.rut ? (
                  <span style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap" }}>RUT {tn.rut}</span>
                ) : null}
                <button className="btn" style={{ ...btnS, color: t.danger }} onClick={() => act(api.cancelTurno, tn._id, `${tn.code} anulado`)} disabled={busy}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionTitleS = { fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: t.muted, margin: "4px 0 6px" };
const rowS = (bg) => ({
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, background: bg,
  border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px",
});
const codeS = { fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: 18, color: "var(--magenta-d)", minWidth: 64 };
const btnS = { padding: "7px 10px", fontSize: 13 };
// Chip del tipo de turno: compra (neutro) / retiro de pedido web (magenta corporativo).
const tipoChipS = (tipo) => ({
  fontSize: 12, fontWeight: 800, borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap",
  background: tipo === "retiro" ? "color-mix(in srgb, var(--magenta) 10%, white)" : "color-mix(in srgb, var(--muted) 12%, white)",
  color: tipo === "retiro" ? "var(--magenta-d)" : "var(--muted)",
});

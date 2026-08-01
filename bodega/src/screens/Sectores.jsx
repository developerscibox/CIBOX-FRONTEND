import { useEffect, useState } from "react";
import { api, usingMock } from "../api.js";
import { Tabla, Skel } from "../components/Ui.jsx";

// Admin del recorrido de picking (products.manage): sectores/zonas de la bodega.
// El orden define el recorrido — el vale impreso y el checklist del picking
// agrupan los ítems por sector en ESTE orden. Cada sector activo puede tener su
// monitor de zona en /zona?s=Nombre (dueño de área marca "cajas listas").
const PILOTO = ["Lácteos", "Galletas", "Congelados"];
const MOCK = PILOTO.map((nombre, i) => ({ nombre, orden: i + 1, activo: true }));

export default function Sectores() {
  const [rows, setRows] = useState(null); // null = cargando
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  const fromServer = (sectores) =>
    (sectores || []).map((s) => ({ nombre: s.nombre, orden: Number(s.orden) || 0, activo: s.activo !== false, nuevo: false }));

  useEffect(() => {
    if (usingMock) { setRows(MOCK.map((s) => ({ ...s, nuevo: false }))); return; }
    let alive = true;
    api.sectores()
      .then((d) => { if (alive) setRows(fromServer(d?.sectores)); })
      .catch((e) => { if (alive) { setRows([]); setErr(e.message); } });
    return () => { alive = false; };
  }, []);

  const patch = (i, p) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
    setDirty(true); setOkMsg("");
  };
  // ↑↓: intercambia filas y renumera TODO el recorrido 1..n (mantiene coherencia).
  const move = (i, dir) => {
    setRows((rs) => {
      const next = [...rs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((r, k) => ({ ...r, orden: k + 1 }));
    });
    setDirty(true); setOkMsg("");
  };
  const add = (nombre = "") => {
    setRows((rs) => [...rs, { nombre, orden: rs.length + 1, activo: true, nuevo: true }]);
    setDirty(true); setOkMsg("");
  };

  async function save() {
    if (busy || usingMock || !rows) return;
    const items = rows
      .filter((r) => String(r.nombre || "").trim())
      .map((r) => ({ nombre: String(r.nombre).trim(), orden: Number(r.orden) || 0, activo: r.activo !== false }));
    setBusy(true); setErr(""); setOkMsg("");
    try {
      const d = await api.putSectores(items);
      setRows(fromServer(d?.sectores));
      setDirty(false);
      setOkMsg("Recorrido guardado ✔ — el vale impreso, el checklist del picking y los monitores de zona ya usan este orden.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const nombres = new Set((rows || []).map((r) => String(r.nombre).trim().toLowerCase()));
  const faltantes = PILOTO.filter((n) => !nombres.has(n.toLowerCase()));

  return (
    <div className="card">
      <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2>Sectores / Zonas</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => add()} disabled={busy || !rows}>Agregar sector</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || usingMock || !dirty || !rows}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 20px 20px" }}>
        <div className="hint" style={{ marginTop: 0 }}>
          El <b>orden define el recorrido del picking</b> (y cómo agrupa el vale y el checklist);
          deja <b>Congelados al final</b> para que la cadena de frío se corte lo menos posible.
          Cada zona tiene su monitor propio: <b>/zona?s=Nombre</b> (el dueño de área marca “cajas listas”).
        </div>

        {faltantes.length ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "12px 0 2px" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Piloto sugerido:</span>
            {faltantes.map((n) => (
              <button key={n} className="btn" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => add(n)}>
                {n}
              </button>
            ))}
          </div>
        ) : null}

        {usingMock ? <div className="hint">Modo demostración — conecta el backend para guardar.</div> : null}
        {err ? (
          <div
            className="ok-msg"
            style={{
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
              color: "var(--danger)",
            }}
          >
            {err}
          </div>
        ) : null}
        {okMsg ? <div className="ok-msg">{okMsg}</div> : null}

        <div style={{ marginTop: 12 }}>
          {!rows ? (
            <Skel h={160} />
          ) : (
            <Tabla
              head={["#", "Sector", "Orden", "Activo", "Mover", "Monitor"]}
              aligns={["l", "l", "r", "l", "l", "l"]}
              empty="Sin sectores aún — agrega el primero (ej: Lácteos)."
              rows={rows.map((r, i) => [
                <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>,
                r.nuevo ? (
                  <input
                    autoFocus={!r.nombre}
                    value={r.nombre}
                    onChange={(e) => patch(i, { nombre: e.target.value })}
                    placeholder="Nombre del sector"
                    maxLength={40}
                    style={{ padding: "6px 9px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, width: 180 }}
                  />
                ) : (
                  <span style={{ fontWeight: 700, opacity: r.activo ? 1 : 0.5 }}>{r.nombre}</span>
                ),
                <input
                  type="number"
                  value={r.orden}
                  min={0}
                  onChange={(e) => patch(i, { orden: e.target.value === "" ? "" : Number(e.target.value) })}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, width: 70, textAlign: "right" }}
                />,
                <button
                  className="btn"
                  style={{ padding: "5px 10px", fontSize: 12.5, color: r.activo ? "var(--ok)" : "var(--muted)" }}
                  onClick={() => patch(i, { activo: !r.activo })}
                  title={r.activo ? "Desactivar (no aparece en el recorrido)" : "Activar"}
                >
                  {r.activo ? "● Activo" : "○ Inactivo"}
                </button>,
                <span style={{ display: "inline-flex", gap: 4 }}>
                  <button className="btn" style={{ padding: "4px 9px" }} onClick={() => move(i, -1)} disabled={i === 0} title="Subir en el recorrido">↑</button>
                  <button className="btn" style={{ padding: "4px 9px" }} onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Bajar en el recorrido">↓</button>
                </span>,
                String(r.nombre || "").trim() && !r.nuevo ? (
                  <a href={`/zona?s=${encodeURIComponent(String(r.nombre).trim())}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--magenta)" }}>
                    Abrir monitor
                  </a>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Disponible al guardar</span>
                ),
              ])}
            />
          )}
        </div>

        <div className="hint">
          Guardar <b>no borra</b> sectores existentes (se actualizan por nombre); para sacar uno del
          recorrido, desactívalo. Los productos usan este nombre en su campo <b>sector</b>.
        </div>
      </div>
    </div>
  );
}

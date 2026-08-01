import { useEffect, useState } from "react";
import { api, usingMock } from "../api.js";
import { t } from "../theme.js";

// Config de módulos de atención (mostradores/cajas). admin/gerente.
// El vendedor elige su módulo en Venta Manual; si hay más de uno, la pantalla
// pública muestra a qué módulo debe ir cada cliente.
const MOCK = [
  { _id: "m1", name: "Caja 1", active: true },
  { _id: "m2", name: "Mesón", active: true },
];

export default function Modulos() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    if (usingMock) { setItems(MOCK); return; }
    try { const d = await api.modules(); setItems(d.items || []); setErr(""); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function add(e) {
    e.preventDefault();
    if (!name.trim() || busy || usingMock) return;
    setBusy(true); setErr("");
    try { await api.createModule(name.trim()); setName(""); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function toggle(m) {
    if (busy || usingMock) return;
    setBusy(true); setErr("");
    try { await api.updateModule(m._id, { active: !m.active }); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function rename(m) {
    if (usingMock) return;
    const nn = window.prompt("Nuevo nombre del módulo:", m.name);
    if (nn == null || !nn.trim()) return;
    setBusy(true); setErr("");
    try { await api.updateModule(m._id, { name: nn.trim() }); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove(m) {
    if (usingMock || !window.confirm(`¿Eliminar el módulo "${m.name}"?`)) return;
    setBusy(true); setErr("");
    try { await api.deleteModule(m._id); await refresh(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-h"><h2>Módulos de atención</h2></div>
      <div style={{ padding: 20 }}>
        <div className="hint" style={{ marginTop: 0 }}>
          Los mostradores/cajas donde se atiende a los clientes. El vendedor elige su módulo en
          Venta Manual al “Llamar al siguiente”; si hay más de uno activo, la pantalla pública
          muestra a qué módulo debe ir cada cliente.
        </div>

        <form onSubmit={add} style={{ display: "flex", gap: 8, margin: "16px 0" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja 1, Mesón, Box 2"
            maxLength={40}
            style={{ flex: 1, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <button className="btn btn-primary" disabled={!name.trim() || busy || usingMock}>+ Agregar</button>
        </form>

        {usingMock ? <div className="hint" style={{ marginTop: 0 }}>Disponible al conectar el backend real.</div> : null}
        {err ? (
          <div role="alert" style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--danger)", color: "var(--danger)", fontSize: 13.5, fontWeight: 600 }}>
            {err}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, textAlign: "center", padding: "24px 0", border: "1px dashed var(--border)", borderRadius: 10 }}>
            Aún no hay módulos de atención.
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Agrega el primero con el formulario de arriba.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((m) => (
              <div key={m._id} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ fontWeight: 700, flex: 1, minWidth: 120, opacity: m.active ? 1 : 0.55 }}>
                  {m.name}
                  {!m.active ? (
                    <span className="badge" style={{ marginLeft: 8, background: "var(--border-soft)", color: "var(--muted)" }}>Inactivo</span>
                  ) : null}
                </span>
                <button className="btn" style={btn} onClick={() => toggle(m)} disabled={busy}>{m.active ? "Desactivar" : "Activar"}</button>
                <button className="btn" style={btn} onClick={() => rename(m)} disabled={busy}>Renombrar</button>
                <button className="btn" style={{ ...btn, color: t.danger }} onClick={() => remove(m)} disabled={busy} title="Eliminar módulo" aria-label={`Eliminar ${m.name}`}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btn = { padding: "7px 10px", fontSize: 13 };

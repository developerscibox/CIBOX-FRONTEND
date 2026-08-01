import { useEffect, useRef, useState } from "react";
import { api, usingMock } from "../api.js";

export default function Ajustes() {
  // Buscador real de productos (debounce) en vez de abusar de low-stock.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // { _id, name, stock }

  const [tipo, setTipo] = useState("ingreso");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const debRef = useRef(null);

  // Debounce: 300ms tras el último tecleo → api.products({ search }).
  useEffect(() => {
    const q = query.trim();
    if (debRef.current) clearTimeout(debRef.current);
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      try {
        const res = usingMock
          ? { items: [] }
          : await api.products({ search: q, limit: 20, include_inactive: false });
        setResults(res?.items || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query]);

  const productId = selected?._id || "";
  // Cantidad válida = entero ≥ 1 (vacío → Number("")=0, decimales → rechaza el backend).
  const qtyNum = Number(qty);
  const qtyValid = Number.isInteger(qtyNum) && qtyNum >= 1;

  function pick(p) {
    setSelected(p);
    setResults([]);
    setQuery("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!productId) return;
    if (reason.trim().length < 3) {
      setError("El motivo debe tener al menos 3 caracteres");
      setDone(null);
      return;
    }
    if (!qtyValid) {
      setError("La cantidad debe ser un número entero de 1 o más");
      setDone(null);
      return;
    }
    // "ajuste" corrige el inventario (conteo, error de carga) y puede ir en
    // cualquier dirección; "merma" es pérdida real y siempre resta.
    const delta = tipo === "ingreso" ? Math.abs(qtyNum) : -Math.abs(qtyNum);
    const movType = tipo === "ingreso" ? "recepcion" : tipo === "merma" ? "merma" : "ajuste";
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      // En real: POST /inventory/adjust { product_id, delta, reason }
      // ajusta stock y deja el movimiento en el kardex en la misma transacción.
      const res = usingMock
        ? { name: selected?.name, stock: (selected?.stock ?? 0) + delta }
        : await api.adjust({ product_id: productId, delta, reason: reason.trim(), type: movType });
      setDone({ name: res.name || selected?.name, delta, stock: res.stock, reason: reason.trim() });
      setReason("");
      setQty(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <div className="card-h"><h2>Ajuste manual de stock</h2></div>
      <form className="form" style={{ padding: 20 }} onSubmit={submit}>
        <div className="field">
          <label>Producto</label>
          {selected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, fontWeight: 600 }}>
                {selected.name}
                <span style={{ color: "var(--muted)", fontWeight: 400 }}> · stock {selected.stock ?? 0}</span>
              </div>
              <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setSelected(null)}>
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por nombre, marca o código…"
                autoFocus
              />
              {query.trim() ? (
                <div style={{ border: "1px solid var(--border)", borderRadius: 9, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
                  {searching ? (
                    <div style={{ padding: 12, color: "var(--muted)", fontSize: 13 }}>Buscando…</div>
                  ) : results.length === 0 ? (
                    <div style={{ padding: 12, color: "var(--muted)", fontSize: 13 }}>Sin coincidencias</div>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => pick(p)}
                        style={{
                          display: "block", width: "100%", textAlign: "left", border: "none",
                          borderBottom: "1px solid var(--border)", background: "#fff", cursor: "pointer",
                          padding: "10px 12px", fontSize: 14,
                        }}
                      >
                        <b>{p.name}</b>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                          {p.barcode ? ` · ${p.barcode}` : ""} · stock {p.stock ?? 0}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <div className="hint">Escribe para buscar y elige el producto a ajustar.</div>
            </>
          )}
        </div>

        <div className="field">
          <label>Tipo de ajuste</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="ingreso">+ Entrada · recepción, conteo a favor</option>
            <option value="ajuste">− Ajuste · corrección de inventario, error de carga</option>
            <option value="merma">− Merma · rotura, vencimiento, robo</option>
          </select>
        </div>

        <div className="field">
          <label>Cantidad</label>
          <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          {!qtyValid ? (
            <div className="hint" style={{ color: "var(--danger)" }}>Ingresa una cantidad entera de 1 o más.</div>
          ) : null}
        </div>

        <div className="field">
          <label>Motivo <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea rows="2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Obligatorio — queda registrado en el kardex con tu nombre" />
          <div className="hint">Todo ajuste exige motivo y queda auditado: quién, cuándo y por qué. El backend lo valida.</div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy || reason.trim().length < 3 || !productId || !qtyValid}>
          {busy ? "Registrando…" : "Registrar ajuste"}
        </button>

        {error ? (
          <div className="ok-msg" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)", borderColor: "var(--danger)", color: "var(--danger)" }}>
            No se pudo registrar: {error}
          </div>
        ) : null}
        {done ? (
          <div className="ok-msg">
            ✓ Ajuste registrado: <b>{done.delta > 0 ? "+" : ""}{done.delta}</b> en “{done.name}”
            {done.stock != null ? <> — stock ahora <b>{done.stock}</b></> : null}.
            <div style={{ fontWeight: 400, fontSize: 13, marginTop: 4 }}>Movimiento escrito en el kardex (motivo: “{done.reason}”).</div>
          </div>
        ) : null}
      </form>
    </div>
  );
}

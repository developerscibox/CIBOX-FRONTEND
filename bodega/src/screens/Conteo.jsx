import { useEffect, useMemo, useRef, useState } from "react";
import { api, usingMock } from "../api.js";
import { t } from "../theme.js";

// Conteo físico (cycle count) — Fase C. El operador inicia un conteo por
// sector/categoría/todo, registra las cantidades reales (guardado progresivo) y
// al cerrar el sistema aplica los ajustes dejando el stock = lo contado
// (autoritativo). Reusa adjustStock en el backend (atómico, kardex, FEFO).

// ── Datos demo (solo sin backend) ─────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { _id: "p1", name: "Coca-Cola 1.5L", sku: "CC15", barcode: "7790001", stock: 48, location: { sector: "Bebidas" }, category: { id: "c2", name: "Bebidas" } },
  { _id: "p2", name: "Arroz grado 1 · 1kg", sku: "AR1", barcode: "7790002", stock: 30, location: { sector: "Abarrotes" }, category: { id: "c1", name: "Abarrotes" } },
  { _id: "p3", name: "Fideos 400g", sku: "FD4", barcode: "7790004", stock: 60, location: { sector: "Abarrotes" }, category: { id: "c1", name: "Abarrotes" } },
  { _id: "p4", name: "Detergente 3kg", sku: "DET3", barcode: "7790003", stock: 14, location: { sector: "Aseo" }, category: { id: "c3", name: "Aseo" } },
];
const MOCK_CATS = { items: [{ _id: "c1", name: "Abarrotes" }, { _id: "c2", name: "Bebidas" }, { _id: "c3", name: "Aseo" }] };
const MOCK_HISTORY = [
  { _id: "h1", scope: { type: "sector", label: "Bebidas" }, status: "closed", closed_at: "2026-06-25T12:00:00Z", applied: { lines_adjusted: 3, units_delta: -7 } },
];

const SCOPE_LABEL = { sector: "Sector", category: "Categoría", all: "Todo el inventario" };

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
};

// Color del diff: 0 gris, + verde, − rojo.
const diffColor = (d) => (d > 0 ? t.ok : d < 0 ? t.danger : t.muted);
const diffStr = (d) => (d > 0 ? `+${d}` : String(d));

export default function Conteo() {
  // ── Datos de catálogo (para iniciar el conteo) ──────────────────────────────
  const [cats, setCats] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);

  // ── Conteo activo y lista de sesiones ───────────────────────────────────────
  const [active, setActive] = useState(null);   // CycleCount open completo (con líneas)
  const [openSessions, setOpenSessions] = useState([]); // todos los conteos open (elegir cuál retomar)
  const [history, setHistory] = useState([]);    // conteos cerrados/cancelados recientes
  const [loading, setLoading] = useState(!usingMock);
  const [error, setError] = useState(null);

  // ── Iniciar conteo ──────────────────────────────────────────────────────────
  const [scopeType, setScopeType] = useState("sector");
  const [scopeValue, setScopeValue] = useState(""); // value del sector/categoría elegido
  const [starting, setStarting] = useState(false);

  // ── Contar ──────────────────────────────────────────────────────────────────
  const [counts, setCounts] = useState({});       // { product_id: "12" } (string en edición)
  const [savingIds, setSavingIds] = useState({}); // { product_id: true } durante el PATCH
  const [search, setSearch] = useState("");
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [appliedResult, setAppliedResult] = useState(null); // resumen tras cerrar
  const baselineRef = useRef({});                  // counted_qty servidor por línea (para no re-PATCH iguales)
  const savingRef = useRef(new Set());             // PATCH en vuelo (el cierre los espera)

  // Carga inicial: catálogo (sectores + categorías) y sesiones de conteo.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (usingMock) {
        setCats(MOCK_CATS.items);
        setSectors([...new Set(MOCK_PRODUCTS.map((p) => p.location?.sector).filter(Boolean))]);
        setCatalogReady(true);
        setHistory(MOCK_HISTORY);
        setLoading(false);
        return;
      }
      try {
        // Catálogo para derivar sectores: páginas de 500 (máx. del backend),
        // hasta 3 páginas si hay más (has_next).
        const fetchAllProducts = async () => {
          const acc = [];
          for (let page = 1; page <= 3; page += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await api.products({ limit: 500, page, include_inactive: false });
            acc.push(...(res?.items || []));
            if (!res?.pagination?.has_next) break;
          }
          return acc;
        };
        let prodErr = null;
        const [catsRes, prodItems, countsRes] = await Promise.all([
          api.categories({ limit: 100 }).catch(() => ({ items: [] })),
          fetchAllProducts().catch((e) => { prodErr = e; return []; }),
          api.counts({ limit: 20 }).catch(() => ({ items: [] })),
        ]);
        if (!alive) return;
        setCats(catsRes?.items || catsRes?.categories || []);
        const secs = [...new Set(prodItems.map((p) => p.location?.sector).filter(Boolean))].sort();
        setSectors(secs);
        setCatalogReady(true);
        if (prodErr) setError(`No se pudieron cargar los sectores del catálogo: ${prodErr.message}`);
        const sessions = countsRes?.items || [];
        const opens = sessions.filter((s) => s.status === "open");
        setOpenSessions(opens);
        setHistory(sessions.filter((s) => s.status !== "open"));
        // Un solo conteo abierto → retomarlo directo; varios → el usuario elige.
        if (opens.length === 1) await loadActive(opens[0]._id);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trae el conteo completo (con líneas) y resetea el estado de edición.
  async function loadActive(id) {
    const data = usingMock ? null : await api.count(id);
    if (!data) return;
    setActive(data);
    const seed = {};
    const base = {};
    for (const ln of data.lines || []) {
      if (ln.counted && ln.counted_qty != null) { seed[ln.product_id] = String(ln.counted_qty); base[ln.product_id] = ln.counted_qty; }
    }
    setCounts(seed);
    baselineRef.current = base;
    setAppliedResult(null);
  }

  // Opciones del selector según el tipo de scope.
  const scopeOptions = useMemo(() => {
    if (scopeType === "sector") return sectors.map((s) => ({ value: s, label: s }));
    if (scopeType === "category") return cats.map((c) => ({ value: c._id, label: c.name }));
    return [];
  }, [scopeType, sectors, cats]);

  // ── Iniciar ────────────────────────────────────────────────────────────────
  async function start() {
    if (scopeType !== "all" && !scopeValue) { setError("Elige un sector o categoría."); return; }
    setStarting(true);
    setError(null);
    const opt = scopeOptions.find((o) => o.value === scopeValue);
    const scope = scopeType === "all"
      ? { type: "all", value: "", label: "Todo el inventario" }
      : { type: scopeType, value: scopeValue, label: opt?.label || scopeValue };
    try {
      if (usingMock) {
        const pool = scopeType === "all"
          ? MOCK_PRODUCTS
          : scopeType === "sector"
            ? MOCK_PRODUCTS.filter((p) => p.location?.sector === scopeValue)
            : MOCK_PRODUCTS.filter((p) => p.category?.id === scopeValue);
        setActive({
          _id: "demo", scope, status: "open",
          lines: pool.map((p) => ({
            product_id: p._id, product_name: p.name, sku: p.sku, barcode: p.barcode,
            theoretical_qty: p.stock, counted_qty: null, counted: false,
          })),
        });
        setCounts({}); baselineRef.current = {}; setAppliedResult(null);
      } else {
        const data = await api.startCount(scope);
        await loadActive(data._id);
      }
      setScopeValue("");
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  // ── Editar / guardar una línea ───────────────────────────────────────────────
  const setLineCount = (pid, raw) => setCounts((c) => ({ ...c, [pid]: raw }));

  // Guardado progresivo al salir del input: PATCH solo si cambió y es válido (>=0).
  async function saveLine(pid) {
    const raw = counts[pid];
    if (raw == null || raw === "") return;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return;
    if (baselineRef.current[pid] === n) return; // sin cambio real
    setSavingIds((s) => ({ ...s, [pid]: true }));
    savingRef.current.add(pid);
    try {
      if (usingMock) {
        setActive((cc) => cc && ({ ...cc, lines: cc.lines.map((ln) => ln.product_id === pid ? { ...ln, counted_qty: n, counted: true } : ln) }));
        baselineRef.current = { ...baselineRef.current, [pid]: n };
      } else {
        const data = await api.saveCounts(active._id, [{ product_id: pid, counted_qty: n }]);
        setActive(data);
        baselineRef.current = { ...baselineRef.current, [pid]: n };
      }
    } catch (e) {
      setError(e.message);
    } finally {
      savingRef.current.delete(pid);
      setSavingIds((s) => { const next = { ...s }; delete next[pid]; return next; });
    }
  }

  // ── Cerrar / cancelar ────────────────────────────────────────────────────────
  async function close() {
    const resumen = summary;
    const ok = window.confirm(
      `Se cerrará el conteo y se aplicarán los ajustes.\n\n` +
      `Se ajustarán ${resumen.toAdjust} producto(s), Δ ${diffStr(resumen.netDelta)} unidades.\n` +
      `El stock quedará igual a lo contado. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    setClosing(true);
    setError(null);
    try {
      // Espera los PATCH de líneas en vuelo (blur reciente) antes de aplicar el
      // cierre: evita cerrar en el backend sin la última línea tecleada.
      while (savingRef.current.size > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 120));
      }
      if (usingMock) {
        const applied = { lines_adjusted: resumen.toAdjust, units_delta: resumen.netDelta };
        setHistory((h) => [{ _id: active._id, scope: active.scope, status: "closed", closed_at: new Date().toISOString(), applied }, ...h]);
        setAppliedResult(applied);
        setOpenSessions((os) => os.filter((s) => s._id !== active._id));
        setActive(null); setCounts({});
      } else {
        const data = await api.closeCount(active._id);
        setAppliedResult(data.applied || { lines_adjusted: 0, units_delta: 0 });
        setHistory((h) => [data, ...h]);
        setOpenSessions((os) => os.filter((s) => s._id !== active._id));
        setActive(null); setCounts({});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  }

  async function cancel() {
    if (!window.confirm("¿Cancelar el conteo? No se aplicará ningún ajuste.")) return;
    setCancelling(true);
    setError(null);
    try {
      if (usingMock) {
        setHistory((h) => [{ _id: active._id, scope: active.scope, status: "cancelled", closed_at: new Date().toISOString(), applied: null }, ...h]);
        setOpenSessions((os) => os.filter((s) => s._id !== active._id));
        setActive(null); setCounts({});
      } else {
        const data = await api.cancelCount(active._id);
        setHistory((h) => [data, ...h]);
        setOpenSessions((os) => os.filter((s) => s._id !== active._id));
        setActive(null); setCounts({});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  }

  // ── Derivados del conteo activo ──────────────────────────────────────────────
  // diff por línea = contado (en edición o persistido) − teórico.
  const rows = useMemo(() => {
    if (!active) return [];
    return (active.lines || []).map((ln) => {
      const raw = counts[ln.product_id];
      const hasInput = raw != null && raw !== "";
      const counted = hasInput ? Math.floor(Number(raw)) : (ln.counted ? ln.counted_qty : null);
      const isCounted = counted != null && Number.isFinite(counted);
      const diff = isCounted ? counted - ln.theoretical_qty : 0;
      return { ...ln, counted, isCounted, diff };
    });
  }, [active, counts]);

  const summary = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.isCounted).length;
    const netDelta = rows.reduce((a, r) => a + (r.isCounted ? r.diff : 0), 0);
    const toAdjust = rows.filter((r) => r.isCounted && r.diff !== 0).length;
    return { total, done, netDelta, toAdjust };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.product_name || "").toLowerCase().includes(q) ||
      (r.sku || "").toLowerCase().includes(q) ||
      (r.barcode || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  if (loading) return <div className="card" style={{ padding: 24, color: t.muted }}>Cargando conteo…</div>;

  return (
    <div>
      {error ? (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14, background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", fontSize: 13.5, fontWeight: 600 }}>
          {error}
        </div>
      ) : null}

      {appliedResult ? (
        <div className="ok-msg" style={{ marginBottom: 14 }}>
          ✓ Conteo cerrado: <b>{appliedResult.lines_adjusted}</b> producto(s) ajustado(s),
          Δ <b style={{ color: diffColor(appliedResult.units_delta) }}>{diffStr(appliedResult.units_delta)}</b> unidades.
          El stock quedó igual a lo contado y los ajustes están en el kardex.
        </div>
      ) : null}

      {!active ? (
        <>
          {openSessions.length > 0 ? (
            <div className="card" style={{ maxWidth: 640, marginBottom: 18 }}>
              <div className="card-h"><h2>Conteos abiertos</h2></div>
              <div style={{ padding: "6px 20px 16px" }}>
                <p style={{ margin: "8px 0 4px", color: t.muted, fontSize: 13.5 }}>
                  Hay {openSessions.length} conteo{openSessions.length === 1 ? "" : "s"} abierto{openSessions.length === 1 ? "" : "s"}.
                  Elige cuál retomar, o inicia otro de un alcance distinto.
                </p>
                {openSessions.map((s) => (
                  <div key={s._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <b>{s.scope?.label || SCOPE_LABEL[s.scope?.type] || "Conteo"}</b>
                      <div style={{ fontSize: 12, color: t.muted }}>{SCOPE_LABEL[s.scope?.type] || "Alcance"} · iniciado {fmtDate(s.created_at)}</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => loadActive(s._id).catch((e) => setError(e.message))}>
                      Retomar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <StartCard
            scopeType={scopeType} setScopeType={(v) => { setScopeType(v); setScopeValue(""); }}
            scopeValue={scopeValue} setScopeValue={setScopeValue}
            scopeOptions={scopeOptions} catalogReady={catalogReady}
            starting={starting} onStart={start}
          />
        </>
      ) : (
        <ActiveCount
          active={active} rows={filteredRows} summary={summary}
          counts={counts} savingIds={savingIds}
          search={search} setSearch={setSearch}
          setLineCount={setLineCount} saveLine={saveLine}
          closing={closing} cancelling={cancelling}
          onClose={close} onCancel={cancel}
        />
      )}

      <HistoryCard history={history} />
    </div>
  );
}

// ── Tarjeta: iniciar conteo ───────────────────────────────────────────────────
function StartCard({ scopeType, setScopeType, scopeValue, setScopeValue, scopeOptions, catalogReady, starting, onStart }) {
  const needsValue = scopeType !== "all";
  const noOptions = needsValue && catalogReady && scopeOptions.length === 0;
  return (
    <div className="card" style={{ maxWidth: 640, marginBottom: 18 }}>
      <div className="card-h"><h2>Iniciar conteo físico</h2></div>
      <div style={{ padding: 20 }}>
        <p style={{ margin: "0 0 16px", color: t.muted, fontSize: 14 }}>
          Elige qué contar. El sistema toma el stock actual como “teórico” y, al cerrar,
          deja el stock <b>igual a lo que contaste</b> (los ajustes quedan en el kardex).
        </p>
        <div className="field">
          <label>Alcance</label>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
            <option value="sector">Por sector</option>
            <option value="category">Por categoría</option>
            <option value="all">Todo el inventario</option>
          </select>
        </div>
        {needsValue ? (
          <div className="field">
            <label>{SCOPE_LABEL[scopeType]}</label>
            <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} disabled={!catalogReady || noOptions}>
              <option value="">— Elegir {SCOPE_LABEL[scopeType].toLowerCase()} —</option>
              {scopeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {noOptions ? (
              <div className="hint" style={{ color: t.warn }}>
                No hay {scopeType === "sector" ? "sectores" : "categorías"} disponibles en el catálogo.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hint" style={{ marginBottom: 12 }}>
            Se contará el catálogo completo. En catálogos grandes puede tomar tiempo.
          </div>
        )}
        <button
          className="btn btn-primary"
          disabled={starting || (needsValue && !scopeValue)}
          onClick={onStart}
        >
          {starting ? "Iniciando…" : "Iniciar conteo"}
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta: conteo abierto ───────────────────────────────────────────────────
function ActiveCount({
  active, rows, summary, counts, savingIds, search, setSearch,
  setLineCount, saveLine, closing, cancelling, onClose, onCancel,
}) {
  const scope = active.scope || {};
  const savingCount = Object.keys(savingIds).length; // PATCH en vuelo: bloquea el cierre
  const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const kpis = [
    { ic: "📦", bg: "#ede9fe", v: `${summary.done}/${summary.total}`, l: "Contados" },
    { ic: "🎯", bg: "#e0f2fe", v: `${pct}%`, l: "Progreso" },
    { ic: "⚖️", bg: "#fef3c7", v: summary.toAdjust, l: "Con diferencia" },
    { ic: "Σ", bg: "#fce7f3", v: diffStr(summary.netDelta), l: "Δ unidades" },
  ];
  const empty = (active.lines || []).length === 0;

  return (
    <div className="card" style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
      <div className="card-h" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2>Conteo · {SCOPE_LABEL[scope.type] || "Alcance"}: {scope.label || "sin especificar"}</h2>
        <div className="spacer" />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" disabled={cancelling || closing} onClick={onCancel} style={{ color: t.danger }}>
            {cancelling ? "Cancelando…" : "Cancelar conteo"}
          </button>
          <button className="btn btn-primary" disabled={closing || cancelling || summary.done === 0 || savingCount > 0} onClick={onClose}>
            {closing ? "Aplicando…" : savingCount > 0 ? "Guardando…" : "Cerrar y aplicar ajustes"}
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <div className="kpis">
          {kpis.map((k, i) => (
            <div className="kpi" key={i}>
              <div className="ic" style={{ background: k.bg }}>{k.ic}</div>
              <div className="v">{k.v}</div>
              <div className="l">{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="empty">No hay productos en este alcance. Cancela e inicia otro conteo.</div>
      ) : (
        <>
          <div style={{ padding: "10px 20px 0" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o código de barras…"
              style={{ width: "100%", border: `1.5px solid ${t.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14 }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: "center" }}>Teórico</th>
                <th style={{ textAlign: "center" }}>Contado</th>
                <th style={{ textAlign: "center" }}>Diferencia</th>
                <th style={{ textAlign: "center" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const raw = counts[r.product_id] ?? "";
                const saving = !!savingIds[r.product_id];
                return (
                  <tr key={r.product_id}>
                    <td>
                      <b>{r.product_name}</b>
                      <div style={{ fontSize: 12, color: t.muted }}>
                        {r.sku ? `${r.sku} · ` : ""}{r.barcode || "sin código"}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", color: t.muted, fontWeight: 600 }}>{r.theoretical_qty}</td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="number"
                        min="0"
                        value={raw}
                        onChange={(e) => setLineCount(r.product_id, e.target.value)}
                        onBlur={() => saveLine(r.product_id)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        placeholder="–"
                        style={{ width: 78, textAlign: "center", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "7px 6px", fontSize: 14, fontWeight: 700, color: raw === "" ? undefined : "#111" }}
                      />
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: r.isCounted ? diffColor(r.diff) : t.muted }}>
                      {r.isCounted ? diffStr(r.diff) : "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {saving ? (
                        <span className="badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>Guardando…</span>
                      ) : r.isCounted ? (
                        <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>Contado</span>
                      ) : (
                        <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>Pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 18, textAlign: "center", color: t.muted }}>Sin coincidencias para la búsqueda.</td></tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tarjeta: historial ────────────────────────────────────────────────────────
function HistoryCard({ history }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="card-h"><h2>Conteos recientes</h2></div>
      {(!history || history.length === 0) ? (
        <div className="empty">Aún no hay conteos registrados. Al cerrar o cancelar un conteo aparecerá aquí.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Alcance</th>
              <th>Fecha</th>
              <th style={{ textAlign: "center" }}>Productos ajustados</th>
              <th style={{ textAlign: "center" }}>Δ unidades</th>
              <th style={{ textAlign: "center" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const cancelled = h.status === "cancelled";
              const delta = h.applied?.units_delta ?? 0;
              return (
                <tr key={h._id}>
                  <td>
                    <b>{h.scope?.label || SCOPE_LABEL[h.scope?.type] || "Conteo"}</b>
                    <div style={{ fontSize: 12, color: t.muted }}>{SCOPE_LABEL[h.scope?.type] || "Alcance"}</div>
                  </td>
                  <td>{fmtDate(h.closed_at || h.created_at)}</td>
                  <td style={{ textAlign: "center" }}>{cancelled ? "—" : (h.applied?.lines_adjusted ?? 0)}</td>
                  <td style={{ textAlign: "center", fontWeight: 700, color: cancelled ? t.muted : diffColor(delta) }}>
                    {cancelled ? "—" : diffStr(delta)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {cancelled ? (
                      <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>Cancelado</span>
                    ) : (
                      <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>Cerrado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

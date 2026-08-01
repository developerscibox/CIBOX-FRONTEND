import { useEffect, useRef, useState } from "react";
import { api, usingMock, takeRecepcionDraft } from "../api.js";
import BarcodeScanner from "../components/BarcodeScanner.jsx";

// Recepción de mercadería: ingreso masivo de un cargamento por escaneo.
// Cabecera (proveedor / N° factura / vencimiento) + escaneo (cámara del celular
// o pistola/tecleo) que va sumando ítems, lista con CAJAS editables, y
// confirmación que llama a POST /inventory/receive. La cantidad se cuenta en
// CAJAS; el backend traduce cajas→unidades con el tamaño de caja (box_qty).
export default function Recepcion() {
  const [supplier, setSupplier] = useState("");
  const [docRef, setDocRef] = useState("");
  const [expiryDate, setExpiryDate] = useState(""); // YYYY-MM-DD · default que prellena filas sin vencimiento
  const [scan, setScan] = useState("");
  const [items, setItems] = useState([]); // [{ product_id, name, barcode, box_qty, qty(cajas), stock }]
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { received:[...], total_items }
  const [camOpen, setCamOpen] = useState(false);
  const inputRef = useRef(null);

  // Puente Reposición → Recepción: al montar, consume el borrador (one-shot) y
  // siembra las filas. Mapea al shape interno EXACTO de fila. Omite filas sin
  // product_id válido.
  useEffect(() => {
    let draft = [];
    try { draft = takeRecepcionDraft() || []; } catch { draft = []; }
    if (!Array.isArray(draft) || draft.length === 0) return;
    const seeded = draft
      .filter((d) => d && d.product_id != null && String(d.product_id).trim() !== "")
      .map((d) => {
        const box = Number(d.box_qty) > 0 ? Number(d.box_qty) : 1;
        const cajas = Math.max(1, Math.floor(Number(d.cajas) || 1));
        return {
          product_id: String(d.product_id),
          name: d.name || `Producto ${d.barcode || d.product_id}`,
          barcode: d.barcode || null,
          stock: null,
          box_qty: box,
          qty: cajas, // CAJAS
          lot_code: "",
          expiry_date: "",
          // Ubicación sembrada desde Reposición (location del producto: objeto
          // ({ code } o string), editable por fila igual que al escanear.
          location: typeof d.location === "string" ? d.location : (d.location?.code || ""),
        };
      });
    if (seeded.length === 0) return;
    setItems(seeded);
    setMsg({ ok: true, text: `✓ ${seeded.length} producto(s) traídos desde Reposición — revisa y confirma` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCajas = items.reduce((a, it) => a + Number(it.qty || 0), 0);
  const totalUnidades = items.reduce((a, it) => a + Number(it.qty || 0) * Number(it.box_qty || 1), 0);

  function addOne(prod) {
    const pid = String(prod.product_id);
    const boxQty = Number(prod.box_qty) > 0 ? Number(prod.box_qty) : 1;
    setItems((cur) => {
      const i = cur.findIndex((x) => x.product_id === pid);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i], qty: Number(next[i].qty || 0) + 1 };
        return next;
      }
      return [
        ...cur,
        {
          product_id: pid,
          name: prod.name,
          barcode: prod.barcode || null,
          stock: prod.stock ?? null,
          box_qty: boxQty, // unidades por caja (para mostrar el total en unidades)
          qty: 1, // CAJAS
          lot_code: "", // lote del proveedor (opcional; el backend autogenera si va vacío)
          expiry_date: expiryDate || "", // prellena con el vencimiento de cabecera (editable por fila)
          location: prod.location?.code || "", // putaway: ubicación física (editable por fila)
        },
      ];
    });
  }

  // Procesa un código venga de la cámara o del campo de texto.
  async function processCode(code) {
    const c = String(code || "").trim();
    setResult(null);
    if (!c) return;
    try {
      if (usingMock) {
        // En demo: sin catálogo real, simula un producto a partir del código.
        addOne({ product_id: c, name: `Producto ${c}`, barcode: c, stock: null, box_qty: 1 });
        setMsg({ ok: true, text: `✓ Producto ${c} agregado a la recepción` });
      } else {
        const product = await api.byBarcode(c); // valida contra el catálogo real
        addOne({
          product_id: String(product._id),
          name: product.name,
          barcode: product.barcode || c,
          stock: product.stock,
          box_qty: product.box_qty ?? 1,
        });
        setMsg({ ok: true, text: `✓ ${product.name} agregado` });
      }
    } catch (err) {
      setMsg({ ok: false, text: `No se encontró el código ${c}: ${err.message}` });
    }
  }

  function onScan(e) {
    e.preventDefault();
    const code = scan.trim();
    setScan("");
    processCode(code).finally(() => inputRef.current?.focus());
  }

  function setQty(pid, qty) {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    setItems((cur) => cur.map((x) => (x.product_id === pid ? { ...x, qty: q } : x)));
  }
  function setExpiry(pid, value) {
    setItems((cur) => cur.map((x) => (x.product_id === pid ? { ...x, expiry_date: value } : x)));
  }
  function setLote(pid, value) {
    setItems((cur) => cur.map((x) => (x.product_id === pid ? { ...x, lot_code: value } : x)));
  }
  function setLocation(pid, value) {
    setItems((cur) => cur.map((x) => (x.product_id === pid ? { ...x, location: value } : x)));
  }
  function setCosto(pid, value) {
    setItems((cur) => cur.map((x) => (x.product_id === pid ? { ...x, costo: value } : x)));
  }
  function bump(pid, d) {
    setItems((cur) =>
      cur.map((x) =>
        x.product_id === pid ? { ...x, qty: Math.max(1, Number(x.qty || 1) + d) } : x,
      ),
    );
  }
  function remove(pid) {
    setItems((cur) => cur.filter((x) => x.product_id !== pid));
  }

  async function confirm() {
    if (items.length === 0) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    const unidades = totalUnidades;
    try {
      const payload = {
        supplier: supplier.trim() || undefined,
        doc_ref: docRef.trim() || undefined,
        // qty = CAJAS. Vencimiento POR FILA: cada producto del cargamento lleva su
        // propio lote. El de cabecera (expiryDate) solo prellena las filas vacías.
        items: items.map((it) => {
          const exp = it.expiry_date || expiryDate;
          const loc = String(it.location || "").trim();
          const lot = String(it.lot_code || "").trim();
          return { product_id: it.product_id, qty: Number(it.qty), ...(Number(it.costo) > 0 ? { unit_cost: Number(it.costo) } : {}), ...(exp ? { expiry_date: exp } : {}), ...(loc ? { location: { code: loc } } : {}), ...(lot ? { lot_code: lot } : {}) };
        }),
      };
      const res = usingMock
        ? {
            received: items.map((it) => {
              const cajas = Number(it.qty);
              const box = Number(it.box_qty || 1);
              const units = cajas * box;
              return {
                product_id: it.product_id,
                name: it.name,
                cajas,
                box_qty: box,
                units,
                stock_after: it.stock != null ? Number(it.stock) + units : null,
              };
            }),
            total_items: items.length,
          }
        : await api.receiveStock(payload); // POST /inventory/receive
      setResult(res);
      setMsg({
        ok: true,
        text: `✓ Recepción registrada: ${res.total_items} producto(s), ${unidades} unidades ingresadas al kardex`,
      });
      setItems([]);
      setSupplier("");
      setDocRef("");
      setExpiryDate("");
      inputRef.current?.focus();
    } catch (err) {
      setMsg({ ok: false, text: `No se pudo registrar la recepción: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 900 }}>
      <div className="card-h">
        <h2>Recepción de mercadería</h2>
        <div className="spacer" />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {items.length} producto(s) · {totalCajas} cajas · {totalUnidades} unidades
        </span>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <label>Proveedor</label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Ej. Distribuidora Sur"
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <label>N° factura / guía <span style={{ color: "var(--muted)", fontWeight: 400 }}>· opcional</span></label>
          <input
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            placeholder="Ej. Factura 12345"
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <label>Vencimiento del lote <span style={{ color: "var(--muted)", fontWeight: 400 }}>· prellena filas vacías</span></label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      </div>

      <div style={{ padding: "0 20px 10px" }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => setCamOpen(true)}
        >
          Escanear con cámara
        </button>
      </div>

      <form className="scan" onSubmit={onScan}>
        <input
          ref={inputRef}
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="…o escribe / lee con pistola y presiona Enter"
          autoFocus
        />
        <button className="btn btn-primary" type="submit">Agregar</button>
      </form>

      {msg ? (
        <div
          style={{
            margin: "0 20px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            color: msg.ok ? "var(--ok)" : "var(--danger)",
          }}
        >
          {msg.text}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="empty">
          Escanea productos para armar la recepción del cargamento.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código</th>
              <th style={{ textAlign: "center" }}>Cajas</th>
              <th style={{ textAlign: "center" }}>Costo unit.</th>
              <th style={{ textAlign: "center" }}>Lote</th>
              <th style={{ textAlign: "center" }}>Vencimiento</th>
              <th style={{ textAlign: "center" }}>Ubicación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const box = Number(it.box_qty || 1);
              const units = Number(it.qty || 0) * box;
              return (
              <tr key={it.product_id}>
                <td>
                  <b>{it.name}</b>
                  {it.stock != null ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>stock actual: {it.stock}</div>
                  ) : null}
                </td>
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 13 }}>
                  {it.barcode || <span style={{ color: "var(--muted)", fontStyle: "italic", fontFamily: "inherit" }}>sin código</span>}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <button className="btn btn-ghost" type="button" onClick={() => bump(it.product_id, -1)} style={{ padding: "4px 10px" }}>−</button>
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => setQty(it.product_id, e.target.value)}
                      style={{ width: 64, textAlign: "center", border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 6px", fontSize: 14 }}
                    />
                    <button className="btn btn-ghost" type="button" onClick={() => bump(it.product_id, 1)} style={{ padding: "4px 10px" }}>+</button>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                    {box > 1 ? <>× {box} = <b>{units}</b> u</> : <>{units} u</>}
                  </div>
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="number"
                    min="0"
                    value={it.costo || ""}
                    onChange={(e) => setCosto(it.product_id, e.target.value)}
                    placeholder="$/u"
                    title="Costo de compra por unidad (recalcula el costo promedio del producto)"
                    style={{ width: 84, textAlign: "center", border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 6px", fontSize: 13 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="text"
                    value={it.lot_code || ""}
                    onChange={(e) => setLote(it.product_id, e.target.value)}
                    placeholder="auto"
                    title="Código de lote del proveedor (opcional; si se deja vacío el sistema lo autogenera)"
                    style={{ width: 96, textAlign: "center", border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 6px", fontSize: 13 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="date"
                    value={it.expiry_date || ""}
                    onChange={(e) => setExpiry(it.product_id, e.target.value)}
                    title="Vencimiento del lote de este producto"
                    style={{ border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 6px", fontSize: 13 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="text"
                    value={it.location || ""}
                    onChange={(e) => setLocation(it.product_id, e.target.value)}
                    placeholder="A-03-2"
                    title="Ubicación física en bodega (putaway)"
                    style={{ width: 84, textAlign: "center", border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 6px", fontSize: 13 }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost" type="button" onClick={() => remove(it.product_id)} style={{ color: "var(--danger)" }}>
                    Quitar
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      <div style={{ padding: 18 }}>
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          type="button"
          disabled={busy || items.length === 0}
          onClick={confirm}
        >
          {busy
            ? "Registrando…"
            : items.length === 0
            ? "Escanea productos para confirmar"
            : `✅ Confirmar recepción (${totalCajas} cajas · ${totalUnidades} unidades)`}
        </button>
      </div>

      {result ? (
        <div className="ok-msg" style={{ margin: "0 18px 18px" }}>
          ✓ Stock actualizado en {result.total_items} producto(s):
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontWeight: 400, fontSize: 13.5 }}>
            {result.received.map((r) => (
              <li key={r.product_id}>
                {r.name}: <b>+{r.cajas ?? r.qty} caja(s)</b>
                {r.units != null ? <> = {r.units} u</> : null}
                {r.stock_after != null ? <> → stock {r.stock_after}</> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {camOpen ? (
        <BarcodeScanner
          title="Escanear recepción"
          onDetected={(code) => processCode(code)}
          onClose={() => { setCamOpen(false); inputRef.current?.focus(); }}
        />
      ) : null}
    </div>
  );
}

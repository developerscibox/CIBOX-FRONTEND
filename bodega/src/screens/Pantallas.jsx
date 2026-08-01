import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, usingMock } from "../api.js";

// CENTRO DE PANTALLAS: un directorio de TODAS las pantallas que se cuelgan de cara al
// público o a los trabajadores (pantalla pública, turno QR, monitores por zona). Cada
// una con acceso directo y un QR para abrirla en la TV/tablet del punto sin escribir URL.

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

const PUBLICAS = [
  { key: "pantalla", ic: "📺", nombre: "Pantalla pública", desc: "Estado de pedidos y fila de atención, de cara al cliente. Modo TV con ?tv.", path: "/pantalla", tv: "/pantalla?tv=1", color: "var(--magenta)" },
  { key: "turno", ic: "🎫", nombre: "Turno / Fila (QR)", desc: "El cliente escanea, saca número y sigue su proceso.", path: "/turno", color: "var(--magenta-d)" },
];

const TRABAJADORES = [
  { key: "totem", ic: "🖐️", nombre: "Tótem de picking", desc: "El bodeguero se identifica (cámara + PIN), toma su pedido y lo finaliza. Táctil, pantalla completa.", path: "/totem", color: "#0e6b66" },
];

function useQR(url) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#1c1230", light: "#ffffff" } })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return src;
}

export default function Pantallas() {
  const [sectores, setSectores] = useState([]);
  const [zoom, setZoom] = useState(null); // { url, nombre }

  useEffect(() => {
    if (usingMock) { setSectores([{ nombre: "Lácteos y refrigerados" }, { nombre: "Abarrotes" }, { nombre: "Bebidas y licores" }]); return; }
    api.sectores().then((r) => setSectores(r?.sectores || r?.data?.sectores || [])).catch(() => {});
  }, []);

  const zonas = (sectores || []).map((s) => ({
    key: "zona-" + s.nombre,
    ic: "🗺️",
    nombre: s.nombre,
    desc: "Monitor del sector: el dueño de área ve sus ítems y marca “Cajas listas”.",
    path: `/zona?s=${encodeURIComponent(s.nombre)}`,
    color: "var(--ok)",
  }));

  return (
    <div>
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16, borderLeft: "4px solid var(--magenta)", fontSize: 13.5, lineHeight: 1.5 }}>
        Estas son las pantallas que se cuelgan en el local. Ábrelas en la TV o tablet del punto: apunta la cámara al <b>QR</b> o usa <b>“Abrir”</b>. Déjalas fijas: se actualizan solas en vivo.
      </div>

      <Grupo titulo="Pantallas públicas · cara al cliente" chip={PUBLICAS.length}>
        {PUBLICAS.map((p) => <Card key={p.key} p={p} onZoom={setZoom} extra={p.tv ? { label: "Modo TV", url: ORIGIN + p.tv } : null} />)}
      </Grupo>

      <Grupo titulo="Estaciones de trabajadores" chip={TRABAJADORES.length}>
        {TRABAJADORES.map((p) => <Card key={p.key} p={p} onZoom={setZoom} />)}
      </Grupo>

      <Grupo titulo="Monitores de zona · bodega" chip={zonas.length}>
        {zonas.length === 0 ? (
          <div className="card" style={{ padding: 20, color: "var(--muted)" }}>
            No hay sectores configurados todavía. Créalos en <b>Sectores / Zonas</b> y aquí aparecerá un monitor por cada uno.
          </div>
        ) : zonas.map((p) => <Card key={p.key} p={p} onZoom={setZoom} />)}
      </Grupo>

      {zoom ? <QrModal zoom={zoom} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}

function QrModal({ zoom, onClose }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(zoom.url, { margin: 1, width: 520, color: { dark: "#1c1230", light: "#ffffff" } }).then(setSrc).catch(() => {});
  }, [zoom.url]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(20,10,25,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, textAlign: "center", maxWidth: 340 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{zoom.nombre}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Escanea con la cámara de la TV/tablet</div>
        {src ? <img src={src} alt="QR" style={{ width: 260, height: 260 }} /> : <div style={{ width: 260, height: 260 }} />}
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "var(--muted)", marginTop: 8, wordBreak: "break-all" }}>{zoom.url}</div>
        <button onClick={onClose} style={{ marginTop: 14, border: "none", background: "var(--magenta-d)", color: "#fff", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
      </div>
    </div>
  );
}

function Grupo({ titulo, chip, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--muted)", letterSpacing: ".5px", textTransform: "uppercase", margin: "0 2px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        {titulo}
        <span style={{ background: "#f3eef6", color: "var(--magenta-d)", borderRadius: 999, padding: "1px 8px", fontSize: 11 }}>{chip}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Card({ p, onZoom, extra }) {
  const url = ORIGIN + p.path;
  const qr = useQR(url);
  return (
    <div className="card" style={{ padding: 16, borderTop: `3px solid ${p.color}`, display: "flex", gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22 }}>{p.ic}</div>
        <div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 2, lineHeight: 1.15 }}>{p.nombre}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{p.desc}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: p.color, color: "#fff", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13 }}>Abrir ↗</a>
          {extra ? <a href={extra.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", background: "#fff", color: p.color, border: `1px solid ${p.color}`, borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13 }}>{extra.label} ↗</a> : null}
        </div>
      </div>
      <button onClick={() => onZoom({ url, nombre: p.nombre })} title="Ampliar QR" style={{ border: "1px solid var(--border-soft)", background: "#fff", borderRadius: 10, padding: 6, cursor: "pointer", alignSelf: "flex-start" }}>
        {qr ? <img src={qr} alt="QR" style={{ width: 72, height: 72, display: "block" }} /> : <div style={{ width: 72, height: 72 }} />}
      </button>
    </div>
  );
}

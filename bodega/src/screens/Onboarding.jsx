import { useEffect, useMemo, useState } from "react";
import { t } from "../theme.js";
import { useAuth } from "../auth.jsx";

// Pasos del tour del WMS. Cada paso declara el permiso que el rol debe tener
// para verlo (perm:null = visible para todos). El texto va en español.
const STEPS = [
  {
    perm: null,
    ic: "👋",
    title: "Bienvenido a Bodega 12",
    body: "Este es el panel de bodega (Lo Espejo). Acá gestionas la operación: pedidos del día, picking, recepción, stock y caja. Vendemos solo por caja y el retiro es presencial.",
  },
  {
    perm: null,
    ic: "🧭",
    title: "Tu menú depende de tu rol",
    body: "A la izquierda está el menú de operación. Solo ves las secciones que tu rol permite; si tu menú es más corto que el de un compañero, es normal. El número en \"Picking\" es un contador en vivo de pedidos por preparar.",
  },
  {
    perm: "orders.read",
    ic: "📊",
    title: "Empieza por el Resumen",
    body: "Tu pantalla de inicio: el estado operativo del día de un vistazo. Cada mañana parte acá.",
  },
  {
    perm: "orders.read",
    ic: "📋",
    title: "Pedidos del día",
    body: "Seguimiento completo de pedidos para retiro, con su fecha comprometida. Desde el detalle entregas al cliente; si paga en efectivo se abre el cobro: escribes el monto recibido y el sistema calcula el vuelto.",
  },
  {
    perm: "orders.read",
    ic: "🗓️",
    title: "Calendario de retiros",
    body: "Para ver qué pedidos se retiran cada día. Tiene vista mensual, semanal, diaria y lista.",
  },
  {
    perm: "orders.prepare",
    ic: "🧺",
    title: "Picking",
    body: "Preparas y verificas pedidos por escaneo. Abres un pedido y escaneas cada código; si no pertenece al pedido, el sistema te avisa.",
  },
  {
    perm: "inventory.adjust",
    ic: "📥",
    title: "Recepción de mercadería",
    body: "Cuando llega un cargamento, ingrésalo masivamente por escaneo. Cada lectura suma stock al producto.",
  },
  {
    perm: "inventory.adjust",
    ic: "⚖️",
    title: "Ajuste de stock",
    body: "Para corregir por mermas, roturas o conteos. El motivo es obligatorio y todo queda auditado.",
  },
  {
    perm: "inventory.read",
    ic: "📈",
    title: "Inventario",
    body: "Panorama gráfico del stock en bodega, en cajas. Para saber qué se está agotando.",
  },
  {
    perm: "reports.read",
    ic: "💰",
    title: "Ventas",
    body: "En \"Ventas\" revisas los KPIs del negocio: ventas del periodo, órdenes por estado y top de productos.",
  },
  {
    perm: "products.manage",
    ic: "📦",
    title: "Productos",
    body: "Das de alta y editas productos, siempre por caja. Mantenlo al día para que tienda y picking calcen.",
  },
  {
    perm: "users.manage",
    ic: "👥",
    title: "Usuarios y roles",
    body: "Asignas roles y activas/desactivas cuentas (la cuenta se crea registrándose en la tienda). El rol define qué secciones ve cada persona.",
  },
  {
    perm: null,
    ic: "🚀",
    title: "Listo para partir",
    body: "Eso es lo esencial. Puedes volver a abrir este tutorial con el botón \"Tutorial\", arriba a la derecha.",
  },
];

const tourKey = (user) =>
  user ? `b12_wms_tour_${user._id || user.id || user.email || "anon"}` : null;

// ¿El usuario ya vio el tour? (true si no hay almacenamiento, para no molestar).
export function tourSeen(user) {
  const key = tourKey(user);
  if (!key) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

const markTourSeen = (user) => {
  const key = tourKey(user);
  if (!key) return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* almacenamiento no disponible */
  }
};

// Overlay de bienvenida tipo carrusel. Filtra los pasos según los permisos del
// rol (can). `open` controla la visibilidad; `onClose` se llama al cerrar.
export default function Onboarding({ open, onClose }) {
  const { user, can } = useAuth();
  const steps = useMemo(
    () => STEPS.filter((s) => s.perm == null || can(s.perm)),
    [can],
  );
  const [i, setI] = useState(0);

  // Al (re)abrir, partir desde el primer paso.
  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  if (!open || steps.length === 0) return null;

  const step = steps[Math.min(i, steps.length - 1)];
  const isFirst = i === 0;
  const isLast = i >= steps.length - 1;

  const close = () => {
    markTourSeen(user);
    onClose?.();
  };
  const next = () => (isLast ? close() : setI((n) => Math.min(n + 1, steps.length - 1)));
  const prev = () => setI((n) => Math.max(n - 1, 0));

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="Tutorial de Bodega 12" onClick={close}>
      <div className="ob-card" onClick={(e) => e.stopPropagation()}>
        <div className="ob-top">
          <span className="ob-kicker">Tutorial · {i + 1} de {steps.length}</span>
          <button className="ob-skip" onClick={close}>Saltar</button>
        </div>

        <div className="ob-ic" aria-hidden="true">{step.ic}</div>
        <h2 className="ob-title">{step.title}</h2>
        <p className="ob-body">{step.body}</p>

        <div className="ob-dots" role="tablist" aria-label="Progreso">
          {steps.map((_, n) => (
            <button
              key={n}
              className={"ob-dot" + (n === i ? " on" : "")}
              aria-label={`Ir al paso ${n + 1}`}
              aria-selected={n === i}
              onClick={() => setI(n)}
            />
          ))}
        </div>

        <div className="ob-actions">
          <button
            className="ob-back"
            onClick={prev}
            disabled={isFirst}
            style={isFirst ? { visibility: "hidden" } : undefined}
          >
            Atrás
          </button>
          <button className="ob-next" onClick={next}>
            {isLast ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>

      <style>{`
        .ob-overlay{position:fixed;inset:0;z-index:1000;background:rgba(42,14,34,.62);
          backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
          padding:24px;animation:ob-fade .18s ease;}
        .ob-card{position:relative;width:100%;max-width:480px;background:${t.surface};
          border:1px solid ${t.border};border-radius:22px;padding:28px 28px 24px;
          box-shadow:0 24px 70px rgba(42,14,34,.4);animation:ob-pop .22s cubic-bezier(.2,.9,.3,1.2);}
        .ob-card::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;border-radius:22px 22px 0 0;
          background:${t.grad};}
        .ob-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
        .ob-kicker{font-size:11.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:${t.magenta};}
        .ob-skip{border:none;background:none;color:${t.muted};font-size:13px;font-weight:600;padding:4px 6px;border-radius:8px;}
        .ob-skip:hover{color:${t.text};background:${t.bg};}
        .ob-ic{width:64px;height:64px;border-radius:18px;background:${t.grad};
          display:flex;align-items:center;justify-content:center;font-size:32px;
          box-shadow:0 8px 22px rgba(230,0,126,.32);margin-bottom:16px;}
        .ob-title{font-size:22px;font-weight:800;line-height:1.15;color:${t.text};margin-bottom:10px;}
        .ob-body{font-size:15px;line-height:1.55;color:${t.muted};min-height:88px;}
        .ob-dots{display:flex;gap:7px;flex-wrap:wrap;margin:20px 0 22px;}
        .ob-dot{width:8px;height:8px;border-radius:99px;border:none;background:${t.border};padding:0;transition:.16s;}
        .ob-dot:hover{background:${t.rosaSoft};}
        .ob-dot.on{width:22px;background:${t.magenta};}
        .ob-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;}
        .ob-back{border:1.5px solid ${t.border};background:${t.surface};color:${t.text};
          border-radius:11px;padding:10px 18px;font-weight:700;font-size:14px;}
        .ob-back:hover{border-color:${t.rosaSoft};}
        .ob-next{border:none;border-radius:11px;padding:11px 24px;font-weight:800;font-size:14px;
          color:#fff;background:${t.grad};box-shadow:0 6px 16px rgba(230,0,126,.32);margin-left:auto;}
        .ob-next:hover{filter:brightness(1.04);}
        @keyframes ob-fade{from{opacity:0;}to{opacity:1;}}
        @keyframes ob-pop{from{opacity:0;transform:translateY(12px) scale(.97);}to{opacity:1;transform:none;}}
        @media(max-width:520px){.ob-card{padding:22px 20px 20px;}.ob-title{font-size:20px;}}
      `}</style>
    </div>
  );
}

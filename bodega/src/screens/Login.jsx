import { useState } from "react";
import { t } from "../theme.js";
import { useAuth } from "../auth.jsx";
import { authApi } from "../api.js";

import { brand } from "../brand.js";
export default function Login() {
  const { login, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // "login" | "olvide" | "enviado"
  const [vista, setVista] = useState("login");

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) { setErr("Ingresa correo y contraseña"); return; }
    setBusy(true);
    setErr(null);
    try {
      await login(email.trim(), password);
    } catch (e2) {
      setErr(e2.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  async function onRecuperar(e) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) { setErr("Ingresa tu correo"); return; }
    setBusy(true);
    setErr(null);
    try {
      await authApi.forgotPassword(email.trim());
      // Se muestra el mismo mensaje exista o no la cuenta: si dijera "ese correo
      // no está registrado", cualquiera podría averiguar qué correos tienen
      // acceso al panel.
      setVista("enviado");
    } catch (e2) {
      setErr(e2.message || "No se pudo enviar el correo");
    } finally {
      setBusy(false);
    }
  }

  const irA = (v) => { setVista(v); setErr(null); };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <img src={brand.logo} alt={brand.name} style={S.logo} />

        {vista === "login" ? (
          <form style={S.card} onSubmit={onSubmit}>
            <div style={S.h}>Inicia sesión</div>
            <div style={S.sub}>Panel de bodega · acceso del equipo</div>

            {sessionExpired && !err ? (
              <div style={S.expired}>Tu sesión expiró por inactividad. Vuelve a iniciar sesión para continuar.</div>
            ) : null}

            <div className="field">
              <label>Correo</label>
              <input
                type="email"
                autoFocus
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@cibox.cl"
              />
            </div>

            <div className="field" style={{ marginBottom: 8 }}>
              <label>Contraseña</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {err ? <div style={S.err}>{err}</div> : null}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 10, padding: "13px 16px", fontSize: 15 }}
              type="submit"
              disabled={busy}
            >
              {busy ? "Ingresando…" : "Ingresar"}
            </button>

            <button type="button" onClick={() => irA("olvide")} style={S.enlace}>
              ¿Olvidaste tu contraseña?
            </button>

            <div style={S.foot}>Cada acción queda registrada con tu usuario.</div>
          </form>
        ) : vista === "olvide" ? (
          <form style={S.card} onSubmit={onRecuperar}>
            <div style={S.h}>Recuperar contraseña</div>
            <div style={S.sub}>Te enviamos un enlace para crear una nueva.</div>

            <div className="field" style={{ marginBottom: 8 }}>
              <label>Correo</label>
              <input
                type="email"
                autoFocus
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@cibox.cl"
              />
            </div>

            {err ? <div style={S.err}>{err}</div> : null}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 10, padding: "13px 16px", fontSize: 15 }}
              type="submit"
              disabled={busy}
            >
              {busy ? "Enviando…" : "Enviarme el enlace"}
            </button>

            <button type="button" onClick={() => irA("login")} style={S.enlace}>
              Volver a iniciar sesión
            </button>
          </form>
        ) : (
          <div style={S.card}>
            <div style={S.h}>Revisa tu correo</div>
            <div style={{ ...S.sub, marginBottom: 14 }}>
              Si <b>{email}</b> tiene una cuenta, le llegó un enlace para crear una
              contraseña nueva. Revisa también la carpeta de spam.
            </div>
            <div style={S.aviso}>
              El enlace abre la página de la tienda para cambiar la clave. Una vez
              cambiada, vuelve acá e ingresa con ella.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 14, padding: "13px 16px", fontSize: 15 }}
              onClick={() => irA("login")}
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}

        <div style={S.copyright}>{brand.name} · {brand.tagline}</div>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: t.grad,
    padding: 20,
  },
  inner: {
    width: "100%",
    maxWidth: 400,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logo: {
    width: 184,
    height: "auto",
    marginBottom: 26,
    filter: "drop-shadow(0 6px 20px rgba(0,0,0,.28))",
  },
  card: {
    width: "100%",
    background: "#fff",
    borderRadius: 22,
    padding: "30px 30px 26px",
    boxShadow: "0 24px 70px rgba(42,16,34,.35)",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  h: { fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-.3px" },
  sub: { fontSize: 13, color: t.muted, marginTop: 4, marginBottom: 22 },
  err: {
    marginBottom: 4,
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  expired: {
    marginBottom: 16,
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
  },
  foot: { marginTop: 16, fontSize: 12, color: t.muted, textAlign: "center" },
  enlace: {
    marginTop: 12,
    background: "none",
    border: "none",
    color: t.muted,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 4,
  },
  aviso: {
    background: "#f3f4f6",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12.5,
    color: t.muted,
    lineHeight: 1.5,
  },
  copyright: {
    marginTop: 22,
    fontSize: 12,
    color: "rgba(255,255,255,.88)",
    textAlign: "center",
    fontWeight: 500,
  },
};

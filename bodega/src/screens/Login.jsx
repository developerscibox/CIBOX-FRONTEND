import { useState } from "react";
import { t } from "../theme.js";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

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

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <img src="/logo-bodega12.png" alt="Bodega 12" style={S.logo} />

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
              placeholder="tucorreo@bodega12.cl"
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

          <div style={S.foot}>Cada acción queda registrada con tu usuario.</div>
        </form>

        <div style={S.copyright}>Bodega 12 · Supermercado mayorista · Lo Espejo</div>
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
  copyright: {
    marginTop: 22,
    fontSize: 12,
    color: "rgba(255,255,255,.88)",
    textAlign: "center",
    fontWeight: 500,
  },
};

// auth.jsx — Cloudflare Sites access screen.

function HostedAuthScreen() {
  const { t } = window.I18N.useI18n();

  function signIn() {
    window.location.assign("/signin-with-chatgpt?return_to=%2Fgame%2Findex.html");
  }

  return (
    <div className="app-shell center" data-auth-screen style={{ minHeight: "100vh" }}>
      <div className="auth-stage fade-in">
        <section className="auth-intro">
          <div className="brand-mark" aria-hidden="true" />
          <span className="eyebrow">{t("auth.eyebrow")}</span>
          <h1>{t("auth.headline")}<br />{t("auth.headlineEm")}</h1>
          <p>{t("auth.description")}</p>
          <div className="auth-docket">
            <span>{t("auth.docketLabel")}</span>
            <strong>{t("auth.docketItems")}</strong>
          </div>
        </section>

        <section className="card auth-panel">
          <div className="row" style={{ justifyContent: "flex-end", marginBottom: "var(--sp-4)" }}>
            <LanguageToggle />
          </div>
          <div className="stack" style={{ gap: "var(--sp-5)" }}>
            <div>
              <span className="eyebrow">{t("auth.access")}</span>
              <h2>{t("auth.loginTitle")}</h2>
              <p className="muted" style={{ margin: 0 }}>{t("auth.loginSubtitle")}</p>
            </div>

            <div className="callout">
              <i className="ti ti-shield-lock" aria-hidden="true" />
              <span>Your account is handled by the hosted access layer. This app never stores your password.</span>
            </div>

            <button
              type="button"
              className="btn-primary"
              data-testid="auth-submit"
              onClick={signIn}
              style={{ width: "100%" }}
            >
              Continue securely
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function LegacyAuthScreen({ onLogin }) {
  const { t, localizeError } = window.I18N.useI18n();
  const [mode, setMode] = React.useState("login");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setError(null);
    if (!username.trim() || !password) return setError({ key: "auth.fillFields" });
    if (mode === "register" && password !== confirmPassword) {
      return setError({ key: "auth.passwordsMismatch" });
    }
    if (mode === "register" && password.length < 8) {
      return setError({ key: "auth.passwordMin" });
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw data.error || new Error("Authentication request failed");
      localStorage.setItem("ao_token", data.token);
      localStorage.setItem("ao_username", data.username);
      onLogin(data.username, data.token, data.scores || {});
    } catch (reason) {
      setError(typeof reason === "string" ? new Error(reason) : reason);
    } finally {
      setLoading(false);
    }
  }

  const register = mode === "register";
  return (
    <div className="app-shell center" data-auth-screen style={{ minHeight: "100vh" }}>
      <div className="auth-stage fade-in">
        <section className="auth-intro">
          <div className="brand-mark" aria-hidden="true" />
          <span className="eyebrow">{t("auth.eyebrow")}</span>
          <h1>{t("auth.headline")}<br />{t("auth.headlineEm")}</h1>
          <p>{t("auth.description")}</p>
          <div className="auth-docket"><span>{t("auth.docketLabel")}</span><strong>{t("auth.docketItems")}</strong></div>
        </section>
        <section className="card auth-panel">
          <div className="row" style={{ justifyContent: "flex-end", marginBottom: "var(--sp-4)" }}><LanguageToggle /></div>
          <div className="stack" style={{ gap: "var(--sp-5)" }}>
            <div>
              <span className="eyebrow">{t("auth.access")}</span>
              <h2>{register ? t("auth.registerTitle") : t("auth.loginTitle")}</h2>
              <p className="muted" style={{ margin: 0 }}>{register ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}</p>
            </div>
            <div className="seg" role="group" aria-label={t("auth.modeLabel")}>
              <button type="button" data-testid="auth-mode-login" aria-pressed={!register} onClick={() => { setMode("login"); setError(null); }}>{t("auth.login")}</button>
              <button type="button" data-testid="auth-mode-register" aria-pressed={register} onClick={() => { setMode("register"); setError(null); }}>{t("auth.register")}</button>
            </div>
            <div className="stack" style={{ gap: "var(--sp-3)" }}>
              <label className="stack" style={{ gap: "var(--sp-1)" }}>
                <span className="label">{t("auth.username")}</span>
                <input id="auth-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} onKeyDown={event => event.key === "Enter" && submit()} />
              </label>
              <label className="stack" style={{ gap: "var(--sp-1)" }}>
                <span className="label">{t("auth.password")}</span>
                <input id="auth-password" type="password" autoComplete={register ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => event.key === "Enter" && submit()} />
              </label>
              {register && <label className="stack" style={{ gap: "var(--sp-1)" }}>
                <span className="label">{t("auth.confirmPassword")}</span>
                <input id="auth-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onKeyDown={event => event.key === "Enter" && submit()} />
              </label>}
            </div>
            {error && <div className="callout callout--danger" role="alert"><i className="ti ti-alert-triangle" aria-hidden="true" /><span>{error.key ? t(error.key, error.params) : localizeError(error)}</span></div>}
            <button type="button" className="btn-primary" data-testid="auth-submit" onClick={submit} disabled={loading} style={{ width: "100%" }}>
              {loading ? t("auth.submitLoading") : register ? t("auth.register") : t("auth.login")}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthScreen(props) {
  return window.location.pathname.startsWith("/game/")
    ? <HostedAuthScreen />
    : <LegacyAuthScreen {...props} />;
}

Object.assign(window, { AuthScreen });

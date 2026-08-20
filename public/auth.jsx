// auth.jsx — Login and Register screens
// Place this file in your public/ folder

const API_BASE = window.API_BASE || "";

function AuthScreen({ onLogin }) {
  const { t, localizeError } = window.I18N.useI18n();
  const [mode, setMode] = React.useState("login"); // "login" or "register"
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    setError("");

    if (!username.trim() || !password) {
      setError(t("auth.fillFields"));
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError(t("auth.passwordsMismatch"));
        return;
      }
      if (password.length < 8) {
        setError(t("auth.passwordMin"));
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(localizeError(data.error));
        setLoading(false);
        return;
      }

      // Save token and username
      localStorage.setItem("ao_token", data.token);
      localStorage.setItem("ao_username", data.username);
      onLogin(data.username, data.token, data.scores || {});
    } catch (err) {
      setError(localizeError(err));
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") handleSubmit();
  }

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  const confirmActive = mode === "register" && confirmPassword.length > 0;
  const passwordsMatch = confirmActive && password === confirmPassword;

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
              <h2>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {mode === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
              </p>
            </div>

            <div className="seg" role="group" aria-label={t("auth.modeLabel")}>
              <button type="button" data-testid="auth-mode-login" aria-pressed={mode === "login"} onClick={() => switchMode("login")}>{t("auth.login")}</button>
              <button type="button" data-testid="auth-mode-register" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>{t("auth.register")}</button>
            </div>

            <div className="stack" style={{ gap: "var(--sp-3)" }}>
              <div className="stack" style={{ gap: "var(--sp-1)" }}>
                <label className="label" htmlFor="auth-username">{t("auth.username")}</label>
                <input
                  id="auth-username"
                  type="text"
                  placeholder={t("auth.usernamePlaceholder")}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={handleKey}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="stack" style={{ gap: "var(--sp-1)" }}>
                <label className="label" htmlFor="auth-password">{t("auth.password")}</label>
                <input
                  id="auth-password"
                  type="password"
                  placeholder={mode === "register" ? t("auth.passwordMinPlaceholder") : t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "register" && (
                <div className="stack" style={{ gap: "var(--sp-1)" }}>
                  <label className="label" htmlFor="auth-confirm">{t("auth.confirmPassword")}</label>
                  <input
                    id="auth-confirm"
                    type="password"
                    placeholder={t("auth.confirmPlaceholder")}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKey}
                    autoComplete="new-password"
                    aria-describedby="confirm-feedback"
                  />
                  {confirmActive && (
                    <span id="confirm-feedback" aria-live="polite" className={`badge ${passwordsMatch ? "badge--ok" : "badge--danger"}`} style={{ alignSelf: "flex-start" }}>
                      <i className={`ti ${passwordsMatch ? "ti-check" : "ti-x"}`} aria-hidden="true" />
                      {passwordsMatch ? t("auth.passwordsMatch") : t("auth.passwordsMismatch")}
                    </span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="callout callout--danger" role="alert">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button type="button" className="btn-primary" data-testid="auth-submit" onClick={handleSubmit} disabled={loading} aria-busy={loading} style={{ width: "100%" }}>
              {loading ? t("auth.submitLoading") : mode === "login" ? t("auth.login") : t("auth.register")}
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });

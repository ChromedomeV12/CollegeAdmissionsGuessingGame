// auth.jsx — Login and Register screens
// Place this file in your public/ folder

const API_BASE = window.API_BASE || "";

function AuthScreen({ onLogin }) {
  const [mode, setMode] = React.useState("login"); // "login" or "register"
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    setError("");

    if (!username.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
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
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      // Save token and username
      localStorage.setItem("ao_token", data.token);
      localStorage.setItem("ao_username", data.username);
      onLogin(data.username, data.token, data.scores || {});
    } catch (err) {
      setError("Could not connect to server.");
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
    <div className="app-shell center" style={{ minHeight: "100vh", padding: "var(--sp-5)" }}>
      <div className="card stack" style={{ maxWidth: 380, width: "100%", gap: "var(--sp-5)" }}>

        {/* Brand */}
        <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: "var(--sp-2)" }}>
          <div className="brand-mark" aria-hidden="true" />
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "var(--fs-h2)", margin: 0, letterSpacing: "-0.015em" }}>
            Admissions <em className="accent-text" style={{ fontStyle: "italic" }}>Oracle</em>
          </h1>
          <p className="muted" style={{ margin: 0 }}>Predict college admissions results</p>
        </div>

        {/* Login / Register toggle */}
        <div className="seg" role="group" aria-label="Authentication mode">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => switchMode("login")}
          >Log in</button>
          <button
            type="button"
            aria-pressed={mode === "register"}
            onClick={() => switchMode("register")}
          >Create account</button>
        </div>

        {/* Fields */}
        <div className="stack" style={{ gap: "var(--sp-3)" }}>
          <div className="stack" style={{ gap: "var(--sp-1)" }}>
            <label className="label" htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              type="text"
              placeholder="your_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="stack" style={{ gap: "var(--sp-1)" }}>
            <label className="label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "register" && (
            <div className="stack" style={{ gap: "var(--sp-1)" }}>
              <label className="label" htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                placeholder="Same password again"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="new-password"
                aria-describedby="confirm-feedback"
              />
              {confirmActive && (
                <span
                  id="confirm-feedback"
                  aria-live="polite"
                  className={`badge ${passwordsMatch ? "badge--ok" : "badge--danger"}`}
                  style={{ alignSelf: "flex-start" }}
                >
                  <i className={`ti ${passwordsMatch ? "ti-check" : "ti-x"}`} style={{ fontSize: "var(--fs-xs)" }} aria-hidden="true" />
                  {passwordsMatch ? "Passwords match" : "Passwords don't match"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="callout" role="alert" style={{ background: "var(--bg-danger)", borderColor: "var(--border-danger)" }}>
            <i className="ti ti-alert-triangle" style={{ color: "var(--text-danger)" }} aria-hidden="true" />
            <span style={{ color: "var(--text-danger)" }}>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          aria-busy={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });

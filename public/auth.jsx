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

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", padding: "1rem",
    }}>
      <div className="card" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="brand-mark" aria-hidden="true" style={{ margin: "0 auto 10px" }} />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admissions <em>Oracle</em></h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>
            Predict college admissions results
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: 4 }}>
          <button
            onClick={() => { setMode("login"); setError(""); }}
            style={{
              flex: 1, padding: "7px 0", fontSize: 13, fontWeight: mode === "login" ? 600 : 400,
              border: "none", borderRadius: "var(--radius-md)",
              background: mode === "login" ? "var(--bg-primary)" : "transparent",
              color: mode === "login" ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer", boxShadow: mode === "login" ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}
          >Log in</button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            style={{
              flex: 1, padding: "7px 0", fontSize: 13, fontWeight: mode === "register" ? 600 : 400,
              border: "none", borderRadius: "var(--radius-md)",
              background: mode === "register" ? "var(--bg-primary)" : "transparent",
              color: mode === "register" ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer", boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}
          >Create account</button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1rem", textAlign: "left" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Username</label>
            <input
              type="text"
              placeholder="your_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKey}
              style={{ width: "100%" }}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Password</label>
            <input
              type="password"
              placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              style={{ width: "100%" }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Confirm password</label>
              <input
                type="password"
                placeholder="Same password again"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={handleKey}
                style={{ width: "100%" }}
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "var(--bg-danger)", color: "var(--text-danger)", border: "0.5px solid var(--border-danger)",
            borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, marginBottom: "1rem", textAlign: "left",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          className="btn-primary"
          style={{ width: "100%", opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: "1rem" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--text-info)", cursor: "pointer", fontSize: 12, padding: 0 }}
          >
            {mode === "login" ? "Create one" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });

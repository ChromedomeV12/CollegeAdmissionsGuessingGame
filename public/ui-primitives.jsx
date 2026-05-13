// Shared UI primitives used across phases.

const { useState, useEffect, useRef, useMemo } = React;

function Badge({ kind = "neutral", children, icon }) {
  return (
    <span className={`badge badge--${kind}`}>
      {icon ? <i className={`ti ti-${icon}`} style={{ fontSize: 12 }} /> : null}
      {children}
    </span>
  );
}

function Pill({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      className="pill"
      aria-pressed={active ? "true" : "false"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Btn({ onClick, children, variant, disabled, icon, iconRight }) {
  const cls = "btn" + (variant === "ghost" ? " btn--ghost" : "");
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {icon ? <i className={`ti ti-${icon}`} style={{ fontSize: 14 }} /> : null}
      {children}
      {iconRight ? <i className={`ti ti-${iconRight}`} style={{ fontSize: 14 }} /> : null}
    </button>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className="tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ phase /* 1..4 */ }) {
  const labels = ["Profile", "Tier", "Schools", "Reveal"];
  return (
    <div>
      <div className="stepper">
        {labels.map((_, i) => {
          const n = i + 1;
          const cls = n < phase ? "step done" : n === phase ? "step current" : "step";
          return <div key={i} className={cls} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: -16, marginBottom: 18 }}>
        {labels.map((l, i) => (
          <span
            key={l}
            className="label"
            style={{
              color: (i + 1 === phase) ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: (i + 1 === phase) ? 500 : 400
            }}
          >
            0{i + 1} {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function difficultyKind(d) {
  if (!d) return "neutral";
  const x = d.toLowerCase();
  if (x === "easy") return "ok";
  if (x === "medium") return "warn";
  if (x === "hard") return "danger";
  return "neutral";
}

function ecTierKind(t) {
  // 1=ok (teal), 2=info (blue), 3=warn (amber), 4=neutral
  return t === 1 ? "ok" : t === 2 ? "info" : t === 3 ? "warn" : "neutral";
}

// Animated number that eases from 0 to target on mount.
function AnimatedNum({ value, duration = 900, format = (n) => Math.round(n).toString() }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, t0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="num">{format(n)}</span>;
}

function RankChip({ rank, totalPoints }) {
  return (
    <div
      title={`${rank.current.name} · ${totalPoints} pts`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "5px 12px 5px 8px",
        borderRadius: "var(--r-pill)",
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-1)",
        fontSize: 12,
        whiteSpace: "nowrap"
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "var(--accent-info-bg)", color: "var(--accent-info-fg)",
        display: "inline-flex", alignItems: "center", justifyContent: "center"
      }}>
        <i className={`ti ti-${rank.current.icon}`} style={{ fontSize: 13 }} />
      </span>
      <span style={{ color: "var(--text-secondary)" }}>{rank.current.name}</span>
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>·</span>
      <span className="num" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {totalPoints >= 0 ? totalPoints : `−${Math.abs(totalPoints)}`} pts
      </span>
    </div>
  );
}

function RankProgressBar({ rank, totalPoints }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "var(--accent-info-bg)", color: "var(--accent-info-fg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center"
          }}>
            <i className={`ti ti-${rank.current.icon}`} style={{ fontSize: 14 }} />
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em" }}>
            {rank.current.name}
          </span>
        </div>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>
          {rank.next
            ? `${Math.max(0, rank.next.min - totalPoints)} pts to ${rank.next.name}`
            : "Max rank reached"}
        </span>
      </div>
      <div style={{ height: 6, background: "var(--bg-surface-3)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.round(rank.progress * 100)}%`,
          background: "var(--accent-info-fg)",
          transition: "width 700ms cubic-bezier(.2,.7,.2,1)"
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>{rank.floor} pts</span>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>
          {rank.next ? `${rank.next.min} pts` : "—"}
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { Badge, Pill, Btn, Tabs, Stepper, difficultyKind, ecTierKind, AnimatedNum, RankChip, RankProgressBar });

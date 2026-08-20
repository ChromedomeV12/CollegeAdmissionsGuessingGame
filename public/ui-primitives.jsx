// Shared UI primitives used across phases.

const { useState, useEffect, useRef, useMemo } = React;

function Badge({ kind = "neutral", children, icon }) {
  return (
    <span className={`badge badge--${kind}`}>
      {icon ? <i className={`ti ti-${icon}`} style={{ fontSize: "var(--fs-sm)" }} /> : null}
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

function LanguageToggle() {
  const { lang, toggleLanguage, t } = window.I18N.useI18n();
  return (
    <button
      type="button"
      className="btn-ghost"
      data-testid="language-toggle"
      onClick={toggleLanguage}
      aria-label={t("nav.toggleLanguage")}
    >
      <i className="ti ti-world" aria-hidden="true" />
      {lang === "en" ? "中文" : "EN"}
    </button>
  );
}


function Btn({ onClick, children, variant, disabled, icon, iconRight, ariaLabel, title, testId }) {
  const cls = "btn" + (variant === "ghost" ? " btn--ghost" : "");
  // Icon-only buttons (no text children) must expose an accessible name.
  const iconOnly = !children;
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? (ariaLabel || title || undefined) : ariaLabel}
      title={title}
      data-testid={testId}
    >
      {icon ? <i className={`ti ti-${icon}`} style={{ fontSize: "var(--fs-md)" }} /> : null}
      {children}
      {iconRight ? <i className={`ti ti-${iconRight}`} style={{ fontSize: "var(--fs-md)" }} /> : null}
    </button>
  );
}

// WAI-ARIA tabs pattern: roving tabindex, Arrow/Home/End keyboard
// navigation (selection follows focus), and stable tab/panel id linkage.
function Tabs({ tabs, active, onChange, idBase = "tabs" }) {
  const tabRefs = useRef([]);
  const count = tabs.length;
  function onKeyDown(e) {
    const activeIdx = tabs.findIndex(t => t.id === active);
    let next = null;
    if (e.key === "ArrowRight") next = (activeIdx + 1) % count;
    else if (e.key === "ArrowLeft") next = (activeIdx - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    // All tab buttons always render, so the target is focusable now.
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="tabs" role="tablist" onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={el => { tabRefs.current[i] = el; }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`${idBase}-panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className="tab"
          data-testid={t.testId}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ phase /* 1..4 */ }) {
  const { t } = window.I18N.useI18n();
  const labels = [t("nav.profile"), t("nav.tier"), t("nav.schools"), t("nav.reveal")];
  return (
    <div className="stepper-wrap" aria-label={t("stepper.progress", { phase })}>
      <div className="stepper" aria-hidden="true">
        {labels.map((_, i) => {
          const n = i + 1;
          const cls = n < phase ? "step done" : n === phase ? "step current" : "step";
          return <div key={i} className={cls} />;
        })}
      </div>
      <div className="stepper-labels">
        {labels.map((label, i) => (
          <span
            key={i}
            className={`label${i + 1 === phase ? " is-current" : ""}`}
          >
            0{i + 1} {label}
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
  const { t } = window.I18N.useI18n();
  const rankName = t(`ranks.${rank.current.id}`);
  const points = totalPoints >= 0 ? totalPoints : `−${Math.abs(totalPoints)}`;
  return (
    <div className="rank-chip" title={t("rank.pointsTitle", { rank: rankName, points })}>
      <span className="rank-chip__icon">
        <i className={`ti ti-${rank.current.icon}`} aria-hidden="true" />
      </span>
      <span className="rank-chip__name">{rankName}</span>
      <span className="rank-chip__divider">·</span>
      <span className="num rank-chip__points">
        {t("rank.pointsValue", { points })}
      </span>
    </div>
  );
}

function RankProgressBar({ rank, totalPoints }) {
  const { t } = window.I18N.useI18n();
  const currentName = t(`ranks.${rank.current.id}`);
  const nextName = rank.next ? t(`ranks.${rank.next.id}`) : null;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "var(--accent-info-bg)", color: "var(--accent-info-fg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center"
          }}>
            <i className={`ti ti-${rank.current.icon}`} style={{ fontSize: "var(--fs-md)" }} aria-hidden="true" />
          </span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em" }}>
            {currentName}
          </span>
        </div>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>
          {rank.next
            ? t("rank.pointsToNext", { points: Math.max(0, rank.next.min - totalPoints), rank: nextName })
            : t("rank.maxReached")}
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--sp-1)" }}>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>{t("rank.pointsValue", { points: rank.floor })}</span>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>
          {rank.next ? t("rank.pointsValue", { points: rank.next.min }) : "—"}
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { Badge, Pill, Btn, Tabs, Stepper, difficultyKind, ecTierKind, AnimatedNum, RankChip, RankProgressBar, LanguageToggle });

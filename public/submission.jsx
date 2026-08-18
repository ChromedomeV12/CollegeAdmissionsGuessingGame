// Consent-first Reddit submission center. A URL is fetched only after the
// signed-in user grants temporary Reddit OAuth access and ownership matches.

const SUBMISSION_API_BASE = window.API_BASE || "";

const SUBMISSION_STATUS = {
  awaiting_reddit_verification: { label: "Awaiting Reddit verification", kind: "warn", icon: "brand-reddit" },
  verified_pending_review: { label: "Verified · pending review", kind: "ok", icon: "shield-check" },
  verification_expired: { label: "Verification expired", kind: "neutral", icon: "clock-off" },
  verification_cancelled: { label: "Verification cancelled", kind: "neutral", icon: "circle-x" },
  verification_failed: { label: "Ownership not verified", kind: "danger", icon: "shield-x" },
  pending_editorial_review: { label: "Editorial review", kind: "info", icon: "notes" },
  published: { label: "Published", kind: "ok", icon: "sparkles" },
  rejected: { label: "Not suitable for the game", kind: "neutral", icon: "archive" },
  withdrawn: { label: "Withdrawn · content purged", kind: "neutral", icon: "trash" },
};

function statusMeta(status) {
  return SUBMISSION_STATUS[status] || { label: status || "Unknown", kind: "neutral", icon: "circle-dotted" };
}

function formatSubmissionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SubmissionScreen({ token, onBack }) {
  const [config, setConfig] = React.useState(null);
  const [submissions, setSubmissions] = React.useState(null);
  const [redditUrl, setRedditUrl] = React.useState("");
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(() => new URLSearchParams(window.location.search).get("submission_status") || "");

  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    try {
      const [configResponse, submissionsResponse] = await Promise.all([
        fetch(`${SUBMISSION_API_BASE}/api/submissions/config`, { headers }),
        fetch(`${SUBMISSION_API_BASE}/api/submissions`, { headers }),
      ]);
      if (!configResponse.ok || !submissionsResponse.ok) throw new Error("Could not load the submission center");
      setConfig(await configResponse.json());
      setSubmissions(await submissionsResponse.json());
    } catch (err) {
      setError(err.message || "Could not load the submission center");
    }
  }

  React.useEffect(() => { load(); }, []);

  React.useEffect(() => {
    if (!notice) return;
    const cleanUrl = `${window.location.pathname}`;
    window.history.replaceState({}, "", cleanUrl);
  }, [notice]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!config?.redditOAuthConfigured) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch(`${SUBMISSION_API_BASE}/api/submissions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          redditUrl,
          consentAccepted,
          consentVersion: config.consentVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start verification");
      window.location.assign(data.authorizeUrl);
    } catch (err) {
      setError(err.message || "Could not start verification");
      setBusy(false);
    }
  }

  async function withdraw(submission) {
    if (!window.confirm("Withdraw this submission and purge its stored Reddit post content?")) return;
    setError("");
    try {
      const response = await fetch(`${SUBMISSION_API_BASE}/api/submissions/${submission.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not withdraw the submission");
      setSubmissions(current => current.map(item => (
        item.id === submission.id
          ? { ...item, status: "withdrawn", title: null, subreddit: null, canWithdraw: false, withdrawnAt: new Date().toISOString() }
          : item
      )));
      setNotice("withdrawn");
    } catch (err) {
      setError(err.message || "Could not withdraw the submission");
    }
  }

  const noticeCopy = {
    verified: "Ownership verified. Your post is now in the private editorial queue; it is not live in the game.",
    owner_mismatch: "We could not verify ownership because the signed-in Reddit account did not match the post author.",
    expired: "That verification link expired. Submit the URL again to generate a new one.",
    cancelled: "Reddit verification was cancelled. Nothing was imported.",
    failed: "Reddit could not complete verification. Nothing was published.",
    withdrawn: "Submission withdrawn. The stored post title and body were purged.",
  };

  return (
    <main className="submission-page fade-in" data-screen-label="Submission Center">
      <section className="submission-hero">
        <div className="submission-hero__copy">
          <span className="eyebrow">Owner-submitted cases only</span>
          <h2>Turn your own results post into a case.</h2>
          <p>
            Paste a Reddit post you authored. We ask Reddit to confirm the account, fetch only that post,
            and place an anonymized draft in a private review queue.
          </p>
        </div>
        <div className="proof-path" aria-label="Three-step ownership verification flow">
          <div><span>01</span><strong>Share link</strong><small>No fetch yet</small></div>
          <div><span>02</span><strong>Verify on Reddit</strong><small>Temporary access</small></div>
          <div><span>03</span><strong>Human review</strong><small>Nothing auto-publishes</small></div>
        </div>
      </section>

      {notice && noticeCopy[notice] && (
        <div className={`callout submission-notice ${notice === "verified" || notice === "withdrawn" ? "callout--success" : "callout--warning"}`} role="status">
          <i className={`ti ${notice === "verified" ? "ti-shield-check" : "ti-info-circle"}`} aria-hidden="true" />
          <span>{noticeCopy[notice]}</span>
        </div>
      )}

      {error && (
        <div className="callout callout--danger" role="alert">
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="submission-layout">
        <form className="submission-form card" onSubmit={handleSubmit}>
          <div className="section-head section-head--compact">
            <div className="title-block">
              <span className="eyebrow">New case</span>
              <h2>Submit your post</h2>
            </div>
          </div>

          <label className="field-label" htmlFor="reddit-post-url">Reddit post URL</label>
          <div className="url-field">
            <i className="ti ti-brand-reddit" aria-hidden="true" />
            <input
              id="reddit-post-url"
              type="url"
              inputMode="url"
              placeholder="https://www.reddit.com/r/collegeresults/comments/..."
              value={redditUrl}
              onChange={event => setRedditUrl(event.target.value)}
              required
              autoComplete="url"
            />
          </div>

          <label className="consent-card">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={event => setConsentAccepted(event.target.checked)}
            />
            <span className="consent-card__box" aria-hidden="true"><i className="ti ti-check" /></span>
            <span>
              <strong>I authored this post and consent to its use.</strong>
              <small>
                I allow Admissions Oracle to fetch this post through Reddit, create an anonymized game draft,
                and hold it for human review. The temporary Reddit token is not stored. I can withdraw before publication.
              </small>
            </span>
          </label>

          {config && !config.redditOAuthConfigured && (
            <div className="callout callout--warning">
              <i className="ti ti-tool" aria-hidden="true" />
              <span>Owner verification needs Reddit API credentials before this can accept submissions.</span>
            </div>
          )}

          <button
            className="btn-primary"
            type="submit"
            disabled={busy || !redditUrl.trim() || !consentAccepted || !config?.redditOAuthConfigured}
          >
            {busy ? "Opening Reddit…" : "Verify ownership with Reddit"}
            <i className="ti ti-arrow-up-right" aria-hidden="true" />
          </button>

          <p className="form-footnote">
            Requested Reddit scopes: <code>identity</code> and <code>read</code>. Access is temporary and used once.
          </p>
        </form>

        <aside className="trust-panel">
          <span className="eyebrow">Built for consent</span>
          <h3>What happens to the post?</h3>
          <ul>
            <li><i className="ti ti-lock" aria-hidden="true" /><span><strong>Private first.</strong> Verified posts wait for editorial review.</span></li>
            <li><i className="ti ti-user-scan" aria-hidden="true" /><span><strong>Proof, not a password.</strong> Reddit handles the sign-in.</span></li>
            <li><i className="ti ti-eye-off" aria-hidden="true" /><span><strong>Public identity removed.</strong> The game does not display the Reddit username or source link.</span></li>
            <li><i className="ti ti-trash" aria-hidden="true" /><span><strong>Withdrawal supported.</strong> Pending post content can be purged here.</span></li>
          </ul>
        </aside>
      </div>

      <section className="submission-history">
        <div className="section-head">
          <div className="title-block">
            <span className="eyebrow">Your queue</span>
            <h2>Submission history</h2>
          </div>
          <span className="sub">Only you can see these records.</span>
        </div>

        {!submissions && <CalmLoading label="Loading submissions…" minHeight="18vh" />}
        {submissions && submissions.length === 0 && (
          <div className="empty-dossier">
            <i className="ti ti-file-plus" aria-hidden="true" />
            <strong>No submitted posts yet.</strong>
            <span>Your first verified case will appear here.</span>
          </div>
        )}
        {submissions && submissions.length > 0 && (
          <div className="submission-list">
            {submissions.map(submission => {
              const meta = statusMeta(submission.status);
              return (
                <article className="submission-record" key={submission.id}>
                  <div className="submission-record__index" aria-hidden="true">
                    <i className={`ti ti-${meta.icon}`} />
                  </div>
                  <div className="submission-record__body">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span className="label">{submission.subreddit ? `r/${submission.subreddit}` : "Reddit submission"}</span>
                        <h3>{submission.title || "Post content removed"}</h3>
                      </div>
                      <Badge kind={meta.kind}>{meta.label}</Badge>
                    </div>
                    <div className="submission-record__meta">
                      <span>Submitted {formatSubmissionDate(submission.createdAt)}</span>
                      {submission.verifiedAt && <span>Verified {formatSubmissionDate(submission.verifiedAt)}</span>}
                    </div>
                  </div>
                  <div className="submission-record__actions">
                    <a className="btn btn--ghost" href={submission.redditUrl} target="_blank" rel="noreferrer">
                      View post <i className="ti ti-external-link" aria-hidden="true" />
                    </a>
                    {submission.canWithdraw && (
                      <button className="btn btn--danger-ghost" type="button" onClick={() => withdraw(submission)}>
                        Withdraw
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <button className="btn btn--ghost submission-back" type="button" onClick={onBack}>
        <i className="ti ti-arrow-left" aria-hidden="true" /> Back to the game
      </button>
    </main>
  );
}

Object.assign(window, { SubmissionScreen });

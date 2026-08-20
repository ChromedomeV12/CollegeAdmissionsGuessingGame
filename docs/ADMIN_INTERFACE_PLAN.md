# Maintainer interface assessment and plan

Assessment date: **2026-08-20**. This is a design plan, not an implemented admin surface.

## Recommendation

Keep the current workflow **CLI-only for the next small, invitation-only dataset**, harden its state model and withdrawal behavior first, then add a **private read-only operations dashboard** if queue monitoring becomes painful. Build a full browser review/publish interface only when submission volume or multiple reviewers justify its larger security and privacy surface.

Do not put `MAINTAINER_API_KEY` into a browser application. The current key is a shared server-side gate, not an admin identity, role system, or safe frontend credential. A future web interface must authenticate named maintainers through a separate admin session and enforce permissions on the server.

## Current workflow

The implemented path is deliberately narrow:

1. The normal player deployment keeps `SUBMISSIONS_ENABLED=false`.
2. An authenticated app account plus `X-Maintainer-Key` can create, list, confirm, or withdraw only that account's Reddit submission rows.
3. OAuth or edit-code proof moves a row to `verified_pending_review`.
4. `npm run export-verified` copies the row's source text into `data/queue.jsonl` and marks it `exported_pending_approval`.
5. `npm run approve` asks for an interactive approve/reject choice and writes approved records to `data/profiles.jsonl`.
6. The player server reloads the profile file for list/detail reads.

This is appropriate for a tiny queue controlled by one or two trusted maintainers. It is not yet a complete editorial system.

### Gaps to close before any admin UI

- There is no named admin identity, role, MFA, per-action authorization, or key rotation workflow. Any app user who also has the shared maintainer key can use the guarded submission API for their own rows.
- `GET /api/submissions` is per-user and capped at 25; it is not a global reviewer queue.
- There is no append-only audit table. `updated_at` shows only the latest row mutation.
- Rejection in `npm run approve` removes a queue line but does not persist a `rejected` transition on the originating database row.
- Approval does not mark the originating submission `approved` or `published`, so database state and playable content can diverge.
- Without `OPENROUTER_API_KEY`, the approval CLI copies the complete Reddit body into `qualitative_notes.raw_post`. The unauthenticated profile-list endpoint currently strips outcomes and `source` but not `qualitative_notes`, so approving that scaffold can publish the raw post body to every client. Raw source publication must be blocked before the workflow is enabled.
- With `OPENROUTER_API_KEY`, the approval CLI sends the title and up to 5,000 characters of the raw Reddit body to OpenRouter and the selected upstream model. Key presence is not consent or a legal basis, and the current workflow has no provider-contract, retention, processing-region, approved-model, or deletion-propagation gate.
- The export step updates SQLite and writes `queue.jsonl` through separate persistence mechanisms. A crash between them can produce an exported status without a durable queue line, or require manual reconciliation.
- Withdrawal purges the SQLite row's stored post fields, but an already exported queue line or published profile may retain derived content. End-to-end withdrawal propagation is not implemented.
- `npm run approve` rewrites `profiles.jsonl` directly. Publication should use validation plus a temporary file and atomic rename, with a recoverable previous version.
- Raw post bodies are duplicated into `queue.jsonl`; copies make retention and deletion harder.
- The OAuth ownership fingerprint is keyed with `JWT_SECRET`; the edit-code fallback does not store one. A separate purpose-bound, rotatable secret is preferable if deterministic OAuth correlation remains necessary.
- Rate limiting is in process memory and resets on restart. It is not an abuse-control system for a multi-instance or public admin service.

These are data-model and integrity problems. A polished UI over them would make the workflow easier to invoke without making it safe.

## Option comparison

| Option | Benefits | Risks / costs | Best fit | Decision |
|---|---|---|---|---|
| CLI-only | Smallest attack surface; secrets stay in maintainer environment; easy to inspect each low-volume case; no new public routes | Weak collaboration, search, audit visibility, queue reconciliation, and withdrawal propagation; shell/server access required | One or two trusted maintainers, a few cases per month | **Keep now, after hardening** |
| Read-only operations dashboard | Queue health and failures become visible; useful without allowing browser mutations; can expose aggregate monitoring only | Still needs named admin authentication, private deployment, safe metrics, and log hygiene | Small team that needs status/health but reviews through CLI | **Build second if needed** |
| Full import/review admin UI | Central review, structured editing, consent evidence, reject/approve/publish, withdrawal, and audit history | Largest attack surface; handles sensitive source prose; requires RBAC, MFA, CSRF/XSS controls, durable state machine, migrations, backups, and operational ownership | Multiple reviewers or sustained queue volume | **Defer until foundations and demand exist** |

“Read-only” must be enforced at the API and database permission layer, not only by hiding buttons.

## Data-minimization rules

### Keep

- random submission ID;
- internal app user ID, kept separately from public profile identity;
- canonical source URL and Reddit post ID only as long as needed for consent/withdrawal/audit obligations;
- consent version and timestamps;
- proof method, result, and expiry timestamps without OAuth tokens;
- current workflow status and non-sensitive reason codes;
- separately stored sanitized editorial draft and published profile;
- minimum non-content tombstone necessary to demonstrate withdrawal or rejection;
- append-only event metadata: actor ID, action, object ID, timestamp, prior/new state, request/correlation ID.

### Avoid or purge

- OAuth access/refresh tokens;
- plaintext maintainer keys or secrets;
- Reddit usernames in player data or ordinary logs;
- raw request/response bodies in logs;
- source prose in metrics, audit events, error trackers, or support screenshots;
- raw or identifiable source prose sent to a third-party AI service unless the recorded consent version explicitly covers that purpose and provider path, the provider/model has passed contract, retention, training-use, region, and deletion review, and the outbound fields have been minimized and redacted;
- duplicate post bodies across SQLite, JSONL queues, caches, backups, and exports;
- unsalted hashes of usernames or short identifiers presented as anonymization;
- source text after withdrawal or expiry unless a documented legal basis requires a narrowly scoped hold.

Use encrypted disks and encrypted off-host backups, but do not treat encryption as a substitute for collection limits and deletion. Access to raw source text should be exceptional, logged, and role-restricted.

## Monitoring model

The first dashboard, if built, should show aggregates rather than people or prose:

- counts by state;
- oldest item age and age buckets, not exact content;
- verification success/failure/expiry rates by proof method;
- export, validation, translation, and publication job failures;
- median and upper-percentile time from consent to verification, review, publish, reject, or withdrawal;
- withdrawal completion lag and purge failures;
- queue growth, reviewer throughput, and retry counts;
- database/volume free space, last successful backup, last restore drill, and build/profile validation status;
- service health without secrets, source URLs, usernames, titles, or post excerpts.

Small cohorts can be identifying. Suppress or coarsen breakdowns below a minimum count, limit time ranges, and never expose metrics publicly.

## Workflow and state machine

Replace loose SQLite-plus-JSONL coordination with one authoritative database workflow. A proposed state model:

```text
awaiting_reddit_verification / awaiting_fallback_code
        ├── verification_expired | verification_cancelled | verification_failed
        └── verified_pending_review
                ├── in_review ──> changes_requested ──> in_review
                ├── rejected
                └── approved_pending_publish ──> published

any non-purged state ──> withdrawal_requested ──> withdrawn
job failures          ──> needs_attention ──> prior valid state (controlled retry)
published replacement ──> superseded

verification_expired / verification_cancelled / verification_failed / withdrawn
        └── fresh consent + new submission ID ──> awaiting_reddit_verification / awaiting_fallback_code
```

Rules:

- Every transition has an allowed prior state, named actor/service identity, timestamp, reason code, and optimistic version.
- Mutations are idempotent. Retried requests use an idempotency key and cannot publish twice.
- Verification never implies approval; approval never implicitly publishes.
- Publish validates the complete `GameRecord`, translation/provenance state, consent state, and withdrawal state in one server-side transaction/job boundary.
- Reject requires a controlled reason; user-facing explanations must not leak internal abuse signals.
- Withdrawal outranks review and publish. It cancels jobs, removes source/derived content from active stores, invalidates caches, removes or replaces the playable profile, schedules backup expiry, and records only the minimum tombstone.
- Expired, cancelled, failed, and withdrawn submissions are terminal records. A person may resubmit, but the system creates a new random submission ID linked by a restricted `retry_of` reference, records the then-current consent version and timestamp, and repeats ownership proof. It never reopens or overwrites the old audit trail. After withdrawal, source text may be reacquired only after withdrawal completion and fresh consent; the old non-content tombstone remains immutable.
- `needs_attention` is not a new consent state. A controlled, idempotent job retry may return to the recorded prior valid state only after rechecking that consent remains current, no withdrawal is pending, and the retention deadline has not passed. Otherwise it terminates or requests fresh consent through a new submission.
- Publication artifacts use write-to-temporary, fsync where applicable, atomic rename, and a recoverable prior version. A database-backed content store is preferable once deployment moves beyond one instance.

## Roles and authentication

Use named identities; never infer an admin role from possession of an ordinary game JWT.

| Role | Allowed actions |
|---|---|
| `ops_viewer` | Aggregate metrics, service/job health, redacted event history |
| `reviewer` | Open assigned source, create/edit sanitized draft, request changes, reject, or editorially approve a draft last edited by a different named actor |
| `publisher` | Validate and publish an approved draft; cannot manage roles or secrets |
| `privacy_operator` | Execute and verify withdrawal/purge; view only the data needed for that request |
| `admin_owner` | Manage roles, emergency access, integrations, and policy—not routine content review by default |
| service identities | OAuth callback, verification, translation, validation, publish, retention, and backup jobs with narrow scopes |

For a small team, one person may hold multiple roles, but the audit record must state which permission authorized each action. Editorial approval must be performed by a named reviewer other than the draft's last editor; a publisher cannot supply that missing approval merely by also holding the reviewer role. The publishing actor may also be the approving reviewer, but the editor and approver remain distinct people. An `admin_owner` emergency override requires recent re-authentication, a controlled reason, and a prominent audit event and is never the normal one-person path. High-impact actions—publish, purge failure override, role change, secret rotation—should require recent re-authentication. Use an identity-aware proxy or established OIDC provider with MFA rather than building password recovery and MFA from scratch.

Admin browser sessions should use short-lived, Secure, HttpOnly, SameSite cookies; server-side CSRF protection; strict origin checks; session revocation; and idle/absolute timeouts. Render imported prose only as escaped text, never raw HTML. Apply a restrictive CSP and prevent source content from reaching analytics/error tools.

## `MAINTAINER_API_KEY` boundary

Today the key is appropriate only as a temporary guard for the enabled **submission HTTP API**. The existing export and approval CLI commands do not use it; trusted shell, database, and file access are a separate privileged boundary that needs its own host access controls and audit trail.

- keep it in environment/secret storage;
- send it only over HTTPS;
- never place it in client JavaScript, HTML, local storage, screenshots, logs, shell history, or repository files;
- rotate it after exposure or staff change;
- keep the player deployment's submission feature disabled.

For a web admin interface, either remove the shared header from human requests or confine it to a backend-for-frontend that is itself privately authenticated. The browser presents an admin session; the server resolves a named actor and enforces RBAC. Service-to-service credentials should be separate per service, scoped, rotatable, and auditable. The OAuth callback remains authorized by its hashed, short-lived, single-use state rather than a browser-visible maintainer key.

## Phased implementation plan

### Phase 0 — harden the CLI workflow

1. Add schema migrations for `submission_events`, `editorial_drafts`, `publication_jobs`, actor/service identities, optimistic versions, and retention deadlines.
2. Make source text single-copy where possible. Store sanitized drafts separately from immutable consent/proof metadata.
3. Replace JSONL export as the authoritative queue with database transactions and idempotent jobs. Keep export only as a signed/redacted backup or interchange operation.
4. Persist approve/reject/publish/supersede states back to the originating submission.
5. Prohibit `qualitative_notes.raw_post` and all other raw source fields in player-facing records. Make publication fail closed if a raw-body sentinel or unapproved free-form source field survives validation, and add unauthenticated API regression tests.
6. Disable OpenRouter/raw-text AI egress by default. Before enabling it, require an explicit consent version and purpose for provider processing; an allowlisted provider and exact model/version; reviewed terms or DPA covering retention, no training or secondary use, deletion, and processing region; field minimization/redaction; and deletion propagation on withdrawal. Audit only outbound metadata—not prose—and use synthetic or de-identified text for evaluation. Apply the privacy gates in `PROFILE_TRANSLATION_PIPELINE.md` to this extraction step too.
7. Implement end-to-end withdrawal across source, draft, translation, queue, published profile, caches, backups, and every approved AI provider according to the retention policy.
8. Validate full records before publish and write the playable artifact atomically with rollback.
9. Add a read-only CLI status command, reconciliation command, dry-run purge, backup check, and audit query.
10. Separate the OAuth ownership-fingerprint secret from `JWT_SECRET`; document rotation and correlation behavior.
11. Add persistent rate limiting and security events without logging source content or secrets.
12. Replace the current terminal-state row reuse with new-record resubmission, retaining immutable tombstone/audit linkage and requiring fresh consent and ownership proof.

Exit gate: crash/retry tests cannot lose, duplicate, or publish a case; withdrawal tests find no active source/derived copy; every transition has an audit event.

### Phase 1 — private read-only operations dashboard

1. Deploy on a separate admin origin behind OIDC/MFA or an identity-aware proxy.
2. Add aggregate-only endpoints with the `ops_viewer` role and minimum-cohort suppression.
3. Show queue age, status counts, job health, backup freshness, restore-drill status, and purge failures.
4. Keep all mutations in CLI; verify API and database permissions reject writes from the dashboard identity.
5. Add access logging by named actor without query text, post bodies, URLs, or secrets.

Exit gate: a compromised viewer session cannot read source prose or mutate workflow state.

### Phase 2 — review workspace

1. Add reviewer assignment/lease, sanitized source view, structured draft editor, validation, comments, and controlled reason codes.
2. Add reject, request-changes, and approve transitions with optimistic concurrency and idempotency. Enforce that the approving reviewer differs from the draft's last editor, and test multi-role users and the audited emergency override explicitly.
3. Integrate translation status/provenance from `PROFILE_TRANSLATION_PIPELINE.md`; protect stable school names, IDs, and tier codes.
4. Keep publish a separate `publisher` action with a final diff, consent/withdrawal check, and recent re-authentication.
5. Add a privacy-operator withdrawal view that proves each active copy and cache was removed.
6. Exercise XSS, CSRF, broken-access-control, session-revocation, audit-integrity, concurrency, rollback, and purge tests.

Exit gate: reviewers can complete the lifecycle without server shell access, and no browser receives a shared service secret.

### Phase 3 — operational maturity

- retention sweeper and legal-hold exception process;
- periodic role review and emergency-access drill;
- encrypted backup rotation and restore objectives;
- audit export with integrity protection and access controls;
- incident playbooks for secret exposure, unauthorized publish, failed purge, Reddit API changes, and corrupted profile artifacts;
- documented SLA/SLO only after monitoring data supports it.

## Deployment implications

- **One host + SQLite:** acceptable for the hardened CLI and a very small private admin surface. Mount `data/` on durable storage, run one writer topology, back up off-host, and accept brief deployment downtime.
- **Separate admin service:** two services cannot safely share a local SQLite file. Either keep the admin backend on the same protected host/process boundary or migrate authoritative workflow state to a network database before separation.
- **Public player environment:** keep `SUBMISSIONS_ENABLED=false`, omit Reddit/admin/LLM secrets, and expose no admin routes or assets.
- **Maintainer environment:** private origin, HTTPS, named admin auth, restricted inbound access, persistent database, audit/backup storage, and no raw-text egress by default. Permit egress only to approved providers/models after the Phase 0 consent, contract, retention, region, minimization, and deletion gates pass.
- **Mainland deployment:** the admin plane need not be mainland-accessible just because the game is. Keeping sensitive editorial tooling in one controlled region reduces duplicate data and compliance scope; confirm cross-border/data-residency requirements before choosing providers.
- **Scaling:** migrate away from local files before multiple app/admin instances, background job workers, or cross-region publishing. Do not place SQLite on an arbitrary network filesystem.

## Build trigger

Start the read-only dashboard when any two are true:

- more than two active maintainers;
- more than roughly ten pending items or repeated stale-queue incidents;
- monitoring requires regular shell/database access;
- a missed verification, failed purge, or queue divergence occurs;
- audit reporting becomes a contractual or regulatory requirement.

Start the full review UI only after Phase 0 is complete and measured workload shows that CLI review is the bottleneck. Convenience alone is not enough reason to move raw applicant prose and publish controls into a browser.

# Deployment options: zero-cost demo, mainland best effort, and production

Research checked on **2026-08-20**. Hosting plans and regional rules change; re-check the linked primary documentation before provisioning or budgeting.

## Decision

There is no honest zero-cost option that provides all of the following for the current app:

- a continuously available Node process;
- durable SQLite storage;
- dependable access from both the global Internet and the Chinese mainland;
- a custom domain, managed TLS, backups, monitoring, and production support.

The best zero-dollar fit for the code as written is an **Oracle Cloud Always Free VM** in an eligible nearby home region, with the repository, Node, Caddy, and `data/game.db` on the VM's persistent boot/block volume. It is suitable for a private demo or small hobby deployment, not a reliability promise. Oracle documents both persistent Always Free block storage and important constraints: home-region-only capacity, possible “out of host capacity” errors, reclamation of idle free compute, and a credit-card requirement for most sign-ups ([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Free Tier account details](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)).

For an easier disposable demo, Render or Koyeb can run the Node process for free, but neither free web tier can preserve the app's SQLite file. Render explicitly loses local SQLite on restart, redeploy, or idle spin-down; Koyeb free instances cannot attach volumes ([Render free limitations](https://render.com/docs/free), [Koyeb free instances](https://www.koyeb.com/docs/reference/instances), [Koyeb volumes](https://www.koyeb.com/docs/reference/volumes)). Do not present either configuration as a persistent launch.

If **reliable mainland-China access is a launch requirement**, budget for a mainland origin or mainland CDN, a qualifying domain and hosting account, ICP filing, post-launch PSB filing, operations, and backups. That is not a zero-cost deployment.

## What this repository needs

The current runtime is not a static site:

- `server.js` is a long-running Express process and serves authenticated `/api/*` routes.
- `better-sqlite3` opens `data/game.db` in WAL mode. Users, scores, locks, rivals, consent receipts, and submission state are writes that must survive restarts.
- SQLite requires one durable writable filesystem shared with its `-wal` and `-shm` files. The simplest safe topology is one app instance plus tested backups; horizontally scaling several instances around one local SQLite file is out of scope.
- `data/profiles.jsonl` is deployment content, while `data/game.db` is mutable application state. Backups must distinguish them.
- Native `better-sqlite3` installation needs a supported Node/CPU combination or a working native build toolchain. Verify this before choosing an Arm VM.
- `SUBMISSIONS_ENABLED` should remain `false` on the public player deployment. A maintainer environment requires separate secrets and a tighter security boundary.

GitHub Pages cannot host the app as written because it publishes static HTML, CSS, and JavaScript, not the Express API ([GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)). Cloud Run has a free allowance and can run Node containers, but its writable filesystem is disposable, so the existing SQLite design is not durable there ([Cloud Run filesystem](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)).

## Development-source dependency risk and production status

The source-oriented development page at `public/index.html` still makes runtime requests to:

| Purpose | Host today | Failure impact |
|---|---|---|
| DM Sans, IBM Plex Mono, Space Grotesk | `fonts.googleapis.com`, `fonts.gstatic.com` | Typography falls back; requests can be slow or unavailable by network/provider. |
| Tabler icon webfont and Three.js | `cdn.jsdelivr.net` | Icons disappear; the Three.js wallpaper falls back to the built-in SVG. |
| Tailwind Play CDN | `cdn.tailwindcss.com` | Utility CSS/runtime configuration may not load. |
| React, ReactDOM, Babel standalone | `unpkg.com` | The app cannot boot if any required script fails. |
| School logos | `logo.clearbit.com` | This API is retired; requests no longer return logos. Local initials are the working fallback. |

Recent GreatFire measurements found the tested `unpkg.com` and top-level `cdn.jsdelivr.net` URLs reachable, while also showing mixed results across jsDelivr hosts/paths; its sparse Google Fonts sample measured low throughput. These observations are a dated measurement, not an availability guarantee ([unpkg measurement](https://en.greatfire.org/https/unpkg.com), [jsDelivr measurement](https://en.greatfire.org/https/cdn.jsdelivr.net), [Google Fonts measurement](https://en.greatfire.org/https/fonts.googleapis.com)). More fundamentally, Cloudflare states that traffic routed across China's network boundary faces material latency and reliability problems ([Cloudflare China Network overview](https://developers.cloudflare.com/china-network/)).

Two of the current choices are also explicitly development-only: Tailwind says Play CDN is not intended for production, and Babel says production apps should normally transpile ahead of time instead of using `@babel/standalone` ([Tailwind Play CDN](https://tailwindcss.com/docs/installation/play-cdn), [Babel standalone](https://babeljs.io/docs/babel-standalone/)).

The Clearbit Logo API is not merely a regional risk: HubSpot shut it down on 2025-12-08 and states that `logo.clearbit.com` requests no longer return logos ([HubSpot sunset notice](https://developers.hubspot.com/changelog/upcoming-sunset-of-clearbits-free-logo-api)).

The production path now resolves these items:

1. `npm run build` bundles production React/ReactDOM, Three.js, and Tabler icons.
2. JSX is transpiled ahead of time; production does not load browser Babel.
3. The Tailwind Play CDN and Google Fonts are removed from the production page in favor of existing application CSS and a system font stack.
4. The retired Clearbit request is removed and school initials are rendered locally.
5. Hashed local assets are served with immutable caching and a restrictive Content Security Policy.
6. `npm run test:production` boots the built app in a browser and rejects third-party HTTP(S) requests or browser errors.

This change improves every region: one first-party origin becomes the only page-load dependency, and a blocked or slow third-party host can no longer prevent boot.

## Option matrix

| Option | Runs current Node app | Durable current SQLite | Free-tier behavior | Domain / TLS | Appropriate use |
|---|---:|---:|---|---|---|
| Oracle Cloud Always Free VM | Yes | Yes, on boot/block volume | Capacity can be unavailable; idle instances may be reclaimed; operator manages OS and backups | Bring a domain; Caddy can provision and renew public TLS when DNS and ports 80/443 are configured ([Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)) | **Recommended zero-dollar demo** after CDN hardening |
| Render Free web service | Yes | **No** | Sleeps after 15 minutes; wake can take about a minute; filesystem and SQLite changes are lost; no free persistent disk | Custom domains and managed TLS included | Disposable UI/API preview only |
| Koyeb Free instance | Yes | **No** | 512 MB / 0.1 vCPU; scales to zero after one idle hour; free instances cannot attach volumes | Custom domain and automatic TLS supported ([Koyeb domains](https://www.koyeb.com/docs/run-and-scale/domains)) | Disposable preview only |
| Koyeb Free + managed PostgreSQL | After a database rewrite | Yes, within service limits | Free DB is 1 GB but only 5 compute-hours/month and sleeps after five idle minutes ([Koyeb databases](https://www.koyeb.com/docs/databases)) | Same as Koyeb | Low-traffic experiment, not a no-change deployment |
| Google Cloud Run | Yes in a container | **No** | Scales to zero and has a free allowance; writable overlay disappears with the instance | Managed platform domain/TLS; custom-domain setup is platform/region dependent | Stateless rewrite or external-database architecture |
| GitHub Pages | **No** | No | Static files only | Supports GitHub and custom domains | Documentation or a separately rewritten static demo |
| Paid single VM + persistent disk | Yes | Yes | No free-tier reclamation, but still one-machine failure risk | Domain plus automated TLS | Small global production / best-effort mainland |
| Mainland origin/CDN + global delivery | Yes, after platform setup | Yes with paid storage/database | Requires paid infrastructure and compliance work | ICP-qualified domain, TLS, DNS/CDN | Reliable mainland plus global production |

Render's free plan includes custom domains and managed TLS but says the free filesystem, including local SQLite, is ephemeral and free Postgres expires after 30 days ([Render free documentation](https://render.com/docs/free)). Koyeb documents that its free instance cannot use a persistent volume, and its volumes are currently preview, single-instance, and non-redundant even on eligible paid instances ([Koyeb volume limitations](https://www.koyeb.com/docs/reference/volumes)). These are architectural blockers, not minor deployment settings.

## Mainland-China reality

### Best effort without mainland hosting

A VM in a nearby non-mainland region, a first-party domain, and zero third-party runtime dependencies can be reasonably usable for some mainland users. It still crosses China's international network boundary. Routing quality varies by carrier, province, time, domain, and IP; a Hong Kong or Singapore location is proximity, not a guarantee.

Cloudflare's ordinary global proxy or a Hong Kong point of presence should not be described as “China acceleration.” Cloudflare says actual in-mainland delivery uses its JD Cloud-operated China Network, which is a separate Enterprise subscription and requires an ICP filing or license for every onboarded apex domain ([availability and ICP requirements](https://developers.cloudflare.com/china-network/)).

Treat this tier as **best effort**:

- choose the nearest eligible region only after tests from China Telecom, China Unicom, and China Mobile;
- self-host all boot-critical assets;
- use a stable first-party domain and valid TLS;
- monitor DNS resolution, TCP/TLS handshake, time to first byte, asset errors, and API latency from multiple provinces;
- keep a tested database backup and restore procedure;
- document that access can degrade or stop without a code change.

### Reliable mainland service

Alibaba Cloud's current guidance says a site hosted on a Chinese-mainland server needs an ICP filing. Its filing workflow also calls for a PSB filing within 30 days after launch; a commercial paid-information service may require an ICP license rather than only a non-commercial filing ([ICP requirements](https://www.alibabacloud.com/help/en/icp-filing/basic-icp-service/product-overview/icp-filing-requirements-for-a-regular-website), [filing workflow](https://www.alibabacloud.com/help/en/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)). Eligibility depends on the filing entity, domain registration, identity verification, service provider, and province. Get qualified local advice before launch.

Alibaba CDN documents the practical boundary: “Global (Excluding the Chinese Mainland)” sends mainland clients to overseas points such as Japan, Singapore, or Hong Kong and needs no ICP filing; acceleration that includes mainland edge nodes requires one ([CDN acceleration regions](https://www.alibabacloud.com/help/en/cdn/user-guide/change-the-accelerated-region)).

A realistic reliable design is therefore paid:

- global origin or region plus mainland origin/edge, or a vendor product explicitly covering both;
- ICP/PSB and any content-specific or commercial licensing;
- domain/DNS ownership under the qualifying entity;
- replicated or deliberately separated data, with a documented data-residency decision;
- paid monitoring, backups, incident response, and renewal ownership.

Do not split SQLite across regions. Either keep one authoritative region and accept cross-border writes, or migrate to a database architecture designed for the chosen residency and replication model.

## Recommended rollout

### Stage 0 — local and CI

- Keep the current local workflow and `npm test` gate.
- Keep `SUBMISSIONS_ENABLED=false`.
- Use the production build and smoke test, rather than the CDN-backed development page, before evaluating carrier performance.

### Stage 1 — zero-dollar private demo

1. Provision one eligible Oracle Always Free VM; choose the home region carefully because Always Free compute is home-region-bound.
2. Confirm the selected CPU architecture can install `better-sqlite3` before moving data.
3. Deploy `deploy/compose.private.yaml`; its named volume keeps `/app/data` persistent and it runs one app process.
4. Keep the application published only on VM loopback and access it through the documented SSH tunnel. A reviewed VPN or identity-aware proxy can replace the tunnel later.
5. Do not expose the raw origin. The current public register/login endpoints are not rate-limited and bcrypt work can exhaust a small VM.
6. Keep SSH restricted, set a strong `JWT_SECRET`, and keep maintainer submission routes disabled.
7. Back up `profiles.jsonl` and a consistent SQLite snapshot to a second location; rehearse restore.
8. Add uptime and disk-space checks. Expect possible free-capacity or idle-reclamation interruptions.

This is the recommended “launch somewhere for free” answer, with the explicit label **private demo / hobby, best-effort mainland**.

### Stage 2 — small public launch

- Move to a paid VM or managed service with persistent storage and backups.
- Use one instance while SQLite remains the database.
- Add persistent IP- and account-aware rate limits for registration and login, plus credential-abuse monitoring, before exposing those endpoints publicly.
- Publish privacy, consent, and deletion information; replace legacy seed cases with consented or synthetic content.
- If optional OpenRouter structuring is enabled, obtain explicit owner consent for that external data transfer and review the provider contract, retention, and deletion terms before sending post text.
- Separate player and maintainer environments. Do not expose the maintainer key to a browser bundle.
- Add health checks, log retention, alerting, dependency/security updates, and a restore objective.

### Stage 3 — mainland reliability

- Select a mainland-capable provider and qualifying legal/filing route.
- Complete ICP before launch and PSB within the applicable post-launch window; confirm any additional licensing before making an availability claim.
- Decide data residency and whether PostgreSQL or another managed database replaces SQLite.
- Contract for mainland delivery rather than assuming an overseas CDN, Hong Kong region, or Cloudflare Free/Pro is equivalent.
- Run carrier/province acceptance tests and ongoing synthetic monitoring.

## Go/no-go checklist

- [x] Production bundle contains no boot-critical third-party CDN requests.
- [x] Retired Clearbit logo requests are removed; local initials/assets are verified.
- [ ] Node version and `better-sqlite3` install are verified on the target architecture.
- [ ] `data/` is on persistent storage; app runs as a single SQLite writer topology.
- [ ] Automated off-host backup and restore test pass.
- [ ] Domain, DNS, TLS renewal, and owner contacts are documented.
- [ ] `JWT_SECRET` is strong; `SUBMISSIONS_ENABLED=false` in the public environment.
- [ ] A private demo has VPN/proxy/allowlist access; a public launch has persistent registration/login rate limits and credential-abuse monitoring.
- [ ] Privacy/deletion contact is published; public cases are consented or synthetic.
- [ ] Global and mainland measurements are labeled with date, carrier, region, and limitations.
- [ ] Mainland reliability claims are withheld until the appropriate filing, infrastructure, and carrier tests are complete.

## Re-check triggers

Repeat the research if a provider changes its free tier, if the app migrates off SQLite, if submissions are enabled, if a mainland entity/provider is selected, or before making any public availability claim. A passing test from one city or carrier is not evidence of nationwide reliability.

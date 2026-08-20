# Profile Translation Pipeline Research

> **Status: research and design only.** This document does not enable profile translation, call a translation provider, change the profile schema, or publish translated applicant content. Provider facts were checked against primary sources on **2026-08-20**. Pricing, quotas, availability, and terms must be rechecked before implementation.

## Executive recommendation

Build an asynchronous, maintainer-only, provider-neutral translation stage between consent verification and human approval. Never translate during page rendering and never overwrite the imported source fields.

For an initial evaluation, benchmark three paths on the same **synthetic or irreversibly de-identified** admissions-language test set. Do not use real applicant text until explicit machine-translation consent, field sensitivity, provider contract/DPA, processing region, and retention gates have all passed:

1. **Azure Translator F0 for the global path**: the most generous currently documented global monthly free allowance in this comparison, explicit no-trace treatment for text translation, and published latency guidance.
2. **Alibaba Cloud Machine Translation as the mainland-China benchmark candidate**: its current REST documentation identifies a China (Hangzhou) service, and the product has a recurring free allowance and terminology controls. Evaluate it with synthetic or fully de-identified fixtures first. The China-site Machine Translation terms allow business data that may contain personal information to be used for service improvement/optimization, so do not send applicant text unless the applicable contract and consent make that secondary use acceptable.
3. **Argos Translate locally as the private/offline baseline**: no provider receives the text and there is no metered quota. Do not ship or commercially rely on a model until its individual model-package license is confirmed and its English/Simplified-Chinese quality passes the admissions test set.

Do not choose a production provider from marketing claims alone. Chinese support is documented for every candidate, but none of the reviewed primary sources establishes comparative quality on US-admissions profiles. Human approval remains mandatory regardless of provider.

Avoid public community LibreTranslate instances for applicant text. Self-host LibreTranslate only if an HTTP service is operationally useful; it uses Argos underneath and does not inherently improve model quality. Do not plan new work around the old DeepL API Free plan: DeepL now says that plan cannot be newly purchased, while the replacement Developer offer has different quota and retention terms.

## How to read the comparison

- **Mainland-capable** means there is either an officially documented mainland service or the software can be hosted on infrastructure selected by this project. It does not mean that an overseas endpoint is reliably reachable through the Great Firewall.
- **Free quota** excludes temporary new-account cloud credits unless the provider documents a recurring product allowance.
- **Quality** below means capabilities and risks documented by the provider. It is not an independent quality ranking.
- **Latency** is reported only where the provider publishes a number. Otherwise it must be measured from the intended deployment regions.
- Legal notes are engineering risk flags, not legal advice.

## Provider comparison

### Quota, throughput, latency, and hosting

| Option | Current free use | Request/rate limits | Published latency | Self-hosting burden |
|---|---|---|---|---|
| **LibreTranslate** | Self-hosted use has no vendor character quota. The hosted service has **no free trial**; its current Pro plan is US$29/month. | A self-hosted instance defaults to no character, request-per-minute, or batch limit; operators must configure safe limits. Hosted Pro advertises bursts up to 80 translations/minute. | No service-level number found; depends on CPU/GPU, model set, text length, and queueing. | High: run and patch an AGPL HTTP service, download models, set API keys/rate limits, monitor workers, and provision CPU/RAM. It is powered by Argos Translate. |
| **Argos Translate** | Free local execution; no metered character quota. | No vendor rate limit. Throughput is bounded by the host and model. Language packages average about 100 MB, and optional CUDA acceleration is supported. | No service-level number found; benchmark the exact model and hardware. | Medium: integrate a Python worker, pin model files and checksums, update packages deliberately, and monitor memory/CPU. No separate web service is required. |
| **Google Cloud Translation NMT** | First **500,000 characters/month** across Basic and Advanced, applied as a non-rollover US$10 monthly credit. | Default general-model quota is **6,000,000 characters/minute** per project and per user; daily characters are unlimited but billable after the credit. | No general text latency commitment found in the reviewed documentation; measure from deployment regions. | Low operational burden; proprietary managed API. Billing and IAM configuration are still required. |
| **Azure Translator F0** | **2,000,000 characters/month** of standard translation/custom-training use. | F0 service limit is **2,000,000 characters/hour**, consumed evenly (about 33,300/minute), with up to 50,000 characters per translate request. | Microsoft documents typical responses of **150–300 ms** for text under 100 characters, a 15-second maximum for standard models, and 120 seconds for custom models. | Low for the global managed service. Free disconnected/self-hosted containers are not part of the documented F0 offer. |
| **DeepL API Free / Developer** | Existing API Free subscriptions retain **500,000 characters/month**, but DeepL says API Free can no longer be purchased. The current Developer signup advertises **1,000,000 characters total**, not a recurring monthly quota. | 128 KiB total request limit. No fixed requests/second number is published; load-based HTTP 429 responses require exponential backoff. | No fixed response-time commitment found; persistent HTTP connections are recommended for low latency. | Low operational burden; proprietary managed API only. Plan migration and retention differences add product risk. |
| **Alibaba Cloud Machine Translation** | Universal and professional editions each document **1,000,000 characters/month** free, followed automatically by paid usage if enabled. | The published previous-version limits page reports **50 QPS** and fewer than 5,000 characters per request for general/professional text; batch entries are below 1,000 characters. Confirm the account's current quota in Quota Center before implementation. | No response-time commitment found. The API documents timeout errors and retry behavior; benchmark mainland and overseas callers separately. | Low for the managed service. The cited REST edition is documented in China (Hangzhou); account/API-specific region confirmation, RAM credentials, budgets, and throttling are still required. |

Primary quota and limit sources: [LibreTranslate installation flags](https://docs.libretranslate.com/guides/installation/), [LibreTranslate hosted plans](https://portal.libretranslate.com/), [Argos project and package guidance](https://github.com/argosopentech/argos-translate), [Google pricing](https://cloud.google.com/products/translate/pricing), [Google quotas](https://cloud.google.com/translate/quotas), [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/translator/), [Azure service limits](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits), [DeepL API plans](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans), [DeepL usage limits](https://developers.deepl.com/docs/resources/usage-limits), [Alibaba pricing](https://www.alibabacloud.com/help/en/machine-translation/product-overview/product-pricing), and [Alibaba API limits](https://help.aliyun.com/zh/machine-translation/developer-reference/limits-for-apis-of-previous-version).

### Mainland/global availability, privacy, quality controls, and terms

| Option | Mainland China and global use | Privacy and retention | Chinese/admissions quality controls | Commercial/terms risk |
|---|---|---|---|---|
| **LibreTranslate** | Can be deployed wherever the project has compliant infrastructure. A mainland public deployment needs the hosting/domain filings described below; an overseas deployment is only best-effort for mainland users. | With a controlled self-host, source text can stay inside that environment. No reviewed hosted-service page states a translation-text retention guarantee, so do not send applicant data to a public/shared instance. | Chinese is available through Argos models. LibreTranslate adds detection, batching, caching, and an API but uses the same underlying model family. Protect school names and tier codes before translation. | Server code is AGPL-3.0. Network deployment—especially modified deployment—requires an AGPL compliance review and corresponding-source process. |
| **Argos Translate** | Fully offline after model installation, so availability follows the worker's hosting. A worker beside the existing app avoids cross-border calls; mainland hosting compliance still applies. | Strongest data-minimization option: text need not leave project-controlled storage. Model downloads and update checks should be separated from translation execution. | Direct English↔Chinese packages exist, but the project documents that pivot translation can reduce quality. Use only a direct pair and require a domain benchmark and human review. | Code is MIT/CC0, but open upstream issues show that licenses for individual model packages are not uniformly explicit. Confirm the exact English↔Chinese model's training-data/model license before redistribution or commercial use. |
| **Google Cloud Translation** | Global managed service with no mainland-China region listed. Chinese language support is not evidence of mainland network reliability; treat access from the mainland as unverified/best-effort. | Google says request text is held briefly in memory, is not used for training, is not shared, and is not claimed by Google. Advanced regional endpoints can constrain supported data locations; global endpoints cannot. | Supports Simplified Chinese, language detection, glossaries, and custom/adaptive options. Admissions quality still needs a golden-set review. | The service may be integrated into an application of independent value, but the API itself may not be resold. Proprietary service and billing account required. |
| **Azure Translator** | The global service is broadly available. A separate Translator deployment is documented in Azure China operated by 21Vianet (`chinanorth` and `chinaeast2`), but applying requires a Chinese legal entity, ICP license, and physical presence in China. This is not a casual free-tier workaround. | Microsoft says text translation processes data at REST and does not store customer data; document translation stores data only temporarily and hard-deletes it after processing. | Supports Simplified Chinese, standard/custom models, dictionaries, and document translation. Use a project-owned glossary and a human admissions reviewer. | Proprietary Azure terms apply. Keep the API behind the server, enforce budget limits, and do not treat machine output as guaranteed accurate. |
| **DeepL API Free / Developer** | DeepL's current paid-plan availability list includes Hong Kong, Macau, and Taiwan but **does not list mainland China**. No mainland region is documented; do not use it as the China path. | Paid Growth states immediate deletion, but the current terms say the free **Developer** plan may perpetually store content or processed content. The legacy Free plan's continuing rights should be confirmed per account before applicant text is used. | Simplified Chinese and Chinese glossaries are supported. DeepL markets high quality, but no reviewed source compares admissions prose; benchmark it like every other provider. | The free plan may be changed or discontinued, and output accuracy is not warranted. Current quota/retention terms make it unsuitable as the default zero-cost applicant-data path. |
| **Alibaba Cloud Machine Translation** | The current REST-edition guide verifies China (Hangzhou). A current FAQ says China-site accounts have Hangzhou availability while international-site accounts have Hangzhou and Singapore; a broader service-endpoint index lists additional region IDs. Those pages are not enough to infer where a particular API edition processes data. Confirm the exact account site, API edition, endpoint, and processing/data region before selection. | The China-site product terms say Alibaba does not intentionally identify, extract, separately collect/store, or link personal information found in business data, **but may use that business data for service improvement/optimization**. That is not a no-trace promise. The international DPA is a separate processor-on-instructions framework and must not be assumed to override the China-site product-specific term; determine the actual contracting entity and terms before applicant text is sent. | Universal translation covers English and Chinese; professional engines include social content. Dictionary intervention can preserve proper nouns and domain terms, but the current dictionary workflow is console-only. | Usage beyond the free allowance falls through to paid billing. Customer is responsible for rights in submitted content and for applicable data/consent rules. Use synthetic/de-identified evaluation data unless counsel confirms the contract and consent support the documented secondary use. |

Primary availability, privacy, quality, and terms sources: [LibreTranslate repository/license](https://github.com/LibreTranslate/LibreTranslate), [Argos package index](https://github.com/argosopentech/argospm-index/blob/main/index.json), [Argos model-license issue](https://github.com/argosopentech/argos-translate/issues/533), [Google data-usage FAQ](https://cloud.google.com/translate/data-usage), [Google language support](https://cloud.google.com/translate/docs/languages), [Azure Translator privacy](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/translator/data-privacy-security), [Azure sovereign/China deployment](https://learn.microsoft.com/en-us/azure/ai-services/translator/reference/sovereign-clouds), [DeepL supported languages](https://developers.deepl.com/docs/getting-started/supported-languages), [DeepL plan availability](https://support.deepl.com/hc/en-us/articles/360020016339-Countries-and-regions-where-DeepL-paid-plans-are-available), [DeepL terms](https://www.deepl.com/en/pro-license), [Alibaba Machine Translation REST region documentation](https://www.alibabacloud.com/help/en/machine-translation/developer-reference/using-rest-api), [Alibaba account-site availability FAQ](https://help.aliyun.com/en/machine-translation/support/faq-about-api-calls), [Alibaba service-endpoint index](https://help.aliyun.com/zh/machine-translation/developer-reference/api-alimt-2018-10-12-endpoint), [Alibaba Machine Translation overview](https://www.alibabacloud.com/help/en/machine-translation/product-overview/general-version-of-machine-translation), [Alibaba dictionary intervention](https://www.alibabacloud.com/help/en/machine-translation/user-guide/user-guide-of-directory-intervention), [Alibaba China service terms section 15.5](https://help.aliyun.com/zh/machine-translation/support/terms-of-service), and [Alibaba international DPA](https://www.alibabacloud.com/help/en/legal/latest/fe2cxg).

## ICP and local-hosting boundary

Calling a translation service does not by itself require moving the Admissions Oracle website into mainland China. The requirement follows the public service's hosting and delivery architecture:

- A website hosted on a server in mainland China requires an ICP filing before launch, including an IP-address-only site. A commercial information service can require an ICP license in addition to filing.
- A website hosted outside mainland China does not require an ICP filing merely because mainland users may visit it. That does not guarantee reliable or fast mainland access, and it does not prove that every other mainland filing duty is absent. Alibaba's filing guidance says a separate Public Security Bureau (PSB) filing may apply when serving mainland users; obtain jurisdiction-specific advice for the actual operator, service, and hosting model.
- Mainland CDN acceleration also requires a filed domain. Hong Kong or an overseas region avoids mainland ICP filing but is still an overseas path through cross-border filtering and congestion.
- Running Argos/LibreTranslate as a private worker on a maintainer's machine does not create a public mainland website. Exposing it publicly from a mainland server would bring the hosting/filing question back into scope.
- Azure China Translator is a separate 21Vianet environment with materially higher eligibility requirements; it should be evaluated only if the project later establishes a Chinese operating entity and compliant hosting plan.

Sources: [Alibaba Cloud ICP filing requirements](https://www.alibabacloud.com/help/en/icp-filing/basic-icp-service/product-overview/icp-filing-requirements-for-a-regular-website), [overseas-enterprise filing requirements](https://www.alibabacloud.com/help/en/icp-filing/basic-icp-service/product-overview/icp-filing-application-for-enterprises-outside-the-chinese-mainland), and [CDN acceleration-region requirements](https://www.alibabacloud.com/help/en/cdn/user-guide/change-the-accelerated-region).

## Proposed non-destructive architecture

Translation belongs after ownership/consent verification and before final profile approval:

```text
verified submission
  -> immutable raw source + consent/provenance
  -> normalized source profile
  -> locale detection and field allowlist
  -> protected-term tokenization
  -> cached provider draft
  -> optional revision suggestion
  -> structural and invariant validation
  -> bilingual human review
  -> approved per-locale overlay
  -> normal publish/export step
```

The game continues reading the canonical source profile. Localization-aware rendering may later select an approved overlay by locale, but it must fall back field-by-field to the immutable source. A missing, failed, rejected, or withdrawn translation must never block the source profile or silently replace it.

### 1. Immutable source and consent

Store the imported text exactly as approved, plus:

- source URL and platform post identifier;
- consent version, verification method, an opaque internal owner reference or keyed HMAC, and timestamps—never a plain unsalted identifier hash;
- import timestamp and immutable source-content SHA-256;
- detected profile locale and per-field detection overrides;
- withdrawal state and timestamp.

Do not mutate this record to "clean up" wording. Normalization and translation are derived artifacts. Existing withdrawal behavior must preempt translation jobs and purge source-derived drafts according to the consent policy.

### 2. Field allowlist

Translate only fields explicitly approved by schema version. Suggested first-pass allowlist:

- `academic_profile.course_rigor.course_load_notes`;
- `extracurriculars[*].title`, `description`, and `achievements[*]`;
- `awards_honors[*].name`;
- `application_results.*[*].notes` when consent and sensitivity review permit it;
- `game_metadata.teaching_points[*]` and `hints.*[*]`;
- `qualitative_notes`.

Never machine-translate:

- profile/applicant IDs, usernames, consent or source identifiers;
- school names, final-decision school, subreddit/community names, URLs;
- tier codes (`HYPSM`, `T10`, `T20`, `T50`, LAC codes), decision codes (`ED`, `REA`, `RD`, `WL`), enum/API values, and DOM/test IDs;
- GPA/test scores, counts, dates, money, rankings, or other numeric facts;
- known UI enum labels already handled by `public/i18n.js`.

Course names need a mixed rule: protect official codes and proper names (`AP`, `IB`, `A-Level`, course numbers), and translate only descriptive text where a reviewer approves it.

### 3. Admissions glossary and protected tokens

Maintain a versioned glossary separate from provider configuration. Each entry declares one of:

- `preserve_exact`: school names, acronyms, tier/decision codes, usernames;
- `preferred_translation`: admissions terms such as waitlist, deferral, need-aware, first-generation, course rigor, superscore, and letter of continued interest;
- `context_note`: ambiguous terms whose translation depends on US admissions practice.

Before a provider call, replace exact protected spans with unambiguous placeholders such as `__AO_TERM_0001__`. After translation, restore them and require exact placeholder count/order validation. Do not rely only on a provider glossary because support differs by provider and plan.

### 4. Cache key and per-locale overlay

Use a content-addressed key that invalidates when any meaning-bearing dependency changes:

```text
sha256(
  source_field_sha256
  + source_locale
  + target_locale
  + provider_id
  + provider_model_or_package_version
  + glossary_version
  + allowlist_schema_version
  + pipeline_version
)
```

The key contains a source hash, not raw applicant text, but this is only data minimization: a hash can remain linkable or dictionary-guessable and does **not** anonymize applicant data. Keep keys and integrity hashes inside the access-controlled translation store rather than general logs. A conceptual derived record is:

```json
{
  "profile_id": "<stable source profile id>",
  "source_locale": "en",
  "source_sha256": "<immutable profile hash>",
  "localizations": {
    "zh-CN": {
      "status": "review_pending",
      "fields": {
        "/extracurriculars/0/description": {
          "source_field_sha256": "<hash>",
          "machine_draft": "<derived text>",
          "revision_draft": null,
          "approved_text": null
        }
      },
      "provenance": {
        "provider": "<adapter id>",
        "model": "<model/package name>",
        "model_version": "<pinned version>",
        "glossary_version": "<version>",
        "pipeline_version": "<version>",
        "translated_at": "<timestamp>",
        "reviewed_by": null,
        "reviewed_at": null
      }
    }
  }
}
```

This is a proposed shape, not a migration. In implementation, sensitive drafts and provenance may live in separate tables/files with tighter access than published profiles.

### 5. Optional small-model revision

An optional small model may propose a revision after literal translation, but it is not a second source of truth. It must:

- receive only the single allowlisted field, protected-token map, first translation, and glossary entries it needs;
- be instructed to preserve every fact, number, negation, uncertainty marker, and placeholder;
- return a structured suggestion and change reasons, not edit the source or approved text directly;
- record provider/model/version and a separate cache key;
- pass the same validation and human review as the first draft.

If the revision adds a claim, drops a qualifier, changes a number, or cannot preserve placeholders, discard it. Do not use applicant content to train or fine-tune a model without a new explicit consent and privacy review.

### 6. Structured validation

Reject a draft before review when any invariant fails:

- output is not valid UTF-8 text or exceeds a configured expansion limit;
- a protected placeholder is missing, duplicated, reordered where order matters, or altered;
- numbers, dates, currencies, scores, decision codes, or tier codes differ;
- array length, JSON pointer, source-field hash, or source locale no longer matches;
- school-name allowlist differs after restoration;
- output is empty, identical because the provider failed, or contains provider error text;
- prohibited HTML/script/control characters appear;
- language detection does not plausibly match the target locale.

Validation proves structure and invariants, not semantic accuracy. A bilingual reviewer compares source, raw machine draft, optional revision, and final text side-by-side before approval.

### 7. State machine, retries, and audit

Recommended states:

```text
not_requested -> queued -> translating -> translated_unreviewed
translated_unreviewed -> revision_pending -> review_pending
translated_unreviewed/revision_pending -> validation_failed
review_pending -> approved -> published
review_pending -> rejected
queued/translating/* -> retry_wait -> translating
any non-withdrawn state -> withdrawn
```

Store attempt count, last error class, next retry time, and provider request identifier when supplied. Retry only transient timeout, throttling, and 5xx failures with exponential backoff and jitter. Do not automatically retry authentication, quota-exhausted, invalid-input, policy, or structural-validation failures. Cap attempts and require maintainer action after the cap.

Audit consent, queue, provider, validation, reviewer, approval/rejection, publish, supersede, and withdrawal events. Do not put source text, translated text, access keys, OAuth tokens, usernames, source-content hashes, or raw profile identifiers in application logs. Use random opaque audit/subject IDs, or a keyed HMAC with a separately managed and rotatable secret when deterministic correlation is essential. Keep ordinary SHA-256 integrity values only in access-controlled source/translation records. Unsalted hashes of usernames, short identifiers, or short applicant fields are linkable and dictionary-guessable; hashing is not anonymization.

### 8. Withdrawal and correction

Withdrawal must be an idempotent high-priority operation:

1. prevent new jobs and cancel queued work;
2. mark in-flight responses unusable even if they arrive later;
3. remove unpublished and published locale overlays, caches, reviewer copies, and exported profile derivatives tied to the source hash;
4. purge source content and ownership proof fields according to the existing consent workflow;
5. retain only the minimum non-content tombstone/audit evidence required to prove the withdrawal was honored.

A source correction creates a new source hash and invalidates all previous cache entries and approvals. Never "patch" an approved translation onto changed source text.

## Security and operational controls

- Provider credentials stay server-side in a secret store; browsers never call translation providers directly.
- The maintainer role that queues translation is distinct from the reviewer who approves it where practical.
- Send one allowlisted field at a time or the smallest useful batch; strip source URLs, Reddit handles, and unrelated fields before remote calls.
- Enforce provider-specific timeout, concurrency, request-size, and monthly-budget ceilings in the adapter.
- Disable automatic paid overage during evaluation where the provider supports hard limits. Alert at 50%, 80%, and 100% of quota.
- Pin local model/package versions and hashes. Do not auto-update a model underneath an approved cache.
- Keep translation out of request-time game paths. Publication reads approved local data and cannot fail because a provider is down.
- Add a provider kill switch and a global `PROFILE_TRANSLATION_ENABLED=false` default before any future implementation.

## Quality and latency evaluation before selection

Create the initial golden set from synthetic or irreversibly de-identified material covering both English→Simplified Chinese and Chinese→English. A privacy reviewer must confirm that combinations of rare facts cannot re-identify an applicant. Real applicant fields may be added only after explicit consent for machine translation and human review, sensitivity approval for each field, and approval of the provider contract/DPA, processing region, retention, and secondary-use terms:

- 50–100 representative fields across academics, activities, awards, decision notes, hints, and teaching points;
- admissions acronyms, negation, ranges, money, dates, school names, mixed Chinese/English text, and ambiguous US-specific terminology;
- short labels, normal paragraphs, and near-limit long fields.

Use two bilingual reviewers and record:

- critical meaning errors, omissions, unsupported additions, and polarity/negation errors;
- exact preservation rate for protected terms and numerical facts;
- glossary adherence and admissions-term consistency;
- fluency/readability on a small ordinal rubric;
- reviewer edit distance and time to approval;
- provider failure rate, p50/p95 latency, cold-start time, and characters/second from the intended global and mainland calling regions;
- total characters and effective cost after cache hits.

Reject a provider/model version with any repeated critical factual error even if its average fluency is high. Store benchmark fixtures only when their licensing/consent permits repository inclusion.

## Decision gates before implementation

Implementation should not begin until all of these are answered:

- Which consent language explicitly authorizes remote machine translation and human review?
- Which exact fields are in allowlist schema v1, and which are too sensitive to leave project-controlled infrastructure?
- Which provider/model versions pass the bilingual golden set?
- Is the exact Argos English↔Chinese model package licensed for the intended distribution/use?
- Which contract, region, DPA, and retention terms govern the chosen managed provider?
- Is the app remaining overseas/best-effort for mainland users, or is a funded mainland entity/ICP/local-hosting program in scope?
- Who can queue, review, approve, reject, correct, and withdraw translations?
- What is the hard monthly cost ceiling and behavior at quota exhaustion?
- How will published overlays and caches be found and purged after withdrawal?

Until those gates are resolved, the safe behavior is the current one: preserve imported prose in its source language and localize only app-owned interface copy and known structured enums.

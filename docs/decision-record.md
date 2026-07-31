# Decision Record

Date checked: 2026-07-31, Asia/Shanghai. Target language: Spanish. Canonical host: `https://www.mejorarcalidaddeimagen.net/`.

## Verdict

Verdict: `test small`.

Primary user task: Spanish-speaking photography users, designers, ecommerce sellers, old-photo scanners, AI-image users, and general users need to improve a mildly soft or low-resolution image and understand whether sharpening, denoise, upscaling, deblur, or face restoration is the right method.

Market/language: pan-Hispanic Spanish with Spain-first wording acceptable. Spain and Mexico SERP samples were similar enough that a neutral Spanish site is preferable to a Spain-only product.

MVP: build a no-login local browser tool for sharpness, light denoise, 1x/2x output, JPEG/PNG/WebP export, before/after comparison, cancel/reset/download, privacy/terms/guide, robots/sitemap/canonical/OG. Do not claim true deblur, face restoration, or AI detail recovery until a verified model path is enabled.

## User Research Attachment

The provided screenshot was treated only as historical third-party clue material. It suggested the keyword cluster `mejorar calidad de imagen`, competitor patterns, exact-match domain availability, ComfyUI/API examples, and possible payment/credit implementations. It was not used as current 2026 fact, and no article copy, screenshots, design, numbers, or rankings were copied.

## SERP Summary

Method: Google searches in the in-app browser with `hl=es`, `pws=0`, `num=10`, and country parameters `gl=ES` plus Mexico samples with `gl=MX`; checked 2026-07-31. The complete sample used a 1365x900 desktop viewport, with the core query also checked at 390px. SERP personalization and location uncertainty remain because this was a browser session, not a paid rank-tracking crawl.

Queries checked: `mejorar calidad de imagen`, `mejorar calidad de imagen online`, `mejorar calidad de una foto`, `mejorar calidad de imagen con IA`, `aumentar resolucion de imagen`, `mejorar foto borrosa`, `escalar imagen`, `quitar desenfoque`.

Observed intent: overwhelmingly tool/product intent. Users expect upload/drop image, quick enhancement, before/after, no sign-up friction, free/trial behavior, and clear quality boundaries. Informational support is useful but should not replace the tool on the homepage.

Typical competitors/result types: Canva, Pixelcut, ImageUpscaler, Upscale.media, AirBrush, Artguru, iLoveIMG, Adobe, PicWish, Fotor, PerfectCorp/YouCam, Picsart, and similar upload tools. Image SERP features appeared across the sample, and video blocks appeared for some photo/AI/deblur variants. `escalar imagen` mixed upscaling with ordinary resize intent; `mejorar foto borrosa` and `quitar desenfoque` returned narrower deblur tools. Mexico core and blur samples showed nearly the same task shape and competitor set as Spain rather than a distinct page architecture.

Gap: many competitors blend "enhance", "unblur", "upscale", "restore", and "AI" claims. A small site can start with an honest Spanish workflow: immediate local tool, no upload for MVP, precise difference between nitidez, ruido, superresolucion, restauracion facial, and desenfoque.

Page decision: `/` handles the core cluster, `/guide` explains methods and limits, `/privacy`, `/terms`, and a 404 support launch trust. Do not create doorway pages for `aumentar resolucion`, `mejorar foto borrosa`, `escalar imagen`, or `quitar desenfoque` until the product has independently strong functionality and search data for each. In particular, do not publish a deblur page while the product only performs local sharpening and interpolation.

## Technology Decision

Browser-local traditional processing: `build`. It is free at the margin, private, fast, testable, and honest if described as sharpening/light denoise/interpolation. It cannot truthfully claim AI, deblur, restoration, or recovery of real missing detail.

Browser-side ML: `postpone`. ONNX/WebGPU/WASM could work later, but requires model license review, package size testing, CDN/bandwidth review, mobile memory testing, and quality benchmarks before public claims.

RunPod Serverless + ComfyUI/Real-ESRGAN: `test small later`. The existing `aisharpenimage` work shows a plausible Real-ESRGAN route for model-assisted 2x, with strict input limits and no durable storage. It is not enabled here at launch because shared prepaid balance, cross-site quota limits, cold starts, support burden, and abuse cost need measured demand from this Spanish tool first.

Shared endpoint vs independent endpoint: shared endpoint reduces setup and uses existing prepaid balance, but two Vercel projects cannot form a reliable cross-site spend ledger. Independent endpoint improves isolation, capacity controls, rollback, and abuse attribution but risks new fixed or prepaid cost and needs user confirmation. No additional recharge, auto-pay, active worker, object storage, or paid model is authorized.

## Reference Repo Review

Reference: `https://github.com/yaakua/ai-outpainting-com`, default branch `master`, GitHub API and repository UI checked 2026-07-31. The README says MIT, but GitHub license metadata is empty and no standalone root `LICENSE` file was found. That ambiguity is enough to avoid copying code; only high-level engineering patterns are considered.

Architecture observed: Next.js 14, React 18, Prisma, NextAuth, Google login, Stripe, PayPal, S3/COS/R2-style signed uploads, RunPod SDK, message queue API, SSE status updates, Konva editor, i18n/blog pages, pino logging, order/credit tables. The public tree includes `.env` and `.env.production` files; those are a security warning and were not read or propagated.

Reusable: high-level pattern of asynchronous job status, explicit order/status separation, and eventual login/payment/credit concepts for a future paid phase.

Needs rewrite: upload handling, storage, queue/SSE, credits, payments, auth, and logging. They must be rebuilt with this site's privacy, Spanish copy, image-enhancement task, current provider limits, and no leaked environment files.

Not adopted: outpainting workflow, branding, visual design, pricing, screenshots, mass multilingual/blog structure, public gallery/explore pages, and any code without license. Outpainting expands canvas boundaries; it does not solve `mejorar calidad de imagen` directly.

## Risk And Cost

Launch cost: local processing only, so no GPU/storage/payment marginal cost beyond hosting. No login or payment at launch.

Official RunPod pricing checked in the browser on 2026-07-31: Serverless worker groups were listed at about USD 0.58/hour for 16 GB, USD 0.69/hour for the 24 GB L4/A5000/3090 group, USD 1.10/hour for 24 GB 4090 PRO, and USD 1.22/hour for the 48 GB A6000/A40 group. The pricing page also offers per-second display. Source: `https://www.runpod.io/pricing`. Prices and GPU availability can change and must be captured again on the day Cloud AI is enabled.

Future Cloud AI cost model must be measured before enablement. The values below are compute only and exclude Vercel execution, ingress/egress, failed requests, storage, logs, payment fees, refunds, tax, and support:

- Optimistic: hot 16 GB worker, 10 billed seconds: `0.58 / 3600 * 10 = USD 0.0016` per success.
- Base: 24 GB worker, 45 billed seconds: `0.69 / 3600 * 45 = USD 0.0086` per success. At a 10% billable failure rate, effective compute per success is about USD 0.0096 before overhead.
- Pessimistic: 4090 PRO, 300 billed seconds: `1.10 / 3600 * 300 = USD 0.0917` per attempt. One automatic billable retry would double that to USD 0.1833, which is why automatic retry after worker start is forbidden.

Controls required before Cloud AI: true MIME decode, 12 MB local limit, smaller AI derivative around 1 MP/1.25 MB, max edge limits, reject image bombs, reject animation/unsupported alpha if model path cannot preserve it, metadata stripping, explicit upload action, no automatic retry after billable start, timeout/cancel, origin allowlist, per-IP/device quotas, queue cap, outstanding job cap, provider balance manual review, no content logging, temporary results only, no public result pages, privacy disclosure, NSFW/illegal-use terms, and a manual budget fuse.

Residual risk: distributed proxies can bypass Vercel instance-local limits. RunPod prepaid balance and disabled auto-pay are the reliable cash fuse; app limits are availability controls, not a hard billing ledger. If multiple sites share a RunPod balance, manual balance checks and conservative concurrency are mandatory.

## Payment Path

Current: no login, no payment, no ads. This keeps upload friction low and avoids selling unverified GPU capacity.

Later, if traffic and value are proven: accounts, Stripe checkout, credits, batches, larger files, 4x/high-quality models, priority queue, private history, API, and commercial workflow plans. Before activation: tax/refund policy, fraud/chargeback handling, privacy changes, support load, GPU/storage/bandwidth cost, durable rate limits, and stop thresholds. The proposed architecture and gates are in `docs/future-auth-payments.md`.

## URL Map

| URL | Intent | Index |
| --- | --- | --- |
| `/` | mejorar calidad de imagen online / con IA / mejorar una foto | yes, self-canonical |
| `/guide` | guide to sharpening, denoise, deblur, upscaling limits | yes, self-canonical |
| `/privacy` | privacy and local/cloud processing disclosure | yes, self-canonical |
| `/terms` | authorized use and result limits | yes, self-canonical |
| `/404.html` | real not found page | noindex |

## Sources Checked

- MDN Canvas APIs for browser-local pixel processing concepts.
- RunPod Serverless pricing page, checked 2026-07-31: `https://www.runpod.io/pricing`.
- RunPod Serverless docs, checked 2026-07-31: `https://docs.runpod.io/serverless/overview`.
- Vercel Functions and deployment docs must be rechecked before any server API limits are relied upon.
- Real-ESRGAN upstream repository currently states BSD-3-Clause; model release files and any bundled dependency/model terms must still be checked before shipping: `https://github.com/xinntao/Real-ESRGAN`.

## Metrics And Gates

Launch metrics: page views, tool starts, valid files, processing success/failure reason, download rate, device/browser, query/country in GSC, and support feedback. Do not log file contents or filenames.

7-day review: production status, HTTPS/redirects, sitemap/GSC processing, console errors, mobile usability, upload/complete/download rate, and SERP queries.

30-day review: non-brand query impressions, country/device mix, local completion rate, demand for AI/2x/deblur, abuse signals, and whether Cloud AI economics justify a controlled beta.

Stop or postpone Cloud AI if median successful cost exceeds USD 0.05, failure rate exceeds 20% over 20 jobs, provider billing differs from expected numbers, prepaid balance drains unexpectedly, or privacy/retention cannot be disclosed accurately.


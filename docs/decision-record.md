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

RunPod Serverless + ComfyUI/Real-ESRGAN: `test small now`, approved by the user on 2026-07-31 using only the existing RunPod account balance. Cloud AI uses the already verified public Worker image and two fixed workflows: High Quality runs `RealESRGAN_x4plus`, downsamples to 2x, and blends 85% AI detail with 15% Lanczos; Fast uses `RealESRGAN_x2plus` with the same conservative blend. Neither mode is face restoration, true deblur, or forensic recovery.

Shared endpoint vs independent endpoint: launch uses the existing shared endpoint with Active workers 0, Max workers 1, 5-second idle timeout, fixed immutable Worker image, and no network volume. At low traffic, sharing improves the chance of a warm/FlashBoot Worker and avoids new capacity. At concurrent traffic, one Worker becomes a queue bottleneck. Create an independent endpoint only after p95 queue delay exceeds 20-30 seconds or busy/timeouts exceed 5%; that change can nearly double peak spend and requires a new confirmation. Two Vercel projects still cannot form a reliable cross-site spend ledger.

## Reference Repo Review

Reference: `https://github.com/yaakua/ai-outpainting-com`, default branch `master`, GitHub API and repository UI checked 2026-07-31. The README says MIT, but GitHub license metadata is empty and no standalone root `LICENSE` file was found. That ambiguity is enough to avoid copying code; only high-level engineering patterns are considered.

Architecture observed: Next.js 14, React 18, Prisma, NextAuth, Google login, Stripe, PayPal, S3/COS/R2-style signed uploads, RunPod SDK, message queue API, SSE status updates, Konva editor, i18n/blog pages, pino logging, order/credit tables. The public tree includes `.env` and `.env.production` files; those are a security warning and were not read or propagated.

Reusable: high-level pattern of asynchronous job status, explicit order/status separation, and eventual login/payment/credit concepts for a future paid phase.

Needs rewrite: upload handling, storage, queue/SSE, credits, payments, auth, and logging. They must be rebuilt with this site's privacy, Spanish copy, image-enhancement task, current provider limits, and no leaked environment files.

Not adopted: outpainting workflow, branding, visual design, pricing, screenshots, mass multilingual/blog structure, public gallery/explore pages, and any code without license. Outpainting expands canvas boundaries; it does not solve `mejorar calidad de imagen` directly.

## Risk And Cost

Launch cost: local processing remains free at the margin. Cloud AI consumes the existing RunPod prepaid balance; the balance observed on 2026-07-31 before this integration was USD 9.88, Auto-Pay was visibly Disabled, current spend rate was USD 0/hour, and the shared endpoint had Active 0 / Max 1. No recharge, automatic payment, object storage, database, active Worker, paid closed model, login, or end-user payment is enabled.

Official RunPod pricing checked in the browser on 2026-07-31: Serverless worker groups were listed at about USD 0.58/hour for 16 GB, USD 0.69/hour for the 24 GB L4/A5000/3090 group, USD 1.10/hour for 24 GB 4090 PRO, and USD 1.22/hour for the 48 GB A6000/A40 group. The pricing page also offers per-second display. Source: `https://www.runpod.io/pricing`. Prices and GPU availability can change and must be captured again on the day Cloud AI is enabled.

Cloud AI cost model. The values below are compute only and exclude Vercel execution, ingress/egress, failed requests, storage, logs, tax, and support:

- Optimistic: hot 16 GB worker, 10 billed seconds: `0.58 / 3600 * 10 = USD 0.0016` per success.
- Base: 24 GB worker, 45 billed seconds: `0.69 / 3600 * 45 = USD 0.0086` per success. At a 10% billable failure rate, effective compute per success is about USD 0.0096 before overhead.
- Pessimistic: 4090 PRO, 300 billed seconds: `1.10 / 3600 * 300 = USD 0.0917` per attempt. One automatic billable retry would double that to USD 0.1833, which is why automatic retry after worker start is forbidden.

Implemented controls: true MIME decode, 12 MB local limit, AI derivative capped at 1 MP/1.25 MB/1600 px edge, Sharp image-bomb limit, animation and non-opaque alpha rejection, metadata stripping, explicit upload action, fixed workflow/model allowlist, no automatic retry after billable start, 300-second timeout/cancel, origin and `Sec-Fetch-Site` checks, salted-IP best-effort allowance, one outstanding job per Vercel runtime, shared endpoint Max workers 1, no content or filename logging, temporary provider results only, no public result pages, privacy/terms disclosure, and the prepaid balance as the cash fuse.

Residual risk: distributed proxies can bypass Vercel instance-local limits. RunPod prepaid balance and disabled auto-pay are the reliable cash fuse; app limits are availability controls, not a hard billing ledger. If multiple sites share a RunPod balance, manual balance checks and conservative concurrency are mandatory.

## Payment Path

Current: Cloud AI beta is free to the user with no login, payment, or ads. The user explicitly authorized paid RunPod calls from the existing balance, but no recharge. This keeps first-use friction low while quality, latency, download rate, abuse, and cost per successful image are measured.

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

30-day review: non-brand query impressions, country/device mix, local versus Cloud AI completion/download rate, p50/p95 queue and execution time, abuse signals, cost per successful image, and whether accounts/credits/Stripe are justified.

Stop or postpone Cloud AI if median successful cost exceeds USD 0.05, failure rate exceeds 20% over 20 jobs, provider billing differs from expected numbers, prepaid balance drains unexpectedly, or privacy/retention cannot be disclosed accurately.


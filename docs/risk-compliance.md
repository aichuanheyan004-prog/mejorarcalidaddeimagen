# Risk And Compliance

Feature/data/content: browser-local image sharpening, light denoise, local interpolation 1x/2x, optional RunPod Cloud AI 2x, guide, privacy, terms.

Legitimate user and authorized task: users improve their own or authorized images for web, ecommerce, design, scanning, or personal editing.

Potential harmful use: copyright misuse, deceptive image editing, sensitive personal-image handling, misleading AI/deblur claims, future GPU cost abuse, and illegal/NSFW content if cloud processing is added.

Rights/source/terms: code and copy are original for this project; public assets are generated in-repo. The `yaakua/ai-outpainting-com` README says MIT, but no standalone license file or GitHub license metadata was detected, so its code is not copied. User uploads remain private in local mode.

Personal/sensitive data flow: local mode remains in browser memory. Cloud AI uploads only after explicit action: the browser creates an approximately 1 MP WebP derivative, the Vercel API verifies real MIME/dimensions/alpha, strips metadata again, and sends it to RunPod. Provider logs can include IP, user agent, job ID, status, runtime, and billing/security metadata. RunPod infrastructure region is not guaranteed and job results may remain retrievable for up to about 30 minutes. There is no site object store, account, payment, public result, or durable image history.

Public/indexable behavior: only homepage, guide, privacy, and terms are indexable. User results are never public or indexable.

Controls: local type/signature and resource limits; AI derivative 1 MP/1.25 MB/1600 px limits; server-side Sharp decode and image-bomb limit; animation and transparency rejection for AI; metadata removal; fixed Real-ESRGAN allowlist; explicit upload; origin and fetch-site checks; best-effort salted-IP allowance; one outstanding job per runtime; shared endpoint Max workers 1; 300-second cancel/timeout; no automatic retry; no content/filename logs; no public results; privacy and terms disclosures; prepaid balance with Auto-Pay disabled; and no unsupported deblur/restoration claims.

Residual risk: browser memory errors, unauthorized/sensitive uploads, model-invented detail, distributed proxies bypassing instance-local limits, cross-site contention on one Worker, cold starts, provider retention/region uncertainty, and both sites consuming the same prepaid balance. App limits are availability controls; the USD 9.88 balance and disabled Auto-Pay are the final cash boundary.

Outcome: allow with controls.

Reviewer/date: Codex, 2026-07-31.

Recheck trigger: recharge, Auto-Pay, Active workers, higher Max workers, independent endpoint, accounts, payments, ads, durable rate limiting, object storage, public galleries, batch processing, API, face restoration, true deblur, provider/model/license changes, or any new paid infrastructure.

# Risk And Compliance

Feature/data/content: browser-local image sharpening, light denoise, local interpolation 1x/2x, guide, privacy, terms.

Legitimate user and authorized task: users improve their own or authorized images for web, ecommerce, design, scanning, or personal editing.

Potential harmful use: copyright misuse, deceptive image editing, sensitive personal-image handling, misleading AI/deblur claims, future GPU cost abuse, and illegal/NSFW content if cloud processing is added.

Rights/source/terms: code and copy are original for this project; public assets are generated in-repo. The `yaakua/ai-outpainting-com` README says MIT, but no standalone license file or GitHub license metadata was detected, so its code is not copied. User uploads remain private in local mode.

Personal/sensitive data flow: launch version processes images in browser memory. No result pages, durable image storage, account, payment, object store, or Cloud AI upload is enabled.

Public/indexable behavior: only homepage, guide, privacy, and terms are indexable. User results are never public or indexable.

Controls: file type and signature validation, 12 MB file limit, 18 MP input and 32 MP output limits, max-edge limits, animated WebP rejection, browser decode validation, metadata removal through Canvas export, object URL cleanup, cooperative cancel/reset/download flow, privacy and terms disclosures, and no unsupported AI/deblur/restoration claims.

Residual risk: browser memory errors on older devices, local processing can still be used on unauthorized images, and future cloud mode would require a new abuse and billing review.

Outcome: allow with controls.

Reviewer/date: Codex, 2026-07-31.

Recheck trigger: enabling Cloud AI, accounts, payments, ads, analytics beyond aggregate events, object storage, public galleries, batch processing, API, face restoration, true deblur, or any new paid infrastructure.

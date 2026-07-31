# Future Authentication And Payments

Status: authentication and payments are design only. A free Cloud AI beta now uses the existing prepaid RunPod balance, but there is still no account, database, checkout, paid storage, analytics vendor, credit ledger, or end-user payment.

## Activation Gates

Do not add login to the local free tool. Introduce accounts only when a user needs durable paid value: credits, batch jobs, private history, API keys, team access, or paid cloud processing.

Before implementation, require all of the following:

- At least 30 days of GSC and product funnel evidence.
- A measured Cloud AI benchmark with at least 20 authorized test jobs.
- Successful-job cost, p50/p95 latency, failure rate, and quality feedback within the stop thresholds in the decision record.
- User confirmation for every new recurring or prepaid cost, including database, email, storage, GPU, Stripe Tax, monitoring, and support tooling.
- A reviewed refund, tax/VAT, privacy, retention, abuse, and chargeback policy.

## Proposed Architecture

- Authentication: a managed email magic-link and optional Google OAuth provider suitable for Vite, plus server-side session verification in Vercel Functions. Provider selection is postponed until current pricing and data-region terms are reviewed.
- Payments: Stripe Checkout and Customer Portal. Prices and product IDs exist only in server environment variables. The browser never grants credits from a success redirect.
- Webhooks: verify Stripe signatures, store the event ID, and process each event idempotently. Refunds and chargebacks create reversing ledger entries.
- Credits: append-only ledger with reason, amount, currency/product source, job ID, and idempotency key. Never maintain balance as a client-writable counter.
- Jobs: separate user, payment, entitlement, job, and result records. A paid order does not mean a GPU job succeeded.
- Files: the beta uses request/response payloads with no object store. Any future paid history or batch workflow requires signed short-lived URLs, private buckets, no public galleries, metadata stripping, minimum retention, and deletion jobs.
- API: separate API keys, quotas, origin controls, per-user concurrency, and an account-wide spend cap. Browser fingerprinting can supplement but never replace account/IP limits.

## Purchase Flow

1. User signs in only when selecting a paid cloud feature.
2. Server creates a Stripe Checkout session for a fixed product.
3. Stripe webhook confirms payment and appends credits once.
4. Each accepted GPU job reserves credits before dispatch.
5. Success consumes the reservation; pre-dispatch failure releases it; post-dispatch failure follows the published refund rule.
6. Refund or chargeback creates a reversing ledger entry and may suspend further paid dispatch.

## Products To Test Later

- Batch processing.
- Larger source files and 4x/high-quality models.
- Priority queue.
- Private job history with explicit retention controls.
- API and commercial workflow plans.
- Ad-free paid experience only if ads are introduced later.

## Stop Conditions

Pause new paid jobs when provider balance drops below the manual reserve, webhook processing is delayed, effective cost exceeds the product margin floor, failure exceeds the documented threshold, refunds or chargebacks spike, retention deletion fails, or cross-site RunPod spend cannot be reconciled.

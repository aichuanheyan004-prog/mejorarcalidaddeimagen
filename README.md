# Mejorar Calidad de Imagen

Spanish-first image quality tool for https://www.mejorarcalidaddeimagen.net/.

Current MVP:

- Local browser processing for sharpness, light denoise, 1x/2x output, JPEG/PNG/WebP export.
- Optional Cloud AI 2x through a fixed Real-ESRGAN workflow on RunPod Serverless. High Quality uses a 4x pass reduced to 2x; Fast uses a native 2x pass.
- No login, payment, public result pages, durable image storage, automatic recharge, or object storage.
- Accounts, credits, Stripe payments, history, API, and batch workflows remain later phases after traffic, quality, latency, abuse, and unit-economics validation.
- `public/og-image.png` is a 1200x630 capture of the verified product UI using an original local test image.

Decision, risk, RunPod cost, reference-repository, and future payment notes are in `docs/`.

The cloud API stays disabled unless server-only `AI_ENABLED`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `AI_RATE_LIMIT_SALT`, and `AI_ALLOWED_ORIGINS` variables are configured. Never place provider credentials in a `VITE_*` variable.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
node C:/Users/chunk/.codex/skills/gefei-site-builder/scripts/audit_static_site.mjs dist
```

# Mejorar Calidad de Imagen

Spanish-first image quality tool for https://www.mejorarcalidaddeimagen.net/.

Current MVP:

- Local browser processing for sharpness, light denoise, 1x/2x output, JPEG/PNG/WebP export.
- No login, payment, public result pages, durable image storage, or Cloud AI enabled at launch.
- Cloud AI, accounts, credits, payments, history, API, and batch workflows are documented as later phases only after cost and abuse validation.
- `public/og-image.png` is a 1200x630 capture of the verified product UI using an original local test image.

Decision, risk, RunPod cost, reference-repository, and future payment notes are in `docs/`.

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

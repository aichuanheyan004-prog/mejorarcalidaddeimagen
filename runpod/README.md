# RunPod Cloud AI beta

This site shares the existing `aisharpenimage-realesrgan` RunPod Serverless endpoint. It does not create a second endpoint, active Worker, network volume, object store, or automatic recharge.

## Worker and model provenance

- Immutable Worker image: `ghcr.io/aichuanheyan004-prog/aisharpenimage:runpod-a1d7080e137eb539b4928f2ebaad2b9969e010c5`.
- Corresponding public source: <https://github.com/aichuanheyan004-prog/aisharpenimage/tree/main/runpod>.
- Base Worker: RunPod `worker-comfyui` 5.8.6, AGPL-3.0.
- Models: official `RealESRGAN_x4plus.pth` and `RealESRGAN_x2plus.pth`, Real-ESRGAN BSD-3-Clause.
- The API builds only the fixed workflows in `server/aiCore.ts`; client-supplied workflows or model names are never accepted.

High Quality runs the x4 model, downsamples to 2x, and blends 85% AI output with 15% Lanczos. Fast runs the native x2 model with the same blend. The deployment does not provide face restoration or true motion deblur.

## Current cost boundary

Verified in the RunPod UI on 2026-07-31:

- existing account balance: USD 9.88 before this integration;
- Auto-Pay: Disabled;
- Active workers: 0;
- Max workers: 1;
- idle timeout: 5 seconds;
- GPU groups: 16 GB, 24 GB, and 24 GB Pro;
- network volume: none.

No recharge is authorized. The prepaid balance is the final shared cash fuse for both sites. App rate limits are best-effort availability controls and cannot form a durable cross-site billing ledger.

Illustrative compute-only ranges from the current official price check:

- optimistic: 10 seconds at USD 0.58/hour = about USD 0.0016;
- base: 45 seconds at USD 0.69/hour = about USD 0.0086, or about USD 0.0096 per success with 10% billable failures;
- pessimistic: 300 seconds at USD 1.10/hour = about USD 0.0917 per attempt.

Failed or canceled work is never submitted automatically again. Pause Cloud AI if median successful cost exceeds USD 0.05, failure exceeds 20% over 20 jobs, the balance drains unexpectedly, or provider billing/retention differs materially from the documented behavior.

## Vercel environment

All values are server-only:

```text
AI_ENABLED=true
RUNPOD_API_KEY=<secret>
RUNPOD_ENDPOINT_ID=<endpoint id>
AI_RATE_LIMIT_SALT=<random secret>
AI_ALLOWED_ORIGINS=https://www.mejorarcalidaddeimagen.net,https://mejorarcalidaddeimagen.vercel.app
```

Never use a `VITE_*` variable for RunPod credentials.

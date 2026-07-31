import type { ImageInfo } from './imageProcessing'

export const AI_SOURCE_MAX_PIXELS = 1_000_000
export const AI_SOURCE_MAX_EDGE = 1_600
export const AI_UPLOAD_MAX_BYTES = 1_250_000
export const AI_POLL_INTERVAL_MS = 1_500
export const AI_POLL_TIMEOUT_MS = 300_000

export type AiJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'
export type AiQualityMode = 'quality' | 'fast'

export type PreparedAiUpload = {
  dataUrl: string
  width: number
  height: number
  bytes: number
}

export type AiJobResponse = {
  id: string
  status: AiJobStatus
}

export type AiStatusResponse = {
  id: string
  status: AiJobStatus
  resultDataUrl?: string
  error?: string
}

type ApiErrorBody = { error?: string }

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('El navegador no pudo preparar la copia para la IA en la nube.')),
      'image/webp',
      quality,
    )
  })
}

export function blobToDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => {
      reader.abort()
      reject(new DOMException('Cancelado', 'AbortError'))
    }

    if (signal?.aborted) {
      abort()
      return
    }

    signal?.addEventListener('abort', abort, { once: true })
    reader.onerror = () => reject(new Error('El navegador no pudo leer la copia preparada.'))
    reader.onload = () => resolve(String(reader.result))
    reader.onloadend = () => signal?.removeEventListener('abort', abort)
    reader.readAsDataURL(blob)
  })
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.getImageData(0, 0, width, height).data
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true
  }
  return false
}

export async function prepareAiUpload(
  info: ImageInfo,
  signal?: AbortSignal,
): Promise<PreparedAiUpload> {
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')

  const pixelScale = Math.min(1, Math.sqrt(AI_SOURCE_MAX_PIXELS / (info.width * info.height)))
  const edgeScale = Math.min(1, AI_SOURCE_MAX_EDGE / Math.max(info.width, info.height))
  const scale = Math.min(pixelScale, edgeScale)
  const width = Math.max(1, Math.round(info.width * scale))
  const height = Math.max(1, Math.round(info.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas no esta disponible en este navegador.')

  context.drawImage(info.bitmap, 0, 0, width, height)
  if (hasTransparency(context, width, height)) {
    throw new Error('La IA en la nube no admite transparencia. Usa el modo local para conservar el canal alfa.')
  }

  let prepared = await canvasToBlob(canvas, 0.86)
  if (prepared.size > AI_UPLOAD_MAX_BYTES) prepared = await canvasToBlob(canvas, 0.72)
  if (prepared.size > AI_UPLOAD_MAX_BYTES) prepared = await canvasToBlob(canvas, 0.58)
  if (prepared.size > AI_UPLOAD_MAX_BYTES) {
    throw new Error('La imagen es demasiado compleja para la IA en la nube. Prueba el modo local.')
  }

  return {
    dataUrl: await blobToDataUrl(prepared, signal),
    width,
    height,
    bytes: prepared.size,
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T
  if (!response.ok) {
    throw new Error(body.error || 'La IA en la nube no pudo completar la solicitud.')
  }
  return body
}

export async function startAiJob(
  prepared: PreparedAiUpload,
  mode: AiQualityMode,
): Promise<AiJobResponse> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: prepared.dataUrl, mode }),
  })
  return parseApiResponse<AiJobResponse>(response)
}

export async function getAiJob(jobId: string, signal?: AbortSignal): Promise<AiStatusResponse> {
  const response = await fetch(`/api/ai?id=${encodeURIComponent(jobId)}`, { signal })
  return parseApiResponse<AiStatusResponse>(response)
}

export async function cancelAiJob(jobId: string): Promise<void> {
  await fetch(`/api/ai?id=${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    keepalive: true,
  }).catch(() => undefined)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('La IA en la nube devolvio una imagen no valida.')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: match[1] })
}

export function aiOutputName(inputName: string, mode: AiQualityMode) {
  const base = inputName
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${base || 'imagen'}-ia-${mode === 'quality' ? 'calidad' : 'rapida'}-2x.webp`
}

export function waitForAiPoll(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const timeout = window.setTimeout(finish, ms)
    const abort = () => {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

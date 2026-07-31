import { createHash } from 'node:crypto'
import {
  createRunpodInput,
  extractRunpodImage,
  normalizeRunpodStatus,
  parseAiQualityMode,
  sanitizeAiInput,
  validateJobId,
} from '../server/aiCore.js'

type ApiRequest = {
  method?: string
  body?: unknown
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

type ApiResponse = {
  status(code: number): ApiResponse
  json(value: unknown): void
  setHeader(name: string, value: string): void
}

type RateEntry = { date: string; count: number }

const DAILY_REQUESTS_PER_RUNTIME = 2
const MAX_OUTSTANDING_JOBS_PER_RUNTIME = 1
const OUTSTANDING_JOB_TTL_MS = 10 * 60 * 1_000
const dailyRateLimit = new Map<string, RateEntry>()
const outstandingJobs = new Map<string, number>()

function env(name: string): string {
  return process.env[name]?.trim() || ''
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function runpodUrl(path: string): string {
  return `https://api.runpod.ai/v2/${encodeURIComponent(env('RUNPOD_ENDPOINT_ID'))}${path}`
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function pruneRuntimeState(now = Date.now()) {
  for (const [id, startedAt] of outstandingJobs) {
    if (now - startedAt > OUTSTANDING_JOB_TTL_MS) outstandingJobs.delete(id)
  }
  if (dailyRateLimit.size > 5_000) {
    const today = currentDate()
    for (const [key, entry] of dailyRateLimit) {
      if (entry.date !== today) dailyRateLimit.delete(key)
    }
  }
}

function clientRateKey(request: ApiRequest): string {
  const forwarded = firstHeader(
    request.headers['x-vercel-forwarded-for'] ?? request.headers['x-forwarded-for'],
  )
    .split(',')[0]
    ?.trim()
  const address = forwarded || request.socket?.remoteAddress || 'unknown'
  return createHash('sha256')
    .update(`${env('AI_RATE_LIMIT_SALT') || 'runtime-local'}:${currentDate()}:${address}`)
    .digest('hex')
}

function checkRateLimit(request: ApiRequest): boolean {
  const key = clientRateKey(request)
  const date = currentDate()
  const current = dailyRateLimit.get(key)
  if (!current || current.date !== date) {
    dailyRateLimit.set(key, { date, count: 1 })
    return true
  }
  if (current.count >= DAILY_REQUESTS_PER_RUNTIME) return false
  current.count += 1
  return true
}

function allowedOrigins(): string[] {
  const configured = env('AI_ALLOWED_ORIGINS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (configured.length > 0) return configured
  return [
    'https://www.mejorarcalidaddeimagen.net',
    'https://mejorarcalidaddeimagen.vercel.app',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]
}

function requestSourceAllowed(request: ApiRequest): boolean {
  const origin = firstHeader(request.headers.origin)
  if (origin && !allowedOrigins().includes(origin)) return false

  const fetchSite = firstHeader(request.headers['sec-fetch-site']).toLowerCase()
  if (fetchSite === 'cross-site') return false

  if (request.method === 'POST' || request.method === 'DELETE') {
    return Boolean(origin)
  }
  return true
}

async function runpodRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(runpodUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${env('RUNPOD_API_KEY')}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`RunPod service request failed (${response.status}).`)
  return body
}

function isClientError(message: string): boolean {
  return /imagen|MIME|limite|valido|valida|animad|transparent|identificador|pixeles|grande/i.test(message)
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  if (!requestSourceAllowed(request)) {
    response.status(403).json({ error: 'El origen de la solicitud no esta permitido.' })
    return
  }
  if (!request.method || !['GET', 'POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, DELETE')
    response.status(405).json({ error: 'Metodo no permitido.' })
    return
  }
  if (env('AI_ENABLED') !== 'true' || !env('RUNPOD_API_KEY') || !env('RUNPOD_ENDPOINT_ID')) {
    response.status(503).json({
      error: 'La IA en la nube no esta disponible temporalmente. El modo local sigue funcionando.',
    })
    return
  }

  try {
    if (request.method === 'POST') {
      const contentType = firstHeader(request.headers['content-type']).toLowerCase()
      if (!contentType.startsWith('application/json')) {
        response.status(415).json({ error: 'La solicitud debe usar JSON.' })
        return
      }

      const body = request.body as { image?: unknown; mode?: unknown } | undefined
      const input = await sanitizeAiInput(body?.image)
      const mode = parseAiQualityMode(body?.mode)
      pruneRuntimeState()

      if (outstandingJobs.size >= MAX_OUTSTANDING_JOBS_PER_RUNTIME) {
        response.setHeader('Retry-After', '30')
        response.status(503).json({
          error: 'La IA en la nube esta ocupada. Prueba el modo local o vuelve a intentarlo mas tarde.',
        })
        return
      }
      if (!checkRateLimit(request)) {
        response.setHeader('Retry-After', '86400')
        response.status(429).json({
          error: 'La IA en la nube no esta disponible para esta solicitud. Intentalo mas tarde.',
        })
        return
      }

      const result = (await runpodRequest('/run', {
        method: 'POST',
        body: JSON.stringify(createRunpodInput(input, mode)),
      })) as { id?: unknown; status?: unknown }
      const id = validateJobId(result.id)
      outstandingJobs.set(id, Date.now())
      response.status(202).json({ id, status: normalizeRunpodStatus(result.status) })
      return
    }

    const rawId = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id
    const id = validateJobId(rawId)

    if (request.method === 'GET') {
      const result = (await runpodRequest(`/status/${encodeURIComponent(id)}`)) as {
        status?: unknown
        error?: unknown
      }
      const status = normalizeRunpodStatus(result.status)
      if (status === 'completed') {
        outstandingJobs.delete(id)
        response.status(200).json({ id, status, resultDataUrl: extractRunpodImage(result) })
        return
      }
      if (status === 'failed' || status === 'canceled') outstandingJobs.delete(id)
      response.status(200).json({
        id,
        status,
        error: status === 'failed' ? String(result.error || 'El trabajo de IA fallo.') : undefined,
      })
      return
    }

    try {
      await runpodRequest(`/cancel/${encodeURIComponent(id)}`, { method: 'POST' })
    } finally {
      outstandingJobs.delete(id)
    }
    response.status(200).json({ id, status: 'canceled' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar la solicitud.'
    response.status(isClientError(message) ? 400 : 502).json({
      error: isClientError(message)
        ? message
        : 'El Worker de IA no pudo completar la solicitud. No se hizo un reintento automatico.',
    })
  }
}

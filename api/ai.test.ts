// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import handler from './ai'

type ResponseState = {
  statusCode: number
  body: unknown
  headers: Record<string, string>
}

function mockResponse() {
  const state: ResponseState = { statusCode: 200, body: undefined, headers: {} }
  const response = {
    status(code: number) {
      state.statusCode = code
      return response
    },
    json(value: unknown) {
      state.body = value
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value
    },
  }
  return { response, state }
}

function request(method: string, options: { origin?: string; body?: unknown; ip?: string } = {}) {
  return {
    method,
    body: options.body ?? {},
    query: {},
    headers: {
      origin: options.origin ?? 'https://www.mejorarcalidaddeimagen.net',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: options.ip ?? '127.0.0.1' },
  }
}

async function validImage() {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer()
  return `data:image/png;base64,${bytes.toString('base64')}`
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.AI_ENABLED
  delete process.env.RUNPOD_API_KEY
  delete process.env.RUNPOD_ENDPOINT_ID
  delete process.env.AI_ALLOWED_ORIGINS
})

describe('protecciones de la API Cloud AI', () => {
  it('permanece desactivada sin configuración de servidor', async () => {
    const { response, state } = mockResponse()
    await handler(request('POST'), response)
    expect(state.statusCode).toBe(503)
    expect(state.headers['Cache-Control']).toBe('no-store')
  })

  it('rechaza métodos y orígenes no permitidos', async () => {
    const unsupported = mockResponse()
    await handler(request('PUT'), unsupported.response)
    expect(unsupported.state.statusCode).toBe(405)

    const crossSite = mockResponse()
    await handler(request('POST', { origin: 'https://example.com' }), crossSite.response)
    expect(crossSite.state.statusCode).toBe(403)
  })

  it('envía una sola solicitud pagable y no reintenta errores del proveedor', async () => {
    process.env.AI_ENABLED = 'true'
    process.env.RUNPOD_API_KEY = 'test-key'
    process.env.RUNPOD_ENDPOINT_ID = 'test-endpoint'

    const providerFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'busy' }),
    })
    vi.stubGlobal('fetch', providerFetch)

    const { response, state } = mockResponse()
    await handler(
      request('POST', {
        ip: '127.0.0.2',
        body: { image: await validImage(), mode: 'quality' },
      }),
      response,
    )

    expect(state.statusCode).toBe(502)
    expect(providerFetch).toHaveBeenCalledTimes(1)
    expect(state.body).toMatchObject({ error: expect.stringMatching(/No se hizo un reintento/i) })
  })
})

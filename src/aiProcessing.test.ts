import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelAiJob, dataUrlToBlob, getAiJob, startAiJob } from './aiProcessing'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cliente Cloud AI', () => {
  it('inicia y consulta un trabajo sin reintentos internos', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'job_12345678', status: 'queued' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'job_12345678', status: 'processing' }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(startAiJob({ dataUrl: 'data:image/webp;base64,AAAA', width: 1, height: 1, bytes: 3 }, 'quality'))
      .resolves.toMatchObject({ status: 'queued' })
    await expect(getAiJob('job_12345678')).resolves.toMatchObject({ status: 'processing' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('cancela con una sola solicitud tolerante a fallos', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(cancelAiJob('job_12345678')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('acepta WebP y rechaza resultados inválidos', () => {
    expect(dataUrlToBlob('data:image/webp;base64,AQID')).toMatchObject({ type: 'image/webp', size: 3 })
    expect(() => dataUrlToBlob('data:image/gif;base64,AQID')).toThrow(/no valida/i)
  })
})

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  AI_BLEND_FACTOR,
  AI_OUTPUT_QUALITY,
  REAL_ESRGAN_FAST_MODEL,
  REAL_ESRGAN_QUALITY_MODEL,
  buildComfyWorkflow,
  createRunpodInput,
  extractRunpodImage,
  normalizeRunpodStatus,
  parseAiQualityMode,
  sanitizeAiInput,
  validateJobId,
} from './aiCore'

async function imageDataUrl(
  options: { format?: 'png' | 'jpeg'; width?: number; height?: number; alpha?: number } = {},
) {
  const format = options.format ?? 'png'
  const channels = options.alpha === undefined ? 3 : 4
  const buffer = await sharp({
    create: {
      width: options.width ?? 16,
      height: options.height ?? 12,
      channels,
      background:
        options.alpha === undefined
          ? { r: 20, g: 40, b: 60 }
          : { r: 20, g: 40, b: 60, alpha: options.alpha },
    },
  })[format]().toBuffer()
  return `data:image/${format};base64,${buffer.toString('base64')}`
}

describe('validación de entrada Cloud AI', () => {
  it('rechaza contenido disfrazado y normaliza una imagen válida a WebP', async () => {
    const jpeg = await imageDataUrl({ format: 'jpeg' })
    await expect(sanitizeAiInput(jpeg.replace('image/jpeg', 'image/png'))).rejects.toThrow(/MIME/i)

    const result = await sanitizeAiInput(jpeg)
    expect(result.dataUrl).toMatch(/^data:image\/webp;base64,/)
    expect(result).toMatchObject({ width: 16, height: 12 })
  })

  it('acepta alfa opaco y rechaza transparencia o dimensiones fuera del límite', async () => {
    await expect(sanitizeAiInput(await imageDataUrl({ alpha: 1 }))).resolves.toMatchObject({ width: 16 })
    await expect(sanitizeAiInput(await imageDataUrl({ alpha: 0.5 }))).rejects.toThrow(/transparent/i)
    await expect(sanitizeAiInput(await imageDataUrl({ width: 1601, height: 1 }))).rejects.toThrow(/limite/i)
  })
})

describe('contrato fijo de RunPod', () => {
  it('usa el flujo 4x a 2x con mezcla conservadora por defecto', () => {
    const workflow = buildComfyWorkflow('quality')
    expect(workflow['2'].inputs.model_name).toBe(REAL_ESRGAN_QUALITY_MODEL)
    expect(workflow['4'].inputs).toMatchObject({ image: ['3', 0], scale_by: 0.5 })
    expect(workflow['6'].inputs).toMatchObject({
      image1: ['5', 0],
      image2: ['4', 0],
      blend_factor: AI_BLEND_FACTOR,
    })
    expect(workflow['7'].inputs).toMatchObject({ quality: AI_OUTPUT_QUALITY })
    expect(createRunpodInput({ dataUrl: 'data:image/webp;base64,AAAA', width: 1, height: 1 }))
      .toMatchObject({ input: { images: [{ name: 'input.webp' }] } })
  })

  it('solo permite el modelo 2x en modo rápido', () => {
    const workflow = buildComfyWorkflow('fast')
    expect(workflow['2'].inputs.model_name).toBe(REAL_ESRGAN_FAST_MODEL)
    expect(workflow['5'].inputs).toMatchObject({ blend_factor: AI_BLEND_FACTOR })
    expect(workflow['7']).toBeUndefined()
    expect(parseAiQualityMode('fast')).toBe('fast')
    expect(() => parseAiQualityMode('custom')).toThrow(/calidad/i)
  })

  it('valida estados, IDs y resultados WebP', async () => {
    expect(normalizeRunpodStatus('IN_QUEUE')).toBe('queued')
    expect(normalizeRunpodStatus('IN_PROGRESS')).toBe('processing')
    expect(normalizeRunpodStatus('COMPLETED')).toBe('completed')
    expect(validateJobId('abc12345_job')).toBe('abc12345_job')
    expect(() => validateJobId('../bad')).toThrow(/Identificador/i)

    const webp = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).webp().toBuffer()
    const raw = webp.toString('base64')
    expect(extractRunpodImage({ output: { images: [{ data: raw }] } })).toBe(`data:image/webp;base64,${raw}`)
    expect(() => extractRunpodImage({ output: { images: [{ data: 'not-base64' }] } })).toThrow(/imagen/i)
  })
})

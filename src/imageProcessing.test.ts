import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_BYTES,
  assertSupportedFile,
  outputName,
  sharpenImageDataAsync,
  sharpenImageData,
  validateDimensions,
  validateFileSignature,
  validateProcessSettings,
} from './imageProcessing'

class ImageDataMock {
  readonly colorSpace = 'srgb' as const
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}

Object.defineProperty(globalThis, 'ImageData', {
  configurable: true,
  value: ImageDataMock as unknown as typeof ImageData,
})

describe('image validation', () => {
  it('rejects unsupported MIME and oversize files', () => {
    expect(() => assertSupportedFile(new File(['x'], 'x.gif', { type: 'image/gif' }))).toThrow(/Formato/)
    expect(() => assertSupportedFile(new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'x.jpg', { type: 'image/jpeg' }))).toThrow(/12 MB/)
  })

  it('rejects image bombs and long edges', () => {
    expect(() => validateDimensions(9000, 2)).toThrow(/lado/)
    expect(() => validateDimensions(5000, 5000)).toThrow(/18 megapíxeles/)
  })

  it('checks file signatures instead of trusting MIME declarations', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(() => validateFileSignature(png, 'image/png')).not.toThrow()
    expect(() => validateFileSignature(png, 'image/jpeg')).toThrow(/no coincide/)
    expect(() => validateFileSignature(new Uint8Array([1, 2, 3]), 'image/png')).toThrow(/contenido/)
  })

  it('rejects animated WebP and unsafe output dimensions', () => {
    const animatedWebp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x0a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x58, 0x01, 0, 0, 0, 0x02,
    ])
    expect(() => validateFileSignature(animatedWebp, 'image/webp')).toThrow(/animado/)
    expect(() => validateProcessSettings(5000, 4000, {
      sharpness: 1,
      denoise: 0.1,
      scale: 2,
      format: 'image/webp',
    })).toThrow(/demasiado grande/)
  })
})

describe('local processing helpers', () => {
  it('changes pixels when sharpness is applied', () => {
    const data = new Uint8ClampedArray([
      20, 20, 20, 255, 80, 80, 80, 255, 20, 20, 20, 255,
      80, 80, 80, 255, 220, 220, 220, 255, 80, 80, 80, 255,
      20, 20, 20, 255, 80, 80, 80, 255, 20, 20, 20, 255,
    ])
    const result = sharpenImageData(new ImageData(data, 3, 3), { sharpness: 1.2, denoise: 0 })
    expect(Array.from(result.data)).not.toEqual(Array.from(data))
    expect(result.data[3]).toBe(255)
  })

  it('creates safe output names', () => {
    expect(outputName('Mi foto final!!.png', 'image/webp')).toBe('mi-foto-final-mejorada.webp')
    expect(outputName('\u900f\u660e \u56fe\u50cf.png', 'image/png')).toBe('imagen-mejorada.png')
  })

  it('honors cancellation between processing chunks', async () => {
    const controller = new AbortController()
    controller.abort()
    const input = new ImageData(new Uint8ClampedArray(32 * 32 * 4), 32, 32)
    await expect(sharpenImageDataAsync(input, { sharpness: 1, denoise: 0 }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

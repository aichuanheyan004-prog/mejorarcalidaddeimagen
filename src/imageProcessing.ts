export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_FILE_BYTES = 12 * 1024 * 1024
export const MAX_PIXELS = 18_000_000
export const MAX_EDGE = 7200
export const MAX_OUTPUT_PIXELS = 32_000_000
export const MAX_OUTPUT_EDGE = 10_000

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export type ProcessSettings = {
  sharpness: number
  denoise: number
  scale: 1 | 2
  format: OutputFormat
}

export type ImageInfo = {
  file: File
  bitmap: ImageBitmap
  width: number
  height: number
  hasAlpha: boolean
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function assertSupportedFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type as OutputFormat)) {
    throw new Error('Formato no compatible. Usa JPEG, PNG o WebP.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el límite de 12 MB.')
  }
  if (file.size === 0) throw new Error('El archivo esta vacio.')
}

function bytesEqual(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function webpIsAnimated(bytes: Uint8Array) {
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)
    if (type === 'ANIM') return true
    if (type === 'VP8X' && offset + 8 < bytes.length && (bytes[offset + 8] & 0x02) !== 0) return true
    if (size < 0) break
    offset += 8 + size + (size % 2)
  }
  return false
}

export function validateFileSignature(bytes: Uint8Array, declaredType: string) {
  let detected: OutputFormat | null = null
  if (bytes.length >= 3 && bytesEqual(bytes, [0xff, 0xd8, 0xff])) detected = 'image/jpeg'
  if (bytes.length >= 8 && bytesEqual(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) detected = 'image/png'
  if (
    bytes.length >= 12 &&
    bytesEqual(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesEqual(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    detected = 'image/webp'
  }

  if (!detected) throw new Error('El contenido no es una imagen JPEG, PNG o WebP válida.')
  if (detected !== declaredType) throw new Error('El tipo declarado no coincide con el contenido de la imagen.')
  if (detected === 'image/webp' && webpIsAnimated(bytes)) {
    throw new Error('WebP animado no es compatible. Usa una imagen estatica.')
  }
}

export function validateDimensions(width: number, height: number) {
  if (width < 1 || height < 1) throw new Error('La imagen no se pudo decodificar.')
  if (width * height > MAX_PIXELS) throw new Error('La imagen supera el límite de 18 megapíxeles.')
  if (Math.max(width, height) > MAX_EDGE) throw new Error('El lado más largo supera el límite permitido.')
}

export function validateProcessSettings(width: number, height: number, settings: ProcessSettings) {
  if (!Number.isFinite(settings.sharpness) || settings.sharpness < 0 || settings.sharpness > 2.5) {
    throw new Error('La nitidez esta fuera del intervalo permitido.')
  }
  if (!Number.isFinite(settings.denoise) || settings.denoise < 0 || settings.denoise > 0.8) {
    throw new Error('La reducción de ruido está fuera del intervalo permitido.')
  }
  if (settings.scale !== 1 && settings.scale !== 2) throw new Error('La escala no es compatible.')
  if (!ACCEPTED_TYPES.includes(settings.format)) throw new Error('El formato de salida no es compatible.')
  const outputWidth = width * settings.scale
  const outputHeight = height * settings.scale
  if (outputWidth * outputHeight > MAX_OUTPUT_PIXELS || Math.max(outputWidth, outputHeight) > MAX_OUTPUT_EDGE) {
    throw new Error('La salida es demasiado grande para procesarla con seguridad en este navegador.')
  }
}

function sharpenRows(
  input: ImageData,
  source: Uint8ClampedArray,
  output: Uint8ClampedArray,
  settings: Pick<ProcessSettings, 'sharpness' | 'denoise'>,
  startY: number,
  endY: number,
) {
  const { width, height } = input
  const strength = Math.max(0, Math.min(2.5, settings.sharpness))
  const denoise = Math.max(0, Math.min(1, settings.denoise))

  for (let y = startY; y < endY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      for (let c = 0; c < 3; c += 1) {
        let sum = 0
        let count = 0
        for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy += 1) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx += 1) {
            sum += source[(yy * width + xx) * 4 + c]
            count += 1
          }
        }
        const blur = sum / count
        const denoised = source[idx + c] * (1 - denoise) + blur * denoise
        output[idx + c] = clampByte(denoised + (denoised - blur) * strength)
      }
      output[idx + 3] = source[idx + 3]
    }
  }
}

export function sharpenImageData(input: ImageData, settings: Pick<ProcessSettings, 'sharpness' | 'denoise'>) {
  const source = new Uint8ClampedArray(input.data)
  const output = new Uint8ClampedArray(input.data)
  sharpenRows(input, source, output, settings, 0, input.height)
  return new ImageData(output, input.width, input.height)
}

export async function sharpenImageDataAsync(
  input: ImageData,
  settings: Pick<ProcessSettings, 'sharpness' | 'denoise'>,
  signal?: AbortSignal,
) {
  const source = new Uint8ClampedArray(input.data)
  const output = new Uint8ClampedArray(input.data)
  const chunkRows = 24

  for (let startY = 0; startY < input.height; startY += chunkRows) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
    sharpenRows(input, source, output, settings, startY, Math.min(input.height, startY + chunkRows))
    if (startY + chunkRows < input.height) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  return new ImageData(output, input.width, input.height)
}

export function outputName(inputName: string, format: OutputFormat) {
  const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg'
  const base = inputName
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${base || 'imagen'}-mejorada.${ext}`
}

export async function decodeImage(file: File): Promise<ImageInfo> {
  assertSupportedFile(file)
  validateFileSignature(new Uint8Array(await file.arrayBuffer()), file.type)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    validateDimensions(bitmap.width, bitmap.height)
  } catch (error) {
    bitmap.close()
    throw error
  }
  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp'
  return { file, bitmap, width: bitmap.width, height: bitmap.height, hasAlpha }
}

export async function processImage(info: ImageInfo, settings: ProcessSettings, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')
  validateProcessSettings(info.width, info.height, settings)
  const canvas = document.createElement('canvas')
  canvas.width = info.width
  canvas.height = info.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas no esta disponible en este navegador.')
  ctx.drawImage(info.bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const processed = await sharpenImageDataAsync(imageData, settings, signal)
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError')

  const out = document.createElement('canvas')
  out.width = info.width * settings.scale
  out.height = info.height * settings.scale
  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('Canvas no esta disponible en este navegador.')
  if (settings.format === 'image/jpeg') {
    outCtx.fillStyle = '#fff'
    outCtx.fillRect(0, 0, out.width, out.height)
  }
  ctx.putImageData(processed, 0, 0)
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(canvas, 0, 0, out.width, out.height)

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => {
      if (!blob) reject(new Error('No se pudo crear la imagen final.'))
      else resolve(blob)
    }, settings.format, settings.format === 'image/png' ? undefined : 0.92)
  })
}

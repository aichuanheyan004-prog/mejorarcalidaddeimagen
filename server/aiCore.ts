import sharp from 'sharp'

export const SERVER_AI_MAX_BYTES = 1_250_000
export const SERVER_AI_MAX_PIXELS = 1_000_000
export const SERVER_AI_MAX_EDGE = 1_600
export const SERVER_AI_MAX_RESULT_CHARS = 4_000_000
export const REAL_ESRGAN_QUALITY_MODEL = 'RealESRGAN_x4plus.pth'
export const REAL_ESRGAN_FAST_MODEL = 'RealESRGAN_x2plus.pth'
export const AI_BLEND_FACTOR = 0.85
export const AI_OUTPUT_QUALITY = 86

export type AiQualityMode = 'quality' | 'fast'

export type SanitizedAiInput = {
  dataUrl: string
  width: number
  height: number
}

export type RunpodStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/
const RAW_BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/
const JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/

export function validateJobId(value: unknown): string {
  if (typeof value !== 'string' || !JOB_ID_PATTERN.test(value)) {
    throw new Error('Identificador de trabajo no valido.')
  }
  return value
}

export function parseAiQualityMode(value: unknown): AiQualityMode {
  if (value === undefined || value === 'quality') return 'quality'
  if (value === 'fast') return 'fast'
  throw new Error('Selecciona un modo de calidad valido.')
}

export function parseImageDataUrl(value: unknown): { mime: string; bytes: Buffer } {
  if (typeof value !== 'string') throw new Error('Se necesita una imagen.')
  const match = DATA_URL_PATTERN.exec(value)
  if (!match) throw new Error('Usa una imagen JPEG, PNG o WebP valida.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length < 16 || bytes.length > SERVER_AI_MAX_BYTES) {
    throw new Error('La copia preparada para IA no puede superar 1,25 MB.')
  }
  return { mime: match[1], bytes }
}

export async function sanitizeAiInput(value: unknown): Promise<SanitizedAiInput> {
  const { mime, bytes } = parseImageDataUrl(value)
  const image = sharp(bytes, { failOn: 'warning', limitInputPixels: SERVER_AI_MAX_PIXELS })
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const expectedFormat = mime === 'image/jpeg' ? 'jpeg' : mime.slice('image/'.length)

  if (metadata.format !== expectedFormat) {
    throw new Error('El contenido no coincide con el tipo MIME declarado.')
  }
  if (
    width < 1 ||
    height < 1 ||
    width > SERVER_AI_MAX_EDGE ||
    height > SERVER_AI_MAX_EDGE ||
    width * height > SERVER_AI_MAX_PIXELS
  ) {
    throw new Error('La copia preparada supera el limite de pixeles para la IA en la nube.')
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new Error('La IA en la nube no admite imagenes animadas.')
  }
  if (metadata.hasAlpha) {
    const stats = await image.clone().stats()
    const alpha = stats.channels.at(-1)
    if (!alpha || alpha.min < 255) {
      throw new Error('Las imagenes transparentes solo se admiten en el modo local.')
    }
  }

  const sanitized = await image.rotate().webp({ quality: 86, effort: 4 }).toBuffer()
  if (sanitized.length > SERVER_AI_MAX_BYTES) {
    throw new Error('La copia saneada para IA es demasiado grande.')
  }
  return {
    dataUrl: `data:image/webp;base64,${sanitized.toString('base64')}`,
    width,
    height,
  }
}

export function buildComfyWorkflow(mode: AiQualityMode = 'quality') {
  const workflow: Record<
    string,
    { inputs: Record<string, unknown>; class_type: string; _meta: { title: string } }
  > = {
    '1': {
      inputs: { image: 'input.webp' },
      class_type: 'LoadImage',
      _meta: { title: 'Load sanitized input' },
    },
    '2': {
      inputs: {
        model_name: mode === 'quality' ? REAL_ESRGAN_QUALITY_MODEL : REAL_ESRGAN_FAST_MODEL,
      },
      class_type: 'UpscaleModelLoader',
      _meta: { title: 'Load allowlisted Real-ESRGAN model' },
    },
    '3': {
      inputs: { upscale_model: ['2', 0], image: ['1', 0] },
      class_type: 'ImageUpscaleWithModel',
      _meta: { title: mode === 'quality' ? 'AI 4x detail pass' : 'Native AI 2x pass' },
    },
  }

  const aiOutputNode = mode === 'quality' ? '4' : '3'
  const faithfulNode = mode === 'quality' ? '5' : '4'
  const blendNode = mode === 'quality' ? '6' : '5'
  const saveNode = mode === 'quality' ? '7' : '6'

  if (mode === 'quality') {
    workflow[aiOutputNode] = {
      inputs: { image: ['3', 0], upscale_method: 'lanczos', scale_by: 0.5 },
      class_type: 'ImageScaleBy',
      _meta: { title: 'Downsample AI detail to 2x' },
    }
  }

  workflow[faithfulNode] = {
    inputs: { image: ['1', 0], upscale_method: 'lanczos', scale_by: 2 },
    class_type: 'ImageScaleBy',
    _meta: { title: 'Faithful 2x reference' },
  }
  workflow[blendNode] = {
    inputs: {
      image1: [faithfulNode, 0],
      image2: [aiOutputNode, 0],
      blend_factor: AI_BLEND_FACTOR,
      blend_mode: 'normal',
    },
    class_type: 'ImageBlend',
    _meta: { title: 'Blend faithful resize to reduce artifacts' },
  }
  workflow[saveNode] = {
    inputs: {
      images: [blendNode, 0],
      filename_prefix: 'mejorarcalidaddeimagen',
      fps: 1,
      lossless: false,
      quality: AI_OUTPUT_QUALITY,
      method: 'default',
    },
    class_type: 'SaveAnimatedWEBP',
    _meta: { title: 'Save compact static WebP result' },
  }

  return workflow
}

export function createRunpodInput(input: SanitizedAiInput, mode: AiQualityMode = 'quality') {
  return {
    input: {
      workflow: buildComfyWorkflow(mode),
      images: [{ name: 'input.webp', image: input.dataUrl }],
    },
  }
}

export function normalizeRunpodStatus(value: unknown): RunpodStatus {
  const status = String(value || '').toUpperCase()
  if (status === 'IN_QUEUE') return 'queued'
  if (status === 'IN_PROGRESS') return 'processing'
  if (status === 'COMPLETED') return 'completed'
  if (status === 'CANCELLED' || status === 'CANCELED' || status === 'TIMED_OUT') return 'canceled'
  return 'failed'
}

export function extractRunpodImage(payload: unknown): string {
  const body = payload as {
    output?: {
      message?: unknown
      images?: Array<{ data?: unknown; image?: unknown }>
    }
  }
  const candidate =
    body.output?.images?.[0]?.data ??
    body.output?.images?.[0]?.image ??
    body.output?.message

  if (typeof candidate !== 'string') {
    throw new Error('RunPod termino sin devolver una imagen compatible.')
  }
  if (candidate.length > SERVER_AI_MAX_RESULT_CHARS) {
    throw new Error('El resultado de IA supera el limite de descarga.')
  }
  if (DATA_URL_PATTERN.test(candidate)) return candidate

  if (candidate.length % 4 !== 0 || !RAW_BASE64_PATTERN.test(candidate)) {
    throw new Error('RunPod termino sin devolver una imagen compatible.')
  }
  const bytes = Buffer.from(candidate, 'base64')
  const isWebp =
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!isWebp) throw new Error('RunPod termino sin devolver una imagen compatible.')
  return `data:image/webp;base64,${candidate}`
}

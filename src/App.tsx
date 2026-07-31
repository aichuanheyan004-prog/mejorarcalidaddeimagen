import {
  Cloud,
  Download,
  Gauge,
  ImageUp,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AI_POLL_INTERVAL_MS,
  AI_POLL_TIMEOUT_MS,
  type AiQualityMode,
  aiOutputName,
  cancelAiJob,
  dataUrlToBlob,
  getAiJob,
  prepareAiUpload,
  startAiJob,
  waitForAiPoll,
} from './aiProcessing'
import {
  type ImageInfo,
  type OutputFormat,
  type ProcessSettings,
  decodeImage,
  outputName,
  processImage,
} from './imageProcessing'
import { useObjectUrl } from './useObjectUrl'

type Status = 'idle' | 'ready' | 'processing' | 'done' | 'error'
type ProcessingMode = 'local' | 'ai'

type ResultInfo = {
  blob: Blob
  width: number
  height: number
  name: string
  mode: ProcessingMode
  quality?: AiQualityMode
}

const initialSettings: ProcessSettings = {
  sharpness: 1.15,
  denoise: 0.12,
  scale: 1,
  format: 'image/webp',
}

function RouteContent() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/') return <Home />
  if (path === '/guide') return <Guide />
  if (path === '/privacy') return <Privacy />
  if (path === '/terms') return <Terms />
  return <NotFound />
}

export function App() {
  return (
    <>
      <Header />
      <RouteContent />
      <Footer />
    </>
  )
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Mejorar Calidad de Imagen">
        <span className="brand-mark">MC</span>
        <span>Mejorar Calidad de Imagen</span>
      </a>
      <nav aria-label="Navegación principal">
        <a href="/guide">Guía</a>
        <a href="/privacy">Privacidad</a>
        <a href="/terms">Términos</a>
      </nav>
    </header>
  )
}

function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aiJobRef = useRef<string | null>(null)
  const [mode, setMode] = useState<ProcessingMode>('ai')
  const [aiQuality, setAiQuality] = useState<AiQualityMode>('quality')
  const [info, setInfo] = useState<ImageInfo | null>(null)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('Arrastra una foto o selecciona un archivo para empezar.')
  const [compare, setCompare] = useState(50)
  const [zoom, setZoom] = useState(1)
  const sourceUrl = useObjectUrl(info?.file)
  const resultUrl = useObjectUrl(result?.blob)
  const canRun = Boolean(info) && status !== 'processing'

  useEffect(() => () => info?.bitmap.close(), [info])

  const fileMeta = useMemo(() => {
    if (!info) {
      return mode === 'ai'
        ? 'JPEG, PNG o WebP; la copia para IA se reduce a 1 megapíxel'
        : 'JPEG, PNG o WebP hasta 12 MB y 18 megapíxeles'
    }
    return `${info.width} × ${info.height}px, ${(info.file.size / 1024 / 1024).toFixed(2)} MB`
  }, [info, mode])

  const outputMeta = result
    ? `${result.width} × ${result.height}px · ${result.quality === 'fast' ? 'IA rápida' : result.quality === 'quality' ? 'IA alta calidad' : 'Local'}`
    : 'Sin resultado'

  function abortInFlight() {
    abortRef.current?.abort()
    abortRef.current = null
    const jobId = aiJobRef.current
    aiJobRef.current = null
    if (jobId) void cancelAiJob(jobId)
  }

  async function loadFile(file: File) {
    abortInFlight()
    try {
      setResult(null)
      setStatus('processing')
      setMessage('Decodificando la imagen y comprobando límites...')
      const decoded = await decodeImage(file)
      setInfo(decoded)
      setStatus('ready')
      setMessage(
        mode === 'ai'
          ? 'Imagen lista. Elige calidad o velocidad y crea una mejora 2x con IA.'
          : 'Imagen lista. Ajusta nitidez, ruido y tamaño de salida.',
      )
    } catch (error) {
      setInfo(null)
      setResult(null)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir la imagen.')
    }
  }

  async function runLocal() {
    if (!info) return
    abortInFlight()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      setStatus('processing')
      setMessage('Procesando en este navegador. La imagen no se sube al servidor.')
      const blob = await processImage(info, settings, controller.signal)
      setResult({
        blob,
        width: info.width * settings.scale,
        height: info.height * settings.scale,
        name: outputName(info.file.name, settings.format),
        mode: 'local',
      })
      setStatus('done')
      setMessage('Resultado local listo. Revisa el antes/después y descarga si te sirve.')
    } catch (error) {
      const canceled = error instanceof DOMException && error.name === 'AbortError'
      setStatus(canceled ? 'ready' : 'error')
      setMessage(canceled ? 'Procesamiento cancelado.' : error instanceof Error ? error.message : 'El procesamiento falló.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function runAi() {
    if (!info) return
    abortInFlight()
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = Date.now()

    try {
      setStatus('processing')
      setMessage('Preparando una copia WebP reducida y sin metadatos...')
      const prepared = await prepareAiUpload(info, controller.signal)
      setMessage('Enviando la copia reducida a la IA en la nube...')

      // Do not abort the dispatch request after sending it: losing the job ID could leave billed work orphaned.
      const job = await startAiJob(prepared, aiQuality)
      aiJobRef.current = job.id
      if (controller.signal.aborted) {
        await cancelAiJob(job.id)
        aiJobRef.current = null
        throw new DOMException('Cancelado', 'AbortError')
      }

      setMessage(
        job.status === 'processing'
          ? 'La mejora con IA está en proceso...'
          : 'Iniciando el Worker. La primera imagen puede tardar más.',
      )

      while (Date.now() - startedAt < AI_POLL_TIMEOUT_MS) {
        await waitForAiPoll(AI_POLL_INTERVAL_MS, controller.signal)
        const current = await getAiJob(job.id, controller.signal)
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1_000))

        if (current.status === 'queued') {
          setMessage(`La IA en la nube está en cola · ${elapsed}s. Puedes cancelar en cualquier momento.`)
          continue
        }
        if (current.status === 'processing') {
          setMessage(`${aiQuality === 'quality' ? 'Creando detalle y reduciendo artefactos' : 'Aplicando mejora rápida'} · ${elapsed}s.`)
          continue
        }
        if (current.status === 'failed' || current.status === 'canceled') {
          throw new Error(current.error || 'El trabajo de IA no terminó correctamente.')
        }
        if (!current.resultDataUrl) throw new Error('La IA terminó sin devolver una imagen.')

        const blob = dataUrlToBlob(current.resultDataUrl)
        const bitmap = await createImageBitmap(blob)
        const width = bitmap.width
        const height = bitmap.height
        bitmap.close()
        setResult({
          blob,
          width,
          height,
          name: aiOutputName(info.file.name, aiQuality),
          mode: 'ai',
          quality: aiQuality,
        })
        aiJobRef.current = null
        setStatus('done')
        setMessage('Mejora 2x con IA lista. El detalle es estimado: revisa letras, rostros y texturas.')
        return
      }

      const timedOutJob = aiJobRef.current
      aiJobRef.current = null
      if (timedOutJob) await cancelAiJob(timedOutJob)
      throw new Error('La IA en la nube superó el tiempo máximo. No se envió un reintento automático.')
    } catch (error) {
      const unfinishedJob = aiJobRef.current
      aiJobRef.current = null
      if (unfinishedJob) await cancelAiJob(unfinishedJob)
      const canceled = error instanceof DOMException && error.name === 'AbortError'
      setStatus(canceled ? 'ready' : 'error')
      setMessage(
        canceled
          ? 'Procesamiento cancelado.'
          : error instanceof Error
            ? error.message
            : 'La IA en la nube no pudo completar la solicitud.',
      )
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  async function cancelWork() {
    const jobId = aiJobRef.current
    aiJobRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    if (jobId) await cancelAiJob(jobId)
    setStatus(info ? 'ready' : 'idle')
    setMessage('Procesamiento cancelado. No se envió un reintento.')
  }

  function reset() {
    abortInFlight()
    setInfo(null)
    setResult(null)
    setSettings(initialSettings)
    setCompare(50)
    setZoom(1)
    setStatus('idle')
    setMessage('Arrastra una foto o selecciona un archivo para empezar.')
  }

  function switchMode(nextMode: ProcessingMode) {
    if (nextMode === mode) return
    abortInFlight()
    setMode(nextMode)
    setResult(null)
    setStatus(info ? 'ready' : 'idle')
    setMessage(
      info
        ? nextMode === 'ai'
          ? 'Imagen lista para crear una mejora 2x con IA.'
          : 'Imagen lista para procesar localmente.'
        : nextMode === 'ai'
          ? 'Elige una imagen para preparar una mejora 2x con IA.'
          : 'Arrastra una foto o selecciona un archivo para empezar.',
    )
  }

  function updateSetting<K extends keyof ProcessSettings>(key: K, value: ProcessSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) void loadFile(file)
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.read) {
        setMessage('Este navegador no ofrece lectura de imágenes desde el portapapeles.')
        return
      }
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((candidate) => candidate.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          await loadFile(new File([blob], 'imagen-pegada', { type }))
          return
        }
      }
      setMessage('No encontré una imagen en el portapapeles.')
    } catch {
      setMessage('El navegador no permitió leer el portapapeles.')
    }
  }

  return (
    <main>
      <section className="tool-shell" aria-labelledby="tool-title">
        <div className="tool-intro">
          <p className="eyebrow">Herramienta online en español</p>
          <h1 id="tool-title">Mejorar calidad de imagen</h1>
          <p>
            Usa IA en la nube para una superresolución 2x con detalle estimado o el modo local para
            nitidez, ruido ligero y exportación privada en tu navegador.
          </p>
        </div>

        <div className="mode-switch" role="group" aria-label="Modo de procesamiento">
          <button type="button" className={mode === 'ai' ? 'active' : ''} aria-pressed={mode === 'ai'} onClick={() => switchMode('ai')} disabled={status === 'processing'}>
            <Cloud aria-hidden="true" /> IA en la nube 2x
          </button>
          <button type="button" className={mode === 'local' ? 'active' : ''} aria-pressed={mode === 'local'} onClick={() => switchMode('local')} disabled={status === 'processing'}>
            <ShieldCheck aria-hidden="true" /> Modo local
          </button>
        </div>

        <div className="workspace" data-testid="workspace">
          <section className="panel upload-panel" aria-label="Entrada de imagen">
            <label className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
              <input
                data-testid="file-input"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void loadFile(file)
                  event.target.value = ''
                }}
              />
              <Upload aria-hidden="true" />
              <span>Arrastra, selecciona o pega una imagen</span>
              <small>{fileMeta}</small>
            </label>
            <div className="button-row">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={status === 'processing'}>
                <ImageUp aria-hidden="true" /> Seleccionar
              </button>
              <button type="button" onClick={() => void pasteFromClipboard()} disabled={status === 'processing'}>
                <Sparkles aria-hidden="true" /> Pegar
              </button>
            </div>
            <p className={`status ${status}`} data-testid="status" role="status" aria-live="polite">{message}</p>
          </section>

          <section className="panel preview-panel" aria-label="Vista previa">
            <div className="preview-frame" style={{ '--zoom': String(zoom) } as CSSProperties}>
              {sourceUrl && resultUrl ? (
                <div className="compare" style={{ '--split': `${compare}%` } as CSSProperties}>
                  <img src={sourceUrl} alt="Imagen original" />
                  <img className="after" src={resultUrl} alt="Imagen mejorada" />
                  <span className="compare-line" aria-hidden="true" />
                </div>
              ) : sourceUrl ? (
                <img src={sourceUrl} alt="Imagen original" />
              ) : (
                <div className="empty-preview">Vista previa</div>
              )}
            </div>
            <label className="control compact-control">
              <span>Comparación antes/después</span>
              <input data-testid="compare-slider" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} disabled={!result} />
            </label>
          </section>

          <section className="panel controls-panel" aria-label="Controles">
            <h2><SlidersHorizontal aria-hidden="true" /> {mode === 'ai' ? 'IA en la nube 2x' : 'Ajustes locales'}</h2>

            {mode === 'ai' ? (
              <>
                <div className="segmented quality-switch" role="group" aria-label="Calidad de la IA en la nube">
                  <button type="button" className={aiQuality === 'quality' ? 'active' : ''} aria-pressed={aiQuality === 'quality'} onClick={() => setAiQuality('quality')} disabled={status === 'processing'}>
                    Alta calidad
                  </button>
                  <button type="button" className={aiQuality === 'fast' ? 'active' : ''} aria-pressed={aiQuality === 'fast'} onClick={() => setAiQuality('fast')} disabled={status === 'processing'}>
                    Rápido
                  </button>
                </div>
                <div className="mode-note">
                  <Gauge aria-hidden="true" />
                  <span>
                    {aiQuality === 'quality'
                      ? 'Modelo 4x, salida 2x y mezcla conservadora para reducir artefactos.'
                      : 'Modelo 2x más rápido; puede suavizar textura fina.'}
                  </span>
                </div>
                <p className="fine-print">No aplica restauración facial ni deblur real. El modelo puede estimar detalles inexistentes.</p>
              </>
            ) : (
              <>
                <label className="control">
                  <span>Nitidez {settings.sharpness.toFixed(2)}</span>
                  <input data-testid="sharpness-slider" type="range" min="0" max="2.5" step="0.05" value={settings.sharpness} onChange={(event) => updateSetting('sharpness', Number(event.target.value))} />
                </label>
                <label className="control">
                  <span>Reducción de ruido {settings.denoise.toFixed(2)}</span>
                  <input data-testid="denoise-slider" type="range" min="0" max="0.8" step="0.02" value={settings.denoise} onChange={(event) => updateSetting('denoise', Number(event.target.value))} />
                </label>
                <div className="segmented" role="group" aria-label="Tamaño de salida">
                  <button className={settings.scale === 1 ? 'active' : ''} data-testid="scale-1x" type="button" onClick={() => updateSetting('scale', 1)}>1x</button>
                  <button className={settings.scale === 2 ? 'active' : ''} data-testid="scale-2x" type="button" onClick={() => updateSetting('scale', 2)}>2x</button>
                </div>
                <label className="control">
                  <span>Formato</span>
                  <select data-testid="format-select" value={settings.format} onChange={(event) => updateSetting('format', event.target.value as OutputFormat)}>
                    <option value="image/webp">WebP</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                  </select>
                </label>
              </>
            )}

            <label className="control">
              <span>Zoom de vista previa {Math.round(zoom * 100)}%</span>
              <input data-testid="zoom-slider" type="range" min="0.75" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>

            <div className="button-row stacked">
              <button data-testid="process-button" type="button" disabled={!canRun} onClick={() => mode === 'ai' ? void runAi() : void runLocal()}>
                <RefreshCcw aria-hidden="true" /> {mode === 'ai' ? 'Crear IA 2x' : 'Mejorar localmente'}
              </button>
              <button data-testid="cancel-button" type="button" disabled={status !== 'processing'} onClick={() => void cancelWork()}>
                <XCircle aria-hidden="true" /> Cancelar
              </button>
              <button data-testid="reset-button" type="button" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Reiniciar
              </button>
              <a
                aria-disabled={!resultUrl}
                className={!resultUrl ? 'disabled button-link' : 'button-link'}
                data-testid="download-link"
                href={resultUrl || undefined}
                download={result?.name}
              >
                <Download aria-hidden="true" /> Descargar
              </a>
            </div>

            <dl className="result-facts">
              <div><dt>Entrada</dt><dd>{info ? `${info.width} × ${info.height}px` : 'Sin imagen'}</dd></div>
              <div><dt>Salida</dt><dd>{outputMeta}</dd></div>
            </dl>
          </section>
        </div>

        <div className={`truth-bar ${mode === 'ai' ? 'cloud' : ''}`}>
          {mode === 'ai' ? (
            <>
              <span><Cloud aria-hidden="true" /> Se sube temporalmente una copia WebP reducida solo al iniciar.</span>
              <span>Sin página pública ni almacenamiento permanente del sitio.</span>
            </>
          ) : (
            <>
              <span><ShieldCheck aria-hidden="true" /> Modo local: sin subida de archivos.</span>
              <span>Nitidez y 2x local no recuperan detalle real perdido.</span>
            </>
          )}
        </div>
      </section>

      <InfoSections />
    </main>
  )
}

function InfoSections() {
  return (
    <section className="content-grid">
      <article>
        <h2>Superresolución con IA</h2>
        <p>La IA en la nube crea una salida 2x. Alta calidad prioriza el detalle y Rápido reduce el tiempo de espera.</p>
      </article>
      <article>
        <h2>Qué puede cambiar</h2>
        <p>La IA puede mejorar bordes y texturas, pero también inventar letras, pelo o detalles finos. Revisa siempre el resultado y conserva el original.</p>
      </article>
      <article>
        <h2>Privacidad por modo</h2>
        <p>El modo local permanece en tu navegador. La IA en la nube envía una copia reducida y sin metadatos solo después de pulsar el botón; no crea resultados públicos.</p>
      </article>
    </section>
  )
}

function Guide() {
  return (
    <main className="document">
      <h1>Guía para mejorar la calidad de una imagen</h1>
      <p>Primero identifica el problema: falta de nitidez, ruido, artefactos JPEG, baja resolución o desenfoque real. Cada caso requiere un ajuste diferente.</p>
      <h2>Nitidez, ruido y halos</h2>
      <p>Sube la nitidez poco a poco y vuelve atrás cuando aparezcan bordes claros u oscuros alrededor de objetos. Si hay mucho granulado, reduce algo de ruido antes de enfocar.</p>
      <h2>Ampliar una imagen</h2>
      <p>Escalar a 2x aumenta píxeles. El modo local interpola; la IA en la nube usa superresolución para estimar textura. Ninguno recupera información fiable que nunca llegó al archivo.</p>
      <h2>IA en la nube: alta calidad y rápido</h2>
      <p>Alta calidad usa un modelo 4x, reduce la salida a 2x y mezcla una referencia conservadora para limitar artefactos. Rápido usa un modelo 2x y prioriza el tiempo. Ambos pueden alterar texto o textura fina.</p>
      <h2>Foto borrosa y desenfoque</h2>
      <p>Una herramienta de nitidez o superresolución no equivale a quitar desenfoque. El desenfoque por movimiento o enfoque fallido necesita modelos específicos y no permite prometer recuperación garantizada.</p>
      <h2>Formato de salida</h2>
      <p>La IA en la nube entrega WebP 2x. En modo local, WebP suele equilibrar calidad y peso, JPEG sirve para fotos sin transparencia y PNG conserva el canal alfa.</p>
      <p><a href="/">Abrir la herramienta para mejorar una foto</a></p>
    </main>
  )
}

function Privacy() {
  return (
    <main className="document">
      <h1>Privacidad</h1>
      <p>El modo local procesa la imagen mediante Canvas en tu navegador y no sube el archivo seleccionado.</p>
      <h2>IA en la nube</h2>
      <p>La IA en la nube se activa solo al pulsar «Crear IA 2x». El navegador prepara una copia WebP reducida a aproximadamente 1 megapíxel; el servidor valida el tipo real, elimina metadatos y la envía temporalmente a RunPod.</p>
      <p>No creamos páginas públicas, galerías ni almacenamiento permanente de imágenes. RunPod puede mantener el resultado del trabajo accesible temporalmente, hasta unos 30 minutos, y Vercel o RunPod pueden conservar metadatos técnicos como IP, agente de usuario, estado, duración e identificador del trabajo para seguridad, facturación y fiabilidad. La región de procesamiento no está garantizada.</p>
      <h2>Límites</h2>
      <p>La IA en la nube no admite imágenes animadas ni transparencia. No registramos intencionadamente el contenido ni el nombre del archivo. Usa el modo local para imágenes sensibles que no quieras subir.</p>
    </main>
  )
}

function Terms() {
  return (
    <main className="document">
      <h1>Términos</h1>
      <p>Usa la herramienta solo con imágenes propias, autorizadas o que tengas derecho a editar. No la uses para actividades ilegales, suplantación, acoso, material abusivo o infracción de derechos.</p>
      <p>La IA en la nube puede estimar o inventar detalles. No garantizamos restauración forense, recuperación de identidad ni información real que no exista en la captura original.</p>
      <p>La disponibilidad depende del navegador, la cola y proveedores externos. Podemos cancelar, limitar o desactivar la IA en la nube ante abuso, coste no controlado, riesgo legal o problemas técnicos. Los fallos no generan un reintento automático después de iniciar un trabajo.</p>
    </main>
  )
}

function NotFound() {
  return (
    <main className="document">
      <h1>404</h1>
      <p>La página que buscas no existe.</p>
      <p><a href="/">Volver a la herramienta</a></p>
    </main>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Mejorar Calidad de Imagen</span>
      <a href="/guide">Guía</a>
      <a href="/privacy">Privacidad</a>
      <a href="/terms">Términos</a>
    </footer>
  )
}

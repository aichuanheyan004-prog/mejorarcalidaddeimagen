import {
  Download,
  ImageUp,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import { type CSSProperties, type DragEvent, useMemo, useRef, useState } from 'react'
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
  const [info, setInfo] = useState<ImageInfo | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [settings, setSettings] = useState(initialSettings)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('Arrastra una foto o selecciona un archivo para empezar.')
  const [compare, setCompare] = useState(50)
  const sourceUrl = useObjectUrl(info?.file)
  const resultUrl = useObjectUrl(result)
  const canRun = Boolean(info) && status !== 'processing'

  const fileMeta = useMemo(() => {
    if (!info) return 'JPEG, PNG o WebP hasta 12 MB y 18 megapíxeles'
    return `${info.width} x ${info.height}px, ${(info.file.size / 1024 / 1024).toFixed(2)} MB`
  }, [info])

  async function loadFile(file: File) {
    try {
      setResult(null)
      setStatus('processing')
      setMessage('Decodificando la imagen y comprobando límites...')
      const decoded = await decodeImage(file)
      setInfo(decoded)
      setStatus('ready')
      setMessage('Imagen lista. Ajusta la nitidez, el ruido y el tamaño de salida.')
    } catch (error) {
      setInfo(null)
      setResult(null)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir la imagen.')
    }
  }

  async function runLocal() {
    if (!info) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      setStatus('processing')
      setMessage('Procesando en este navegador. La imagen no se sube al servidor.')
      const blob = await processImage(info, settings, controller.signal)
      setResult(blob)
      setStatus('done')
      setMessage('Resultado listo. Revisa el antes/después y descarga si te sirve.')
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === 'AbortError' ? 'ready' : 'error')
      setMessage(error instanceof Error ? error.message : 'El procesamiento falló.')
    }
  }

  function reset() {
    abortRef.current?.abort()
    setInfo(null)
    setResult(null)
    setSettings(initialSettings)
    setStatus('idle')
    setMessage('Arrastra una foto o selecciona un archivo para empezar.')
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
            Aumenta la nitidez, reduce ruido ligero y exporta una versión más limpia sin subir la
            imagen en el modo local. Para fotos muy borrosas o detalles inexistentes, el resultado
            tiene límites.
          </p>
        </div>

        <div className="workspace" data-testid="workspace">
          <section className="panel upload-panel" aria-label="Entrada de imagen">
            <label
              className="dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                data-testid="file-input"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void loadFile(file)
                }}
              />
              <Upload aria-hidden="true" />
              <span>Arrastra, selecciona o pega una imagen</span>
              <small>{fileMeta}</small>
            </label>
            <div className="button-row">
              <button type="button" onClick={() => inputRef.current?.click()}>
                <ImageUp aria-hidden="true" /> Seleccionar
              </button>
              <button type="button" onClick={() => void pasteFromClipboard()}>
                <Sparkles aria-hidden="true" /> Pegar
              </button>
            </div>
            <p className={`status ${status}`} data-testid="status" role="status">{message}</p>
          </section>

          <section className="panel preview-panel" aria-label="Vista previa">
            <div className="preview-frame">
              {sourceUrl && resultUrl ? (
                <div className="compare" style={{ '--split': `${compare}%` } as CSSProperties}>
                  <img src={sourceUrl} alt="Imagen original" />
                  <img className="after" src={resultUrl} alt="Imagen mejorada" />
                </div>
              ) : sourceUrl ? (
                <img src={sourceUrl} alt="Imagen original" />
              ) : (
                <div className="empty-preview">Vista previa</div>
              )}
            </div>
            {sourceUrl && resultUrl ? (
              <label className="control">
                <span>Comparacion</span>
                <input data-testid="compare-slider" type="range" min="0" max="100" value={compare} onChange={(event) => setCompare(Number(event.target.value))} />
              </label>
            ) : null}
          </section>

          <section className="panel controls-panel" aria-label="Controles">
            <h2><SlidersHorizontal aria-hidden="true" /> Ajustes</h2>
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
            <div className="button-row stacked">
              <button data-testid="process-button" type="button" disabled={!canRun} onClick={() => void runLocal()}>
                <RefreshCcw aria-hidden="true" /> Mejorar
              </button>
              <button data-testid="cancel-button" type="button" disabled={status !== 'processing'} onClick={() => abortRef.current?.abort()}>
                <XCircle aria-hidden="true" /> Cancelar
              </button>
              <button data-testid="reset-button" type="button" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Reiniciar
              </button>
              <a
                aria-disabled={!resultUrl || !info}
                className={!resultUrl || !info ? 'disabled button-link' : 'button-link'}
                data-testid="download-link"
                href={resultUrl || undefined}
                download={info ? outputName(info.file.name, settings.format) : undefined}
              >
                <Download aria-hidden="true" /> Descargar
              </a>
            </div>
          </section>
        </div>

        <div className="truth-bar">
          <span><ShieldCheck aria-hidden="true" /> Modo local: sin subida de archivos.</span>
          <span>La mejora con IA no está activa en esta versión.</span>
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
        <h2>Qué mejora realmente</h2>
        <p>La nitidez aumenta el contraste alrededor de bordes ya existentes. La reducción de ruido suaviza granulado ligero. La ampliación 2x local cambia el tamaño con interpolación; no reconstruye detalle real perdido.</p>
      </article>
      <article>
        <h2>Cuándo usarlo</h2>
        <p>Funciona mejor en fotos apenas suaves, imágenes de producto, escaneos, capturas y salidas de IA con falta leve de definición. Una foto movida o fuera de foco puede necesitar un modelo específico de deblur.</p>
      </article>
      <article>
        <h2>Privacidad</h2>
        <p>El modo disponible procesa en memoria del navegador. No hay cuentas, historial público ni páginas indexables con resultados de usuarios.</p>
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
      <p>Escalar a 2x aumenta píxeles, pero una ampliación local no inventa información fiable. La superresolución con IA puede estimar detalle, aunque también puede crear texturas o letras falsas.</p>
      <h2>Foto borrosa y desenfoque</h2>
      <p>Una herramienta de nitidez no equivale a quitar desenfoque. El desenfoque por movimiento, enfoque fallido o baja luz necesita modelos y pruebas específicas; no conviene prometer recuperación garantizada.</p>
      <h2>Formato de salida</h2>
      <p>WebP suele equilibrar calidad y peso. JPEG va bien para fotos sin transparencia. PNG conserva transparencia y gráficos, pero puede pesar más.</p>
      <p><a href="/">Abrir la herramienta para mejorar una foto</a></p>
    </main>
  )
}

function Privacy() {
  return (
    <main className="document">
      <h1>Privacidad</h1>
      <p>El modo local procesa la imagen en tu navegador mediante Canvas. El archivo seleccionado no se sube a nuestro servidor en esta versión.</p>
      <p>No creamos páginas públicas de resultados ni guardamos historiales de imágenes. Si en una fase posterior se activa Cloud AI, la interfaz pedirá acción explícita y explicará RunPod, retención temporal, límites y borrado.</p>
      <p>Podemos recibir registros técnicos básicos del sitio, como URL visitada, estado de respuesta y agente de usuario, según el proveedor de alojamiento. No incluyas datos sensibles si no quieres que sean procesados por tu navegador.</p>
    </main>
  )
}

function Terms() {
  return (
    <main className="document">
      <h1>Términos</h1>
      <p>Usa la herramienta solo con imágenes propias, autorizadas o que tengas derecho a editar. No la uses para actividades ilegales, suplantación, acoso, material abusivo o infracción de derechos.</p>
      <p>El resultado puede contener halos, textura perdida, artefactos o cambios de color. No garantizamos restauración forense, recuperación de identidad ni detalles reales que no existan en la captura original.</p>
      <p>La herramienta se ofrece sin garantía de disponibilidad continua. Podemos cambiar límites o desactivar funciones si hay abuso, riesgo legal, coste no controlado o problemas técnicos.</p>
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

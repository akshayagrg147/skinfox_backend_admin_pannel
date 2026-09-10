import { ArrowRight, Camera, CircleAlert, ImageUp, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type PhotoCaptureProps = {
  onCapture: (photo: string) => void
  onSkip: () => void
  /** Photo checks left today. undefined while unknown; 0 disables capture. */
  remaining?: number
  limit?: number
  limitMessage?: string
}

const CAPTURE_SIZE = 720

/**
 * Captures a reference photo entirely on the device. The image is handed back as
 * a data URL held in React state only — it is never uploaded, persisted, or sent
 * with the care-finder request. This is a visual aid for the questions that
 * follow, not an analysis of the person's skin.
 */
export function PhotoCapture({ onCapture, onSkip, remaining, limit, limitMessage }: PhotoCaptureProps) {
  const [mode, setMode] = useState<'intro' | 'live'>('intro')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Releasing the camera when this step unmounts matters: a live track keeps the
  // device indicator on even after the modal closes.
  useEffect(() => stopStream, [stopStream])

  // Runs after the <video> has mounted, so the ref is populated by now.
  useEffect(() => {
    if (mode !== 'live') return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    // play() resolves to a promise in browsers, but to undefined elsewhere.
    const started = video.play() as Promise<void> | undefined
    started?.catch(() => undefined)
  }, [mode])

  const startCamera = async () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t open the camera here. You can choose a photo instead.')
      return
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('The camera needs a secure (https) connection. You can choose a photo instead.')
      return
    }
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setMode('live')
    } catch (cause) {
      const name = (cause as { name?: string })?.name
      setError(
        name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow it in your browser, or choose a photo instead.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device. You can choose a photo instead.'
            : 'The camera could not be opened. You can choose a photo instead.',
      )
      stopStream()
    } finally {
      setStarting(false)
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    // Square centre crop keeps the framing consistent with the reference thumbnail.
    const edge = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(edge, CAPTURE_SIZE)
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, (video.videoWidth - edge) / 2, (video.videoHeight - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', 0.82)
    stopStream()
    setMode('intro')
    onCapture(photo)
  }

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file isn’t an image. Please choose a photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const image = new Image()
      // Re-encoding through a canvas both caps the upload size and drops EXIF
      // metadata, which on phone photos usually includes GPS coordinates.
      image.onload = () => {
        const edge = Math.min(image.naturalWidth, image.naturalHeight) || CAPTURE_SIZE
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = Math.min(edge, CAPTURE_SIZE)
        const context = canvas.getContext('2d')
        if (!context) { onCapture(reader.result as string); return }
        context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height)
        onCapture(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => setError('That photo could not be read. Please try another one.')
      image.src = reader.result
    }
    reader.onerror = () => setError('That photo could not be read. Please try another one.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="care-photo">
      {mode === 'live' ? (
        <>
          <h2 className="care-photo__title">Line up your photo.</h2>
          <p className="care-photo__hint">Find even, natural light and look straight at the camera.</p>
          <div className="care-photo__stage">
            <video ref={videoRef} className="care-photo__video" autoPlay playsInline muted aria-label="Camera preview" />
            <span className="care-photo__frame" aria-hidden="true" />
          </div>
          <div className="care-photo__actions">
            <button type="button" className="care-finder-primary-button" onClick={capture}>
              <Camera size={17} aria-hidden="true" /> Capture photo
            </button>
            <button type="button" className="care-finder-text-button" onClick={() => { stopStream(); setMode('intro') }}>
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
        </>
      ) : remaining === 0 ? (
        <>
          <h2 className="care-photo__title">Let’s carry on with the questions.</h2>
          <p className="care-photo__hint">
            {limitMessage || `You’ve used today’s ${limit ?? 2} photo checks. The questions cover everything a photo would, and your care edit works just the same.`}
          </p>
          <div className="care-photo__actions">
            <button type="button" className="care-finder-primary-button" onClick={onSkip}>
              Continue to the questions <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="care-photo__title">Start with a photo?</h2>
          <p className="care-photo__hint">
            Take a quick photo to keep beside you while you answer. It stays on your device — we never upload or store it,
            and it isn’t analysed or used to diagnose anything.
          </p>
          <ul className="care-photo__assurances">
            <li><ShieldCheck size={15} aria-hidden="true" /> Stays on your device</li>
            {typeof remaining === 'number' && <li><Camera size={15} aria-hidden="true" /> {remaining} of {limit ?? 2} photo checks left today</li>}
          </ul>
          {error && (
            <p className="care-photo__error" role="status">
              <CircleAlert size={16} aria-hidden="true" /> {error}
            </p>
          )}
          <div className="care-photo__actions">
            <button type="button" className="care-finder-primary-button" onClick={() => void startCamera()} disabled={starting}>
              {starting ? <><RefreshCw size={17} aria-hidden="true" className="care-photo__spin" /> Opening camera…</> : <><Camera size={17} aria-hidden="true" /> Take a photo</>}
            </button>
            <button type="button" className="care-finder-text-button" onClick={() => fileInputRef.current?.click()}>
              <ImageUp size={16} aria-hidden="true" /> Choose a photo
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="user"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = '' }}
          />
          <button type="button" className="care-photo__skip care-finder-text-button" onClick={onSkip}>
            Continue without a photo
          </button>
        </>
      )}
    </div>
  )
}

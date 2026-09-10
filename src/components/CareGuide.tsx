import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import './care-guide.css'

type CareGuideProps = {
  variant?: 'feature' | 'sidebar' | 'compact'
  message?: string
  /** Shows a brief "thinking" beat before the next line, as if replying. */
  speaking?: boolean
  className?: string
}

const defaultMessage =
  'Hi, let’s find what feels right for you. Tell me about your skin, hair or scalp, and we’ll explore your everyday care together.'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** Reveals the line a few characters at a time, so the guide reads as speaking. */
function useTypedText(text: string, enabled: boolean) {
  const [shown, setShown] = useState(text)

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setShown(text)
      return
    }
    setShown('')
    let index = 0
    // Two characters a tick keeps longer lines from dragging.
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + 2)
      setShown(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, 18)
    return () => window.clearInterval(timer)
  }, [text, enabled])

  return shown
}

/** A fictional product-discovery guide, never presented as a clinician. */
export function CareGuide({ variant = 'sidebar', message, speaking = false, className = '' }: CareGuideProps) {
  const line = message ?? defaultMessage
  const typed = useTypedText(line, variant === 'sidebar')
  const isTyping = typed.length < line.length

  return (
    <div className={`care-guide care-guide--${variant} ${speaking ? 'is-speaking' : ''} ${className}`}>
      <div className="care-guide__portrait">
        <img
          src="/care/skinfox-care-guide.webp"
          srcSet="/care/skinfox-care-guide-small.webp 240w, /care/skinfox-care-guide.webp 640w"
          sizes={variant === 'compact' ? '64px' : '(max-width: 680px) 240px, 420px'}
          alt="Portrait of the SkinFox care guide, a friendly product adviser in a white blazer"
          width="640"
          height="640"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="care-guide__identity">
        <span className="care-guide__identity-icon" aria-hidden="true"><Sparkles size={17} /></span>
        <span><strong>Your SkinFox care guide</strong><small>Product guide · Not a medical professional</small></span>
      </div>
      {variant !== 'feature' && (
        speaking ? (
          <p className="care-guide__message care-guide__message--typing">
            <span className="care-guide__dots" role="status" aria-label="Your care guide is replying"><i /><i /><i /></span>
          </p>
        ) : (
          // The complete line stays in the accessibility tree via aria-label, so
          // assistive tech never reads a half-typed sentence.
          <p className={`care-guide__message ${isTyping ? 'is-typing' : ''}`} aria-label={line}>
            <span aria-hidden="true">{typed}</span>
          </p>
        )
      )}
    </div>
  )
}

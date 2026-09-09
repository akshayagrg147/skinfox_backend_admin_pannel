import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

type ModalShellProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  drawer?: boolean
}

export function ModalShell({ open, onClose, title, children, className = '', drawer = false }: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const selectors = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(selectors) ?? []).filter((item) => !item.hasAttribute('disabled'))

    document.body.classList.add('is-locked')
    window.setTimeout(() => getFocusable()[0]?.focus(), 30)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('is-locked')
      previousFocus?.focus()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={panelRef}
            className={`${drawer ? 'drawer-panel' : 'modal-panel'} ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={drawer ? { x: '100%' } : { y: 28, scale: 0.985, opacity: 0 }}
            animate={drawer ? { x: 0 } : { y: 0, scale: 1, opacity: 1 }}
            exit={drawer ? { x: '100%' } : { y: 18, scale: 0.99, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <button className="icon-button modal-close" onClick={onClose} aria-label={`Close ${title}`}>
              <X size={19} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

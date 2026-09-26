import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { LaunchPromotion } from '../hooks/useStorefront'
import { ModalShell } from './ModalShell'

type LaunchOfferPopupProps = {
  promotion: LaunchPromotion
  eligible: boolean
}

const POPUP_DELAY_MS = 900

function sessionKey(promotionId: string) {
  return `skinfox-launch-offer-seen:${promotionId}`
}

export function LaunchOfferPopup({ promotion, eligible }: LaunchOfferPopupProps) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const maximumOrders = Math.max(0, Math.round(promotion.maximumOrders))
  const remainingOrders = Math.min(maximumOrders, Math.max(0, Math.round(promotion.remainingOrders)))
  const claimedOrders = Math.max(0, maximumOrders - remainingOrders)
  const claimedPercent = maximumOrders > 0 ? Math.min(100, (claimedOrders / maximumOrders) * 100) : 0
  const formatter = useMemo(() => new Intl.NumberFormat('en-IN'), [])

  useEffect(() => {
    if (!eligible) return
    const key = sessionKey(promotion.id)
    try {
      if (window.sessionStorage.getItem(key)) return
    } catch {
      // Private browsing can make storage unavailable. The popup can still be
      // shown once for the current React mount without breaking the storefront.
    }

    const timer = window.setTimeout(() => {
      setOpen(true)
      try {
        window.sessionStorage.setItem(key, 'seen')
      } catch {
        // Session persistence is an enhancement, not a requirement.
      }
    }, POPUP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [eligible, promotion.id])

  if (!eligible) return null

  const close = () => setOpen(false)

  return (
    <ModalShell open={open} onClose={close} title="SkinFox launch offer" className="launch-offer-modal">
      <div className="launch-offer-modal__glow" aria-hidden="true" />
      <div className="launch-offer-modal__content">
        <span className="launch-offer-modal__eyebrow"><Sparkles size={15} /> Exclusive launch offer</span>
        <h2>A little more care,<br /><em>for a little less.</em></h2>
        <p>Enjoy <strong>{promotion.discountPercent}% off</strong> SkinFox essentials while the launch allocation lasts.</p>

        <div className="launch-offer-modal__availability" aria-label={`${formatter.format(remainingOrders)} of ${formatter.format(maximumOrders)} launch reservations remain`}>
          <div>
            <motion.strong
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.16, duration: reduceMotion ? 0.12 : 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              {formatter.format(remainingOrders)}
            </motion.strong>
            <span>reservations left</span>
          </div>
          <small>of the first {formatter.format(maximumOrders)} launch reservations</small>
          <span className="launch-offer-modal__progress" aria-hidden="true">
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: claimedPercent / 100 }}
              transition={{ delay: reduceMotion ? 0 : 0.24, duration: reduceMotion ? 0.12 : 0.75, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        </div>

        <div className="launch-offer-modal__actions">
          <a className="button button--copper" href="#shop" onClick={close}>Shop the offer <ArrowRight size={16} /></a>
          <button type="button" className="launch-offer-modal__later" onClick={close}>Maybe later</button>
        </div>
        <small className="launch-offer-modal__note">Offer availability is confirmed at checkout.</small>
      </div>
    </ModalShell>
  )
}

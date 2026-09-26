import { motion } from 'framer-motion'
import type { LaunchPromotion } from '../hooks/useStorefront'

type LaunchProgressProps = {
  promotion: LaunchPromotion
}

export function LaunchProgress({ promotion }: LaunchProgressProps) {
  const maximumOrders = Math.max(0, Math.round(promotion.maximumOrders))
  const remainingOrders = Math.min(maximumOrders, Math.max(0, Math.round(promotion.remainingOrders)))
  const formatter = new Intl.NumberFormat('en-IN')

  return (
    <span className="announcement__remaining" aria-label={`${formatter.format(remainingOrders)} of ${formatter.format(maximumOrders)} launch orders remain`}>
      <motion.b
        key={remainingOrders}
        initial={{ opacity: 0, y: -5, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {formatter.format(remainingOrders)}
      </motion.b>
      <em>orders left</em>
    </span>
  )
}

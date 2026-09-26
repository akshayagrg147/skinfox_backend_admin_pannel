import { z } from 'zod'

export const launchPromotionSchema = z.object({
  id: z.string().min(1).default('skinfox-launch-40'),
  enabled: z.boolean().default(true),
  discountPercent: z.number().int().min(0).max(100).default(40),
  maximumOrders: z.number().int().min(1).max(1_000_000).default(500),
  startsAt: z.string().datetime().default(() => new Date(0).toISOString()),
  endsAt: z.string().datetime().nullable().default(null),
  eligibleProductIds: z.array(z.string()).default([]),
  eligibleCategories: z.array(z.string()).default([]),
}).strict()

export type LaunchPromotion = z.infer<typeof launchPromotionSchema>
export type LaunchPromotionStatus = 'active' | 'paused' | 'scheduled' | 'completed' | 'ended'

export type LaunchPromotionPriceLine = {
  quantity: number
  unitPricePaise: number | null
  mrpPaise?: number | null
}

export const defaultLaunchPromotion = (): LaunchPromotion => launchPromotionSchema.parse({
  id: process.env.LAUNCH_PROMOTION_ID ?? 'skinfox-launch-40',
  enabled: process.env.LAUNCH_PROMOTION_ENABLED !== 'false',
  discountPercent: Number(process.env.LAUNCH_PROMOTION_PERCENT ?? 40),
  maximumOrders: Number(process.env.LAUNCH_PROMOTION_MAX_ORDERS ?? 500),
  startsAt: process.env.LAUNCH_PROMOTION_STARTS_AT || new Date(0).toISOString(),
  endsAt: process.env.LAUNCH_PROMOTION_ENDS_AT || null,
})

export const parseLaunchPromotion = (value: unknown, fallback = defaultLaunchPromotion()): LaunchPromotion => {
  const parsed = launchPromotionSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

export const launchPromotionStatus = (promotion: LaunchPromotion, successfulOrders: number, now = new Date()): LaunchPromotionStatus => {
  if (successfulOrders >= promotion.maximumOrders) return 'completed'
  if (!promotion.enabled) return 'paused'
  if (new Date(promotion.startsAt) > now) return 'scheduled'
  if (promotion.endsAt && new Date(promotion.endsAt) < now) return 'ended'
  return 'active'
}

export const launchPromotionDiscount = (subtotalPaise: number, promotion: LaunchPromotion, successfulOrders: number, now = new Date()) => {
  if (launchPromotionStatus(promotion, successfulOrders, now) !== 'active' || promotion.discountPercent <= 0) return 0
  return Math.min(subtotalPaise, Math.floor(subtotalPaise * promotion.discountPercent / 100))
}

/**
 * Return the part of a cart that can safely receive the launch promotion.
 *
 * Product `pricePaise` is the price customers already see and pay for. When
 * it is below the product MRP, that product already has a catalogue markdown;
 * applying the launch percentage again would create a silent double discount
 * (and make the Razorpay amount disagree with the storefront price). Only
 * full-price catalogue lines are therefore eligible for the additional launch
 * promotion. Lines without an MRP are left out because the percentage cannot
 * be explained accurately to a customer.
 */
export const launchPromotionEligibleSubtotal = (lines: LaunchPromotionPriceLine[]) => lines.reduce((total, line) => {
  const unitPrice = line.unitPricePaise
  const mrp = line.mrpPaise
  if (!Number.isInteger(unitPrice) || unitPrice <= 0 || !Number.isInteger(mrp) || mrp <= 0 || unitPrice < mrp) return total
  return total + unitPrice * Math.max(0, Math.trunc(line.quantity))
}, 0)

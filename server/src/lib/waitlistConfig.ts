import { z } from 'zod'
import { randomBytes } from 'node:crypto'

export const waitlistSettingsSchema = z.object({
  enabled: z.boolean(),
  depositPaise: z.number().int().min(100).max(10_000_000),
  discountPercent: z.number().int().min(1).max(90),
  termsVersion: z.string().trim().min(1).max(40),
  refundable: z.literal(false).default(false),
  stage: z.enum(['waitlist', 'founder_reveal', 'launch', 'regular']).default('waitlist'),
  founderCapacity: z.number().int().min(1).max(10_000).default(200),
  founderPricePaise: z.number().int().min(100).max(10_000_000).default(59_900),
  launchPricePaise: z.number().int().min(100).max(10_000_000).default(64_900),
  regularPricePaise: z.number().int().min(100).max(10_000_000).default(70_000),
  pricingMode: z.enum(['exact_revealed_price', 'discount_off_mrp', 'percentage_of_mrp']).default('exact_revealed_price'),
}).strict()
  .superRefine((value, ctx) => {
    if (value.founderPricePaise > value.launchPricePaise) ctx.addIssue({ code: 'custom', path: ['founderPricePaise'], message: 'Founder price cannot exceed launch price' })
    if (value.launchPricePaise > value.regularPricePaise) ctx.addIssue({ code: 'custom', path: ['launchPricePaise'], message: 'Launch price cannot exceed regular price' })
    if (['waitlist', 'founder_reveal'].includes(value.stage) && !value.enabled) ctx.addIssue({ code: 'custom', path: ['enabled'], message: 'Waitlist and founder-reveal stages must keep launch access enabled' })
    if (['launch', 'regular'].includes(value.stage) && value.enabled) ctx.addIssue({ code: 'custom', path: ['enabled'], message: 'Launch and regular stages must close new waitlist reservations' })
  })

export type WaitlistSettings = z.infer<typeof waitlistSettingsSchema>

export function waitlistDefaultsFromEnv(env: NodeJS.ProcessEnv = process.env): WaitlistSettings {
  const deposit = Number(env.WAITLIST_DEPOSIT_PAISE ?? 9900)
  const discount = Number(env.WAITLIST_DISCOUNT_PERCENT ?? 25)
  const enabled = env.WAITLIST_ENABLED !== 'false'
  return waitlistSettingsSchema.parse({
    enabled,
    depositPaise: Number.isFinite(deposit) ? Math.min(10_000_000, Math.max(100, Math.round(deposit))) : 9900,
    discountPercent: Number.isFinite(discount) ? Math.min(90, Math.max(1, Math.round(discount))) : 25,
    termsVersion: env.WAITLIST_TERMS_VERSION?.trim() || '2026-09-10-nonrefundable',
    refundable: false,
    stage: enabled ? 'waitlist' : 'launch',
    founderCapacity: 200,
    founderPricePaise: 59_900,
    launchPricePaise: 64_900,
    regularPricePaise: 70_000,
    pricingMode: 'exact_revealed_price',
  })
}

export function parseStoredWaitlistSettings(value: unknown, fallback: WaitlistSettings): WaitlistSettings {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const legacyStage = stored && stored.stage === undefined && stored.enabled === false ? 'launch' : undefined
  const legacyRefundPolicy = stored && stored.refundable === undefined
  const parsed = waitlistSettingsSchema.safeParse(stored ? { ...fallback, ...stored, ...(legacyStage ? { stage: legacyStage } : {}), ...(legacyRefundPolicy ? { refundable: false, termsVersion: fallback.termsVersion } : {}) } : value)
  return parsed.success ? parsed.data : fallback
}

export function calculateWaitlistDepositPaise(unitDepositPaise: number, quantities: readonly number[]): number {
  if (!Number.isInteger(unitDepositPaise) || unitDepositPaise < 100 || quantities.length === 0 || quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1 || quantity > 8)) {
    throw new RangeError('Invalid waitlist deposit calculation input.')
  }
  const total = unitDepositPaise * quantities.reduce((sum, quantity) => sum + quantity, 0)
  if (!Number.isSafeInteger(total) || total > 2_000_000_000) throw new RangeError('Waitlist deposit total is too large.')
  return total
}

export function createWaitlistId(now: Date = new Date()): string {
  return `SFWL-${now.getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`
}

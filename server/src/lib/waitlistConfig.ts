import { z } from 'zod'

export const waitlistSettingsSchema = z.object({
  enabled: z.boolean(),
  depositPaise: z.number().int().min(100).max(10_000_000),
  discountPercent: z.number().int().min(1).max(90),
  termsVersion: z.string().trim().min(1).max(40),
}).strict()

export type WaitlistSettings = z.infer<typeof waitlistSettingsSchema>

export function waitlistDefaultsFromEnv(env: NodeJS.ProcessEnv = process.env): WaitlistSettings {
  const deposit = Number(env.WAITLIST_DEPOSIT_PAISE ?? 9900)
  const discount = Number(env.WAITLIST_DISCOUNT_PERCENT ?? 25)
  return waitlistSettingsSchema.parse({
    enabled: env.WAITLIST_ENABLED !== 'false',
    depositPaise: Number.isFinite(deposit) ? Math.min(10_000_000, Math.max(100, Math.round(deposit))) : 9900,
    discountPercent: Number.isFinite(discount) ? Math.min(90, Math.max(1, Math.round(discount))) : 25,
    termsVersion: env.WAITLIST_TERMS_VERSION?.trim() || '2026-09-10',
  })
}

export function parseStoredWaitlistSettings(value: unknown, fallback: WaitlistSettings): WaitlistSettings {
  const parsed = waitlistSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}

import { randomToken } from './crypto.js'
import { prisma } from './prisma.js'

/**
 * Daily quota for care-finder photo analysis.
 *
 * Each analysed photo costs a real API call, so the limit is enforced on the
 * server. The browser is identified by a long-lived httpOnly cookie; an IP
 * ceiling sits behind it so clearing cookies does not hand out unlimited runs.
 * Neither key is perfect on its own — together they keep casual repeat use and
 * accidental loops inside a predictable spend.
 */

export const PHOTO_DAILY_LIMIT = Number(process.env.PHOTO_ANALYSIS_DAILY_LIMIT ?? 2)
export const PHOTO_DAILY_IP_LIMIT = Number(process.env.PHOTO_ANALYSIS_DAILY_IP_LIMIT ?? 10)
export const PHOTO_DEVICE_COOKIE = 'sf_photo_device'

/** Day key in the store's own timezone, so the quota resets at local midnight. */
export const quotaDay = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'Asia/Kolkata' }).format(now)

export const newDeviceId = () => randomToken(18)

const usedToday = async (scope: string, scopeKey: string, day: string) =>
  (await prisma.photoAnalysisUsage.findUnique({ where: { scope_scopeKey_day: { scope, scopeKey, day } } }))?.count ?? 0

export type QuotaState = { allowed: boolean; remaining: number; limit: number; reason: 'device' | 'ip' | null }

export async function checkPhotoQuota(deviceId: string, ip: string): Promise<QuotaState> {
  const day = quotaDay()
  const [deviceUsed, ipUsed] = await Promise.all([usedToday('device', deviceId, day), usedToday('ip', ip, day)])
  const remaining = Math.max(0, PHOTO_DAILY_LIMIT - deviceUsed)
  if (deviceUsed >= PHOTO_DAILY_LIMIT) return { allowed: false, remaining: 0, limit: PHOTO_DAILY_LIMIT, reason: 'device' }
  if (ipUsed >= PHOTO_DAILY_IP_LIMIT) return { allowed: false, remaining, limit: PHOTO_DAILY_LIMIT, reason: 'ip' }
  return { allowed: true, remaining, limit: PHOTO_DAILY_LIMIT, reason: null }
}

/** Recorded only once an analysis actually completes, so our own failures never cost a user a run. */
export async function recordPhotoUse(deviceId: string, ip: string): Promise<number> {
  const day = quotaDay()
  const [device] = await Promise.all([
    prisma.photoAnalysisUsage.upsert({
      where: { scope_scopeKey_day: { scope: 'device', scopeKey: deviceId, day } },
      update: { count: { increment: 1 } },
      create: { scope: 'device', scopeKey: deviceId, day, count: 1 },
    }),
    prisma.photoAnalysisUsage.upsert({
      where: { scope_scopeKey_day: { scope: 'ip', scopeKey: ip, day } },
      update: { count: { increment: 1 } },
      create: { scope: 'ip', scopeKey: ip, day, count: 1 },
    }),
  ])
  return Math.max(0, PHOTO_DAILY_LIMIT - device.count)
}

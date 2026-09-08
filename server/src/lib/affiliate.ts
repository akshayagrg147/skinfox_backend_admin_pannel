import { randomToken } from './crypto.js'

export const MINIMUM_AFFILIATE_REDEMPTION_PAISE = 50_000
export const AFFILIATE_COMMISSION_BPS = 1_000

export const affiliateCommissionPaise = (subtotalPaise: number, discountPaise: number) => {
  const eligibleSellingValue = Math.max(0, subtotalPaise - discountPaise)
  return Math.floor(eligibleSellingValue * AFFILIATE_COMMISSION_BPS / 10_000)
}

export const affiliateReferralCode = () => {
  const suffix = randomToken(6).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()
  return `SFX-${suffix}`
}

export const isValidPan = (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.trim().toUpperCase())

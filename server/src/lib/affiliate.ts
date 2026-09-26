import { randomToken } from './crypto.js'

export const MINIMUM_AFFILIATE_REDEMPTION_PAISE = 50_000
export const AFFILIATE_COMMISSION_BPS = 1_000

export type AffiliateRuleScope = 'campaign' | 'affiliate' | 'product' | 'category' | 'global'
export type AffiliateRuleType = 'percentage' | 'fixed'
export type AffiliateCommissionRuleInput = {
  id: string
  scope: AffiliateRuleScope
  type: AffiliateRuleType
  rateBps?: number | null
  fixedAmountPaise?: number | null
  priority?: number
  active?: boolean
  startsAt: Date
  endsAt?: Date | null
  updatedAt?: Date
}

const rulePrecedence: Record<AffiliateRuleScope, number> = {
  campaign: 5,
  affiliate: 4,
  product: 3,
  category: 2,
  global: 1,
}

/**
 * Choose one deterministic rule. The order mirrors the affiliate programme
 * contract: campaign, affiliate, product, category, then global. Priority and
 * update time make ties stable without depending on database row order.
 */
export const selectAffiliateCommissionRule = (rules: AffiliateCommissionRuleInput[], now = new Date()) => rules
  .filter((rule) => rule.active !== false && rule.startsAt <= now && (!rule.endsAt || rule.endsAt > now))
  .sort((left, right) => rulePrecedence[right.scope] - rulePrecedence[left.scope] || (right.priority ?? 0) - (left.priority ?? 0) || (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0) || left.id.localeCompare(right.id))[0] ?? null

export const calculateAffiliateCommission = (eligibleAmountPaise: number, rule: AffiliateCommissionRuleInput) => {
  const eligible = Math.max(0, Math.floor(Number(eligibleAmountPaise) || 0))
  const commission = rule.type === 'percentage'
    ? Math.floor(eligible * Math.max(0, Math.min(10_000, Number(rule.rateBps ?? 0))) / 10_000)
    : Math.max(0, Math.min(eligible, Math.floor(Number(rule.fixedAmountPaise ?? 0))))
  return { eligibleAmountPaise: eligible, commissionPaise: commission }
}

export const affiliateCommissionPaise = (subtotalPaise: number, discountPaise: number) => {
  const eligibleSellingValue = Math.max(0, subtotalPaise - discountPaise)
  return Math.floor(eligibleSellingValue * AFFILIATE_COMMISSION_BPS / 10_000)
}

export const affiliateReferralCode = () => {
  const suffix = randomToken(6).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()
  return `SFX-${suffix}`
}

export const isValidPan = (value: string) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value.trim().toUpperCase())

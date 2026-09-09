export type CareFinderAnswer = string | string[]

export type CareFinderMetadata = {
  role?: 'essential' | 'optional'
  reason?: string
  frequency?: string
  days?: string[]
  timeOfDay?: string
  instructions?: string
  stepOrder?: number
  guidanceStatus?: 'approved' | 'needs_review'
  avoidIf?: Record<string, string[]>
}

export type CareFinderRuleLike = {
  productId: string
  answerKey: string
  answerValue: string
  weight: number
  metadata?: unknown
}

export type CareFinderProductLike = {
  id: string
  name: string
  status?: string
  purchaseState?: string
  pricePaise?: number | null
  mrpPaise?: number | null
  variants?: Array<{ purchaseState?: string; pricePaise?: number | null; mrpPaise?: number | null; inventory?: Array<{ availableQty: number; reservedQty: number }> }>
}

export type ScoredCareProduct = {
  product: CareFinderProductLike
  score: number
  metadata: CareFinderMetadata
  matchedRules: string[]
}

export const answerMatches = (answer: CareFinderAnswer | undefined, expected: string) => Array.isArray(answer) ? answer.includes(expected) : answer === expected

export const metadataFrom = (value: unknown): CareFinderMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const metadata = value as Record<string, unknown>
  const role = metadata.role === 'optional' ? 'optional' : metadata.role === 'essential' ? 'essential' : undefined
  const days = Array.isArray(metadata.days) ? metadata.days.filter((day): day is string => typeof day === 'string') : undefined
  const guidanceStatus = metadata.guidanceStatus === 'approved' ? 'approved' : metadata.guidanceStatus === 'needs_review' ? 'needs_review' : undefined
  const avoidIf = metadata.avoidIf && typeof metadata.avoidIf === 'object' && !Array.isArray(metadata.avoidIf)
    ? Object.fromEntries(Object.entries(metadata.avoidIf as Record<string, unknown>).map(([key, item]) => [key, Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === 'string') : []]))
    : undefined
  return {
    ...(role ? { role } : {}),
    ...(typeof metadata.reason === 'string' ? { reason: metadata.reason } : {}),
    ...(typeof metadata.frequency === 'string' ? { frequency: metadata.frequency } : {}),
    ...(days?.length ? { days } : {}),
    ...(typeof metadata.timeOfDay === 'string' ? { timeOfDay: metadata.timeOfDay } : {}),
    ...(typeof metadata.instructions === 'string' ? { instructions: metadata.instructions } : {}),
    ...(typeof metadata.stepOrder === 'number' && Number.isFinite(metadata.stepOrder) ? { stepOrder: metadata.stepOrder } : {}),
    ...(guidanceStatus ? { guidanceStatus } : {}),
    ...(avoidIf ? { avoidIf } : {}),
  }
}

export const productIsPurchasable = (product: CareFinderProductLike) => {
  if (product.status && product.status !== 'published') return false
  if (product.purchaseState && product.purchaseState !== 'available') return false
  const variant = product.variants?.find((candidate) => candidate.purchaseState === 'available' && (candidate.pricePaise ?? product.pricePaise) !== null && (candidate.inventory ?? []).reduce((sum, row) => sum + row.availableQty - row.reservedQty, 0) > 0)
  if (product.variants?.length && !variant) return false
  return (variant?.pricePaise ?? product.pricePaise) !== null
}

const shouldAvoid = (metadata: CareFinderMetadata, answers: Record<string, CareFinderAnswer>) => Object.entries(metadata.avoidIf ?? {}).some(([key, values]) => {
  const answer = answers[key]
  return values.some((value) => answerMatches(answer, value))
})

export function scoreCareFinderProducts(rules: CareFinderRuleLike[], products: CareFinderProductLike[], answers: Record<string, CareFinderAnswer>): ScoredCareProduct[] {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const scores = new Map<string, ScoredCareProduct>()
  for (const rule of rules) {
    const metadata = metadataFrom(rule.metadata)
    if (!answerMatches(answers[rule.answerKey], rule.answerValue) || shouldAvoid(metadata, answers)) continue
    const product = productsById.get(rule.productId)
    if (!product || !productIsPurchasable(product)) continue
    const existing = scores.get(product.id)
    if (existing) {
      existing.score += rule.weight
      existing.matchedRules.push(`${rule.answerKey}:${rule.answerValue}`)
      if (metadata.role === 'essential') existing.metadata.role = 'essential'
      if (rule.weight > (existing.metadata as CareFinderMetadata & { _reasonWeight?: number })._reasonWeight!) Object.assign(existing.metadata, metadata, { _reasonWeight: rule.weight })
    } else {
      scores.set(product.id, { product, score: rule.weight, metadata: { ...metadata, _reasonWeight: rule.weight } as CareFinderMetadata, matchedRules: [`${rule.answerKey}:${rule.answerValue}`] })
    }
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name)).map((item) => {
    const metadata = { ...item.metadata } as CareFinderMetadata & { _reasonWeight?: number }
    delete metadata._reasonWeight
    return { ...item, metadata }
  })
}

export const productPricePaise = (product: CareFinderProductLike) => product.variants?.find((variant) => variant.purchaseState === 'available')?.pricePaise ?? product.pricePaise ?? 0
export const productMrpPaise = (product: CareFinderProductLike) => product.variants?.find((variant) => variant.purchaseState === 'available')?.mrpPaise ?? product.mrpPaise ?? null

import { createHash } from 'node:crypto'
import { Prisma, type AdminUser, type InventoryItem } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { ApiError, notFound, validationError } from './errors.js'

const productSelect = { id: true, name: true, slug: true, image: true, imageAlt: true, category: true, status: true, purchaseState: true } as const
const variantSelect = { id: true, sku: true, name: true, size: true, purchaseState: true, product: { select: productSelect } } as const

export async function inventoryWorkspace() {
  // One consistent read of the ledger; inventory rows do not have updatedAt.
  const [variants, locations, latest, movements] = await prisma.$transaction([
    prisma.productVariant.findMany({ select: { ...variantSelect, inventory: { include: { location: true } } }, orderBy: { sku: 'asc' } }),
    prisma.inventoryLocation.findMany({ orderBy: { name: 'asc' } }),
    prisma.inventoryMovement.groupBy({ by: ['variantId', 'locationId'], _max: { createdAt: true } }),
    prisma.inventoryMovement.findMany({ include: { variant: { select: variantSelect }, location: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12 }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  const lastByRow = new Map(latest.map((row) => [`${row.variantId}:${row.locationId}`, row._max.createdAt]))
  const rows = variants.flatMap(({ inventory, ...variant }) => inventory.length
    ? inventory.map((row) => ({ ...row, variant, lastMovementAt: lastByRow.get(`${row.variantId}:${row.locationId}`) ?? null }))
    : [{ id: `untracked:${variant.id}`, variantId: variant.id, locationId: null, availableQty: null, reservedQty: null, lowStockThreshold: null, location: null, variant, lastMovementAt: null }])
  return { rows, locations, movements, historyAvailable: true, complete: true, safeAdjustments: true, latestMovementComplete: true, untrackedIncluded: true }
}

export async function inventoryHistory(query: unknown) {
  const input = z.object({ variantId: z.string().optional(), locationId: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(query)
  const where = { ...(input.variantId ? { variantId: input.variantId } : {}), ...(input.locationId ? { locationId: input.locationId } : {}) }
  const [rows, total] = await prisma.$transaction([
    prisma.inventoryMovement.findMany({ where, include: { variant: { select: variantSelect }, location: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.limit, take: input.limit }),
    prisma.inventoryMovement.count({ where }),
  ])
  return { rows, total, page: input.page, limit: input.limit }
}

export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().min(1), locationId: z.string().min(1),
  quantity: z.number().int().min(-2147483647).max(2147483647).refine((value) => value !== 0, 'Enter a non-zero adjustment.'),
  reason: z.string().trim().min(3).max(500),
  expectedAvailableQty: z.number().int().optional(), expectedReservedQty: z.number().int().optional(),
})

export function validateInventoryAdjustment(item: Pick<InventoryItem, 'availableQty' | 'reservedQty'>, input: z.infer<typeof inventoryAdjustmentSchema>) {
  if ((input.expectedAvailableQty !== undefined && input.expectedAvailableQty !== item.availableQty) || (input.expectedReservedQty !== undefined && input.expectedReservedQty !== item.reservedQty)) {
    throw new ApiError(409, 'INVENTORY_CHANGED', 'Stock changed since you opened this item. Refresh the count and review the adjustment again.')
  }
  const next = item.availableQty + input.quantity
  if (!Number.isSafeInteger(next) || next < 0 || next > 2147483647 || next < item.reservedQty) {
    throw validationError('The resulting on-hand quantity must be non-negative and cannot be less than reserved stock.')
  }
  return next
}

type AdjustmentContext = { user: Pick<AdminUser, 'id'>; requestId: string; key: string; ip?: string; userAgent?: string }

export async function adjustInventory(body: unknown, context: AdjustmentContext) {
  const input = inventoryAdjustmentSchema.parse(body)
  const key = z.string().min(8).max(200).parse(context.key)
  const scope = `inventory-adjustment:${context.user.id}`
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const replay = async () => {
    const record = await prisma.idempotencyRecord.findUnique({ where: { key_scope: { key, scope } } })
    if (!record) return null
    if (record.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This adjustment reference has already been used for different values.')
    return record.responseBody
  }
  const saved = await replay()
  if (saved) return saved
  try {
    return await prisma.$transaction(async (tx) => {
      // Reserve the key inside the stock transaction. Concurrent retries cannot
      // apply a second movement, including when the first response is lost.
      const receipt = await tx.idempotencyRecord.create({ data: { key, scope, requestHash, expiresAt: new Date(Date.now() + 86400000) } })
      const before = await tx.inventoryItem.findUnique({ where: { variantId_locationId: { variantId: input.variantId, locationId: input.locationId } } })
      if (!before) throw notFound('This SKU is not tracked at the selected location.')
      const next = validateInventoryAdjustment(before, input)
      const updated = await tx.inventoryItem.updateMany({ where: { id: before.id, availableQty: before.availableQty, reservedQty: before.reservedQty }, data: { availableQty: next } })
      if (!updated.count) throw new ApiError(409, 'INVENTORY_CHANGED', 'Stock changed during this adjustment. Refresh the count and review it again.')
      const item = { ...before, availableQty: next }
      const movement = await tx.inventoryMovement.create({ data: { variantId: input.variantId, locationId: input.locationId, quantity: input.quantity, type: 'adjustment', reason: input.reason, actorId: context.user.id } })
      await tx.auditLog.create({ data: { actorId: context.user.id, action: 'inventory_adjustment', entityType: 'InventoryItem', entityId: item.id, beforeSummary: before, afterSummary: item, reason: input.reason, requestId: context.requestId, ip: context.ip, userAgent: context.userAgent, result: 'success' } })
      const response = JSON.parse(JSON.stringify({ data: { item, movement }, meta: { requestId: context.requestId } })) as Prisma.InputJsonValue
      await tx.idempotencyRecord.update({ where: { id: receipt.id }, data: { responseStatus: 200, responseBody: response } })
      return response
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const previous = await replay()
      if (previous) return previous
    }
    throw error
  }
}

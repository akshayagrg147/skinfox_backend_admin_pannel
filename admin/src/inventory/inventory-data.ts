import { ApiRequestError, get, getWithMeta } from '../api'

export type InventoryLocation = { id: string; name: string; code: string; isActive?: boolean }
export type InventoryVariant = { id: string; sku: string; name: string; size: string; purchaseState?: string; product: { id: string; name: string; image: string | null; imageAlt?: string | null; status?: string | null; purchaseState?: string | null; category?: string | null } }
export type InventoryRecord = { id: string; variantId: string; locationId: string | null; availableQty: number | null; reservedQty: number | null; lowStockThreshold: number | null; variant: InventoryVariant; location: InventoryLocation | null; lastMovementAt?: string | null }
export type InventoryMovement = { id: string; variantId: string; locationId: string; type: string; quantity: number; reason: string; createdAt: string; actorId?: string; orderId?: string; variant: InventoryVariant; location: InventoryLocation }
export type InventorySnapshot = { rows: InventoryRecord[]; locations: InventoryLocation[]; movements: InventoryMovement[]; historyAvailable: boolean; complete: boolean; safeAdjustments: boolean; latestMovementComplete: boolean; untrackedIncluded: boolean }
export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock' | 'untracked' | 'mismatch'
export const stockLabels: Record<StockState, string> = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock', untracked: 'Untracked', mismatch: 'Check count' }
export const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
export const numberLabel = (value: number | null | undefined) => value === null || value === undefined ? '—' : value.toLocaleString('en-IN')
export const humanize = (value: string) => value.replaceAll('_', ' ')
export const dateLabel = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded'

export function stockFor(row: InventoryRecord) {
  const tracked = whole(row.availableQty) && whole(row.reservedQty)
  const onHand = tracked ? row.availableQty! : null
  const reserved = tracked ? row.reservedQty! : null
  const free = tracked ? Math.max(0, onHand! - reserved!) : null
  const mismatch = tracked && (onHand! < 0 || reserved! < 0 || reserved! > onHand!)
  const state: StockState = !tracked ? 'untracked' : mismatch ? 'mismatch' : free === 0 ? 'out_of_stock' : whole(row.lowStockThreshold) && free! <= row.lowStockThreshold ? 'low_stock' : 'in_stock'
  const product = row.variant.product
  const publication = product.status === 'published' ? 'Live' : product.status ? humanize(product.status) : 'Status unavailable'
  const availability = row.variant.purchaseState ?? product.purchaseState
  const salesBlocked = Boolean((product.status && product.status !== 'published') || (availability && availability !== 'available'))
  const nextAction = state === 'mismatch' ? 'Reconcile stock count' : state === 'untracked' ? 'Inventory not tracked' : state === 'out_of_stock' ? (onHand! > 0 ? 'All stock reserved' : 'Restock needed') : state === 'low_stock' ? 'Below stock threshold' : salesBlocked ? 'Review catalogue availability' : 'Stock healthy'
  return { tracked, onHand, reserved, free, state, publication, availability, salesBlocked, nextAction }
}

export function inventorySummary(rows: InventoryRecord[]) {
  const tracked = rows.filter((row) => stockFor(row).tracked)
  return {
    skuCount: new Set(tracked.map((row) => row.variantId)).size,
    locationCount: new Set(tracked.map((row) => row.locationId)).size,
    onHand: tracked.reduce((sum, row) => sum + row.availableQty!, 0),
    reserved: tracked.reduce((sum, row) => sum + row.reservedQty!, 0),
    free: tracked.reduce((sum, row) => sum + stockFor(row).free!, 0),
    low: new Set(rows.filter((row) => stockFor(row).state === 'low_stock').map((row) => row.variantId)).size,
    out: new Set(rows.filter((row) => stockFor(row).state === 'out_of_stock').map((row) => row.variantId)).size,
  }
}

export function filterInventory(rows: InventoryRecord[], query: string, location: string, status: string, sort: string) {
  const term = query.trim().toLocaleLowerCase()
  const filtered = rows.filter((row) => {
    const stock = stockFor(row)
    return (!term || [row.variant.product.name, row.variant.sku, row.variant.size, row.location?.name, row.location?.code].some((value) => value?.toLocaleLowerCase().includes(term)))
      && (location === 'all' || row.locationId === location || (location === 'unassigned' && !row.locationId))
      && (status === 'all' || status === stock.state || (status === 'sales_blocked' && stock.salesBlocked) || (status === 'attention' && (stock.state !== 'in_stock' || stock.salesBlocked)))
  })
  const priority: Record<StockState, number> = { mismatch: 0, out_of_stock: 1, low_stock: 2, untracked: 3, in_stock: 4 }
  return filtered.sort((a, b) => {
    const left = stockFor(a), right = stockFor(b)
    const diff = sort === 'stock_asc' ? (left.free ?? Number.MAX_SAFE_INTEGER) - (right.free ?? Number.MAX_SAFE_INTEGER)
      : sort === 'stock_desc' ? (right.free ?? -1) - (left.free ?? -1)
        : sort === 'updated' ? (Date.parse(b.lastMovementAt ?? '') || 0) - (Date.parse(a.lastMovementAt ?? '') || 0)
          : sort === 'attention' ? priority[left.state] - priority[right.state] || Number(right.salesBlocked) - Number(left.salesBlocked) : 0
    return diff || a.variant.product.name.localeCompare(b.variant.product.name) || (a.location?.name ?? '').localeCompare(b.location?.name ?? '') || a.id.localeCompare(b.id)
  })
}

export function movementLabel(movement: InventoryMovement) {
  if (movement.type === 'reservation_hold') return `${numberLabel(movement.quantity)} reserved`
  if (movement.type === 'reservation_release') return `${numberLabel(movement.quantity)} released`
  if (movement.type === 'sale') return `−${numberLabel(Math.abs(movement.quantity))} shipped`
  return `${movement.quantity > 0 ? '+' : '−'}${numberLabel(Math.abs(movement.quantity))} units`
}

export async function loadInventory(): Promise<InventorySnapshot> {
  try {
    const snapshot = await get<InventorySnapshot>('/admin/inventory/workspace')
    if (snapshot && Array.isArray(snapshot.rows)) return snapshot
    // Older servers resolve /workspace through the existing variant-detail
    // route and return an array. Read the existing, paginated stock ledger.
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 404)) throw error
  }
  const allRows = new Map<string, InventoryRecord>()
  let complete = false
  for (let page = 1; page <= 100; page++) {
    const result = await getWithMeta<InventoryRecord[]>(`/admin/inventory?page=${page}&limit=100`)
    if (!Array.isArray(result.data)) throw new Error('The inventory response could not be read.')
    result.data.forEach((row) => allRows.set(row.id, row))
    if (typeof result.meta?.total === 'number' && allRows.size >= result.meta.total) { complete = true; break }
    if (!result.data.length || result.data.length < 100) { complete = result.meta?.total === undefined || allRows.size === result.meta.total; break }
  }
  let movements: InventoryMovement[] = [], historyAvailable = true
  try { movements = await get<InventoryMovement[]>('/admin/inventory/history') } catch { historyAvailable = false }
  if (!Array.isArray(movements)) { movements = []; historyAvailable = false }
  const rows = [...allRows.values()].map((row) => ({ ...row, lastMovementAt: movements.find((movement) => movement.variantId === row.variantId && movement.locationId === row.locationId)?.createdAt ?? null }))
  return { rows, locations: [...new Map(rows.flatMap((row) => row.location ? [[row.location.id, row.location] as const] : [])).values()], movements, historyAvailable, complete, safeAdjustments: false, latestMovementComplete: false, untrackedIncluded: false }
}

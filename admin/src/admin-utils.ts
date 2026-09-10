export type AdminRole = 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'CONTENT_EDITOR' | 'ORDER_MANAGER' | 'SUPPORT_AGENT' | 'ANALYST'

const screenAccess: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ['dashboard', 'products', 'catalogue', 'inventory', 'orders', 'waitlist', 'customers', 'affiliates', 'campaigns', 'content', 'care-finder', 'promotions', 'shipping', 'leads', 'analytics', 'users', 'audit', 'settings'],
  CATALOG_MANAGER: ['dashboard', 'products', 'catalogue', 'inventory'],
  CONTENT_EDITOR: ['dashboard', 'campaigns', 'content', 'care-finder'],
  ORDER_MANAGER: ['dashboard', 'inventory', 'orders', 'waitlist', 'customers', 'shipping'],
  SUPPORT_AGENT: ['orders', 'waitlist', 'customers', 'leads'],
  ANALYST: ['dashboard', 'waitlist', 'leads', 'analytics', 'audit'],
}

export function availableScreens(role: string): string[] {
  return screenAccess[role as AdminRole] ?? []
}

export function canAccessScreen(role: string, screen: string): boolean {
  return availableScreens(role).includes(screen)
}

export function defaultScreen(role: string): string {
  return availableScreens(role)[0] ?? 'dashboard'
}

const searchableText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(searchableText).join(' ')
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(searchableText).join(' ')
  return String(value)
}

export function filterRows<T extends Record<string, unknown>>(rows: T[], fields: string[], query: string): T[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return rows
  return rows.filter((row) => fields.some((field) => searchableText(row[field]).toLocaleLowerCase().includes(normalized)))
}

export function withSearch(path: string, query: string): string {
  const normalized = query.trim()
  if (!normalized) return path
  return `${path}${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(normalized)}`
}

export function formatAdminCell(value: unknown, field: string): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && field.toLowerCase().endsWith('paise')) return `₹${(value / 100).toLocaleString('en-IN')}`
  if (typeof value === 'number') return value.toLocaleString('en-IN')
  if (Array.isArray(value)) return `${value.length} items`
  if (typeof value === 'object') return 'Configured'
  return String(value).replaceAll('_', ' ')
}

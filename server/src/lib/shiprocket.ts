/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Small, server-only Shiprocket client.
 *
 * The storefront never talks to Shiprocket directly. Credentials are read
 * from the process environment and are deliberately not persisted in the
 * admin JSON settings editor.
 */

export type ShippingPaymentMethod = 'cod' | 'prepaid'

export interface ShippingPackage {
  weightKg: number
  lengthCm?: number
  breadthCm?: number
  heightCm?: number
  declaredValuePaise?: number
}

export interface ShippingCheckInput extends ShippingPackage {
  pickupPincode: string
  deliveryPincode: string
  paymentMethod: ShippingPaymentMethod
}

export interface CourierOption {
  id: string
  name: string
  ratePaise: number | null
  codAvailable: boolean
  estimatedDays: number | null
  etd: string | null
  raw?: unknown
}

export interface ShippingCheckResult {
  provider: 'shiprocket' | 'manual'
  serviceable: boolean
  codAvailable: boolean
  couriers: CourierOption[]
  message?: string
}

export interface ShiprocketOrderInput {
  orderNumber: string
  orderDate: string
  pickupLocation: string
  paymentMethod: ShippingPaymentMethod
  subtotalPaise: number
  customer: { name: string; email?: string; phone: string }
  address: { line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string }
  items: Array<{ name: string; sku: string; quantity: number; sellingPricePaise: number }>
  package: ShippingPackage
}

export interface ShiprocketCreateResult {
  providerOrderId: string | null
  providerShipmentId: string | null
  raw: unknown
}

type FetchLike = typeof fetch

type ShiprocketResponse = {
  token?: string
  token_expiry?: string
  status?: number
  message?: string
  data?: any
  [key: string]: any
}

const numberOrNull = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const paiseFromRupees = (value: unknown) => {
  const number = numberOrNull(value)
  return number === null ? null : Math.round(number * 100)
}

const stringValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

export class ShiprocketAdapter {
  readonly name = 'shiprocket' as const
  private token: string | null = null
  private tokenExpiresAt = 0

  constructor(
    private readonly email = process.env.SHIPROCKET_API_EMAIL,
    private readonly password = process.env.SHIPROCKET_API_PASSWORD,
    private readonly baseUrl = process.env.SHIPROCKET_API_BASE_URL ?? 'https://apiv2.shiprocket.in/v1/external',
    private readonly fetcher: FetchLike = fetch,
  ) {}

  configured() { return Boolean(this.email && this.password) }
  bookingEnabled() { return process.env.SHIPROCKET_BOOKING_ENABLED === 'true' }

  private async request<T extends ShiprocketResponse>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!this.configured()) throw new Error('SHIPROCKET_NOT_CONFIGURED')
    const token = await this.authenticate()
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(20_000),
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    })
    if (response.status === 401 && retry) {
      this.token = null
      this.tokenExpiresAt = 0
      return this.request<T>(path, init, false)
    }
    const payload = await response.json().catch(() => ({})) as T
    if (!response.ok) throw new Error(`SHIPROCKET_HTTP_${response.status}:${stringValue(payload.message) ?? 'Shiprocket request failed'}`)
    return payload
  }

  private async authenticate() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token
    if (!this.email || !this.password) throw new Error('SHIPROCKET_NOT_CONFIGURED')
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/auth/login`, {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    })
    const payload = await response.json().catch(() => ({})) as ShiprocketResponse
    if (!response.ok || !payload.token) throw new Error(`SHIPROCKET_AUTH_FAILED:${stringValue(payload.message) ?? `HTTP ${response.status}`}`)
    const expiry = Date.parse(String(payload.token_expiry ?? ''))
    this.token = payload.token
    // Shiprocket tokens are long-lived. Refresh a day before a supplied
    // expiry, or after 8 days when the account does not return one.
    this.tokenExpiresAt = Number.isFinite(expiry) ? expiry - 86_400_000 : Date.now() + 8 * 86_400_000
    return this.token
  }

  async serviceability(input: ShippingCheckInput): Promise<ShippingCheckResult> {
    const params = new URLSearchParams({
      pickup_postcode: input.pickupPincode,
      delivery_postcode: input.deliveryPincode,
      weight: String(input.weightKg),
      cod: input.paymentMethod === 'cod' ? '1' : '0',
    })
    if (input.lengthCm) params.set('length', String(input.lengthCm))
    if (input.breadthCm) params.set('breadth', String(input.breadthCm))
    if (input.heightCm) params.set('height', String(input.heightCm))
    if (input.declaredValuePaise) params.set('declared_value', String(input.declaredValuePaise / 100))
    const payload = await this.request<ShiprocketResponse>(`/courier/serviceability/?${params.toString()}`)
    const rows = Array.isArray(payload.data?.available_courier_companies) ? payload.data.available_courier_companies : []
    const couriers: CourierOption[] = rows.map((row: any) => ({
      id: String(row.courier_company_id ?? row.id ?? ''),
      name: String(row.courier_name ?? row.name ?? 'Courier'),
      ratePaise: paiseFromRupees(row.rate ?? row.freight_charge ?? row.total),
      codAvailable: Boolean(row.cod === true || row.cod === 1 || row.cod === '1' || row.cod_available === true),
      estimatedDays: numberOrNull(row.estimated_delivery_days ?? row.etd_days),
      etd: stringValue(row.etd ?? row.expected_delivery_date),
      raw: row,
    })).filter((row) => row.id)
    const codAvailable = input.paymentMethod !== 'cod' || couriers.some((courier) => courier.codAvailable)
    return { provider: 'shiprocket', serviceable: couriers.length > 0, codAvailable, couriers, message: couriers.length ? undefined : 'No Shiprocket courier is serviceable for this address and package.' }
  }

  async serviceable(pincode: string, pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE ?? '') {
    if (!pickupPincode) return false
    const result = await this.serviceability({ pickupPincode, deliveryPincode: pincode, paymentMethod: 'cod', weightKg: Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG ?? 0.5) })
    return result.serviceable
  }

  async createOrder(input: ShiprocketOrderInput): Promise<ShiprocketCreateResult> {
    const [firstName, ...lastNameParts] = input.customer.name.trim().split(/\s+/)
    const payload = await this.request<ShiprocketResponse>('/orders/create/', {
      method: 'POST',
      body: JSON.stringify({
        order_id: input.orderNumber,
        order_date: input.orderDate,
        pickup_location: input.pickupLocation,
        billing_customer_name: firstName,
        billing_last_name: lastNameParts.join(' '),
        billing_address: input.address.line1,
        billing_address_2: [input.address.line2, input.address.landmark].filter(Boolean).join(', '),
        billing_city: input.address.city,
        billing_pincode: input.address.pincode,
        billing_state: input.address.state,
        billing_country: 'India',
        billing_email: input.customer.email ?? '',
        billing_phone: input.customer.phone,
        shipping_is_billing: true,
        order_items: input.items.map((item) => ({ name: item.name, sku: item.sku, units: item.quantity, selling_price: item.sellingPricePaise / 100 })),
        payment_method: input.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        sub_total: input.subtotalPaise / 100,
        length: input.package.lengthCm ?? 1,
        breadth: input.package.breadthCm ?? 1,
        height: input.package.heightCm ?? 1,
        weight: input.package.weightKg,
      }),
    })
    return { providerOrderId: stringValue(payload.order_id ?? payload.data?.order_id), providerShipmentId: stringValue(payload.shipment_id ?? payload.data?.shipment_id), raw: payload }
  }

  async assignAwb(shipmentId: string, courierId: string) { return this.request<ShiprocketResponse>('/courier/assign/awb', { method: 'POST', body: JSON.stringify({ shipment_id: shipmentId, courier_id: courierId }) }) }
  async requestPickup(shipmentId: string) { return this.request<ShiprocketResponse>('/courier/generate/pickup', { method: 'POST', body: JSON.stringify({ shipment_id: [shipmentId] }) }) }
  async generateLabel(shipmentId: string) { return this.request<ShiprocketResponse>('/courier/generate/label', { method: 'POST', body: JSON.stringify({ shipment_id: [shipmentId] }) }) }
  async generateManifest(shipmentId: string) { return this.request<ShiprocketResponse>('/courier/generate/manifest', { method: 'POST', body: JSON.stringify({ shipment_id: [shipmentId] }) }) }
  async cancelOrder(orderIds: string[]) { return this.request<ShiprocketResponse>('/orders/cancel', { method: 'POST', body: JSON.stringify({ ids: orderIds }) }) }
  async trackAwb(awb: string) { return this.request<ShiprocketResponse>(`/courier/track/awb/${encodeURIComponent(awb)}`, { method: 'GET' }) }
}

export const shippingEnvironment = () => ({
  provider: process.env.SHIPPING_PROVIDER === 'shiprocket' ? 'shiprocket' : 'manual',
  configured: Boolean(process.env.SHIPROCKET_API_EMAIL && process.env.SHIPROCKET_API_PASSWORD),
  bookingEnabled: process.env.SHIPROCKET_BOOKING_ENABLED === 'true',
  pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION ?? null,
  pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE ?? null,
})

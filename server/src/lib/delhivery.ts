/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-only Delhivery B2C adapter.
 *
 * Delhivery uses a static account token.  It is intentionally read only from
 * the API process environment; the storefront and admin browser never see it.
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
  provider: 'delhivery' | 'manual'
  serviceable: boolean
  codAvailable: boolean
  couriers: CourierOption[]
  message?: string
  metadata?: Record<string, unknown>
}

export interface DelhiveryOrderInput {
  orderNumber: string
  orderDate: string
  pickupLocation: string
  paymentMethod: ShippingPaymentMethod
  totalPaise: number
  customer: { name: string; email?: string; phone: string }
  address: { line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string }
  items: Array<{ name: string; sku: string; quantity: number; sellingPricePaise: number }>
  package: ShippingPackage
}

export interface DelhiveryCreateResult {
  providerOrderId: string | null
  providerShipmentId: string | null
  raw: unknown
}

type FetchLike = typeof fetch
type ProviderPayload = Record<string, any>

const stringValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const numberOrNull = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}
const paiseFromRupees = (value: unknown) => {
  const number = numberOrNull(value)
  return number === null ? null : Math.round(number * 100)
}
const truthyFlag = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null
  if (value === false || value === 0) return false
  const normalized = String(value).trim().toLowerCase()
  if (['n', 'no', 'false', '0', 'not serviceable', 'nsz'].includes(normalized)) return false
  if (['y', 'yes', 'true', '1', 'serviceable'].includes(normalized)) return true
  return Boolean(value)
}
const pathValue = (value: any, paths: string[]) => {
  for (const path of paths) {
    const result = path.split('.').reduce((current, key) => current?.[key], value)
    if (result !== undefined && result !== null && result !== '') return result
  }
  return undefined
}

const apiBaseFromEnvironment = () => {
  if (process.env.DELHIVERY_API_BASE_URL) return process.env.DELHIVERY_API_BASE_URL
  return process.env.DELHIVERY_ENV === 'staging' ? 'https://staging-express.delhivery.com' : 'https://track.delhivery.com'
}

export class DelhiveryAdapter {
  readonly name = 'delhivery' as const
  private readonly token: string
  private readonly baseUrl: string
  private readonly fetcher: FetchLike

  constructor(
    token = process.env.DELHIVERY_API_TOKEN ?? '',
    baseUrl = apiBaseFromEnvironment(),
    fetcher: FetchLike = fetch,
  ) {
    this.token = token
    this.baseUrl = baseUrl
    this.fetcher = fetcher
  }

  configured() { return Boolean(this.token) }
  bookingEnabled() { return process.env.DELHIVERY_BOOKING_ENABLED === 'true' }
  get apiBaseUrl() { return this.baseUrl }

  private async request<T extends ProviderPayload | Array<any> = ProviderPayload>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.configured()) throw new Error('DELHIVERY_NOT_CONFIGURED')
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(20_000),
      headers: { accept: 'application/json', authorization: `Token ${this.token}`, ...(init.headers ?? {}) },
    })
    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : await response.text().catch(() => '')
    if (!response.ok) {
      const message = typeof payload === 'object' ? stringValue((payload as any).error ?? (payload as any).message ?? (payload as any).detail) : stringValue(payload)
      throw new Error(`DELHIVERY_HTTP_${response.status}:${message ?? 'Delhivery request failed'}`)
    }
    return payload as T
  }

  private chargeableWeightGrams(input: ShippingPackage) {
    const dead = Math.max(1, Math.ceil(input.weightKg * 1000))
    const volumetric = input.lengthCm && input.breadthCm && input.heightCm
      ? Math.ceil((input.lengthCm * input.breadthCm * input.heightCm) / 5)
      : 0
    return Math.max(dead, volumetric)
  }

  async calculateCharge(input: ShippingCheckInput) {
    const params = new URLSearchParams({
      md: process.env.DELHIVERY_BILLING_MODE === 'S' ? 'S' : 'E',
      cgm: String(this.chargeableWeightGrams(input)),
      o_pin: input.pickupPincode,
      d_pin: input.deliveryPincode,
      ss: 'Delivered',
      pt: input.paymentMethod === 'cod' ? 'COD' : 'Pre-paid',
    })
    try {
      const payload = await this.request<ProviderPayload>(`/api/kinko/v1/invoice/charges/.json?${params.toString()}`)
      const row = Array.isArray(payload) ? payload[0] : payload
      const amountPaise = paiseFromRupees(pathValue(row, ['total_amount', 'total', 'amount', 'gross_amount', 'data.total_amount']))
      return { amountPaise, raw: payload, approximate: true }
    } catch (error) {
      // Serviceability should remain useful when an account does not have the
      // optional rate endpoint enabled.  Booking still requires a real quote.
      return { amountPaise: null, raw: { error: String(error) }, approximate: true }
    }
  }

  async serviceability(input: ShippingCheckInput): Promise<ShippingCheckResult> {
    const params = new URLSearchParams({ filter_codes: input.deliveryPincode })
    const payload = await this.request<ProviderPayload | any[]>(`/c/api/pin-codes/json/?${params.toString()}`)
    const rows = Array.isArray(payload)
      ? payload
      : (payload as any)?.delivery_codes ?? (payload as any)?.data ?? (payload as any)?.pin_codes ?? []
    const row = Array.isArray(rows) ? rows[0] : rows
    const postal = row?.postal_code ?? row ?? {}
    const explicitDelivery = truthyFlag(pathValue(postal, ['delivery', 'delivery_available', 'is_delivery', 'serviceable', 'status']))
    const serviceable = explicitDelivery !== false && Boolean(row || postal)
    const codFlag = truthyFlag(pathValue(postal, ['cash', 'cod', 'cod_available', 'cash_on_delivery']))
    const codAvailable = codFlag !== false
    const charge = serviceable ? await this.calculateCharge(input) : { amountPaise: null, raw: null, approximate: true }
    const courier: CourierOption = {
      id: 'delhivery',
      name: 'Delhivery',
      ratePaise: charge.amountPaise,
      codAvailable,
      estimatedDays: numberOrNull(pathValue(postal, ['estimated_days', 'transit_days', 'etd_days', 'expected_delivery_days'])),
      etd: stringValue(pathValue(postal, ['etd', 'expected_delivery_date', 'delivery_date'])),
      raw: { pin: postal, charge: charge.raw },
    }
    const paymentAllowed = input.paymentMethod !== 'cod' || codAvailable
    return {
      provider: 'delhivery',
      serviceable: serviceable && paymentAllowed,
      codAvailable,
      couriers: serviceable ? [courier] : [],
      message: !serviceable ? 'Delhivery does not service this pincode.' : !paymentAllowed ? 'Delhivery COD is not available for this pincode.' : charge.amountPaise === null ? 'Delhivery serviceability is available; rate quote is not available for this account.' : undefined,
      metadata: { chargeApproximate: charge.approximate, chargeResponse: charge.raw },
    }
  }

  async serviceable(pincode: string, pickupPincode = process.env.DELHIVERY_PICKUP_PINCODE ?? '') {
    if (!pickupPincode || !pincode) return false
    const result = await this.serviceability({ pickupPincode, deliveryPincode: pincode, paymentMethod: 'prepaid', weightKg: Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG ?? 0.5) })
    return result.serviceable
  }

  async createOrder(input: DelhiveryOrderInput): Promise<DelhiveryCreateResult> {
    const sellerName = process.env.DELHIVERY_SELLER_NAME ?? ''
    const sellerAddress = process.env.DELHIVERY_SELLER_ADDRESS ?? ''
    const sellerPincode = process.env.DELHIVERY_SELLER_PINCODE ?? process.env.DELHIVERY_PICKUP_PINCODE ?? ''
    const missing = ['DELHIVERY_CLIENT_NAME', 'DELHIVERY_PICKUP_LOCATION', 'DELHIVERY_PICKUP_PINCODE', 'DELHIVERY_SELLER_GST_TIN', 'DELHIVERY_DEFAULT_HSN_CODE'].filter((key) => !process.env[key])
    if (missing.length) throw new Error(`DELHIVERY_BOOKING_NOT_CONFIGURED:${missing.join(',')}`)
    const shipment: Record<string, unknown> = {
      order: input.orderNumber,
      order_date: input.orderDate,
      name: input.customer.name,
      add: [input.address.line1, input.address.line2, input.address.landmark].filter(Boolean).join(', '),
      pin: input.address.pincode,
      city: input.address.city,
      state: input.address.state,
      country: 'India',
      phone: input.customer.phone,
      email: input.customer.email ?? '',
      payment_mode: input.paymentMethod === 'cod' ? 'COD' : 'Pre-paid',
      products_desc: input.items.map((item) => `${item.name} (${item.sku}) x${item.quantity}`).join(', '),
      quantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
      total_amount: input.totalPaise / 100,
      cod_amount: input.paymentMethod === 'cod' ? input.totalPaise / 100 : 0,
      client: process.env.DELHIVERY_CLIENT_NAME,
      pickup_location: input.pickupLocation,
      seller_name: sellerName,
      seller_add: sellerAddress,
      seller_pin: sellerPincode,
      seller_gst_tin: process.env.DELHIVERY_SELLER_GST_TIN,
      hsn_code: process.env.DELHIVERY_DEFAULT_HSN_CODE,
      weight: this.chargeableWeightGrams(input.package),
      shipment_width: input.package.breadthCm ?? 1,
      shipment_height: input.package.heightCm ?? 1,
      shipment_length: input.package.lengthCm ?? 1,
    }
    const body = new URLSearchParams({ format: 'json', data: JSON.stringify({ shipments: [shipment], pickup_location: { name: input.pickupLocation } }) })
    const payload = await this.request<ProviderPayload>('/api/cmu/create.json', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    const first = (payload as any)?.packages?.[0] ?? (payload as any)?.data?.packages?.[0] ?? (payload as any)?.shipment ?? (payload as any)?.data?.shipment ?? {}
    const awb = stringValue(pathValue(first, ['waybill', 'awb', 'awb_code'])) ?? stringValue(pathValue(payload, ['waybill', 'awb', 'awb_code', 'data.waybill', 'data.awb']))
    const providerOrderId = stringValue(pathValue(payload, ['order', 'order_id', 'data.order', 'data.order_id'])) ?? input.orderNumber
    return { providerOrderId, providerShipmentId: awb, raw: payload }
  }

  /** Delhivery allocates the waybill during order creation; kept for the
   * existing booking flow and returns a normalized AWB response without a
   * second network call. */
  async assignAwb(waybill: string, courierId?: string) { void courierId; return { awb_code: waybill, courier_name: 'Delhivery', status: 'awb_assigned' } }

  async requestPickup(shipmentId: string) {
    void shipmentId
    const pickupDate = new Date().toISOString().slice(0, 10)
    const body = new URLSearchParams({ pickup_time: process.env.DELHIVERY_PICKUP_TIME ?? '16:00:00', pickup_date: pickupDate, pickup_location: process.env.DELHIVERY_PICKUP_LOCATION ?? '', expected_package_count: '1' })
    return this.request<ProviderPayload>('/fm/request/new/', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
  }

  async generateLabel(waybill: string) {
    if (!this.configured()) throw new Error('DELHIVERY_NOT_CONFIGURED')
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}&pdf=True`, {
      method: 'GET',
      signal: AbortSignal.timeout(20_000),
      headers: { accept: 'application/json, application/pdf', authorization: `Token ${this.token}` },
    })
    const contentType = response.headers.get('content-type') ?? ''
    if (!response.ok) throw new Error(`DELHIVERY_HTTP_${response.status}:Unable to generate packing slip`)
    if (contentType.includes('json')) return response.json() as Promise<ProviderPayload>
    const bytes = Buffer.from(await response.arrayBuffer())
    return { label_url: `data:${contentType || 'application/pdf'};base64,${bytes.toString('base64')}`, content_type: contentType || 'application/pdf' }
  }

  async generateManifest(shipmentId: string): Promise<never> {
    void shipmentId
    throw new Error('DELHIVERY_MANIFEST_UNSUPPORTED:Delhivery uses packing slips and pickup requests instead of a separate manifest endpoint.')
  }

  async cancelOrder(ids: string[]) {
    const waybill = ids.find(Boolean)
    if (!waybill) throw new Error('DELHIVERY_WAYBILL_REQUIRED')
    return this.request<ProviderPayload>('/api/p/edit', { method: 'POST', body: JSON.stringify({ waybill, cancellation: 'true' }), headers: { 'content-type': 'application/json' } })
  }

  async trackAwb(awb: string, reference?: string) {
    const params = new URLSearchParams({ waybill: awb })
    if (reference) params.set('ref_ids', reference)
    return this.request<ProviderPayload>(`/api/v1/packages/json/?${params.toString()}`, { method: 'GET' })
  }
}

export const shippingEnvironment = () => {
  const provider = process.env.SHIPPING_PROVIDER === 'delhivery' ? 'delhivery' : 'manual'
  const required = ['DELHIVERY_API_TOKEN', 'DELHIVERY_CLIENT_NAME', 'DELHIVERY_PICKUP_LOCATION', 'DELHIVERY_PICKUP_PINCODE', 'DELHIVERY_SELLER_GST_TIN', 'DELHIVERY_DEFAULT_HSN_CODE']
  return {
    provider,
    configured: Boolean(process.env.DELHIVERY_API_TOKEN),
    bookingEnabled: provider === 'delhivery' && process.env.DELHIVERY_BOOKING_ENABLED === 'true',
    pickupLocation: process.env.DELHIVERY_PICKUP_LOCATION ?? null,
    pickupPincode: process.env.DELHIVERY_PICKUP_PINCODE ?? null,
    apiBaseUrl: provider === 'delhivery' ? apiBaseFromEnvironment() : null,
    environment: process.env.DELHIVERY_ENV === 'staging' ? 'staging' : 'production',
    clientName: process.env.DELHIVERY_CLIENT_NAME ?? null,
    missingConfig: provider === 'delhivery' ? required.filter((key) => !process.env[key]) : [],
    rateCalculation: provider === 'delhivery',
  }
}

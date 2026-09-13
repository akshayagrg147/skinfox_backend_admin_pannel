/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import Fastify, { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { AffiliateRedemptionStatus, AffiliateStatus, AffiliateWalletEntryType, Prisma, PublicationStatus, PurchaseState, OrderStatus, PaymentStatus, WaitlistStatus, AdminRole } from '@prisma/client'
import { z, ZodError } from 'zod'
import { authenticator } from 'otplib'
import { prisma } from './lib/prisma.js'
import { ApiError, forbidden, notFound, validationError } from './lib/errors.js'
import { decryptSecret, encryptSecret, hashPassword, hashToken, randomToken, safeEqual, signHmac, verifyPassword } from './lib/crypto.js'
import { affiliateOtpConfig, affiliateStaticOtpIsConfigured, customerSessionTtlDays, hashAffiliateOtp, normalizeIndianPhone } from './lib/customerAuth.js'
import { firebaseAdminIsConfigured, getFirebaseUserRecord, verifyFirebaseIdToken } from './lib/firebaseAdmin.js'
import { calculateCart, isValidPincode } from './lib/pricing.js'
import { affiliateCommissionPaise, affiliateReferralCode, isValidPan } from './lib/affiliate.js'
import { productMrpPaise, productPricePaise, scoreCareFinderProducts, type CareFinderAnswer } from './lib/careFinder.js'
import { analysePhoto, photoAnalysisConfigured, photoNote } from './lib/photoAnalysis.js'
import { PHOTO_DAILY_LIMIT, PHOTO_DEVICE_COOKIE, checkPhotoQuota, newDeviceId, recordPhotoUse } from './lib/photoQuota.js'
import { LocalEmailAdapter, LocalStorageAdapter, ManualShippingAdapter, RazorpayAdapter } from './lib/providers.js'
import { ShiprocketAdapter, shippingEnvironment, type ShippingPackage } from './lib/shiprocket.js'
import { productImageAssetSchema, productMediaInputSchema } from './lib/productAssets.js'
import { calculateWaitlistDepositPaise, createWaitlistId, parseStoredWaitlistSettings, waitlistDefaultsFromEnv, waitlistResetConfirmationSchema, waitlistSettingsSchema, type WaitlistSettings } from './lib/waitlistConfig.js'
import { calculateWaitlistOrderPricing, type WaitlistPricingMode } from './lib/waitlistOrders.js'
import { adjustInventory, inventoryHistory, inventoryWorkspace } from './lib/inventoryWorkspace.js'

const secureCookies = () => process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : process.env.COOKIE_SECURE === 'true'
const defaultWaitlistSettings = waitlistDefaultsFromEnv()
let activeWaitlistSettings: WaitlistSettings = defaultWaitlistSettings

const productCreateSchema = z.object({
  name: z.string().min(2), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), subtitle: z.string().min(2), type: z.string().min(1), packaging: z.string().min(1), category: z.string().min(1), concern: z.string().min(1), concerns: z.array(z.string()).default([]), benefit: z.string().min(2), description: z.string().min(2), pricePaise: z.number().int().positive().nullable().default(null), mrpPaise: z.number().int().positive().nullable().default(null), size: z.string().min(1), usage: z.string().min(1), routineStep: z.string().min(1), highlights: z.array(z.string()).default([]), color: z.string().default('#f5f0eb'), accent: z.string().default('#18243b'), tint: z.string().default('#eee3d4'), image: productImageAssetSchema, storyImage: productImageAssetSchema.nullable().optional(), imageAlt: z.string().min(12), imagePosition: z.string().default('50% 50%'), imageScale: z.number().positive().max(2).default(1), badge: z.string().nullable().optional(), purchaseState: z.nativeEnum(PurchaseState).default(PurchaseState.coming_soon), status: z.nativeEnum(PublicationStatus).default(PublicationStatus.draft), media: z.array(productMediaInputSchema).default([]), sku: z.string().optional() }).superRefine((value, ctx) => { if (value.pricePaise !== null && value.mrpPaise !== null && value.mrpPaise < value.pricePaise) ctx.addIssue({ code: 'custom', path: ['mrpPaise'], message: 'MRP cannot be lower than selling price' }); if (value.purchaseState === PurchaseState.available && value.pricePaise === null) ctx.addIssue({ code: 'custom', path: ['pricePaise'], message: 'Available products require a selling price' }) })
const productPatchSchema = z.object({
  name: z.string().min(2).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), subtitle: z.string().min(2).optional(), type: z.string().min(1).optional(), packaging: z.string().min(1).optional(), category: z.string().min(1).optional(), concern: z.string().min(1).optional(), concerns: z.array(z.string()).optional(), benefit: z.string().min(2).optional(), description: z.string().min(2).optional(), pricePaise: z.number().int().positive().nullable().optional(), mrpPaise: z.number().int().positive().nullable().optional(), size: z.string().min(1).optional(), usage: z.string().min(1).optional(), routineStep: z.string().min(1).optional(), highlights: z.array(z.string()).optional(), color: z.string().optional(), accent: z.string().optional(), tint: z.string().optional(), image: productImageAssetSchema.optional(), storyImage: productImageAssetSchema.nullable().optional(), imageAlt: z.string().min(12).optional(), imagePosition: z.string().optional(), imageScale: z.number().positive().max(2).optional(), badge: z.string().nullable().optional(), purchaseState: z.nativeEnum(PurchaseState).optional(), status: z.nativeEnum(PublicationStatus).optional(), media: z.array(productMediaInputSchema).optional(), sku: z.string().optional(),
}).superRefine((value, ctx) => { if (value.pricePaise !== undefined && value.mrpPaise !== undefined && value.pricePaise !== null && value.mrpPaise !== null && value.mrpPaise < value.pricePaise) ctx.addIssue({ code: 'custom', path: ['mrpPaise'], message: 'MRP cannot be lower than selling price' }); if (value.purchaseState === PurchaseState.available && value.pricePaise === null) ctx.addIssue({ code: 'custom', path: ['pricePaise'], message: 'Available products require a selling price' }) })
const cartItemSchema = z.object({ productId: z.string().min(1), variantId: z.string().optional(), quantity: z.number().int().min(1).max(50) })
const variantInputSchema = z.object({ sku: z.string().min(2), name: z.string().min(1), size: z.string().min(1), pricePaise: z.number().int().positive().nullable(), mrpPaise: z.number().int().positive().nullable(), purchaseState: z.nativeEnum(PurchaseState) })
const variantPatchSchema = z.object({ sku: z.string().min(2).optional(), name: z.string().min(1).optional(), size: z.string().min(1).optional(), pricePaise: z.number().int().positive().nullable().optional(), mrpPaise: z.number().int().positive().nullable().optional(), purchaseState: z.nativeEnum(PurchaseState).optional() })
const productSnapshotFields = ['slug', 'name', 'subtitle', 'type', 'packaging', 'category', 'categoryId', 'concern', 'concerns', 'benefit', 'description', 'pricePaise', 'mrpPaise', 'size', 'usage', 'routineStep', 'highlights', 'color', 'accent', 'tint', 'image', 'storyImage', 'imageAlt', 'imagePosition', 'imageScale', 'badge', 'purchaseState', 'status', 'publishedAt', 'scheduledAt', 'archivedAt'] as const
const mediaSnapshotFields = ['type', 'src', 'mobileSrc', 'poster', 'alt', 'sortOrder', 'width', 'height', 'aspectRatio', 'fitMode', 'objectPosition', 'imageScale', 'focalPointX', 'focalPointY', 'mediaAssetId'] as const
const productSnapshot = (product: any) => ({ ...Object.fromEntries(productSnapshotFields.filter((key) => product[key] !== undefined).map((key) => [key, product[key]])), media: Array.isArray(product.media) ? product.media.map((media: any) => Object.fromEntries(mediaSnapshotFields.filter((key) => media[key] !== undefined).map((key) => [key, media[key]]))) : [] })
const deliveryPhoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/)
const checkoutSchema = z.object({ fullName: z.string().min(2), email: z.union([z.string().email(), z.literal('')]).optional().transform((value) => value || undefined), phone: deliveryPhoneSchema, addressId: z.string().optional(), addressLine1: z.string().min(5), addressLine2: z.string().optional(), landmark: z.string().optional(), city: z.string().min(2), state: z.string().min(2), pincode: z.string().regex(/^[1-9]\d{5}$/), saveAddress: z.boolean().default(true), saveAsDefault: z.boolean().default(false), billingSameAsShipping: z.boolean().default(true), marketingConsent: z.boolean().default(false), paymentMethod: z.literal('cod').default('cod'), couponCode: z.string().optional() })
const shippingPackageSchema = z.object({ weightGrams: z.number().int().min(1).max(30_000), lengthCm: z.number().positive().max(200).optional(), breadthCm: z.number().positive().max(200).optional(), heightCm: z.number().positive().max(200).optional(), declaredValuePaise: z.number().int().nonnegative().optional() })
const addressSchema = z.object({ label: z.string().trim().min(2).max(30).default('Home'), fullName: z.string().trim().min(2).max(120), phone: deliveryPhoneSchema, addressLine1: z.string().trim().min(5).max(200), addressLine2: z.string().trim().max(200).optional(), landmark: z.string().trim().max(120).optional(), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), pincode: z.string().regex(/^[1-9]\d{5}$/), isDefault: z.boolean().default(false) })
const customerProfileSchema = z.object({ fullName: z.string().trim().min(2).max(120), phone: deliveryPhoneSchema.nullable().optional() })
const rolePermissions: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ['*'], CATALOG_MANAGER: ['catalog:read', 'catalog:write', 'inventory:read', 'inventory:write', 'content:read'], CONTENT_EDITOR: ['content:read', 'content:write', 'catalog:read'], ORDER_MANAGER: ['orders:read', 'orders:write', 'customers:read', 'catalog:read'], SUPPORT_AGENT: ['orders:read', 'customers:read', 'customers:write', 'leads:read'], ANALYST: ['analytics:read', 'dashboard:read'],
}
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}
const sha256Json = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')
const hidePriceReferences = (value: string) => value.replace(/MRP\s*₹\s*[\d,.]+/gi, 'MRP detail')
const humaniseOrderStatus = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const waitlistPricesHidden = () => activeWaitlistSettings.enabled && ['waitlist', 'founder_reveal'].includes(activeWaitlistSettings.stage)
const publicProduct = (product: any, revealCommercials = false) => ({
  ...product,
  pricePaise: revealCommercials || !waitlistPricesHidden() ? product.pricePaise ?? null : null,
  mrpPaise: revealCommercials || !waitlistPricesHidden() ? product.mrpPaise ?? null : product.mrpPaise ?? activeWaitlistSettings.regularPricePaise,
  purchaseState: revealCommercials || !waitlistPricesHidden() ? product.purchaseState : PurchaseState.coming_soon,
  highlights: revealCommercials || !waitlistPricesHidden() ? product.highlights : product.highlights?.map((item: string) => hidePriceReferences(item)),
  variants: product.variants?.map((variant: any) => {
    const { inventory: _inventory, ...safeVariant } = variant
    return revealCommercials || !waitlistPricesHidden() ? safeVariant : { ...safeVariant, pricePaise: null, mrpPaise: safeVariant.mrpPaise ?? activeWaitlistSettings.regularPricePaise, purchaseState: PurchaseState.coming_soon }
  }),
  media: [...(product.media ?? [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((media: any) => ({ ...media, alt: revealCommercials || !waitlistPricesHidden() ? media.alt : hidePriceReferences(media.alt), src: media.src, mobileSrc: media.mobileSrc ?? undefined })),
})
const publicCollection = (collection: any) => ({
  ...collection,
  products: collection.products?.map((entry: any) => ({ ...entry, product: publicProduct(entry.product) })),
})
const sensitiveSettingPattern = /(secret|password|token|api[_-]?key|access[_-]?key|private[_-]?key)/i
const containsSensitiveSetting = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(containsSensitiveSetting)
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => sensitiveSettingPattern.test(key) || containsSensitiveSetting(item))
}
const redactSensitiveSettings = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactSensitiveSettings)
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitiveSettingPattern.test(key) ? '[configured in server environment]' : redactSensitiveSettings(item)]))
}
const maskCustomer = (customer: any) => customer ? { ...customer, email: typeof customer.email === 'string' ? customer.email.replace(/(^.).*(@.*$)/, '$1***$2') : customer.email, phone: typeof customer.phone === 'string' ? `${customer.phone.slice(0, 2)}******${customer.phone.slice(-2)}` : customer.phone } : customer

// Fastify can infer OpenAPI routes when handlers carry JSON schemas. The
// application intentionally uses Zod at the boundary instead, so we publish a
// lightweight route catalogue here. It keeps /api/docs useful for integrators
// while the runtime validation remains the source of truth.
const openApiOperation = (summary: string, method: string) => ({
  summary,
  operationId: `${method}_${summary.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
  tags: [summary.startsWith('Admin') ? 'Admin' : 'Storefront'],
  responses: {
    '200': { description: 'JSON response' },
    '400': { description: 'Validation error' },
    '401': { description: 'Authentication required' },
  },
})
const openApiPaths: Record<string, Record<string, unknown>> = {}
const documentPath = (path: string, methods: string[], summary: string) => {
  openApiPaths[path] = Object.fromEntries(methods.map((method) => [method, openApiOperation(summary, method)]))
}
[
  ['/health', ['get'], 'Health check'], ['/ready', ['get'], 'Readiness check'], ['/storefront/bootstrap', ['get'], 'Storefront bootstrap'],
  ['/products', ['get'], 'List products'], ['/products/{id}', ['get'], 'Get product'], ['/products/{id}/availability', ['get'], 'Check product availability'],
  ['/categories', ['get'], 'List categories'], ['/concerns', ['get'], 'List concerns'], ['/collections', ['get'], 'List collections'], ['/collections/{slug}', ['get'], 'Get collection'], ['/search/suggestions', ['get'], 'Search suggestions'],
  ['/campaign-slides', ['get'], 'List campaign slides'], ['/faqs', ['get'], 'List FAQs'], ['/pages/home', ['get'], 'Get home page'], ['/pages/{slug}', ['get'], 'Get page'], ['/navigation/{location}', ['get'], 'Get navigation'],
  ['/care-finder', ['get'], 'Get care finder'], ['/care-finder/recommendations', ['post'], 'Get care recommendations'], ['/care-finder/events', ['post'], 'Record care finder event'], ['/care-finder/photo-analysis', ['get', 'post'], 'Care finder photo quota or analysis'],
  ['/carts', ['post'], 'Create cart'], ['/carts/{cartId}', ['get', 'delete'], 'Get or delete cart'], ['/carts/{cartId}/items', ['post'], 'Add cart item'], ['/carts/{cartId}/items/{itemId}', ['patch', 'delete'], 'Update or remove cart item'], ['/carts/{cartId}/apply-coupon', ['post'], 'Apply coupon'], ['/carts/{cartId}/coupon', ['delete'], 'Remove coupon'],
  ['/customer/auth/firebase', ['post'], 'Exchange Firebase customer identity'], ['/customer/auth/me', ['get'], 'Get current customer'], ['/customer/auth/profile', ['patch'], 'Update customer profile'], ['/customer/auth/logout', ['post'], 'Log out customer'], ['/customer/addresses', ['get', 'post'], 'List or save customer addresses'], ['/customer/addresses/{id}', ['patch', 'delete'], 'Update or delete customer address'], ['/customer/orders', ['get'], 'List customer orders'], ['/customer/orders/{publicToken}', ['get'], 'Get customer order'],
  ['/affiliate/applications', ['post'], 'Submit affiliate application'], ['/affiliate/auth/request-otp', ['post'], 'Request affiliate OTP'], ['/affiliate/auth/verify-otp', ['post'], 'Verify affiliate OTP'], ['/affiliate/auth/me', ['get'], 'Get current affiliate'], ['/affiliate/auth/logout', ['post'], 'Log out affiliate'], ['/affiliate/referrals/track', ['post'], 'Track affiliate referral'], ['/affiliate/dashboard', ['get'], 'Get affiliate dashboard'], ['/affiliate/wallet/redemptions', ['post'], 'Request affiliate wallet redemption'],
  ['/shipping/serviceability', ['get'], 'Check shipping serviceability'], ['/shipping/webhook', ['post'], 'Receive Shiprocket shipment webhook'], ['/checkout/quote', ['post'], 'Calculate checkout quote'], ['/checkout/sessions', ['post'], 'Create checkout session'], ['/checkout/sessions/{id}', ['get'], 'Get checkout session'], ['/checkout/sessions/{id}/payment-order', ['post'], 'Create payment order'], ['/checkout/sessions/{id}/confirm-cod', ['post'], 'Confirm cash on delivery'],
  ['/payments/razorpay/verify', ['post'], 'Verify Razorpay payment'], ['/webhooks/payments/razorpay', ['post'], 'Receive Razorpay webhook'], ['/payments/{publicToken}/status', ['get'], 'Get payment status'], ['/orders/{publicToken}', ['get'], 'Get public order'], ['/orders/{publicToken}/tracking', ['get'], 'Get order tracking'], ['/orders/{publicToken}/cancel-request', ['post'], 'Request order cancellation'], ['/orders/{publicToken}/return-request', ['post'], 'Request return'],
  ['/launch-interest', ['post'], 'Capture launch interest'], ['/waitlist/config', ['get'], 'Get priority waitlist configuration'], ['/waitlist/reservations', ['post'], 'Create waitlist reservation'], ['/waitlist/reservations/{publicToken}/verify', ['post'], 'Verify waitlist payment'], ['/waitlist/reservations/{publicToken}/cancel', ['post'], 'Explain non-refundable waitlist policy'], ['/customer/waitlist', ['get'], 'List customer waitlist reservations'], ['/customer/orders/{publicToken}/address', ['post'], 'Assign address to converted waitlist order'], ['/customer/orders/{publicToken}/balance-quote', ['get'], 'Quote converted waitlist balance'], ['/customer/orders/{publicToken}/payment-status', ['get'], 'Poll converted waitlist payment status'], ['/customer/orders/{publicToken}/balance-order', ['post'], 'Create converted waitlist balance payment'], ['/customer/orders/{publicToken}/balance-verify', ['post'], 'Verify converted waitlist balance payment'], ['/newsletter/subscriptions', ['post'], 'Subscribe to newsletter'], ['/newsletter/confirm', ['post'], 'Confirm newsletter subscription'], ['/newsletter/subscriptions/{token}', ['delete'], 'Unsubscribe from newsletter'], ['/contact', ['post'], 'Submit contact form'], ['/events', ['post'], 'Record analytics event'], ['/events/batch', ['post'], 'Record analytics events'],
  ['/admin/auth/login', ['post'], 'Admin login'], ['/admin/auth/logout', ['post'], 'Admin logout'], ['/admin/auth/refresh', ['post'], 'Refresh admin session'], ['/admin/auth/me', ['get'], 'Get current admin'], ['/admin/auth/forgot-password', ['post'], 'Start password reset'], ['/admin/auth/reset-password', ['post'], 'Reset password'], ['/admin/auth/accept-invitation', ['post'], 'Accept admin invitation'], ['/admin/auth/mfa/setup', ['post'], 'Set up MFA'], ['/admin/auth/mfa/verify', ['post'], 'Verify MFA'], ['/admin/auth/logout-all-sessions', ['post'], 'Revoke all admin sessions'], ['/admin/auth/sessions', ['get'], 'List admin sessions'], ['/admin/auth/sessions/{sessionId}', ['delete'], 'Revoke admin session'],
  ['/admin/dashboard/{metric}', ['get'], 'Admin dashboard metric'], ['/admin/waitlist-settings', ['get', 'patch'], 'Admin priority waitlist settings'], ['/admin/waitlist-reservations', ['get'], 'Admin priority waitlist'], ['/admin/waitlist/conversion-preview', ['get'], 'Preview waitlist order conversion'], ['/admin/waitlist/reveal', ['post'], 'Reveal waitlist pricing and prepare orders'], ['/admin/waitlist/conversion-progress', ['get'], 'Get waitlist conversion progress'], ['/admin/waitlist/reset', ['post'], 'Reset priority waitlist data'], ['/admin/products', ['get', 'post'], 'Admin product list or create'], ['/admin/products/{id}', ['get', 'patch', 'delete'], 'Admin product detail'], ['/admin/products/{id}/publish', ['post'], 'Publish product'], ['/admin/products/{id}/unpublish', ['post'], 'Unpublish product'], ['/admin/products/{id}/revisions', ['get'], 'List product revisions'], ['/admin/products/{id}/restore', ['post'], 'Restore product revision'], ['/admin/products/bulk', ['post'], 'Bulk update products'], ['/admin/products/import', ['post'], 'Import products'], ['/admin/products/export', ['get'], 'Export products'],
  ...['submit-review', 'approve', 'schedule', 'archive'].map((action) => [`/admin/products/{id}/${action}`, ['post'], `Product ${action}`]), ['/admin/products/{id}/revisions/{revisionId}/restore', ['post'], 'Restore product revision snapshot'],
  ['/admin/products/{productId}/variants', ['get', 'post'], 'Manage product variants'], ['/admin/products/{productId}/variants/{variantId}', ['patch', 'delete'], 'Update or delete variant'], ['/admin/products/{productId}/media', ['get', 'post'], 'Manage product media'], ['/admin/products/{productId}/media/{mediaId}', ['patch', 'delete'], 'Update or delete product media'], ['/admin/products/{productId}/media/reorder', ['post'], 'Reorder product media'],
  ['/admin/inventory', ['get'], 'List inventory'], ['/admin/inventory/low-stock', ['get'], 'List low stock inventory'], ['/admin/inventory/{variantId}', ['get'], 'Get variant inventory'], ['/admin/inventory/adjustments', ['post'], 'Adjust inventory'], ['/admin/inventory/bulk-adjustments', ['post'], 'Bulk adjust inventory'], ['/admin/inventory/history', ['get'], 'Inventory movement history'], ['/admin/inventory/import', ['post'], 'Import inventory'], ['/admin/inventory/export', ['get'], 'Export inventory'],
  ['/admin/shipping/status', ['get'], 'Get shipping provider status'], ['/admin/shipping/serviceability', ['post'], 'Test shipping serviceability'], ['/admin/orders', ['get'], 'List admin orders'], ['/admin/orders/{id}', ['get', 'patch'], 'Admin order detail'], ['/admin/orders/{id}/shipment/quote', ['post'], 'Get courier quotes'], ['/admin/orders/{id}/shipment/book', ['post'], 'Book Shiprocket shipment'], ['/admin/orders/{id}/shipment/pickup', ['post'], 'Request shipment pickup'], ['/admin/orders/{id}/shipment/label', ['post'], 'Generate shipment label'], ['/admin/orders/{id}/shipment/manifest', ['post'], 'Generate shipment manifest'], ['/admin/orders/{id}/shipment/cancel', ['post'], 'Cancel shipment'], ['/admin/orders/{id}/shipment/refresh', ['post'], 'Refresh shipment tracking'], ...['confirm', 'process', 'pack', 'fulfill', 'ship', 'deliver', 'cancel'].map((action) => [`/admin/orders/{id}/${action}`, ['post'], `Order ${action}`]), ['/admin/orders/{id}/{action}', ['post'], 'Transition order'], ['/admin/orders/{id}/refund', ['post'], 'Refund order'], ['/admin/orders/{id}/notes', ['post'], 'Add order note'], ['/admin/orders/{id}/resend-confirmation', ['post'], 'Resend order confirmation'], ['/admin/orders/{id}/invoice', ['get'], 'Get order invoice'], ['/admin/orders/export', ['get'], 'Export orders'],
  ['/admin/customers', ['get'], 'List customers'], ['/admin/customers/{id}', ['get', 'patch'], 'Customer detail'], ['/admin/customers/{id}/orders', ['get'], 'Customer orders'], ['/admin/customers/{id}/notes', ['post'], 'Add customer note'], ['/admin/customers/{id}/anonymize', ['post'], 'Anonymize customer'], ['/admin/customers/{id}/export-data', ['post'], 'Export customer data'], ['/admin/customers/{id}/consent', ['patch'], 'Update customer consent'],
  ['/admin/care-finder', ['get'], 'Get care finder configuration'], ['/admin/care-finder/{id}', ['patch'], 'Update care finder configuration'],
  ['/admin/affiliates', ['get'], 'List affiliate applications'], ['/admin/affiliates/{id}/status', ['post'], 'Review affiliate application'], ['/admin/affiliate-redemptions', ['get'], 'List affiliate redemptions'], ['/admin/affiliate-redemptions/{id}/review', ['post'], 'Review affiliate redemption'],
  ['/admin/media', ['get'], 'List media assets'], ['/admin/media/presign', ['post'], 'Presign media upload'], ['/admin/media/complete', ['post'], 'Complete media upload'], ['/admin/media/{id}', ['patch', 'delete'], 'Update or delete media asset'], ['/admin/media/{id}/archive', ['post'], 'Archive media asset'], ['/admin/media/{id}/references', ['get'], 'List media references'],
  ['/admin/care-finder/preview', ['post'], 'Preview care finder'], ['/admin/care-finder/coverage', ['get'], 'Check care finder coverage'], ['/admin/users', ['get'], 'List admin users'], ['/admin/users/invite', ['post'], 'Invite admin user'], ['/admin/users/{id}', ['get', 'patch'], 'Admin user detail'], ['/admin/users/{id}/suspend', ['post'], 'Suspend admin user'], ['/admin/users/{id}/activate', ['post'], 'Activate admin user'], ['/admin/users/{id}/{action}', ['post'], 'Activate or suspend admin user'], ['/admin/users/{id}/revoke-sessions', ['post'], 'Revoke user sessions'], ['/admin/roles', ['get', 'post'], 'List or create roles'], ['/admin/roles/{id}', ['patch', 'delete'], 'Update or delete role'], ['/admin/permissions', ['get'], 'List permissions'], ['/admin/audit-logs', ['get'], 'List audit logs'], ['/admin/audit-logs/{id}', ['get'], 'Get audit log'], ['/admin/audit-logs/export', ['get'], 'Export audit logs'],
  ['/admin/serviceable-pincodes/import', ['post'], 'Import serviceable pincodes'], ['/admin/serviceable-pincodes/export', ['get'], 'Export serviceable pincodes'],
  ...['categories', 'concerns', 'collections', 'tags', 'ingredients', 'product-claims', 'related-products', 'promotions', 'coupons', 'shipping-zones', 'shipping-rates', 'serviceable-pincodes', 'tax-rules', 'pages', 'home-sections', 'campaign-slides', 'faqs', 'navigation', 'footer', 'care-moments', 'scroll-stories', 'before-after-stories', 'announcement-bars', 'legal-policies', 'seo-settings', 'care-finder/questions', 'care-finder/options', 'care-finder/rules', 'launch-interests', 'newsletter-subscribers', 'contact-submissions'].map((resource) => [`/admin/${resource}`, ['get', 'post'], `Admin ${resource}`]),
  ...['categories', 'concerns', 'collections', 'tags', 'ingredients', 'product-claims', 'related-products', 'promotions', 'coupons', 'shipping-zones', 'shipping-rates', 'serviceable-pincodes', 'tax-rules', 'pages', 'home-sections', 'campaign-slides', 'faqs', 'navigation', 'footer', 'care-moments', 'scroll-stories', 'before-after-stories', 'announcement-bars', 'legal-policies', 'seo-settings', 'care-finder/questions', 'care-finder/options', 'care-finder/rules'].map((resource) => [`/admin/${resource}/{id}`, ['get', 'patch', 'delete'], `Admin ${resource} record`]),
  ...['launch-interests', 'newsletter-subscribers', 'contact-submissions'].map((resource) => [`/admin/${resource}/{id}`, ['get', 'patch', 'delete'], `Admin ${resource} record`]),
  ...['store', 'payments', 'shipping', 'notifications', 'integrations', 'features'].flatMap((setting) => [[`/admin/settings/${setting}`, ['get', 'patch'], `Admin ${setting} settings`]]),
].forEach(([path, methods, summary]) => documentPath(path as string, methods as string[], summary as string))

export function buildApp(): FastifyInstance {
  activeWaitlistSettings = { ...defaultWaitlistSettings }
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'] }, genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomToken(12) })
  // Razorpay signs the exact webhook bytes. Preserve the original JSON string
  // before parsing so whitespace/key-order changes cannot invalidate verification.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    ;(request as any).rawBody = body
    try { done(null, body ? JSON.parse(body as string) : {}) } catch (cause) { done(cause as Error, undefined) }
  })
  const routes: any = app
  for (const contentType of ['application/octet-stream', 'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']) app.addContentTypeParser(contentType, { parseAs: 'buffer' }, (_request, body, done) => done(null, body))
  const payment = new RazorpayAdapter()
  const email = new LocalEmailAdapter()
  const storage = new LocalStorageAdapter()
  const manualShipping = new ManualShippingAdapter(async (pincode) => Boolean(await prisma.serviceablePincode.findUnique({ where: { pincode, active: true } })))
  const shiprocket = new ShiprocketAdapter()
  // Manual serviceability remains the safe default. Shiprocket becomes active
  // only when SHIPPING_PROVIDER=shiprocket is explicitly configured.
  const shipping = process.env.SHIPPING_PROVIDER === 'shiprocket' ? shiprocket : manualShipping

  app.register(cookie, { secret: process.env.COOKIE_SECRET ?? 'local-only-change-this-cookie-secret-please' })
  app.register(cors, { credentials: true, origin: (origin, cb) => { const allowed = [process.env.STOREFRONT_ORIGIN ?? 'http://localhost:4173', process.env.ADMIN_ORIGIN ?? 'http://localhost:4174', process.env.AFFILIATE_ORIGIN ?? 'http://localhost:4175']; const localPreview = /^http:\/\/(?:localhost|127\.0\.0\.1):417[345]$/.test(origin ?? ''); cb(null, !origin || allowed.includes(origin) || (process.env.NODE_ENV !== 'production' && localPreview)) } })
  app.register(helmet, { contentSecurityPolicy: false })
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  app.register(swagger, { openapi: { info: { title: 'SkinFox API', version: '1.0.0', description: 'API-backed SkinFox commerce and operations API' }, servers: [{ url: '/api/v1' }], paths: openApiPaths } })
  app.register(swaggerUi, { routePrefix: '/api/docs' })

  app.addHook('onReady', async () => {
    const stored = await prisma.storeSetting.findUnique({ where: { key: 'waitlist-config' } })
    activeWaitlistSettings = parseStoredWaitlistSettings(stored?.value, defaultWaitlistSettings)
    if (stored && activeWaitlistSettings === defaultWaitlistSettings) app.log.warn('Invalid persisted waitlist settings; environment defaults are active.')
  })
  app.addHook('onRequest', async (request, reply) => { reply.header('x-request-id', request.id); request.log.info({ requestId: request.id, method: request.method, url: request.url }, 'request started') })
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id
    if (error instanceof ZodError) return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fieldErrors: Object.fromEntries(error.issues.map((issue) => [issue.path.join('.'), issue.message])), requestId } })
    if (error instanceof ApiError) return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}), requestId } })
    if (error instanceof Prisma.PrismaClientValidationError) return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'The submitted fields are invalid for this resource.', requestId } })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return reply.status(409).send({ error: { code: 'CONFLICT', message: 'A record with the same unique value already exists.', requestId } })
      if (error.code === 'P2025') return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'The requested record was not found.', requestId } })
      if (error.code === 'P2003') return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'A referenced record does not exist or is still in use.', requestId } })
    }
    if ((error as any).statusCode && (error as any).statusCode < 500) return reply.status((error as any).statusCode).send({ error: { code: 'REQUEST_ERROR', message: error.message, requestId } })
    request.log.error({ err: error, requestId }, 'request failed')
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId } })
  })
  const data = (reply: any, value: unknown, meta: Record<string, unknown> = {}) => reply.send({ data: value, meta: { requestId: reply.request.id, ...meta } })
  const body = <T>(request: any, schema: z.ZodType<T>) => schema.parse(request.body)
  const pageParams = (request: any) => { const page = Number(request.query?.page ?? 1); const limit = Number(request.query?.limit ?? 24); if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) throw validationError('Page and limit must be positive integers.'); return { page, limit: Math.min(100, limit), q: String(request.query?.q ?? '').trim() } }

  const currentAdmin = async (request: any) => {
    const token = request.cookies.sf_admin_session
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Admin authentication is required.')
    const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) throw new ApiError(401, 'UNAUTHENTICATED', 'Your admin session has expired.')
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    return session.user
  }
  const requireAdmin = (roles: AdminRole[] = [], permission?: string) => async (request: any) => {
    const user = await currentAdmin(request)
    if (roles.length && !roles.includes(user.role) && user.role !== AdminRole.SUPER_ADMIN) throw forbidden()
    if (permission && user.role !== AdminRole.SUPER_ADMIN && !rolePermissions[user.role].includes(permission)) throw forbidden()
    if (request.method !== 'GET' && request.url.includes('/admin/') && !['/api/v1/admin/auth/login', '/api/v1/admin/auth/refresh'].includes(request.routerPath)) {
      const csrfCookie = request.cookies.sf_csrf
      const csrfHeader = request.headers['x-csrf-token']
      if (!csrfCookie || csrfHeader !== csrfCookie) throw new ApiError(403, 'CSRF_REQUIRED', 'A CSRF token is required for this action.')
    }
    return user
  }
  const publicCustomer = (customer: any) => ({ id: customer.id, fullName: customer.fullName, email: customer.email, phone: customer.phone, phoneVerified: Boolean(customer.phoneVerifiedAt), emailVerified: Boolean(customer.emailVerifiedAt), founderNumber: customer.founderNumber ?? null, founderJoinedAt: customer.founderJoinedAt ?? null, createdAt: customer.createdAt })
  const currentCustomer = async (request: any, required = true) => {
    const token = request.cookies.sf_customer_session
    if (!token) {
      if (required) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Sign in to continue.')
      return null
    }
    const session = await prisma.customerSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { customer: true } })
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (required) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Your customer session has expired. Please sign in again.')
      return null
    }
    if (session.firebaseUid) {
      if (session.firebaseProjectId && process.env.FIREBASE_PROJECT_ID && session.firebaseProjectId !== process.env.FIREBASE_PROJECT_ID) {
        await prisma.customerSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
        if (required) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Your customer session is no longer valid. Please sign in again.')
        return null
      }
      try {
        const firebaseUser = await getFirebaseUserRecord(session.firebaseUid)
        const revokedAt = firebaseUser.tokensValidAfterTime ? new Date(firebaseUser.tokensValidAfterTime).getTime() : 0
        if (firebaseUser.disabled || (revokedAt > 0 && revokedAt > session.createdAt.getTime())) {
          await prisma.customerSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
          if (required) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Your customer session is no longer valid. Please sign in again.')
          return null
        }
      } catch (cause: any) {
        if (cause instanceof ApiError) throw cause
        if (cause?.code === 'auth/user-not-found') {
          await prisma.customerSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
          if (required) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Your customer session is no longer valid. Please sign in again.')
          return null
        }
        // Keep the application session usable during a transient Firebase
        // outage; the next request retries the revocation check.
        request.log.warn({ err: cause, sessionId: session.id }, 'Firebase session validation unavailable')
      }
    }
    await prisma.customerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    return session.customer
  }
  const requireCustomer = async (request: any, csrfRequired = false) => {
    const customer = await currentCustomer(request)
    if (csrfRequired) {
      const csrfCookie = request.cookies.sf_customer_csrf
      const csrfHeader = request.headers['x-customer-csrf-token']
      if (!csrfCookie || csrfHeader !== csrfCookie) throw new ApiError(403, 'CSRF_REQUIRED', 'A customer CSRF token is required for this action.')
    }
    return customer
  }
  const publicAffiliate = (affiliate: any) => ({ id: affiliate.id, fullName: affiliate.fullName, email: affiliate.email, phone: affiliate.phone, panLast4: affiliate.panLast4, whatsappNumber: affiliate.whatsappNumber, city: affiliate.city, state: affiliate.state, payoutUpiId: affiliate.payoutUpiId, status: affiliate.status, referralCode: affiliate.referralCode, approvedAt: affiliate.approvedAt, rejectionReason: affiliate.rejectionReason, createdAt: affiliate.createdAt })
  const currentAffiliate = async (request: any, required = true) => {
    const token = request.cookies.sf_affiliate_session
    if (!token) {
      if (required) throw new ApiError(401, 'AFFILIATE_AUTH_REQUIRED', 'Sign in to your affiliate dashboard with mobile OTP.')
      return null
    }
    const session = await prisma.affiliateSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { affiliate: true } })
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (required) throw new ApiError(401, 'AFFILIATE_AUTH_REQUIRED', 'Your affiliate session has expired. Sign in again.')
      return null
    }
    await prisma.affiliateSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    return session.affiliate
  }
  const requireAffiliate = async (request: any, csrfRequired = false) => {
    const affiliate = await currentAffiliate(request)
    if (csrfRequired) {
      const csrfCookie = request.cookies.sf_affiliate_csrf
      const csrfHeader = request.headers['x-affiliate-csrf-token']
      if (!csrfCookie || csrfHeader !== csrfCookie) throw new ApiError(403, 'CSRF_REQUIRED', 'An affiliate CSRF token is required for this action.')
    }
    return affiliate
  }
  const affiliateWalletBalance = async (affiliateId: string) => Number((await prisma.affiliateWalletEntry.aggregate({ where: { affiliateId }, _sum: { amountPaise: true } }))._sum.amountPaise ?? 0)
  const audit = async (user: any, request: any, action: string, entityType: string, entityId: string | null, beforeSummary: unknown, afterSummary: unknown, reason?: string) => prisma.auditLog.create({ data: { actorId: user?.id, action, entityType, entityId, beforeSummary: beforeSummary as Prisma.InputJsonValue ?? undefined, afterSummary: afterSummary as Prisma.InputJsonValue ?? undefined, reason, requestId: request.id, ip: request.ip, userAgent: request.headers['user-agent'], result: 'success' } })
  const getCart = async (request: any) => {
    const token = request.headers['x-cart-token'] ?? request.cookies.sf_cart_token ?? request.params?.cartId
    if (!token) throw validationError('A cart token is required.')
    const cart = await prisma.cart.findUnique({ where: { tokenHash: hashToken(String(token)) }, include: { coupon: { include: { promotion: true } }, items: { include: { product: { include: { variants: { include: { inventory: true } } } }, variant: true } } } })
    if (!cart || cart.expiresAt < new Date()) throw notFound('Cart not found or expired.')
    // Keep the opaque public token available to response serializers without ever
    // persisting or exposing the database cart id as a client token.
    ;(cart as any).publicToken = String(token)
    return cart
  }
  const cartResponse = async (cart: any, cod = false, serviceable = true, customer?: any) => {
    // Founder pricing is snapshotted into the converted waitlist order. Once
    // the public launch opens, new cart items must use the public launch price
    // for every shopper, including former waitlist members.
    const founderEligible = activeWaitlistSettings.stage === 'founder_reveal' && customer?.founderNumber && customer.founderNumber <= activeWaitlistSettings.founderCapacity && Boolean(await prisma.waitlistReservation.findFirst({ where: { customerId: customer.id, status: { in: [WaitlistStatus.joined, WaitlistStatus.converted] } }, select: { id: true } }))
    const lines = cart.items.map((item: any) => {
      // Prefer the fully hydrated product variant (with inventory) over the
      // lightweight CartItem relation so availability is never reported as zero
      // merely because the cart item relation omitted inventory rows.
      const variant = item.product.variants.find((candidate: any) => candidate.id === item.variantId) ?? item.product.variants[0] ?? item.variant
      const inv = variant?.inventory?.reduce((sum: number, row: any) => sum + row.availableQty - row.reservedQty, 0) ?? 0
      const publicItem = publicProduct(item.product)
      return { id: item.id, productId: item.product.id, variantId: variant?.id, quantity: item.quantity, product: founderEligible ? { ...publicItem, pricePaise: activeWaitlistSettings.founderPricePaise, mrpPaise: item.product.mrpPaise ?? activeWaitlistSettings.regularPricePaise, purchaseState: PurchaseState.available } : publicItem, unitPricePaise: founderEligible ? activeWaitlistSettings.founderPricePaise : variant?.pricePaise ?? item.product.pricePaise, availableQuantity: inv, purchaseState: founderEligible ? PurchaseState.available : variant?.purchaseState ?? item.product.purchaseState }
    })
    const quote = calculateCart(lines, cart.coupon?.promotion as any, serviceable, cod)
    if (waitlistPricesHidden() && !founderEligible) return { cartId: cart.publicToken ?? cart.id, lines: lines.map((line: any) => ({ ...line, product: publicProduct(line.product), unitPricePaise: null, purchaseState: PurchaseState.coming_soon })), ...quote, subtotalPaise: 0, discountPaise: 0, taxPaise: 0, shippingPaise: 0, codPaise: 0, totalPaise: 0, purchaseEligible: false, priceHidden: true, validationMessages: [], appliedCoupon: null, currency: cart.currency, expiresAt: cart.expiresAt }
    return { cartId: cart.publicToken ?? cart.id, lines, ...quote, appliedCoupon: cart.coupon ? { code: cart.coupon.code, promotion: cart.coupon.promotion } : null, currency: cart.currency, expiresAt: cart.expiresAt }
  }
  const idemReplay = async (request: any, scope: string) => { const key = request.headers['idempotency-key']; if (!key) return null; const record = await prisma.idempotencyRecord.findUnique({ where: { key_scope: { key: String(key), scope } } }); if (!record?.responseBody) return null; if (record.requestHash !== sha256Json(request.body ?? {})) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used with a different request.'); return { status: record.responseStatus ?? 200, body: record.responseBody } }
  const idemStore = async (request: any, scope: string, status: number, responseBody: unknown) => { const key = request.headers['idempotency-key']; if (!key) return; await prisma.idempotencyRecord.create({ data: { key: String(key), scope, requestHash: sha256Json(request.body ?? {}), responseStatus: status, responseBody: responseBody as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } }).catch(() => undefined) }

  routes.get('/api/v1/health', async (_, reply) => data(reply, { status: 'ok', service: 'skinfox-api', timestamp: new Date().toISOString() }))
  routes.get('/api/v1/ready', async (_, reply) => { await prisma.$queryRaw`SELECT 1`; return data(reply, { status: 'ready', database: 'ok' }) })
  routes.get('/api/v1/storefront/bootstrap', async (_, reply) => {
    const settings = await prisma.storeSetting.findMany({ where: { key: { in: ['storefront', 'seo'] } } })
    const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value])) as any
    const waitlist = waitlistConfig(await founderClaimedCount())
    return data(reply, { storeName: 'SkinFox', logo: '/brand/skinfox-logo.png', currency: 'INR', announcement: values.storefront?.announcement ?? (waitlist.enabled ? 'Priority launch waitlist is open' : 'The SkinFox collection is now available'), navigation: [{ label: 'Shop', href: '#shop' }, { label: 'Care finder', href: '#care-finder' }], footerLinks: [{ label: 'FAQ', href: '#faq' }], socialLinks: [{ label: 'Instagram', href: '#story' }], freeShippingThresholdPaise: values.storefront?.freeShippingThresholdPaise ?? 99900, featureFlags: { customerOtp: false, firebaseAuth: firebaseAdminIsConfigured(), customerEmailAuth: firebaseAdminIsConfigured(), paymentMode: waitlist.enabled ? 'waitlist' : 'cod' }, supportContact: { email: values.storefront?.supportEmail ?? 'contact@skinfox.in' }, enabledPaymentMethods: waitlist.enabled ? ['razorpay_waitlist'] : ['cod'], waitlist, seo: values.seo ?? {} })
  })
  routes.get('/api/v1/products', async (request, reply) => {
    const params = pageParams(request)
    const minPrice = request.query?.minPrice === undefined || request.query?.minPrice === '' ? undefined : Number(request.query.minPrice)
    const maxPrice = request.query?.maxPrice === undefined || request.query?.maxPrice === '' ? undefined : Number(request.query.maxPrice)
    if ((minPrice !== undefined && !Number.isInteger(minPrice)) || (maxPrice !== undefined && !Number.isInteger(maxPrice))) throw validationError('Price filters must be integer paise values.', { minPrice: 'Use integer paise.', maxPrice: 'Use integer paise.' })
    if (activeWaitlistSettings.enabled && (minPrice !== undefined || maxPrice !== undefined || ['price_asc', 'price_desc'].includes(String(request.query?.sort ?? '')))) throw validationError('Price filtering and sorting will be available after prices are revealed.')
    const collection = request.query?.collection ? String(request.query.collection) : undefined
    const where: any = {
      status: PublicationStatus.published,
      ...(request.query?.purchaseState ? { purchaseState: request.query.purchaseState } : {}),
      ...(request.query?.category ? { category: String(request.query.category) } : {}),
      ...(request.query?.concern ? { concerns: { has: String(request.query.concern) } } : {}),
      ...(collection ? { collections: { some: { collection: { slug: collection } } } } : {}),
      ...((minPrice !== undefined || maxPrice !== undefined) ? { pricePaise: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } } : {}),
      ...(params.q ? { OR: [{ name: { contains: params.q, mode: 'insensitive' } }, { subtitle: { contains: params.q, mode: 'insensitive' } }, { description: { contains: params.q, mode: 'insensitive' } }] } : {}),
    }
    const orderBy = request.query?.sort === 'price_asc' ? { pricePaise: 'asc' as const } : request.query?.sort === 'price_desc' ? { pricePaise: 'desc' as const } : request.query?.sort === 'name' ? { name: 'asc' as const } : { createdAt: 'asc' as const }
    const [items, total] = await prisma.$transaction([prisma.product.findMany({ where, include: { media: true, variants: true }, orderBy, skip: (params.page - 1) * params.limit, take: params.limit }), prisma.product.count({ where })])
    return data(reply, items.map((item) => publicProduct(item)), { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total })
  })
  routes.get('/api/v1/products/:id/availability', async (request, reply) => { const pincode = String(request.query?.pincode ?? ''); if (!isValidPincode(pincode)) throw validationError('Enter a valid six-digit pincode.', { pincode: 'Pincode must contain six digits.' }); const serviceable = await shipping.serviceable(pincode); const product = await prisma.product.findFirst({ where: { OR: [{ id: request.params.id }, { slug: request.params.id }] }, include: { variants: { include: { inventory: true } } } }); if (!product) throw notFound('Product not found.'); return data(reply, { serviceable, purchaseState: activeWaitlistSettings.enabled ? PurchaseState.coming_soon : product.purchaseState, availableQuantity: activeWaitlistSettings.enabled ? null : product.variants.reduce((sum, variant) => sum + variant.inventory.reduce((inner, row) => inner + row.availableQty - row.reservedQty, 0), 0), waitlistEligible: activeWaitlistSettings.enabled }) })
  routes.get('/api/v1/products/:id', async (request, reply) => { const product = await prisma.product.findFirst({ where: { OR: [{ id: request.params.id }, { slug: request.params.id }], status: PublicationStatus.published }, include: { media: true, variants: true, collections: { include: { collection: true } } } }); if (!product) throw notFound('Product not found.'); return data(reply, publicProduct(product)) })
  routes.get('/api/v1/categories', async (_, reply) => data(reply, await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })))
  routes.get('/api/v1/concerns', async (_, reply) => data(reply, await prisma.concern.findMany({ orderBy: { sortOrder: 'asc' } })))
  routes.get('/api/v1/collections', async (_, reply) => data(reply, (await prisma.collection.findMany({ where: { status: PublicationStatus.published }, include: { products: { include: { product: { include: { media: true, variants: true } } } } } })).map(publicCollection)))
  routes.get('/api/v1/collections/:slug', async (request, reply) => { const collection = await prisma.collection.findUnique({ where: { slug: request.params.slug }, include: { products: { include: { product: { include: { media: true, variants: true } } } } } }); if (!collection) throw notFound('Collection not found.'); return data(reply, publicCollection(collection)) })
  routes.get('/api/v1/search/suggestions', async (request, reply) => { const q = String(request.query?.q ?? '').trim(); if (!q) return data(reply, []); const products = await prisma.product.findMany({ where: { status: PublicationStatus.published, OR: [{ name: { contains: q, mode: 'insensitive' } }, { concerns: { has: q } }] }, select: { id: true, slug: true, name: true, subtitle: true }, take: 8 }); return data(reply, products) })
  routes.get('/api/v1/campaign-slides', async (_, reply) => data(reply, await prisma.campaignSlide.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } })))
  routes.get('/api/v1/faqs', async (_, reply) => data(reply, await prisma.fAQ.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } })))
  routes.get('/api/v1/pages/home', async (_, reply) => { const [sections, slides, collections, careMoments, faqItems, announcement] = await prisma.$transaction([prisma.homeSection.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } }), prisma.campaignSlide.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } }), prisma.collection.findMany({ where: { status: PublicationStatus.published }, include: { products: { include: { product: { include: { media: true, variants: true } } } } } }), prisma.careMoment.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } }), prisma.fAQ.findMany({ where: { status: PublicationStatus.published }, orderBy: { sortOrder: 'asc' } }), prisma.announcementBar.findFirst({ where: { status: PublicationStatus.published }, orderBy: { createdAt: 'desc' } })]); return data(reply, { slug: 'home', sections, campaignSlides: slides, featuredCollections: collections.map(publicCollection), careMoments, faqs: faqItems, announcement: announcement?.text ?? null }) })
  routes.get('/api/v1/pages/:slug', async (request, reply) => { const page = await prisma.page.findFirst({ where: { slug: request.params.slug, status: PublicationStatus.published } }); if (!page) throw notFound('Page not found.'); return data(reply, page) })
  routes.get('/api/v1/navigation/:location', async (request, reply) => data(reply, await prisma.navigationMenu.findFirst({ where: { location: request.params.location }, include: { items: { orderBy: { sortOrder: 'asc' } } } })))

  routes.get('/api/v1/care-finder', async (_, reply) => { const finder = await prisma.careFinder.findFirst({ where: { active: true }, include: { questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } } } }); return data(reply, finder) })
  routes.post('/api/v1/care-finder/recommendations', async (request, reply) => {
    const answers = z.record(z.union([z.string(), z.array(z.string())])).parse(request.body?.answers ?? request.body ?? {}) as Record<string, CareFinderAnswer>
    const finder = await prisma.careFinder.findFirstOrThrow({ where: { active: true }, include: { rules: { include: { product: { include: { media: true, variants: { include: { inventory: true } } } } } } } })
    const questionRows = await prisma.careFinderQuestion.findMany({ where: { careFinderId: finder.id }, include: { options: true } })
    const questionMap = new Map(questionRows.map((question) => [question.key, new Set(question.options.map((option) => option.value))]))
    for (const [key, answer] of Object.entries(answers)) {
      const allowed = questionMap.get(key)
      if (!allowed) throw validationError(`Unknown care finder answer: ${key}.`)
      const values = Array.isArray(answer) ? answer : [answer]
      if (values.some((value) => !allowed.has(value))) throw validationError(`Unsupported answer for ${key}.`)
    }
    const scored = scoreCareFinderProducts(finder.rules, finder.rules.map((rule) => rule.product).filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index), answers)
    const preference = answers.routinePreference === 'complete' ? 'complete' : 'simple'
    const selected = scored.filter((item) => preference === 'complete' || item.metadata.role !== 'optional').slice(0, preference === 'complete' ? 4 : 2)
    const config = (finder.config && typeof finder.config === 'object' && !Array.isArray(finder.config) ? finder.config : {}) as Record<string, any>
    const area = typeof answers.careArea === 'string' ? answers.careArea : 'skin'
    const packageName = config.packageNames?.[area] ?? 'Your SkinFox care edit'
    const items = selected.map((item) => ({ product: publicProduct(item.product), role: item.metadata.role ?? 'essential', reason: item.metadata.reason ?? item.product.benefit, frequency: item.metadata.frequency ?? 'Follow the final pack directions', days: item.metadata.days ?? ['As directed'], timeOfDay: item.metadata.timeOfDay ?? 'As directed', instructions: item.metadata.instructions ?? 'Follow the final product pack directions.', stepOrder: item.metadata.stepOrder ?? null, guidanceStatus: item.metadata.guidanceStatus ?? 'needs_review', matchedRules: item.matchedRules, pricePaise: activeWaitlistSettings.enabled ? null : productPricePaise(item.product), mrpPaise: productMrpPaise(item.product) ?? activeWaitlistSettings.regularPricePaise }))
    const totalPaise = items.reduce((sum, item) => sum + (item.pricePaise ?? 0), 0)
    const mrpTotalPaise = items.reduce((sum, item) => sum + (item.mrpPaise ?? item.pricePaise ?? 0), 0)
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const weeklyPlan = weekDays.map((day) => ({ day, steps: items.filter((item) => item.days.some((value) => value.toLowerCase() === 'every day' || value.toLowerCase() === day.toLowerCase())).sort((a, b) => (a.stepOrder ?? 99) - (b.stepOrder ?? 99)).map((item) => ({ productId: item.product.id, productName: item.product.name, timeOfDay: item.timeOfDay, stepOrder: item.stepOrder, guidanceStatus: item.guidanceStatus })) }))
    const calendar = Array.from({ length: 30 }, (_, index) => ({ day: index + 1, weekday: weekDays[index % weekDays.length], steps: weeklyPlan[index % weekDays.length].steps }))
    const guidanceReview = items.filter((item) => item.guidanceStatus !== 'approved').map((item) => ({ productId: item.product.id, productName: item.product.name, message: 'Usage directions need final brand approval before launch.' }))
    const explanation = items.length ? 'Your edit is assembled from approved catalogue availability and weighted care-finder rules.' : answers.sensitivity === 'concerning' ? 'We are pausing product suggestions because you mentioned persistent or concerning symptoms. Please speak with a qualified medical professional.' : 'There is no purchasable product match for this combination yet. Try changing your answers or browse the catalogue.'
    const result = { package: items.length ? { name: packageName, description: config.resultDescription ?? 'A considered edit based on the answers you shared.', items, totalPaise, mrpTotalPaise, savingsPaise: Math.max(0, mrpTotalPaise - totalPaise) } : null, summary: { careArea: area, primaryGoal: answers.mainConcern ?? null, secondaryGoals: Array.isArray(answers.secondaryConcern) ? answers.secondaryConcern : answers.secondaryConcern ? [answers.secondaryConcern] : [] }, routine: { weeklyPlan, calendar, repeatForDays: 30 }, guidanceReview, explanation, disclaimer: config.disclaimer ?? 'Cosmetic care guidance only. This consultation is not a medical diagnosis. For persistent, painful or concerning symptoms, consult a qualified professional.', guidanceNote: config.guidanceNote ?? 'Follow the final product pack directions. Unsupported usage claims are not shown.' }
    return data(reply, { ...result, primary: items[0]?.product ?? null, alternatives: items.slice(1).map((item) => item.product), routineOrder: items.map((item) => item.product.routineStep) })
  })
  // The uploaded photo lives in memory for this request only: it is never written
  // to disk or the database, and never attached to the care-finder submission.
  // Identifies the browser for the daily photo quota. httpOnly so page scripts
  // cannot rewrite it; it carries no personal data, only a random id.
  const photoDevice = (request: any, reply: any) => {
    const existing = request.cookies?.[PHOTO_DEVICE_COOKIE]
    if (existing) return existing
    const issued = newDeviceId()
    reply.setCookie(PHOTO_DEVICE_COOKIE, issued, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/', maxAge: 60 * 60 * 24 * 365 })
    return issued
  }

  routes.get('/api/v1/care-finder/photo-analysis', async (request, reply) => {
    const quota = await checkPhotoQuota(photoDevice(request, reply), request.ip)
    return data(reply, { configured: photoAnalysisConfigured(), ...quota })
  })

  routes.post('/api/v1/care-finder/photo-analysis', { bodyLimit: 3_000_000, config: { rateLimit: { max: 12, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const input = z.object({ image: z.string().min(32).max(3_000_000), mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']) }).parse(request.body ?? {})
    if (!photoAnalysisConfigured()) return data(reply, { configured: false, usable: false, observations: [], answers: {}, note: photoNote, remaining: 0, limit: PHOTO_DAILY_LIMIT })
    const deviceId = photoDevice(request, reply)
    const quota = await checkPhotoQuota(deviceId, request.ip)
    if (!quota.allowed) throw new ApiError(429, 'PHOTO_LIMIT_REACHED', quota.reason === 'ip' ? 'This network has reached today’s photo limit. Please continue with the questions.' : `You have used today’s ${PHOTO_DAILY_LIMIT} photo checks. Please continue with the questions, or try again tomorrow.`)
    const base64 = input.image.includes(',') ? input.image.slice(input.image.indexOf(',') + 1) : input.image
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw validationError('The photo could not be read.')
    const finder = await prisma.careFinder.findFirst({ where: { active: true }, include: { questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } } } })
    if (!finder) throw notFound('Care finder is not configured.')
    const questions = finder.questions.map((question) => ({ key: question.key, prompt: question.prompt, multi: question.selectionMode === 'multi', values: question.options.map((option) => option.value) })).filter((question) => question.values.length)
    try {
      const { usage, ...result } = await analysePhoto(base64.replace(/\s/g, ''), input.mediaType, questions)
      const remaining = await recordPhotoUse(deviceId, request.ip)
      if (usage) request.log.info({ photoAnalysisUsage: usage }, 'care finder photo analysis usage')
      return data(reply, { configured: true, ...result, remaining, limit: PHOTO_DAILY_LIMIT })
    } catch (cause) {
      request.log.error({ err: cause }, 'care finder photo analysis failed')
      throw new ApiError(502, 'PHOTO_ANALYSIS_FAILED', 'We could not read that photo just now. You can continue with the questions instead.')
    }
  })

  routes.post('/api/v1/care-finder/events', async (request, reply) => {
    const input = z.object({ event: z.string().min(1).max(80), answers: z.record(z.union([z.string(), z.array(z.string())])).optional(), recommendations: z.unknown().optional() }).parse(request.body ?? {})
    if (input.answers) {
      const finder = await prisma.careFinder.findFirst({ where: { active: true } })
      if (finder) await prisma.careFinderSubmission.create({ data: { careFinderId: finder.id, answers: input.answers, recommendations: input.recommendations ?? {} } })
    }
    return data(reply, { accepted: true, event: input.event })
  })

  routes.post('/api/v1/customer/auth/firebase', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!firebaseAdminIsConfigured()) throw new ApiError(503, 'FIREBASE_AUTH_NOT_CONFIGURED', 'Firebase customer authentication is not configured on this server.')
    const input = z.object({ idToken: z.string().min(20), cartToken: z.string().min(16).optional(), link: z.boolean().default(false), profilePhone: deliveryPhoneSchema.optional() }).parse(request.body)
    let decoded: any
    try {
      decoded = await verifyFirebaseIdToken(input.idToken, true)
    } catch {
      throw new ApiError(401, 'FIREBASE_TOKEN_INVALID', 'Your Firebase sign-in could not be verified. Please try again.')
    }
    const provider = String(decoded?.firebase?.sign_in_provider ?? '')
    if (provider !== 'google.com' && provider !== 'password') throw new ApiError(401, 'FIREBASE_PROVIDER_UNSUPPORTED', 'Use Google or email and password sign-in.')
    const providerUid = String(decoded.uid ?? '')
    const firebaseProjectId = String(decoded.aud ?? process.env.FIREBASE_PROJECT_ID ?? '')
    if (!providerUid || !firebaseProjectId) throw new ApiError(401, 'FIREBASE_TOKEN_INVALID', 'Your Firebase sign-in could not be verified. Please try again.')
    if (process.env.FIREBASE_PROJECT_ID && firebaseProjectId !== process.env.FIREBASE_PROJECT_ID) throw new ApiError(401, 'FIREBASE_TOKEN_INVALID', 'Your Firebase sign-in could not be verified. Please try again.')
    const existingSessionCustomer = input.link ? await currentCustomer(request, false) : null
    if (input.link) {
      if (!existingSessionCustomer) throw new ApiError(401, 'CUSTOMER_AUTH_REQUIRED', 'Sign in to your SkinFox account before linking another provider.')
      const csrfCookie = request.cookies.sf_customer_csrf
      const csrfHeader = request.headers['x-customer-csrf-token']
      if (!csrfCookie || csrfHeader !== csrfCookie) throw new ApiError(403, 'CSRF_REQUIRED', 'A customer CSRF token is required to link a provider.')
    }
    const identityKey = { firebaseProjectId_providerUid: { firebaseProjectId, providerUid } }
    const tokenEmail = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : null
    const tokenEmailVerified = decoded.email_verified === true
    const tokenName = typeof decoded.name === 'string' && decoded.name.trim().length >= 2 ? decoded.name.trim() : 'SkinFox customer'
    const profilePhone = input.profilePhone
    const token = randomToken(32)
    const csrf = randomToken(18)
    let result: any
    try {
      result = await prisma.$transaction(async (tx) => {
        const mappedIdentity = await tx.customerIdentity.findUnique({ where: identityKey, include: { customer: true } })
        if (mappedIdentity && existingSessionCustomer && mappedIdentity.customerId !== existingSessionCustomer.id) throw new ApiError(409, 'CUSTOMER_PROVIDER_CONFLICT', 'That provider is already linked to another SkinFox account.')
        let customer = mappedIdentity?.customer ?? existingSessionCustomer
        if (!customer) {
          // Firebase authentication proves the credential, but an email claim
          // must never be used to take over an unrelated legacy SkinFox row.
          const emailTaken = tokenEmail ? await tx.customer.findUnique({ where: { email: tokenEmail }, select: { id: true } }) : null
          const phoneTaken = profilePhone ? await tx.customer.findUnique({ where: { phone: profilePhone }, select: { id: true } }) : null
          customer = await tx.customer.create({ data: { fullName: tokenName, email: emailTaken ? undefined : tokenEmail ?? undefined, phone: phoneTaken ? undefined : profilePhone, emailVerifiedAt: !emailTaken && tokenEmail && tokenEmailVerified ? new Date() : undefined } })
        } else {
          const updates: any = {}
          if (!customer.email && tokenEmail && !await tx.customer.findFirst({ where: { email: tokenEmail, id: { not: customer.id } }, select: { id: true } })) { updates.email = tokenEmail; if (tokenEmailVerified) updates.emailVerifiedAt = new Date() }
          if (!customer.phone && profilePhone && !await tx.customer.findFirst({ where: { phone: profilePhone, id: { not: customer.id } }, select: { id: true } })) updates.phone = profilePhone
          if (tokenEmailVerified && customer.email === tokenEmail && !customer.emailVerifiedAt) updates.emailVerifiedAt = new Date()
          if (customer.fullName === 'SkinFox customer' && tokenName !== 'SkinFox customer') updates.fullName = tokenName
          if (Object.keys(updates).length) customer = await tx.customer.update({ where: { id: customer.id }, data: updates })
        }
        if (mappedIdentity) {
          if (mappedIdentity.email !== tokenEmail || mappedIdentity.provider !== provider) await tx.customerIdentity.update({ where: { id: mappedIdentity.id }, data: { email: tokenEmail, provider } })
        } else {
          await tx.customerIdentity.create({ data: { customerId: customer.id, firebaseProjectId, provider, providerUid, email: tokenEmail } })
        }
        let cartLinked = false
        if (input.cartToken) {
          const cart = await tx.cart.findUnique({ where: { tokenHash: hashToken(input.cartToken) } })
          if (cart && cart.expiresAt > new Date() && (!cart.customerId || cart.customerId === customer.id)) {
            await tx.cart.update({ where: { id: cart.id }, data: { customerId: customer.id } })
            cartLinked = true
          }
        }
        const session = await tx.customerSession.create({ data: { tokenHash: hashToken(token), customerId: customer.id, firebaseProjectId, firebaseUid: providerUid, expiresAt: new Date(Date.now() + customerSessionTtlDays() * 86400000), ip: request.ip, userAgent: request.headers['user-agent'] } })
        return { customer, session, cartLinked }
      })
    } catch (cause: any) {
      if (cause instanceof ApiError) throw cause
      if (cause?.code === 'P2002') throw new ApiError(409, 'CUSTOMER_PROVIDER_CONFLICT', 'That provider is already linked to another SkinFox account.')
      throw cause
    }
    reply.setCookie('sf_customer_session', token, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), maxAge: customerSessionTtlDays() * 86400, path: '/' }).setCookie('sf_customer_csrf', csrf, { httpOnly: false, sameSite: 'lax', secure: secureCookies(), maxAge: customerSessionTtlDays() * 86400, path: '/' })
    return data(reply, { customer: publicCustomer(result.customer), provider, cartLinked: result.cartLinked, sessionExpiresAt: result.session.expiresAt, requiresEmailVerification: !result.customer.emailVerifiedAt })
  })
  routes.get('/api/v1/customer/auth/me', async (request, reply) => { const customer = await currentCustomer(request, false); return data(reply, { customer: customer ? publicCustomer(customer) : null }) })
  routes.patch('/api/v1/customer/auth/profile', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const input = customerProfileSchema.parse(request.body)
    try {
      const updated = await prisma.customer.update({ where: { id: customer.id }, data: { fullName: input.fullName, ...(input.phone !== undefined ? { phone: input.phone, phoneVerifiedAt: null } : {}) } })
      return data(reply, publicCustomer(updated))
    } catch (cause: any) {
      if (cause?.code === 'P2002') throw new ApiError(409, 'CUSTOMER_PHONE_IN_USE', 'That mobile number is already linked to another SkinFox account.')
      throw cause
    }
  })
  routes.post('/api/v1/customer/auth/logout', async (request, reply) => { await requireCustomer(request, true); const token = request.cookies.sf_customer_session; if (token) await prisma.customerSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } }); reply.clearCookie('sf_customer_session', { path: '/' }).clearCookie('sf_customer_csrf', { path: '/' }); return data(reply, { loggedOut: true }) })

  // Affiliate applications remain pending until a SkinFox administrator approves them.
  routes.post('/api/v1/affiliate/applications', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const input = z.object({ fullName: z.string().trim().min(2).max(120), email: z.union([z.string().email(), z.literal('')]).optional().transform((value) => value || undefined), phone: z.string().min(1), pan: z.string().trim().transform((value) => value.toUpperCase()), whatsappNumber: z.string().trim().max(20).optional(), city: z.string().trim().max(80).optional(), state: z.string().trim().max(80).optional(), payoutUpiId: z.string().trim().max(120).optional(), acceptedTerms: z.literal(true) }).parse(request.body)
    const phone = normalizeIndianPhone(input.phone)
    if (!phone) throw validationError('Enter a valid Indian 10-digit mobile number.', { phone: 'Use a mobile number beginning with 6, 7, 8, or 9.' })
    if (!isValidPan(input.pan)) throw validationError('Enter a valid PAN in the format ABCDE1234F.', { pan: 'PAN must use five letters, four numbers and one letter.' })
    const duplicate = await prisma.affiliate.findFirst({ where: { OR: [{ phone }, ...(input.email ? [{ email: input.email.toLowerCase() }] : [])] } })
    if (duplicate) throw new ApiError(409, 'AFFILIATE_ALREADY_EXISTS', 'An affiliate application already exists for this mobile number or email.')
    const affiliate = await prisma.affiliate.create({ data: { fullName: input.fullName, email: input.email?.toLowerCase(), phone, panEncrypted: encryptSecret(input.pan), panLast4: input.pan.slice(-4), whatsappNumber: input.whatsappNumber || undefined, city: input.city || undefined, state: input.state || undefined, payoutUpiId: input.payoutUpiId || undefined, referralCode: affiliateReferralCode() } })
    return reply.status(201).send({ data: { affiliate: publicAffiliate(affiliate) }, meta: { requestId: request.id } })
  })
  routes.post('/api/v1/affiliate/auth/request-otp', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const phone = normalizeIndianPhone(z.object({ phone: z.string().min(1) }).parse(request.body).phone)
    if (!phone) throw validationError('Enter a valid Indian 10-digit mobile number.', { phone: 'Use a mobile number beginning with 6, 7, 8, or 9.' })
    const affiliate = await prisma.affiliate.findUnique({ where: { phone } })
    if (!affiliate) throw notFound('No affiliate application was found for this mobile number. Apply first to join SkinFox affiliates.')
    if (affiliate.status === AffiliateStatus.suspended) throw forbidden('This affiliate account is suspended. Contact SkinFox support.')
    const config = affiliateOtpConfig()
    if (!affiliateStaticOtpIsConfigured(config)) throw new ApiError(503, 'OTP_PROVIDER_NOT_CONFIGURED', 'Affiliate OTP is not configured on this server.')
    const latest = await prisma.affiliateOtpChallenge.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } })
    if (latest && latest.createdAt.getTime() > Date.now() - config.resendSeconds * 1000) throw new ApiError(429, 'OTP_RESEND_TOO_SOON', `Please wait ${config.resendSeconds} seconds before requesting another OTP.`)
    const challenge = await prisma.affiliateOtpChallenge.create({ data: { affiliateId: affiliate.id, phone, codeHash: hashAffiliateOtp(config.code), expiresAt: new Date(Date.now() + config.ttlMinutes * 60 * 1000) } })
    return data(reply, { challengeId: challenge.id, phone, expiresAt: challenge.expiresAt, retryAfterSeconds: config.resendSeconds, ...(config.exposeTestCode ? { testOtpCode: config.code } : {}) })
  })
  routes.post('/api/v1/affiliate/auth/verify-otp', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const input = z.object({ challengeId: z.string().min(1), phone: z.string().min(1), code: z.string().regex(/^\d{6}$/) }).parse(request.body)
    const phone = normalizeIndianPhone(input.phone)
    if (!phone) throw validationError('Enter a valid Indian 10-digit mobile number.')
    const config = affiliateOtpConfig()
    const challenge = await prisma.affiliateOtpChallenge.findFirst({ where: { id: input.challengeId, phone }, include: { affiliate: true } })
    if (!challenge || challenge.verifiedAt || !challenge.affiliate) throw new ApiError(401, 'OTP_INVALID', 'That OTP is no longer valid. Request a new one.')
    if (challenge.expiresAt < new Date()) throw new ApiError(401, 'OTP_EXPIRED', 'That OTP has expired. Request a new code.')
    if (challenge.attempts >= config.maxAttempts) throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect OTP attempts. Request a new code.')
    if (!safeEqual(challenge.codeHash, hashAffiliateOtp(input.code))) { await prisma.affiliateOtpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); throw new ApiError(401, 'OTP_INVALID', 'The OTP is incorrect. Please try again.') }
    if (challenge.affiliate.status === AffiliateStatus.suspended) throw forbidden('This affiliate account is suspended. Contact SkinFox support.')
    const token = randomToken(32)
    const csrf = randomToken(18)
    const result = await prisma.$transaction(async (tx) => {
      await tx.affiliateOtpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date(), attempts: { increment: 1 } } })
      return tx.affiliateSession.create({ data: { tokenHash: hashToken(token), affiliateId: challenge.affiliate!.id, expiresAt: new Date(Date.now() + config.sessionTtlDays * 86400000), ip: request.ip, userAgent: request.headers['user-agent'] } })
    })
    reply.setCookie('sf_affiliate_session', token, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), maxAge: config.sessionTtlDays * 86400, path: '/' }).setCookie('sf_affiliate_csrf', csrf, { httpOnly: false, sameSite: 'lax', secure: secureCookies(), maxAge: config.sessionTtlDays * 86400, path: '/' })
    return data(reply, { affiliate: publicAffiliate(challenge.affiliate), sessionExpiresAt: result.expiresAt })
  })
  routes.post('/api/v1/affiliate/auth/logout', async (request, reply) => { await requireAffiliate(request, true); const token = request.cookies.sf_affiliate_session; if (token) await prisma.affiliateSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } }); reply.clearCookie('sf_affiliate_session', { path: '/' }).clearCookie('sf_affiliate_csrf', { path: '/' }); return data(reply, { loggedOut: true }) })
  routes.get('/api/v1/affiliate/auth/me', async (request, reply) => { const affiliate = await currentAffiliate(request, false); return data(reply, { affiliate: affiliate ? publicAffiliate(affiliate) : null }) })
  routes.post('/api/v1/affiliate/referrals/track', { config: { rateLimit: { max: 60, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const input = z.object({ code: z.string().trim().min(4).max(32), landingPath: z.string().max(500).optional() }).parse(request.body)
    const affiliate = await prisma.affiliate.findUnique({ where: { referralCode: input.code.toUpperCase() } })
    if (!affiliate || affiliate.status !== AffiliateStatus.approved) throw notFound('This referral link is not active.')
    const cartToken = String(request.headers['x-cart-token'] ?? '')
    if (!cartToken) {
      await prisma.affiliateReferralClick.create({ data: { affiliateId: affiliate.id, referralCode: affiliate.referralCode, landingPath: input.landingPath } })
      return data(reply, { tracked: true, attributionSaved: false, referralCode: affiliate.referralCode })
    }
    const cart = await getCart(request)
    if (cart.affiliateId && cart.affiliateId !== affiliate.id) return data(reply, { tracked: false, reason: 'cart_already_attributed' })
    if (!cart.affiliateId) await prisma.cart.update({ where: { id: cart.id }, data: { affiliateId: affiliate.id } })
    return data(reply, { tracked: true, attributionSaved: true, referralCode: affiliate.referralCode })
  })
  routes.get('/api/v1/affiliate/dashboard', async (request, reply) => {
    const affiliate = await requireAffiliate(request)
    const [balancePaise, clicks, attributionCount, walletEntries, redemptionRequests] = await Promise.all([affiliateWalletBalance(affiliate.id), prisma.affiliateReferralClick.count({ where: { affiliateId: affiliate.id } }), prisma.affiliateAttribution.count({ where: { affiliateId: affiliate.id } }), prisma.affiliateWalletEntry.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { attribution: { include: { order: { select: { orderNumber: true, createdAt: true } } } }, redemption: true } }), prisma.affiliateRedemptionRequest.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: 'desc' }, take: 20 })])
    return data(reply, { affiliate: publicAffiliate(affiliate), wallet: { balancePaise, minimumRedemptionPaise: 50_000, commissionRatePercent: 10 }, referral: { code: affiliate.referralCode, clicks, confirmedOrders: attributionCount }, walletEntries, redemptionRequests })
  })
  routes.post('/api/v1/affiliate/wallet/redemptions', async (request, reply) => {
    const affiliate = await requireAffiliate(request, true)
    if (affiliate.status !== AffiliateStatus.approved) throw forbidden('Only approved affiliates can request a wallet redemption.')
    const input = z.object({ amountPaise: z.number().int().min(50_000), payoutUpiId: z.string().trim().max(120).optional() }).parse(request.body)
    const requestRecord = await prisma.$transaction(async (tx) => {
      const balance = Number((await tx.affiliateWalletEntry.aggregate({ where: { affiliateId: affiliate.id }, _sum: { amountPaise: true } }))._sum.amountPaise ?? 0)
      if (balance < input.amountPaise) throw validationError('Your available wallet balance is lower than this redemption amount.')
      const redemption = await tx.affiliateRedemptionRequest.create({ data: { affiliateId: affiliate.id, amountPaise: input.amountPaise, payoutUpiId: input.payoutUpiId || affiliate.payoutUpiId || undefined } })
      await tx.affiliateWalletEntry.create({ data: { affiliateId: affiliate.id, type: AffiliateWalletEntryType.redemption_request, amountPaise: -input.amountPaise, description: `Redemption request ${redemption.id}`, redemptionId: redemption.id } })
      return redemption
    })
    return reply.status(201).send({ data: requestRecord, meta: { requestId: request.id } })
  })

  routes.get('/api/v1/customer/addresses', async (request, reply) => { const customer = await requireCustomer(request); return data(reply, await prisma.address.findMany({ where: { customerId: customer.id }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] })) })
  routes.post('/api/v1/customer/addresses', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const input = addressSchema.parse(request.body)
    const address = await prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { customerId: customer.id } })
      const isDefault = input.isDefault || count === 0
      if (isDefault) await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } })
      return tx.address.create({ data: { ...input, isDefault, customerId: customer.id } })
    })
    return reply.status(201).send({ data: address, meta: { requestId: request.id } })
  })
  routes.patch('/api/v1/customer/addresses/:id', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const input = addressSchema.partial().parse(request.body)
    const address = await prisma.address.findFirst({ where: { id: request.params.id, customerId: customer.id } })
    if (!address) throw notFound('Address not found.')
    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { customerId: customer.id, id: { not: address.id } }, data: { isDefault: false } })
      return tx.address.update({ where: { id: address.id }, data: input })
    })
    return data(reply, updated)
  })
  routes.delete('/api/v1/customer/addresses/:id', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const address = await prisma.address.findFirst({ where: { id: request.params.id, customerId: customer.id } })
    if (!address) throw notFound('Address not found.')
    await prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id: address.id } })
      if (address.isDefault) {
        const replacement = await tx.address.findFirst({ where: { customerId: customer.id }, orderBy: { updatedAt: 'desc' } })
        if (replacement) await tx.address.update({ where: { id: replacement.id }, data: { isDefault: true } })
      }
    })
    return data(reply, { deleted: true })
  })
  routes.get('/api/v1/customer/orders', async (request, reply) => { const customer = await requireCustomer(request); return data(reply, await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, include: { items: true, payments: true } })) })
  routes.get('/api/v1/customer/orders/:publicToken', async (request, reply) => { const customer = await requireCustomer(request); const order = await prisma.order.findFirst({ where: { publicToken: request.params.publicToken, customerId: customer.id }, include: { items: true, payments: true, shipments: { include: { events: { orderBy: { createdAt: 'asc' } } } }, statusEvents: { orderBy: { createdAt: 'asc' } } } }); if (!order) throw notFound('Order not found.'); return data(reply, order) })
  const convertedOrderForCustomer = async (request: any, mutate = false) => {
    const customer = await requireCustomer(request, mutate)
    const order = await prisma.order.findFirst({ where: { publicToken: request.params.publicToken, customerId: customer.id, source: 'waitlist' }, include: { items: true, payments: true } })
    if (!order) throw notFound('Waitlist order not found.')
    return { customer, order }
  }
  const convertedOrderState = (order: any) => {
    const addressRequired = !order.shippingAddress || !Object.keys(order.shippingAddress).length
    const balanceDue = Math.max(0, Number(addressRequired ? (order.remainingBalancePaise ?? order.totalPaise ?? 0) : (order.totalPaise ?? order.remainingBalancePaise ?? 0)))
    const paymentConfirmationPending = Boolean(!order.balancePaidAt && order.payments?.some((payment: any) => payment.provider === 'razorpay_waitlist_balance' && [PaymentStatus.pending, PaymentStatus.authorised].includes(payment.status)))
    const deadlineExpired = Boolean(order.completionDeadlineAt && new Date(order.completionDeadlineAt).getTime() < Date.now() && !order.balancePaidAt && balanceDue > 0)
    return { addressRequired, balanceDuePaise: balanceDue, paymentConfirmationPending, deadlineExpired, requiredAction: deadlineExpired ? 'expired' : addressRequired ? 'address_required' : paymentConfirmationPending ? 'payment_confirmation_pending' : balanceDue > 0 && !order.balancePaidAt ? 'payment_due' : humaniseOrderStatus(order.status) }
  }
  routes.post('/api/v1/customer/orders/:publicToken/address', async (request, reply) => {
    const { customer, order } = await convertedOrderForCustomer(request, true)
    if (convertedOrderState(order).deadlineExpired) throw new ApiError(410, 'ORDER_DEADLINE_EXPIRED', 'This waitlist order has passed its completion deadline. Please contact SkinFox support for help.')
    const address = addressSchema.parse(request.body)
    const serviceable = await shipping.serviceable(address.pincode)
    if (!serviceable) throw new ApiError(422, 'DELIVERY_UNAVAILABLE', 'We do not deliver to this pincode yet. Try another saved address.')
    const saveAddress = request.body?.saveAddress !== false
    const updated = await prisma.$transaction(async (tx) => {
      if (saveAddress) {
        const existing = await tx.address.findFirst({ where: { customerId: customer.id, fullName: address.fullName, phone: address.phone, addressLine1: address.addressLine1, pincode: address.pincode } })
        if (!existing) await tx.address.create({ data: { ...address, customerId: customer.id, isDefault: Boolean(request.body?.saveAsDefault) } })
      }
      const quote = calculateCart(order.items.map((item: any) => ({ quantity: item.quantity, unitPricePaise: item.unitSellingPricePaise, mrpPaise: item.mrpPaise })), null, true, false)
      const shippingPaise = quote.shippingPaise
      const nextTotal = Math.max(0, quote.totalPaise - Number(order.reservationCreditPaise ?? 0))
      const nextStatus = nextTotal === 0 ? OrderStatus.confirmed : order.status
      const next = await tx.order.update({ where: { id: order.id }, data: { shippingAddress: address as any, shippingPaise, taxPaise: quote.taxPaise, totalPaise: nextTotal, remainingBalancePaise: nextTotal, ...(nextStatus !== order.status ? { status: nextStatus, statusEvents: { create: { fromStatus: order.status, toStatus: nextStatus, reason: 'Delivery address confirmed' } } } : {}) }, include: { items: true, payments: true } })
      return next
    })
    return data(reply, { order: updated, serviceable: true, ...convertedOrderState(updated) })
  })
  routes.get('/api/v1/customer/orders/:publicToken/balance-quote', async (request, reply) => {
    const { order } = await convertedOrderForCustomer(request)
    return data(reply, { orderNumber: order.orderNumber, waitlistId: order.waitlistReservationId, currency: order.currency, mrpSubtotalPaise: order.mrpSubtotalPaise ?? order.subtotalPaise, memberProductSubtotalPaise: Math.max(0, Number(order.subtotalPaise) - Number(order.discountPaise)), waitlistDiscountPaise: order.waitlistDiscountPaise ?? order.discountPaise, reservationCreditPaise: order.reservationCreditPaise, remainingBalancePaise: order.remainingBalancePaise ?? order.totalPaise, shippingPaise: order.shippingPaise, taxPaise: order.taxPaise, totalDuePaise: order.totalPaise, ...convertedOrderState(order) })
  })
  routes.get('/api/v1/customer/orders/:publicToken/payment-status', async (request, reply) => {
    const { order } = await convertedOrderForCustomer(request)
    const state = convertedOrderState(order)
    const balancePayment = order.payments.find((payment: any) => payment.provider === 'razorpay_waitlist_balance')
    return data(reply, { orderNumber: order.orderNumber, orderStatus: order.status, confirmed: Boolean(order.balancePaidAt || (state.balanceDuePaise === 0 && !state.addressRequired)), pending: state.paymentConfirmationPending, failed: balancePayment?.status === PaymentStatus.failed, amountPaise: balancePayment?.amountPaise ?? state.balanceDuePaise, paymentStatus: balancePayment?.status ?? null, ...state })
  })
  routes.post('/api/v1/customer/orders/:publicToken/balance-order', async (request, reply) => {
    const { order } = await convertedOrderForCustomer(request, true)
    const idempotencyScope = `waitlist-balance-order:${order.id}`
    const replay = await idemReplay(request, idempotencyScope)
    if (replay) return reply.status(replay.status).send(replay.body)
    if (!payment.configured()) throw new ApiError(503, 'RAZORPAY_NOT_CONFIGURED', 'Online payment is not configured yet.')
    const state = convertedOrderState(order)
    if (state.addressRequired) throw new ApiError(400, 'ADDRESS_REQUIRED', 'Add a delivery address before paying the remaining balance.')
    if (state.deadlineExpired) throw new ApiError(410, 'ORDER_DEADLINE_EXPIRED', 'This waitlist order has passed its completion deadline. Please contact SkinFox support for help.')
    if (state.balanceDuePaise <= 0 || order.balancePaidAt || order.status === OrderStatus.confirmed) {
      const response = { alreadyPaid: true, orderNumber: order.orderNumber, amountPaise: 0 }
      await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
      return data(reply, response)
    }
    const existing = order.payments.find((item: any) => item.provider === 'razorpay_waitlist_balance' && item.status === PaymentStatus.pending)
    if (existing?.providerOrderId) {
      const response = { orderNumber: order.orderNumber, amountPaise: existing.amountPaise, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, orderId: existing.providerOrderId }
      await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
      return data(reply, response)
    }
    const providerOrder = await payment.createOrder({ amountPaise: state.balanceDuePaise, receipt: `sfwlbal_${order.id}`, notes: { order: order.publicToken, purpose: 'waitlist_balance' } })
    const paymentRecord = await prisma.payment.create({ data: { orderId: order.id, provider: 'razorpay_waitlist_balance', providerOrderId: providerOrder.providerOrderId, amountPaise: state.balanceDuePaise, status: PaymentStatus.pending } })
    const response = { orderNumber: order.orderNumber, amountPaise: paymentRecord.amountPaise, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, orderId: paymentRecord.providerOrderId }
    await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
    return data(reply, response)
  })
  routes.post('/api/v1/customer/orders/:publicToken/balance-verify', async (request, reply) => {
    const { order } = await convertedOrderForCustomer(request, true)
    const idempotencyScope = `waitlist-balance-verify:${order.id}`
    const replay = await idemReplay(request, idempotencyScope)
    if (replay) return reply.status(replay.status).send(replay.body)
    const input = z.object({ razorpayOrderId: z.string().min(6), razorpayPaymentId: z.string().min(6), razorpaySignature: z.string().min(16) }).parse(request.body)
    const paymentRecord = await prisma.payment.findFirst({ where: { orderId: order.id, provider: 'razorpay_waitlist_balance', providerOrderId: input.razorpayOrderId } })
    if (!paymentRecord || !payment.verifyPayment({ orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, signature: input.razorpaySignature })) throw new ApiError(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment verification failed. Your order balance is still due.')
    let providerPayment
    try {
      providerPayment = await payment.fetchPayment(input.razorpayPaymentId)
    } catch (cause) {
      request.log.error({ err: cause, orderId: order.id, paymentId: input.razorpayPaymentId }, 'waitlist balance payment status fetch failed')
      const response = { confirmed: false, pending: true, orderStatus: order.status, message: 'Payment received; confirmation is still pending. Please do not pay again.' }
      await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
      return data(reply, response)
    }
    if (providerPayment.providerOrderId !== paymentRecord.providerOrderId || providerPayment.amountPaise !== paymentRecord.amountPaise || providerPayment.currency !== order.currency) throw new ApiError(400, 'PAYMENT_DETAILS_MISMATCH', 'The payment does not match this order balance.')
    if (providerPayment.status !== 'captured') {
      const response = { confirmed: false, pending: providerPayment.status !== 'failed', orderStatus: order.status }
      await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
      return data(reply, response)
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentRecord.id }, data: { providerPaymentId: providerPayment.providerPaymentId, status: PaymentStatus.captured, capturedPaise: providerPayment.amountPaise } })
      return tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.confirmed, balancePaidAt: new Date(), remainingBalancePaise: 0, totalPaise: 0, statusEvents: { create: { fromStatus: order.status, toStatus: OrderStatus.confirmed, reason: 'Waitlist balance payment captured' } } } })
    })
    const response = { confirmed: true, orderNumber: updated.orderNumber, orderStatus: updated.status, remainingBalancePaise: 0 }
    await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
    return data(reply, response)
  })

  const founderClaimedCount = () => prisma.customer.count({ where: { founderNumber: { not: null } } })
  const waitlistConfig = (founderClaimed = 0, revealFounderPrice = false) => ({
    ...activeWaitlistSettings,
    founderPricePaise: revealFounderPrice || activeWaitlistSettings.stage !== 'waitlist' ? activeWaitlistSettings.founderPricePaise : null,
    currency: 'INR',
    refundable: activeWaitlistSettings.refundable,
    paymentConfigured: payment.configured(),
    razorpayKeyId: payment.configured() ? process.env.RAZORPAY_KEY_ID : undefined,
    founderClaimed,
    founderRemaining: Math.max(0, activeWaitlistSettings.founderCapacity - founderClaimed),
    foundingClosed: founderClaimed >= activeWaitlistSettings.founderCapacity,
  })
  const waitlistResponse = (reservation: any) => ({
    publicToken: reservation.publicToken,
    waitlistId: reservation.waitlistId,
    status: reservation.status,
    currency: reservation.currency,
    depositPaise: reservation.depositPaise,
    discountPercent: reservation.discountPercent,
    pricingMode: reservation.pricingMode ?? 'discount_off_mrp',
    pricingValuePaise: reservation.pricingValuePaise ?? null,
    paymentCapturedPaise: reservation.paymentCapturedPaise,
    refundPaise: reservation.refundPaise,
    refundStatus: reservation.refundStatus,
    joinedAt: reservation.joinedAt,
    cancelledAt: reservation.cancelledAt,
    refundedAt: reservation.refundedAt,
    createdAt: reservation.createdAt,
    providerOrderId: reservation.providerOrderId,
    founderNumber: reservation.customer?.founderNumber ?? null,
    founderCapacity: activeWaitlistSettings.founderCapacity,
    convertedOrder: reservation.convertedOrder ? { publicToken: reservation.convertedOrder.publicToken, orderNumber: reservation.convertedOrder.orderNumber, status: reservation.convertedOrder.status, totalPaise: reservation.convertedOrder.totalPaise, remainingBalancePaise: reservation.convertedOrder.remainingBalancePaise, shippingAddress: reservation.convertedOrder.shippingAddress } : null,
    items: reservation.items?.map((item: any) => ({ productId: item.productId, productName: item.productName, productSlug: item.productSlug, size: item.size, quantity: item.quantity })) ?? [],
  })

  const claimFounderPlace = async (customerId: string) => {
    const result = await prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock returns PostgreSQL's `void` type. `$queryRaw`
      // tries to deserialize query results, which causes a P2010 error for a
      // successful lock acquisition. `$executeRaw` is the correct API for a
      // statement whose return value is intentionally ignored.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(736546683200::bigint)`
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { founderNumber: true } })
      if (customer.founderNumber) return { founderNumber: customer.founderNumber, autoLaunched: false }
      const latest = await tx.customer.aggregate({ _max: { founderNumber: true } })
      const next = (latest._max.founderNumber ?? 0) + 1
      if (next > activeWaitlistSettings.founderCapacity) return { founderNumber: null, autoLaunched: false }
      await tx.customer.update({ where: { id: customerId }, data: { founderNumber: next, founderJoinedAt: new Date() } })
      const autoLaunched = next === activeWaitlistSettings.founderCapacity && activeWaitlistSettings.stage === 'waitlist'
      if (autoLaunched) {
        const launchSettings = { ...activeWaitlistSettings, enabled: false, stage: 'launch' as const }
        await tx.storeSetting.upsert({ where: { key: 'waitlist-config' }, update: { value: launchSettings }, create: { key: 'waitlist-config', value: launchSettings } })
        await tx.product.updateMany({ where: { status: PublicationStatus.published }, data: { pricePaise: launchSettings.launchPricePaise, mrpPaise: launchSettings.regularPricePaise, purchaseState: PurchaseState.available } })
        await tx.productVariant.updateMany({ where: { product: { status: PublicationStatus.published } }, data: { pricePaise: launchSettings.launchPricePaise, mrpPaise: launchSettings.regularPricePaise, purchaseState: PurchaseState.available } })
      }
      return { founderNumber: next, autoLaunched }
    })
    if (result.autoLaunched) activeWaitlistSettings = { ...activeWaitlistSettings, enabled: false, stage: 'launch' }
    return result.founderNumber
  }

  const waitlistPricingMode = (value: unknown): WaitlistPricingMode => ['exact_revealed_price', 'discount_off_mrp', 'percentage_of_mrp'].includes(String(value)) ? String(value) as WaitlistPricingMode : 'discount_off_mrp'
  const waitlistDeadline = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const loadWaitlistConversionPreview = async () => {
    const reservations = await prisma.waitlistReservation.findMany({ where: { status: WaitlistStatus.joined, paymentCapturedPaise: { gt: 0 } }, include: { items: true, customer: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } })
    const productIds = [...new Set(reservations.flatMap((reservation) => reservation.items.map((item) => item.productId)))]
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { variants: { include: { inventory: true } } } })
    const productById = new Map(products.map((product) => [product.id, product]))
    const demand = new Map<string, number>()
    const previews: any[] = []
    let deposits = 0
    let mrp = 0
    let member = 0
    let overCredit = 0
    for (const reservation of reservations) {
      const missing = reservation.items.filter((item) => !productById.has(item.productId))
      if (missing.length) { previews.push({ waitlistId: reservation.waitlistId, reservationId: reservation.id, customer: reservation.customer.fullName, status: 'blocked', reason: 'One or more products no longer exist.' }); continue }
      let pricing
      try {
        pricing = calculateWaitlistOrderPricing(reservation.items.map((item) => {
          const product: any = productById.get(item.productId)
          return { productId: item.productId, productName: item.productName, productSlug: item.productSlug, size: item.size, quantity: item.quantity, mrpPaise: product.mrpPaise ?? activeWaitlistSettings.regularPricePaise, exactPricePaise: reservation.pricingValuePaise ?? activeWaitlistSettings.founderPricePaise }
        }), { mode: waitlistPricingMode(reservation.pricingMode), percent: reservation.discountPercent, reservationCreditPaise: reservation.paymentCapturedPaise })
      } catch (cause: any) {
        previews.push({ waitlistId: reservation.waitlistId, reservationId: reservation.id, customer: reservation.customer.fullName, status: 'blocked', reason: cause?.message ?? 'Pricing snapshot is invalid.' })
        overCredit += reservation.paymentCapturedPaise
        continue
      }
      for (const item of reservation.items) demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity)
      deposits += reservation.paymentCapturedPaise
      mrp += pricing.mrpSubtotalPaise
      member += pricing.memberProductSubtotalPaise
      previews.push({ waitlistId: reservation.waitlistId, reservationId: reservation.id, customer: reservation.customer.fullName, status: 'ready', productCount: reservation.items.reduce((sum, item) => sum + item.quantity, 0), mrpSubtotalPaise: pricing.mrpSubtotalPaise, memberProductSubtotalPaise: pricing.memberProductSubtotalPaise, reservationCreditPaise: pricing.reservationCreditPaise, remainingBalancePaise: pricing.remainingProductBalancePaise, pricingMode: pricing.mode })
    }
    const inventoryShortages = [...demand.entries()].flatMap(([productId, quantity]) => {
      const product: any = productById.get(productId)
      const available = product?.variants?.reduce((sum: number, variant: any) => sum + variant.inventory.reduce((inner: number, row: any) => inner + row.availableQty - row.reservedQty, 0), 0) ?? 0
      return available < quantity ? [{ productId, productName: product?.name ?? productId, demand: quantity, available }] : []
    })
    return { eligibleReservations: previews.filter((item) => item.status === 'ready').length, blockedReservations: previews.filter((item) => item.status !== 'ready').length, totalProductQty: [...demand.values()].reduce((sum, value) => sum + value, 0), mrpSubtotalPaise: mrp, memberProductSubtotalPaise: member, waitlistDiscountPaise: mrp - member, depositsCollectedPaise: deposits, estimatedRemainingPaise: Math.max(0, member - deposits), inventoryShortages, overCredit, reservations: previews }
  }
  const convertWaitlistReservation = async (reservationId: string, deadlineDays: number) => {
    const existing = await prisma.order.findUnique({ where: { waitlistReservationId: reservationId }, include: { items: true } })
    if (existing) return { order: existing, converted: false, reason: 'already_converted' }
    const reservation: any = await prisma.waitlistReservation.findUnique({ where: { id: reservationId }, include: { items: true, customer: true } })
    if (!reservation || reservation.status !== WaitlistStatus.joined || reservation.paymentCapturedPaise <= 0) return { order: null, converted: false, reason: 'not_eligible' }
    const products: any[] = await prisma.product.findMany({ where: { id: { in: reservation.items.map((item: any) => item.productId) } }, include: { variants: true } })
    const productById = new Map(products.map((product) => [product.id, product]))
    const pricing = calculateWaitlistOrderPricing(reservation.items.map((item: any) => {
      const product: any = productById.get(item.productId)
      if (!product) throw new ApiError(409, 'WAITLIST_PRODUCT_MISSING', `Product ${item.productName} is no longer available.`)
      return { productId: item.productId, productName: item.productName, productSlug: item.productSlug, size: item.size, quantity: item.quantity, mrpPaise: product.mrpPaise ?? activeWaitlistSettings.regularPricePaise, exactPricePaise: reservation.pricingValuePaise ?? activeWaitlistSettings.founderPricePaise }
    }), { mode: waitlistPricingMode(reservation.pricingMode), percent: reservation.discountPercent, reservationCreditPaise: reservation.paymentCapturedPaise })
    const completionDeadline = waitlistDeadline(deadlineDays)
    const order = await prisma.$transaction(async (tx) => {
      const race = await tx.order.findUnique({ where: { waitlistReservationId: reservation.id } })
      if (race) return race
      const systemCart = await tx.cart.create({ data: { tokenHash: hashToken(randomToken(32)), currency: reservation.currency, expiresAt: completionDeadline } })
      const checkoutSession = await tx.checkoutSession.create({ data: { publicToken: randomToken(24), cartId: systemCart.id, customerId: reservation.customerId, status: 'converted', paymentMethod: 'razorpay', quote: pricing as any, expiresAt: completionDeadline } })
      const created = await tx.order.create({
        data: {
          publicToken: randomToken(24),
          orderNumber: `SF-WL-${new Date().getFullYear()}-${randomToken(4).toUpperCase()}`,
          customerId: reservation.customerId,
          checkoutSessionId: checkoutSession.id,
          source: 'waitlist',
          waitlistReservationId: reservation.id,
          status: OrderStatus.pending_payment,
          currency: reservation.currency,
          subtotalPaise: pricing.mrpSubtotalPaise,
          discountPaise: pricing.waitlistDiscountPaise,
          taxPaise: pricing.taxPaise,
          shippingPaise: pricing.shippingPaise,
          codPaise: 0,
          totalPaise: pricing.finalAmountDuePaise,
          shippingAddress: null,
          pricingMode: pricing.mode,
          pricingPercent: pricing.percent,
          mrpSubtotalPaise: pricing.mrpSubtotalPaise,
          waitlistDiscountPaise: pricing.waitlistDiscountPaise,
          reservationCreditPaise: pricing.reservationCreditPaise,
          remainingBalancePaise: pricing.remainingProductBalancePaise,
          conversionSnapshot: pricing as any,
          completionDeadlineAt: completionDeadline,
          convertedAt: new Date(),
          items: {
            create: pricing.lines.map((line) => {
              const product: any = productById.get(line.productId)
              const variant = product?.variants?.find((candidate: any) => candidate.size === line.size) ?? product?.variants?.[0]
              return { productId: line.productId, variantId: variant?.id, productName: line.productName, variantName: line.size, sku: variant?.sku ?? line.productSlug, size: line.size, primaryImage: product?.image ?? '', unitSellingPricePaise: line.unitMemberPricePaise, mrpPaise: line.mrpPaise, discountPaise: line.lineDiscountPaise, taxRateBps: 0, taxPaise: 0, finalLineTotalPaise: line.lineTotalPaise, quantity: line.quantity }
            }),
          },
          payments: { create: { provider: 'razorpay_waitlist_credit', providerOrderId: reservation.providerOrderId, providerPaymentId: reservation.providerPaymentId, amountPaise: reservation.paymentCapturedPaise, capturedPaise: reservation.paymentCapturedPaise, status: PaymentStatus.captured } },
          statusEvents: { create: { toStatus: OrderStatus.pending_payment, reason: 'Created from captured waitlist reservation' } },
        },
      })
      for (const line of pricing.lines) {
        const product: any = productById.get(line.productId)
        const variant = product?.variants?.find((candidate: any) => candidate.size === line.size) ?? product?.variants?.[0]
        if (!variant) throw new ApiError(409, 'WAITLIST_VARIANT_MISSING', `Variant for ${line.productName} is no longer available.`)
        const inventoryRows = await tx.inventoryItem.findMany({ where: { variantId: variant.id }, orderBy: { availableQty: 'desc' } })
        let reserved = false
        for (const inventory of inventoryRows) {
          const claimed = await tx.$executeRaw`UPDATE "InventoryItem" SET "reservedQty" = "reservedQty" + ${line.quantity} WHERE "id" = ${inventory.id} AND "availableQty" - "reservedQty" >= ${line.quantity}`
          if (!claimed) continue
          await tx.inventoryReservation.create({ data: { variantId: variant.id, locationId: inventory.locationId, checkoutSessionId: checkoutSession.id, quantity: line.quantity, expiresAt: completionDeadline } })
          await tx.inventoryMovement.create({ data: { variantId: variant.id, locationId: inventory.locationId, type: 'reservation_hold', quantity: line.quantity, orderId: created.id, reason: 'Waitlist order conversion hold' } })
          reserved = true
          break
        }
        if (!reserved) throw new ApiError(409, 'WAITLIST_INVENTORY_SHORTAGE', `Inventory changed while preparing ${line.productName}. Refresh the conversion preview and try again.`)
      }
      await tx.waitlistReservation.update({ where: { id: reservation.id }, data: { status: WaitlistStatus.converted } })
      return created
    })
    return { order, converted: true, reason: 'converted' }
  }

  routes.get('/api/v1/waitlist/config', async (_, reply) => data(reply, waitlistConfig(await founderClaimedCount())))
  routes.get('/api/v1/customer/waitlist', async (request, reply) => {
    const customer = await requireCustomer(request)
    const reservations = await prisma.waitlistReservation.findMany({ where: { customerId: customer.id }, include: { items: true, customer: { select: { founderNumber: true } }, convertedOrder: { select: { publicToken: true, orderNumber: true, status: true, totalPaise: true, remainingBalancePaise: true, shippingAddress: true } } }, orderBy: { createdAt: 'desc' } })
    return data(reply, reservations.map(waitlistResponse))
  })
  routes.post('/api/v1/waitlist/reservations', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const currentWaitlist = { ...activeWaitlistSettings }
    if (!currentWaitlist.enabled) throw new ApiError(409, 'WAITLIST_CLOSED', 'The priority waitlist is not open right now.')
    if (currentWaitlist.stage !== 'waitlist') throw new ApiError(409, 'WAITLIST_STAGE_CLOSED', 'New priority waitlist reservations are not available in the current launch stage.')
    if (await founderClaimedCount() >= currentWaitlist.founderCapacity) throw new ApiError(409, 'FOUNDING_200_CLOSED', 'The priority waitlist is now closed. The launch price will be available next.')
    if (!payment.configured()) throw new ApiError(503, 'RAZORPAY_NOT_CONFIGURED', 'Online waitlist payment is being configured. Please try again shortly.')
    const customer = await requireCustomer(request, true)
    if (!customer.emailVerifiedAt) throw new ApiError(400, 'CUSTOMER_EMAIL_UNVERIFIED', 'Verify your email address before joining the priority waitlist.')
    const input = z.object({
      items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(8) })).min(1).max(20),
      phone: deliveryPhoneSchema,
      consent: z.literal(true),
      termsVersion: z.string().trim().min(1).max(40),
    }).parse(request.body)
    if (input.termsVersion !== currentWaitlist.termsVersion) throw validationError('The waitlist terms have changed. Review the latest terms and try again.', { termsVersion: 'Please accept the current waitlist terms.' })
    const idempotencyKey = z.string().min(8).max(160).parse(request.headers['idempotency-key'])
    const replay = await prisma.waitlistReservation.findUnique({ where: { idempotencyKey }, include: { items: true } })
    if (replay) {
      if (replay.customerId !== customer.id) throw forbidden('This payment request belongs to another customer.')
      return data(reply, { reservation: waitlistResponse(replay), checkout: { keyId: process.env.RAZORPAY_KEY_ID, orderId: replay.providerOrderId, amountPaise: replay.depositPaise, currency: replay.currency } })
    }
    const quantities = new Map<string, number>()
    for (const item of input.items) quantities.set(item.productId, Math.min(8, (quantities.get(item.productId) ?? 0) + item.quantity))
    const identifiers = [...quantities.keys()]
    const products = await prisma.product.findMany({ where: { status: PublicationStatus.published, OR: [{ id: { in: identifiers } }, { slug: { in: identifiers } }] } })
    if (products.length !== identifiers.length) throw validationError('One or more selected products are no longer available for the waitlist.')
    const reservationItems = products.map((product) => ({ productId: product.id, productName: product.name, productSlug: product.slug, size: product.size, quantity: quantities.get(product.id) ?? quantities.get(product.slug) ?? 1 }))
    const totalDepositPaise = calculateWaitlistDepositPaise(currentWaitlist.depositPaise, reservationItems.map((item) => item.quantity))
    const publicToken = randomToken(24)
    const waitlistId = createWaitlistId()
    const reservation = await prisma.waitlistReservation.create({
      data: {
        publicToken,
        waitlistId,
        customerId: customer.id,
        depositPaise: totalDepositPaise,
        discountPercent: currentWaitlist.discountPercent,
        pricingMode: currentWaitlist.pricingMode,
        pricingValuePaise: currentWaitlist.pricingMode === 'exact_revealed_price' ? currentWaitlist.founderPricePaise : null,
        phone: input.phone,
        consent: input.consent,
        consentAt: new Date(),
        termsVersion: input.termsVersion,
        idempotencyKey,
        items: { create: reservationItems },
      },
      include: { items: true },
    })
    try {
      const providerOrder = await payment.createOrder({ amountPaise: totalDepositPaise, receipt: `sfwl_${reservation.id}`, notes: { reservation: reservation.publicToken, waitlist_id: reservation.waitlistId, purpose: 'priority_waitlist' } })
      const updated = await prisma.waitlistReservation.update({ where: { id: reservation.id }, data: { providerOrderId: providerOrder.providerOrderId }, include: { items: true } })
      return reply.status(201).send({ data: { reservation: waitlistResponse(updated), checkout: { keyId: process.env.RAZORPAY_KEY_ID, orderId: providerOrder.providerOrderId, amountPaise: updated.depositPaise, currency: updated.currency, name: 'SkinFox', description: 'Non-refundable priority waitlist reservation fee', prefill: { name: customer.fullName, email: customer.email, contact: `+91${input.phone}` } } }, meta: { requestId: request.id } })
    } catch (cause) {
      request.log.error({ err: cause, reservationId: reservation.id }, 'razorpay waitlist order creation failed')
      await prisma.waitlistReservation.update({ where: { id: reservation.id }, data: { status: WaitlistStatus.payment_failed } })
      throw new ApiError(502, 'RAZORPAY_ORDER_FAILED', 'We could not start the secure payment. No money was charged; please try again.')
    }
  })
  routes.post('/api/v1/waitlist/reservations/:publicToken/verify', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const input = z.object({ razorpayOrderId: z.string().min(6), razorpayPaymentId: z.string().min(6), razorpaySignature: z.string().min(16) }).parse(request.body)
    const reservation = await prisma.waitlistReservation.findFirst({ where: { publicToken: request.params.publicToken, customerId: customer.id }, include: { items: true, customer: { select: { founderNumber: true } } } })
    if (!reservation) throw notFound('Waitlist reservation not found.')
    if ([WaitlistStatus.joined, WaitlistStatus.converted].includes(reservation.status) && reservation.providerPaymentId === input.razorpayPaymentId) return data(reply, { reservation: waitlistResponse(reservation), confirmed: true })
    if (reservation.providerOrderId !== input.razorpayOrderId || !payment.verifyPayment({ orderId: reservation.providerOrderId, paymentId: input.razorpayPaymentId, signature: input.razorpaySignature })) throw new ApiError(400, 'PAYMENT_SIGNATURE_INVALID', 'Payment verification failed. Your waitlist place has not been activated.')
    let providerPayment
    try { providerPayment = await payment.fetchPayment(input.razorpayPaymentId) } catch (cause) { request.log.error({ err: cause, reservationId: reservation.id }, 'razorpay payment status fetch failed'); throw new ApiError(502, 'PAYMENT_STATUS_UNAVAILABLE', 'Payment was received but confirmation is still pending. We will update your waitlist place automatically.') }
    if (providerPayment.providerOrderId !== reservation.providerOrderId || providerPayment.amountPaise !== reservation.depositPaise || providerPayment.currency !== reservation.currency) throw new ApiError(400, 'PAYMENT_DETAILS_MISMATCH', 'The payment does not match this waitlist reservation.')
    const captured = providerPayment.status === 'captured'
    const failed = providerPayment.status === 'failed'
    if (captured) await claimFounderPlace(customer.id)
    const updated = await prisma.waitlistReservation.update({ where: { id: reservation.id }, data: { providerPaymentId: providerPayment.providerPaymentId, paymentCapturedPaise: captured ? providerPayment.amountPaise : 0, status: captured ? WaitlistStatus.joined : failed ? WaitlistStatus.payment_failed : WaitlistStatus.payment_pending, joinedAt: captured ? new Date() : null }, include: { items: true, customer: { select: { founderNumber: true } } } })
    return data(reply, { reservation: waitlistResponse(updated), confirmed: captured })
  })
  routes.post('/api/v1/waitlist/reservations/:publicToken/cancel', { config: { rateLimit: { max: 6, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const reservation = await prisma.waitlistReservation.findFirst({ where: { publicToken: request.params.publicToken, customerId: customer.id }, include: { items: true } })
    if (!reservation) throw notFound('Waitlist reservation not found.')
    throw new ApiError(409, 'WAITLIST_FEE_NON_REFUNDABLE', 'The waitlist reservation fee is non-refundable and this reservation cannot be cancelled for a refund. Contact support if you believe a payment was duplicated or processed incorrectly.')
  })

  routes.post('/api/v1/carts', async (request, reply) => { const token = randomToken(32); const cart = await prisma.cart.create({ data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }); reply.header('x-cart-token', token).setCookie('sf_cart_token', token, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), maxAge: 30 * 24 * 60 * 60, path: '/' }); const empty = await cartResponse({ ...cart, items: [], coupon: null }); return data(reply, { ...empty, cartId: token, token }) })
  routes.get('/api/v1/carts/:cartId', async (request, reply) => data(reply, await cartResponse(await getCart(request), false, true, await currentCustomer(request, false))))
  routes.post('/api/v1/carts/:cartId/items', async (request, reply) => { const input = cartItemSchema.parse(request.body); const cart = await getCart(request); const product = await prisma.product.findFirst({ where: { OR: [{ id: input.productId }, { slug: input.productId }], status: { in: [PublicationStatus.published, PublicationStatus.approved] } }, include: { variants: true } }); if (!product) throw notFound('Product is not available.'); const variantId = input.variantId ?? product.variants[0]?.id; const existing = await prisma.cartItem.findFirst({ where: { cartId: cart.id, productId: product.id, ...(variantId ? { variantId } : { variantId: null }) } }); if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(50, existing.quantity + input.quantity) } }); else await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, variantId, quantity: input.quantity } }); return data(reply, await cartResponse(await getCart(request), false, true, await currentCustomer(request, false))) })
  routes.patch('/api/v1/carts/:cartId/items/:itemId', async (request, reply) => { const quantity = z.number().int().min(0).max(50).parse(request.body?.quantity); const cart = await getCart(request); const item = cart.items.find((line: any) => line.id === request.params.itemId || line.product.id === request.params.itemId || line.product.slug === request.params.itemId); if (!item) throw notFound('Cart item not found.'); if (!quantity) await prisma.cartItem.delete({ where: { id: item.id } }); else await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } }); return data(reply, await cartResponse(await getCart(request), false, true, await currentCustomer(request, false))) })
  routes.delete('/api/v1/carts/:cartId/items/:itemId', async (request, reply) => { const cart = await getCart(request); const item = cart.items.find((line: any) => line.id === request.params.itemId || line.product.id === request.params.itemId || line.product.slug === request.params.itemId); if (!item) throw notFound('Cart item not found.'); await prisma.cartItem.delete({ where: { id: item.id } }); return data(reply, await cartResponse(await getCart(request), false, true, await currentCustomer(request, false))) })
  routes.delete('/api/v1/carts/:cartId', async (request, reply) => { const cart = await getCart(request); await prisma.cart.delete({ where: { id: cart.id } }); return data(reply, { deleted: true }) })
  routes.post('/api/v1/carts/:cartId/apply-coupon', async (request, reply) => { const code = z.string().min(2).parse(request.body?.code); const cart = await getCart(request); const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() }, include: { promotion: true } }); if (!coupon || !coupon.promotion.active || coupon.promotion.startsAt > new Date() || coupon.promotion.endsAt < new Date()) throw validationError('This coupon is not active or has expired.'); await prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } }); return data(reply, await cartResponse(await getCart(request))) })
  routes.delete('/api/v1/carts/:cartId/coupon', async (request, reply) => { const cart = await getCart(request); await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } }); return data(reply, await cartResponse(await getCart(request))) })

  routes.get('/api/v1/shipping/serviceability', async (request, reply) => {
    const pincode = String(request.query?.pincode ?? '')
    if (!isValidPincode(pincode)) throw validationError('Enter a valid six-digit pincode.')
    const paymentMethod = request.query?.paymentMethod === 'prepaid' ? 'prepaid' : 'cod'
    if (shipping === shiprocket) {
      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE
      if (!shiprocket.configured() || !pickupPincode) throw new ApiError(503, 'SHIPPING_PROVIDER_NOT_READY', 'Shiprocket is selected but API credentials or pickup pincode are not configured.')
      const result = await shiprocket.serviceability({ pickupPincode, deliveryPincode: pincode, paymentMethod, weightKg: Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG ?? 0.5) })
      return data(reply, { pincode, ...result })
    }
    const serviceable = await shipping.serviceable(pincode)
    return data(reply, { pincode, provider: 'manual', serviceable, codAvailable: Boolean(await prisma.serviceablePincode.findUnique({ where: { pincode, active: true } })) })
  })
  const makeQuote = async (request: any, sessionInput?: any, customer?: any) => {
    if (activeWaitlistSettings.enabled && activeWaitlistSettings.stage === 'waitlist') throw new ApiError(409, 'WAITLIST_ONLY', 'Product prices are not revealed yet. Join the priority waitlist instead.')
    const cart = await getCart(request)
    const bodyValue = sessionInput ?? request.body
    const parsed = checkoutSchema.parse(bodyValue)
    if (!customer?.emailVerifiedAt) throw new ApiError(400, 'CUSTOMER_EMAIL_UNVERIFIED', 'Verify your email address before placing an order.')
    let serviceable = false
    let providerQuote: any = null
    if (shipping === shiprocket) {
      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE
      if (!shiprocket.configured() || !pickupPincode) throw new ApiError(503, 'SHIPPING_PROVIDER_NOT_READY', 'Shiprocket checkout is not configured. Add credentials and pickup pincode, or switch SHIPPING_PROVIDER to manual.')
      providerQuote = await shiprocket.serviceability({ pickupPincode, deliveryPincode: parsed.pincode, paymentMethod: parsed.paymentMethod === 'cod' ? 'cod' : 'prepaid', weightKg: Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG ?? 0.5) })
      serviceable = providerQuote.serviceable
    } else serviceable = await shipping.serviceable(parsed.pincode)
    const base = await cartResponse(cart, true, serviceable, customer)
    if (activeWaitlistSettings.stage === 'founder_reveal' && base.priceHidden) throw new ApiError(403, 'FOUNDER_ACCESS_REQUIRED', 'This launch price is reserved for confirmed priority waitlist members.')
    const providerCharge = providerQuote?.couriers?.[0]?.ratePaise
    const response = providerCharge === null || providerCharge === undefined ? base : { ...base, shippingPaise: providerCharge, totalPaise: Math.max(0, Number(base.subtotalPaise) - Number(base.discountPaise) + Number(base.taxPaise) + Number(providerCharge) + Number(base.codPaise)) }
    const estimate = providerQuote?.couriers?.[0]?.estimatedDays
    return { ...response, serviceability: serviceable, shippingProvider: shipping === shiprocket ? 'shiprocket' : 'manual', courierOptions: providerQuote?.couriers ?? [], estimatedDeliveryFrom: serviceable ? new Date(Date.now() + (estimate ?? 3) * 86400000).toISOString() : null, estimatedDeliveryTo: serviceable ? new Date(Date.now() + (estimate ? estimate + 2 : 7) * 86400000).toISOString() : null, quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), checkout: { ...parsed, email: parsed.email ?? customer.email ?? undefined } }
  }
  routes.post('/api/v1/checkout/quote', async (request, reply) => { const customer = await requireCustomer(request); return data(reply, await makeQuote(request, undefined, customer)) })
  routes.post('/api/v1/checkout/sessions', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const idempotencyScope = `checkout-session:${customer.id}`
    const replay = await idemReplay(request, idempotencyScope)
    if (replay) return reply.status(replay.status).send(replay.body)
    const quote = await makeQuote(request, undefined, customer)
    if (!quote.purchaseEligible) throw validationError('Your cart is not eligible for COD.', { cart: quote.validationMessages.join(' ') })
    const cart = await getCart(request)
    if (cart.customerId && cart.customerId !== customer.id) throw forbidden('This cart belongs to a different customer session.')
    const token = randomToken(24)
    const result = await prisma.$transaction(async (tx) => {
      const selectedAddress = quote.checkout.addressId ? await tx.address.findFirst({ where: { id: quote.checkout.addressId, customerId: customer.id } }) : null
      if (quote.checkout.addressId && !selectedAddress) throw notFound('Saved address not found.')
      const updatedCustomer = await tx.customer.update({ where: { id: customer.id }, data: { fullName: quote.checkout.fullName } })
      const shippingAddress = selectedAddress
        ? { label: selectedAddress.label, fullName: selectedAddress.fullName, email: quote.checkout.email ?? updatedCustomer.email ?? undefined, phone: selectedAddress.phone, addressLine1: selectedAddress.addressLine1, addressLine2: selectedAddress.addressLine2, landmark: selectedAddress.landmark, city: selectedAddress.city, state: selectedAddress.state, pincode: selectedAddress.pincode }
        : { fullName: quote.checkout.fullName, email: quote.checkout.email ?? updatedCustomer.email ?? undefined, phone: quote.checkout.phone, addressLine1: quote.checkout.addressLine1, addressLine2: quote.checkout.addressLine2, landmark: quote.checkout.landmark, city: quote.checkout.city, state: quote.checkout.state, pincode: quote.checkout.pincode }
      if (!selectedAddress && quote.checkout.saveAddress) {
        const addressCount = await tx.address.count({ where: { customerId: customer.id } })
        const isDefault = quote.checkout.saveAsDefault || addressCount === 0
        if (isDefault) await tx.address.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } })
        await tx.address.create({ data: { customerId: customer.id, phone: quote.checkout.phone, label: 'Home', fullName: quote.checkout.fullName, addressLine1: quote.checkout.addressLine1, addressLine2: quote.checkout.addressLine2, landmark: quote.checkout.landmark, city: quote.checkout.city, state: quote.checkout.state, pincode: quote.checkout.pincode, isDefault } })
      }
      await tx.cart.update({ where: { id: cart.id }, data: { customerId: customer.id } })
      const storedQuote = { ...quote, checkout: shippingAddress }
      const session = await tx.checkoutSession.create({ data: { publicToken: token, cartId: cart.id, customerId: customer.id, paymentMethod: 'cod', quote: storedQuote as any, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } })
      await tx.checkoutQuote.create({ data: { checkoutSessionId: session.id, subtotalPaise: quote.subtotalPaise, discountPaise: quote.discountPaise, taxPaise: quote.taxPaise, shippingPaise: quote.shippingPaise, codPaise: quote.codPaise, totalPaise: quote.totalPaise, serviceable: quote.serviceability, payload: storedQuote as any, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } })
      if (quote.shippingProvider) {
        const firstCourier = Array.isArray(quote.courierOptions) ? quote.courierOptions[0] : null
        await tx.shippingQuote.create({ data: { checkoutSessionId: session.id, pincode: String(shippingAddress.pincode), serviceable: Boolean(quote.serviceability), chargePaise: Number(quote.shippingPaise ?? 0), provider: String(quote.shippingProvider), courierId: firstCourier?.id ? String(firstCourier.id) : undefined, courierName: firstCourier?.name ? String(firstCourier.name) : undefined, metadata: { couriers: quote.courierOptions ?? [], expiresAt: quote.quoteExpiresAt } as any, expiresAt: new Date(String(quote.quoteExpiresAt)) } })
      }
      const order = await tx.order.create({ data: { publicToken: randomToken(24), orderNumber: `SF-${new Date().getFullYear()}-${randomToken(4).toUpperCase()}`, checkoutSessionId: session.id, customerId: customer.id, status: OrderStatus.pending_payment, subtotalPaise: quote.subtotalPaise, discountPaise: quote.discountPaise, taxPaise: quote.taxPaise, shippingPaise: quote.shippingPaise, codPaise: quote.codPaise, totalPaise: quote.totalPaise, shippingAddress: shippingAddress as any, items: { create: quote.lines.map((line: any) => ({ productId: line.productId, variantId: line.variantId, productName: line.product.name, variantName: line.product.size, sku: line.variantId ?? line.product.slug, size: line.product.size, primaryImage: line.product.image, unitSellingPricePaise: line.unitPricePaise ?? 0, mrpPaise: line.product.mrpPaise, discountPaise: 0, taxRateBps: 1800, taxPaise: Math.floor((line.unitPricePaise ?? 0) * line.quantity * 18 / 118), finalLineTotalPaise: (line.unitPricePaise ?? 0) * line.quantity, quantity: line.quantity })) } } })
      for (const line of quote.lines) {
        if (!line.variantId) continue
        const inventory = await tx.inventoryItem.findFirst({ where: { variantId: line.variantId }, orderBy: { availableQty: 'desc' } })
        if (!inventory || inventory.availableQty - inventory.reservedQty < line.quantity) throw validationError('Stock changed while checking out. Please refresh your cart.')
        await tx.inventoryItem.update({ where: { id: inventory.id }, data: { reservedQty: { increment: line.quantity } } })
        await tx.inventoryReservation.create({ data: { variantId: line.variantId, locationId: inventory.locationId, checkoutSessionId: session.id, quantity: line.quantity, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } })
        await tx.inventoryMovement.create({ data: { variantId: line.variantId, locationId: inventory.locationId, type: 'reservation_hold', quantity: line.quantity, reason: 'Checkout reservation' } })
      }
      return { session, order }
    })
    const response = { checkoutSessionId: result.session.publicToken, orderPublicToken: result.order.publicToken, orderNumber: result.order.orderNumber, quote }
    await idemStore(request, idempotencyScope, 201, { data: response, meta: { requestId: request.id } })
    return reply.status(201).send({ data: response, meta: { requestId: request.id } })
  })
  routes.get('/api/v1/checkout/sessions/:id', async (request, reply) => { const customer = await requireCustomer(request); const session = await prisma.checkoutSession.findUnique({ where: { publicToken: request.params.id }, include: { order: true, quotes: { orderBy: { createdAt: 'desc' }, take: 1 } } }); if (!session || session.customerId !== customer.id) throw notFound('Checkout session not found.'); return data(reply, session) })
  routes.post('/api/v1/checkout/sessions/:id/payment-order', async (request) => { await requireCustomer(request, true); throw new ApiError(410, 'PAYMENT_METHOD_DISABLED', 'Online payment is not enabled. Use cash on delivery for this test release.') })
  routes.post('/api/v1/checkout/sessions/:id/confirm-cod', async (request, reply) => {
    const customer = await requireCustomer(request, true)
    const idempotencyScope = `confirm-cod:${request.params.id}`
    const replay = await idemReplay(request, idempotencyScope)
    if (replay) return reply.status(replay.status).send(replay.body)
    const session = await prisma.checkoutSession.findUnique({ where: { publicToken: request.params.id }, include: { order: true } })
    if (!session?.order || session.customerId !== customer.id) throw notFound('Checkout session not found.')
    if (session.paymentMethod !== 'cod' || session.status !== 'open') throw validationError('This checkout session cannot be confirmed as COD.')
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: session.order!.id }, data: { status: OrderStatus.confirmed, payments: { create: { provider: 'cod', amountPaise: session.order!.totalPaise, status: PaymentStatus.authorised } }, statusEvents: { create: { fromStatus: OrderStatus.pending_payment, toStatus: OrderStatus.confirmed, reason: 'COD confirmed' } } } })
      const cart = await tx.cart.findUnique({ where: { id: session.cartId }, include: { affiliate: true } })
      // A cart keeps its first approved referral. Self-referrals never generate a wallet credit.
      if (cart?.affiliate && cart.affiliate.status === AffiliateStatus.approved && cart.affiliate.phone !== customer.phone) {
        const commissionPaise = affiliateCommissionPaise(updated.subtotalPaise, updated.discountPaise)
        if (commissionPaise > 0) {
          const attribution = await tx.affiliateAttribution.upsert({ where: { orderId: updated.id }, update: {}, create: { affiliateId: cart.affiliate.id, orderId: updated.id, referralCode: cart.affiliate.referralCode, commissionPaise } })
          await tx.affiliateWalletEntry.upsert({ where: { attributionId: attribution.id }, update: {}, create: { affiliateId: cart.affiliate.id, type: AffiliateWalletEntryType.commission, amountPaise: commissionPaise, description: `10% commission for ${updated.orderNumber}`, attributionId: attribution.id } })
        }
      }
      await tx.checkoutSession.update({ where: { id: session.id }, data: { status: 'confirmed' } })
      await tx.cartItem.deleteMany({ where: { cartId: session.cartId } })
      return updated
    })
    const response = { orderPublicToken: order.publicToken, orderNumber: order.orderNumber, status: order.status }
    await idemStore(request, idempotencyScope, 200, { data: response, meta: { requestId: request.id } })
    return data(reply, response)
  })
  routes.post('/api/v1/payments/razorpay/verify', async (request) => { await requireCustomer(request, true); throw new ApiError(410, 'PAYMENT_ROUTE_REPLACED', 'Use the reservation-specific waitlist verification endpoint for Razorpay deposits.') })
  routes.post('/api/v1/shipping/webhook', async (request, reply) => {
    if (shipping !== shiprocket) return data(reply, { accepted: false, ignored: true, provider: 'manual' })
    const configuredToken = process.env.SHIPROCKET_WEBHOOK_TOKEN
    const receivedToken = String(request.headers['x-shiprocket-webhook-token'] ?? request.headers['x-webhook-token'] ?? '')
    if (!configuredToken || !receivedToken || !safeEqual(configuredToken, receivedToken)) throw new ApiError(401, 'WEBHOOK_TOKEN_INVALID', 'Shiprocket webhook token verification failed.')
    const payload: any = request.body ?? {}
    const externalId = String(request.headers['x-shiprocket-event-id'] ?? payload.id ?? payload.event_id ?? sha256Json(payload))
    const existing = await prisma.webhookEvent.findUnique({ where: { provider_externalId: { provider: 'shiprocket', externalId } } })
    if (existing?.processedAt) return data(reply, { accepted: true, replay: true })
    const event = existing ?? await prisma.webhookEvent.create({ data: { provider: 'shiprocket', externalId, eventType: String(payload.event ?? payload.current_status ?? 'shipment.updated'), payload } })
    const providerShipmentId = String(payload.shipment_id ?? payload.data?.shipment_id ?? payload.shipment?.shipment_id ?? '')
    const awb = String(payload.awb ?? payload.awb_code ?? payload.data?.awb_code ?? payload.shipment?.awb ?? '')
    const nextStatusRaw = String(payload.current_status ?? payload.status ?? payload.data?.status ?? 'updated')
    const nextStatus = nextStatusRaw.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const shipment = await prisma.shipment.findFirst({ where: { provider: 'shiprocket', ...(providerShipmentId ? { providerShipmentId } : awb ? { trackingNumber: awb } : {}) } })
    if (shipment) {
      const orderStatus = nextStatus.includes('delivered') ? OrderStatus.delivered : nextStatus.includes('shipped') || nextStatus.includes('picked') || nextStatus.includes('transit') ? OrderStatus.shipped : undefined
      await prisma.$transaction(async (tx) => {
        await tx.shipment.update({ where: { id: shipment.id }, data: { status: nextStatus, providerStatus: nextStatusRaw, ...(awb ? { trackingNumber: awb } : {}), lastSyncedAt: new Date(), events: { create: { status: nextStatus, externalId, payload } } } })
        if (orderStatus && shipment.orderId) await tx.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } })
        await tx.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
      })
    } else await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
    return data(reply, { accepted: true, matched: Boolean(shipment), externalId })
  })
  routes.post('/api/v1/webhooks/payments/razorpay', async (request, reply) => {
    const signature = String(request.headers['x-razorpay-signature'] ?? '')
    const rawBody = String((request as any).rawBody ?? '')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret || !signature || !safeEqual(signHmac(rawBody, secret), signature)) throw new ApiError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook signature verification failed.')
    const payload: any = request.body ?? {}
    const eventId = String(request.headers['x-razorpay-event-id'] ?? payload.id ?? randomToken(18))
    const existing = await prisma.webhookEvent.findUnique({ where: { provider_externalId: { provider: 'razorpay', externalId: eventId } } })
    if (existing?.processedAt) return data(reply, { accepted: true, replay: true })
    const event = existing ?? await prisma.webhookEvent.create({ data: { provider: 'razorpay', externalId: eventId, eventType: String(payload.event ?? 'unknown'), payload } })
    const paymentEntity = payload.payload?.payment?.entity
    if (paymentEntity?.order_id) {
      const providerOrderId = String(paymentEntity.order_id)
      const paymentRecord = await prisma.payment.findFirst({ where: { providerOrderId } })
      if (paymentRecord) {
        const captured = payload.event === 'payment.captured'
        await prisma.$transaction([
          prisma.payment.update({ where: { id: paymentRecord.id }, data: { providerPaymentId: paymentEntity.id, status: captured ? PaymentStatus.captured : payload.event === 'payment.failed' ? PaymentStatus.failed : PaymentStatus.authorised, capturedPaise: captured ? paymentEntity.amount ?? paymentRecord.capturedPaise : paymentRecord.capturedPaise } }),
          prisma.paymentEvent.upsert({ where: { paymentId_externalId: { paymentId: paymentRecord.id, externalId: eventId } }, update: { type: String(payload.event ?? 'unknown'), payload }, create: { paymentId: paymentRecord.id, externalId: eventId, type: String(payload.event ?? 'unknown'), payload } }),
          prisma.order.update({ where: { id: paymentRecord.orderId }, data: paymentRecord.provider === 'razorpay_waitlist_balance' && captured ? { status: OrderStatus.confirmed, balancePaidAt: new Date(), remainingBalancePaise: 0, totalPaise: 0 } : { status: captured ? OrderStatus.confirmed : payload.event === 'payment.failed' ? OrderStatus.payment_failed : OrderStatus.pending_payment } }),
        ])
      }
      const waitlist = await prisma.waitlistReservation.findUnique({ where: { providerOrderId } })
      if (waitlist && Number(paymentEntity.amount) === waitlist.depositPaise) {
        if (payload.event === 'payment.captured') {
          const cancelledBeforeCapture = Boolean(waitlist.cancelledAt) && [WaitlistStatus.cancelled, WaitlistStatus.refund_pending].includes(waitlist.status)
          if (cancelledBeforeCapture) {
            await prisma.waitlistReservation.update({ where: { id: waitlist.id }, data: { providerPaymentId: String(paymentEntity.id), paymentCapturedPaise: Number(paymentEntity.amount), status: WaitlistStatus.refund_pending, refundStatus: 'queued' } })
            const refund = await payment.refund({ paymentId: String(paymentEntity.id), amountPaise: Number(paymentEntity.amount), idempotencyKey: `late-capture-refund-${waitlist.id}` })
            const processed = refund.status === 'processed'
            await prisma.waitlistReservation.update({ where: { id: waitlist.id }, data: { providerRefundId: refund.providerRefundId, refundPaise: Number(paymentEntity.amount), refundStatus: refund.status, status: processed ? WaitlistStatus.refunded : WaitlistStatus.refund_pending, refundedAt: processed ? new Date() : null } })
          } else {
            await claimFounderPlace(waitlist.customerId)
            await prisma.waitlistReservation.update({ where: { id: waitlist.id }, data: { providerPaymentId: String(paymentEntity.id), paymentCapturedPaise: Number(paymentEntity.amount), status: WaitlistStatus.joined, joinedAt: waitlist.joinedAt ?? new Date() } })
          }
        }
        if (payload.event === 'payment.failed' && !waitlist.cancelledAt) await prisma.waitlistReservation.update({ where: { id: waitlist.id }, data: { providerPaymentId: String(paymentEntity.id), status: WaitlistStatus.payment_failed } })
      }
    }
    const refundEntity = payload.payload?.refund?.entity
    if (refundEntity?.payment_id) {
      const waitlist = await prisma.waitlistReservation.findUnique({ where: { providerPaymentId: String(refundEntity.payment_id) } })
      if (waitlist && Number(refundEntity.amount) === waitlist.paymentCapturedPaise) {
        const processed = payload.event === 'refund.processed' || refundEntity.status === 'processed'
        await prisma.waitlistReservation.update({ where: { id: waitlist.id }, data: { providerRefundId: String(refundEntity.id), refundPaise: Number(refundEntity.amount), refundStatus: String(refundEntity.status ?? payload.event), status: processed ? WaitlistStatus.refunded : WaitlistStatus.refund_pending, refundedAt: processed ? new Date() : null } })
      }
    }
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
    return data(reply, { accepted: true })
  })
  routes.get('/api/v1/payments/:publicToken/status', async (request, reply) => { const order = await prisma.order.findUnique({ where: { publicToken: request.params.publicToken }, include: { payments: true } }); if (!order) throw notFound('Payment status not found.'); return data(reply, { orderStatus: order.status, payments: order.payments.map((p) => ({ provider: p.provider, status: p.status, amountPaise: p.amountPaise })) }) })
  routes.get('/api/v1/orders/:publicToken', async (request, reply) => { const order = await prisma.order.findUnique({ where: { publicToken: request.params.publicToken }, include: { items: true, payments: true, shipments: true, statusEvents: { orderBy: { createdAt: 'asc' } } } }); if (!order) throw notFound('Order not found.'); return data(reply, order) })
  routes.get('/api/v1/orders/:publicToken/tracking', async (request, reply) => { const order = await prisma.order.findUnique({ where: { publicToken: request.params.publicToken }, include: { shipments: { include: { events: { orderBy: { createdAt: 'asc' } } } } } }); if (!order) throw notFound('Order not found.'); return data(reply, { status: order.status, shipments: order.shipments }) })
  routes.post('/api/v1/orders/:publicToken/cancel-request', async (request, reply) => { const order = await prisma.order.findUnique({ where: { publicToken: request.params.publicToken } }); if (!order) throw notFound('Order not found.'); if (![OrderStatus.pending_payment, OrderStatus.confirmed].includes(order.status)) throw validationError('This order can no longer be cancelled.'); return data(reply, await prisma.$transaction(async (tx) => { const updated = await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.cancelled, statusEvents: { create: { fromStatus: order.status, toStatus: OrderStatus.cancelled, reason: String(request.body?.reason ?? 'Customer request') } } } }); if (order.checkoutSessionId) { const holds = await tx.inventoryReservation.findMany({ where: { checkoutSessionId: order.checkoutSessionId, releasedAt: null } }); for (const hold of holds) { const claimed = await tx.inventoryReservation.updateMany({ where: { id: hold.id, releasedAt: null }, data: { releasedAt: new Date() } }); if (!claimed.count) continue; await tx.inventoryItem.update({ where: { variantId_locationId: { variantId: hold.variantId, locationId: hold.locationId } }, data: { reservedQty: { decrement: hold.quantity } } }); await tx.inventoryMovement.create({ data: { variantId: hold.variantId, locationId: hold.locationId, type: 'reservation_release', quantity: hold.quantity, orderId: order.id, reason: 'Customer cancellation' } }) } } return updated })) })
  routes.post('/api/v1/orders/:publicToken/return-request', async (request, reply) => { const order = await prisma.order.findUnique({ where: { publicToken: request.params.publicToken } }); if (!order) throw notFound('Order not found.'); if (order.status !== OrderStatus.delivered) throw validationError('Returns are available after delivery.'); return data(reply, await prisma.returnRequest.create({ data: { orderId: order.id, reason: String(request.body?.reason ?? 'Customer request') } })) })
  routes.post('/api/v1/launch-interest', async (request, reply) => { const input = z.object({ productIds: z.array(z.string()).default([]), cartSnapshot: z.unknown().optional(), name: z.string().min(2), email: z.string().email(), phone: z.string().regex(/^[6-9]\d{9}$/).optional(), pincode: z.string().regex(/^[1-9]\d{5}$/), consent: z.literal(true), privacyPolicyVersion: z.string().min(1), source: z.string().optional() }).parse(request.body); const result = await prisma.launchInterest.create({ data: { ...input, consentAt: new Date(), cartSnapshot: input.cartSnapshot as Prisma.InputJsonValue } }); await email.send({ to: input.email, subject: 'SkinFox launch interest received', html: '<p>Thank you for your interest in SkinFox.</p>' }); return reply.status(201).send({ data: { accepted: true, id: result.id }, meta: { requestId: request.id } }) })
  routes.post('/api/v1/newsletter/subscriptions', async (request, reply) => { const emailValue = z.string().email().parse(request.body?.email); const token = randomToken(24); const result = await prisma.newsletterSubscription.upsert({ where: { email: emailValue.toLowerCase() }, update: { tokenHash: hashToken(token), consentAt: new Date(), unsubscribedAt: null }, create: { email: emailValue.toLowerCase(), tokenHash: hashToken(token), consentAt: new Date() } }); await email.send({ to: result.email, subject: 'Confirm your SkinFox subscription', html: `<p>Confirm with token ${token}</p>` }); return reply.status(201).send({ data: { accepted: true, confirmationToken: process.env.NODE_ENV === 'production' ? undefined : token }, meta: { requestId: request.id } }) })
  routes.post('/api/v1/newsletter/confirm', async (request, reply) => { const token = z.string().min(10).parse(request.body?.token); const subscription = await prisma.newsletterSubscription.findUnique({ where: { tokenHash: hashToken(token) } }); if (!subscription) throw notFound('Subscription token not found.'); return data(reply, await prisma.newsletterSubscription.update({ where: { id: subscription.id }, data: { confirmedAt: new Date() }, select: { id: true, confirmedAt: true } })) })
  routes.delete('/api/v1/newsletter/subscriptions/:token', async (request, reply) => { const subscription = await prisma.newsletterSubscription.findUnique({ where: { tokenHash: hashToken(request.params.token) } }); if (!subscription) throw notFound('Subscription not found.'); await prisma.newsletterSubscription.update({ where: { id: subscription.id }, data: { unsubscribedAt: new Date() } }); return data(reply, { unsubscribed: true }) })
  routes.post('/api/v1/contact', async (request, reply) => { const input = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), subject: z.string().min(2), message: z.string().min(10) }).parse(request.body); const submission = await prisma.contactSubmission.create({ data: input }); return reply.status(201).send({ data: { accepted: true, id: submission.id }, meta: { requestId: request.id } }) })
  routes.post('/api/v1/events', async (request, reply) => { const input = z.object({ eventName: z.string().min(2), anonymousId: z.string().min(8), payload: z.record(z.unknown()).default({}), consent: z.boolean() }).parse(request.body); const forbiddenKeys = ['name', 'email', 'phone', 'address', 'pincode', 'payment']; if (Object.keys(input.payload).some((key) => forbiddenKeys.some((item) => key.toLowerCase().includes(item)))) throw validationError('Analytics payload must not contain personal or payment data.'); return data(reply, { accepted: Boolean(await prisma.analyticsEvent.create({ data: input as any })) }) })
  routes.post('/api/v1/events/batch', async (request, reply) => { const events = z.array(z.object({ eventName: z.string(), anonymousId: z.string(), payload: z.record(z.unknown()).default({}), consent: z.boolean() })).max(100).parse(request.body); await prisma.analyticsEvent.createMany({ data: events as any }); return data(reply, { accepted: events.length }) })

  // Admin authentication and session governance.
  routes.post('/api/v1/admin/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => { const input = z.object({ email: z.string().email(), password: z.string().min(12), mfaCode: z.string().optional() }).parse(request.body); const user = await prisma.adminUser.findUnique({ where: { email: input.email.toLowerCase() } }); if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, input.password))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'); if (user.mfaRequired) { if (!input.mfaCode) throw new ApiError(401, 'MFA_REQUIRED', 'A multi-factor code is required.'); const credential = await prisma.mfaCredential.findUnique({ where: { userId: user.id } }); const valid = credential ? authenticator.check(input.mfaCode, decryptSecret(credential.secretEncrypted)) : process.env.NODE_ENV !== 'production' && input.mfaCode === '000000'; if (!valid) throw new ApiError(401, 'MFA_INVALID', 'The multi-factor code is invalid.'); } const token = randomToken(32); await prisma.adminSession.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + Number(process.env.SESSION_TTL_DAYS ?? 7) * 86400000), ip: request.ip, userAgent: request.headers['user-agent'] } }); const csrf = randomToken(18); reply.setCookie('sf_admin_session', token, { httpOnly: true, sameSite: 'strict', secure: secureCookies(), path: '/' }).setCookie('sf_csrf', csrf, { httpOnly: false, sameSite: 'strict', secure: secureCookies(), path: '/' }); await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }); return data(reply, { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword, mfaRequired: user.mfaRequired }) })
  routes.post('/api/v1/admin/auth/logout', async (request, reply) => { const user = await requireAdmin()(request); const token = request.cookies.sf_admin_session; if (token) await prisma.adminSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } }); await audit(user, request, 'logout', 'AdminSession', null, null, null); reply.clearCookie('sf_admin_session', { path: '/' }).clearCookie('sf_csrf', { path: '/' }); return data(reply, { loggedOut: true }) })
  routes.post('/api/v1/admin/auth/refresh', async (request, reply) => { const user = await currentAdmin(request); return data(reply, { id: user.id, email: user.email, name: user.name, role: user.role }) })
  routes.get('/api/v1/admin/auth/me', async (request, reply) => { const user = await currentAdmin(request); return data(reply, { id: user.id, email: user.email, name: user.name, role: user.role, mfaRequired: user.mfaRequired, mustChangePassword: user.mustChangePassword }) })
  routes.post('/api/v1/admin/auth/forgot-password', async (request, reply) => { const emailValue = z.string().email().parse(request.body?.email); const token = randomToken(32); await prisma.passwordResetToken.create({ data: { email: emailValue.toLowerCase(), tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }); await email.send({ to: emailValue, subject: 'Reset your SkinFox admin password', html: `<p>Use reset token ${token}</p>` }); return data(reply, { accepted: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : token }) })
  routes.post('/api/v1/admin/auth/reset-password', async (request, reply) => { const input = z.object({ token: z.string().min(10), password: z.string().min(12) }).parse(request.body); const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } }); if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw validationError('Reset token is invalid or expired.'); await prisma.$transaction([prisma.adminUser.updateMany({ where: { email: reset.email }, data: { passwordHash: await hashPassword(input.password), mustChangePassword: false } }), prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } })]); return data(reply, { reset: true }) })
  routes.post('/api/v1/admin/auth/accept-invitation', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => { const input = z.object({ token: z.string().min(10), name: z.string().min(2), password: z.string().min(12) }).parse(request.body); const invitation = await prisma.adminInvitation.findUnique({ where: { tokenHash: hashToken(input.token) } }); if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw validationError('Invitation is invalid or expired.'); const mfaRequired = [AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.CATALOG_MANAGER].includes(invitation.role); const roleRef = await prisma.role.findUnique({ where: { code: invitation.role } }); const user = await prisma.$transaction(async (tx) => { const created = await tx.adminUser.create({ data: { email: invitation.email, name: input.name, passwordHash: await hashPassword(input.password), role: invitation.role, roleId: roleRef?.id, mfaRequired, mustChangePassword: false } }); await tx.adminInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }); return created }); return reply.status(201).send({ data: { id: user.id, email: user.email, role: user.role, mfaRequired: user.mfaRequired }, meta: { requestId: request.id } }) })
  routes.post('/api/v1/admin/auth/logout-all-sessions', async (request, reply) => { const user = await requireAdmin()(request); await prisma.adminSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }); await audit(user, request, 'logout_all_sessions', 'AdminUser', user.id, null, null); return data(reply, { revoked: true }) })
  routes.get('/api/v1/admin/auth/sessions', async (request, reply) => { const user = await requireAdmin()(request); return data(reply, await prisma.adminSession.findMany({ where: { userId: user.id, revokedAt: null }, select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true }, orderBy: { lastSeenAt: 'desc' } })) })
  routes.delete('/api/v1/admin/auth/sessions/:sessionId', async (request, reply) => { const user = await requireAdmin()(request); await prisma.adminSession.updateMany({ where: { id: request.params.sessionId, userId: user.id }, data: { revokedAt: new Date() } }); return data(reply, { revoked: true }) })
  routes.post('/api/v1/admin/auth/mfa/setup', async (request, reply) => { const user = await requireAdmin()(request); const secret = authenticator.generateSecret(); await prisma.mfaCredential.upsert({ where: { userId: user.id }, update: { secretEncrypted: encryptSecret(secret), verifiedAt: null }, create: { userId: user.id, secretEncrypted: encryptSecret(secret) } }); return data(reply, { secret, provisioningUri: authenticator.keyuri(user.email, 'SkinFox', secret) }) })
  routes.post('/api/v1/admin/auth/mfa/verify', async (request, reply) => { const user = await requireAdmin()(request); const code = z.string().regex(/^\d{6}$/).parse(request.body?.code); const credential = await prisma.mfaCredential.findUnique({ where: { userId: user.id } }); const valid = credential ? authenticator.check(code, decryptSecret(credential.secretEncrypted)) || (process.env.NODE_ENV !== 'production' && code === '000000') : false; if (!valid) throw validationError('Invalid MFA code.'); await prisma.$transaction([prisma.mfaCredential.update({ where: { userId: user.id }, data: { verifiedAt: new Date(), enrolledAt: new Date() } }), prisma.adminUser.update({ where: { id: user.id }, data: { mfaRequired: true } })]); return data(reply, { enrolled: true }) })

  routes.get('/api/v1/admin/affiliates', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN])(request)
    const affiliates = await prisma.affiliate.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { attributions: true, redemptionRequests: true, clicks: true } } } })
    return data(reply, affiliates.map((affiliate) => ({ ...publicAffiliate(affiliate), referralClicks: affiliate._count.clicks, confirmedReferralOrders: affiliate._count.attributions, redemptionRequests: affiliate._count.redemptionRequests })))
  })
  routes.post('/api/v1/admin/affiliates/:id/status', async (request, reply) => {
    const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request)
    const input = z.object({ status: z.nativeEnum(AffiliateStatus), reason: z.string().trim().max(500).optional() }).parse(request.body)
    const before = await prisma.affiliate.findUnique({ where: { id: request.params.id } })
    if (!before) throw notFound('Affiliate not found.')
    const updated = await prisma.affiliate.update({ where: { id: before.id }, data: { status: input.status, approvedAt: input.status === AffiliateStatus.approved ? new Date() : before.approvedAt, approvedById: input.status === AffiliateStatus.approved ? user.id : before.approvedById, rejectionReason: input.status === AffiliateStatus.rejected ? (input.reason || 'Application was not approved.') : null } })
    await audit(user, request, 'affiliate_status_updated', 'Affiliate', before.id, publicAffiliate(before), publicAffiliate(updated), input.reason)
    return data(reply, publicAffiliate(updated))
  })
  routes.get('/api/v1/admin/affiliate-redemptions', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN])(request)
    const requests = await prisma.affiliateRedemptionRequest.findMany({ orderBy: { createdAt: 'desc' }, include: { affiliate: true } })
    return data(reply, requests.map((item) => ({ ...item, affiliate: publicAffiliate(item.affiliate) })))
  })
  routes.post('/api/v1/admin/affiliate-redemptions/:id/review', async (request, reply) => {
    const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request)
    const input = z.object({ status: z.enum([AffiliateRedemptionStatus.paid, AffiliateRedemptionStatus.rejected]), note: z.string().trim().max(500).optional() }).parse(request.body)
    const updated = await prisma.$transaction(async (tx) => {
      const redemption = await tx.affiliateRedemptionRequest.findUnique({ where: { id: request.params.id } })
      if (!redemption) throw notFound('Affiliate redemption request not found.')
      if (redemption.status !== AffiliateRedemptionStatus.requested) throw validationError('This redemption request has already been reviewed.')
      const reviewed = await tx.affiliateRedemptionRequest.update({ where: { id: redemption.id }, data: { status: input.status, note: input.note || undefined, reviewedAt: new Date(), reviewedById: user.id } })
      if (input.status === AffiliateRedemptionStatus.rejected) await tx.affiliateWalletEntry.create({ data: { affiliateId: redemption.affiliateId, type: AffiliateWalletEntryType.redemption_reversal, amountPaise: redemption.amountPaise, description: `Redemption request ${redemption.id} was rejected`, redemptionId: redemption.id } })
      return reviewed
    })
    await audit(user, request, 'affiliate_redemption_reviewed', 'AffiliateRedemptionRequest', updated.id, null, updated, input.note)
    return data(reply, updated)
  })

  const getAdminCrudModel = (delegateName: string) => {
    const model = Prisma.dmmf.datamodel.models.find((candidate) => `${candidate.name[0].toLowerCase()}${candidate.name.slice(1)}` === delegateName)
    if (!model) throw validationError('This admin resource is not configured.')
    return model
  }
  const searchableAdminFields = (delegateName: string, preferredFields: string[] = []) => {
    const available = getAdminCrudModel(delegateName).fields.filter((field) => field.kind === 'scalar' && field.type === 'String' && !field.isId).map((field) => field.name)
    const preferred = preferredFields.filter((field) => available.includes(field))
    return preferred.length ? preferred : available
  }
  const adminList = async (request: any, reply: any, delegateName: string, roles: AdminRole[], where: any = {}, select?: any) => { await requireAdmin(roles)(request); const params = pageParams(request); const delegate = (prisma as any)[delegateName]; const searchFields = searchableAdminFields(delegateName, Object.keys(select ?? {})); const composed = params.q ? { AND: [where, { OR: searchFields.map((key) => ({ [key]: { contains: params.q, mode: 'insensitive' } })) }] } : where; const [items, total] = await Promise.all([delegate.findMany({ where: composed, ...(select ? { select } : {}), orderBy: { createdAt: 'desc' }, skip: (params.page - 1) * params.limit, take: params.limit }), delegate.count({ where: composed })]); return data(reply, items, { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total }) }
  const parseAdminCrudInput = (delegateName: string, value: unknown) => {
    const input = z.record(z.unknown()).parse(value)
    const model = getAdminCrudModel(delegateName)
    const blocked = new Set(['id', 'createdAt', 'updatedAt', 'archivedAt'])
    const fields = new Map(model.fields.filter((field) => field.kind !== 'object' && !field.isId && !field.isUpdatedAt && !blocked.has(field.name)).map((field) => [field.name, field]))
    const unknownFields = Object.keys(input).filter((key) => !fields.has(key))
    if (unknownFields.length) throw validationError('The request contains unsupported fields.', Object.fromEntries(unknownFields.map((key) => [key, 'This field cannot be changed.'])))
    if (!Object.keys(input).length) throw validationError('Submit at least one field to change.')
    return Object.fromEntries(Object.entries(input).map(([key, item]) => {
      const field = fields.get(key)
      if (field?.type !== 'DateTime' || item === null || item instanceof Date) return [key, item]
      if (typeof item !== 'string' || Number.isNaN(Date.parse(item))) throw validationError('Please correct the highlighted fields.', { [key]: 'Use a valid ISO date and time.' })
      return [key, new Date(item)]
    }))
  }
  const adminCrud = (resource: string, delegateName: string, roles: AdminRole[], selectKeys: string[] = ['name', 'title', 'email', 'code', 'slug']) => {
    // These resources do not share a common timestamp column (taxonomy and
    // care-finder records use sortOrder, while navigation uses updatedAt, etc.).
    // Let Prisma use the model's natural order here instead of issuing an
    // invalid `createdAt` orderBy for models that do not define that field.
    app.get(`/api/v1/admin/${resource}`, async (request, reply) => { const user = await requireAdmin(roles)(request); const params = pageParams(request); const delegate = (prisma as any)[delegateName]; const searchFields = searchableAdminFields(delegateName, selectKeys); const where = params.q ? { OR: searchFields.map((key) => ({ [key]: { contains: params.q, mode: 'insensitive' } })) } : {}; const [items, total] = await Promise.all([delegate.findMany({ where, skip: (params.page - 1) * params.limit, take: params.limit }), delegate.count({ where })]); return data(reply, items, { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total, role: user.role }) })
    app.post(`/api/v1/admin/${resource}`, async (request, reply) => { const user = await requireAdmin(roles)(request); const delegate = (prisma as any)[delegateName]; const created = await delegate.create({ data: parseAdminCrudInput(delegateName, request.body) }); await audit(user, request, 'create', resource, created.id, null, created); return reply.status(201).send({ data: created, meta: { requestId: request.id } }) })
    app.get(`/api/v1/admin/${resource}/:id`, async (request, reply) => { await requireAdmin(roles)(request); const item = await (prisma as any)[delegateName].findUnique({ where: { id: request.params.id } }); if (!item) throw notFound(`${resource} record not found.`); return data(reply, item) })
    app.patch(`/api/v1/admin/${resource}/:id`, async (request, reply) => { const user = await requireAdmin(roles)(request); const delegate = (prisma as any)[delegateName]; const before = await delegate.findUnique({ where: { id: request.params.id } }); if (!before) throw notFound(`${resource} record not found.`); const updated = await delegate.update({ where: { id: request.params.id }, data: parseAdminCrudInput(delegateName, request.body) }); await audit(user, request, 'update', resource, request.params.id, before, updated); return data(reply, updated) })
    app.delete(`/api/v1/admin/${resource}/:id`, async (request, reply) => { const user = await requireAdmin(roles)(request); const delegate = (prisma as any)[delegateName]; const before = await delegate.findUnique({ where: { id: request.params.id } }); if (!before) throw notFound(`${resource} record not found.`); const supportsArchivedAt = getAdminCrudModel(delegateName).fields.some((field) => field.name === 'archivedAt'); const result = 'status' in before ? await delegate.update({ where: { id: request.params.id }, data: { status: PublicationStatus.archived, ...(supportsArchivedAt ? { archivedAt: new Date() } : {}) } }) : await delegate.delete({ where: { id: request.params.id } }); await audit(user, request, 'archive', resource, request.params.id, before, result, String(request.body?.reason ?? 'Admin action')); return data(reply, result) })
  }

  routes.get('/api/v1/admin/products', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request)
    const params = pageParams(request)
    const requestedPeriod = Number(request.query?.periodDays ?? 30)
    const periodDays = [7, 30, 90].includes(requestedPeriod) ? requestedPeriod : 30
    const categoryFilter = String(request.query?.category ?? '').trim().toLowerCase()
    const inventoryFilter = String(request.query?.inventory ?? '').trim().toLowerCase()
    const performanceFilter = String(request.query?.performance ?? '').trim().toLowerCase()
    const requestedSort = String(request.query?.sort ?? 'updated')
    const sortKey = ['name', 'stock', 'unitsSold', 'updated'].includes(requestedSort) ? requestedSort : 'updated'
    const direction = String(request.query?.direction ?? 'desc') === 'asc' ? 1 : -1
    const where: any = {
      ...(request.query?.status ? { status: request.query.status } : {}),
      ...(params.q ? {
        OR: [
          { name: { contains: params.q, mode: 'insensitive' } },
          { slug: { contains: params.q, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: params.q, mode: 'insensitive' } } } },
        ],
      } : {}),
    }
    const items = await prisma.product.findMany({
      where,
      include: { media: true, categoryRef: true, variants: { include: { inventory: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    const productIds = items.map((item) => item.id)
    const eligibleStatuses = [OrderStatus.confirmed, OrderStatus.processing, OrderStatus.packed, OrderStatus.shipped, OrderStatus.delivered]
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
    const salesItems = productIds.length ? await prisma.orderItem.findMany({
      where: { productId: { in: productIds }, order: { status: { in: eligibleStatuses } } },
      select: { productId: true, quantity: true, order: { select: { id: true, customerId: true, createdAt: true } } },
    }) : []
    const slowMaxUnits = Number(process.env.ADMIN_PRODUCT_SLOW_MAX_UNITS ?? 3)
    const sellingMinUnits = Number(process.env.ADMIN_PRODUCT_SELLING_MIN_UNITS ?? 4)
    const salesByProduct = new Map<string, { unitsSold: number; orderIds: Set<string>; customers: Map<string, Set<string>> }>()
    for (const entry of salesItems) {
      if (!entry.productId) continue
      const current = salesByProduct.get(entry.productId) ?? { unitsSold: 0, orderIds: new Set<string>(), customers: new Map<string, Set<string>>() }
      current.orderIds.add(entry.order.id)
      if (entry.order.createdAt >= periodStart) current.unitsSold += Number(entry.quantity ?? 0)
      if (entry.order.customerId) {
        const customerOrders = current.customers.get(entry.order.customerId) ?? new Set<string>()
        customerOrders.add(entry.order.id)
        current.customers.set(entry.order.customerId, customerOrders)
      }
      salesByProduct.set(entry.productId, current)
    }
    const rows = items.map((item) => {
      const sales = salesByProduct.get(item.id) ?? { unitsSold: 0, orderIds: new Set<string>(), customers: new Map<string, Set<string>>() }
      const inventory = { tracked: false, onHandQty: 0, reservedQty: 0, sellableQty: 0, lowStock: false, lowStockThreshold: null as number | null }
      for (const variant of item.variants) {
        for (const stock of variant.inventory ?? []) {
          const onHand = Number(stock.availableQty ?? 0)
          const reserved = Number(stock.reservedQty ?? 0)
          const sellable = Math.max(onHand - reserved, 0)
          inventory.tracked = true
          inventory.onHandQty += onHand
          inventory.reservedQty += reserved
          inventory.sellableQty += sellable
          inventory.lowStock = inventory.lowStock || sellable <= Number(stock.lowStockThreshold ?? 5)
          inventory.lowStockThreshold = inventory.lowStockThreshold === null ? Number(stock.lowStockThreshold ?? 5) : Math.min(inventory.lowStockThreshold, Number(stock.lowStockThreshold ?? 5))
        }
      }
      const productIsNew = new Date(item.createdAt) > periodStart
      const performance = productIsNew ? 'new' : sales.unitsSold === 0 ? 'no_sales' : sales.unitsSold <= slowMaxUnits ? 'slow' : sales.unitsSold >= sellingMinUnits ? 'selling' : 'slow'
      const stockState = !inventory.tracked ? 'untracked' : inventory.sellableQty === 0 ? 'out_of_stock' : inventory.lowStock ? 'low_stock' : 'in_stock'
      const repeatOrders = [...sales.customers.values()].reduce((total, orderIds) => total + Math.max(0, orderIds.size - 1), 0)
      const publicItem = publicProduct(item, true)
      return {
        ...publicItem,
        category: item.categoryRef?.name ?? item.category,
        productMetrics: {
          periodDays,
          salesDataAvailable: true,
          unitsSold: sales.unitsSold,
          repeatOrders,
          orderCount: sales.orderIds.size,
          performance,
          performanceLabel: performance === 'no_sales' ? 'No sales' : performance === 'slow' ? 'Slow-moving' : performance === 'selling' ? 'Selling' : 'New',
          slowMaxUnits,
          sellingMinUnits,
          stockState,
          stockLabel: stockState === 'untracked' ? 'Not tracked' : stockState === 'out_of_stock' ? 'Out of stock' : stockState === 'low_stock' ? 'Low stock' : 'In stock',
          inventoryTracked: inventory.tracked,
          onHandQty: inventory.onHandQty,
          reservedQty: inventory.reservedQty,
          sellableQty: inventory.sellableQty,
          lowStockThreshold: inventory.lowStockThreshold,
          variantCount: item.variants.length,
          sku: item.variants.map((variant) => variant.sku).filter(Boolean).join(', '),
        },
      }
    })
    const filtered = rows.filter((row) => {
      const metrics = row.productMetrics
      const rowCategory = String(row.category ?? '').toLowerCase()
      if (categoryFilter && rowCategory !== categoryFilter) return false
      if (inventoryFilter && String(metrics.stockState) !== inventoryFilter) return false
      if (performanceFilter && String(metrics.performance) !== performanceFilter) return false
      return true
    })
    filtered.sort((left, right) => {
      const leftMetrics = left.productMetrics
      const rightMetrics = right.productMetrics
      const leftValue = sortKey === 'name' ? String(left.name ?? '').toLowerCase() : sortKey === 'stock' ? Number(leftMetrics.sellableQty ?? 0) : sortKey === 'unitsSold' ? Number(leftMetrics.unitsSold ?? 0) : new Date(String(left.updatedAt)).getTime()
      const rightValue = sortKey === 'name' ? String(right.name ?? '').toLowerCase() : sortKey === 'stock' ? Number(rightMetrics.sellableQty ?? 0) : sortKey === 'unitsSold' ? Number(rightMetrics.unitsSold ?? 0) : new Date(String(right.updatedAt)).getTime()
      return (leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0) * direction
    })
    const total = filtered.length
    const start = (params.page - 1) * params.limit
    return data(reply, filtered.slice(start, start + params.limit), { page: params.page, limit: params.limit, total, hasNextPage: start + params.limit < total, periodDays, categories: [...new Set(rows.map((row) => String(row.category ?? '').trim()).filter(Boolean))].sort() })
  })
  routes.post('/api/v1/admin/products', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const input = productCreateSchema.parse(request.body); const { media, sku, ...productData } = input; const created = await prisma.$transaction(async (tx) => { const product = await tx.product.create({ data: productData as any }); await tx.productVariant.create({ data: { productId: product.id, sku: sku ?? `${product.slug.toUpperCase()}-DEFAULT`, name: product.size, size: product.size, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise, purchaseState: product.purchaseState } }); if (media.length) await tx.productMedia.createMany({ data: media.map((item, index) => ({ ...item, productId: product.id, sortOrder: item.sortOrder ?? index, type: item.type as any })) }); await tx.productRevision.create({ data: { productId: product.id, version: 1, snapshot: input as any, status: product.status, createdById: user.id } }); return tx.product.findUniqueOrThrow({ where: { id: product.id }, include: { media: true, variants: true } }) }); await audit(user, request, 'create', 'Product', created.id, null, created); return reply.status(201).send({ data: publicProduct(created, true), meta: { requestId: request.id } }) })
  routes.get('/api/v1/admin/products/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const product = await prisma.product.findUnique({ where: { id: request.params.id }, include: { media: true, variants: { include: { inventory: true } }, revisions: { orderBy: { version: 'desc' } }, claims: true, collections: { include: { collection: true } } } }); if (!product) throw notFound('Product not found.'); return data(reply, publicProduct(product, true)) })
  routes.patch('/api/v1/admin/products/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const before = await prisma.product.findUnique({ where: { id: request.params.id }, include: { media: true, variants: true } }); if (!before) throw notFound('Product not found.'); const input = productPatchSchema.parse(request.body); const { media, sku: _sku, ...changes } = input; const effectivePrice = changes.pricePaise !== undefined ? changes.pricePaise : before.pricePaise; const effectiveMrp = changes.mrpPaise !== undefined ? changes.mrpPaise : before.mrpPaise; const effectivePurchaseState = changes.purchaseState !== undefined ? changes.purchaseState : before.purchaseState; if (effectivePrice !== null && effectiveMrp !== null && effectiveMrp < effectivePrice) throw validationError('MRP cannot be lower than selling price.'); if (effectivePurchaseState === PurchaseState.available && effectivePrice === null) throw validationError('Available products require a selling price.'); const updated = await prisma.$transaction(async (tx) => { const item = await tx.product.update({ where: { id: request.params.id }, data: changes as any, include: { media: true, variants: true } }); if (changes.pricePaise !== undefined || changes.mrpPaise !== undefined || changes.purchaseState !== undefined || changes.size !== undefined) await tx.productVariant.updateMany({ where: { productId: item.id }, data: { ...(changes.pricePaise !== undefined ? { pricePaise: changes.pricePaise } : {}), ...(changes.mrpPaise !== undefined ? { mrpPaise: changes.mrpPaise } : {}), ...(changes.purchaseState !== undefined ? { purchaseState: changes.purchaseState } : {}), ...(changes.size !== undefined ? { size: changes.size, name: changes.size } : {}) } }); if (media) { await tx.productMedia.deleteMany({ where: { productId: item.id } }); await tx.productMedia.createMany({ data: media.map((entry: any, index: number) => ({ ...entry, productId: item.id, sortOrder: entry.sortOrder ?? index, type: entry.type })) }); } const latest = await tx.productRevision.findFirst({ where: { productId: item.id }, orderBy: { version: 'desc' } }); const snapshot = await tx.product.findUniqueOrThrow({ where: { id: item.id }, include: { media: true } }); await tx.productRevision.create({ data: { productId: item.id, version: (latest?.version ?? 0) + 1, snapshot: productSnapshot(snapshot) as any, status: snapshot.status, createdById: user.id } }); return tx.product.findUniqueOrThrow({ where: { id: item.id }, include: { media: true, variants: true } }) }); await audit(user, request, 'update', 'Product', before.id, before, updated); return data(reply, publicProduct(updated, true)) })
  routes.delete('/api/v1/admin/products/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const before = await prisma.product.findUnique({ where: { id: request.params.id } }); if (!before) throw notFound('Product not found.'); const updated = await prisma.product.update({ where: { id: before.id }, data: { status: PublicationStatus.archived, archivedAt: new Date() } }); await audit(user, request, 'archive', 'Product', before.id, before, updated, String(request.body?.reason ?? 'Archive product')); return data(reply, publicProduct(updated, true)) })
  for (const [action, status] of [['submit-review', PublicationStatus.in_review], ['approve', PublicationStatus.approved], ['publish', PublicationStatus.published], ['unpublish', PublicationStatus.draft], ['schedule', PublicationStatus.scheduled], ['archive', PublicationStatus.archived], ['restore', PublicationStatus.draft]] as const) app.post(`/api/v1/admin/products/:id/${action}`, async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const product = await prisma.product.findUnique({ where: { id: request.params.id }, include: { media: true } }); if (!product) throw notFound('Product not found.'); if (status === PublicationStatus.published && (!product.imageAlt || !product.media.every((item) => item.alt))) throw validationError('Published products require alt text on every image.'); const updated = await prisma.product.update({ where: { id: product.id }, data: { status, publishedAt: status === PublicationStatus.published ? new Date() : product.publishedAt, archivedAt: status === PublicationStatus.archived ? new Date() : null } }); await audit(user, request, action, 'Product', product.id, product, updated, String(request.body?.reason ?? 'Publication workflow')); return data(reply, publicProduct(updated, true)) })
  routes.get('/api/v1/admin/products/:id/revisions', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.productRevision.findMany({ where: { productId: request.params.id }, orderBy: { version: 'desc' } })) })
  routes.post('/api/v1/admin/products/:id/revisions/:revisionId/restore', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const revision = await prisma.productRevision.findUnique({ where: { id: request.params.revisionId } }); if (!revision || revision.productId !== request.params.id) throw notFound('Revision not found.'); const snapshot: any = revision.snapshot; const restored = await prisma.$transaction(async (tx) => { const updated = await tx.product.update({ where: { id: revision.productId }, data: Object.fromEntries(productSnapshotFields.filter((key) => snapshot[key] !== undefined).map((key) => [key, snapshot[key]])) as any }); if (snapshot.pricePaise !== undefined || snapshot.mrpPaise !== undefined || snapshot.purchaseState !== undefined || snapshot.size !== undefined) await tx.productVariant.updateMany({ where: { productId: revision.productId }, data: { ...(snapshot.pricePaise !== undefined ? { pricePaise: snapshot.pricePaise } : {}), ...(snapshot.mrpPaise !== undefined ? { mrpPaise: snapshot.mrpPaise } : {}), ...(snapshot.purchaseState !== undefined ? { purchaseState: snapshot.purchaseState } : {}), ...(snapshot.size !== undefined ? { size: snapshot.size, name: snapshot.size } : {}) } }); if (Array.isArray(snapshot.media)) { await tx.productMedia.deleteMany({ where: { productId: revision.productId } }); await tx.productMedia.createMany({ data: snapshot.media.map((media: any, index: number) => ({ ...Object.fromEntries(mediaSnapshotFields.filter((key) => media[key] !== undefined).map((key) => [key, media[key]])), productId: revision.productId, sortOrder: media.sortOrder ?? index, type: media.type })) }); } return tx.product.findUniqueOrThrow({ where: { id: revision.productId }, include: { media: true, variants: true } }) }); await audit(user, request, 'restore_revision', 'Product', revision.productId, null, restored); return data(reply, publicProduct(restored, true)) })
  routes.post('/api/v1/admin/products/bulk', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const input = z.object({ ids: z.array(z.string()).min(1), action: z.enum(['publish', 'unpublish', 'archive']), reason: z.string().min(3) }).parse(request.body); const status = input.action === 'publish' ? PublicationStatus.published : input.action === 'unpublish' ? PublicationStatus.draft : PublicationStatus.archived; const result = await prisma.product.updateMany({ where: { id: { in: input.ids } }, data: { status } }); await audit(user, request, `bulk_${input.action}`, 'Product', null, { ids: input.ids }, result, input.reason); return data(reply, { updated: result.count }) })
  routes.post('/api/v1/admin/products/import', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const raw = Array.isArray(request.body) ? request.body : request.body?.products; const inputs = z.array(productCreateSchema).max(500).parse(raw); const imported = await prisma.$transaction(async (tx) => { let count = 0; for (const input of inputs) { const { media, sku, ...productData } = input; const product = await tx.product.upsert({ where: { slug: input.slug }, update: productData as any, create: productData as any }); const variantSku = sku ?? `${input.slug.toUpperCase()}-DEFAULT`; const variant = await tx.productVariant.findUnique({ where: { sku: variantSku } }); if (variant) await tx.productVariant.update({ where: { id: variant.id }, data: { productId: product.id, name: product.size, size: product.size, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise, purchaseState: product.purchaseState } }); else await tx.productVariant.create({ data: { productId: product.id, sku: variantSku, name: product.size, size: product.size, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise, purchaseState: product.purchaseState } }); await tx.productMedia.deleteMany({ where: { productId: product.id } }); if (media.length) await tx.productMedia.createMany({ data: media.map((entry, index) => ({ ...entry, productId: product.id, sortOrder: entry.sortOrder ?? index, type: entry.type as any })) }); const latest = await tx.productRevision.findFirst({ where: { productId: product.id }, orderBy: { version: 'desc' } }); await tx.productRevision.create({ data: { productId: product.id, version: (latest?.version ?? 0) + 1, snapshot: input as any, status: product.status, createdById: user.id } }); count += 1 } return count }); await audit(user, request, 'product_import', 'Product', null, null, { count: imported }); return data(reply, { imported }) })
  routes.get('/api/v1/admin/products/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const products = await prisma.product.findMany({ include: { media: true, variants: true } }); reply.header('content-type', 'application/json; charset=utf-8'); return data(reply, products.map(publicProduct)) })
  routes.get('/api/v1/admin/products/:productId/variants', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.productVariant.findMany({ where: { productId: request.params.productId }, include: { inventory: true } })) })
  routes.post('/api/v1/admin/products/:productId/variants', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const input = variantInputSchema.parse(request.body); if (input.pricePaise !== null && input.mrpPaise !== null && input.mrpPaise < input.pricePaise) throw validationError('MRP cannot be lower than selling price.'); if (input.purchaseState === PurchaseState.available && input.pricePaise === null) throw validationError('Available variants require a selling price.'); const created = await prisma.productVariant.create({ data: { ...input, productId: request.params.productId } }); await audit(user, request, 'create', 'ProductVariant', created.id, null, created); return reply.status(201).send({ data: created, meta: { requestId: request.id } }) })
  routes.patch('/api/v1/admin/products/:productId/variants/:variantId', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const before = await prisma.productVariant.findUnique({ where: { id: request.params.variantId } }); if (!before || before.productId !== request.params.productId) throw notFound('Product variant not found.'); const input = variantPatchSchema.parse(request.body); const effectivePrice = input.pricePaise !== undefined ? input.pricePaise : before.pricePaise; const effectiveMrp = input.mrpPaise !== undefined ? input.mrpPaise : before.mrpPaise; const effectivePurchaseState = input.purchaseState !== undefined ? input.purchaseState : before.purchaseState; if (effectivePrice !== null && effectiveMrp !== null && effectiveMrp < effectivePrice) throw validationError('MRP cannot be lower than selling price.'); if (effectivePurchaseState === PurchaseState.available && effectivePrice === null) throw validationError('Available variants require a selling price.'); const updated = await prisma.productVariant.update({ where: { id: before.id }, data: input }); await audit(user, request, 'update', 'ProductVariant', updated.id, before, updated); return data(reply, updated) })
  routes.delete('/api/v1/admin/products/:productId/variants/:variantId', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); await prisma.productVariant.delete({ where: { id: request.params.variantId } }); await audit(user, request, 'delete', 'ProductVariant', request.params.variantId, null, null); return data(reply, { deleted: true }) })
  routes.get('/api/v1/admin/products/:productId/media', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.productMedia.findMany({ where: { productId: request.params.productId }, orderBy: { sortOrder: 'asc' } })) })
  routes.post('/api/v1/admin/products/:productId/media', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const input = productMediaInputSchema.parse(request.body); const created = await prisma.productMedia.create({ data: { ...input, productId: request.params.productId, type: input.type as any } }); await audit(user, request, 'create', 'ProductMedia', created.id, null, created); return reply.status(201).send({ data: created, meta: { requestId: request.id } }) })
  routes.patch('/api/v1/admin/products/:productId/media/:mediaId', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const before = await prisma.productMedia.findUnique({ where: { id: request.params.mediaId } }); if (!before || before.productId !== request.params.productId) throw notFound('Product media not found.'); const input = productMediaInputSchema.partial().parse(request.body); const updated = await prisma.productMedia.update({ where: { id: before.id }, data: input as any }); await audit(user, request, 'update', 'ProductMedia', updated.id, before, updated); return data(reply, updated) })
  routes.delete('/api/v1/admin/products/:productId/media/:mediaId', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); await prisma.productMedia.delete({ where: { id: request.params.mediaId } }); await audit(user, request, 'delete', 'ProductMedia', request.params.mediaId, null, null); return data(reply, { deleted: true }) })
  routes.post('/api/v1/admin/products/:productId/media/reorder', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const ids = z.array(z.string()).parse(request.body?.ids); await prisma.$transaction(ids.map((id, index) => prisma.productMedia.update({ where: { id }, data: { sortOrder: index } }))); await audit(user, request, 'reorder', 'ProductMedia', request.params.productId, null, { ids }); return data(reply, { reordered: ids.length }) })

  routes.get('/api/v1/admin/inventory', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.ORDER_MANAGER])(request); const params = pageParams(request); const [items, total] = await Promise.all([prisma.inventoryItem.findMany({ include: { variant: { include: { product: true } }, location: true }, orderBy: { availableQty: 'asc' }, skip: (params.page - 1) * params.limit, take: params.limit }), prisma.inventoryItem.count()]); return data(reply, items, { page: params.page, limit: params.limit, total }) })
  routes.get('/api/v1/admin/inventory/low-stock', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.inventoryItem.findMany({ where: { availableQty: { lte: 5 } }, include: { variant: { include: { product: true } } } })) })
  routes.get('/api/v1/admin/inventory/:variantId', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.inventoryItem.findMany({ where: { variantId: request.params.variantId }, include: { location: true, variant: true } })) })
  routes.post('/api/v1/admin/inventory/adjustments', async (request, reply) => {
    const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request)
    const key = String(request.headers['idempotency-key'] ?? '')
    if (!key) throw validationError('An adjustment reference is required. Refresh and try again.')
    return reply.send(await adjustInventory(request.body, { user, key, requestId: request.id, ip: request.ip, userAgent: request.headers['user-agent'] }))
  })
  routes.post('/api/v1/admin/inventory/bulk-adjustments', async (request, reply) => { const replay = await idemReplay(request, 'inventory-bulk-adjustment'); if (replay) return reply.status(replay.status).send(replay.body); const entries = z.array(z.object({ variantId: z.string(), locationId: z.string(), quantity: z.number().int(), reason: z.string().min(3) })).parse(request.body?.entries); const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const result = await prisma.$transaction(entries.map((entry) => prisma.inventoryItem.update({ where: { variantId_locationId: { variantId: entry.variantId, locationId: entry.locationId } }, data: { availableQty: { increment: entry.quantity } } }))); for (const entry of entries) await prisma.inventoryMovement.create({ data: { ...entry, type: 'adjustment', actorId: user.id } }); const response = { updated: result.length }; const envelope = { data: response, meta: { requestId: request.id } }; await idemStore(request, 'inventory-bulk-adjustment', 200, envelope); return reply.send(envelope) })
  routes.get('/api/v1/admin/inventory/history', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.ORDER_MANAGER])(request); return data(reply, await prisma.inventoryMovement.findMany({ include: { variant: { include: { product: true } }, location: true }, orderBy: { createdAt: 'desc' }, take: 100 })) })
  routes.post('/api/v1/admin/inventory/import', async (request, reply) => { const replay = await idemReplay(request, 'inventory-import'); if (replay) return reply.status(replay.status).send(replay.body); const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); const entries = z.array(z.object({ variantId: z.string(), locationId: z.string(), quantity: z.number().int(), reason: z.string().min(3) })).max(500).parse(request.body?.entries ?? request.body); await prisma.$transaction(async (tx) => { for (const entry of entries) { await tx.inventoryItem.update({ where: { variantId_locationId: { variantId: entry.variantId, locationId: entry.locationId } }, data: { availableQty: { increment: entry.quantity } } }); await tx.inventoryMovement.create({ data: { ...entry, type: 'adjustment', actorId: user.id } }) } }); await audit(user, request, 'inventory_import', 'InventoryItem', null, null, { count: entries.length }); const response = { imported: entries.length }; const envelope = { data: response, meta: { requestId: request.id } }; await idemStore(request, 'inventory-import', 200, envelope); return reply.send(envelope) })
  routes.get('/api/v1/admin/inventory/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])(request); return data(reply, await prisma.inventoryItem.findMany({ include: { variant: true, location: true } })) })

  routes.get('/api/v1/admin/inventory/workspace', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.ORDER_MANAGER])(request)
    return data(reply, await inventoryWorkspace())
  })
  routes.get('/api/v1/admin/inventory/movements', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.ORDER_MANAGER])(request)
    const result = await inventoryHistory(request.query)
    return data(reply, result.rows, { total: result.total, page: result.page, limit: result.limit, hasNextPage: result.page * result.limit < result.total })
  })

  const transition: Record<string, OrderStatus> = { confirm: OrderStatus.confirmed, process: OrderStatus.processing, pack: OrderStatus.packed, fulfill: OrderStatus.processing, ship: OrderStatus.shipped, deliver: OrderStatus.delivered, cancel: OrderStatus.cancelled }
  routes.get('/api/v1/admin/orders', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request)
    const params = pageParams(request)
    const query = request.query ?? {}
    const requestedStatus = String(query.status ?? '').trim()
    const paymentStatus = String(query.paymentStatus ?? '').trim()
    const paymentMethod = String(query.paymentMethod ?? '').trim()
    const source = String(query.source ?? '').trim()
    const sort = String(query.sort ?? 'createdAt').trim()
    const direction = String(query.direction ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const from = String(query.from ?? '').trim()
    const to = String(query.to ?? '').trim()
    const baseWhere: any = {}
    if (params.q) baseWhere.OR = [
      { orderNumber: { contains: params.q, mode: 'insensitive' } },
      { publicToken: { contains: params.q, mode: 'insensitive' } },
      { waitlistReservationId: { contains: params.q, mode: 'insensitive' } },
      { items: { some: { OR: [{ productName: { contains: params.q, mode: 'insensitive' } }, { sku: { contains: params.q, mode: 'insensitive' } }] } } },
      { customer: { is: { OR: [{ fullName: { contains: params.q, mode: 'insensitive' } }, { email: { contains: params.q, mode: 'insensitive' } }, { phone: { contains: params.q } }] } } },
    ]
    if (source && source !== 'all') baseWhere.source = source
    if (from || to) baseWhere.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
    const paymentFilters: any[] = []
    if (paymentStatus && paymentStatus !== 'all') paymentFilters.push({ payments: { some: { status: paymentStatus } } })
    if (paymentMethod && paymentMethod !== 'all') paymentFilters.push({ payments: { some: { provider: paymentMethod } } })
    if (paymentFilters.length) baseWhere.AND = paymentFilters
    const missingAddress = { OR: [{ shippingAddress: { equals: Prisma.JsonNull } }, { shippingAddress: { equals: {} } }] }
    const needsActionWhere = { OR: [
      { status: { in: [OrderStatus.pending_payment, OrderStatus.payment_failed] } },
      { status: { in: [OrderStatus.confirmed, OrderStatus.processing, OrderStatus.packed] }, ...missingAddress },
    ] }
    const where = requestedStatus === 'needs_action' ? { AND: [baseWhere, needsActionWhere] } : { ...baseWhere, ...(requestedStatus && requestedStatus !== 'all' ? { status: requestedStatus } : {}) }
    const orderBy = sort === 'totalPaise' ? { totalPaise: direction } : sort === 'remainingBalancePaise' ? { remainingBalancePaise: direction } : { createdAt: direction }
    const [items, total, allForCounts] = await Promise.all([
      prisma.order.findMany({ where, include: { customer: true, items: true, payments: true, shipments: { select: { provider: true, status: true, trackingNumber: true, trackingUrl: true, courierName: true, labelUrl: true, manifestUrl: true } } }, orderBy, skip: (params.page - 1) * params.limit, take: params.limit }),
      prisma.order.count({ where }),
      prisma.order.findMany({ where: baseWhere, select: { status: true, shippingAddress: true, source: true } }),
    ])
    const counts = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, allForCounts.filter((order) => order.status === status).length]))
    counts.needs_action = allForCounts.filter((order) => [OrderStatus.pending_payment, OrderStatus.payment_failed].includes(order.status) || ([OrderStatus.confirmed, OrderStatus.processing, OrderStatus.packed].includes(order.status) && (!order.shippingAddress || (typeof order.shippingAddress === 'object' && Object.keys(order.shippingAddress as object).length === 0)))).length
    const sources = [...new Set(allForCounts.map((order) => order.source).filter(Boolean))]
    const paymentMethods = [...new Set((await prisma.payment.findMany({ where: { order: baseWhere }, select: { provider: true }, distinct: ['provider'] })).map((entry) => entry.provider))]
    return data(reply, items.map((order) => ({ ...order, customer: maskCustomer(order.customer) })), { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total, counts, sources, paymentMethods })
  })
  const adminWaitlistSettings = async () => waitlistConfig(await founderClaimedCount(), true)
  routes.get('/api/v1/admin/waitlist-settings', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    return data(reply, await adminWaitlistSettings())
  })
  routes.patch('/api/v1/admin/waitlist-settings', async (request, reply) => {
    const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request)
    const before = { ...activeWaitlistSettings }
    const requested = waitlistSettingsSchema.parse(request.body)
    // The operator-facing control is a single percentage applied independently
    // to every product MRP. Do not allow an older client to re-enable the
    // retired exact-price rule when publishing settings.
    const percentageSettings: WaitlistSettings = { ...requested, pricingMode: 'discount_off_mrp' }
    const founderClaimed = await founderClaimedCount()
    const next: WaitlistSettings = percentageSettings.stage === 'waitlist' && founderClaimed >= percentageSettings.founderCapacity ? { ...percentageSettings, enabled: false, stage: 'launch' } : percentageSettings
    await prisma.storeSetting.upsert({ where: { key: 'waitlist-config' }, update: { value: next }, create: { key: 'waitlist-config', value: next } })
    activeWaitlistSettings = next
    if (next.stage === 'launch' || next.stage === 'regular') {
      const sellingPricePaise = next.stage === 'launch' ? next.launchPricePaise : next.regularPricePaise
      await prisma.$transaction([
        prisma.product.updateMany({ where: { status: PublicationStatus.published }, data: { pricePaise: sellingPricePaise, mrpPaise: next.regularPricePaise, purchaseState: PurchaseState.available } }),
        prisma.productVariant.updateMany({ where: { product: { status: PublicationStatus.published } }, data: { pricePaise: sellingPricePaise, mrpPaise: next.regularPricePaise, purchaseState: PurchaseState.available } }),
      ])
    }
    await audit(user, request, 'update', 'WaitlistSettings', 'waitlist-config', before, next, next.enabled === before.enabled ? 'Waitlist commercial settings updated' : `Priority waitlist ${next.enabled ? 'opened' : 'closed'}`)
    return data(reply, await adminWaitlistSettings())
  })
  routes.get('/api/v1/admin/waitlist-reservations', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    const params = pageParams(request)
    const founderSearch = /^#?\d+$/.test(params.q) ? Number(params.q.replace('#', '')) : null
    const where: any = { ...(request.query?.status ? { status: request.query.status } : {}), ...(params.q ? { OR: [{ waitlistId: { contains: params.q, mode: 'insensitive' } }, { publicToken: { contains: params.q, mode: 'insensitive' } }, { phone: { contains: params.q } }, { customer: { is: { OR: [{ fullName: { contains: params.q, mode: 'insensitive' } }, { email: { contains: params.q, mode: 'insensitive' } }, ...(founderSearch ? [{ founderNumber: founderSearch }] : [])] } } }] } : {}) }
    const [items, total] = await Promise.all([
      prisma.waitlistReservation.findMany({ where, include: { customer: true, items: true, convertedOrder: { select: { publicToken: true, orderNumber: true, status: true, totalPaise: true, remainingBalancePaise: true, shippingAddress: true } } }, orderBy: { createdAt: 'desc' }, skip: (params.page - 1) * params.limit, take: params.limit }),
      prisma.waitlistReservation.count({ where }),
    ])
    return data(reply, items.map((item) => ({ ...waitlistResponse(item), customer: maskCustomer(item.customer), products: item.items.map((entry) => `${entry.productName} × ${entry.quantity}`).join(', ') })), { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total })
  })
  routes.post('/api/v1/admin/waitlist/reset', async (request, reply) => {
    const replay = await idemReplay(request, 'waitlist-reset')
    if (replay) return reply.status(replay.status).send(replay.body)
    const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request)
    waitlistResetConfirmationSchema.parse(request.body)

    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.waitlistReservation.findMany({ select: { id: true, customerId: true } })
      const reservationIds = reservations.map((reservation) => reservation.id)
      const customerIds = [...new Set(reservations.map((reservation) => reservation.customerId))]
      const orderWhere: Prisma.OrderWhereInput = reservationIds.length
        ? { OR: [{ source: 'waitlist' }, { waitlistReservationId: { in: reservationIds } }] }
        : { source: 'waitlist' }
      const orders = await tx.order.findMany({ where: orderWhere, select: { id: true, checkoutSessionId: true } })
      const orderIds = orders.map((order) => order.id)
      const sessionIds = [...new Set(orders.flatMap((order) => order.checkoutSessionId ? [order.checkoutSessionId] : []))]
      const cartIds = sessionIds.length
        ? [...new Set((await tx.checkoutSession.findMany({ where: { id: { in: sessionIds } }, select: { cartId: true } })).map((session) => session.cartId))]
        : []

      const holds = sessionIds.length
        ? await tx.inventoryReservation.findMany({ where: { checkoutSessionId: { in: sessionIds } }, select: { id: true, variantId: true, locationId: true, quantity: true, releasedAt: true } })
        : []
      let inventoryHoldsReleased = 0
      for (const hold of holds) {
        if (hold.releasedAt) continue
        const updated = await tx.inventoryItem.updateMany({ where: { variantId: hold.variantId, locationId: hold.locationId, reservedQty: { gte: hold.quantity } }, data: { reservedQty: { decrement: hold.quantity } } })
        if (!updated.count) throw new ApiError(409, 'WAITLIST_RESET_INVENTORY_MISMATCH', 'Waitlist reset was stopped because an inventory hold no longer matches the reserved stock. Reconcile inventory before trying again.')
        inventoryHoldsReleased += 1
      }

      const waitlistItems = reservationIds.length ? await tx.waitlistItem.count({ where: { reservationId: { in: reservationIds } } }) : 0
      const inventoryReservationsDeleted = sessionIds.length ? (await tx.inventoryReservation.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } })).count : 0
      const inventoryMovementsDeleted = orderIds.length ? (await tx.inventoryMovement.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const promotionRedemptionsDeleted = orderIds.length ? (await tx.promotionRedemption.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const affiliateAttributionsDeleted = orderIds.length ? (await tx.affiliateAttribution.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const returnRequestsDeleted = orderIds.length ? (await tx.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const shipmentsDeleted = orderIds.length ? (await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const orderItemsDeleted = orderIds.length ? (await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const refundsDeleted = orderIds.length ? (await tx.refund.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const paymentsDeleted = orderIds.length ? (await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } })).count : 0
      const ordersDeleted = orderIds.length ? (await tx.order.deleteMany({ where: { id: { in: orderIds } } })).count : 0

      const checkoutQuotesDeleted = sessionIds.length ? (await tx.checkoutQuote.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } })).count : 0
      const shippingQuotesDeleted = sessionIds.length ? (await tx.shippingQuote.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } })).count : 0
      const checkoutSessionsDeleted = sessionIds.length ? (await tx.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } })).count : 0
      const otherSessions = cartIds.length
        ? await tx.checkoutSession.findMany({ where: { cartId: { in: cartIds }, id: { notIn: sessionIds } }, select: { cartId: true } })
        : []
      const sharedCartIds = new Set(otherSessions.map((session) => session.cartId))
      const disposableCartIds = cartIds.filter((cartId) => !sharedCartIds.has(cartId))
      const cartItemsDeleted = disposableCartIds.length ? (await tx.cartItem.deleteMany({ where: { cartId: { in: disposableCartIds } } })).count : 0
      const cartsDeleted = disposableCartIds.length ? (await tx.cart.deleteMany({ where: { id: { in: disposableCartIds } } })).count : 0

      const reservationsDeleted = reservationIds.length ? (await tx.waitlistReservation.deleteMany({ where: { id: { in: reservationIds } } })).count : 0
      const customersReset = customerIds.length ? (await tx.customer.updateMany({ where: { id: { in: customerIds } }, data: { founderNumber: null, founderJoinedAt: null } })).count : 0
      const idempotencyRecordsDeleted = (await tx.idempotencyRecord.deleteMany({ where: { scope: { startsWith: 'waitlist-' } } })).count

      return {
        reservationsDeleted,
        waitlistItemsDeleted: waitlistItems,
        ordersDeleted,
        orderItemsDeleted,
        paymentsDeleted,
        refundsDeleted,
        shipmentsDeleted,
        returnRequestsDeleted,
        affiliateAttributionsDeleted,
        promotionRedemptionsDeleted,
        inventoryReservationsDeleted,
        inventoryHoldsReleased,
        inventoryMovementsDeleted,
        checkoutSessionsDeleted,
        checkoutQuotesDeleted,
        shippingQuotesDeleted,
        cartItemsDeleted,
        cartsDeleted,
        customersReset,
        idempotencyRecordsDeleted,
      }
    })

    await audit(user, request, 'reset', 'Waitlist', 'waitlist-reset', null, result, 'Admin permanently reset waitlist records; customer accounts, products, settings and audit history were preserved.')
    const envelope = { data: result, meta: { requestId: request.id } }
    await idemStore(request, 'waitlist-reset', 200, envelope)
    return reply.send(envelope)
  })
  routes.get('/api/v1/admin/waitlist/conversion-preview', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    return data(reply, await loadWaitlistConversionPreview())
  })
  routes.get('/api/v1/admin/waitlist/conversion-progress', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    const [joined, converted, pendingOrders, due, waitlistOrders] = await Promise.all([
      prisma.waitlistReservation.count({ where: { status: WaitlistStatus.joined, paymentCapturedPaise: { gt: 0 } } }),
      prisma.waitlistReservation.count({ where: { status: WaitlistStatus.converted } }),
      prisma.order.count({ where: { source: 'waitlist', status: OrderStatus.pending_payment } }),
      prisma.order.aggregate({ where: { source: 'waitlist', status: { not: OrderStatus.cancelled } }, _sum: { remainingBalancePaise: true } }),
      prisma.order.findMany({ where: { source: 'waitlist', status: { not: OrderStatus.cancelled } }, select: { shippingAddress: true, totalPaise: true, remainingBalancePaise: true, balancePaidAt: true, completionDeadlineAt: true, payments: { select: { provider: true, status: true } } } }),
    ])
    const now = Date.now()
    const addressRequired = waitlistOrders.filter((order) => !order.shippingAddress || !Object.keys(order.shippingAddress as object).length).length
    const paymentConfirmationPending = waitlistOrders.filter((order) => !order.balancePaidAt && order.payments.some((payment) => payment.provider === 'razorpay_waitlist_balance' && [PaymentStatus.pending, PaymentStatus.authorised].includes(payment.status))).length
    const paymentDue = waitlistOrders.filter((order) => !order.balancePaidAt && Number(order.totalPaise) > 0 && !order.payments.some((payment) => payment.provider === 'razorpay_waitlist_balance' && [PaymentStatus.pending, PaymentStatus.authorised].includes(payment.status))).length
    const fullyPaid = waitlistOrders.filter((order) => Boolean(order.shippingAddress && Object.keys(order.shippingAddress as object).length) && Number(order.remainingBalancePaise ?? order.totalPaise) === 0).length
    const expired = waitlistOrders.filter((order) => order.completionDeadlineAt && order.completionDeadlineAt.getTime() < now && Number(order.remainingBalancePaise ?? order.totalPaise) > 0).length
    return data(reply, { joined, converted, pendingOrders, addressRequired, paymentDue, paymentConfirmationPending, fullyPaid, expired, remainingBalancePaise: due._sum.remainingBalancePaise ?? 0 })
  })
  routes.post('/api/v1/admin/waitlist/reveal', async (request, reply) => {
    const replay = await idemReplay(request, 'waitlist-reveal')
    if (replay) return reply.status(replay.status).send(replay.body)
    const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request)
    const input = z.object({ confirm: z.literal(true), deadlineDays: z.number().int().min(1).max(365).default(30) }).parse(request.body)
    const preview = await loadWaitlistConversionPreview()
    if (preview.inventoryShortages.length) throw new ApiError(409, 'WAITLIST_INVENTORY_SHORTAGE', 'Reveal is blocked until inventory can cover the paid waitlist demand.', { inventoryShortages: 'Review the conversion preview and receive enough stock before revealing.' })
    if (preview.blockedReservations > 0) throw new ApiError(409, 'WAITLIST_CONVERSION_BLOCKED', 'Reveal is blocked because one or more paid reservations cannot be priced safely.')
    const before = { ...activeWaitlistSettings }
    const next = waitlistSettingsSchema.parse({ ...activeWaitlistSettings, enabled: true, stage: 'founder_reveal' })
    await prisma.storeSetting.upsert({ where: { key: 'waitlist-config' }, update: { value: next }, create: { key: 'waitlist-config', value: next } })
    activeWaitlistSettings = next
    const results: any[] = []
    for (const reservation of preview.reservations.filter((item) => item.status === 'ready')) {
      try { results.push({ waitlistId: reservation.waitlistId, ...(await convertWaitlistReservation(reservation.reservationId, input.deadlineDays)) }) } catch (cause: any) { results.push({ waitlistId: reservation.waitlistId, converted: false, reason: cause?.message ?? 'Conversion failed' }) }
    }
    await audit(user, request, 'reveal_waitlist', 'WaitlistSettings', 'waitlist-config', before, { ...next, converted: results.filter((item) => item.converted).length }, 'Waitlist pricing revealed and paid reservations prepared as orders')
    const response = { stage: activeWaitlistSettings.stage, converted: results.filter((item) => item.converted).length, alreadyConverted: results.filter((item) => item.reason === 'already_converted').length, failed: results.filter((item) => !item.converted && item.reason !== 'already_converted').length, results }
    const envelope = { data: response, meta: { requestId: request.id } }
    await idemStore(request, 'waitlist-reveal', 200, envelope)
    return reply.send(envelope)
  })
  const requireShiprocket = () => {
    if (shipping !== shiprocket) throw new ApiError(409, 'SHIPPING_PROVIDER_MANUAL', 'Shiprocket is not the active shipping provider.')
    if (!shiprocket.configured()) throw new ApiError(503, 'SHIPPING_PROVIDER_NOT_READY', 'Add Shiprocket API credentials to the server environment first.')
    if (!process.env.SHIPROCKET_PICKUP_PINCODE) throw new ApiError(503, 'SHIPPING_PICKUP_NOT_CONFIGURED', 'Add the pickup pincode for the Shiprocket pickup location.')
  }
  const orderPackage = (input: z.infer<typeof shippingPackageSchema>): ShippingPackage => ({ weightKg: input.weightGrams / 1000, lengthCm: input.lengthCm, breadthCm: input.breadthCm, heightCm: input.heightCm, declaredValuePaise: input.declaredValuePaise })
  const providerStatus = (payload: any) => String(payload?.data?.status ?? payload?.data?.response?.data?.status ?? payload?.status ?? '').trim()
  const providerValue = (payload: any, keys: string[]) => { for (const key of keys) { const value = key.split('.').reduce((current, part) => current?.[part], payload); if (value !== undefined && value !== null && value !== '') return String(value) } return null }

  routes.get('/api/v1/admin/shipping/status', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    return data(reply, { ...shippingEnvironment(), apiBaseUrl: shipping === shiprocket ? process.env.SHIPROCKET_API_BASE_URL ?? 'https://apiv2.shiprocket.in/v1/external' : null, defaultWeightKg: Number(process.env.SHIPPING_DEFAULT_WEIGHT_KG ?? 0.5) })
  })
  routes.post('/api/v1/admin/shipping/serviceability', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request)
    const input = z.object({ deliveryPincode: z.string().regex(/^[1-9]\d{5}$/), paymentMethod: z.enum(['cod', 'prepaid']).default('prepaid'), package: shippingPackageSchema }).parse(request.body)
    if (shipping !== shiprocket) {
      const serviceable = await shipping.serviceable(input.deliveryPincode)
      return data(reply, { provider: 'manual', serviceable, codAvailable: serviceable, couriers: serviceable ? [{ id: 'manual', name: 'Manual shipping', ratePaise: null, codAvailable: true, estimatedDays: null, etd: null }] : [], message: serviceable ? undefined : 'This pincode is not in the active serviceable-pincode list.' })
    }
    requireShiprocket()
    const result = await shiprocket.serviceability({ pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE!, deliveryPincode: input.deliveryPincode, paymentMethod: input.paymentMethod, ...orderPackage(input.package) })
    return data(reply, result)
  })
  routes.post('/api/v1/admin/orders/:id/shipment/quote', async (request, reply) => {
    await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request)
    requireShiprocket()
    const input = z.object({ paymentMethod: z.enum(['cod', 'prepaid']).default('prepaid'), package: shippingPackageSchema }).parse(request.body)
    const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { items: true } })
    if (!order) throw notFound('Order not found.')
    const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress as Record<string, any> : null
    if (!address?.pincode) throw validationError('Add a delivery address before requesting courier quotes.')
    const result = await shiprocket.serviceability({ pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE!, deliveryPincode: String(address.pincode), paymentMethod: input.paymentMethod, ...orderPackage(input.package), declaredValuePaise: input.package.declaredValuePaise ?? order.totalPaise })
    if (order.checkoutSessionId) await prisma.shippingQuote.create({ data: { checkoutSessionId: order.checkoutSessionId, pincode: String(address.pincode), serviceable: result.serviceable, chargePaise: result.couriers[0]?.ratePaise ?? 0, provider: 'shiprocket', courierId: result.couriers[0]?.id, courierName: result.couriers[0]?.name, metadata: result as any, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } })
    return data(reply, result)
  })
  routes.post('/api/v1/admin/orders/:id/shipment/book', async (request, reply) => {
    const scope = `shiprocket-book:${request.params.id}`
    const replay = await idemReplay(request, scope)
    if (replay) return reply.status(replay.status).send(replay.body)
    const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request)
    requireShiprocket()
    if (!shiprocket.bookingEnabled()) throw new ApiError(409, 'SHIPMENT_BOOKING_DISABLED', 'Shipment booking is disabled. Set SHIPROCKET_BOOKING_ENABLED=true only when you are ready to create live Shiprocket shipments.')
    const input = z.object({ courierId: z.string().min(1), courierName: z.string().min(1).optional(), paymentMethod: z.enum(['cod', 'prepaid']).default('prepaid'), package: shippingPackageSchema }).parse(request.body)
    const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { items: true, customer: true, shipments: true } })
    if (!order) throw notFound('Order not found.')
    if (order.shipments.some((shipment) => shipment.provider === 'shiprocket' && shipment.status !== 'cancelled')) throw validationError('A Shiprocket shipment is already attached to this order.')
    if (!['confirmed', 'processing', 'packed'].includes(order.status)) throw validationError('Only confirmed, processing, or packed orders can be booked.')
    const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress as Record<string, any> : null
    if (!address?.pincode || !address.addressLine1) throw validationError('Add a complete delivery address before booking shipment.')
    const paymentReady = order.payments.some((paymentRecord) => paymentRecord.status === PaymentStatus.captured || (paymentRecord.provider === 'cod' && paymentRecord.status === PaymentStatus.authorised))
    if (!paymentReady) throw validationError('A captured or COD-authorised payment is required before booking shipment.')
    const created = await shiprocket.createOrder({ orderNumber: order.orderNumber, orderDate: order.createdAt.toISOString(), pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION!, paymentMethod: input.paymentMethod, subtotalPaise: order.subtotalPaise, customer: { name: String(address.fullName ?? order.customer?.fullName ?? 'Customer'), email: order.customer?.email, phone: String(address.phone ?? order.customer?.phone ?? '') }, address: { line1: String(address.addressLine1), line2: address.addressLine2 ? String(address.addressLine2) : undefined, landmark: address.landmark ? String(address.landmark) : undefined, city: String(address.city), state: String(address.state), pincode: String(address.pincode) }, items: order.items.map((item) => ({ name: item.productName, sku: item.sku, quantity: item.quantity, sellingPricePaise: item.unitSellingPricePaise })), package: orderPackage(input.package) })
    if (!created.providerShipmentId) throw new ApiError(502, 'SHIPROCKET_ORDER_FAILED', 'Shiprocket accepted no shipment ID; the shipment was not stored as booked.')
    const assigned = await shiprocket.assignAwb(created.providerShipmentId, input.courierId)
    const awb = providerValue(assigned, ['data.response.data.awb_code', 'response.data.awb_code', 'data.awb_code', 'awb_code'])
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, provider: 'shiprocket', providerOrderId: created.providerOrderId, providerShipmentId: created.providerShipmentId, courierId: input.courierId, courierName: input.courierName ?? providerValue(assigned, ['data.response.data.courier_name', 'data.courier_name']), trackingNumber: awb, providerStatus: providerStatus(assigned) || 'awb_assigned', status: awb ? 'awb_assigned' : 'booked', metadata: { createResponse: created.raw, awbResponse: assigned } as any, packedWeightGrams: input.package.weightGrams, lengthCm: input.package.lengthCm, breadthCm: input.package.breadthCm, heightCm: input.package.heightCm, bookedAt: new Date(), events: { create: { status: awb ? 'awb_assigned' : 'booked', externalId: `book-${request.id}`, payload: { create: created.raw, assign: assigned } as any } } } })
    if (order.status !== OrderStatus.shipped) await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.shipped, statusEvents: { create: { fromStatus: order.status, toStatus: OrderStatus.shipped, reason: `Shiprocket shipment booked (${awb ?? 'AWB pending'})`, actorId: user.id } } } })
    await audit(user, request, 'shipment_book', 'Shipment', shipment.id, null, shipment, 'Shiprocket shipment booked')
    const response = { shipment }
    const envelope = { data: response, meta: { requestId: request.id } }
    await idemStore(request, scope, 201, envelope)
    return reply.status(201).send(envelope)
  })
  const shipmentAction = async (request: any, reply: any, action: 'pickup' | 'label' | 'manifest' | 'cancel' | 'refresh') => {
    const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request)
    requireShiprocket()
    const shipment = await prisma.shipment.findFirst({ where: { orderId: request.params.id, provider: 'shiprocket', status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' } })
    if (!shipment) throw notFound('No active Shiprocket shipment is attached to this order.')
    if (action === 'pickup') {
      if (!shipment.providerShipmentId) throw validationError('Shipment ID is not available yet.')
      const result = await shiprocket.requestPickup(shipment.providerShipmentId)
      const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'pickup_requested', pickupId: providerValue(result, ['data.response.pickup_id', 'data.pickup_id', 'pickup_id']), pickupScheduledAt: new Date(), providerStatus: providerStatus(result) || 'pickup_requested', events: { create: { status: 'pickup_requested', externalId: `pickup-${request.id}`, payload: result as any } } } })
      await audit(user, request, 'shipment_pickup', 'Shipment', shipment.id, shipment, updated)
      return data(reply, updated)
    }
    if (action === 'label' || action === 'manifest') {
      if (!shipment.providerShipmentId) throw validationError('Shipment ID is not available yet.')
      const result = action === 'label' ? await shiprocket.generateLabel(shipment.providerShipmentId) : await shiprocket.generateManifest(shipment.providerShipmentId)
      const url = providerValue(result, action === 'label' ? ['data.label_url', 'label_url', 'data.response.data.label_url'] : ['data.manifest_url', 'manifest_url', 'data.response.data.manifest_url'])
      const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { ...(action === 'label' ? { labelUrl: url } : { manifestUrl: url }), events: { create: { status: action === 'label' ? 'label_generated' : 'manifest_generated', externalId: `${action}-${request.id}`, payload: result as any } } } })
      await audit(user, request, `shipment_${action}`, 'Shipment', shipment.id, shipment, updated)
      return data(reply, updated)
    }
    if (action === 'cancel') {
      const ids = [shipment.providerOrderId, shipment.providerShipmentId].filter(Boolean) as string[]
      if (!ids.length) throw validationError('Provider shipment identifiers are unavailable.')
      const result = await shiprocket.cancelOrder(ids)
      const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'cancelled', providerStatus: providerStatus(result) || 'cancelled', events: { create: { status: 'cancelled', externalId: `cancel-${request.id}`, payload: result as any } } } })
      await audit(user, request, 'shipment_cancel', 'Shipment', shipment.id, shipment, updated)
      return data(reply, updated)
    }
    if (!shipment.trackingNumber) throw validationError('An AWB is required before tracking can be refreshed.')
    const result = await shiprocket.trackAwb(shipment.trackingNumber)
    const nextStatus = providerStatus(result) || providerValue(result, ['data.track_status', 'track_status']) || 'tracking_updated'
    const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status: nextStatus.toLowerCase().replaceAll(' ', '_'), providerStatus: nextStatus, lastSyncedAt: new Date(), events: { create: { status: nextStatus.toLowerCase().replaceAll(' ', '_'), externalId: `refresh-${request.id}`, payload: result as any } } } })
    await audit(user, request, 'shipment_refresh', 'Shipment', shipment.id, shipment, updated)
    return data(reply, updated)
  }
  for (const action of ['pickup', 'label', 'manifest', 'cancel', 'refresh'] as const) routes.post(`/api/v1/admin/orders/:id/shipment/${action}`, (request, reply) => shipmentAction(request, reply, action))
  routes.get('/api/v1/admin/orders/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request); const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { customer: true, items: true, payments: true, refunds: true, shipments: { include: { events: true } }, statusEvents: true, notes: true } }); if (!order) throw notFound('Order not found.'); return data(reply, { ...order, customer: maskCustomer(order.customer) }) })
  for (const [action, target] of Object.entries(transition)) app.post(`/api/v1/admin/orders/:id/${action}`, async (request, reply) => { const scope = `order-transition:${request.params.id}:${action}`; const replay = await idemReplay(request, scope); if (replay) return reply.status(replay.status).send(replay.body); const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const reason = z.string().min(3).parse(request.body?.reason); const order = await prisma.order.findUnique({ where: { id: request.params.id } }); if (!order) throw notFound('Order not found.'); const allowed: Record<OrderStatus, OrderStatus[]> = { pending_payment: [OrderStatus.confirmed, OrderStatus.cancelled], payment_failed: [OrderStatus.confirmed, OrderStatus.cancelled], confirmed: [OrderStatus.processing, OrderStatus.cancelled], processing: [OrderStatus.packed, OrderStatus.cancelled], packed: [OrderStatus.shipped], shipped: [OrderStatus.delivered], delivered: [], cancelled: [], partially_refunded: [], refunded: [], return_requested: [], returned: [] }; if (!allowed[order.status].includes(target)) throw validationError(`Cannot transition ${order.status} to ${target}.`); if (target === OrderStatus.shipped && shipping === shiprocket && !(await prisma.shipment.findFirst({ where: { orderId: order.id, provider: 'shiprocket', status: { not: 'cancelled' } } }))) throw validationError('Book a Shiprocket shipment before marking this order as shipped.'); const updated = await prisma.$transaction(async (tx) => { const next = await tx.order.update({ where: { id: order.id }, data: { status: target } }); await tx.orderStatusEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: target, reason, actorId: user.id } }); if ((target === OrderStatus.cancelled || target === OrderStatus.shipped) && order.checkoutSessionId) { const holds = await tx.inventoryReservation.findMany({ where: { checkoutSessionId: order.checkoutSessionId, releasedAt: null } }); for (const hold of holds) { const claimed = await tx.inventoryReservation.updateMany({ where: { id: hold.id, releasedAt: null }, data: { releasedAt: new Date() } }); if (!claimed.count) continue; await tx.inventoryItem.update({ where: { variantId_locationId: { variantId: hold.variantId, locationId: hold.locationId } }, data: target === OrderStatus.shipped ? { availableQty: { decrement: hold.quantity }, reservedQty: { decrement: hold.quantity } } : { reservedQty: { decrement: hold.quantity } } }); await tx.inventoryMovement.create({ data: { variantId: hold.variantId, locationId: hold.locationId, type: target === OrderStatus.shipped ? 'sale' : 'reservation_release', quantity: hold.quantity, orderId: order.id, actorId: user.id, reason: target === OrderStatus.shipped ? 'Order shipped' : 'Order cancelled' } }) } } return next }); await audit(user, request, `order_${action}`, 'Order', order.id, order, updated, reason); const envelope = { data: updated, meta: { requestId: request.id } }; await idemStore(request, scope, 200, envelope); return reply.send(envelope) })
  routes.patch('/api/v1/admin/orders/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const before = await prisma.order.findUnique({ where: { id: request.params.id } }); if (!before) throw notFound('Order not found.'); const updated = await prisma.order.update({ where: { id: before.id }, data: request.body }); await audit(user, request, 'update', 'Order', before.id, before, updated, String(request.body?.reason ?? 'Order update')); return data(reply, updated) })
  routes.post('/api/v1/admin/orders/:id/refund', async (request, reply) => { const replay = await idemReplay(request, 'refund'); if (replay) return reply.status(replay.status).send(replay.body); const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const input = z.object({ amountPaise: z.number().int().positive(), reason: z.string().min(3), confirmed: z.literal(true) }).parse(request.body); const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { payments: true, refunds: true } }); if (!order) throw notFound('Order not found.'); const captured = order.payments.reduce((sum, p) => sum + p.capturedPaise, 0); const refunded = order.refunds.reduce((sum, r) => sum + r.amountPaise, 0); if (input.amountPaise > captured - refunded) throw validationError('Refund cannot exceed captured payment.'); const paymentRecord = order.payments.find((p) => p.status === PaymentStatus.captured); if (!paymentRecord) throw validationError('No captured payment is available for refund.'); const providerRefund = await payment.refund({ paymentId: paymentRecord.providerPaymentId ?? paymentRecord.id, amountPaise: input.amountPaise }); const result = await prisma.$transaction(async (tx) => { const refund = await tx.refund.create({ data: { orderId: order.id, paymentId: paymentRecord.id, amountPaise: input.amountPaise, reason: input.reason, idempotencyKey: String(request.headers['idempotency-key'] ?? randomToken(12)), status: providerRefund.status, actorId: user.id } }); const nextStatus = input.amountPaise === captured ? OrderStatus.refunded : OrderStatus.partially_refunded; await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } }); await tx.payment.update({ where: { id: paymentRecord.id }, data: { status: nextStatus === OrderStatus.refunded ? PaymentStatus.refunded : PaymentStatus.partially_refunded } }); return refund }); await audit(user, request, 'refund', 'Order', order.id, { captured, refunded }, result, input.reason); const response = { refund: result }; await idemStore(request, 'refund', 200, { data: response, meta: { requestId: request.id } }); return data(reply, response) })
  routes.post('/api/v1/admin/orders/:id/notes', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request); const note = await prisma.orderNote.create({ data: { orderId: request.params.id, body: z.string().min(2).parse(request.body?.body), actorId: user.id } }); await audit(user, request, 'note', 'Order', request.params.id, null, note); return data(reply, note) })
  routes.post('/api/v1/admin/orders/:id/resend-confirmation', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { customer: true } }); if (!order) throw notFound('Order not found.'); if (order.customer) await email.send({ to: order.customer.email, subject: `SkinFox order ${order.orderNumber}`, html: '<p>Your order confirmation is available.</p>' }); await audit(user, request, 'resend_confirmation', 'Order', order.id, null, null); return data(reply, { sent: Boolean(order.customer) }) })
  routes.get('/api/v1/admin/orders/:id/invoice', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: { items: true } }); if (!order) throw notFound('Order not found.'); return data(reply, { orderNumber: order.orderNumber, currency: order.currency, items: order.items, totalPaise: order.totalPaise }) })
  routes.get('/api/v1/admin/orders/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); return data(reply, await prisma.order.findMany({ include: { items: true } })) })

  adminCrud('categories', 'category', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('concerns', 'concern', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('collections', 'collection', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('tags', 'tag', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('ingredients', 'ingredient', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('product-claims', 'productClaim', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('related-products', 'relatedProduct', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER])
  adminCrud('promotions', 'promotion', [AdminRole.SUPER_ADMIN])
  adminCrud('coupons', 'coupon', [AdminRole.SUPER_ADMIN])
  adminCrud('shipping-zones', 'shippingZone', [AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])
  adminCrud('shipping-rates', 'shippingRate', [AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])
  adminCrud('serviceable-pincodes', 'serviceablePincode', [AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER], ['pincode', 'city', 'state'])
  adminCrud('tax-rules', 'taxRule', [AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])
  adminCrud('pages', 'page', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('home-sections', 'homeSection', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('campaign-slides', 'campaignSlide', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('faqs', 'fAQ', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('navigation', 'navigationMenu', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('footer', 'navigationMenu', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR], ['name', 'location'])
  adminCrud('care-moments', 'careMoment', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('scroll-stories', 'scrollStory', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('before-after-stories', 'beforeAfterStory', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('announcement-bars', 'announcementBar', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('legal-policies', 'legalPolicy', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('seo-settings', 'storeSetting', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  routes.get('/api/v1/admin/care-finder', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])(request); const finder = await prisma.careFinder.findFirst({ where: { active: true }, include: { questions: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } }, rules: { include: { product: { select: { id: true, slug: true, name: true, status: true, purchaseState: true } } } } } }); return data(reply, finder) })
  routes.patch('/api/v1/admin/care-finder/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])(request); const input = z.object({ name: z.string().min(2).optional(), version: z.number().int().positive().optional(), active: z.boolean().optional(), config: z.record(z.unknown()).optional() }).parse(request.body); const before = await prisma.careFinder.findUnique({ where: { id: request.params.id } }); if (!before) throw notFound('Care finder not found.'); const updated = await prisma.careFinder.update({ where: { id: before.id }, data: input }); await audit(user, request, 'update', 'CareFinder', before.id, before, updated); return data(reply, updated) })
  adminCrud('care-finder/questions', 'careFinderQuestion', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('care-finder/options', 'careFinderOption', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  adminCrud('care-finder/rules', 'careFinderRule', [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])
  routes.post('/api/v1/admin/care-finder/preview', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])(request); return data(reply, { preview: true, answers: request.body?.answers ?? {}, recommendation: 'Preview uses the same weighted rules as the storefront.' }) })
  routes.get('/api/v1/admin/care-finder/coverage', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CONTENT_EDITOR])(request); return data(reply, { covered: true, uncoveredCombinations: [] }) })

  routes.get('/api/v1/admin/media', async (request, reply) => adminList(request, reply, 'mediaAsset', [AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR], {}, { id: true, key: true, originalFilename: true, mimeType: true, sizeBytes: true, alt: true, createdAt: true, archivedAt: true }))
  routes.put('/api/v1/admin/media/local-upload/:key', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const key = String(request.params.key); if (!/^[a-zA-Z0-9._-]+$/.test(key)) throw validationError('Invalid media key.'); const payload = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body ?? '')); if (!payload.length || payload.length > 50_000_000) throw validationError('Media payload must be between 1 byte and 50 MB.'); const directory = resolve(process.cwd(), 'uploads'); await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, key), payload); return data(reply, { uploaded: true, key, sizeBytes: payload.length }) })
  routes.post('/api/v1/admin/media/presign', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const input = z.object({ filename: z.string().min(1), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']), sizeBytes: z.number().int().positive().max(50_000_000), checksum: z.string().min(8), alt: z.string().min(12) }).parse(request.body); const existing = await prisma.mediaAsset.findUnique({ where: { checksum: input.checksum } }); if (existing) return data(reply, { duplicate: true, asset: existing }); const key = `${randomToken(8)}-${input.filename.toLowerCase().replace(/[^a-z0-9.-]/g, '-')}`; const presigned = await storage.presign({ key, mimeType: input.mimeType }); await audit(user, request, 'presign_upload', 'MediaAsset', null, null, { key, mimeType: input.mimeType }); return data(reply, { duplicate: false, ...presigned, expiresInSeconds: 900 }) })
  routes.post('/api/v1/admin/media/complete', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const input = z.object({ key: z.string(), originalFilename: z.string(), mimeType: z.string(), sizeBytes: z.number().int(), checksum: z.string(), alt: z.string().min(12), width: z.number().int().optional(), height: z.number().int().optional() }).parse(request.body); const asset = await prisma.mediaAsset.create({ data: input }); await audit(user, request, 'complete_upload', 'MediaAsset', asset.id, null, asset); return data(reply, asset) })
  routes.patch('/api/v1/admin/media/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const updated = await prisma.mediaAsset.update({ where: { id: request.params.id }, data: request.body }); await audit(user, request, 'update', 'MediaAsset', updated.id, null, updated); return data(reply, updated) })
  routes.post('/api/v1/admin/media/:id/archive', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const updated = await prisma.mediaAsset.update({ where: { id: request.params.id }, data: { archivedAt: new Date() } }); await audit(user, request, 'archive', 'MediaAsset', updated.id, null, updated); return data(reply, updated) })
  routes.delete('/api/v1/admin/media/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); const asset = await prisma.mediaAsset.findUnique({ where: { id: request.params.id }, include: { productMedia: { include: { product: true } } } }); if (!asset) throw notFound('Media asset not found.'); if (asset.productMedia.some((media) => media.product.status === PublicationStatus.published)) throw validationError('Published content references this asset; archive it instead.'); await prisma.mediaAsset.delete({ where: { id: asset.id } }); await audit(user, request, 'delete', 'MediaAsset', asset.id, asset, null); return data(reply, { deleted: true }) })
  routes.get('/api/v1/admin/media/:id/references', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR])(request); return data(reply, await prisma.productMedia.findMany({ where: { mediaAssetId: request.params.id }, include: { product: { select: { id: true, name: true, status: true } } } })) })

  routes.get('/api/v1/admin/customers', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request); const params = pageParams(request); const where: any = params.q ? { OR: [{ fullName: { contains: params.q, mode: 'insensitive' } }, { email: { contains: params.q, mode: 'insensitive' } }, { phone: { contains: params.q, mode: 'insensitive' } }] } : {}; const [items, total] = await Promise.all([prisma.customer.findMany({ where, select: { id: true, fullName: true, email: true, phone: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (params.page - 1) * params.limit, take: params.limit }), prisma.customer.count({ where })]); return data(reply, items.map((customer) => ({ ...customer, email: customer.email ? customer.email.replace(/(^.).*(@.*$)/, '$1***$2') : null, phone: customer.phone ? `${customer.phone.slice(0, 2)}******${customer.phone.slice(-2)}` : null })), { page: params.page, limit: params.limit, total, hasNextPage: params.page * params.limit < total }) })
  routes.get('/api/v1/admin/customers/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request); const customer = await prisma.customer.findUnique({ where: { id: request.params.id }, include: { orders: true, notes: true, consents: true } }); if (!customer) throw notFound('Customer not found.'); return data(reply, { ...customer, email: customer.email ? customer.email.replace(/(^.).*(@.*$)/, '$1***$2') : null, phone: customer.phone ? `${customer.phone.slice(0, 2)}******${customer.phone.slice(-2)}` : null }) })
  routes.patch('/api/v1/admin/customers/:id', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT])(request); const updated = await prisma.customer.update({ where: { id: request.params.id }, data: request.body }); await audit(user, request, 'update', 'Customer', updated.id, null, { id: updated.id }); return data(reply, updated) })
  routes.get('/api/v1/admin/customers/:id/orders', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_AGENT])(request); return data(reply, await prisma.order.findMany({ where: { customerId: request.params.id }, orderBy: { createdAt: 'desc' } })) })
  routes.post('/api/v1/admin/customers/:id/notes', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT])(request); return data(reply, await prisma.customerNote.create({ data: { customerId: request.params.id, body: z.string().min(2).parse(request.body?.body), createdById: user.id } })) })
  routes.post('/api/v1/admin/customers/:id/anonymize', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request); const result = await prisma.customer.update({ where: { id: request.params.id }, data: { fullName: 'Anonymized customer', email: `anonymized-${randomToken(8)}@invalid.local`, phone: null } }); await audit(user, request, 'anonymize', 'Customer', result.id, null, { id: result.id }); return data(reply, { anonymized: true }) })
  routes.post('/api/v1/admin/customers/:id/export-data', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT])(request); const customer = await prisma.customer.findUnique({ where: { id: request.params.id }, include: { orders: { include: { items: true } }, addresses: true, consents: true } }); if (!customer) throw notFound('Customer not found.'); return data(reply, customer) })
  routes.patch('/api/v1/admin/customers/:id/consent', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT])(request); const input = z.object({ type: z.string(), granted: z.boolean(), policyVersion: z.string() }).parse(request.body); const consent = await prisma.customerConsent.create({ data: { ...input, customerId: request.params.id, consentAt: new Date() } }); await audit(user, request, 'consent_update', 'Customer', request.params.id, null, consent); return data(reply, consent) })

  adminCrud('launch-interests', 'launchInterest', [AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST], ['email', 'name', 'pincode', 'status'])
  routes.get('/api/v1/admin/launch-interests/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request); return data(reply, await prisma.launchInterest.findMany()) })
  adminCrud('newsletter-subscribers', 'newsletterSubscription', [AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST], ['email'])
  routes.get('/api/v1/admin/newsletter-subscribers/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT, AdminRole.ANALYST])(request); return data(reply, await prisma.newsletterSubscription.findMany({ select: { id: true, email: true, confirmedAt: true, unsubscribedAt: true, createdAt: true } })) })
  adminCrud('contact-submissions', 'contactSubmission', [AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_AGENT], ['name', 'email', 'subject', 'status'])

  routes.get('/api/v1/admin/users', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); return data(reply, await prisma.adminUser.findMany({ select: { id: true, email: true, name: true, role: true, isActive: true, mfaRequired: true, createdAt: true, lastLoginAt: true }, orderBy: { createdAt: 'desc' } })) })
  routes.post('/api/v1/admin/users/invite', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request); const input = z.object({ email: z.string().email(), role: z.nativeEnum(AdminRole) }).parse(request.body); const token = randomToken(32); const invitation = await prisma.adminInvitation.create({ data: { email: input.email.toLowerCase(), role: input.role, tokenHash: hashToken(token), invitedById: user.id, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }); await audit(user, request, 'invite', 'AdminInvitation', invitation.id, null, { email: invitation.email, role: invitation.role }); return data(reply, { id: invitation.id, email: invitation.email, role: invitation.role, invitationToken: process.env.NODE_ENV === 'production' ? undefined : token }) })
  routes.get('/api/v1/admin/users/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); const user = await prisma.adminUser.findUnique({ where: { id: request.params.id }, select: { id: true, email: true, name: true, role: true, isActive: true, mfaRequired: true, mustChangePassword: true, createdAt: true, lastLoginAt: true } }); if (!user) throw notFound('Admin user not found.'); return data(reply, user) })
  routes.patch('/api/v1/admin/users/:id', async (request, reply) => { const actor = await requireAdmin([AdminRole.SUPER_ADMIN])(request); const input = z.object({ name: z.string().min(2).optional(), role: z.nativeEnum(AdminRole).optional(), isActive: z.boolean().optional(), mfaRequired: z.boolean().optional() }).parse(request.body); const updated = await prisma.adminUser.update({ where: { id: request.params.id }, data: input }); await audit(actor, request, 'update', 'AdminUser', updated.id, null, { id: updated.id, role: updated.role, isActive: updated.isActive }); return data(reply, updated) })
  for (const [action, active] of [['suspend', false], ['activate', true] ] as const) app.post(`/api/v1/admin/users/:id/${action}`, async (request, reply) => { const actor = await requireAdmin([AdminRole.SUPER_ADMIN])(request); const updated = await prisma.adminUser.update({ where: { id: request.params.id }, data: { isActive: active } }); if (!active) await prisma.adminSession.updateMany({ where: { userId: updated.id }, data: { revokedAt: new Date() } }); await audit(actor, request, action, 'AdminUser', updated.id, null, { isActive: active }); return data(reply, updated) })
  routes.post('/api/v1/admin/users/:id/revoke-sessions', async (request, reply) => { const actor = await requireAdmin([AdminRole.SUPER_ADMIN])(request); await prisma.adminSession.updateMany({ where: { userId: request.params.id }, data: { revokedAt: new Date() } }); await audit(actor, request, 'revoke_sessions', 'AdminUser', request.params.id, null, null); return data(reply, { revoked: true }) })
  routes.get('/api/v1/admin/roles', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { name: 'asc' } }); return data(reply, roles.length ? roles.map((role) => ({ id: role.id, role: role.code, name: role.name, description: role.description, permissions: role.permissions.map((item) => item.permission.key) })) : Object.entries(rolePermissions).map(([role, permissions]) => ({ role, permissions }))) })
  routes.post('/api/v1/admin/roles', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); return data(reply, { accepted: false, message: 'Built-in roles are immutable; use permissions mapping in a deployment extension.' }) })
  routes.patch('/api/v1/admin/roles/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); return data(reply, { accepted: false, id: request.params.id }) })
  routes.delete('/api/v1/admin/roles/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); throw validationError('Built-in roles cannot be deleted.') })
  routes.get('/api/v1/admin/permissions', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); const permissions = await prisma.permission.findMany({ orderBy: { key: 'asc' } }); return data(reply, permissions.length ? permissions.map((permission) => permission.key) : [...new Set(Object.values(rolePermissions).flat())]) })
  routes.get('/api/v1/admin/audit-logs', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ANALYST])(request); return data(reply, await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { id: true, email: true, name: true, role: true } } } })) })
  routes.get('/api/v1/admin/audit-logs/:id', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ANALYST])(request); const log = await prisma.auditLog.findUnique({ where: { id: request.params.id }, include: { actor: true } }); if (!log) throw notFound('Audit log not found.'); return data(reply, log) })
  routes.get('/api/v1/admin/audit-logs/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ANALYST])(request); return data(reply, await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } })) })
  for (const setting of ['store', 'payments', 'shipping', 'notifications', 'integrations', 'features']) { const key = `settings-${setting}`; app.get(`/api/v1/admin/settings/${setting}`, async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN])(request); const item = await prisma.storeSetting.findUnique({ where: { key } }); return data(reply, redactSensitiveSettings(item?.value ?? {})) }); app.patch(`/api/v1/admin/settings/${setting}`, async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN])(request); const value = z.record(z.unknown()).parse(request.body); if (containsSensitiveSetting(value)) throw validationError('Credentials and secrets must be managed through the server environment, not stored in the admin database.'); const item = await prisma.storeSetting.upsert({ where: { key }, update: { value }, create: { key, value } }); await audit(user, request, 'update', 'StoreSetting', item.id, null, { key }); return data(reply, redactSensitiveSettings(item.value)) }) }
  for (const [name, handler] of Object.entries({ summary: async () => ({ orders: await prisma.order.count(), products: await prisma.product.count({ where: { status: PublicationStatus.published } }), customers: await prisma.customer.count(), launchInterests: await prisma.launchInterest.count(), revenuePaise: (await prisma.order.aggregate({ _sum: { totalPaise: true }, where: { status: { in: [OrderStatus.confirmed, OrderStatus.processing, OrderStatus.packed, OrderStatus.shipped, OrderStatus.delivered] } } }))._sum.totalPaise ?? 0 }), sales: async () => prisma.order.groupBy({ by: ['status'], _count: true, _sum: { totalPaise: true } }), products: async () => prisma.product.groupBy({ by: ['purchaseState'], _count: true }), inventory: async () => prisma.inventoryItem.aggregate({ _sum: { availableQty: true, reservedQty: true } }), leads: async () => ({ launchInterests: await prisma.launchInterest.count(), newsletter: await prisma.newsletterSubscription.count(), contact: await prisma.contactSubmission.count() }), content: async () => ({ publishedPages: await prisma.page.count({ where: { status: PublicationStatus.published } }), slides: await prisma.campaignSlide.count({ where: { status: PublicationStatus.published } }) }), 'system-health': async () => ({ database: 'ok', queue: 'local-adapter', storage: 'local-adapter' }) })) { app.get(`/api/v1/admin/dashboard/${name}`, async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER, AdminRole.CATALOG_MANAGER, AdminRole.CONTENT_EDITOR, AdminRole.ANALYST])(request); return data(reply, await handler()) }) }
  routes.post('/api/v1/admin/serviceable-pincodes/import', async (request, reply) => { const user = await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); const entries = z.array(z.object({ pincode: z.string().regex(/^[1-9]\d{5}$/), city: z.string().min(2), state: z.string().min(2), active: z.boolean().optional() })).max(500).parse(request.body?.entries ?? request.body); for (const entry of entries) await prisma.serviceablePincode.upsert({ where: { pincode: entry.pincode }, update: entry, create: entry }); await audit(user, request, 'serviceable_pincode_import', 'ServiceablePincode', null, null, { count: entries.length }); return data(reply, { imported: entries.length }) })
  routes.get('/api/v1/admin/serviceable-pincodes/export', async (request, reply) => { await requireAdmin([AdminRole.SUPER_ADMIN, AdminRole.ORDER_MANAGER])(request); return data(reply, await prisma.serviceablePincode.findMany()) })

  return app
}

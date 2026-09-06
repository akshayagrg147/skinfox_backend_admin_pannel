import { z } from 'zod'

export const purchaseStateSchema = z.enum(['available', 'coming_soon', 'out_of_stock', 'discontinued'])
export const productMediaSchema = z.object({
  type: z.enum(['image', 'video']),
  src: z.string().min(1),
  mobileSrc: z.string().optional(),
  poster: z.string().optional(),
  alt: z.string().min(1),
  sortOrder: z.number().int().nonnegative().default(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspectRatio: z.number().positive().optional(),
  fitMode: z.enum(['contain', 'cover']).default('contain'),
  objectPosition: z.string().default('50% 50%'),
  imageScale: z.number().positive().max(2).default(1),
  focalPointX: z.number().min(0).max(1).default(0.5),
  focalPointY: z.number().min(0).max(1).default(0.5),
})
export const productInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subtitle: z.string().min(2),
  pricePaise: z.number().int().positive().nullable(),
  mrpPaise: z.number().int().positive().nullable(),
  purchaseState: purchaseStateSchema.default('coming_soon'),
  media: z.array(productMediaSchema).default([]),
}).superRefine((value, ctx) => {
  if (value.pricePaise !== null && value.mrpPaise !== null && value.mrpPaise < value.pricePaise) ctx.addIssue({ code: 'custom', path: ['mrpPaise'], message: 'MRP cannot be lower than selling price' })
  if (value.purchaseState === 'available' && value.pricePaise === null) ctx.addIssue({ code: 'custom', path: ['pricePaise'], message: 'Available products require a selling price' })
})
export const addressSchema = z.object({
  fullName: z.string().min(2), email: z.string().email(), phone: z.string().regex(/^[6-9]\d{9}$/), addressLine1: z.string().min(5), addressLine2: z.string().optional(), landmark: z.string().optional(), city: z.string().min(2), state: z.string().min(2), pincode: z.string().regex(/^\d{6}$/), billingSameAsShipping: z.boolean().default(true), marketingConsent: z.boolean().default(false),
})
export type PurchaseState = z.infer<typeof purchaseStateSchema>
export type ProductMediaInput = z.infer<typeof productMediaSchema>

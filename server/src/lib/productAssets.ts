import { z } from 'zod'

export const productImageAssetSchema = z.string().regex(
  /^\/products\/(?!.*\.\.)[a-zA-Z0-9/_-]+\.(?:avif|jpe?g|png|webp)$/,
  'Use an image from the website assets folder, for example /products/product-name.webp',
)

const localUploadedImageSchema = z.string().regex(
  /^\/api\/v1\/media\/[a-zA-Z0-9._-]+$/,
  'Use a valid uploaded media URL.',
)

const remoteImageSchema = z.string().url().refine((value) => value.startsWith('https://'), 'Uploaded images must use HTTPS.')

/**
 * Product images can be bundled website artwork, locally served uploads in a
 * development environment, or HTTPS URLs returned by the configured media
 * provider. The backend still verifies provider uploads before persistence.
 */
export const productImageSourceSchema = z.union([productImageAssetSchema, localUploadedImageSchema, remoteImageSchema])

export const productMediaAssetSchema = z.string().regex(
  /^\/products\/(?!.*\.\.)[a-zA-Z0-9/_-]+\.(?:avif|jpe?g|png|webp|mp4|webm)$/,
  'Use media from the website assets folder, for example /products/product-name.webp',
)

export const productMediaSourceSchema = z.union([
  productMediaAssetSchema,
  z.string().regex(/^\/api\/v1\/media\/[a-zA-Z0-9._-]+$/, 'Use a valid uploaded media URL.'),
  remoteImageSchema,
])

export const productMediaInputSchema = z.object({
  type: z.enum(['image', 'video']),
  src: productMediaSourceSchema,
  mobileSrc: productImageSourceSchema.optional(),
  poster: productImageSourceSchema.optional(),
  alt: z.string().min(12),
  sortOrder: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspectRatio: z.number().positive().optional(),
  fitMode: z.enum(['contain', 'cover']).optional(),
  objectPosition: z.string().optional(),
  imageScale: z.number().positive().optional(),
  focalPointX: z.number().min(0).max(1).optional(),
  focalPointY: z.number().min(0).max(1).optional(),
  mediaAssetId: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'image' && value.src.startsWith('/api/v1/media/') && !value.mediaAssetId) ctx.addIssue({ code: 'custom', path: ['mediaAssetId'], message: 'Uploaded images must reference a media asset.' })
})

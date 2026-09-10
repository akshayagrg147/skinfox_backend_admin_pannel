import { z } from 'zod'

export const productImageAssetSchema = z.string().regex(
  /^\/products\/(?!.*\.\.)[a-zA-Z0-9/_-]+\.(?:avif|jpe?g|png|webp)$/,
  'Use an image from the website assets folder, for example /products/product-name.webp',
)

export const productMediaAssetSchema = z.string().regex(
  /^\/products\/(?!.*\.\.)[a-zA-Z0-9/_-]+\.(?:avif|jpe?g|png|webp|mp4|webm)$/,
  'Use media from the website assets folder, for example /products/product-name.webp',
)

export const productMediaInputSchema = z.object({
  type: z.enum(['image', 'video']),
  src: productMediaAssetSchema,
  mobileSrc: productImageAssetSchema.optional(),
  poster: productImageAssetSchema.optional(),
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
})

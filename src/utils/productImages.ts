// Only supplied local artwork has generated alternatives. New catalogue uploads
// continue to use their original URL without requesting non-existent variants.
const responsiveArtwork = new Set([
  'rayyvia-sun-protect-primary',
  'coco-kiss-lotion-primary',
  'acnfin-soft-face-wash-primary',
  'hydrelle-campaign-new',
  'onion-shampoo-primary',
  'scalp-hair-treatment-primary',
  'onion-hair-oil-primary',
])

export function productImageSrcSet(src: string): string | undefined {
  const name = /^\/products\/([^/]+)\.webp$/.exec(src)?.[1]
  if (!name || !responsiveArtwork.has(name)) return undefined
  return [320, 640].map((width) => `/products/responsive/${name}-${width}.webp ${width}w`).join(', ')
}

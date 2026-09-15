// Local artwork has checked-in responsive alternatives. ImageKit uploads use
// ImageKit's URL transformations so storefront cards can request an
// appropriately sized, automatic-format rendition without another upload.
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
  if (/^https:\/\/ik\.imagekit\.io\//i.test(src)) {
    try {
      const url = new URL(src)
      const path = /^\/([^/]+)(\/.*)?$/.exec(url.pathname)
      if (!path) return undefined
      return [320, 640].map((width) => `${url.origin}/${path[1]}/tr:w-${width},q-80,f-auto${path[2] ?? ''}${url.search} ${width}w`).join(', ')
    } catch {
      return undefined
    }
  }
  const name = /^\/products\/([^/]+)\.webp$/.exec(src)?.[1]
  if (!name || !responsiveArtwork.has(name)) return undefined
  return [320, 640].map((width) => `/products/responsive/${name}-${width}.webp ${width}w`).join(', ')
}

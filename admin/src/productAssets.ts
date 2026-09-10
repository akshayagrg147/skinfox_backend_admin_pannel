const productAssetPattern = /^\/products\/(?!.*\.\.)[a-zA-Z0-9/_-]+\.(?:avif|jpe?g|png|webp)$/

export const isProductImageAssetPath = (path: string) => productAssetPattern.test(path)

export const splitAssetPaths = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

export const makeProductSlug = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

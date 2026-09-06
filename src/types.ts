export type ProductType = 'sunscreen' | 'face-wash' | 'shampoo' | 'hair-oil' | 'lotion' | 'hair-treatment'

export type ProductPackaging = 'pump-bottle' | 'tube' | 'oil-bottle' | 'treatment-bottle'

export type ProductMedia = {
  type: 'image' | 'video'
  src: string
  mobileSrc?: string
  alt: string
  poster?: string
  sortOrder?: number
  width?: number
  height?: number
  aspectRatio?: number
  fitMode?: 'contain' | 'cover'
  objectPosition?: string
  imageScale?: number
  focalPointX?: number
  focalPointY?: number
}

export type Product = {
  id: string
  name: string
  subtitle: string
  type: ProductType
  packaging: ProductPackaging
  category: string
  concern: string
  concerns: string[]
  benefit: string
  description: string
  price: number | null
  mrp: number | null
  size: string
  usage: string
  step: string
  highlights: string[]
  color: string
  accent: string
  tint: string
  image: string
  storyImage?: string
  imageAlt: string
  imagePosition: string
  imageScale: number
  media: ProductMedia[]
  badge?: string
}

export type CartLine = {
  product: Product
  quantity: number
}

export type QuizAnswer = {
  skinFeel?: string
  concern?: string
  ritual?: string
}

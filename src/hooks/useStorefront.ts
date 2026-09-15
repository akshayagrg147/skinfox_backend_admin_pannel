/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { products as seedProducts } from '../data/products'
import { normalizeProductCopy } from '../data/productCopy'
import type { Product } from '../types'
import { getStorefront } from '../lib/storefrontApi'

export type CampaignApiSlide = { id: string; kind: 'image' | 'video'; desktopSrc: string; mobileSrc?: string; poster?: string; alt: string; durationMs: number; autoplay: boolean; ctaLabel?: string; ctaUrl?: string; textOverlay?: { eyebrow?: string; title?: string; description?: string } | null }
export type CareFinderCondition = { key: string; equals?: string; in?: string[]; not?: string[] }
export type CareFinderApi = {
  id: string
  name: string
  config?: { intro?: string; resultTitle?: string; resultDescription?: string; packageNames?: Record<string, string>; disclaimer?: string; guidanceNote?: string } | null
  questions: Array<{
    id: string
    key: string
    prompt: string
    sortOrder: number
    selectionMode?: 'single' | 'multi'
    required?: boolean
    condition?: CareFinderCondition | null
    options: Array<{ id: string; value: string; label: string; description?: string; condition?: CareFinderCondition | null }>
  }>
}
export type HomeApi = { sections?: Array<Record<string, unknown>>; campaignSlides?: CampaignApiSlide[]; faqs?: Array<{ question: string; answer: string }>; careMoments?: Array<Record<string, unknown>>; announcement?: string | null }
export type LaunchPromotion = { id: string; enabled: boolean; discountPercent: number; maximumOrders: number; successfulOrders: number; remainingOrders: number; status: 'active' | 'paused' | 'scheduled' | 'completed' | 'ended'; message: string }
export type PaymentMethod = 'cod' | 'razorpay'

const fixedProductBySlug = new Map(seedProducts.map((product) => [product.id, product]))

export const mapProduct = (value: any): Product => {
  const id = value.slug ?? value.id
  const fixed = fixedProductBySlug.get(id)
  // The first seven products ship with approved artwork in the storefront
  // bundle. Keep that artwork as a fallback for legacy catalogue rows, but
  // prefer any gallery explicitly linked to a managed media asset. This lets
  // an administrator replace or extend photography without a redeploy while
  // preserving the existing seed experience for older records.
  const apiMedia = Array.isArray(value.media)
    ? [...value.media]
      .filter((media: any) => media && typeof media.src === 'string')
      .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
      .map((media: any) => ({ type: media.type, src: media.src, mobileSrc: media.mobileSrc, alt: media.alt, poster: media.poster, sortOrder: media.sortOrder, width: media.width, height: media.height, aspectRatio: media.aspectRatio, fitMode: media.fitMode, objectPosition: media.objectPosition, imageScale: media.imageScale, focalPointX: media.focalPointX, focalPointY: media.focalPointY }))
    : []
  const managedMedia = Array.isArray(value.media) && value.media.some((media: any) => typeof media?.mediaAssetId === 'string')
  const useFixedArtwork = Boolean(fixed && !managedMedia)
  const media = useFixedArtwork ? fixed?.media ?? [] : apiMedia
  const primaryMedia = media.find((item) => item.type === 'image')
  return normalizeProductCopy({
    ...value,
    id,
    price: value.pricePaise === null || value.pricePaise === undefined ? null : value.pricePaise / 100,
    mrp: value.mrpPaise === null || value.mrpPaise === undefined ? null : value.mrpPaise / 100,
    step: value.routineStep ?? value.step,
    ...(useFixedArtwork && fixed ? { image: fixed.image, imageAlt: fixed.imageAlt, imagePosition: fixed.imagePosition, imageScale: fixed.imageScale, storyImage: fixed.storyImage, media } : {
      image: value.image ?? primaryMedia?.src ?? '',
      imageAlt: value.imageAlt ?? primaryMedia?.alt ?? '',
      media,
    }),
  })
}

export const mapCatalogProducts = (catalog: any[]): Product[] => {
  const catalogBySlug = new Map(catalog.map((product) => [product.slug ?? product.id, product]))
  const launchProducts = seedProducts.flatMap((fixed) => {
    const product = catalogBySlug.get(fixed.id)
    return product ? [mapProduct(product)] : []
  })
  const additionalProducts = catalog
    .filter((product) => !fixedProductBySlug.has(product.slug ?? product.id))
    .map(mapProduct)

  return [...launchProducts, ...additionalProducts]
}

export function useStorefront() {
  const isTest = import.meta.env.MODE === 'test'
  const isServer = Boolean(import.meta.env.SSR)
  const [products, setProducts] = useState<Product[]>(isTest ? seedProducts : isServer ? seedProducts.map((product) => ({ ...product, price: null, mrp: null })) : [])
  const [campaigns, setCampaigns] = useState<CampaignApiSlide[]>([])
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [home, setHome] = useState<HomeApi | null>(null)
  const [careFinder, setCareFinder] = useState<CareFinderApi | null>(null)
  const [promotion, setPromotion] = useState<LaunchPromotion>({ id: 'skinfox-launch-50', enabled: true, discountPercent: 50, maximumOrders: 500, successfulOrders: 0, remainingOrders: 500, status: 'active', message: 'Exclusive launch access — enjoy 50% off for the first 500 orders.' })
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(['cod'])
  const [loading, setLoading] = useState(!isTest && !isServer)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isTest) return
    let cancelled = false
    Promise.all([getStorefront<any>('/products?limit=100'), getStorefront<CampaignApiSlide[]>('/campaign-slides'), getStorefront<Array<{ question: string; answer: string }>>('/faqs'), getStorefront<CareFinderApi>('/care-finder'), getStorefront<HomeApi>('/pages/home'), getStorefront<{ promotion?: LaunchPromotion; enabledPaymentMethods?: PaymentMethod[] }>('/storefront/bootstrap')]).then(([catalog, slides, faqItems, finder, homePayload, bootstrap]) => {
      if (cancelled) return
      setProducts(mapCatalogProducts(catalog.data ?? catalog))
      setHome(homePayload)
      setCampaigns(homePayload.campaignSlides?.length ? homePayload.campaignSlides : slides)
      setFaqs(homePayload.faqs?.length ? homePayload.faqs : faqItems)
      setCareFinder(finder)
      if (bootstrap.promotion) setPromotion(bootstrap.promotion)
      if (Array.isArray(bootstrap.enabledPaymentMethods) && bootstrap.enabledPaymentMethods.length) setEnabledPaymentMethods(bootstrap.enabledPaymentMethods)
      setError('')
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'The SkinFox API is unavailable.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isTest])
  return { products, campaigns, faqs, careFinder, home, promotion, enabledPaymentMethods, loading, error, apiMode: !isTest }
}

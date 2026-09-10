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
export type WaitlistConfig = {
  enabled: boolean
  depositPaise: number
  discountPercent: number
  currency: 'INR'
  refundable: boolean
  termsVersion: string
  paymentConfigured: boolean
  razorpayKeyId?: string
  stage: 'waitlist' | 'founder_reveal' | 'launch' | 'regular'
  founderCapacity: number
  founderClaimed: number
  founderRemaining: number
  foundingClosed: boolean
  founderPricePaise: number | null
  launchPricePaise: number
  regularPricePaise: number
}

const fixedProductBySlug = new Map(seedProducts.map((product) => [product.id, product]))

export const mapProduct = (value: any): Product => {
  const id = value.slug ?? value.id
  const fixed = fixedProductBySlug.get(id)
  return normalizeProductCopy({
    ...value,
    id,
    price: value.pricePaise === null || value.pricePaise === undefined ? null : value.pricePaise / 100,
    mrp: value.mrpPaise === null || value.mrpPaise === undefined ? null : value.mrpPaise / 100,
    step: value.routineStep ?? value.step,
    ...(fixed ? { image: fixed.image, imageAlt: fixed.imageAlt, imagePosition: fixed.imagePosition, imageScale: fixed.imageScale, storyImage: fixed.storyImage, media: fixed.media } : {
      media: (value.media ?? []).map((media: any) => ({ type: media.type, src: media.src, mobileSrc: media.mobileSrc, alt: media.alt, poster: media.poster, sortOrder: media.sortOrder, width: media.width, height: media.height, aspectRatio: media.aspectRatio, fitMode: media.fitMode, objectPosition: media.objectPosition, imageScale: media.imageScale, focalPointX: media.focalPointX, focalPointY: media.focalPointY })),
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
  const [waitlist, setWaitlist] = useState<WaitlistConfig>({ enabled: true, depositPaise: 9900, discountPercent: 25, currency: 'INR', refundable: false, termsVersion: '2026-09-10-nonrefundable', paymentConfigured: false, stage: 'waitlist', founderCapacity: 200, founderClaimed: 0, founderRemaining: 200, foundingClosed: false, founderPricePaise: 59900, launchPricePaise: 64900, regularPricePaise: 70000 })
  const [loading, setLoading] = useState(!isTest && !isServer)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isTest) return
    let cancelled = false
    Promise.all([getStorefront<any>('/products?limit=100'), getStorefront<CampaignApiSlide[]>('/campaign-slides'), getStorefront<Array<{ question: string; answer: string }>>('/faqs'), getStorefront<CareFinderApi>('/care-finder'), getStorefront<HomeApi>('/pages/home'), getStorefront<WaitlistConfig>('/waitlist/config')]).then(([catalog, slides, faqItems, finder, homePayload, waitlistConfig]) => {
      if (cancelled) return
      setProducts(mapCatalogProducts(catalog.data ?? catalog))
      setHome(homePayload)
      setCampaigns(homePayload.campaignSlides?.length ? homePayload.campaignSlides : slides)
      setFaqs(homePayload.faqs?.length ? homePayload.faqs : faqItems)
      setCareFinder(finder)
      setWaitlist(waitlistConfig)
      setError('')
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'The SkinFox API is unavailable.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isTest])
  return { products, campaigns, faqs, careFinder, home, waitlist, loading, error, apiMode: !isTest }
}

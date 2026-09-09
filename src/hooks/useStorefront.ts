/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { products as seedProducts } from '../data/products'
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

export const mapProduct = (value: any): Product => ({ ...value, id: value.slug ?? value.id, price: value.pricePaise === null || value.pricePaise === undefined ? null : value.pricePaise / 100, mrp: value.mrpPaise === null || value.mrpPaise === undefined ? null : value.mrpPaise / 100, step: value.routineStep ?? value.step, media: (value.media ?? []).map((media: any) => ({ type: media.type, src: media.src, mobileSrc: media.mobileSrc, alt: media.alt, poster: media.poster, sortOrder: media.sortOrder, width: media.width, height: media.height, aspectRatio: media.aspectRatio, fitMode: media.fitMode, objectPosition: media.objectPosition, imageScale: media.imageScale, focalPointX: media.focalPointX, focalPointY: media.focalPointY })) })

export function useStorefront() {
  const isTest = import.meta.env.MODE === 'test'
  const [products, setProducts] = useState<Product[]>(isTest ? seedProducts : [])
  const [campaigns, setCampaigns] = useState<CampaignApiSlide[]>([])
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [home, setHome] = useState<HomeApi | null>(null)
  const [careFinder, setCareFinder] = useState<CareFinderApi | null>(null)
  const [loading, setLoading] = useState(!isTest)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isTest) return
    let cancelled = false
    Promise.all([getStorefront<any>('/products?limit=100'), getStorefront<CampaignApiSlide[]>('/campaign-slides'), getStorefront<Array<{ question: string; answer: string }>>('/faqs'), getStorefront<CareFinderApi>('/care-finder'), getStorefront<HomeApi>('/pages/home')]).then(([catalog, slides, faqItems, finder, homePayload]) => {
      if (cancelled) return
      setProducts((catalog.data ?? catalog).map(mapProduct))
      setHome(homePayload)
      setCampaigns(homePayload.campaignSlides?.length ? homePayload.campaignSlides : slides)
      setFaqs(homePayload.faqs?.length ? homePayload.faqs : faqItems)
      setCareFinder(finder)
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'The SkinFox API is unavailable.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isTest])
  return { products, campaigns, faqs, careFinder, home, loading, error, apiMode: !isTest }
}

import { describe, expect, it } from 'vitest'
import { products } from '../data/products'
import { categorySeo, faqSeo, homeSeo, productSeo, serializeSchema } from './metadata'

describe('public page SEO', () => {
  it('uses the selling price for product offers, never the MRP or a guessed price', () => {
    const pending = productSeo({ ...products[0], price: null, mrp: 700 })
    expect(pending.structuredData?.find((item) => item['@type'] === 'Product')).not.toHaveProperty('offers')
    const onOffer = productSeo({ ...products[0], price: 550, mrp: 700 })
    expect(onOffer.structuredData?.find((item) => item['@type'] === 'Product')).toMatchObject({ offers: { price: '550.00', priceCurrency: 'INR' } })
    expect(onOffer.structuredData?.find((item) => item['@type'] === 'Product')).not.toHaveProperty('offers.availability')
  })

  it('uses the same FAQ text passed by the visible page and does not invent medical credentials', () => {
    const visibleFaqs = [{ question: 'How can I find a routine?', answer: 'Use Find My Care to explore cosmetic products.' }]
    const data = homeSeo(visibleFaqs).structuredData
    expect(data?.find((item) => item['@type'] === 'FAQPage')).toMatchObject({ mainEntity: [{ name: visibleFaqs[0].question, acceptedAnswer: { text: visibleFaqs[0].answer } }] })
    expect(data?.find((item) => item['@type'] === 'OnlineStore')).toHaveProperty('name', 'SkinFox')
    expect(JSON.stringify(data)).not.toContain('MedicalOrganization')
  })

  it('escapes markup in structured data so catalogue text cannot break out of the script', () => {
    const serialized = serializeSchema([{ name: '</script><img src=x onerror=alert(1)>' }])
    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized)['@graph'][0].name).toBe('</script><img src=x onerror=alert(1)>')
  })

  it('uses search-led page titles and FAQ schema for crawlable landing pages', () => {
    const product = productSeo(products[0])
    expect(product.title).toMatch(/SPF 50 sunscreen for face/i)
    expect(product.description).toMatch(/sunscreen/i)
    expect(product.structuredData?.some((item) => item['@type'] === 'FAQPage')).toBe(true)
    expect(categorySeo('hair-care').title).toMatch(/hair care/i)
    expect(faqSeo().structuredData?.find((item) => item['@type'] === 'FAQPage')).toBeTruthy()
  })
})

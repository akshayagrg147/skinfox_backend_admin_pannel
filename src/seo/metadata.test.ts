import { describe, expect, it } from 'vitest'
import { products } from '../data/products'
import { homeSeo, productSeo, serializeSchema } from './metadata'

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
})

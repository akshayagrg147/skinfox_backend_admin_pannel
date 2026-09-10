import type { Product } from '../types'

const descriptions: Record<string, { original: string; revised: string }> = {
  'rayyvia-sun-protect': {
    original: 'A 60 g facial suncream. The photographed pack marks SPF 50+++ and names zinc oxide, titanium dioxide and almond oil; verify the final production pack and approved sun-protection claims before launch.',
    revised: 'A 60 g facial suncream in an easy-to-carry tube for your daily sun-care routine. Explore the pack information and follow the product label for application and reapplication directions.',
  },
  'coco-kiss-moisturizing-lotion': {
    original: 'A 100 ml moisturizing lotion photographed in a friendly pump format for dry and ultra-dry skin. Final ingredients, age suitability and approved directions will be published from the production pack before launch.',
    revised: 'A 100 ml moisturising lotion for dry and ultra-dry skin, in a convenient pump bottle. An everyday moisture-care option; check the product label for ingredients, suitability and directions before use.',
  },
  'acnfin-soft-face-wash': {
    original: 'A 100 g foaming face wash for acne-prone skin. The photographed pack describes a soothing post-wash feel and gentle pore cleansing; efficacy claims and complete directions require final brand approval.',
    revised: 'A 100 g foaming face wash designed for an acne-prone skin-care routine. A focused cleansing step in an easy-to-use tube. Follow the product label for directions and suitability.',
  },
  'hydrelle-dry-skin-specialist': {
    original: 'The 200 g Hydrelle Dry Skin Specialist moisturising lotion shown in the navy tube. Full ingredients and approved usage directions will be published from the production pack before launch.',
    revised: 'Hydrelle Dry Skin Specialist is a moisturising lotion in a generous 200 g tube. Explore a simple moisture-care step for your routine and follow the product label for ingredients and directions.',
  },
  'onion-shampoo': {
    original: 'A 300 ml amber-pump shampoo. The photographed front pack names onion, aloe vera, hibiscus and rosemary; consult the final production pack for the complete ingredient list and directions.',
    revised: 'A 300 ml shampoo in a convenient pump bottle for your hair-wash routine. The pack highlights onion, aloe vera, hibiscus and rosemary. Check the product label for the complete ingredients and usage directions.',
  },
  'intensive-scalp-hair-treatment': {
    original: 'A 250 ml transparent oil treatment with visible botanicals. The photographed front pack names bhringraj, neem, triphala, reetha, shikakai and kalonji; final directions and the complete ingredient list are pending.',
    revised: 'A 250 ml herb oil for a considered scalp-and-hair care routine. The pack highlights bhringraj, neem, triphala, reetha, shikakai and kalonji. Follow the product label for the complete ingredients and directions.',
  },
  'onion-hair-oil': {
    original: 'A 200 ml amber-bottle hair oil. The front label calls out onion seed, argan, tea tree, almond and olive oils; consult the final production pack for the complete ingredient list and directions.',
    revised: 'A botanical hair oil in a 200 ml amber bottle for your regular oiling routine. The pack highlights onion seed, argan, tea tree, almond and olive oils. Check the product label for the complete ingredients and directions.',
  },
}

const defaultHighlightCopy: Record<string, Record<string, string>> = {
  'rayyvia-sun-protect': { 'MRP ₹700 shown in supplied artwork': 'Compact daily-care format' },
  'acnfin-soft-face-wash': { 'MRP ₹760 visible on the supplied pack': 'For an acne-prone skin routine' },
  'hydrelle-dry-skin-specialist': { 'MRP ₹750 shown in supplied artwork': 'Dry-skin moisture care' },
}

// Replace only the known draft catalogue wording. Admin-authored descriptions,
// product identity, selling prices, stock and all purchase rules remain untouched.
export function normalizeProductCopy<T extends Product>(product: T): T {
  const copy = descriptions[product.id]
  return {
    ...product,
    description: copy && product.description === copy.original ? copy.revised : product.description,
    highlights: product.highlights.map((item) => defaultHighlightCopy[product.id]?.[item] ?? item),
  }
}

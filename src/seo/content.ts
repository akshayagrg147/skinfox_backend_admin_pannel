import type { FaqEntry } from './metadata'

export const defaultFaqs: FaqEntry[] = [
  { question: 'How do I find the right products for my routine?', answer: 'Start with Find My Care. Tell us about your skin, hair or scalp-care needs and preferences, and the guide will suggest a cosmetic care routine using the SkinFox collection. You can review each product before adding it to your bag.' },
  { question: 'Does Find My Care provide medical advice?', answer: 'No. Find My Care helps you explore cosmetic products and daily routines. It does not diagnose conditions or replace a consultation. For persistent, painful or concerning symptoms, speak with a qualified healthcare professional.' },
  { question: 'How much sunscreen should I apply?', answer: 'Use the amount and reapplication guidance printed on the approved Rayyvia pack. A consistent amount matters more than trying to stretch a tube; do not use this website as a substitute for the final label.' },
  { question: 'When should I reapply sunscreen?', answer: 'Reapply Rayyvia as directed on the approved product label, especially when the label indicates reapplication after outdoor exposure, sweating or towel drying.' },
  { question: 'Should I use hair oil before or after washing?', answer: 'An oil-led routine is commonly used before a wash, but the correct placement, amount and contact time depend on the final Onion Hair Oil label. Follow that pack rather than a generic routine.' },
  { question: 'Can I use Onion Hair Oil with Onion Shampoo?', answer: 'Both products can be explored as separate hair-care steps. Use the oil and shampoo only as directed on their respective approved labels, and stop if irritation occurs.' },
  { question: 'Is Acnfin Soft suitable for oily-feeling skin?', answer: 'Acnfin Soft is presented as a foaming face-wash format for an acne-prone skin routine. Review the final label for suitability and consult a qualified professional for persistent or painful symptoms.' },
  { question: 'Can I use a body lotion on my face?', answer: 'Use Hydrelle or Coco Kiss only on the areas and skin types approved on the final product label. If the pack does not specify facial use, ask a qualified professional before applying it to your face.' },
  { question: 'How long does delivery take?', answer: 'Delivery availability, estimated dates and charges are confirmed at checkout after you enter a serviceable pincode. Your order page shows the latest shipment and tracking information when it is available.' },
  { question: 'Which payment methods does SkinFox accept?', answer: 'SkinFox currently uses secure online payment through Razorpay when the payment service is configured. The available method is shown before you place the order.' },
  { question: 'Can I return a SkinFox order?', answer: 'Return eligibility, timelines and refund handling are described in the SkinFox shipping and returns policy. Contact support with your order ID if you need help with a specific delivery.' },
  { question: 'Where can I find product pricing?', answer: 'Every available SkinFox product shows its current selling price and MRP on the product page. Shipping and taxes, when applicable, are shown at checkout before you place the order.' },
  { question: 'How can I view my orders and saved addresses?', answer: 'Sign in using the account icon, then open My orders or Saved addresses. Your account brings together your order history, profile and delivery details. For help with an order, email contact@skinfox.in.' },
]

export type ProductSeoContent = {
  searchPhrase: string
  title: string
  description: string
  intro: string
  suitableFor: string
  howToUse: string
  keyIngredients: string[]
  ingredientNote: string
  faqs: FaqEntry[]
}

// This content is intentionally conservative: ingredient names are only listed
// where they are visible in the supplied pack artwork. The final INCI list must
// still be copied from the approved production label before publishing it here.
export const productSeoContent: Record<string, ProductSeoContent> = {
  'rayyvia-sun-protect': {
    searchPhrase: 'SPF 50 sunscreen for face',
    title: 'Rayyvia SPF 50 Sunscreen for Face, 60 g | SkinFox',
    description: 'Rayyvia SPF 50 sunscreen for face in a portable 60 g tube. Explore the daily sun-care format, pack information, price and label-led usage at SkinFox.',
    intro: 'Rayyvia is a portable SPF 50 sunscreen for face and a simple daily sun-care step. The 60 g tube is designed for an easy-to-carry routine; use it exactly as directed on the approved product label and reapply as that label recommends.',
    suitableFor: 'A daily sun-care routine for adults looking for a facial sunscreen format. Review the final label for skin suitability and use a qualified professional for persistent or concerning skin symptoms.',
    howToUse: 'Apply and reapply only according to the final product label. Do not rely on this page as a substitute for the directions printed on the pack.',
    keyIngredients: ['Zinc oxide (named on supplied artwork)', 'Titanium dioxide (named on supplied artwork)', 'Almond oil (named on supplied artwork)'],
    ingredientNote: 'The complete INCI list and final SPF/PA notation will be published from the approved production label. The current artwork shows SPF 50; confirm the final pack before launch.',
    faqs: [
      { question: 'What is Rayyvia SPF 50 sunscreen for face?', answer: 'Rayyvia is a 60 g facial sunscreen format for a daily sun-care routine. Follow the final pack directions for application and reapplication.' },
      { question: 'Who is this sunscreen for?', answer: 'It is presented for adults looking for a portable facial sunscreen. Check the approved label for suitability and patch-test guidance.' },
      { question: 'How often should I apply Rayyvia?', answer: 'Use and reapply it according to the final product label. The website does not replace the approved pack directions.' },
      { question: 'Where can I find the full ingredients?', answer: 'The complete INCI list will be published from the approved production pack. The artwork currently names zinc oxide, titanium dioxide and almond oil.' },
    ],
  },
  'acnfin-soft-face-wash': {
    searchPhrase: 'face wash for acne-prone skin',
    title: 'Acnfin Soft Face Wash for Acne-Prone Skin | SkinFox',
    description: 'Acnfin Soft face wash for acne-prone skin in a 100 g foaming format. Explore the cleansing routine, suitability, pack details and current SkinFox pricing.',
    intro: 'Acnfin Soft is a face wash for acne-prone skin routines, presented in a 100 g foaming tube. It is a cleansing step—not a diagnosis or treatment—and the final label should guide how it is used.',
    suitableFor: 'People exploring a cosmetic cleansing step for acne-prone or oily-feeling skin. Speak with a qualified healthcare professional about persistent, painful or concerning symptoms.',
    howToUse: 'Use the amount and frequency stated on the approved product label. Rinse as directed and stop use if irritation occurs.',
    keyIngredients: [],
    ingredientNote: 'The complete INCI list and any approved active-ingredient claims are pending the final production label. No unverified acne-treatment claim is made here.',
    faqs: [
      { question: 'What is Acnfin Soft?', answer: 'Acnfin Soft is a 100 g foaming face wash for a cosmetic acne-prone skin cleansing routine.' },
      { question: 'Can Acnfin Soft treat acne?', answer: 'SkinFox does not make a medical treatment claim for this cosmetic product. For persistent or painful acne, consult a qualified healthcare professional.' },
      { question: 'How do I use this face wash?', answer: 'Follow the amount and frequency printed on the final pack. Product directions will be updated once the approved label is available.' },
      { question: 'What are the ingredients?', answer: 'The complete INCI list will be published from the approved production label before launch.' },
    ],
  },
  'hydrelle-dry-skin-specialist': {
    searchPhrase: 'moisturiser for dry skin',
    title: 'Hydrelle Moisturising Lotion for Dry Skin, 200 g | SkinFox',
    description: 'Hydrelle moisturising lotion for dry skin in a generous 200 g format. Explore the dry-skin care routine, suitability, pack details and current SkinFox pricing.',
    intro: 'Hydrelle is a moisturiser for dry skin in a generous 200 g tube. It is designed as a focused moisture-care step; follow the final label for the approved directions and ingredient list.',
    suitableFor: 'A cosmetic moisture step for dry-feeling skin. Check the label for suitability, patch-test guidance and any age-specific directions.',
    howToUse: 'Apply the product only as directed on the approved label. The correct amount and frequency depend on the final production instructions.',
    keyIngredients: [],
    ingredientNote: 'The full INCI list and approved ingredient explanations will be added from the final production label. The page does not make a treatment claim.',
    faqs: [
      { question: 'What is Hydrelle used for?', answer: 'Hydrelle is a 200 g moisturising lotion for a dry-skin care routine. Follow the pack directions for use.' },
      { question: 'Can I use Hydrelle on my face?', answer: 'Use it only on the areas and skin types approved on the final product label. Ask a qualified professional if you are unsure.' },
      { question: 'How often should I moisturise?', answer: 'Follow the frequency printed on the final pack rather than relying on a generic online routine.' },
      { question: 'Where is the full ingredient list?', answer: 'The complete INCI list will be published from the approved production label before launch.' },
    ],
  },
  'coco-kiss-moisturizing-lotion': {
    searchPhrase: 'moisturiser for very dry skin',
    title: 'Coco Kiss Moisturising Lotion for Very Dry Skin | SkinFox',
    description: 'Coco Kiss moisturising lotion for very dry skin in a compact 100 ml pump format. Explore the moisture-care routine, suitability and pack information at SkinFox.',
    intro: 'Coco Kiss is a moisturiser for very dry skin in a compact 100 ml pump bottle. It offers a simple moisture-care format for everyday routines; the final label remains the source of truth for ingredients and directions.',
    suitableFor: 'Adults exploring an everyday cosmetic moisture step for dry or ultra-dry skin. Review the final label for suitability and patch-test guidance.',
    howToUse: 'Use the amount and frequency stated on the approved pack. Do not use this page as a substitute for the product label.',
    keyIngredients: [],
    ingredientNote: 'The complete INCI list and approved ingredient explanations are pending the final production label. No unverified age, medical or treatment claims are made.',
    faqs: [
      { question: 'What is Coco Kiss?', answer: 'Coco Kiss is a 100 ml pump-format moisturising lotion for dry and ultra-dry skin routines.' },
      { question: 'Is Coco Kiss suitable for very dry skin?', answer: 'The pack presents it for dry and ultra-dry skin. Check the final label for suitability and patch-test instructions.' },
      { question: 'How do I apply Coco Kiss?', answer: 'Follow the amount and frequency on the final product label.' },
      { question: 'When will the ingredients be available?', answer: 'SkinFox will publish the complete INCI list from the approved production pack before launch.' },
    ],
  },
  'onion-hair-oil': {
    searchPhrase: 'onion hair oil',
    title: 'Onion Hair Oil with Argan & Tea Tree, 200 ml | SkinFox',
    description: 'Onion hair oil with argan, tea tree, almond and olive oils in a 200 ml bottle. Explore the oiling routine and label-led product information at SkinFox.',
    intro: 'SkinFox Onion Hair Oil is an onion hair oil in a 200 ml amber bottle for a regular hair-care ritual. The supplied artwork names a botanical blend; follow the approved label for the complete ingredients and directions.',
    suitableFor: 'Adults exploring an oil-led cosmetic hair-care routine. It is not a hair-loss treatment claim; consult a qualified professional for persistent scalp concerns.',
    howToUse: 'Use the quantity, scalp or hair placement and frequency stated on the final product label. Wash or leave in only as directed on the pack.',
    keyIngredients: ['Onion seed oil (named on supplied artwork)', 'Argan oil (named on supplied artwork)', 'Tea tree oil (named on supplied artwork)', 'Almond oil (named on supplied artwork)', 'Olive oil (named on supplied artwork)'],
    ingredientNote: 'The complete INCI list will be published from the approved production label. The named ingredients above are pack references, not a substitute for the full list.',
    faqs: [
      { question: 'What is onion hair oil?', answer: 'It is a 200 ml cosmetic hair-oil format with onion seed, argan, tea tree, almond and olive oils named on the supplied artwork.' },
      { question: 'Does it treat hair fall?', answer: 'SkinFox does not make a hair-loss treatment claim. Consult a qualified professional about persistent hair or scalp concerns.' },
      { question: 'How do I use Onion Hair Oil?', answer: 'Follow the quantity, frequency and wash-out directions on the final product label.' },
      { question: 'Is the full INCI list available?', answer: 'The complete INCI list will be published from the approved production pack before launch.' },
    ],
  },
  'onion-shampoo': {
    searchPhrase: 'onion shampoo',
    title: 'Onion Shampoo for Everyday Hair Wash, 300 ml | SkinFox',
    description: 'Onion shampoo for everyday hair wash in a 300 ml pump bottle. Explore the gentle cleansing format, pack ingredients and label-led usage at SkinFox.',
    intro: 'SkinFox Onion Shampoo is an onion shampoo for an everyday hair-wash routine, presented in a 300 ml pump bottle. The supplied artwork names onion, aloe vera, hibiscus and rosemary; the final pack remains the source of truth.',
    suitableFor: 'Adults looking for a regular cosmetic shampoo format. Check the final label for hair type, frequency and eye-contact guidance.',
    howToUse: 'Use the quantity and frequency printed on the approved product label. Rinse thoroughly as directed and avoid contact with eyes.',
    keyIngredients: ['Onion (named on supplied artwork)', 'Aloe vera (named on supplied artwork)', 'Hibiscus (named on supplied artwork)', 'Rosemary (named on supplied artwork)'],
    ingredientNote: 'The complete INCI list will be published from the approved production label. The named ingredients are artwork references only.',
    faqs: [
      { question: 'What is Onion Shampoo?', answer: 'It is a 300 ml pump-format shampoo for an everyday hair-wash routine.' },
      { question: 'Can I use it every day?', answer: 'Follow the frequency recommended on the final pack for your hair type and routine.' },
      { question: 'What ingredients are named on the pack?', answer: 'The supplied artwork names onion, aloe vera, hibiscus and rosemary. Review the final INCI list before use.' },
      { question: 'Does it prevent hair loss?', answer: 'SkinFox does not make a medical hair-loss claim for this cosmetic shampoo.' },
    ],
  },
  'intensive-scalp-hair-treatment': {
    searchPhrase: 'herbal scalp and hair treatment oil',
    title: 'Herbal Scalp & Hair Oil, 250 ml | SkinFox',
    description: 'Herbal scalp and hair treatment oil in a 250 ml bottle. Explore the herb-led cosmetic routine and label-led usage information at SkinFox.',
    intro: 'Intensive Scalp & Hair Treatment is a 250 ml herb-led oil for a considered scalp-and-hair routine. The supplied artwork names several botanicals; the final production label should guide every use decision.',
    suitableFor: 'Adults exploring an oil-led scalp and hair-care routine. It is not a treatment for a medical scalp condition; consult a qualified professional when symptoms persist.',
    howToUse: 'Follow the quantity, frequency and wash-out instructions printed on the approved label. Stop use if irritation occurs.',
    keyIngredients: ['Bhringraj (named on supplied artwork)', 'Neem (named on supplied artwork)', 'Triphala (named on supplied artwork)', 'Reetha (named on supplied artwork)', 'Shikakai (named on supplied artwork)', 'Kalonji (named on supplied artwork)'],
    ingredientNote: 'The complete INCI list will be published from the approved production pack. These are names visible in the supplied artwork, not the full INCI list.',
    faqs: [
      { question: 'What is this scalp and hair treatment?', answer: 'It is a 250 ml botanical oil format for a cosmetic scalp-and-hair care routine.' },
      { question: 'What botanicals are named on the pack?', answer: 'The supplied artwork names bhringraj, neem, triphala, reetha, shikakai and kalonji.' },
      { question: 'How should I use the treatment?', answer: 'Follow the quantity, frequency and wash-out directions on the final product label.' },
      { question: 'Is it a treatment for a scalp condition?', answer: 'SkinFox does not make a medical treatment claim. Speak with a qualified professional about persistent scalp symptoms.' },
    ],
  },
}

export type CategorySlug = 'skin-care' | 'hair-care' | 'body-care'
export const categoryPages: Record<CategorySlug, { name: string; title: string; description: string; intro: string; concerns: string[] }> = {
  'skin-care': { name: 'Skin care', title: 'Skin Care Products Online in India | SkinFox', description: 'Explore SkinFox skin care products online in India, including SPF 50 sunscreen, face wash and moisturisers for everyday routines.', intro: 'Build a clear skin-care routine with SkinFox essentials for cleansing, moisturising and daily sun protection. Explore pack sizes, current prices and label-led product information before you choose.', concerns: ['Sun Protection', 'Face Wash', 'Acne & Oily Skin', 'Dry Skin', 'Gentle Moisture'] },
  'hair-care': { name: 'Hair care', title: 'Hair Care Products Online in India | SkinFox', description: 'Shop SkinFox hair care products online in India, including onion hair oil, onion shampoo and an herbal scalp-and-hair treatment.', intro: 'Explore hair-care formats for washing, oiling and scalp rituals. SkinFox keeps the product details clear and avoids unsupported hair-loss or medical claims.', concerns: ['Hair Wash', 'Hair Oil', 'Scalp Care'] },
  'body-care': { name: 'Body care', title: 'Body Care Products for Dry Skin | SkinFox', description: 'Discover SkinFox body care products for dry and ultra-dry skin, with moisturising lotions, pack details and clear everyday guidance.', intro: 'Find a simple body-care moisture step for dry-feeling skin. Review the product format, size, price and approved label directions before adding anything to your routine.', concerns: ['Dry Skin', 'Gentle Moisture'] },
}

export const guidePages = [
  { slug: 'onion-oil-vs-onion-shampoo', title: 'Onion Oil vs Onion Shampoo: Which Fits Your Routine?', excerpt: 'Understand the difference between an oil-led and wash-led hair-care step without turning cosmetic products into medical claims.', sections: [{ heading: 'Oil and shampoo do different jobs', body: 'An onion hair oil is an oil-led pre-wash or hair-care format, while an onion shampoo is designed for a cleansing step. The right choice depends on the routine you prefer and the directions on each final pack.' }, { heading: 'A simple way to choose', body: 'Choose a shampoo when you want a wash step. Choose an oil when you want an oil-led ritual. You can explore both formats, but always follow the approved product label and stop if irritation occurs.' }] },
  { slug: 'how-much-sunscreen-on-face', title: 'How Much Sunscreen Should You Apply on Your Face?', excerpt: 'A practical, label-first guide to the amount, timing and reapplication habits that make a daily facial sunscreen routine easier to follow.', sections: [{ heading: 'The tested amount', body: 'Sunscreen testing is commonly based on 2 mg per square centimetre of skin. Consumer guidance often explains this as roughly two finger lengths for the face and neck, but the final Rayyvia pack is the source of truth for the product and should be followed first.' }, { heading: 'Build the habit', body: 'Apply sunscreen as the final step of your morning skin-care routine when the label directs. Reapply at the intervals and after the activities specified on the pack, especially when outdoor exposure, sweating or towel drying is involved.' }, { heading: 'SPF and PA are different', body: 'SPF describes the product’s labelled UVB protection rating, while a PA notation communicates UVA protection. SkinFox will publish the exact label notation once the approved production artwork is final; do not infer a rating from a product name.' }] },
  { slug: 'moisturiser-for-winter-dry-skin', title: 'How to Choose a Moisturiser for Winter Dry Skin', excerpt: 'A practical guide to comparing lotion formats for dry and ultra-dry skin during colder, drier weather.', sections: [{ heading: 'Start with how your skin feels', body: 'Dry-feeling skin can benefit from a consistent moisture step after cleansing. Compare the texture, pack size and application area shown on the product label, then choose a format you will use regularly.' }, { heading: 'Lotion or richer format?', body: 'A pump lotion can make everyday use easy, while a larger tube can suit a focused body-care routine. Hydrelle and Coco Kiss are presented as moisture-care formats; review their final labels for approved areas and directions.' }, { heading: 'Keep claims realistic', body: 'A moisturiser can be part of a cosmetic care routine, but persistent, painful or unusual symptoms need a qualified healthcare professional rather than a product page.' }] },
]

export const aboutPage = {
  title: 'About SkinFox | Everyday Skin, Hair & Body Care',
  description: 'Learn about SkinFox, its everyday skin, hair and body-care approach, and the business details behind the online store.',
}

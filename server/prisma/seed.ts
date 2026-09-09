/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import { PrismaClient, PublicationStatus, PurchaseState, MediaType, FitMode } from '@prisma/client'
import { products } from '../../src/data/products.ts'
import { encryptSecret, hashPassword } from '../src/lib/crypto.js'

const prisma = new PrismaClient()

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

async function main() {
  const rolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*'], CATALOG_MANAGER: ['catalog:read', 'catalog:write', 'inventory:read', 'inventory:write', 'content:read'], CONTENT_EDITOR: ['content:read', 'content:write', 'catalog:read'], ORDER_MANAGER: ['orders:read', 'orders:write', 'customers:read', 'catalog:read'], SUPPORT_AGENT: ['orders:read', 'customers:read', 'customers:write', 'leads:read'], ANALYST: ['analytics:read', 'dashboard:read'],
  }
  const roles = new Map<string, string>()
  for (const [code, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({ where: { code: code as any }, update: { name: code.replaceAll('_', ' ') }, create: { code: code as any, name: code.replaceAll('_', ' ') } })
    roles.set(code, role.id)
    for (const key of permissions) {
      const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } })
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } })
    }
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.')
    const mfaRequired = Boolean(process.env.SEED_ADMIN_MFA_SECRET)
    const admin = await prisma.adminUser.upsert({ where: { email: adminEmail.toLowerCase() }, update: { name: process.env.SEED_ADMIN_NAME ?? 'SkinFox Admin', roleId: roles.get('SUPER_ADMIN'), mfaRequired }, create: { email: adminEmail.toLowerCase(), name: process.env.SEED_ADMIN_NAME ?? 'SkinFox Admin', passwordHash: await hashPassword(adminPassword), role: 'SUPER_ADMIN', roleId: roles.get('SUPER_ADMIN'), mustChangePassword: true, mfaRequired } })
    if (process.env.SEED_ADMIN_MFA_SECRET) await prisma.mfaCredential.upsert({ where: { userId: admin.id }, update: { secretEncrypted: encryptSecret(process.env.SEED_ADMIN_MFA_SECRET) }, create: { userId: admin.id, secretEncrypted: encryptSecret(process.env.SEED_ADMIN_MFA_SECRET) } })
  }
  const location = await prisma.inventoryLocation.upsert({ where: { code: 'MAIN' }, update: {}, create: { code: 'MAIN', name: 'SkinFox main warehouse' } })
  const categoryNames = [...new Set(products.map((p) => p.category))]
  const concernNames = [...new Set(products.flatMap((p) => p.concerns))]
  const categories = new Map<string, string>()
  const concerns = new Map<string, string>()
  const productIds = new Map<string, string>()
  for (const name of categoryNames) categories.set(name, (await prisma.category.upsert({ where: { slug: slugify(name) }, update: { name }, create: { name, slug: slugify(name) } })).id)
  for (const name of concernNames) concerns.set(name, (await prisma.concern.upsert({ where: { slug: slugify(name) }, update: { name }, create: { name, slug: slugify(name) } })).id)

  for (const source of products) {
    const product = await prisma.product.upsert({
      where: { slug: source.id },
      update: {
        name: source.name, subtitle: source.subtitle, type: source.type, packaging: source.packaging, category: source.category, categoryId: categories.get(source.category), concern: source.concern, concerns: source.concerns, benefit: source.benefit, description: source.description,
        pricePaise: source.price === null ? null : Math.round(source.price * 100), mrpPaise: source.mrp === null ? null : Math.round(source.mrp * 100), size: source.size, usage: source.usage, routineStep: source.step, highlights: source.highlights, color: source.color, accent: source.accent, tint: source.tint, image: source.image, storyImage: source.storyImage, imageAlt: source.imageAlt, imagePosition: source.imagePosition, imageScale: source.imageScale, badge: source.badge, purchaseState: source.price === null ? PurchaseState.coming_soon : PurchaseState.available, status: PublicationStatus.published,
      },
      create: {
        slug: source.id, name: source.name, subtitle: source.subtitle, type: source.type, packaging: source.packaging, category: source.category, categoryId: categories.get(source.category), concern: source.concern, concerns: source.concerns, benefit: source.benefit, description: source.description,
        pricePaise: source.price === null ? null : Math.round(source.price * 100), mrpPaise: source.mrp === null ? null : Math.round(source.mrp * 100), size: source.size, usage: source.usage, routineStep: source.step, highlights: source.highlights, color: source.color, accent: source.accent, tint: source.tint, image: source.image, storyImage: source.storyImage, imageAlt: source.imageAlt, imagePosition: source.imagePosition, imageScale: source.imageScale, badge: source.badge, purchaseState: source.price === null ? PurchaseState.coming_soon : PurchaseState.available, status: PublicationStatus.published,
      },
    })
    productIds.set(source.id, product.id)
    await prisma.product.update({ where: { id: product.id }, data: { concernRefs: { set: source.concerns.map((name) => ({ id: concerns.get(name)! })) } } })
    await prisma.productMedia.deleteMany({ where: { productId: product.id } })
    await prisma.productMedia.createMany({ data: source.media.map((media, mediaIndex) => ({ productId: product.id, type: media.type === 'video' ? MediaType.video : MediaType.image, src: media.src, poster: media.poster, alt: media.alt, sortOrder: mediaIndex, fitMode: FitMode.contain, objectPosition: source.imagePosition, imageScale: source.imageScale })) })
    const variant = await prisma.productVariant.upsert({ where: { sku: `${source.id.toUpperCase()}-DEFAULT` }, update: { productId: product.id, name: source.size, size: source.size, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise, purchaseState: product.purchaseState }, create: { productId: product.id, sku: `${source.id.toUpperCase()}-DEFAULT`, name: source.size, size: source.size, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise, purchaseState: product.purchaseState } })
    await prisma.inventoryItem.upsert({ where: { variantId_locationId: { variantId: variant.id, locationId: location.id } }, update: { availableQty: source.price === null ? 0 : 25 }, create: { variantId: variant.id, locationId: location.id, availableQty: source.price === null ? 0 : 25 } })
    const revisionSnapshot = { ...source, pricePaise: source.price === null ? null : Math.round(source.price * 100), mrpPaise: source.mrp === null ? null : Math.round(source.mrp * 100), routineStep: source.step, purchaseState: source.price === null ? PurchaseState.coming_soon : PurchaseState.available, media: source.media.map((media, mediaIndex) => ({ type: media.type, src: media.src, poster: media.poster, alt: media.alt, sortOrder: mediaIndex, fitMode: FitMode.contain, objectPosition: source.imagePosition, imageScale: source.imageScale })) }
    await prisma.productRevision.upsert({ where: { productId_version: { productId: product.id, version: 1 } }, update: { snapshot: revisionSnapshot as object, status: PublicationStatus.published }, create: { productId: product.id, version: 1, snapshot: revisionSnapshot as object, status: PublicationStatus.published } })
  }

  const launchCollection = await prisma.collection.upsert({ where: { slug: 'launch-edit' }, update: { name: 'The launch edit', description: 'The current seven-product SkinFox collection.', status: PublicationStatus.published }, create: { slug: 'launch-edit', name: 'The launch edit', description: 'The current seven-product SkinFox collection.', status: PublicationStatus.published } })
  await prisma.collectionProduct.deleteMany({ where: { collectionId: launchCollection.id } })
  await prisma.collectionProduct.createMany({ data: products.map((product, sortOrder) => ({ collectionId: launchCollection.id, productId: productIds.get(product.id)!, sortOrder })) })

  for (const menuInput of [
    { id: 'main-navigation', location: 'header', label: 'Main navigation', items: [['Shop', '#shop'], ['Care finder', '#care-finder'], ['On the label', '#ingredients'], ['Our story', '#story']] },
    { id: 'footer-navigation', location: 'footer', label: 'Footer navigation', items: [['FAQ', '#faq'], ['Privacy', '/pages/privacy'], ['Terms', '/pages/terms']] },
  ]) {
    const menu = await prisma.navigationMenu.upsert({ where: { id: menuInput.id }, update: { location: menuInput.location, label: menuInput.label }, create: { id: menuInput.id, location: menuInput.location, label: menuInput.label } })
    await prisma.navigationItem.deleteMany({ where: { menuId: menu.id } })
    await prisma.navigationItem.createMany({ data: menuInput.items.map(([label, href], sortOrder) => ({ menuId: menu.id, label, href, sortOrder })) })
  }

  await prisma.storeSetting.upsert({ where: { key: 'storefront' }, update: { value: { storeName: 'SkinFox', logo: '/brand/skinfox-logo.png', currency: 'INR', freeShippingThresholdPaise: 99900, announcement: 'New collection preview', supportEmail: 'hello@skinfox.example' } }, create: { key: 'storefront', value: { storeName: 'SkinFox', logo: '/brand/skinfox-logo.png', currency: 'INR', freeShippingThresholdPaise: 99900, announcement: 'New collection preview', supportEmail: 'hello@skinfox.example' } } })
  await prisma.storeSetting.upsert({ where: { key: 'seo' }, update: { value: { title: 'SkinFox — Care for every ritual', description: 'Skin, body, hair and scalp care.' } }, create: { key: 'seo', value: { title: 'SkinFox — Care for every ritual', description: 'Skin, body, hair and scalp care.' } } })
  const slides = [
    { kind: MediaType.video, desktopSrc: '/media/rayyvia-campaign-slide-01-v2.mp4', poster: '/media/rayyvia-campaign-slide-01-v2-poster.jpg', alt: 'SkinFox Rayyvia Sun Protect landscape campaign film', durationMs: 10000, textOverlay: { eyebrow: 'Rayyvia Sun Protect', title: 'A brighter daily ritual.', description: 'The first film in the SkinFox campaign reel—made for a vivid, joyful sun-care moment.' } },
    { kind: MediaType.image, desktopSrc: '/media/rayyvia-campaign-slide-02.jpg', alt: 'SkinFox Rayyvia Sun Protect campaign banner with two women holding the suncream against a blue sky', durationMs: 7000, textOverlay: { eyebrow: 'Meet Rayyvia', title: 'Hello, sunshine.', description: 'A wide campaign view for the bright, everyday Rayyvia sun-care ritual.' } },
    { kind: MediaType.image, desktopSrc: '/media/hydrelle-campaign-slide-03.jpg', alt: 'SkinFox Hydrelle campaign banner with two women and the Dry Skin Specialist moisturising lotion', durationMs: 7000, textOverlay: { eyebrow: 'Meet Hydrelle', title: 'Dry-skin care, reimagined.', description: 'A bright campaign moment for Hydrelle and its 200 g moisturising-lotion ritual.' } },
  ]
  await prisma.campaignSlide.deleteMany({})
  await prisma.campaignSlide.createMany({ data: slides.map((s, sortOrder) => ({ ...s, sortOrder, status: PublicationStatus.published, autoplay: true })) })
  await prisma.fAQ.deleteMany({})
  const faqData = [
    ['Are these the actual SkinFox products?', 'Yes. All seven current catalogue entries and their galleries use the supplied SkinFox photography.'],
    ['Does the ritual finder diagnose skin conditions?', 'No. It offers cosmetic product-discovery guidance only. Persistent, painful or concerning symptoms should be discussed with a qualified dermatologist.'],
    ['How are the product visuals presented?', 'Every shopping surface uses supplied SkinFox pack photography with individual media positioning controls.'],
    ['When will orders open?', 'This is a launch preview while selling prices and final pack details are being confirmed.'],
  ].map(([question, answer], sortOrder) => ({ question, answer, sortOrder, status: PublicationStatus.published }))
  await prisma.fAQ.createMany({ data: faqData })
  await prisma.homeSection.deleteMany({})
  await prisma.homeSection.createMany({ data: [
    { key: 'hero', title: 'Multi-product hero', payload: { productOrder: products.map((product) => product.id), ctaLabel: 'Explore the launch edit', ctaTarget: '#shop' }, sortOrder: 0, status: PublicationStatus.published },
    { key: 'proof-strip', title: 'Proof strip', payload: { items: ['Skin, body, hair and scalp care', 'Supplied SkinFox product photography', 'INR launch preview'] }, sortOrder: 1, status: PublicationStatus.published },
    { key: 'featured-collection', title: 'Featured collection', payload: { collectionSlug: 'launch-edit', title: 'The launch edit' }, sortOrder: 2, status: PublicationStatus.published },
    { key: 'care-moments', title: 'Care moments', payload: { productIds: ['hydrelle-dry-skin-specialist', 'onion-shampoo', 'onion-hair-oil'].map((slug) => productIds.get(slug)) }, sortOrder: 3, status: PublicationStatus.published },
    { key: 'scroll-story', title: 'Hydrelle product story', payload: { productId: productIds.get('hydrelle-dry-skin-specialist'), disclaimer: 'Cosmetic education only; not a clinical result.' }, sortOrder: 4, status: PublicationStatus.published },
    { key: 'before-after-education', title: 'Before / after education', payload: { disclaimer: 'Illustrative moisture-study artwork, not a clinical claim.' }, sortOrder: 5, status: PublicationStatus.published },
    { key: 'newsletter', title: 'The Skin Letter', payload: { title: 'Notes for every ritual', consentRequired: true }, sortOrder: 6, status: PublicationStatus.published },
  ] })
  await prisma.careMoment.deleteMany({})
  await prisma.careMoment.createMany({ data: [
    { title: 'A softer start', description: 'A focused moisturising moment for dry-skin days.', productId: productIds.get('hydrelle-dry-skin-specialist'), image: products.find((product) => product.id === 'hydrelle-dry-skin-specialist')?.image, sortOrder: 0, status: PublicationStatus.published },
    { title: 'Wash, then reset', description: 'A bright cleansing ritual for the hair wash shelf.', productId: productIds.get('onion-shampoo'), image: products.find((product) => product.id === 'onion-shampoo')?.image, sortOrder: 1, status: PublicationStatus.published },
    { title: 'An oil-led pause', description: 'A slower botanical care moment for regular oiling.', productId: productIds.get('onion-hair-oil'), image: products.find((product) => product.id === 'onion-hair-oil')?.image, sortOrder: 2, status: PublicationStatus.published },
  ] })
  await prisma.scrollStory.deleteMany({})
  await prisma.scrollStory.create({ data: { productId: productIds.get('hydrelle-dry-skin-specialist'), title: 'Hydrelle, in four chapters', payload: { chapters: ['Centre', 'Right', 'Left', 'Right'], disclaimer: 'Cosmetic education only; not a clinical result.' }, status: PublicationStatus.published } })
  await prisma.beforeAfterStory.deleteMany({})
  await prisma.beforeAfterStory.create({ data: { title: 'Moisture study, illustrated', beforeSrc: '/products/hydrelle-routine-cheek-study-v1.webp', afterSrc: '/products/hydrelle-routine-comparison-v1.webp', disclaimer: 'Illustrative artwork, not a clinical claim.', status: PublicationStatus.published } })
  await prisma.announcementBar.deleteMany({})
  await prisma.announcementBar.create({ data: { text: 'New collection preview · Selling prices are confirmed at launch', status: PublicationStatus.published } })
  for (const policy of [{ slug: 'privacy', title: 'Privacy policy', version: '2026-01', body: 'SkinFox uses submitted details only to respond to your request and operate the launch preview.' }, { slug: 'terms', title: 'Terms of use', version: '2026-01', body: 'SkinFox product information is presented for cosmetic discovery and launch planning.' }]) await prisma.legalPolicy.upsert({ where: { slug: policy.slug }, update: { ...policy, status: PublicationStatus.published, publishedAt: new Date() }, create: { ...policy, status: PublicationStatus.published, publishedAt: new Date() } })
  for (const page of [{ slug: 'privacy', title: 'Privacy policy', body: { blocks: [{ type: 'rich_text', text: 'SkinFox uses submitted details only to respond to your request and operate the launch preview.' }] } }, { slug: 'terms', title: 'Terms of use', body: { blocks: [{ type: 'rich_text', text: 'SkinFox product information is presented for cosmetic discovery and launch planning.' }] } }]) await prisma.page.upsert({ where: { slug: page.slug }, update: { title: page.title, body: page.body, status: PublicationStatus.published }, create: { ...page, status: PublicationStatus.published, previewToken: `${page.slug}-preview-token` } })
  await prisma.serviceablePincode.upsert({ where: { pincode: '560001' }, update: {}, create: { pincode: '560001', city: 'Bengaluru', state: 'Karnataka' } })
  const finderConfig = {
    intro: 'Tell us what is getting in the way of your routine and we will shape a considered SkinFox edit around it.',
    resultTitle: 'Your personalised SkinFox routine',
    resultDescription: 'A focused cosmetic care plan based on the answers you shared. You can edit your answers at any time.',
    packageNames: { skin: 'The Skin Reset', body: 'The Body Comfort Edit', hair: 'The Hair Ritual', scalp: 'The Scalp Pause' },
    disclaimer: 'Cosmetic care guidance only. This consultation is not a medical diagnosis. For persistent, painful or concerning symptoms, consult a qualified professional.',
    guidanceNote: 'Usage amounts and compatibility details are shown only after final pack directions are approved.',
  }
  const finder = await prisma.careFinder.upsert({ where: { id: 'default-care-finder' }, update: { name: 'SkinFox personalised care finder', config: finderConfig }, create: { id: 'default-care-finder', name: 'SkinFox personalised care finder', config: finderConfig } })
  await prisma.careFinderQuestion.deleteMany({ where: { careFinderId: finder.id } })
  const questionData = [
    { key: 'careArea', prompt: 'What would you like help with?', selectionMode: 'single', options: [{ value: 'skin', label: 'Face & skin', description: 'Protection, cleansing and moisture.' }, { value: 'body', label: 'Body', description: 'Comfort-focused everyday moisture.' }, { value: 'hair', label: 'Hair', description: 'Cleansing and botanical hair care.' }, { value: 'scalp', label: 'Scalp', description: 'A slower scalp and hair ritual.' }] },
    { key: 'mainConcern', prompt: 'What is your main care goal?', selectionMode: 'single', options: [{ value: 'sun_protection', label: 'Daily sun protection', description: 'A bright facial protection step.', condition: { key: 'careArea', in: ['skin'] } }, { value: 'face_cleansing', label: 'Face cleansing', description: 'A focused foaming cleanse.', condition: { key: 'careArea', in: ['skin'] } }, { value: 'dry_skin', label: 'Dry-skin comfort', description: 'A generous moisturising step.', condition: { key: 'careArea', in: ['skin', 'body'] } }, { value: 'body_moisture', label: 'Everyday body moisture', description: 'A simple body-care start.', condition: { key: 'careArea', in: ['body'] } }, { value: 'hair_cleansing', label: 'Hair cleansing', description: 'A gentle wash for regular care.', condition: { key: 'careArea', in: ['hair'] } }, { value: 'scalp_care', label: 'Scalp care', description: 'A considered scalp treatment.', condition: { key: 'careArea', in: ['scalp'] } }, { value: 'hair_oiling', label: 'Hair oiling', description: 'A botanical oil-led ritual.', condition: { key: 'careArea', in: ['hair', 'scalp'] } }] },
    { key: 'secondaryConcern', prompt: 'Would you like to add a second focus?', selectionMode: 'multi', required: false, options: [{ value: 'sun_protection', label: 'Sun protection', description: 'Add a daily protection step.', condition: { key: 'careArea', in: ['skin'] } }, { value: 'face_cleansing', label: 'Face cleansing', description: 'Add a focused cleanse.', condition: { key: 'careArea', in: ['skin'] } }, { value: 'dry_skin', label: 'Dry-skin comfort', description: 'Add a moisturising step.', condition: { key: 'careArea', in: ['skin', 'body'] } }, { value: 'hair_cleansing', label: 'Hair cleansing', description: 'Add a wash step.', condition: { key: 'careArea', in: ['hair', 'scalp'] } }, { value: 'scalp_care', label: 'Scalp care', description: 'Add a scalp treatment step.', condition: { key: 'careArea', in: ['scalp', 'hair'] } }, { value: 'hair_oiling', label: 'Hair oiling', description: 'Add a botanical oil step.', condition: { key: 'careArea', in: ['hair', 'scalp'] } }] },
    { key: 'skinType', prompt: 'How does your skin usually feel?', selectionMode: 'single', condition: { key: 'careArea', in: ['skin', 'body'] }, options: [{ value: 'dry', label: 'Dry or tight', description: 'Often feels tight or needs extra comfort.' }, { value: 'oily', label: 'Oily or shiny', description: 'Often feels shiny or needs a lighter feel.' }, { value: 'combination', label: 'A little of both', description: 'Different areas feel different.' }, { value: 'unsure', label: 'I am not sure', description: 'We will keep the edit simple.' }] },
    { key: 'scalpType', prompt: 'How does your scalp usually feel?', selectionMode: 'single', condition: { key: 'careArea', in: ['scalp'] }, options: [{ value: 'dry', label: 'Dry or tight', description: 'Often feels dry or needs extra comfort.' }, { value: 'oily', label: 'Oily or congested', description: 'Often feels oily between washes.' }, { value: 'normal', label: 'Neither noticeably dry nor oily', description: 'No strong preference either way.' }, { value: 'unsure', label: 'I am not sure', description: 'We will keep the edit simple.' }] },
    { key: 'sensitivity', prompt: 'How should we account for sensitivity or known ingredient allergies?', selectionMode: 'single', options: [{ value: 'sensitive', label: 'Keep it especially gentle', description: 'I prefer a minimal, careful edit.' }, { value: 'allergy', label: 'I know of an ingredient allergy', description: 'We will keep guidance conservative and flag this for review.' }, { value: 'concerning', label: 'I have persistent or concerning symptoms', description: 'We will pause product suggestions and point you to qualified medical advice.' }, { value: 'normal', label: 'No known sensitivity', description: 'No known sensitivity or exclusions.' }, { value: 'unsure', label: 'I am not sure', description: 'Show the clearest guidance available.' }] },
    { key: 'currentRoutine', prompt: 'What are you already using?', selectionMode: 'multi', required: false, options: [{ value: 'none', label: 'Nothing consistently', description: 'I am starting fresh.' }, { value: 'cleanser', label: 'A cleanser', description: 'I already have a cleansing step.' }, { value: 'moisturiser', label: 'A moisturiser', description: 'I already have a moisture step.' }, { value: 'sun_protection', label: 'Sun protection', description: 'I already use a protection step.' }, { value: 'hair_cleansing', label: 'A shampoo', description: 'I already wash my hair regularly.' }, { value: 'hair_oiling', label: 'A hair oil', description: 'I already have an oil step.' }] },
    { key: 'routinePreference', prompt: 'How much ritual feels realistic?', selectionMode: 'single', options: [{ value: 'simple', label: 'Keep it simple', description: 'One or two deliberate steps.' }, { value: 'complete', label: 'Build the complete edit', description: 'I enjoy a considered multi-step routine.' }] },
  ]
  for (const [sortOrder, q] of questionData.entries()) { const question = await prisma.careFinderQuestion.create({ data: { careFinderId: finder.id, key: q.key, prompt: q.prompt, sortOrder, selectionMode: q.selectionMode, required: q.required ?? true, condition: q.condition as any } }); await prisma.careFinderOption.createMany({ data: q.options.map((option, optionSort) => ({ questionId: question.id, value: option.value, label: option.label, description: option.description, sortOrder: optionSort, condition: option.condition as any })) }) }
  await prisma.careFinderRule.deleteMany({ where: { careFinderId: finder.id } })
  const guidance: Record<string, Record<string, unknown>> = {
    'rayyvia-sun-protect': { role: 'essential', stepOrder: 3, reason: 'A focused daily facial protection step for a skin-first routine.', frequency: 'Daily', days: ['Every day'], timeOfDay: 'Morning', instructions: 'Follow the final product pack directions before daytime exposure.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'acnfin-soft-face-wash': { role: 'essential', stepOrder: 1, reason: 'A focused foaming cleanse for the face-care step.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'coco-kiss-moisturizing-lotion': { role: 'essential', stepOrder: 2, reason: 'A compact moisture step for dry or comfort-focused care.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'hydrelle-dry-skin-specialist': { role: 'essential', stepOrder: 2, reason: 'A generous moisturising step for dry-skin comfort.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'onion-shampoo': { role: 'essential', stepOrder: 1, reason: 'A cleansing step for a regular hair-care routine.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'intensive-scalp-hair-treatment': { role: 'essential', stepOrder: 2, reason: 'A considered treatment step for a scalp-led ritual.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
    'onion-hair-oil': { role: 'essential', stepOrder: 2, reason: 'A botanical oil step for a slower hair or scalp ritual.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  }
  const rules: Array<{ slug: string; answerKey: string; answerValue: string; weight: number; metadata?: Record<string, unknown> }> = [
    { slug: 'rayyvia-sun-protect', answerKey: 'mainConcern', answerValue: 'sun_protection', weight: 30 },
    { slug: 'acnfin-soft-face-wash', answerKey: 'mainConcern', answerValue: 'face_cleansing', weight: 30 },
    { slug: 'hydrelle-dry-skin-specialist', answerKey: 'mainConcern', answerValue: 'dry_skin', weight: 30 },
    { slug: 'coco-kiss-moisturizing-lotion', answerKey: 'mainConcern', answerValue: 'body_moisture', weight: 30 },
    { slug: 'onion-shampoo', answerKey: 'mainConcern', answerValue: 'hair_cleansing', weight: 30 },
    { slug: 'intensive-scalp-hair-treatment', answerKey: 'mainConcern', answerValue: 'scalp_care', weight: 30 },
    { slug: 'onion-hair-oil', answerKey: 'mainConcern', answerValue: 'hair_oiling', weight: 30 },
    { slug: 'coco-kiss-moisturizing-lotion', answerKey: 'secondaryConcern', answerValue: 'dry_skin', weight: 12, metadata: { role: 'optional' } },
    { slug: 'rayyvia-sun-protect', answerKey: 'secondaryConcern', answerValue: 'sun_protection', weight: 12, metadata: { role: 'optional' } },
    { slug: 'acnfin-soft-face-wash', answerKey: 'secondaryConcern', answerValue: 'face_cleansing', weight: 12, metadata: { role: 'optional' } },
    { slug: 'onion-shampoo', answerKey: 'secondaryConcern', answerValue: 'hair_cleansing', weight: 12, metadata: { role: 'optional' } },
    { slug: 'intensive-scalp-hair-treatment', answerKey: 'secondaryConcern', answerValue: 'scalp_care', weight: 12, metadata: { role: 'optional' } },
    { slug: 'onion-hair-oil', answerKey: 'secondaryConcern', answerValue: 'hair_oiling', weight: 12, metadata: { role: 'optional' } },
    { slug: 'hydrelle-dry-skin-specialist', answerKey: 'skinType', answerValue: 'dry', weight: 7, metadata: { role: 'optional' } },
    { slug: 'coco-kiss-moisturizing-lotion', answerKey: 'skinType', answerValue: 'dry', weight: 5, metadata: { role: 'optional' } },
    { slug: 'rayyvia-sun-protect', answerKey: 'careArea', answerValue: 'skin', weight: 4 },
    { slug: 'coco-kiss-moisturizing-lotion', answerKey: 'careArea', answerValue: 'body', weight: 4 },
    { slug: 'onion-shampoo', answerKey: 'careArea', answerValue: 'hair', weight: 4 },
    { slug: 'intensive-scalp-hair-treatment', answerKey: 'careArea', answerValue: 'scalp', weight: 4 },
  ]
  for (const rule of rules) { const product = await prisma.product.findUniqueOrThrow({ where: { slug: rule.slug } }); await prisma.careFinderRule.create({ data: { careFinderId: finder.id, answerKey: rule.answerKey, answerValue: rule.answerValue, productId: product.id, weight: rule.weight, metadata: { ...guidance[rule.slug], ...(rule.metadata ?? {}) } } }) }
  console.log(`Seeded ${products.length} SkinFox products and launch content.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())

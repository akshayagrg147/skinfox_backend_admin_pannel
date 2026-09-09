import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Option = { value: string; label: string; description: string; condition?: Record<string, unknown> }
type Question = { key: string; prompt: string; selectionMode?: string; required?: boolean; condition?: Record<string, unknown>; options: Option[] }

const config = {
  intro: 'Tell us what is getting in the way of your routine and we will shape a considered SkinFox edit around it.',
  resultTitle: 'Your personalised SkinFox routine',
  resultDescription: 'A focused cosmetic care plan based on the answers you shared. You can edit your answers at any time.',
  packageNames: { skin: 'The Skin Reset', body: 'The Body Comfort Edit', hair: 'The Hair Ritual', scalp: 'The Scalp Pause' },
  disclaimer: 'Cosmetic care guidance only. This consultation is not a medical diagnosis. For persistent, painful or concerning symptoms, consult a qualified professional.',
  guidanceNote: 'Usage amounts and compatibility details are shown only after final pack directions are approved.',
}

const questions: Question[] = [
  { key: 'careArea', prompt: 'What would you like help with?', options: [
    { value: 'skin', label: 'Face & skin', description: 'Protection, cleansing and moisture.' },
    { value: 'body', label: 'Body', description: 'Comfort-focused everyday moisture.' },
    { value: 'hair', label: 'Hair', description: 'Cleansing and botanical hair care.' },
    { value: 'scalp', label: 'Scalp', description: 'A slower scalp and hair ritual.' },
  ] },
  { key: 'mainConcern', prompt: 'What is your main care goal?', options: [
    { value: 'sun_protection', label: 'Daily sun protection', description: 'A bright facial protection step.', condition: { key: 'careArea', in: ['skin'] } },
    { value: 'face_cleansing', label: 'Face cleansing', description: 'A focused foaming cleanse.', condition: { key: 'careArea', in: ['skin'] } },
    { value: 'dry_skin', label: 'Dry-skin comfort', description: 'A generous moisturising step.', condition: { key: 'careArea', in: ['skin', 'body'] } },
    { value: 'body_moisture', label: 'Everyday body moisture', description: 'A simple body-care start.', condition: { key: 'careArea', in: ['body'] } },
    { value: 'hair_cleansing', label: 'Hair cleansing', description: 'A gentle wash for regular care.', condition: { key: 'careArea', in: ['hair'] } },
    { value: 'scalp_care', label: 'Scalp care', description: 'A considered scalp treatment.', condition: { key: 'careArea', in: ['scalp'] } },
    { value: 'hair_oiling', label: 'Hair oiling', description: 'A botanical oil-led ritual.', condition: { key: 'careArea', in: ['hair', 'scalp'] } },
  ] },
  { key: 'secondaryConcern', prompt: 'Would you like to add a second focus?', selectionMode: 'multi', required: false, options: [
    { value: 'sun_protection', label: 'Sun protection', description: 'Add a daily protection step.', condition: { key: 'careArea', in: ['skin'] } },
    { value: 'face_cleansing', label: 'Face cleansing', description: 'Add a focused cleanse.', condition: { key: 'careArea', in: ['skin'] } },
    { value: 'dry_skin', label: 'Dry-skin comfort', description: 'Add a moisturising step.', condition: { key: 'careArea', in: ['skin', 'body'] } },
    { value: 'hair_cleansing', label: 'Hair cleansing', description: 'Add a wash step.', condition: { key: 'careArea', in: ['hair', 'scalp'] } },
    { value: 'scalp_care', label: 'Scalp care', description: 'Add a scalp treatment step.', condition: { key: 'careArea', in: ['scalp', 'hair'] } },
    { value: 'hair_oiling', label: 'Hair oiling', description: 'Add a botanical oil step.', condition: { key: 'careArea', in: ['hair', 'scalp'] } },
  ] },
  { key: 'skinType', prompt: 'How does your skin usually feel?', condition: { key: 'careArea', in: ['skin', 'body'] }, options: [
    { value: 'dry', label: 'Dry or tight', description: 'Often feels tight or needs extra comfort.' },
    { value: 'oily', label: 'Oily or shiny', description: 'Often feels shiny or needs a lighter feel.' },
    { value: 'combination', label: 'A little of both', description: 'Different areas feel different.' },
    { value: 'unsure', label: 'I am not sure', description: 'We will keep the edit simple.' },
  ] },
  { key: 'scalpType', prompt: 'How does your scalp usually feel?', condition: { key: 'careArea', in: ['scalp'] }, options: [
    { value: 'dry', label: 'Dry or tight', description: 'Often feels dry or needs extra comfort.' },
    { value: 'oily', label: 'Oily or congested', description: 'Often feels oily between washes.' },
    { value: 'normal', label: 'Neither noticeably dry nor oily', description: 'No strong preference either way.' },
    { value: 'unsure', label: 'I am not sure', description: 'We will keep the edit simple.' },
  ] },
  { key: 'sensitivity', prompt: 'How should we account for sensitivity or known ingredient allergies?', options: [
    { value: 'sensitive', label: 'Keep it especially gentle', description: 'I prefer a minimal, careful edit.' },
    { value: 'allergy', label: 'I know of an ingredient allergy', description: 'We will keep guidance conservative and flag this for review.' },
    { value: 'concerning', label: 'I have persistent or concerning symptoms', description: 'We will pause product suggestions and point you to qualified medical advice.' },
    { value: 'normal', label: 'No known sensitivity', description: 'No known sensitivity or exclusions.' },
    { value: 'unsure', label: 'I am not sure', description: 'Show the clearest guidance available.' },
  ] },
  { key: 'currentRoutine', prompt: 'What are you already using?', selectionMode: 'multi', required: false, options: [
    { value: 'none', label: 'Nothing consistently', description: 'I am starting fresh.' },
    { value: 'cleanser', label: 'A cleanser', description: 'I already have a cleansing step.' },
    { value: 'moisturiser', label: 'A moisturiser', description: 'I already have a moisture step.' },
    { value: 'sun_protection', label: 'Sun protection', description: 'I already use a protection step.' },
    { value: 'hair_cleansing', label: 'A shampoo', description: 'I already wash my hair regularly.' },
    { value: 'hair_oiling', label: 'A hair oil', description: 'I already have an oil step.' },
  ] },
  { key: 'routinePreference', prompt: 'How much ritual feels realistic?', options: [
    { value: 'simple', label: 'Keep it simple', description: 'One or two deliberate steps.' },
    { value: 'complete', label: 'Build the complete edit', description: 'I enjoy a considered multi-step routine.' },
  ] },
]

const guidance: Record<string, Record<string, unknown>> = {
  'rayyvia-sun-protect': { role: 'essential', stepOrder: 3, reason: 'A focused daily facial protection step for a skin-first routine.', frequency: 'Daily', days: ['Every day'], timeOfDay: 'Morning', instructions: 'Follow the final product pack directions before daytime exposure.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'acnfin-soft-face-wash': { role: 'essential', stepOrder: 1, reason: 'A focused foaming cleanse for the face-care step.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'coco-kiss-moisturizing-lotion': { role: 'essential', stepOrder: 2, reason: 'A compact moisture step for dry or comfort-focused care.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'hydrelle-dry-skin-specialist': { role: 'essential', stepOrder: 2, reason: 'A generous moisturising step for dry-skin comfort.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'onion-shampoo': { role: 'essential', stepOrder: 1, reason: 'A cleansing step for a regular hair-care routine.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'intensive-scalp-hair-treatment': { role: 'essential', stepOrder: 2, reason: 'A considered treatment step for a scalp-led ritual.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
  'onion-hair-oil': { role: 'essential', stepOrder: 2, reason: 'A botanical oil step for a slower hair or scalp ritual.', frequency: 'As directed on pack', days: ['As directed'], timeOfDay: 'As directed', instructions: 'Follow the final product pack directions.', guidanceStatus: 'needs_review', avoidIf: { sensitivity: ['concerning'] } },
}

const rules: Array<[string, string, string, number, Record<string, unknown>?]> = [
  ['rayyvia-sun-protect', 'mainConcern', 'sun_protection', 30], ['acnfin-soft-face-wash', 'mainConcern', 'face_cleansing', 30], ['hydrelle-dry-skin-specialist', 'mainConcern', 'dry_skin', 30], ['coco-kiss-moisturizing-lotion', 'mainConcern', 'body_moisture', 30], ['onion-shampoo', 'mainConcern', 'hair_cleansing', 30], ['intensive-scalp-hair-treatment', 'mainConcern', 'scalp_care', 30], ['onion-hair-oil', 'mainConcern', 'hair_oiling', 30],
  ['coco-kiss-moisturizing-lotion', 'secondaryConcern', 'dry_skin', 12, { role: 'optional' }], ['rayyvia-sun-protect', 'secondaryConcern', 'sun_protection', 12, { role: 'optional' }], ['acnfin-soft-face-wash', 'secondaryConcern', 'face_cleansing', 12, { role: 'optional' }], ['onion-shampoo', 'secondaryConcern', 'hair_cleansing', 12, { role: 'optional' }], ['intensive-scalp-hair-treatment', 'secondaryConcern', 'scalp_care', 12, { role: 'optional' }], ['onion-hair-oil', 'secondaryConcern', 'hair_oiling', 12, { role: 'optional' }],
  ['hydrelle-dry-skin-specialist', 'skinType', 'dry', 7, { role: 'optional' }], ['coco-kiss-moisturizing-lotion', 'skinType', 'dry', 5, { role: 'optional' }],
  ['rayyvia-sun-protect', 'careArea', 'skin', 4], ['coco-kiss-moisturizing-lotion', 'careArea', 'body', 4], ['onion-shampoo', 'careArea', 'hair', 4], ['intensive-scalp-hair-treatment', 'careArea', 'scalp', 4],
]

async function main() {
  const current = await prisma.careFinder.findFirst({ where: { active: true } })
  const finder = current
    ? await prisma.careFinder.update({ where: { id: current.id }, data: { name: 'SkinFox personalised care finder', version: { increment: 1 }, config, active: true } })
    : await prisma.careFinder.create({ data: { id: 'default-care-finder', name: 'SkinFox personalised care finder', config, active: true } })

  await prisma.careFinderRule.deleteMany({ where: { careFinderId: finder.id } })
  await prisma.careFinderQuestion.deleteMany({ where: { careFinderId: finder.id } })
  for (const [sortOrder, questionInput] of questions.entries()) {
    const question = await prisma.careFinderQuestion.create({ data: { careFinderId: finder.id, key: questionInput.key, prompt: questionInput.prompt, sortOrder, selectionMode: questionInput.selectionMode ?? 'single', required: questionInput.required ?? true, condition: questionInput.condition } })
    await prisma.careFinderOption.createMany({ data: questionInput.options.map((option, optionSort) => ({ questionId: question.id, value: option.value, label: option.label, description: option.description, sortOrder: optionSort, condition: option.condition })) })
  }
  for (const [slug, answerKey, answerValue, weight, metadata] of rules) {
    const product = await prisma.product.findUniqueOrThrow({ where: { slug } })
    await prisma.careFinderRule.create({ data: { careFinderId: finder.id, answerKey, answerValue, productId: product.id, weight, metadata: { ...guidance[slug], ...(metadata ?? {}) } } })
  }
  console.log(`Synced care finder ${finder.id}: ${questions.length} questions, ${rules.length} rules. Product pricing and inventory were not changed.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())

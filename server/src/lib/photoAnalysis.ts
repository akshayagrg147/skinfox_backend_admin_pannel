import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
// The SDK's zodOutputFormat consumes zod v4 schemas; the rest of the server
// still uses the v3 API from the bare 'zod' import.
import * as z from 'zod/v4'

/**
 * Cosmetic photo guidance for the care finder.
 *
 * The photo is held in memory for the duration of one request and is never
 * written to disk or to the database. The model is constrained to visible,
 * cosmetic attributes: it must not name conditions, and every answer it returns
 * is filtered against the care finder's own option values before use, so an
 * unexpected reply can never reach the recommendation engine.
 */

export const PHOTO_ANALYSIS_MODEL = 'claude-opus-5'

const analysisSchema = z.object({
  usable: z.boolean(),
  observations: z.array(z.string()),
  answers: z.array(z.object({ questionKey: z.string(), values: z.array(z.string()) })),
})

const systemPrompt = `You help a personal-care (cosmetics) store called SkinFox suggest products. You are shown one customer photo.

Describe ONLY visually apparent, cosmetic attributes — for example "skin looks dry", "visible shine across the forehead", "tone looks uneven", "hair looks dry at the ends".

Hard rules, no exceptions:
- Never name or imply a medical or dermatological condition. Do not use words like acne, eczema, rosacea, psoriasis, dermatitis, infection, allergy, disease, or any diagnosis.
- Never diagnose, and never suggest anything is wrong with the person.
- Never estimate age, gender, ethnicity, weight, health, mood, or identity, and never attempt to identify who the person is.
- Always hedge: say "appears" or "looks", never state a certainty.
- Keep each observation under 12 words, and return at most 4.
- If the image is unclear, is not a person, or you cannot tell, set usable to false and return empty observations and answers.

Then map what you observed onto the care-finder questions supplied by the user message. Choose ONLY from the allowed values listed for each question. Omit any question the photo cannot reasonably inform — a partial answer set is expected and correct.`

export type AllowedQuestion = { key: string; prompt: string; values: string[]; multi: boolean }
export type PhotoAnalysisResult = {
  usable: boolean
  observations: string[]
  answers: Record<string, string | string[]>
  note: string
}

export const photoAnalysisConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY)

export async function analysePhoto(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  questions: AllowedQuestion[],
): Promise<PhotoAnalysisResult> {
  const client = new Anthropic()
  const questionBrief = questions
    .map((question) => `- ${question.key} (${question.prompt}) — pick ${question.multi ? 'one or more' : 'exactly one'} of: ${question.values.join(', ')}`)
    .join('\n')

  const response = await client.messages.parse({
    model: PHOTO_ANALYSIS_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    output_config: { format: zodOutputFormat(analysisSchema), effort: 'low' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: `Care-finder questions you may answer:\n${questionBrief}` },
        ],
      },
    ],
  })

  const parsed = response.parsed_output
  if (!parsed || !parsed.usable) {
    return { usable: false, observations: [], answers: {}, note: photoNote }
  }

  // Only values the care finder actually defines survive, so the recommendation
  // endpoint can never be handed an answer it would reject.
  const allowed = new Map(questions.map((question) => [question.key, question]))
  const answers: Record<string, string | string[]> = {}
  for (const entry of parsed.answers) {
    const question = allowed.get(entry.questionKey)
    if (!question) continue
    const permitted = new Set(question.values)
    const values = entry.values.filter((value) => permitted.has(value))
    if (!values.length) continue
    // A single-select question must never receive an array, however many values
    // the model offers for it.
    answers[entry.questionKey] = question.multi && values.length > 1 ? values : values[0]
  }

  return { usable: true, observations: parsed.observations.slice(0, 4), answers, note: photoNote }
}

export const photoNote =
  'Based on what is visible in your photo. This is cosmetic product guidance, not a skin analysis or medical assessment — please check and adjust anything that looks wrong.'

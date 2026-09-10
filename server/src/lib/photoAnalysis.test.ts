import { beforeEach, describe, expect, it, vi } from 'vitest'

const parse = vi.fn()
const usage = { input_tokens: 1200, output_tokens: 110 }
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { parse } } }))

const { analysePhoto, photoAnalysisConfigured } = await import('./photoAnalysis.js')

const questions = [
  { key: 'careArea', prompt: 'Where shall we begin?', values: ['skin', 'hair'], multi: false },
  { key: 'secondaryConcern', prompt: 'Anything else?', values: ['comfort', 'moisture'], multi: true },
]

describe('care finder photo analysis', () => {
  beforeEach(() => parse.mockReset())

  it('reports whether an API key is configured', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(photoAnalysisConfigured()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'test-key'
    expect(photoAnalysisConfigured()).toBe(true)
  })

  it('keeps only answers the care finder actually defines', async () => {
    parse.mockResolvedValue({
      model: 'claude-haiku-4-5', usage,
      parsed_output: {
        usable: true,
        observations: ['Skin looks dry'],
        answers: [
          { questionKey: 'careArea', values: ['skin'] },
          { questionKey: 'secondaryConcern', values: ['moisture', 'not-a-real-option'] },
          { questionKey: 'invented_question', values: ['anything'] },
        ],
      },
    })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.usable).toBe(true)
    // Unknown question dropped, unknown value dropped, valid answers preserved.
    expect(result.answers).toEqual({ careArea: 'skin', secondaryConcern: 'moisture' })
    expect(result.observations).toEqual(['Skin looks dry'])
  })

  it('returns nothing usable when the model cannot read the photo', async () => {
    parse.mockResolvedValue({ model: 'claude-haiku-4-5', usage, parsed_output: { usable: false, observations: ['ignored'], answers: [{ questionKey: 'careArea', values: ['skin'] }] } })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.usable).toBe(false)
    expect(result.answers).toEqual({})
    expect(result.observations).toEqual([])
  })

  it('caps how many observations are shown', async () => {
    parse.mockResolvedValue({ model: 'claude-haiku-4-5', usage, parsed_output: { usable: true, observations: ['a', 'b', 'c', 'd', 'e', 'f'], answers: [] } })

    expect((await analysePhoto('base64data', 'image/jpeg', questions)).observations).toHaveLength(4)
  })

  it('sends the image and the allowed values to the model', async () => {
    parse.mockResolvedValue({ model: 'claude-haiku-4-5', usage, parsed_output: { usable: true, observations: [], answers: [] } })

    await analysePhoto('base64data', 'image/jpeg', questions)

    const request = parse.mock.calls[0][0]
    expect(request.model).toBe('claude-haiku-4-5')
    // Haiku 4.5 rejects effort with a 400, and runs without thinking by default.
    expect(request.output_config).not.toHaveProperty('effort')
    expect(request).not.toHaveProperty('thinking')
    const [image, text] = request.messages[0].content
    expect(image.source).toMatchObject({ type: 'base64', media_type: 'image/jpeg', data: 'base64data' })
    expect(text.text).toContain('skin, hair')
    expect(request.system).toContain('Never name or imply a medical or dermatological condition')
    expect(request.system).toContain('Never comment on skin colour, depth, or undertone')
    // Real schema conversion runs here: a zod-version mismatch would throw.
    expect(request.output_config.format.type).toBe('json_schema')
    expect(request.output_config.format.schema.properties).toHaveProperty('observations')
  })

  it('never hands a single-select question an array', async () => {
    parse.mockResolvedValue({
      model: 'claude-haiku-4-5', usage,
      parsed_output: {
        usable: true,
        observations: [],
        answers: [
          { questionKey: 'careArea', values: ['skin', 'hair'] },
          { questionKey: 'secondaryConcern', values: ['comfort', 'moisture'] },
        ],
      },
    })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.answers.careArea).toBe('skin')
    expect(result.answers.secondaryConcern).toEqual(['comfort', 'moisture'])
  })

  it('reports token usage for cost tracking', async () => {
    parse.mockResolvedValue({ model: 'claude-haiku-4-5', usage, parsed_output: { usable: true, observations: [], answers: [] } })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.usage).toEqual({ model: 'claude-haiku-4-5', inputTokens: 1200, outputTokens: 110 })
  })

  it('never lets the photo answer questions about the person, above all sensitivity', async () => {
    const withPersonal = [
      ...questions,
      { key: 'sensitivity', prompt: 'Sensitivity or allergies?', values: ['sensitive', 'allergy', 'concerning', 'normal'], multi: false },
      { key: 'currentRoutine', prompt: 'What are you already using?', values: ['none', 'moisturiser'], multi: true },
      { key: 'routinePreference', prompt: 'How much ritual?', values: ['simple', 'complete'], multi: false },
    ]
    parse.mockResolvedValue({
      model: 'claude-haiku-4-5', usage,
      parsed_output: {
        usable: true,
        observations: [],
        answers: [
          { questionKey: 'careArea', values: ['skin'] },
          { questionKey: 'sensitivity', values: ['normal'] },
          { questionKey: 'currentRoutine', values: ['moisturiser'] },
          { questionKey: 'routinePreference', values: ['simple'] },
        ],
      },
    })

    const result = await analysePhoto('base64data', 'image/jpeg', withPersonal)

    // Not offered to the model...
    const brief = parse.mock.calls[0][0].messages[0].content[1].text
    expect(brief).not.toContain('sensitivity')
    expect(brief).not.toContain('currentRoutine')
    expect(brief).not.toContain('routinePreference')
    // ...and not accepted back even if the model answers anyway.
    expect(result.answers).toEqual({ careArea: 'skin' })
  })
})

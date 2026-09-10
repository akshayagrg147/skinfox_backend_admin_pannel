import { beforeEach, describe, expect, it, vi } from 'vitest'

const parse = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { parse } } }))

const { analysePhoto, photoAnalysisConfigured } = await import('./photoAnalysis.js')

const questions = [
  { key: 'careArea', prompt: 'Where shall we begin?', values: ['skin', 'hair'], multi: false },
  { key: 'secondaryGoals', prompt: 'Anything else?', values: ['comfort', 'moisture'], multi: true },
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
      parsed_output: {
        usable: true,
        observations: ['Skin looks dry'],
        answers: [
          { questionKey: 'careArea', values: ['skin'] },
          { questionKey: 'secondaryGoals', values: ['moisture', 'not-a-real-option'] },
          { questionKey: 'invented_question', values: ['anything'] },
        ],
      },
    })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.usable).toBe(true)
    // Unknown question dropped, unknown value dropped, valid answers preserved.
    expect(result.answers).toEqual({ careArea: 'skin', secondaryGoals: 'moisture' })
    expect(result.observations).toEqual(['Skin looks dry'])
  })

  it('returns nothing usable when the model cannot read the photo', async () => {
    parse.mockResolvedValue({ parsed_output: { usable: false, observations: ['ignored'], answers: [{ questionKey: 'careArea', values: ['skin'] }] } })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.usable).toBe(false)
    expect(result.answers).toEqual({})
    expect(result.observations).toEqual([])
  })

  it('caps how many observations are shown', async () => {
    parse.mockResolvedValue({ parsed_output: { usable: true, observations: ['a', 'b', 'c', 'd', 'e', 'f'], answers: [] } })

    expect((await analysePhoto('base64data', 'image/jpeg', questions)).observations).toHaveLength(4)
  })

  it('sends the image and the allowed values to the model', async () => {
    parse.mockResolvedValue({ parsed_output: { usable: true, observations: [], answers: [] } })

    await analysePhoto('base64data', 'image/jpeg', questions)

    const request = parse.mock.calls[0][0]
    expect(request.model).toBe('claude-opus-5')
    const [image, text] = request.messages[0].content
    expect(image.source).toMatchObject({ type: 'base64', media_type: 'image/jpeg', data: 'base64data' })
    expect(text.text).toContain('skin, hair')
    expect(request.system).toContain('Never name or imply a medical or dermatological condition')
    // Real schema conversion runs here: a zod-version mismatch would throw.
    expect(request.output_config.format.type).toBe('json_schema')
    expect(request.output_config.format.schema.properties).toHaveProperty('observations')
  })

  it('never hands a single-select question an array', async () => {
    parse.mockResolvedValue({
      parsed_output: {
        usable: true,
        observations: [],
        answers: [
          { questionKey: 'careArea', values: ['skin', 'hair'] },
          { questionKey: 'secondaryGoals', values: ['comfort', 'moisture'] },
        ],
      },
    })

    const result = await analysePhoto('base64data', 'image/jpeg', questions)

    expect(result.answers.careArea).toBe('skin')
    expect(result.answers.secondaryGoals).toEqual(['comfort', 'moisture'])
  })
})

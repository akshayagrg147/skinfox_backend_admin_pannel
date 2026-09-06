import { describe, expect, it } from 'vitest'
import { SCALP_STORY_MOTION, clampStoryProgress, getScrollShowcaseIndex, getScrollStoryStep, shouldUseEnhancedStory } from './scrollStory'

describe('scroll product story progress', () => {
  it('defines a reference-style pinned bottle journey that alternates sides', () => {
    const { progress, xVw, yVh, rotateDeg, scale } = SCALP_STORY_MOTION
    const keyframeCount = progress.length

    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(1)
    expect(progress.every((value, index) => index === 0 || value > progress[index - 1])).toBe(true)
    expect([xVw, yVh, rotateDeg, scale].every((values) => values.length === keyframeCount)).toBe(true)
    expect([progress, xVw, yVh, rotateDeg, scale].flat().every(Number.isFinite)).toBe(true)
    expect(xVw[0]).toBe(0)
    expect(xVw.at(-1)).toBeGreaterThan(0)
    expect(Math.max(...xVw)).toBeGreaterThanOrEqual(25)
    expect(Math.min(...xVw)).toBeLessThanOrEqual(-25)
    expect(Math.max(...xVw) - Math.min(...xVw)).toBeGreaterThanOrEqual(50)
    expect(rotateDeg.some((value) => value < 0)).toBe(true)
    expect(rotateDeg.some((value) => value > 0)).toBe(true)
    expect(xVw.filter((value) => value >= 25)).toHaveLength(4)
    expect(xVw.filter((value) => value <= -25)).toHaveLength(2)
    expect(progress[2] - progress[1]).toBeCloseTo(0.14)
    expect(progress[4] - progress[3]).toBeCloseTo(0.13)
    expect(progress[6] - progress[5]).toBeCloseTo(0.14)
    expect(scale.every((value, index) => index === 0 || value <= scale[index - 1])).toBe(true)
    expect(SCALP_STORY_MOTION.ease(0)).toBe(0)
    expect(SCALP_STORY_MOTION.ease(0.25)).toBeCloseTo(0.1464, 4)
    expect(SCALP_STORY_MOTION.ease(0.5)).toBeCloseTo(0.5)
    expect(SCALP_STORY_MOTION.ease(0.75)).toBeCloseTo(0.8536, 4)
    expect(SCALP_STORY_MOTION.ease(1)).toBe(1)
  })

  it('keeps scroll motion on small screens while respecting accessibility and data preferences', () => {
    expect(shouldUseEnhancedStory({ reducedMotion: false, saveData: false })).toBe(true)
    expect(shouldUseEnhancedStory({ reducedMotion: true, saveData: false })).toBe(false)
    expect(shouldUseEnhancedStory({ reducedMotion: false, saveData: true })).toBe(false)
  })

  it('clamps progress to a safe normalized range', () => {
    expect(clampStoryProgress(-0.6)).toBe(0)
    expect(clampStoryProgress(0.42)).toBe(0.42)
    expect(clampStoryProgress(4)).toBe(1)
    expect(clampStoryProgress(Number.NaN)).toBe(0)
  })

  it('maps forward and reverse progress to deterministic chapters', () => {
    const checkpoints = [
      [0, 0],
      [0.219, 0],
      [0.22, 1],
      [0.434, 1],
      [0.435, 2],
      [0.689, 2],
      [0.69, 3],
      [1, 3],
    ] as const

    checkpoints.forEach(([progress, chapter]) => expect(getScrollStoryStep(progress)).toBe(chapter))
    ;[...checkpoints].reverse().forEach(([progress, chapter]) => expect(getScrollStoryStep(progress)).toBe(chapter))
  })

  it('keeps out-of-range values on a valid chapter', () => {
    expect(getScrollStoryStep(-1)).toBe(0)
    expect(getScrollStoryStep(2)).toBe(3)
  })

  it('maps collection progress safely for current and future launch sizes', () => {
    for (const count of [1, 4, 8, 10]) {
      expect(getScrollShowcaseIndex(0, count)).toBe(0)
      expect(getScrollShowcaseIndex(1, count)).toBe(count - 1)

      const samples = Array.from({ length: 41 }, (_, index) => index / 40)
      const forward = samples.map((value) => getScrollShowcaseIndex(value, count))
      const reverse = [...samples].reverse().map((value) => getScrollShowcaseIndex(value, count))
      expect(forward.every((index) => index >= 0 && index < count)).toBe(true)
      expect(forward.every((index, position) => position === 0 || index >= forward[position - 1])).toBe(true)
      expect(reverse).toEqual([...forward].reverse())
    }
  })
})

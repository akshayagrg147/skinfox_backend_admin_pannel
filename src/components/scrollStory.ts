export const STORY_STEP_THRESHOLDS = [0.22, 0.435, 0.69] as const

export const SCALP_STORY_MOTION = {
  progress: [0, 0.1, 0.24, 0.37, 0.5, 0.62, 0.76, 1],
  xVw: [0, 0, 26, 26, -26, -26, 25, 25],
  yVh: [6, 4, 0, 0, 0, 0, 0, 3],
  rotateDeg: [-6, -3, 6, 6, -6, -6, 4, 0],
  scale: [0.98, 0.95, 0.84, 0.82, 0.78, 0.76, 0.73, 0.7],
  ease: (value: number) => 0.5 - (Math.cos(Math.PI * value) / 2),
} as const

export function shouldUseEnhancedStory({ reducedMotion, saveData }: { reducedMotion: boolean; saveData: boolean }) {
  return !reducedMotion && !saveData
}

export function clampStoryProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

export function getScrollStoryStep(progress: number) {
  const value = clampStoryProgress(progress)

  if (value < STORY_STEP_THRESHOLDS[0]) return 0
  if (value < STORY_STEP_THRESHOLDS[1]) return 1
  if (value < STORY_STEP_THRESHOLDS[2]) return 2
  return 3
}

export function getScrollShowcaseIndex(progress: number, productCount: number) {
  const count = Math.max(1, Math.floor(productCount))
  const value = clampStoryProgress(progress)
  return Math.min(count - 1, Math.floor(value * count))
}

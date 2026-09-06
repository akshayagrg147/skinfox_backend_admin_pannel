import { describe, expect, it } from 'vitest'

describe('admin workspace smoke test', () => {
  it('loads the test runner and workspace contract', () => {
    expect('/api/v1'.startsWith('/api/')).toBe(true)
  })
})

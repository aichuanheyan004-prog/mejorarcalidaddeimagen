/** @vitest-environment jsdom */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useObjectUrl } from './useObjectUrl'

const createObjectUrl = vi.fn()
const revokeObjectUrl = vi.fn()

Object.defineProperties(URL, {
  createObjectURL: { configurable: true, value: createObjectUrl },
  revokeObjectURL: { configurable: true, value: revokeObjectUrl },
})

describe('useObjectUrl', () => {
  beforeEach(() => {
    createObjectUrl.mockReset()
    revokeObjectUrl.mockReset()
    createObjectUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
  })

  it('revokes replaced and unmounted object URLs', () => {
    const first = new Blob(['first'], { type: 'image/png' })
    const second = new Blob(['second'], { type: 'image/png' })
    const { rerender, result, unmount } = renderHook(
      ({ blob }) => useObjectUrl(blob),
      { initialProps: { blob: first } },
    )

    expect(result.current).toBe('blob:first')
    rerender({ blob: second })
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:first')
    expect(result.current).toBe('blob:second')

    unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:second')
  })
})

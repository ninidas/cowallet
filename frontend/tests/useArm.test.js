import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useArm } from '../src/hooks/useArm'

// Appuie sur le bouton « id » et renvoie ce que confirm() a répondu
function press(result, id) {
  let ok
  act(() => { ok = result.current[1](id) })
  return ok
}

describe('useArm', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('rien d\'armé au départ', () => {
    const { result } = renderHook(() => useArm())
    expect(result.current[0]).toBe(null)
  })

  it('première touche : arme sans confirmer ; seconde : confirme et désarme', () => {
    const { result } = renderHook(() => useArm())
    expect(press(result, 'del')).toBe(false)
    expect(result.current[0]).toBe('del')
    expect(press(result, 'del')).toBe(true)
    expect(result.current[0]).toBe(null)
  })

  it('se désarme seul au bout de 3 s', () => {
    const { result } = renderHook(() => useArm())
    press(result, 'del')
    act(() => vi.advanceTimersByTime(2999))
    expect(result.current[0]).toBe('del')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe(null)
    // Après expiration, il faut de nouveau deux touches
    expect(press(result, 'del')).toBe(false)
  })

  it('un autre bouton réarme sur lui, sans confirmer', () => {
    const { result } = renderHook(() => useArm())
    press(result, 'cat-1')
    expect(press(result, 'cat-2')).toBe(false)
    expect(result.current[0]).toBe('cat-2')
    expect(press(result, 'cat-2')).toBe(true)
  })

  it('réarmer repart pour un délai complet', () => {
    const { result } = renderHook(() => useArm())
    press(result, 'a')
    act(() => vi.advanceTimersByTime(2500))
    press(result, 'b')
    act(() => vi.advanceTimersByTime(2500))
    expect(result.current[0]).toBe('b')
    act(() => vi.advanceTimersByTime(500))
    expect(result.current[0]).toBe(null)
  })

  it('délai réglable', () => {
    const { result } = renderHook(() => useArm(500))
    press(result, 'x')
    act(() => vi.advanceTimersByTime(500))
    expect(result.current[0]).toBe(null)
  })

  it('le minuteur est arrêté au démontage', () => {
    const { result, unmount } = renderHook(() => useArm())
    press(result, 'x')
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import i18n from '../src/i18n/i18n'
import { useFmt } from '../src/hooks/useFmt'

const auth = vi.hoisted(() => ({ config: null }))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }))

// Intl sépare les milliers par une espace fine insécable et met une insécable avant le symbole
const NNBSP = ' ', NBSP = ' '
const fmtWith = opts => renderHook(() => useFmt(opts)).result.current

describe('useFmt', () => {
  afterEach(async () => {
    auth.config = null
    await act(() => i18n.changeLanguage('fr'))
  })

  it('euros au format français par défaut', () => {
    const fmt = fmtWith()
    expect(fmt(1323.33)).toBe(`1${NNBSP}323,33${NBSP}€`)
    expect(fmt(0)).toBe(`0,00${NBSP}€`)
    expect(fmt(-5)).toBe(`-5,00${NBSP}€`)
    expect(fmt(12.345)).toBe(`12,35${NBSP}€`)
  })

  it('devise du groupe, en symbole court', () => {
    auth.config = { currency: 'USD' }
    expect(fmtWith()(1323.33)).toBe(`1${NNBSP}323,33${NBSP}$`)
    auth.config = { currency: 'GBP' }
    expect(fmtWith()(10)).toBe(`10,00${NBSP}£`)
  })

  it('yen sans décimales', () => {
    auth.config = { currency: 'JPY' }
    expect(fmtWith()(1234.5)).toBe(`1${NNBSP}235${NBSP}¥`)
  })

  it('nombre de décimales imposé', () => {
    expect(fmtWith({ maximumFractionDigits: 0 })(12.6)).toBe(`13${NBSP}€`)
  })

  it("suit la langue de l'app, pas celle du téléphone", async () => {
    await act(() => i18n.changeLanguage('en'))
    expect(fmtWith()(1323.33)).toBe('€1,323.33')
  })
})

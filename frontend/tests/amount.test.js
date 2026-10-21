import { describe, it, expect } from 'vitest'
import { cleanAmountInput, parseAmount } from '../src/utils/amount'

describe('cleanAmountInput', () => {
  it('garde la virgule ou le point tel que tapé', () => {
    expect(cleanAmountInput('12,50')).toBe('12,50')
    expect(cleanAmountInput('12.50')).toBe('12.50')
    expect(cleanAmountInput('66,')).toBe('66,')
    expect(cleanAmountInput(',5')).toBe(',5')
  })

  it('ne garde que le premier séparateur décimal', () => {
    expect(cleanAmountInput('12,5,0')).toBe('12,50')
    expect(cleanAmountInput('1.2,3')).toBe('1.23')
    expect(cleanAmountInput('1,,')).toBe('1,')
  })

  it('retire espaces, symbole, lettres et signe moins', () => {
    expect(cleanAmountInput('1 234,56 €')).toBe('1234,56')
    expect(cleanAmountInput('1 234,56')).toBe('1234,56')
    expect(cleanAmountInput('-12')).toBe('12')
    expect(cleanAmountInput('abc')).toBe('')
  })

  it('vide, null ou undefined donnent une chaîne vide', () => {
    expect(cleanAmountInput('')).toBe('')
    expect(cleanAmountInput(null)).toBe('')
    expect(cleanAmountInput(undefined)).toBe('')
  })

  it('accepte un nombre', () => {
    expect(cleanAmountInput(12.5)).toBe('12.5')
  })
})

describe('parseAmount', () => {
  it('lit la virgule comme le point', () => {
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount(',5')).toBe(0.5)
    expect(parseAmount('66,')).toBe(66)
  })

  it('garde le signe moins', () => {
    expect(parseAmount('-3,2')).toBe(-3.2)
  })

  it('NaN si vide ou invalide', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount(null)).toBeNaN()
    expect(parseAmount(undefined)).toBeNaN()
    expect(parseAmount('abc')).toBeNaN()
  })

  it("s'arrête au premier caractère illisible (espace compris)", () => {
    expect(parseAmount('12abc')).toBe(12)
    expect(parseAmount('1 234,5')).toBe(1)
    // Seule la première virgule devient un point
    expect(parseAmount('1,234,5')).toBe(1.234)
  })

  it('accepte un nombre', () => {
    expect(parseAmount(7)).toBe(7)
  })

  it('après cleanAmountInput, une saisie avec espaces et symbole se lit entière', () => {
    expect(parseAmount(cleanAmountInput('1 234,56 €'))).toBe(1234.56)
  })
})

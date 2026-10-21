import { describe, it, expect, afterEach, vi } from 'vitest'
import { getDefaultCurrency } from '../src/utils/currency'

const withLanguage = lang => vi.spyOn(navigator, 'language', 'get').mockReturnValue(lang)

describe('getDefaultCurrency', () => {
  afterEach(() => vi.restoreAllMocks())

  it('devise de la langue du navigateur quand elle est connue', () => {
    withLanguage('fr-FR'); expect(getDefaultCurrency()).toBe('EUR')
    withLanguage('en-US'); expect(getDefaultCurrency()).toBe('USD')
    withLanguage('en-GB'); expect(getDefaultCurrency()).toBe('GBP')
    withLanguage('fr-CH'); expect(getDefaultCurrency()).toBe('CHF')
    withLanguage('pt-BR'); expect(getDefaultCurrency()).toBe('BRL')
    withLanguage('ja-JP'); expect(getDefaultCurrency()).toBe('JPY')
  })

  it('sinon, la langue seule', () => {
    withLanguage('fr'); expect(getDefaultCurrency()).toBe('EUR')
    withLanguage('en'); expect(getDefaultCurrency()).toBe('USD')
    withLanguage('en-ZA'); expect(getDefaultCurrency()).toBe('USD')
    withLanguage('de-LU'); expect(getDefaultCurrency()).toBe('EUR')
  })

  it("l'euro pour tout le reste", () => {
    withLanguage('ja'); expect(getDefaultCurrency()).toBe('EUR')
    withLanguage('xx-YY'); expect(getDefaultCurrency()).toBe('EUR')
  })

  it("langue vide : traitée comme l'anglais", () => {
    withLanguage(''); expect(getDefaultCurrency()).toBe('USD')
  })
})

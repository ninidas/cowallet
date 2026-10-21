import { describe, it, expect } from 'vitest'
import i18n from '../src/i18n/i18n'
import { txLabel, txKind, txKindLabel, txDay } from '../src/components/month/transactions'

const t = i18n.t.bind(i18n)

describe('libellés des transactions', () => {
  it('txLabel retire « PRLV SEPA » en tête et resserre les espaces', () => {
    expect(txLabel('PRLV SEPA Assurance Exemple  Contrat')).toBe('Assurance Exemple Contrat')
    expect(txLabel('prlv sepa Assurance Exemple')).toBe('Assurance Exemple')
    expect(txLabel('CB  Boulangerie du coin')).toBe('CB Boulangerie du coin')
    expect(txLabel('VIR PRLV SEPA Alex')).toBe('VIR PRLV SEPA Alex')
  })

  it('txKind : carte, prélèvement ou rien', () => {
    expect(txKind({ is_card: true, description: 'PRLV SEPA X' })).toBe('card')
    expect(txKind({ is_card: false, description: 'PRLV SEPA Assurance Exemple' })).toBe('debit')
    expect(txKind({ is_card: false, description: 'VIR Alex' })).toBe(null)
  })

  it('txKindLabel nomme le porteur de la carte quand il est connu', () => {
    expect(txKindLabel({ is_card: true, card_owner: 'Sam', description: 'Boulangerie du coin' }, t)).toBe('Carte de Sam')
    expect(txKindLabel({ is_card: true, description: 'Boulangerie du coin' }, t)).toBe('Carte')
    expect(txKindLabel({ is_card: false, card_owner: 'Sam', description: 'PRLV SEPA Assurance Exemple' }, t)).toBe('Prélèvement')
    expect(txKindLabel({ is_card: false, description: 'VIR Alex' }, t)).toBe(null)
  })

  it("txDay préfère la date d'achat à celle d'enregistrement", () => {
    expect(txDay({ date: '2026-09-17', purchase_date: '2026-09-15' })).toBe('2026-09-15')
    expect(txDay({ date: '2026-09-17', purchase_date: null })).toBe('2026-09-17')
  })
})

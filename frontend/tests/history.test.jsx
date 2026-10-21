import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategoryBreakdown, { breakdownRows, merchantsOf, UNCATEGORIZED } from '../src/components/history/CategoryBreakdown'

// useFmt lit la devise du groupe : pas de groupe chargé, donc l'euro
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ config: null }) }))

// Trois mois : août et septembre ont des relevés, novembre (à venir) seulement du prévu
const months = [
  { id: 1, label: 'Août 2026' }, { id: 2, label: 'Septembre 2026' }, { id: 3, label: 'Novembre 2026' },
]
const stats = {
  by_month: [
    { label: 'Août 2026', Maison: 1000, Alimentation: 500 },
    { label: 'Septembre 2026', Maison: 1000, Alimentation: 500, Voiture: 60 },
    { label: 'Novembre 2026', Maison: 1000, Alimentation: 500 },
  ],
  by_month_actual: [
    { label: 'Août 2026', Maison: 990, Alimentation: 560, Santé: 40, [UNCATEGORIZED]: 25 },
    { label: 'Septembre 2026', Maison: 1000, Alimentation: 480 },
    { label: 'Novembre 2026' },
  ],
  by_merchant: [
    { month: 'Août 2026', month_id: 1, category: 'Alimentation', key: 'SUPER', merchant: 'Supermarché Central', kind: 'card', total: 400, count: 5 },
    { month: 'Septembre 2026', month_id: 2, category: 'Alimentation', key: 'SUPER', merchant: 'Supermarché Central', kind: 'card', total: 380, count: 4 },
    { month: 'Août 2026', month_id: 1, category: 'Alimentation', key: 'BOUL', merchant: 'Boulangerie du coin', kind: 'card', total: 160, count: 12 },
    { month: 'Septembre 2026', month_id: 2, category: 'Alimentation', key: 'BOUL', merchant: 'Boulangerie du coin', kind: 'card', total: 100, count: 8 },
    { month: 'Août 2026', month_id: 1, category: UNCATEGORIZED, key: 'PAYPAL|7', merchant: 'PayPal', kind: 'debit', date: '2026-08-19', total: 25, count: 1 },
  ],
}
const categoriesMap = new Map([['Maison', { color: '#3b82f6' }], ['Alimentation', { color: '#10b981' }]])
const shortLabel = l => l.slice(0, 4)

describe('breakdownRows', () => {
  it('additionne les mois choisis ; prévu d\'abord, puis le non prévu, « Sans catégorie » en dernier', () => {
    expect(breakdownRows(stats, ['Août 2026', 'Septembre 2026'])).toEqual([
      { category: 'Maison', budget: 2000, actual: 1990 },
      { category: 'Alimentation', budget: 1000, actual: 1040 },
      { category: 'Voiture', budget: 60, actual: 0 },
      { category: 'Santé', budget: 0, actual: 40 },
      { category: UNCATEGORIZED, budget: 0, actual: 25 },
    ])
  })
})

describe('merchantsOf', () => {
  it('un commerçant par ligne sur la période, du plus gros au plus petit', () => {
    expect(merchantsOf(stats, ['Août 2026', 'Septembre 2026'], 'Alimentation').map(m => [m.merchant, m.total, m.count]))
      .toEqual([['Supermarché Central', 780, 9], ['Boulangerie du coin', 260, 20]])
    expect(merchantsOf(stats, ['Septembre 2026'], 'Alimentation').map(m => m.total)).toEqual([380, 100])
  })
})

describe('CategoryBreakdown', () => {
  const renderIt = (onOpenMonth = vi.fn()) =>
    render(<CategoryBreakdown stats={stats} months={months} categoriesMap={categoriesMap} shortLabel={shortLabel} onOpenMonth={onOpenMonth} />)

  it('« Tous » ne compte que les mois avec relevés, et le dit', () => {
    renderIt()
    expect(screen.getByText('Sur les 2 mois avec relevés bancaires')).toBeInTheDocument()
    expect(screen.getByText('Les mois sans relevés ne sont pas comptés.')).toBeInTheDocument()
    // 3 095 € réels sur 3 060 € prévus (novembre écarté) : 35 € au-dessus
    expect(screen.getByText('+35 € au-dessus')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nove' })).not.toBeInTheDocument()
  })

  it('étiquettes : écart, non prévu, rien de dépensé, à classer', () => {
    renderIt()
    expect(screen.getByText('+40 €')).toBeInTheDocument()
    expect(screen.getByText('−10 €')).toBeInTheDocument()
    expect(screen.getByText('non prévu')).toBeInTheDocument()
    expect(screen.getByText('rien de dépensé')).toBeInTheDocument()
    expect(screen.getByText('1 à classer')).toBeInTheDocument()
  })

  it('une catégorie dépliée montre ses commerçants', () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: /Alimentation/ }))
    expect(screen.getByText('Supermarché Central')).toBeInTheDocument()
    expect(screen.getByText('9 achats')).toBeInTheDocument()
    expect(screen.getByText('780 €')).toBeInTheDocument()
  })

  it('sur un mois, « Sans catégorie » mène au classement dans ce mois', () => {
    const onOpenMonth = vi.fn()
    renderIt(onOpenMonth)
    fireEvent.click(screen.getByRole('button', { name: 'Août' }))
    expect(screen.getByText('Août 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sans catégorie/ }))
    expect(screen.getByText('PayPal du 19 août')).toBeInTheDocument()
    expect(screen.getByText('25,00 €')).toBeInTheDocument()
    expect(screen.getByText('1 prélèvement')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Classer dans Août 2026' }))
    expect(onOpenMonth).toHaveBeenCalledWith(1)
  })
})

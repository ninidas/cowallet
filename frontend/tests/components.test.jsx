import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '../src/i18n/i18n'
import TransferButton from '../src/components/month/TransferButton'
import SpentStrip from '../src/components/month/SpentStrip'
import BudgetVsActualCard from '../src/components/month/BudgetVsActualCard'
import TransactionSheet from '../src/components/month/TransactionSheet'
import NotifRow from '../src/components/settings/NotifRow'

// useFmt lit la devise du groupe : pas de groupe chargé, donc l'euro
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ config: null }) }))

const t = i18n.t.bind(i18n)

describe('TransferButton', () => {
  it('à virer : prénom et montant, un appui bascule', () => {
    const onToggle = vi.fn()
    render(<TransferButton name="alex" amount={612.5} done={false} onToggle={onToggle} />)
    expect(screen.getByText('alex')).toBeInTheDocument()
    expect(screen.getByText('612,50 € à virer')).toBeInTheDocument()
    expect(screen.queryByText(/à recevoir/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('viré : le montant laisse place à « Viré »', () => {
    render(<TransferButton name="sam" amount={612.5} done onToggle={() => {}} />)
    expect(screen.getByText('Viré')).toBeInTheDocument()
    expect(screen.queryByText(/à virer/)).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-50')
  })

  it('a avancé plus que sa part : ce que le compte commun lui doit', () => {
    render(<TransferButton name="sam" amount={0} toReceive={40} done={false} onToggle={() => {}} />)
    expect(screen.getByText('40,00 € à recevoir')).toBeInTheDocument()
  })

  it('pendant l\'enregistrement, le bouton est inactif', () => {
    render(<TransferButton name="sam" amount={10} done={false} onToggle={() => {}} loading />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('SpentStrip', () => {
  const bva = {
    has_transactions: true,
    total_actual: 450,
    total_budget: 400,
    uncategorized: 25.5,
    first_date: '2026-09-01',
    last_date: '2026-09-28',
  }

  it('mois passé au-dessus du prévu', () => {
    const { container } = render(<SpentStrip bva={bva} isCurrent={false} />)
    expect(screen.getByText('Dépensé')).toBeInTheDocument()
    expect(screen.getByText('+50,00 € au-dessus')).toHaveClass('bg-red-100')
    expect(screen.getByText('/ 400,00 € prévus').parentElement).toHaveTextContent('450,00 € / 400,00 € prévus')
    expect(screen.getByText('Transactions du 1 sept. au 28 sept.')).toBeInTheDocument()
    expect(screen.getByText('dont 25,50 € encore sans catégorie')).toBeInTheDocument()
    // Barre pleine en rouge, et un trait à l'endroit du prévu
    const bar = container.querySelector('.bg-red-300')
    expect(bar).toHaveStyle({ width: '100%' })
    expect(bar.nextSibling).toHaveStyle({ left: `${(400 / 450) * 100}%` })
  })

  it('mois en cours sous le prévu', () => {
    const { container } = render(<SpentStrip bva={{ ...bva, total_actual: 300, uncategorized: 0 }} isCurrent />)
    expect(screen.getByText('Dépensé à ce jour')).toBeInTheDocument()
    expect(screen.getByText('−100,00 € sous le prévu')).toHaveClass('bg-emerald-100')
    expect(screen.queryByText(/^Transactions du/)).not.toBeInTheDocument()
    expect(screen.queryByText(/sans catégorie/)).not.toBeInTheDocument()
    expect(container.querySelector('.bg-emerald-300')).toHaveStyle({ width: '75%' })
    expect(container.querySelector('.bg-white.w-0\\.5')).toBeNull()
  })

  it('pile au prévu : pas de pastille d\'écart', () => {
    render(<SpentStrip bva={{ ...bva, total_actual: 400 }} isCurrent={false} />)
    expect(screen.queryByText(/au-dessus|sous le prévu/)).not.toBeInTheDocument()
  })

  it('rien de prévu : barre pleine', () => {
    const { container } = render(<SpentStrip bva={{ ...bva, total_budget: 0, total_actual: 20 }} isCurrent />)
    expect(screen.getByText('+20,00 € au-dessus')).toBeInTheDocument()
    expect(container.querySelector('.bg-red-300')).toHaveStyle({ width: '100%' })
  })
})

describe('BudgetVsActualCard', () => {
  it("rien à montrer sans catégorie ni transaction à classer", () => {
    const { container } = render(<BudgetVsActualCard bva={{ rows: [], uncategorized: 0, total_actual: 0, total_budget: 0 }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('une ligne par catégorie, la ligne « Sans catégorie » et le total', () => {
    render(<BudgetVsActualCard bva={{
      rows: [{ category: 'Courses', icon: '🛒', color: '#10b981', actual: 180, budget: 200, delta: -20 }],
      uncategorized: 30, uncategorized_count: 2, total_actual: 210, total_budget: 200,
    }} />)
    expect(screen.getByText('Courses')).toBeInTheDocument()
    expect(screen.getByText('-20,00 €')).toHaveClass('text-emerald-500')
    expect(screen.getByText('2 transactions à classer')).toBeInTheDocument()
    expect(screen.getByText('+10,00 €')).toHaveClass('text-red-600')
  })
})

describe('TransactionSheet', () => {
  const categories = [
    { id: 1, name: 'Courses', color: '#10b981' },
    { id: 2, name: 'Maison', color: '#3b82f6' },
  ]
  const tx = { id: 7, description: 'PRLV SEPA Boulangerie du coin', amount: 12.4, date: '2026-09-15', category: null }

  it('libellé, date, nature et montant ; une catégorie se choisit d\'un appui', () => {
    const onPick = vi.fn()
    render(<TransactionSheet tx={tx} categories={categories} onPick={onPick} onDelete={() => {}} onClose={() => {}} t={t} />)
    expect(screen.getByText('Boulangerie du coin')).toBeInTheDocument()
    expect(screen.getByText('mardi 15 septembre · Prélèvement')).toBeInTheDocument()
    expect(screen.getByText('12,40 €')).toBeInTheDocument()
    expect(screen.getByText(/suivront le même choix/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Maison' }))
    expect(onPick).toHaveBeenCalledWith('Maison')
  })

  it('retoucher la catégorie choisie la retire', () => {
    const onPick = vi.fn()
    render(<TransactionSheet tx={{ ...tx, category: 'Courses' }} categories={categories} onPick={onPick} onDelete={() => {}} onClose={() => {}} t={t} />)
    expect(screen.getByRole('radio', { name: 'Courses' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/suivront le même choix/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Courses' }))
    expect(onPick).toHaveBeenCalledWith(null)
  })

  it('un remboursement s\'affiche en positif', () => {
    render(<TransactionSheet tx={{ ...tx, amount: -8 }} categories={categories} onPick={() => {}} onDelete={() => {}} onClose={() => {}} t={t} />)
    expect(screen.getByText('+8,00 €')).toHaveClass('text-emerald-600')
  })

  it('suppression en deux touches', () => {
    const onDelete = vi.fn()
    render(<TransactionSheet tx={tx} categories={categories} onPick={() => {}} onDelete={onDelete} onClose={() => {}} t={t} />)
    fireEvent.click(screen.getByText('Supprimer la transaction'))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Confirmer : supprimer la transaction'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

describe('NotifRow', () => {
  it('libellé, explication et interrupteur', () => {
    const onToggle = vi.fn()
    render(<NotifRow label="Budget dépassé" hint="Quand le réel passe au-dessus du prévu" on onToggle={onToggle} />)
    expect(screen.getByText('Quand le réel passe au-dessus du prévu')).toBeInTheDocument()
    const sw = screen.getByRole('switch', { name: 'Budget dépassé' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveClass('bg-violet-600')
    fireEvent.click(sw)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('éteint quand on ne dit rien', () => {
    render(<NotifRow label="Rappel" hint="…" onToggle={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch')).toHaveClass('bg-slate-200')
  })

  it('inactif : un appui ne fait rien ; le contenu ajouté s\'affiche dessous', () => {
    const onToggle = vi.fn()
    render(<NotifRow label="Cet appareil" hint="…" disabled onToggle={onToggle}><p>Notifications bloquées</p></NotifRow>)
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).not.toHaveBeenCalled()
    expect(screen.getByText('Notifications bloquées')).toBeInTheDocument()
  })
})

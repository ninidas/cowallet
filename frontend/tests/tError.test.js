import { describe, it, expect, vi } from 'vitest'
import i18n from '../src/i18n/i18n'
import { tError } from '../src/utils/tError'

const t = i18n.t.bind(i18n)

describe('tError', () => {
  it('traduit un message connu du serveur', () => {
    expect(tError(t, 'Invalid credentials')).toBe('Identifiants incorrects')
    expect(tError(t, 'Month already exists')).toBe('Ce mois existe déjà')
  })

  it('deux messages du serveur peuvent donner la même traduction', () => {
    expect(tError(t, 'New password is too short')).toBe(tError(t, 'Password must be at least 12 characters'))
  })

  it('demande la clé errors.* avec le message d\'origine en repli', () => {
    const fake = vi.fn(() => 'traduit')
    expect(tError(fake, 'Too many attempts')).toBe('traduit')
    expect(fake).toHaveBeenCalledWith('errors.too_many_attempts', 'Too many attempts')
  })

  it('laisse tel quel un message inconnu', () => {
    const fake = vi.fn()
    expect(tError(fake, 'Boulangerie du coin introuvable')).toBe('Boulangerie du coin introuvable')
    expect(fake).not.toHaveBeenCalled()
  })

  it('renvoie la valeur vide telle quelle', () => {
    expect(tError(t, '')).toBe('')
    expect(tError(t, null)).toBe(null)
    expect(tError(t, undefined)).toBe(undefined)
  })
})

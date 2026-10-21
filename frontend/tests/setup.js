import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import i18n from '../src/i18n/i18n'

// Textes en français, comme l'app par défaut
beforeAll(() => i18n.changeLanguage('fr'))
afterEach(() => cleanup())

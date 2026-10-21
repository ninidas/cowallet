// Saisie des montants : champ texte (clavier décimal) plutôt que type="number", que Safari sur iPhone
// vide dès qu'on tape une virgule (« 66, » est invalide pour lui). Virgule et point sont acceptés.

// Garde les chiffres et un seul séparateur décimal, tel que tapé
export function cleanAmountInput(value) {
  const s = String(value ?? '').replace(/[^\d.,]/g, '')
  const i = s.search(/[.,]/)
  return i === -1 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/[.,]/g, '')
}

// Montant saisi → nombre (NaN si vide ou invalide)
export function parseAmount(value) {
  return parseFloat(String(value ?? '').replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.'))
}

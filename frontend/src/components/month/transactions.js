// Transactions importées : libellé, nature (carte, prélèvement) et jour, partagés par la liste et la feuille

// Libellé de la banque tel quel (on le retrouve sur le relevé), sans le « PRLV SEPA » déjà dit par « Prélèvement »
export const txLabel = d => d.replace(/^PRLV SEPA\s+/i, '').replace(/\s{2,}/g, ' ')
export const txKind  = tx => tx.is_card ? 'card' : /^PRLV SEPA/i.test(tx.description) ? 'debit' : null
// « Carte de Sam » quand la carte est reconnue (Réglages › Compte), sinon « Carte » / « Prélèvement »
export const txKindLabel = (tx, t) => {
  const kind = txKind(tx)
  if (kind === 'card' && tx.card_owner) return t('month_detail.tx_card_of', { name: tx.card_owner })
  return kind ? t(`month_detail.tx_${kind}`) : null
}
// Paiement par carte : la vraie date d'achat, la banque l'enregistre 1 à 3 jours plus tard
export const txDay = tx => tx.purchase_date || tx.date

import { useState, useEffect } from 'react'

// Ordinateur : sommaire à gauche et rubrique à droite ; téléphone : l'un puis l'autre
export function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = e => setDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

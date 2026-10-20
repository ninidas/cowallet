import { useState, useRef, useEffect } from 'react'

// Suppression en deux touches : la première arme le bouton pendant 3 s, la seconde confirme.
// confirm(id) renvoie true quand l'action doit vraiment être faite.
export function useArm(delay = 3000) {
  const [armed, setArmed] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function confirm(id) {
    clearTimeout(timer.current)
    if (armed !== id) {
      setArmed(id)
      timer.current = setTimeout(() => setArmed(null), delay)
      return false
    }
    setArmed(null)
    return true
  }
  return [armed, confirm]
}

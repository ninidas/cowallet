import { createContext, useContext } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications'

const PushContext = createContext(null)

export function PushProvider({ children }) {
  const push = usePushNotifications()
  return <PushContext.Provider value={push}>{children}</PushContext.Provider>
}

export function usePush() {
  return useContext(PushContext)
}

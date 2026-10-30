import { useEffect, useState } from 'react'

// The time now, read again every half minute, for words such as "Synced 2 minutes ago".
export function usePapelizSyncClockTime(): number {
  const [syncClockTime, setSyncClockTime] = useState(() => Date.now())
  useEffect(() => {
    const syncClockTimer = setInterval(() => setSyncClockTime(Date.now()), 30_000)
    return () => clearInterval(syncClockTimer)
  }, [])
  return syncClockTime
}

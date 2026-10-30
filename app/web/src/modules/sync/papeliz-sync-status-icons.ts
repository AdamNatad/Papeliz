import { CirclePause, CloudCheck, CloudOff, Lock, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { PapelizSyncStatusIconKind } from './papeliz-sync-screen-words'

// The icon for each sync state, in the status bar and on the Sync page.
export const papelizSyncStatusIcons: Record<PapelizSyncStatusIconKind, LucideIcon> = {
  synced: CloudCheck,
  syncing: RefreshCw,
  offline: CloudOff,
  waiting: CloudOff,
  attention: TriangleAlert,
  paused: CirclePause,
  locked: Lock,
}

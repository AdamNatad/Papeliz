import { onBackButtonPress } from '@tauri-apps/api/app'
import type { PluginListener } from '@tauri-apps/api/core'
import { useEffect, useRef } from 'react'

// Android's Back (the gesture or the button) steps back inside Papeliz before it leaves it: an open
// sheet or menu closes, a Settings page goes back to the list, another place goes back to Note, and only
// then does Back leave the app. While anything can be stepped back, the page listens to Back through
// Tauri's app plugin, which then hands each Back to the page instead of the phone; with nothing left, it
// stops listening, so Back on Note leaves Papeliz the phone's own way.

const papelizMobileBackSteps: Array<() => void> = []
let papelizMobileBackButtonListener: Promise<PluginListener> | null = null

function takeLatestPapelizMobileBackStep(): void {
  papelizMobileBackSteps.at(-1)?.()
}

function listenToBackWhileThereAreSteps(): void {
  if (papelizMobileBackSteps.length > 0 && papelizMobileBackButtonListener === null) {
    papelizMobileBackButtonListener = onBackButtonPress(takeLatestPapelizMobileBackStep)
  } else if (papelizMobileBackSteps.length === 0 && papelizMobileBackButtonListener !== null) {
    const backButtonListenerToStop = papelizMobileBackButtonListener
    papelizMobileBackButtonListener = null
    void backButtonListenerToStop.then((backButtonListener) => backButtonListener.unregister()).catch(() => undefined)
  }
}

// While `isBackStepAvailable`, Back runs `takeBackStep`: the most recent step available goes first, so a
// sheet closes before the place it opened on.
export function usePapelizMobileBackStep(isBackStepAvailable: boolean, takeBackStep: () => void): void {
  const latestTakeBackStep = useRef(takeBackStep)
  useEffect(() => {
    latestTakeBackStep.current = takeBackStep
  })
  useEffect(() => {
    if (!isBackStepAvailable) return undefined
    const papelizMobileBackStep = () => latestTakeBackStep.current()
    papelizMobileBackSteps.push(papelizMobileBackStep)
    listenToBackWhileThereAreSteps()
    return () => {
      const backStepIndex = papelizMobileBackSteps.lastIndexOf(papelizMobileBackStep)
      if (backStepIndex !== -1) papelizMobileBackSteps.splice(backStepIndex, 1)
      listenToBackWhileThereAreSteps()
    }
  }, [isBackStepAvailable])
}

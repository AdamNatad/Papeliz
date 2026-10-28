import { lazy, Suspense } from 'react'

// Where the eye previewer button goes. Only development builds load it: in a production build
// `import.meta.env.DEV` is false, so the button and everything it uses are left out.
const PapelizWorkspaceEyePreviewerButton = import.meta.env.DEV
  ? lazy(() =>
      import('./papeliz-workspace-eye-previewer-button').then((eyePreviewerButtonModule) => ({
        default: eyePreviewerButtonModule.PapelizWorkspaceEyePreviewerButton,
      })),
    )
  : null

export function PapelizWorkspaceEyePreviewerSlot() {
  if (PapelizWorkspaceEyePreviewerButton === null) return null
  return (
    <Suspense fallback={null}>
      <PapelizWorkspaceEyePreviewerButton />
    </Suspense>
  )
}

interface PapelizFileListToggleIconProps {
  isFileListOpen: boolean
  className?: string
}

// The file list button's icon: a rounded window with a panel down its left side. Open, the panel
// is a filled block; closed, it is a slim bar. Between the two it grows or shrinks in place.
export function PapelizFileListToggleIcon({ isFileListOpen, className }: PapelizFileListToggleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <rect
        fill="currentColor"
        stroke="none"
        className="papeliz-file-list-toggle-icon-panel"
        style={isFileListOpen ? { x: 6, y: 7, width: 5, height: 10, rx: 1.5 } : { x: 7, y: 7.5, width: 2, height: 9, rx: 1 }}
      />
    </svg>
  )
}

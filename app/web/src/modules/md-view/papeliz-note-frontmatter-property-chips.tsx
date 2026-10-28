import { Calendar, Hash, Link as LinkIcon, Tag as TagIcon, type LucideIcon } from 'lucide-react'
import type { PapelizNoteFrontmatterProperty } from './papeliz-note-frontmatter-properties'

function getFrontmatterPropertyIcon(frontmatterPropertyName: string): LucideIcon {
  const lowerCasePropertyName = frontmatterPropertyName.toLowerCase()
  if (lowerCasePropertyName === 'tags' || lowerCasePropertyName === 'tag') return Hash
  if (lowerCasePropertyName === 'aliases' || lowerCasePropertyName === 'alias') return LinkIcon
  if (/date|created|updated|modified|due/.test(lowerCasePropertyName)) return Calendar
  return TagIcon
}

interface PapelizNoteFrontmatterPropertyChipsProps {
  noteFrontmatterProperties: readonly PapelizNoteFrontmatterProperty[]
}

// The note's properties (its frontmatter) as chips: an icon, the name and the values. The locked
// MD View page draws them above the note; the editable MD View draws them in place of the
// frontmatter while the cursor is elsewhere (papeliz-md-view-presentation.ts).
export function PapelizNoteFrontmatterPropertyChips({ noteFrontmatterProperties }: PapelizNoteFrontmatterPropertyChipsProps) {
  return (
    <ul className="papeliz-md-view-properties" aria-label="Note properties">
      {noteFrontmatterProperties.map((noteFrontmatterProperty) => {
        const FrontmatterPropertyIcon = getFrontmatterPropertyIcon(noteFrontmatterProperty.frontmatterPropertyName)
        return (
          <li key={noteFrontmatterProperty.frontmatterPropertyName} className="papeliz-md-view-property">
            <FrontmatterPropertyIcon className="size-3.5 flex-none" aria-hidden="true" />
            <b>{noteFrontmatterProperty.frontmatterPropertyName}</b>
            <span>{noteFrontmatterProperty.frontmatterPropertyValues.join(', ')}</span>
          </li>
        )
      })}
    </ul>
  )
}

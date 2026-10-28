// Reads the simple YAML that notes keep at the top (their frontmatter) into name/value pairs for
// the MD View's property chips. It understands the common shapes:
//   key: value        key: [one, two]        key:
//                                              - one
//                                              - two
// Anything more complex is shown as its raw text. The note itself is never changed.

export interface PapelizNoteFrontmatterProperty {
  frontmatterPropertyName: string
  frontmatterPropertyValues: string[]
}

const papelizFrontmatterTopLevelLinePattern = /^([^\s#:][^:]*):(?:\s+(.*)|\s*)$/
const papelizFrontmatterListItemLinePattern = /^\s+-\s*(.*)$/

function unquoteFrontmatterValue(frontmatterValueText: string): string {
  const trimmedValueText = frontmatterValueText.trim()
  if (trimmedValueText.length >= 2) {
    const firstCharacter = trimmedValueText[0]
    const lastCharacter = trimmedValueText[trimmedValueText.length - 1]
    if ((firstCharacter === '"' || firstCharacter === "'") && firstCharacter === lastCharacter) return trimmedValueText.slice(1, -1)
  }
  return trimmedValueText
}

function readInlineFrontmatterValues(frontmatterValueText: string): string[] {
  const trimmedValueText = frontmatterValueText.trim()
  if (trimmedValueText.startsWith('[') && trimmedValueText.endsWith(']')) {
    return trimmedValueText
      .slice(1, -1)
      .split(',')
      .map(unquoteFrontmatterValue)
      .filter((frontmatterValue) => frontmatterValue.length > 0)
  }
  const unquotedValue = unquoteFrontmatterValue(trimmedValueText)
  return unquotedValue.length > 0 ? [unquotedValue] : []
}

export function readPapelizNoteFrontmatterProperties(frontmatterText: string): PapelizNoteFrontmatterProperty[] {
  const frontmatterProperties: PapelizNoteFrontmatterProperty[] = []
  let currentFrontmatterProperty: PapelizNoteFrontmatterProperty | null = null
  for (const frontmatterLine of frontmatterText.split(/\r?\n/)) {
    if (frontmatterLine.trim().length === 0 || frontmatterLine.trimStart().startsWith('#')) continue
    const topLevelLineMatch = papelizFrontmatterTopLevelLinePattern.exec(frontmatterLine)
    if (topLevelLineMatch) {
      currentFrontmatterProperty = {
        frontmatterPropertyName: (topLevelLineMatch[1] ?? '').trim(),
        frontmatterPropertyValues: readInlineFrontmatterValues(topLevelLineMatch[2] ?? ''),
      }
      frontmatterProperties.push(currentFrontmatterProperty)
      continue
    }
    if (currentFrontmatterProperty === null) continue
    const listItemLineMatch = papelizFrontmatterListItemLinePattern.exec(frontmatterLine)
    const nestedValueText = listItemLineMatch ? unquoteFrontmatterValue(listItemLineMatch[1] ?? '') : frontmatterLine.trim()
    if (nestedValueText.length > 0) currentFrontmatterProperty.frontmatterPropertyValues.push(nestedValueText)
  }
  return frontmatterProperties
}

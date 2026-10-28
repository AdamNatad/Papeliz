import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PapelizLegalDocument, PapelizLegalDocumentSection } from '@/components/legal/papeliz-legal-document'
import { papelizSiteGitHubRepositoryUrl } from '@/lib/papeliz-site-config'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'MIT License',
  papelizSitePageDescription: 'Papeliz is open source under the MIT License.',
  papelizSitePagePath: '/license/',
})

// Read at build time from the repository's root LICENSE, so this page never drifts from it.
// `next build` runs in site/main/. The file's hard line breaks are joined so paragraphs reflow on
// narrow screens.
const papelizRepositoryLicenseParagraphs = readFileSync(path.join(process.cwd(), '..', '..', 'LICENSE'), 'utf8')
  .trim()
  .split(/\r?\n\s*\r?\n/)
  .map((papelizRepositoryLicenseParagraph) => papelizRepositoryLicenseParagraph.replace(/\s*\r?\n\s*/g, ' '))

export default function PapelizSiteLicensePage() {
  return (
    <PapelizLegalDocument
      papelizLegalDocumentHeading="MIT License"
      papelizLegalDocumentLead={
        <p>
          Papeliz is open source. You may use, copy, change, merge, publish, distribute, sublicense and
          sell it, as long as the copyright notice and this permission notice stay with it.
        </p>
      }
    >
      <PapelizLegalDocumentSection papelizLegalSectionTitle="The license text">
        <div className="space-y-4 rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-5 font-mono text-[13px] leading-relaxed text-papeliz-ink sm:p-6">
          {papelizRepositoryLicenseParagraphs.map((papelizRepositoryLicenseParagraph) => (
            <p key={papelizRepositoryLicenseParagraph}>{papelizRepositoryLicenseParagraph}</p>
          ))}
        </div>
        {papelizSiteGitHubRepositoryUrl && (
          <p>
            The same text is in the{' '}
            <a href={`${papelizSiteGitHubRepositoryUrl}/blob/main/LICENSE`} className="font-medium text-papeliz-blue hover:underline">
              LICENSE file on GitHub
            </a>
            .
          </p>
        )}
      </PapelizLegalDocumentSection>

      <PapelizLegalDocumentSection papelizLegalSectionTitle="Open-source libraries">
        <p>
          Papeliz is built with open-source libraries, each under its own license. They are credited
          in the project’s README.
        </p>
      </PapelizLegalDocumentSection>
    </PapelizLegalDocument>
  )
}

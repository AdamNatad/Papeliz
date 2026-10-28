import { PapelizSiteGitHubMark } from '@/components/logo/papeliz-site-channel-marks'
import { papelizSiteGitHubRepositoryUrl } from '@/lib/papeliz-site-config'

const papelizSiteGitHubIconButtonClassName =
  'grid size-[34px] flex-none place-items-center rounded-full text-white/90 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/15 hover:text-white'

// The header's GitHub button, with the Accessibility button's size and hover. Until the repository
// exists it stays in place but is not a link, and its tooltip says so.
export function PapelizSiteGitHubIconButton() {
  if (!papelizSiteGitHubRepositoryUrl) {
    return (
      <span role="img" aria-label="Papeliz on GitHub: coming soon" title="Papeliz on GitHub: coming soon" className={papelizSiteGitHubIconButtonClassName}>
        <PapelizSiteGitHubMark className="size-[18px]" />
      </span>
    )
  }
  return (
    <a
      href={papelizSiteGitHubRepositoryUrl}
      aria-label="Papeliz on GitHub"
      title="Papeliz on GitHub"
      className={`${papelizSiteGitHubIconButtonClassName} focus-visible:outline-white active:scale-[.94]`}
    >
      <PapelizSiteGitHubMark className="size-[18px]" />
    </a>
  )
}

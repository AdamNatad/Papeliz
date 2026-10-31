// How the account page's lists say when something happened: "5 minutes ago", "yesterday", then a
// day ("on Oct 2", with the year when it isn't this year).

const papelizAccountRelativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function describePapelizAccountPastDay(pastTime: number, currentTime: number): string {
  const pastTimeIsThisYear = new Date(pastTime).getFullYear() === new Date(currentTime).getFullYear()
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: pastTimeIsThisYear ? undefined : 'numeric' }).format(pastTime)
}

export function describePapelizAccountTimeAgo(pastTime: number, currentTime: number): string {
  const minutesAgo = Math.round((currentTime - pastTime) / 60_000)
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return papelizAccountRelativeTimeFormat.format(-minutesAgo, 'minute')
  const hoursAgo = Math.round(minutesAgo / 60)
  if (hoursAgo < 24) return papelizAccountRelativeTimeFormat.format(-hoursAgo, 'hour')
  const daysAgo = Math.round(hoursAgo / 24)
  if (daysAgo < 30) return papelizAccountRelativeTimeFormat.format(-daysAgo, 'day')
  return `on ${describePapelizAccountPastDay(pastTime, currentTime)}`
}

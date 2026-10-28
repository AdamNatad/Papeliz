// Panulat's logo, for its row in the Adam Natad page's Apps list (Adam, 2026-10-28: the page kept as it is).
import * as React from "react";

type PapelizSiteAdamNatadPanulatLogoProps = Omit<React.SVGProps<SVGSVGElement>, "children"> & {
  alt?: string;
  title?: string;
  /** Draw only the pen tile, without the square behind it, for use on cream surfaces. */
  bare?: boolean;
};

export function PapelizSiteAdamNatadPanulatLogo({
  title = "Panulat logo",
  alt,
  role,
  bare = false,
  ...props
}: PapelizSiteAdamNatadPanulatLogoProps) {
  const id = React.useId().replace(/:/g, "");
  const label = props["aria-label"] ?? alt ?? title;
  const clipA = `panulat-logo-${id}-a`;
  const clipB = `panulat-logo-${id}-b`;
  const clipC = `panulat-logo-${id}-c`;
  const clipD = `panulat-logo-${id}-d`;
  const clipE = `panulat-logo-${id}-e`;
  const clipF = `panulat-logo-${id}-f`;
  const clipG = `panulat-logo-${id}-g`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={512}
      height={512}
      viewBox="0 0 384 384"
      role={role ?? "img"}
      aria-label={label}
      focusable="false"
      {...props}
    >
      <defs>
        <clipPath id={clipB}>
          <path d="M4.35 1h317.3v330H4.35Zm0 0" />
        </clipPath>
        <clipPath id={clipC}>
          <path d="M62.1 1h201.8a57.75 57.75 0 0 1 57.75 57.75v214.5A57.75 57.75 0 0 1 263.9 331H62.1a57.75 57.75 0 0 1-57.75-57.75V58.75A57.75 57.75 0 0 1 62.1 1m0 0" />
        </clipPath>
        <clipPath id={clipE}>
          <path d="M.35 0h317.3v330H.35Zm0 0" />
        </clipPath>
        <clipPath id={clipF}>
          <path d="M58.1 0h201.8a57.75 57.75 0 0 1 57.75 57.75v214.5A57.75 57.75 0 0 1 259.9 330H58.1A57.75 57.75 0 0 1 .35 272.25V57.75A57.75 57.75 0 0 1 58.1 0m0 0" />
        </clipPath>
        <clipPath id={clipD}>
          <path d="M0 0h318v330H0z" />
        </clipPath>
        <clipPath id={clipG}>
          <path d="M104 282h117v48.7H104Zm0 0" />
        </clipPath>
        <clipPath id={clipA}>
          <path d="M0 0h327v333H0z" />
        </clipPath>
      </defs>
      {bare ? null : <path fill="#fff" d="M-38.4-38.4h460.8v460.8H-38.4z" />}
      {bare ? null : <path fill="#f6e3c3" d="M-38.4-38.4h460.8v460.8H-38.4z" />}
      <g clipPath={`url(#${clipA})`} transform="translate(29 26)">
        <g clipPath={`url(#${clipB})`}>
          <g clipPath={`url(#${clipC})`}>
            <g clipPath={`url(#${clipD})`} transform="translate(4 1)">
              <g clipPath={`url(#${clipE})`}>
                <g clipPath={`url(#${clipF})`}>
                  <path fill="#aa794a" d="M.35 0h317.3v329.7H.35Zm0 0" />
                </g>
              </g>
            </g>
          </g>
        </g>
        <path fill="#7db8a3" d="M214 283H110.5l1.01-9.1h101.46Zm0 0" />
        <path
          fill="#382215"
          d="M109.11 247.95H215.4a13.3 13.3 0 0 1 9.33 3.86 14 14 0 0 1 2.86 4.28 13 13 0 0 1 1 5.05 13.3 13.3 0 0 1-5.86 10.97 13.3 13.3 0 0 1-7.33 2.22H109.1a13.2 13.2 0 0 1-13.19-13.19 13.3 13.3 0 0 1 5.87-10.97 13.3 13.3 0 0 1 7.32-2.22m0 0"
        />
        <g clipPath={`url(#${clipG})`}>
          <path fill="#382215" d="M220.3 330.93H104.21l6.3-47.94H214Zm0 0" />
        </g>
        <path
          fill="#fff5e6"
          d="m77.1 159.59.03-.19c.03-.19.04-.16.1-.39.02-.07.48-.8.48-.8l71.33-135.7.04-.07.05-.13.02-.08.01-.06.01-.04v-.05l.01-.04v-.19l-.01-.02v-.01c-.48-.87-1.2-2.7-1.2-4.86 0-5.7 4.6-10.39 10.2-10.39v10.4l-.03 4.8h.02V139.5q-.01.4-.17.83A14.8 14.8 0 0 0 147 154.6c0 8.17 6.7 14.78 14.95 14.78h.49l.58 78.57s-7.64.02-17.04 0h-33.6l-.42-3.7-.23-1.63c-1.82-10.98-10.7-37.28-10.7-37.28l-4.23-9.92-1.93-4.4-9.32-17.26-4.26-7.16-3.32-4.67-.13-.19-.16-.22-.08-.13-.13-.22-.08-.15-.08-.16-.07-.19-.06-.17-.02-.06-.04-.18-.03-.25-.01-.18zm0 0"
        />
        <path
          fill="#7db8a3"
          d="M145.52 52.72 89.5 158.62l-.28.98.16.67 1.24 1.57 4.92 7.8 3.24 5.8 4.17 7.98 4.01 7.95 2.85 7 3.86 10.35 2.97 8.89 3.62 13.05c.08-1.02-2.88-22.19-2.88-22.19l-3.94-15.6-2.93-9.06-5.63-12.33-6.02-10.82-.3-.97-.06-.68.06-.73.1-.8.24-.76.82-1.82 4.4-8.92 40.13-89.16 1.6-3.86.59-1.42Zm0 0"
        />
        <path
          fill="#f3e3c9"
          d="m247.41 159.59-.03-.19c-.03-.19-.04-.16-.1-.39-.02-.07-.48-.8-.48-.8L175.46 22.5l-.03-.07-.05-.13-.04-.14v-.09l-.01-.04v-.19l.01-.03c.48-.88 1.2-2.7 1.2-4.86 0-5.7-4.6-10.4-10.2-10.4v10.4l.03 4.8h-.03V139.5q0 .4.18.83a14.8 14.8 0 0 1 10.99 14.26 14.87 14.87 0 0 1-15.44 14.77l-.58 78.57s7.63.02 17.04 0l33.6.01.42-3.7.23-1.63c1.81-10.98 10.69-37.28 10.69-37.28l4.23-9.92 1.94-4.41 9.32-17.25 4.26-7.17 3.32-4.67.13-.18.15-.22.09-.13.13-.22.08-.15.08-.16.07-.19.06-.17.02-.06.04-.19.03-.24.01-.18zm0 0"
        />
        <path
          fill="#7db8a3"
          d="m178.98 52.72 56.04 105.9.27.98-.15.67-1.24 1.57-4.92 7.8-3.24 5.8-4.17 7.98-4.02 7.95-2.84 7-3.87 10.35-2.96 8.89-3.63 13.05c-.07-1.02 2.9-22.19 2.9-22.19l3.94-15.6 2.93-9.06 5.62-12.33 6.02-10.82.3-.97.06-.68-.07-.73-.09-.8-.25-.76-.81-1.82-4.4-8.92-40.13-89.16-1.6-3.86-.6-1.42Zm0 0"
        />
      </g>
    </svg>
  );
}

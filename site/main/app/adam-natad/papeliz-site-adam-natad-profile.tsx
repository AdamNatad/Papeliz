"use client";

// Adam Natad's profile, kept as it is on his other site and recoloured in Papeliz blue (Adam, 2026-10-28:
// "follow our Adam Natad page ... as is and just change color"). It names his other apps and companies by design.

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PapelizMark } from "@/components/logo/papeliz-mark";
import { PapelizSiteIntroducingBadge } from "@/components/marketing/papeliz-site-introducing-badge";
import { PapelizSiteAdamNatadLightbox } from "./papeliz-site-adam-natad-lightbox";
import { PapelizSiteAdamNatadPanulatLogo } from "./papeliz-site-adam-natad-panulat-logo";
import adamNatadProfileStyles from "./papeliz-site-adam-natad-profile.module.css";
import {
  FaAmazon,
  FaEllipsis,
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
  FaRedditAlien,
  FaSpotify,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { SiRakuten } from "react-icons/si";
import {
  Archive,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CodeXml,
  ExternalLink,
  History,
  Library,
  Swords,
} from "lucide-react";

export type AdamNatadProfileConfig = {
  images: {
    adam1: string;
    adam2: string;
    nbdbCor: string;
  };

  external: {
    panulat: string;
    fortifyte: string;
    harvestmare: string;
    openshinobi: string;
    flovade: string;
    papeliz: string;
    natadCorporationWebsite: string;
    natadTechSolutionsWebsite: string;
    cloudflareForStartups: string;
    personal: string;
    facebook: string;
    youtube: string;
    xProfile: string;
    instagramProfile: string;
    redditProfile: string;
    tiktokProfile: string;
    spotifyArtist: string;
    nbdb: string;
    nlp: string;

    githubVideoRecoveryCLI: string;
    videoRecoveryCLIReleases: string;

    pageSizerMarketplace: string;
    pageSizerGithub: string;

    booksAmazon: string;
    booksApple: string;
    booksKobo: string;

    orcid: string;
    linkedin: string;
    github: string;
    steamDev: string;
  };
};

type AdamNatadProfileLinkRow = {
  label: string;
  description: string;
  href: string;
};

type AdamNatadProfileTimelineEntry = {
  /** Date and age, as Adam wrote them, e.g. "2006–2010 · Ages 9–12". */
  period: string;
  /** Text, or text with links (the company names in the 2024 and 2026 entries). */
  paragraphs: ReactNode[];
};

type AdamNatadProfileEarlierProduct = {
  name: string;
  description: string;
};

const ADAM_NATAD_PROFILE_WHASOLUTIONS_PRODUCTS: AdamNatadProfileEarlierProduct[] = [
  { name: "WhaFoods", description: "WhatsApp Food Delivery with GeoFencing Solution" },
  { name: "WhaSalon", description: "WhatsApp Salon & Spa Booking Solution" },
  { name: "WhaLaundry", description: "WhatsApp Laundry Delivery & Pickup Solution" },
  { name: "WhaCourier", description: "WhatsApp Package Delivery with GeoFencing Solution" },
  { name: "WhaClinic", description: "WhatsApp Clinic Appointment Scheduling Solution" },
  { name: "WhaShop", description: "WhatsApp Catalog & Order Management Solution" },
  { name: "WhaBookings", description: "WhatsApp Events, Hotels and Services Bookings Solution" },
];

const ADAM_NATAD_PROFILE_NT_SOLUTIONS_PRODUCTS: AdamNatadProfileEarlierProduct[] = [
  { name: "FoodMonkey", description: "Food delivery platform" },
  { name: "OrderXpress", description: "Ride-hailing solution" },
  { name: "LendSys", description: "Loan management system" },
  { name: "UltiStore", description: "E-commerce platform" },
  { name: "ServiceXpress", description: "On-demand services booking app" },
  { name: "BrandBites", description: "Branded food delivery system" },
  { name: "BrandVault", description: "Customizable online store solution" },
  { name: "NCash", description: "Mobile wallet platform" },
];

type AdamNatadProfileOlderSoftware = {
  years: string;
  name: string;
};

// Adam's older software (2026-10-28), oldest first.
const ADAM_NATAD_PROFILE_OLDER_SOFTWARE: AdamNatadProfileOlderSoftware[] = [
  { years: "2015–2019", name: "iSCSI Diskless Boot Software" },
  { years: "2016", name: "Game Menu Launchers" },
  { years: "2017", name: "Traffic Shaper" },
];

function isAdamNatadProfileExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

function AdamNatadProfileSectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-papeliz-blue">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-[clamp(1.25rem,7cqi,1.5rem)] font-semibold tracking-tight text-papeliz-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-papeliz-ink-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

// Whole class names, so Tailwind finds them: each keeps text on one line from a container width.
const ADAM_NATAD_PROFILE_KEEP_ON_ONE_LINE_CLASSES = {
  "10.5rem": "@min-[10.5rem]:whitespace-nowrap",
  "14.5rem": "@min-[14.5rem]:whitespace-nowrap",
  "15rem": "@min-[15rem]:whitespace-nowrap",
} as const;

/** A text link whose underline slides in from the left on hover, as the footer's links do. */
function AdamNatadProfileInlineLink({
  href,
  children,
  surface = "onCard",
  keepOnOneLineFromContainerWidth,
}: {
  href: string;
  children: ReactNode;
  /** onCard: Papeliz blue; onCardInk: bold ink, to highlight a name in running text; onCloudflareOrange: white. */
  surface?: "onCard" | "onCardInk" | "onCloudflareOrange";
  /**
   * Keep a name such as a company name on one line (Adam, 2026-10-13), but only once the nearest container is at least
   * this wide, about the name's own width: in a narrower column it wraps rather than running out of its card.
   */
  keepOnOneLineFromContainerWidth?: keyof typeof ADAM_NATAD_PROFILE_KEEP_ON_ONE_LINE_CLASSES;
}) {
  const surfaceClass = {
    onCard: adamNatadProfileStyles.adamNatadProfileInlineLinkOnCard,
    onCardInk: adamNatadProfileStyles.adamNatadProfileInlineLinkOnCardInk,
    onCloudflareOrange: adamNatadProfileStyles.adamNatadProfileInlineLinkOnCloudflareOrange,
  }[surface];
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${adamNatadProfileStyles.adamNatadProfileInlineLink} ${surfaceClass}${keepOnOneLineFromContainerWidth ? ` ${ADAM_NATAD_PROFILE_KEEP_ON_ONE_LINE_CLASSES[keepOnOneLineFromContainerWidth]}` : ""}`}
    >
      {children}
    </a>
  );
}

/** One row of a link list, as on the Press page: label, a quiet line under it, an arrow at the end. */
function AdamNatadProfileLinkRowItem({ row }: { row: AdamNatadProfileLinkRow }) {
  const external = isAdamNatadProfileExternalHref(row.href);
  const className =
    "group flex items-center justify-between gap-4 border-b border-papeliz-line py-4 text-left hover:text-papeliz-blue";
  const content = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-papeliz-ink group-hover:text-papeliz-blue">
          {row.label}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-papeliz-ink-muted">{row.description}</span>
      </span>
      {external ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-papeliz-blue transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 text-papeliz-blue transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  if (external) {
    return (
      <a href={row.href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={row.href} className={className}>
      {content}
    </Link>
  );
}

function AdamNatadProfileLinkList({ rows }: { rows: AdamNatadProfileLinkRow[] }) {
  return (
    <div className="grid [&>*:last-child]:border-b-0">
      {rows.map((row) => (
        <AdamNatadProfileLinkRowItem key={row.href} row={row} />
      ))}
    </div>
  );
}

// A bordered list panel, as Apps and Games use (Adam, 2026-10-14): rows divided by a soft line, filling their column.
// Side by side, two panels match heights and share their rows out evenly (the section passes its `auto-rows-fr`).
const ADAM_NATAD_PROFILE_LIST_PANEL_CLASS =
  "grid flex-1 divide-y divide-papeliz-line overflow-hidden rounded-lg border border-papeliz-line-strong bg-papeliz-surface";

/** One group of legacy software in its panel: each product's name, then its line beside it once the panel is wide. */
function AdamNatadProfileEarlierProductPanel({
  title,
  products,
}: {
  title: string;
  products: AdamNatadProfileEarlierProduct[];
}) {
  return (
    <div className="@container flex min-w-0 flex-col">
      <h3 className="mb-2.5 text-base font-semibold text-papeliz-ink">{title}</h3>
      <ul className={`${ADAM_NATAD_PROFILE_LIST_PANEL_CLASS} @min-[44rem]/adam-natad-legacy-software:auto-rows-fr`}>
        {products.map((product) => (
          <li
            key={product.name}
            className="grid content-center gap-0.5 px-4 py-3 @min-[26rem]:grid-cols-[7.5rem_minmax(0,1fr)] @min-[26rem]:items-baseline @min-[26rem]:gap-4"
          >
            <span className="text-sm font-semibold text-papeliz-ink">{product.name}</span>
            <span className="text-pretty text-sm leading-snug text-papeliz-ink-muted">{product.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Adam's older software in one panel: its years over its name, three across once the panel is wide. */
function AdamNatadProfileOlderSoftwarePanel({ items }: { items: AdamNatadProfileOlderSoftware[] }) {
  return (
    <div className="@container min-w-0">
      <h3 className="mb-2.5 text-base font-semibold text-papeliz-ink">Older software</h3>
      <ol className="grid divide-y divide-papeliz-line overflow-hidden rounded-lg border border-papeliz-line-strong bg-papeliz-surface @min-[36rem]:grid-cols-3 @min-[36rem]:divide-x @min-[36rem]:divide-y-0">
        {items.map((item) => (
          <li key={item.name} className="px-4 py-3.5">
            <span className="block text-xs font-semibold tabular-nums tracking-wide text-papeliz-blue">{item.years}</span>
            <span className="mt-1 block text-[15px] font-semibold leading-snug text-papeliz-ink">{item.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A tile for a row that is not an app: a book store's mark or a registry's icon on its own colour. */
function AdamNatadProfileMarkTile({ background, children }: { background: string; children: ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] @min-[20rem]:h-11 @min-[20rem]:w-11"
      style={{ background }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

type AdamNatadProfilePanelLink = {
  name: string;
  description: string;
  href: string;
  tile: ReactNode;
};

/** A linked row in a list panel, as an app's row is: tile, name, one line, and the warm tan tint on hover. */
function AdamNatadProfilePanelLinkRow({ link }: { link: AdamNatadProfilePanelLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-3.5 transition-colors duration-150 hover:bg-papeliz-blue-soft focus-visible:bg-papeliz-blue-soft active:bg-papeliz-blue-soft-hover @min-[20rem]:gap-4 @min-[20rem]:px-4"
    >
      {link.tile}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-papeliz-ink">{link.name}</span>
        <span className="mt-1 block text-pretty text-sm leading-snug text-papeliz-ink-muted">{link.description}</span>
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A titled list panel of linked rows (the book stores and the registries, side by side in Authorship). */
function AdamNatadProfilePanelLinkList({ title, links }: { title: string; links: AdamNatadProfilePanelLink[] }) {
  return (
    <div className="@container flex min-w-0 flex-col">
      <h3 className="mb-2.5 text-base font-semibold text-papeliz-ink">{title}</h3>
      <div className={`${ADAM_NATAD_PROFILE_LIST_PANEL_CLASS} @min-[40rem]/adam-natad-authorship:auto-rows-fr`}>
        {links.map((link) => (
          <AdamNatadProfilePanelLinkRow key={link.href} link={link} />
        ))}
      </div>
    </div>
  );
}

type AdamNatadProfileProductStatus = "available" | "inDevelopment";

type AdamNatadProfileProductIcon =
  | { kind: "panulatLogo" }
  | { kind: "papelizMark" }
  | { kind: "image"; src: string; background: string }
  | { kind: "letter"; letter: string; background: string };

type AdamNatadProfileProduct = {
  name: string;
  description: string;
  status: AdamNatadProfileProductStatus;
  /** Only for a product with a live site. */
  href?: string;
  icon: AdamNatadProfileProductIcon;
};

type AdamNatadProfileProductGroup = {
  title: string;
  items: AdamNatadProfileProduct[];
};

// Status badges: a soft tint with a dot in the status's own colour, beside the name (Adam, 2026-10-14: everything but
// Panulat is In Development, in blue).
const ADAM_NATAD_PROFILE_PRODUCT_STATUS: Record<
  AdamNatadProfileProductStatus,
  { label: string; shortLabel: string; badgeClassName: string; dotClassName: string }
> = {
  available: {
    label: "Available",
    shortLabel: "Available",
    badgeClassName: "bg-[#E3F3E6] text-[#1D6431]",
    dotClassName: "bg-[#2E9E4F]",
  },
  inDevelopment: {
    label: "In Development",
    shortLabel: "In Dev",
    badgeClassName: "bg-[#E4EEFC] text-[#1D4F91]",
    dotClassName: "bg-[#3B7DD8]",
  },
};

function AdamNatadProfileProductStatusBadge({
  status,
  className = "",
}: {
  status: AdamNatadProfileProductStatus;
  className?: string;
}) {
  const statusStyle = ADAM_NATAD_PROFILE_PRODUCT_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11.5px] font-semibold leading-none ${statusStyle.badgeClassName} ${className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusStyle.dotClassName}`} />
      {/* The full label once the column fits it beside the name, the short one on a narrow column (Adam, 2026-10-14:
          "In Dev"); screen readers always hear the full label. */}
      <span className="hidden @min-[20rem]:inline">{statusStyle.label}</span>
      <span aria-hidden="true" className="@min-[20rem]:hidden">
        {statusStyle.shortLabel}
      </span>
      <span className="sr-only @min-[20rem]:hidden">{statusStyle.label}</span>
    </span>
  );
}

function AdamNatadProfileProductIconTile({ icon }: { icon: AdamNatadProfileProductIcon }) {
  const tileClass =
    "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl @min-[20rem]:h-11 @min-[20rem]:w-11";
  if (icon.kind === "panulatLogo") {
    return (
      <span className={tileClass}>
        <PapelizSiteAdamNatadPanulatLogo width={44} height={44} className="h-full w-full" aria-hidden="true" />
      </span>
    );
  }
  if (icon.kind === "papelizMark") {
    return (
      <span className={`${tileClass} bg-papeliz-topbar`}>
        <PapelizMark size={30} papelizMarkTone="on-blue" />
      </span>
    );
  }
  if (icon.kind === "image") {
    return (
      <span className={`${tileClass} ring-1 ring-black/10`} style={{ backgroundColor: icon.background }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon.src} alt="" width={44} height={44} className="h-full w-full object-cover" decoding="async" />
      </span>
    );
  }
  return (
    <span
      className={`${tileClass} text-lg font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
      style={{ background: icon.background }}
      aria-hidden="true"
    >
      {icon.letter}
    </span>
  );
}

/**
 * One app or game in its group's panel: icon, then the name with its status badge beside it (wrapping under the name on a
 * narrow column), then one line. Every row links to its site (the domains are Adam's) and takes a warm tan tint on hover,
 * without an arrow (Adam, 2026-10-14).
 */
function AdamNatadProfileProductRow({ product }: { product: AdamNatadProfileProduct }) {
  const rowClass = "flex items-center gap-3 px-3 py-3.5 @min-[20rem]:gap-4 @min-[20rem]:px-4";
  const content = (
    <>
      <AdamNatadProfileProductIconTile icon={product.icon} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold leading-snug text-papeliz-ink">
            {product.name}
          </span>
          <AdamNatadProfileProductStatusBadge status={product.status} />
        </span>
        <span className="mt-1 block text-pretty text-sm leading-snug text-papeliz-ink-muted">
          {product.description}
        </span>
      </span>
    </>
  );
  if (!product.href) {
    return <div className={rowClass}>{content}</div>;
  }
  // Hover and keyboard focus tint the row the site's warm tan, text unchanged (Adam, 2026-10-14: picked over the darker
  // espresso); pressed is the tan x0.94.
  const linkClass = `group ${rowClass} transition-colors duration-150 hover:bg-papeliz-blue-soft focus-visible:bg-papeliz-blue-soft active:bg-papeliz-blue-soft-hover`;
  // Every row opens in a new tab, Papeliz's own home page included, so the reader keeps this page (Adam, 2026-10-14).
  return (
    <a href={product.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {content}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// The timeline's gradient, oldest entry first: green for life at the start, then teal, sky, indigo and violet as the
// years run on (Adam, 2026-10-14). The same stops paint the line in adam-natad-profile.module.css; keep them in step.
const ADAM_NATAD_PROFILE_TIMELINE_GRADIENT_STOPS = ["#22C55E", "#14B8A6", "#0EA5E9", "#6366F1", "#8B5CF6"];

/** The colour at a point (0 to 1) along the timeline's gradient. */
function adamNatadProfileTimelineColorAt(position: number) {
  const stops = ADAM_NATAD_PROFILE_TIMELINE_GRADIENT_STOPS;
  const scaled = Math.min(Math.max(position, 0), 1) * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const mix = scaled - index;
  const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const from = channels(stops[index]);
  const to = channels(stops[index + 1]);
  return `#${from
    .map((channel, channelIndex) =>
      Math.round(channel + (to[channelIndex] - channel) * mix)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * The Personal Timeline: the gradient line draws down as the reader scrolls (to 60% of the viewport's height), each
 * dot lights up in its colour when the line reaches it, and entries fade up as they come into view. Everything shows
 * filled and still with reduced motion, and the content is all there before the script runs.
 */
function AdamNatadProfileTimeline({ entries }: { entries: AdamNatadProfileTimelineEntry[] }) {
  const timelineListRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const timelineList = timelineListRef.current;
    if (!timelineList) return;
    const items = [...timelineList.querySelectorAll<HTMLLIElement>("li[data-adam-natad-profile-timeline-item]")];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      const listBox = timelineList.getBoundingClientRect();
      const atPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const readingLine = viewportHeight * 0.6;
      const progress = reducedMotion.matches || atPageEnd
        ? 1
        : Math.min(Math.max((readingLine - listBox.top) / Math.max(listBox.height, 1), 0), 1);
      timelineList.style.setProperty("--adam-natad-profile-timeline-progress", progress.toFixed(4));
      timelineList.style.setProperty("--adam-natad-profile-timeline-tip-color", adamNatadProfileTimelineColorAt(progress));
      timelineList.dataset.adamNatadProfileTimelineDrawing = String(progress > 0 && progress < 1);
      for (const item of items) {
        const itemTop = item.getBoundingClientRect().top;
        item.dataset.adamNatadProfileTimelineReached = String(reducedMotion.matches || atPageEnd || itemTop + 10 <= readingLine);
        if (item.dataset.adamNatadProfileTimelineRevealed !== "true") {
          item.dataset.adamNatadProfileTimelineRevealed = String(reducedMotion.matches || itemTop < viewportHeight - 40);
        }
      }
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reducedMotion.addEventListener("change", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotion.removeEventListener("change", requestUpdate);
    };
  }, []);

  return (
    <ol ref={timelineListRef} className={`${adamNatadProfileStyles.adamNatadProfileTimeline} ml-2`}>
      <span aria-hidden="true" className={adamNatadProfileStyles.adamNatadProfileTimelineTrack}>
        <span className={adamNatadProfileStyles.adamNatadProfileTimelineGlow} />
        <span className={adamNatadProfileStyles.adamNatadProfileTimelineFill} />
        <span className={adamNatadProfileStyles.adamNatadProfileTimelineTip} />
      </span>
      {entries.map((entry, entryIndex) => (
        <li
          key={entry.period}
          data-adam-natad-profile-timeline-item=""
          className={adamNatadProfileStyles.adamNatadProfileTimelineItem}
          style={
            {
              "--adam-natad-profile-timeline-dot-color": adamNatadProfileTimelineColorAt(
                entries.length > 1 ? entryIndex / (entries.length - 1) : 0,
              ),
            } as CSSProperties
          }
        >
          <span aria-hidden="true" className={adamNatadProfileStyles.adamNatadProfileTimelineDot} />
          <div className={adamNatadProfileStyles.adamNatadProfileTimelineItemBody}>
            {/* Normal case: the labels carry real dates and ages, and the all-caps style read as AI-made. */}
            <h3 className="text-sm font-semibold leading-snug text-papeliz-blue">{entry.period}</h3>
            {entry.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="mt-1.5 text-pretty text-base leading-relaxed text-papeliz-ink">
                {paragraph}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

type AdamNatadProfileHeroSocialLink = {
  label: string;
  domain: string;
  href: string;
  /** The round button's fill (a brand colour or gradient); the avatar has none. */
  background?: string;
  icon: ReactNode;
};

// When each round link under the intro shows in the row rather than in the "…" menu: the row's width (a container
// query) must hold it, every link before it and the "…" button, at 48 px each with 12 px gaps (60 px a slot, so the
// k-th link needs (k + 2) × 60 − 12 px). From 648 px all eleven fit and the "…" button goes. Whole class names, so
// Tailwind finds them.
const ADAM_NATAD_PROFILE_HERO_SOCIAL_LINK_VISIBILITY = [
  { inRow: "inline-flex", inMenu: "hidden" },
  { inRow: "hidden @min-[168px]:inline-flex", inMenu: "flex @min-[168px]:hidden" },
  { inRow: "hidden @min-[228px]:inline-flex", inMenu: "flex @min-[228px]:hidden" },
  { inRow: "hidden @min-[288px]:inline-flex", inMenu: "flex @min-[288px]:hidden" },
  { inRow: "hidden @min-[348px]:inline-flex", inMenu: "flex @min-[348px]:hidden" },
  { inRow: "hidden @min-[408px]:inline-flex", inMenu: "flex @min-[408px]:hidden" },
  { inRow: "hidden @min-[468px]:inline-flex", inMenu: "flex @min-[468px]:hidden" },
  { inRow: "hidden @min-[528px]:inline-flex", inMenu: "flex @min-[528px]:hidden" },
  { inRow: "hidden @min-[588px]:inline-flex", inMenu: "flex @min-[588px]:hidden" },
  { inRow: "hidden @min-[648px]:inline-flex", inMenu: "flex @min-[648px]:hidden" },
  { inRow: "hidden @min-[648px]:inline-flex", inMenu: "flex @min-[648px]:hidden" },
] as const;

/**
 * The round links under the intro, as on adamnatad.com (Adam, 2026-10-14): his site (his avatar, no frame), then X,
 * LinkedIn, GitHub, YouTube, Instagram, Facebook, Reddit, TikTok, Spotify and Amazon in their brand colours. The row
 * uses the space it has; the links that do not fit wait in the "…" menu (name and domain): dark brown, opening right
 * under "…" with a pointer to it and kept inside the row's width; Esc, a click elsewhere or a resize closes it. Hover and
 * pressed darken each round link to x0.97 and x0.94 of its own colour.
 */
function AdamNatadProfileHeroSocialLinks({
  adamNatadProfileLinks,
}: {
  adamNatadProfileLinks: AdamNatadProfileConfig["external"];
}) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuPlacement, setMoreMenuPlacement] = useState<{ menuLeft: number; pointerLeft: number } | null>(null);
  const moreAreaRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLUListElement>(null);

  // Place the menu under "…": its right edge on the button's, moved left or right only as far as staying inside the
  // row's width needs, with the pointer over the button's centre.
  // A closed menu keeps its last place: the next opening measures again before it paints.
  useLayoutEffect(() => {
    if (!moreMenuOpen) return;
    const area = moreAreaRef.current;
    const button = moreButtonRef.current;
    const menu = moreMenuRef.current;
    if (!area || !button || !menu) return;
    const areaBox = area.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const buttonRight = buttonBox.right - areaBox.left;
    const buttonCentre = buttonBox.left + buttonBox.width / 2 - areaBox.left;
    const menuLeft = Math.min(Math.max(buttonRight - menuWidth, 0), Math.max(areaBox.width - menuWidth, 0));
    setMoreMenuPlacement({ menuLeft, pointerLeft: Math.min(Math.max(buttonCentre - menuLeft, 18), menuWidth - 18) });
  }, [moreMenuOpen]);

  const heroSocialLinks: AdamNatadProfileHeroSocialLink[] = [
    {
      label: "Personal Website",
      domain: "adamnatad.com",
      href: adamNatadProfileLinks.personal,
      icon: (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/adam-natad/adam-natad-website-icon.png"
          alt=""
          width={48}
          height={48}
          className="h-full w-full object-cover"
          decoding="async"
        />
      ),
    },
    { label: "X", domain: "x.com", href: adamNatadProfileLinks.xProfile, background: "#000000", icon: <FaXTwitter /> },
    { label: "LinkedIn", domain: "linkedin.com", href: adamNatadProfileLinks.linkedin, background: "#0A66C2", icon: <FaLinkedinIn /> },
    { label: "GitHub", domain: "github.com", href: adamNatadProfileLinks.github, background: "#24292F", icon: <FaGithub /> },
    { label: "YouTube", domain: "youtube.com", href: adamNatadProfileLinks.youtube, background: "#FF0000", icon: <FaYoutube /> },
    {
      label: "Instagram",
      domain: "instagram.com",
      href: adamNatadProfileLinks.instagramProfile,
      background: "linear-gradient(45deg, #F58529, #DD2A7B 45%, #8134AF 75%, #515BD4)",
      icon: <FaInstagram />,
    },
    { label: "Facebook", domain: "facebook.com", href: adamNatadProfileLinks.facebook, background: "#1877F2", icon: <FaFacebookF /> },
    { label: "Reddit", domain: "reddit.com", href: adamNatadProfileLinks.redditProfile, background: "#FF4500", icon: <FaRedditAlien /> },
    { label: "TikTok", domain: "tiktok.com", href: adamNatadProfileLinks.tiktokProfile, background: "#000000", icon: <FaTiktok /> },
    { label: "Spotify", domain: "open.spotify.com", href: adamNatadProfileLinks.spotifyArtist, background: "#1DB954", icon: <FaSpotify /> },
    { label: "Amazon", domain: "amazon.com", href: adamNatadProfileLinks.booksAmazon, background: "#FF9900", icon: <FaAmazon /> },
  ];

  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!moreAreaRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreMenuOpen(false);
      moreButtonRef.current?.focus();
    };
    const closeOnResize = () => setMoreMenuOpen(false);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [moreMenuOpen]);

  const roundLinkClass =
    "h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-sm ring-1 ring-black/10 transition-[filter,scale] duration-150 ease-out hover:brightness-[0.97] active:scale-[0.985] active:brightness-[0.94] [&_svg]:h-[21px] [&_svg]:w-[21px]";

  return (
    <div ref={moreAreaRef} className="@container relative">
      {/* Centred under the intro (Adam, 2026-10-14). */}
      <div className="flex items-center justify-center gap-3">
        {heroSocialLinks.map((heroSocialLink, heroSocialLinkIndex) => (
          <a
            key={heroSocialLink.label}
            href={heroSocialLink.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${heroSocialLink.label} (opens in a new tab)`}
            title={heroSocialLink.label}
            className={`${roundLinkClass} ${ADAM_NATAD_PROFILE_HERO_SOCIAL_LINK_VISIBILITY[heroSocialLinkIndex].inRow}`}
            style={heroSocialLink.background ? { background: heroSocialLink.background } : undefined}
          >
            {heroSocialLink.icon}
          </a>
        ))}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="More links"
          title="More links"
          aria-expanded={moreMenuOpen}
          aria-controls="adam-natad-profile-hero-more-links"
          onClick={() => setMoreMenuOpen((open) => !open)}
          className={`${roundLinkClass} inline-flex bg-papeliz-blue text-papeliz-on-blue! @min-[648px]:hidden ${moreMenuOpen ? "ring-2 ring-papeliz-blue-line" : ""}`}
        >
          <FaEllipsis />
        </button>
      </div>

      {moreMenuOpen ? (
        <ul
          ref={moreMenuRef}
          id="adam-natad-profile-hero-more-links"
          style={{ left: moreMenuPlacement?.menuLeft ?? 0, visibility: moreMenuPlacement ? "visible" : "hidden" }}
          className="papeliz-site-selection-on-color absolute top-full z-30 mt-3 w-64 max-w-full rounded-2xl bg-papeliz-topbar p-1.5 shadow-papeliz-pop ring-1 ring-white/10 transition-[opacity,translate] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
        >
          {/* The pointer up to "…". */}
          <span
            aria-hidden="true"
            className="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-papeliz-topbar ring-1 ring-white/10 [clip-path:polygon(0_0,100%_0,0_100%)]"
            style={{ left: moreMenuPlacement?.pointerLeft ?? 0 }}
          />
          {heroSocialLinks.map((heroSocialLink, heroSocialLinkIndex) => (
            <li key={heroSocialLink.label} className={ADAM_NATAD_PROFILE_HERO_SOCIAL_LINK_VISIBILITY[heroSocialLinkIndex].inMenu}>
              <a
                href={heroSocialLink.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMoreMenuOpen(false)}
                className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none active:bg-white/[0.14]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white ring-1 ring-white/15 transition-transform duration-150 ease-out group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transition-none [&_svg]:h-[18px] [&_svg]:w-[18px]"
                  style={heroSocialLink.background ? { background: heroSocialLink.background } : undefined}
                >
                  {heroSocialLink.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug text-white">{heroSocialLink.label}</span>
                  <span className="block truncate text-sm leading-snug text-white/75">{heroSocialLink.domain}</span>
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PapelizSiteAdamNatadProfile({ adamNatadProfileConfig }: { adamNatadProfileConfig: AdamNatadProfileConfig }) {
  const adamNatadProfileLinks = adamNatadProfileConfig.external;

  const quickFacts = [
    { label: "Date of birth", value: "September 1, 1997" },
    { label: "Hometown", value: "Don Juan Climaco Sr. (Magdugo), Toledo City, Cebu, Philippines" },
    { label: "Natad Corporation", value: "Founder and CEO" },
    { label: "NatadTech Solutions OPC", value: "Founder and President" },
  ];

  // Apps and games as a calm list (Adam, 2026-10-14: option C; no company named here, Panulat only one row since this is
  // its site; everything but Panulat In Development). Every item links to its own domain; flovade.com and
  // harvestmare.com are Adam's, not yet serving a site on 2026-10-14. Apps are Panulat, Papeliz, FloVade (Adam,
  // 2026-10-28); Papeliz is available at papeliz.com (Adam: "already available at its .com domain").
  const productAndGameGroups: AdamNatadProfileProductGroup[] = [
    {
      title: "Apps",
      items: [
        {
          name: "Panulat",
          description: "Book Creation Software with AI Assistant",
          status: "available",
          href: adamNatadProfileLinks.panulat,
          icon: { kind: "panulatLogo" },
        },
        {
          name: "Papeliz",
          description: "AI Markdown Editor",
          status: "available",
          href: "/",
          icon: { kind: "papelizMark" },
        },
        {
          name: "FloVade",
          description: "AI research and lead intelligence",
          status: "inDevelopment",
          href: adamNatadProfileLinks.flovade,
          icon: { kind: "letter", letter: "F", background: "linear-gradient(135deg, #0F3B46, #1F7A7F)" },
        },
      ],
    },
    {
      title: "Games",
      items: [
        {
          name: "OpenShinobi",
          description: "3D online ninja RPG",
          status: "inDevelopment",
          href: adamNatadProfileLinks.openshinobi,
          icon: { kind: "image", src: "/images/adam-natad/openshinobi-icon.png", background: "#FFFFFF" },
        },
        {
          name: "FortiFyte",
          // Non-breaking spaces keep "Unreal Engine 5" on one line.
          description: "Open-world game in Unreal\u00A0Engine\u00A05",
          status: "inDevelopment",
          href: adamNatadProfileLinks.fortifyte,
          icon: { kind: "image", src: "/images/adam-natad/fortifyte-icon.png", background: "#0B0B0D" },
        },
        {
          name: "Harvestmare",
          description: "Details coming soon",
          status: "inDevelopment",
          href: adamNatadProfileLinks.harvestmare,
          icon: { kind: "letter", letter: "H", background: "linear-gradient(135deg, #3E2716, #7A5233)" },
        },
      ],
    },
  ];

  // Where his books are, and who registers and catalogs them, as list panels like Apps and Games (Adam, 2026-10-28:
  // the section "feels outdated"). Each store's mark sits on its own colour.
  const bookStoreLinks: AdamNatadProfilePanelLink[] = [
    {
      name: "Amazon",
      description: "amazon.com/author/adam-natad",
      href: adamNatadProfileLinks.booksAmazon,
      tile: (
        <AdamNatadProfileMarkTile background="#232F3E">
          <FaAmazon className="h-5 w-5 text-[#FF9900]" />
        </AdamNatadProfileMarkTile>
      ),
    },
    {
      name: "Apple Books",
      description: "Apple Books author page",
      href: adamNatadProfileLinks.booksApple,
      tile: (
        <AdamNatadProfileMarkTile background="linear-gradient(180deg, #FFAE34, #FF7A00)">
          <BookOpen className="h-5 w-5 text-white" strokeWidth={2.25} />
        </AdamNatadProfileMarkTile>
      ),
    },
    {
      name: "Kobo",
      description: "Rakuten Kobo author page",
      href: adamNatadProfileLinks.booksKobo,
      tile: (
        <AdamNatadProfileMarkTile background="#BF0000">
          <SiRakuten className="h-5 w-5 text-white" />
        </AdamNatadProfileMarkTile>
      ),
    },
  ];
  const bookRegistryLinks: AdamNatadProfilePanelLink[] = [
    {
      name: "National Book Development Board",
      description: "Registered Author/Writer (NBDB)",
      href: adamNatadProfileLinks.nbdb,
      tile: (
        <AdamNatadProfileMarkTile background="var(--color-papeliz-blue-soft)">
          <BadgeCheck className="h-5 w-5 text-papeliz-blue" />
        </AdamNatadProfileMarkTile>
      ),
    },
    {
      name: "National Library of the Philippines",
      description: "Catalogs his works (NLP)",
      href: adamNatadProfileLinks.nlp,
      tile: (
        <AdamNatadProfileMarkTile background="var(--color-papeliz-blue-soft)">
          <Library className="h-5 w-5 text-papeliz-blue" />
        </AdamNatadProfileMarkTile>
      ),
    },
  ];

  // Only these three, in this order (Adam, 2026-10-28). Papeliz links its site.
  const openSourceProjects: {
    name: string;
    description: string;
    status?: AdamNatadProfileProductStatus;
    rows: AdamNatadProfileLinkRow[];
  }[] = [
    {
      name: "VideoRecoveryCLI",
      description:
        "Recovers corrupted .MP4 videos on Windows from the command line, with a working reference video, ffmpeg and recover_mp4.",
      rows: [
        { label: "GitHub", description: "AdamNatad/VideoRecoveryCLI", href: adamNatadProfileLinks.githubVideoRecoveryCLI },
        { label: "Releases", description: "The files it needs", href: adamNatadProfileLinks.videoRecoveryCLIReleases },
      ],
    },
    {
      name: "Page Sizer",
      description: "A Google Docs add-on that sets custom page sizes and margins beyond the default limits.",
      rows: [
        { label: "Google Workspace Marketplace", description: "Install the add-on", href: adamNatadProfileLinks.pageSizerMarketplace },
        { label: "GitHub", description: "AdamNatad/PageSizer", href: adamNatadProfileLinks.pageSizerGithub },
      ],
    },
    {
      name: "Papeliz",
      description: "An AI Markdown editor.",
      rows: [{ label: "Website", description: "papeliz.com", href: adamNatadProfileLinks.papeliz }],
    },
  ];


  // Adam's own Personal Timeline (2026-10-14), word for word.
  const timelineEntries: AdamNatadProfileTimelineEntry[] = [
    {
      period: "September 1997 · Birth",
      paragraphs: ["Born on September 1, 1997, in Don Juan Climaco Sr. (Magdugo), Toledo City, Cebu, Philippines."],
    },
    {
      period: "2006–2010 · Ages 9–12",
      paragraphs: [
        "Began exploring assembly language, memory manipulation, and reverse engineering. Built numerous custom game trainers using Cheat Engine 5.1, developed an enhanced fork of NTCore for Medal of Honor, and modified CWCheat and custom firmware for the PlayStation Portable (PSP). Also created modified Flash (SWF) files for online Facebook games, using Fiddler2 to intercept and replace game resources.",
      ],
    },
    {
      period: "2010–2013 · Ages 13–15",
      paragraphs: [
        "Developed multiple web applications and custom software solutions using HTML, JavaScript, and PHP. Experimented with software modification, customization, and repackaging installers. In 2012, began studying game development through Game Institute.",
      ],
    },
    {
      period: "2013–2016 · Ages 16–19",
      paragraphs: [
        "Designed and developed a custom PXE/iSCSI network boot infrastructure for enterprises, call centers, and internet cafés. Forked pfSense to build his own traffic-shaping system, incorporating VirtualBox virtualization, multi-WAN configurations, failover, WAN bonding, bandwidth management, and Quality of Service (QoS). Implemented TCP/UDP port-based traffic classification and prioritization to optimize network performance, VoIP communications, and bandwidth allocation.",
      ],
    },
    {
      period: "2016–2019 · Ages 19–21",
      paragraphs: [
        "Worked as a freelance developer, building web and desktop applications while conducting iSCSI training and technical seminars.",
      ],
    },
    {
      period: "January 2018 · Age 20",
      paragraphs: [
        "Designed, built, and operated a 100-GPU cryptocurrency mining infrastructure using NVIDIA GeForce GTX 1060 6GB graphics cards across nine mining rigs (seven 12-GPU and two 8-GPU configurations). Deployed a dedicated Linux-based mining operating system with centralized remote management, GPU monitoring, and configuration control.",
        "Implemented memory vendor-based workload allocation, assigning Samsung and Micron VRAM-equipped GPUs to Ethereum (ETH) mining using Ethash, while Hynix-equipped GPUs were dedicated to Zcash (ZEC) mining using Equihash. Managed mining configurations, hardware integration, and pool connectivity through Nanopool.",
      ],
    },
    {
      period: "2019–2023 · Ages 22–25",
      paragraphs: [
        "Expanded into mobile software development, building cross-platform applications and custom solutions using multiple frameworks and technologies.",
      ],
    },
    {
      period: "June 2024 · Age 26",
      paragraphs: [
        <>
          Incorporated{" "}
          <AdamNatadProfileInlineLink href={adamNatadProfileLinks.natadTechSolutionsWebsite} surface="onCardInk">
            NatadTech Solutions OPC
          </AdamNatadProfileInlineLink>{" "}
          in Cebu, Philippines on June 1 as its Founder and President.
        </>,
      ],
    },
    {
      period: "August 2026 · Age 28",
      paragraphs: [
        <>
          Incorporated{" "}
          <AdamNatadProfileInlineLink href={adamNatadProfileLinks.natadCorporationWebsite} surface="onCardInk">
            Natad Corporation
          </AdamNatadProfileInlineLink>{" "}
          in Delaware, United States of America on August 27 as its Founder and CEO.
        </>,
      ],
    },
  ];

  // The three links under the intro are peers, so they share one style: the site's blue button, hover and pressed
  // in the darker blue. Each leads with its site's own icon (Adam,
  // 2026-10-13: brown buttons, the brand icon on the left, no arrow on the right); the icons are copies of each site's
  // favicon in public/images.
  const companyWebsiteButtonBaseClass =
    "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-papeliz-blue px-5 text-base font-medium text-papeliz-on-blue transition-[background-color,scale] duration-150 ease-out hover:bg-papeliz-blue-hover active:scale-[0.985] active:bg-papeliz-blue-hover";
  // In a company card the button spans the card's full width (Adam, 2026-10-13).
  const companyWebsiteButtonClass = `${companyWebsiteButtonBaseClass} w-full`;
  // Each company card's website button, led by the site's own icon.
  const companyWebsiteLinks = [
    {
      label: "Natad Corporation",
      address: "natad.ai",
      href: adamNatadProfileLinks.natadCorporationWebsite,
      iconSrc: "/images/adam-natad/natad-corporation-icon.png",
    },
    {
      label: "NatadTech",
      address: "natadtech.com",
      href: adamNatadProfileLinks.natadTechSolutionsWebsite,
      iconSrc: "/images/adam-natad/natadtech-icon.png",
    },
  ];
  const [natadCorporationHeroLink, natadTechHeroLink] = companyWebsiteLinks;


  // Each company card ends with the same big button as the top ones (Adam, 2026-10-13), in place of a website line.
  const renderCompanyWebsiteButton = (companyHeroLink: (typeof companyWebsiteLinks)[number]) => (
    <a
      href={companyHeroLink.href}
      target="_blank"
      rel="noopener noreferrer"
      title={companyHeroLink.address}
      className={companyWebsiteButtonClass}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={companyHeroLink.iconSrc}
        alt=""
        width={22}
        height={22}
        className="h-[22px] w-[22px] shrink-0 rounded-[5px] bg-white object-cover"
        decoding="async"
      />
      {/* The label steps down with the button's own width (a container query on its wrapper): "Visit Official
          Website", then "Visit Site", then "Visit" (Adam, 2026-10-13). Screen readers hear the visible label plus the
          company's name. */}
      <span className="hidden whitespace-nowrap @min-[15.5rem]:inline">Visit Official Website</span>
      <span className="hidden whitespace-nowrap @min-[9.5rem]:inline @min-[15.5rem]:hidden">Visit Site</span>
      <span className="whitespace-nowrap @min-[9.5rem]:hidden">Visit</span>
      <span className="sr-only"> of {companyHeroLink.label} (opens in a new tab)</span>
    </a>
  );

  // Each section sits on a soft card, so text never sits straight on the page background; panels inside a card
  // are the page's own surface with the same soft border.
  const cardClass = "rounded-xl border border-papeliz-line bg-papeliz-surface-soft p-5 sm:p-8";
  const innerPanelClass = "rounded-lg border border-papeliz-line bg-papeliz-surface p-5 sm:p-6";

  // The two company cards (Adam, 2026-10-13): name, motto, a generic summary, then Role, Incorporated and Country as
  // labelled rows, so the role no longer sits as an all-caps label above the name.
  const companyCards = [
    {
      name: "Natad Corporation",
      motto: "Making Things Intelligent",
      summary: "An AI/SI Technology Company turning advanced intelligence into software people use every day.",
      facts: [
        { label: "Role", value: "Founder and CEO" },
        { label: "Incorporated", value: "August 27, 2026" },
        { label: "Location", value: "United States of America – Delaware" },
      ],
      heroLink: natadCorporationHeroLink,
    },
    {
      name: "NatadTech Solutions OPC",
      motto: "Making Things Simple",
      summary: "Apps, Games, and Tailored Solutions designed for specific problems.",
      facts: [
        { label: "Role", value: "Founder and President" },
        { label: "Incorporated", value: "June 1, 2024" },
        { label: "Location", value: "Cebu, Philippines" },
      ],
      heroLink: natadTechHeroLink,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 pb-16 sm:space-y-6 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-papeliz-blue [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-papeliz-blue">
      {/* Who he is */}
      {/* Three layouts by the card's own width (container queries; Adam, 2026-10-13/14): up to 28rem of card (about 520 px screens)
          a centred profile, the badge over the photo over the name, then the intro; from 28rem the photo floats right, scaling with the card, with the
          badge, name and the start of the intro beside it and the rest flowing full width under it; the name scales
          too (9cqi, 28 to 48 px); from 48rem the photo sits on the right beside all the text, once
          that column holds the three links in one row. The links fill their row. */}
      <section className={`${cardClass} @container`}>
        <div className="flex flex-col items-center gap-4 @min-[28rem]:flow-root @min-[48rem]:grid @min-[48rem]:grid-cols-[minmax(0,1fr)_13rem] @min-[48rem]:[grid-template-areas:'header_photo'_'body_photo'] @min-[54rem]:grid-cols-[minmax(0,1fr)_17rem] @min-[54rem]:gap-x-12">
          <div className="order-2 w-full max-w-[10rem] [grid-area:photo] @min-[28rem]:float-right @min-[28rem]:max-w-none @min-[28rem]:mb-3 @min-[28rem]:ml-4 @min-[28rem]:w-[clamp(6rem,30cqi,10rem)] @min-[30rem]:mb-4 @min-[30rem]:ml-6 @min-[48rem]:float-none @min-[48rem]:m-0 @min-[48rem]:w-full @min-[48rem]:max-w-none @min-[48rem]:self-center">
            {/* Opens in the page's lightbox on click (Adam, 2026-10-14); the wrapper keeps the photo's own rounding and
                tan edge on the viewer's thumbnail button. */}
            <div className="rounded-[1.6rem] [&_button]:rounded-[1.6rem] [&_button]:border-papeliz-line [&_button]:bg-papeliz-surface-gray">
              <PapelizSiteAdamNatadLightbox
                items={[{ src: adamNatadProfileConfig.images.adam1, alt: "Adam Natad" }]}
                lightboxTitle="Adam Natad"
                aspectClassName="aspect-[4/5]"
                fit="cover"
                sizes="(max-width: 768px) 40vw, 272px"
                showCaption={false}
              />
            </div>
          </div>

          <div className="contents min-w-0 [grid-area:header] @min-[28rem]:block @min-[28rem]:pt-1 @min-[30rem]:pt-2 @min-[48rem]:self-end @min-[48rem]:pt-0">
            <PapelizSiteIntroducingBadge className="order-1">Creator of Papeliz</PapelizSiteIntroducingBadge>
            <h1 className="order-3 text-center text-[clamp(1.75rem,9cqi,3rem)] font-bold leading-none tracking-tight text-papeliz-ink @min-[28rem]:mt-3 @min-[28rem]:text-left">
              Adam Natad
            </h1>
          </div>

          <div className="order-4 mt-1 w-full min-w-0 [grid-area:body] @min-[28rem]:mt-5 @min-[30rem]:mt-6 @min-[48rem]:mt-0 @min-[48rem]:self-start">
            {/* Games named beside the software, the books and the music (Adam, 2026-10-28: "where is Games?"). */}
            <p className="text-lg leading-relaxed text-papeliz-ink">
              <strong className="font-semibold text-papeliz-ink">Adam Natad</strong>{" "}
              (Jose Adam Climaco Natad) is a
              software and game developer, author, producer, and the creator of Papeliz. He is the Founder and CEO
              of{" "}
              <AdamNatadProfileInlineLink href={adamNatadProfileLinks.natadCorporationWebsite} keepOnOneLineFromContainerWidth="10.5rem">
                Natad Corporation
              </AdamNatadProfileInlineLink>
              , an AI/SI Technology Company, and the Founder and President of{" "}
              <AdamNatadProfileInlineLink href={adamNatadProfileLinks.natadTechSolutionsWebsite} keepOnOneLineFromContainerWidth="14.5rem">
                NatadTech Solutions OPC
              </AdamNatadProfileInlineLink>
              . He builds AI models, apps, and games, writes books, and produces music.
            </p>
            {/* Clears the floated photo on tablets. */}
            <div className="clear-both mt-7">
              <AdamNatadProfileHeroSocialLinks adamNatadProfileLinks={adamNatadProfileLinks} />
            </div>
          </div>
        </div>

        {/* At a glance */}
        <dl className="mt-8 grid grid-cols-1 gap-x-8 border-t border-papeliz-line sm:grid-cols-2 lg:grid-cols-[1fr_1.7fr_1fr_1.15fr]">
          {quickFacts.map((fact) => (
            <div
              key={fact.label}
              className="border-b border-papeliz-line py-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:pb-0"
            >
              <dt className="text-sm text-papeliz-ink-muted">{fact.label}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-papeliz-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Companies */}
      <section className={cardClass}>
        <AdamNatadProfileSectionHeading icon={<Building2 className="h-5 w-5" />} title="Companies" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5">
          {companyCards.map((companyCard) => (
            <article
              key={companyCard.name}
              className="flex flex-col rounded-lg border border-papeliz-line bg-papeliz-surface p-5 sm:p-7"
            >
              {/* 24 px, shrinking on narrow phones (to 14 px at 280 px) so "NatadTech Solutions OPC" stays on one row. */}
              <h3 className="whitespace-nowrap text-[clamp(0.875rem,5vw,1.5rem)] font-semibold leading-tight tracking-tight text-papeliz-ink">
                {companyCard.name}
              </h3>
              <p className="mt-1 text-sm font-medium italic leading-5 text-papeliz-blue">{companyCard.motto}</p>
              <p className="mt-4 text-base leading-relaxed text-papeliz-ink">{companyCard.summary}</p>
              {/* Label and value side by side when the card is wide enough for the longest pair; on a narrow card the
                  label sits above its value, so no value ever breaks onto two lines (a container query on the list). */}
              <dl className="@container mt-6 text-sm">
                {companyCard.facts.map((companyFact) => (
                  <div
                    key={companyFact.label}
                    className="flex flex-col gap-0.5 border-t border-papeliz-line py-3 @min-[16rem]:flex-row @min-[16rem]:items-baseline @min-[16rem]:justify-between @min-[16rem]:gap-4"
                  >
                    <dt className="text-papeliz-ink-muted">{companyFact.label}</dt>
                    <dd className="font-semibold text-papeliz-ink @min-[16rem]:text-right">{companyFact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="@container mt-auto pt-5">{renderCompanyWebsiteButton(companyCard.heroLink)}</div>
            </article>
          ))}
        </div>

        {/* Startup support (Adam, 2026-10-13): Cloudflare's orange one shade deeper (#C0560C) so white text keeps 4.5:1;
            the official logo (Cloudflare's press kit PNG; it has no SVG) sits on a white tile, as its black wordmark
            needs; normal-case labels, no icon chips. The layout follows the panel's own width (a container query):
            wide, one row (logo | heading and sentence | facts); medium, the facts stack in a right-hand column beside
            the logo and text, so no corner is left empty; narrow, everything stacks with the facts side by side. */}
        <div className="@container mt-4 lg:mt-5">
          <div className="papeliz-site-selection-on-color grid gap-5 rounded-lg bg-[#C0560C] p-5 text-white sm:p-6 @min-[32rem]:grid-cols-[minmax(0,1fr)_auto] @min-[32rem]:gap-x-8 @min-[56rem]:grid-cols-[auto_minmax(0,1fr)_auto] @min-[56rem]:items-center">
            <div className="flex w-full max-w-44 items-center justify-center rounded-md bg-white px-4 py-3 @min-[32rem]:col-start-1 @min-[32rem]:row-start-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/adam-natad/cloudflare-logo.png" alt="" width={512} height={173} className="h-auto w-full" decoding="async" />
            </div>
            <div className="min-w-0 @min-[32rem]:col-start-1 @min-[32rem]:row-start-2 @min-[56rem]:col-start-2 @min-[56rem]:row-start-1">
              <h3 className="text-lg font-semibold leading-snug">
                <AdamNatadProfileInlineLink
                  href={adamNatadProfileLinks.cloudflareForStartups}
                  surface="onCloudflareOrange"
                  keepOnOneLineFromContainerWidth="15rem"
                >
                  Cloudflare for Startups
                </AdamNatadProfileInlineLink>
              </h3>
              <p className="mt-1 text-base leading-relaxed text-white">
                Natad Corporation received $100,000 through the program.
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-10 gap-y-3 border-t border-white/30 pt-4 @min-[32rem]:col-start-2 @min-[32rem]:row-span-2 @min-[32rem]:row-start-1 @min-[32rem]:flex-col @min-[32rem]:flex-nowrap @min-[32rem]:justify-center @min-[32rem]:gap-y-4 @min-[32rem]:border-l @min-[32rem]:border-t-0 @min-[32rem]:pl-8 @min-[32rem]:pt-0 @min-[56rem]:col-start-3 @min-[56rem]:row-span-1 @min-[56rem]:flex-row @min-[56rem]:gap-x-10">
              <div>
                <dt className="text-sm font-medium text-white">Support</dt>
                <dd className="mt-0.5 whitespace-nowrap text-xl font-bold tracking-tight">$100,000</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-white">Joined</dt>
                <dd className="mt-0.5 whitespace-nowrap text-xl font-bold tracking-tight">August 13, 2026</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Apps and games */}
      <section className={`${cardClass} @container/adam-natad-apps-and-games`}>
        <AdamNatadProfileSectionHeading
          icon={<Swords className="h-5 w-5" />}
          title="Apps and Games"
          description="Apps that think, and worlds worth getting lost in."
        />
        {/* Side by side, every row and both panels share one height (Adam, 2026-10-14: unify the sizes): the panels
            stretch to the taller one and share it out in equal rows. Stacked, each row is as tall as its own text. */}
        <div className="mt-6 grid gap-x-6 gap-y-6 @min-[44rem]:grid-cols-2">
          {productAndGameGroups.map((productGroup) => (
            <div key={productGroup.title} className="@container flex min-w-0 flex-col">
              <h3 className="mb-2.5 text-base font-semibold text-papeliz-ink">{productGroup.title}</h3>
              <div className="grid flex-1 divide-y @min-[44rem]/adam-natad-apps-and-games:auto-rows-fr divide-papeliz-line overflow-hidden rounded-lg border border-papeliz-line-strong bg-papeliz-surface">
                {productGroup.items.map((product) => (
                  <AdamNatadProfileProductRow key={product.name} product={product} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Personal Timeline */}
      <section className={cardClass}>
        <AdamNatadProfileSectionHeading icon={<History className="h-5 w-5" />} title="Personal Timeline" />
        <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12">
          <AdamNatadProfileTimeline entries={timelineEntries} />
          {/* Stays in view beside the longer timeline on wide screens. */}
          <figure className="mx-auto w-full max-w-[14rem] lg:sticky lg:top-28 lg:mx-0 lg:self-start">
            <PapelizSiteAdamNatadLightbox
              items={[{ src: adamNatadProfileConfig.images.adam2, alt: "Adam Natad at his graduation" }]}
              lightboxTitle="Adam Natad"
              thumbMode="natural"
              fit="cover"
              showCaption={false}
            />          </figure>
        </div>
      </section>

      {/* Authorship: the two lines, then where the books are and who registers them, as list panels like Apps and
          Games, with the certificate beside them (Adam, 2026-10-28: "feels outdated"). */}
      <section className={`${cardClass} @container/adam-natad-authorship`}>
        <AdamNatadProfileSectionHeading
          icon={<BookOpen className="h-5 w-5" />}
          title="Authorship and technical publications"
          description="Educational and technical books, and fiction too"
        />
        <div className="mt-6 grid gap-8 @min-[52rem]/adam-natad-authorship:grid-cols-[minmax(0,1fr)_13rem] @min-[52rem]/adam-natad-authorship:gap-10">
          <div className="min-w-0">
            <div className="space-y-3 text-base leading-relaxed text-papeliz-ink">
              <p>
                Adam writes educational and technical books about Windows, Laravel, Flutter, and software
                development, and he writes fiction too.
              </p>
              <p>
                His books are on Amazon, Apple Books, Google Play Books, Rakuten Kobo, and other stores, with
                audiobook editions as well.
              </p>
            </div>
            <div className="mt-6 grid gap-6 @min-[40rem]/adam-natad-authorship:grid-cols-2">
              <AdamNatadProfilePanelLinkList title="Find his books" links={bookStoreLinks} />
              <AdamNatadProfilePanelLinkList title="Registered with" links={bookRegistryLinks} />
            </div>
          </div>
          <figure className="mx-auto w-full max-w-[13rem] @min-[52rem]/adam-natad-authorship:mx-0 @min-[52rem]/adam-natad-authorship:self-start">
            <PapelizSiteAdamNatadLightbox
              items={[{ src: adamNatadProfileConfig.images.nbdbCor, alt: "NBDB Certificate of Registration" }]}
              lightboxTitle="NBDB Certificate of Registration"
              thumbMode="natural"
              fit="contain"
              showCaption={false}
            />
            <figcaption className="mt-2 text-center text-xs text-papeliz-ink-muted">NBDB Certificate of Registration</figcaption>
          </figure>
        </div>
      </section>

      {/* Open source */}
      <section className={cardClass}>
        <AdamNatadProfileSectionHeading icon={<CodeXml className="h-5 w-5" />} title="Open-source projects" />
        <div className="mt-6 grid gap-4 md:grid-cols-3 lg:gap-5">
          {openSourceProjects.map((project) => (
            <article key={project.name} className={`${innerPanelClass} @container min-w-0`}>
              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-papeliz-ink">
                {project.name}
                {project.status ? <AdamNatadProfileProductStatusBadge status={project.status} /> : null}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-papeliz-ink">{project.description}</p>
              {project.rows.length > 0 ? (
                <div className="mt-2">
                  <AdamNatadProfileLinkList rows={project.rows} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* Legacy software */}
      <section className={`${cardClass} @container/adam-natad-legacy-software`}>
        <AdamNatadProfileSectionHeading
          icon={<Archive className="h-5 w-5" />}
          title="Legacy software"
          description="Earlier software projects"
        />
        {/* Older software first, oldest first, then the two product lines, in panels like Apps and Games (Adam,
            2026-10-28: "improve this", "add in my older software"). */}
        <div className="mt-6 space-y-6">
          <AdamNatadProfileOlderSoftwarePanel items={ADAM_NATAD_PROFILE_OLDER_SOFTWARE} />
          <div className="grid gap-6 @min-[44rem]/adam-natad-legacy-software:grid-cols-2">
            <AdamNatadProfileEarlierProductPanel title="WhaSolutions" products={ADAM_NATAD_PROFILE_WHASOLUTIONS_PRODUCTS} />
            <AdamNatadProfileEarlierProductPanel title="NT Solutions" products={ADAM_NATAD_PROFILE_NT_SOLUTIONS_PRODUCTS} />
          </div>
        </div>
      </section>

    </div>
  );
}

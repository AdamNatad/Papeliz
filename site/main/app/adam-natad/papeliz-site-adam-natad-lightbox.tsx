/**
 * The Adam Natad page's image viewer, in Papeliz colours.
 *
 * BASIC Viewer with optional natural thumbnails
 * - Single-image lightbox (NO slides / NO carousel)
 * - Click thumbnail -> the image opens large over a dimmed ink backdrop (Adam, 2026-10-14: no titled bar, no
 *   frame): rounded, shadowed, shown whole (object-contain), its name as a caption beneath, a round close button
 * - ESC, the close button or the backdrop closes; focus moves to the close button and back to the thumbnail
 * - It fades and scales in (@starting-style), still with reduced motion
 *
 * NEW:
 * - thumbMode: "fixed" (old aspectClassName box) OR "natural" (thumbnail keeps original ratio)
 */

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";

export type PapelizSiteAdamNatadLightboxImage = {
  src: string;
  alt: string;
};

// Keeps the page from scrolling behind the open image; nested viewers share one lock.
let papelizSiteAdamNatadLightboxScrollLockCount = 0;
let papelizSiteAdamNatadLightboxPreviousBodyOverflow = "";

function lockPapelizSiteAdamNatadLightboxBodyScroll() {
  if (papelizSiteAdamNatadLightboxScrollLockCount === 0) {
    papelizSiteAdamNatadLightboxPreviousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  papelizSiteAdamNatadLightboxScrollLockCount += 1;
  return () => {
    papelizSiteAdamNatadLightboxScrollLockCount = Math.max(0, papelizSiteAdamNatadLightboxScrollLockCount - 1);
    if (papelizSiteAdamNatadLightboxScrollLockCount === 0) {
      document.body.style.overflow = papelizSiteAdamNatadLightboxPreviousBodyOverflow;
    }
  };
}

export function PapelizSiteAdamNatadLightbox({
  items,
  aspectClassName = "aspect-[16/10]",
  sizes = "(max-width: 640px) 92vw, 720px",
  fit = "contain",
  className = "",
  showCaption = true,

  // NEW
  thumbMode = "fixed",
  lightboxTitle,
}: {
  items: PapelizSiteAdamNatadLightboxImage[];
  aspectClassName?: string;
  sizes?: string;
  fit?: "cover" | "contain";
  className?: string;
  showCaption?: boolean;
  thumbMode?: "fixed" | "natural";
  /** The caption under the opened image; without it the image's alt shows when showCaption is on, else none. */
  lightboxTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PapelizSiteAdamNatadLightboxImage | null>(null);

  const thumbObjectClass = fit === "contain" ? "object-contain bg-white" : "object-cover";

  const openedFromRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(false);
    setActive(null);
    openedFromRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const unlockScroll = lockPapelizSiteAdamNatadLightboxBodyScroll();
    closeButtonRef.current?.focus();
    return unlockScroll;
  }, [open]);

  const lightboxCaption = lightboxTitle ?? (showCaption && active?.alt ? active.alt : "");

  return (
    <>
      {/* Thumbnails */}
      <div
        className={[
          "w-full",
          "grid gap-3",
          items.length > 1 ? "grid-cols-2 sm:grid-cols-1" : "grid-cols-1",
          className,
        ].join(" ")}
      >
        {items.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={(event) => {
              openedFromRef.current = event.currentTarget;
              setActive(img);
              setOpen(true);
            }}
            className={[
              "group relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-papeliz-blue/35",
            ].join(" ")}
            aria-label={`Open image: ${img.alt}`}
            title={img.alt}
          >
            {/* ✅ Thumbnail mode switch */}
            {thumbMode === "natural" ? (
              <div className="relative w-full">
                {/* Use <img> so the thumbnail keeps the image’s natural aspect ratio */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className={[
                    "block w-full h-auto",
                    "bg-white",
                    fit === "cover" ? "object-cover" : "object-contain",
                  ].join(" ")}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              </div>
            ) : (
              <div className={["relative w-full", aspectClassName].join(" ")}>
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes={sizes}
                  className={thumbObjectClass}
                  draggable={false}
                  preload={i === 0}
                />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black">
                <ZoomIn className="h-3.5 w-3.5" />
                View
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox: only after a click, so always in the browser, where document.body exists. */}
      {open && active
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-label={lightboxCaption || active.alt || "Image"}
            >
              {/* Backdrop: Papeliz's ink, dimmed and softly blurred; a click closes. */}
              <button
                type="button"
                className="absolute inset-0 cursor-zoom-out bg-[#111112]/80 backdrop-blur-sm transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
                aria-label="Close image"
                tabIndex={-1}
                onClick={close}
              />

              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="absolute right-3 top-3 z-[2] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:top-5"
                aria-label="Close"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>

              <figure className="pointer-events-none relative z-[1] flex max-h-full max-w-full flex-col items-center transition-[opacity,scale] duration-300 ease-out starting:scale-[0.96] starting:opacity-0 motion-reduce:transition-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.src}
                  alt={active.alt}
                  className="pointer-events-auto block h-auto max-h-[calc(100dvh-7rem)] w-auto max-w-[min(92vw,72rem)] rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
                  decoding="async"
                />
                {lightboxCaption ? (
                  <figcaption className="mt-3 max-w-[min(92vw,72rem)] text-center text-sm font-medium text-white/90">
                    {lightboxCaption}
                  </figcaption>
                ) : null}
              </figure>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

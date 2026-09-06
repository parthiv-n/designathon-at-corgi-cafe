"use client";

import { useEffect, useRef, useState } from "react";

interface DestinationBackdropProps {
  src?: string;
}

const FADE_MS = 1_200;

/** Ask Unsplash for a crisp 16:9 crop instead of stretching its card image. */
function landscapeSource(src: string): string {
  try {
    const url = new URL(src);

    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", "2400");
      url.searchParams.set("h", "1350");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("crop", "entropy");
      url.searchParams.set("q", "85");
      url.searchParams.set("auto", "format");
    }

    return url.toString();
  } catch {
    return src;
  }
}

/**
 * Keeps the old destination visible until the next landscape is decoded, then
 * dissolves between them. The texture beneath remains the initial fallback.
 */
export function DestinationBackdrop({ src }: DestinationBackdropProps) {
  const [current, setCurrent] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src) return;

    const next = landscapeSource(src);
    if (next === currentRef.current) return;

    let cancelled = false;
    let revealFrame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      setPrevious(currentRef.current);
      setCurrent(next);
      setShowCurrent(false);
      currentRef.current = next;

      // Two frames guarantee the new layer paints at zero opacity first.
      revealFrame = requestAnimationFrame(() => {
        revealFrame = requestAnimationFrame(() => setShowCurrent(true));
      });
      settleTimer = setTimeout(() => setPrevious(null), FADE_MS);
    };

    image.src = next;

    return () => {
      cancelled = true;
      image.onload = null;
      cancelAnimationFrame(revealFrame);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [src]);

  return (
    <div className="destination-backdrop" aria-hidden="true">
      {previous ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`destination-backdrop-image is-previous${showCurrent ? " is-hidden" : ""}`}
          src={previous}
          alt=""
        />
      ) : null}
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`destination-backdrop-image is-current${showCurrent ? " is-visible" : ""}`}
          src={current}
          alt=""
        />
      ) : null}
      <div className="destination-backdrop-shade" />
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";
import { displayPhotoUrl } from "@/lib/vibeBoard";

/** How many empty slots to show before anything has been scraped. */
const EMPTY_SLOTS = 4;

/**
 * The rail down the left edge: every photo pulled off the Instagram post.
 *
 * Sits where the colour palette used to, and keeps its shape -- a pinned strip
 * of chips that drop in one after another. Clicking a chip pins that photo onto
 * the page; clicking a pinned one takes it back off.
 */
export function PhotoBank({
  photos,
  pinned,
  busy,
  onToggle,
}: {
  photos: string[];
  pinned: string[];
  busy: boolean;
  onToggle: (url: string) => void;
}) {
  // Instagram CDN URLs are signed and occasionally 403 from the browser. A
  // chip that cannot load is dropped rather than left as a broken frame.
  const [broken, setBroken] = useState<string[]>([]);
  const usable = photos.filter((src) => !broken.includes(src));

  return (
    <aside className="photo-bank" aria-label="Photos from the post">
      <div className="photo-bank-pin" aria-hidden />

      {usable.length === 0 ? (
        <div className="photo-bank-empty">
          <ol className="photo-bank-chips">
            {Array.from({ length: EMPTY_SLOTS }, (_, index) => (
              <li key={index} className="photo-bank-chip is-blank" aria-hidden />
            ))}
          </ol>
          <p className="photo-bank-hint">
            {busy ? "developing…" : "paste an instagram link"}
          </p>
        </div>
      ) : (
        <ol className="photo-bank-chips">
          {usable.map((src, index) => {
            const isPinned = pinned.includes(src);

            return (
              <li
                key={src}
                className={`photo-bank-chip${isPinned ? " is-pinned" : ""}`}
                style={
                  {
                    animationDelay: `${120 + index * 90}ms`,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  className="photo-bank-button"
                  aria-pressed={isPinned}
                  aria-label={
                    isPinned
                      ? `Photo ${index + 1} of ${usable.length}. Pinned to the page. Click to take it off.`
                      : `Photo ${index + 1} of ${usable.length}. Click to pin it to the page.`
                  }
                  onClick={() => onToggle(src)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayPhotoUrl(src)}
                    alt=""
                    loading="lazy"
                    onError={() =>
                      setBroken((current) =>
                        current.includes(src) ? current : [...current, src],
                      )
                    }
                  />
                  {isPinned ? (
                    <span className="photo-bank-tick" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

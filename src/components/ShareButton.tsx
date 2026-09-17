"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { domToPng } from "modern-screenshot";

/** How long "saved" stays up before the button goes back to offering itself. */
const CONFIRM_MS = 2_400;

/** Retina, so the paper grain survives being posted into a chat thread. */
const EXPORT_SCALE = 2;

type Status = "idle" | "working" | "saved" | "failed";

/**
 * All four kept to a similar length on purpose. The button is anchored to the
 * corner, so a long word mid-click makes it lurch sideways under the pointer.
 */
const LABELS: Record<Status, string> = {
  idle: "save",
  working: "saving",
  saved: "saved",
  failed: "retry",
};

/** A stray element cannot blow the canvas up past this, in CSS pixels. */
const MAX_BLEED = 240;

/**
 * How far the scraps poke out past the edges of the stage.
 *
 * `domToPng` sizes its canvas to exactly the node it is given, so anything
 * hanging outside gets sheared off -- which is what beheaded the bulldog clip
 * in every saved board. The clip is translated 55px up so it bites the top of
 * the paper rather than sitting on it, leaving roughly 37px of itself above
 * the stage and outside the picture.
 *
 * Measured rather than hardcoded, because the clip is draggable and resizable:
 * whatever the reader has done to it, the export has to be big enough to hold
 * the result.
 */
function bleedAround(stage: HTMLElement) {
  const box = stage.getBoundingClientRect();
  const bleed = { top: 0, right: 0, bottom: 0, left: 0 };

  for (const child of stage.querySelectorAll<HTMLElement>("*")) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    bleed.top = Math.max(bleed.top, box.top - rect.top);
    bleed.left = Math.max(bleed.left, box.left - rect.left);
    bleed.right = Math.max(bleed.right, rect.right - box.right);
    bleed.bottom = Math.max(bleed.bottom, rect.bottom - box.bottom);
  }

  return {
    top: Math.min(Math.ceil(bleed.top), MAX_BLEED),
    right: Math.min(Math.ceil(bleed.right), MAX_BLEED),
    bottom: Math.min(Math.ceil(bleed.bottom), MAX_BLEED),
    left: Math.min(Math.ceil(bleed.left), MAX_BLEED),
  };
}

function fileName(destination: string): string {
  const place = destination
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${place || "scrapbook"}-moodboard.png`;
}

/**
 * Downloads the paper and everything pinned to it as a PNG.
 *
 * Captures the stage rather than the whole page, so the chat panel and this
 * button stay out of the shot and the export comes out on a transparent
 * background -- the torn paper edge reads as a cut-out wherever it is posted.
 *
 * The photos come from Unsplash and Wikimedia, both of which send
 * `Access-Control-Allow-Origin: *`, so they inline without a proxy. Scraped
 * Instagram frames are already same-origin by the time they reach the page,
 * since they are served through /api/ig-photo.
 */
export function ShareButton({
  stageRef,
  destination,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  destination: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage || status === "working") return;

    clearTimeout(confirmTimer.current);
    setStatus("working");

    // The drag, resize and rotate handles are only invisible because nothing
    // is hovering them, and on a touch screen the remove stamps are visible
    // outright. Neither belongs in a keepsake.
    stage.classList.add("is-exporting");

    try {
      // The handwriting is a web font; capturing before it settles bakes the
      // fallback into the image.
      await document.fonts.ready;

      // Grow the canvas by whatever hangs over the edges, then push the board
      // in by the same amount so the overhang lands inside the picture instead
      // of off the top of it.
      const bleed = bleedAround(stage);
      const box = stage.getBoundingClientRect();

      const png = await domToPng(stage, {
        scale: EXPORT_SCALE,
        backgroundColor: null,
        width: box.width + bleed.left + bleed.right,
        height: box.height + bleed.top + bleed.bottom,
        style: {
          overflow: "visible",
          transform: `translate(${bleed.left}px, ${bleed.top}px)`,
          transformOrigin: "top left",
        },
      });

      const link = document.createElement("a");
      link.download = fileName(destination);
      link.href = png;
      link.click();

      setStatus("saved");
    } catch (error) {
      console.error("[ShareButton] could not export the board:", error);
      setStatus("failed");
    } finally {
      stage.classList.remove("is-exporting");
      confirmTimer.current = setTimeout(() => setStatus("idle"), CONFIRM_MS);
    }
  }, [destination, stageRef, status]);

  return (
    <button
      type="button"
      className={`board-share is-${status}`}
      onClick={save}
      disabled={status === "working"}
      aria-label="Download this board as a PNG"
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path
          d="M8 1.9v8.2m0 0L4.9 7M8 10.1 11.1 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2.2 11.4v1.4a1.4 1.4 0 0 0 1.4 1.4h8.8a1.4 1.4 0 0 0 1.4-1.4v-1.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {LABELS[status]}
    </button>
  );
}

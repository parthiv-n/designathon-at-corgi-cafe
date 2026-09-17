"use client";

import { useState, type CSSProperties } from "react";
import type { NoteCardData } from "@/data/cards";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";

/**
 * Roughly the area one character of the handwriting font covers, in em², and
 * how much of the writable box we are willing to fill with type. Together
 * they turn "this much text in a box this size" into a font size, which is the
 * only way a fixed size can be avoided: the sheets have wildly different clear
 * areas, and a caption can be three words or twenty-six.
 */
const CHAR_AREA_EM = 0.575;
const BOX_FILL = 0.72;

/** Below the floor it stops being readable; above the ceiling it looks shouty. */
const MIN_FONT_PX = 10;
const MAX_FONT_PX = 17;

/** Must match .note-heading and .note-footnote in globals.css. */
const HEADING_EM = 1.14;
const FOOTNOTE_EM = 0.86;

export function NoteCard({
  card,
  index,
  locked,
  onRemove,
}: {
  card: NoteCardData;
  index: number;
  locked: boolean;
  onRemove: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  // Notes stack above the photos, so they drag on the "text" layer.
  const drag = useBoardDrag({ x: card.x, y: card.y }, "scrapbook-board", "text");
  const size = useResize(card.width, 96, 280);

  // Fit the writing to the paper rather than the paper to the writing. Derived
  // from the live width, so it keeps fitting as the reader resizes the note.
  const { top, left, right, bottom } = card.paperBox;
  const boxWidth = (size.width * (100 - left - right)) / 100;
  const boxHeight =
    ((size.width / card.paperAspect) * (100 - top - bottom)) / 100;

  // A heading is set larger and a footnote smaller, and the area a line covers
  // goes with the square of its size -- so count their characters at their own
  // weight rather than the body's, or a long restaurant name overflows the
  // sheet it was measured to fit.
  const crowding =
    card.text.length +
    (card.heading?.length ?? 0) * HEADING_EM ** 2 +
    (card.footnote?.length ?? 0) * FOOTNOTE_EM ** 2;

  const fontSize = Math.min(
    MAX_FONT_PX,
    Math.max(
      MIN_FONT_PX,
      Math.sqrt((BOX_FILL * boxWidth * boxHeight) / (CHAR_AREA_EM * Math.max(crowding, 1))),
    ),
  );

  function handleRemove() {
    if (locked || leaving) return;
    setLeaving(true);
    window.setTimeout(onRemove, 420);
  }

  return (
    <div
      className={`scrap-pin is-note${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing ? " is-resizing" : ""}`}
      style={
        {
          "--rot": `${card.rotate}deg`,
          left: `${drag.pos.x}%`,
          top: `${drag.pos.y}%`,
          width: `${size.width}px`,
          zIndex: drag.z ?? card.z,
          animationDelay: `${140 + index * 140}ms`,
        } as CSSProperties
      }
      {...drag.bind}
    >
      <article
        className="note-card"
        style={
          {
            color: card.ink,
            fontSize: `${fontSize.toFixed(2)}px`,
            "--note-top": `${top}%`,
            "--note-left": `${left}%`,
            "--note-right": `${right}%`,
            "--note-bottom": `${bottom}%`,
          } as CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="note-paper" src={card.paper} alt="" draggable={false} />
        {/*
          * Each line is its own block so HandText's apostrophe spans stay
          * inline within it. Left bare, its text nodes become anonymous flex
          * items and a contraction breaks the line in three.
          */}
        <p className="note-copy">
          {card.heading ? (
            <span className="note-line note-heading">
              <HandText text={card.heading} />
            </span>
          ) : null}
          <span className="note-line">
            <HandText text={card.text} />
          </span>
          {card.footnote ? (
            <span className="note-line note-footnote">
              <HandText text={card.footnote} />
            </span>
          ) : null}
        </p>
      </article>
      {locked ? null : (
        <>
          <StampControls onRemove={handleRemove} />
          <ResizeHandle bind={size.bind} />
        </>
      )}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";
import type { DecorCardData } from "@/data/cards";
import { ResizeHandle } from "@/components/ResizeHandle";
import { RotateHandle } from "@/components/RotateHandle";
import { StampControls } from "@/components/StampControls";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";
import { useRotate } from "@/hooks/useRotate";

/**
 * A strip of tape or a paper scrap, as its own thing on the page.
 *
 * These were decoration in the literal sense before: tape was a child of the
 * photo it sat on and moved with it, and the loose ephemera were painted onto
 * the paper behind `pointer-events: none`. Now each one drags, turns, resizes
 * and tears off independently, so a photo can be lifted out from under its own
 * tape.
 */
export function DecorPiece({
  card,
  index,
  locked,
  onRemove,
}: {
  card: DecorCardData;
  index: number;
  locked: boolean;
  onRemove: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  // Tape sits over the photos it holds down; loose scraps sit under them.
  const drag = useBoardDrag(
    { x: card.x, y: card.y },
    "scrapbook-board",
    card.variant === "ephemera" ? "photo" : "text",
  );
  const size = useResize(
    card.width,
    card.variant === "sparkle" ? 16 : 28,
    card.variant === "sparkle" ? 96 : 340,
  );
  const spin = useRotate(card.rotate);

  function handleRemove() {
    if (locked || leaving) return;
    setLeaving(true);
    window.setTimeout(onRemove, 420);
  }

  return (
    <div
      className={`scrap-pin is-decor is-${card.variant}${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing || spin.rotating ? " is-resizing" : ""}`}
      style={
        {
          "--rot": `${spin.angle}deg`,
          left: `${drag.pos.x}%`,
          top: `${drag.pos.y}%`,
          width: `${size.width}px`,
          zIndex: drag.z ?? card.z,
          animationDelay: `${90 + index * 60}ms`,
        } as CSSProperties
      }
      {...drag.bind}
    >
      {/* Transparent scans, served as-is so their torn edges survive. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="decor-scan" src={card.src} alt="" draggable={false} />
      {locked ? null : (
        <>
          <StampControls onRemove={handleRemove} />
          <RotateHandle bind={spin.bind} />
          <ResizeHandle bind={size.bind} />
        </>
      )}
    </div>
  );
}

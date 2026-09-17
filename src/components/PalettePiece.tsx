"use client";

import { useState, type CSSProperties } from "react";
import type { PaletteCardData } from "@/data/cards";
import { ResizeHandle } from "@/components/ResizeHandle";
import { RotateHandle } from "@/components/RotateHandle";
import { StampControls } from "@/components/StampControls";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";
import { useRotate } from "@/hooks/useRotate";

/**
 * The board's colours, as a paint-chip strip someone taped to the page.
 *
 * The model has always sampled a palette off the prompt or the photos; until
 * now that reading only tinted ink and slips. On a mood board the palette is
 * a deliverable, so it sits with the other scraps and can be dragged, turned
 * and torn off the same way.
 */
export function PalettePiece({
  card,
  index,
  locked,
  onRemove,
}: {
  card: PaletteCardData;
  index: number;
  locked: boolean;
  onRemove: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const drag = useBoardDrag({ x: card.x, y: card.y }, "scrapbook-board", "text");
  const size = useResize(card.width, 52, 220);
  const spin = useRotate(card.rotate);

  function handleRemove() {
    if (locked || leaving) return;
    setLeaving(true);
    window.setTimeout(onRemove, 420);
  }

  return (
    <div
      className={`scrap-pin is-palette${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing || spin.rotating ? " is-resizing" : ""}`}
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
      <ul className="palette-chips" aria-label="Colour palette">
        {card.colors.map((color) => (
          <li key={color} className="palette-chip">
            <span
              className="palette-swatch"
              style={{ background: color }}
              aria-hidden
            />
            <span className="palette-hex">{color}</span>
          </li>
        ))}
      </ul>
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

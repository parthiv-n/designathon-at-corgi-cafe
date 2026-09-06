"use client";

import { useState, type CSSProperties } from "react";
import type { NoteCardData } from "@/data/cards";
import { AnalogDecor } from "@/components/AnalogDecor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";

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
  const size = useResize(210, 120, 360);

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
      <article className="note-card" style={{ color: card.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="note-paper" src={card.paper} alt="" draggable={false} />
        <p className="note-copy">
          <HandText text={card.text} />
        </p>
      </article>
      <AnalogDecor items={card.decors} />
      {locked ? null : (
        <>
          <StampControls onRemove={handleRemove} />
          <ResizeHandle bind={size.bind} />
        </>
      )}
    </div>
  );
}

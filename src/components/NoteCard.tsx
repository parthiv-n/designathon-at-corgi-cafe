"use client";

import { useState, type CSSProperties } from "react";
import type { NoteCardData } from "@/data/cards";
import { AnalogDecor } from "@/components/AnalogDecor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";

function nextRotation() {
  return -8 + Math.random() * 18;
}

export function NoteCard({
  card,
  index,
  locked,
}: {
  card: NoteCardData;
  index: number;
  locked: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [variant, setVariant] = useState(0);
  const [rotate, setRotate] = useState(card.rotate);

  // Notes stack above the photos, so they drag on the "text" layer.
  const drag = useBoardDrag({ x: card.x, y: card.y }, "scrapbook-board", "text");
  const size = useResize(210, 120, 360);

  const pool = [card.text, ...card.alts];
  const text = pool[variant % pool.length];

  function handleReject() {
    if (locked || leaving) return;
    setAccepted(false);
    setLeaving(true);
    window.setTimeout(() => {
      setVariant((value) => value + 1);
      setRotate(nextRotation());
      setLeaving(false);
    }, 420);
  }

  return (
    <div
      key={`${card.id}-${variant}`}
      className={`scrap-pin is-note${accepted ? " is-kept" : ""}${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing ? " is-resizing" : ""}`}
      style={
        {
          "--rot": `${rotate}deg`,
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
          <HandText text={text} />
        </p>
      </article>
      {accepted ? <span className="kept-stamp">kept</span> : null}
      <AnalogDecor items={card.decors} />
      {locked ? null : (
        <>
          <StampControls
            onAccept={() => setAccepted(true)}
            onReject={handleReject}
          />
          <ResizeHandle bind={size.bind} />
        </>
      )}
    </div>
  );
}

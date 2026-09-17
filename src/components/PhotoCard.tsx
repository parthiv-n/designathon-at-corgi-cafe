"use client";

import { useState, type CSSProperties } from "react";
import type { PhotoCardData } from "@/data/cards";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";

export function PhotoCard({
  card,
  index,
  locked,
  onRemove,
}: {
  card: PhotoCardData;
  index: number;
  locked: boolean;
  onRemove: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Position and size are the reader's, not the layout's: the slot only seeds
  // them, and anything they drag or resize stays where they put it.
  const drag = useBoardDrag({ x: card.x, y: card.y });
  const size = useResize(card.width, 96, 420);

  const showCredit = Boolean(card.credit) && !failed;

  function handleRemove() {
    if (locked || leaving) return;
    setLeaving(true);
    window.setTimeout(onRemove, 420);
  }

  return (
    <div
      className={`scrap-pin is-photo${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing ? " is-resizing" : ""}`}
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
      <figure className="photo-card">
        {failed ? null : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={card.src}
            src={card.src}
            alt={card.alt}
            title={
              showCredit
                ? `Photo by ${card.credit!.name} on Unsplash`
                : undefined
            }
            width={size.width}
            height={Math.round(size.width * 1.28)}
            draggable={false}
            onError={() => setFailed(true)}
          />
        )}
      </figure>
      {card.label ? (
        <span
          className="scrap-label"
          style={
            {
              "--slip-paper": card.slip.paper,
              "--slip-ink": card.slip.ink,
            } as CSSProperties
          }
        >
          <span className="scrap-label-title">
            <HandText text={card.label} />
          </span>
          {card.sublabel ? (
            <span className="scrap-label-sub">{card.sublabel}</span>
          ) : null}
        </span>
      ) : null}
      {locked ? null : (
        <>
          <StampControls onRemove={handleRemove} />
          <ResizeHandle bind={size.bind} />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PhotoCardData } from "@/data/cards";
import { AnalogDecor } from "@/components/AnalogDecor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";
import { notePaper } from "@/lib/layout";

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
  const pinRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Position and size are the reader's, not the layout's: the slot only seeds
  // them, and anything they drag or resize stays where they put it.
  const drag = useBoardDrag({ x: card.x, y: card.y });
  const size = useResize(card.width, 90, 480);

  const current = { src: card.src, alt: card.alt, location: card.location };
  const showCredit = Boolean(card.credit) && !failed;

  useEffect(() => {
    if (!flipped) return;

    const onPointer = (event: PointerEvent) => {
      if (!pinRef.current?.contains(event.target as Node)) {
        setFlipped(false);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [flipped]);

  function handleRemove() {
    if (locked || leaving) return;
    setFlipped(false);
    setLeaving(true);
    window.setTimeout(onRemove, 420);
  }

  return (
    <div
      ref={pinRef}
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
      <button
        type="button"
        className={`photo-card ${flipped ? "is-flipped" : ""}`}
        aria-pressed={flipped}
        aria-label={
          flipped
            ? `Back of photo: ${current.location}. Click to flip back.`
            : `Photo: ${current.alt}. Click to flip.`
        }
        onClick={() => {
          // A drag that ends on the card is not a click on it.
          if (drag.didDrag()) return;
          setFlipped((value) => !value);
        }}
      >
        <span className="photo-face photo-front">
          {failed ? null : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={current.src}
              src={current.src}
              alt=""
              title={
                showCredit
                  ? `Photo by ${card.credit!.name} on Unsplash`
                  : undefined
              }
              width={size.width}
              height={Math.round(size.width * 1.28)}
              draggable={false}
              // Do not replace a failed request with unrelated stock imagery.
              onError={() => setFailed(true)}
            />
          )}
        </span>
        <span className="photo-face photo-back">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="photo-back-paper"
            src={notePaper(`${card.id}-back`)}
            alt=""
            draggable={false}
          />
          <span className="photo-back-caption">
            <HandText text={current.location} />
          </span>
        </span>
      </button>
      {card.label ? (
        <span className="scrap-label">
          <span className="scrap-label-title">
            <HandText text={card.label} />
          </span>
          {card.sublabel ? (
            <span className="scrap-label-sub">{card.sublabel}</span>
          ) : null}
        </span>
      ) : null}
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

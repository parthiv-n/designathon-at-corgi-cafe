"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PhotoCardData } from "@/data/cards";
import { AnalogDecor } from "@/components/AnalogDecor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { StampControls } from "@/components/StampControls";
import { HandText } from "@/lib/handText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";
import { unsplashUrlFor } from "@/lib/vibeBoard";

function nextRotation() {
  return -8 + Math.random() * 18;
}

export function PhotoCard({
  card,
  index,
  locked,
}: {
  card: PhotoCardData;
  index: number;
  locked: boolean;
}) {
  const pinRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [variant, setVariant] = useState(0);
  const [rotate, setRotate] = useState(card.rotate);
  const [cut, setCut] = useState(card.cut);
  const [failed, setFailed] = useState(false);

  // Position and size are the reader's, not the layout's: the slot only seeds
  // them, and anything they drag or resize stays where they put it.
  const drag = useBoardDrag({ x: card.x, y: card.y });
  const size = useResize(card.width, 90, 480);

  const pool = [
    { src: card.src, alt: card.alt, location: card.location },
    ...card.alts,
  ];
  const current = pool[variant % pool.length];

  // Only the card's own photo carries the credit. Rejecting deals a bank photo
  // onto it, and `failed` swaps in the curated set -- neither is this
  // photographer's work.
  const showCredit = card.credit && variant === 0 && !failed;

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

  function handleReject() {
    if (locked || leaving) return;
    setFlipped(false);
    setAccepted(false);
    setLeaving(true);
    window.setTimeout(() => {
      setVariant((value) => value + 1);
      setRotate(nextRotation());
      setCut((value) => (value % 8) + 1);
      // The next photo deserves its own chance to load.
      setFailed(false);
      setLeaving(false);
    }, 420);
  }

  return (
    <div
      ref={pinRef}
      key={`${card.id}-${variant}`}
      className={`scrap-pin is-photo${accepted ? " is-kept" : ""}${leaving ? " is-leaving" : ""}${drag.dragging ? " is-dragging" : ""}${drag.settled ? " is-placed" : ""}${size.resizing ? " is-resizing" : ""}`}
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
        <span className={`photo-face photo-front cut-${cut}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.src}
            src={failed ? unsplashUrlFor(card.id) : current.src}
            alt=""
            title={
              showCredit
                ? `Photo by ${card.credit!.name} on Unsplash`
                : undefined
            }
            width={size.width}
            height={Math.round(size.width * 1.28)}
            draggable={false}
            // Instagram CDN URLs are signed and sometimes 403 from the browser.
            // A stand-in photo keeps the page whole rather than tearing a hole
            // in it mid-demo.
            onError={() => setFailed(true)}
          />
        </span>
        <span className={`photo-face photo-back cut-${cut}`}>
          <span className="photo-back-paper" />
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

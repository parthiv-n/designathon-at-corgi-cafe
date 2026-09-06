"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PhotoCardData } from "@/data/mock";
import { AnalogDecor } from "@/components/AnalogDecor";
import { StampControls } from "@/components/StampControls";

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

  const pool = [
    { src: card.src, alt: card.alt, location: card.location },
    ...card.alts,
  ];
  const current = pool[variant % pool.length];

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
      setLeaving(false);
    }, 420);
  }

  return (
    <div
      ref={pinRef}
      key={`${card.id}-${variant}`}
      className={`scrap-pin${accepted ? " is-kept" : ""}${leaving ? " is-leaving" : ""}`}
      style={
        {
          "--rot": `${rotate}deg`,
          left: `${card.x}%`,
          top: `${card.y}%`,
          width: `clamp(118px, 16vw, ${card.width}px)`,
          zIndex: card.z,
          animationDelay: `${140 + index * 140}ms`,
        } as CSSProperties
      }
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
        onClick={() => setFlipped((value) => !value)}
      >
        <span className={`photo-face photo-front cut-${cut}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.src}
            src={current.src}
            alt=""
            width={card.width}
            height={Math.round(card.width * 1.28)}
          />
        </span>
        <span className={`photo-face photo-back cut-${cut}`}>
          <span className="photo-back-paper" />
          <span className="photo-back-caption">{current.location}</span>
        </span>
      </button>
      {accepted ? <span className="kept-stamp">kept</span> : null}
      <AnalogDecor items={card.decors} />
      {locked ? null : (
        <StampControls
          onAccept={() => setAccepted(true)}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";
import type { NoteCardData } from "@/data/cards";
import { AnalogDecor } from "@/components/AnalogDecor";
import { StampControls } from "@/components/StampControls";

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
  const [cut, setCut] = useState(card.cut);

  const pool = [card.text, ...card.alts];
  const text = pool[variant % pool.length];

  function handleReject() {
    if (locked || leaving) return;
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
      key={`${card.id}-${variant}`}
      className={`scrap-pin${accepted ? " is-kept" : ""}${leaving ? " is-leaving" : ""}`}
      style={
        {
          "--rot": `${rotate}deg`,
          left: `${card.x}%`,
          top: `${card.y}%`,
          width: "clamp(140px, 18vw, 210px)",
          zIndex: card.z,
          animationDelay: `${140 + index * 140}ms`,
        } as CSSProperties
      }
    >
      <article
        className={`note-card cut-${cut}`}
        style={{ color: card.ink }}
      >
        <p>{text}</p>
      </article>
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

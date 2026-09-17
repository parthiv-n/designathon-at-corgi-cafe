"use client";

import { useEffect, useState } from "react";
import { BeadTitle } from "@/components/BeadTitle";
import { DecorPiece } from "@/components/DecorPiece";
import { NoteCard } from "@/components/NoteCard";
import { PalettePiece } from "@/components/PalettePiece";
import { PhotoCard } from "@/components/PhotoCard";
import { buildCards } from "@/lib/layout";
import type { CanvasState } from "@/lib/vibeBoard";

export function ScrapbookCanvas({
  canvasState,
  titlePrompt,
  onRemove,
}: {
  canvasState: CanvasState;
  titlePrompt?: string;
  onRemove: (id: string) => void;
}) {
  // Matches the breakpoint globals.css uses for the rest of the page. Starts
  // false so the server and the first client render agree; the board is empty
  // until a scrape lands, so there is nothing to re-lay-out before this settles.
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const sync = () => setCompact(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const cards = buildCards(canvasState, compact);
  const heading =
    canvasState.destination.trim() ||
    canvasState.post.place ||
    titlePrompt?.trim() ||
    canvasState.vibeSummary;

  // A fresh layout re-keys every scrap so the whole page re-pins; within one
  // layout, ids carry their content, so only what actually changed remounts.
  const generation = canvasState.layoutSeed;

  return (
    <section className="scrap-canvas" aria-label="Scrapbook canvas">
      {heading ? <BeadTitle prompt={heading} locked={false} /> : null}

      {cards.map((card, index) => {
        const key = `${generation}-${card.id}-${card.width}`;
        const remove = () => onRemove(card.id);

        if (card.kind === "photo") {
          return (
            <PhotoCard
              key={key}
              card={card}
              index={index}
              locked={false}
              onRemove={remove}
            />
          );
        }

        if (card.kind === "note") {
          return (
            <NoteCard
              key={key}
              card={card}
              index={index}
              locked={false}
              onRemove={remove}
            />
          );
        }

        if (card.kind === "palette") {
          return (
            <PalettePiece
              key={key}
              card={card}
              index={index}
              locked={false}
              onRemove={remove}
            />
          );
        }

        return (
          <DecorPiece
            key={key}
            card={card}
            index={index}
            locked={false}
            onRemove={remove}
          />
        );
      })}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BeadTitle } from "@/components/BeadTitle";
import { BoardAssets } from "@/components/BoardAssets";
import { NoteCard } from "@/components/NoteCard";
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

  // A new post re-keys every card so the whole page re-pins; within one post,
  // card ids carry their content, so only what actually changed remounts.
  const generation = canvasState.originalImage ?? "empty";

  return (
    <section className="scrap-canvas" aria-label="Scrapbook canvas">
      {cards.length > 0 ? (
        <BoardAssets seed={`${heading}-${generation}`} />
      ) : null}
      {heading ? <BeadTitle prompt={heading} locked={false} /> : null}

      {cards.map((card, index) =>
        card.kind === "photo" ? (
          <PhotoCard
            key={`${generation}-${card.id}`}
            card={card}
            index={index}
            locked={false}
            onRemove={() => onRemove(card.id)}
          />
        ) : (
          <NoteCard
            key={`${generation}-${card.id}`}
            card={card}
            index={index}
            locked={false}
            onRemove={() => onRemove(card.id)}
          />
        ),
      )}
    </section>
  );
}

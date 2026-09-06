"use client";

import { useEffect, useState } from "react";
import { BeadTitle } from "@/components/BeadTitle";
import { NoteCard } from "@/components/NoteCard";
import { PhotoCard } from "@/components/PhotoCard";
import { buildCards } from "@/lib/layout";
import type { CanvasState } from "@/lib/vibeBoard";

export function ScrapbookCanvas({
  canvasState,
  done,
  showHowTo = false,
  titlePrompt,
}: {
  canvasState: CanvasState;
  done: boolean;
  showHowTo?: boolean;
  onHowToTyped?: () => void;
  titlePrompt?: string;
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
    titlePrompt?.trim() ||
    canvasState.post.place ||
    canvasState.vibeSummary;

  // A new post re-keys every card so the whole page re-pins; within one post,
  // card ids carry their content, so only what actually changed remounts.
  const generation = canvasState.originalImage ?? "empty";

  return (
    <section className="scrap-canvas" aria-label="Scrapbook canvas">
      {!showHowTo && heading ? (
        <BeadTitle prompt={heading} locked={done} />
      ) : null}

      {cards.map((card, index) =>
        card.kind === "photo" ? (
          <PhotoCard
            key={`${generation}-${card.id}`}
            card={card}
            index={index}
            locked={done}
          />
        ) : (
          <NoteCard
            key={`${generation}-${card.id}`}
            card={card}
            index={index}
            locked={done}
          />
        ),
      )}

      {done ? (
        <div className="saved-stamp" aria-live="polite">
          <span>saved</span>
          <em>
            {new Date()
              .toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              .toLowerCase()}
          </em>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { NoteCard } from "@/components/NoteCard";
import { PhotoCard } from "@/components/PhotoCard";
import { ResizeHandle } from "@/components/ResizeHandle";
import { TypewriterText } from "@/components/TypewriterText";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";
import { buildCards } from "@/lib/layout";
import type { CanvasState } from "@/lib/vibeBoard";

export function ScrapbookCanvas({
  canvasState,
  done,
}: {
  canvasState: CanvasState;
  done: boolean;
}) {
  // Matches the breakpoint globals.css uses for the rest of the page. Starts
  // false so the server and the first client render agree; the board is empty
  // until a scrape lands, so there is nothing to re-lay-out before this settles.
  const [compact, setCompact] = useState(false);

  // The title is a scrap like any other -- draggable and resizable.
  const title = useBoardDrag({ x: 8, y: 6 }, "scrapbook-board", "text");
  const titleSize = useResize(260, 140, 420);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const sync = () => setCompact(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const cards = buildCards(canvasState, compact);
  const caption = canvasState.vibeSummary.toLowerCase();

  // A new post re-keys every card so the whole page re-pins; within one post,
  // card ids carry their content, so only what actually changed remounts.
  const generation = canvasState.originalImage ?? "empty";

  return (
    <section className="scrap-canvas" aria-label="Scrapbook canvas">
      {caption ? (
        <p
          key={`caption-${caption}`}
          className={`page-title${title.dragging ? " is-dragging" : ""}${titleSize.resizing ? " is-resizing" : ""}`}
          style={{
            left: `${title.pos.x}%`,
            top: `${title.pos.y}%`,
            width: titleSize.width,
            zIndex: title.z ?? 42,
          }}
          {...title.bind}
        >
          <TypewriterText text={caption} active />
          {done ? null : <ResizeHandle bind={titleSize.bind} />}
        </p>
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

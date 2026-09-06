"use client";

import { ResizeHandle } from "@/components/ResizeHandle";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useResize } from "@/hooks/useResize";

const INTENT_WORDS = new Set([
  "adventure",
  "bar",
  "bars",
  "best",
  "cafe",
  "cafes",
  "coffee",
  "day",
  "food",
  "guide",
  "holiday",
  "ideas",
  "inspo",
  "itinerary",
  "night",
  "places",
  "restaurant",
  "restaurants",
  "things",
  "tour",
  "travel",
  "trip",
  "weekend",
]);

function destinationWord(prompt: string) {
  const words = prompt
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .split(/[^a-zA-Z]+/)
    .filter(Boolean);

  const placeWords = words.filter(
    (word) => word.length >= 2 && !INTENT_WORDS.has(word.toLowerCase()),
  );
  const candidates = placeWords.length > 0 ? placeWords : words;
  return candidates.slice(0, 2).join(" ").toUpperCase();
}

export function BeadTitle({
  prompt,
  locked = false,
}: {
  prompt: string;
  locked?: boolean;
}) {
  const word = destinationWord(prompt);
  const letters = word.split("");
  const beadCount = letters.filter((character) => /[A-Z]/.test(character)).length;
  const drag = useBoardDrag({ x: 5, y: 9 }, "scrapbook-board", "chrome");
  const size = useResize(Math.max(160, beadCount * 50), 120, 640);

  if (!word) return null;

  const beadPx = Math.max(30, Math.round(size.width / Math.max(beadCount, 1)));

  return (
    <div
      className={`bead-title${drag.dragging ? " is-dragging" : ""}${size.resizing ? " is-resizing" : ""}`}
      aria-label={word}
      style={{
        left: `${drag.pos.x}%`,
        top: `${drag.pos.y}%`,
        zIndex: drag.z ?? 52,
        ["--bead-size" as string]: `${beadPx}px`,
      }}
      {...(locked ? {} : drag.bind)}
    >
      {letters.map((character, index) =>
        character === " " ? (
          <span key={`gap-${index}`} className="bead-gap" aria-hidden />
        ) : (
          // The supplied bead PNGs retain their photographed material edges.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${character}-${index}`}
            className="bead-letter"
            src={`/letter-beads/${character}.png`}
            alt=""
            draggable={false}
            style={{
              rotate: `${((index % 3) - 1) * 2.2}deg`,
              animationDelay: `${80 + index * 110}ms`,
            }}
          />
        ),
      )}
      {locked ? null : <ResizeHandle bind={size.bind} />}
    </div>
  );
}

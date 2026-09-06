import { MOCK_CARDS, MOCK_CAPTION } from "@/data/mock";
import { NoteCard } from "@/components/NoteCard";
import { PhotoCard } from "@/components/PhotoCard";
import { TypewriterText } from "@/components/TypewriterText";

export function ScrapbookCanvas({
  revealed,
  generation,
  prompt,
  done,
}: {
  revealed: boolean;
  generation: number;
  prompt: string;
  done: boolean;
}) {
  const caption = prompt
    ? `${prompt.toLowerCase()} — tiles, sardines, and a first scatter of scraps.`
    : MOCK_CAPTION;

  return (
    <section className="scrap-canvas" aria-label="Scrapbook canvas">
      {revealed ? (
        <p key={`caption-${generation}`} className="page-title">
          <TypewriterText text={caption} active />
        </p>
      ) : null}

      {revealed
        ? MOCK_CARDS.map((card, index) =>
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
          )
        : null}

      {done ? (
        <div className="saved-stamp" aria-live="polite">
          <span>saved</span>
          <em>6 sep</em>
        </div>
      ) : null}
    </section>
  );
}

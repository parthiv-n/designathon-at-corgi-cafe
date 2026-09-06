"use client";

import { useState } from "react";
import { PhotoBank } from "@/components/PhotoBank";
import { PromptBar } from "@/components/PromptBar";
import { ScrapbookCanvas } from "@/components/ScrapbookCanvas";
import { TypewriterText } from "@/components/TypewriterText";
import { useCanvasController } from "@/hooks/useCanvasController";
import { EMPTY_CANVAS, looksLikeInstagramUrl } from "@/lib/vibeBoard";

export function Scrapbook() {
  // The one canvas for the whole page. useCanvasController is per-instance
  // state, so calling it anywhere else would fork the board.
  const canvas = useCanvasController(EMPTY_CANVAS);
  const [done, setDone] = useState(false);

  const { canvasState } = canvas;
  const hasBoard = canvasState.activities.length > 0 || !!canvasState.originalImage;

  /**
   * One bar, two features. An Instagram link is a new page to build; anything
   * else is a note to the director about the page already on the table.
   */
  function handleSubmit(value: string) {
    if (looksLikeInstagramUrl(value)) {
      void canvas.runInstagram(value);
    } else {
      void canvas.sendMessage(value);
    }
  }

  // The model's own words, which land before the typed patch does.
  const lastNode = canvas.nodes[canvas.nodes.length - 1] ?? null;

  return (
    <div className={`scrapbook-page${done ? " is-done" : ""}`}>
      <PhotoBank
        photos={canvasState.photoBank}
        pinned={canvasState.pinned}
        busy={canvas.isPending}
        onToggle={canvas.togglePinned}
      />

      <div className="paper-stage">
        <div className="paper-sheet" aria-hidden="true" />
        <div className="scrapbook-board">
          <ScrapbookCanvas canvasState={canvasState} done={done} />
        </div>
      </div>

      <div className="prompt-dock">
        <div className="director-slip" aria-live="polite">
          {canvas.error ? (
            <p className="director-error" role="alert">
              {canvas.error}
            </p>
          ) : canvas.status ? (
            <TypewriterText text={canvas.status} active />
          ) : (
            lastNode
          )}
        </div>

        <PromptBar
          busy={canvas.isPending || done}
          hasBoard={hasBoard}
          onSubmit={handleSubmit}
          onFilesPicked={canvas.addToBank}
        />

        {hasBoard && !done ? (
          <button
            type="button"
            className="keep-page"
            onClick={() => setDone(true)}
          >
            keep this page
          </button>
        ) : null}
      </div>
    </div>
  );
}

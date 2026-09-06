"use client";

import { useState } from "react";
import { PromptBar } from "@/components/PromptBar";
import { ResizeHandle } from "@/components/ResizeHandle";
import { ScrapbookCanvas } from "@/components/ScrapbookCanvas";
import { SidePanel } from "@/components/SidePanel";
import { UnsplashCredits } from "@/components/UnsplashCredits";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useCanvasController } from "@/hooks/useCanvasController";
import { useResize } from "@/hooks/useResize";
import { EMPTY_CANVAS, looksLikeInstagramUrl } from "@/lib/vibeBoard";

export function Scrapbook() {
  // The one canvas for the whole page. useCanvasController is per-instance
  // state, so calling it anywhere else would fork the board.
  const canvas = useCanvasController(EMPTY_CANVAS);
  const [done, setDone] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // The board stays masked to the paper until the drop animation has finished;
  // after that scraps can be dragged past the torn edge.
  const [loose, setLoose] = useState(false);

  // The bulldog clip is furniture, not content: it drags and resizes but holds
  // no state anyone needs back.
  const clip = useBoardDrag({ x: 77, y: -11 }, "paper-stage", "chrome");
  const clipSize = useResize(128, 64, 220);

  const { canvasState } = canvas;
  const revealed =
    canvasState.activities.length > 0 || !!canvasState.originalImage;

  /**
   * One entry point, two features. An Instagram link is a new page to build;
   * anything else is a note to the director about the page already on the
   * table. The intro prompt bar and the panel's chat field both land here.
   */
  function handleSubmit(value: string) {
    setPanelOpen(true);
    setLoose(false);

    if (looksLikeInstagramUrl(value)) {
      void canvas.runInstagram(value).then(() => setLoose(true));
    } else {
      void canvas.sendMessage(value).then(() => setLoose(true));
    }
  }

  return (
    <div
      className={`scrapbook-page${panelOpen ? " is-chatting" : ""}${revealed ? " is-revealed" : ""}`}
    >
      {revealed && !panelOpen ? (
        <button
          type="button"
          className="chat-reopen"
          onClick={() => setPanelOpen(true)}
        >
          my board
        </button>
      ) : null}

      <SidePanel
        messages={canvas.messages}
        error={canvas.error}
        busy={canvas.isPending}
        active={panelOpen}
        photos={canvasState.photoBank}
        pinned={canvasState.pinned}
        onClose={() => setPanelOpen(false)}
        onSend={handleSubmit}
        onToggle={canvas.togglePinned}
        onFilesPicked={canvas.addToBank}
      />

      <div className="paper-stage">
        <div className="paper-sheet" aria-hidden="true" />

        {!revealed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="vision-mark" src="/assets/vision.gif" alt="" />
        ) : null}

        <div
          className={`paper-bulldog${clip.dragging ? " is-dragging" : ""}${clipSize.resizing ? " is-resizing" : ""}`}
          style={{
            left: `${clip.pos.x}%`,
            top: `${clip.pos.y}%`,
            width: clipSize.width,
            zIndex: clip.z ?? 60,
          }}
          {...clip.bind}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/bulldog_clip.png" alt="" draggable={false} />
          {done ? null : <ResizeHandle bind={clipSize.bind} />}
        </div>

        <div className={`scrapbook-board${loose ? "" : " is-contained"}`}>
          <ScrapbookCanvas canvasState={canvasState} done={done} />
        </div>
      </div>

      {!revealed ? (
        <div className="prompt-dock">
          <PromptBar
            busy={canvas.isPending}
            status={canvas.status}
            error={canvas.error}
            onSubmit={handleSubmit}
            onFilesPicked={canvas.addToBank}
          />
        </div>
      ) : null}

      <footer className="page-footer">
        {revealed && !done ? (
          <button
            type="button"
            className="keep-page"
            onClick={() => setDone(true)}
          >
            keep this page
          </button>
        ) : null}
        <UnsplashCredits activities={canvasState.activities} />
      </footer>
    </div>
  );
}

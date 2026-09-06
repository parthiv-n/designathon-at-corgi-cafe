"use client";

import { useCallback, useState } from "react";
import { DestinationBackdrop } from "@/components/DestinationBackdrop";
import { PromptBar } from "@/components/PromptBar";
import { ResizeHandle } from "@/components/ResizeHandle";
import { ScrapbookCanvas } from "@/components/ScrapbookCanvas";
import { SidePanel } from "@/components/SidePanel";
import { UnsplashCredits } from "@/components/UnsplashCredits";
import { useBoardDrag } from "@/hooks/useBoardDrag";
import { useCanvasController } from "@/hooks/useCanvasController";
import { useResize } from "@/hooks/useResize";
import { type SubmitOptions } from "@/lib/onboarding";
import { EMPTY_CANVAS, looksLikeInstagramUrl } from "@/lib/vibeBoard";

export function Scrapbook() {
  // The one canvas for the whole page. useCanvasController is per-instance
  // state, so calling it anywhere else would fork the board.
  const canvas = useCanvasController(EMPTY_CANVAS);
  const [done, setDone] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [titlePrompt, setTitlePrompt] = useState("");
  // The board stays masked to the paper until the drop animation has finished;
  // after that scraps can be dragged past the torn edge.
  const [loose, setLoose] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [typedHowTo, setTypedHowTo] = useState(0);
  const onboardingReady = onboarding && typedHowTo >= 4;

  // The bulldog clip is furniture, not content: it drags and resizes but holds
  // no state anyone needs back.
  const clip = useBoardDrag({ x: 77, y: -11 }, "paper-stage", "chrome");
  const clipSize = useResize(146, 64, 220);

  const { canvasState } = canvas;
  const revealed =
    canvasState.activities.length > 0 || !!canvasState.originalImage;
  // Wallpaper is a separate destination photo. Never reuse a card, hero, or
  // bank image -- those already live on the page.
  const destinationImage = canvasState.backdropImage;

  const markHowToTyped = useCallback(() => {
    setTypedHowTo((count) => count + 1);
  }, []);

  function clearTutorial() {
    setOnboarding(false);
    setTypedHowTo(0);
  }

  /**
   * One entry point, two features. An Instagram link is a new page to build;
   * anything else is a note to the director about the page already on the
   * table. The intro prompt bar and the panel's chat field both land here.
   *
   * `isOnboarding` is the only thing that starts the how-to — the prompt
   * string is just what we put in the bar so it looks like a normal ask.
   */
  function handleSubmit(value: string, options?: SubmitOptions) {
    if (options?.isOnboarding) {
      setLoose(false);
      setOnboarding(true);
      setTypedHowTo(0);
      setPanelOpen(true);
      return;
    }

    clearTutorial();
    setPanelOpen(true);
    setLoose(false);

    if (looksLikeInstagramUrl(value)) {
      void canvas.runInstagram(value).then(() => setLoose(true));
    } else {
      setTitlePrompt((current) => current || value);
      void canvas.sendMessage(value).then(() => setLoose(true));
    }
  }

  function handleFiles(urls: string[]) {
    clearTutorial();
    canvas.addToBank(urls);
  }

  return (
    <div
      className={`scrapbook-page${panelOpen ? " is-chatting" : ""}${revealed ? " is-revealed" : ""}`}
    >
      <DestinationBackdrop src={destinationImage} />

      {(revealed || onboarding) && !panelOpen ? (
        <button
          type="button"
          className="chat-reopen"
          onClick={() => setPanelOpen(true)}
        >
          {onboarding && !revealed ? "how-to" : "my board"}
        </button>
      ) : null}

      <SidePanel
        messages={canvas.messages}
        error={canvas.error}
        busy={canvas.isPending}
        active={panelOpen}
        photos={canvasState.photoBank}
        pinned={canvasState.pinned}
        labels={canvasState.post.photoLabels ?? {}}
        onClose={() => setPanelOpen(false)}
        onSend={handleSubmit}
        onToggle={canvas.togglePinned}
        onFilesPicked={handleFiles}
        howTo={onboarding}
        onHowToTyped={markHowToTyped}
        onboardingReady={onboardingReady}
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
          <ScrapbookCanvas
            canvasState={canvasState}
            done={done}
            titlePrompt={
              titlePrompt || canvasState.post.place || canvasState.vibeSummary
            }
          />
        </div>
      </div>

      {!revealed ? (
        <div className="prompt-dock">
          <PromptBar
            busy={canvas.isPending}
            status={canvas.status}
            error={canvas.error}
            onSubmit={handleSubmit}
            onFilesPicked={handleFiles}
            showHowTo={!onboarding}
            onboardingReady={onboardingReady}
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

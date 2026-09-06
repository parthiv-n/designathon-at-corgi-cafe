"use client";

import { useState } from "react";
import { PaletteStrip } from "@/components/PaletteStrip";
import { PromptBar } from "@/components/PromptBar";
import { ScrapbookCanvas } from "@/components/ScrapbookCanvas";

export function Scrapbook() {
  const [revealed, setRevealed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function handleSubmit(value: string) {
    setBusy(true);
    setDone(false);
    setPrompt(value);
    setRevealed(true);
    setGeneration((count) => count + 1);
    window.setTimeout(() => setBusy(false), 420);
  }

  return (
    <div className={`scrapbook-page${done ? " is-done" : ""}`}>
      <PaletteStrip />
      <div className="paper-stage">
        <div className="paper-sheet" aria-hidden="true" />
        <div className="scrapbook-board">
          <ScrapbookCanvas
            revealed={revealed}
            generation={generation}
            prompt={prompt}
            done={done}
          />
        </div>
      </div>
      <div className="prompt-dock">
        <PromptBar busy={busy || done} onSubmit={handleSubmit} />
        {revealed && !done ? (
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

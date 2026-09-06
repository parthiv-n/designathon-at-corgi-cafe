"use client";

import { useRef, useState } from "react";

export function PromptBar({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [attached, setAttached] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next || busy) return;
    onSubmit(next);
  }

  return (
    <form className="prompt-bar" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="vibe-input">
        Describe the trip vibe
      </label>
      <button
        type="button"
        className="prompt-clip"
        aria-label="Attach images"
        onClick={() => fileRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
          <path
            d="M8.5 12.5 14 7a2.8 2.8 0 1 1 4 4l-8.2 8.1a4 4 0 0 1-5.7-5.6L12.4 5.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {attached > 0 ? <span className="prompt-clip-dot" /> : null}
      </button>
      <input
        id="vibe-input"
        className="prompt-input"
        type="text"
        value={value}
        autoComplete="off"
        placeholder="what's the vibe?"
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="submit"
        className={`prompt-send${value.trim() ? " is-ready" : ""}`}
        disabled={busy || !value.trim()}
        aria-label="Generate scrapbook"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
          <path
            d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => setAttached(event.target.files?.length ?? 0)}
      />
    </form>
  );
}

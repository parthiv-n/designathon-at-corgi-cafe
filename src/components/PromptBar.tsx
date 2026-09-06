"use client";

import { useEffect, useRef, useState } from "react";

export function PromptBar({
  busy,
  hasBoard,
  onSubmit,
  onFilesPicked,
}: {
  busy: boolean;
  /** Once a page exists the bar stops asking for a link and starts taking notes. */
  hasBoard: boolean;
  onSubmit: (value: string) => void;
  onFilesPicked: (urls: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [attached, setAttached] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  // Object URLs live until they are revoked, so hand them back on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function submit() {
    const next = value.trim();
    if (!next || busy) return;
    onSubmit(next);
    setValue("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleFiles(files: FileList | null) {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;

    const urls = picked.map((file) => URL.createObjectURL(file));
    objectUrls.current.push(...urls);
    setAttached((count) => count + urls.length);
    onFilesPicked(urls);
  }

  return (
    <form className="prompt-bar" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="vibe-input">
        {hasBoard
          ? "Tell the page what to change"
          : "Paste an Instagram link to build a page"}
      </label>
      <button
        type="button"
        className="prompt-clip"
        aria-label="Add your own photos to the bank"
        title="add your own photos to the bank"
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
        placeholder={
          hasBoard ? "what should change?" : "paste an instagram link"
        }
        onChange={(event) => setValue(event.target.value)}
        // Implicit form submission is easy to lose (a disabled submit button
        // suppresses it, and some embedded browsers never fire it at all).
        // Enter is the main way anyone uses this bar, so handle it outright.
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
      />
      <button
        type="submit"
        className={`prompt-send${value.trim() ? " is-ready" : ""}`}
        disabled={busy || !value.trim()}
        aria-label={hasBoard ? "Send to the page" : "Build the page"}
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
        onChange={(event) => handleFiles(event.target.files)}
      />
    </form>
  );
}

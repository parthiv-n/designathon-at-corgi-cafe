"use client";

import { useEffect, useRef, useState } from "react";
import { TypewriterText } from "@/components/TypewriterText";
import { HOW_TO_PROMPT, type SubmitOptions } from "@/lib/onboarding";

const VIBE_PLACEHOLDER = "upload your inspo or write a prompt";

/**
 * The intro bar, shown only until a board exists. After that the side panel's
 * chat field takes over, so this never needs a "what should change?" mode.
 */
export function PromptBar({
  busy,
  status,
  error,
  onSubmit,
  onFilesPicked,
  showHowTo = false,
  onboardingReady = false,
}: {
  busy: boolean;
  /** What the scrape is doing, written under the bar while it runs. */
  status: string;
  error: string | null;
  onSubmit: (value: string, options?: SubmitOptions) => void;
  onFilesPicked: (urls: string[]) => void;
  /** Quiet how-to link. Hidden once the tutorial has started. */
  showHowTo?: boolean;
  /** Cards have finished writing — clear the demo query and focus. */
  onboardingReady?: boolean;
}) {
  const [value, setValue] = useState("");
  const [attached, setAttached] = useState(0);
  const [typing, setTyping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  const empty = value.length === 0;

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(() => setTyping(true), reduced ? 0 : 2000);
    return () => window.clearTimeout(timer);
  }, []);

  // Object URLs live until they are revoked, so hand them back on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  if (onboardingReady && value.length > 0) {
    setValue("");
  }

  useEffect(() => {
    if (!onboardingReady) return;
    inputRef.current?.focus();
  }, [onboardingReady]);

  function submit(options?: SubmitOptions) {
    const next = value.trim();
    if (!next || busy) return;
    onSubmit(next, options);
    if (!options?.isOnboarding) setValue("");
  }

  function startHowTo() {
    if (busy || !showHowTo) return;
    setValue(HOW_TO_PROMPT);
    window.requestAnimationFrame(() => {
      onSubmit(HOW_TO_PROMPT, { isOnboarding: true });
    });
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
    <>
      <form className="prompt-bar" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="vibe-input">
          Describe the trip vibe
        </label>
        <button
          type="button"
          className="prompt-clip"
          aria-label="Add your own photos to the gallery"
          title="add your own photos to the gallery"
          onClick={() => fileRef.current?.click()}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            aria-hidden
          >
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
        <div className="prompt-field">
          <span className={`prompt-ghost${empty ? "" : " is-away"}`} aria-hidden>
            <TypewriterText
              text={VIBE_PLACEHOLDER}
              active={typing}
              persistCaret={empty}
              caretAt="start"
            />
          </span>
          <input
            ref={inputRef}
            id="vibe-input"
            className={`prompt-input${empty ? " has-ghost" : ""}`}
            type="text"
            value={value}
            autoComplete="off"
            placeholder={VIBE_PLACEHOLDER}
            onChange={(event) => setValue(event.target.value)}
            // Implicit form submission is easy to lose (a disabled submit
            // button suppresses it, and some embedded browsers never fire it at
            // all). Enter is the main way anyone uses this bar, so handle it
            // outright.
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit();
            }}
          />
        </div>
        <button
          type="submit"
          className={`prompt-send${value.trim() ? " is-ready" : ""}`}
          disabled={busy || !value.trim()}
          aria-label="Generate scrapbook"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            aria-hidden
          >
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

      {/*
       * Before the board exists the panel is empty, so a failed scrape would
       * otherwise report nowhere. This is the only status surface on the intro
       * screen.
       */}
      {showHowTo ? (
        <button
          type="button"
          className="prompt-howto"
          aria-label="Show a short how-to in chat"
          onClick={startHowTo}
          disabled={busy}
        >
          first time? here&apos;s a how-to.
        </button>
      ) : null}

      <p className={`prompt-status${error ? " is-error" : ""}`} aria-live="polite">
        {error ?? status}
      </p>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { TypewriterText } from "@/components/TypewriterText";
import {
  HOW_TO_PROMPT,
  HOW_TO_REPLIES,
  type SubmitOptions,
} from "@/lib/onboarding";
import { displayPhotoUrl, type ChatMessage } from "@/lib/vibeBoard";

type Tab = "chat" | "gallery";

/** How many empty slots the gallery shows before anything has been scraped. */
const EMPTY_SLOTS = 6;

/**
 * The glass panel down the left edge. Two tabs over one surface:
 *
 * - "my board" is the conversation with the director.
 * - "gallery" is every photo the scrape pulled, plus anything dropped in by
 *   hand. Clicking a chip pins that photo to the page; clicking a pinned one
 *   takes it back off.
 *
 * Both used to be separate furniture -- a rail down the left edge and a slip
 * under the prompt bar. Tabs put them on one surface and give the board back
 * its margins.
 */
export function SidePanel({
  messages,
  error,
  busy,
  status,
  active,
  photos,
  pinned,
  labels,
  onClose,
  onSend,
  onToggle,
  onFilesPicked,
  howTo = false,
  onHowToTyped,
  onboardingReady = false,
}: {
  messages: ChatMessage[];
  error: string | null;
  busy: boolean;
  /** The step the server is on, e.g. "collecting photos". Empty when idle. */
  status: string;
  active: boolean;
  photos: string[];
  pinned: string[];
  /** Photo URL -> the place the post's caption named for it. Often empty. */
  labels: Record<string, string>;
  onClose: () => void;
  onSend: (value: string, options?: SubmitOptions) => void;
  onToggle: (url: string) => void;
  onFilesPicked: (urls: string[]) => void;
  howTo?: boolean;
  onHowToTyped?: () => void;
  onboardingReady?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("chat");
  const [value, setValue] = useState("");
  // Instagram CDN URLs are signed and occasionally 403 from the browser. A chip
  // that cannot load is dropped rather than left as a broken frame.
  const [broken, setBroken] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  const usable = photos.filter((src) => !broken.includes(src));

  // Object URLs live until they are revoked, so hand them back on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || tab !== "chat") return;
    log.scrollTop = log.scrollHeight;
  }, [messages, error, busy, tab, howTo]);

  useEffect(() => {
    if (!active || tab !== "chat") return;
    if (howTo && !onboardingReady) return;
    if (!howTo && messages.length === 0) return;
    inputRef.current?.focus();
  }, [active, tab, messages.length, howTo, onboardingReady]);

  function send() {
    const next = value.trim();
    if (!next || busy) return;
    setValue("");
    onSend(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    send();
  }

  function handleFiles(files: FileList | null) {
    const picked = Array.from(files ?? []);
    if (picked.length === 0) return;

    const urls = picked.map((file) => URL.createObjectURL(file));
    objectUrls.current.push(...urls);
    onFilesPicked(urls);
    // Show them what they just added rather than leaving it on the chat tab.
    setTab("gallery");
  }

  return (
    <aside className="chat-panel" aria-label="Board panel">
      <header className="chat-head">
        <div className="panel-tabs" role="tablist" aria-label="Panel sections">
          <button
            type="button"
            role="tab"
            id="tab-chat"
            aria-selected={tab === "chat"}
            aria-controls="panel-chat"
            className={`panel-tab${tab === "chat" ? " is-active" : ""}`}
            onClick={() => setTab("chat")}
          >
            my board
          </button>
          <button
            type="button"
            role="tab"
            id="tab-gallery"
            aria-selected={tab === "gallery"}
            aria-controls="panel-gallery"
            className={`panel-tab${tab === "gallery" ? " is-active" : ""}`}
            onClick={() => setTab("gallery")}
          >
            gallery
            {usable.length > 0 ? (
              <span className="panel-tab-count">{usable.length}</span>
            ) : null}
          </button>
        </div>
        <button
          type="button"
          className="chat-close"
          aria-label="Close panel"
          onClick={onClose}
        >
          &times;
        </button>
      </header>

      {tab === "chat" ? (
        <div
          ref={logRef}
          className="chat-log"
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
        >
          {howTo ? (
            <HowToThread onReplyTyped={onHowToTyped} />
          ) : (
            messages.map((message, index) => (
              <p
                key={`${message.role}-${index}`}
                className={`chat-bubble is-${message.role}`}
              >
                {message.content}
              </p>
            ))
          )}
          {busy && !howTo ? (
            <div
              className="chat-bubble is-assistant is-loading"
              role="status"
              aria-live="polite"
              aria-label="The chatbot is working"
            >
              <svg
                className="chat-loading-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="34 16"
                />
              </svg>
              {/*
                * Named steps rather than a single "thinking": a board takes
                * the better part of half a minute to build, and the wait
                * reads as a hang unless it can show it is moving. The label
                * comes off the server as each step starts, so it is the work
                * actually in flight and not a timer guessing at it.
                */}
              <span key={status} className="chat-loading-step">
                {status || 'thinking'}
              </span>
            </div>
          ) : null}
          {error ? (
            <p className="chat-bubble is-assistant is-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className="gallery-log"
          id="panel-gallery"
          role="tabpanel"
          aria-labelledby="tab-gallery"
        >
          {usable.length === 0 ? (
            <>
              <ol className="photo-bank-chips">
                {Array.from({ length: EMPTY_SLOTS }, (_, index) => (
                  <li
                    key={index}
                    className="photo-bank-chip is-blank"
                    aria-hidden
                  />
                ))}
              </ol>
              <p className="photo-bank-hint">
                {busy ? "developing..." : "paste an instagram link"}
              </p>
            </>
          ) : (
            <ol className="photo-bank-chips">
              {usable.map((src, index) => {
                const isPinned = pinned.includes(src);

                return (
                  <li
                    key={src}
                    className={`photo-bank-chip${isPinned ? " is-pinned" : ""}`}
                    style={{ animationDelay: `${120 + index * 90}ms` }}
                  >
                    <button
                      type="button"
                      className="photo-bank-button"
                      aria-pressed={isPinned}
                      aria-label={
                        isPinned
                          ? `${labels[src] ?? `Photo ${index + 1} of ${usable.length}`}. Pinned to the page. Click to take it off.`
                          : `${labels[src] ?? `Photo ${index + 1} of ${usable.length}`}. Click to pin it to the page.`
                      }
                      onClick={() => onToggle(src)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayPhotoUrl(src)}
                        alt=""
                        loading="lazy"
                        onError={() =>
                          setBroken((current) =>
                            current.includes(src) ? current : [...current, src],
                          )
                        }
                      />
                      {isPinned ? (
                        <span className="photo-bank-tick" aria-hidden>
                          &#10003;
                        </span>
                      ) : null}
                    </button>
                    {labels[src] ? (
                      <span className="photo-bank-caption">{labels[src]}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-input">
          Tweak the board
        </label>
        <button
          type="button"
          className="chat-clip"
          aria-label="Add your own photos to the gallery"
          title="add your own photos to the gallery"
          onClick={() => fileRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
            <path
              d="M8.5 12.5 14 7a2.8 2.8 0 1 1 4 4l-8.2 8.1a4 4 0 0 1-5.7-5.6L12.4 5.2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="chat-field">
          {value.length === 0 ? (
            <span className="chat-caret" aria-hidden />
          ) : null}
          <input
            ref={inputRef}
            id="chat-input"
            className="chat-input"
            type="text"
            value={value}
            autoComplete="off"
            placeholder="tweak the board..."
            onChange={(event) => setValue(event.target.value)}
            // Implicit form submission is easy to lose (a disabled submit
            // button suppresses it), and Enter is how anyone actually uses this
            // field, so handle it outright.
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
          />
        </div>
        <button
          type="submit"
          className={`chat-send${value.trim() ? " is-ready" : ""}`}
          disabled={busy || !value.trim()}
          aria-label="Send tweak"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
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
    </aside>
  );
}

function HowToThread({ onReplyTyped }: { onReplyTyped?: () => void }) {
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(() => setStep(0), reduced ? 0 : 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const log = document.getElementById("panel-chat");
    if (log) log.scrollTop = log.scrollHeight;
  }, [step]);

  function handleTyped() {
    onReplyTyped?.();
    setStep((current) => current + 1);
  }

  return (
    <>
      <p className="chat-bubble is-user">{HOW_TO_PROMPT}</p>
      {HOW_TO_REPLIES.slice(0, step + 1).map((reply, index) => (
        <p
          key={reply.id}
          className={`chat-bubble is-assistant${reply.cta ? " is-howto-cta" : ""}`}
        >
          <TypewriterText
            text={reply.text}
            active={index === step}
            speed="fast"
            onComplete={index === step ? handleTyped : undefined}
          />
        </p>
      ))}
    </>
  );
}

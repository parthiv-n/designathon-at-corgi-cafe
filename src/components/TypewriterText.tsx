"use client";

import { useEffect, useRef, useState } from "react";
import { HandText } from "@/lib/handText";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TypewriterText({
  text,
  active,
  persistCaret = false,
  caretAt = "end",
  className,
  onComplete,
}: {
  text: string;
  active: boolean;
  persistCaret?: boolean;
  caretAt?: "start" | "end";
  className?: string;
  onComplete?: () => void;
}) {
  const [shown, setShown] = useState("");
  const announced = useRef(false);
  const done = shown.length >= text.length && text.length > 0;

  useEffect(() => {
    announced.current = false;
  }, [text, active]);

  useEffect(() => {
    if (!done || !onComplete || announced.current) return;
    announced.current = true;
    onComplete();
  }, [done, onComplete]);

  useEffect(() => {
    if (!active || !text) return;

    if (prefersReducedMotion()) {
      const frame = window.requestAnimationFrame(() => setShown(text));
      return () => window.cancelAnimationFrame(frame);
    }

    let index = 0;
    let timer = 0;

    const tick = () => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) return;

      const ch = text[index - 1];
      let delay = 48 + Math.random() * 90;
      if (".!?,".includes(ch)) delay += 160 + Math.random() * 100;
      if (ch === "—" || ch === "-") delay += 90;
      if (ch === " ") delay += 16 + Math.random() * 24;
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, 140);
    return () => window.clearTimeout(timer);
  }, [text, active]);

  const caret =
    active && (!done || persistCaret) ? (
      <span className="type-caret" aria-hidden />
    ) : null;

  return (
    <span className={className}>
      {caretAt === "start" ? caret : null}
      <HandText text={shown} />
      {caretAt === "end" ? caret : null}
    </span>
  );
}

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
  speed = "normal",
}: {
  text: string;
  active: boolean;
  persistCaret?: boolean;
  caretAt?: "start" | "end";
  className?: string;
  onComplete?: () => void;
  speed?: "normal" | "fast";
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
      const fast = speed === "fast";
      let delay = fast ? 8 + Math.random() * 8 : 48 + Math.random() * 90;
      if (".!?,".includes(ch)) delay += fast ? 28 : 160 + Math.random() * 100;
      if (ch === "—" || ch === "-") delay += fast ? 14 : 90;
      if (ch === " ") delay += fast ? 3 : 16 + Math.random() * 24;
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, speed === "fast" ? 20 : 140);
    return () => window.clearTimeout(timer);
  }, [text, active, speed]);

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

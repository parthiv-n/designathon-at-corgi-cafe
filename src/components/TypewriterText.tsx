"use client";

import { useEffect, useState } from "react";
import { HandText } from "@/lib/handText";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TypewriterText({
  text,
  active,
  persistCaret = false,
  className,
}: {
  text: string;
  active: boolean;
  persistCaret?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState("");
  const done = shown.length >= text.length && text.length > 0;

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

  return (
    <span className={className}>
      <HandText text={shown} />
      {active && (!done || persistCaret) ? (
        <span className="type-caret" aria-hidden />
      ) : null}
    </span>
  );
}

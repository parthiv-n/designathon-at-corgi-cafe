"use client";

import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TypewriterText({
  text,
  active,
  className,
}: {
  text: string;
  active: boolean;
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
      let delay = 24 + Math.random() * 72;
      if (".!?,".includes(ch)) delay += 130 + Math.random() * 90;
      if (ch === "—" || ch === "-") delay += 70;
      if (ch === " ") delay += 8 + Math.random() * 18;
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, 90);
    return () => window.clearTimeout(timer);
  }, [text, active]);

  return (
    <span className={className}>
      {shown}
      {active && !done ? (
        <span className="type-caret" aria-hidden>
          ▍
        </span>
      ) : null}
    </span>
  );
}

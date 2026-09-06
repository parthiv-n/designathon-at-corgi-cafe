"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export function useResize(initialWidth: number, min = 72, max = 560) {
  const [width, setWidth] = useState(initialWidth);
  const [resizing, setResizing] = useState(false);
  const active = useRef(false);
  const start = useRef({ w: initialWidth, x: 0 });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      active.current = true;
      setResizing(true);
      start.current = { w: width, x: event.clientX };
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!active.current) return;
      const next = start.current.w + event.clientX - start.current.x;
      setWidth(Math.min(max, Math.max(min, next)));
    },
    [max, min],
  );

  const onPointerUp = useCallback(() => {
    active.current = false;
    setResizing(false);
  }, []);

  return {
    width,
    resizing,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

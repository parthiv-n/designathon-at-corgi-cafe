"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

let layer = 70;

type Start = {
  x: number;
  y: number;
  px: number;
  py: number;
  bw: number;
  bh: number;
};

export function useBoardDrag(
  initial: { x: number; y: number },
  boardClass = "scrapbook-board",
  stack: "photo" | "text" | "chrome" = "photo",
) {
  const [pos, setPos] = useState(initial);
  const [z, setZ] = useState<number | undefined>();
  const [dragging, setDragging] = useState(false);
  const [settled, setSettled] = useState(false);
  const dragged = useRef(false);
  const active = useRef(false);
  const start = useRef<Start>({ x: 0, y: 0, px: 0, py: 0, bw: 1, bh: 1 });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const board = event.currentTarget.closest(`.${boardClass}`);
      if (!board) return;

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = board.getBoundingClientRect();
      active.current = true;
      dragged.current = false;
      setSettled(true);
      setDragging(true);
      layer += 1;
      setZ(
        stack === "text"
          ? 50 + layer
          : stack === "chrome"
            ? layer
            : Math.min(38, 12 + (layer % 26)),
      );
      start.current = {
        x: pos.x,
        y: pos.y,
        px: event.clientX,
        py: event.clientY,
        bw: rect.width,
        bh: rect.height,
      };
    },
    [boardClass, pos.x, pos.y, stack],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!active.current) return;
    const dx = event.clientX - start.current.px;
    const dy = event.clientY - start.current.py;
    if (Math.hypot(dx, dy) > 5) dragged.current = true;
    setPos({
      x: start.current.x + (dx / start.current.bw) * 100,
      y: start.current.y + (dy / start.current.bh) * 100,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    active.current = false;
    setDragging(false);
  }, []);

  return {
    pos,
    z,
    dragging,
    settled,
    didDrag: () => dragged.current,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Turns a scrap by dragging a handle around it.
 *
 * The angle follows the pointer's bearing from the scrap's centre rather than
 * its raw movement, so the piece tracks your hand however far out you grab it.
 * Tape in particular is unusable without this: a strip is only convincing at
 * the angle someone actually tore it off at.
 */
export function useRotate(initial: number) {
  const [angle, setAngle] = useState(initial);
  const [rotating, setRotating] = useState(false);
  const active = useRef(false);
  const origin = useRef({ x: 0, y: 0, angle: initial, bearing: 0 });

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;

      // The handle is a child of the scrap, so the scrap is what we measure.
      const host = event.currentTarget.parentElement;
      if (!host) return;

      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const box = host.getBoundingClientRect();
      const centreX = box.left + box.width / 2;
      const centreY = box.top + box.height / 2;

      active.current = true;
      setRotating(true);
      origin.current = {
        x: centreX,
        y: centreY,
        angle,
        bearing: Math.atan2(event.clientY - centreY, event.clientX - centreX),
      };
    },
    [angle],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!active.current) return;

    const { x, y, angle: from, bearing } = origin.current;
    const now = Math.atan2(event.clientY - y, event.clientX - x);
    setAngle(from + ((now - bearing) * 180) / Math.PI);
  }, []);

  const onPointerUp = useCallback(() => {
    active.current = false;
    setRotating(false);
  }, []);

  return {
    angle,
    rotating,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

import type { PointerEvent } from "react";

export function ResizeHandle({
  bind,
}: {
  bind: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
}) {
  return (
    <button
      type="button"
      className="resize-handle"
      aria-label="Resize"
      {...bind}
    />
  );
}

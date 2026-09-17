import type { PointerEvent } from "react";

export function RotateHandle({
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
      className="rotate-handle"
      aria-label="Rotate"
      {...bind}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path
          d="M13 8a5 5 0 1 1-1.7-3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M12.9 1.6v3.1H9.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

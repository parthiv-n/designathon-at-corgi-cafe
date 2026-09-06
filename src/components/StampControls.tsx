export function StampControls({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="stamp-controls">
      <button
        type="button"
        className="stamp-mark stamp-no"
        aria-label="Remove this card"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="3.4 2.6"
          />
          <path
            d="M14 14.5 26 26.2M25.6 14.2 14.2 26.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

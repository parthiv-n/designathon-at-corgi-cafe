export function StampControls({
  onAccept,
  onReject,
}: {
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="stamp-controls">
      <button
        type="button"
        className="stamp-mark stamp-yes"
        aria-label="Keep this card"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onAccept();
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
            strokeDasharray="4 2.2"
          />
          <path
            d="M12 21.2 17.4 27 28.2 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="stamp-mark stamp-no"
        aria-label="Reject this card"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onReject();
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

const ASSET_COUNT = 33;

const ASSET_SLOTS = [
  { top: "8%", left: "2%" },
  { top: "12%", right: "3%" },
  { bottom: "5%", right: "9%" },
  { bottom: "7%", left: "7%" },
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/**
 * A stable random-looking selection for each generated board. Keeping the
 * selection deterministic prevents decorative assets jumping on every render.
 */
export function BoardAssets({ seed }: { seed: string }) {
  const count = 3 + (hash(seed) % 2);
  const choices = Array.from({ length: ASSET_COUNT }, (_, assetIndex) => ({
    assetIndex,
    score: hash(`${seed}-asset-${assetIndex}`),
  }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count);

  const assets = ASSET_SLOTS.slice(0, count).map((slot, index) => {
    const assetIndex = choices[index].assetIndex;
    const variation = hash(`${seed}-position-${index}`);
    const rotate = -13 + (variation % 27);
    const width = 58 + (variation % 34);

    return { assetIndex, index, rotate, slot, width };
  });

  return (
    <div className="board-assets" aria-hidden>
      {assets.map(({ assetIndex, index, rotate, slot, width }) => (
        // These are transparent decorative scans, served as-is to retain edges.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${assetIndex}-${index}`}
          src={`/ephemera/ephemera-${String(assetIndex).padStart(2, "0")}.png`}
          alt=""
          style={{
            ...slot,
            width,
            rotate: `${rotate}deg`,
          }}
          draggable={false}
        />
      ))}
    </div>
  );
}

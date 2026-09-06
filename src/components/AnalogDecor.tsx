/* eslint-disable @next/next/no-img-element */
import type { DecorAsset } from "@/data/mock";

export function AnalogDecor({ items }: { items: DecorAsset[] }) {
  if (!items.length) return null;

  return (
    <>
      {items.map((item, index) => (
        <img
          key={`${item.src}-${index}`}
          className={`ephemera-asset is-${item.kind}`}
          src={item.src}
          alt=""
          style={{
            top: item.top,
            left: item.left,
            right: item.right,
            bottom: item.bottom,
            width: item.width,
            transform: `rotate(${item.rotate}deg)`,
          }}
        />
      ))}
    </>
  );
}

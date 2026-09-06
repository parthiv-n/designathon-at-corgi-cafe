import { PALETTE } from "@/data/mock";

export function PaletteStrip() {
  return (
    <aside className="palette-strip" aria-label="Board colour palette">
      <div className="palette-pin" aria-hidden />
      <ol className="palette-chips">
        {PALETTE.map((swatch, index) => (
          <li
            key={swatch.hex}
            className="palette-chip"
            style={{ animationDelay: `${120 + index * 90}ms` }}
          >
            <span
              className="palette-swatch"
              style={{ backgroundColor: swatch.hex }}
              title={swatch.name}
            />
            <span className="palette-hex">{swatch.hex}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

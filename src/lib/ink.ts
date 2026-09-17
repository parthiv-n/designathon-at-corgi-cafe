/**
 * Keeping handwriting readable on whatever sheet it lands on.
 *
 * A note's ink is pulled from the board's palette, and that palette is sampled
 * off the user's photos -- so it is regularly a pale sand or a hot coral, and
 * a pale sand on cream paper is decoration rather than text. The hue is worth
 * keeping (it is what ties the note to the board), the lightness is not, so
 * this walks the lightness until the pair clears a contrast ratio and leaves
 * everything else alone.
 */

/** WCAG AA for body text is 4.5:1. Handwriting is thin, so aim past it. */
const MIN_CONTRAST = 5.2;

type Rgb = [number, number, number];

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** sRGB relative luminance, per WCAG 2.1. */
function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = luminance(a);
  const second = luminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return [0, 0, lightness];

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  return [hue, saturation, lightness];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) {
    const value = l * 255;
    return [value, value, value];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const channel = (t: number) => {
    let shifted = t;
    if (shifted < 0) shifted += 1;
    if (shifted > 1) shifted -= 1;
    if (shifted < 1 / 6) return p + (q - p) * 6 * shifted;
    if (shifted < 1 / 2) return q;
    if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6;
    return p;
  };

  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/**
 * The nearest version of `ink` that is readable on `paper`.
 *
 * Moves away from the paper's lightness in small steps -- darker on a cream
 * sheet, lighter on brown kraft -- and stops as soon as the contrast clears.
 * The hue survives, so a coral palette still writes in a deep rust rather than
 * a generic black.
 */
export function legibleInk(
  ink: string,
  paper: string,
  minContrast = MIN_CONTRAST,
): string {
  const paperRgb = parseHex(paper);
  if (!paperRgb) return "#2a2420";

  // The model writes the palette, so a malformed hex is a live possibility.
  // Fall back to neutral ink and let it go through the same search, rather
  // than returning a fixed dark that has never been checked against the sheet.
  const inkRgb = parseHex(ink) ?? [42, 36, 32];
  if (contrastRatio(inkRgb, paperRgb) >= minContrast) return toHex(inkRgb);

  const [hue, saturation, lightness] = rgbToHsl(inkRgb);
  // Very saturated ink goes neon once it is pushed dark, so rein it in first.
  const tamed = Math.min(saturation, 0.72);

  // Walk the whole lightness range rather than picking a direction up front.
  // A mid-tone sheet like brown kraft can be easier to read dark ink on than
  // light, and guessing wrong there is how you end up with the least legible
  // option of the two.
  let closest: { hex: string; distance: number } | null = null;
  let strongest = { hex: toHex(inkRgb), ratio: contrastRatio(inkRgb, paperRgb) };

  const steps = 60;
  for (let step = 0; step <= steps; step += 1) {
    const candidateLightness = 0.04 + (step / steps) * 0.92;
    const candidate = hslToRgb([hue, tamed, candidateLightness]);
    const ratio = contrastRatio(candidate, paperRgb);

    if (ratio > strongest.ratio) {
      strongest = { hex: toHex(candidate), ratio };
    }

    if (ratio >= minContrast) {
      // Among the options that clear the bar, take the one that moved least:
      // it keeps the note closest to the colour the board actually chose.
      const distance = Math.abs(candidateLightness - lightness);
      if (!closest || distance < closest.distance) {
        closest = { hex: toHex(candidate), distance };
      }
    }
  }

  // Nothing clears the bar on this sheet -- a mid-grey paper has no readable
  // ink at all. Return the most legible option there is rather than a colour
  // picked for its direction.
  return closest?.hex ?? strongest.hex;
}

/** Plain stock, for a palette entry too grey to tint into anything. */
const NEUTRAL_SLIP = "#f4efe2";

/**
 * A palette colour as sticky-note stock.
 *
 * The palette is sampled off the user's photos, so a board about Tokyo at
 * night hands us `#ff2e88` and `#00e5ff`. A slip printed in either of those
 * neons is a sticker, not a piece of paper -- real note stock is a wash of a
 * colour, not the colour itself. So the hue is kept, which is the part that
 * ties the slip to the board, and the lightness is pushed up into paper's
 * range. Saturation is only reined in, not replaced: a muted hike stays dusty,
 * and a neon board still reads as neon stationery rather than a stack of the
 * same yellow.
 *
 * `wash` nudges lightness so neighbouring slips from the same hue don't match.
 */
export function paperTint(color: string, wash = 0.82): string {
  const rgb = parseHex(color);
  if (!rgb) return NEUTRAL_SLIP;

  const [hue, saturation] = rgbToHsl(rgb);

  // A palette entry that is already near-grey has no hue worth amplifying;
  // forcing saturation onto it would invent a pink from a charcoal.
  if (saturation < 0.06) return NEUTRAL_SLIP;

  const paperSat = Math.min(Math.max(saturation * 0.78, 0.28), 0.72);
  const paperLight = Math.min(Math.max(wash, 0.72), 0.9);

  return toHex(hslToRgb([hue, paperSat, paperLight]));
}

/**
 * Pads a short palette with colours derived from the ones it already has.
 *
 * The swatch strip wants five, and the model regularly returns three. Padding
 * from a fixed default would staple an unrelated neon onto a board of desert
 * ochres, so the extras are grown from the real entries instead: same hue,
 * stepped lighter and darker, which is what a paint chip card looks like
 * anyway. Nothing invented, just more of what the board already is.
 */
export function extendPalette(colors: string[], want: number): string[] {
  const seeds = colors
    .map((color) => parseHex(color))
    .filter((rgb): rgb is Rgb => rgb !== null);

  if (seeds.length === 0) return [];

  const out = seeds.map(toHex);

  // Alternate down and up so the strip does not just fade out at one end.
  const steps = [-0.16, 0.16, -0.3, 0.3];

  for (let i = 0; out.length < want && i < steps.length * seeds.length; i += 1) {
    const [hue, saturation, lightness] = rgbToHsl(seeds[i % seeds.length]);
    const shifted = Math.min(
      Math.max(lightness + steps[Math.floor(i / seeds.length) % steps.length], 0.12),
      0.9,
    );
    const candidate = toHex(hslToRgb([hue, saturation, shifted]));

    if (!out.includes(candidate)) out.push(candidate);
  }

  return out.slice(0, want);
}

/** Uppercase six-digit hex, or null when the model wrote something else. */
export function tidyHex(color: string): string | null {
  const rgb = parseHex(color);
  return rgb ? toHex(rgb).toUpperCase() : null;
}

/**
 * A search-friendly name for the palette's strongest colour.
 *
 * Outfit stock queries append this ("terracotta linen outfit") so the clothes
 * on the board share a temperature with the rest of the page, rather than
 * coming back as generic fashion photography.
 */
export function paletteToneName(colors: string[]): string {
  let best: { hue: number; sat: number; light: number } | null = null;

  for (const color of colors) {
    const rgb = parseHex(color);
    if (!rgb) continue;
    const [hue, sat, light] = rgbToHsl(rgb);
    // Near-black and near-white are the page's contrast, not its mood.
    if (light < 0.14 || light > 0.88) continue;
    if (!best || sat > best.sat) best = { hue, sat, light };
  }

  if (!best) return "neutral";
  if (best.sat < 0.1) {
    if (best.light > 0.62) return "cream";
    if (best.light < 0.38) return "charcoal";
    return "stone";
  }

  const deg = best.hue * 360;
  if (deg < 18 || deg >= 345) return best.light < 0.5 ? "terracotta" : "rose";
  if (deg < 38) return "rust";
  if (deg < 58) return "mustard";
  if (deg < 85) return "olive";
  if (deg < 155) return "forest";
  if (deg < 190) return "teal";
  if (deg < 250) return "navy";
  if (deg < 300) return "plum";
  return "rose";
}

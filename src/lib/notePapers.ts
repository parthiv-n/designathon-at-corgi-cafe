/**
 * The writable area of each torn-paper scan.
 *
 * These scans are not rectangles of paper. They are photographs of paper, with
 * transparent surrounds, tape, bulldog clips, stick-on stars and plaid borders
 * baked in, all at different sizes and angles. A single hardcoded inset --
 * which is what this used to be -- puts the handwriting over the clip on one
 * sheet and off the torn edge entirely on the next.
 *
 * So each sheet was measured instead: draw it to a canvas, take the colour
 * most of the opaque pixels share as the paper itself, and find the largest
 * axis-aligned rectangle of that colour. That rectangle is where writing can
 * safely go, and its mean colour is what the ink has to be legible against.
 */
export interface NotePaper {
  /** Width ÷ height of the scan, for working out the card's real height. */
  aspect: number;
  /** Insets of the writable box, as percentages of the scan. */
  top: number;
  left: number;
  right: number;
  bottom: number;
  /** Mean colour inside the writable box. Drives the ink contrast. */
  tone: string;
}

/**
 * Only sheets whose writable box covers at least half the scan.
 *
 * Nine of the fifteen scans came in under that -- one is 2% paper and 98%
 * bulldog clip -- and no amount of shrinking the type makes a legible note out
 * of them. The last one cut was a wide landscape sheet at 40%: it technically
 * fitted, but only by dropping to 11px where the others sit near 16px, which
 * is exactly the kind of "fits, but nobody can read it" this was meant to fix.
 * Six good sheets is plenty of variety for a page that shows one note at a
 * time.
 *
 * Measured insets are the maximal rectangle, so they sit flush against the
 * clip or the torn edge. `SAFE_MARGIN` pulls the text back off that line.
 */
const SAFE_MARGIN = 2;

const MEASURED: Record<string, NotePaper> = {
  "note-00": { aspect: 1.174, top: 19.1, left: 7.5, right: 8.1, bottom: 9.6, tone: "#e6dec6" },
  "note-01": { aspect: 1.216, top: 21.2, left: 6.3, right: 6.9, bottom: 9.8, tone: "#f1e4db" },
  "note-02": { aspect: 0.909, top: 29.0, left: 6.3, right: 7.5, bottom: 6.8, tone: "#e7e6a8" },
  "note-03": { aspect: 0.924, top: 19.7, left: 5.0, right: 5.0, bottom: 4.6, tone: "#e2dbd1" },
  "note-05": { aspect: 0.911, top: 22.2, left: 6.3, right: 6.3, bottom: 9.1, tone: "#f3f5f4" },
  "note-07": { aspect: 0.889, top: 15.6, left: 14.4, right: 14.4, bottom: 12.2, tone: "#dfd5cf" },
};

export const NOTE_PAPER_NAMES = Object.keys(MEASURED);

/** Falls back to a conservative centre box for a name we have not measured. */
const UNMEASURED: NotePaper = {
  aspect: 1,
  top: 24,
  left: 14,
  right: 14,
  bottom: 14,
  tone: "#e2dbd1",
};

export function notePaperSrc(name: string): string {
  return `/note-cards/${name}.png`;
}

export function notePaperGeometry(name: string): NotePaper {
  const measured = MEASURED[name];
  if (!measured) return UNMEASURED;

  return {
    ...measured,
    top: measured.top + SAFE_MARGIN,
    left: measured.left + SAFE_MARGIN,
    right: measured.right + SAFE_MARGIN,
    bottom: measured.bottom + SAFE_MARGIN,
  };
}

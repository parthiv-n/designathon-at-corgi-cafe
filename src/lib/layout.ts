import type {
  DecorCardData,
  NoteCardData,
  PaletteCardData,
  PhotoAlt,
  PhotoCardData,
  ScrapCard,
} from "@/data/cards";
import type { Activity, CanvasState, PhotoCredit } from "@/lib/vibeBoard";
import { displayPhotoUrl, isFoodOrDrinkStop } from "@/lib/vibeBoard";
import { extendPalette, legibleInk, paperTint, tidyHex } from "@/lib/ink";
import {
  NOTE_PAPER_NAMES,
  notePaperGeometry,
  notePaperSrc,
} from "@/lib/notePapers";

/**
 * Where scraps land on the page.
 *
 * This used to be four hand-tuned quarters, which meant every board anyone
 * ever generated put its photos in the same three places, and a fifth scrap
 * had nowhere to go but on top of one of them. Positions are dealt from a
 * seeded shuffle instead, and each scrap is dropped into whatever space the
 * ones before it left free.
 *
 * Two properties matter and both are load-bearing:
 *
 * 1. Given the same seed and the same cards, the result is identical. The
 *    cards are rebuilt from scratch on every render, so anything else would
 *    make the page twitch continuously.
 * 2. A scrap's position depends only on the seed, its own id, and the scraps
 *    placed *before* it. Adding a card can therefore never move one that is
 *    already on the paper.
 */

type Rect = { x: number; y: number; w: number; h: number };

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Positions are percentages but sizes are pixels, so overlap needs a board to
 * measure against. The stage is fluid, so these are the sizes it lands near on
 * a laptop with the chat panel open -- close enough that scraps that do not
 * overlap here do not overlap there either.
 */
const BOARD = { width: 1000, height: 800 };
const COMPACT_BOARD = { width: 520, height: 440 };

/** Keeps a scrap's whole footprint on the paper rather than just its corner. */
const PAPER: Bounds = { minX: 3, minY: 5, maxX: 97, maxY: 94 };
const COMPACT_PAPER: Bounds = { minX: 2, minY: 4, maxX: 98, maxY: 96 };

/**
 * Furniture that is not a card but still takes up room: the letter beads sit
 * top-left and the bulldog clip bites the top-right corner. Without these the
 * shuffle happily posts a photo over the title.
 */
const RESERVED: Rect[] = [
  { x: 2, y: 3, w: 44, h: 13 },
  { x: 66, y: 0, w: 24, h: 11 },
];

/** How many spots to try before settling for the least-bad one. */
const PLACEMENT_ATTEMPTS = 240;

/** Breathing room between two scraps, as a percentage of the board. */
const GAP = 1.45;


/** Files in /public/washi-tape and /public/ephemera. */
const WASHI_TAPE_COUNT = 45;
const EPHEMERA_COUNT = 33;

/** More than this and the paper reads as a contact sheet, not a page. */
const MAX_PHOTO_CARDS = 5;
const MAX_COMPACT_PHOTO_CARDS = 3;

/** Fewer than this and the paper reads as a board that failed to build. */
const MIN_PHOTO_CARDS = 3;

/**
 * Past this the page is all handwriting and no pictures.
 *
 * Reachable now that every restaurant and bar arrives as a note: ask for six
 * places to eat and, without a ceiling, you get six sheets of paper. The stops
 * beyond it are still in the itinerary and still in the chat, they just do not
 * all get pinned up at once.
 */
const MAX_NOTE_CARDS = 12;
const MAX_COMPACT_NOTE_CARDS = 6;

/** Notes read as marginalia, so they sit narrower than the photos. */
const MAX_NOTE_WORDS = 18;

/** Captions get a little more room, since they are the post's own voice. */
const MAX_CAPTION_WORDS = 26;

/* --- Seeded randomness ------------------------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32. Small, fast, and good enough to scatter paper convincingly. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A private stream of numbers for one purpose on one scrap.
 *
 * Every draw is namespaced by scrap id, so nothing a scrap does can shift the
 * numbers another scrap gets -- which is what lets a new card appear without
 * re-rolling the page.
 */
function streamFor(...parts: (string | number)[]): () => number {
  return mulberry32(hashString(parts.join(":")));
}

/** Inclusive-ish float in [min, max). */
function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length];
}

/* --- Placement -------------------------------------------------------- */

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function centreOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/**
 * How much elbow room a candidate has: the distance to the nearest thing
 * already on the paper, the title and the clip included.
 *
 * Maximising this is what turns "somewhere free" into "spread out". Keeping
 * scraps off the torn edge as well was the obvious next thing to weigh in
 * here, and it measurably backfired -- pulling every scrap toward the middle
 * fights the spreading, and the page ended up more huddled than with no edge
 * term at all. The bounds already guarantee a scrap lands fully on the paper,
 * which is the part that actually matters.
 */
function elbowRoom(candidate: Rect, taken: Rect[]): number {
  const here = centreOf(candidate);
  let nearest = Number.POSITIVE_INFINITY;

  for (const other of taken) {
    const there = centreOf(other);
    nearest = Math.min(nearest, Math.hypot(here.x - there.x, here.y - there.y));
  }

  return nearest;
}

/**
 * Finds a home for one scrap.
 *
 * Deals random spots from the scrap's own stream and takes the roomiest one
 * that touches nothing. Taking the *first* free spot instead -- which is what
 * this did -- is why a three-photo board came out huddled in one corner with
 * half the page bare: on a page that empty almost every spot is free, so the
 * first one dealt always won and nothing ever pushed the scraps apart.
 *
 * When the paper is genuinely full it takes the spot that overlaps least,
 * because a slightly crowded page still beats a scrap dumped off the edge.
 */
function findSpot(
  taken: Rect[],
  seed: string,
  size: { w: number; h: number },
  bounds: Bounds,
): Rect {
  const random = streamFor(seed, "spot");
  const maxX = Math.max(bounds.minX, bounds.maxX - size.w);
  const maxY = Math.max(bounds.minY, bounds.maxY - size.h);

  let crowded: Rect = { x: bounds.minX, y: bounds.minY, ...size };
  let leastOverlap = Number.POSITIVE_INFINITY;

  let roomiest: Rect | null = null;
  let mostRoom = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const candidate: Rect = {
      x: between(random, bounds.minX, maxX),
      y: between(random, bounds.minY, maxY),
      ...size,
    };

    // Test with a margin so scraps do not end up edge to edge, but store the
    // true rect, or the gaps would compound with every card.
    const padded: Rect = {
      x: candidate.x - GAP,
      y: candidate.y - GAP,
      w: size.w + GAP * 2,
      h: size.h + GAP * 2,
    };

    let overlap = 0;
    for (const other of taken) overlap += overlapArea(padded, other);

    if (overlap > 0) {
      if (overlap < leastOverlap) {
        leastOverlap = overlap;
        crowded = candidate;
      }
      continue;
    }

    const room = elbowRoom(candidate, taken);
    // Mild pull off the far corners so three large prints do not each claim an
    // edge and leave the middle of the paper empty. Kept small on purpose:
    // weighting the centre too hard is how every scrap ended up in a huddle.
    const here = centreOf(candidate);
    const inward = 1 - Math.min(1, Math.hypot(here.x - 50, here.y - 52) / 58);
    const score = room + inward * 16;
    if (score > mostRoom) {
      mostRoom = score;
      roomiest = candidate;
    }
  }

  return roomiest ?? crowded;
}

/* --- Content helpers -------------------------------------------------- */

/** A wall of handwriting on a scrap is unreadable; trim to a scannable line. */
function trimNote(text: string, maxWords = MAX_NOTE_WORDS): string {
  // Captions arrive with hard line breaks and emoji bullets; flatten first.
  const flat = text.replace(/\s+/g, " ").trim();
  const words = flat.split(" ");
  if (words.length <= maxWords) return flat;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function uniquePhotoSources(sources: string[]): string[] {
  const seen = new Set<string>();
  return sources.filter((src) => {
    const displayed = displayPhotoUrl(src);
    if (seen.has(displayed)) return false;
    seen.add(displayed);
    return true;
  });
}

/** Accepts leftover string[] from a hot-reloaded session as well as {src,label}. */
function readFillers(
  value: CanvasState["fillerPhotos"] | undefined,
): { src: string; label: string; kind?: "food" | "outfit" }[] {
  return (value ?? []).flatMap((entry) => {
    if (typeof entry === "string") {
      return entry ? [{ src: entry, label: "" }] : [];
    }
    if (entry && typeof entry.src === "string") {
      const kind =
        entry.kind === "food" || entry.kind === "outfit" ? entry.kind : undefined;
      return [{ src: entry.src, label: entry.label ?? "", ...(kind ? { kind } : {}) }];
    }
    return [];
  });
}

/**
 * Other photos from the post, as the reject-stamp pool. This is what wires the
 * bank into the existing gesture: rejecting a card deals the next scraped photo
 * onto it instead of inventing new content.
 */
function bankAlts(
  bank: string[],
  exclude: string | undefined,
  location: string,
  labels: Record<string, string> = {},
): PhotoAlt[] {
  return uniquePhotoSources(bank)
    .filter(
      (src) =>
        !exclude || displayPhotoUrl(src) !== displayPhotoUrl(exclude),
    )
    .map((src) => ({
      src: displayPhotoUrl(src),
      // When the caption numbered its frames, each one is a named place rather
      // than "another photo", so say which.
      alt: labels[src] ?? "A photo from the post",
      location: labels[src]?.toLowerCase() ?? location,
    }));
}

/**
 * A stable paper scan for a note. Keyed off the card id so a note keeps the
 * same sheet across re-renders, and two notes side by side rarely match.
 */
export function notePaperName(id: string): string {
  return pick(streamFor(id, "paper"), NOTE_PAPER_NAMES);
}

/* --- The board -------------------------------------------------------- */

/**
 * Everything the builder needs to hand each scrap a spot, wrapped up so the
 * per-card functions do not each have to re-derive it.
 */
class Page {
  readonly taken: Rect[];

  constructor(
    private readonly seed: string,
    private readonly compact: boolean,
  ) {
    this.taken = [...RESERVED];
  }

  private get bounds(): Bounds {
    return this.compact ? COMPACT_PAPER : PAPER;
  }

  private get board(): { width: number; height: number } {
    return this.compact ? COMPACT_BOARD : BOARD;
  }

  /** A scrap's own stream, so its numbers never depend on the page around it. */
  random(id: string, purpose: string): () => number {
    return streamFor(this.seed, id, purpose);
  }

  toPercent(px: { width: number; height: number }): { w: number; h: number } {
    return {
      w: (px.width / this.board.width) * 100,
      h: (px.height / this.board.height) * 100,
    };
  }

  /** Claims a spot, and blocks anything placed later from using it. */
  claim(id: string, px: { width: number; height: number }): Rect {
    const rect = findSpot(
      this.taken,
      `${this.seed}:${id}`,
      this.toPercent(px),
      this.bounds,
    );
    this.taken.push(rect);
    return rect;
  }

  /**
   * A spot for something decorative. It dodges nothing and blocks nothing, so
   * it stays exactly where it is however the cards around it change.
   */
  loose(id: string, px: { width: number; height: number }, bounds: Bounds): Rect {
    return findSpot([], `${this.seed}:${id}`, this.toPercent(px), bounds);
  }
}

/** Height of a photo scrap: the print itself, plus the slip taped under it. */
function photoHeight(width: number, labelled: boolean): number {
  return Math.round(width * 1.28) + (labelled ? 54 : 8);
}

/** A note is exactly as tall as the scan it is written on. */
function noteHeight(width: number, aspect: number): number {
  return Math.round(width / aspect);
}

/**
 * One written scrap. The three kinds differ only in what they say.
 *
 * Worth having as a function rather than three copies: each one has to pick a
 * sheet, measure it, size itself off that sheet's aspect, claim a spot and
 * force its ink legible against that sheet's tone, and a copy that skipped the
 * last step would put pale ink on cream paper.
 */
function writtenNote(
  page: Page,
  compact: boolean,
  spec: {
    id: string;
    text: string;
    /** Raw palette colour. Made legible against the chosen sheet here. */
    ink: string;
    z: number;
    heading?: string;
    footnote?: string;
    alts: string[];
    /** Captions are the post's own voice and get a wider sheet. */
    wide?: boolean;
  },
): NoteCardData {
  const style = page.random(spec.id, "style");
  const paper = notePaperName(spec.id);
  const geometry = notePaperGeometry(paper);

  const [narrowest, widest] = spec.wide
    ? compact
      ? [148, 188]
      : [186, 232]
    : compact
      ? [140, 182]
      : [174, 218];

  const width = Math.round(between(style, narrowest, widest));
  const spot = page.claim(spec.id, {
    width,
    height: noteHeight(width, geometry.aspect),
  });

  return {
    id: spec.id,
    kind: "note",
    paper: notePaperSrc(paper),
    paperBox: geometry,
    paperAspect: geometry.aspect,
    text: spec.text,
    heading: spec.heading,
    footnote: spec.footnote,
    x: spot.x,
    y: spot.y,
    rotate: Number(between(style, -6, 6).toFixed(2)),
    width,
    cut: Math.floor(between(style, 0, 8)),
    z: spec.z,
    // The palette is sampled off the user's photos, so it is as likely to hand
    // us a pale sand as a deep teal. Force it legible on this sheet.
    ink: legibleInk(spec.ink, geometry.tone),
    alts: spec.alts,
  };
}

/** "$$ · wine bar", skipping whichever half the model left blank. */
function costAndType(activity: Activity): string | undefined {
  const parts = [activity.cost, activity.placeType]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * The board's colours, printed as a paint-chip strip.
 *
 * Placed early and with a stable id so later stops dodge it instead of sitting
 * on it, and so "add some bars" cannot shove the strip to a new corner.
 */
function paletteCard(
  page: Page,
  colors: string[],
  compact: boolean,
): PaletteCardData | null {
  const printed = colors
    .map((color) => tidyHex(color))
    .filter((color): color is string => color !== null);

  if (printed.length === 0) return null;

  const chips =
    printed.length >= 4 ? printed.slice(0, 5) : extendPalette(printed, 5);

  const style = page.random("palette", "style");
  const width = compact ? 70 : 84;
  const height = compact ? 188 : 240;
  const spot = page.claim("palette", { width, height });

  return {
    id: "palette",
    kind: "palette",
    colors: chips,
    x: spot.x,
    y: spot.y,
    rotate: Number(between(style, -4.2, 4.2).toFixed(2)),
    width,
    z: 18,
  };
}

function photoCard(
  page: Page,
  id: string,
  src: string,
  alt: string,
  location: string,
  alts: PhotoAlt[],
  meta: {
    label?: string;
    sublabel?: string;
    credit?: PhotoCredit;
    palette?: string[];
  } = {},
  compact = false,
): PhotoCardData {
  const style = page.random(id, "style");
  const width = compact
    ? Math.round(between(style, 148, 186))
    : Math.round(between(style, 198, 248));

  // A colour per slip, drawn from the board's own palette so a page of them
  // reads as one set of stationery rather than a random assortment. Seeded off
  // the card id, so a slip keeps its colour and two neighbours rarely match.
  const palette = meta.palette?.length ? meta.palette : ["#fdf6b8"];
  const paper = paperTint(
    pick(page.random(id, "slip"), palette),
    between(page.random(id, "slip-wash"), 0.74, 0.88),
  );
  const labelled = Boolean(meta.label);
  const spot = page.claim(id, {
    width,
    height: photoHeight(width, labelled),
  });

  return {
    id,
    kind: "photo",
    src: displayPhotoUrl(src),
    alt,
    location,
    label: meta.label,
    sublabel: meta.sublabel,
    credit: meta.credit,
    slip: { paper, ink: legibleInk("#2a2420", paper) },
    x: spot.x,
    y: spot.y,
    rotate: Number(between(style, -3.4, 3.4).toFixed(2)),
    width,
    cut: Math.floor(between(style, 0, 8)),
    z: 12 + Math.floor(between(style, 0, 8)),
    alts,
  };
}

/**
 * A strip of tape for a photo, laid across one of its corners.
 *
 * Positioned from the photo's opening rect so the page starts out looking
 * taped down, but it is a scrap in its own right from that moment on: drag the
 * photo and the tape stays on the paper, exactly like peeling a print off it.
 */
function tapeFor(
  page: Page,
  photo: PhotoCardData,
  compact: boolean,
): DecorCardData | null {
  const random = page.random(photo.id, "tape");

  // Not every print gets taped. A page where all four corners match reads as a
  // template rather than something anyone assembled.
  if (random() > 0.62) return null;

  const width = Math.round(between(random, compact ? 40 : 56, compact ? 64 : 92));
  const size = page.toPercent({ width, height: width * 0.42 });
  const photoSize = page.toPercent({
    width: photo.width,
    height: photoHeight(photo.width, Boolean(photo.label)),
  });

  // Top-left or top-right corner, hanging over the edge the way tape does.
  const onLeft = random() > 0.5;
  const x = onLeft
    ? photo.x - size.w * 0.34
    : photo.x + photoSize.w - size.w * 0.66;

  return {
    id: `tape-${photo.id}`,
    kind: "decor",
    variant: "washi",
    src: `/washi-tape/tape-${String(
      Math.floor(random() * WASHI_TAPE_COUNT),
    ).padStart(2, "0")}.png`,
    x,
    y: photo.y - size.h * 0.42,
    rotate: Number(between(random, -34, 34).toFixed(1)),
    width,
    z: photo.z + 6,
  };
}

/**
 * The loose paper scraps -- ticket stubs, stamps, postmarks.
 *
 * They live in the margins rather than the middle, which keeps them clear of
 * the photos without having to negotiate with them, and means they hold still
 * when the itinerary grows.
 */
const EPHEMERA_MARGINS: Bounds[] = [
  { minX: 1, minY: 8, maxX: 16, maxY: 46 },
  { minX: 78, minY: 10, maxX: 97, maxY: 44 },
  { minX: 2, minY: 58, maxX: 20, maxY: 92 },
  { minX: 76, minY: 56, maxX: 97, maxY: 92 },
  { minX: 34, minY: 3, maxX: 62, maxY: 16 },
  { minX: 30, minY: 78, maxX: 64, maxY: 92 },
];

function ephemera(page: Page, seed: string, compact: boolean): DecorCardData[] {
  const chooser = streamFor(seed, "ephemera");
  const count = compact ? 2 + Math.floor(chooser() * 2) : 3 + Math.floor(chooser() * 3);

  // Shuffle the margins so which corners get used varies per board too.
  const margins = EPHEMERA_MARGINS.map((bounds, index) => ({
    bounds,
    order: streamFor(seed, "margin", index)(),
  }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count);

  return margins.map(({ bounds }, index) => {
    const id = `ephemera-${index}`;
    const random = page.random(id, "style");
    const width = Math.round(between(random, compact ? 32 : 42, compact ? 54 : 76));
    // The scans are not square and some are noticeably tall, so budget for the
    // worst of them -- an under-estimate here hangs a ticket stub over the
    // torn edge, where the PNG export shears it off.
    const spot = page.loose(id, { width, height: width * 1.3 }, bounds);

    return {
      id,
      kind: "decor" as const,
      variant: "ephemera" as const,
      src: `/ephemera/ephemera-${String(
        Math.floor(random() * EPHEMERA_COUNT),
      ).padStart(2, "0")}.png`,
      x: spot.x,
      y: spot.y,
      rotate: Number(between(random, -16, 16).toFixed(1)),
      width,
      // Under the photos, so dragging a print away uncovers what was beneath.
      z: 4,
    };
  });
}

const SPARKLE_FILES = ["/assets/star.gif", "/assets/sparkle.gif"] as const;

/**
 * Twinkling star stickers. They sit on top of the page rather than claiming a
 * slot, so they decorate the prints instead of shoving them aside.
 */
const SPARKLE_SLOTS: Bounds[] = [
  { minX: 10, minY: 16, maxX: 26, maxY: 34 },
  { minX: 74, minY: 14, maxX: 90, maxY: 32 },
  { minX: 42, minY: 40, maxX: 58, maxY: 56 },
  { minX: 14, minY: 64, maxX: 30, maxY: 82 },
  { minX: 70, minY: 62, maxX: 88, maxY: 80 },
];

function sparkles(page: Page, seed: string, compact: boolean): DecorCardData[] {
  const chooser = streamFor(seed, "sparkle");
  const count = compact ? 2 : 2 + Math.floor(chooser() * 2);

  const slots = SPARKLE_SLOTS.map((bounds, index) => ({
    bounds,
    order: streamFor(seed, "sparkle-slot", index)(),
  }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count);

  return slots.map(({ bounds }, index) => {
    const id = `sparkle-${index}`;
    const random = page.random(id, "style");
    const src = SPARKLE_FILES[Math.floor(random() * SPARKLE_FILES.length)];
    const width = Math.round(
      between(random, compact ? 34 : 42, compact ? 52 : 64),
    );
    const spot = page.loose(id, { width, height: width }, bounds);

    return {
      id,
      kind: "decor" as const,
      variant: "sparkle" as const,
      src,
      x: spot.x,
      y: spot.y,
      rotate: Number(between(random, -18, 18).toFixed(1)),
      width,
      z: 36 + index,
    };
  });
}

/**
 * Turns the live canvas into the scraps on the page.
 *
 * Nothing here is stateful: the cards are derived fresh on every render, and
 * card ids carry the content they were built from so an AI swap remounts just
 * that one card and it re-pins with the drop animation.
 */
export function buildCards(canvas: CanvasState, compact = false): ScrapCard[] {
  const {
    activities,
    photoBank,
    pinned,
    colorPalette,
    originalImage,
    post,
    layoutSeed,
  } = canvas;
  // Set only when the post's caption was a numbered legend of its frames.
  const photoLabels = post.photoLabels ?? {};

  if (activities.length === 0 && !originalImage) return [];

  const page = new Page(layoutSeed || "initial", compact);
  const maxPhotos = compact ? MAX_COMPACT_PHOTO_CARDS : MAX_PHOTO_CARDS;
  const maxNotes = compact ? MAX_COMPACT_NOTE_CARDS : MAX_NOTE_CARDS;
  const photos: PhotoCardData[] = [];
  const notes: NoteCardData[] = [];

  /**
   * Placement order is the one thing here that is not cosmetic.
   *
   * Scraps only dodge what was placed before them, so the fixed-size things go
   * down first and the open-ended lists follow. That way "add some bars"
   * appends photos at the end of the queue, where they cannot disturb the hero
   * photo or the note that were already on the paper.
   */

  if (originalImage) {
    photos.push(
      photoCard(
        page,
        "hero",
        originalImage,
        photoLabels[originalImage] ??
          post.altText ??
          "The photo this page came from",
        photoLabels[originalImage]?.toLowerCase() ?? "straight off the post",
        bankAlts(
          photoBank,
          originalImage,
          "another frame from the post",
          photoLabels,
        ),
        {
          // The caption's own name for this frame beats the tagged location,
          // which is often the whole country.
          label:
            photoLabels[originalImage]?.toLowerCase() ??
            post.place ??
            "from the post",
          sublabel: post.author ? `@${post.author}` : undefined,
          palette: colorPalette,
        },
        compact,
      ),
    );
  }

  /**
   * One written scrap keeps the generated page image-led. Food stops already
   * get a named sheet below; this is only a caption next to the first print
   * when that print is a place to see, not to eat.
   */
  const [first] = activities;
  if (first?.resolvedImage && !isFoodOrDrinkStop(first)) {
    notes.push(
      writtenNote(page, compact, {
        id: `note-0-${slug(first.title)}`,
        text: trimNote(first.description.toLowerCase()),
        ink: colorPalette[0],
        z: 40,
        alts: [
          `${first.title.toLowerCase()} — ${first.cost.toLowerCase()}, ${first.placeType.toLowerCase()}`,
          `${first.placeType.toLowerCase()} — worth a stop.`,
        ],
      }),
    );
  }

  // The post's own words, when it had any, torn out and taped on.
  if (post.caption && activities.length === 0) {
    notes.push(
      writtenNote(page, compact, {
        id: "post-caption",
        text: trimNote(post.caption, MAX_CAPTION_WORDS),
        ink: colorPalette[2] ?? colorPalette[0],
        z: 22,
        wide: true,
        alts: [
          post.author
            ? `— @${post.author}, straight off the post`
            : "straight off the post",
        ],
      }),
    );
  }

  // Colours go down with the furniture so the photos scatter around them
  // rather than the strip having to find a gap in a finished page.
  const swatches = paletteCard(page, colorPalette, compact);

  // Named stops take photo slots first. Anything left without a print — no
  // Places photo, or the page is already full of prints — is written down
  // later, so the chat never claims a pin that has nowhere to sit.
  const pictured = new Set<string>();
  activities.forEach((activity, index) => {
    const src = activity.resolvedImage;
    if (!src) return;
    if (photos.length >= maxPhotos) return;

    pictured.add(activity.title.toLowerCase());
    photos.push(
      photoCard(
        page,
        `act-${index}-${slug(activity.title)}`,
        src,
        activity.title,
        `${activity.title.toLowerCase()} — ${activity.cost}, ${activity.placeType}`,
        bankAlts(photoBank, src, activity.title.toLowerCase()),
        {
          label: activity.title.toLowerCase(),
          sublabel: `${activity.cost} · ${activity.placeType}`,
          // `resolvedCredit` is set only on the Unsplash path.
          credit: activity.resolvedCredit,
          palette: colorPalette,
        },
        compact,
      ),
    );
  });

  // Carousel posts often yield fewer searchable place photos than the board
  // needs. Fill only from that same post, never unrelated stock imagery.
  const placedPhotoSources = new Set(photos.map((card) => card.src));
  const uniquePinned = uniquePhotoSources(pinned);
  const pinnedPhotoSources = new Set(uniquePinned.map(displayPhotoUrl));
  const pendingPinnedCount = uniquePinned.filter(
    (src) => !placedPhotoSources.has(displayPhotoUrl(src)),
  ).length;
  const minimumFillers = uniquePhotoSources(photoBank)
    .filter(
      (src) =>
        !placedPhotoSources.has(displayPhotoUrl(src)) &&
        !pinnedPhotoSources.has(displayPhotoUrl(src)),
    )
    .slice(
      0,
      Math.max(0, maxPhotos - placedPhotoSources.size - pendingPinnedCount),
    );

  minimumFillers.forEach((src, index) => {
    photos.push(
      photoCard(
        page,
        `bank-fill-${index}-${slug(src.slice(-24))}`,
        src,
        photoLabels[src] ?? "A photo from the post",
        photoLabels[src]?.toLowerCase() ?? "from the post",
        bankAlts(photoBank, src, "another frame from the post", photoLabels),
        {
          label: photoLabels[src]?.toLowerCase() ?? "from the post",
          palette: colorPalette,
        },
        compact,
      ),
    );
  });

  // Pinned bank photos queue up behind anything the chat added.
  uniquePinned.forEach((src, index) => {
    if (photos.length >= maxPhotos) return;

    photos.push(
      photoCard(
        page,
        `pin-${index}-${slug(src.slice(-24))}`,
        src,
        photoLabels[src] ?? "A photo you pinned from the bank",
        photoLabels[src]?.toLowerCase() ?? "pinned from the bank",
        bankAlts(photoBank, src, "another frame from the post", photoLabels),
        {
          label: photoLabels[src]?.toLowerCase() ?? "pinned",
          palette: colorPalette,
        },
        compact,
      ),
    );
  });

  /**
   * Destination top-ups. Placed before the food notes so their spots stay put
   * when the user asks for another bakery -- a scrap only dodges what went
   * down before it, and these used to shuffle onto the new note.
   *
   * Scene fillers still only fill the board up to the minimum. Food and outfit
   * inspo sit on top of that, in any slots left under the photo cap, so they
   * never steal a landmark's place and never get mistaken for a stop.
   */
  const alreadyPlaced = new Set(photos.map((card) => card.src));
  const fillers = readFillers(canvas.fillerPhotos).filter(
    (photo) => !alreadyPlaced.has(displayPhotoUrl(photo.src)),
  );
  const sceneFillers = fillers.filter((photo) => !photo.kind);
  const foodFillers = fillers.filter((photo) => photo.kind === "food");
  const outfitFillers = fillers.filter((photo) => photo.kind === "outfit");

  sceneFillers
    .slice(0, Math.max(0, MIN_PHOTO_CARDS - photos.length))
    .forEach((photo, index) => {
      const named = photo.label.trim().toLowerCase();
      photos.push(
        photoCard(
          page,
          `filler-${index}-${slug(photo.src.slice(-24))}`,
          photo.src,
          named || `${canvas.destination || "The destination"}, in general`,
          named || canvas.destination.toLowerCase() || "on the way",
          [],
          {
            label: named || undefined,
            palette: colorPalette,
          },
          compact,
        ),
      );
    });

  const inspo = [
    foodFillers[0],
    outfitFillers[0],
    foodFillers[1],
    outfitFillers[1],
  ].filter((photo): photo is (typeof fillers)[number] => Boolean(photo));

  inspo.forEach((photo, index) => {
    if (photos.length >= maxPhotos) return;

    const named = photo.label.trim().toLowerCase();
    const typeLabel = photo.kind === "food" ? "food inspo" : "outfit inspo";
    photos.push(
      photoCard(
        page,
        `inspo-${photo.kind}-${index}-${slug(photo.src.slice(-24))}`,
        photo.src,
        named || typeLabel,
        typeLabel,
        [],
        {
          label: named || typeLabel,
          sublabel: typeLabel,
          palette: colorPalette,
        },
        compact,
      ),
    );
  });

  /**
   * Food and bars without a Places photo, plus a why-go scrap for each
   * location that already has a print. Locations are images first; the note
   * keeps the line of handwritten info next to them.
   */
  activities.forEach((activity, index) => {
    const seen = pictured.has(activity.title.toLowerCase());
    if (isFoodOrDrinkStop(activity) && seen) return;
    if (!isFoodOrDrinkStop(activity) && !seen && !activity.description.trim()) {
      return;
    }
    if (
      !isFoodOrDrinkStop(activity) &&
      seen &&
      index === 0 &&
      first?.resolvedImage
    ) {
      // The first location already has note-0 sitting by its print.
      return;
    }
    if (notes.length >= maxNotes) return;

    notes.push(
      writtenNote(page, compact, {
        id: `eat-${index}-${slug(activity.title)}`,
        heading: activity.title.toLowerCase(),
        text: trimNote(activity.description.toLowerCase()),
        footnote: costAndType(activity),
        ink: colorPalette[index % colorPalette.length],
        z: 44 + notes.length,
        alts: [
          `${activity.placeType.toLowerCase()} — worth a stop.`,
          `${activity.title.toLowerCase()} — ${activity.cost.toLowerCase()}`,
        ],
      }),
    );
  });

  const tape = photos
    .map((photo) => tapeFor(page, photo, compact))
    .filter((piece): piece is DecorCardData => piece !== null);

  const cards: ScrapCard[] = [
    ...ephemera(page, layoutSeed || "initial", compact),
    ...photos,
    ...tape,
    ...(swatches ? [swatches] : []),
    ...notes,
    ...sparkles(page, layoutSeed || "initial", compact),
  ];

  return cards.filter((card) => !(canvas.dismissed ?? []).includes(card.id));
}

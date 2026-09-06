import type {
  DecorAsset,
  PhotoAlt,
  PhotoCardData,
  ScrapCard,
} from "@/data/cards";
import type { CanvasState, PhotoCredit } from "@/lib/vibeBoard";
import { displayPhotoUrl } from "@/lib/vibeBoard";

/**
 * Where scraps land on the page.
 *
 * These numbers were tuned by hand against the paper texture -- the rotations
 * read as a real pinboard and the tape overhangs line up with the torn edges.
 * Board data gets laid onto them rather than positioned generatively, because
 * random placement immediately looks random.
 */

type PhotoSlot = {
  x: number;
  y: number;
  compactX: number;
  compactY: number;
  rotate: number;
  width: number;
  compactWidth: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
};

type NoteSlot = {
  x: number;
  y: number;
  compactX: number;
  compactY: number;
  rotate: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
};

/**
 * One photo per quarter of the paper. Coordinates are the card's top-left,
 * inset so a ~170px print still sits on the sheet — including the narrower
 * chatting stage. The title beads occupy the top-left strip, so the NW slot
 * starts below them.
 *
 *   0 NW · 1 NE
 *   2 SW · 3 SE
 */
const PHOTO_SLOTS: PhotoSlot[] = [
  {
    x: 6,
    y: 26,
    compactX: 5,
    compactY: 18,
    rotate: -1.6,
    width: 172,
    compactWidth: 132,
    cut: 1,
    z: 14,
    decors: [
      {
        src: "/washi-tape/tape-00.png",
        kind: "washi",
        rotate: -22,
        width: 118,
        top: "-6%",
        left: "-8%",
      },
    ],
  },
  {
    x: 57,
    y: 16,
    compactX: 52,
    compactY: 10,
    rotate: 1.8,
    width: 164,
    compactWidth: 128,
    cut: 5,
    z: 16,
    decors: [],
  },
  {
    x: 8,
    y: 56,
    compactX: 6,
    compactY: 50,
    rotate: 1.4,
    width: 156,
    compactWidth: 124,
    cut: 6,
    z: 18,
    decors: [],
  },
  {
    x: 55,
    y: 54,
    compactX: 50,
    compactY: 48,
    rotate: -1.8,
    width: 168,
    compactWidth: 128,
    cut: 2,
    z: 20,
    decors: [
      {
        src: "/washi-tape/tape-07.png",
        kind: "washi",
        rotate: 16,
        width: 102,
        top: "4%",
        right: "-12%",
      },
    ],
  },
];

const NOTE_SLOTS: NoteSlot[] = [
  {
    x: 37,
    y: 40,
    compactX: 28,
    compactY: 36,
    rotate: -4.8,
    cut: 8,
    z: 24,
    decors: [
      {
        src: "/washi-tape/tape-12.png",
        kind: "washi",
        rotate: 28,
        width: 96,
        top: "-8%",
        right: "-6%",
      },
    ],
  },
];

/** Slot the hero photo occupies; the itinerary fills the other quarters. */
const HERO_SLOT = 0;
const QUARTERS = [0, 1, 2, 3];
const ACTIVITY_SLOTS = [0, 1, 2, 3];
const PINNED_SLOTS = [0, 1, 2, 3];
const MAX_PHOTO_CARDS = 4;

/** Notes read as marginalia, so they sit narrower than the photos. */
const MAX_NOTE_WORDS = 18;

/** Captions get a little more room, since they are the post's own voice. */
const MAX_CAPTION_WORDS = 26;

/**
 * Where the post's own caption gets taped down. Lands in the NE quarter so it
 * stays on the paper when the page has no itinerary photos beside the hero.
 */
const CAPTION_SLOT: NoteSlot = {
  x: 56,
  y: 18,
  compactX: 48,
  compactY: 12,
  rotate: 4.2,
  cut: 6,
  z: 22,
  decors: [
    {
      src: "/washi-tape/tape-04.png",
      kind: "washi",
      rotate: -18,
      width: 88,
      top: "-7%",
      left: "-6%",
    },
  ],
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps a card's top-left on the paper. Percentages leave room for a ~170px
 * photo (or the smaller compact print) plus a little torn-edge margin.
 */
function keepOnPaper(
  x: number,
  y: number,
  compact: boolean,
): { x: number; y: number } {
  return {
    x: clamp(x, compact ? 4 : 5, compact ? 54 : 66),
    y: clamp(y, compact ? 8 : 14, compact ? 48 : 58),
  };
}

function fitNote(slot: NoteSlot, compact: boolean): { x: number; y: number } {
  return compact
    ? { x: slot.compactX, y: slot.compactY }
    : { x: slot.x, y: slot.y };
}

/** How many torn-paper scans live in /public/note-cards. */
const NOTE_PAPERS = 19;

/**
 * A stable paper scan for a note. Keyed off the card id so a note keeps the
 * same sheet across re-renders, and two notes side by side rarely match.
 */
export function notePaper(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) % NOTE_PAPERS;
  return `/note-cards/note-${String(index).padStart(2, "0")}.png`;
}

function photoCard(
  id: string,
  slotIndex: number,
  src: string,
  alt: string,
  location: string,
  alts: PhotoAlt[],
  meta: { label?: string; sublabel?: string; credit?: PhotoCredit } = {},
  drift = 0,
  compact = false,
): PhotoCardData {
  const quarter = slotIndex % PHOTO_SLOTS.length;
  const slot = PHOTO_SLOTS[quarter];
  const originX = compact ? slot.compactX : slot.x;
  const originY = compact ? slot.compactY : slot.y;
  // Extra cards reuse a quarter; step toward the page center so they stay on
  // the paper instead of walking off the torn edge.
  const inwardX = quarter % 2 === 0 ? 1 : -1;
  const inwardY = quarter < 2 ? 1 : -1;
  const at = keepOnPaper(
    originX + inwardX * drift * 3,
    originY + inwardY * drift * 3,
    compact,
  );

  return {
    id,
    kind: "photo",
    src: displayPhotoUrl(src),
    alt,
    location,
    label: meta.label,
    sublabel: meta.sublabel,
    credit: meta.credit,
    x: at.x,
    y: at.y,
    rotate: Math.max(-2, Math.min(2, slot.rotate + drift * 0.4)),
    width: compact ? slot.compactWidth : slot.width,
    cut: slot.cut,
    z: slot.z + drift,
    decors: drift === 0 ? slot.decors : [],
    alts,
  };
}

/**
 * Turns the live canvas into the scraps on the page.
 *
 * Nothing here is stateful: the cards are derived fresh on every render, and
 * card ids carry the content they were built from so an AI swap remounts just
 * that one card and it re-pins with the drop animation.
 */
export function buildCards(canvas: CanvasState, compact = false): ScrapCard[] {
  const { activities, photoBank, pinned, colorPalette, originalImage, post } =
    canvas;
  // Set only when the post's caption was a numbered legend of its frames.
  const photoLabels = post.photoLabels ?? {};

  if (activities.length === 0 && !originalImage) return [];

  const cards: ScrapCard[] = [];
  const occupiedPhotoSlots = new Set<number>();
  const activitySlots = originalImage ? [1, 2, 3] : [...QUARTERS];

  if (originalImage) {
    occupiedPhotoSlots.add(HERO_SLOT);
    cards.push(
      photoCard(
        "hero",
        HERO_SLOT,
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
        },
        0,
        compact,
      ),
    );
  }

  // Each stop with a photo takes the next free quarter. Chat extras reuse a
  // quarter and step toward the middle so they stay on the paper.
  activities.forEach((activity, index) => {
    // Only render a photo card when search found this specific place. The
    // activity's note still renders below when neither source has a relevant
    // result, without filling the gap with unrelated stock travel imagery.
    const src = activity.resolvedImage;
    if (!src) return;
    const currentPhotoCount = cards.filter((card) => card.kind === "photo").length;
    if (currentPhotoCount >= MAX_PHOTO_CARDS) return;

    // `resolvedCredit` is set only on the Unsplash path.
    const isExtra = index >= activitySlots.length;
    const extraIndex = index - activitySlots.length;

    const slotIndex = isExtra
      ? PINNED_SLOTS[extraIndex % PINNED_SLOTS.length]
      : activitySlots[index];
    occupiedPhotoSlots.add(slotIndex);

    cards.push(
      photoCard(
        `act-${index}-${slug(activity.title)}`,
        slotIndex,
        src,
        activity.title,
        `${activity.title.toLowerCase()} — ${activity.cost}, ${activity.placeType}`,
        bankAlts(photoBank, src, activity.title.toLowerCase()),
        {
          label: activity.title.toLowerCase(),
          sublabel: `${activity.cost} · ${activity.placeType}`,
          credit: activity.resolvedCredit,
        },
        isExtra ? Math.floor(extraIndex / PINNED_SLOTS.length) : 0,
        compact,
      ),
    );
  });

  // Carousel posts often yield fewer searchable place photos than the board
  // needs. Fill only from that same post, never unrelated stock imagery.
  const placedPhotoSources = new Set(
    cards
      .filter((card): card is PhotoCardData => card.kind === "photo")
      .map((card) => card.src),
  );
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
      Math.max(
        0,
        MAX_PHOTO_CARDS - placedPhotoSources.size - pendingPinnedCount,
      ),
    );

  minimumFillers.forEach((src, index) => {
    const slotIndex =
      ACTIVITY_SLOTS.find((slot) => !occupiedPhotoSlots.has(slot)) ??
      ACTIVITY_SLOTS[(placedPhotoSources.size + index) % ACTIVITY_SLOTS.length];
    occupiedPhotoSlots.add(slotIndex);

    cards.push(
      photoCard(
        `bank-fill-${index}-${slug(src.slice(-24))}`,
        slotIndex,
        src,
        photoLabels[src] ?? "A photo from the post",
        photoLabels[src]?.toLowerCase() ?? "from the post",
        bankAlts(photoBank, src, "another frame from the post", photoLabels),
        { label: photoLabels[src]?.toLowerCase() ?? "from the post" },
        0,
        compact,
      ),
    );
  });

  // Pinned bank photos queue up behind anything the chat added.
  const pinnedOffset = Math.max(0, activities.length - activitySlots.length);
  uniquePinned.forEach((src, index) => {
    const currentPhotoCount = cards.filter((card) => card.kind === "photo").length;
    if (currentPhotoCount >= MAX_PHOTO_CARDS) return;

    const seat = pinnedOffset + index;
    const slotIndex =
      ACTIVITY_SLOTS.find((slot) => !occupiedPhotoSlots.has(slot)) ??
      PINNED_SLOTS[seat % PINNED_SLOTS.length];
    occupiedPhotoSlots.add(slotIndex);

    cards.push(
      photoCard(
        `pin-${index}-${slug(src.slice(-24))}`,
        slotIndex,
        src,
        photoLabels[src] ?? "A photo you pinned from the bank",
        photoLabels[src]?.toLowerCase() ?? "pinned from the bank",
        bankAlts(photoBank, src, "another frame from the post", photoLabels),
        { label: photoLabels[src]?.toLowerCase() ?? "pinned" },
        Math.floor(seat / PINNED_SLOTS.length),
        compact,
      ),
    );
  });

  // One written scrap keeps the generated page image-led.
  activities.slice(0, 1).forEach((activity, index) => {
    const slot = NOTE_SLOTS[index];
    const at = fitNote(slot, compact);

    cards.push({
      id: `note-${index}-${slug(activity.title)}`,
      kind: "note",
      paper: notePaper(`note-${index}-${slug(activity.title)}`),
      text: trimNote(activity.description.toLowerCase()),
      x: at.x,
      y: at.y,
      rotate: slot.rotate,
      cut: slot.cut,
      z: slot.z,
      ink: colorPalette[index % colorPalette.length],
      decors: slot.decors,
      alts: [
        `${activity.title.toLowerCase()} — ${activity.cost.toLowerCase()}, ${activity.placeType.toLowerCase()}`,
        `${activity.placeType.toLowerCase()} — worth a stop.`,
      ],
    });
  });

  // The post's own words, when it had any, torn out and taped on.
  if (post.caption && activities.length === 0) {
    const slot = CAPTION_SLOT;
    const at = fitNote(slot, compact);

    cards.push({
      id: "post-caption",
      kind: "note",
      paper: notePaper("post-caption"),
      text: trimNote(post.caption, MAX_CAPTION_WORDS),
      x: at.x,
      y: at.y,
      rotate: slot.rotate,
      cut: slot.cut,
      z: slot.z,
      ink: colorPalette[2] ?? colorPalette[0],
      decors: slot.decors,
      alts: [
        post.author
          ? `— @${post.author}, straight off the post`
          : "straight off the post",
      ],
    });
  }

  return cards.filter((card) => !(canvas.dismissed ?? []).includes(card.id));
}

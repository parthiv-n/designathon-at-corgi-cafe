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
  rotate: number;
  width: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
};

type NoteSlot = {
  x: number;
  y: number;
  rotate: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
};

/**
 * Slot 0 is the hero (the post's cover), 1-2 the itinerary, 3-5 pinned extras.
 *
 * A photo card is roughly 13-17% of the stage wide and 25-33% tall; a note is
 * about 17% by 20%. The top-left corner from x14 to x48, y3 to y14 is left
 * empty on purpose -- that is where the handwritten title sits, and cards
 * outrank it in the stacking order, so anything parked there buries it.
 */
const PHOTO_SLOTS: PhotoSlot[] = [
  {
    x: 3,
    y: 18,
    rotate: -7.8,
    width: 200,
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
  { x: 50, y: 4, rotate: 9.4, width: 168, cut: 5, z: 16, decors: [] },
  {
    x: 78,
    y: 18,
    rotate: -6.8,
    width: 186,
    cut: 3,
    z: 12,
    decors: [
      {
        src: "/ephemera/ephemera-06.png",
        kind: "ephemera",
        rotate: 14,
        width: 78,
        right: "-8%",
        bottom: "6%",
      },
    ],
  },
  { x: 23, y: 34, rotate: 8.2, width: 160, cut: 6, z: 18, decors: [] },
  {
    x: 64,
    y: 56,
    rotate: -8,
    width: 176,
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
      {
        src: "/ephemera/ephemera-07.png",
        kind: "ephemera",
        rotate: -8,
        width: 42,
        left: "6%",
        bottom: "8%",
      },
    ],
  },
  { x: 84, y: 46, rotate: 6.6, width: 154, cut: 7, z: 11, decors: [] },
  {
    x: 43,
    y: 58,
    rotate: 10,
    width: 168,
    cut: 4,
    z: 15,
    decors: [
      {
        src: "/washi-tape/tape-16.png",
        kind: "washi",
        rotate: -14,
        width: 110,
        bottom: "-4%",
        left: "10%",
      },
    ],
  },
];

const NOTE_SLOTS: NoteSlot[] = [
  { x: 2, y: 58, rotate: -4.6, cut: 8, z: 10, decors: [] },
  {
    x: 45,
    y: 36,
    rotate: -7.9,
    cut: 3,
    z: 17,
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
  {
    x: 23,
    y: 66,
    rotate: 8.8,
    cut: 5,
    z: 13,
    decors: [
      {
        src: "/ephemera/ephemera-03.png",
        kind: "ephemera",
        rotate: -12,
        width: 56,
        right: "-10%",
        top: "18%",
      },
    ],
  },
];

/** Slot the hero photo occupies; the itinerary starts after it. */
const HERO_SLOT = 0;
const ACTIVITY_SLOTS = [1, 2, 3];
const PINNED_SLOTS = [4, 5, 6];

/** Notes read as marginalia, so they sit narrower than the photos. */
const MAX_NOTE_WORDS = 18;

/** Captions get a little more room, since they are the post's own voice. */
const MAX_CAPTION_WORDS = 26;

/**
 * Where the post's own caption gets taped down. Deliberately off to the right,
 * away from the itinerary notes on the left, so the page reads as "what they
 * said" beside "what we made of it".
 */
const CAPTION_SLOT: NoteSlot = {
  x: 63,
  y: 2,
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
  return bank
    .filter((src) => src !== exclude)
    .map((src) => ({
      src: displayPhotoUrl(src),
      // When the caption numbered its frames, each one is a named place rather
      // than "another photo", so say which.
      alt: labels[src] ?? "A photo from the post",
      location: labels[src]?.toLowerCase() ?? location,
    }));
}

/**
 * Squeezes a slot onto a narrow screen.
 *
 * Slot coordinates are percentages of the stage, but a card's *width* is
 * clamped in pixels, so on a phone a card that reads as 16% of a laptop stage
 * becomes more like 35% and the right-hand slots hang off the torn edge. This
 * pulls everything back into the left two thirds and stretches the vertical
 * spread to compensate. Scraps still overlap -- that is the look -- but they
 * stay on the paper.
 */
function fit(
  x: number,
  y: number,
  compact: boolean,
): { x: number; y: number } {
  if (!compact) return { x, y };
  return { x: 6 + (x / 100) * 46, y: 2 + (y / 100) * 88 };
}

/** How many torn-paper scans live in /public/note-cards. */
const NOTE_PAPERS = 19;

/**
 * A stable paper scan for a note. Keyed off the card id so a note keeps the
 * same sheet across re-renders, and two notes side by side rarely match.
 */
function notePaper(id: string): string {
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
  const slot = PHOTO_SLOTS[slotIndex % PHOTO_SLOTS.length];
  const at = fit(slot.x + drift * 4, Math.min(slot.y + drift * 5, 64), compact);

  return {
    id,
    kind: "photo",
    src: displayPhotoUrl(src),
    alt,
    location,
    label: meta.label,
    sublabel: meta.sublabel,
    credit: meta.credit,
    // Overflow scraps reuse a slot but step off it, so a deep stack of pinned
    // photos fans out instead of hiding under itself.
    x: at.x,
    y: at.y,
    rotate: slot.rotate + drift * 2.5,
    width: slot.width,
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

  if (originalImage) {
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

  // The first three stops are the itinerary the photo was read into and get the
  // good slots. Anything past that came from the chat ("add some food options")
  // and fills the spare slots, drifting off them once those run out.
  activities.forEach((activity, index) => {
    // Only render a photo card when search found this specific place. The
    // activity's note still renders below when neither source has a relevant
    // result, without filling the gap with unrelated stock travel imagery.
    const src = activity.resolvedImage;
    if (!src) return;

    // `resolvedCredit` is set only on the Unsplash path.
    const isExtra = index >= ACTIVITY_SLOTS.length;
    const extraIndex = index - ACTIVITY_SLOTS.length;

    cards.push(
      photoCard(
        `act-${index}-${slug(activity.title)}`,
        isExtra
          ? PINNED_SLOTS[extraIndex % PINNED_SLOTS.length]
          : ACTIVITY_SLOTS[index],
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

  // Pinned bank photos queue up behind anything the chat added.
  const pinnedOffset = Math.max(0, activities.length - ACTIVITY_SLOTS.length);
  pinned.forEach((src, index) => {
    const seat = pinnedOffset + index;

    cards.push(
      photoCard(
        `pin-${slug(src.slice(-24))}`,
        PINNED_SLOTS[seat % PINNED_SLOTS.length],
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

  // Keep generated boards image-led: one handwritten note summarizes the first
  // stop, while every other activity uses its photo's compact sticky label.
  activities.slice(0, 1).forEach((activity, index) => {
    const slot = NOTE_SLOTS[index];

    const at = fit(slot.x, slot.y, compact);

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
      // The palette lost its strip to the photo bank, so it lives on as ink.
      ink: colorPalette[index % colorPalette.length],
      decors: slot.decors,
      alts: [
        `${activity.title.toLowerCase()} — ${activity.cost.toLowerCase()}, ${activity.placeType.toLowerCase()}`,
        `${activity.placeType.toLowerCase()} — worth a stop.`,
      ],
    });
  });

  // The post's own words, when it had any, torn out and taped on.
  if (post.caption) {
    const slot = CAPTION_SLOT;
    const at = fit(slot.x, slot.y, compact);

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

  return cards;
}

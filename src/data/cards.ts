/**
 * The shapes the scrapbook renders. Positions and decor are assigned by
 * `@/lib/layout`, which lays live board data onto hand-tuned slots.
 */

import type { PhotoCredit } from "@/lib/vibeBoard";

export type PhotoAlt = {
  src: string;
  alt: string;
  location: string;
};

/**
 * A strip of washi tape or a scanned paper scrap.
 *
 * These used to be children of the card they decorated, which made them part
 * of that card rather than things in their own right: tape could not be peeled
 * off a photo, and the loose ephemera were painted onto the paper with
 * `pointer-events: none`. They are top-level scraps now, so every one of them
 * drags, rotates, resizes and tears off like anything else on the page.
 */
export type DecorCardData = {
  id: string;
  kind: "decor";
  variant: "washi" | "ephemera" | "sparkle";
  src: string;
  x: number;
  y: number;
  rotate: number;
  width: number;
  z: number;
};

export type PhotoCardData = {
  id: string;
  kind: "photo";
  src: string;
  alt: string;
  location: string;
  /** Small sticky slip taped to the photo, naming what it is. */
  label?: string;
  /** Optional second line on the slip, e.g. "$$ · 15m walk". */
  sublabel?: string;
  /**
   * The slip's own stock and ink, tinted from the board's palette.
   *
   * Every slip used to be the same yellow, which made a page of them look
   * printed rather than assembled, and said nothing about the board it was on.
   */
  slip: { paper: string; ink: string };
  x: number;
  y: number;
  rotate: number;
  width: number;
  cut: number;
  z: number;
  /** Rejecting the card cycles through these. Fed from the photo bank. */
  alts: PhotoAlt[];
  /**
   * Set only for photos Unsplash search found. Post photos and the curated
   * fallbacks have no photographer to name.
   */
  credit?: PhotoCredit;
};

export type NoteCardData = {
  id: string;
  kind: "note";
  text: string;
  /**
   * The place's name, written above the note.
   *
   * Only set on the notes that stand in for a photo card -- a restaurant or a
   * bar. Those carry the whole recommendation on their own, and a description
   * of somewhere you cannot name is not a recommendation.
   */
  heading?: string;
  /** Cost and category, e.g. "$$ · wine bar". The photo slip's second line. */
  footnote?: string;
  /** Torn-paper scan the note is written on, from /public/note-cards. */
  paper: string;
  /**
   * Where on that scan it is safe to write, measured per sheet. See
   * `@/lib/notePapers` -- these are photographs of paper, and the clear area
   * is a different shape on every one.
   */
  paperBox: { top: number; left: number; right: number; bottom: number };
  /** Width ÷ height of the scan, so the card knows its own real height. */
  paperAspect: number;
  x: number;
  y: number;
  rotate: number;
  /** Starting width in px. The reader can resize from here. */
  width: number;
  cut: number;
  z: number;
  ink: string;
  alts: string[];
};

/**
 * The board's colours, as a paint-chip card pinned to the page.
 *
 * The palette is the one part of the model's reading of a photo that never had
 * anywhere to live: it tinted things quietly -- ink, now the slips -- but was
 * never shown. On a mood board it is a deliverable in its own right, so it goes
 * up as swatches with their hex codes, the way a real one would.
 */
export type PaletteCardData = {
  id: string;
  kind: "palette";
  /** Four or five, already validated as hex and uppercased for printing. */
  colors: string[];
  x: number;
  y: number;
  rotate: number;
  width: number;
  z: number;
};

export type ScrapCard =
  | PhotoCardData
  | NoteCardData
  | DecorCardData
  | PaletteCardData;

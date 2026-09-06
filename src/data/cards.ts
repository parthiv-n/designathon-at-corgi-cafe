/**
 * The shapes the scrapbook renders. Positions and decor are assigned by
 * `@/lib/layout`, which lays live board data onto hand-tuned slots.
 */

export type PhotoAlt = {
  src: string;
  alt: string;
  location: string;
};

export type DecorAsset = {
  src: string;
  kind: "washi" | "ephemera";
  rotate: number;
  width: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
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
  x: number;
  y: number;
  rotate: number;
  width: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
  /** Rejecting the card cycles through these. Fed from the photo bank. */
  alts: PhotoAlt[];
};

export type NoteCardData = {
  id: string;
  kind: "note";
  text: string;
  x: number;
  y: number;
  rotate: number;
  cut: number;
  z: number;
  ink: string;
  decors: DecorAsset[];
  alts: string[];
};

export type ScrapCard = PhotoCardData | NoteCardData;

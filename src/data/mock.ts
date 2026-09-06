export type PaletteSwatch = {
  hex: string;
  name: string;
};

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
  x: number;
  y: number;
  rotate: number;
  width: number;
  cut: number;
  z: number;
  decors: DecorAsset[];
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

export const PALETTE: PaletteSwatch[] = [
  { hex: "#1F4E6B", name: "azulejo" },
  { hex: "#E2B84A", name: "tram" },
  { hex: "#6B8F71", name: "garden" },
  { hex: "#8E3B4A", name: "vinho" },
  { hex: "#2A2420", name: "ink" },
  { hex: "#C9B8A0", name: "limestone" },
];

export const MOCK_CAPTION =
  "late june in lisbon — tiles, sardines, and the 28 tram.";

export const MOCK_CARDS: ScrapCard[] = [
  {
    id: "p1",
    kind: "photo",
    src: "https://picsum.photos/id/1015/480/620",
    alt: "Sunlit hillside overlooking a pale city",
    location: "miradouro da senhora do monte",
    x: 6,
    y: 16,
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
    alts: [
      {
        src: "https://picsum.photos/id/1018/480/620",
        alt: "River bend from above",
        location: "ponte 25 de abril, walking the river",
      },
      {
        src: "https://picsum.photos/id/1022/480/620",
        alt: "High ridge in late sun",
        location: "monsanto, last bench",
      },
      {
        src: "https://picsum.photos/id/1039/480/620",
        alt: "Forest path in haze",
        location: "sintra, after the mist lifts",
      },
    ],
  },
  {
    id: "p2",
    kind: "photo",
    src: "https://picsum.photos/id/1036/440/560",
    alt: "Winding road through dry coastal hills",
    location: "cabo da roca, wind in the teeth",
    x: 28,
    y: 4,
    rotate: 9.4,
    width: 168,
    cut: 5,
    z: 16,
    decors: [],
    alts: [
      {
        src: "https://picsum.photos/id/1043/440/560",
        alt: "Coast road in fog",
        location: "cascais, empty weekday",
      },
      {
        src: "https://picsum.photos/id/1050/440/560",
        alt: "Cliffs meeting water",
        location: "urca, the last turn",
      },
    ],
  },
  {
    id: "p3",
    kind: "photo",
    src: "https://picsum.photos/id/164/460/600",
    alt: "Lighthouse and sea at the edge of land",
    location: "belém, before the coaches arrive",
    x: 54,
    y: 6,
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
    alts: [
      {
        src: "https://picsum.photos/id/122/460/600",
        alt: "Harbour wall at dusk",
        location: "cais do sodré, last ferry",
      },
      {
        src: "https://picsum.photos/id/142/460/600",
        alt: "Stone pier",
        location: "alcântara, morning tide",
      },
      {
        src: "https://picsum.photos/id/179/460/600",
        alt: "Quiet waterfront",
        location: "docas, before lunch",
      },
    ],
  },
  {
    id: "p4",
    kind: "photo",
    src: "https://picsum.photos/id/201/420/540",
    alt: "Quiet street with long afternoon shadows",
    location: "alfama, after the tiles get louder",
    x: 16,
    y: 42,
    rotate: 8.2,
    width: 160,
    cut: 6,
    z: 18,
    decors: [],
    alts: [
      {
        src: "https://picsum.photos/id/238/420/540",
        alt: "Narrow stair street",
        location: "mouraria, the blue door",
      },
      {
        src: "https://picsum.photos/id/250/420/540",
        alt: "Washing lines over a lane",
        location: "graça, laundry day",
      },
    ],
  },
  {
    id: "p5",
    kind: "photo",
    src: "https://picsum.photos/id/274/500/640",
    alt: "Market hall with hanging lights",
    location: "time out market, saturday noon",
    x: 38,
    y: 30,
    rotate: -8,
    width: 208,
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
    alts: [
      {
        src: "https://picsum.photos/id/292/500/640",
        alt: "Crowded indoor hall",
        location: "mercado da ribeira, upstairs",
      },
      {
        src: "https://picsum.photos/id/326/500/640",
        alt: "Food stall lights",
        location: "campo de ourique, saturday",
      },
      {
        src: "https://picsum.photos/id/365/500/640",
        alt: "Market aisle",
        location: "feira da ladra, early",
      },
    ],
  },
  {
    id: "p6",
    kind: "photo",
    src: "https://picsum.photos/id/433/400/520",
    alt: "Old tram climbing a steep street",
    location: "tram 28, graça bend",
    x: 66,
    y: 20,
    rotate: 6.6,
    width: 154,
    cut: 7,
    z: 11,
    decors: [],
    alts: [
      {
        src: "https://picsum.photos/id/445/400/520",
        alt: "Yellow tram in shade",
        location: "estrela, the slow climb",
      },
      {
        src: "https://picsum.photos/id/452/400/520",
        alt: "Streetcar corner",
        location: "chiado, after the bell",
      },
    ],
  },
  {
    id: "p7",
    kind: "photo",
    src: "https://picsum.photos/id/49/430/560",
    alt: "Painted factory wall in late light",
    location: "lx factory, last wall on the left",
    x: 46,
    y: 50,
    rotate: 10,
    width: 176,
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
    alts: [
      {
        src: "https://picsum.photos/id/58/430/560",
        alt: "Painted brick wall",
        location: "lx, the courtyard door",
      },
      {
        src: "https://picsum.photos/id/76/430/560",
        alt: "Factory window",
        location: "alcântara, studio row",
      },
      {
        src: "https://picsum.photos/id/96/430/560",
        alt: "Mural at dusk",
        location: "bairro alto, side street",
      },
    ],
  },
  {
    id: "n1",
    kind: "note",
    text: "ride the 28 until you get lost. hop off when the tiles get louder.",
    x: 7,
    y: 60,
    rotate: -4.6,
    cut: 8,
    z: 10,
    ink: "#1F4E6B",
    decors: [],
    alts: [
      "take the 15 to belém and walk back along the river. no plan.",
      "miss your stop on purpose. the next one is usually better.",
    ],
  },
  {
    id: "n2",
    kind: "note",
    text: "pastel de nata at manteigaria — go twice. once is a rehearsal.",
    x: 64,
    y: 48,
    rotate: -7.9,
    cut: 3,
    z: 17,
    ink: "#8E3B4A",
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
    alts: [
      "coffee standing up at a counter. sit only if the tiles are cold.",
      "ginjinha in a chocolate cup. one is polite. two is research.",
    ],
  },
  {
    id: "n3",
    kind: "note",
    text: "sunset from senhora do monte. cheap bottle. sit on the wall.",
    x: 22,
    y: 24,
    rotate: 8.8,
    cut: 5,
    z: 13,
    ink: "#2A2420",
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
    alts: [
      "miradouro da graça at 7. bring olives. leave when the lights come on.",
      "walk santa catarina until the river goes gold, then downhill.",
    ],
  },
];

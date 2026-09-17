import { paletteToneName } from './ink';

/**
 * Cuisine and dish words tied to a destination, so food queries are
 * "italian pasta food photography" rather than a generic "food" search.
 */
const CUISINE_HINTS: Array<{
  match: RegExp;
  cuisine: string;
  dish: string;
  drink: string;
}> = [
  {
    match:
      /\b(rome|italy|italian|florence|venice|milan|tuscany|amalfi|naples|sicily|como)\b/i,
    cuisine: 'italian',
    dish: 'pasta',
    drink: 'espresso',
  },
  {
    match: /\b(paris|france|lyon|provence|nice|marseille)\b/i,
    cuisine: 'french',
    dish: 'pastry',
    drink: 'cafe',
  },
  {
    match: /\b(tokyo|kyoto|osaka|japan)\b/i,
    cuisine: 'japanese',
    dish: 'ramen',
    drink: 'matcha',
  },
  {
    match: /\b(kenya|nairobi|amboseli|mombasa|masai|maasai)\b/i,
    cuisine: 'kenyan',
    dish: 'nyama choma',
    drink: 'chai',
  },
  {
    match: /\b(mexico|oaxaca|cdmx|mexico city)\b/i,
    cuisine: 'mexican',
    dish: 'tacos',
    drink: 'cafe',
  },
  {
    match: /\b(bangkok|thailand|chiang mai)\b/i,
    cuisine: 'thai',
    dish: 'street food',
    drink: 'coffee',
  },
  {
    match: /\b(marrakech|morocco|fes)\b/i,
    cuisine: 'moroccan',
    dish: 'tagine',
    drink: 'mint tea',
  },
  {
    match: /\b(barcelona|madrid|seville|spain|ibiza)\b/i,
    cuisine: 'spanish',
    dish: 'tapas',
    drink: 'espresso',
  },
  {
    match: /\b(lisbon|portugal|porto)\b/i,
    cuisine: 'portuguese',
    dish: 'pastel de nata',
    drink: 'espresso',
  },
  {
    match: /\b(seoul|korea)\b/i,
    cuisine: 'korean',
    dish: 'bbq',
    drink: 'cafe',
  },
  {
    match: /\b(hanoi|vietnam|saigon)\b/i,
    cuisine: 'vietnamese',
    dish: 'pho',
    drink: 'egg coffee',
  },
  {
    match: /\b(athens|greece|santorini)\b/i,
    cuisine: 'greek',
    dish: 'meze',
    drink: 'cafe',
  },
  {
    match: /\b(new york|nyc)\b/i,
    cuisine: 'new york',
    dish: 'pizza',
    drink: 'coffee',
  },
  {
    match: /\b(brazil|rio)\b/i,
    cuisine: 'brazilian',
    dish: 'street food',
    drink: 'cafe',
  },
];

/** 1–2 food searches built from the destination/vibe, never a bare "food". */
export function foodSearchQueries(
  destination: string,
  vibeSummary = '',
  focus = '',
): string[] {
  const place = destination.trim();
  if (!place) return [];
  const haystack = `${place} ${vibeSummary} ${focus}`;
  const hint = CUISINE_HINTS.find(entry => entry.match.test(haystack));
  if (hint) {
    return [
      `${hint.cuisine} ${hint.dish} food photography`,
      `${hint.drink} ${place} cafe aesthetic`,
    ];
  }
  return [`${place} food photography`, `${place} cafe aesthetic`];
}

/**
 * 1–2 outfit searches. The first is tinted with the board's own palette so
 * the clothes match the trip rather than reading as generic fashion stock.
 */
export function outfitSearchQueries(
  destination: string,
  vibeSummary = '',
  focus = '',
  colorPalette: string[] = [],
): string[] {
  const place = destination.trim();
  if (!place) return [];
  const haystack = `${place} ${vibeSummary} ${focus}`.toLowerCase();
  const tone = paletteToneName(colorPalette);
  const garment = /\b(safari|savanna|savannah|wildlife|hike|hiking|bush)\b/.test(
    haystack,
  )
    ? 'safari outfit'
    : /\b(beach|coast|island|swim)\b/.test(haystack)
      ? 'linen beach outfit'
      : 'linen travel outfit';
  return [`${tone} ${garment}`, `${place} street style`];
}

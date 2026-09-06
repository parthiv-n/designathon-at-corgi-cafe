/**
 * How the director lifts a place name from a loose prompt so the letter beads
 * can spell it. One short proper noun -- city, island, region or country --
 * never the vibe, the company, or the whole sentence.
 */
export const DESTINATION_GUIDE = `destination is the place name spelled in letter beads on the page.
Lift it from the user's words (or the Instagram caption/place). Keep it to
one proper noun, or two if that is how the place is written (New York,
Lake Como, Costa Brava). Never a mood word, never "trip", "tour", "girls",
"aesthetic", "winter", or a sentence.

Examples -- query → destination:
- "girls trip to ibiza" → Ibiza
- "aesthetic swedish city tour" → Sweden
- "winter in brisbane" → Brisbane
- "tokyo cyberpunk neon core" → Tokyo
- "sardinia beach girls trip" → Sardinia
- "long weekend in lisbon" → Lisbon
- "romantic week in paris" → Paris
- "solo hike through patagonia" → Patagonia
- "family holiday to the amalfi coast" → Amalfi
- "new york rooftop jazz nights" → New York
- "lake como villa summer" → Lake Como
- "cheap eats in mexico city" → Mexico City
- "kyoto temple fog morning" → Kyoto
- "marrakech riad and souk crawl" → Marrakech
- "iceland ring road in october" → Iceland
- "cape town food and wine" → Cape Town
- "barcelona gothic quarter wander" → Barcelona
- "seoul late night convenience store run" → Seoul
- "scottish highlands bothy weekend" → Highlands
- "santorini sunset with the girls" → Santorini
- "austin bbq and live music" → Austin
- "banff snow and hot springs" → Banff
- "nairobi and the masai mara" → Nairobi
- "a quiet week on the isle of skye" → Skye
- "hanoi motorbike and egg coffee" → Hanoi

If the prompt names no place, infer the most likely real destination from
the vibe and write that. Never leave destination empty when you rebuild.`;

/** Beads only have A–Z. Keep one or two words so the title still fits. */
export function beadLabel(prompt: string): string {
  return prompt
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .toUpperCase();
}

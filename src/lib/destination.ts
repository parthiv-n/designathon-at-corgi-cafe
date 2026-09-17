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

Read the WHOLE prompt before deciding. A long, chatty sentence still names
exactly one place, and it is rarely the first noun: in "I want to go to Brazil
for carnival" the destination is Brazil, not "I" and not "carnival". Strip the
opener ("i want to", "can you", "planning a", "take me to") and the trailing
reason ("for carnival", "with my sister", "on a budget") before you answer.

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
- "I want to go to Brazil for carnival" → Rio de Janeiro
- "somewhere in Japan for the cherry blossoms" → Kyoto

When the prompt names a country but the reason points at one city -- carnival
in Brazil, cherry blossoms in Japan, hogmanay in Scotland -- answer with that
city. The beads should spell somewhere you can actually walk around.

If the board already names a country and they ask where to go, or name a
city or park inside it, destination becomes that more specific place:
Kenya plus "what would be a good place to go" → Amboseli or Nairobi, not Kenya.

If the prompt names no place, infer the most likely real destination from
the vibe and write that. Never leave destination empty when you rebuild.`;

/**
 * The other half of a long prompt: WHY they are going. The destination decides
 * where the stops are, this decides which stops are worth putting on the page.
 */
export const FOCUS_GUIDE = `focus is what the trip is actually about, in two to five lowercase words.
It is the part of the prompt left over once the place name is removed, and it
is what makes two boards for the same city look different.

Examples -- query → destination + focus:
- "I want to go to Brazil for carnival" → Rio de Janeiro + "carnival season"
- "cheap eats in mexico city" → Mexico City + "cheap street food"
- "berlin techno weekend" → Berlin → "late night techno"
- "romantic week in paris" → Paris + "slow romantic evenings"
- "solo hike through patagonia" → Patagonia + "solo hiking"
- "tokyo with a toddler" → Tokyo + "easy with small kids"
- "seoul late night convenience store run" → Seoul + "late night snacking"

Every stop you choose must serve the focus. A carnival board is sambadromes,
blocos and rooftop parties, not a generic museum. A cheap-eats board is
taquerias and markets, not tasting menus. Let the focus steer the colour
palette too: carnival is hot and saturated, a winter hike is cold and muted.

If the prompt gives you nothing to go on, leave focus as an empty string
rather than inventing one.`;

/** Beads are photographed letters, so a long name has to shrink rather than wrap. */
const MAX_BEAD_LETTERS = 16;

/**
 * What the letter beads spell.
 *
 * The whole place name, not the first two words: "Rio de Janeiro" used to come
 * out as "RIO DE", which reads as a truncation bug rather than a title. Words
 * are kept whole and the run stops before it would overflow the paper, so
 * BeadTitle only ever has to scale, never hyphenate.
 */
export function beadLabel(prompt: string): string {
  const words = prompt
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const kept: string[] = [];
  let letters = 0;

  for (const word of words) {
    if (kept.length > 0 && letters + word.length > MAX_BEAD_LETTERS) break;
    kept.push(word);
    letters += word.length;
  }

  return kept.join(" ").toUpperCase();
}

/**
 * Words that look like a destination to a regex but never are. Anything in
 * here disqualifies a candidate outright.
 */
const NOT_A_PLACE = new Set([
  "a", "an", "and", "the", "my", "our", "your", "his", "her", "their", "its",
  "i", "we", "me", "us", "you", "it", "there", "here", "somewhere", "anywhere",
  "go", "going", "get", "getting", "see", "seeing", "do", "doing", "be",
  "take", "taking", "make", "making", "have", "having", "find", "finding",
  "want", "wanna", "need", "like", "love", "plan", "planning", "book", "visit",
  // Words that open a request, and are capitalised for that reason alone.
  "can", "could", "would", "should", "will", "please", "let", "lets", "show",
  "give", "build", "create", "design", "help", "add", "put", "how", "what",
  "where", "when", "why", "who", "is", "are", "im", "id", "ive",
  "trip", "tour", "holiday", "vacation", "weekend", "week", "day", "days",
  "night", "nights", "month", "year", "time", "break", "getaway", "escape",
  "place", "places", "spot", "spots", "board", "page", "vibe",
  "aesthetic", "mood", "girls", "boys", "family", "solo", "couple", "friends",
  "cheap", "budget", "luxury", "fancy", "quiet", "busy", "warm", "cold", "hot",
  "spring", "summer", "autumn", "fall", "winter",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  // Whatever follows one of these is the reason for the trip, not the place.
  "for", "with", "without", "during", "before", "after", "from", "by", "but",
  "or", "so", "then", "that", "this", "these", "those", "while", "because",
]);

/** Small words that live *inside* a place name and should not end the match. */
const CONNECTORS = new Set([
  "de", "del", "di", "da", "do", "des", "du", "la", "le", "les", "los", "las",
  "el", "al", "van", "von", "upon", "on", "of", "the", "and", "saint", "st",
]);

/** Prepositions that a place name tends to follow. */
const ANCHORS = [
  "to", "in", "at", "around", "across", "through", "near", "into", "toward",
  "towards", "visiting", "visit", "explore", "exploring",
];

function isPlaceish(word: string): boolean {
  const lower = word.toLowerCase();
  return (
    lower.length > 1 &&
    !NOT_A_PLACE.has(lower) &&
    !CONNECTORS.has(lower) &&
    !ANCHORS.includes(lower)
  );
}

/**
 * A best guess at the destination, made on the client before the model has
 * answered.
 *
 * Not a substitute for the director -- it exists so the beads do not spell the
 * opening words of the sentence while the request is in flight. "I want to go
 * to Brazil for carnival" used to put "I WANT" on the paper for the five
 * seconds Gemini took to reply. Returns "" when it cannot find a place with
 * any confidence, which leaves the beads off the page until the real
 * destination arrives -- blank reads as loading, "I WANT" reads as broken.
 */
export function guessDestination(prompt: string): string {
  const words = prompt
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\w'’-]+|[^\w'’-]+$/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "";

  /**
   * Reads a place name forwards from `start`.
   *
   * Only the first word may be lowercase, and only when a preposition vouched
   * for it. After that the run continues on capitalisation ("New York") or on
   * a connector with a real word behind it ("Rio de Janeiro"). Without that
   * rule "Brazil for carnival" reads as one long place name.
   */
  const runFrom = (start: number, capitalisedOnly: boolean): string => {
    const first = words[start];
    if (!first || !isPlaceish(first)) return "";
    if (capitalisedOnly && !/^[A-Z]/.test(first)) return "";

    const run = [first];

    for (let i = start + 1; i < words.length && run.length < 3; i += 1) {
      const word = words[i];

      if (CONNECTORS.has(word.toLowerCase())) {
        const next = words[i + 1];
        if (!next || !isPlaceish(next)) break;
        run.push(word, next);
        i += 1;
        continue;
      }

      if (!isPlaceish(word) || !/^[A-Z]/.test(word)) break;
      run.push(word);
    }

    // Never end on a connector -- "Rio de" is not a place.
    while (run.length > 0 && CONNECTORS.has(run[run.length - 1].toLowerCase())) {
      run.pop();
    }

    return run.join(" ");
  };

  // A preposition is the strongest signal there is, and it survives an
  // all-lowercase prompt, which capitalisation does not.
  for (let i = 0; i < words.length - 1; i += 1) {
    if (!ANCHORS.includes(words[i].toLowerCase())) continue;
    const found = runFrom(i + 1, false);
    if (found) return found;
  }

  // No preposition. Fall back to a capitalised run. The first word is fair
  // game -- "New York rooftop jazz nights" would otherwise come out as "York"
  // -- because NOT_A_PLACE already covers the openers that are capitalised
  // only by virtue of starting a sentence.
  for (let i = 0; i < words.length; i += 1) {
    const found = runFrom(i, true);
    if (found) return found;
  }

  // Nothing capitalised either. A short prompt is a search phrase and its
  // first real word is almost always the place ("berlin techno weekend"); a
  // long one is a sentence, where the same guess picks up whatever adjective
  // happens to be missing from NOT_A_PLACE. So only trust the short ones.
  if (words.length <= 4 && isPlaceish(words[0])) return words[0];

  return "";
}

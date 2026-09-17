export const HOW_TO_PROMPT = "how does this work?";

export type SubmitOptions = {
  /** Tutorial only. Never infer this from the prompt text. */
  isOnboarding?: boolean;
};

export type HowToReply = {
  id: string;
  text: string;
  cta?: boolean;
};

/**
 * Hardcoded how-to, shown in the chat panel. Kept off the director's
 * transcript so a later "how does this work?" can still be a real question.
 */
export const HOW_TO_REPLIES: HowToReply[] = [
  {
    id: "howto-1",
    text: "this is your travel vision board.",
  },
  {
    id: "howto-2",
    text: "describe a vibe below — 'tokyo cyberpunk neon core', 'sardinia beach girls trip' — or drag in a photo you've saved, or paste a link from instagram, pinterest, or tiktok.",
  },
  {
    id: "howto-3",
    text: "your board fills in with photos, notes, and a colour palette to match. drag scraps around, keep what you like, tear off what you don't.",
  },
  {
    id: "howto-4",
    text: "try it — write a vibe below, or upload your first inspo pic.",
    cta: true,
  },
];

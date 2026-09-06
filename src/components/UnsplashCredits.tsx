import type { Activity } from "@/lib/vibeBoard";
import { UNSPLASH_HOME_URL, withUnsplashUtm } from "@/lib/vibeBoard";

/**
 * The attribution Unsplash's API guidelines ask for: name the photographer,
 * name Unsplash, link back to both.
 *
 * Deliberately quiet. The page is a paper scrapbook and a credit block sitting
 * in the middle of it would read as chrome, so this is one small line under the
 * prompt dock. Renders nothing until a photo actually came from Unsplash.
 */
export function UnsplashCredits({ activities }: { activities: Activity[] }) {
  // Deduped by profile: the same photographer can land on two cards, and
  // thanking them twice on one line looks like a bug.
  const credits = [
    ...new Map(
      activities
        .map((activity) => activity.resolvedCredit)
        .filter((credit) => credit !== undefined)
        .map((credit) => [credit.profileUrl, credit]),
    ).values(),
  ];

  if (credits.length === 0) return null;

  return (
    <p className="unsplash-credits">
      photos by{" "}
      {credits.map((credit, index) => (
        <span key={credit.profileUrl}>
          {index > 0 ? ", " : ""}
          <a
            href={withUnsplashUtm(credit.profileUrl)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {credit.name}
          </a>
        </span>
      ))}{" "}
      on{" "}
      <a href={UNSPLASH_HOME_URL} target="_blank" rel="noreferrer noopener">
        Unsplash
      </a>
    </p>
  );
}

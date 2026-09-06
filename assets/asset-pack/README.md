# Scrapbook asset pack (auto-extracted)

Extracted from the 6 reference sheets into individual transparent PNGs.
Check `_previews/` for a contact-sheet look at each category before
digging into folders.

- `ephemera/` (33 files) — tickets, receipts, stamps, pressed flowers,
  stickers. Drop a couple onto note cards as decoration.
- `washi-tape/` (45 files) — individual tape strips, transparent bg,
  ready to rotate ~5-15deg and place across a card corner.
- `letters-beads/` (52 files) — full A-Z alphabet, twice over (round
  bead style). Good for a short spelled-out label.
- `letters-ransom/` (87 files) — ransom-note style cut-out letters.
  IMPORTANT: this source sheet only covered A-E (multiple style
  variants per letter), not the full alphabet. Fine for short accent
  words/titles that happen to use those letters, not a full dynamic
  headline system unless you find/crop more letters.

## Notes on quality
This was extracted programmatically (connected-component detection
against the white background), not manually cut — most items are
clean, but a handful of cells still contain 2 items merged together
where they sat close together on the original sheet (a few in
ephemera/ and washi-tape/, more in letters-ransom/ since that sheet
was densely packed). Worth a quick manual glance before shipping,
not a blocker to starting.

## Usage sketch (React)
```tsx
import tape from '@/public/washi-tape/manifest.json' // or just glob the folder

function randomTape() {
  const files = ['tape-00.png', 'tape-01.png', /* ...from manifest.json */];
  return files[Math.floor(Math.random() * files.length)];
}

// in a Card component:
<div className="card" style={{ transform: `rotate(${rotation}deg)` }}>
  <img src={photoSrc} alt="" />
  {hasDecoration && (
    <img
      src={`/washi-tape/${randomTape()}`}
      className="tape-corner"
      style={{ transform: `rotate(${tapeRotation}deg)` }}
    />
  )}
</div>
```

## Licensing — worth flagging before this goes anywhere near production
These look like sourced/found reference images (stock sticker packs /
Pinterest), not originals you made. Totally fine to use as-is for a
one-day hackathon demo — nobody's going to audit asset provenance on
a Sunday. But if you want the "shippable" pitch to hold up under a
follow-up question, it's worth having a one-line answer ready: these
are demo placeholders, and a shipped version would use licensed or
commissioned assets (or generate its own sticker/tape graphics)
instead of found clip art.

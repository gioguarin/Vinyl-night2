/** Normalize a title or artist for comparison: strip feat./remaster/bracket noise, punctuation, case. */
export function normalizePart(s: string): string {
  return s
    .toLowerCase()
    .replace(/\((feat|ft|with)\.?[^)]*\)/gi, " ")
    .replace(/\[(.*?)\]/g, " ")
    .replace(/\((\d{4} )?(remaster(ed)?|mono|stereo|live|single version|album version|deluxe)[^)]*\)/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Stable key identifying "the same song" across consecutive recognitions. */
export function trackKey(title: string, artist: string): string {
  return `${normalizePart(title)}::${normalizePart(artist)}`;
}

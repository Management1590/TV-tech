/**
 * Client-safe pure search algorithms for TV Tech OS
 * Ordered Subsequence Pattern Matching & Relevance Scoring
 */

/**
 * Normalizes text for search by converting to lowercase and stripping all non-alphanumeric characters.
 * Spaces, hyphens, slashes, periods, etc. are completely ignored.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if query appears as an ordered sequence in target (left-to-right, index strictly increasing).
 * Both query and target are normalized to alphanumeric characters only.
 *
 * Example 1: Target = "samsung backlight 1" (norm: "samsungbacklight1")
 *  - "ssung"     -> TRUE
 *  - "ungback"   -> TRUE
 *  - "smuback"   -> TRUE
 *  - "backsamsu" -> FALSE
 *
 * Example 2: Target = "4-3-32" (norm: "4332")
 *  - "4332"      -> TRUE
 *  - "332"       -> TRUE
 *  - "4 3 32"    -> TRUE
 *  - "4/3/32"    -> TRUE
 */
export function matchesOrderedPattern(query: string, target: string): boolean {
  const q = normalizeSearchString(query);
  const t = normalizeSearchString(target);

  if (!q || !t) return false;
  if (q.length > t.length) return false;

  let qIdx = 0;
  for (let tIdx = 0; tIdx < t.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;
      if (qIdx === q.length) return true;
    }
  }

  return false;
}

/**
 * Computes relevance score for ranking search results.
 * Higher score = higher ranking in search output.
 */
export function calculateMatchScore(query: string, text: string): number {
  const cleanQ = query.trim().toLowerCase();
  const cleanT = text.trim().toLowerCase();

  if (!cleanQ || !cleanT) return 0;

  // Exact full match
  if (cleanT === cleanQ) return 100;

  // Starts with exact query string
  if (cleanT.startsWith(cleanQ)) return 90;

  // Contains contiguous substring
  if (cleanT.includes(cleanQ)) return 75;

  // Ordered subsequence match
  if (matchesOrderedPattern(cleanQ, cleanT)) {
    const normQ = normalizeSearchString(cleanQ);
    const normT = normalizeSearchString(cleanT);
    const densityRatio = normQ.length / Math.max(normT.length, 1);
    return Math.round(40 + densityRatio * 30);
  }

  return 0;
}

/**
 * Finds all character index ranges [startIndex, endIndex] in `text` that match `query`.
 * Supports exact contiguous matches, individual word tokens, and ordered pattern matches.
 * Automatically sorts and merges overlapping ranges for clean rendering.
 */
export function getHighlightedRanges(text: string, query: string): [number, number][] {
  if (!text || !query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();

  const ranges: [number, number][] = [];

  // 1. Contiguous full query match
  let fullIdx = lowerText.indexOf(lowerQuery);
  while (fullIdx !== -1) {
    ranges.push([fullIdx, fullIdx + lowerQuery.length]);
    fullIdx = lowerText.indexOf(lowerQuery, fullIdx + 1);
  }

  // 2. Individual words match (when query contains spaces)
  const words = cleanQuery.split(/\s+/).map((w) => w.toLowerCase()).filter((w) => w.length > 0);
  if (words.length > 1) {
    for (const word of words) {
      let wordIdx = lowerText.indexOf(word);
      while (wordIdx !== -1) {
        ranges.push([wordIdx, wordIdx + word.length]);
        wordIdx = lowerText.indexOf(word, wordIdx + 1);
      }
    }
  }

  // 3. If no ranges found yet, check ordered pattern match (subsequence)
  if (ranges.length === 0) {
    const normQ = normalizeSearchString(cleanQuery);
    if (normQ.length > 0) {
      let qIdx = 0;
      for (let tIdx = 0; tIdx < text.length; tIdx++) {
        const char = text[tIdx].toLowerCase();
        if (/[a-z0-9]/.test(char) && char === normQ[qIdx]) {
          ranges.push([tIdx, tIdx + 1]);
          qIdx++;
          if (qIdx === normQ.length) break;
        }
      }
    }
  }

  if (ranges.length === 0) return [];

  // Sort ranges by start index, then end index
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Merge overlapping or contiguous ranges
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

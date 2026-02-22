/**
 * Count votes and find the winner. Ties go to the first candidate in the list.
 * @param votes - Record of voterId → optionId
 * @param candidates - Ordered list of valid option IDs (first = tie-break default)
 * @returns The winning option ID
 */
export function tallyVotes(votes: Record<string, string>, candidates: string[]): string {
  const counts: Record<string, number> = {};
  for (const optionId of Object.values(votes)) {
    counts[optionId] = (counts[optionId] || 0) + 1;
  }

  let winner = candidates[0];
  let maxVotes = 0;
  for (const id of candidates) {
    const count = counts[id] || 0;
    if (count > maxVotes) {
      maxVotes = count;
      winner = id;
    }
  }
  return winner;
}

/** Check if the lobby is in solo mode (1 or fewer players). */
export function isSoloMode(players: Record<string, unknown>): boolean {
  return Object.keys(players).length <= 1;
}

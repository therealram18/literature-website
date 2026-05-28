/**
 * deck.js
 * Builds, shuffles, and deals the 54-card Literature deck.
 *
 * Key guarantee: each team always receives exactly 27 cards,
 * distributed as evenly as possible among that team's players.
 * This prevents team-level card count disadvantages regardless
 * of player count (4, 6, 8, …).
 */

const { ALL_CARDS } = require('./sets');

function createDeck() {
  return [...ALL_CARDS];
}

/**
 * Fisher-Yates shuffle. Returns a new array, does not mutate input.
 */
function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Distribute an array of cards as evenly as possible among n players.
 * The first (cards.length % n) players get one extra card each.
 *
 * e.g. 27 cards, 2 players → [14, 13]
 *      27 cards, 3 players → [9, 9, 9]
 *      27 cards, 4 players → [7, 7, 7, 6]
 */
function distributeEvenly(cards, n) {
  const base  = Math.floor(cards.length / n);
  const extra = cards.length % n;
  const hands = [];
  let cursor  = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    hands.push(cards.slice(cursor, cursor + size));
    cursor += size;
  }
  return hands;
}

/**
 * Shuffle and deal cards guaranteeing each team gets exactly 27 cards,
 * distributed as evenly as possible within the team.
 *
 * @param {{ id: string, team: 'A'|'B' }[]} players
 *   Must be an even number ≥ 4, equal team sizes.
 * @returns {{ [playerId: string]: string[] }}
 */
function dealToPlayers(players) {
  const n = players.length;
  if (n < 4 || n % 2 !== 0) {
    throw new Error(
      `Invalid player count: ${n}. Must be at least 4 and even.`
    );
  }

  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');

  if (teamA.length !== teamB.length) {
    throw new Error(
      `Teams must be equal size. A: ${teamA.length}, B: ${teamB.length}.`
    );
  }

  const shuffled = shuffle(createDeck()); // 54 cards

  // Split deck cleanly down the middle — each team gets exactly 27
  const cardsForA = shuffled.slice(0, 27);
  const cardsForB = shuffled.slice(27);

  // Distribute each team's 27 cards evenly among its players
  const handsA = distributeEvenly(cardsForA, teamA.length);
  const handsB = distributeEvenly(cardsForB, teamB.length);

  const result = {};
  teamA.forEach((p, i) => { result[p.id] = handsA[i]; });
  teamB.forEach((p, i) => { result[p.id] = handsB[i]; });
  return result;
}

module.exports = { createDeck, shuffle, distributeEvenly, dealToPlayers };
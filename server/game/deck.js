/**
 * deck.js
 * Builds, shuffles, and deals the 54-card Literature deck.
 *
 * Responsibilities:
 *   - createDeck()    → ordered array of all 54 card IDs
 *   - shuffle(deck)   → Fisher-Yates shuffle, returns new array
 *   - deal(deck, n)   → splits deck into n hands of equal size
 */

const { ALL_CARDS } = require('./sets');

/**
 * Returns a fresh, ordered copy of all 54 cards.
 * Ordering doesn't matter for game logic but is useful for tests.
 */
function createDeck() {
  return [...ALL_CARDS]; // copy — never mutate the source constant
}

/**
 * Fisher-Yates shuffle.
 * Returns a NEW shuffled array; does not mutate the input.
 *
 * @param {string[]} deck
 * @returns {string[]}
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
 * Deals a shuffled deck into n equal hands.
 * Literature is always 6 players × 9 cards = 54 cards.
 *
 * @param {string[]} deck   - shuffled 54-card array
 * @param {number}   n      - number of players
 * @returns {string[][]}    - array of n hands
 *
 */
function deal(deck, n = 6) {
  const hands = Array.from({ length: n }, () => []);
  deck.forEach((card, index) => {
    hands[index % n].push(card);
  });
  return hands;
}

/**
 * Convenience: shuffle + deal in one call.
 * Returns an object mapping playerIds → hand array.
 *
 * @param {string[]} playerIds  - ordered array of n player socket IDs
 * @returns {{ [playerId: string]: string[] }}
 */
function dealToPlayers(playerIds) {
  const numPlayers = playerIds.length;
  if (numPlayers < 4 || numPlayers % 2 !== 0) {
    throw new Error(`Invalid number of players: ${numPlayers}. Must be at least 4 and an even number.`);
  }
  const deck = createDeck();
  const shuffled = shuffle(deck);
  const hands = deal(shuffled, numPlayers);

  const result = {};
  playerIds.forEach((id, i) => {
    result[id] = hands[i];
  });
  return result;
}

module.exports = { createDeck, shuffle, deal, dealToPlayers };
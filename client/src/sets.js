/**
 * sets.js
 * Pure data — no logic, no side effects.
 * Every other file imports from here.
 *
 * 54 cards across 9 sets of 6:
 *   LOW_S / LOW_H / LOW_D / LOW_C  → A-6 of each suit
 *   HIGH_S / HIGH_H / HIGH_D / HIGH_C → 8-K of each suit
 *   SEVENS                          → 7♠ 7♥ 7♦ 7♣ + 2 Jokers
 *
 * Card ID format: rank + suit
 *   Ranks: A 2 3 4 5 6 7 8 9 T J Q K
 *   Suits: S H D C
 *   Jokers: J1 J2
 */

const SETS = {
  LOW_S:  ['AS', '2S', '3S', '4S', '5S', '6S'],
  LOW_H:  ['AH', '2H', '3H', '4H', '5H', '6H'],
  LOW_D:  ['AD', '2D', '3D', '4D', '5D', '6D'],
  LOW_C:  ['AC', '2C', '3C', '4C', '5C', '6C'],
  HIGH_S: ['8S', '9S', 'TS', 'JS', 'QS', 'KS'],
  HIGH_H: ['8H', '9H', 'TH', 'JH', 'QH', 'KH'],
  HIGH_D: ['8D', '9D', 'TD', 'JD', 'QD', 'KD'],
  HIGH_C: ['8C', '9C', 'TC', 'JC', 'QC', 'KC'],
  SEVENS: ['7S', '7H', '7D', '7C', 'J1', 'J2'],
};

// All 54 card IDs as a flat array — used to validate card IDs
const ALL_CARDS = Object.values(SETS).flat();

// Reverse lookup: card ID → set name  e.g. 'QH' → 'HIGH_H'
const CARD_TO_SET = {};
for (const [setName, cards] of Object.entries(SETS)) {
  for (const card of cards) {
    CARD_TO_SET[card] = setName;
  }
}

// Human-readable display names for the UI and game log
const SET_DISPLAY_NAMES = {
  LOW_S:  'Lower Spades (A–6♠)',
  LOW_H:  'Lower Hearts (A–6♥)',
  LOW_D:  'Lower Diamonds (A–6♦)',
  LOW_C:  'Lower Clubs (A–6♣)',
  HIGH_S: 'Upper Spades (8–K♠)',
  HIGH_H: 'Upper Hearts (8–K♥)',
  HIGH_D: 'Upper Diamonds (8–K♦)',
  HIGH_C: 'Upper Clubs (8–K♣)',
  SEVENS: 'Sevens & Jokers',
};

/**
 * Returns the set name for a given card ID.
 * Throws if the card ID is not recognised.
 */
function getSet(cardId) {
  const set = CARD_TO_SET[cardId];
  if (!set) throw new Error(`Unknown card: "${cardId}"`);
  return set;
}

/**
 * Returns true if cardA and cardB belong to the same set.
 */
function sameSets(cardA, cardB) {
  return CARD_TO_SET[cardA] === CARD_TO_SET[cardB];
}

/**
 * Returns all cards in the same set as the given card.
 */
function setMates(cardId) {
  return SETS[getSet(cardId)];
}

export {
  SETS,
  ALL_CARDS,
  CARD_TO_SET,
  SET_DISPLAY_NAMES,
  getSet,
  sameSets,
  setMates,
};
/**
 * Hand.jsx
 * Displays the local player's cards, grouped by set.
 *
 * Props:
 *   hand          string[]         — the player's current cards
 *   resolvedSets  string[]         — sets already won/discarded (greyed out group headers)
 *   selectedCard  string|null      — card currently selected for an ask
 *   onSelectCard  (cardId) => void — called when the player clicks a card
 *                                    clicking the same card again deselects it
 *
 * A card is selectable only if:
 *   - It's in the player's hand
 *   - Its set is not yet resolved
 */

import { SETS, SET_DISPLAY_NAMES, CARD_TO_SET } from '../sets';

// ── Card display helpers ──────────────────────────────────────────────────────

const RANK_DISPLAY = {
  A: 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', T: '10', J: 'J', Q: 'Q', K: 'K',
  J1: '🃏', J2: '🃏',
};

const SUIT_DISPLAY = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_COLOR   = { S: 'black', H: 'red', D: 'red', C: 'black' };

function parseCard(cardId) {
  if (cardId === 'J1' || cardId === 'J2') {
    return { rank: '🃏', suit: '', color: 'purple', label: 'Joker' };
  }
  const suit  = cardId.slice(-1);
  const rank  = cardId.slice(0, -1);
  return {
    rank:  RANK_DISPLAY[rank] ?? rank,
    suit:  SUIT_DISPLAY[suit] ?? suit,
    color: SUIT_COLOR[suit] ?? 'black',
    label: `${RANK_DISPLAY[rank]}${SUIT_DISPLAY[suit]}`,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Hand({ hand = [], resolvedSets = [], selectedCard, onSelectCard }) {
  // Group hand cards by set, preserving canonical set order
  const cardsBySet = {};
  for (const cardId of hand) {
    const setName = CARD_TO_SET[cardId];
    if (!cardsBySet[setName]) cardsBySet[setName] = [];
    cardsBySet[setName].push(cardId);
  }

  // Only render sets where the player holds at least one card,
  // or sets that are resolved (so the player can see what's gone)
  const setsToShow = Object.keys(SETS).filter(
    setName => cardsBySet[setName]?.length > 0
  );

  if (setsToShow.length === 0) {
    return (
      <div className="hand hand--empty">
        <p className="hand__empty-msg">You have no cards.</p>
      </div>
    );
  }

  return (
    <div className="hand">
      {setsToShow.map(setName => {
        const isResolved = resolvedSets.includes(setName);
        const cards      = cardsBySet[setName];

        return (
          <div
            key={setName}
            className={`hand__set ${isResolved ? 'hand__set--resolved' : ''}`}
          >
            <span className="hand__set-label">
              {SET_DISPLAY_NAMES[setName]}
            </span>

            <div className="hand__cards">
              {cards.map(cardId => {
                const { rank, suit, color, label } = parseCard(cardId);
                const isSelected  = selectedCard === cardId;
                const isSelectable = !isResolved;

                return (
                  <button
                    key={cardId}
                    className={[
                      'hand__card',
                      `hand__card--${color}`,
                      isSelected   ? 'hand__card--selected'   : '',
                      !isSelectable ? 'hand__card--disabled'  : '',
                    ].join(' ').trim()}
                    onClick={() => {
                      if (!isSelectable) return;
                      onSelectCard?.(isSelected ? null : cardId);
                    }}
                    disabled={!isSelectable}
                    aria-label={label}
                    aria-pressed={isSelected}
                  >
                    <span className="hand__card-rank">{rank}</span>
                    <span className="hand__card-suit">{suit}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

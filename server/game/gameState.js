/**
 * gameState.js
 * The complete server-side game engine for Literature.
 *
 * This module is the single source of truth. The socket server calls these
 * functions and broadcasts the results — it never applies rules itself.
 *
 * Public API:
 *   createGame(roomId, players)          → initialState
 *   askCard(state, askerId, targetId, cardId)  → { ok, newState, event }
 *   claimSet(state, claimerId, setName, mapping) → { ok, newState, event }
 *   getPublicState(state, forPlayerId)   → safe view for one player
 */

const { SETS, CARD_TO_SET, SET_DISPLAY_NAMES, getSet, sameSets } = require('./sets');
const { dealToPlayers } = require('./deck');

// ─────────────────────────────────────────────────────────────────────────────
// CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fresh game state.
 *
 * @param {string}   roomId
 * @param {{ id: string, name: string, team: 'A'|'B' }[]} players
\ * @returns {GameState}
 */
function createGame(roomId, players) {
  _validatePlayers(players);

  const playerIds = players.map(p => p.id);
  const hands     = dealToPlayers(players);

  const teams = {
    A: players.filter(p => p.team === 'A').map(p => p.id),
    B: players.filter(p => p.team === 'B').map(p => p.id),
  };

  // First turn: random player
  const firstPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];

  return {
    roomId,
    phase:       'playing',       // 'lobby' | 'playing' | 'finished'
    players:     Object.fromEntries(players.map(p => [p.id, { id: p.id, name: p.name, team: p.team }])),
    teams,
    hands,                        // { [playerId]: string[] }  — PRIVATE
    currentTurn: firstPlayer,
    score:       { A: 0, B: 0 },
    wonSets:     { A: [], B: [] },// sets won by each team
    discardedSets: [],            // sets lost to bad claims
    resolvedSets:  [],            // union of won + discarded (no longer in play)
    lastAction:  null,            // { type, by, detail } — drives the game log
    winner:      null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ASK CARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One player asks another for a specific card.
 *
 * Rules enforced:
 *   1. It is the asker's turn.
 *   2. The asker does not already hold the card.
 *   3. The asker holds at least one card from the same set.
 *   4. The target is on the opposing team.
 *   5. The card's set has not already been resolved.
 *   6. The target must have at least one card (can't ask someone with 0 cards,
 *      but they can still be asked — the rule is that they simply cannot be the
 *      active asker on their own turn).
 *
 * @returns {{ ok: boolean, error?: string, newState: GameState, event: object }}
 */
function askCard(state, askerId, targetId, cardId) {
  // ── Validation ──────────────────────────────────────────────────────────
  if (state.phase !== 'playing') {
    return _fail(state, 'Game is not in progress.');
  }
  if (state.currentTurn !== askerId) {
    return _fail(state, 'It is not your turn.');
  }

  const askerHand = state.hands[askerId];
  const targetHand = state.hands[targetId];

  if (!askerHand || !targetHand) {
    return _fail(state, 'Invalid player ID.');
  }

  if (askerHand.includes(cardId)) {
    return _fail(state, 'You already hold that card.');
  }

  const setName = CARD_TO_SET[cardId];
  if (!setName) {
    return _fail(state, `Unknown card: "${cardId}".`);
  }

  if (state.resolvedSets.includes(setName)) {
    return _fail(state, 'That set has already been claimed.');
  }

  // The asker must hold at least one card from the same set
  const hasSetCard = askerHand.some(c => CARD_TO_SET[c] === setName);
  if (!hasSetCard) {
    return _fail(state, 'You must hold a card from that set to ask for one.');
  }

  // Target must be on the opposing team
  const askerTeam  = state.players[askerId].team;
  const targetTeam = state.players[targetId].team;
  if (askerTeam === targetTeam) {
    return _fail(state, 'You can only ask players on the opposing team.');
  }

  // ── Resolution ──────────────────────────────────────────────────────────
  const newState  = _cloneState(state);
  const askerName = state.players[askerId].name;
  const targetName = state.players[targetId].name;

  if (targetHand.includes(cardId)) {
    // Success: card moves to asker; turn stays with asker
    newState.hands[targetId] = targetHand.filter(c => c !== cardId);
    newState.hands[askerId]  = [...askerHand, cardId];

    newState.lastAction = {
      type:   'ask_success',
      by:     askerId,
      detail: `${askerName} asked ${targetName} for ${cardId} — success! Turn stays.`,
    };

    // currentTurn stays as askerId
  } else {
    // Failure: card stays where it is; turn passes to target
    newState.currentTurn = targetId;

    newState.lastAction = {
      type:   'ask_fail',
      by:     askerId,
      detail: `${askerName} asked ${targetName} for ${cardId} — failed. ${targetName}'s turn.`,
    };
  }

  // After any ask, a player with 0 cards skips their turn
  newState.currentTurn = _skipEmptyHands(newState, newState.currentTurn);

  return { ok: true, newState, event: newState.lastAction };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM SET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A player claims a full set, stating who holds each card.
 *
 * @param {GameState} state
 * @param {string}    claimerId   - the player making the claim
 * @param {string}    setName     - e.g. 'HIGH_H'
 * @param {{ [cardId: string]: string }} mapping
 *   Maps every card in the set to the player the claimer believes holds it.
 *   All 6 cards must be included, all mapped players must be on the claimer's team.
 *
 * Outcomes:
 *   'success'  - all locations correct → claimer's team scores +1
 *   'discard'  - team holds all cards but ≥1 location wrong → set discarded, no points
 *   'stolen'   - opponent team holds ≥1 card → opponent team scores +1
 */
function claimSet(state, claimerId, setName, mapping) {
  // ── Validation ──────────────────────────────────────────────────────────
  if (state.phase !== 'playing') {
    return _fail(state, 'Game is not in progress.');
  }

  const claimerTeam = state.players[claimerId]?.team;
  if (!claimerTeam) return _fail(state, 'Invalid claimer ID.');

  // // The claimer's TEAM must be the one whose turn it is
  // const activeTeam = state.players[state.currentTurn]?.team;
  // if (claimerTeam !== activeTeam) {
  //   return _fail(state, 'It is not your team\'s turn.');
  // }

  if (!SETS[setName]) {
    return _fail(state, `Unknown set: "${setName}".`);
  }

  if (state.resolvedSets.includes(setName)) {
    return _fail(state, 'That set has already been resolved.');
  }

  const setCards = SETS[setName];

  // mapping must cover every card in the set
  const missingCards = setCards.filter(c => !(c in mapping));
  if (missingCards.length > 0) {
    return _fail(state, `Claim incomplete — missing cards: ${missingCards.join(', ')}.`);
  }

  // All claimed holders must be on the claimer's team
  const teamIds = new Set(state.teams[claimerTeam]);
  for (const [card, holder] of Object.entries(mapping)) {
    if (!teamIds.has(holder)) {
      return _fail(state, `Card ${card} mapped to ${holder} who is not on your team.`);
    }
  }

  // ── Resolution ──────────────────────────────────────────────────────────
  const opponentTeam = claimerTeam === 'A' ? 'B' : 'A';

  // Check if the opponent holds any card in this set
  const opponentHasCard = state.teams[opponentTeam].some(pid =>
    setCards.some(card => state.hands[pid]?.includes(card))
  );

  const newState = _cloneState(state);
  const claimerName = state.players[claimerId].name;
  let outcome;

  if (opponentHasCard) {
    // STOLEN: opponent scores
    outcome = 'stolen';
    newState.score[opponentTeam] += 1;
    newState.wonSets[opponentTeam].push(setName);
    newState.lastAction = {
      type:    'claim_stolen',
      by:      claimerId,
      detail:  `${claimerName} claimed ${SET_DISPLAY_NAMES[setName]} — but the opponent held a card! ${opponentTeam} wins the set.`,
      setName,
    };
    // // Turn goes to opponent team
    // newState.currentTurn = _firstWithCards(newState, opponentTeam);
    newState.currentTurn = _skipEmptyHands(newState, claimerId);
    // If claimer is empty, find next on same team
    if (!newState.currentTurn) {
      newState.currentTurn = _firstWithCards(newState, claimerTeam);
    }
  } else {
    // All cards are on the claimer's team — check location accuracy
    const allCorrect = setCards.every(card => {
      const claimedHolder = mapping[card];
      return newState.hands[claimedHolder]?.includes(card);
    });

    if (allCorrect) {
      // SUCCESS: claimer's team scores
      outcome = 'success';
      newState.score[claimerTeam] += 1;
      newState.wonSets[claimerTeam].push(setName);
      newState.lastAction = {
        type:    'claim_success',
        by:      claimerId,
        detail:  `${claimerName} claimed ${SET_DISPLAY_NAMES[setName]} — correct! ${claimerTeam} wins the set.`,
        setName,
      };
      // Turn stays with claimer's team
      newState.currentTurn = _skipEmptyHands(newState, claimerId);
      // If claimer is empty, find next on same team
      if (!newState.currentTurn) {
        newState.currentTurn = _firstWithCards(newState, claimerTeam);
      }
    } else {
      // DISCARD: no one scores
      outcome = 'discard';
      newState.discardedSets.push(setName);
      newState.lastAction = {
        type:    'claim_discard',
        by:      claimerId,
        detail:  `${claimerName} claimed ${SET_DISPLAY_NAMES[setName]} — wrong locations! Set discarded. Turn passes to team ${opponentTeam}.`,
        setName,
      };
      // // Turn goes to opponent team
      // newState.currentTurn = _firstWithCards(newState, opponentTeam);
      newState.currentTurn = _skipEmptyHands(newState, claimerId);
      // If claimer is empty, find next on same team
      if (!newState.currentTurn) {
        newState.currentTurn = _firstWithCards(newState, claimerTeam);
      }
    }
  }

  // Remove claimed set's cards from all hands
  _removeSetFromHands(newState, setCards);
  newState.resolvedSets.push(setName);

  // Check if game is over
  const totalSets = Object.keys(SETS).length;
  if (newState.resolvedSets.length === totalSets) {
    newState.phase  = 'finished';
    newState.winner = _determineWinner(newState.score);
    newState.lastAction.detail += ` Game over! Winner: ${newState.winner ?? '(draw)'}.`;
  }

  return { ok: true, outcome, newState, event: newState.lastAction };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC STATE (safe to send to a specific player)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a view of the state safe to send to one player.
 * Their own hand is included; other players' hands are replaced with counts.
 *
 * @param {GameState} state
 * @param {string}    forPlayerId
 * @returns {PublicState}
 */
function getPublicState(state, forPlayerId) {
  const handCounts = {};
  for (const [pid, hand] of Object.entries(state.hands)) {
    handCounts[pid] = hand.length;
  }

  return {
    roomId:        state.roomId,
    phase:         state.phase,
    players:       state.players,
    teams:         state.teams,
    currentTurn:   state.currentTurn,
    score:         state.score,
    wonSets:       state.wonSets,
    discardedSets: state.discardedSets,
    resolvedSets:  state.resolvedSets,
    lastAction:    state.lastAction,
    winner:        state.winner,
    myHand:        state.hands[forPlayerId] ?? [],   // private
    handCounts,                                       // all players — for UI
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _validatePlayers(players) {
  const numPlayers = players.length;
  if (numPlayers < 4 || numPlayers % 2 !== 0) {
    throw new Error(`Literature requires at least 4 players, and an even number of players.`);
  }
  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');
  if (teamA.length !== numPlayers / 2 || teamB.length !== numPlayers / 2) {
    throw new Error('Teams must be of equal size.');
  }
  const ids = players.map(p => p.id);
  if (new Set(ids).size !== numPlayers) {
    throw new Error('Player IDs must be unique.');
  }
}

function _holderOf(cardId, hands) {
  for (const [pid, hand] of Object.entries(hands)) {
    if (hand.includes(cardId)) return pid;
  }
  return null;
}

/**
 * Deep-clone only the parts of state that mutations touch.
 * Keeps things fast without a full JSON.parse/stringify.
 */
function _cloneState(state) {
  return {
    ...state,
    hands:         Object.fromEntries(
      Object.entries(state.hands).map(([pid, h]) => [pid, [...h]])
    ),
    score:         { ...state.score },
    wonSets:       { A: [...state.wonSets.A], B: [...state.wonSets.B] },
    discardedSets: [...state.discardedSets],
    resolvedSets:  [...state.resolvedSets],
    teams:         { A: [...state.teams.A], B: [...state.teams.B] },
  };
}

function _removeSetFromHands(state, setCards) {
  for (const pid of Object.keys(state.hands)) {
    state.hands[pid] = state.hands[pid].filter(c => !setCards.includes(c));
  }
}

/**
 * If the given player's hand is empty, find the next team-mate who has cards.
 * Returns the player ID to give the turn to, or null if the whole team is empty
 * (which shouldn't happen during normal play).
 */
function _skipEmptyHands(state, playerId) {
  if (!playerId) return null;
  if (state.hands[playerId]?.length > 0) return playerId;
  const team = state.players[playerId]?.team;
  if (!team) return null;
  return _firstWithCards(state, team);
}

function _firstWithCards(state, team) {
  return (
    state.teams[team].find(pid => state.hands[pid]?.length > 0) ?? null
  );
}

function _determineWinner(score) {
  if (score.A > score.B) return 'A';
  if (score.B > score.A) return 'B';
  return null; // draw
}

function _fail(state, error) {
  return { ok: false, error, newState: state, event: null };
}

module.exports = {
  createGame,
  askCard,
  claimSet,
  getPublicState,
};
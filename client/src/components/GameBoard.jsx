/**
 * GameBoard.jsx
 * The main in-game screen.
 *
 * Responsibilities:
 *   - Show all players, their hand counts, and whose turn it is
 *   - Show scores and resolved sets
 *   - Ask flow: select a card from Hand → select an opponent → emit ask_card
 *   - Claim flow: open ClaimModal → emit claim_set
 *   - Show GameLog (last action)
 *
 * Props:
 *   gameState   PublicGameState   — from App.jsx (updated on every game_update)
 */

import { useState, useEffect } from 'react';
import socket from '../socket';
import Hand        from './Hand';
import ClaimModal  from './ClaimModal';
import GameLog     from './GameLog';
import { SETS, CARD_TO_SET } from '../sets'; // Import the set definitions

export default function GameBoard({ gameState }) {
  const [selectedCard,  setSelectedCard]  = useState(null);  // card chosen to ask for
  const [selectedTarget, setSelectedTarget] = useState(null); // opponent chosen to ask
  const [showClaim, setShowClaim]         = useState(false);

  // Clear ask selections whenever the game state updates
  useEffect(() => {
    setSelectedCard(null);
    setSelectedTarget(null);
  }, [gameState?.currentTurn]);

  if (!gameState) return <div className="board board--loading">Loading…</div>;

  const {
    players = {},
    teams = {},
    myHand = [],
    handCounts = {},
    currentTurn = null,
    score = { A: 0, B: 0 },
    resolvedSets = [],
    wonSets = { A: [], B: [] },
    discardedSets = [],
    lastAction = null,
    winner = null,
  } = gameState;

  const myId     = socket.id;
  const me       = players[myId];
  const myTeam   = me?.team;
  const isMyTurn = currentTurn === myId;

  const allPlayers    = Object.values(players);
  const opponents     = allPlayers.filter(p => p.team !== myTeam);
  const teammates     = allPlayers.filter(p => p.team === myTeam && p.id !== myId);

  // Calculate valid cards to ask for (must own a card in the set, but not the card itself)
  const validAskCards = [];
  if (isMyTurn && myHand.length > 0) {
    const myActiveSets = new Set(myHand.map(cardId => CARD_TO_SET[cardId]));
    myActiveSets.forEach(setName => {
      SETS[setName].forEach(cardId => {
        if (!myHand.includes(cardId)) {
          validAskCards.push(cardId);
        }
      });
    });
  }

  // ── Ask flow ────────────────────────────────────────────────────────────────

  function handleSelectCard(cardId) {
    setSelectedCard(cardId);
    setSelectedTarget(null); // reset target when card changes
  }

  function handleSelectTarget(playerId) {
    if (!isMyTurn || !selectedCard) return;
    setSelectedTarget(playerId);
  }

  function handleAsk() {
    if (!isMyTurn || !selectedCard || !selectedTarget) return;
    socket.emit('ask_card', { targetId: selectedTarget, cardId: selectedCard });
    setSelectedCard(null);
    setSelectedTarget(null);
  }

  // ── Claim flow ──────────────────────────────────────────────────────────────

  function handleClaimSubmit(setName, mapping) {
    socket.emit('claim_set', { setName, mapping });
    setShowClaim(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="board">

      {/* ── Scoreboard ─────────────────────────────────────────────────── */}
      <header className="board__header">
        <div className="board__score">
          <span className={`board__score-team ${myTeam === 'A' ? 'board__score-team--mine' : ''}`}>
            Team A: {score.A}
          </span>
          <span className="board__score-sep">–</span>
          <span className={`board__score-team ${myTeam === 'B' ? 'board__score-team--mine' : ''}`}>
            Team B: {score.B}
          </span>
        </div>

        <div className="board__turn-indicator">
          {isMyTurn
            ? <strong>Your turn</strong>
            : <span>
                {players[currentTurn]?.name ?? '…'}'s turn
              </span>
          }
        </div>

        {/* Claim button — anyone can claim at any time */}
        <button
          className="board__claim-btn"
          onClick={() => setShowClaim(true)}
        >
          Claim a Set
        </button>
      </header>

      {/* ── Game log ───────────────────────────────────────────────────── */}
      <GameLog lastAction={lastAction} />

      {/* ── Players panel ──────────────────────────────────────────────── */}
      <div className="board__players">

        {/* Opponents — clickable when it's your turn and you've picked a card */}
        <div className="board__player-group board__player-group--opponents">
          <h3>Opponents</h3>
          <div className="board__player-list">
            {opponents.map(p => {
              const isTarget    = selectedTarget === p.id;
              const isClickable = isMyTurn && !!selectedCard && handCounts[p.id] > 0;

              return (
                <div
                  key={p.id}
                  className={[
                    'board__player',
                    'board__player--opponent',
                    isTarget    ? 'board__player--target'    : '',
                    isClickable ? 'board__player--clickable' : '',
                    handCounts[p.id] === 0 ? 'board__player--empty' : '',
                  ].join(' ').trim()}
                  onClick={() => isClickable && handleSelectTarget(p.id)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={e => e.key === 'Enter' && isClickable && handleSelectTarget(p.id)}
                >
                  <span className="board__player-name">{p.name}</span>
                  <span className="board__player-count">{handCounts[p.id]} cards</span>
                  {p.id === currentTurn && (
                    <span className="board__player-turn-badge">●</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Teammates */}
        <div className="board__player-group board__player-group--teammates">
          <h3>Teammates</h3>
          <div className="board__player-list">
            {teammates.map(p => (
              <div
                key={p.id}
                className={[
                  'board__player',
                  'board__player--teammate',
                  handCounts[p.id] === 0 ? 'board__player--empty' : '',
                ].join(' ').trim()}
              >
                <span className="board__player-name">{p.name}</span>
                <span className="board__player-count">{handCounts[p.id]} cards</span>
                {p.id === currentTurn && (
                  <span className="board__player-turn-badge">●</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Ask action bar ─────────────────────────────────────────────── */}
      {isMyTurn && (
        <div className="board__ask-bar">
          <div className="board__ask-select">
            <label>Ask for: </label>
            <select
              value={selectedCard || ''}
              onChange={(e) => {
                setSelectedCard(e.target.value || null);
                setSelectedTarget(null); // Reset target if card changes
              }}
            >
              <option value="">-- Choose a card --</option>
              {validAskCards.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {!selectedCard && (
            <p className="board__ask-hint">Select a card from the dropdown to ask for it.</p>
          )}
          {selectedCard && !selectedTarget && (
            <p className="board__ask-hint">
              Asking for <strong>{selectedCard}</strong> — now pick an opponent above.
            </p>
          )}
          {selectedCard && selectedTarget && (
            <>
              <p className="board__ask-hint">
                Ask <strong>{players[selectedTarget]?.name}</strong> for <strong>{selectedCard}</strong>?
              </p>
              <div className="board__ask-actions">
                <button className="board__btn board__btn--ask" onClick={handleAsk}>
                  Ask
                </button>
                <button
                  className="board__btn board__btn--cancel"
                  onClick={() => { setSelectedCard(null); setSelectedTarget(null); }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
      

      {/* ── Your hand ──────────────────────────────────────────────────── */}
      <div className="board__hand-area">
        <h3 className="board__hand-title">
          Your hand ({myHand.length} cards)
        </h3>
        <Hand
          hand={myHand}
          resolvedSets={resolvedSets}
          selectedCard={isMyTurn ? selectedCard : null}
          onSelectCard={isMyTurn ? handleSelectCard : undefined}
        />
      </div>

      {/* ── Sets status ────────────────────────────────────────────────── */}
      <div className="board__sets-status">
        <div className="board__sets-col">
          <h4>Team A won</h4>
          {wonSets.A.length === 0
            ? <span className="board__sets-none">—</span>
            : wonSets.A.map(s => <span key={s} className="board__set-chip board__set-chip--a">{s}</span>)
          }
        </div>
        <div className="board__sets-col">
          <h4>Discarded</h4>
          {discardedSets.length === 0
            ? <span className="board__sets-none">—</span>
            : discardedSets.map(s => <span key={s} className="board__set-chip board__set-chip--discard">{s}</span>)
          }
        </div>
        <div className="board__sets-col">
          <h4>Team B won</h4>
          {wonSets.B.length === 0
            ? <span className="board__sets-none">—</span>
            : wonSets.B.map(s => <span key={s} className="board__set-chip board__set-chip--b">{s}</span>)
          }
        </div>
      </div>

      {/* ── Claim modal ────────────────────────────────────────────────── */}
      {showClaim && (
        <ClaimModal
          players={allPlayers}
          myId={myId}
          myTeam={myTeam}
          resolvedSets={resolvedSets}
          onSubmit={handleClaimSubmit}
          onClose={() => setShowClaim(false)}
        />
      )}

    </div>
  );
}

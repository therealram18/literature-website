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
// import GameLog     from './GameLog';
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

  function computeSeats(playerOrder, players, myId, handCounts, currentTurn) {
    const n = playerOrder.length;
    const myIdx = playerOrder.indexOf(myId);
    const rx = 39, ry = 36;
    return playerOrder.map((pid, i) => {
      const offset = (i - myIdx + n) % n;
      const angleDeg = (270 + offset * (360 / n)) % 360;
      const rad = angleDeg * Math.PI / 180;
      return {
        pid,
        cx: 50 + rx * Math.cos(rad),
        cy: 50 + ry * Math.sin(rad),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="table-wrap">
      <div className="table-layout">

      {/* ── Scoreboard ─────────────────────────────────────────────────── */}
      <div className="table-header">
        <div className="turn-banner">
          <span>★</span>
          {isMyTurn ? <strong>Your turn</strong> : <span>{players[currentTurn]?.name ?? '…'}'s turn</span>}
        </div>
      </div>

      {/* ── Game log ───────────────────────────────────────────────────── */}
      {/* <GameLog lastAction={lastAction} /> */}

      {/* ── Players panel ──────────────────────────────────────────────── */}
      <div className="felt-zone" style={{ position: 'relative' }}>
        <div className="felt-inner" />
        <div className="felt-logo">LITERATURE</div>
        {computeSeats(state.playerOrder, players, myId, handCounts, currentTurn).map(seat => (
          <div
            key={seat.pid}
            className="seat"
            style={{ left: `${seat.cx}%`, top: `${seat.cy}%` }}
          >
            <div
              className={[
                'seat-bubble',
                seat.pid === myId ? 'you' : `team-${players[seat.pid]?.team?.toLowerCase()}`,
                seat.pid === currentTurn ? 'active' : '',
              ].join(' ').trim()}
              onClick={() => {
                if (isMyTurn && selectedCard && players[seat.pid]?.team !== myTeam) {
                  handleSelectTarget(seat.pid);
                }
              }}
              style={{ cursor: isMyTurn && selectedCard && players[seat.pid]?.team !== myTeam ? 'pointer' : 'default' }}
            >
              {seat.pid === currentTurn && <div className="seat-badge">★</div>}
              {players[seat.pid]?.name?.substring(0, 3).toUpperCase()}
            </div>
            <div className="seat-label">{players[seat.pid]?.name}</div>
            <div className="card-count-chip">{handCounts[seat.pid] ?? 0} cards</div>
          </div>
        ))}
      </div>

      {/* ── Ask action bar ─────────────────────────────────────────────── */}
      {isMyTurn && selectedCard && selectedTarget && (
        <div className="action-confirm-bar">
          <p>Ask <strong>{players[selectedTarget]?.name}</strong> for <strong>{selectedCard}</strong>?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="big-btn btn-orange" style={{ flex: 1 }} onClick={handleAsk}>Ask</button>
            <button className="big-btn btn-outline" style={{ flex: 1 }}
              onClick={() => { setSelectedCard(null); setSelectedTarget(null); }}>
              Cancel
            </button>
          </div>
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

      {/* ── Add sidebar ────────────────────────────────────────────────── */}

      <div className="table-sidebar">

        {/* Scores */}
        <div className="score-strip">
          {Object.entries(score).map(([team, pts]) => (
            <div key={team} className="score-chip"
              style={{ background: team === 'A' ? '#EFF6FF' : '#FFF0F7' }}>
              <div className="s-left">
                <span className="s-label">Team {team}</span>
                <span className="s-sub">
                  {(wonSets[team] ?? []).join(', ') || 'No sets yet'}
                </span>
              </div>
              <div className="s-num">{pts}</div>
            </div>
          ))}
          {discardedSets.length > 0 && (
            <div className="score-chip" style={{ background: '#F9FAFB' }}>
              <div className="s-left">
                <span className="s-label">Discarded</span>
                <span className="s-sub">{discardedSets.join(', ')}</span>
              </div>
              <div className="s-num" style={{ fontSize: 20 }}>✗</div>
            </div>
          )}
        </div>

        {/* Claim button */}
        <div className="action-row">
          <button className="big-btn btn-pink" onClick={() => setShowClaim(true)}>
            Claim a Set
          </button>
        </div>

        {/* Activity log */}
        <div className="activity-log">
          <div className="log-title" id="logTitle">Last move</div>
          <div id="logContent">
            {lastAction ? (
              <div className="log-item log-main">
                {lastAction.type === 'ask' && (
                  <span>
                    <strong>{players[lastAction.askerId]?.name}</strong> asked{' '}
                    <strong>{players[lastAction.targetId]?.name}</strong> for{' '}
                    <strong>{lastAction.card}</strong> —{' '}
                    {lastAction.success ? 'got it! 🎉' : 'nope 😅'}
                  </span>
                )}
                {lastAction.type === 'claim' && (
                  <span>
                    <strong>{players[lastAction.claimerId]?.name}</strong> claimed{' '}
                    <strong>{lastAction.setId}</strong> —{' '}
                    {lastAction.result === 'claimed' ? '✅ correct!' :
                    lastAction.result === 'discarded' ? '❌ discarded' :
                    '⚡ opponent wins!'}
                  </span>
                )}
              </div>
            ) : (
              <div className="log-item" style={{ color: '#aaa' }}>No moves yet</div>
            )}
          </div>
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
    </div>
  );
}

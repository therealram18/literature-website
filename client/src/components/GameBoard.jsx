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
import AskModal from './AskModal';
// import GameLog     from './GameLog';
import { SETS, CARD_TO_SET } from '../sets'; // Import the set definitions
import characters from '../characters';

export default function GameBoard({ gameState }) {
  const [selectedCard,  setSelectedCard]  = useState(null);  // card chosen to ask for
  const [selectedTarget, setSelectedTarget] = useState(null); // opponent chosen to ask
  const [showClaim, setShowClaim]         = useState(false);
  const [showAsk, setShowAsk]             = useState(false);

  // Clear ask selections whenever the game state updates
  useEffect(() => {
    setSelectedCard(null);
    setSelectedTarget(null);
  }, [gameState?.currentTurn]);

  if (!gameState) return <div className="board board--loading">Loading…</div>;

  const {
    players = {},
    teams = {},
    playerOrder = [],
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

  // ── Custom Alternating Sort Logic ──────────────────────────────────────────
  
  // Alternating Red/Black order matching the IDs in your sets.js file
  const SET_ORDER = [
    'LOW_D',  // Red (Lower Diamonds)
    'LOW_S',  // Black (Lower Spades)
    'LOW_H',  // Red (Lower Hearts)
    'LOW_C',  // Black (Lower Clubs)
    'HIGH_D', // Red (Upper Diamonds)
    'HIGH_S', // Black (Upper Spades)
    'HIGH_H', // Red (Upper Hearts)
    'HIGH_C', // Black (Upper Clubs)
    'SEVENS'  // Wildcards
  ];

  // Sort the hand using the custom alternating sequence
  const sortedHand = [...myHand].sort((cardA, cardB) => {
    const setA = CARD_TO_SET[cardA];
    const setB = CARD_TO_SET[cardB];
    
    const indexA = SET_ORDER.indexOf(setA);
    const indexB = SET_ORDER.indexOf(setB);
    
    // 1. Sort by the alternating Set Order
    if (indexA !== indexB) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    
    // 2. Sort alphabetically within the same set
    if (cardA < cardB) return -1;
    if (cardA > cardB) return 1;
    
    return 0; 
  });

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
    setShowAsk(false);
  }

  function handleSelectTarget(playerId) {
    if (!isMyTurn || !selectedCard) return;
    socket.emit('ask_card', { targetId: playerId, cardId: selectedCard });
    setSelectedCard(null);
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
    const myIdx = playerOrder.indexOf(myId) !== -1 ? playerOrder.indexOf(myId) : 0;
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
  // Fallback to Object.keys if playerOrder is empty/missing from the backend
  const pOrder = playerOrder?.length > 0 ? playerOrder : Object.keys(players);

  console.log("Seats rendering: ", computeSeats(pOrder, players, myId, handCounts, currentTurn));

  return (
    <div className="screen active">
      <div className="table-wrap">
        <div className="table-layout">

          {/* ── Scoreboard ─────────────────────────────────────────────────── */}
          <div className="table-header">
            <div className="turn-banner">
              <span>★</span>
              {isMyTurn ? <strong>Your turn</strong> : <span>{players[currentTurn]?.name ?? '…'}'s turn</span>}
            </div>

            {selectedCard && (
              <div style={{ background: 'var(--yellow)', padding: '8px 16px', borderRadius: '8px', border: '2px solid var(--orange)', display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
                <span>Asking for <strong>{selectedCard}</strong>. Click an opponent to ask!</span>
                <button className="big-btn btn-outline" style={{ minHeight: '0', padding: '4px 12px', fontSize: '13px' }} onClick={() => setSelectedCard(null)}>Cancel</button>
              </div>
            )}
          </div>

          {/* ── Players panel ──────────────────────────────────────────────── */}
          <div className="felt-zone">
            <div className="felt-inner" />
            <div className="felt-logo">LITERATURE</div>
            
            {computeSeats(pOrder, players, myId, handCounts, currentTurn).map(seat => {
              const p = players[seat.pid];
              if (!p) return null;
              const isOpponent = p.team !== myTeam;
              const canAsk = isMyTurn && selectedCard && isOpponent;

              return (
                <div
                  key={seat.pid}
                  className="seat"
                  style={{ left: `${seat.cx}%`, top: `${seat.cy}%` }} /* Stripped absolute/transform to trust CSS */
                >
                  <div
                    className={[
                      'seat-bubble',
                      seat.pid === myId ? 'you' : `team-${p.team?.toLowerCase()}`,
                      seat.pid === currentTurn ? 'active' : '',
                    ].join(' ').trim()}
                    onClick={() => canAsk && handleSelectTarget(seat.pid)}
                    style={{ cursor: canAsk ? 'pointer' : 'default' }}
                  >
                    {seat.pid === currentTurn && <div className="seat-badge">★</div>}
                    
                    {/* Clean up Avatar Image */}
                    {p.avatar ? (
                      <img 
                        src={characters.find(a => a.imageId === p.avatar)?.image || p.avatar} 
                        alt={p.name} 
                      />
                    ) : (
                      <span>{p.name?.substring(0, 3).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="seat-label">{p.name}</div>
                  <div className="card-count-chip">{handCounts[seat.pid] ?? 0} cards</div>
                </div>
              );
            })}
          </div>

          {/* ── Your hand ──────────────────────────────────────────────────── */}
          <div className="hand-section">
            <div className="section-title">
              Your hand ({myHand.length} cards)
            </div>
            <Hand
              hand={sortedHand}
              resolvedSets={resolvedSets}
              selectedCard={selectedCard} /* Re-enabled so you see what is selected */
              onSelectCard={handleSelectCard}
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

          {/* Action row */}
          <div className="action-row">
            <button 
              className="big-btn btn-orange" 
              disabled={!isMyTurn}
              onClick={() => setShowAsk(true)}
            >
              Ask for a Card!
            </button>
            <button 
              className="big-btn btn-purple" 
              onClick={() => setShowClaim(true)}
            >
              Claim
            </button>
          </div>

          {/* Activity log */}
          <div className="activity-log">
            <div className="log-title" id="logTitle">Last move</div>
            <div id="logContent">
              {lastAction ? (
                <div className="log-item log-main">
                  {(lastAction.type === 'ask_success' || lastAction.type === 'ask_fail') && (
                    <span>
                      <strong>{players[lastAction.askerId]?.name}</strong> asked{' '}
                      <strong>{players[lastAction.targetId]?.name}</strong> for{' '}
                      <strong>{lastAction.card || lastAction.cardId}</strong> —{' '}
                      {lastAction.type === 'ask_success' ? 'got it! 🎉' : 'nope 😅'}
                    </span>
                  )}
                  {(lastAction.type === 'claim_success' || lastAction.type === 'claim_stolen' || lastAction.type === 'claim_discard') && (
                    <span>
                      <strong>{players[lastAction.claimerId]?.name}</strong> claimed{' '}
                      <strong>{lastAction.setId || lastAction.setName}</strong> —{' '}
                      {lastAction.type === 'claim_success' ? '✅ correct!' :
                      lastAction.type === 'claim_discard' ? '❌ discarded' :
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

      </div>
      </div>
      {/* ── Ask modal ──────────────────────────────────────────────────── */}

      {showAsk && (
          <AskModal 
            myHand={myHand}
            validAskCards={validAskCards}
            onSelectCard={handleSelectCard}
            onClose={() => setShowAsk(false)}
          />
        )}

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

/**
 * ClaimModal.jsx
 * Lets any player claim a set by mapping each card to a teammate.
 *
 * Props:
 *   players       { id, name, team }[]  — all players in the game
 *   myId          string                — socket.id of the local player
 *   myTeam        'A'|'B'
 *   resolvedSets  string[]              — sets already gone (can't claim)
 *   onSubmit      (setName, mapping) => void
 *   onClose       () => void
 */

import { useState } from 'react';
import { SETS, SET_DISPLAY_NAMES } from '../sets';

export default function ClaimModal({
  players = [],
  myId,
  myTeam,
  resolvedSets = [],
  onSubmit,
  onClose,
}) {
  const [setName, setSetName]   = useState('');
  const [mapping, setMapping]   = useState({});  // { cardId: playerId }
  const [activeCard, setActiveCard] = useState(null);

  const teammates = players.filter(p => p.team === myTeam);

  // Sets still in play
  const availableSets = Object.keys(SETS).filter(
    s => !resolvedSets.includes(s)
  );

  // Cards in the currently selected set
  const setCards = setName ? SETS[setName] : [];

  // When the set changes, reset the mapping and the active card picker
  function handleSetChange(e) {
    setSetName(e.target.value);
    setMapping({});
    setActiveCard(null);
  }

  function handleAssign(cardId, playerId) {
    setMapping(prev => ({ ...prev, [cardId]: playerId }));
  }

  // All cards must be assigned before submitting
  const allAssigned =
    setName &&
    setCards.length > 0 &&
    setCards.every(c => mapping[c]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!allAssigned) return;
    onSubmit(setName, mapping);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Claim a set">
      <div className="modal">
        <div className="modal-head">
          <h2 className="modal__title">Claim a Set</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>

          {/* Step 1: pick the set */}
          <div className="modal__field">
            <label htmlFor="set-select">Which set are you claiming?</label>
            <select
              id="set-select"
              value={setName}
              onChange={handleSetChange}
              required
            >
              <option value="">— select a set —</option>
              {availableSets.map(s => (
                <option key={s} value={s}>{SET_DISPLAY_NAMES[s]}</option>
              ))}
            </select>
          </div>

          {/* Step 2: assign each card to a teammate */}
          {setName && (
            <div className="modal__assignments">
              <p className="modal__instructions" style={{ marginBottom: '1rem' }}>
                Who holds each card? (Setup the claim grid)
              </p>

              {/* 6-column grid */}
              <div className="card-grid">
                {setCards.map(cardId => {
                  const assignedToId = mapping[cardId];
                  const assignedPlayer = teammates.find(p => p.id === assignedToId);
                  
                  return (
                    <button
                      key={cardId}
                      type="button"
                      className={`card-pick ${assignedToId ? 'selected' : ''} ${activeCard === cardId ? 'active-picker' : ''}`.trim()}
                      onClick={() => setActiveCard(cardId)}
                    >
                      <div className="card-label">{cardId}</div>
                      <div className="owner-label" style={{ fontSize: '0.8em', color: '#666' }}>
                        {assignedPlayer ? (assignedPlayer.id === myId ? 'You' : assignedPlayer.name) : '?'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Small player picker (shows up below the grid when a card is clicked) */}
              {activeCard && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>
                    Assign <strong>{activeCard}</strong> to:
                  </p>
                  <div className="modal__teammate-btns">
                    {teammates.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={[
                          'modal__teammate-btn',
                          mapping[activeCard] === p.id ? 'modal__teammate-btn--selected' : '',
                          p.id === myId ? 'modal__teammate-btn--me' : '',
                        ].join(' ').trim()}
                        onClick={() => {
                          handleAssign(activeCard, p.id);
                          // Optionally, auto-close the picker or auto-advance to next empty card here
                        }}
                      >
                        {p.name}{p.id === myId ? ' (you)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="modal__footer">
            <button
              type="button"
              className="big-btn btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="big-btn btn-orange"
              disabled={!allAssigned}
            >
              Submit Claim
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

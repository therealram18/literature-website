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

  const teammates = players.filter(p => p.team === myTeam);

  // Sets still in play
  const availableSets = Object.keys(SETS).filter(
    s => !resolvedSets.includes(s)
  );

  // Cards in the currently selected set
  const setCards = setName ? SETS[setName] : [];

  // When the set changes, reset the mapping
  function handleSetChange(e) {
    setSetName(e.target.value);
    setMapping({});
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
        <div className="modal__header">
          <h2 className="modal__title">Claim a Set</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit}>

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
              <p className="modal__instructions">
                Who holds each card? (Only your teammates can hold them.)
              </p>

              {setCards.map(cardId => (
                <div key={cardId} className="modal__assignment-row">
                  <span className="modal__card-label">{cardId}</span>
                  <div className="modal__teammate-btns">
                    {teammates.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={[
                          'modal__teammate-btn',
                          mapping[cardId] === p.id ? 'modal__teammate-btn--selected' : '',
                          p.id === myId ? 'modal__teammate-btn--me' : '',
                        ].join(' ').trim()}
                        onClick={() => handleAssign(cardId, p.id)}
                      >
                        {p.name}{p.id === myId ? ' (you)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <div className="modal__footer">
            <button
              type="button"
              className="modal__btn modal__btn--cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal__btn modal__btn--submit"
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

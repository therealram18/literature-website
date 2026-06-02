import { useState, useEffect } from 'react';
import { SETS, SET_DISPLAY_NAMES } from '../sets';

export default function ClaimModal({
  players = [],
  myId,
  myTeam,
  resolvedSets = [],
  onSubmit,
  onClose,
}) {
  const [setName, setSetName] = useState('');
  const [mapping, setMapping] = useState({}); // { cardId: playerId }

  // 1. Get teammates (and myself) and sort so 'You' is the first column
  const teammates = players.filter(p => p.team === myTeam);
  const sortedTeammates = [
    teammates.find(p => p.id === myId),
    ...teammates.filter(p => p.id !== myId)
  ].filter(Boolean);

  // 2. Determine which sets are still available to claim
  const availableSets = Object.keys(SETS).filter(s => !resolvedSets.includes(s));

  // Initialize the first available set
  useEffect(() => {
    if (!setName && availableSets.length > 0) {
      setSetName(availableSets[0]);
    }
  }, [availableSets, setName]);

  // Ensure unmapped cards disable the submit button
  const currentSetCards = setName ? SETS[setName] : [];
  const allAssigned = currentSetCards.length > 0 && currentSetCards.every(c => mapping[c]);

  function handleRadioChange(cardId, playerId) {
    setMapping(prev => ({ ...prev, [cardId]: playerId }));
  }

  function handleSubmit() {
    if (!allAssigned) return;
    onSubmit(setName, mapping);
  }

  // Visual helper: converts "10H" to "10♥"
  function formatCard(cardId) {
    return cardId.replace(/H|D|S|C/, match => {
      const suits = { H: '♥', D: '♦', S: '♠', C: '♣' };
      return suits[match];
    });
  }

  return (
    <div id="declare" className="screen active" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
      <div className="modal-wrap">
        <div className="modal-head" style={{ background: 'var(--purple)' }}>
          <h2>Claim</h2>
          <p>Assign each card to the right player — don't mess this up!</p>
        </div>
        
        <div className="modal-body">
          <div className="section-title" style={{ marginBottom: '8px' }}>Which set?</div>
          <select 
            className="dark-sel"
            value={setName} 
            onChange={(e) => {
              setSetName(e.target.value);
              setMapping({}); // reset mappings when set changes
            }}
          >
            {availableSets.map(s => (
              <option key={s} value={s}>
                {SET_DISPLAY_NAMES[s] || s}
              </option>
            ))}
          </select>

          {setName && currentSetCards.length > 0 && (
            <>
              <div className="section-title" style={{ marginBottom: '8px', marginTop: '16px' }}>
                Who has what?
              </div>
              <table className="dec-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Card</th>
                    {sortedTeammates.map(p => (
                      <th key={p.id} style={{ textAlign: 'center' }}>
                        {p.id === myId ? 'You' : p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentSetCards.map(cardId => (
                    <tr key={cardId}>
                      <td style={{ fontWeight: '600' }}>{formatCard(cardId)}</td>
                      {sortedTeammates.map(p => (
                        <td key={`${cardId}-${p.id}`} style={{ textAlign: 'center' }}>
                          <input 
                            type="radio" 
                            name={`claim-radio-${cardId}`} // Groups radios by card
                            checked={mapping[cardId] === p.id}
                            onChange={() => handleRadioChange(cardId, p.id)}
                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="modal-foot" style={{ marginTop: '20px' }}>
            <button className="big-btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button 
              className={`big-btn ${allAssigned ? 'btn-purple' : 'btn-outline'}`} 
              style={{ flex: 1, opacity: allAssigned ? 1 : 0.5 }} 
              onClick={handleSubmit}
              disabled={!allAssigned}
            >
              Claim!
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
import { SETS, SET_DISPLAY_NAMES } from '../sets';

export default function AskModal({ myHand = [], validAskCards = [], onSelectCard, onClose }) {
  // Determine which sets the player actually has at least one card in
  const myActiveSets = [...new Set(myHand.map(cardId => {
    return Object.keys(SETS).find(setName => SETS[setName].includes(cardId));
  }))].filter(Boolean);

  return (
    <div id="ask" className="screen" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
      <div className="modal-wrap">
        <div className="modal-head">
          <h2>Ask for a Card 🙏</h2>
          <p>Pick the card you need — grayed out = you already have it</p>
        </div>
        <div className="modal-body">
          <div className="scroll-box">
            {myActiveSets.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center' }}>You cannot ask for any cards right now!</p>
            ) : (
              myActiveSets.map(setName => (
                <div key={setName} className="set-section">
                  <div className="set-head">
                    <span className="set-badge" style={{ background: '#F5F5F5' }}>
                      {SET_DISPLAY_NAMES[setName] || setName}
                    </span>
                  </div>
                  <div className="card-grid">
                    {SETS[setName].map(cardId => {
                      const canAsk = validAskCards.includes(cardId);
                      const isRed = cardId.endsWith('H') || cardId.endsWith('D');
                      
                      // Convert '10H' to '10♥' for the button display
                      const displayLabel = cardId.replace(/H|D|S|C/, match => {
                        const suits = { H: '♥', D: '♦', S: '♠', C: '♣' };
                        return suits[match];
                      });

                      return (
                        <button
                          key={cardId}
                          className={['card-pick', isRed ? 'red-s' : '', !canAsk ? 'out' : ''].join(' ').trim()}
                          disabled={!canAsk}
                          onClick={() => onSelectCard(cardId)}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="modal-foot">
            <button className="big-btn btn-outline" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
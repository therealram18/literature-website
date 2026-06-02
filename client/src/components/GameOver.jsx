export default function GameOver({ gameState }) {
  const { winner, score } = gameState;
  
  // Did Team A or Team B win?
  const isTeamA = winner === 'A';

  function handlePlayAgain() {
    window.location.reload(); // Quickest way to reset everything
  }

  return (
    <div id="winner" className="screen active" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999 }}>
      <div className="winner-wrap">
        
        {/* Dynamic color for confetti bar based on winner */}
        <div 
          className="winner-confetti-bar" 
          style={{ background: isTeamA ? 'var(--blue)' : 'var(--pink)' }}
        />
        
        <div className="winner-card">
          <div className="winner-over">Game Over!</div>
          <div className="winner-team" style={{ color: isTeamA ? 'var(--blue)' : 'var(--pink)' }}>
            Team {winner}
          </div>
          <div className="winner-tagline">absolute domination 💅</div>
          
          <div className="score-duo">
            <div className={`score-box ${isTeamA ? 'win' : 'lose'}`}>
              <div className="sb-label" style={{ color: 'var(--blue)' }}>⚡ Team A</div>
              <div className="sb-num" style={{ color: 'var(--blue)' }}>{score?.A || 0}</div>
              <div className="sb-sub">sets won</div>
            </div>
            <div className={`score-box ${!isTeamA ? 'win' : 'lose'}`}>
              <div className="sb-label" style={{ color: 'var(--pink)' }}>🔥 Team B</div>
              <div className="sb-num" style={{ color: 'var(--pink)' }}>{score?.B || 0}</div>
              <div className="sb-sub">sets won</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="big-btn btn-orange" style={{ flex: 1 }} onClick={handlePlayAgain}>
              Play Again 🔄
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
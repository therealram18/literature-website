import { useState, useEffect } from 'react';
import socket from './socket';
import AvatarPicker from './components/AvatarPicker';
import Lobby        from './components/Lobby';
import GameBoard    from './components/GameBoard';
import GameOver from './components/GameOver';

export default function App() {
  const [phase, setPhase]         = useState('avatar');  // 'avatar'|'lobby'|'playing'|'finished'
  const [gameState, setGameState] = useState(null);
  const [error, setError]         = useState(null);
  const [playerInfo, setPlayerInfo] = useState(null);    // { name, avatar, roomId, isCreate }

  useEffect(() => {
    socket.on('game_started', (state) => {
      setGameState(state);
      setPhase('playing');
      setError(null);
    });

    socket.on('game_update', (state) => {
      setGameState(state);
    });

    socket.on('game_over', ({ winner, score }) => {
      setPhase('finished');
      setGameState(prev => ({ ...prev, winner, score }));
    });

    socket.on('action_error', (message) => {
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.off('game_started');
      socket.off('game_update');
      socket.off('game_over');
      socket.off('action_error');
    };
  }, []);

  function handleAvatarComplete(info) {
    // info: { name, avatar, roomId, isCreate }
    setPlayerInfo(info);
    setPhase('lobby');
  }

  return (
    <div className="app">
      {error && (
        <div className="error-toast" role="alert">{error}</div>
      )}

      {phase === 'avatar' && (
        <AvatarPicker onComplete={handleAvatarComplete} />
      )}

      {phase === 'lobby' && (
        <Lobby
          playerInfo={playerInfo}
        />
      )}

      {phase === 'playing' && (
        <GameBoard gameState={gameState} />
      )}

      {phase === 'finished' && (
        <div className="screen active">
          <div className="winner-wrap">
            <div className="winner-confetti-bar" />
            <div className="winner-card">
              <div className="winner-over">GAME OVER</div>
              <div className="winner-team">
                {gameState?.winner ? `Team ${gameState.winner} Wins!` : "It's a Draw!"}
              </div>
              <div className="winner-tagline">
                {gameState?.winner ? 'Absolute legends 🏆' : 'Too close to call 🤝'}
              </div>
              <div className="score-duo">
                <div className={`score-box ${gameState?.winner === 'A' ? 'win' : 'lose'}`}>
                  <div className="sb-label">⚡ Team A</div>
                  <div className="sb-num">{gameState?.score?.A ?? 0}</div>
                  <div className="sb-sub">sets won</div>
                </div>
                <div className={`score-box ${gameState?.winner === 'B' ? 'win' : 'lose'}`}>
                  <div className="sb-label">🔥 Team B</div>
                  <div className="sb-num">{gameState?.score?.B ?? 0}</div>
                  <div className="sb-sub">sets won</div>
                </div>
              </div>
              <button
                className="big-btn btn-orange"
                onClick={() => {
                  socket.disconnect();
                  setPhase('avatar');
                  setGameState(null);
                  setPlayerInfo(null);
                }}
              >
                Play Again 🔄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

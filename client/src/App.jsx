import { useState, useEffect } from 'react';
import socket from './socket';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

export default function App() {
  const [phase, setPhase]         = useState('lobby');   // 'lobby' | 'playing' | 'finished'
  const [gameState, setGameState] = useState(null);
  const [error, setError]         = useState(null);

  useEffect(() => {
    // Game has started — move every player out of the lobby
    socket.on('game_started', (state) => {
      setGameState(state);
      setPhase('playing');
      setError(null);
    });

    // State update during play (ask / claim results)
    socket.on('game_update', (state) => {
      setGameState(state);
    });

    // Game is over
    socket.on('game_over', ({ winner, score }) => {
      setPhase('finished');
      setGameState(prev => ({ ...prev, winner, score }));
    });

    // Server rejected an action
    socket.on('action_error', (message) => {
      setError(message);
      // Auto-clear after 4 seconds
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.off('game_started');
      socket.off('game_update');
      socket.off('game_over');
      socket.off('action_error');
    };
  }, []);

  return (
    <div className="app">
      {/* Global error toast — visible in any phase */}
      {error && (
        <div className="error-toast" role="alert">
          {error}
        </div>
      )}

      {phase === 'lobby' && (
        <Lobby onGameStart={() => setPhase('playing')} />
      )}

      {phase === 'playing' && (
        <GameBoard gameState={gameState} />
      )}

      {phase === 'finished' && (
        <div className="game-over">
          <h2>Game Over</h2>
          {gameState?.winner
            ? <p>Team {gameState.winner} wins!</p>
            : <p>It's a draw!</p>
          }
          <p>Score — A: {gameState?.score?.A ?? 0} | B: {gameState?.score?.B ?? 0}</p>
          <button onClick={() => {
            socket.disconnect();
            setPhase('lobby');
            setGameState(null);
          }}>
            Back to Lobby
          </button>
        </div>
      )}
    </div>
  );
}

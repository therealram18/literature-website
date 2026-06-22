import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import socket from './socket';
import AvatarPicker from './components/AvatarPicker';
import Lobby        from './components/Lobby';
import GameBoard    from './components/GameBoard';
import GameOver from './components/GameOver';

// ── /room/:roomId ─────────────────────────────────────────────────────────────
function RoomPage() {
  const { roomId }                  = useParams(); // read the :roomId from the URL
  const navigate                    = useNavigate();
  // const hasSession                  = !!localStorage.getItem('lit_session');
  const [phase, setPhase]           = useState('connecting');  // 'avatar'|'lobby'|'playing'|'finished'
  const [gameState, setGameState]   = useState(null);
  const [error, setError]           = useState(null);
  const [room, setRoom]             = useState(null);

  // Emit join_room once on mount — covers fresh join, reconnect, and mid-game refresh
  useEffect(() => {
    // Only attempt reconnect if we were mid-game
    // if (phase === 'lobby') return;

    // room update implies lobby
    socket.on('room_update', (snapshot) => {
      setRoom(snapshot);
      setPhase('lobby');
    });

    socket.on('game_started', (state) => {
      setGameState(state);
      setPhase('playing');
      setError(null);
    });

    socket.on('game_update', (state) => {
      setGameState(state);
    });

    socket.on('game_over', ({ winner, score }) => {
      localStorage.removeItem('lit_session');   // ← clear on game over
      setPhase('finished');
      setGameState(prev => ({ ...prev, winner, score }));
    });

    socket.on('game_expired', (message) => {
      localStorage.removeItem('lit_session');   
      setError(message);
      navigate('/');
    });

    socket.on('action_error', (message) => {
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    const raw = localStorage.getItem('lit_session');
    if (!raw) { setPhase('lobby'); return; }
    const { name, avatar, playerToken } = JSON.parse(raw);
    if (!name) { setPhase('lobby'); return; }
    
    const join = () => socket.emit('join_room', { roomId, name, avatar, playerToken });
    if (socket.connected) join(); 
    else {
      socket.connect();
      socket.once('connect', join);
    }
    
    return () => {
      socket.off('room_update');
      socket.off('game_started');
      socket.off('game_update');
      socket.off('game_over');
      socket.off('game_expired');
      socket.off('action_error');
    };
    
  }, [roomId]);

  function handleLeave() {
    localStorage.removeItem('lit_session');     // ← clear on intentional leave
    navigate('/');
  }

  if (phase === 'connecting') {
    return (
      <div className="screen active">
        <div className="lobby-wrap">
          <div className="lobby-header">
            <div style={{fontFamily:"'Baloo 2',sans-serif",fontSize:'24px',fontWeight:800,color:'#fff'}}>
              Connecting…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {error && (
        <div className="error-toast" role="alert">{error}</div>
      )}

      {phase === 'lobby' && (
        <Lobby
          roomId={roomId} initialRoom={room} onLeave={handleLeave}
        />
      )}

      {phase === 'playing' && (
        <GameBoard gameState={gameState} onLeave={handleLeave} />
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
                onClick={handleLeave}
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

// ── / (home) ──────────────────────────────────────────────────────────────────
function HomePage() {
  const navigate = useNavigate();

  function handleAvatarComplete({ name, avatar, roomId }) {
    const playerToken = crypto.randomUUID(); // ← generate a unique token for this player
    localStorage.setItem('lit_session', JSON.stringify({ name, avatar, playerToken }));
    navigate(`/room/${roomId}`);
    // RoomPage mounts, reads roomId from URL, name/avatar from localStorage,
    // and the Lobby component handles the actual join_room emit
  }

  return <AvatarPicker onComplete={handleAvatarComplete} />;
}

// ── Router root ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<HomePage />}/>
      <Route path="/room/:roomId"   element={<RoomPage />}/>
    </Routes>
  );
}

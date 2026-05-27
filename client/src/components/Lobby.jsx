import { useState, useEffect } from 'react';
import socket from '../socket';

/**
 * Lobby
 *
 * Phases:
 *   'join'   — player enters their name and a room ID
 *   'waiting' — player is in a room, picks a team, waits for host to start
 *
 * Props:
 *   onGameStart  — called when the server fires game_started (handled in App.jsx,
 *                  but Lobby can also react if needed)
 */
export default function Lobby({ onGameStart }) {
  // ── Join form state ────────────────────────────────────────────────────────
  const [name, setName]     = useState('');
  const [roomId, setRoomId] = useState('');

  // ── Room state (populated after joining) ──────────────────────────────────
  const [lobbyPhase, setLobbyPhase] = useState('join');  // 'join' | 'waiting'
  const [room, setRoom]             = useState(null);
  const [myId, setMyId]             = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Socket listeners
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Fired whenever the room changes (player joins, team assigned, etc.)
    socket.on('room_update', (snapshot) => {
      setRoom(snapshot);
    });

    // Someone disconnected mid-lobby
    socket.on('player_left', ({ playerName }) => {
      // room_update will follow immediately; this is just for a flash message if needed
      console.log(`${playerName} left the room.`);
    });

    return () => {
      socket.off('room_update');
      socket.off('player_left');
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;

    socket.connect();
    setMyId(socket.id);

    // socket.id isn't set synchronously — wait for connect event
    socket.once('connect', () => {
      setMyId(socket.id);
      socket.emit('join_room', { roomId: roomId.trim().toUpperCase(), name: name.trim() });
      setLobbyPhase('waiting');
    });
  }

  function handleTeam(team) {
    socket.emit('set_team', { team });
  }

  function handleStart() {
    socket.emit('start_game');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────────

  const me          = room?.players.find(p => p.id === socket.id);
  const isHost      = room?.hostId === socket.id;
  const teamA       = room?.players.filter(p => p.team === 'A') ?? [];
  const teamB       = room?.players.filter(p => p.team === 'B') ?? [];
  const unassigned  = room?.players.filter(p => !p.team) ?? [];
  const totalPlayers = room?.players.length ?? 0;

  const canStart =
    isHost &&
    totalPlayers >= 4 &&
    totalPlayers % 2 === 0 &&
    unassigned.length === 0 &&
    teamA.length === teamB.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Join screen
  // ─────────────────────────────────────────────────────────────────────────

  if (lobbyPhase === 'join') {
    return (
      <div className="lobby lobby--join">
        <h1 className="lobby__title">Literature</h1>

        <form className="lobby__form" onSubmit={handleJoin}>
          <div className="lobby__field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              autoFocus
              required
            />
          </div>

          <div className="lobby__field">
            <label htmlFor="roomId">Room code</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={6}
              required
            />
          </div>

          <button className="lobby__btn lobby__btn--primary" type="submit">
            Join Room
          </button>
        </form>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Waiting room
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="lobby lobby--waiting">
      <h1 className="lobby__title">Literature</h1>
      <p className="lobby__room-code">Room: <strong>{room?.roomId}</strong></p>

      {/* Team selection */}
      <div className="lobby__team-select">
        <p>Pick your team:</p>
        <div className="lobby__team-btns">
          <button
            className={`lobby__btn lobby__btn--team ${me?.team === 'A' ? 'lobby__btn--active' : ''}`}
            onClick={() => handleTeam('A')}
          >
            Team A
          </button>
          <button
            className={`lobby__btn lobby__btn--team ${me?.team === 'B' ? 'lobby__btn--active' : ''}`}
            onClick={() => handleTeam('B')}
          >
            Team B
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="lobby__players">
        <div className="lobby__team-col">
          <h3>Team A ({teamA.length})</h3>
          <ul>
            {teamA.map(p => (
              <li key={p.id} className={p.id === socket.id ? 'lobby__player--me' : ''}>
                {p.name} {p.id === room?.hostId && <span className="lobby__host-badge">host</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="lobby__team-col">
          <h3>Team B ({teamB.length})</h3>
          <ul>
            {teamB.map(p => (
              <li key={p.id} className={p.id === socket.id ? 'lobby__player--me' : ''}>
                {p.name} {p.id === room?.hostId && <span className="lobby__host-badge">host</span>}
              </li>
            ))}
          </ul>
        </div>

        {unassigned.length > 0 && (
          <div className="lobby__team-col lobby__team-col--unassigned">
            <h3>No team yet ({unassigned.length})</h3>
            <ul>
              {unassigned.map(p => (
                <li key={p.id} className={p.id === socket.id ? 'lobby__player--me' : ''}>
                  {p.name} {p.id === room?.hostId && <span className="lobby__host-badge">host</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Start / waiting */}
      <div className="lobby__footer">
        {isHost ? (
          <>
            <button
              className="lobby__btn lobby__btn--primary"
              onClick={handleStart}
              disabled={!canStart}
            >
              Start Game
            </button>
            {!canStart && (
              <p className="lobby__hint">
                {unassigned.length > 0
                  ? 'All players must pick a team.'
                  : totalPlayers < 4
                  ? 'Need at least 4 players.'
                  : totalPlayers % 2 !== 0
                  ? 'Need an even number of players.'
                  : teamA.length !== teamB.length
                  ? 'Teams must be equal size.'
                  : ''}
              </p>
            )}
          </>
        ) : (
          <p className="lobby__waiting">Waiting for the host to start the game…</p>
        )}
      </div>
    </div>
  );
}

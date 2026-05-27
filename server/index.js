/**
 * index.js  —  Literature online server
 *
 * Stack: Express + Socket.io
 * Start:  node index.js   (or: nodemon index.js during development)
 *
 * ─── Room lifecycle ──────────────────────────────────────────────────────────
 *
 *  1. Player connects and emits  join_room  → assigned to a room lobby
 *  2. Players pick teams via     set_team
 *  3. Any player can emit        start_game  (once ≥4 players, even split)
 *  4. During play:
 *       ask_card   → active player asks opponent for a card
 *       claim_set  → ANY player may claim a set at any time
 *  5. When all 9 sets are resolved the server emits  game_over
 *
 * ─── Event reference ─────────────────────────────────────────────────────────
 *
 *  CLIENT → SERVER              SERVER → CLIENT (room broadcast unless noted)
 *  ─────────────────────────    ────────────────────────────────────────────
 *  join_room(roomId, name)  →   room_update(roomSnapshot)
 *  set_team(team)           →   room_update(roomSnapshot)
 *  start_game()             →   game_started(publicState)   [+ hand_update private]
 *  ask_card(targetId,card)  →   game_update(publicState)    [+ hand_update private]
 *  claim_set(setName,map)   →   game_update(publicState)    [+ hand_update private]
 *  disconnect               →   room_update  or  player_left
 *
 *  error replies go back to the sender only via  action_error(message)
 */

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const { createGame, askCard, claimSet, getPublicState } = require('./game/gameState');

// ─────────────────────────────────────────────────────────────────────────────
// Server setup
// ─────────────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin:  process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT ?? 3001;

// Serve static React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory room store
//
// rooms[roomId] = {
//   id:          string,
//   players:     { [socketId]: { id, name, team: 'A'|'B'|null } },
//   gameState:   GameState | null,   // null while in lobby
//   phase:       'lobby' | 'playing' | 'finished',
//   hostId:      string,             // first player to join; may start the game
// }
// ─────────────────────────────────────────────────────────────────────────────

const rooms = {};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot safe to broadcast to everyone in the lobby */
function roomSnapshot(room) {
  return {
    roomId:  room.id,
    phase:   room.phase,
    hostId:  room.hostId,
    players: Object.values(room.players).map(p => ({
      id:   p.id,
      name: p.name,
      team: p.team,
    })),
  };
}

/** Emit a per-player hand_update to everyone in a room after a state change */
function broadcastHands(room) {
  if (!room.gameState) return;
  for (const pid of Object.keys(room.gameState.hands)) {
    const sock = io.sockets.sockets.get(pid);
    if (sock) {
      sock.emit('hand_update', {
        hand:       room.gameState.hands[pid],
        handCounts: _handCounts(room.gameState),
      });
    }
  }
}

/** Broadcast the public game state to every player in a room */
function broadcastGameState(room) {
  if (!room.gameState) return;
  for (const pid of Object.keys(room.players)) {
    const sock = io.sockets.sockets.get(pid);
    if (sock) {
      sock.emit('game_update', getPublicState(room.gameState, pid));
    }
  }
}

function _handCounts(state) {
  return Object.fromEntries(
    Object.entries(state.hands).map(([pid, h]) => [pid, h.length])
  );
}

/** Validate that a room is ready to start */
function canStart(room) {
  const players = Object.values(room.players);
  const n = players.length;
  if (n < 4)       return { ok: false, reason: `Need at least 4 players (have ${n}).` };
  if (n % 2 !== 0) return { ok: false, reason: `Need an even number of players (have ${n}).` };

  const teamA = players.filter(p => p.team === 'A').length;
  const teamB = players.filter(p => p.team === 'B').length;
  if (teamA !== teamB) {
    return { ok: false, reason: `Teams must be equal. Currently A:${teamA} B:${teamB}.` };
  }
  return { ok: true };
}

/** Find or create a room by ID */
function getOrCreateRoom(roomId, hostId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      id:        roomId,
      players:   {},
      gameState: null,
      phase:     'lobby',
      hostId,
    };
  }
  return rooms[roomId];
}

/** Clean up empty rooms */
function pruneRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (Object.keys(room.players).length === 0) {
    delete rooms[roomId];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io event handlers
// ─────────────────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log(`[connect] ${socket.id}`);

  // ── join_room ──────────────────────────────────────────────────────────────
  // payload: { roomId: string, name: string }
  socket.on('join_room', ({ roomId, name } = {}) => {
    if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
      return socket.emit('action_error', 'Invalid room ID.');
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return socket.emit('action_error', 'Name is required.');
    }

    const room = getOrCreateRoom(roomId.trim(), socket.id);

    if (room.phase !== 'lobby') {
      return socket.emit('action_error', 'Game already in progress — cannot join.');
    }

    // Leave any previous room (handles reconnects / room switching)
    const prevRooms = [...socket.rooms].filter(r => r !== socket.id);
    prevRooms.forEach(r => {
      socket.leave(r);
      const prev = rooms[r];
      if (prev) {
        delete prev.players[socket.id];
        io.to(r).emit('room_update', roomSnapshot(prev));
        pruneRoom(r);
      }
    });

    // Assign to new room
    socket.join(roomId);
    room.players[socket.id] = {
      id:   socket.id,
      name: name.trim(),
      team: null,
    };

    console.log(`[join_room] ${name} → ${roomId}`);
    io.to(roomId).emit('room_update', roomSnapshot(room));
  });

  // ── set_team ───────────────────────────────────────────────────────────────
  // payload: { team: 'A'|'B' }
  socket.on('set_team', ({ team } = {}) => {
    const room = _roomOf(socket);
    if (!room)                  return socket.emit('action_error', 'You are not in a room.');
    if (room.phase !== 'lobby') return socket.emit('action_error', 'Game already started.');
    if (team !== 'A' && team !== 'B') return socket.emit('action_error', 'Team must be A or B.');

    room.players[socket.id].team = team;
    io.to(room.id).emit('room_update', roomSnapshot(room));
  });

  // ── start_game ─────────────────────────────────────────────────────────────
  socket.on('start_game', () => {
    const room = _roomOf(socket);
    if (socket.id !== room?.hostId) return socket.emit('action_error', 'Only the host can start the game.');
    if (!room)                  return socket.emit('action_error', 'You are not in a room.');
    if (room.phase !== 'lobby') return socket.emit('action_error', 'Game already started.');

    const check = canStart(room);
    if (!check.ok) return socket.emit('action_error', check.reason);

    const players = Object.values(room.players).map(p => ({
      id:   p.id,
      name: p.name,
      team: p.team,
    }));

    try {
      room.gameState = createGame(room.id, players);
      room.phase     = 'playing';
    } catch (err) {
      return socket.emit('action_error', err.message);
    }

    console.log(`[start_game] room ${room.id} — ${players.length} players`);

    // Send each player their private view of the initial state
    for (const pid of Object.keys(room.players)) {
      const sock = io.sockets.sockets.get(pid);
      if (sock) {
        sock.emit('game_started', getPublicState(room.gameState, pid));
      }
    }
    broadcastHands(room);
  });

  // ── ask_card ───────────────────────────────────────────────────────────────
  // payload: { targetId: string, cardId: string }
  socket.on('ask_card', ({ targetId, cardId } = {}) => {
    const room = _roomOf(socket);
    if (!room)                    return socket.emit('action_error', 'You are not in a room.');
    if (room.phase !== 'playing') return socket.emit('action_error', 'No game in progress.');

    const { ok, error, newState } = askCard(
      room.gameState, socket.id, targetId, cardId
    );

    if (!ok) return socket.emit('action_error', error);

    room.gameState = newState;
    if (newState.phase === 'finished') room.phase = 'finished';

    broadcastGameState(room);
    broadcastHands(room);

    if (newState.phase === 'finished') {
      io.to(room.id).emit('game_over', {
        winner: newState.winner,
        score:  newState.score,
      });
    }
  });

  // ── claim_set ──────────────────────────────────────────────────────────────
  // payload: { setName: string, mapping: { [cardId]: playerId } }
  //
  // Anyone may claim at any time.
  // The turn only changes if the active player runs out of cards as a result.
  socket.on('claim_set', ({ setName, mapping } = {}) => {
    const room = _roomOf(socket);
    if (!room)                    return socket.emit('action_error', 'You are not in a room.');
    if (room.phase !== 'playing') return socket.emit('action_error', 'No game in progress.');

    const { ok, error, newState } = claimSet(
      room.gameState, socket.id, setName, mapping
    );

    if (!ok) return socket.emit('action_error', error);

    room.gameState = newState;
    if (newState.phase === 'finished') room.phase = 'finished';

    broadcastGameState(room);
    broadcastHands(room);

    if (newState.phase === 'finished') {
      io.to(room.id).emit('game_over', {
        winner: newState.winner,
        score:  newState.score,
      });
    }
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', reason => {
    console.log(`[disconnect] ${socket.id} (${reason})`);
    const room = _roomOf(socket);
    if (!room) return;

    const player = room.players[socket.id];
    delete room.players[socket.id];

    if (room.phase === 'lobby') {
      if (Object.keys(room.players).length === 0) {
        pruneRoom(room.id);
      } else {
        if (room.hostId === socket.id) {
          room.hostId = Object.keys(room.players)[0];
        }
        io.to(room.id).emit('room_update', roomSnapshot(room));
      }
    } else {
      // Mid-game: keep state alive so the player can reconnect.
      // Their hand remains in gameState.hands; they rejoin via join_room.
      io.to(room.id).emit('player_left', {
        playerId:   socket.id,
        playerName: player?.name ?? 'Unknown',
        message:    `${player?.name ?? 'A player'} disconnected. Waiting for reconnect…`,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility: find the room a socket is currently in
// ─────────────────────────────────────────────────────────────────────────────

function _roomOf(socket) {
  for (const roomId of socket.rooms) {
    if (roomId !== socket.id && rooms[roomId]) {
      return rooms[roomId];
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Literature server running on port ${PORT}`);
  console.log(`Client origin: ${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}`);
});

module.exports = { app, server, io }; // exported for integration tests
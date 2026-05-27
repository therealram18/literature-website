/**
 * rooms.js
 * In-memory store for all active game rooms.
 *
 * A "room" wraps a gameState with lobby metadata so index.js
 * can manage players before the game starts.
 *
 * Shape of a room object:
 * {
 *   id:        string,              // e.g. "ABC123"
 *   hostId:    string,              // socket.id of the player who created it
 *   status:    'lobby' | 'playing' | 'finished',
 *   players:   Map<socketId, { id, name, team: 'A'|'B'|null }>,
 *   gameState: GameState | null,    // null until startGame() is called
 * }
 */

const { createGame, askCard, claimSet, getPublicState } = require('./game/gameState');

// ─── Storage ─────────────────────────────────────────────────────────────────

/** @type {Map<string, Room>} */
const rooms = new Map();

// ─── Room lifecycle ───────────────────────────────────────────────────────────

/**
 * Create a new room with a random 6-character ID.
 * The creating player is automatically added.
 */
function createRoom(socketId, playerName) {
  const id = _generateRoomId();
  const room = {
    id,
    hostId: socketId,
    status: 'lobby',
    players: new Map([
      [socketId, { id: socketId, name: playerName, team: null }],
    ]),
    gameState: null,
  };
  rooms.set(id, room);
  return room;
}

/**
 * Add a player to an existing room.
 * Returns { ok, error, room }.
 */
function joinRoom(roomId, socketId, playerName) {
  const room = rooms.get(roomId);

  if (!room)                       return _err('Room not found.');
  if (room.status !== 'lobby')     return _err('Game already started.');
  if (room.players.has(socketId))  return _err('You are already in this room.');

  room.players.set(socketId, { id: socketId, name: playerName, team: null });
  return { ok: true, room };
}

/**
 * Assign a player to a team.
 * Returns { ok, error, room }.
 */
function assignTeam(roomId, socketId, team) {
  const room = rooms.get(roomId);

  if (!room)                       return _err('Room not found.');
  if (room.status !== 'lobby')     return _err('Cannot change teams once game has started.');
  if (!['A', 'B'].includes(team))  return _err('Team must be "A" or "B".');

  const player = room.players.get(socketId);
  if (!player) return _err('You are not in this room.');

  player.team = team;
  return { ok: true, room };
}

/**
 * Start the game. Only the host can call this.
 * Validates >=4 players and balanced teams before calling createGame().
 * Returns { ok, error, room }.
 */
function startGame(roomId, socketId) {
  const room = rooms.get(roomId);

  if (!room)                     return _err('Room not found.');
  if (room.status !== 'lobby')   return _err('Game already started.');
  if (room.hostId !== socketId)  return _err('Only the host can start the game.');

  const players = [...room.players.values()];

  if (players.length < 4 || players.length % 2 !== 0) {
    return _err(`Need at least 4 and an even number of players. Currently: ${players.length}.`);
  }

  const teamA = players.filter(p => p.team === 'A');
  const teamB = players.filter(p => p.team === 'B');

  if (teamA.length !== teamB.length) {
    return _err(
      `Teams must be even. Currently: Team A has ${teamA.length}, Team B has ${teamB.length}.`
    );
  }

  try {
    room.gameState = createGame(roomId, players);
    room.status    = 'playing';
  } catch (e) {
    return _err(`Failed to start game: ${e.message}`);
  }

  return { ok: true, room };
}

// ─── Game action wrappers ─────────────────────────────────────────────────────
// These delegate to gameState.js and persist the new state back to the room.

/**
 * Process an ask-card action.
 * Returns { ok, error, event, room } — always safe to call broadcast from.
 */
function handleAsk(roomId, askerId, targetId, cardId) {
  const room = rooms.get(roomId);
  if (!room)                   return _err('Room not found.');
  if (room.status !== 'playing') return _err('Game is not in progress.');

  const { ok, error, newState, event } = askCard(
    room.gameState, askerId, targetId, cardId
  );

  if (!ok) return _err(error);

  room.gameState = newState;
  if (newState.phase === 'finished') room.status = 'finished';

  return { ok: true, event, room };
}

/**
 * Process a claim-set action.
 * Returns { ok, error, outcome, event, room }.
 */
function handleClaim(roomId, claimerId, setName, mapping) {
  const room = rooms.get(roomId);
  if (!room)                   return _err('Room not found.');
  if (room.status !== 'playing') return _err('Game is not in progress.');

  const { ok, error, outcome, newState, event } = claimSet(
    room.gameState, claimerId, setName, mapping
  );

  if (!ok) return _err(error);

  room.gameState = newState;
  if (newState.phase === 'finished') room.status = 'finished';

  return { ok: true, outcome, event, room };
}

// ─── State accessors ──────────────────────────────────────────────────────────

/** Returns the room or null. */
function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

/**
 * Find which room a socket is currently in.
 * Returns the room or null.
 */
function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

/**
 * Returns a safe snapshot of the game state for one player.
 * Returns null if there's no active game state yet.
 */
function getStateForPlayer(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room?.gameState) return null;
  return getPublicState(room.gameState, playerId);
}

/**
 * Returns a lobby summary safe to broadcast to all players.
 * Deliberately excludes gameState (hands etc.).
 */
function getLobbySnapshot(room) {
  return {
    roomId:   room.id,
    hostId:   room.hostId,
    status:   room.status,
    players:  [...room.players.values()].map(p => ({
      id:    p.id,
      name:  p.name,
      team:  p.team,
    })),
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Remove a player from their room when they disconnect.
 * If the room becomes empty, delete it.
 * If the host leaves, promote the next player.
 *
 * Returns { room: Room|null, playerWasInGame: boolean }
 */
function removePlayer(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return { room: null, playerWasInGame: false };

  const playerWasInGame = room.status === 'playing';
  room.players.delete(socketId);

  if (room.players.size === 0) {
    rooms.delete(room.id);
    return { room: null, playerWasInGame };
  }

  // Promote a new host if the host left
  if (room.hostId === socketId) {
    room.hostId = room.players.keys().next().value;
  }

  return { room, playerWasInGame };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let id;
  do {
    id = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms.has(id));
  return id;
}

function _err(error) {
  return { ok: false, error };
}

module.exports = {
  createRoom,
  joinRoom,
  assignTeam,
  startGame,
  handleAsk,
  handleClaim,
  getRoom,
  getRoomBySocket,
  getStateForPlayer,
  getLobbySnapshot,
  removePlayer,
};
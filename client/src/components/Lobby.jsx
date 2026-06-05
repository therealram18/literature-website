/**
 * Lobby.jsx
 * Matches the #lobby screen from the HTML design.
 *
 * Props:
 *   roomId (string): the room code to join
 *   onLeave (function): callback to trigger when user intentionally leaves the lobby
 */

import { useState, useEffect } from 'react';
import socket from '../socket';

export default function Lobby({ roomId, initialRoom, onLeave }) {
  const [room, setRoom]   = useState(initialRoom);
  const [copied, setCopied] = useState(false);

  // Auto-connect as soon as Lobby mounts
  useEffect(() => {
    // socket.connect();

    // socket.once('connect', () => {
    //   const { name, avatar } = JSON.parse(localStorage.getItem('lit_session') || '{}');
    //   if (!name) return;
    //   socket.emit('join_room', { roomId, name, avatar });
    // });

    socket.on('room_update', (snapshot) => {
      setRoom(snapshot);
    });

    socket.on('player_left', ({ playerName }) => {
      console.log(`${playerName} left.`);
    });

    return () => {
      socket.off('room_update');
      socket.off('player_left');
    };
  }, [roomId]);

  function handleTeam(team) {
    socket.emit('set_team', { team });
  }

  function handleStart() {
    socket.emit('start_game');
  }

  function handleCopy() {
    if (!room?.roomId) return;
    navigator.clipboard.writeText(room.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShuffle() {
    socket.emit('shuffle_teams');
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const me         = room?.players.find(p => p.id === socket.id);
  const isHost     = room?.hostId === socket.id;
  const teamA      = room?.players.filter(p => p.team === 'A') ?? [];
  const teamB      = room?.players.filter(p => p.team === 'B') ?? [];
  const unassigned = room?.players.filter(p => !p.team) ?? [];
  const total      = room?.players.length ?? 0;

  const canStart =
    isHost &&
    total >= 4 &&
    total % 2 === 0 &&
    unassigned.length === 0 &&
    teamA.length === teamB.length;

  // ── Loading state (before first room_update) ──────────────────────────────
  if (!room) {
    return (
      <div className="screen active">
        <div className="lobby-wrap">
          <div className="lobby-header">
            <div>
              <div style={{fontFamily:"'Baloo 2',sans-serif",fontSize:'24px',fontWeight:800,color:'#fff',marginBottom:'4px'}}>
                Connecting…
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting room ──────────────────────────────────────────────────────────
  // Max 6 slots shown (expandable later)
  const MAX_SLOTS = 6;
  const slots = [
    ...room.players,
    ...Array(Math.max(0, MAX_SLOTS - room.players.length)).fill(null),
  ];

  return (
    <div className="screen active">
      <div className="lobby-wrap">

        {/* Header */}
        <div className="lobby-header">
          <div>
            <div style={{fontFamily:"'Baloo 2',sans-serif",fontSize:'24px',fontWeight:800,color:'#fff',marginBottom:'4px'}}>
              Game Lobby 🎮
            </div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.75)'}}>
              Waiting for everyone to show up...
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div className="room-code">{room.roomId}</div>
            <button
              className="big-btn btn-outline"
              style={{width:'auto',padding:'8px 16px',fontSize:'13px'}}
              onClick={handleCopy}
            >
              {copied ? 'Copied! ✓' : 'Copy 📋'}
            </button>
          </div>
        </div>

        {/* Players + Teams */}
        <div className="two-col">

          {/* Players joined */}
          <div className="card">
            <div className="section-title">
              <span style={{background:'var(--green)',color:'#fff',width:'20px',height:'20px',borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'10px',border:'2px solid var(--dark)'}}>✓</span>
              Players Joined
            </div>
            {slots.map((p, i) => (
              <div key={i} className="player-pill">
                <span className={`player-pip${p ? '' : ' empty'}`} />
                {p ? (
                  <>
                    <span>{p.name}</span>
                    {p.id === room.hostId && (
                      <span className="sticker" style={{marginLeft:'auto',fontSize:'9px',padding:'2px 6px'}}>Host</span>
                    )}
                    {p.id === socket.id && (
                      <span className="sticker" style={{marginLeft: p.id === room.hostId ? '4px' : 'auto',fontSize:'9px',padding:'2px 6px',background:'var(--blue)',color:'#fff'}}>You</span>
                    )}
                  </>
                ) : (
                  <span style={{color:'#aaa'}}>Waiting...</span>
                )}
              </div>
            ))}
          </div>

          {/* Teams */}
          <div className="card">
            <div className="section-title">
              <span style={{background:'var(--pink)',color:'#fff',padding:'2px 8px',borderRadius:'6px',border:'2px solid var(--dark)'}}>Teams</span>
            </div>

            <div className="team-block">
              <div className="team-name-input" style={{borderColor:'var(--blue)',display:'flex',alignItems:'center',gap:'8px'}}>
                ⚡ Team A
                {me?.team !== 'A' && (
                  <button
                    onClick={() => handleTeam('A')}
                    style={{marginLeft:'auto',padding:'2px 10px',fontSize:'11px',fontWeight:700,background:'var(--blue)',color:'#fff',border:'2px solid var(--dark)',borderRadius:'8px',cursor:'pointer'}}
                  >
                    Join
                  </button>
                )}
              </div>
              {teamA.map(p => (
                <div key={p.id} className="player-pill" style={{borderColor:'var(--blue)',background:'#EFF6FF'}}>
                  <span className="player-pip" style={{background:'var(--blue)'}} />
                  {p.name}
                  {p.id === socket.id && <span style={{marginLeft:'auto',fontSize:'11px',color:'var(--blue)',fontWeight:700}}>you</span>}
                </div>
              ))}
            </div>

            <div className="team-block">
              <div className="team-name-input" style={{borderColor:'var(--pink)',display:'flex',alignItems:'center',gap:'8px'}}>
                🔥 Team B
                {me?.team !== 'B' && (
                  <button
                    onClick={() => handleTeam('B')}
                    style={{marginLeft:'auto',padding:'2px 10px',fontSize:'11px',fontWeight:700,background:'var(--pink)',color:'#fff',border:'2px solid var(--dark)',borderRadius:'8px',cursor:'pointer'}}
                  >
                    Join
                  </button>
                )}
              </div>
              {teamB.map(p => (
                <div key={p.id} className="player-pill" style={{borderColor:'var(--pink)',background:'#FFF0F7'}}>
                  <span className="player-pip" style={{background:'var(--pink)'}} />
                  {p.name}
                  {p.id === socket.id && <span style={{marginLeft:'auto',fontSize:'11px',color:'var(--pink)',fontWeight:700}}>you</span>}
                </div>
              ))}
            </div>

            {unassigned.length > 0 && (
              <div style={{fontSize:'12px',color:'#aaa',marginTop:'8px'}}>
                {unassigned.map(p => p.name).join(', ')} — no team yet
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:'10px'}}>
          {/* <button className="big-btn btn-outline" style={{flex:1}} onClick={handleShuffle}>
            Shuffle Teams 🔀
          </button> */}
          {isHost ? (
            <button
              className="big-btn btn-green"
              style={{flex:1}}
              onClick={handleStart}
              disabled={!canStart}
              title={
                !canStart
                  ? unassigned.length > 0 ? 'All players must pick a team'
                  : total < 4 ? 'Need at least 4 players'
                  : teamA.length !== teamB.length ? 'Teams must be equal'
                  : ''
                  : ''
              }
            >
              Start Game 🚀
            </button>
          ) : (
            <button className="big-btn btn-green" style={{flex:1,opacity:0.5}} disabled>
              Waiting for host…
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

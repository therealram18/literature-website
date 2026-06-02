/**
 * AvatarPicker.jsx
 * Matches the #charselect screen from the HTML design.
 *
 * Props:
 *   onComplete({ name, avatar }) — called when player locks in their character
 */

import { useState } from 'react';
import characters from '../characters';

export default function AvatarPicker({ onComplete }) {
  const [name, setName]           = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [joinMode, setJoinMode]   = useState(null);   // 'create' | 'join'
  const [selected, setSelected]   = useState(null);   // character object

  // ── Step 1: home screen — name + create/join ────────────────────────────
  if (!joinMode) {
    return (
      <div className="screen active">
        <div className="home-wrap">
          <div className="home-hero">
            <div className="home-title">LITERATURE</div>
          </div>
          <div className="card">
            <div className="section-title">
              <span style={{background:'var(--orange)',color:'#fff',padding:'2px 8px',borderRadius:'6px',border:'2px solid var(--dark)'}}>01</span>
              Who are you?
            </div>
            <div style={{marginBottom:'16px'}}>
              <input
                className="fun-input"
                type="text"
                placeholder="Enter your name (be creative)"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button
              className="big-btn btn-orange"
              style={{marginBottom:'12px'}}
              onClick={() => { if (name.trim()) setJoinMode('create'); }}
              disabled={!name.trim()}
            >
              Create a Room ✨
            </button>
            <div className="divider"><span>or join one</span></div>
            <div style={{marginBottom:'12px'}}>
              <input
                className="fun-input"
                type="text"
                placeholder="Room code e.g. MOPUS6"
                value={roomInput}
                onChange={e => setRoomInput(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
            <button
              className="big-btn btn-outline"
              onClick={() => { if (name.trim() && roomInput.trim()) setJoinMode('join'); }}
              disabled={!name.trim() || !roomInput.trim()}
            >
              Join Game →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: character select ─────────────────────────────────────────────
  function handleLockIn() {
    if (!selected) return;
    onComplete({
      name:     name.trim(),
      roomId:   joinMode === 'join' ? roomInput.trim() : null,
      isCreate: joinMode === 'create',
      avatar:   selected,
    });
  }

  return (
    <div className="screen active">
      <div className="char-wrap">
        <div className="char-header">
          <h2>Pick Your Character 🎭</h2>
          <p>Choose your alter ego for this game — choose wisely (or chaotically)</p>
        </div>

        <div className="char-slider-wrap">
          <div className="char-track-outer">
            <div className="char-track" id="charTrack">
              {characters.map(c => (
                <div
                  key={c.imageId}
                  className={`char-card${selected?.imageId === c.imageId ? ' selected' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <img src={c.image} alt={c.name} className="char-avatar" />
                  <div className="char-name">{c.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="selected-display">
            {selected ? `You picked: ${selected.name}` : 'Tap a character to pick them 👆'}
          </div>

          <button
            className="big-btn btn-green"
            style={{marginTop:'14px'}}
            onClick={handleLockIn}
            disabled={!selected}
          >
            Lock In &amp; Continue 🔒
          </button>
        </div>
      </div>
    </div>
  );
}

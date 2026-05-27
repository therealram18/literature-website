/**
 * GameLog.jsx
 * Shows only the single most recent game action.
 * Per spec: "The game log will only show the last question asked."
 */

export default function GameLog({ lastAction }) {
  if (!lastAction) return null;

  const typeClass = {
    ask_success:    'game-log--success',
    ask_fail:       'game-log--fail',
    claim_success:  'game-log--claim-success',
    claim_discard:  'game-log--claim-discard',
    claim_stolen:   'game-log--claim-stolen',
  }[lastAction.type] ?? '';

  return (
    <div className={`game-log ${typeClass}`} role="status" aria-live="polite">
      <span className="game-log__text">{lastAction.detail}</span>
    </div>
  );
}

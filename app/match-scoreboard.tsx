import type { Snapshot, ScoreDetail } from './simulator';

export function MatchScoreboard({ s, timed }: { s: Snapshot; timed: boolean }) {
  const seconds = Math.max(0, Math.ceil(s.time));
  return (
    <section className="match-board" aria-label="Match scoreboard">
      <div className="match-board-title">
        <b>DECODE</b>
        <span>
          {timed ? 'REGULATION MATCH' : 'FREE DRIVE'} ·{' '}
          {s.players === 2 ? '2 PLAYERS' : '1 PLAYER'}
        </span>
        <span>2025–26</span>
      </div>
      <div className="match-board-scores">
        <div className="alliance-score blue-alliance">
          <span>BLUE</span>
          <strong>{s.score}</strong>
        </div>
        <div
          className={
            'match-timer ' +
            (timed && seconds <= 20 && s.phase === 'TELEOP'
              ? 'closing-seconds'
              : '')
          }
        >
          <strong>
            {timed
              ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : '∞'}
          </strong>
          <span>
            {s.ended
              ? 'FINAL'
              : !s.running
                ? `${s.phase || 'AUTO'} · ${s.started ? 'PAUSED' : 'READY'}`
                : timed
                  ? s.phase
                  : 'PRACTICE'}
          </span>
        </div>
        <div className="alliance-score red-alliance">
          <strong>{s.redScore || 0}</strong>
          <span>RED</span>
        </div>
      </div>
      {timed && (
        <div className="match-phase-track" aria-label="Regulation match phases">
          {[
            ['AUTO', '0:30'],
            ['TRANSITION', '0:08'],
            ['TELEOP', '2:00'],
          ].map(([phase, duration]) => (
            <span
              key={phase}
              className={s.phase === phase ? 'current' : ''}
              aria-current={s.phase === phase ? 'step' : undefined}
            >
              {phase} <b>{duration}</b>
            </span>
          ))}
        </div>
      )}
      <div className="match-board-meta">
        <span>
          Magazine <b>{s.magazine.length}/3</b>
        </span>
        <span className="board-motif">
          Motif{' '}
          {(s.motif || 'GPP').split('').map((c, i) => (
            <i
              key={i}
              className={'ball ' + c}
              aria-label={c === 'G' ? 'Green' : 'Purple'}
            />
          ))}
        </span>
        <span>
          Ramp <b>{s.ramp.length}/9</b>
        </span>
      </div>
    </section>
  );
}

const rows: [keyof ScoreDetail, string][] = [
  ['autoArtifacts', 'AUTO · Artifacts'],
  ['autoPattern', 'AUTO · Pattern'],
  ['leave', 'AUTO · Leave'],
  ['teleopArtifacts', 'TELEOP · Artifacts'],
  ['teleopPattern', 'TELEOP · Pattern'],
  ['base', 'Return to base'],
];
export function MatchResults({
  s,
  onRestart,
}: {
  s: Snapshot;
  onRestart: () => void;
}) {
  const red = s.redScore || 0,
    winner =
      s.score === red ? 'TIE MATCH' : s.score > red ? 'BLUE WINS' : 'RED WINS';
  return (
    <section className="match-results" aria-label="Final match results">
      <header>
        <span>DECODE / FINAL RESULT</span>
        <b className="winner-banner">{winner}</b>
      </header>
      <div className="results-totals">
        <div className="blue-alliance">
          <span>Blue alliance</span>
          <strong>{s.score}</strong>
        </div>
        <div className="red-alliance">
          <span>Red alliance</span>
          <strong>{red}</strong>
        </div>
      </div>
      <table>
        <caption>Points by match phase</caption>
        <thead>
          <tr>
            <th scope="col">Blue</th>
            <th scope="col">Scoring category</th>
            <th scope="col">Red</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, label]) => (
            <tr key={key}>
              <td>{s.breakdown?.[0][key] ?? 0}</td>
              <th scope="row">{label}</th>
              <td>{s.breakdown?.[1][key] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>
        <p>Practice scoring · referee penalties are not simulated.</p>
        <button className="primary" onClick={onRestart}>
          Drive again
        </button>
      </footer>
    </section>
  );
}

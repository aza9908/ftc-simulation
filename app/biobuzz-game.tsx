'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Gamepad2,
  Crosshair,
  ChevronLeft,
  ChevronRight,
  Move,
  Flower2,
  Hexagon,
  CircleHelp,
  Maximize,
  PackageOpen,
} from 'lucide-react';
import type { Biobuzz, BioSnapshot } from './biobuzz';
import { BIO_MANUAL, ROBOT_NAMES } from './biobuzz-rules';
import './biobuzz.css';
const initial: BioSnapshot = {
  ready: false,
  running: false,
  ended: false,
  time: 120,
  timed: true,
  players: 1,
  ids: [0, 2],
  score: { red: 0, blue: 0 },
  tips: { red: 0, blue: 0 },
  load: { red: 5, blue: 5 },
  nectar: { red: 0, blue: 0 },
  flowers: Array.from({ length: 4 }, () => ({
    count: 4,
    owner: null,
    bottom: null,
  })),
  robots: [],
  message: 'Preparing BIOBUZZ field…',
  view: 'Field',
};
export default function BiobuzzGame() {
  const pressedAt = useRef<Record<string, number>>({});
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Biobuzz | null>(null);
  const [s, setS] = useState(initial),
    [player, setPlayer] = useState(0),
    [help, setHelp] = useState(false);
  useEffect(() => {
    let dead = false,
      owned: Biobuzz | undefined;
    import('./biobuzz')
      .then(async ({ Biobuzz }) => {
        if (!host.current || dead) return;
        const sim = await Biobuzz.create(host.current, (state) => {
          if (!dead) setS(state);
        });
        if (dead) sim.dispose();
        else {
          owned = sim;
          engine.current = sim;
        }
      })
      .catch((error) => {
        if (!dead)
          setS((v) => ({
            ...v,
            message: `Could not start 3D: ${error.message}. Try reloading in a WebGL2 browser.`,
          }));
      });
    return () => {
      dead = true;
      owned?.dispose();
      engine.current = null;
    };
  }, []);
  const r = s.robots[player];
  const act = (action: string) => {
    engine.current?.action(player, action);
    host.current?.focus({ preventScroll: true });
  };
  const configure = (v: Record<string, unknown>) => {
    engine.current?.configure(v);
    setPlayer(0);
  };
  const clock = s.timed
    ? `${Math.floor(Math.ceil(s.time) / 60)}:${String(Math.ceil(s.time) % 60).padStart(2, '0')}`
    : '∞';
  const hold = (action: string, label: string) => ({
    'aria-label': label,
    onClick: () => {
      if (
        action.startsWith('turret') &&
        performance.now() - (pressedAt.current[action] ?? performance.now()) <
          180
      )
        engine.current?.action(player, action);
      delete pressedAt.current[action];
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      pressedAt.current[action] = performance.now();
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.current?.hold(player, action, true);
    },
    onPointerUp: () => engine.current?.hold(player, action, false),
    onPointerCancel: () => engine.current?.hold(player, action, false),
    onLostPointerCapture: () => engine.current?.hold(player, action, false),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        engine.current?.hold(player, action, true);
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        engine.current?.hold(player, action, false);
        if (action.startsWith('turret')) engine.current?.action(player, action);
      }
    },
    onBlur: () => engine.current?.hold(player, action, false),
  });
  return (
    <main className="bio-app">
      <header className="bio-header">
        <div className="bio-brand">
          <span className="bio-mark">
            <Hexagon size={27} />
          </span>
          <div>
            <h1>
              BIOBUZZ<span> / FIELD LAB</span>
            </h1>
            <p>FIRST TECH CHALLENGE · 2026–27</p>
          </div>
        </div>
        <div className="bio-seasons">
          <span>2026–27 BIOBUZZ</span>
          <a href="/decode">2025–26 DECODE</a>
        </div>
        <button
          className="bio-icon"
          aria-label="Help and controls"
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          <CircleHelp size={21} />
        </button>
      </header>
      <div className="bio-toolbar">
        <label>
          Players{' '}
          <select
            value={s.players}
            disabled={!s.ready}
            onChange={(e) => configure({ players: Number(e.target.value) })}
          >
            <option value={1}>Single player</option>
            <option value={2}>Two players · local</option>
          </select>
        </label>
        <label>
          Session{' '}
          <select
            value={s.timed ? 'timed' : 'practice'}
            disabled={!s.ready}
            onChange={(e) => configure({ timed: e.target.value === 'timed' })}
          >
            <option value="timed">2:00 driver practice</option>
            <option value="practice">Free practice</option>
          </select>
        </label>
        {s.ids.slice(0, s.players).map((id, p) => (
          <label key={p}>
            P{p + 1}{' '}
            <select
              value={id}
              disabled={!s.ready}
              onChange={(e) =>
                configure({
                  [p === 0 ? 'robot1' : 'robot2']: Number(e.target.value),
                })
              }
            >
              {ROBOT_NAMES.map((name, i) => (
                <option
                  key={i}
                  value={i}
                  disabled={s.players === 2 && s.ids[1 - p] === i}
                >
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="bio-controller">
          <Gamepad2 size={18} />
          <span>
            {s.robots.some((r) => r.controller)
              ? 'Controller connected'
              : 'Keyboard / PS5 controller'}
          </span>
        </div>
      </div>
      <div className="bio-workspace">
        <section
          className="bio-field-column"
          aria-label="BIOBUZZ playing field"
        >
          <div className="bio-arena">
            <div
              ref={host}
              tabIndex={0}
              className="bio-canvas"
              aria-label="Interactive three dimensional robot field"
            />
            <div className="bio-viewbar">
              <span>
                <i />
                {s.ended
                  ? 'SESSION COMPLETE'
                  : s.running
                    ? 'MANUAL CONTROL'
                    : 'READY TO DRIVE'}
              </span>
              <div>
                {['Field', 'Follow', 'Top'].map((v) => (
                  <button
                    key={v}
                    className={s.view === v ? 'selected' : ''}
                    onClick={() => engine.current?.setView(v)}
                  >
                    {v}
                  </button>
                ))}
                <button
                  aria-label="Full screen field"
                  onClick={() => {
                    const el = host.current?.parentElement;
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else void el?.requestFullscreen();
                  }}
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
            {!s.ready && (
              <div className="bio-loading">
                <Hexagon size={34} />
                <p>{s.message}</p>
              </div>
            )}
            {s.ended && (
              <div className="bio-result">
                <span>DRIVER PRACTICE COMPLETE</span>
                <h2>
                  {s.score.blue === s.score.red
                    ? 'Tied game'
                    : `${s.score.blue > s.score.red ? 'Blue' : 'Red'} alliance wins`}
                </h2>
                <p>
                  Red {s.score.red} · Blue {s.score.blue}
                </p>
                <button onClick={() => engine.current?.reset()}>
                  Play again <RotateCcw size={16} />
                </button>
              </div>
            )}
            <div className="bio-field-hint">
              {s.view === 'Field'
                ? 'Drag to orbit · Scroll to zoom'
                : s.view === 'Follow'
                  ? `Following ${ROBOT_NAMES[s.ids[player]]}`
                  : 'W / ↑ = away from audience'}
            </div>
          </div>
          <div
            className="bio-scoreboard"
            aria-label={
              s.ended
                ? 'Final scores'
                : 'Projected scores if the field finished now'
            }
          >
            <div className="bio-score red">
              <span>
                RED ALLIANCE<small>{s.tips.red} hive tips</small>
              </span>
              <strong>{s.score.red}</strong>
            </div>
            <div
              className={'bio-clock' + (s.time <= 60 ? ' final-minute' : '')}
            >
              <small>{s.timed ? 'TELEOP PRACTICE' : 'FREE PRACTICE'}</small>
              <strong>{clock}</strong>
              <span>
                {s.ended
                  ? 'FINAL'
                  : !s.timed || s.time <= 60
                    ? 'FLOWERS OPEN'
                    : 'HIVE PHASE'}
              </span>
            </div>
            <div className="bio-score blue">
              <strong>{s.score.blue}</strong>
              <span>
                BLUE ALLIANCE<small>{s.tips.blue} hive tips</small>
              </span>
            </div>
          </div>
          <div className="bio-transport">
            <button
              className="bio-start"
              disabled={!s.ready}
              onClick={() => {
                engine.current?.toggle();
                host.current?.focus({ preventScroll: true });
              }}
            >
              {s.running ? <Pause size={19} /> : <Play size={19} />}{' '}
              {s.running ? 'Pause' : s.ended ? 'New session' : 'Start driving'}
            </button>
            <button
              className="bio-icon"
              aria-label="Reset field"
              disabled={!s.ready}
              onClick={() => engine.current?.reset()}
            >
              <RotateCcw size={19} />
            </button>
            <p role="status">{s.message}</p>
          </div>
          <div className="bio-score-note">
            {s.ended
              ? 'Final score'
              : 'Scores include the current cells, flowers, gardens, and parking.'}
          </div>
          <div className="bio-field-status">
            <div>
              <b>RED HIVE</b>
              <progress value={s.load.red} max={8} />
              <span>{s.load.red.toFixed(1)} / 8 load</span>
            </div>
            <div className="bio-flower-track">
              <b>FLOWERS</b>
              {s.flowers.map((f, i) => (
                <button
                  key={i}
                  title={`Flower ${i + 1}: ${f.count} pieces; ${f.owner ?? 'no'} owner`}
                  onClick={() => engine.current?.focusFlower(i)}
                  className={f.owner ?? ''}
                >
                  <Flower2 size={21} />
                  <span>{i + 1}</span>
                </button>
              ))}
            </div>
            <div>
              <b>BLUE HIVE</b>
              <progress value={s.load.blue} max={8} />
              <span>{s.load.blue.toFixed(1)} / 8 load</span>
            </div>
          </div>
        </section>
        <aside className="bio-console">
          <div className="bio-console-title">
            <h2>Driver station</h2>
            {s.players === 2 && (
              <div>
                {[0, 1].map((p) => (
                  <button
                    key={p}
                    className={player === p ? 'selected' : ''}
                    onClick={() => {
                      setPlayer(p);
                      engine.current?.selectPlayer(p);
                    }}
                  >
                    P{p + 1}
                  </button>
                ))}
              </div>
            )}
            <span className={s.ids[player] < 2 ? 'blue' : 'red'}>
              {ROBOT_NAMES[s.ids[player]]}
            </span>
          </div>
          <div className="bio-inventory">
            <div>
              <span>MAGAZINE</span>
              <b>{r?.inventory.length ?? 4} / 4</b>
            </div>
            <div>
              {Array.from({ length: 4 }, (_, i) => (
                <i key={i} className={r?.inventory[i] ?? 'empty'} />
              ))}
            </div>
            <small>Yellow = pollen · Red / blue = nectar</small>
          </div>
          <div className="bio-actions">
            <button
              className={r?.intake ? 'active' : ''}
              disabled={!s.ready}
              onClick={() => act('intake')}
            >
              <PackageOpen size={20} />
              <span>
                Intake <small>{r?.intake ? 'ON' : 'OFF'}</small>
              </span>
              <kbd>{player === 0 ? 'R' : '/'}</kbd>
            </button>
            <button
              className="bio-shoot"
              disabled={!s.ready}
              onClick={() => act('shoot')}
            >
              <Crosshair size={20} />
              <span>Launch</span>
              <kbd>{player === 0 ? 'SPACE' : 'ENTER'}</kbd>
            </button>
            <button disabled={!s.ready} onClick={() => act('place')}>
              <Flower2 size={20} />
              <span>Place in flower</span>
              <kbd>{player === 0 ? 'F' : 'M'}</kbd>
            </button>
            <button disabled={!s.ready} onClick={() => act('nectar')}>
              <Hexagon size={20} />
              <span>
                Load nectar{' '}
                <small>
                  {s.nectar[s.ids[player] < 2 ? 'blue' : 'red']} ready
                </small>
              </span>
              <kbd>{player === 0 ? 'N' : 'B'}</kbd>
            </button>
          </div>
          <div className="bio-aim-heading">
            <h3>Turret & launch</h3>
            <button
              className={r?.assist ? 'active' : ''}
              onClick={() => act('assist')}
            >
              <Crosshair size={14} />
              {r?.assist ? 'Hive assist on' : 'Manual aim'}
            </button>
          </div>
          <div className="bio-turret">
            <button {...hold('turretLeft', 'Rotate turret left')}>
              <ChevronLeft size={25} />
            </button>
            <div>
              <strong>{Math.round(r?.turret ?? 0)}°</strong>
              <span>TURRET</span>
            </div>
            <button {...hold('turretRight', 'Rotate turret right')}>
              <ChevronRight size={25} />
            </button>
            <button onClick={() => act('center')}>Center</button>
          </div>
          <small className="bio-key-note">
            {player === 0
              ? 'Click = 10° · Hold / Z / X = turn · C = center'
              : 'O / P turn turret · H centers'}
          </small>
          {(['power', 'elevation'] as const).map((key) => (
            <label key={key} className="bio-slider">
              <span>
                {key === 'power' ? 'Launch speed' : 'Launch angle'}
                <b>
                  {key === 'power'
                    ? (r?.power ?? 6).toFixed(1) + ' m/s'
                    : Math.round(r?.elevation ?? 55) + '°'}
                </b>
              </span>
              <div>
                <button
                  aria-label={`Decrease ${key}`}
                  onClick={() => engine.current?.adjust(player, key, -1)}
                >
                  −
                </button>
                <input
                  type="range"
                  min={key === 'power' ? 3 : 15}
                  max={key === 'power' ? 11 : 80}
                  step={key === 'power' ? 0.1 : 1}
                  value={r?.[key] ?? (key === 'power' ? 6 : 55)}
                  onChange={(e) =>
                    engine.current?.setAim(player, key, Number(e.target.value))
                  }
                />
                <button
                  aria-label={`Increase ${key}`}
                  onClick={() => engine.current?.adjust(player, key, 1)}
                >
                  +
                </button>
              </div>
            </label>
          ))}
          <p className="bio-shot-state">{r?.status ?? 'Loading robot…'}</p>
          <details className="bio-drive">
            <summary>
              <Move size={17} />
              Drive controls <span>{(r?.speed ?? 0).toFixed(1)} m/s</span>
            </summary>
            <div className="bio-drive-pad">
              {[
                ['turnLeft', '↶'],
                ['forward', '↑'],
                ['turnRight', '↷'],
                ['left', '←'],
                ['back', '↓'],
                ['right', '→'],
              ].map(([a, l]) => (
                <button key={a} {...hold(a, a)}>
                  {l}
                </button>
              ))}
            </div>
            <p>
              {player === 0
                ? 'WASD move · Q / E rotate · Shift precision'
                : 'Arrow keys move · , / . rotate · Right Shift precision'}
            </p>
          </details>
        </aside>
      </div>
      <footer className="bio-footer">
        <span>Unofficial driver practice · Physics at 120 Hz</span>
        <a href={BIO_MANUAL} target="_blank" rel="noreferrer">
          Official BIOBUZZ manual ↗
        </a>
        <button onClick={() => setHelp(!help)}>How to play</button>
      </footer>
      {help && (
        <div className="bio-help-backdrop" onClick={() => setHelp(false)}>
          <section
            className="bio-help"
            role="dialog"
            aria-modal="true"
            aria-label="How to play BIOBUZZ"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="bio-help-close"
              onClick={() => setHelp(false)}
              aria-label="Close help"
            >
              ×
            </button>
            <span>2026–27 / BIOBUZZ</span>
            <h2>Collect. Tip. Claim.</h2>
            <ol>
              <li>
                <b>Collect pollen.</b> Start with four yellow balls. Switch on
                intake and drive your front roller over loose balls, or into a
                flower’s bottom opening.
              </li>
              <li>
                <b>Tip your hive.</b> Launch into the raised cell of your
                alliance. A complete tip earns 20 points and unlocks one nectar
                at your loading zone. Watch the hive switch ends.
              </li>
              <li>
                <b>Claim flowers.</b> In the last 60 seconds, fill flowers from
                the top using F / M when your front lift is close. Bottom nectar
                earns 5 points; top nectar owns the flower and earns 2 per
                piece.
              </li>
              <li>
                <b>Finish well.</b> Leave pieces in your garden (1 each), in
                your raised cell (2 each), and park in your loading zone (5).
              </li>
            </ol>
            <p>
              <b>PS5:</b> left stick drive · right stick rotate · Square intake
              · R2 launch · Cross place · Triangle load nectar · L1 precision ·
              R1 + right stick turret · D-pad power / angle.
            </p>
            <p>
              Hive load is shown in pollen-equivalent units. Three nectar count
              as five pollen for the tipping calibration. Scores include current
              end-of-match positions and remain provisional until the field
              settles.
            </p>
            <p>
              One or two local drivers. Inactive robots stay parked. This is
              manual TELEOP practice: official matches also include 30 seconds
              of AUTO and an 8-second transition. Hive calibration follows the
              kickoff guide; motor, ball mass, drag, and contact parameters are
              training estimates. No automatic referee or network multiplayer.
            </p>
            <a href={BIO_MANUAL} target="_blank" rel="noreferrer">
              Read the official rules ↗
            </a>
          </section>
        </div>
      )}
    </main>
  );
}

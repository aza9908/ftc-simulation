'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  RotateCcw,
  Pause,
  Play,
  Crosshair,
  Maximize,
  Keyboard,
  ChevronRight,
  Volume2,
  VolumeX,
  ArrowUpRight,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { Simulator, Snapshot } from './simulator';
import { MatchScoreboard, MatchResults } from './match-scoreboard';
const initial: Snapshot = {
  ready: false,
  score: 0,
  classified: 0,
  overflow: 0,
  pattern: 0,
  magazine: ['P', 'G', 'P'],
  ramp: [],
  speed: 0,
  time: 120,
  running: false,
  gate: 0,
  nearGate: false,
  controller: '',
  message: 'Preparing field…',
  shots: 0,
  hits: 0,
  ended: false,
  inZone: true,
};
export default function Home() {
  const mount = useRef<HTMLDivElement>(null),
    sim = useRef<Simulator | null>(null);
  const [s, setS] = useState(initial),
    [assist, setAssist] = useState(true),
    [power, setPower] = useState(6.3),
    [elevation, setElevation] = useState(55),
    [view, setView] = useState('Field'),
    [sound, setSound] = useState(true),
    [help, setHelp] = useState(false),
    [timed, setTimed] = useState(false);
  useEffect(() => {
    let dead = false;
    let owned: Simulator | null = null;
    const host = mount.current;
    import('./simulator')
      .then(async ({ Simulator }) => {
        if (dead || !host) return;
        const engine = await Simulator.create(host, (v) => {
          if (!dead) {
            setS(v);
            if (v.view) setView(v.view);
            if (v.power !== undefined) setPower(v.power);
            if (v.elevation !== undefined) setElevation(v.elevation);
            if (v.assist !== undefined) setAssist(v.assist);
          }
        });
        if (dead) engine.dispose();
        else {
          owned = engine;
          sim.current = engine;
        }
      })
      .catch((e) =>
        setS((v) => ({
          ...v,
          message: `Unable to start 3D: ${e.message}. Please reload in a WebGL2-capable browser.`,
        })),
      );
    return () => {
      dead = true;
      owned?.dispose();
      if (sim.current === owned) sim.current = null;
    };
  }, []);
  const start = () => sim.current?.toggle();
  return (
    <main className="sim-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            D<span>›</span>
          </span>
          <div>
            <h1>
              DECODE<span className="brand-divider"> / </span>
              <span className="subbrand">SIMULATOR</span>
            </h1>
            <p>FIRST TECH CHALLENGE · 2025–26</p>
          </div>
        </div>
        <div className="connection">
          <span
            className={s.controller ? 'status-dot' : 'status-dot neutral'}
          />
          <Gamepad2 size={17} />
          <span>{s.controller || 'Connect a controller'}</span>
        </div>
        <button
          className="icon-button"
          aria-label="Show controls and simulation details"
          onClick={() => setHelp(!help)}
        >
          <Keyboard size={20} />
        </button>
      </header>
      <div className="workspace">
        <div className="field-column">
          <section className="arena">
            <div
              ref={mount}
              className="canvas-mount"
              aria-label="Interactive 3D FTC DECODE field"
            />
            <div className="arena-top">
              <div className="session-label">
                <span className="status-dot" />{' '}
                {timed ? s.phase || 'AUTO' : 'FREE DRIVE'}{' '}
                <span className="small-separator">/</span> BLUE ALLIANCE
              </div>
              <div className="view-picker">
                {['Field', 'Follow', 'Top'].map((v) => (
                  <button
                    key={v}
                    className={view === v ? 'selected' : ''}
                    onClick={() => {
                      setView(v);
                      sim.current?.configure({ view: v });
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {!s.ready && (
              <div className="loading-message" role="status">
                {s.message}
              </div>
            )}
            {s.ready && s.ended && (
              <MatchResults
                s={s}
                onRestart={() => {
                  sim.current?.reset();
                  start();
                }}
              />
            )}
            {s.ready && !s.running && !s.ended && (
              <div className="start-overlay">
                <div className="eyebrow">
                  {s.ended ? 'SESSION COMPLETE' : 'YOUR DRIVER STATION'}
                </div>
                <h2>
                  {s.ended
                    ? `${s.score} points. One more run?`
                    : 'Take the controls.'}
                </h2>
                <p>
                  {s.ended
                    ? `${s.classified} classified · ${s.overflow} overflow · ${s.pattern} pattern points`
                    : 'Collect. Aim. Launch. Open the gate and go again.'}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    if (s.ended) sim.current?.reset();
                    start();
                  }}
                >
                  <Play size={17} fill="currentColor" />
                  {s.ended ? 'Drive again' : 'Start driving'}
                  <kbd>Enter</kbd>
                </button>
              </div>
            )}
            <div className="field-caption">
              <span>DECODE</span>
              <small>12 × 12 FT FIELD</small>
            </div>
            {s.running && (
              <div
                className={
                  'interaction-prompt ' + (s.nearGate ? 'available' : '')
                }
              >
                <kbd>F</kbd>
                <span>{s.gatePrompt || 'Blue gate is on the left'}</span>
              </div>
            )}
            <div className="arena-bottom">
              <div className="telemetry">
                <span className="status-dot" />
                <span>
                  {s.speed.toFixed(2)} <small>m/s</small>
                </span>
                <span className="telemetry-divider" />
                <span>{s.inZone ? 'LAUNCH ZONE' : 'COLLECTION ZONE'}</span>
              </div>
              <div className="camera-buttons">
                <button
                  className="icon-button"
                  aria-label={sound ? 'Mute sounds' : 'Enable sounds'}
                  onClick={() => {
                    setSound(!sound);
                    sim.current?.configure({ sound: !sound });
                  }}
                >
                  {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Full screen"
                  onClick={() => {
                    if (document.fullscreenElement) document.exitFullscreen();
                    else
                      document.documentElement
                        .requestFullscreen()
                        .catch(() => {});
                  }}
                >
                  <Maximize size={18} />
                </button>
              </div>
            </div>
            <div className="touch-controls">
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sim.current?.press('KeyW', true);
                }}
                onPointerUp={() => sim.current?.press('KeyW', false)}
                onPointerCancel={() => sim.current?.press('KeyW', false)}
              >
                ↑
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sim.current?.press('KeyA', true);
                }}
                onPointerUp={() => sim.current?.press('KeyA', false)}
                onPointerCancel={() => sim.current?.press('KeyA', false)}
              >
                ←
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sim.current?.press('KeyS', true);
                }}
                onPointerUp={() => sim.current?.press('KeyS', false)}
                onPointerCancel={() => sim.current?.press('KeyS', false)}
              >
                ↓
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sim.current?.press('KeyD', true);
                }}
                onPointerUp={() => sim.current?.press('KeyD', false)}
                onPointerCancel={() => sim.current?.press('KeyD', false)}
              >
                →
              </button>
              <button
                onClick={() => sim.current?.toggleIntake()}
                aria-pressed={!!s.intake}
              >
                Intake
              </button>
              <button onClick={() => sim.current?.shoot()}>Shoot</button>
            </div>
          </section>
          <MatchScoreboard s={s} timed={timed} />
        </div>
        <aside className="driver-panel">
          <div className="panel-heading">
            <span>DRIVER STATION</span>
            <span className="live-badge">● LIVE</span>
          </div>
          <div className="robot-title">
            <div className="robot-number">01</div>
            <div>
              <h2>Blue Mecanum</h2>
              <p>Holonomic drive · 3-artifact intake</p>
            </div>
          </div>
          <section className="panel-section">
            <div className="section-title">
              <h3>Magazine</h3>
              <span>{s.magazine.length} / 3</span>
            </div>
            <div className="magazine">
              {[0, 1, 2].map((i) => (
                <div
                  className={'magazine-slot ' + (s.magazine[i] || 'empty')}
                  key={i}
                >
                  {s.magazine[i] ? (
                    <i className={'large-ball ' + s.magazine[i]} />
                  ) : (
                    <span>+</span>
                  )}
                  <small>{i === 0 ? 'NEXT' : `0${i + 1}`}</small>
                </div>
              ))}
            </div>
            <button
              className={'intake-button ' + (s.intake ? 'active' : '')}
              aria-pressed={!!s.intake}
              disabled={!s.running || (timed && s.phase !== 'TELEOP')}
              onClick={() => sim.current?.toggleIntake()}
            >
              {s.intake ? 'Intake running' : 'Start intake'} <kbd>R / L1</kbd>
            </button>
            <p className="hint">Front intake only · 3 artifacts maximum.</p>
          </section>
          <div className="intake-secondary">
            <button
              disabled={
                !s.running ||
                !s.magazine.length ||
                (timed && s.phase !== 'TELEOP')
              }
              onClick={() => sim.current?.reverseIntake()}
            >
              Reverse <kbd>B / ○</kbd>
            </button>
            <button
              disabled={
                !s.running || !s.reserve || (timed && s.phase !== 'TELEOP')
              }
              onClick={() => sim.current?.loadArtifact()}
            >
              Feed tray ({s.reserve || 0}) <kbd>H</kbd>
            </button>
          </div>
          <section className="panel-section">
            <div className="section-title">
              <h3>Launcher</h3>
              <Crosshair size={17} />
            </div>
            <div className="setting-row">
              <label htmlFor="aim-assist">Aim assist</label>
              <Switch
                id="aim-assist"
                checked={assist}
                onCheckedChange={(v) => {
                  setAssist(v);
                  sim.current?.configure({ assist: v });
                }}
              />
            </div>
            <div className="power-label">
              <label id="power-label">Launch speed</label>
              <span>{assist ? 'AUTO' : `${power.toFixed(1)} m/s`}</span>
            </div>
            <Slider
              aria-labelledby="power-label"
              min={3}
              max={11}
              step={0.1}
              value={[power]}
              disabled={assist}
              onValueChange={(v) => {
                let n = Array.isArray(v) ? v[0] : v;
                setPower(n);
                sim.current?.configure({ power: n });
              }}
            />
            <div className="power-label">
              <label id="elevation-label">Shot elevation</label>
              <span>{assist ? 'AUTO' : `${elevation}°`}</span>
            </div>
            <Slider
              aria-labelledby="elevation-label"
              min={25}
              max={75}
              step={1}
              value={[elevation]}
              disabled={assist}
              onValueChange={(v) => {
                const angle = Array.isArray(v) ? v[0] : v;
                setElevation(angle);
                sim.current?.configure({ elevation: angle });
              }}
            />
            <div className="range-readout">
              <span>
                Goal <b>{(s.goalDistance || 0).toFixed(1)} m</b>
              </span>
              <span>
                Estimated reach{' '}
                <b>
                  {s.shotRange == null
                    ? 'Too low'
                    : `${s.shotRange.toFixed(1)} m`}
                </b>
              </span>
            </div>
            <p className="hint">
              {assist
                ? 'Aim assist compensates movement. Shoot from a taped launch zone.'
                : '− / + adjusts speed · [ / ] adjusts elevation. D-pad works too. Range estimate excludes collisions.'}
            </p>
            <button
              className="shoot-button"
              disabled={
                !s.running ||
                !s.magazine.length ||
                (timed && s.phase !== 'TELEOP')
              }
              onClick={() => sim.current?.shoot()}
            >
              {s.flywheel && s.flywheel < 94
                ? `Spinning up · ${s.flywheel}%`
                : 'Launch artifact'}{' '}
              <kbd>SPACE</kbd>
            </button>
          </section>
          <section className="panel-section">
            <div className="section-title">
              <h3>Classifier · {s.motif || 'GPP'}</h3>
              <span>{s.ramp.length} / 9</span>
            </div>
            <div className="ramp-slots">
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className={'ramp-slot ' + (s.ramp[i] || '')}
                  title={`Slot ${i + 1}: ${s.ramp[i] || 'empty'}, target ${(s.motif || 'GPP')[i % 3] === 'G' ? 'green' : 'purple'}`}
                >
                  {s.ramp[i] ? (
                    <i className={'ball ' + s.ramp[i]} />
                  ) : (
                    <i className={'ghost-ball ' + (s.motif || 'GPP')[i % 3]} />
                  )}
                </span>
              ))}
            </div>
            <div className="gate-row">
              <span
                className={s.gate > 0.3 ? 'gate-status open' : 'gate-status'}
              >
                ◈ Gate {s.gate > 0.3 ? 'open' : 'closed'}
              </span>
              <button
                disabled={!s.running || (timed && s.phase !== 'TELEOP')}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  sim.current?.press('KeyF', true);
                }}
                onPointerCancel={() => sim.current?.press('KeyF', false)}
                onKeyDown={(e) => {
                  if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    sim.current?.press('KeyF', true);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    sim.current?.press('KeyF', false);
                  }
                }}
                onBlur={() => sim.current?.press('KeyF', false)}
                onPointerUp={() => sim.current?.press('KeyF', false)}
                onPointerLeave={() => sim.current?.press('KeyF', false)}
              >
                Hold <kbd>F</kbd>
              </button>
            </div>
            <p className="hint">
              {s.nearGate
                ? 'In reach. Hold F / Square until the ramp is empty.'
                : 'Approach the glowing blue circle on the left, then hold F / Square.'}
            </p>
          </section>
          <section className="session-stats">
            <div>
              <span>Classified</span>
              <strong>{s.classified}</strong>
            </div>
            <div>
              <span>Overflow</span>
              <strong>{s.overflow}</strong>
            </div>
            <div>
              <span>Accuracy</span>
              <strong>
                {s.shots ? Math.round((s.hits / s.shots) * 100) : 0}
                <small>%</small>
              </strong>
            </div>
          </section>
          <div className="session-actions">
            <div className="setting-row">
              <label htmlFor="timed">Four-robot match practice</label>
              <Switch
                id="timed"
                checked={timed}
                onCheckedChange={(v) => {
                  setTimed(v);
                  sim.current?.configure({ timed: v });
                  sim.current?.reset();
                }}
              />
            </div>
            <p className="hint">
              30s preset AUTO → 8s transition → 120s TELEOP. Return to the blue
              base in the last 20s.
            </p>
            <div className="action-buttons">
              <button onClick={start} disabled={!s.ready || s.ended}>
                {s.running ? <Pause size={16} /> : <Play size={16} />}{' '}
                {s.running ? 'Pause' : 'Drive'}
              </button>
              <button onClick={() => sim.current?.reset()}>
                <RotateCcw size={16} />
                Reset field
              </button>
            </div>
          </div>
        </aside>
      </div>
      <footer className="control-strip">
        <div>
          <Keyboard size={19} />
          <b>CONTROLS</b>
        </div>
        <span>
          <kbd>W A S D</kbd> Move
        </span>
        <span>
          <kbd>Q E</kbd> Turn
        </span>
        <span>
          <kbd>R</kbd> Intake
        </span>
        <span>
          <kbd>SPACE</kbd> Shoot
        </span>
        <span>
          <kbd>F</kbd> Gate
        </span>
        <span>
          <kbd>SHIFT</kbd> Precision
        </span>
        <button onClick={() => setHelp(!help)}>
          Controller guide <ChevronRight size={15} />
        </button>
      </footer>
      <div className="status-strip">
        <span role="status">{s.ready ? s.message : 'Loading simulation'}</span>
        <span>Unofficial DECODE practice · simplified field model</span>
      </div>
      {help && (
        <div className="help-panel">
          <button
            className="close-help"
            onClick={() => setHelp(false)}
            aria-label="Close controls"
          >
            ×
          </button>
          <Gamepad2 size={26} />
          <h2>Made for your controller.</h2>
          <p>
            Connect your PS5 DualSense by USB or Bluetooth, then press any
            button. A standard browser gamepad mapping is required.
          </p>
          <div className="control-guide">
            <span>Left stick</span>
            <b>Move · forward in Follow view</b>
            <span>Right stick ↔</span>
            <b>Turn robot</b>
            <span>L1 / R</span>
            <b>Toggle intake</b>
            <span>Circle / B</span>
            <b>Reverse intake</b>
            <span>R2 / Cross</span>
            <b>Launch artifact</b>
            <span>Square (hold)</span>
            <b>Push nearby gate</b>
            <span>L2</span>
            <b>Precision driving</b>
            <span>Triangle</span>
            <b>Change camera</b>
            <span>D-pad ← / →</span>
            <b>Manual launch speed</b>
            <span>D-pad ↓ / ↑</span>
            <b>Manual elevation</b>
            <span>Options / Enter</span>
            <b>Pause / resume</b>
          </div>
          <h3>Simulation notes</h3>
          <p>
            WASD moves relative to the field in Field/Top view, and relative to
            the robot in Follow view. Q/E turns; Shift slows movement and
            turning. Rapier rigid-body physics at 120 Hz; gravity, momentum,
            friction, bouncing, and continuous collision detection. Robot
            traction and gate linkage are approximated. Classifier routing is
            scripted after goal entry. Match mode adds three practice bots,
            preset autonomous, randomized motifs, and post-match settling. Bot
            strategy, field geometry, and referee coverage remain
            approximations; this is not an official match adjudicator.
          </p>
          <a
            href="https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm"
            target="_blank"
            rel="noreferrer"
          >
            Read the official TU32 manual <ArrowUpRight size={16} />
          </a>
        </div>
      )}
    </main>
  );
}

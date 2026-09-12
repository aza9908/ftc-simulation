'use client';
type Shot = {
  power: number;
  elevation: number;
  automatic: boolean;
  status: string;
};
type Props = {
  player: 0 | 1;
  shot: Shot;
  ready: boolean;
  canShoot: boolean;
  adjust: (v: { power?: number; elevation?: number }) => void;
  fit: () => void;
  shoot: () => void;
};
export function ShootingControls({
  player,
  shot,
  ready,
  canShoot,
  adjust,
  fit,
  shoot,
}: Props) {
  return (
    <div className="shooting-controls">
      <div className="shot-heading">
        <b>Shooting</b>
        <span>{shot.automatic ? 'Range matched' : 'Your settings'}</span>
      </div>
      <div className="shot-adjustment">
        <label htmlFor={`shot-power-${player}`}>
          Power{' '}
          <strong>
            {shot.power.toFixed(1)} <small>m/s</small>
          </strong>
        </label>
        <div className="shot-slider-row">
          <button
            disabled={!ready}
            aria-label={`Player ${player + 1} decrease power`}
            onClick={() => adjust({ power: shot.power - 0.2 })}
          >
            −
          </button>
          <input
            id={`shot-power-${player}`}
            aria-label={`Player ${player + 1} shooting power`}
            type="range"
            min="3"
            max="11"
            step=".1"
            value={shot.power}
            disabled={!ready}
            onChange={(e) => adjust({ power: Number(e.target.value) })}
          />
          <button
            disabled={!ready}
            aria-label={`Player ${player + 1} increase power`}
            onClick={() => adjust({ power: shot.power + 0.2 })}
          >
            +
          </button>
        </div>
      </div>
      <div className="shot-adjustment">
        <label htmlFor={`shot-angle-${player}`}>
          Angle <strong>{shot.elevation.toFixed(0)}°</strong>
        </label>
        <div className="shot-slider-row">
          <button
            disabled={!ready}
            aria-label={`Player ${player + 1} lower shot angle`}
            onClick={() => adjust({ elevation: shot.elevation - 2 })}
          >
            −
          </button>
          <input
            id={`shot-angle-${player}`}
            aria-label={`Player ${player + 1} shooting angle`}
            type="range"
            min="25"
            max="75"
            step="1"
            value={shot.elevation}
            disabled={!ready}
            onChange={(e) => adjust({ elevation: Number(e.target.value) })}
          />
          <button
            disabled={!ready}
            aria-label={`Player ${player + 1} raise shot angle`}
            onClick={() => adjust({ elevation: shot.elevation + 2 })}
          >
            +
          </button>
        </div>
      </div>
      <div className="shot-actions">
        <button disabled={!ready} onClick={fit}>
          Match goal distance
        </button>
        <button className="shot-fire" disabled={!canShoot} onClick={shoot}>
          Shoot <kbd>{player === 0 ? 'Space' : '/'}</kbd>
        </button>
      </div>
      <output className="shot-feedback">{shot.status}</output>
    </div>
  );
}

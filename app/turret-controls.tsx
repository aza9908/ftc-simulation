'use client';
import type { KeyboardEvent, PointerEvent } from 'react';

type Props = {
  player: 0 | 1;
  angle: number;
  mode: string;
  disabled: boolean;
  press: (key: string, down: boolean) => void;
  center: () => void;
  track: () => void;
};
export function TurretControls({
  player,
  angle,
  mode,
  disabled,
  press,
  center,
  track,
}: Props) {
  const left = player === 0 ? 'KeyZ' : 'KeyK',
    right = player === 0 ? 'KeyX' : 'KeyL';
  const hold = (key: string) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press(key, true);
    },
    onPointerUp: () => press(key, false),
    onPointerCancel: () => press(key, false),
    onLostPointerCapture: () => press(key, false),
    onBlur: () => press(key, false),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        press(key, true);
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        press(key, false);
      }
    },
  });
  return (
    <div className="turret-controls">
      <div className="turret-heading">
        <b>Turn turret</b>
        <span>
          {Math.abs(angle) < 0.5
            ? 'Centered'
            : `${Math.abs(angle).toFixed(0)}° ${angle > 0 ? 'left' : 'right'}`}
        </span>
      </div>
      <div className="turret-bearing" aria-hidden="true">
        <i style={{ transform: `rotate(${-angle}deg)` }} />
      </div>
      <div className="turret-buttons">
        <button
          disabled={disabled}
          aria-label={`Player ${player + 1} turret left`}
          {...hold(left)}
        >
          ◀ Left <kbd>{player === 0 ? 'Z' : 'K'}</kbd>
        </button>
        <button disabled={disabled} onClick={center}>
          Center
        </button>
        <button
          disabled={disabled}
          aria-label={`Player ${player + 1} turret right`}
          {...hold(right)}
        >
          Right ▶ <kbd>{player === 0 ? 'X' : 'L'}</kbd>
        </button>
      </div>
      <div className="turret-mode">
        <span>{mode}</span>
        <button disabled={disabled} onClick={track}>
          Track goal
        </button>
      </div>
      <p className="hint">
        Hold left/right · R1 + right stick on PS5. R3 centers.
      </p>
    </div>
  );
}

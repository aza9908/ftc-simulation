export const deadzone = (v: number) =>
  Math.abs(v) < 0.13 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.13)) / 0.87;
export function driveImpulse(
  current: { x: number; z: number },
  target: { x: number; z: number },
  mass: number,
  dt: number,
) {
  const braking = Math.hypot(target.x, target.z) < 0.01;
  const response = 1 - Math.exp(-dt / (braking ? 0.085 : 0.14));
  let x = (target.x - current.x) * mass * response,
    z = (target.z - current.z) * mass * response,
    max = mass * (braking ? 5.8 : 4.7) * dt,
    len = Math.hypot(x, z);
  if (len > max) {
    x *= max / len;
    z *= max / len;
  }
  return { x, z };
}
export function launchVelocity(
  start: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
) {
  let distance = Math.hypot(target.x - start.x, target.z - start.z),
    t = Math.max(0.65, Math.min(1.05, distance / 3.2));
  return {
    x: (target.x - start.x) / t,
    y: (target.y - start.y + 4.905 * t * t) / t,
    z: (target.z - start.z) / t,
  };
}
export function inLaunchZone(x: number, z: number) {
  return z <= -Math.abs(x) + 0.23 || z >= 1.2192 + Math.abs(x) - 0.23;
}
export function patternPoints(colors: string[], motif = 'GPP') {
  return colors.reduce(
    (score, c, i) => score + (c === motif[i % 3] ? 2 : 0),
    0,
  );
}

export function overLaunchLine(x: number, z: number) {
  return (
    Math.abs(z + Math.abs(x)) < 0.29 ||
    (z > 1 && Math.abs(z - 1.2192 - Math.abs(x)) < 0.29)
  );
}
export function basePoints(x: number, z: number, yaw: number, side = 1) {
  const half = 0.2285,
    extent = (Math.abs(Math.cos(yaw)) + Math.abs(Math.sin(yaw))) * 0.19;
  const dx = Math.abs(x - side * 1.1),
    dz = Math.abs(z - 1.49);
  if (dx + extent <= half && dz + extent <= half) return 10;
  if (dx < half + extent && dz < half + extent) return 5;
  return 0;
}

/** Distance from the blue lever to the robot's oriented bumper perimeter. */
export function gateReach(x: number, z: number, yaw: number) {
  const dx = -1.47 - x,
    dz = 0.4 - z,
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  const localX = dx * c - dz * s,
    localZ = dx * s + dz * c;
  return Math.hypot(
    Math.max(0, Math.abs(localX) - 0.205),
    Math.max(0, Math.abs(localZ) - 0.205),
  );
}
export function manualLaunch(
  speed: number,
  elevation: number,
  yaw: number,
  platform: { x: number; z: number },
) {
  const angle = (elevation * Math.PI) / 180,
    horizontal = speed * Math.cos(angle);
  return {
    x: -Math.sin(yaw) * horizontal + platform.x,
    y: speed * Math.sin(angle),
    z: -Math.cos(yaw) * horizontal + platform.z,
  };
}
/** Horizontal distance when a shot descends through the goal lip height. */
export function shotRange(
  speed: number,
  elevation: number,
  startHeight = 0.38,
  targetHeight = 0.985,
) {
  const a = (elevation * Math.PI) / 180,
    vy = speed * Math.sin(a),
    disc = vy * vy - 2 * 9.81 * (targetHeight - startHeight);
  return disc < 0
    ? null
    : (speed * Math.cos(a) * (vy + Math.sqrt(disc))) / 9.81;
}
/** Editing a control must not swallow unrelated game keys such as F or WASD. */
export function controlOwnsKey(
  code: string,
  textEditing: boolean,
  adjustmentFocused: boolean,
) {
  if (textEditing) return true;
  return (
    adjustmentFocused &&
    [
      'Space',
      'Enter',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ].includes(code)
  );
}

export const deadzone = (v: number) =>
  Math.abs(v) < 0.13 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.13)) / 0.87;
export function driveImpulse(
  current: { x: number; z: number },
  target: { x: number; z: number },
  mass: number,
  dt: number,
) {
  let x = (target.x - current.x) * mass * 0.12,
    z = (target.z - current.z) * mass * 0.12,
    max = mass * 4.7 * dt,
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

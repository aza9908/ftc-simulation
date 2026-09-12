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
  const distance = Math.hypot(target.x - start.x, target.z - start.z);
  const t = Math.max(0.65, Math.min(1.05, distance / 3.2));
  const velocity = {
    x: (target.x - start.x) / t,
    y: (target.y - start.y + 4.905 * t * t) / t,
    z: (target.z - start.z) / t,
  };
  // Iteratively correct the launch against the same drag model used by Rapier.
  for (let i = 0; i < 10; i++) {
    const end = flightAt(start, velocity, t);
    velocity.x += (target.x - end.x) / t;
    velocity.y += (target.y - end.y) / t;
    velocity.z += (target.z - end.z) / t;
  }
  return velocity;
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
  const angle = (elevation * Math.PI) / 180;
  let p = { x: 0, y: startHeight, z: 0 };
  let v = { x: speed * Math.cos(angle), y: speed * Math.sin(angle), z: 0 };
  for (let i = 0; i < 720; i++) {
    const previous = p;
    const next = flightStep(p, v, 1 / 120);
    p = next.position;
    v = next.velocity;
    if (v.y < 0 && previous.y >= targetHeight && p.y <= targetHeight) {
      const alpha = (previous.y - targetHeight) / (previous.y - p.y);
      return previous.x + (p.x - previous.x) * alpha;
    }
    if (p.y < 0) break;
  }
  return null;
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

export type Vector = { x: number; y: number; z: number };
// Approximate foam-ball aerodynamic coefficient: rho=1.225 kg/m³, Cd=0.47,
// diameter=0.127 m, mass=0.065 kg. Requires calibration against a real artifact.
export const BALL_DRAG = (0.5 * 1.225 * 0.47 * Math.PI * 0.0635 ** 2) / 0.065;
export function dragDelta(v: Vector, dt: number) {
  const factor = 1 / (1 + BALL_DRAG * Math.hypot(v.x, v.y, v.z) * dt) - 1;
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}
export function flightStep(p: Vector, v: Vector, dt: number) {
  const d = dragDelta(v, dt);
  const velocity = { x: v.x + d.x, y: v.y + d.y - 9.81 * dt, z: v.z + d.z };
  return {
    velocity,
    position: {
      x: p.x + velocity.x * dt,
      y: p.y + velocity.y * dt,
      z: p.z + velocity.z * dt,
    },
  };
}
export function flightAt(start: Vector, velocity: Vector, time: number) {
  let p = { ...start },
    v = { ...velocity };
  const steps = Math.max(1, Math.ceil(time * 120)),
    dt = time / steps;
  for (let i = 0; i < steps; i++) {
    const next = flightStep(p, v, dt);
    p = next.position;
    v = next.velocity;
  }
  return p;
}
/** Wheel speed budget shared between forward, strafe and turning commands. */
export function mecanumDemand(x: number, z: number, turn: number, yaw: number) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const lateral = x * c - z * s,
    forward = x * s + z * c;
  const scale = Math.max(
    1,
    Math.abs(lateral) + Math.abs(forward) + Math.abs(turn) * 0.35,
  );
  return { x: x / scale, z: z / scale, turn: turn / scale };
}

/** Turret motor with bounded speed, acceleration, and cable stops at ±170°. */
export function turretStep(
  angle: number,
  velocity: number,
  input: number,
  target: number | null,
  dt: number,
) {
  const limit = (170 * Math.PI) / 180;
  const goal =
    target === null ? null : Math.max(-limit, Math.min(limit, target));
  const desired = input
    ? input * 1.6
    : goal === null
      ? 0
      : Math.max(-1.6, Math.min(1.6, (goal - angle) * 6));
  velocity += Math.max(-7 * dt, Math.min(7 * dt, desired - velocity));
  const next = angle + velocity * dt;
  angle = Math.max(-limit, Math.min(limit, next));
  if (angle !== next) velocity = 0;
  return { angle, velocity };
}

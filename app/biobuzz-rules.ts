/** BIOBUZZ kickoff V1, §§9–11; field setup guide V1 §12. SI units. */
export const BIO_MANUAL =
  'https://ftc-resources.firstinspires.org/ftc/archive/2027/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20V1.htm';
export const BIO_FIELD_GUIDE =
  'https://ftc-resources.firstinspires.org/ftc/archive/2027/field/eventfieldguide';
export type Alliance = 'red' | 'blue';
export type PieceKind = 'pollen' | Alliance;
export const FIELD_HALF = 1.8288;
export const STEP = 1 / 120;
export const HIVE_LIMIT = Math.PI / 6;
export const HIVE_PIVOT = 1.1165;
export const HIVE_X = 0.32385;
export const CELL = {
  inner: 0.23927,
  outer: 0.54509,
  halfWidth: 0.254,
  bottom: -0.03,
  shoulder: 0.1633,
  peak: 0.3256,
};
export const FLOWER_TOP = 0.5461;
export const FLOWER_MIDDLE = 0.1002;
export const FLOWER_RADIUS = 0.0508;
export const FLOWERS = [
  { x: -FIELD_HALF + 0.068, z: 0.6096, facing: Math.PI / 2 },
  { x: -0.6096, z: -FIELD_HALF + 0.068, facing: 0 },
  { x: FIELD_HALF - 0.068, z: -0.6096, facing: -Math.PI / 2 },
  { x: 0.6096, z: FIELD_HALF - 0.068, facing: Math.PI },
];
export const ROBOT_NAMES = ['Blue 1', 'Blue 2', 'Red 1', 'Red 2'];
export const allianceOf = (id: number): Alliance => (id < 2 ? 'blue' : 'red');
export const radiusOf = (kind: PieceKind) =>
  kind === 'pollen' ? 0.03556 : 0.04572;
// Training estimates, not measured manufacturer specifications. Nectar/pollen
// ratio models the two official calibration combinations (8P and 3P+3N).
export const massOf = (kind: PieceKind) => (kind === 'pollen' ? 0.03 : 0.05);
export const pollenEquivalent = (kinds: PieceKind[]) =>
  kinds.reduce((n, k) => n + (k === 'pollen' ? 1 : 5 / 3), 0);
export const shouldTip = (kinds: PieceKind[]) =>
  pollenEquivalent(kinds) >= 7.99;
export const flowersOpen = (time: number, timed: boolean) =>
  !timed || time <= 60;
export const nectarAvailable = (
  tips: number,
  entered: number,
  time: number,
  timed: boolean,
) =>
  Math.max(
    0,
    Math.min(5 - entered, flowersOpen(time, timed) ? 5 : tips - entered),
  );
export function inLoading(
  x: number,
  z: number,
  alliance: Alliance,
  extent = 0,
) {
  const sign = alliance === 'red' ? -1 : 1;
  return (
    sign * x + extent >= FIELD_HALF - 0.2794 &&
    sign * x - extent <= FIELD_HALF &&
    sign * z + extent >= 0.635 &&
    sign * z - extent <= 1.2192
  );
}
export function inGarden(x: number, z: number, r: number, alliance: Alliance) {
  const side = alliance === 'red' ? -1 : 1;
  return (
    side * x + r >= FIELD_HALF - 0.5842 &&
    side * x - r <= FIELD_HALF &&
    -side * z + r >= FIELD_HALF - 0.0508 &&
    -side * z - r <= FIELD_HALF
  );
}
export function flowerScore(kinds: PieceKind[]) {
  const nectar = kinds.filter((k): k is Alliance => k !== 'pollen');
  const bottom = nectar[0] ?? null,
    owner = nectar.at(-1) ?? null;
  return {
    bottom,
    owner,
    red: (bottom === 'red' ? 5 : 0) + (owner === 'red' ? kinds.length * 2 : 0),
    blue:
      (bottom === 'blue' ? 5 : 0) + (owner === 'blue' ? kinds.length * 2 : 0),
  };
}
export type Vec = { x: number; y: number; z: number };
export function flightStep(p: Vec, v: Vec, kind: PieceKind, dt = STEP) {
  const drag =
    (0.5 * 1.225 * 0.47 * Math.PI * radiusOf(kind) ** 2) / massOf(kind);
  const f = 1 / (1 + drag * Math.hypot(v.x, v.y, v.z) * dt);
  const velocity = { x: v.x * f, y: v.y * f - 9.81 * dt, z: v.z * f };
  return {
    position: {
      x: p.x + velocity.x * dt,
      y: p.y + velocity.y * dt,
      z: p.z + velocity.z * dt,
    },
    velocity,
  };
}
export function ballisticVelocity(
  start: Vec,
  target: Vec,
  kind: PieceKind,
  time: number,
) {
  const v = {
    x: (target.x - start.x) / time,
    y: (target.y - start.y + 4.905 * time * time) / time,
    z: (target.z - start.z) / time,
  };
  for (let n = 0; n < 7; n++) {
    let p = { ...start },
      w = { ...v };
    const steps = Math.ceil(time / STEP),
      dt = time / steps;
    for (let i = 0; i < steps; i++) {
      const result = flightStep(p, w, kind, dt);
      p = result.position;
      w = result.velocity;
    }
    v.x += (target.x - p.x) / time;
    v.y += (target.y - p.y) / time;
    v.z += (target.z - p.z) / time;
  }
  return v;
}
export const wrapAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

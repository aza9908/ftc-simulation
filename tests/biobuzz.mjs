import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
fs.mkdirSync('work/biobuzz-test', { recursive: true });
for (const name of ['physics', 'biobuzz-rules', 'biobuzz-tags', 'biobuzz']) {
  const source = fs
    .readFileSync(`app/${name}.ts`, 'utf8')
    .replaceAll("'./physics'", "'./physics.mjs'")
    .replaceAll("'./biobuzz-rules'", "'./biobuzz-rules.mjs'")
    .replaceAll("'./biobuzz-tags'", "'./biobuzz-tags.mjs'");
  fs.writeFileSync(
    `work/biobuzz-test/${name}.mjs`,
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const { Biobuzz } = await import('../work/biobuzz-test/biobuzz.mjs');
const R = await import('../work/biobuzz-test/biobuzz-rules.mjs');
await RAPIER.init();
function engine() {
  const s = Object.create(Biobuzz.prototype);
  Object.assign(s, {
    world: new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    scene: new THREE.Scene(),
    robots: [],
    balls: [],
    hives: [],
    flowers: [],
    ids: [0, 2],
    players: 1,
    timed: false,
    time: 120,
    running: false,
    ended: false,
    settling: 0,
    elapsed: 0,
    keys: new Set(),
    padSlots: [null, null],
    view: 'Field',
    selected: 0,
    cb: (v) => {
      s.snapshot = v;
    },
  });
  s.label = () => new THREE.Mesh();
  s.world.timestep = R.STEP;
  s.world.numSolverIterations = 10;
  s.world.numInternalPgsIterations = 2;
  s.buildField();
  s.buildHives();
  s.buildFlowers();
  for (let i = 0; i < 4; i++) s.robots.push(s.buildRobot(i));
  s.reset();
  return s;
}
function advance(s, seconds) {
  for (let i = 0; i < seconds / R.STEP; i++) s.step();
  s.sync();
  s.emit();
}
function pose(r, x, z, yaw) {
  r.yaw = yaw;
  r.body.setTranslation({ x, y: 0.072, z }, true);
  r.body.setRotation(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    true,
  );
  r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
assert.equal(R.shouldTip(Array(7).fill('pollen')), false);
assert.equal(R.shouldTip(Array(8).fill('pollen')), true);
assert.equal(R.shouldTip(['blue', 'blue', 'blue', 'pollen', 'pollen']), false);
assert.equal(
  R.shouldTip(['blue', 'blue', 'blue', 'pollen', 'pollen', 'pollen']),
  true,
);
assert.equal(R.nectarAvailable(2, 1, 61, true), 1);
assert.equal(R.nectarAvailable(0, 0, 60, true), 5);
assert.deepEqual(R.flowerScore(['pollen', 'red', 'pollen', 'blue']), {
  bottom: 'red',
  owner: 'blue',
  red: 5,
  blue: 8,
});
assert(R.inLoading(-1.75, -0.9, 'red'));
assert(R.inLoading(1.75, 0.9, 'blue'));
assert(!R.inLoading(1.75, 0.9, 'red'));
const s = engine();
assert.equal(s.balls.length, 56);
assert.equal(s.balls.filter((b) => b.kind === 'pollen').length, 40);
assert(s.robots.every((r) => r.inventory.length === 4));
advance(s, 2);
console.log(
  'Initial hives:',
  s.hives.map((h) => ({
    color: h.alliance,
    load: h.load,
    count: s.cellBalls(h).length,
  })),
  'flowers:',
  s.flowers.map((f) => f.balls.length),
);
assert(
  s.hives.every((h) => h.tips === 0 && s.cellBalls(h).length === 3),
  'Staged nectar must stay in cells',
);
// Physical hive: seven pollen may not tip, eight must tip then empty.
const h = s.hives[1];
for (const b of s.cellBalls(h)) {
  b.state = 'held';
  b.body.setEnabled(false);
}
const payload = [];
for (let i = 0; i < 7; i++) {
  const p = s.hivePoint(
    h,
    new THREE.Vector3(
      ((i % 4) - 1.5) * 0.08,
      0.04 + Math.floor(i / 4) * 0.07,
      h.active * (R.CELL.inner + 0.05),
    ),
  );
  payload.push(s.addBall('pollen', p.x, p.y, p.z));
}
advance(s, 2);
assert.equal(h.tips, 0, 'Seven pollen should not tip');
const p = s.hivePoint(
  h,
  new THREE.Vector3(0.08, 0.13, h.active * (R.CELL.inner + 0.06)),
);
payload.push(s.addBall('pollen', p.x, p.y, p.z));
advance(s, 5);
console.log(
  'Hive tip:',
  h.tips,
  h.angle,
  'payload floor:',
  payload.filter((b) => b.body.translation().y < 0.12).length,
);
assert.equal(h.tips, 1, 'Eight pollen should finish one physical tip');
assert(
  payload.filter((b) => b.body.translation().y < 0.12).length >= 6,
  'Tipped cell must spill onto floor',
);
// Restore the official inventory before testing actual assisted shots.
s.reset();
s.running = true;
const robot = s.robots[0],
  blue = s.hives[1];
pose(robot, R.HIVE_X, -1.4, Math.PI);
robot.assist = true;
robot.ballistics = true;
advance(s, 1);
for (let i = 0; i < 3; i++) {
  s.action(0, 'shoot');
  advance(s, 1.4);
}
advance(s, 4);
console.log(
  'Shot cycle:',
  blue.tips,
  robot.inventory.length,
  blue.load,
  s.message,
);
assert.equal(
  robot.inventory.length,
  1,
  'Three queued shots must fire once each',
);
assert(
  blue.tips >= 1,
  'Three launched pollen into the preloaded hive must tip it',
);
assert.equal(s.balls.length, 56, 'Gameplay must conserve all scoring elements');
s.action(0, 'nectar');
assert.equal(blue.entered, 1);
assert.equal(blue.reserve[0].state, 'free');
// Intake stops at capacity and cannot reach nectar trapped in a flower.
s.reset();
s.running = true;
robot.inventory.splice(0).forEach((b) => {
  b.state = 'reserve';
});
pose(robot, 0, 1, 0);
robot.intake = true;
const b = s.balls.find((b) => b.kind === 'pollen' && b.state === 'free');
b.body.setTranslation({ x: 0, y: 0.036, z: 0.72 }, true);
b.grounded = true;
b.born = -1;
advance(s, 0.3);
assert(robot.inventory.includes(b), 'Front roller must collect a floor ball');
// Correct time gate, lift animation and actual gravity placement in flower.
s.reset();
s.running = true;
s.timed = true;
s.time = 61;
const f = s.flowers[0];
pose(robot, f.x + 0.29, f.z, Math.PI / 2);
s.action(0, 'place');
assert.equal(robot.place, null);
s.time = 60;
s.action(0, 'place');
assert(robot.place, 'Aligned lift must start in the final minute');
advance(s, 2);
assert.equal(robot.inventory.length, 3);
assert(
  f.balls.length >= 4,
  'Released pollen should remain physically in the flower',
);
// All gamepad/keyboard players use independent mechanisms.
s.configure({ players: 2 });
s.running = true;
s.setAim(0, 'power', 7);
s.setAim(1, 'power', 4.5);
assert.equal(s.robots[s.ids[0]].power, 7);
assert.equal(s.robots[s.ids[1]].power, 4.5);
s.action(1, 'intake');
assert.equal(s.robots[s.ids[1]].intake, true);
assert.equal(s.robots[s.ids[0]].intake, false);
s.timed = true;
s.time = 0.05;
advance(s, 5);
assert.equal(s.time, 0);
assert.equal(s.ended, true);
assert.equal(s.running, false);
s.reset();
s.running = true;
s.timed = false;
s.players = 1;
const defaultHive = s.hives[1];
s.robots[0].assist = true;
s.robots[0].ballistics = true;
for (let i = 0; i < 3; i++) {
  s.action(0, 'shoot');
  advance(s, 1.5);
}
advance(s, 4);
assert.equal(
  defaultHive.tips,
  1,
  'Default starting position must have a working assisted shot',
);
const before = s.robots[0].turretAngle;
s.action(0, 'turretLeft');
for (let i = 0; i < 120; i++) s.updateIdleControls(1 / 120);
assert(
  s.robots[0].turretAngle > before + 0.1,
  'Turret tap must work while paused',
);
s.players = 2;
const buttons = () =>
  Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
const pads = [
  {
    index: 0,
    id: 'Test DualSense 1',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: buttons(),
  },
  {
    index: 1,
    id: 'Test DualSense 2',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: buttons(),
  },
];
const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { getGamepads: () => pads },
});
s.pad(0, s.robots[s.ids[0]]);
s.pad(1, s.robots[s.ids[1]]);
assert.deepEqual(s.padSlots, [0, 1]);
pads[0].connected = false;
s.pad(0, s.robots[s.ids[0]]);
s.pad(1, s.robots[s.ids[1]]);
assert.equal(s.robots[s.ids[0]].controller, '');
assert.equal(s.robots[s.ids[1]].controller, 'Test DualSense 2');
if (nav) Object.defineProperty(globalThis, 'navigator', nav);
else delete globalThis.navigator;
s.reset();
s.timed = true;
s.running = true;
s.advanceClock(60.5);
assert.equal(
  s.time,
  59.5,
  'Clock must use wall time independently of rendered physics frames',
);
s.advanceClock(60);
assert.equal(s.time, 0);
assert(s.settling > 0);
s.world.free();
console.log(
  'BIOBUZZ rules, physical cells, firing, recycling, intake, lift, multiplayer, and timer checks passed.',
);

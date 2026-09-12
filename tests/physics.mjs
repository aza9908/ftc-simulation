import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
fs.mkdirSync('work', { recursive: true });
for (const name of ['physics', 'simulator']) {
  let src = fs
    .readFileSync(`app/${name}.ts`, 'utf8')
    .replace("'./physics'", "'./physics.mjs'");
  fs.writeFileSync(
    `work/${name}.mjs`,
    ts.transpileModule(src, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    }).outputText,
  );
}
const { Simulator } = await import('../work/simulator.mjs');
const P = await import('../work/physics.mjs');
await RAPIER.init();
const s = Object.create(Simulator.prototype);
Object.assign(s, {
  world: new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
  scene: new THREE.Scene(),
  robotMesh: new THREE.Group(),
  turret: new THREE.Group(),
  wheels: [],
  balls: [],
  gates: [],
  inventory: [],
  ramp: [],
  bots: [],
  blueReserve: [],
  redReserve: [],
  redRamp: [],
  keys: new Set(),
  s: {},
  options: {
    assist: true,
    power: 6.3,
    view: 'Field',
    sound: false,
    timed: false,
  },
  padButtons: [],
  yaw: 0,
  shotClock: 0,
  cb: () => {},
  label: () => {},
});
s.world.timestep = 1 / 120;
s.buildField();
s.buildRobot();
s.buildBots();
s.reset();
const step = (n) => {
  for (let i = 0; i < n; i++) s.step();
};
assert.equal(s.balls.length, 36);
assert.equal(s.balls.filter((b) => b.color === 'G').length, 12);
assert.equal(s.inventory.length, 3);
assert.equal(s.blueReserve.length, 3);
assert.equal(s.redReserve.length, 6);
assert.equal(s.balls.filter((b) => b.state === 'free').length, 24);
assert.equal(s.s.intake, false);
s.s.running = true;
s.shoot();
assert.equal(s.s.shots, 0, 'launcher must spin up');
step(400);
assert.equal(
  s.s.classified,
  1,
  'assisted shot must classify in the left BLUE goal',
);
assert.equal(s.ramp.length, 1);
const recycled = s.ramp[0];
s.robot.setTranslation({ x: -1.29, y: 0.14, z: 0.36 }, true);
s.robot.setLinvel({ x: 0, y: 0, z: 0 }, true);
s.keys.add('KeyF');
step(800);
assert(s.s.gate > 0.8);
assert.equal(s.ramp.length, 0, 'physical ramp ball exits open gate');
s.keys.clear();
step(250);
assert(s.s.gate < 0.1);
// Verify that manual intake, rather than a proximity pickup, is necessary.
s.robot.setTranslation({ x: 0, y: 0.14, z: 0.5 }, true);
s.robot.setLinvel({ x: 0, y: 0, z: 0 }, true);
s.robot.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
recycled.body.setTranslation({ x: 0, y: 0.07, z: 0.21 }, true);
recycled.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
recycled.state = 'free';
const count = s.inventory.length;
step(90);
assert.equal(s.inventory.length, count, 'intake OFF does not collect');
s.toggleIntake();
step(180);
assert.equal(s.inventory.length, count + 1, 'intake ON physically captures');
s.reverseIntake();
assert.equal(s.inventory.length, count, 'reverse returns artifact to field');
assert.equal(s.s.intake, false);
s.reset();
s.s.running = true;
s.keys.add('KeyD');
step(1000);
assert(s.robot.translation().x < 1.7, 'field wall stops robot');
s.reset();
s.s.running = true;
s.robot.setTranslation({ x: 0, y: 0.14, z: 0.5 }, true);
s.flywheel = 1;
s.shoot();
assert.equal(s.s.shots, 0, 'illegal zone guarded');
assert.equal(P.patternPoints(['G', 'P', 'P', 'P', 'G', 'P'], 'GPP'), 8);
assert.equal(P.patternPoints(['P', 'P', 'G'], 'PPG'), 6);
assert.equal(P.basePoints(1.1, 1.49, 0), 10);
assert.equal(P.basePoints(1.1, 1.49, Math.PI / 4), 5);
assert.equal(P.basePoints(0, 0, 0), 0);
// Four robots, real match phase durations, control lockout, and settling after buzzer.
s.options.timed = true;
s.reset();
assert.equal(s.bots.filter((b) => b.body.isEnabled()).length, 3);
assert.equal(s.blueReserve.length + s.redReserve.length, 0);
assert.equal(s.s.time, 30);
s.s.running = true;
s.toggleIntake();
assert.equal(s.s.intake, false, 'manual intake locked during AUTO');
step(3601);
assert.equal(s.s.phase, 'TRANSITION');
step(960);
assert.equal(s.s.phase, 'TELEOP');
s.toggleIntake();
assert.equal(s.s.intake, true);
step(120 * 120 - 2);
assert(Number.isFinite(s.s.score) && Number.isFinite(s.s.redScore));
assert.equal(s.balls.length, 36);
s.s.time = 0.001;
step(1);
assert.equal(s.s.phase, 'SETTLING');
assert.equal(s.s.ended, false, 'physics continues after buzzer');
step(1900);
assert.equal(s.s.phase, 'COMPLETE');
assert(s.s.ended);
assert.equal(
  Object.values(s.s.breakdown[0]).reduce((a, b) => a + b, 0),
  s.s.score,
  'blue results must reconcile',
);
assert.equal(
  Object.values(s.s.breakdown[1]).reduce((a, b) => a + b, 0),
  s.s.redScore,
  'red results must reconcile',
);
assert(s.s.breakdown[0].autoArtifacts > 0, 'AUTO artifacts tracked separately');
assert.equal(s.balls.length, 36, 'no artifacts are created or lost');
// A full, single-file ramp must remain blocked until the physically nearby gate opens.
s.options.timed = false;
s.reset();
s.s.running = true;
const rackBalls = s.balls.filter((b) => b.state === 'free').slice(0, 9);
for (const ball of rackBalls) {
  ball.state = 'ramp';
  s.ramp.push(ball);
  ball.body.setTranslation({ x: -1.61, y: 0.87, z: -1.03 }, true);
  ball.body.setLinvel({ x: 0, y: 0, z: 0.18 }, true);
  step(130);
}
step(300);
assert.equal(s.ramp.length, 9, 'closed narrow ramp retains nine balls');
assert(
  rackBalls.every((b) => Math.abs(b.body.translation().x + 1.61) < 0.04),
  'balls remain in the single-file lane',
);
s.robot.setTranslation({ x: -1.22, y: 0.14, z: 0.4 }, true);
s.robot.setLinvel({ x: 0, y: 0, z: 0 }, true);
const switchTarget = {
  closest(selector) {
    return selector.includes('[role="switch"]') ? {} : null;
  },
};
s.keydown({
  code: 'KeyF',
  target: switchTarget,
  repeat: false,
  defaultPrevented: false,
  preventDefault() {},
});
assert(s.keys.has('KeyF'), 'F must work with a settings switch focused');
step(1000);
assert(s.s.gate > 0.8);
assert.equal(s.ramp.length, 0, 'held F drains all nine balls');
s.keys.clear();
step(250);
assert(s.s.gate < 0.1);
assert(P.gateReach(-1.22, 0.4, 0) < 0.16);
assert(P.gateReach(0, 0.4, 0) > 0.16);
assert(P.controlOwnsKey('Space', false, true));
assert(!P.controlOwnsKey('KeyF', false, true));
assert(P.controlOwnsKey('KeyF', true, false));
assert(P.shotRange(8, 45) > P.shotRange(5, 45));
assert.equal(P.shotRange(3, 25), null);
const movingShot = P.manualLaunch(6, 55, 0, { x: 1, z: 0.5 }),
  stillShot = P.manualLaunch(6, 55, 0, { x: 0, z: 0 });
assert.equal(movingShot.x - stillShot.x, 1);
assert.equal(movingShot.z - stillShot.z, 0.5);
// Servo impulse should converge across different simulation step sizes.
function response(dt) {
  let v = { x: 0, z: 0 };
  for (let t = 0; t < 1 - 1e-8; t += dt) {
    let imp = P.driveImpulse(v, { x: 1.65, z: 0 }, 14, dt);
    v.x += imp.x / 14;
  }
  return v.x;
}
assert(Math.abs(response(1 / 60) - response(1 / 120)) < 0.025);
// Standard gamepad mapping uses L1 as an edge-triggered intake toggle.
s.options.timed = false;
s.reset();
s.s.running = true;
const pad = {
  connected: true,
  mapping: 'standard',
  axes: [1, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
};
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [pad],
  configurable: true,
});
step(180);
assert(s.robot.translation().x > 0.6);
pad.axes = [0, 0, 0, 0];
pad.buttons[4].pressed = true;
step(3);
assert(s.s.intake);
pad.buttons[4].pressed = false;
step(1);
pad.buttons[4].pressed = true;
step(1);
assert(!s.s.intake);
pad.buttons[9].pressed = true;
step(1);
assert(!s.s.running);
// Compare the aiming model against Rapier flight, without any field collisions.
const flightWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
flightWorld.timestep = 1 / 120;
for (const velocity of [
  { x: 3, y: 5, z: 0 },
  { x: -6, y: 7, z: 2 },
  { x: 1, y: 3, z: -2 },
]) {
  const origin = { x: 0, y: 2, z: 0 };
  const ball = flightWorld.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0),
  );
  flightWorld.createCollider(
    RAPIER.ColliderDesc.ball(0.0635).setMass(0.065),
    ball,
  );
  ball.setLinvel(velocity, true);
  for (let i = 0; i < 96; i++) {
    const d = P.dragDelta(ball.linvel(), 1 / 120),
      m = ball.mass();
    ball.applyImpulse({ x: d.x * m, y: d.y * m, z: d.z * m }, true);
    flightWorld.step();
  }
  const prediction = P.flightAt(origin, velocity, 0.8),
    actual = ball.translation();
  assert(
    Math.hypot(
      actual.x - prediction.x,
      actual.y - prediction.y,
      actual.z - prediction.z,
    ) < 0.04,
    'guide and Rapier flight agree within 4 cm',
  );
  assert(
    Math.abs(actual.x) < Math.abs(velocity.x * 0.8),
    'air resistance reduces horizontal travel',
  );
  flightWorld.removeRigidBody(ball);
}
flightWorld.free();
const straight = P.mecanumDemand(1, 0, 0, 0),
  diagonal = P.mecanumDemand(1, 1, 0, 0),
  turning = P.mecanumDemand(1, 0, 1, 0);
assert.equal(straight.x, 1);
assert.equal(
  diagonal.x + diagonal.z,
  1,
  'diagonal wheel commands fit motor speed limit',
);
assert(
  turning.x < straight.x && turning.turn < 1,
  'translation and rotation share motor capacity',
);
const rotationRobot = s.robot;
s.options.assist = false;
s.options.elevation = 55;
rotationRobot.setLinvel({ x: 0, y: 0, z: 0 }, true);
rotationRobot.setAngvel({ x: 0, y: 0, z: 0 }, true);
const stillMuzzle = s.getLaunch().velocity;
rotationRobot.setAngvel({ x: 0, y: 2, z: 0 }, true);
const rotatingMuzzle = s.getLaunch().velocity;
assert(
  Math.abs(
    Math.hypot(
      rotatingMuzzle.x - stillMuzzle.x,
      rotatingMuzzle.z - stillMuzzle.z,
    ) - 0.46,
  ) < 0.0001,
  'rotating muzzle adds tangential velocity',
);
let frees = 0;
const disposable = Object.create(Simulator.prototype);
Object.assign(disposable, {
  disposed: false,
  frame: 0,
  resize: { disconnect() {} },
  contextLife: new AbortController(),
  world: {
    free() {
      frees++;
    },
  },
  scene: new THREE.Scene(),
  renderer: { dispose() {}, domElement: { remove() {} } },
});
globalThis.cancelAnimationFrame = () => {};
globalThis.window = { removeEventListener() {} };
globalThis.document = { removeEventListener() {} };
disposable.dispose();
disposable.dispose();
assert.equal(frees, 1, 'dispose must be idempotent');
s.world.free();
console.log(
  'PASS: staging, spin-up, goal scoring, gate/recycling, manual intake/reverse, collisions, motifs, base scoring, four robots, match phases, settling, conservation and controller mapping.',
);

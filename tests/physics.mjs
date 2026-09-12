import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
fs.mkdirSync('work', { recursive: true });
for (const name of [
  'physics',
  'field-tags',
  'robot-library',
  'robot-model',
  'simulator',
]) {
  let src = fs
    .readFileSync(`app/${name}.ts`, 'utf8')
    .replace("'./physics'", "'./physics.mjs'")
    .replace("'./robot-model'", "'./robot-model.mjs'")
    .replace("'./robot-library'", "'./robot-library.mjs'")
    .replace("'./field-tags'", "'./field-tags.mjs'");
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
  robotModels: new Map(),
  modelRequests: new Map(),
  modelStatus: [],
  modelFiles: new Map(),
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
// Timed play starts immediately in manual control; nobody drives or shoots without input.
s.options.timed = true;
s.reset();
assert.equal(s.bots.filter((b) => b.body.isEnabled()).length, 3);
assert.equal(s.s.time, 120);
assert.equal(s.s.phase, 'MANUAL');
s.s.running = true;
const parked = s.bots.map((b) => ({ ...b.body.translation() }));
step(900);
assert.equal(s.s.shots, 0);
assert.equal(s.s.score, 0);
assert.equal(s.s.redScore, 0);
for (const [i, b] of s.bots.entries())
  assert(
    Math.hypot(
      b.body.translation().x - parked[i].x,
      b.body.translation().z - parked[i].z,
    ) < 0.03,
    'unselected robots do not drive',
  );
s.toggleIntake();
assert.equal(s.s.intake, true, 'intake available immediately');
s.keys.add('KeyW');
step(30);
s.keys.clear();
assert(s.robot.translation().z < 1.5, 'manual drive available immediately');
step(120 * 120 - 932);
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
assert.equal(s.s.breakdown[0].autoArtifacts, 0, 'no autonomous points');
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
// Wall-clock countdown must preserve overshoot at phase boundaries.
s.options.timed = true;
s.options.players = 1;
s.reset();
s.s.running = true;
s.advanceMatch(30.25);
assert.equal(s.s.phase, 'MANUAL');
assert.equal(s.s.time, 89.75);
s.advanceMatch(8);
assert.equal(s.s.phase, 'MANUAL');
assert.equal(s.s.time, 81.75);
s.advanceMatch(81.75);
assert.equal(s.s.phase, 'SETTLING');
// Two local players: independent drive commands and no AI takeover in free play.
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [],
  configurable: true,
});
s.options.timed = false;
s.options.players = 2;
s.reset();
s.s.running = true;
assert.equal(s.bots.filter((b) => b.body.isEnabled()).length, 3);
assert.equal(s.bots[1].inventory.length, 3);
const red = s.bots[1];
s.robot.setTranslation({ x: 0.5, y: 0.14, z: 0.7 }, true);
red.body.setTranslation({ x: -0.5, y: 0.14, z: 0.7 }, true);
s.keys.add('ArrowUp');
step(90);
s.keys.clear();
assert(red.body.translation().z < 0.25, 'arrow keys drive Player 2');
assert(
  Math.abs(s.robot.translation().z - 0.7) < 0.04,
  'Player 2 arrows do not drive Player 1',
);
assert.equal(s.s.intake, false);
s.toggleSecondIntake();
assert(s.secondIntake);
assert.equal(s.s.intake, false);
// Both players have manual control immediately in timed mode.
s.options.timed = true;
s.reset();
s.s.running = true;
s.toggleSecondIntake();
assert(s.secondIntake);
s.options.timed = false;
s.reset();
s.s.running = true;
red.body.setTranslation({ x: 1.22, y: 0.14, z: 0.4 }, true);
s.keys.add('KeyO');
step(140);
assert(
  s.gates.find((g) => g.side === 1).angle > 0.5,
  'Player 2 opens red gate',
);
s.keys.clear();
// Gate contact travel follows the manual's approximately 51 mm horizontal push.
const angle = -0.55,
  tip = { x: 0.125, y: -0.07 };
const moved = {
  x: tip.x * Math.cos(angle) - tip.y * Math.sin(angle),
  y: tip.x * Math.sin(angle) + tip.y * Math.cos(angle),
};
assert(Math.abs(tip.x - moved.x - 0.051) < 0.005);
assert(Math.abs(0.2 + moved.y - 0.076) < 0.005);
// Player 2 shots score only through the physical red goal, with spin-up and cooldown.
s.reset();
s.s.running = true;
red.body.setTranslation({ x: -0.42, y: 0.14, z: 1.62 }, true);
s.keys.add('Slash');
step(480);
s.keys.clear();
assert(s.s.redScore > 0, 'Player 2 can score in red goal');
assert(s.s.breakdown[1].teleopArtifacts > 0);
// Two controller slots stay assigned when Controller 1 disconnects.
s.reset();
s.s.running = true;
s.controllerSlots = [];
const pad1 = {
  connected: true,
  mapping: 'standard',
  index: 0,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
};
const pad2 = {
  connected: true,
  mapping: 'standard',
  index: 1,
  axes: [0, -1, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
};
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [pad1, pad2],
  configurable: true,
});
s.robot.setTranslation({ x: 0.5, y: 0.14, z: 0.7 }, true);
red.body.setTranslation({ x: -0.5, y: 0.14, z: 0.7 }, true);
step(45);
pad1.connected = false;
step(45);
assert(red.body.translation().z < 0.25);
assert(
  Math.abs(s.robot.translation().z - 0.7) < 0.04,
  'Controller 2 cannot take over Player 1 after disconnection',
);
pad2.axes = [0, 0, 0, 0];
pad2.buttons[4].pressed = true;
step(1);
assert(s.secondIntake);
assert(!s.s.intake);
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [],
  configurable: true,
});
s.options.players = 1;
s.options.timed = false;
s.reset();
// Every selectable identity has the correct alliance, start location and goal target.
for (const id of [0, 1, 2, 3]) {
  s.configure({ robot1: id, players: 1, timed: false });
  s.reset();
  s.s.running = true;
  assert.equal(s.playerSide, id < 2 ? 1 : -1);
  assert(Math.abs(s.robot.translation().x - s.robotSpawn(id).x) < 0.0001);
  assert.equal(s.inventory.length, 3);
  assert.equal(s.balls.length, 36);
  step(200); // The physical turret needs time to slew toward its alliance goal.
  assert(s.getLaunch().aligned, 'turret reaches goal bearing before firing');
  const targetX = -s.playerSide * 1.55;
  assert(
    Math.sign(s.getLaunch().velocity.x) ===
      Math.sign(targetX - s.robot.translation().x),
  );
  s.keys.add('Space');
  step(500);
  s.keys.clear();
  assert(
    (id < 2 ? s.s.score : s.s.redScore) > 0,
    `selected robot ${id} scores in its own alliance goal`,
  );
  s.robot.setTranslation({ x: -s.playerSide * 1.22, y: 0.14, z: 0.4 }, true);
  s.robot.setLinvel({ x: 0, y: 0, z: 0 }, true);
  s.keys.add('KeyF');
  step(150);
  s.keys.clear();
  assert(
    s.gates.find((g) => g.side === -s.playerSide).angle > 0.5,
    `selected robot ${id} opens its own gate`,
  );
}
// Same-alliance multiplayer is supported and cannot select the same robot twice.
s.configure({ players: 2, robot1: 1, robot2: 0, timed: false });
s.reset();
s.s.running = true;
assert.equal(s.bots[1].side, 1);
assert.equal(s.inventory.length + s.bots[1].inventory.length, 6);
const p2 = s.bots[1];
p2.body.setTranslation({ x: 0.42, y: 0.14, z: 1.62 }, true);
s.keys.add('Slash');
step(500);
s.keys.clear();
assert(s.s.score > 0, 'Player 2 can drive a blue robot');
assert.equal(s.s.redScore, 0);
s.configure({ robot1: 2, robot2: 2 });
assert.notEqual(s.options.robot1, s.options.robot2);
s.configure({ robot1: 0, robot2: 2, players: 1, timed: false });
s.reset();
// Turrets slew independently, keep their heading, and launch along the barrel.
s.configure({ robot1: 0, robot2: 2, players: 2, timed: false, assist: true });
s.reset();
s.s.running = true;
s.flywheel = 1;
s.shoot();
assert.equal(s.s.shots, 0, 'assisted shot waits for turret alignment');
assert(s.fireRequested);
step(120);
assert.equal(s.s.shots, 1, 'pending shot fires once after alignment');
s.reset();
s.s.running = true;
s.shootPlayer(1);
assert(s.secondFireRequested, 'P2 on-screen shot queues during spin-up');
step(300);
assert.equal(
  s.bots[1].inventory.length,
  2,
  'P2 queued shot fires exactly once',
);
step(120);
assert.equal(s.bots[1].inventory.length, 2, 'P2 queued shot does not repeat');
s.reset();
s.s.running = true;
s.keys.add('KeyZ');
step(60);
assert(!s.turretAssisted(0));
assert(
  s.turretAssisted(1),
  'Player 1 manual aiming does not override Player 2',
);
s.keys.add('KeyL');
step(60);
s.keys.clear();
step(60);
assert(s.turretAngles[0] > 1 && s.turretAngles[1] < -0.5);
assert(
  Math.abs(s.robot.rotation().y) < 0.001,
  'turret keys leave chassis still',
);
assert(Math.abs(s.bots[1].body.rotation().y) < 0.001);
const manualShot = s.getLaunch(),
  shotBall = s.inventory[0];
s.shoot();
assert.equal(s.s.shots, 1);
assert(Math.abs(shotBall.body.linvel().x - manualShot.velocity.x) < 1e-5);
assert(Math.abs(shotBall.body.translation().x - manualShot.start.x) < 1e-5);
assert(manualShot.velocity.x < -1, 'turned turret launches left of chassis');
s.keys.add('KeyZ');
step(500);
s.keys.clear();
assert(Math.abs(s.turretAngles[0] - (170 * Math.PI) / 180) < 1e-9);
assert.equal(s.turretRates[0], 0, 'cable stop arrests the turret');
s.centerTurret(0);
s.centerTurret(1);
step(400);
assert(
  Math.abs(s.turretAngles[0]) < 0.001 && Math.abs(s.turretAngles[1]) < 0.001,
);
s.s.running = false;
s.keys.add('KeyX');
const pausedAngle = s.turretAngles[0];
step(60);
assert.equal(s.turretAngles[0], pausedAngle, 'paused turret does not move');
s.keys.clear();
s.s.running = true;
pad1.connected = true;
pad1.axes = [0, 0, 1, 0];
pad1.buttons[5].pressed = true;
pad2.connected = true;
pad2.axes = [0, 0, -1, 0];
pad2.buttons.forEach((b) => {
  b.pressed = false;
  b.value = 0;
});
pad2.buttons[5].pressed = true;
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [pad1, pad2],
  configurable: true,
});
s.controllerSlots = [0, 1];
step(70);
assert(s.turretAngles[0] < -0.7 && s.turretAngles[1] > 0.7);
assert(
  Math.abs(s.bots[1].body.rotation().y) < 0.001,
  'R1 routes stick away from chassis',
);
pad1.axes = [0, 0, 0, 0];
pad1.buttons[5].pressed = false;
pad1.buttons[11].pressed = true;
pad2.axes = [0, 0, 0, 0];
pad2.buttons[5].pressed = false;
pad2.buttons[11].pressed = true;
step(300);
assert(
  Math.abs(s.turretAngles[0]) < 0.001 && Math.abs(s.turretAngles[1]) < 0.001,
  'R3 centers both turrets',
);
pad1.buttons[11].pressed = false;
pad2.buttons[11].pressed = false;
s.robot.setTranslation({ x: 0.5, y: 0.14, z: 0.5 }, true);
pad1.axes = [0, 0, 1, 0];
step(60);
assert(
  Math.abs(s.robot.rotation().y) > 0.1,
  'release R1 to steer chassis again',
);
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [],
  configurable: true,
});
s.configure({ players: 1, robot1: 0, robot2: 2, timed: false });
s.reset();
// Real GLB parsing, pivot animation, per-identity attachment and restoration.
const M = await import('../work/robot-model.mjs');
function makeGlb(external = false) {
  const positions = new Float32Array([-1, 0, -1, 1, 0, -1, 0, 1, 0, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 1, 3, 2, 3, 0, 2, 0, 3, 1]);
  const bin = new Uint8Array(positions.byteLength + indices.byteLength);
  bin.set(new Uint8Array(positions.buffer));
  bin.set(new Uint8Array(indices.buffer), positions.byteLength);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { mesh: 0, scale: [1, 0.4, 1] },
      { name: 'Turret', translation: [0, 0.5, 0], children: [2] },
      {
        name: 'Barrel',
        mesh: 0,
        translation: [0, 0.1, -0.3],
        scale: [0.2, 0.1, 0.6],
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [
      {
        byteLength: bin.length,
        ...(external ? { uri: 'https://example.com/model.bin' } : {}),
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: indices.byteLength,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [-1, 0, -1],
        max: [1, 1, 1],
      },
      { bufferView: 1, componentType: 5123, count: 12, type: 'SCALAR' },
    ],
  };
  const str = JSON.stringify(json),
    padded = str.padEnd(Math.ceil(str.length / 4) * 4, ' ');
  const data = new ArrayBuffer(28 + padded.length + bin.length),
    dv = new DataView(data);
  [0x46546c67, 2, data.byteLength, padded.length, 0x4e4f534a].forEach((n, i) =>
    dv.setUint32(i * 4, n, true),
  );
  new Uint8Array(data, 20, padded.length).set(new TextEncoder().encode(padded));
  dv.setUint32(20 + padded.length, bin.length, true);
  dv.setUint32(24 + padded.length, 0x004e4942, true);
  new Uint8Array(data, 28 + padded.length).set(bin);
  return data;
}
assert.throws(() => M.validateGlb(new ArrayBuffer(8)), /valid GLB/);
assert.throws(() => M.validateGlb(makeGlb(true)), /Embed all/);
const info = await s.importRobotModel(
  0,
  new File([makeGlb()], 'test-robot.glb'),
);
assert(info.turret && info.triangles === 8);
const imported = s.robotModels.get(0);
assert.equal(imported.root.parent, s.robotMesh);
const box = new THREE.Box3().setFromObject(imported.root),
  size = box.getSize(new THREE.Vector3());
assert(size.x <= 0.44001 && size.z <= 0.44001 && size.y <= 0.48001);
const barrel = imported.root.getObjectByName('Barrel');
const before = barrel.getWorldPosition(new THREE.Vector3());
s.turretAngles[0] = Math.PI / 2;
s.updateRobotModels();
assert(
  barrel.getWorldPosition(new THREE.Vector3()).distanceTo(before) > 0.05,
  'imported turret rotates around exported origin',
);
await assert.rejects(() =>
  s.importRobotModel(0, new File(['invalid'], 'broken.glb')),
);
assert.equal(
  s.robotModels.get(0),
  imported,
  'failed import preserves the working model',
);
s.configure({ robot1: 2, robot2: 0, players: 2 });
s.reset();
assert.equal(
  imported.root.parent,
  s.bots[1].mesh,
  'model follows robot identity when players swap',
);
assert.equal(
  imported.turret.rotation.y,
  0,
  'field reset centers imported turret',
);
s.removeRobotModel(0);
assert.equal(imported.root.parent, null);
assert(
  s.bots[1].mesh.children.every((child) => child.visible),
  'restore reveals default robot',
);
s.configure({ robot1: 0, robot2: 2, players: 1 });
s.reset();
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
s.configure({ assist: false, power: 6.3, elevation: 55 });
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
// Aim sliders remain independent of turret tracking and of the other player.
s.options.players = 2;
s.configure({ assist: true });
s.shotSettings[1] = { power: 7, elevation: 50, automatic: false };
const otherShot = { ...s.shotSettings[1] };
s.adjustShot(0, { power: 8, elevation: 42 });
assert(
  s.turretAssisted(0),
  'changing power or angle must not switch off goal tracking',
);
assert.equal(s.getLaunch(0).power, 8);
assert.equal(s.getLaunch(0).elevation, 42);
assert.deepEqual(s.shotSettings[1], otherShot, 'P1 sliders must not change P2');
s.adjustShot(1, { power: 9, elevation: 62 });
assert.equal(s.getLaunch(0).power, 8);
assert.equal(s.getLaunch(1).power, 9);
assert.equal(s.getLaunch(1).elevation, 62);
s.adjustmentClock = 0;
s.secondAdjustmentClock = 0;
s.s.running = true;
pad1.connected = true;
pad2.connected = true;
pad1.axes = [0, 0, 0, 0];
pad2.axes = [0, 0, 0, 0];
for (const p of [pad1, pad2]) for (const b of p.buttons) b.pressed = false;
pad1.buttons[15].pressed = true;
pad2.buttons[12].pressed = true;
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [pad1, pad2],
  configurable: true,
});
step(1);
assert(Math.abs(s.shotSettings[0].power - 8.2) < 1e-8);
assert.equal(
  s.shotSettings[1].elevation,
  64,
  'both controllers can adjust simultaneously',
);
Object.defineProperty(navigator, 'getGamepads', {
  value: () => [],
  configurable: true,
});

s.matchShotRange(0);
assert(s.shotSettings[0].automatic);
assert.equal(s.shotSettings[1].automatic, false);
// Both decorative goal markers are mounted on the front wall, facing the field.
s.scene.updateMatrixWorld(true);
for (const side of [-1, 1]) {
  const front = s.scene.getObjectByName(`goal-front-${side}`);
  const marker = s.scene.getObjectByName(`goal-marker-${side}`);
  assert.equal(marker.parent, front);
  assert.equal(marker.userData.tagId, side === -1 ? 20 : 24);
  assert(Math.abs(Math.abs(marker.position.x) - 0.0135) < 1e-8);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(
    marker.matrixWorld,
  );
  const expected = new THREE.Vector3(-side, 0, 1).normalize();
  assert(
    normal.dot(expected) > 0.999999,
    'marker face follows diagonal front wall',
  );
}
let frees = 0;
const disposable = Object.create(Simulator.prototype);
Object.assign(disposable, {
  disposed: false,
  robotModels: new Map(),
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
  'PASS: staging, spin-up, goal scoring, gate/recycling, manual intake/reverse, collisions, motifs, base scoring, four selectable robots, immediate manual control, parked robots, two-player input, settling, conservation and controller mapping.',
);

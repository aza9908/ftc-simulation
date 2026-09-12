import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  driveImpulse,
  dragDelta,
  flightAt,
  mecanumDemand,
  launchVelocity,
  inLaunchZone,
  patternPoints,
  deadzone,
  gateReach,
  manualLaunch,
  shotRange,
  controlOwnsKey,
  basePoints,
} from './physics';
export type ScoreDetail = {
  autoArtifacts: number;
  autoPattern: number;
  leave: number;
  teleopArtifacts: number;
  teleopPattern: number;
  base: number;
};
export type Snapshot = {
  robot1?: number;
  robot2?: number;
  alliance?: string;
  started?: boolean;
  players?: number;
  player2?: {
    magazine: string[];
    intake: boolean;
    speed: number;
    gate: number;
    nearGate: boolean;
    controller: string;
  };
  breakdown?: [ScoreDetail, ScoreDetail];
  elevation?: number;
  power?: number;
  assist?: boolean;
  gateDistance?: number;
  gatePrompt?: string;
  shotRange?: number | null;
  goalDistance?: number;
  intake?: boolean;
  flywheel?: number;
  phase?: string;
  motif?: string;
  reserve?: number;
  redScore?: number;
  view?: string;
  ready: boolean;
  score: number;
  classified: number;
  overflow: number;
  pattern: number;
  magazine: string[];
  ramp: string[];
  speed: number;
  time: number;
  running: boolean;
  gate: number;
  nearGate: boolean;
  controller: string;
  message: string;
  shots: number;
  hits: number;
  ended: boolean;
  inZone: boolean;
};
type Ball = {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  color: string;
  state: 'free' | 'held' | 'flight' | 'transit' | 'ramp' | 'reserve';
  capture?: number;
  owner?: number;
  previousY: number;
  wait: number;
  side: number;
};
type Gate = {
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  angle: number;
  velocity: number;
  side: number;
};
type Options = {
  robot1: number;
  robot2: number;
  players: 1 | 2;
  elevation: number;
  assist: boolean;
  power: number;
  view: string;
  sound: boolean;
  timed: boolean;
};
const H = 1.8288,
  R = 0.0635,
  DT = 1 / 120;
let rapierReady: Promise<void> | undefined;
export class Simulator {
  static async create(el: HTMLElement, cb: (s: Snapshot) => void) {
    await (rapierReady ??= RAPIER.init());
    return new Simulator(el, cb);
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.03, 80);
  renderer: THREE.WebGLRenderer;
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  robot!: RAPIER.RigidBody;
  robotMesh = new THREE.Group();
  turret = new THREE.Group();
  wheels: THREE.Mesh[] = [];
  balls: Ball[] = [];
  gates: Gate[] = [];
  inventory: Ball[] = [];
  ramp: Ball[] = [];
  options: Options = {
    assist: true,
    power: 6.3,
    elevation: 55,
    view: 'Field',
    sound: true,
    timed: true,
    players: 1,
    robot1: 0,
    robot2: 2,
  };
  controllerSlots: number[] = [];
  secondIntake = false;
  secondFlywheel = 0;
  secondReverseClock = 0;
  secondPadButtons: boolean[] = [];
  keys = new Set<string>();
  s: Snapshot = {
    ready: true,
    score: 0,
    classified: 0,
    overflow: 0,
    pattern: 0,
    magazine: [],
    ramp: [],
    speed: 0,
    time: 120,
    running: false,
    gate: 0,
    nearGate: false,
    controller: '',
    message: 'WASD to drive. Space to launch. Aim assist is on.',
    shots: 0,
    hits: 0,
    ended: false,
    inZone: true,
  };
  yaw = 0;
  frame = 0;
  last = 0;
  accum = 0;
  uiClock = 0;
  shotClock = 0;
  gateClock = 0;
  flywheel = 0;
  fireRequested = false;
  reverseClock = 0;
  settleClock = 0;
  motif = 'GPP';
  intakeRoller?: THREE.Mesh;
  blueReserve: Ball[] = [];
  redReserve: Ball[] = [];
  redRamp: Ball[] = [];
  botShots = 0;
  bots: {
    body: RAPIER.RigidBody;
    mesh: THREE.Group;
    inventory: Ball[];
    side: number;
    cooldown: number;
    yaw: number;
    gate: boolean;
  }[] = [];
  disposed = false;
  padButtons: boolean[] = [];
  resize: ResizeObserver;
  audio?: AudioContext;
  trajectory: THREE.Line;
  gateMarker?: THREE.Mesh;
  adjustmentClock = 0;
  contextLife = new AbortController();
  constructor(
    private el: HTMLElement,
    private cb: (s: Snapshot) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    el.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#26343d');
    this.scene.fog = new THREE.Fog('#26343d', 10, 25);
    this.scene.add(new THREE.HemisphereLight('#d4e8ff', '#444c44', 2));
    let sun = new THREE.DirectionalLight('#fff7dc', 3.5);
    sun.position.set(-3, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.1,
      far: 20,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    this.scene.add(sun);
    let fill = new THREE.DirectionalLight('#a2c4ff', 1.5);
    fill.position.set(5, 3, -4);
    this.scene.add(fill);
    this.world.timestep = DT;
    this.buildField();
    this.buildRobot();
    this.buildBots();
    this.trajectory = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: '#dcff92',
        dashSize: 0.06,
        gapSize: 0.055,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.scene.add(this.trajectory);
    this.keydown = this.keydown.bind(this);
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(el);
    this.resizeCanvas();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.reset();
    this.camera.position.set(0, 5.2, 5.3);
    this.camera.lookAt(0, 0, 0);
    this.registerTools();
    this.frame = requestAnimationFrame(this.tick);
  }
  mat(color: THREE.ColorRepresentation, metalness = 0, roughness = 0.6) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness });
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: THREE.ColorRepresentation,
    physical = false,
    parent: THREE.Object3D = this.scene,
  ) {
    let mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat(color, color === '#9caeb5' ? 0.75 : 0),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (physical)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
          .setTranslation(x, y, z)
          .setFriction(0.6),
      );
    return mesh;
  }
  label(
    text: string,
    x: number,
    y: number,
    z: number,
    size: number,
    color = '#dae4e8',
    flat = false,
  ) {
    let c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    let ctx = c.getContext('2d')!;
    ctx.font = 'bold 100px Arial';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128);
    let texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    let m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size / 4),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    if (flat) m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    return m;
  }
  line(a: THREE.Vector3, b: THREE.Vector3, width: number, color: string) {
    let dist = a.distanceTo(b),
      m = this.box(
        (a.x + b.x) / 2,
        0.008,
        (a.z + b.z) / 2,
        width,
        0.005,
        dist,
        color,
      );
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    return m;
  }
  buildField() {
    this.box(0, -0.1, 0, 5.8, 0.1, 5.8, '#18232b', true);
    this.box(0, -0.045, 0, H * 2, 0.09, H * 2, '#535d60', true);
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 6; z++) {
        let m = this.box(
          -H + (x + 0.5) * 0.6096,
          0.001,
          -H + (z + 0.5) * 0.6096,
          0.604,
          0.006,
          0.604,
          (x + z) % 2 ? '#687477' : '#626e72',
        );
        m.receiveShadow = true;
      }
    for (let side of [-1, 1]) {
      this.box(
        side * (H + 0.025),
        0.14,
        0,
        0.045,
        0.28,
        H * 2 + 0.1,
        '#53616a',
        true,
      );
      this.box(
        0,
        0.14,
        side * (H + 0.025),
        H * 2,
        0.28,
        0.045,
        '#53616a',
        true,
      );
      this.box(
        side * (H + 0.025),
        0.29,
        0,
        0.055,
        0.035,
        H * 2 + 0.1,
        '#b6c3c6',
      );
      this.box(0, 0.29, side * (H + 0.025), H * 2, 0.035, 0.055, '#b6c3c6');
      for (let p = -H; p <= H + 0.01; p += 0.6096) {
        this.box(side * (H + 0.02), 0.17, p, 0.068, 0.33, 0.055, '#263840');
        this.box(p, 0.17, side * (H + 0.02), 0.055, 0.33, 0.068, '#263840');
      }
    }
    // The two taped triangular launch zones share the field's center line axis.
    this.line(
      new THREE.Vector3(-H, 0, -H),
      new THREE.Vector3(0, 0, 0),
      0.025,
      '#e4e6db',
    );
    this.line(
      new THREE.Vector3(H, 0, -H),
      new THREE.Vector3(0, 0, 0),
      0.025,
      '#e4e6db',
    );
    this.line(
      new THREE.Vector3(-0.6096, 0, H),
      new THREE.Vector3(0, 0, H - 0.6096),
      0.025,
      '#e4e6db',
    );
    this.line(
      new THREE.Vector3(0.6096, 0, H),
      new THREE.Vector3(0, 0, H - 0.6096),
      0.025,
      '#e4e6db',
    );
    this.label('DECODE', 0, 0.011, -0.55, 1.1, '#929e9d', true);
    this.label('FIRST TECH CHALLENGE', 0, 0.012, -0.75, 0.9, '#8b989b', true);
    for (let side of [-1, 1]) {
      const color = side === -1 ? '#2864d3' : '#d52e30',
        gx = side * 1.46,
        gz = -1.49;
      // Open triangular goal: two back walls and a diagonal front wall, with no top collider.
      this.box(gx, 0.492, gz - 0.27, 0.58, 0.985, 0.026, color, true);
      this.box(gx + side * 0.27, 0.492, gz, 0.026, 0.985, 0.56, color, true);
      let front = this.box(
        gx - side * 0.015,
        0.43,
        gz + 0.015,
        0.026,
        0.86,
        0.76,
        color,
      );
      front.rotation.y = (side * Math.PI) / 4;
      let desc = RAPIER.ColliderDesc.cuboid(0.013, 0.43, 0.38)
        .setTranslation(front.position.x, front.position.y, front.position.z)
        .setRotation({
          x: 0,
          y: Math.sin((side * Math.PI) / 8),
          z: 0,
          w: Math.cos((side * Math.PI) / 8),
        });
      this.world.createCollider(desc);
      this.box(gx, 0.985, gz - 0.27, 0.62, 0.022, 0.034, '#ced8d7');
      this.box(gx + side * 0.27, 0.985, gz, 0.034, 0.022, 0.6, '#ced8d7');
      this.box(gx, 1.16, gz - 0.29, 0.62, 0.37, 0.035, color, true);
      this.label('FIRST', gx, 1.22, gz - 0.265, 0.43, '#eef4ff');
      this.label('TECH CHALLENGE', gx, 1.11, gz - 0.262, 0.48, '#eef4ff');
      // Fiducial-style contrast target, decorative rather than a valid AprilTag.
      this.box(gx - side * 0.12, 0.58, gz + 0.17, 0.18, 0.18, 0.008, '#e8e9df');
      this.box(
        gx - side * 0.12,
        0.58,
        gz + 0.179,
        0.12,
        0.12,
        0.008,
        '#17242a',
      );
      this.box(
        gx - side * 0.145,
        0.595,
        gz + 0.185,
        0.04,
        0.05,
        0.008,
        '#e8e9df',
      );
      // Classifier chute is at the field side: inclined physical rails and gravity-close gate.
      let ramp = this.box(
        side * 1.61,
        0.5,
        -0.39,
        0.148,
        0.022,
        1.47,
        '#a0afb0',
      );
      ramp.rotation.x = 0.43;
      let rd = RAPIER.ColliderDesc.cuboid(0.074, 0.011, 0.735)
        .setTranslation(side * 1.61, 0.5, -0.39)
        .setRotation({
          x: Math.sin(0.43 / 2),
          y: 0,
          z: 0,
          w: Math.cos(0.43 / 2),
        })
        .setFriction(0.16);
      this.world.createCollider(rd);
      for (let dx of [-0.083, 0.083]) {
        let rail = this.box(
          side * 1.61 + dx,
          0.58,
          -0.39,
          0.018,
          0.1,
          1.47,
          '#aebbbd',
        );
        rail.rotation.x = 0.43;
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.009, 0.05, 0.735)
            .setTranslation(rail.position.x, rail.position.y, rail.position.z)
            .setRotation({
              x: Math.sin(0.43 / 2),
              y: 0,
              z: 0,
              w: Math.cos(0.43 / 2),
            }),
        );
      }
      for (let z of [-0.95, 0.2])
        this.box(side * 1.61, 0.09, z, 0.025, 0.18, 0.025, '#9caeb5', true);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          side * 1.47,
          0.2,
          0.35,
        ),
      );
      const gate = new THREE.Group();
      const from = new THREE.Vector3(-side * 0.125, -0.07, 0),
        to = new THREE.Vector3(side * 0.19, 0.13, 0);
      const center = from.clone().add(to).multiplyScalar(0.5),
        length = from.distanceTo(to);
      const rotation = Math.atan2(to.y - from.y, to.x - from.x);
      const arm = this.box(
        center.x,
        center.y,
        0,
        length,
        0.024,
        0.018,
        '#292e33',
        false,
        gate,
      );
      arm.rotation.z = rotation;
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(length / 2, 0.012, 0.009)
          .setTranslation(center.x, center.y, 0)
          .setRotation({
            x: 0,
            y: 0,
            z: Math.sin(rotation / 2),
            w: Math.cos(rotation / 2),
          }),
        body,
      );
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.007, 8, 24),
        this.mat('#343b40'),
      );
      eye.position.copy(from);
      gate.add(eye);
      const pivot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.05, 16),
        this.mat('#bcc4c9'),
      );
      pivot.rotation.x = Math.PI / 2;
      gate.add(pivot);
      for (const x of [side * 1.47, side * 1.74]) {
        this.box(x, 0.15, 0.385, 0.018, 0.3, 0.035, '#8f9ca3', true);
        this.box(x, 0.3, 0.385, 0.032, 0.025, 0.045, '#b4bdc2');
      }
      this.scene.add(gate);
      this.gates.push({ body, mesh: gate, angle: 0, velocity: 0, side });
      if (side === -1) {
        this.gateMarker = new THREE.Mesh(
          new THREE.RingGeometry(0.23, 0.255, 48),
          new THREE.MeshBasicMaterial({
            color: '#87a8ef',
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        this.gateMarker.rotation.x = -Math.PI / 2;
        this.gateMarker.position.set(-1.25, 0.017, 0.4);
        this.scene.add(this.gateMarker);
      }
      this.line(
        new THREE.Vector3(side * 1.31, 0, 0.21),
        new THREE.Vector3(side * 1.31, 0, 0.49),
        0.025,
        color,
      );
      this.label(
        side === -1 ? 'BLUE GATE' : 'RED GATE',
        side * 1.12,
        0.015,
        0.37,
        0.48,
        color,
        true,
      );
      for (let dx of [-0.23, 0.23])
        this.box(
          side * 1.1 + dx,
          0.012,
          1.49,
          0.018,
          0.007,
          0.46,
          side === 1 ? '#568ced' : '#e65f56',
        );
      for (let z of [1.26, 1.72])
        this.box(
          side * 1.1,
          0.012,
          z,
          0.48,
          0.007,
          0.018,
          side === 1 ? '#568ced' : '#e65f56',
        );
      this.label(
        'BASE',
        side * 1.1,
        0.016,
        1.48,
        0.33,
        side === 1 ? '#568ced' : '#e65f56',
        true,
      );
      this.line(
        new THREE.Vector3(side * 1.25, 0, 0.62),
        new THREE.Vector3(side * H, 0, 0.62),
        0.023,
        '#dce1d9',
      );
      this.line(
        new THREE.Vector3(side * 1.25, 0, 0.62),
        new THREE.Vector3(side * 1.25, 0, 1.18),
        0.023,
        '#dce1d9',
      );
      this.box(side * 2.15, 0.045, 1.6, 0.28, 0.06, 0.93, '#182730');
      this.label(
        side === -1 ? 'RED PLAYER' : 'BLUE PLAYER',
        side * 2.15,
        0.081,
        1.95,
        0.5,
        side === -1 ? '#e65f56' : '#568ced',
        true,
      );
      this.label('RECYCLE', side * 1.59, 0.014, 0.98, 0.4, '#b0bec1', true);
      for (let z of [-0.55, 0.1, 0.75])
        this.box(side * 0.78, 0.012, z, 0.254, 0.006, 0.021, '#dce1d9');
    }
  }
  buildRobot() {
    this.robot = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.13, 1.35)
        .setLinearDamping(0.1)
        .setAngularDamping(4)
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.19, 0.11, 0.19)
        .setMass(14)
        .setFriction(0.04)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      this.robot,
    );
    this.robot.setEnabledRotations(false, true, false, true);
    this.box(0, 0, 0, 0.35, 0.14, 0.34, '#1b242b', false, this.robotMesh);
    this.box(0, 0.083, 0, 0.32, 0.02, 0.33, '#a7b6ba', false, this.robotMesh);
    this.box(
      0,
      -0.025,
      0.184,
      0.35,
      0.095,
      0.015,
      '#437ce3',
      false,
      this.robotMesh,
    );
    this.box(-0.179, 0, 0, 0.025, 0.11, 0.38, '#437ce3', false, this.robotMesh);
    this.box(0.179, 0, 0, 0.025, 0.11, 0.38, '#437ce3', false, this.robotMesh);
    for (let x of [-0.2, 0.2])
      for (let z of [-0.13, 0.13]) {
        let wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, 0.072, 0.055, 20),
          this.mat('#151e21', 0.1, 0.85),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.052, z);
        wheel.castShadow = true;
        this.robotMesh.add(wheel);
        this.wheels.push(wheel);
        for (let i = 0; i < 8; i++) {
          let roller = new THREE.Mesh(
            new THREE.CylinderGeometry(0.014, 0.014, 0.066, 8),
            this.mat('#777f7c', 0.5),
          );
          roller.rotation.x = Math.PI / 4;
          roller.position.set(
            Math.sin((i * Math.PI) / 4) * 0.058,
            0,
            Math.cos((i * Math.PI) / 4) * 0.058,
          );
          wheel.add(roller);
        }
      }
    for (let x of [-0.14, 0.14])
      for (let z of [-0.13, 0.1]) {
        this.box(
          x,
          0.16,
          z,
          0.021,
          0.21,
          0.021,
          '#9caeb5',
          false,
          this.robotMesh,
        );
      }
    this.box(
      0,
      0.235,
      -0.025,
      0.31,
      0.02,
      0.29,
      '#394851',
      false,
      this.robotMesh,
    );
    this.turret.position.y = 0.24;
    this.box(0, 0.027, 0, 0.19, 0.025, 0.23, '#a9b8b9', false, this.turret);
    for (let x of [-0.07, 0.07]) {
      this.box(
        x,
        0.067,
        -0.075,
        0.03,
        0.07,
        0.22,
        '#1c2c36',
        false,
        this.turret,
      );
    }
    this.box(0, 0.032, -0.18, 0.17, 0.04, 0.03, '#cafb63', false, this.turret);
    this.robotMesh.add(this.turret);
    let intake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.28, 16),
      this.mat('#c4f86b'),
    );
    intake.rotation.z = Math.PI / 2;
    intake.position.set(0, -0.045, -0.22);
    this.intakeRoller = intake;
    this.robotMesh.add(intake);
    this.scene.add(this.robotMesh);
  }
  spawn(color: string, x: number, y: number, z: number) {
    let body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
        .setLinearDamping(0)
        .setAngularDamping(0.02),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(R)
        .setMass(0.065)
        .setFriction(0.45)
        .setRestitution(0.34),
      body,
    );
    let mesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 16),
      this.mat(color === 'G' ? '#85cf39' : '#9050d9', 0.04, 0.34),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    let b: Ball = {
      body,
      mesh,
      color,
      state: 'free',
      previousY: y,
      wait: 0,
      side: 1,
    };
    this.balls.push(b);
    return b;
  }
  get playerSide() {
    return (this.options.robot1 ?? 0) < 2 ? 1 : -1;
  }
  get allianceName() {
    return this.playerSide === 1 ? 'Blue' : 'Red';
  }
  get selectedRamp() {
    return this.playerSide === 1 ? this.ramp : this.redRamp;
  }
  get selectedReserve() {
    return this.playerSide === 1 ? this.blueReserve : this.redReserve;
  }
  robotSpawn(id: number) {
    return [
      { x: 0.42, y: 0.14, z: 1.62 },
      { x: 1.1, y: 0.14, z: -1.2 },
      { x: -0.42, y: 0.14, z: 1.62 },
      { x: -1.1, y: 0.14, z: -1.2 },
    ][id];
  }
  styleRobot(mesh: THREE.Group, id: number) {
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.robotLabel) {
        const material = o.material as THREE.MeshStandardMaterial;
        if (
          material.color &&
          ['437ce3', 'd52e30'].includes(material.color.getHexString())
        )
          material.color.set(id < 2 ? '#437ce3' : '#d52e30');
      }
    });
    const previous = mesh.getObjectByName('robot-id');
    if (previous) {
      mesh.remove(previous);
      const m = previous as THREE.Mesh;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    const label = this.label(
      ['BLUE 1', 'BLUE 2', 'RED 1', 'RED 2'][id],
      0,
      0.43,
      0,
      0.4,
      id < 2 ? '#b4d3ff' : '#ffb4be',
      true,
    );
    if (label) {
      label.name = 'robot-id';
      label.userData.robotLabel = true;
      mesh.add(label);
    }
  }
  reset() {
    for (let b of this.balls) {
      this.world.removeRigidBody(b.body);
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.balls = [];
    this.inventory = [];
    this.ramp = [];
    this.keys.clear();
    this.yaw = 0;
    this.options.robot1 ??= 0;
    this.options.robot2 ??= 2;
    if (this.options.robot2 === this.options.robot1)
      this.options.robot2 = (this.options.robot1 + 1) % 4;
    this.robot.setTranslation(this.robotSpawn(this.options.robot1), true);
    this.styleRobot(this.robotMesh, this.options.robot1);
    this.robot.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.robot.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.robot.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let g of this.gates) {
      g.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      g.angle = 0;
      g.velocity = 0;
      g.body.setTranslation({ x: g.side * 1.47, y: 0.2, z: 0.35 }, true);
      g.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }
    this.blueReserve = [];
    this.redReserve = [];
    this.redRamp = [];
    this.motif = ['GPP', 'PGP', 'PPG'][Math.floor(Math.random() * 3)];
    for (let side of [-1, 1]) {
      for (let [row, z] of [-0.55, 0.1, 0.75].entries()) {
        const sequence = ['PPG', 'PGP', 'GPP'][row];
        for (let i = 0; i < 3; i++)
          this.spawn(sequence[i], side * (0.63 + i * 0.15), 0.08, z);
      }
      for (let i = 0; i < 3; i++)
        this.spawn('PGP'[i], side * 1.72, 0.08, 1.3 + i * 0.15);
      for (let i = 0; i < 6; i++) {
        let ball = this.spawn('PGPPGP'[i], side * 2.15, 0.12, 1.25 + i * 0.14);
        ball.state = 'reserve';
        ball.body.setEnabled(false);
        (side === 1 ? this.blueReserve : this.redReserve).push(ball);
      }
    }
    this.inventory = this.selectedReserve.splice(0, 3);
    for (const ball of this.inventory) {
      ball.state = 'held';
      ball.mesh.visible = false;
    }
    this.secondIntake = false;
    this.secondFlywheel = 0;
    this.secondReverseClock = 0;
    this.secondPadButtons = [];
    const remaining = [0, 1, 2, 3].filter(
      (id) => id !== this.options.robot1 && id !== this.options.robot2,
    );
    const ids = [remaining[0], this.options.robot2, remaining[1]];
    for (const [i, bot] of this.bots.entries()) {
      const id = ids[i];
      bot.side = id < 2 ? 1 : -1;
      bot.body.setEnabled(true);
      bot.mesh.visible = true;
      bot.inventory = [];
      bot.cooldown = 0;
      bot.yaw = 0;
      bot.gate = false;
      bot.body.setTranslation(this.robotSpawn(id), true);
      bot.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      bot.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bot.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.styleRobot(bot.mesh, id);
      if (this.options.players === 2 && i === 1) {
        bot.inventory = (
          bot.side === 1 ? this.blueReserve : this.redReserve
        ).splice(0, 3);
        for (const ball of bot.inventory) {
          ball.state = 'held';
          ball.mesh.visible = false;
        }
      }
    }
    if (this.gateMarker) this.gateMarker.position.x = -this.playerSide * 1.25;
    this.flywheel = 0;
    this.fireRequested = false;
    this.reverseClock = 0;
    this.settleClock = 0;
    Object.assign(this.s, {
      intake: false,
      breakdown: [0, 1].map(() => ({
        autoArtifacts: 0,
        autoPattern: 0,
        leave: 0,
        teleopArtifacts: 0,
        teleopPattern: 0,
        base: 0,
      })),
      score: 0,
      classified: 0,
      overflow: 0,
      pattern: 0,
      speed: 0,
      time: 120,
      phase: 'MANUAL',
      motif: this.motif,
      redScore: 0,
      running: false,
      started: false,
      gate: 0,
      nearGate: false,
      message: `${this.allianceName} robot selected. R / L1 intake · Space / R2 shoot.`,
      shots: 0,
      hits: 0,
      ended: false,
    });
    this.shotClock = 0;
    this.accum = 0;
    this.emit();
  }
  toggleIntake() {
    if (!this.s.running || (this.options.timed && this.s.phase !== 'MANUAL'))
      return;
    this.s.intake = !this.s.intake;
    this.s.message = this.s.intake
      ? 'Intake on · approach artifacts with the front roller'
      : 'Intake off';
    this.emit();
  }
  configure(v: Partial<Options>) {
    this.options = { ...this.options, ...v };
    this.options.robot1 = Math.max(
      0,
      Math.min(3, Math.floor(this.options.robot1 ?? 0)),
    );
    this.options.robot2 = Math.max(
      0,
      Math.min(3, Math.floor(this.options.robot2 ?? 2)),
    );
    if (this.options.robot2 === this.options.robot1)
      this.options.robot2 = (this.options.robot1 + 1) % 4;
    this.options.power = Math.max(3, Math.min(11, this.options.power));
    this.options.elevation = Math.max(
      25,
      Math.min(75, this.options.elevation || 55),
    );
    this.emit();
  }
  press(k: string, v: boolean) {
    if (v) this.keys.add(k);
    else this.keys.delete(k);
  }
  keydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement;
    const editing = !!target?.closest(
      'textarea, input:not([type="checkbox"]):not([type="range"]):not([type="radio"]), [contenteditable="true"]',
    );
    const adjusting = !!target?.closest(
      '[role="switch"],[role="slider"],input[type="checkbox"],input[type="range"],input[type="radio"],select',
    );
    if (controlOwnsKey(e.code, editing, adjusting)) return;
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'KeyF',
        'KeyQ',
        'KeyE',
      ].includes(e.code)
    )
      e.preventDefault();
    if (
      this.options.players === 2 &&
      ['Slash', 'Comma', 'Period'].includes(e.code)
    )
      e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'KeyI') this.toggleSecondIntake();
      if (e.code === 'Enter') this.toggle();
      if (e.code === 'KeyR') this.toggleIntake();
      if (e.code === 'KeyH') this.loadArtifact();
      if (e.code === 'KeyC')
        this.options.view =
          this.options.view === 'Field'
            ? 'Follow'
            : this.options.view === 'Follow'
              ? 'Top'
              : 'Field';
      if (e.code === 'Escape' && this.s.running) this.toggle();
    }
    this.keys.add(e.code);
  }
  keyup = (e: KeyboardEvent) => this.keys.delete(e.code);
  blur = () => {
    this.keys.clear();
    if (this.s.running) {
      this.s.running = false;
      this.s.message = 'Paused while the game is unfocused.';
      this.emit();
    }
  };
  visibility = () => {
    if (document.hidden) this.blur();
  };
  toggle() {
    if (this.s.ended) return;
    this.s.running = !this.s.running;
    if (this.s.running) this.s.started = true;
    this.keys.clear();
    if (this.s.running) {
      if (!this.audio && this.options.sound) {
        try {
          this.audio = new AudioContext();
        } catch {}
      }
      this.audio?.resume().catch(() => {});
      this.s.message = `${this.allianceName} controls active. R / L1 intake · Space / R2 shoot · F / Square gate.`;
    } else this.s.message = 'Paused · Enter to resume';
    this.emit();
  }
  sound(freq = 450) {
    if (!this.options.sound || !this.audio) return;
    let o = this.audio.createOscillator(),
      gain = this.audio.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, this.audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.55,
      this.audio.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.06, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.audio.currentTime + 0.15,
    );
    o.connect(gain).connect(this.audio.destination);
    o.start();
    o.stop(this.audio.currentTime + 0.16);
  }
  getLaunch() {
    let p = this.robot.translation();
    let yaw = this.options.assist
      ? Math.atan2(-(-this.playerSide * 1.55 - p.x), -(-1.59 - p.z))
      : this.yaw;
    let x = p.x - Math.sin(yaw) * 0.23,
      z = p.z - Math.cos(yaw) * 0.23;
    let start = { x, y: p.y + 0.27, z };
    let velocity = this.options.assist
      ? launchVelocity(start, {
          x: -this.playerSide * 1.55,
          y: 1.055,
          z: -1.59,
        })
      : manualLaunch(this.options.power, this.options.elevation || 55, yaw, {
          x: this.robot.linvel().x + this.robot.angvel().y * (z - p.z),
          z: this.robot.linvel().z - this.robot.angvel().y * (x - p.x),
        });
    // Assisted turret compensates platform motion through relative exit velocity.
    // Ballistic world velocity remains unchanged; manual shots inherit chassis motion.
    return { start, velocity, yaw };
  }
  shoot() {
    if (this.options.timed && this.s.phase !== 'MANUAL') return;
    if (!this.s.running || !this.inventory.length || this.shotClock > 0) return;
    let p = this.robot.translation();
    if (!inLaunchZone(p.x, p.z)) {
      this.s.message = 'Move into a taped launch triangle before shooting.';
      this.emit();
      return;
    }
    this.fireRequested = true;
    if (this.flywheel < 0.94) {
      this.s.message = 'Flywheel spinning up…';
      return;
    }
    this.fireRequested = false;
    let b = this.inventory.shift()!,
      { start, velocity } = this.getLaunch();
    b.state = 'flight';
    b.owner = 1;
    b.previousY = start.y;
    b.body.setEnabled(true);
    b.body.setTranslation(start, true);
    b.body.setLinvel(velocity, true);
    b.body.setAngvel({ x: 10, y: 0, z: 0 }, true);
    b.mesh.visible = true;
    const chassis = this.robot.linvel(),
      omega = this.robot.angvel().y;
    const muzzle = {
      x: chassis.x + omega * (start.z - p.z),
      z: chassis.z - omega * (start.x - p.x),
    };
    this.robot.applyImpulseAtPoint(
      {
        x: -(velocity.x - muzzle.x) * b.body.mass(),
        y: 0,
        z: -(velocity.z - muzzle.z) * b.body.mass(),
      },
      start,
      true,
    );
    this.flywheel = Math.max(0, this.flywheel - 0.16);
    this.shotClock = 0.35;
    this.s.shots++;
    this.sound(350);
    this.s.message = 'Artifact launched';
    this.emit();
  }
  step(advanceClock = true) {
    const connected = Array.from(navigator.getGamepads?.() || []).filter(
      (p): p is Gamepad => !!p && p.connected && p.mapping === 'standard',
    );
    this.controllerSlots ??= [];
    for (const [i, p] of connected.entries()) {
      const id = p.index ?? i;
      if (!this.controllerSlots.includes(id) && this.controllerSlots.length < 2)
        this.controllerSlots.push(id);
    }
    const pads = this.controllerSlots.map((id) =>
      connected.find((p, i) => (p.index ?? i) === id),
    );
    const pad = pads[0];
    this.s.controller = pad
      ? pad.mapping === 'standard'
        ? 'Controller connected'
        : 'Nonstandard controller · use keyboard'
      : '';
    let axes = pad?.mapping === 'standard' ? pad.axes : [],
      buttons = pad?.mapping === 'standard' ? pad.buttons : [];
    if (buttons[4]?.pressed && !this.padButtons[4]) this.toggleIntake();
    if (buttons[9]?.pressed && !this.padButtons[9]) this.toggle();
    if (buttons[3]?.pressed && !this.padButtons[3])
      this.options.view =
        this.options.view === 'Field'
          ? 'Follow'
          : this.options.view === 'Follow'
            ? 'Top'
            : 'Field';
    const secondButtons = pads[1]?.buttons || [];
    if (this.options.players === 2) {
      if (secondButtons[4]?.pressed && !this.secondPadButtons?.[4])
        this.toggleSecondIntake();
      if (secondButtons[9]?.pressed && !this.secondPadButtons?.[9])
        this.toggle();
      if (secondButtons[3]?.pressed && !this.secondPadButtons?.[3])
        this.options.view =
          this.options.view === 'Field'
            ? 'Follow'
            : this.options.view === 'Follow'
              ? 'Top'
              : 'Field';
    }
    this.secondPadButtons = secondButtons.map((b) => b.pressed);
    this.padButtons = buttons.map((b) => b.pressed);
    if (!this.s.running) return;
    this.shotClock = Math.max(0, this.shotClock - DT);
    this.reverseClock = Math.max(0, this.reverseClock - DT);
    this.adjustmentClock = Math.max(0, (this.adjustmentClock || 0) - DT);
    const canDrive = !this.options.timed || this.s.phase === 'MANUAL';
    if (canDrive && !this.options.assist && this.adjustmentClock === 0) {
      const power =
        Number(this.keys.has('Equal') || buttons[15]?.pressed) -
        Number(this.keys.has('Minus') || buttons[14]?.pressed);
      const angle =
        Number(this.keys.has('BracketRight') || buttons[12]?.pressed) -
        Number(this.keys.has('BracketLeft') || buttons[13]?.pressed);
      if (power || angle) {
        this.configure({
          power: this.options.power + power * 0.2,
          elevation: (this.options.elevation || 55) + angle * 2,
        });
        this.adjustmentClock = 0.12;
      }
    }
    this.flywheel +=
      ((this.inventory.length && canDrive ? 1 : 0) - this.flywheel) *
      (1 - Math.exp(-DT / 0.22));
    if (this.fireRequested && canDrive) this.shoot();
    if (canDrive && (this.keys.has('KeyB') || buttons[1]?.pressed))
      this.reverseIntake();
    if (this.options.players === 2)
      this.updateSecondPlayer(pads[1] || undefined);
    let left = Number(
        this.keys.has('KeyA') ||
          (this.options.players !== 2 && this.keys.has('ArrowLeft')),
      ),
      right = Number(
        this.keys.has('KeyD') ||
          (this.options.players !== 2 && this.keys.has('ArrowRight')),
      ),
      up = Number(
        this.keys.has('KeyW') ||
          (this.options.players !== 2 && this.keys.has('ArrowUp')),
      ),
      down = Number(
        this.keys.has('KeyS') ||
          (this.options.players !== 2 && this.keys.has('ArrowDown')),
      );
    let x = right - left + deadzone(axes[0] || 0),
      z = down - up + deadzone(axes[1] || 0);
    if (!canDrive) {
      x = 0;
      z = 0;
    }
    if (canDrive && this.options.view === 'Follow') {
      const c = Math.cos(this.yaw),
        s = Math.sin(this.yaw);
      const worldX = x * c + z * s;
      z = -x * s + z * c;
      x = worldX;
    }
    let len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    let turn =
      Number(this.keys.has('KeyQ')) -
      Number(this.keys.has('KeyE')) -
      deadzone(axes[2] || 0);
    if (!canDrive) turn = 0;
    const demand = mecanumDemand(x, z, turn, this.yaw);
    x = demand.x;
    z = demand.z;
    turn = demand.turn;
    let precision =
      this.keys.has('ShiftLeft') ||
      (this.options.players !== 2 && this.keys.has('ShiftRight')) ||
      (buttons[6]?.value || 0) > 0.2;
    let p = this.robot.translation(),
      vel = this.robot.linvel();
    let impulse = driveImpulse(
      vel,
      { x: x * (precision ? 0.45 : 1.65), z: z * (precision ? 0.45 : 1.65) },
      this.robot.mass(),
      DT,
    );
    if (p.y < 0.22)
      this.robot.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    const angular = this.robot.angvel(),
      targetTurn = turn * (precision ? 0.85 : 2.4),
      inertia = (this.robot.mass() * 0.38 * 0.38) / 6;
    this.robot.applyTorqueImpulse(
      {
        x: 0,
        y: Math.max(
          -inertia * 8 * DT,
          Math.min(
            inertia * 8 * DT,
            (targetTurn - angular.y) * inertia * (1 - Math.exp(-DT / 0.1)),
          ),
        ),
        z: 0,
      },
      true,
    );
    let q = this.robot.rotation();
    this.yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.z * q.z),
    );
    this.s.inZone = inLaunchZone(p.x, p.z);
    this.s.speed = Math.hypot(vel.x, vel.z);
    if (
      canDrive &&
      (this.keys.has('Space') || buttons[7]?.pressed || buttons[0]?.pressed)
    )
      this.shoot();
    this.s.gateDistance = gateReach(
      p.x * this.playerSide,
      p.z,
      this.yaw * this.playerSide,
    );
    this.s.nearGate = this.s.gateDistance <= 0.16;
    const wantsGate = this.keys.has('KeyF') || buttons[2]?.pressed;
    this.s.gatePrompt = !canDrive
      ? 'Gate control is unavailable after time expires'
      : this.s.nearGate
        ? wantsGate
          ? 'Opening gate · keep holding F / Square'
          : `Hold F / Square to open ${this.allianceName} gate`
        : `${this.allianceName} gate · ${Math.max(0, this.s.gateDistance - 0.16).toFixed(1)} m away`;
    if (wantsGate && !this.s.nearGate) {
      this.s.message =
        `Approach the marked ${this.allianceName} gate. ` + this.s.gatePrompt;
    }
    for (let g of this.gates) {
      let pushing =
        (canDrive &&
          g.side === -this.playerSide &&
          this.s.nearGate &&
          (this.keys.has('KeyF') || buttons[2]?.pressed)) ||
        this.bots.some((bot) => bot.gate && -bot.side === g.side);
      const acceleration =
        (pushing ? 6 : 0) - 1.6 * Math.cos(g.angle) - 5 * g.velocity;
      g.velocity += acceleration * DT;
      g.angle = Math.max(0, Math.min(0.55, g.angle + g.velocity * DT));
      if (g.angle === 0 || g.angle === 0.55) g.velocity = 0;
      g.body.setNextKinematicTranslation({ x: g.side * 1.47, y: 0.2, z: 0.35 });
      g.body.setNextKinematicRotation({
        x: 0,
        y: 0,
        z: Math.sin((g.side * g.angle) / 2),
        w: Math.cos(g.angle / 2),
      });
      if (g.side === -this.playerSide) this.s.gate = g.angle / 0.55;
    }
    for (const b of this.balls) {
      if (!b.body.isEnabled() || b.body.isSleeping()) continue;
      const v = b.body.linvel(),
        d = dragDelta(v, DT),
        mass = b.body.mass();
      b.body.applyImpulse(
        { x: d.x * mass, y: d.y * mass, z: d.z * mass },
        false,
      );
    }
    this.world.step();
    for (let b of this.balls) {
      if (b.state === 'held' || b.state === 'reserve') continue;
      let pos = b.body.translation();
      if (b.state === 'transit') {
        b.wait -= DT;
        if (b.wait <= 0) {
          b.body.setEnabled(true);
          b.body.setTranslation({ x: b.side * 1.61, y: 0.87, z: -1.03 }, true);
          b.body.setLinvel({ x: 0, y: 0, z: 0.18 }, true);
          b.mesh.visible = true;
          b.state = 'ramp';
        }
        continue;
      }
      if (
        b.state === 'flight' &&
        b.previousY > 1.01 &&
        pos.y <= 1.01 &&
        b.body.linvel().y < 0
      ) {
        for (let side of [-1, 1]) {
          let u = (pos.x - side * 1.46) * side,
            v = pos.z + 1.49;
          if (u > -0.22 && u < 0.22 && v > -0.22 && v < 0.22 && v < u - 0.035) {
            b.side = side;
            b.state = 'transit';
            b.wait = 0.5;
            b.body.setEnabled(false);
            b.mesh.visible = false;
            const rack = side === -1 ? this.ramp : this.redRamp;
            if (b.owner === 1 && side === -this.playerSide) this.s.hits++;
            const retained = rack.length < 9;
            if (retained) {
              rack.push(b);
              if (side === -this.playerSide) this.s.classified++;
            } else {
              if (side === -this.playerSide) this.s.overflow++;
              b.state = 'free';
              b.body.setEnabled(true);
              b.body.setTranslation({ x: side * 1.61, y: 0.25, z: 0.55 }, true);
              b.body.setLinvel({ x: 0, y: 0, z: 0.5 }, true);
              b.mesh.visible = true;
            }
            this.award(
              side === -1 ? 0 : 1,
              'teleopArtifacts',
              retained ? 3 : 1,
            );
            this.s.message = retained
              ? 'Artifact classified · +3'
              : 'Overflow · +1 — clear the gate';
            this.sound(800);

            break;
          }
        }
      }
      b.previousY = pos.y;
      if (b.state === 'flight' && pos.y < 0.1) b.state = 'free';
      // A released ball can settle on the floor immediately below the lip.
      // Count physical departure from the deck, even without forward momentum.
      if (
        b.state === 'ramp' &&
        (pos.z > 0.48 || (pos.z > 0.278 && pos.y < 0.13))
      ) {
        b.state = 'free';
        this.ramp = this.ramp.filter((v) => v !== b);
        this.redRamp = this.redRamp.filter((v) => v !== b);
        this.s.message =
          'Gate released an artifact. Collect it from the return lane.';
      }
      if (canDrive)
        this.captureArtifact(
          b,
          this.robot,
          this.yaw,
          this.inventory,
          !!this.s.intake,
          1,
        );
      if (pos.y < -0.5 || Math.abs(pos.x) > 2.25 || Math.abs(pos.z) > 2.25) {
        this.ramp = this.ramp.filter((v) => v !== b);
        this.redRamp = this.redRamp.filter((v) => v !== b);
        b.state = 'reserve';
        b.body.setEnabled(false);
        b.mesh.visible = true;
        const side = pos.x < 0 ? -1 : 1;
        (side === 1 ? this.blueReserve : this.redReserve).push(b);
        b.mesh.position.set(side * 2.15, 0.12, 1.25);
        this.s.message =
          'Out-of-field artifact returned to the human-player tray.';
      }
    }
    if (this.options.timed && advanceClock) this.advanceMatch();
  }

  tick = (t: number) => {
    if (this.disposed) return;
    const wallElapsed = this.last ? Math.max(0, (t - this.last) / 1000) : 0;
    let elapsed = Math.min(wallElapsed, 0.1);
    this.last = t;
    this.accum += elapsed;
    while (this.accum >= DT) {
      this.step(false);
      this.accum -= DT;
    }
    if (this.s.running && this.options.timed) this.advanceMatch(wallElapsed);
    let p = this.robot.translation(),
      q = this.robot.rotation();
    this.robotMesh.position.set(p.x, p.y, p.z);
    this.robotMesh.quaternion.set(q.x, q.y, q.z, q.w);
    for (let w of this.wheels) w.rotation.x += (this.s.speed * elapsed) / 0.07;
    if (this.gateMarker) {
      const mat = this.gateMarker.material as THREE.MeshBasicMaterial;
      mat.color.set(
        this.s.nearGate
          ? '#cafb63'
          : this.playerSide === 1
            ? '#87a8ef'
            : '#f18c95',
      );
      mat.opacity = this.s.nearGate ? 0.85 : 0.5;
    }
    let shot = this.getLaunch();
    this.turret.rotation.y = shot.yaw - this.yaw;
    if (this.intakeRoller)
      this.intakeRoller.rotation.x +=
        this.s.running && this.s.intake ? elapsed * 35 : 0;
    for (const bot of this.bots) {
      let p = bot.body.translation(),
        q = bot.body.rotation();
      bot.mesh.position.set(p.x, p.y, p.z);
      bot.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (let b of this.balls) {
      if (b.state === 'reserve') continue;
      if (b.state === 'held') {
        const bot = this.bots.find((v) => v.inventory.includes(b));
        const owner = bot?.body || this.robot;
        const inventory = bot?.inventory || this.inventory;
        let local = new THREE.Vector3(
          (inventory.indexOf(b) - 1) * 0.1,
          0.16,
          0.035,
        );
        let q = owner.rotation(),
          p = owner.translation();
        local
          .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w))
          .add(new THREE.Vector3(p.x, p.y, p.z));
        b.mesh.visible = !bot || bot.mesh.visible;
        b.mesh.position.copy(local);
        continue;
      }
      if (!b.mesh.visible) continue;
      let p = b.body.translation(),
        q = b.body.rotation();
      b.mesh.position.set(p.x, p.y, p.z);
      b.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (let g of this.gates) {
      let p = g.body.translation(),
        q = g.body.rotation();
      g.mesh.position.set(p.x, p.y, p.z);
      g.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
    this.trajectory.visible = this.inventory.length > 0 && this.s.inZone;
    if (this.trajectory.visible) {
      let points = [];
      for (let i = 0; i < 40; i++) {
        const point = flightAt(shot.start, shot.velocity, i * 0.027);
        if (point.y < 0.03) break;
        points.push(new THREE.Vector3(point.x, point.y, point.z));
      }
      this.trajectory.geometry.dispose();
      this.trajectory.geometry = new THREE.BufferGeometry().setFromPoints(
        points,
      );
      this.trajectory.computeLineDistances();
    }
    let target = new THREE.Vector3(0, 0.15, -0.12),
      cam = new THREE.Vector3(0, 5.5, 5.7);
    if (this.options.view === 'Top') {
      cam.set(0, 6.6, 0.01);
    }
    if (this.options.view === 'Follow') {
      cam.set(
        p.x + Math.sin(this.yaw) * 2.1,
        p.y + 1.6,
        p.z + Math.cos(this.yaw) * 2.1,
      );
      target.set(p.x, 0.25, p.z - 0.3);
    }
    this.camera.position.lerp(cam, 1 - Math.exp(-elapsed * 4));
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
    this.uiClock += elapsed;
    if (this.uiClock > 0.1) {
      this.emit();
      this.uiClock = 0;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  emit() {
    this.s.robot1 = this.options.robot1 ?? 0;
    this.s.robot2 = this.options.robot2 ?? 2;
    this.s.alliance = this.allianceName;
    this.s.players = this.options.players || 1;
    if (this.options.players === 2 && this.bots[1]) {
      const b = this.bots[1],
        p = b.body.translation();
      this.s.player2 = {
        magazine: b.inventory.map((v) => v.color),
        intake: this.secondIntake,
        speed: Math.hypot(b.body.linvel().x, b.body.linvel().z),
        gate: (this.gates.find((g) => g.side === -b.side)?.angle || 0) / 0.55,
        nearGate: gateReach(p.x * b.side, p.z, b.yaw * b.side) <= 0.16,
        controller: this.secondPadButtons.length ? 'Controller 2' : 'Keyboard',
      };
    } else this.s.player2 = undefined;
    this.s.flywheel = Math.round(this.flywheel * 100);
    this.s.elevation = this.options.elevation || 55;
    this.s.power = this.options.power;
    this.s.assist = this.options.assist;
    const launch = this.getLaunch();
    this.s.goalDistance = Math.hypot(
      -this.playerSide * 1.55 - launch.start.x,
      -1.59 - launch.start.z,
    );
    const v = launch.velocity;
    this.s.shotRange = shotRange(
      Math.hypot(v.x, v.y, v.z),
      (Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI,
      launch.start.y,
    );
    this.s.reserve = this.selectedReserve.length;
    this.s.motif = this.motif;
    this.s.view = this.options.view;
    this.s.magazine = this.inventory.map((b) => b.color);
    this.s.ramp = this.selectedRamp.map((b) => b.color);
    this.cb({
      ...this.s,
      magazine: [...this.s.magazine],
      ramp: [...this.s.ramp],
    });
  }
  resizeCanvas() {
    let w = this.el.clientWidth,
      h = this.el.clientHeight;
    if (w && h) {
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }
  buildBots() {
    for (const side of [1, -1, -1]) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setLinearDamping(0.1)
          .setAngularDamping(4)
          .setCcdEnabled(true),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.19, 0.11, 0.19)
          .setMass(14)
          .setFriction(0.04)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
        body,
      );
      body.setEnabledRotations(false, true, false, true);
      const mesh = this.robotMesh.clone(true);
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material = (o.material as THREE.MeshStandardMaterial).clone();
          let m = o.material as THREE.MeshStandardMaterial;
          if (side === -1 && m.color.getHexString() === '437ce3')
            m.color.set('#d52e30');
        }
      });
      this.scene.add(mesh);
      body.setEnabled(false);
      mesh.visible = false;
      this.bots.push({
        body,
        mesh,
        inventory: [],
        side,
        cooldown: 1,
        yaw: 0,
        gate: false,
      });
    }
  }
  captureArtifact(
    b: Ball,
    body: RAPIER.RigidBody,
    yaw: number,
    inventory: Ball[],
    enabled: boolean,
    owner: number,
  ) {
    if (b.state !== 'free') return;
    const p = body.translation(),
      pos = b.body.translation();
    const dx = pos.x - p.x,
      dz = pos.z - p.z,
      forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw),
      lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    if (
      !enabled ||
      inventory.length >= 3 ||
      pos.y > 0.17 ||
      forward < 0.16 ||
      forward > 0.43 ||
      Math.abs(lateral) > 0.18
    ) {
      if (b.owner === owner) b.capture = 0;
      return;
    }
    b.owner = owner;
    // Intake rollers impart a bounded force only within the front mouth.
    const target = {
      x: p.x - Math.sin(yaw) * 0.24,
      z: p.z - Math.cos(yaw) * 0.24,
    };
    const v = b.body.linvel();
    b.body.applyImpulse(
      {
        x: ((target.x - pos.x) * 8 - v.x) * 0.006,
        y: 0,
        z: ((target.z - pos.z) * 8 - v.z) * 0.006,
      },
      true,
    );
    if (forward < 0.32 && Math.abs(lateral) < 0.145) {
      b.capture = (b.capture || 0) + DT;
      if (b.capture > 0.16) {
        b.capture = 0;
        b.state = 'held';
        b.body.setEnabled(false);
        inventory.push(b);
        if (body === this.robot) {
          this.s.message = `Intaked ${b.color === 'G' ? 'green' : 'purple'} artifact · ${inventory.length}/3`;
          this.sound(520);
        }
      }
    }
  }
  reverseIntake() {
    if (this.options.timed && this.s.phase !== 'MANUAL') return;
    if (!this.s.running || !this.inventory.length || this.reverseClock > 0)
      return;
    this.s.intake = false;
    this.fireRequested = false;
    const b = this.inventory.pop()!,
      p = this.robot.translation();
    b.state = 'free';
    b.capture = 0;
    b.body.setEnabled(true);
    b.body.setTranslation(
      {
        x: p.x - Math.sin(this.yaw) * 0.31,
        y: 0.085,
        z: p.z - Math.cos(this.yaw) * 0.31,
      },
      true,
    );
    b.body.setLinvel(
      { x: -Math.sin(this.yaw) * 0.45, y: 0, z: -Math.cos(this.yaw) * 0.45 },
      true,
    );
    b.mesh.visible = true;
    this.reverseClock = 0.45;
    this.s.message = 'Intake reversed · artifact ejected';
  }
  loadArtifact() {
    if (
      !this.s.running ||
      (this.options.timed && this.s.phase !== 'MANUAL') ||
      !this.selectedReserve.length
    )
      return;
    const p = this.robot.translation();
    if (p.x * this.playerSide > 1.02 && p.z > 1.02) {
      this.s.message = 'Clear your loading zone before the human player feeds.';
      return;
    }
    const b = this.selectedReserve.shift()!;
    b.state = 'free';
    b.body.setEnabled(true);
    b.body.setTranslation({ x: this.playerSide * 1.69, y: 0.08, z: 1.6 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.mesh.visible = true;
    this.s.message = 'Human player placed one artifact in your loading zone';
    this.emit();
  }
  toggleSecondIntake() {
    if (
      this.options.players === 2 &&
      this.s.running &&
      (!this.options.timed || this.s.phase === 'MANUAL')
    ) {
      this.secondIntake = !this.secondIntake;
      this.emit();
    }
  }
  updateSecondPlayer(pad?: Gamepad) {
    const bot = this.bots[1];
    if (!bot?.body.isEnabled()) return;
    const active = !this.options.timed || this.s.phase === 'MANUAL';
    const axes = pad?.axes || [],
      buttons = pad?.buttons || [];
    if (active && !this.options.assist && this.adjustmentClock === 0) {
      const power =
          Number(!!buttons[15]?.pressed) - Number(!!buttons[14]?.pressed),
        elevation =
          Number(!!buttons[12]?.pressed) - Number(!!buttons[13]?.pressed);
      if (power || elevation) {
        this.configure({
          power: this.options.power + power * 0.2,
          elevation: (this.options.elevation || 55) + elevation * 2,
        });
        this.adjustmentClock = 0.12;
      }
    }
    const p = bot.body.translation(),
      q = bot.body.rotation();
    bot.yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.z * q.z),
    );
    bot.cooldown = Math.max(0, bot.cooldown - DT);
    this.secondReverseClock = Math.max(0, this.secondReverseClock - DT);
    this.secondFlywheel +=
      ((active && bot.inventory.length ? 1 : 0) - this.secondFlywheel) *
      (1 - Math.exp(-DT / 0.22));
    if (!active) this.secondIntake = false;
    let x = active
      ? Number(this.keys.has('ArrowRight')) -
        Number(this.keys.has('ArrowLeft')) +
        deadzone(axes[0] || 0)
      : 0;
    let z = active
      ? Number(this.keys.has('ArrowDown')) -
        Number(this.keys.has('ArrowUp')) +
        deadzone(axes[1] || 0)
      : 0;
    let turn = active
      ? Number(this.keys.has('Comma')) -
        Number(this.keys.has('Period')) -
        deadzone(axes[2] || 0)
      : 0;
    const magnitude = Math.max(1, Math.hypot(x, z));
    x /= magnitude;
    z /= magnitude;
    if (this.options.view === 'Follow') {
      const c = Math.cos(this.yaw),
        ss = Math.sin(this.yaw),
        xx = x * c + z * ss;
      z = -x * ss + z * c;
      x = xx;
    }
    const demand = mecanumDemand(x, z, turn, bot.yaw);
    const precision =
      this.keys.has('ShiftRight') || (buttons[6]?.value || 0) > 0.2;
    const impulse = driveImpulse(
      bot.body.linvel(),
      {
        x: demand.x * (precision ? 0.45 : 1.65),
        z: demand.z * (precision ? 0.45 : 1.65),
      },
      bot.body.mass(),
      DT,
    );
    if (p.y < 0.22)
      bot.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
    const inertia = (bot.body.mass() * 0.38 * 0.38) / 6;
    bot.body.applyTorqueImpulse(
      {
        x: 0,
        y: Math.max(
          -inertia * 8 * DT,
          Math.min(
            inertia * 8 * DT,
            (demand.turn * (precision ? 0.85 : 2.4) - bot.body.angvel().y) *
              inertia *
              (1 - Math.exp(-DT / 0.1)),
          ),
        ),
        z: 0,
      },
      true,
    );
    bot.gate =
      active &&
      gateReach(p.x * bot.side, p.z, bot.yaw * bot.side) <= 0.16 &&
      (this.keys.has('KeyO') || !!buttons[2]?.pressed);
    if (active)
      for (const b of this.balls)
        this.captureArtifact(
          b,
          bot.body,
          bot.yaw,
          bot.inventory,
          this.secondIntake,
          3,
        );
    const reverse = active && (this.keys.has('KeyU') || buttons[1]?.pressed);
    const shoot =
      active &&
      (this.keys.has('Slash') || buttons[7]?.pressed || buttons[0]?.pressed);
    if (reverse && bot.inventory.length && this.secondReverseClock === 0) {
      const b = bot.inventory.shift()!;
      const forward = { x: -Math.sin(bot.yaw), z: -Math.cos(bot.yaw) };
      b.state = 'free';
      b.body.setEnabled(true);
      b.mesh.visible = true;
      b.body.setTranslation(
        { x: p.x + forward.x * 0.3, y: 0.09, z: p.z + forward.z * 0.3 },
        true,
      );
      b.body.setLinvel(
        { x: forward.x * 0.75, y: 0.1, z: forward.z * 0.75 },
        true,
      );
      this.secondReverseClock = 0.4;
    } else if (
      shoot &&
      bot.inventory.length &&
      bot.cooldown === 0 &&
      this.secondFlywheel > 0.86 &&
      inLaunchZone(p.x, p.z)
    ) {
      const yaw = this.options.assist
        ? Math.atan2(-(-bot.side * 1.55 - p.x), -(-1.59 - p.z))
        : bot.yaw;
      const start = {
        x: p.x - Math.sin(yaw) * 0.23,
        y: p.y + 0.27,
        z: p.z - Math.cos(yaw) * 0.23,
      };
      const chassis = bot.body.linvel(),
        omega = bot.body.angvel().y;
      const muzzle = {
        x: chassis.x + omega * (start.z - p.z),
        z: chassis.z - omega * (start.x - p.x),
      };
      const velocity = this.options.assist
        ? launchVelocity(start, { x: -bot.side * 1.55, y: 1.055, z: -1.59 })
        : manualLaunch(
            this.options.power,
            this.options.elevation || 55,
            yaw,
            muzzle,
          );
      const b = bot.inventory.shift()!;
      b.state = 'flight';
      b.owner = 3;
      b.previousY = start.y;
      b.body.setEnabled(true);
      b.body.setTranslation(start, true);
      b.body.setLinvel(velocity, true);
      b.mesh.visible = true;
      bot.body.applyImpulseAtPoint(
        {
          x: -(velocity.x - muzzle.x) * b.body.mass(),
          y: 0,
          z: -(velocity.z - muzzle.z) * b.body.mass(),
        },
        start,
        true,
      );
      bot.cooldown = 0.35;
      this.secondFlywheel = Math.max(0, this.secondFlywheel - 0.16);
    }
  }

  award(alliance: 0 | 1, category: keyof ScoreDetail, points: number) {
    if (this.s.breakdown) this.s.breakdown[alliance][category] += points;
    if (alliance === 0) this.s.score += points;
    else this.s.redScore = (this.s.redScore || 0) + points;
  }
  advanceMatch(dt = DT) {
    if (this.s.phase === 'COMPLETE') return;
    this.s.time = Math.max(0, this.s.time - dt);
    if (this.s.time > 0) return;
    if (this.s.phase === 'MANUAL') {
      this.s.phase = 'SETTLING';
      this.s.intake = false;
      this.fireRequested = false;
      this.settleClock = 0;
      this.keys.clear();
      this.s.message =
        'Time expired · motors disabled, waiting for artifacts to settle';
      return;
    }
    if (this.s.phase === 'SETTLING') {
      this.settleClock += dt;
      const moving = this.balls.some(
        (b) =>
          b.state === 'transit' ||
          ((b.state === 'flight' || b.state === 'ramp' || b.state === 'free') &&
            Math.hypot(
              b.body.linvel().x,
              b.body.linvel().y,
              b.body.linvel().z,
            ) > 0.08),
      );
      if (this.settleClock < 2 || (moving && this.settleClock < 15)) return;
      this.s.pattern = patternPoints(
        this.ramp.map((b) => b.color),
        this.motif,
      );
      this.award(0, 'teleopPattern', this.s.pattern);
      this.award(
        1,
        'teleopPattern',
        patternPoints(
          this.redRamp.map((b) => b.color),
          this.motif,
        ),
      );
      let blueFull = 0,
        redFull = 0;
      for (const actor of [
        { body: this.robot, side: this.playerSide },
        ...(this.options.players === 2 ? [this.bots[1]] : []),
      ]) {
        const p = actor.body.translation(),
          q = actor.body.rotation(),
          yaw = Math.atan2(2 * q.w * q.y, 1 - 2 * q.y * q.y),
          points = basePoints(p.x, p.z, yaw, actor.side);
        if (actor.side === 1) {
          this.award(0, 'base', points);
          if (points === 10) blueFull++;
        } else {
          this.award(1, 'base', points);
          if (points === 10) redFull++;
        }
      }
      if (blueFull === 2) this.award(0, 'base', 10);
      if (redFull === 2) this.award(1, 'base', 10);
      this.s.ended = true;
      this.s.running = false;
      this.s.phase = 'COMPLETE';
      this.s.message = `Match practice complete · Blue ${this.s.score} / Red ${this.s.redScore}`;
      this.emit();
    }
  }

  registerTools() {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => unknown };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    for (let tool of [
      {
        name: 'read_practice_state',
        description:
          'Read the visible robot practice score, magazine, ramp, and clock.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({ ...this.s }),
      },
      {
        name: 'set_practice_running',
        description: 'Start or pause the same simulation shown on screen.',
        inputSchema: {
          type: 'object',
          properties: { running: { type: 'boolean' } },
          required: ['running'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (v: unknown) => {
          if (!v || typeof (v as { running?: unknown }).running !== 'boolean')
            throw Error('running must be boolean');
          if (this.s.ended)
            throw Error('Session complete. Reset the field first.');
          if (this.s.running !== (v as { running: boolean }).running)
            this.toggle();
          return { running: this.s.running };
        },
      },
    ]) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: this.contextLife.signal }),
        ).catch(() => {});
      } catch {}
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.contextLife.abort();
    this.world.free();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        for (let m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('map' in m) (m.map as THREE.Texture | null)?.dispose();
          m.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.audio?.close();
  }
}

import * as THREE from 'three';
import { bioTagTexture } from './biobuzz-tags';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { driveImpulse, deadzone, turretStep, mecanumDemand } from './physics';
import {
  FIELD_HALF as H,
  STEP as DT,
  HIVE_LIMIT,
  HIVE_PIVOT,
  HIVE_X,
  CELL,
  FLOWERS,
  FLOWER_TOP,
  FLOWER_RADIUS,
  FLOWER_MIDDLE,
  ROBOT_NAMES,
  allianceOf,
  radiusOf,
  massOf,
  pollenEquivalent,
  shouldTip,
  flowersOpen,
  nectarAvailable,
  inLoading,
  inGarden,
  flowerScore,
  flightStep,
  ballisticVelocity,
  wrapAngle,
  type Alliance,
  type PieceKind,
} from './biobuzz-rules';
export type BioRobotState = {
  inventory: PieceKind[];
  intake: boolean;
  turret: number;
  power: number;
  elevation: number;
  assist: boolean;
  speed: number;
  status: string;
  controller: string;
};
export type BioSnapshot = {
  ready: boolean;
  running: boolean;
  ended: boolean;
  time: number;
  timed: boolean;
  players: number;
  ids: number[];
  score: Record<Alliance, number>;
  tips: Record<Alliance, number>;
  load: Record<Alliance, number>;
  nectar: Record<Alliance, number>;
  flowers: { count: number; owner: Alliance | null; bottom: Alliance | null }[];
  robots: BioRobotState[];
  message: string;
  view: string;
};
type Ball = {
  kind: PieceKind;
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  state: 'free' | 'held' | 'reserve';
  previous: THREE.Vector3;
  shot: boolean;
  grounded: boolean;
  born: number;
};
type Robot = {
  id: number;
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  turret: THREE.Group;
  barrel: THREE.Group;
  lift: THREE.Group;
  rollers: THREE.Mesh[];
  inventory: Ball[];
  yaw: number;
  turretAngle: number;
  turretVelocity: number;
  nudge: number | null;
  power: number;
  elevation: number;
  assist: boolean;
  ballistics: boolean;
  intake: boolean;
  spin: number;
  cooldown: number;
  queued: boolean;
  controls: Set<string>;
  place: { time: number; flower: number; released: boolean } | null;
  status: string;
  controller: string;
  targetYaw: number;
  buttons: boolean[];
  adjustClock: number;
};
type Hive = {
  alliance: Alliance;
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  angle: number;
  velocity: number;
  target: number;
  tipping: boolean;
  tips: number;
  entered: number;
  load: number;
  active: number;
  triggerTime: number;
  reserve: Ball[];
};
let ready: Promise<void> | undefined;
const COLORS = { red: 0xe23c49, blue: 0x2375df, pollen: 0xf9d335 };
const v3 = (v: { x: number; y: number; z: number }) =>
  new THREE.Vector3(v.x, v.y, v.z);
export class Biobuzz {
  static async create(host: HTMLElement, cb: (s: BioSnapshot) => void) {
    await (ready ??= RAPIER.init());
    return new Biobuzz(host, cb);
  }
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.025, 100);
  renderer: THREE.WebGLRenderer;
  orbit: OrbitControls;
  observer: ResizeObserver;
  robots: Robot[] = [];
  balls: Ball[] = [];
  hives: Hive[] = [];
  flowers: {
    x: number;
    z: number;
    mesh: THREE.Group;
    ring: THREE.Mesh;
    balls: Ball[];
  }[] = [];
  keys = new Set<string>();
  padSlots: (number | null)[] = [null, null];
  ids = [0, 2];
  players = 1;
  timed = true;
  time = 120;
  running = false;
  ended = false;
  settling = 0;
  elapsed = 0;
  view = 'Field';
  selected = 0;
  message =
    'Four pollen loaded. Start driving, then launch at the raised blue cell.';
  trajectory = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: 0xf6dc70,
      dashSize: 0.045,
      gapSize: 0.035,
      transparent: true,
      opacity: 0.75,
    }),
  );
  targetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.005, 6, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffe77f,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  );
  disposed = false;
  frame = 0;
  previousTime = 0;
  accumulator = 0;
  emitClock = 0;
  cb: (s: BioSnapshot) => void;
  constructor(host: HTMLElement, cb: (s: BioSnapshot) => void) {
    this.cb = cb;
    this.world.timestep = DT;
    this.world.numSolverIterations = 10;
    this.world.numInternalPgsIterations = 2;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x253239);
    this.scene.fog = new THREE.Fog(0x253239, 10, 28);
    this.camera.position.set(4.4, 5.8, 6.2);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.34, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.07;
    this.orbit.minDistance = 2.3;
    this.orbit.maxDistance = 12;
    this.orbit.maxPolarAngle = Math.PI * 0.46;
    this.orbit.enablePan = false;
    this.scene.add(new THREE.HemisphereLight(0xe5f4ff, 0x768584, 2));
    const light = new THREE.DirectionalLight(0xfff6de, 3.2);
    light.position.set(-3, 7, 3);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -3.4,
      right: 3.4,
      top: 3.4,
      bottom: -3.4,
      near: 0.2,
      far: 16,
    });
    light.shadow.normalBias = 0.014;
    this.scene.add(light);
    const fill = new THREE.DirectionalLight(0xbad6ff, 1);
    fill.position.set(4, 3, -4);
    this.scene.add(fill);
    this.buildField();
    this.buildHives();
    this.buildFlowers();
    for (let id = 0; id < 4; id++) this.robots.push(this.buildRobot(id));
    this.scene.add(this.trajectory, this.targetRing);
    this.targetRing.renderOrder = 5;
    this.reset();
    this.observer = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.view === 'Field') this.frameField();
    });
    this.observer.observe(host);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.frame = requestAnimationFrame(this.tick);
  }
  material(color: number, metalness = 0.15, roughness = 0.6) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness });
  }
  box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    body?: RAPIER.RigidBody,
    transparent = false,
  ) {
    const mat = this.material(color);
    if (transparent) {
      mat.transparent = true;
      mat.opacity = 0.2;
      mat.depthWrite = false;
      mat.side = THREE.DoubleSide;
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = !transparent;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (body)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
          .setTranslation(x, y, z)
          .setFriction(0.5)
          .setRestitution(0.15),
        body,
      );
    return mesh;
  }
  beam(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    color: number,
    body?: RAPIER.RigidBody,
  ) {
    const delta = b.clone().sub(a),
      length = delta.length(),
      mid = a.clone().add(b).multiplyScalar(0.5),
      q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      );
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, length, 8),
      this.material(color, 0.65, 0.35),
    );
    mesh.position.copy(mid);
    mesh.quaternion.copy(q);
    mesh.castShadow = true;
    parent.add(mesh);
    if (body)
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(length / 2, r)
          .setTranslation(mid.x, mid.y, mid.z)
          .setRotation(q)
          .setFriction(0.45),
        body,
      );
    return mesh;
  }
  label(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    color = '#dce6e6',
    bg = 'transparent',
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    if (bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 128);
    }
    ctx.fillStyle = color;
    ctx.font = '700 47px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 65);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  buildField() {
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(H, 0.05, H)
        .setTranslation(0, -0.05, 0)
        .setFriction(0.65)
        .setRestitution(0.25),
      floor,
    );
    const floorMat = this.material(0x858c8e, 0.05, 0.95);
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 6; z++) {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.608, 0.035, 0.608),
          floorMat,
        );
        tile.position.set(
          -H + 0.3048 + x * 0.6096,
          -0.018,
          -H + 0.3048 + z * 0.6096,
        );
        tile.receiveShadow = true;
        this.scene.add(tile);
      }
    this.box(this.scene, 15, 0.1, 15, 0, -0.13, 0, 0x2a373c);
    const wall = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const side of [-1, 1]) {
      this.box(
        this.scene,
        0.02,
        0.305,
        H * 2,
        side * (H + 0.01),
        0.1525,
        0,
        0xcadce3,
        wall,
        true,
      );
      this.box(
        this.scene,
        H * 2,
        0.305,
        0.02,
        0,
        0.1525,
        side * (H + 0.01),
        0xcadce3,
        wall,
        true,
      );
      for (const y of [0.03, 0.305]) {
        this.box(
          this.scene,
          0.035,
          0.035,
          H * 2 + 0.06,
          side * (H + 0.012),
          y,
          0,
          0x9caab0,
          wall,
        );
        this.box(
          this.scene,
          H * 2 + 0.06,
          0.035,
          0.035,
          0,
          y,
          side * (H + 0.012),
          0x9caab0,
          wall,
        );
      }
      for (let i = 0; i <= 6; i++) {
        const p = -H + i * 0.6096;
        this.box(
          this.scene,
          0.045,
          0.31,
          0.045,
          side * (H + 0.018),
          0.155,
          p,
          0x53666c,
        );
        this.box(
          this.scene,
          0.045,
          0.31,
          0.045,
          p,
          0.155,
          side * (H + 0.018),
          0x53666c,
        );
      }
      const color = side < 0 ? COLORS.red : COLORS.blue;
      // Loading zones: A5 and F2. Gardens: A1 and F6.
      this.box(
        this.scene,
        0.2794,
        0.005,
        0.0254,
        side * (H - 0.1397),
        0.005,
        side * 0.635,
        color,
      );
      this.box(
        this.scene,
        0.2794,
        0.005,
        0.0254,
        side * (H - 0.1397),
        0.005,
        side * 1.2192,
        color,
      );
      this.box(
        this.scene,
        0.0254,
        0.005,
        0.5842,
        side * (H - 0.2794),
        0.005,
        side * 0.9271,
        color,
      );
      this.box(
        this.scene,
        0.5842,
        0.005,
        0.0508,
        side * (H - 0.2921),
        0.006,
        -side * (H - 0.0254),
        color,
      );
      this.box(this.scene, 0.14, 0.025, 0.58, side * 2.03, 0.005, 0, color);
      const area = this.label(
        this.scene,
        side < 0 ? 'RED ALLIANCE' : 'BLUE ALLIANCE',
        side * 2.3,
        0.005,
        0,
        1.3,
        side < 0 ? '#ef6b76' : '#70aaff',
      );
      area.rotation.x = -Math.PI / 2;
      area.rotation.z = (side * Math.PI) / 2;
    }
    const title = this.label(
      this.scene,
      'BIOBUZZ',
      0,
      0.007,
      1.15,
      0.7,
      '#aab4b4',
    );
    title.rotation.x = -Math.PI / 2;
    const season = this.label(
      this.scene,
      '2026–27',
      0,
      0.008,
      1.31,
      0.36,
      '#aab4b4',
    );
    season.rotation.x = -Math.PI / 2;
  }
  buildHives() {
    const frame = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const x of [-0.607, 0.607]) {
      for (const z of [-0.485, 0.485])
        this.beam(
          this.scene,
          new THREE.Vector3(x, 0.02, z),
          new THREE.Vector3(x, HIVE_PIVOT, 0),
          0.019,
          0xa5afb5,
          frame,
        );
      this.beam(
        this.scene,
        new THREE.Vector3(x, 0.021, -0.485),
        new THREE.Vector3(x, 0.021, 0.485),
        0.014,
        0xa5afb5,
        frame,
      );
    }
    this.beam(
      this.scene,
      new THREE.Vector3(-0.607, HIVE_PIVOT, 0),
      new THREE.Vector3(0.607, HIVE_PIVOT, 0),
      0.016,
      0xbcc7cc,
      frame,
    );
    for (const z of [-0.025, 0.025]) {
      const sign = this.label(
        this.scene,
        'FIRST  ·  BIOBUZZ',
        0,
        0.97,
        z,
        0.57,
        '#152b2c',
        '#ecda56',
      );
      if (z < 0) sign.rotation.y = Math.PI;
    }
    for (const alliance of ['red', 'blue'] as const) {
      const x = alliance === 'red' ? -HIVE_X : HIVE_X,
        angle = alliance === 'red' ? -HIVE_LIMIT : HIVE_LIMIT;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(x, HIVE_PIVOT, 0)
          .setRotation(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              angle,
            ),
          ),
      );
      const mesh = new THREE.Group();
      mesh.position.set(x, HIVE_PIVOT, 0);
      mesh.rotation.x = angle;
      this.scene.add(mesh);
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(-CELL.halfWidth, CELL.bottom);
        shape.lineTo(CELL.halfWidth, CELL.bottom);
        shape.lineTo(CELL.halfWidth, CELL.shoulder);
        shape.lineTo(0, CELL.peak);
        shape.lineTo(-CELL.halfWidth, CELL.shoulder);
        shape.closePath();
        const panel = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshStandardMaterial({
            color: 0xd9e0df,
            metalness: 0.05,
            roughness: 0.27,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
          }),
        );
        panel.position.z = side * CELL.inner;
        mesh.add(panel);
        // Back panel is a pentagonal convex slab. Five walls enclose the cell,
        // leaving the outer pentagon open for real projectile entry/spillage.
        const corners = [
          [-CELL.halfWidth, CELL.bottom],
          [CELL.halfWidth, CELL.bottom],
          [CELL.halfWidth, CELL.shoulder],
          [0, CELL.peak],
          [-CELL.halfWidth, CELL.shoulder],
        ];
        const points: number[] = [];
        for (const dz of [-0.004, 0.004])
          for (const [px, py] of corners)
            points.push(px, py, side * CELL.inner + dz);
        const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
        if (hull)
          this.world.createCollider(
            hull.setFriction(0.4).setRestitution(0.08),
            body,
          );
        for (let i = 0; i < 5; i++) {
          const a = corners[i],
            b = corners[(i + 1) % 5];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            midX = (a[0] + b[0]) / 2,
            midY = (a[1] + b[1]) / 2,
            rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const wall = this.box(
            mesh,
            len,
            0.008,
            CELL.outer - CELL.inner,
            midX,
            midY,
            (side * (CELL.inner + CELL.outer)) / 2,
            0xdce2df,
            undefined,
            true,
          );
          wall.rotation.z = rot;
          this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(
              len / 2,
              0.004,
              (CELL.outer - CELL.inner) / 2,
            )
              .setTranslation(
                midX,
                midY,
                (side * (CELL.inner + CELL.outer)) / 2,
              )
              .setRotation(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 0, 1),
                  rot,
                ),
              )
              .setFriction(0.33)
              .setRestitution(0.08),
            body,
          );
          for (const end of [CELL.inner, CELL.outer])
            this.beam(
              mesh,
              new THREE.Vector3(a[0], a[1], side * end),
              new THREE.Vector3(b[0], b[1], side * end),
              0.009,
              COLORS[alliance],
            );
          this.beam(
            mesh,
            new THREE.Vector3(a[0], a[1], side * CELL.inner),
            new THREE.Vector3(a[0], a[1], side * CELL.outer),
            0.0035,
            0x7e8b90,
          );
        }
        const firstId =
          alliance === 'red' ? (side === 1 ? 34 : 30) : side === 1 ? 38 : 42;
        for (let tag = 0; tag < 4; tag++) {
          const marker = new THREE.Mesh(
            new THREE.PlaneGeometry(0.08255, 0.08255),
            new THREE.MeshBasicMaterial({
              map: bioTagTexture(firstId + tag),
              side: THREE.DoubleSide,
            }),
          );
          marker.position.set(
            (tag - 1.5) * 0.095,
            CELL.bottom - 0.0055,
            side * (CELL.inner + 0.16),
          );
          marker.rotation.x = Math.PI / 2;
          if (side < 0) marker.rotation.z = Math.PI;
          mesh.add(marker);
        }
        this.beam(
          mesh,
          new THREE.Vector3(0, -0.04, 0),
          new THREE.Vector3(0, CELL.bottom, side * CELL.inner),
          0.018,
          0x828c92,
        );
      }
      this.hives.push({
        alliance,
        body,
        mesh,
        angle,
        velocity: 0,
        target: angle,
        tipping: false,
        tips: 0,
        entered: 0,
        load: 5,
        active: alliance === 'red' ? 1 : -1,
        triggerTime: 0,
        reserve: [],
      });
    }
  }
  ring(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    tube: number,
    color: number,
    body?: RAPIER.RigidBody,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, tube, 8, 32),
      this.material(color, 0.3, 0.5),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    parent.add(mesh);
    if (body)
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          b = ((i + 1) * Math.PI) / 12;
        const pa = new THREE.Vector3(
            x + Math.cos(a) * r,
            y,
            z + Math.sin(a) * r,
          ),
          pb = new THREE.Vector3(x + Math.cos(b) * r, y, z + Math.sin(b) * r),
          mid = pa.clone().add(pb).multiplyScalar(0.5),
          dir = pb.clone().sub(pa);
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(dir.length() / 2, tube)
            .setTranslation(mid.x, mid.y, mid.z)
            .setRotation(
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir.normalize(),
              ),
            )
            .setFriction(0.35)
            .setRestitution(0.08),
          body,
        );
      }
    return mesh;
  }
  buildFlowers() {
    FLOWERS.forEach((f, i) => {
      const mesh = new THREE.Group();
      mesh.position.set(f.x, 0, f.z);
      this.scene.add(mesh);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(f.x, 0, f.z),
      );
      const ring = this.ring(
        mesh,
        0,
        FLOWER_TOP,
        0,
        FLOWER_RADIUS + 0.008,
        0.008,
        0xddb64f,
        body,
      );
      this.ring(mesh, 0, FLOWER_MIDDLE, 0, 0.05, 0.009, 0x28333a, body);
      this.ring(mesh, 0, 0.011, 0, 0.044, 0.008, 0x28333a, body);
      for (let j = 0; j < 4; j++) {
        const a = Math.PI / 4 + (j * Math.PI) / 2;
        this.beam(
          mesh,
          new THREE.Vector3(
            Math.cos(a) * 0.061,
            FLOWER_MIDDLE,
            Math.sin(a) * 0.061,
          ),
          new THREE.Vector3(
            Math.cos(a) * 0.061,
            FLOWER_TOP,
            Math.sin(a) * 0.061,
          ),
          0.0078,
          0x5e923b,
          body,
        );
      }
      const back = new THREE.Vector3(0, 0, -0.054).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        f.facing,
      );
      this.beam(
        mesh,
        new THREE.Vector3(back.x, 0.01, back.z),
        new THREE.Vector3(back.x, FLOWER_MIDDLE, back.z),
        0.01,
        0x738184,
        body,
      );
      this.box(
        mesh,
        0.13,
        0.033,
        0.008,
        0,
        FLOWER_TOP + 0.017,
        -0.06,
        0x73557e,
      );
      const label = this.label(
        this.scene,
        `F${i + 1}`,
        f.x,
        0.02,
        f.z + (f.z > 1 ? -0.19 : 0.19),
        0.12,
        '#f0d268',
      );
      label.rotation.x = -Math.PI / 2;
      this.flowers.push({ x: f.x, z: f.z, mesh, ring, balls: [] });
    });
  }
  buildRobot(id: number): Robot {
    const alliance = allianceOf(id),
      mesh = new THREE.Group();
    this.scene.add(mesh);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.075, 0)
        .enabledRotations(false, true, false)
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.18, 0.07, 0.195)
        .setMass(12)
        .setFriction(0.08)
        .setRestitution(0.05),
      body,
    );
    this.box(mesh, 0.36, 0.045, 0.39, 0, 0, 0, 0x65767c);
    this.box(mesh, 0.285, 0.011, 0.31, 0, 0.055, 0, 0x243037);
    for (const x of [-0.169, 0.169])
      this.box(mesh, 0.024, 0.09, 0.4, x, 0.05, 0, 0x9eaeb4);
    for (const z of [-0.17, 0.17])
      this.box(mesh, 0.345, 0.064, 0.025, 0, 0.053, z, COLORS[alliance]);
    const rollers: THREE.Mesh[] = [];
    for (const x of [-0.182, 0.182])
      for (const z of [-0.132, 0.132]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.063, 0.063, 0.055, 20),
          this.material(0x192126, 0.15, 0.84),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.005, z);
        mesh.add(wheel);
        rollers.push(wheel);
        for (let j = 0; j < 8; j++) {
          const a = (j * Math.PI) / 4;
          const roller = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.014, 0.048, 3, 6),
            this.material(0x3a464e),
          );
          roller.position.set(0, Math.cos(a) * 0.052, Math.sin(a) * 0.052);
          roller.rotation.z = Math.PI / 4;
          wheel.add(roller);
        }
        this.world.createCollider(
          RAPIER.ColliderDesc.ball(0.06)
            .setTranslation(x, -0.005, z)
            .setFriction(0.04)
            .setMass(0.2),
          body,
        );
      }
    // Low front roller and hopper: pollen and nectar have different diameters.
    const roller = this.beam(
      mesh,
      new THREE.Vector3(-0.15, 0.005, -0.228),
      new THREE.Vector3(0.15, 0.005, -0.228),
      0.021,
      0xe7c743,
    );
    rollers.push(roller);
    this.box(mesh, 0.32, 0.014, 0.09, 0, -0.04, -0.21, 0x293238);
    for (const x of [-0.13, 0.13])
      this.beam(
        mesh,
        new THREE.Vector3(x, 0.05, 0.14),
        new THREE.Vector3(x, 0.37, 0.04),
        0.011,
        0xc4d0d1,
      );
    this.box(mesh, 0.24, 0.017, 0.16, 0, 0.12, 0.065, 0x37484b);
    const turret = new THREE.Group();
    turret.position.y = 0.26;
    mesh.add(turret);
    this.ring(turret, 0, 0, 0, 0.084, 0.014, COLORS[alliance]);
    const barrel = new THREE.Group();
    turret.add(barrel);
    this.box(barrel, 0.105, 0.064, 0.22, 0, 0.022, -0.072, 0x49575e);
    this.box(barrel, 0.059, 0.048, 0.24, 0, 0.022, -0.073, 0x141e24);
    for (const x of [-0.067, 0.067]) {
      const fly = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 0.035, 24),
        this.material(0xd6dfdf),
      );
      fly.rotation.z = Math.PI / 2;
      fly.position.set(x, 0.02, -0.015);
      barrel.add(fly);
    }
    const lift = new THREE.Group();
    lift.position.set(0, 0.07, -0.22);
    mesh.add(lift);
    this.box(lift, 0.13, 0.012, 0.13, 0, 0, 0, 0xd9b744);
    for (const x of [-0.07, 0.07])
      this.box(lift, 0.012, 0.03, 0.13, x, 0.014, 0, 0xbd9e36);
    for (const x of [-0.09, 0.09])
      this.beam(
        mesh,
        new THREE.Vector3(x, 0.035, -0.17),
        new THREE.Vector3(x, 0.55, -0.17),
        0.008,
        0xb5c1c6,
      );
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.27, 0.285, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffdd55,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    halo.name = 'driver-halo';
    halo.position.y = -0.063;
    halo.rotation.x = -Math.PI / 2;
    mesh.add(halo);
    const plate = this.label(
      mesh,
      ROBOT_NAMES[id].toUpperCase(),
      0,
      0.105,
      0.192,
      0.27,
      '#ffffff',
      alliance === 'blue' ? '#155bb1' : '#b62431',
    );
    plate.name = 'robot-identity';
    return {
      id,
      body,
      mesh,
      turret,
      barrel,
      lift,
      rollers,
      inventory: [],
      yaw: 0,
      turretAngle: 0,
      turretVelocity: 0,
      nudge: null,
      power: 6,
      elevation: 55,
      assist: true,
      ballistics: true,
      intake: false,
      spin: 0,
      cooldown: 0,
      queued: false,
      controls: new Set(),
      place: null,
      status: 'Ready',
      controller: '',
      targetYaw: 0,
      buttons: [],
      adjustClock: 0,
    };
  }
  addBall(
    kind: PieceKind,
    x: number,
    y: number,
    z: number,
    state: Ball['state'] = 'free',
  ) {
    const radius = radiusOf(kind),
      body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setCcdEnabled(true)
          .setCanSleep(true)
          .setAngularDamping(0.15),
      );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setMass(massOf(kind))
        .setFriction(0.45)
        .setRestitution(0.32),
      body,
    );
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 12),
      this.material(COLORS[kind], 0.05, 0.57),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const b: Ball = {
      kind,
      body,
      mesh,
      state,
      previous: new THREE.Vector3(x, y, z),
      shot: false,
      grounded: state === 'free' && y < 0.1,
      born: this.elapsed,
    };
    this.balls.push(b);
    if (state !== 'free') body.setEnabled(false);
    return b;
  }
  reset() {
    this.running = false;
    this.ended = false;
    this.time = 120;
    this.elapsed = 0;
    this.settling = 0;
    this.accumulator = 0;
    this.keys.clear();
    for (const b of this.balls) {
      this.world.removeRigidBody(b.body);
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    this.balls = [];
    for (const r of this.robots) {
      const side = allianceOf(r.id) === 'blue' ? 1 : -1,
        z = (r.id % 2 === 0 ? -1 : 1) * side * 1.05,
        x = side * (H - 0.201);
      r.body.setTranslation({ x, y: 0.076, z }, true);
      r.yaw = (side * Math.PI) / 2;
      r.body.setRotation(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          r.yaw,
        ),
        true,
      );
      r.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      r.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const halo = r.mesh.getObjectByName('driver-halo');
      if (halo) halo.visible = this.ids.slice(0, this.players).includes(r.id);
      r.turretAngle = 0;
      r.turretVelocity = 0;
      r.nudge = null;
      r.intake = false;
      r.inventory = [];
      r.controls.clear();
      r.place = null;
      r.spin = 0;
      r.cooldown = 0;
      r.queued = false;
      r.lift.position.y = 0.07;
      for (let i = 0; i < 4; i++)
        r.inventory.push(this.addBall('pollen', x, 0.2, z, 'held'));
    }
    for (const h of this.hives) {
      h.angle = h.alliance === 'red' ? -HIVE_LIMIT : HIVE_LIMIT;
      h.target = h.angle;
      h.active = h.alliance === 'red' ? 1 : -1;
      h.velocity = 0;
      h.tipping = false;
      h.tips = 0;
      h.entered = 0;
      h.load = 5;
      h.triggerTime = 0;
      h.reserve = [];
      h.body.setRotation(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          h.angle,
        ),
        true,
      );
      h.body.setNextKinematicRotation(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          h.angle,
        ),
      );
      h.mesh.rotation.x = h.angle;
      h.mesh.updateMatrixWorld(true);
      for (let i = 0; i < 3; i++) {
        const p = h.mesh.localToWorld(
          new THREE.Vector3(
            (i - 1) * 0.099,
            0.035,
            h.active * (CELL.inner + 0.065),
          ),
        );
        this.addBall(h.alliance, p.x, p.y, p.z);
      }
      for (let i = 0; i < 5; i++)
        h.reserve.push(this.addBall(h.alliance, 0, -5, 0, 'reserve'));
      const sign = h.alliance === 'red' ? -1 : 1;
      for (let i = 0; i < 4; i++)
        this.addBall(
          'pollen',
          sign * (H - 0.06 - i * 0.075),
          0.04,
          -sign * (H - 0.041),
        );
    }
    for (const f of this.flowers) {
      f.balls = [];
      for (let i = 0; i < 4; i++)
        this.addBall(
          'pollen',
          f.x + (i % 2 ? -0.008 : 0.008),
          0.036 + i * 0.069,
          f.z,
        );
    }
    // Settle the staged balls without consuming match time or processing input.
    for (let i = 0; i < 90; i++) this.world.step();
    this.updateBalls();
    this.sync();
    this.message =
      'Four pollen loaded. Start driving, then launch at your raised hive cell.';
    this.emit();
  }
  configure(v: Record<string, unknown>) {
    if (typeof v.players === 'number') this.players = v.players === 2 ? 2 : 1;
    if (typeof v.timed === 'boolean') this.timed = v.timed;
    if (typeof v.robot1 === 'number')
      this.ids[0] = Math.max(0, Math.min(3, v.robot1));
    if (typeof v.robot2 === 'number')
      this.ids[1] = Math.max(0, Math.min(3, v.robot2));
    if (this.ids[0] === this.ids[1]) this.ids[1] = (this.ids[0] + 2) % 4;
    this.selected = 0;
    this.reset();
  }
  setView(v: string) {
    this.view = v;
    this.orbit.enabled = v === 'Field';
    if (v === 'Field') {
      this.frameField();
    }
    this.emit();
  }
  frameField() {
    this.orbit.target.set(0, 0.3, 0);
    const direction = new THREE.Vector3(3.2, 4.1, 4.8).normalize();
    let distance = 6.8;
    for (let step = 0; step < 7; step++) {
      this.camera.position
        .copy(this.orbit.target)
        .addScaledVector(direction, distance);
      this.camera.lookAt(this.orbit.target);
      this.camera.updateMatrixWorld(true);
      const points = [
        ...[-H, H].flatMap((x) =>
          [-H, H].map((z) => new THREE.Vector3(x, 0, z)),
        ),
        ...[-0.61, 0.61].flatMap((x) =>
          [-0.55, 0.55].map((z) => new THREE.Vector3(x, 1.67, z)),
        ),
      ];
      const ratio = Math.max(
        ...points.map((p) => {
          p.project(this.camera);
          return Math.max(Math.abs(p.x) / 0.88, Math.abs(p.y) / 0.8);
        }),
      );
      distance *= Math.max(0.8, Math.min(1.2, ratio));
    }
    this.orbit.update();
  }
  selectPlayer(p: number) {
    this.selected = p;
    this.emit();
  }
  focusFlower(i: number) {
    const f = this.flowers[i];
    if (!f) return;
    this.view = 'Field';
    this.orbit.enabled = true;
    this.orbit.target.set(f.x, 0.25, f.z);
    this.camera.position.set(f.x * 0.65 + 1.2, 2, f.z * 0.65 + 2);
    this.emit();
  }
  toggle() {
    if (this.ended) this.reset();
    this.running = !this.running;
    this.keys.clear();
    this.robots.forEach((r) => r.controls.clear());
    this.message = this.running
      ? 'WASD drive · R intake · Space launch · F place in flower'
      : 'Paused · adjust your aim or resume driving';
    this.emit();
  }
  action(p: number, action: string) {
    const r = this.robots[this.ids[p]];
    if (!r || p >= this.players) return;
    if (
      (this.ended || this.settling > 0) &&
      ['intake', 'shoot', 'place', 'nectar'].includes(action)
    ) {
      this.message = 'Session complete · reset the field to play again';
      return;
    }
    if (action === 'intake') {
      r.intake = !r.intake;
      this.message = r.intake
        ? 'Intake on · approach loose balls or a flower’s bottom opening'
        : 'Intake off';
    }
    if (action === 'assist') {
      r.assist = !r.assist;
      r.ballistics = r.assist;
      this.message = r.assist
        ? 'Hive tracking and launch calculation enabled'
        : 'Manual turret and launch controls';
    }
    if (action === 'center') {
      r.assist = false;
      r.nudge = 0;
    }
    if (action === 'turretLeft' || action === 'turretRight') {
      r.assist = false;
      r.nudge = Math.max(
        (-170 * Math.PI) / 180,
        Math.min(
          (170 * Math.PI) / 180,
          r.turretAngle + ((action === 'turretLeft' ? 1 : -1) * Math.PI) / 18,
        ),
      );
    }
    if (action === 'shoot') {
      if (!this.running) {
        this.message = 'Press Start driving before launching';
      } else if (!r.inventory.length) {
        this.message = 'Magazine empty · switch on intake to collect pollen';
      } else {
        r.queued = true;
        this.message = 'Shot queued · flywheel spinning up';
      }
    }
    if (action === 'place') this.placeFlower(r);
    if (action === 'nectar') this.feedNectar(r);
    this.emit();
  }
  hold(p: number, control: string, on: boolean) {
    const r = this.robots[this.ids[p]];
    if (!r) return;
    if (on) r.controls.add(control);
    else r.controls.delete(control);
    if (on && control.startsWith('turret')) {
      r.assist = false;
      r.nudge = null;
    }
  }
  setAim(p: number, key: 'power' | 'elevation', value: number) {
    const r = this.robots[this.ids[p]];
    if (!r || !Number.isFinite(value)) return;
    r[key] = Math.max(
      key === 'power' ? 3 : 15,
      Math.min(key === 'power' ? 11 : 80, value),
    );
    r.ballistics = false;
    this.emit();
  }
  adjust(p: number, key: 'power' | 'elevation', d: number) {
    const r = this.robots[this.ids[p]];
    if (r) this.setAim(p, key, r[key] + d * (key === 'power' ? 0.2 : 2));
  }
  keyDown = (event: KeyboardEvent) => {
    const el = event.target as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (['select', 'textarea'].includes(tag) || el.isContentEditable) return;
    if (
      tag === 'input' &&
      ((el as HTMLInputElement).type !== 'range' ||
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
        ].includes(event.code))
    )
      return;
    if (
      (event.code === 'Enter' || event.code === 'Space') &&
      el.closest('button,summary,a')
    )
      return;
    const used = [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyQ',
      'KeyE',
      'KeyR',
      'KeyF',
      'KeyN',
      'KeyZ',
      'KeyX',
      'KeyC',
      'Space',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Comma',
      'Period',
      'Slash',
      'Enter',
      'KeyM',
      'KeyB',
      'KeyO',
      'KeyP',
      'KeyH',
      'ShiftLeft',
      'ShiftRight',
    ];
    if (!used.includes(event.code)) return;
    event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    const actions: Record<string, [number, string]> = {
      KeyR: [0, 'intake'],
      Space: [0, 'shoot'],
      KeyF: [0, 'place'],
      KeyN: [0, 'nectar'],
      KeyC: [0, 'center'],
      Slash: [1, 'intake'],
      Enter: [1, 'shoot'],
      KeyM: [1, 'place'],
      KeyB: [1, 'nectar'],
      KeyH: [1, 'center'],
    };
    const a = actions[event.code];
    if (a) this.action(...a);
    if (['KeyZ', 'KeyX', 'KeyO', 'KeyP'].includes(event.code)) {
      const p = event.code === 'KeyZ' || event.code === 'KeyX' ? 0 : 1;
      if (p < this.players) {
        this.robots[this.ids[p]].assist = false;
        this.robots[this.ids[p]].nudge = null;
      }
    }
  };
  keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };
  blur = () => {
    this.keys.clear();
    for (const r of this.robots) {
      r.controls.clear();
      r.queued = false;
    }
    if (this.running) {
      this.running = false;
      this.message = 'Paused while the field is out of focus';
      this.emit();
    }
  };
  visibility = () => {
    if (document.hidden) this.blur();
  };
  localToHive(h: Hive, p: { x: number; y: number; z: number }) {
    return v3(p)
      .sub(v3(h.body.translation()))
      .applyQuaternion(
        new THREE.Quaternion()
          .copy(h.body.rotation() as THREE.Quaternion)
          .invert(),
      );
  }
  hivePoint(h: Hive, p: THREE.Vector3) {
    return p
      .applyQuaternion(
        new THREE.Quaternion().copy(h.body.rotation() as THREE.Quaternion),
      )
      .add(v3(h.body.translation()));
  }
  cellBalls(h: Hive, side = h.active) {
    return this.balls.filter((b) => {
      if (b.state !== 'free') return false;
      const p = this.localToHive(h, b.body.translation()),
        r = radiusOf(b.kind);
      const roof =
        CELL.peak -
        (Math.abs(p.x) * (CELL.peak - CELL.shoulder)) / CELL.halfWidth;
      return (
        Math.abs(p.x) < CELL.halfWidth - r * 0.2 &&
        p.y > CELL.bottom - r * 0.1 &&
        p.y < roof + r * 0.1 &&
        side * p.z > CELL.inner - r * 0.1 &&
        side * p.z < CELL.outer - r * 0.25
      );
    });
  }
  hiveFor(r: Robot) {
    return this.hives.find((h) => h.alliance === allianceOf(r.id))!;
  }
  flowerAt(b: Ball) {
    const p = b.body.translation();
    return this.flowers.findIndex(
      (f) =>
        Math.hypot(p.x - f.x, p.z - f.z) <
          FLOWER_RADIUS + radiusOf(b.kind) * 0.4 &&
        p.y < FLOWER_TOP + radiusOf(b.kind),
    );
  }
  placeFlower(r: Robot) {
    if (!this.running) {
      this.message = 'Start driving before placing a ball';
      return;
    }
    if (!flowersOpen(this.time, this.timed)) {
      this.message =
        'Flowers open with 1:00 remaining · collect pollen and tip your hive first';
      return;
    }
    if (r.place) return;
    if (!r.inventory.length) {
      this.message = 'Collect pollen or nectar first';
      return;
    }
    if (Math.hypot(r.body.linvel().x, r.body.linvel().z) > 0.45) {
      this.message = 'Slow down beside a flower before raising the lift';
      return;
    }
    const pos = v3(r.body.translation()),
      q = new THREE.Quaternion()
        .copy(r.body.rotation() as THREE.Quaternion)
        .invert();
    const index = this.flowers.findIndex((f) => {
      const local = new THREE.Vector3(f.x, pos.y, f.z)
        .sub(pos)
        .applyQuaternion(q);
      return Math.abs(local.x) < 0.16 && local.z < -0.16 && local.z > -0.42;
    });
    if (index < 0) {
      this.message = 'Face a flower and bring your front lift close to it';
      return;
    }
    const flower = this.flowers[index];
    const top = Math.max(
      0,
      ...flower.balls.map((b) => b.body.translation().y + radiusOf(b.kind)),
    );
    if (top > FLOWER_TOP - 0.025) {
      this.message = 'Flower is full · use another flower';
      return;
    }
    r.place = { time: 0, flower: index, released: false };
    r.queued = false;
    this.message = `Lifting ${r.inventory[0].kind} into flower ${index + 1}`;
  }
  feedNectar(r: Robot) {
    if (!this.running) {
      this.message = 'Start driving to introduce nectar';
      return;
    }
    const h = this.hiveFor(r),
      available = nectarAvailable(h.tips, h.entered, this.time, this.timed);
    if (!available) {
      this.message =
        h.entered >= 5
          ? 'All five reserve nectar are on the field'
          : 'Tip your hive, or wait until 1:00, to unlock reserve nectar';
      return;
    }
    const sign = h.alliance === 'red' ? -1 : 1;
    const x = sign * (H - 0.09),
      z = sign * (0.7 + (h.entered % 4) * 0.13);
    if (
      this.robots.some(
        (bot) =>
          Math.hypot(
            bot.body.translation().x - x,
            bot.body.translation().z - z,
          ) < 0.3,
      ) ||
      this.balls.some(
        (b) =>
          b.state === 'free' &&
          Math.hypot(b.body.translation().x - x, b.body.translation().z - z) <
            0.1 &&
          b.body.translation().y < 0.12,
      )
    ) {
      this.message =
        'Clear the loading zone so nectar can touch the floor first';
      return;
    }
    const b = h.reserve[h.entered++];
    b.state = 'free';
    b.grounded = false;
    b.shot = false;
    b.born = this.elapsed;
    b.body.setEnabled(true);
    b.body.setTranslation({ x, y: 0.055, z }, true);
    b.previous.set(x, 0.055, z);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.message = `${h.alliance === 'red' ? 'Red' : 'Blue'} nectar delivered to the loading zone`;
  }
  muzzle(r: Robot) {
    const yaw = r.yaw + r.turretAngle,
      a = (r.elevation * Math.PI) / 180;
    const offset = new THREE.Vector3(0, 0.022, -0.205)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), a)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    offset.y += 0.26;
    return v3(r.body.translation()).add(offset);
  }
  platformVelocity(r: Robot, start: THREE.Vector3) {
    const pos = r.body.translation(),
      w = r.body.angvel().y + r.turretVelocity,
      v = r.body.linvel();
    return new THREE.Vector3(
      v.x + w * (start.z - pos.z),
      v.y,
      v.z - w * (start.x - pos.x),
    );
  }
  aim(r: Robot) {
    const h = this.hiveFor(r),
      kind = r.inventory[0]?.kind ?? 'pollen';
    const target = this.hivePoint(
      h,
      new THREE.Vector3(0, 0.115, h.active * (CELL.outer - 0.055)),
    );
    const start = this.muzzle(r),
      platform = this.platformVelocity(r, start),
      distance = start.distanceTo(target);
    const travel = Math.max(0.57, Math.min(0.88, distance / 3.3 + 0.27));
    const launch = ballisticVelocity(start, target, kind, travel);
    const relative = v3(launch).sub(platform);
    r.targetYaw = Math.atan2(-relative.x, -relative.z);
    if (r.assist && r.ballistics) {
      r.power = Math.max(3, Math.min(11, relative.length()));
      r.elevation = Math.max(
        15,
        Math.min(
          80,
          (Math.atan2(relative.y, Math.hypot(relative.x, relative.z)) * 180) /
            Math.PI,
        ),
      );
    }
    return { target, start, platform };
  }
  shotVelocity(r: Robot) {
    const a = (r.elevation * Math.PI) / 180,
      yaw = r.yaw + r.turretAngle,
      platform = this.platformVelocity(r, this.muzzle(r));
    return new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(a) * r.power,
      Math.sin(a) * r.power,
      -Math.cos(yaw) * Math.cos(a) * r.power,
    ).add(platform);
  }
  launch(r: Robot) {
    if (!r.inventory.length || r.cooldown > 0 || r.place) return;
    const b = r.inventory.shift()!,
      start = this.muzzle(r),
      velocity = this.shotVelocity(r);
    b.state = 'free';
    b.shot = true;
    b.grounded = false;
    b.born = this.elapsed;
    b.body.setEnabled(true);
    b.body.setTranslation(start, true);
    b.body.setLinvel(velocity, true);
    b.body.setAngvel({ x: velocity.z * 2, y: 0, z: -velocity.x * 2 }, true);
    b.previous.copy(start);
    const recoil = velocity
      .clone()
      .sub(this.platformVelocity(r, start))
      .multiplyScalar(-massOf(b.kind));
    r.body.applyImpulseAtPoint(recoil, start, true);
    r.cooldown = 0.32;
    r.spin *= 0.8;
    r.queued = false;
    this.message = `${ROBOT_NAMES[r.id]} launched ${b.kind}`;
  }
  intake(r: Robot) {
    if (!r.intake || r.inventory.length >= 4 || r.place) return;
    const pos = v3(r.body.translation()),
      inv = new THREE.Quaternion()
        .copy(r.body.rotation() as THREE.Quaternion)
        .invert();
    for (const b of this.balls) {
      if (r.inventory.length >= 4) break;
      if (
        b.state !== 'free' ||
        !b.grounded ||
        b.body.translation().y > 0.17 ||
        this.elapsed - b.born < 0.25
      )
        continue;
      if (b.kind !== 'pollen' && this.flowerAt(b) !== -1) continue;
      const local = v3(b.body.translation()).sub(pos).applyQuaternion(inv),
        radius = radiusOf(b.kind);
      if (
        Math.abs(local.x) > 0.16 + radius ||
        local.z > -0.1 ||
        local.z < -0.34 - radius
      )
        continue;
      b.state = 'held';
      b.shot = false;
      b.body.setEnabled(false);
      r.inventory.push(b);
      this.message = `${ROBOT_NAMES[r.id]} collected ${b.kind} · ${r.inventory.length}/4`;
    }
  }
  updateLift(r: Robot) {
    if (!r.place) {
      r.lift.position.lerp(new THREE.Vector3(0, 0.07, -0.22), 0.1);
      return;
    }
    const place = r.place;
    place.time += DT;
    const f = this.flowers[place.flower];
    const local = new THREE.Vector3(f.x, 0.63, f.z)
      .sub(v3(r.body.translation()))
      .applyQuaternion(
        new THREE.Quaternion()
          .copy(r.body.rotation() as THREE.Quaternion)
          .invert(),
      );
    const alpha = Math.min(1, place.time / 0.6);
    r.lift.position.lerpVectors(
      new THREE.Vector3(0, 0.07, -0.22),
      local,
      alpha * alpha * (3 - 2 * alpha),
    );
    if (place.time >= 0.72 && !place.released) {
      if (!flowersOpen(this.time, this.timed)) {
        r.place = null;
        return;
      }
      const b = r.inventory.shift();
      if (b) {
        b.state = 'free';
        b.shot = false;
        b.grounded = false;
        b.born = this.elapsed;
        b.body.setEnabled(true);
        b.body.setTranslation({ x: f.x, y: 0.66, z: f.z }, true);
        b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        b.previous.set(f.x, 0.66, f.z);
        this.message = `Placed ${b.kind} into flower ${place.flower + 1}`;
      }
      place.released = true;
    }
    if (place.time > 1.2) r.place = null;
  }
  pad(p: number, r: Robot) {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads
        ? Array.from(navigator.getGamepads()).filter(
            (g): g is Gamepad => g !== null && g.connected,
          )
        : [];
    if (this.padSlots[p] === null) {
      const available = pads.find((g) => !this.padSlots.includes(g.index));
      if (available) this.padSlots[p] = available.index;
    }
    const pad = pads.find((g) => g.index === this.padSlots[p]);
    if (!pad) {
      r.controller = '';
      r.buttons = [];
      return { x: 0, z: 0, turn: 0, turret: 0, precision: false, shoot: false };
    }
    r.controller = pad.id;
    const b = pad.buttons.map((b) => b.pressed),
      edge = (i: number) => b[i] && !r.buttons[i];
    if (edge(9)) this.toggle();
    if (edge(2)) this.action(p, 'intake');
    if (edge(0)) this.action(p, 'place');
    if (edge(3)) this.action(p, 'nectar');
    if (edge(11)) this.action(p, 'center');
    r.adjustClock -= DT;
    if (r.adjustClock <= 0) {
      if (b[12] || b[13]) this.adjust(p, 'elevation', b[12] ? 1 : -1);
      if (b[14] || b[15]) this.adjust(p, 'power', b[15] ? 1 : -1);
      if (b[12] || b[13] || b[14] || b[15]) r.adjustClock = 0.13;
    }
    const right = deadzone(pad.axes[2] ?? 0);
    if (b[5] && Math.abs(right) > 0.05) {
      r.assist = false;
      r.nudge = null;
    }
    r.buttons = b;
    return {
      x: deadzone(pad.axes[0] ?? 0),
      z: deadzone(pad.axes[1] ?? 0),
      turn: b[5] ? 0 : -right,
      turret: b[5] ? -right : 0,
      precision: !!b[4],
      shoot: (pad.buttons[7]?.value ?? 0) > 0.25,
    };
  }
  updateRobots() {
    for (const r of this.robots) {
      r.yaw = 2 * Math.atan2(r.body.rotation().y, r.body.rotation().w);
      r.cooldown = Math.max(0, r.cooldown - DT);
    }
    for (let p = 0; p < this.players; p++) {
      const r = this.robots[this.ids[p]],
        c = r.controls,
        k = this.keys;
      const code =
        p === 0
          ? ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyX']
          : [
              'ArrowUp',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
              'Comma',
              'Period',
              'KeyO',
              'KeyP',
            ];
      const pressed = (index: number, name: string) =>
        k.has(code[index]) || c.has(name) ? 1 : 0;
      const pad = this.pad(p, r);
      const x = Math.max(
          -1,
          Math.min(1, pressed(3, 'right') - pressed(2, 'left') + pad.x),
        ),
        z = Math.max(
          -1,
          Math.min(1, pressed(1, 'back') - pressed(0, 'forward') + pad.z),
        ),
        turn = Math.max(
          -1,
          Math.min(
            1,
            pressed(4, 'turnLeft') - pressed(5, 'turnRight') + pad.turn,
          ),
        );
      const demand = mecanumDemand(
          r.place ? 0 : x,
          r.place ? 0 : z,
          r.place ? 0 : turn,
          r.yaw,
        ),
        speed =
          k.has(p === 0 ? 'ShiftLeft' : 'ShiftRight') || pad.precision
            ? 0.65
            : 2.1;
      const vel = r.body.linvel(),
        onFloor = r.body.translation().y < 0.13;
      if (onFloor) {
        const impulse = driveImpulse(
          vel,
          { x: demand.x * speed, z: demand.z * speed },
          r.body.mass(),
          DT,
        );
        r.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
        r.body.applyTorqueImpulse(
          {
            x: 0,
            y: Math.max(
              -0.025,
              Math.min(0.025, (demand.turn * 2.7 - r.body.angvel().y) * 0.045),
            ),
            z: 0,
          },
          true,
        );
      }
      this.aim(r);
      const turretInput =
        pressed(6, 'turretLeft') - pressed(7, 'turretRight') + pad.turret;
      const t = turretStep(
        r.turretAngle,
        r.turretVelocity,
        turretInput,
        r.nudge !== null
          ? r.nudge
          : r.assist
            ? wrapAngle(r.targetYaw - r.yaw)
            : null,
        DT,
      );
      r.turretAngle = t.angle;
      r.turretVelocity = t.velocity;
      r.spin += (1 - r.spin) * (1 - Math.exp(-DT / 0.22));
      const aligned =
        !r.assist ||
        Math.abs(wrapAngle(r.yaw + r.turretAngle - r.targetYaw)) < 0.045;
      const h = this.hiveFor(r),
        local = this.localToHive(h, r.body.translation());
      r.status = !r.inventory.length
        ? 'Magazine empty'
        : r.place
          ? 'Lift placing a piece'
          : h.tipping
            ? 'Hive moving · wait for the new opening'
            : r.spin < 0.92
              ? 'Flywheel spinning up'
              : !aligned
                ? 'Turret aligning'
                : h.active * local.z < CELL.outer + 0.1
                  ? 'Move in front of the raised cell'
                  : r.ballistics
                    ? 'Hive solution ready · Space / R2'
                    : 'Manual launch settings';
      if (
        (r.queued || pad.shoot || k.has(p === 0 ? 'Space' : 'Enter')) &&
        r.inventory.length &&
        r.spin > 0.92 &&
        aligned &&
        !h.tipping
      )
        this.launch(r);
      this.intake(r);
      this.updateLift(r);
    }
    // Parked robots still collide and brake; no automatic driving or scoring.
    for (const r of this.robots.filter(
      (r) => !this.ids.slice(0, this.players).includes(r.id),
    )) {
      const impulse = driveImpulse(
        r.body.linvel(),
        { x: 0, z: 0 },
        r.body.mass(),
        DT,
      );
      r.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
      r.body.setAngvel({ x: 0, y: r.body.angvel().y * 0.95, z: 0 }, true);
    }
  }
  updateHives() {
    for (const h of this.hives) {
      const pieces = this.cellBalls(h);
      h.load = pollenEquivalent(pieces.map((b) => b.kind));
      if (!h.tipping) {
        h.triggerTime = shouldTip(pieces.map((b) => b.kind))
          ? h.triggerTime + DT
          : 0;
        if (h.triggerTime > 0.065) {
          h.tipping = true;
          h.target = -h.target;
          h.triggerTime = 0;
          this.message = `${h.alliance === 'red' ? 'Red' : 'Blue'} hive tipping · stand clear for falling pieces`;
        }
      }
      if (h.tipping) {
        // Finite inertia and damping between the two calibrated stable stops.
        // Kinematic colliders transfer this motion to real free rigid bodies.
        const torque = (h.target - h.angle) * 28 - h.velocity * 5.8;
        h.velocity += torque * DT;
        h.velocity = Math.max(-2.1, Math.min(2.1, h.velocity));
        h.angle += h.velocity * DT;
        if (
          Math.abs(h.target - h.angle) < 0.009 &&
          Math.abs(h.velocity) < 0.14
        ) {
          h.angle = h.target;
          h.velocity = 0;
          h.tipping = false;
          h.active *= -1;
          h.tips++;
          this.message = `${h.alliance === 'red' ? 'Red' : 'Blue'} hive tipped · +20 points · nectar unlocked`;
        }
        h.angle = Math.max(-HIVE_LIMIT, Math.min(HIVE_LIMIT, h.angle));
      }
      h.body.setNextKinematicRotation(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          h.angle,
        ),
      );
    }
  }
  updateBalls() {
    for (const b of this.balls) {
      if (b.state !== 'free') continue;
      const p = b.body.translation(),
        v = b.body.linvel();
      b.previous.set(p.x, p.y, p.z);
      if (p.y < radiusOf(b.kind) + 0.015 && Math.abs(v.y) < 0.35)
        b.grounded = true;
      // Aerodynamic drag integrated consistently with the trajectory preview.
      const next = flightStep(p, v, b.kind, DT).velocity;
      b.body.setLinvel({ x: next.x, y: next.y + 9.81 * DT, z: next.z }, false);
      if (p.y < radiusOf(b.kind) + 0.009) {
        const rolling = Math.exp(-0.65 * DT);
        b.body.setLinvel(
          { x: next.x * rolling, y: next.y + 9.81 * DT, z: next.z * rolling },
          false,
        );
      }
      // Field-staff return: keep all 56 pieces, never manufacture replacements.
      if (p.y < -0.3 || Math.abs(p.x) > H + 0.38 || Math.abs(p.z) > H + 0.38) {
        const x = Math.max(-H + 0.08, Math.min(H - 0.08, p.x)),
          z = Math.max(-H + 0.08, Math.min(H - 0.08, p.z));
        b.body.setTranslation({ x, y: radiusOf(b.kind) + 0.01, z }, true);
        b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.grounded = true;
        this.message = 'Out-of-bounds piece returned by field staff';
      }
    }
    for (const f of this.flowers) {
      f.balls = this.balls
        .filter((b) => {
          if (b.state !== 'free') return false;
          const p = b.body.translation(),
            r = radiusOf(b.kind);
          return (
            Math.hypot(p.x - f.x, p.z - f.z) < FLOWER_RADIUS + r * 0.35 &&
            p.y + r > FLOWER_MIDDLE &&
            p.y - r < FLOWER_TOP
          );
        })
        .sort((a, b) => a.body.translation().y - b.body.translation().y);
      const owner = flowerScore(f.balls.map((b) => b.kind)).owner;
      (f.ring.material as THREE.MeshStandardMaterial).color.setHex(
        owner ? COLORS[owner] : 0xddb64f,
      );
    }
  }
  updateTrajectory() {
    const r = this.robots[this.ids[this.selected]];
    if (!r) return;
    this.aim(r);
    const start = this.muzzle(r),
      kind = r.inventory[0]?.kind ?? 'pollen';
    let p = { x: start.x, y: start.y, z: start.z },
      v = this.shotVelocity(r);
    const points = [start];
    for (let i = 0; i < 200; i++) {
      const n = flightStep(p, v, kind, DT);
      p = n.position;
      v = v3(n.velocity);
      if (i % 3 === 0) points.push(v3(p));
      if (p.y < 0.025) break;
    }
    this.trajectory.geometry.dispose();
    this.trajectory.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.trajectory.computeLineDistances();
    const h = this.hiveFor(r);
    this.targetRing.position.copy(
      this.hivePoint(
        h,
        new THREE.Vector3(0, 0.13, h.active * (CELL.outer + 0.008)),
      ),
    );
    this.targetRing.quaternion.copy(h.body.rotation() as THREE.Quaternion);
    this.targetRing.visible = r.assist && !h.tipping;
  }
  updateIdleControls(dt: number) {
    for (let p = 0; p < this.players; p++) {
      const r = this.robots[this.ids[p]],
        pad = this.pad(p, r);
      this.aim(r);
      const left =
          r.controls.has('turretLeft') ||
          this.keys.has(p === 0 ? 'KeyZ' : 'KeyO'),
        right =
          r.controls.has('turretRight') ||
          this.keys.has(p === 0 ? 'KeyX' : 'KeyP');
      const result = turretStep(
        r.turretAngle,
        r.turretVelocity,
        Number(left) - Number(right) + pad.turret,
        r.nudge !== null
          ? r.nudge
          : r.assist
            ? wrapAngle(r.targetYaw - r.yaw)
            : null,
        dt,
      );
      r.turretAngle = result.angle;
      r.turretVelocity = result.velocity;
    }
  }
  sync() {
    for (const r of this.robots) {
      r.mesh.position.copy(v3(r.body.translation()));
      r.mesh.quaternion.copy(r.body.rotation() as THREE.Quaternion);
      r.turret.rotation.y = r.turretAngle;
      r.barrel.rotation.x = (r.elevation * Math.PI) / 180;
      for (let i = 0; i < r.inventory.length; i++) {
        const b = r.inventory[i];
        const local =
          r.place && !r.place.released && i === 0
            ? r.lift.position
                .clone()
                .add(new THREE.Vector3(0, radiusOf(b.kind) + 0.014, 0))
            : new THREE.Vector3(
                ((i % 2) - 0.5) * 0.098,
                0.19,
                Math.floor(i / 2) * 0.1 + 0.005,
              );
        b.mesh.position.copy(r.mesh.localToWorld(local));
        b.mesh.visible = true;
      }
      const speed = r.body.linvel();
      for (let i = 0; i < r.rollers.length; i++)
        r.rollers[i].rotation.y +=
          i === 4 ? (r.intake ? 0.12 : 0) : Math.hypot(speed.x, speed.z) * 0.02;
    }
    for (const h of this.hives) {
      h.mesh.position.copy(v3(h.body.translation()));
      h.mesh.quaternion.copy(h.body.rotation() as THREE.Quaternion);
    }
    for (const b of this.balls) {
      if (b.state === 'free') {
        b.mesh.position.copy(v3(b.body.translation()));
        b.mesh.quaternion.copy(b.body.rotation() as THREE.Quaternion);
        b.mesh.visible = true;
      } else if (b.state === 'reserve') {
        const hive = this.hives.find((h) => h.reserve.includes(b));
        if (hive) {
          const sign = hive.alliance === 'red' ? -1 : 1,
            index = hive.reserve.indexOf(b);
          b.mesh.position.set(sign * 2.03, 0.06, (index - 2) * 0.1);
          b.mesh.visible = true;
        } else b.mesh.visible = false;
      }
    }
  }
  step(advanceClock = true) {
    this.elapsed += DT;
    if (this.settling === 0) this.updateRobots();
    else
      for (const r of this.robots) {
        const impulse = driveImpulse(
          r.body.linvel(),
          { x: 0, z: 0 },
          r.body.mass(),
          DT,
        );
        r.body.applyImpulse({ x: impulse.x, y: 0, z: impulse.z }, true);
        r.body.setAngvel({ x: 0, y: r.body.angvel().y * 0.8, z: 0 }, true);
      }
    this.updateBalls();
    this.updateHives();
    this.world.step();
    if (this.settling > 0) {
      this.settling -= DT;
      if (this.settling <= 0) {
        this.running = false;
        this.ended = true;
        this.settling = 0;
        this.message =
          'Session complete · final scores include flowers, gardens, cells, and parking';
      }
    } else if (advanceClock) this.advanceClock(DT);
  }
  advanceClock(seconds: number) {
    if (!this.timed || this.time <= 0 || this.settling > 0) return;
    const previous = this.time;
    this.time = Math.max(0, this.time - seconds);
    if (previous > 60 && this.time <= 60)
      this.message =
        'Final minute · flowers open and all remaining nectar is available';
    if (this.time === 0) {
      this.settling = 4;
      this.keys.clear();
      this.robots.forEach((r) => {
        r.queued = false;
        r.controls.clear();
      });
      this.message = 'Time! Waiting for balls and hives to settle…';
    }
  }
  tick = (now: number) => {
    if (this.disposed) return;
    if (document.hidden) {
      this.previousTime = now;
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    const wallDt = (now - (this.previousTime || now)) / 1000;
    const dt = Math.min(0.05, wallDt);
    this.previousTime = now;
    if (this.running) {
      this.advanceClock(wallDt);
      this.accumulator += dt;
      while (this.accumulator >= DT) {
        this.step(false);
        this.accumulator -= DT;
        if (!this.running) break;
      }
    } else {
      this.accumulator = 0;
      this.updateIdleControls(dt);
    }
    this.sync();
    this.updateView(dt);
    this.renderer.render(this.scene, this.camera);
    this.emitClock += dt;
    if (this.emitClock > 0.1) {
      this.emitClock = 0;
      this.updateTrajectory();
      this.emit();
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  updateView(dt: number) {
    const r = this.robots[this.ids[this.selected]],
      pos = v3(r.body.translation());
    if (this.view === 'Top') {
      this.camera.position.lerp(
        new THREE.Vector3(0, 7.6, 0.001),
        1 - Math.exp(-dt * 5),
      );
      this.camera.lookAt(0, 0, 0);
    } else if (this.view === 'Follow') {
      const behind = new THREE.Vector3(0, 1.6, 2.4)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw)
        .add(pos);
      this.camera.position.lerp(behind, 1 - Math.exp(-dt * 5));
      this.camera.lookAt(pos.x, pos.y + 0.4, pos.z);
    } else this.orbit.update();
  }
  emit() {
    const score = { red: 0, blue: 0 },
      tips = { red: 0, blue: 0 },
      load = { red: 0, blue: 0 },
      nectar = { red: 0, blue: 0 };
    for (const h of this.hives) {
      tips[h.alliance] = h.tips;
      load[h.alliance] = h.load;
      nectar[h.alliance] = nectarAvailable(
        h.tips,
        h.entered,
        this.time,
        this.timed,
      );
      score[h.alliance] = h.tips * 20 + this.cellBalls(h).length * 2;
    }
    for (const f of this.flowers) {
      const value = flowerScore(f.balls.map((b) => b.kind));
      score.red += value.red;
      score.blue += value.blue;
    }
    for (const b of this.balls) {
      if (
        b.state !== 'free' ||
        b.body.translation().y > radiusOf(b.kind) + 0.08
      )
        continue;
      const p = b.body.translation();
      for (const a of ['red', 'blue'] as const)
        if (inGarden(p.x, p.z, radiusOf(b.kind), a)) score[a]++;
    }
    for (const r of this.robots) {
      const p = r.body.translation(),
        extent =
          0.195 * (Math.abs(Math.sin(r.yaw)) + Math.abs(Math.cos(r.yaw)));
      if (inLoading(p.x, p.z, allianceOf(r.id), extent))
        score[allianceOf(r.id)] += 5;
    }
    this.cb({
      ready: true,
      running: this.running,
      ended: this.ended,
      time: this.time,
      timed: this.timed,
      players: this.players,
      ids: [...this.ids],
      score,
      tips,
      load,
      nectar,
      flowers: this.flowers.map((f) => {
        const v = flowerScore(f.balls.map((b) => b.kind));
        return { count: f.balls.length, owner: v.owner, bottom: v.bottom };
      }),
      robots: this.ids.slice(0, this.players).map((id) => {
        const r = this.robots[id];
        return {
          inventory: r.inventory.map((b) => b.kind),
          intake: r.intake,
          turret: (r.turretAngle * 180) / Math.PI,
          power: r.power,
          elevation: r.elevation,
          assist: r.assist,
          speed: Math.hypot(r.body.linvel().x, r.body.linvel().z),
          status: r.status,
          controller: r.controller,
        };
      }),
      message: this.message,
      view: this.view,
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.orbit.dispose();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        for (const mat of Array.isArray(m.material)
          ? m.material
          : [m.material]) {
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) value.dispose();
          mat.dispose();
        }
      }
    });
    this.world.free();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

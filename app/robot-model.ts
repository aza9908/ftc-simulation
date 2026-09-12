import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type RobotModel = {
  root: THREE.Group;
  turret?: THREE.Group;
  name: string;
  triangles: number;
  launcherHeight: number;
};

// Inspect the container before the loader can resolve resources. Imports are
// self-contained, session-local files; no remote URLs or decoder CDNs are used.
export function validateGlb(data: ArrayBuffer) {
  if (data.byteLength > 30 * 1024 * 1024)
    throw new Error('Choose a GLB smaller than 30 MB.');
  if (data.byteLength < 20) throw new Error('This is not a valid GLB file.');
  const v = new DataView(data);
  if (
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== data.byteLength ||
    v.getUint32(16, true) !== 0x4e4f534a
  )
    throw new Error('Export glTF Binary (.glb) from Blender.');
  const length = v.getUint32(12, true);
  if (length > data.byteLength - 20)
    throw new Error('The GLB file is incomplete.');
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(data, 20, length)),
  );
  for (const resource of [...(json.buffers || []), ...(json.images || [])])
    if (resource.uri)
      throw new Error('Embed all textures and buffers in the GLB export.');
  if (
    (json.extensionsUsed || []).some((e: string) =>
      /draco|meshopt|basisu/i.test(e),
    )
  )
    throw new Error(
      'Export without Draco, Meshopt or KTX texture compression.',
    );
  if (json.skins?.length)
    throw new Error(
      'Use rigid mesh parts instead of an armature for this robot.',
    );
  if ((json.nodes?.length || 0) > 2000)
    throw new Error('Simplify the model to fewer than 2,000 objects.');
  if (
    (json.accessors || []).some(
      (a: { count: number }) =>
        !Number.isFinite(a.count) || a.count > 1_000_000,
    )
  )
    throw new Error('Simplify the model before exporting.');
  return json;
}

export function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m);
      for (const value of Object.values(m))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const g of geometries) g.dispose();
  const images = new Set(Array.from(textures, (t) => t.source.data));
  for (const t of textures) t.dispose();
  for (const image of images)
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
      image.close();
  for (const m of materials) m.dispose();
  root.removeFromParent();
}

export function prepareRobotModel(
  scene: THREE.Group,
  name: string,
): RobotModel {
  let triangles = 0;
  const remove: THREE.Object3D[] = [];
  scene.traverse((o) => {
    o.userData.importedRobot = true;
    if (o instanceof THREE.Light || o instanceof THREE.Camera) remove.push(o);
    if (!(o instanceof THREE.Mesh)) return;
    const positions = o.geometry.getAttribute('position');
    if (!positions) throw new Error('The model has missing mesh positions.');
    triangles +=
      ((o.geometry.index?.count || positions.count) / 3) *
      (o instanceof THREE.InstancedMesh ? o.count : 1);
    for (const n of positions.array)
      if (!Number.isFinite(n))
        throw new Error('The model contains invalid geometry.');
    o.castShadow = true;
    o.receiveShadow = true;
  });
  for (const o of remove) o.removeFromParent();
  if (!triangles || triangles > 300_000)
    throw new Error('Use a mesh model with fewer than 300,000 triangles.');
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  if (
    ![size.x, size.y, size.z].every(Number.isFinite) ||
    Math.min(size.x, size.y, size.z) < 1e-6
  )
    throw new Error('Export a complete three-dimensional robot.');
  const root = new THREE.Group();
  root.name = 'custom-robot';
  root.userData.importedRobot = true;
  const fit = new THREE.Group();
  const scale = Math.min(0.44 / size.x, 0.44 / size.z, 0.48 / size.y);
  fit.scale.setScalar(scale);
  fit.position.set(
    -(bounds.min.x + size.x / 2) * scale,
    -0.125 - bounds.min.y * scale,
    -(bounds.min.z + size.z / 2) * scale,
  );
  fit.add(scene);
  root.add(fit);
  root.updateMatrixWorld(true);
  let turretNode: THREE.Object3D | undefined;
  scene.traverse((o) => {
    if (o.name.toLowerCase() === 'turret' && !turretNode) turretNode = o;
  });
  let turret: THREE.Group | undefined;
  if (turretNode) {
    turret = new THREE.Group();
    turret.name = 'imported-turret-pivot';
    turret.position.copy(turretNode.getWorldPosition(new THREE.Vector3()));
    root.add(turret);
    root.updateMatrixWorld(true);
    // A separate Y-axis pivot preserves Blender's export transforms and origin.
    turret.attach(turretNode);
  }
  return {
    root,
    turret,
    name,
    triangles: Math.round(triangles),
    launcherHeight: Math.max(0.24, -0.125 + size.y * scale + 0.025),
  };
}

export async function readRobotModel(file: File) {
  if (!file.name.toLowerCase().endsWith('.glb'))
    throw new Error('Choose a .glb export, not the .blend project file.');
  if (file.size > 30 * 1024 * 1024)
    throw new Error('Choose a GLB smaller than 30 MB.');
  const data = await file.arrayBuffer();
  validateGlb(data);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!url.startsWith('blob:'))
      throw new Error('Only embedded GLB resources are supported.');
    return url;
  });
  const gltf = await new GLTFLoader(manager).parseAsync(data, '');
  try {
    return prepareRobotModel(gltf.scene, file.name);
  } catch (error) {
    disposeModel(gltf.scene);
    throw error;
  }
}

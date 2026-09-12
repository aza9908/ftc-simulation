import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { readRobotModel, disposeModel } from '../work/robot-model.mjs';
import { ROBOT_LIBRARY, DEFAULT_ROBOT_MODELS } from '../work/robot-library.mjs';
for (const entry of ROBOT_LIBRARY) {
  const bytes = fs.readFileSync(`public${entry.file}`);
  assert(bytes.length < 10 * 1024 * 1024, 'bundled CAD stays under 10 MB');
  const model = await readRobotModel(new File([bytes], `${entry.id}.glb`));
  assert(model.triangles > 10_000 && model.triangles < 300_000);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert(
    Math.abs(bounds.min.y + 0.125) < 0.00001,
    'robot rests on the chassis floor',
  );
  assert(size.x <= 0.44001 && size.z <= 0.44001 && size.y <= 0.48001);
  assert(
    model.launcherHeight > bounds.max.y,
    'simulator turret clears the CAD',
  );
  console.log(
    `PASS: ${entry.name}: ${model.triangles.toLocaleString()} triangles, ${(bytes.length / 1048576).toFixed(1)} MB, correct floor fit and turret clearance`,
  );
  disposeModel(model.root);
}
assert.equal(DEFAULT_ROBOT_MODELS.length, 4);
assert(
  DEFAULT_ROBOT_MODELS.every((id) =>
    ROBOT_LIBRARY.some((entry) => entry.id === id),
  ),
);

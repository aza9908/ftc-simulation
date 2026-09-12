import * as THREE from 'three';
// Pixel grids copied from AprilRobotics/apriltag-imgs (36h11 IDs 20, 24).
// FIRST DECODE TU32 §9.10 assigns these to blue and red goals respectively.
const tags: Record<20 | 24, string[]> = {
  20: [
    '1111111111',
    '1000000001',
    '1010000001',
    '1001110101',
    '1010100101',
    '1000100101',
    '1001001001',
    '1010111101',
    '1000000001',
    '1111111111',
  ],
  24: [
    '1111111111',
    '1000000001',
    '1010100001',
    '1010110001',
    '1010101001',
    '1011110001',
    '1010001001',
    '1001110001',
    '1000000001',
    '1111111111',
  ],
};
export function goalTagTexture(id: 20 | 24) {
  // DataTexture starts at the bottom-left; source PNG rows start at the top.
  const pixels = tags[id].slice().reverse().join('');
  const data = new Uint8Array(10 * 10 * 4);
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i] === '1' ? 255 : 0;
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, 10, 10);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

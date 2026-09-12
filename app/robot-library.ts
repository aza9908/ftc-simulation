export const ROBOT_LIBRARY = [
  {
    id: 'sideswipe-v3',
    name: 'Sideswipe V3',
    origin: 'Adrian Contraș · Romania',
    detail: 'DECODE competition design · coaxial swerve',
    source: 'https://github.com/adisimaimulte1/ftc-cad-archive',
    file: '/models/sideswipe-v3.glb',
    credit:
      'Original CAD © 2026 Adrian Contraș. Optimized simulator adaptation; educational, non-commercial use. No endorsement implied.',
  },
  {
    id: 'cicada-matrix',
    name: 'Cicada × Matrix',
    origin: 'Teams 31678 & 19348 · Libya',
    detail: 'DECODE 30-hour CAD concept · mecanum',
    source:
      'https://github.com/cicadaroboticsteam-art/FTC-Decode-30-hours-Robot-matrix-cicada-',
    file: '/models/cicada-matrix.glb',
    credit:
      'Original CAD by Team Cicada and Team Matrix, released under the Unlicense. Optimized simulator adaptation.',
  },
] as const;

export type LibraryId = (typeof ROBOT_LIBRARY)[number]['id'];
export type ModelStatus = {
  id: string;
  name: string;
  state: 'loading' | 'ready' | 'error';
  error?: string;
};
export const DEFAULT_ROBOT_MODELS: LibraryId[] = [
  'sideswipe-v3',
  'cicada-matrix',
  'sideswipe-v3',
  'cicada-matrix',
];

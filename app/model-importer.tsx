'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import type { Simulator } from './simulator';
import { ROBOT_LIBRARY, type ModelStatus } from './robot-library';

export function ModelImporter({
  getSimulator,
  ready,
  models = [],
}: {
  getSimulator: () => Simulator | null;
  ready: boolean;
  models?: ModelStatus[];
}) {
  const [robot, setRobot] = useState(0);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const names = ['Blue 1', 'Blue 2', 'Red 1', 'Red 2'];
  const model = models[robot];
  const busy = model?.state === 'loading';
  const run = async (operation: () => Promise<unknown>) => {
    setError('');
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load this model. Try again.',
      );
    }
  };
  return (
    <details className="model-importer robot-library">
      <summary>
        Real FTC robot library <span>2 designs · already on the field</span>
      </summary>
      <div className="model-import-body">
        <div className="library-select">
          <label>
            Change model for
            <select
              value={robot}
              onChange={(e) => {
                setRobot(Number(e.target.value));
                setError('');
              }}
            >
              {names.map((name, id) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <output>
            {busy
              ? 'Loading CAD model…'
              : model?.state === 'ready'
                ? model.name
                : 'Model unavailable'}
          </output>
        </div>
        <div className="robot-library-grid">
          {ROBOT_LIBRARY.map((item) => (
            <article
              key={item.id}
              className={
                model?.id === item.id && model.state === 'ready'
                  ? 'selected'
                  : ''
              }
            >
              <Image
                unoptimized
                width={220}
                height={180}
                src={`/models/${item.id}.${item.id === 'sideswipe-v3' ? 'webp' : 'jpg'}`}
                alt={`${item.name} source CAD design`}
                loading="lazy"
              />
              <div className="library-card-content">
                <h3>{item.name}</h3>
                <p>{item.origin}</p>
                <small>{item.detail}</small>
                <button
                  disabled={!ready || busy}
                  onClick={() =>
                    run(async () =>
                      getSimulator()?.selectRobotModel(robot, item.id),
                    )
                  }
                >
                  {model?.id === item.id && model.state === 'ready'
                    ? `On ${names[robot]} · reload`
                    : `Use on ${names[robot]}`}
                </button>
                <a href={item.source} target="_blank" rel="noreferrer">
                  Original CAD & designer ↗
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="hint">
          Real team CAD, optimized for this simulator. A simulator turret is
          fitted above each design. Both use the same training drivetrain and
          collision model.
        </p>
        <p className="model-credit">
          {ROBOT_LIBRARY.find((item) => item.id === model?.id)?.credit}{' '}
          <a href="/models/CREDITS.md" target="_blank" rel="noreferrer">
            Credits & licenses
          </a>
        </p>
        {(error || model?.state === 'error') && (
          <p className="model-import-error" role="alert">
            {error || model?.error} The previous robot stays available; choose a
            model to retry.
          </p>
        )}
        <details className="custom-model-import">
          <summary>Import your own Blender model</summary>
          <div className="model-import-actions">
            <button
              disabled={!ready || busy}
              onClick={() => fileInput.current?.click()}
            >
              Choose GLB
            </button>
            <button
              disabled={!ready || busy || !model || model.id === 'training'}
              onClick={() => getSimulator()?.rotateRobotModel(robot)}
            >
              Rotate model 90°
            </button>
            <button
              disabled={!ready || busy}
              onClick={() => getSimulator()?.removeRobotModel(robot)}
            >
              Use training chassis
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".glb,model/gltf-binary"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void run(async () =>
                    getSimulator()?.importRobotModel(robot, file),
                  );
              }}
            />
          </div>
          <p className="hint">
            Blender → Export → glTF 2.0 → GLB, with embedded textures and
            compression off. Maximum 30 MB / 300,000 triangles. Name a movable
            turret group <b>Turret</b> and place its origin at the joint. Custom
            uploads last until reload. Model changes pause play.
          </p>
        </details>
      </div>
    </details>
  );
}

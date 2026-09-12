'use client';
import { useRef, useState } from 'react';
import type { Simulator } from './simulator';

type Info = { name: string; turret: boolean; triangles: number };
export function ModelImporter({
  getSimulator,
  ready,
}: {
  getSimulator: () => Simulator | null;
  ready: boolean;
}) {
  const [robot, setRobot] = useState(0);
  const [models, setModels] = useState<Record<number, Info>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const names = ['Blue 1', 'Blue 2', 'Red 1', 'Red 2'];
  const model = models[robot];
  return (
    <details className="model-importer">
      <summary>
        Blender robot models <span>Import .glb</span>
      </summary>
      <div className="model-import-body">
        <p>Give any of the four robots your own Blender model.</p>
        <div className="model-import-actions">
          <label>
            Robot
            <select
              value={robot}
              disabled={busy}
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
          <button
            disabled={!ready || busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? 'Importing…' : model ? 'Replace model' : 'Import GLB'}
          </button>
          {model && (
            <>
              <button
                disabled={busy}
                onClick={() => getSimulator()?.rotateRobotModel(robot)}
              >
                Rotate model 90°
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  getSimulator()?.removeRobotModel(robot);
                  setModels((all) => {
                    const next = { ...all };
                    delete next[robot];
                    return next;
                  });
                  setError('');
                }}
              >
                Restore default
              </button>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".glb,model/gltf-binary"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              const engine = getSimulator();
              if (!file || !engine) return;
              setBusy(true);
              setError('');
              try {
                const result = await engine.importRobotModel(robot, file);
                if (result) setModels((all) => ({ ...all, [robot]: result }));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'Could not import this model. Try another GLB.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
        <p className="model-import-status" role="status" aria-live="polite">
          {busy
            ? `Loading ${names[robot]} model…`
            : model
              ? `${model.name} · ${model.triangles.toLocaleString()} triangles · ${model.turret ? 'Custom turret connected' : 'Default turning turret retained'}`
              : 'Default robot model'}
        </p>
        {error && (
          <p className="model-import-error" role="alert">
            {error}
          </p>
        )}
        <ol>
          <li>
            In Blender: File → Export → glTF 2.0 → glTF Binary (.glb). Embed
            textures and turn compression off.
          </li>
          <li>
            For a turning turret, parent its parts to an object named{' '}
            <b>Turret</b>, with its origin at the rotation joint. Face the robot
            forward; use Rotate model if needed.
          </li>
        </ol>
        <p className="hint">
          30 MB / 300,000 triangles maximum. Models fit the robot automatically
          and last until page reload. Import pauses play. This changes
          appearance; chassis collisions, intake and launch position keep the
          simulator’s standard dimensions.
        </p>
      </div>
    </details>
  );
}

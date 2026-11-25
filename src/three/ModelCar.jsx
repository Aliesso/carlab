import { memo, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Part } from './Part';
import { buildModel, PIVOT, resolveAnchor, surfaceAnchor } from './buildModel';

/* The selected car's GLB, cut into parts that fly in on scroll (see src/cars/*.js). */
export const ModelCar = memo(function ModelCar({ car, onAnchors, onReady }) {
  const gltf = useGLTF(car.url);
  const parts = useMemo(() => buildModel(gltf.scene, car), [gltf, car]);
  // free the per-triangle split geometry when this car is swapped out
  useEffect(
    () => () => {
      for (const p of Object.values(parts)) for (const m of p.meshes) if (m.geo.userData.generated) m.geo.dispose();
    },
    [parts],
  );

  const defs = useMemo(() => {
    const out = car.defs
      .filter((d) => parts[d.key])
      .map((d) => ({ ...d, part: parts[d.key], pivot: PIVOT[d.pivot ?? 'center'](parts[d.key]) }));
    // anything no definition covers still shows up with the body
    for (const k of Object.keys(parts)) {
      if (!out.find((d) => d.key === k)) {
        const step = car.defs.find((d) => d.key === 'rest')?.step ?? 4;
        out.push({ key: k, step, from: [0, 3, 0], part: parts[k], pivot: PIVOT.center(parts[k]) });
      }
    }
    return out;
  }, [parts, car]);

  useEffect(() => {
    const anchors = {};
    for (const s of car.steps)
      anchors[s.key] = s.callouts.map(
        (c) => (c.part ? surfaceAnchor(parts, c.part, c.at, s.cam.p) : resolveAnchor(parts, c.pick)) ?? [0, -50, 0],
      );
    onAnchors?.(anchors);
    onReady?.();
  }, [parts, car, onAnchors, onReady]);

  return (
    <group>
      {defs.map((d) => (
        <Part
          key={d.key}
          step={d.step}
          delay={d.delay}
          from={d.from}
          rot={d.rot}
          pivot={d.pivot}
          ghost={d.part.ghost.length ? d.part.ghost : undefined}
          ghostColor={car.theme.accent}
        >
          <primitive object={d.part.object} />
        </Part>
      ))}
    </group>
  );
});

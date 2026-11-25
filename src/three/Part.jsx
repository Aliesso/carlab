import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { clamp, easeOut, partT, smooth } from '../store';
import { makeGhostMaterial } from './materials';

const onLayer1 = (o) => o && o.layers.set(1);

/*
  A car part that flies in from `from` (offset) with `rot` (euler) and seats
  at its real position as its build step is scrolled into view.
  `pivot` is the point it rotates around (e.g. a door hinge).
  `ghost` = geometries rendered as a hologram at the target until it lands.
*/
export function Part({ step, delay = 0, from = [0, 3, 0], rot = [0, 0, 0], pivot = [0, 0, 0], ghost, ghostColor, children }) {
  const ref = useRef();
  const gref = useRef();
  const mat = useMemo(() => (ghost ? makeGhostMaterial(ghostColor) : null), [ghost, ghostColor]);

  useFrame((state) => {
    const t = partT(step, delay);
    const o = ref.current;
    o.visible = t > 0.001;
    const k = 1 - easeOut(t);
    const lift = Math.sin(t * Math.PI) * 0.18;
    o.position.set(pivot[0] + from[0] * k, pivot[1] + from[1] * k + lift, pivot[2] + from[2] * k);
    o.rotation.set(rot[0] * k, rot[1] * k, rot[2] * k);
    if (mat) {
      const op = 1 - smooth(clamp(t * 1.6));
      mat.uniforms.uOpacity.value = op;
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      gref.current.visible = op > 0.004;
    }
  });

  return (
    <>
      <group ref={ref} visible={false}>
        <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
      </group>
      {ghost && (
        <group ref={gref}>
          {ghost.map((g, i) => (
            <mesh
              key={i}
              ref={onLayer1}
              geometry={g.geo ?? g}
              position={g.pos}
              rotation={g.rot}
              matrixAutoUpdate={!g.matrix}
              matrix={g.matrix}
              material={mat}
              renderOrder={5}
            />
          ))}
        </group>
      )}
    </>
  );
}

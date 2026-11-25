import * as THREE from 'three';
import { M } from './materials';

/*
  Turns a named GLB into build parts using a car config:
    car.rules      [regex on node-name chain (+ material name), partKey]
                   'key*' splits by side (keyR/keyL), 'key#' by quadrant (keyFR…),
                   or a function ({xn, yn, zn}) => key run per triangle
    car.byMaterial optional (materialName) => partKey for meshes no rule matched
    car.paintMat   material name that becomes the selectable metallic paint
    car.frontNode  regex of a node that sits at the front (orientation check)
    car.ghostMats  regex of materials used for the hologram preview
  Everything is normalised to: length along +x (front), ground y = 0, length = car.length.
*/

function nameChain(o) {
  const a = [];
  for (let p = o; p; p = p.parent) if (p.name) a.push(p.name);
  return a.join(' ');
}

// re-group the triangles of one geometry by keyFn(world-space centroid) → Map(key → geometry)
function splitTriangles(geo, matrix, keyFn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const groups = new Map();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, i + k).applyMatrix4(matrix));
    const key = keyFn(c.multiplyScalar(1 / 3));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const out = new Map();
  for (const [key, tris] of groups) {
    const geoOut = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const size = attr.itemSize;
      const arr = new Float32Array(tris.length * 3 * size);
      let o = 0;
      for (const t of tris)
        for (let k = 0; k < 3; k++)
          for (let ci = 0; ci < size; ci++) arr[o++] = attr.getComponent(t + k, ci);
      geoOut.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.set(key, geoOut);
  }
  return out;
}

export function buildModel(scene, car) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const N = new THREE.Matrix4().makeTranslation(-ctr.x, -box.min.y, -ctr.z);
  if (size.z > size.x) N.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const s = car.length / Math.max(size.x, size.z);
  N.premultiply(new THREE.Matrix4().makeScale(s, s, s));

  const meshes = [];
  scene.traverse((o) => o.isMesh && o.visible && meshes.push(o));

  // front must point to +x
  const fb = new THREE.Box3();
  meshes.filter((m) => car.frontNode.test(nameChain(m))).forEach((m) => fb.expandByObject(m));
  if (!fb.isEmpty() && fb.getCenter(new THREE.Vector3()).applyMatrix4(N).x < 0) {
    N.premultiply(new THREE.Matrix4().makeRotationY(Math.PI));
  }

  // overall size after normalisation (for function rules)
  const nb = box.clone().applyMatrix4(N);
  const halfL = Math.max(-nb.min.x, nb.max.x);
  const halfW = Math.max(-nb.min.z, nb.max.z);
  const H = nb.max.y;

  const parts = {};
  const add = (key, geo, mat, matrix, ghost) => {
    parts[key] ??= { key, object: new THREE.Group(), box: new THREE.Box3(), meshes: [], ghost: [] };
    const p = parts[key];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(matrix);
    mesh.renderOrder = mat?.transparent ? 2 : 0;
    p.object.add(mesh);
    p.meshes.push({ geo, matrix });
    if (ghost) p.ghost.push({ geo, matrix });
    if (!geo.boundingBox) geo.computeBoundingBox();
    p.box.union(geo.boundingBox.clone().applyMatrix4(matrix));
  };

  for (const src of meshes) {
    const matName = src.material?.name ?? '';
    const chain = `${nameChain(src)} ${matName}`;
    let key = car.rules.find(([rx]) => rx.test(chain))?.[1] ?? car.byMaterial?.(matName) ?? 'rest';
    const matrix = new THREE.Matrix4().multiplyMatrices(N, src.matrixWorld);

    let mat = src.material;
    if (matName === car.paintMat) mat = M.paintSolid;
    else if (mat && !mat.userData.__tuned) {
      mat.envMapIntensity = 1.1;
      // transmission renders the whole scene again every frame — fake it with plain alpha
      if (mat.transmission > 0) {
        mat.transmission = 0;
        mat.transparent = true;
        mat.opacity = Math.min(mat.opacity, 0.45);
        mat.depthWrite = false;
      }
      mat.userData.__tuned = true;
    }
    const ghost = car.ghostMats.test(matName);

    // 'x*' → split by side (xR / xL); 'x#' → by quadrant (xFR, xFL, xBR, xBL);
    // a function → called per triangle with the centroid normalised (xn, zn ∈ [-1, 1], yn ∈ [0, 1])
    let keyFn = null;
    if (typeof key === 'function') {
      const fn = key;
      keyFn = (c) => fn({ xn: c.x / halfL, yn: c.y / H, zn: c.z / halfW });
    } else if (key.endsWith('*')) {
      const base = key.slice(0, -1);
      keyFn = (c) => base + (c.z >= 0 ? 'R' : 'L');
    } else if (key.endsWith('#')) {
      const base = key.slice(0, -1);
      keyFn = (c) => base + (c.x >= 0 ? 'F' : 'B') + (c.z >= 0 ? 'R' : 'L');
    }
    if (keyFn)
      for (const [k, g] of splitTriangles(src.geometry, matrix, keyFn)) {
        g.userData.generated = true; // ours to dispose (the GLB's own geometry stays cached)
        add(k, g, mat, matrix, ghost);
      }
    else add(key, src.geometry, mat, matrix, ghost);
  }
  return parts;
}

/* pivot helpers for part definitions */
export const PIVOT = {
  center: (p) => p.box.getCenter(new THREE.Vector3()).toArray(),
  // door hinge: front edge, inner face
  hinge: (p) => {
    const c = p.box.getCenter(new THREE.Vector3());
    return [p.box.max.x, c.y, c.z >= 0 ? p.box.min.z : p.box.max.z];
  },
  rearTop: (p) => [p.box.min.x, p.box.max.y, 0], // hood
  frontTop: (p) => [p.box.max.x, p.box.max.y, 0], // hatchback
  rearBottom: (p) => [p.box.min.x, p.box.min.y, 0], // tailgate
};

/* ---------- arrow anchors on the real geometry ---------- */
const tmp = new THREE.Vector3();
function extreme(part, dir) {
  const d = new THREE.Vector3(...dir).normalize();
  let best = -Infinity;
  const out = new THREE.Vector3();
  for (const { geo, matrix } of part.meshes) {
    const p = geo.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 4000));
    for (let i = 0; i < p.count; i += step) {
      tmp.fromBufferAttribute(p, i).applyMatrix4(matrix);
      const k = tmp.dot(d);
      if (k > best) { best = k; out.copy(tmp); }
    }
  }
  return out;
}

/*
  Precise anchor: `at` = [u, v, w] inside the part's bounding box
  (u: 0 rear → 1 front, v: 0 bottom → 1 top, w: 0 left → 1 right).
  A ray is cast from the step's camera through that point; the first surface of
  the part it hits is where the arrow lands — i.e. exactly what is seen on screen there.
*/
const raycaster = new THREE.Raycaster();
export function surfaceAnchor(parts, key, at, camPos) {
  const part = parts[key];
  if (!part) return null;
  const b = part.box;
  const target = new THREE.Vector3(
    THREE.MathUtils.lerp(b.min.x, b.max.x, at[0]),
    THREE.MathUtils.lerp(b.min.y, b.max.y, at[1]),
    THREE.MathUtils.lerp(b.min.z, b.max.z, at[2]),
  );
  part.object.updateMatrixWorld(true);
  const origin = new THREE.Vector3(...camPos);
  raycaster.set(origin, target.clone().sub(origin).normalize());
  raycaster.far = Infinity;
  const hit = raycaster.intersectObject(part.object, true)[0];
  if (hit) return hit.point.toArray();
  // the line of sight missed the part: fall back to the nearest surface vertex
  let best = Infinity;
  const out = new THREE.Vector3();
  for (const { geo, matrix } of part.meshes) {
    const p = geo.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 6000));
    for (let i = 0; i < p.count; i += step) {
      tmp.fromBufferAttribute(p, i).applyMatrix4(matrix);
      const d = tmp.distanceToSquared(target);
      if (d < best) { best = d; out.copy(tmp); }
    }
  }
  return out.toArray();
}

// spec: [partKey, [dx,dy,dz]] → outermost point in that direction
//       [partKey, 'side' | 'sideLow'] → centre of the part on its outer face
export function resolveAnchor(parts, spec) {
  const [key, how] = spec;
  const part = parts[key];
  if (!part) return null;
  if (how === 'side' || how === 'sideLow') {
    const c = part.box.getCenter(new THREE.Vector3());
    const z = c.z >= 0 ? part.box.max.z : part.box.min.z;
    const y = how === 'sideLow' ? part.box.min.y + (part.box.max.y - part.box.min.y) * 0.1 : c.y;
    return [c.x, y, z];
  }
  return extreme(part, how).toArray();
}

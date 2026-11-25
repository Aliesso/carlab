import { Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Grid, Html, Lightformer, Sparkles } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { ModelCar } from './ModelCar';
import { camsFor, sidesFor } from '../cars';
import { SECTIONS, clamp, partT, smooth, store } from '../store';

/* ---------------------------------------------------------------- camera */
const sph = new THREE.Spherical();
const sphA = new THREE.Spherical();
const sphB = new THREE.Spherical();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const sideShift = (s) => (s === 'l' ? 1 : s === 'r' ? -1 : 0); // +1 = car framed right (card on the left)

// ?instant → no scroll smoothing (used for screenshot tests)
const INSTANT = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('instant');

function wrapPi(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function CameraRig({ car }) {
  const KEYS = useMemo(() => camsFor(car).map((c) => ({ p: new THREE.Vector3(...c.p), t: new THREE.Vector3(...c.t) })), [car]);
  const SIDES = useMemo(() => sidesFor(car), [car]);
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    store.u += (store.target - store.u) * (1 - Math.exp(-dt * 4.5));
    if (INSTANT) store.u = store.target;
    const u = clamp(store.u, 0, SECTIONS - 1);
    const i = Math.min(Math.floor(u), SECTIONS - 2);
    const f = smooth(clamp((u - i - 0.12) / 0.76));
    const A = KEYS[i];
    const B = KEYS[i + 1];

    // interpolate on a sphere around the target so the camera never cuts through the car
    target.lerpVectors(A.t, B.t, f);
    sphA.setFromVector3(vA.copy(A.p).sub(A.t));
    sphB.setFromVector3(vB.copy(B.p).sub(B.t));
    sph.radius = THREE.MathUtils.lerp(sphA.radius, sphB.radius, f);
    sph.phi = THREE.MathUtils.lerp(sphA.phi, sphB.phi, f);
    sph.theta = sphA.theta + wrapPi(sphB.theta - sphA.theta) * f;

    // slow turntable on the hero and final sections
    const t = state.clock.elapsedTime;
    const fin = smooth(clamp(u - (SECTIONS - 2)));
    store.orbit += dt * 0.16 * fin;
    sph.theta += wrapPi(store.orbit) * fin + Math.sin(t * 0.25) * 0.06 * (1 - smooth(clamp(u)));

    // portrait screens: back off so the car fits
    const aspect = size.width / size.height;
    const portrait = aspect < 1;
    sph.radius *= portrait ? Math.min(2.2, 1.25 / aspect) : aspect < 1.35 ? 1.12 : 1;

    mouse.current.x += (store.mouse.x - mouse.current.x) * (1 - Math.exp(-dt * 3));
    mouse.current.y += (store.mouse.y - mouse.current.y) * (1 - Math.exp(-dt * 3));
    sph.theta -= mouse.current.x * 0.06;
    sph.phi = clamp(sph.phi + mouse.current.y * 0.04, 0.3, 1.52);

    pos.setFromSpherical(sph).add(target);
    camera.position.copy(pos);
    camera.lookAt(portrait ? target.clone().setY(target.y - 1.15) : target);

    // frame the car opposite the text card
    const sA = sideShift(SIDES[i]);
    const sB = sideShift(SIDES[i + 1]);
    const shift = portrait ? 0 : THREE.MathUtils.lerp(sA, sB, f);
    const frac = 0.17; // fraction of the screen width
    camera.filmOffset = -shift * frac * camera.getFilmWidth() * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    camera.updateProjectionMatrix();
  });
  return null;
}

/* -------------------------------------------------------------- callouts */
const proj = new THREE.Vector3();
const projC = new THREE.Vector3();
const CENTER = new THREE.Vector3(0, 0.62, 0);

function Callout({ at, label, value, index, visible, cardSide, v }) {
  const el = useRef();
  const { camera, size } = useThree();
  const last = useRef('');
  const mid = 'ah' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useFrame(() => {
    if (!el.current) return;
    proj.set(at[0], at[1], at[2]).project(camera);
    projC.copy(CENTER).project(camera);
    const px = (proj.x * 0.5 + 0.5) * size.width;
    let h = proj.x >= projC.x ? 'r' : 'l';
    const room = 300;
    if (h === 'l' && px < room) h = 'r';
    if (h === 'r' && px > size.width - room) h = 'l';
    if (size.width > 900) {
      if (cardSide === 'l' && h === 'l' && px - room < size.width * 0.42) h = 'r';
      if (cardSide === 'r' && h === 'r' && px + room > size.width * 0.58) h = 'l';
    }
    const vtc = v || (proj.y >= projC.y ? 'u' : 'd');
    const key = h + vtc;
    if (key !== last.current) {
      last.current = key;
      el.current.dataset.h = h;
      el.current.dataset.v = vtc;
    }
  });

  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className={`co${visible ? ' on' : ''}`} data-h="r" data-v="u" style={{ '--i': index }}>
        <span className="co-dot" />
        <svg className="co-line" width="120" height="64" viewBox="0 0 120 64" fill="none">
          <defs>
            <marker id={mid} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <path d="M8 56 L52 12 L120 12" pathLength="1" markerStart={`url(#${mid})`} />
        </svg>
        <div className="co-card">
          <span className="co-k">{String(index + 1).padStart(2, '0')}</span>
          <b>{label}</b>
          <small>{value}</small>
        </div>
      </div>
    </Html>
  );
}

function Callouts({ car, active, show, anchors }) {
  if (!anchors) return null;
  return car.steps.map((s, si) =>
    s.callouts.map((c, i) => (
      <Callout key={s.key + i} {...c} at={anchors[s.key][i]} index={i} visible={show && active === si + 1} cardSide={s.side} />
    )),
  );
}

/* ------------------------------------------------------- studio lighting */
function Studio() {
  return (
    <Environment resolution={512} frames={1} environmentIntensity={1}>
      {[-6, -3, 0, 3, 6].map((x) => (
        <Lightformer key={x} form="rect" intensity={2.4} rotation-x={Math.PI / 2} position={[x, 6, 0]} scale={[1.1, 14, 1]} />
      ))}
      <Lightformer form="rect" intensity={1.4} rotation-y={Math.PI / 2} position={[-10, 2, 0]} scale={[24, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.4} rotation-y={-Math.PI / 2} position={[10, 2, 0]} scale={[24, 2.2, 1]} />
      <Lightformer form="rect" color="#4fd8ff" intensity={2.2} position={[0, 1.5, -12]} scale={[26, 2.5, 1]} />
      <Lightformer form="rect" color="#ff8a4c" intensity={0.9} rotation-y={Math.PI} position={[0, 1, 12]} scale={[26, 1.6, 1]} />
      <Lightformer form="ring" intensity={3} position={[6, 5, 6]} scale={3} onUpdate={(o) => o.lookAt(0, 0, 0)} />
    </Environment>
  );
}

function Floor({ accent }) {
  const ring = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = 1 + ((t * 0.35) % 1) * 0.6;
    ring.current.scale.setScalar(s);
    ring.current.material.opacity = 0.35 * (1 - ((t * 0.35) % 1));
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#07080b" roughness={0.85} metalness={0.2} />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[40, 40]}
        cellSize={0.25}
        cellThickness={0.6}
        cellColor="#16202c"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#1f3b52"
        fadeDistance={22}
        fadeStrength={1.6}
        infiniteGrid
      />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <ringGeometry args={[3.2, 3.215, 128]} />
        <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <ringGeometry args={[3.2, 3.23, 128]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function Scene({ car, active, show, onModelReady }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const [anchors, setAnchors] = useState(null);
  return (
    <>
      <color attach="background" args={['#06070a']} />
      <fog attach="fog" args={['#06070a', 13, 32]} />
      <CameraRig car={car} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 8, 4]} intensity={1.3} />
      <Studio />
      <Suspense fallback={null}>
        <ModelCar car={car} onAnchors={setAnchors} onReady={onModelReady} />
      </Suspense>
      <Callouts car={car} active={active} show={show} anchors={anchors} />
      <Floor accent={car.theme.accent} />
      <BlobShadow />
      <Sparkles count={70} scale={[14, 4, 14]} position={[0, 2, 0]} size={2.2} speed={0.25} opacity={0.35} color={car.theme.accent} />
      {/* 4× MSAA half-float buffers on hi-dpi screens can exhaust GPU memory (→ context loss): only 2× on 1× screens */}
      <EffectComposer multisampling={dpr > 1.2 ? 0 : 2}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1.05} luminanceSmoothing={0.25} />
        <Vignette offset={0.28} darkness={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

/* soft baked shadow under the truck — grows darker as the shell lands (cheap vs. ContactShadows) */
function BlobShadow() {
  const mat = useRef();
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    r.addColorStop(0, 'rgba(0,0,0,1)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  useFrame(() => {
    mat.current.opacity = 0.25 + 0.35 * smooth(partT(3)) + 0.3 * smooth(partT(5));
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.007, 0]} renderOrder={1}>
      <planeGeometry args={[6.4, 2.9]} />
      <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} color="#000" opacity={0.5} />
    </mesh>
  );
}

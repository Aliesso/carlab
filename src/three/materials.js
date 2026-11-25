import * as THREE from 'three';

/* metallic flake: tiny random normals under a perfectly smooth clearcoat */
function flakeNormalMap() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.55;
    data[i * 4] = 128 + Math.cos(a) * r * 127;
    data[i * 4 + 1] = 128 + Math.sin(a) * r * 127;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/* infotainment screen texture */
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 512, 300);
  bg.addColorStop(0, '#04121f');
  bg.addColorStop(1, '#0a0614');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 300);
  const tiles = [
    ['#2bb3ff', 16, 16], ['#4fd8ff', 264, 16], ['#7cffb2', 16, 158], ['#ffb347', 264, 158],
  ];
  for (const [col, x, y] of tiles) {
    g.fillStyle = col + '33';
    g.fillRect(x, y, 232, 126);
    g.fillStyle = col;
    g.fillRect(x, y, 6, 126);
    g.fillRect(x + 22, y + 28, 110, 10);
    g.fillStyle = col + '99';
    g.fillRect(x + 22, y + 52, 160, 6);
    g.fillRect(x + 22, y + 66, 130, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DS = THREE.DoubleSide;

export const M = {
  paint: new THREE.MeshPhysicalMaterial({
    color: '#7d0c18',
    metalness: 0.62,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    normalMap: flakeNormalMap(),
    normalScale: new THREE.Vector2(0.22, 0.22),
    vertexColors: true,
    side: DS,
    envMapIntensity: 1.2,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#0b1016',
    metalness: 0.1,
    roughness: 0.04,
    clearcoat: 1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: DS,
    envMapIntensity: 1.6,
  }),
  chrome: new THREE.MeshPhysicalMaterial({ color: '#f1f3f6', metalness: 1, roughness: 0.1, side: DS }),
  satin: new THREE.MeshPhysicalMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.24, clearcoat: 0.5, side: DS }),
  blackGloss: new THREE.MeshPhysicalMaterial({
    color: '#08090b', metalness: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: DS,
  }),
  plastic: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.65, metalness: 0.1 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.92, metalness: 0, side: DS }),
  alloy: new THREE.MeshPhysicalMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.22, clearcoat: 0.6 }),
  alloyDark: new THREE.MeshStandardMaterial({ color: '#3a3d43', metalness: 0.9, roughness: 0.4, side: DS }),
  disc: new THREE.MeshStandardMaterial({ color: '#7d8188', metalness: 1, roughness: 0.38 }),
  caliper: new THREE.MeshPhysicalMaterial({ color: '#c3121e', metalness: 0.2, roughness: 0.35, clearcoat: 1 }),
  chassis: new THREE.MeshStandardMaterial({ color: '#23262c', metalness: 0.75, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: '#59606a', metalness: 0.9, roughness: 0.35 }),
  aluminum: new THREE.MeshStandardMaterial({ color: '#a4abb4', metalness: 1, roughness: 0.32 }),
  spring: new THREE.MeshPhysicalMaterial({ color: '#4fd8ff', metalness: 0.6, roughness: 0.25, clearcoat: 1 }),
  block: new THREE.MeshStandardMaterial({ color: '#3c4048', metalness: 0.8, roughness: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: '#c9773e', metalness: 1, roughness: 0.3 }),
  radiator: new THREE.MeshStandardMaterial({ color: '#1a1c21', metalness: 0.6, roughness: 0.55 }),
  leather: new THREE.MeshStandardMaterial({ color: '#2a2a31', roughness: 0.72, metalness: 0 }),
  leatherAccent: new THREE.MeshStandardMaterial({ color: '#8b6a4f', roughness: 0.6 }),
  dash: new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.8 }),
  carpet: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 1 }),
  screen: new THREE.MeshStandardMaterial({
    color: '#000', emissive: '#ffffff', emissiveMap: screenTexture(), emissiveIntensity: 1.6, toneMapped: false,
  }),
  gauge: new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fd8ff').multiplyScalar(2.2), toneMapped: false }),
  headHousing: new THREE.MeshPhysicalMaterial({
    color: '#16181c', metalness: 0.95, roughness: 0.12, clearcoat: 1, side: DS,
  }),
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color('#e6f6ff').multiplyScalar(4), toneMapped: false, side: DS }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#dfefff', metalness: 0.4, roughness: 0.02, clearcoat: 1, emissive: '#bfe6ff', emissiveIntensity: 0.25 }),
  tail: new THREE.MeshPhysicalMaterial({
    color: '#3d0007', emissive: '#ff1f35', emissiveIntensity: 2.2, roughness: 0.15, clearcoat: 1, toneMapped: false, side: DS,
  }),
};

// same paint for meshes without vertex colours (mirrors)
M.paintSolid = M.paint.clone();
M.paintSolid.vertexColors = false;

const PAINT_COLOR = new THREE.Color();
export function setPaint(p) {
  PAINT_COLOR.set(p.hex);
  M.paint.color.copy(PAINT_COLOR);
  M.paint.metalness = p.metal ?? 0.62;
  M.paint.roughness = p.rough ?? 0.3;
  M.paintSolid.color.copy(PAINT_COLOR);
  M.paintSolid.metalness = M.paint.metalness;
  M.paintSolid.roughness = M.paint.roughness;
}

/* holographic "blueprint" ghost shown where a part will land */
const ghostVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const ghostFrag = /* glsl */ `
  uniform float uOpacity; uniform float uTime; uniform vec3 uColor;
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float lines = smoothstep(0.86, 1.0, fract(vW.y * 34.0)) * 0.35;
    float sweep = mod(uTime * 1.1, 8.0) - 4.0;
    float band = exp(-abs(vW.x - sweep) * 7.0);
    float a = (0.035 + fres * 0.85 + lines * 0.25 + band * 0.5) * uOpacity;
    gl_FragColor = vec4(uColor * (0.6 + fres * 1.6 + band * 1.2), a);
  }
`;
export function makeGhostMaterial(color = '#4fd8ff') {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: ghostVert,
    fragmentShader: ghostFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

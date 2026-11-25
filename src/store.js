// Shared mutable state read inside the render loop (no React re-renders).
export const SECTIONS = 11; // hero + 9 build steps + final

export const store = {
  u: 0, // smoothed section position (0 = hero, 10 = final)
  target: 0, // raw section position from scroll
  mouse: { x: 0, y: 0 },
  orbit: 0,
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// 0 → part is off-stage, 1 → part is seated. A step lands just before its section is centred.
export function partT(step, delay = 0) {
  const t = clamp((store.u - (step - 0.82)) / 0.62);
  return delay ? clamp((t - delay) / (1 - delay)) : t;
}

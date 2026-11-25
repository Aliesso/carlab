import { Component, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, useGLTF } from '@react-three/drei';
import Lenis from 'lenis';
import Scene from './three/Scene';
import { CARS, carById } from './cars';
import { setPaint } from './three/materials';
import { clamp, SECTIONS, store } from './store';

let lenis = null;
const pad = (n) => String(n).padStart(2, '0');
// one scroll section = 100vh; on phones innerHeight changes as the address bar hides, so measure the section
const sectionH = () => document.querySelector('.sec')?.offsetHeight || window.innerHeight;
const initialCar = () => carById(new URLSearchParams(window.location.search).get('car'));

function Swatches({ paints, value, onChange, big }) {
  return (
    <div className={`swatches${big ? ' big' : ''}`}>
      {paints.map((p, i) => (
        <button
          key={p.name}
          className={i === value ? 'sel' : ''}
          style={{ '--c': p.hex }}
          onClick={() => onChange(i)}
          aria-label={p.name}
          title={p.name}
        />
      ))}
    </div>
  );
}

// WebGL context creation can throw (e.g. the browser blocked WebGL for this page) — don't take the page down
class GLBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('[3D] disabled:', err?.message);
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function CarSwitch({ car, onSelect, big }) {
  return (
    <div className={`car-switch${big ? ' big' : ''}`} role="tablist" aria-label="Model seç">
      {CARS.map((c) => (
        <button
          key={c.id}
          role="tab"
          aria-selected={c.id === car.id}
          className={c.id === car.id ? 'sel' : ''}
          style={{ '--ca': c.theme.accent }}
          onClick={() => onSelect(c.id)}
        >
          <i />
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [car, setCar] = useState(initialCar);
  const [active, setActive] = useState(0);
  const [show, setShow] = useState(false);
  const [paint, setPaintIdx] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [glFailed, setGlFailed] = useState(null); // null | 'lost' | 'blocked'
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio || 1));
  const pctRef = useRef();
  const barRef = useRef();

  const ready = canvasReady && modelReady;
  const onModelReady = useCallback(() => setModelReady(true), []);
  const steps = car.steps;
  const NAMES = ['Start', ...steps.map((s) => s.kicker), 'Final'];

  // smooth scroll + HUD progress
  useEffect(() => {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85 });
    let raf;
    let lastPct = -1;
    const loop = (t) => {
      lenis.raf(t);
      const p = clamp((store.u - 0.2) / (SECTIONS - 2 - 0.2));
      const pct = Math.round(p * 100);
      if (pct !== lastPct && pctRef.current) {
        lastPct = pct;
        pctRef.current.textContent = pad(pct);
        barRef.current.style.transform = `scaleX(${p})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onScroll = () => {
      const u = window.scrollY / sectionH();
      store.target = u;
      const a = Math.round(u);
      setActive(a);
      setShow(Math.abs(u - a) < 0.3);
    };
    const onMove = (e) => {
      store.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      store.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('pointermove', onMove);
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onMove);
      lenis.destroy();
    };
  }, []);

  // per-car theme
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', car.theme.accent);
    root.style.setProperty('--accent2', car.theme.accent2);
    root.style.setProperty('--grad', car.theme.grad);
    root.dataset.car = car.id;
    document.title = `${car.brand.join(' / ')} — Detal-detal yığılma`;
  }, [car]);

  useEffect(() => setPaint(car.paints[paint] ?? car.paints[0]), [car, paint]);

  // once a car is on screen, fetch the other ones in the background
  useEffect(() => {
    if (ready) CARS.filter((c) => c.id !== car.id).forEach((c) => useGLTF.preload(c.url));
  }, [ready, car]);

  const selectCar = (id) => {
    if (id === car.id) return;
    const next = carById(id);
    lenis?.scrollTo(0, { immediate: true });
    store.u = store.target = 0;
    store.orbit = 0;
    setModelReady(false);
    setPaintIdx(0);
    setCar(next);
    const url = new URL(window.location.href);
    url.searchParams.set('car', id);
    window.history.replaceState(null, '', url);
  };

  const goTo = (i, duration = 1.6) => lenis?.scrollTo(i * sectionH(), { duration });
  const step = active >= 1 && active <= steps.length ? steps[active - 1] : null;
  const paints = car.paints;

  return (
    <>
      {glFailed && (
        <div className="gl-fail" role="alert">
          <b>3D göstərilə bilmir</b>
          {glFailed === 'lost' ? (
            <p>Video kart 3D kontekstini itirdi. Səhifəni yeniləyin.</p>
          ) : (
            <p>
              Brauzer bu səhifə üçün WebGL-i bloklayıb (adətən video kart əvvəl həddən artıq yüklənəndə olur). Brauzeri tam bağlayıb
              yenidən açın və “Hardware acceleration” ayarının aktiv olduğunu yoxlayın.
            </p>
          )}
          <button className="btn" onClick={() => window.location.reload()}>Yenilə</button>
        </div>
      )}

      <div className={`loader${ready || glFailed ? ' done' : ''}`}>
        <div className="loader-mark">
          <i /><i /><i />
        </div>
        <span>{car.label} yüklənir…</span>
      </div>

      <div className="stage">
        <GLBoundary onFail={() => setGlFailed('blocked')}>
          <Canvas
            dpr={dpr}
            gl={{ antialias: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
            camera={{ fov: 30, near: 0.1, far: 80, position: [6.6, 2.5, 6.4] }}
            onCreated={({ gl }) => {
              const el = gl.domElement;
              // keep the page alive if the GPU drops the context; it can be restored
              el.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setGlFailed('lost');
              });
              el.addEventListener('webglcontextrestored', () => setGlFailed(null));
              setTimeout(() => setCanvasReady(true), 300);
            }}
          >
            {/* drop resolution when frames get slow instead of pushing the GPU into a reset */}
            <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio))} />
            <Scene key={car.id} car={car} active={active} show={show} onModelReady={onModelReady} />
          </Canvas>
        </GLBoundary>
      </div>
      <div className="grain" />

      {/* ---------------- HUD ---------------- */}
      <header className="nav">
        <button className="brand" onClick={() => goTo(0, 2.2)}>
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 20c3-6 7-8 13-8s9 2 13 8" />
            <circle cx="9" cy="21" r="3" />
            <circle cx="23" cy="21" r="3" />
          </svg>
          <span>{car.brand[0]}<em>/</em>{car.brand[1]}</span>
        </button>
        <CarSwitch car={car} onSelect={selectCar} />
        <div className="assembly">
          <span className="assembly-label">Yığılma</span>
          <b ref={pctRef}>00</b>
          <span className="assembly-unit">%</span>
          <span className="assembly-bar"><i ref={barRef} /></span>
        </div>
      </header>

      <nav className="rail" aria-label="Addımlar">
        {NAMES.map((n, i) => (
          <button key={n + i} className={i === active ? 'on' : i < active ? 'past' : ''} onClick={() => goTo(i)}>
            <span>{n}</span>
            <i />
          </button>
        ))}
      </nav>

      <div className={`status${step ? ' vis' : ''}`}>
        <span className="status-k">{step ? `${pad(active)} / ${pad(steps.length)}` : ''}</span>
        <span className="status-n">{step?.kicker}</span>
      </div>

      <div className={`paint-dock${active >= 4 && active < SECTIONS - 1 ? ' vis' : ''}`}>
        <span>{paints[paint].name}</span>
        <Swatches paints={paints} value={paint} onChange={setPaintIdx} />
      </div>

      {/* ---------------- story ---------------- */}
      <main key={car.id}>
        <section className={`sec hero${active === 0 ? ' on' : ''}`}>
          <div className="hero-inner">
            <div className="eyebrow rv">{car.hero.eyebrow}</div>
            <h1 className="rv">
              <span className="outline">{car.hero.outline}</span>
              <span className="grad">{car.hero.title}</span>
            </h1>
            <p className="lead rv">{car.hero.lead}</p>
          </div>
          <div className="scroll-hint">
            <span>SCROLL</span>
            <i />
          </div>
        </section>

        {steps.map((s, i) => (
          <section key={s.key} className={`sec step side-${s.side}${active === i + 1 ? ' on' : ''}`}>
            <article className="card">
              <span className="card-big">{pad(i + 1)}</span>
              <div className="num rv">
                <b>{pad(i + 1)}</b>
                <em>/ {pad(steps.length)}</em>
                <span>{s.kicker}</span>
              </div>
              <h2 className="rv">{s.title}</h2>
              <p className="rv">{s.text}</p>
              <dl className="specs rv">
                {s.specs.map(([k, v]) => (
                  <div key={k}>
                    <dd>{v}</dd>
                    <dt>{k}</dt>
                  </div>
                ))}
              </dl>
            </article>
          </section>
        ))}

        <section className={`sec final${active === SECTIONS - 1 ? ' on' : ''}`}>
          <div className="final-inner">
            <div className="eyebrow rv">{pad(steps.length)} / {pad(steps.length)} · Tam yığıldı</div>
            <h2 className="rv">Tamamlandı.</h2>
            <p className="rv final-name">
              {car.name} <span>{car.year}</span> — <b>{paints[paint].name}</b>
            </p>
            <div className="rv">
              <Swatches paints={paints} value={paint} onChange={setPaintIdx} big />
            </div>
            <div className="final-actions rv">
              <button className="btn" onClick={() => goTo(0, 3.2)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Yenidən sök
              </button>
              {CARS.filter((c) => c.id !== car.id).map((c) => (
                <button key={c.id} className="btn btn-ghost" onClick={() => selectCar(c.id)}>
                  {c.label} yığ →
                </button>
              ))}
            </div>
            <small className="note rv">
              3D model: <a href={car.credit.url} target="_blank" rel="noreferrer">“{car.credit.title}”</a> — {car.credit.author},{' '}
              <a href={car.credit.licenseUrl} target="_blank" rel="noreferrer">{car.credit.license}</a>
            </small>
          </div>
        </section>
      </main>
    </>
  );
}

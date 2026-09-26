import { useEffect, useRef } from 'react';
import { initAudio, playStartupSound, stopEngine } from './engineSound';

// The 3D scene is heavy: skip it on weak or data-saving devices and for visitors who asked for less motion
function canRender3D(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (typeof OffscreenCanvas === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) return false;
  return new URLSearchParams(window.location.search).get('lite') !== '1';
}

const use3D = canRender3D();

function StaticBackdrop() {
  return (
    <div
      className="fixed inset-0 w-full h-screen z-[1] pointer-events-none"
      style={{
        background:
          'radial-gradient(ellipse 60% 45% at 70% 62%, rgba(231,37,38,0.16), transparent 70%), radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.05), transparent 70%), #0a0a0a',
      }}
    />
  );
}

export default function ScrollScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progressBar = progressRef.current;
    if (!progressBar) return;

    if (!use3D) {
      const onScroll = () => {
        const totalH = document.body.scrollHeight - window.innerHeight;
        progressBar.style.width = `${totalH > 0 ? Math.min(window.scrollY / totalH, 1) * 100 : 0}%`;
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const container = containerRef.current;
    if (!container) return;

    // A canvas can only be transferred to a worker once, so each mount gets a fresh one
    // (StrictMode mounts effects twice in dev). After transfer, only the worker may resize it.
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-full block';
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      console.warn('OffscreenCanvas not supported in this browser — 3D scene disabled');
      return;
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);

    const worker = new Worker(new URL('./scrollWorker.ts', import.meta.url), { type: 'module' });
    const offscreen = canvas.transferControlToOffscreen();

    let sectionTops: number[] = [];
    let sectionBottoms: number[] = [];

    const recomputeSectionOffsets = () => {
      const sections = document.querySelectorAll<HTMLElement>('#scroll-container > section');
      sectionTops = Array.from(sections).map((s) => s.offsetTop);
      sectionBottoms = sectionTops.map((_, i) =>
        i < sectionTops.length - 1 ? sectionTops[i + 1] : document.body.scrollHeight
      );
    };
    recomputeSectionOffsets();

    worker.postMessage(
      { type: 'init', canvas: offscreen, width: window.innerWidth, height: window.innerHeight },
      [offscreen],
    );
    worker.postMessage({ type: 'scroll', scrollY: window.scrollY, sectionTops, sectionBottoms });

    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        const sy = window.scrollY;
        const totalH = document.body.scrollHeight - window.innerHeight;
        progressBar.style.width = `${totalH > 0 ? Math.min(sy / totalH, 1) * 100 : 0}%`;
        worker.postMessage({ type: 'scroll', scrollY: sy, sectionTops, sectionBottoms });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => {
      recomputeSectionOffsets();
      worker.postMessage({
        type: 'resize',
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
        sectionTops,
        sectionBottoms,
      });
    };
    window.addEventListener('resize', onResize);

    const onClick = () => { initAudio(); playStartupSound(); };
    canvas.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('click', onClick);
      stopEngine();
      worker.terminate();
      canvas.remove();
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} />
      {use3D ? <div ref={containerRef} className="fixed inset-0 w-full h-screen z-[1] pointer-events-none" /> : <StaticBackdrop />}
      <div
        className="fixed inset-0 w-full h-full z-[2] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 75% 65% at 50% 60%, transparent 40%, rgba(10,10,10,0.35) 62%, rgba(10,10,10,0.75) 82%, #0a0a0a 100%)',
        }}
      />
    </>
  );
}

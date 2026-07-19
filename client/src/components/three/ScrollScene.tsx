import { useEffect, useRef } from 'react';
import { initAudio, playStartupSound, stopEngine } from './engineSound';

export default function ScrollScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const progressBar = progressRef.current;
    if (!canvas || !progressBar) return;

    if (typeof canvas.transferControlToOffscreen !== 'function') {
      console.warn('OffscreenCanvas not supported in this browser — 3D scene disabled');
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

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
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
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
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={progressRef} />
      <div className="fixed inset-0 w-full h-screen z-[1] pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
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

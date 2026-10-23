'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';

const COLORS = ['#ff2e88', '#1d4ed8', '#ffc400', '#0b7a45', '#7c3aed', '#ff7a00'];

function subscribeMotion(fn: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}

/** True when the device asks for reduced motion (R92). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
}

/** Lightweight canvas confetti burst (~2.5 s, 140 particles). Never created with reduced motion. */
export function Confetti() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reduce) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = (c.width = window.innerWidth);
    const h = (c.height = window.innerHeight);
    const parts = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: -6 - Math.random() * 10,
      r: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: Math.random() * Math.PI,
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const age = t - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - age / 2500);
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      if (age < 2500) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  if (reduce) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" aria-hidden="true" data-testid="confetti" />;
}

'use client';

import { useRef, useEffect } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  r: number;
  g: number;
  b: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationRef = useRef<number>(0);
  const reducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const handleMotion = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', handleMotion);

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const generateStars = (w: number, h: number) => {
      const count = Math.max(80, Math.min(200, Math.floor((w * h) / 8000)));
      const stars: Star[] = [];
      for (let i = 0; i < count; i++) {
        const isRedTinted = Math.random() < 0.12;
        let r: number, g: number, b: number;
        if (isRedTinted) {
          r = 200 + Math.floor(Math.random() * 55);
          g = 150 + Math.floor(Math.random() * 40);
          b = 150 + Math.floor(Math.random() * 30);
        } else {
          const brightness = 200 + Math.floor(Math.random() * 56);
          r = brightness;
          g = brightness;
          b = brightness + 15;
        }
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 0.5 + Math.random() * 1.5,
          baseOpacity: 0.2 + Math.random() * 0.8,
          r,
          g,
          b,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 1.2,
          driftX: (Math.random() - 0.5) * 0.15,
          driftY: (Math.random() - 0.5) * 0.15,
        });
      }
      starsRef.current = stars;
    };

    const resize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w === 0 || h === 0) return;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        generateStars(w, h);
      }, 200);
    };

    const draw = (time: number) => {
      if (!ctx || !canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const t = time * 0.001;

      const isReduced = reducedMotionRef.current;

      for (const star of starsRef.current) {
        let opacity: number;
        let x: number;
        let y: number;

        if (isReduced) {
          opacity = star.baseOpacity;
          x = star.x;
          y = star.y;
        } else {
          const twinkle = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
          opacity = Math.min(1, star.baseOpacity * (0.5 + twinkle * 0.5));
          const dx = star.driftX * t * 0.5;
          const dy = star.driftY * t * 0.5;
          x = ((star.x + dx) % w + w) % w;
          y = ((star.y + dy) % h + h) % h;
        }

        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.r},${star.g},${star.b},${opacity})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      clearTimeout(resizeTimeout);
      mq.removeEventListener('change', handleMotion);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 25% 65%, rgba(220,59,74,0.12) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 80% 25%, rgba(140,31,42,0.08) 0%, transparent 55%)',
          willChange: 'transform, opacity',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(220,59,74,0.06) 0%, transparent 50%)',
          animation: 'nebula-drift-1 50s ease-in-out infinite, nebula-fade 30s ease-in-out infinite',
          willChange: 'transform, opacity',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 45% 35% at 65% 40%, rgba(140,31,42,0.08) 0%, transparent 50%)',
          animation: 'nebula-drift-2 45s ease-in-out infinite, nebula-fade 25s ease-in-out infinite',
          willChange: 'transform, opacity',
          animationDelay: '-10s',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
};

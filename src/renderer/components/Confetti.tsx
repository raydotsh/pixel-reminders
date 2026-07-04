import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = [
  '#f59e0b', // gold
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // green
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

export default function Confetti({ active }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    const particles: Particle[] = [];
    
    // Spawn particles from bottom or random locations
    const count = 60;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 40,
        y: canvas.height - 40,
        // Cozy pixel blocks
        size: Math.floor(Math.random() * 4) + 4, // 4px to 7px blocky pixels
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 6, // Go upwards
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    let animationFrameId: number;
    let opacity = 1.0;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let allDone = true;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // Gravity
        p.vx *= 0.98; // Friction
        p.rotation += p.rotationSpeed;

        if (p.y < canvas.height) {
          allDone = false;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = opacity;
        
        // Draw crisp 8-bit square confetti
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        
        ctx.restore();
      });

      opacity -= 0.015; // Slow fade out
      if (opacity <= 0 || allDone) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-50"
    />
  );
}

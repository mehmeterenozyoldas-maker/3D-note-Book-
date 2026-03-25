import React, { useEffect, useRef } from 'react';
import { VFXType } from '../types';

interface VFXLayerProps {
  type?: VFXType;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  phase: number;
}

export const VFXLayer: React.FC<VFXLayerProps> = ({ type = 'none' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>();
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    if (type === 'none' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset particles on type change
    particlesRef.current = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Mouse tracking for interactivity
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const createParticle = (): Particle => {
      const w = canvas.width;
      const h = canvas.height;
      
      switch (type) {
        case 'embers':
          return {
            x: Math.random() * w,
            y: h + 10,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -Math.random() * 1 - 0.5,
            size: Math.random() * 2 + 1,
            alpha: 1,
            life: Math.random() * 100 + 50,
            maxLife: 150,
            phase: Math.random() * Math.PI * 2
          };
        case 'pollen':
          return {
            x: Math.random() * w,
            y: -10,
            vx: (Math.random() - 0.5) * 1,
            vy: Math.random() * 0.5 + 0.2,
            size: Math.random() * 3 + 1,
            alpha: 0.6,
            life: Math.random() * 300 + 100,
            maxLife: 400,
            phase: Math.random() * Math.PI * 2
          };
        case 'dust':
        default:
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            size: Math.random() * 1.5,
            alpha: 0,
            life: Math.random() * 200 + 100,
            maxLife: 300,
            phase: Math.random() * Math.PI * 2
          };
      }
    };

    // Pre-populate dust
    if (type === 'dust') {
        for(let i=0; i<30; i++) particlesRef.current.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawning logic
      if (particlesRef.current.length < 50) {
         if (Math.random() < 0.05) particlesRef.current.push(createParticle());
      }

      // Interaction Force
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Update & Draw
      particlesRef.current.forEach((p, i) => {
        p.life--;
        p.phase += 0.02;

        // Mouse interaction: Repel
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.hypot(dx, dy);
        if (dist < 100 && dist > 0) {
            const force = (100 - dist) / 100;
            p.vx += (dx / dist) * force * 0.2;
            p.vy += (dy / dist) * force * 0.2;
        }

        if (type === 'dust') {
            p.x += p.vx + Math.sin(p.phase) * 0.1;
            p.y += p.vy;
            // Damping for dust
            p.vx *= 0.98; 
            p.vy *= 0.98;

            if (p.life > p.maxLife * 0.8) p.alpha = Math.min(0.4, p.alpha + 0.01);
            else if (p.life < 50) p.alpha = Math.max(0, p.alpha - 0.01);
            
            ctx.fillStyle = `rgba(255, 255, 230, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (type === 'embers') {
            p.x += p.vx + Math.cos(p.phase) * 0.3;
            p.y += p.vy;
            p.alpha = Math.min(1, p.life / 50);
            
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            gradient.addColorStop(0, `rgba(255, 200, 150, ${p.alpha})`);
            gradient.addColorStop(1, `rgba(100, 50, 0, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        else if (type === 'pollen') {
            p.x += p.vx + Math.sin(p.phase) * 0.5;
            p.y += p.vy;
            p.alpha = Math.min(0.6, p.life / 50);

            ctx.fillStyle = `rgba(255, 255, 200, ${p.alpha})`;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size, p.size/2, p.phase, 0, Math.PI*2);
            ctx.fill();
        }

        // Cleanup
        if (p.life <= 0 || p.y < -50 || p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) {
             particlesRef.current.splice(i, 1);
        }
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [type]);

  if (type === 'none') return null;

  return (
    <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none z-10 mix-blend-screen"
    />
  );
};

import { useEffect, useRef } from 'react';

// Pakistan flag colours + gold sparkles
const COLOURS = [
  '#2EAD4E',  // bright green
  '#01411C',  // flag deep green
  '#FFFFFF',  // white
  '#FFFFFF',  // white (double-weighted so it appears often)
  '#FFD700',  // gold
  '#C8F060',  // yellow-green shimmer
  '#00CC66',  // emerald
];

export default function PakFireworks() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* ── Particle ─────────────────────────────────────────────── */
    function Particle(x, y, color, angle, speed) {
      this.x = x; this.y = y; this.color = color;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.decay = 0.010 + Math.random() * 0.016;
      this.r    = 1.2 + Math.random() * 2.4;
      this.gravity = 0.055;
    }
    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= 0.97;
      this.vy *= 0.97;
      this.alpha -= this.decay;
    };
    Particle.prototype.dead = function () { return this.alpha <= 0; };
    Particle.prototype.draw = function () {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle   = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    /* ── Rocket ───────────────────────────────────────────────── */
    function Rocket() {
      this.x = canvas.width  * (0.1 + Math.random() * 0.8);
      this.y = canvas.height + 10;
      this.targetY = canvas.height * (0.08 + Math.random() * 0.38);
      this.color = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      this.vx = (Math.random() - 0.5) * 3;
      this.vy = -(17 + Math.random() * 8);
      this.trail = [];
      this.done  = false;
    }
    Rocket.prototype.update = function () {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 12) this.trail.shift();
      this.x  += this.vx;
      this.y  += this.vy;
      this.vy += 0.24;             // gravity slows ascent
      if (this.y <= this.targetY || this.vy >= -0.5) this.done = true;
    };
    Rocket.prototype.draw = function () {
      this.trail.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = (i / this.trail.length) * 0.7;
        ctx.fillStyle   = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.save();
      ctx.fillStyle   = '#FFFFFF';
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    Rocket.prototype.explode = function (parts) {
      const count = 90 + Math.floor(Math.random() * 60);
      const alt   = COLOURS[Math.floor(Math.random() * COLOURS.length)];

      // Main burst
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 1.5 + Math.random() * 6;
        const col   = i % 5 === 0 ? alt : this.color;
        parts.push(new Particle(this.x, this.y, col, angle + (Math.random() - 0.5) * 0.35, speed));
      }
      // White sparkle ring
      for (let i = 0; i < 28; i++) {
        const p = new Particle(this.x, this.y, '#FFFFFF', Math.random() * Math.PI * 2, 7 + Math.random() * 5);
        p.r = 1; p.decay = 0.03;
        parts.push(p);
      }
      // Gold glitter centre
      for (let i = 0; i < 16; i++) {
        const p = new Particle(this.x, this.y, '#FFD700', Math.random() * Math.PI * 2, 2 + Math.random() * 3);
        p.r = 2; p.decay = 0.018;
        parts.push(p);
      }
    };

    /* ── Animation state ─────────────────────────────────────── */
    let rockets   = [];
    let particles = [];
    let animId;
    const tids = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); tids.push(id); };

    const SHOW_MS  = 7000;  // active show window
    const PAUSE_MS = 5000;  // quiet gap between shows

    const runShow = () => {
      // 12 rockets launched 400 ms apart
      for (let i = 0; i < 12; i++) {
        later(() => rockets.push(new Rocket()), i * 420);
      }
      // After show window: wait for particles to fade, then pause, then repeat
      later(() => {
        later(() => {
          particles = [];
          rockets   = [];
          runShow();
        }, PAUSE_MS);
      }, SHOW_MS);
    };

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rockets (normal composite — need to be visible against any bg)
      rockets = rockets.filter(r => {
        r.update();
        if (r.done) { r.explode(particles); return false; }
        r.draw();
        return true;
      });

      // Particles with additive glow (lighter = bright against dark or light areas)
      ctx.globalCompositeOperation = 'lighter';
      particles = particles.filter(p => {
        p.update();
        if (p.dead()) return false;
        p.draw();
        return true;
      });
      ctx.globalCompositeOperation = 'source-over';

      animId = requestAnimationFrame(loop);
    };

    loop();
    runShow();

    return () => {
      cancelAnimationFrame(animId);
      tids.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
}

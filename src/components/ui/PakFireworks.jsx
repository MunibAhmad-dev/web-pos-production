import { useEffect, useRef } from 'react';

const COLOURS = ['#2EAD4E', '#01411C', '#FFFFFF', '#FFFFFF', '#FFD700', '#C8F060', '#00CC66'];

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

    /* ── Particle ─────────────────────────────────────────────────
       No save/restore, no shadowBlur — fast flat draw.
       `lighter` composite in the loop gives the glow for free.    */
    function Particle(x, y, color, angle, speed, opts = {}) {
      this.x = x; this.y = y; this.color = color;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha   = 1;
      this.decay   = opts.decay   ?? (0.006 + Math.random() * 0.009);
      this.r       = opts.r       ?? (1.4 + Math.random() * 2);
      this.gravity = opts.gravity ?? 0.08;
      this.drag    = opts.drag    ?? 0.97;
    }
    Particle.prototype.update = function () {
      this.x += this.vx; this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= this.drag; this.vy *= this.drag;
      this.alpha -= this.decay;
    };
    Particle.prototype.dead = function () { return this.alpha <= 0; };
    Particle.prototype.draw = function () {
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    };

    /* ── Rocket ──────────────────────────────────────────────────*/
    function Rocket() {
      this.x = canvas.width * (0.1 + Math.random() * 0.8);
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
      if (this.trail.length > 10) this.trail.shift();
      this.x += this.vx; this.y += this.vy;
      this.vy += 0.24;
      if (this.y <= this.targetY || this.vy >= -0.5) this.done = true;
    };
    Rocket.prototype.draw = function () {
      const n = this.trail.length;
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = (i / n) * 0.55;
        ctx.fillStyle   = this.color;
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle   = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fill();
    };
    Rocket.prototype.explode = function (parts) {
      // hard cap so a backlog of rockets can't flood the particle pool
      if (parts.length > 900) return;

      const count = 60 + Math.floor(Math.random() * 30);
      const alt   = COLOURS[Math.floor(Math.random() * COLOURS.length)];

      // ① Main starburst — spreads outward, slow decay so it stays visible
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 2 + Math.random() * 5.5;
        parts.push(new Particle(
          this.x, this.y,
          i % 5 === 0 ? alt : this.color,
          angle + (Math.random() - 0.5) * 0.35,
          speed,
          { decay: 0.005 + Math.random() * 0.007, gravity: 0.09, drag: 0.97 }
        ));
      }

      // ② Bright white flash ring — short-lived, fast
      for (let i = 0; i < 18; i++) {
        parts.push(new Particle(
          this.x, this.y, '#FFFFFF',
          Math.random() * Math.PI * 2,
          7 + Math.random() * 4,
          { decay: 0.03, r: 1, gravity: 0.05, drag: 0.96 }
        ));
      }

      // ③ Ember rain — fall straight down with slight drift, long-lived
      //    These create the lingering "rain" streaks after the burst.
      for (let i = 0; i < 30; i++) {
        // angle biased downward (π/2) with small random spread
        const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        const speed = 0.4 + Math.random() * 1.8;
        const col   = i % 3 === 0 ? '#FFD700' : (i % 3 === 1 ? this.color : '#FFFFFF');
        parts.push(new Particle(
          this.x + (Math.random() - 0.5) * 30,
          this.y + (Math.random() - 0.5) * 10,
          col, angle, speed,
          { decay: 0.003 + Math.random() * 0.005, r: 1 + Math.random(), gravity: 0.12, drag: 0.99 }
        ));
      }
    };

    /* ── State ───────────────────────────────────────────────── */
    let rockets   = [];
    let particles = [];
    let animId;
    const tids = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); tids.push(id); };

    const SHOW_MS  = 6000;
    const PAUSE_MS = 5000;

    const runShow = () => {
      for (let i = 0; i < 10; i++) later(() => rockets.push(new Rocket()), i * 450);
      later(() => later(() => { particles = []; rockets = []; runShow(); }, PAUSE_MS), SHOW_MS);
    };

    /* ── Loop ────────────────────────────────────────────────── */
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rockets — normal blending
      ctx.globalCompositeOperation = 'source-over';
      rockets = rockets.filter(r => {
        r.update();
        if (r.done) { r.explode(particles); return false; }
        r.draw();
        return true;
      });

      // Particles — additive blending = natural glow, no shadowBlur needed
      ctx.globalCompositeOperation = 'lighter';
      const alive = [];
      for (const p of particles) {
        p.update();
        if (!p.dead()) { p.draw(); alive.push(p); }
      }
      particles = alive;

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

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
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none' }}
    />
  );
}

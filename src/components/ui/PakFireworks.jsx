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

    /* ── Particle ─────────────────────────────────────────────── */
    function Particle(x, y, color, angle, speed, opts = {}) {
      this.x = x; this.y = y; this.color = color;
      this.vx      = Math.cos(angle) * speed;
      this.vy      = Math.sin(angle) * speed;
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

    /* ── Normal Rocket ────────────────────────────────────────── */
    function Rocket() {
      this.x       = canvas.width * (0.05 + Math.random() * 0.9);
      this.y       = canvas.height + 10;
      this.targetY = canvas.height * (0.08 + Math.random() * 0.38);
      this.color   = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      this.vx      = (Math.random() - 0.5) * 3;
      this.vy      = -(17 + Math.random() * 8);
      this.trail   = [];
      this.done    = false;
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
      if (parts.length > 2200) return;
      const count = 60 + Math.floor(Math.random() * 30);
      const alt   = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        parts.push(new Particle(this.x, this.y, i % 5 === 0 ? alt : this.color,
          angle + (Math.random() - 0.5) * 0.35, 2 + Math.random() * 5.5,
          { decay: 0.005 + Math.random() * 0.007, gravity: 0.09, drag: 0.97 }));
      }
      for (let i = 0; i < 18; i++) {
        parts.push(new Particle(this.x, this.y, '#FFFFFF',
          Math.random() * Math.PI * 2, 7 + Math.random() * 4,
          { decay: 0.03, r: 1, gravity: 0.05, drag: 0.96 }));
      }
      for (let i = 0; i < 28; i++) {
        const col = i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? this.color : '#FFFFFF';
        parts.push(new Particle(
          this.x + (Math.random() - 0.5) * 30, this.y + (Math.random() - 0.5) * 10,
          col, Math.PI / 2 + (Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 1.8,
          { decay: 0.003 + Math.random() * 0.005, r: 1 + Math.random(), gravity: 0.12, drag: 0.99 }));
      }
    };

    /* ── Ballistic Rocket ─────────────────────────────────────────
       Slow, majestic, thick-trailed — explodes in a massive burst. */
    function BallisticRocket() {
      this.x       = canvas.width * (0.2 + Math.random() * 0.6);
      this.y       = canvas.height + 10;
      this.targetY = canvas.height * (0.02 + Math.random() * 0.1);  // near top of screen
      this.color   = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      this.vx      = (Math.random() - 0.5) * 1.5;  // nearly straight up
      this.vy      = -(11 + Math.random() * 4);     // slower than normal
      this.trail   = [];
      this.done    = false;
    }
    BallisticRocket.prototype.update = function () {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 35) this.trail.shift();  // long dramatic trail
      this.x += this.vx; this.y += this.vy;
      this.vy += 0.10;  // light gravity — climbs far
      if (this.y <= this.targetY || this.vy >= -0.5) this.done = true;
    };
    BallisticRocket.prototype.draw = function () {
      const n = this.trail.length;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle   = this.color;
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, 2 + t * 3, 0, Math.PI * 2);  // trail widens toward head
        ctx.fill();
      }
      // Glowing white core
      ctx.globalAlpha = 1;
      ctx.fillStyle   = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();
      // Large colored halo around the head
      ctx.globalAlpha = 0.45;
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 13, 0, Math.PI * 2);
      ctx.fill();
    };
    BallisticRocket.prototype.explode = function (parts) {
      if (parts.length > 2200) return;
      const count = 220 + Math.floor(Math.random() * 80);
      const alt1  = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      const alt2  = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      // Massive starburst
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const col   = i % 7 === 0 ? alt1 : i % 7 === 1 ? alt2 : this.color;
        parts.push(new Particle(this.x, this.y, col,
          angle + (Math.random() - 0.5) * 0.2, 3 + Math.random() * 9,
          { decay: 0.004 + Math.random() * 0.006, r: 2 + Math.random() * 3, gravity: 0.10, drag: 0.97 }));
      }
      // White shockwave ring
      for (let i = 0; i < 55; i++) {
        parts.push(new Particle(this.x, this.y, '#FFFFFF',
          Math.random() * Math.PI * 2, 11 + Math.random() * 6,
          { decay: 0.035, r: 1.5, gravity: 0.04, drag: 0.96 }));
      }
      // Gold glitter core
      for (let i = 0; i < 35; i++) {
        parts.push(new Particle(this.x, this.y, '#FFD700',
          Math.random() * Math.PI * 2, 1 + Math.random() * 3,
          { decay: 0.012, r: 2.5, gravity: 0.06, drag: 0.98 }));
      }
      // Heavy long-lasting ember rain
      for (let i = 0; i < 65; i++) {
        const col = i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? this.color : '#FFFFFF';
        parts.push(new Particle(
          this.x + (Math.random() - 0.5) * 70, this.y + (Math.random() - 0.5) * 15,
          col, Math.PI / 2 + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 2.2,
          { decay: 0.002 + Math.random() * 0.004, r: 1.5 + Math.random(), gravity: 0.14, drag: 0.99 }));
      }
    };

    /* ── Spawn helper ─────────────────────────────────────────── */
    let rockets   = [];
    let particles = [];
    let animId;
    let burstTimer;
    const tids = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); tids.push(id); };

    const spawnRocket = () => {
      // ~15% chance of ballistic on any given launch
      rockets.push(Math.random() < 0.15 ? new BallisticRocket() : new Rocket());
    };

    // Continuously schedule bursts — no pause ever
    const scheduleBurst = () => {
      burstTimer = setTimeout(() => {
        const count = 3 + Math.floor(Math.random() * 6);  // 3–8 per burst
        for (let i = 0; i < count; i++) setTimeout(spawnRocket, i * 110);
        scheduleBurst();
      }, 1500 + Math.random() * 1000);  // every 1.5–2.5 s
    };

    // Opening salvo: 12–15 at once
    const w1 = 12 + Math.floor(Math.random() * 4);
    for (let i = 0; i < w1; i++) later(spawnRocket, i * 80);

    // Second wave 2 s later
    const w2 = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < w2; i++) later(spawnRocket, 2000 + i * 120);

    // Then continuous forever
    scheduleBurst();

    /* ── Loop ────────────────────────────────────────────────── */
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';
      rockets = rockets.filter(r => {
        r.update();
        if (r.done) { r.explode(particles); return false; }
        r.draw();
        return true;
      });

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

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(burstTimer);
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

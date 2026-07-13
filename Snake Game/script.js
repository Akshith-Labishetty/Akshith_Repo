/* ============================================================
   SERPENT — Premium Snake Game
   Vanilla JS · no dependencies
   ------------------------------------------------------------
   Modules:
     • Audio      — WebAudio synth for SFX + ambient music
     • Particles  — background float + food-burst system
     • Game       — core loop, state, rendering (interpolated 60fps)
   ============================================================ */

(() => {
  'use strict';

  /* ---------- Config ---------- */
  const GRID = 20;                 // cells per axis
  const DIFFICULTY = {
    easy:   { step: 150, speedup: 0.6, label: 'Easy'   },
    medium: { step: 115, speedup: 1.0, label: 'Medium' },
    hard:   { step: 80,  speedup: 1.6, label: 'Hard'   },
  };
  const MIN_STEP = 55;             // fastest possible tick (ms)
  const COLORS = {
    snakeA: '#22C55E', snakeB: '#16A34A', head: '#4ADE80',
    food: '#EF4444', accent: '#06B6D4', grid: 'rgba(255,255,255,0.035)',
    obstacle: 'rgba(148,163,184,0.5)',
  };

  /* ---------- DOM ---------- */
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  const bgCanvas = $('#bg-particles');
  const bgCtx = bgCanvas.getContext('2d');

  const el = {
    score: $('#score'), high: $('#high-score'),
    finalScore: $('#final-score'), finalHigh: $('#final-high'),
    overBadge: $('#over-badge'), body: document.body,
    screenStart: $('#screen-start'), screenPause: $('#screen-pause'), screenOver: $('#screen-over'),
    btnPlay: $('#btn-play'), btnPause: $('#btn-pause'), btnResume: $('#btn-resume'),
    btnQuit: $('#btn-quit'), btnAgain: $('#btn-again'), btnShare: $('#btn-share'),
    btnSound: $('#btn-sound'), shareLabel: $('#share-label'),
    segThumb: $('#seg-thumb'), segOpts: document.querySelectorAll('.segmented__opt'),
    toggleObstacles: $('#toggle-obstacles'),
  };

  /* ============================================================
     AUDIO — small WebAudio synth (no asset files)
     ============================================================ */
  const Audio = (() => {
    let actx = null, muted = false, musicGain = null, musicTimer = null;

    const ensure = () => {
      if (!actx) {
        try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return null; }
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    };

    const tone = (freq, dur = 0.1, type = 'sine', vol = 0.2, when = 0) => {
      if (muted) return;
      const ac = ensure(); if (!ac) return;
      const t = ac.currentTime + when;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t); osc.stop(t + dur + 0.02);
    };

    /* Ambient background music — slow arpeggio pad */
    const scale = [220.0, 261.6, 329.6, 392.0, 440.0, 523.2];
    let step = 0;
    const startMusic = () => {
      const ac = ensure(); if (!ac || musicTimer) return;
      musicGain = ac.createGain();
      musicGain.gain.value = muted ? 0 : 0.04;
      musicGain.connect(ac.destination);
      const beat = () => {
        if (!actx) return;
        const t = actx.currentTime;
        const f = scale[step % scale.length];
        [f, f * 1.5].forEach((freq) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = 'triangle'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(1, t + 0.6);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
          o.connect(g).connect(musicGain);
          o.start(t); o.stop(t + 2);
        });
        step++;
      };
      beat();
      musicTimer = setInterval(beat, 1600);
    };
    const stopMusic = () => { clearInterval(musicTimer); musicTimer = null; };

    return {
      eat()   { tone(523.2, 0.09, 'square', 0.18); tone(784, 0.11, 'square', 0.14, 0.05); },
      turn()  { tone(320, 0.04, 'sine', 0.06); },
      over()  { tone(300, 0.2, 'sawtooth', 0.2); tone(180, 0.35, 'sawtooth', 0.18, 0.12); tone(120, 0.5, 'sawtooth', 0.16, 0.28); },
      start() { tone(392, 0.1, 'sine', 0.18); tone(587, 0.14, 'sine', 0.16, 0.08); },
      record(){ [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'sine', 0.16, i * 0.09)); },
      startMusic, stopMusic,
      toggleMute() {
        muted = !muted;
        if (musicGain) musicGain.gain.value = muted ? 0 : 0.04;
        return muted;
      },
      isMuted: () => muted,
      resume: ensure,
    };
  })();

  /* ============================================================
     BACKGROUND PARTICLES — gentle floating dots
     ============================================================ */
  const BgParticles = (() => {
    let w, h, dots = [];
    const resize = () => {
      w = bgCanvas.width = innerWidth; h = bgCanvas.height = innerHeight;
      const count = Math.min(70, Math.floor(w * h / 24000));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
        a: Math.random() * 0.4 + 0.1,
      }));
    };
    const tick = () => {
      bgCtx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = w; if (d.x > w) d.x = 0;
        if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
        bgCtx.beginPath();
        bgCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(148,163,184,${d.a})`;
        bgCtx.fill();
      }
      requestAnimationFrame(tick);
    };
    addEventListener('resize', resize);
    resize(); tick();
    return {};
  })();

  /* ============================================================
     FOOD-BURST PARTICLES (on the game canvas)
     ============================================================ */
  const Burst = (() => {
    let parts = [];
    const spawn = (x, y, color) => {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const spd = Math.random() * 3 + 1.5;
        parts.push({
          x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: 1, color, r: Math.random() * 3 + 1.5,
        });
      }
    };
    const update = (dt) => {
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.9; p.vy *= 0.9;
        p.life -= dt * 2.2;
      }
      parts = parts.filter((p) => p.life > 0);
    };
    const draw = (c) => {
      for (const p of parts) {
        c.globalAlpha = Math.max(0, p.life);
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    };
    return { spawn, update, draw, get active() { return parts.length > 0; } };
  })();

  /* ============================================================
     GAME CORE
     ============================================================ */
  const Game = {
    state: 'menu',            // menu | playing | paused | over
    difficulty: 'medium',
    obstacles: false,

    snake: [], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: { x: 0, y: 0 }, walls: [],
    score: 0, high: 0,
    step: 115, stepBase: 115,
    acc: 0, lastTime: 0,
    // interpolation: previous cell positions for smooth glide
    prevSnake: [],
    eatPulse: 0,             // shrink/grow anim on eat
    foodPulse: 0,           // pulsing food glow phase

    cell() { return canvas.width / GRID; },

    init() {
      this.high = +(localStorage.getItem('serpent_high') || 0);
      el.high.textContent = this.high;
      // crisp canvas on hi-dpi
      this.fitCanvas();
      addEventListener('resize', () => this.fitCanvas());
      requestAnimationFrame((t) => this.loop(t));
    },

    fitCanvas() {
      const size = Math.round(canvas.getBoundingClientRect().width);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._css = size;
    },
    cssCell() { return this._css / GRID; },

    reset() {
      const mid = Math.floor(GRID / 2);
      this.snake = [
        { x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid },
      ];
      this.prevSnake = this.snake.map((s) => ({ ...s }));
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.score = 0;
      el.score.textContent = '0';
      const cfg = DIFFICULTY[this.difficulty];
      this.stepBase = cfg.step;
      this.step = cfg.step;
      this.acc = 0;
      this.walls = this.obstacles ? this.makeWalls() : [];
      this.placeFood();
    },

    makeWalls() {
      const walls = [];
      const clusters = 4;
      for (let c = 0; c < clusters; c++) {
        const wx = 3 + Math.floor(Math.random() * (GRID - 6));
        const wy = 3 + Math.floor(Math.random() * (GRID - 6));
        const len = 2 + Math.floor(Math.random() * 3);
        const horiz = Math.random() > 0.5;
        for (let i = 0; i < len; i++) {
          const x = horiz ? wx + i : wx;
          const y = horiz ? wy : wy + i;
          if (x > 0 && x < GRID - 1 && y > 0 && y < GRID - 1) walls.push({ x, y });
        }
      }
      // keep center clear for spawn
      const mid = Math.floor(GRID / 2);
      return walls.filter((w) => Math.abs(w.y - mid) > 1 || w.x < mid - 4 || w.x > mid + 2);
    },

    placeFood() {
      let p, tries = 0;
      do {
        p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        tries++;
      } while (tries < 200 && (
        this.snake.some((s) => s.x === p.x && s.y === p.y) ||
        this.walls.some((w) => w.x === p.x && w.y === p.y)
      ));
      this.food = p;
    },

    setDir(x, y) {
      // prevent 180° reversal relative to current committed direction
      if (x === -this.dir.x && y === -this.dir.y) return;
      if (x === this.nextDir.x && y === this.nextDir.y) return;
      this.nextDir = { x, y };
      if (this.state === 'playing') Audio.turn();
    },

    tick() {
      this.dir = this.nextDir;
      // snapshot for interpolation
      this.prevSnake = this.snake.map((s) => ({ ...s }));

      const head = this.snake[0];
      const nx = head.x + this.dir.x;
      const ny = head.y + this.dir.y;

      // wall / self collision
      const hitWall = nx < 0 || ny < 0 || nx >= GRID || ny >= GRID;
      const hitSelf = this.snake.some((s, i) => i < this.snake.length - 1 && s.x === nx && s.y === ny);
      const hitObs = this.walls.some((w) => w.x === nx && w.y === ny);
      if (hitWall || hitSelf || hitObs) { this.gameOver(); return; }

      this.snake.unshift({ x: nx, y: ny });

      // eat?
      if (nx === this.food.x && ny === this.food.y) {
        this.score++;
        el.score.textContent = this.score;
        el.score.classList.remove('pop'); void el.score.offsetWidth; el.score.classList.add('pop');
        this.eatPulse = 1;
        Audio.eat();
        // particle burst at food location
        const c = this.cssCell();
        Burst.spawn((this.food.x + 0.5) * c, (this.food.y + 0.5) * c, COLORS.food);
        // haptic
        if (navigator.vibrate) navigator.vibrate(12);
        // progressive speed-up
        const cfg = DIFFICULTY[this.difficulty];
        this.step = Math.max(MIN_STEP, this.stepBase - this.score * cfg.speedup);
        this.placeFood();
      } else {
        this.snake.pop();
      }
    },

    gameOver() {
      this.state = 'over';
      el.body.classList.remove('is-paused');
      el.btnPause.disabled = true;
      Audio.stopMusic();
      Audio.over();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);

      const isRecord = this.score > this.high;
      if (isRecord) {
        this.high = this.score;
        localStorage.setItem('serpent_high', this.high);
        el.high.textContent = this.high;
        Audio.record();
      }
      el.finalScore.textContent = this.score;
      el.finalHigh.textContent = this.high;
      el.overBadge.textContent = isRecord ? 'New Record' : 'Game Over';
      el.overBadge.classList.toggle('badge--record', isRecord);
      el.shareLabel.textContent = 'Share Score';
      showScreen('over');
    },

    start() {
      Audio.resume(); Audio.start(); Audio.startMusic();
      this.reset();
      this.state = 'playing';
      el.btnPause.disabled = false;
      el.body.classList.remove('is-paused');
      hideScreens();
    },

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      el.body.classList.add('is-paused');
      Audio.stopMusic();
      showScreen('pause');
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      el.body.classList.remove('is-paused');
      Audio.startMusic();
      this.lastTime = performance.now();
      hideScreens();
    },
    togglePause() { this.state === 'playing' ? this.pause() : this.resume(); },

    quitToMenu() {
      this.state = 'menu';
      el.body.classList.remove('is-paused');
      el.btnPause.disabled = true;
      Audio.stopMusic();
      showScreen('start');
    },

    /* -------- main loop (rAF, fixed-step logic + interpolated render) -------- */
    loop(time) {
      const dt = Math.min(0.05, (time - (this.lastTime || time)) / 1000);
      this.lastTime = time;
      this.foodPulse += dt;
      if (this.eatPulse > 0) this.eatPulse = Math.max(0, this.eatPulse - dt * 4);
      Burst.update(dt);

      if (this.state === 'playing') {
        this.acc += dt * 1000;
        while (this.acc >= this.step) {
          this.acc -= this.step;
          this.tick();
          if (this.state !== 'playing') break;
        }
      }

      this.render();
      requestAnimationFrame((t) => this.loop(t));
    },

    /* -------- rendering -------- */
    render() {
      const size = this._css;
      const c = this.cssCell();
      ctx.clearRect(0, 0, size, size);

      // grid lines
      ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID; i++) {
        ctx.moveTo(i * c, 0); ctx.lineTo(i * c, size);
        ctx.moveTo(0, i * c); ctx.lineTo(size, i * c);
      }
      ctx.stroke();

      // obstacles
      for (const w of this.walls) {
        this.roundRect(w.x * c + 2, w.y * c + 2, c - 4, c - 4, 5);
        ctx.fillStyle = COLORS.obstacle; ctx.fill();
      }

      // food — pulsing glow
      this.drawFood(c);

      // snake — interpolated glide
      this.drawSnake(c);

      // burst particles on top
      Burst.draw(ctx);
    },

    drawFood(c) {
      const pulse = (Math.sin(this.foodPulse * 4) + 1) / 2;      // 0..1
      const cx = (this.food.x + 0.5) * c;
      const cy = (this.food.y + 0.5) * c;
      const r = c * 0.3 + pulse * c * 0.06;

      // glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, c * (0.9 + pulse * 0.3));
      glow.addColorStop(0, 'rgba(239,68,68,0.5)');
      glow.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, c * (0.9 + pulse * 0.3), 0, Math.PI * 2); ctx.fill();

      // core
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, '#FCA5A5');
      grad.addColorStop(0.5, COLORS.food);
      grad.addColorStop(1, '#B91C1C');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    },

    drawSnake(c) {
      // interpolation factor between logic ticks (0..1)
      let t = this.state === 'playing' ? Math.min(1, this.acc / this.step) : 1;
      const n = this.snake.length;

      for (let i = n - 1; i >= 0; i--) {
        const cur = this.snake[i];
        const prev = this.prevSnake[i] || cur;
        // smooth interpolation but ignore wrap jumps
        let ix = lerp(prev.x, cur.x, t);
        let iy = lerp(prev.y, cur.y, t);
        if (Math.abs(cur.x - prev.x) > 1 || Math.abs(cur.y - prev.y) > 1) { ix = cur.x; iy = cur.y; }

        const isHead = i === 0;
        const frac = i / Math.max(1, n - 1);
        // body gradient green -> darker toward tail
        const col = mixColor(COLORS.snakeA, COLORS.snakeB, frac);

        // eat pulse makes head swell briefly
        let pad = 2;
        if (isHead && this.eatPulse > 0) pad = 2 - this.eatPulse * 1.4;
        const seg = c - pad * 2;
        const x = ix * c + pad, y = iy * c + pad;
        const radius = isHead ? seg * 0.42 : seg * 0.34;

        if (isHead) {
          ctx.shadowColor = 'rgba(34,197,94,0.6)';
          ctx.shadowBlur = 14;
        } else {
          ctx.shadowColor = 'rgba(34,197,94,0.15)';
          ctx.shadowBlur = 5;
        }

        this.roundRect(x, y, seg, seg, radius);
        if (isHead) {
          const g = ctx.createLinearGradient(x, y, x + seg, y + seg);
          g.addColorStop(0, COLORS.head);
          g.addColorStop(1, COLORS.snakeA);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = col;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // eyes on head
        if (isHead) this.drawEyes(x, y, seg, c);
      }
    },

    drawEyes(x, y, seg, c) {
      const d = this.dir;
      const eR = seg * 0.11;
      // base eye offsets, rotated by direction
      const off = seg * 0.24, fwd = seg * 0.16;
      const cx = x + seg / 2, cy = y + seg / 2;
      // perpendicular axis for two eyes
      const px = -d.y, py = d.x;
      const eyes = [
        { ex: cx + d.x * fwd + px * off, ey: cy + d.y * fwd + py * off },
        { ex: cx + d.x * fwd - px * off, ey: cy + d.y * fwd - py * off },
      ];
      for (const e of eyes) {
        ctx.fillStyle = '#04140A';
        ctx.beginPath(); ctx.arc(e.ex, e.ey, eR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(e.ex - eR * 0.3, e.ey - eR * 0.3, eR * 0.4, 0, Math.PI * 2); ctx.fill();
      }
    },

    roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
  };

  /* ---------- small math helpers ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(c) { const n = parseInt(c.slice(1), 16); return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 }; }
  function mixColor(a, b, t) {
    const A = hex(a), B = hex(b);
    const r = Math.round(lerp(A.r, B.r, t)), g = Math.round(lerp(A.g, B.g, t)), bl = Math.round(lerp(A.b, B.b, t));
    return `rgb(${r},${g},${bl})`;
  }

  /* ============================================================
     SCREEN MANAGEMENT
     ============================================================ */
  function hideScreens() {
    [el.screenStart, el.screenPause, el.screenOver].forEach((s) => s.classList.remove('is-active'));
  }
  function showScreen(name) {
    hideScreens();
    ({ start: el.screenStart, pause: el.screenPause, over: el.screenOver })[name].classList.add('is-active');
  }

  /* ============================================================
     INPUT
     ============================================================ */
  const KEYMAP = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };

  addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (Game.state === 'playing' || Game.state === 'paused') Game.togglePause();
      else if (Game.state === 'menu') Game.start();
      return;
    }
    if (e.key === 'Enter' && Game.state === 'over') { Game.start(); return; }
    const m = KEYMAP[e.key];
    if (m) {
      e.preventDefault();
      if (Game.state === 'menu') Game.start();
      Game.setDir(m[0], m[1]);
    }
  });

  /* Touch swipe on the board */
  let touchStart = null;
  const board = $('#board');
  board.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;   // ignore taps
    if (Math.abs(dx) > Math.abs(dy)) Game.setDir(dx > 0 ? 1 : -1, 0);
    else Game.setDir(0, dy > 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });

  /* Mobile D-pad */
  document.querySelectorAll('.dpad__btn').forEach((btn) => {
    const dir = btn.dataset.dir;
    const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const handler = (e) => { e.preventDefault(); Game.setDir(map[0], map[1]); };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('click', handler);
  });

  /* ============================================================
     UI WIRING
     ============================================================ */
  // Difficulty segmented control
  const positions = { easy: 0, medium: 1, hard: 2 };
  function selectDifficulty(diff) {
    Game.difficulty = diff;
    el.segThumb.style.transform = `translateX(${positions[diff] * 100}%)`;
    el.segOpts.forEach((o) => {
      const on = o.dataset.difficulty === diff;
      o.classList.toggle('is-selected', on);
      o.setAttribute('aria-checked', on);
    });
  }
  el.segOpts.forEach((o) => o.addEventListener('click', () => { selectDifficulty(o.dataset.difficulty); Audio.resume(); Audio.turn(); }));
  selectDifficulty('medium');

  // Obstacles toggle
  el.toggleObstacles.addEventListener('change', (e) => { Game.obstacles = e.target.checked; });

  // Buttons
  el.btnPlay.addEventListener('click', () => Game.start());
  el.btnPause.addEventListener('click', () => Game.togglePause());
  el.btnResume.addEventListener('click', () => Game.resume());
  el.btnQuit.addEventListener('click', () => Game.quitToMenu());
  el.btnAgain.addEventListener('click', () => Game.start());

  // Sound toggle
  el.btnSound.addEventListener('click', () => {
    const muted = Audio.toggleMute();
    el.body.classList.toggle('is-muted', muted);
  });

  // Share score
  el.btnShare.addEventListener('click', async () => {
    const text = `I scored ${Game.score} in Serpent 🐍 (best: ${Game.high}). Can you beat me?`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Serpent', text }); }
      else { await navigator.clipboard.writeText(text); el.shareLabel.textContent = 'Copied!'; setTimeout(() => el.shareLabel.textContent = 'Share Score', 1600); }
    } catch { /* user cancelled */ }
  });

  /* ---------- Boot ---------- */
  Game.init();
})();

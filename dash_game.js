// dash_game.js - DASH engine: constants, icon drawing, object drawing, physics + renderer
export const U = 30, BASE = 311, STEP = 1 / 240, G = 3250, JUMP = 640, VMAX = 950;
export const PRIMARY = ['#7dff2a', '#ff3b3b', '#ff9a1f', '#ffe81f', '#1fd1ff', '#2f6bff', '#a43bff', '#ff4fd8', '#ffffff', '#3a3a4c'];
export const SECONDARY = ['#1fffe0', '#ffffff', '#ffd21f', '#ff6a3d', '#ff2f6d', '#7a4dff', '#3a8bff', '#2bd45a', '#111118', '#b0b0c0'];
export const DIFFS = [
  { id: 'easy', name: 'EASY', stars: 1, col: '#3aa0ff' },
  { id: 'medium', name: 'MEDIUM', stars: 2, col: '#35d35a' },
  { id: 'hard', name: 'HARD', stars: 3, col: '#ffd21f' },
  { id: 'insane', name: 'INSANE', stars: 4, col: '#ff3b3b' },
  { id: 'demon', name: 'DEMON', stars: 5, col: '#c4222f' }
];
export const SPEEDS = { port_s1: .8, port_s2: 1, port_s3: 1.3, port_s4: 1.6 };
const PORT_COL = { port_s1: '#f9a825', port_s2: '#2979ff', port_s3: '#2ee86b', port_s4: '#ff3d7f' };
export const OBJ = {
  block: { name: 'Block', cat: 'blocks', solid: true },
  spike: { name: 'Spike', cat: 'hazards' },
  orb_y: { name: 'Yellow Orb', cat: 'orbs' },
  orb_p: { name: 'Pink Orb', cat: 'orbs' },
  pad_y: { name: 'Yellow Pad', cat: 'pads' },
  pad_p: { name: 'Pink Pad', cat: 'pads' },
  port_s1: { name: 'Slow Portal', cat: 'portals' },
  port_s2: { name: 'Normal Portal', cat: 'portals' },
  port_s3: { name: 'Fast Portal', cat: 'portals' },
  port_s4: { name: 'Faster Portal', cat: 'portals' },
  trig_color: { name: 'Color Trigger', cat: 'triggers', trig: true },
  trig_move: { name: 'Move Trigger', cat: 'triggers', trig: true },
  trig_end: { name: 'End Trigger', cat: 'triggers', trig: true }
};
export const defColor = t => (t === 'block' || t === 'spike') ? '#0d0d22' : '#ffffff';
const PHYS = { orb_y: JUMP, orb_p: 450, pad_y: 900, pad_p: 620 };

const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerpC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const shade = (h, f) => rgb2hex(hex2rgb(h).map(v => Math.max(0, Math.min(255, v + 255 * f))));

// ---------- icons (36 cube skins = 6 faces x 6 patterns) ----------
function face(c, f, s) {
  const eye = (x, y, w, h, round) => {
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = s * .04;
    if (round) { c.beginPath(); c.ellipse(x * s, y * s, w * s / 2, h * s / 2, 0, 0, 7); c.fill(); c.stroke(); }
    else { c.fillRect((x - w / 2) * s, (y - h / 2) * s, w * s, h * s); c.strokeRect((x - w / 2) * s, (y - h / 2) * s, w * s, h * s); }
    c.fillStyle = '#000'; c.fillRect((x - w * .15) * s, (y - h * .15) * s, w * .3 * s, h * .3 * s);
  };
  const mouth = (x, y, w, h) => { c.fillStyle = '#000'; c.fillRect(x * s, y * s, w * s, h * s); };
  if (f === 0) { eye(-.2, -.1, .22, .22); eye(.2, -.1, .22, .22); mouth(-.22, .2, .44, .07); }
  else if (f === 1) { eye(-.2, -.1, .2, .2, 1); eye(.2, -.1, .2, .2, 1); c.strokeStyle = '#000'; c.lineWidth = s * .06; c.beginPath(); c.arc(0, .08 * s, .22 * s, .2, Math.PI - .2); c.stroke(); }
  else if (f === 2) { eye(0, -.08, .42, .34, 1); mouth(-.2, .22, .4, .06); }
  else if (f === 3) { eye(-.2, -.05, .2, .18); eye(.2, -.05, .2, .18); c.strokeStyle = '#000'; c.lineWidth = s * .07; c.beginPath(); c.moveTo(-.34 * s, -.26 * s); c.lineTo(-.08 * s, -.14 * s); c.moveTo(.34 * s, -.26 * s); c.lineTo(.08 * s, -.14 * s); c.stroke(); mouth(-.2, .22, .4, .06); }
  else if (f === 4) { eye(-.2, -.12, .14, .14, 1); eye(.2, -.12, .14, .14, 1); mouth(-.14, .12, .28, .18); }
  else { mouth(-.36, -.2, .72, .2); c.fillStyle = '#fff'; c.fillRect(-.3 * s, -.17 * s, .2 * s, .05 * s); c.fillRect(.1 * s, -.17 * s, .2 * s, .05 * s); mouth(-.2, .2, .4, .07); }
}
export function drawIcon(c, skin, c1, c2, s) {
  const h = s / 2, f = skin % 6, p = Math.floor(skin / 6) % 6, lw = Math.max(1, s * .08);
  c.save();
  c.fillStyle = c1; c.fillRect(-h, -h, s, s); c.fillStyle = c2;
  if (p === 0) c.fillRect(-s * .3, -s * .3, s * .6, s * .6);
  else if (p === 1) c.fillRect(-h, -s * .12, s, s * .24);
  else if (p === 2) { const q = s * .25;[[-h, -h], [h - q, -h], [-h, h - q], [h - q, h - q]].forEach(([x, y]) => c.fillRect(x, y, q, q)); }
  else if (p === 3) { c.beginPath(); c.moveTo(-h, -h); c.lineTo(h, -h); c.lineTo(-h, h); c.fill(); }
  else if (p === 4) { c.fillRect(-h, -h, s, s); c.fillStyle = c1; c.fillRect(-s * .3, -s * .3, s * .6, s * .6); }
  else { c.fillRect(-h, -h, h, h); c.fillRect(0, 0, h, h); }
  face(c, f, s);
  c.strokeStyle = '#000'; c.lineWidth = lw; c.strokeRect(-h + lw / 2, -h + lw / 2, s - lw, s - lw);
  c.restore();
}
const ICACHE = {};
export function skinURL(skin, c1, c2, size = 64) {
  const k = [skin, c1, c2, size].join('|'); if (ICACHE[k]) return ICACHE[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.translate(size / 2, size / 2); drawIcon(x, skin, c1, c2, size * .84); return ICACHE[k] = cv.toDataURL();
}
export function diffURL(id, size = 64) {
  const k = 'd' + id + size; if (ICACHE[k]) return ICACHE[k];
  const d = DIFFS.find(x => x.id === id) || DIFFS[0];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); const s = size;
  c.translate(s / 2, s / 2); c.lineWidth = s * .06; c.strokeStyle = '#000';
  if (id === 'demon') { c.fillStyle = '#7d0f1a'; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * .2, -s * .3); c.lineTo(sg * s * .42, -s * .52); c.lineTo(sg * s * .38, -s * .18); c.closePath(); c.fill(); c.stroke(); }); }
  c.fillStyle = d.col; c.beginPath(); c.arc(0, 0, s * .36, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#000';
  if (id === 'hard' || id === 'insane' || id === 'demon') { c.fillRect(-s * .2, -s * .12, s * .14, s * .1); c.fillRect(s * .06, -s * .12, s * .14, s * .1); }
  else { c.beginPath(); c.arc(-s * .13, -s * .08, s * .05, 0, 7); c.arc(s * .13, -s * .08, s * .05, 0, 7); c.fill(); }
  c.strokeStyle = '#000'; c.lineWidth = s * .05; c.beginPath();
  if (id === 'easy') c.arc(0, s * .02, s * .17, .15, Math.PI - .15);
  else if (id === 'medium') c.arc(0, s * .05, s * .12, .25, Math.PI - .25);
  else if (id === 'hard') { c.moveTo(-s * .12, s * .14); c.lineTo(s * .12, s * .14); }
  else c.arc(0, s * .24, s * .13, Math.PI + .3, -.3);
  c.stroke();
  if (id === 'demon') { c.fillStyle = '#fff'; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * .06, s * .14); c.lineTo(sg * s * .12, s * .14); c.lineTo(sg * s * .09, s * .24); c.fill(); }); }
  return ICACHE[k] = cv.toDataURL();
}

// ---------- object drawing (x,y = top-left of the cell on screen, cs = cell px) ----------
export function drawObj(c, o, x, y, cs, col, ed, time = 0) {
  const t = o.t, r = o.r || 0, lw = Math.max(1, cs * .07);
  c.save(); c.lineJoin = 'round';
  if (t === 'block') {
    c.fillStyle = col; c.fillRect(x, y, cs, cs); c.strokeStyle = '#fff'; c.lineWidth = lw; c.strokeRect(x + lw / 2, y + lw / 2, cs - lw, cs - lw);
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = lw * .6; c.strokeRect(x + cs * .22, y + cs * .22, cs * .56, cs * .56);
  } else if (t === 'spike') {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.moveTo(-cs / 2, cs / 2); c.lineTo(0, -cs / 2); c.lineTo(cs / 2, cs / 2); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(-cs * .2, cs * .42); c.lineTo(0, -cs * .12); c.lineTo(cs * .2, cs * .42); c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();
  } else if (t === 'orb_y' || t === 'orb_p') {
    const cl = t === 'orb_y' ? '#ffe21f' : '#ff5fd2', cx = x + cs / 2, cy = y + cs / 2, pu = 1 + Math.sin(time * 6) * .07;
    c.beginPath(); c.arc(cx, cy, cs * .46 * pu, 0, 7); c.strokeStyle = cl; c.globalAlpha = .55; c.lineWidth = lw; c.stroke(); c.globalAlpha = 1;
    c.beginPath(); c.arc(cx, cy, cs * .26, 0, 7); c.fillStyle = cl; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
  } else if (t === 'pad_y' || t === 'pad_p') {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.moveTo(-cs * .42, cs / 2); c.quadraticCurveTo(0, cs * .05, cs * .42, cs / 2); c.closePath();
    c.fillStyle = t === 'pad_y' ? '#ffe21f' : '#ff5fd2'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
  } else if (SPEEDS[t]) {
    const cx = x + cs / 2, cl = PORT_COL[t];
    c.beginPath(); c.ellipse(cx, y, cs * .34, cs, 0, 0, 7); c.fillStyle = cl; c.globalAlpha = .22; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = cl; c.lineWidth = lw * 1.6; c.stroke();
    c.fillStyle = '#fff'; c.font = `bold ${cs * .5}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(['>', '>>', '>>>', '>>>>'][['port_s1', 'port_s2', 'port_s3', 'port_s4'].indexOf(t)].slice(0, 3), cx, y);
  } else if (ed && OBJ[t].trig) {
    const cl = t === 'trig_color' ? (o.col || '#ff5252') : t === 'trig_move' ? '#3aa0ff' : '#35d35a';
    c.fillStyle = cl; c.globalAlpha = .85; c.fillRect(x + cs * .08, y + cs * .08, cs * .84, cs * .84); c.globalAlpha = 1;
    c.strokeStyle = '#fff'; c.lineWidth = lw; c.strokeRect(x + cs * .08, y + cs * .08, cs * .84, cs * .84);
    c.fillStyle = '#fff'; c.font = `bold ${cs * .34}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t === 'trig_color' ? 'COL' : t === 'trig_move' ? 'MOV' : 'END', x + cs / 2, y + cs / 2);
  }
  c.restore();
}

function rotRect(r, x0, y0, x1, y1) {
  let pts = [[x0, y0], [x1, y1]];
  for (let i = 0; i < r; i++) pts = pts.map(([x, y]) => { const dx = x - 15, dy = y - 15; return [15 + dy, 15 - dx]; });
  return [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])];
}
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

// ---------- the game ----------
export class Game {
  constructor(cv) {
    this.cv = cv; this.c = cv.getContext('2d'); this.cb = {}; this.running = false; this.paused = false;
    this.held = false; this.edgeT = 0; this.skin = { id: 0, c1: PRIMARY[0], c2: SECONDARY[0] };
    const press = d => { if (!this.running || this.paused) return; if (d) { if (!this.held) this.edgeT = .05; this.held = true; } else this.held = false; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); press(true); });
    addEventListener('pointerup', () => press(false)); addEventListener('pointercancel', () => press(false));
    addEventListener('keydown', e => {
      if (!this.running) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) press(true); }
      else if (e.code === 'Escape' && !e.repeat) this.cb.onPause && this.cb.onPause();
    });
    addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') press(false); });
    addEventListener('resize', () => this.running && this.resize());
  }
  resize() { const d = Math.min(2, devicePixelRatio || 1); this.cv.width = this.cv.clientWidth * d; this.cv.height = this.cv.clientHeight * d; }
  load(level) {
    this.level = level;
    const objs = (level.objs || []).map(o => ({ ...o, ex: o.x * U, ey: o.y * U, col0: o.c || defColor(o.t), col: o.c || defColor(o.t), used: false }));
    objs.sort((a, b) => a.ex - b.ex);
    this.groups = {};
    objs.forEach(o => { if (o.g) (this.groups[o.g] = this.groups[o.g] || []).push(o); if (o.t === 'spike') o.hb = rotRect(o.r || 0, 9, 0, 21, 18); });
    const mv = new Set(objs.filter(o => o.t === 'trig_move').map(o => o.tg));
    const solid = o => !OBJ[o.t].trig;
    this.S = objs.filter(o => solid(o) && !(o.g && mv.has(o.g)));
    this.D = objs.filter(o => solid(o) && o.g && mv.has(o.g));
    this.T = objs.filter(o => OBJ[o.t].trig);
    this.ports = objs.filter(o => SPEEDS[o.t]);
    const end = this.T.find(o => o.t === 'trig_end'); this.endX = end ? end.ex : Infinity;
    this.objs = objs;
  }
  timeAtX(x) {
    let t = 0, x0 = 0, sp = 1;
    for (const p of this.ports) { if (p.ex >= x) break; t += (p.ex - x0) / (BASE * sp); x0 = p.ex; sp = SPEEDS[p.t]; }
    return t + (x - x0) / (BASE * sp);
  }
  start(o = {}) {
    this.sx = o.x || 0; this.sy = o.y || 0; this.attempts = 1; this.best = 0; this.jumps = 0; this.camY = -70; this.won = false;
    this.reset(true); this.running = true; this.paused = false; this.acc = 0; this.last = performance.now();
    cancelAnimationFrame(this.raf); this.resize(); this.raf = requestAnimationFrame(t => this.frame(t));
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.held = false; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  reset(first) {
    this.objs.forEach(o => { o.col = o.col0; o.used = false; });
    this.gOff = {}; this.acts = []; this.parts = [];
    this.bg = this.level.bg || '#2b5fd9'; this.ground = this.level.ground || '#173a94';
    this.p = { x: this.sx, y: this.sy, vy: 0, rot: 0, grounded: false, dead: false, deadT: 0 };
    this.speed = 1; for (const p of this.ports) { if (p.ex >= this.sx) break; this.speed = SPEEDS[p.t]; }
    this.time = this.timeAtX(this.sx); this.ti = 0; this.si = 0;
    while (this.ti < this.T.length && this.T[this.ti].ex < this.sx) { this.fire(this.T[this.ti], true); this.ti++; }
    this.runActs();
    if (!first) this.attempts++;
    this.cb.onSpawn && this.cb.onSpawn(this.time);
  }
  fire(t, instant) {
    const dur = instant ? 0 : (t.dur || 0);
    if (t.t === 'trig_color') {
      const to = hex2rgb(t.col || '#ff5252');
      if (t.tg === 0) this.acts.push({ k: 'bg', from: hex2rgb(this.bg), to, t0: this.time, dur });
      else if (t.tg === -1) this.acts.push({ k: 'gr', from: hex2rgb(this.ground), to, t0: this.time, dur });
      else this.acts.push({ k: 'col', list: (this.groups[t.tg] || []).map(o => [o, hex2rgb(o.col)]), to, t0: this.time, dur });
    } else if (t.t === 'trig_move') {
      const b = this.gOff[t.tg] || { x: 0, y: 0 };
      this.acts.push({ k: 'mv', g: t.tg, b: { ...b }, d: [t.dx || 0, t.dy || 0], t0: this.time, dur });
    }
  }
  runActs() {
    for (let i = this.acts.length - 1; i >= 0; i--) {
      const a = this.acts[i], pr = a.dur > 0 ? Math.min(1, (this.time - a.t0) / a.dur) : 1;
      if (a.k === 'bg') this.bg = rgb2hex(lerpC(a.from, a.to, pr));
      else if (a.k === 'gr') this.ground = rgb2hex(lerpC(a.from, a.to, pr));
      else if (a.k === 'col') { const h = rgb2hex(lerpC([0, 0, 0], a.to, 1)); for (const [o, f] of a.list) o.col = pr >= 1 ? h : rgb2hex(lerpC(f, a.to, pr)); }
      else if (a.k === 'mv') { const e = ease(pr); this.gOff[a.g] = { x: a.b.x + a.d[0] * e, y: a.b.y + a.d[1] * e }; }
      if (pr >= 1) this.acts.splice(i, 1);
    }
  }
  die() {
    const p = this.p; p.dead = true; p.deadT = .7;
    for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 260; this.parts.push({ x: p.x + 15, y: p.y + 15, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .6 + Math.random() * .3, col: i % 2 ? this.skin.c1 : this.skin.c2, s: 3 + Math.random() * 5 }); }
    this.cb.onDeath && this.cb.onDeath(this.pct(), this.attempts);
  }
  pct() { return isFinite(this.endX) ? Math.max(0, Math.min(100, this.p.x / this.endX * 100)) : 0; }
  hit(p, x, y, w, h, inset = 0) { return p.x + inset < x + w && p.x + 30 - inset > x && p.y + inset < y + h && p.y + 30 - inset > y; }
  step(dt) {
    const p = this.p;
    if (p.dead) {
      p.deadT -= dt; for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 600 * dt; q.life -= dt; }
      this.parts = this.parts.filter(q => q.life > 0); if (p.deadT <= 0) this.reset(); return;
    }
    this.time += dt; this.edgeT -= dt;
    while (this.ti < this.T.length && this.T[this.ti].ex <= p.x) {
      const t = this.T[this.ti++]; if (t.t === 'trig_end') { this.win(); return; } this.fire(t);
    }
    this.runActs();
    if (this.held && p.grounded) { p.vy = JUMP; p.grounded = false; this.jumps++; }
    const edge = this.edgeT > 0, prevB = p.y;
    p.grounded = false;
    p.x += BASE * this.speed * dt; p.vy -= G * dt; if (p.vy < -VMAX) p.vy = -VMAX; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    const S = this.S;
    while (this.si < S.length && S[this.si].ex < p.x - 40) this.si++;
    for (let i = this.si; i < S.length && S[i].ex < p.x + 40; i++) { this.inter(S[i], 0, 0, prevB, edge); if (p.dead) return; }
    for (const o of this.D) {
      const g = this.gOff[o.g]; this.inter(o, g ? g.x * U : 0, g ? g.y * U : 0, prevB, edge); if (p.dead) return;
    }
    if (p.grounded) { const t = Math.round(p.rot / 90) * 90; p.rot += (t - p.rot) * Math.min(1, 30 * dt); }
    else p.rot += 420 * dt;
    if (!p.dead && p.grounded && Math.random() < dt * 30) this.parts.push({ x: p.x, y: p.y + 2, vx: -40 - Math.random() * 40, vy: 30 + Math.random() * 50, life: .25, col: this.skin.c1, s: 2 + Math.random() * 2 });
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    if (this.parts.length > 60) this.parts = this.parts.filter(q => q.life > 0);
  }
  inter(o, gx, gy, prevB, edge) {
    const p = this.p, x = o.ex + gx, y = o.ey + gy, t = o.t;
    if (t === 'block') {
      if (this.hit(p, x, y, U, U)) {
        if (p.vy <= 0 && prevB >= y + U - 4) { p.y = y + U; p.vy = 0; p.grounded = true; }
        else this.die();
      }
    } else if (t === 'spike') {
      const h = o.hb; if (this.hit(p, x + h[0], y + h[1], h[2] - h[0], h[3] - h[1], 4)) this.die();
    } else if (t === 'orb_y' || t === 'orb_p') {
      const dx = p.x + 15 - (x + 15), dy = p.y + 15 - (y + 15), on = dx * dx + dy * dy < 26 * 26;
      if (on && edge && !o.used) { p.vy = PHYS[t]; o.used = true; p.grounded = false; this.edgeT = 0; this.jumps++; }
      else if (!on) o.used = false;
    } else if (t === 'pad_y' || t === 'pad_p') {
      const on = this.hit(p, x + 2, y, U - 4, 12);
      if (on && !o.used) { p.vy = PHYS[t]; o.used = true; p.grounded = false; }
      else if (!on) o.used = false;
    } else if (SPEEDS[t]) {
      if (this.hit(p, x + 5, y, 20, 60)) this.speed = SPEEDS[t];
    }
  }
  win() { this.won = true; this.p.grounded = true; this.cb.onWin && this.cb.onWin(); }
  frame(ts) {
    if (!this.running) return;
    const dt = Math.min(.05, (ts - this.last) / 1000); this.last = ts;
    if (!this.paused && !this.won) { this.acc += dt; let n = 0; while (this.acc >= STEP && n++ < 40) { this.step(STEP); this.acc -= STEP; } if (this.p.dead === false) this.best = Math.max(this.best, this.pct()); }
    this.render(dt);
    this.cb.onFrame && this.cb.onFrame(this.pct(), this.attempts);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  render(dt) {
    const c = this.c, W = this.cv.width, H = this.cv.height, s = H / 330, p = this.p;
    this.camX = p.x - (W / s) * .3;
    const ty = Math.max(-70, p.y - 330 * .4); this.camY += (ty - this.camY) * Math.min(1, 6 * dt);
    const X = x => (x - this.camX) * s, Y = y => H - (y - this.camY) * s;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, this.bg); g.addColorStop(1, shade(this.bg, -.35));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.05)'; const gs = 150 * s, off = (this.camX * .35 * s) % gs;
    for (let x = -off; x < W; x += gs) c.fillRect(x, 0, gs * .5, H);
    const gy = Y(0);
    if (gy < H) {
      c.fillStyle = this.ground; c.fillRect(0, gy, W, H - gy);
      c.fillStyle = 'rgba(0,0,0,.18)'; const g2 = 60 * s, o2 = (this.camX * s) % g2; for (let x = -o2; x < W; x += g2) c.fillRect(x, gy + 3 * s, g2 / 2, H);
      c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(0, gy - 2 * s, W, 3 * s);
    }
    if (this.attempts && this.sx === 0) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `bold ${30 * s}px "Lilita One",sans-serif`; c.textAlign = 'left'; c.fillText('Attempt ' + this.attempts, X(150), Y(150)); }
    const cs = U * s, S = this.S; let lo = 0, hi = S.length; const lx = this.camX - 60;
    while (lo < hi) { const m = (lo + hi) >> 1; if (S[m].ex < lx) lo = m + 1; else hi = m; }
    const rx = this.camX + W / s + 60;
    for (let i = lo; i < S.length && S[i].ex < rx; i++) { const o = S[i]; drawObj(c, o, X(o.ex), Y(o.ey + U), cs, o.col, false, this.time); }
    for (const o of this.D) { const gg = this.gOff[o.g], gx = gg ? gg.x * U : 0, gyy = gg ? gg.y * U : 0, x = X(o.ex + gx); if (x > -cs * 2 && x < W + cs) drawObj(c, o, x, Y(o.ey + gyy + U), cs, o.col, false, this.time); }
    if (isFinite(this.endX)) { const x = X(this.endX); if (x > -50 && x < W + 50) { const gr = c.createLinearGradient(x - 12 * s, 0, x + 12 * s, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - 12 * s, 0, 24 * s, H); } }
    for (const q of this.parts) { c.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); c.fillStyle = q.col; c.fillRect(X(q.x) - q.s * s / 2, Y(q.y) - q.s * s / 2, q.s * s, q.s * s); }
    c.globalAlpha = 1;
    if (!p.dead) { c.save(); c.translate(X(p.x) + 15 * s, Y(p.y) - 15 * s); c.rotate(p.rot * Math.PI / 180); drawIcon(c, this.skin.id, this.skin.c1, this.skin.c2, 30 * s); c.restore(); }
  }
}

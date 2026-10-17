// dash_app.js - DASH (single file: Firebase setup, engine, UI, editor). Put all future code here.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, addDoc, onSnapshot, serverTimestamp, increment, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getStorage, ref as sref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js";
// dash_firebase.js - Firebase setup for DASH

const firebaseConfig = {
  apiKey: "AIzaSyAlQ0fG9UUgyFFdwlKlTb0p2nbeoJkc3ig",
  authDomain: "dash-da809.firebaseapp.com",
  projectId: "dash-da809",
  storageBucket: "dash-da809.firebasestorage.app",
  messagingSenderId: "463073446480",
  appId: "1:463073446480:web:d939f6448a8391dcfa9f55",
  measurementId: "G-G3D6GQ09CJ"
};

const app = initializeApp(firebaseConfig);
isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* ===== ENGINE ===== */
// dash_game.js - DASH engine: constants, icon drawing, object drawing, physics + renderer
const U = 30, BASE = 311, STEP = 1 / 240, G = 3250, JUMP = 640, VMAX = 950;
const PRIMARY = ['#7dff2a', '#ff3b3b', '#ff9a1f', '#ffe81f', '#1fd1ff', '#2f6bff', '#a43bff', '#ff4fd8', '#ffffff', '#3a3a4c'];
const SECONDARY = ['#1fffe0', '#e8f1ff', '#ffd21f', '#ff6a3d', '#ff2f6d', '#7a4dff', '#3a8bff', '#2bd45a', '#111118', '#b0b0c0'];
const DIFFS = [
  { id: 'easy', name: 'EASY', stars: 1, col: '#3aa0ff' },
  { id: 'medium', name: 'MEDIUM', stars: 2, col: '#35d35a' },
  { id: 'hard', name: 'HARD', stars: 3, col: '#ffd21f' },
  { id: 'insane', name: 'INSANE', stars: 4, col: '#ff3b3b' },
  { id: 'demon', name: 'DEMON', stars: 5, col: '#c4222f' }
];
const SPEEDS = { port_s1: .8, port_s2: 1, port_s3: 1.3, port_s4: 1.6 };
const PORT_COL = { port_s1: '#f9a825', port_s2: '#2979ff', port_s3: '#2ee86b', port_s4: '#ff3d7f', port_gd: '#2ee0ff', port_gu: '#ff9a2e', port_ship: '#ff4fd8', port_cube: '#7dff2a' };
const GRAV = { port_gd: 1, port_gu: 1 }, MODEP = { port_ship: 1, port_cube: 1 }, CEIL = 450;
const OBJ = {
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
  trig_end: { name: 'End Trigger', cat: 'triggers', trig: true },
  orb_b: { name: 'Blue Orb (gravity)', cat: 'orbs' },
  port_gd: { name: 'Gravity Down Portal', cat: 'portals' },
  port_gu: { name: 'Gravity Up Portal', cat: 'portals' }
};
OBJ.port_ship = { name: 'Ship Portal', cat: 'portals' }; OBJ.port_cube = { name: 'Cube Portal', cat: 'portals' };
OBJ.spike.hz = { k: 't', a: 1, b: 1, n: 1 };
['Plain','Inset','Cross','Dots','Stripes','Checker','Bevel','Slab','Frame','Diamond'].forEach((n, i) => [0, 1].forEach(v => { if (i + v) OBJ['blk' + (i + v * 10)] = { name: n + (v ? ' Dark' : ''), cat: 'blocks', solid: true, bs: i, bv: v }; }));
OBJ.block.solid = true;
[['Half Spike','t',1,.5,1],['Thin Spike','t',.5,1,1],['Wide Spike','t',1,.7,1],['Double Spike','t',1,1,2],['Triple Spike','t',1,1,3],['Mini Spikes','t',1,.5,3],['Quad Mini','t',1,.4,4],['Needle','t',.3,1,1],['Fang','t',.7,1,1],
 ['Mini Saw','s',.22,6],['Small Saw','s',.35,8],['Saw','s',.5,8],['Big Saw','s',.75,10],['Large Saw','s',1,12],['Huge Saw','s',1.5,14],['Star Saw','s',.5,5],['Blade Saw','s',.6,3],['Gear','s',.5,12],['Spiky Ball','s',.4,16]]
 .forEach(([n, k, a, b, c], i) => OBJ['hz' + i] = { name: n, cat: 'hazards', hz: k === 't' ? { k, a, b, n: c } : { k, a, b } });
['Flower','Tulip','Bush','Tree','Grass','Cloud','Big Cloud','Brick','Mini Bricks','Mini Spike','Mini Spike Row','Star','Moon','Sun','Dots','Ring','Diamond','Crystal','Vine','Mushroom','Leaf','Pebbles','Fence','Lamp','Arrow','Cross','Wave','Zigzag','Heart','Pillar']
 .forEach((n, i) => OBJ['dc' + i] = { name: n, cat: 'decor', deco: true, dk: i, di: i });
function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
const BGS = [['stripes','Stripes'],['dots','Dots'],['tri','Triangles'],['circles','Circles'],['grid','Grid'],['waves','Waves'],['none','Plain']];
const defColor = t => { const d = OBJ[t]; if (!d) return '#ffffff'; if (d.deco) return hsl(d.di * 47 % 360, 65, 68); if (t === 'block' || d.hz) return '#0d0d22'; if (d.bs !== undefined) return d.bv ? '#27276a' : '#0d0d22'; return '#ffffff'; };
const PHYS = { orb_y: JUMP, orb_p: 450, pad_y: 900, pad_p: 620 };

const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerpC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (h, f) => rgb2hex(hex2rgb(h).map(v => Math.max(0, Math.min(255, v + 255 * f))));

// ---------- icons (36 cube skins = 6 faces x 6 patterns) ----------
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function face(c, f, s) {
  c.strokeStyle = '#111'; c.lineWidth = s * .05; c.lineCap = 'round';
  const eye = (x, y, r) => { c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fillStyle = '#fff'; c.fill(); c.stroke(); c.fillStyle = '#111'; c.beginPath(); c.arc((x + .02) * s, y * s, r * s * .5, 0, 7); c.fill(); };
  const arc = (x, y, r, a, b) => { c.beginPath(); c.arc(x * s, y * s, r * s, a, b); c.stroke(); };
  if (f === 0) { eye(-.18, -.08, .11); eye(.18, -.08, .11); arc(0, .05, .18, .3, Math.PI - .3); }
  else if (f === 1) { eye(-.18, -.08, .08); eye(.18, -.08, .08); c.beginPath(); c.moveTo(-.15 * s, .2 * s); c.lineTo(.15 * s, .2 * s); c.stroke(); }
  else if (f === 2) { eye(0, -.05, .2); c.beginPath(); c.arc(0, .27 * s, .05 * s, 0, 7); c.fillStyle = '#111'; c.fill(); }
  else if (f === 3) { eye(-.2, -.05, .1); eye(.2, -.05, .1); c.beginPath(); c.moveTo(-.34 * s, -.26 * s); c.lineTo(-.08 * s, -.17 * s); c.moveTo(.34 * s, -.26 * s); c.lineTo(.08 * s, -.17 * s); c.stroke(); arc(0, .32, .13, Math.PI + .4, -.4); }
  else if (f === 4) { c.fillStyle = '#111'; c.fillRect(-.36 * s, -.17 * s, .72 * s, .18 * s); arc(0, .05, .16, .4, Math.PI - .4); }
  else { eye(-.2, -.08, .09); eye(.2, -.08, .09); c.beginPath(); c.arc(0, .14 * s, .1 * s, 0, Math.PI); c.fillStyle = '#111'; c.fill(); }
}
function drawIcon(c, skin, c1, c2, s) {
  const h = s / 2, f = skin % 6, p = Math.floor(skin / 6) % 6, lw = Math.max(1.5, s * .07);
  c.save(); c.lineJoin = 'round'; rr(c, -h, -h, s, s, s * .2); c.fillStyle = c1; c.fill(); c.save(); c.clip(); c.fillStyle = c2; c.strokeStyle = c2;
  if (p === 0) { c.beginPath(); c.moveTo(0, -h * .95); c.lineTo(h * .95, 0); c.lineTo(0, h * .95); c.lineTo(-h * .95, 0); c.closePath(); c.globalAlpha = .45; c.fill(); }
  else if (p === 1) c.fillRect(-h, h * .65, s, h * .4);
  else if (p === 2) { const q = s * .22;[[-h, -h], [h - q, -h], [-h, h - q], [h - q, h - q]].forEach(([x, y]) => c.fillRect(x, y, q, q)); }
  else if (p === 3) { c.beginPath(); c.moveTo(-h, -h); c.lineTo(h, -h); c.lineTo(-h, h); c.closePath(); c.globalAlpha = .6; c.fill(); }
  else if (p === 4) { c.lineWidth = s * .14; c.strokeRect(-h, -h, s, s); }
  else { c.lineWidth = s * .1; c.beginPath(); c.moveTo(-h, h * .55); c.lineTo(0, h * .95); c.lineTo(h, h * .55); c.stroke(); }
  c.restore(); face(c, f, s); rr(c, -h + lw / 2, -h + lw / 2, s - lw, s - lw, s * .2); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke(); c.restore();
}
const HULL = [[-.5, .3, -.4, .02, .35, .02, .55, .2, .4, .3], 0, [-.5, .2, -.3, .05, .3, .05, .55, .17, .3, .3, -.3, .3], [-.5, .3, -.5, .05, .55, .22, .55, .3], 0, [-.5, .3, -.5, 0, -.3, .12, .45, .12, .55, .22, .4, .3]];
function hull(c, k, s) { c.beginPath(); if (k === 1) c.ellipse(0, .17 * s, .52 * s, .16 * s, 0, 0, 7); else if (k === 4) rr(c, -.5 * s, .04 * s, 1.05 * s, .27 * s, .13 * s); else { const a = HULL[k]; for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); } }
function drawShip(c, cube, ship, c1, c2, s) {
  const k = ship % 6, p = Math.floor(ship / 6) % 5, lw = Math.max(1.5, s * .05);
  c.save(); c.translate(0, -s * .05); c.lineJoin = 'round';
  c.save(); c.translate(0, -s * .13); drawIcon(c, cube, c1, c2, s * .55); c.restore();
  c.fillStyle = '#ffb020'; c.beginPath(); c.moveTo(-.5 * s, .12 * s); c.lineTo(-.7 * s, .17 * s); c.lineTo(-.5 * s, .22 * s); c.fill();
  hull(c, k, s); c.fillStyle = c2; c.fill(); c.save(); c.clip(); c.fillStyle = c1;
  if (p === 0) c.fillRect(-s, .14 * s, 2 * s, .06 * s);
  else if (p === 1) [-.2, 0, .2].forEach(x => { c.beginPath(); c.arc(x * s, .17 * s, .035 * s, 0, 7); c.fill(); });
  else if (p === 2) c.fillRect(-s, 0, .75 * s, s);
  else if (p === 3) c.fillRect(.3 * s, 0, s, s);
  else { c.fillRect(-s, .24 * s, 2 * s, .07 * s); c.beginPath(); c.arc(.1 * s, .12 * s, .04 * s, 0, 7); c.fill(); }
  c.restore(); hull(c, k, s); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke(); c.restore();
}
const ICACHE = {};
function shipURL(ship, cube, c1, c2, size = 64) {
  const key = ['ship', ship, cube, c1, c2, size].join('|'); if (ICACHE[key]) return ICACHE[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.translate(size / 2, size / 2); drawShip(x, cube, ship, c1, c2, size * .8); return ICACHE[key] = cv.toDataURL();
}
function skinURL(skin, c1, c2, size = 64) {
  const k = [skin, c1, c2, size].join('|'); if (ICACHE[k]) return ICACHE[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.translate(size / 2, size / 2); drawIcon(x, skin, c1, c2, size * .84); return ICACHE[k] = cv.toDataURL();
}
function diffURL(id, size = 64) {
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
function drawObj(c, o, x, y, cs, col, ed, time = 0) {
  const t = o.t, r = o.r || 0, lw = Math.max(1, cs * .07);
  c.save(); c.lineJoin = 'round';
  if (OBJ[t].hz && t !== 'spike') hzDraw(c, OBJ[t].hz, o, x, y, cs, col, lw, time);
  else if (OBJ[t].deco) { c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2); c.translate(-cs / 2, -cs / 2); decor(c, OBJ[t].dk, cs, col); }
  else if (OBJ[t].bs !== undefined) blockDraw(c, OBJ[t].bs, x, y, cs, col, lw);
  else if (t === 'block') {
    c.fillStyle = col; c.fillRect(x, y, cs, cs); c.strokeStyle = '#fff'; c.lineWidth = lw; c.strokeRect(x + lw / 2, y + lw / 2, cs - lw, cs - lw);
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = lw * .6; c.strokeRect(x + cs * .22, y + cs * .22, cs * .56, cs * .56);
  } else if (t === 'spike') {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.moveTo(-cs / 2, cs / 2); c.lineTo(0, -cs / 2); c.lineTo(cs / 2, cs / 2); c.closePath();
    c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
    c.beginPath(); c.moveTo(-cs * .2, cs * .42); c.lineTo(0, -cs * .12); c.lineTo(cs * .2, cs * .42); c.strokeStyle = 'rgba(255,255,255,.25)'; c.stroke();
  } else if (['orb_y', 'orb_p', 'orb_b'].includes(t)) {
    const cl = t === 'orb_y' ? '#ffe21f' : t === 'orb_b' ? '#2fb6ff' : '#ff5fd2', cx = x + cs / 2, cy = y + cs / 2, pu = 1 + Math.sin(time * 6) * .07;
    c.beginPath(); c.arc(cx, cy, cs * .46 * pu, 0, 7); c.strokeStyle = cl; c.globalAlpha = .55; c.lineWidth = lw; c.stroke(); c.globalAlpha = 1;
    c.beginPath(); c.arc(cx, cy, cs * .26, 0, 7); c.fillStyle = cl; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
  } else if (t === 'pad_y' || t === 'pad_p') {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.moveTo(-cs * .42, cs / 2); c.quadraticCurveTo(0, cs * .05, cs * .42, cs / 2); c.closePath();
    c.fillStyle = t === 'pad_y' ? '#ffe21f' : '#ff5fd2'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
  } else if (SPEEDS[t] || GRAV[t] || MODEP[t]) {
    const cx = x + cs / 2, cl = PORT_COL[t];
    c.beginPath(); c.ellipse(cx, y, cs * .34, cs, 0, 0, 7); c.fillStyle = cl; c.globalAlpha = .22; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = cl; c.lineWidth = lw * 1.6; c.stroke();
    c.fillStyle = '#fff'; c.font = `bold ${cs * .5}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(MODEP[t] ? (t === 'port_ship' ? 'S' : 'C') : GRAV[t] ? (t === 'port_gd' ? '▼' : '▲') : ['>', '>>', '>>>', '>>>>'][['port_s1', 'port_s2', 'port_s3', 'port_s4'].indexOf(t)].slice(0, 3), cx, y);
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
function drawBG(c, W, H, s, camX, st = 'stripes') {
  c.fillStyle = 'rgba(255,255,255,.06)'; c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2 * s;
  const gg = (st === 'tri' ? 120 : st === 'circles' ? 140 : 90) * s, off = (camX * .35 * s) % gg;
  if (st === 'stripes') { const gs = 150 * s, o = (camX * .35 * s) % gs; for (let x = -o; x < W; x += gs) c.fillRect(x, 0, gs * .5, H); }
  else if (st === 'dots') for (let x = -off; x < W; x += gg) for (let y = gg / 2; y < H; y += gg) { c.beginPath(); c.arc(x, y, 9 * s, 0, 7); c.fill(); }
  else if (st === 'tri') for (let x = -off; x < W; x += gg) for (let y = 0; y < H; y += gg) { c.beginPath(); c.moveTo(x, y + gg * .8); c.lineTo(x + gg * .4, y + gg * .2); c.lineTo(x + gg * .8, y + gg * .8); c.closePath(); c.fill(); }
  else if (st === 'circles') for (let x = -off; x < W; x += gg) for (let y = gg / 2; y < H; y += gg) { c.beginPath(); c.arc(x, y, gg * .3, 0, 7); c.stroke(); }
  else if (st === 'grid') { for (let x = -off; x < W; x += gg) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += gg) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
  else if (st === 'waves') for (let y = gg / 2; y < H; y += gg) { c.beginPath(); for (let x = -gg; x < W + gg; x += 12 * s) c[x === -gg ? 'moveTo' : 'lineTo'](x, y + Math.sin((x + off * 2) / (30 * s)) * 12 * s); c.stroke(); }
}
function blockDraw(c, b, x, y, s, col, lw) {
  c.fillStyle = col; c.fillRect(x, y, s, s); c.strokeStyle = '#fff'; c.lineWidth = lw; c.strokeRect(x + lw / 2, y + lw / 2, s - lw, s - lw);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.strokeStyle = 'rgba(255,255,255,.3)';
  if (b === 1) c.strokeRect(x + s * .2, y + s * .2, s * .6, s * .6);
  else if (b === 2) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s); c.moveTo(x + s, y); c.lineTo(x, y + s); c.stroke(); }
  else if (b === 3) for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + s * (.3 + .4 * (i & 1)), y + s * (.3 + .4 * (i >> 1)), s * .07, 0, 7); c.fill(); }
  else if (b === 4) for (let i = 1; i < 4; i++) c.fillRect(x, y + s * i / 4 - s * .03, s, s * .06);
  else if (b === 5) { c.fillRect(x, y, s / 2, s / 2); c.fillRect(x + s / 2, y + s / 2, s / 2, s / 2); }
  else if (b === 6) { c.fillRect(x, y, s, s * .18); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + s * .82, s, s * .18); }
  else if (b === 7) c.fillRect(x, y, s, s * .35);
  else if (b === 8) { c.lineWidth = s * .16; c.strokeRect(x + s * .15, y + s * .15, s * .7, s * .7); }
  else if (b === 9) { c.beginPath(); c.moveTo(x + s / 2, y + s * .15); c.lineTo(x + s * .85, y + s / 2); c.lineTo(x + s / 2, y + s * .85); c.lineTo(x + s * .15, y + s / 2); c.closePath(); c.stroke(); }
}
function hzDraw(c, h, o, x, y, s, col, lw, time) {
  c.translate(x + s / 2, y + s / 2); c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = lw;
  if (h.k === 't') {
    c.rotate((o.r || 0) * Math.PI / 2); const n = h.n, w = s * h.a / n, hh = s * h.b;
    for (let i = 0; i < n; i++) { const x0 = -s * h.a / 2 + i * w; c.beginPath(); c.moveTo(x0, s / 2); c.lineTo(x0 + w / 2, s / 2 - hh); c.lineTo(x0 + w, s / 2); c.closePath(); c.fill(); c.stroke(); }
  } else {
    c.rotate(time * 4 + (o.r || 0)); const R = s * h.a, N = h.b; c.beginPath();
    for (let i = 0; i < N * 2; i++) { const an = i * Math.PI / N, rr = i & 1 ? R * .72 : R; c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); }
    c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, R * .22, 0, 7); c.fillStyle = '#fff'; c.fill();
  }
}
function decor(c, k, s, col) {
  const f = (x, y, w, h) => c.fillRect(x * s, y * s, w * s, h * s), o = (x, y, r) => { c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); },
    P = (...a) => { c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); c.fill(); },
    L = (...a) => { c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.stroke(); };
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = s * .07; c.lineCap = 'round';
  const GR = '#3fbf4f', BR = '#8a5a2b';
  switch (k) {
    case 0: c.strokeStyle = GR; L(.5, 1, .5, .5); for (let i = 0; i < 5; i++) o(.5 + Math.cos(i * 1.257) * .15, .4 + Math.sin(i * 1.257) * .15, .1); c.fillStyle = '#ffe36b'; o(.5, .4, .08); break;
    case 1: c.strokeStyle = GR; L(.5, 1, .5, .5); P(.3, .15, .5, .4, .7, .15, .65, .55, .35, .55); break;
    case 2: c.fillStyle = GR; o(.3, .75, .22); o(.55, .65, .28); o(.75, .8, .18); break;
    case 3: c.fillStyle = BR; f(.45, .5, .1, .5); c.fillStyle = GR; o(.5, .35, .3); break;
    case 4: c.strokeStyle = GR; L(.3, 1, .25, .5); L(.5, 1, .5, .35); L(.7, 1, .75, .5); break;
    case 5: o(.3, .6, .2); o(.5, .5, .25); o(.7, .6, .2); f(.3, .6, .4, .2); break;
    case 6: o(.2, .65, .18); o(.4, .45, .25); o(.65, .5, .22); o(.82, .68, .15); f(.2, .65, .62, .18); break;
    case 7: f(.05, .2, .9, .6); c.strokeStyle = 'rgba(0,0,0,.4)'; L(.05, .5, .95, .5); L(.5, .2, .5, .5); L(.28, .5, .28, .8); break;
    case 8: f(.08, .1, .38, .3); f(.54, .1, .38, .3); f(.3, .5, .4, .3); break;
    case 9: P(.3, 1, .5, .55, .7, 1); break;
    case 10: P(.05, 1, .25, .6, .45, 1); P(.55, 1, .75, .6, .95, 1); break;
    case 11: { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? .17 : .4; c[i ? 'lineTo' : 'moveTo']((.5 + Math.cos(a) * r) * s, (.5 + Math.sin(a) * r) * s); } c.fill(); break; }
    case 12: c.beginPath(); c.arc(.5 * s, .5 * s, .35 * s, .6, 5.7); c.arc(.62 * s, .45 * s, .28 * s, 5.2, 1.0, true); c.fill(); break;
    case 13: o(.5, .5, .2); for (let i = 0; i < 8; i++) L(.5 + Math.cos(i * .785) * .28, .5 + Math.sin(i * .785) * .28, .5 + Math.cos(i * .785) * .42, .5 + Math.sin(i * .785) * .42); break;
    case 14: o(.25, .3, .08); o(.6, .5, .1); o(.4, .78, .07); break;
    case 15: c.beginPath(); c.arc(.5 * s, .5 * s, .32 * s, 0, 7); c.stroke(); break;
    case 16: P(.5, .1, .85, .5, .5, .9, .15, .5); break;
    case 17: P(.5, .05, .7, .4, .5, .95, .3, .4); break;
    case 18: c.strokeStyle = GR; L(.5, 0, .35, .25, .65, .5, .35, .75, .5, 1); break;
    case 19: c.fillStyle = '#eee'; f(.43, .5, .14, .5); c.fillStyle = col; c.beginPath(); c.arc(.5 * s, .5 * s, .35 * s, Math.PI, 0); c.fill(); break;
    case 20: c.beginPath(); c.ellipse(.5 * s, .5 * s, .4 * s, .18 * s, -.7, 0, 7); c.fill(); break;
    case 21: c.fillStyle = '#9aa'; o(.25, .8, .15); o(.55, .85, .12); o(.75, .75, .18); break;
    case 22: f(.1, .2, .1, .8); f(.8, .2, .1, .8); f(.05, .35, .9, .08); f(.05, .65, .9, .08); break;
    case 23: c.fillStyle = '#556'; f(.46, .35, .08, .65); c.fillStyle = '#ffe36b'; o(.5, .28, .2); break;
    case 24: P(.1, .4, .55, .4, .55, .2, .92, .5, .55, .8, .55, .6, .1, .6); break;
    case 25: L(.2, .2, .8, .8); L(.8, .2, .2, .8); break;
    case 26: c.beginPath(); for (let x = 0; x <= 1.001; x += .05) c[x ? 'lineTo' : 'moveTo'](x * s, (.5 + Math.sin(x * 12) * .15) * s); c.stroke(); break;
    case 27: L(.05, .7, .25, .3, .45, .7, .65, .3, .85, .7); break;
    case 28: o(.35, .38, .2); o(.65, .38, .2); P(.17, .5, .83, .5, .5, .9); break;
    default: f(.3, .15, .4, .85); f(.2, .05, .6, .15); f(.2, .9, .6, .1);
  }
}
const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

// ---------- the game ----------
class Game {
  constructor(cv) {
    this.cv = cv; this.c = cv.getContext('2d'); this.cb = {}; this.running = false; this.paused = false;
    this.held = false; this.edgeT = 0; this.skin = { id: 0, c1: PRIMARY[0], c2: SECONDARY[0] };
    const press = d => { if (!this.running || this.paused) return; if (d) { if (!this.held) { this.edgeT = .05; this.holdUsed = false; } this.held = true; } else { this.held = false; this.holdUsed = false; } };
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
    objs.forEach(o => { if (o.g) (this.groups[o.g] = this.groups[o.g] || []).push(o); const h = OBJ[o.t].hz; if (h) { if (h.k === 's') o.hr = h.a * U * .8; else { const hw = h.n > 1 ? 12 : 6 * h.a; o.hb = rotRect(o.r || 0, 15 - hw, 0, 15 + hw, 18 * h.b); } } });
    const mv = new Set(objs.filter(o => o.t === 'trig_move').map(o => o.tg));
    const solid = o => !OBJ[o.t].trig && !OBJ[o.t].deco;
    this.DEC = objs.filter(o => OBJ[o.t].deco); this.hasGrav = objs.some(o => o.t === 'orb_b' || GRAV[o.t] || MODEP[o.t]); this.mports = objs.filter(o => MODEP[o.t]);
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
    this.gr = 1; this.holdUsed = false; this.mode = 'cube'; for (const q of this.mports) { if (q.ex >= this.sx) break; this.mode = q.t === 'port_ship' ? 'ship' : 'cube'; } this.gOff = {}; this.acts = []; this.parts = [];
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
      const key = t.tg === 0 ? 'bg' : t.tg === -1 ? 'gr' : 'c' + t.tg; this.acts = this.acts.filter(a => a.key !== key);
      const to = hex2rgb(t.col || '#ff5252');
      if (t.tg === 0) this.acts.push({ key, k: 'bg', from: hex2rgb(this.bg), to, t0: this.time, dur });
      else if (t.tg === -1) this.acts.push({ key, k: 'gr', from: hex2rgb(this.ground), to, t0: this.time, dur });
      else this.acts.push({ key, k: 'col', list: (this.groups[t.tg] || []).map(o => [o, hex2rgb(o.col)]), to, t0: this.time, dur });
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
    if (this.mode !== 'ship' && this.held && !this.holdUsed && p.grounded) { p.vy = JUMP * this.gr; p.grounded = false; this.jumps++; }
    const edge = this.edgeT > 0, prevB = p.y;
    p.grounded = false;
    const gr = this.gr; p.x += BASE * this.speed * dt; if (this.mode === 'ship') { p.vy += (this.held ? 1 : -1) * gr * 2600 * dt; p.vy = Math.max(-400, Math.min(400, p.vy)); } else { p.vy -= G * dt * gr; if (p.vy * gr < -VMAX) p.vy = -VMAX * gr; } p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; if (gr > 0 || p.vy < 0) p.vy = 0; if (gr > 0) p.grounded = true; }
    if (this.hasGrav && p.y > CEIL - 30) { p.y = CEIL - 30; if (p.vy > 0 || gr < 0) p.vy = 0; if (gr < 0) p.grounded = true; }
    const S = this.S;
    while (this.si < S.length && S[this.si].ex < p.x - 40) this.si++;
    for (let i = this.si; i < S.length && S[i].ex < p.x + 40; i++) { this.inter(S[i], 0, 0, prevB, edge); if (p.dead) return; }
    for (const o of this.D) {
      const g = this.gOff[o.g]; this.inter(o, g ? g.x * U : 0, g ? g.y * U : 0, prevB, edge); if (p.dead) return;
    }
    if (this.mode === 'ship') p.rot = -Math.atan2(p.vy, BASE * this.speed) * 180 / Math.PI; else if (p.grounded) { const t = Math.round(p.rot / 90) * 90; p.rot += (t - p.rot) * Math.min(1, 30 * dt); }
    else p.rot += 420 * dt * this.gr;
    if (!p.dead && p.grounded && Math.random() < dt * 30) this.parts.push({ x: p.x, y: p.y + 2, vx: -40 - Math.random() * 40, vy: 30 + Math.random() * 50, life: .25, col: this.skin.c1, s: 2 + Math.random() * 2 });
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    if (this.parts.length > 60) this.parts = this.parts.filter(q => q.life > 0);
  }
  inter(o, gx, gy, prevB, edge) {
    const p = this.p, x = o.ex + gx, y = o.ey + gy, t = o.t;
    if (OBJ[t].solid) {
      if (this.hit(p, x, y, U, U)) {
        if (this.mode === 'ship') { if (prevB >= y + U - 4) { p.y = y + U; if (p.vy < 0) p.vy = 0; } else if (prevB + 30 <= y + 4) { p.y = y - 30; if (p.vy > 0) p.vy = 0; } else this.die(); }
        else if (this.gr > 0 ? (p.vy <= 0 && prevB >= y + U - 4) : (p.vy >= 0 && prevB + 30 <= y + 4)) { p.y = this.gr > 0 ? y + U : y - 30; p.vy = 0; p.grounded = true; }
        else this.die();
      }
    } else if (OBJ[t].hz) {
      if (o.hr) { const dx = p.x + 15 - (x + 15), dy = p.y + 15 - (y + 15); if (dx * dx + dy * dy < (o.hr + 9) ** 2) this.die(); }
      else { const h = o.hb; if (this.hit(p, x + h[0], y + h[1], h[2] - h[0], h[3] - h[1], 4)) this.die(); }
    } else if (['orb_y', 'orb_p', 'orb_b'].includes(t)) {
      const dx = p.x + 15 - (x + 15), dy = p.y + 15 - (y + 15), on = dx * dx + dy * dy < 26 * 26;
      if (on && (edge || (this.held && !this.holdUsed)) && !o.used) { if (t === 'orb_b') { this.gr = -this.gr; p.vy = -200 * this.gr; } else p.vy = PHYS[t] * this.gr; o.used = true; p.grounded = false; this.edgeT = 0; this.holdUsed = true; this.jumps++; }
      else if (!on) o.used = false;
    } else if (t === 'pad_y' || t === 'pad_p') {
      const on = this.hit(p, x + 2, y, U - 4, 12);
      if (on && !o.used) { p.vy = PHYS[t] * this.gr; o.used = true; p.grounded = false; }
      else if (!on) o.used = false;
    } else if (SPEEDS[t]) {
      if (this.hit(p, x + 5, y, 20, 60)) this.speed = SPEEDS[t];
    } else if (t === 'port_gd' || t === 'port_gu') {
      if (this.hit(p, x + 5, y, 20, 60)) this.gr = t === 'port_gu' ? -1 : 1;
    } else if (MODEP[t]) {
      if (this.hit(p, x + 5, y, 20, 60)) this.mode = t === 'port_ship' ? 'ship' : 'cube';
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
    drawBG(c, W, H, s, this.camX, this.level.bgs);
    const gy = Y(0);
    if (gy < H) {
      c.fillStyle = this.ground; c.fillRect(0, gy, W, H - gy);
      c.fillStyle = 'rgba(0,0,0,.18)'; const g2 = 60 * s, o2 = (this.camX * s) % g2; for (let x = -o2; x < W; x += g2) c.fillRect(x, gy + 3 * s, g2 / 2, H);
      c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(0, gy - 2 * s, W, 3 * s);
    }
    if (this.hasGrav) { const cy = Y(CEIL); c.fillStyle = this.ground; c.fillRect(0, 0, W, cy - s); c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(0, cy - s, W, 3 * s); }
    if (this.attempts && this.sx === 0) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `bold ${30 * s}px "Lilita One",sans-serif`; c.textAlign = 'left'; c.fillText('Attempt ' + this.attempts, X(150), Y(150)); }
    const cs = U * s, S = this.S; let lo = 0, hi = S.length; const lx = this.camX - 60;
    while (lo < hi) { const m = (lo + hi) >> 1; if (S[m].ex < lx) lo = m + 1; else hi = m; }
    const rx = this.camX + W / s + 60;
    for (const o of this.DEC) { const x = X(o.ex); if (x > -cs * 2 && x < W + cs) drawObj(c, o, x, Y(o.ey + U), cs, o.col, false, this.time); }
    for (let i = lo; i < S.length && S[i].ex < rx; i++) { const o = S[i]; drawObj(c, o, X(o.ex), Y(o.ey + U), cs, o.col, false, this.time); }
    for (const o of this.D) { const gg = this.gOff[o.g], gx = gg ? gg.x * U : 0, gyy = gg ? gg.y * U : 0, x = X(o.ex + gx); if (x > -cs * 2 && x < W + cs) drawObj(c, o, x, Y(o.ey + gyy + U), cs, o.col, false, this.time); }
    if (isFinite(this.endX)) { const x = X(this.endX); if (x > -50 && x < W + 50) { const gr = c.createLinearGradient(x - 12 * s, 0, x + 12 * s, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - 12 * s, 0, 24 * s, H); } }
    for (const q of this.parts) { c.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); c.fillStyle = q.col; c.fillRect(X(q.x) - q.s * s / 2, Y(q.y) - q.s * s / 2, q.s * s, q.s * s); }
    c.globalAlpha = 1;
    if (!p.dead) { c.save(); c.translate(X(p.x) + 15 * s, Y(p.y) - 15 * s); c.rotate(p.rot * Math.PI / 180); if (this.mode === 'ship') { if (this.gr < 0) c.scale(1, -1); drawShip(c, this.skin.id, this.skin.ship || 0, this.skin.c1, this.skin.c2, 30 * s); } else drawIcon(c, this.skin.id, this.skin.c1, this.skin.c2, 30 * s); c.restore(); }
  }
}

/* ===== APP ===== */
// dash_app.js - DASH: UI, accounts, community, editor, moderation (all synced to Firebase)

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n || 0).toLocaleString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MOD = 'Vortarium';
const STAR_SCALE = 1;           // stars awarded per difficulty star (1..5). Change here to rebalance.
const SLOTS = 20, SONG_CHUNK = 600000;
const blobB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); });
let me = null, P = null;
const settings = Object.assign({ music: true, sfx: true, vol: .6 }, JSON.parse(localStorage.dash_settings || '{}'));
const isMod = () => !!P && P.username === MOD;
const nameHTML = n => esc(n) + (n === MOD ? '<i class="modm">M</i>' : '');
const myIcon = (size = 64) => skinURL(P?.skin || 0, PRIMARY[P?.c1 || 0], SECONDARY[P?.c2 || 0], size);
const userIcon = (u, size = 64) => skinURL(u.skin || 0, PRIMARY[u.c1 || 0], SECONDARY[u.c2 || 0], size);
const errMsg = e => {
  const c = e?.code || '';
  if (typeof e === 'string') return e;
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong username or password';
  if (c.includes('email-already-in-use')) return 'That username is already taken';
  if (c.includes('permission-denied')) return 'Permission denied (check your Firestore/Storage rules)';
  if (c.includes('operation-not-allowed')) return 'Enable Email/Password sign-in in Firebase Authentication';
  return e?.message || 'Something went wrong';
};
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600);
}
let modalClose = null;
function modal(html, wide) { $('#modalBody').innerHTML = html; $('#modalBox').classList.toggle('wide', !!wide); $('#modal').classList.add('open'); }
function closeModal() { try { prevA && prevA.pause(); prevA = null; } catch { } $('#modal').classList.remove('open'); if (modalClose) { modalClose(); modalClose = null; } }
async function batchDelete(refs) { for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(db); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); } }
async function delCol(path) { const s = await getDocs(collection(db, ...path)); await batchDelete(s.docs.map(d => d.ref)); }

/* ---- IndexedDB for songs ---- */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('dash_db', 1); r.onupgradeneeded = () => r.result.createObjectStore('songs'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { try { const d = await idb(); return await new Promise(r => { const q = d.transaction('songs').objectStore('songs').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch { return null; } };
const idbSet = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction('songs', 'readwrite').objectStore('songs').put(v, k); q.onsuccess = res; q.onerror = () => rej(q.error); }); };
const idbDel = async k => { try { const d = await idb(); d.transaction('songs', 'readwrite').objectStore('songs').delete(k); } catch { } };

/* ================= audio ================= */
const A = { menu: new Audio('dash_music.mp3'), editor: new Audio('dash_editor.mp3'), die: new Audio('dash_die.mp3'), win: new Audio('dash_win.mp3') };
A.menu.loop = A.editor.loop = true;
let track = null, unlocked = false;
function applyAudio() {
  for (const k of ['menu', 'editor']) {
    A[k].volume = settings.vol;
    if (settings.music && unlocked && track === k) A[k].play().catch(() => { }); else A[k].pause();
  }
}
function setTrack(t) { if (track === t) return; track = t; applyAudio(); }
function sfx(k) { if (!settings.sfx) return; const a = A[k].cloneNode(); a.volume = settings.vol; a.play().catch(() => { }); }
const unlock = () => { unlocked = true; applyAudio(); };
addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
function saveSettings() { localStorage.dash_settings = JSON.stringify(settings); applyAudio(); if (me) updateDoc(doc(db, 'users', me.uid), { settings }).catch(() => { }); }

/* ================= achievements / unlocks ================= */
const ACH_DEFS = [
  ['totalViews', 'Popular', 'Get {n} total views on your levels', [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]],
  ['levelsBeaten', 'Winner', 'Beat {n} levels', [1, 3, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 500]],
  ['netLikes', 'Liked', 'Reach {n} total net likes', [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]],
  ['maxPostLikes', 'Hit Level', 'Get {n} net likes on a single level', [5, 10, 25, 50, 100, 250, 500, 1000]],
  ['rated', 'Verified', 'Get {n} of your levels rated', [1, 2, 3, 5, 10, 20, 50]],
  ['stars', 'Stargazer', 'Collect {n} stars', [1, 10, 25, 50, 100, 200, 350, 500, 750, 1000]],
  ['demons', 'Demon Slayer', 'Beat {n} demon levels', [1, 3, 5, 10, 20, 35, 50]],
  ['published', 'Creator', 'Publish {n} levels', [1, 5, 10, 20, 35, 50]],
  ['comments', 'Chatty', 'Post {n} comments', [1, 5, 10, 25, 50, 100]],
  ['crystals', 'Gem Hoarder', 'Collect {n} crystals', [50, 250, 1000, 2500, 5000]]
];
const ACH = (() => {
  const list = []; ACH_DEFS.forEach(([stat, name, desc, ns], ci) => ns.forEach((n, i) => list.push({ stat, n, name: `${name} ${i + 1}`, desc: desc.replace('{n}', fmt(n)), tier: i / ns.length, ci })));
  list.sort((a, b) => a.tier - b.tier || a.ci - b.ci);
  const cols = []; for (let i = 1; i < 10; i++) { cols.push({ k: 'p', i }); cols.push({ k: 's', i }); }
  const pools = [{ a: Array.from({ length: 35 }, (_, i) => ({ k: 'skin', i: i + 1 })) }, { a: cols }, { a: Array.from({ length: 29 }, (_, i) => ({ k: 'ship', i: i + 1 })) }]; pools.forEach(p => p.n = p.a.length);
  list.forEach(a => { pools.sort((x, y) => y.a.length / y.n - x.a.length / x.n); a.rw = pools.find(p => p.a.length).a.shift(); }); return list;
})();
const rwName = r => r.k === 'skin' ? `Cube skin #${r.i + 1}` : r.k === 'ship' ? `Ship skin #${r.i + 1}` : r.k === 'p' ? `Primary color #${r.i + 1}` : `Secondary color #${r.i + 1}`;
function unlocked_() {
  const u = { skin: new Set([0]), ship: new Set([0]), p: new Set([0]), s: new Set([0]) };
  if (me && P) ACH.forEach(a => { if ((P[a.stat] || 0) >= a.n) u[a.rw.k].add(a.rw.i); });
  return u;
}
function checkAch() {
  if (!me || !P) return; const key = 'dash_ach_' + me.uid; const seen = new Set(JSON.parse(localStorage[key] || '[]'));
  const first = !localStorage[key]; const now = ACH.filter(a => (P[a.stat] || 0) >= a.n).map(a => a.name);
  if (!first) now.filter(n => !seen.has(n)).forEach(n => { const a = ACH.find(x => x.name === n); toast(`🏆 Achievement: ${a.name} - unlocked ${rwName(a.rw)}`, 'ok'); });
  localStorage[key] = JSON.stringify(now);
}

/* ================= navigation ================= */
let cur = 'menu', curP = {}, stack = [];
const views = {};
function showLayer(n) { ['menu', 'view', 'play', 'edit'].forEach(l => $('#' + l).classList.toggle('active', l === n)); document.body.classList.toggle('fs', n === 'play' || n === 'edit'); }
function go(name, p = {}, push = true) {
  if (name === 'menu') { stack = []; cur = 'menu'; curP = {}; showLayer('menu'); }
  else { if (push) stack.push([cur, curP]); cur = name; curP = p; showLayer('view'); views[name](p); if (me && ['account', 'cosmetics', 'community'].includes(name)) refreshMyStats().then(refreshProfile).then(() => { if (cur === name) views[name](curP); }); }
  renderFooter(); setTrack('menu');
}
function back() { const s = stack.pop(); s && s[0] !== 'menu' ? go(s[0], s[1], false) : go('menu'); }
const page = (title, html) => { $('#view').innerHTML = `<div class="page"><header><button class="round" data-act="back">◀</button><h2>${title}</h2></header><div class="pbody">${html}</div></div>`; };
function renderFooter() {
  const s = P || {};
  $('#footer').innerHTML = `<span class="fname">${me ? nameHTML(P?.username || '…') : 'Anonymous'}</span><span>💎 ${fmt(s.crystals)}</span><span>⭐ ${fmt(s.stars)}</span><span>😈 ${fmt(s.demons)}</span><span>👍 ${fmt(s.netLikes)}</span><span>✅ ${fmt(s.levelsBeaten)}</span>`;
  $('#menuIcon').src = myIcon(64);
  const b = $('#menuBadge'); const n = (reqs.length || 0) + (isMod() ? modPending : 0); b.textContent = n; b.classList.toggle('hide', !n);
}

/* ================= auth ================= */
const emailOf = u => `${u.toLowerCase()}@dash-game.app`;
const newProfile = username => ({ username, stars: 0, crystals: 0, levelsBeaten: 0, demons: 0, netLikes: 0, totalViews: 0, published: 0, rated: 0, maxPostLikes: 0, comments: 0, skin: 0, ship: 0, c1: 0, c2: 0, songs: [], settings, created: serverTimestamp() });
let busySignup = false;
async function signUp(username, pw) {
  username = username.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw 'Username: 3-16 letters, numbers or _';
  if (pw.length < 6) throw 'Password must be at least 6 characters';
  const key = username.toLowerCase();
  if ((await getDoc(doc(db, 'usernames', key))).exists()) throw 'That username is already taken';
  busySignup = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailOf(username), pw);
    try { const b = writeBatch(db); b.set(doc(db, 'usernames', key), { uid: cred.user.uid }); b.set(doc(db, 'users', cred.user.uid), newProfile(username)); await b.commit(); }
    catch (e) { await deleteUser(cred.user).catch(() => { }); throw 'Could not create the account: ' + errMsg(e); }
    await afterLogin(cred.user);
  } finally { busySignup = false; }
}
async function afterLogin(u) {
  me = u; P = null;
  if ((await getDoc(doc(db, 'banned', u.uid))).exists()) { await signOut(auth); me = null; toast('This account has been banned', 'err'); return; }
  let s = await getDoc(doc(db, 'users', u.uid)); if (!s.exists()) { await sleep(1200); s = await getDoc(doc(db, 'users', u.uid)); }
  if (!s.exists()) { await signOut(auth); me = null; toast('Account data not found', 'err'); return; }
  P = s.data(); if (P.settings) { Object.assign(settings, P.settings); localStorage.dash_settings = JSON.stringify(settings); applyAudio(); }
  loadSlots(); startListeners(); renderFooter();
  refreshMyStats(); pullDrafts(); syncSongs(); purgeDMs();
  if (cur === 'account') views.account({ tab: 'account' });
}
onAuthStateChanged(auth, async u => {
  if (busySignup) return;
  if (u) { try { await afterLogin(u); } catch (e) { console.error(e); toast('Could not load account: ' + errMsg(e), 'err'); } }
  else { me = null; P = null; stopListeners(); loadSlots(); renderFooter(); if (cur === 'account') views.account({ tab: 'account' }); }
});
async function refreshProfile() {
  if (!me || !P) return; try { const s = await getDoc(doc(db, 'users', me.uid)); if (s.exists()) { Object.assign(P, s.data()); renderFooter(); checkAch(); } } catch { }
}
async function refreshMyStats() {
  if (!me || !P) return;
  try {
    const s = await getDocs(query(collection(db, 'levels'), where('authorId', '==', me.uid)));
    let views = 0, net = 0, max = 0, rated = 0;
    s.forEach(d => { const l = d.data(); views += l.views || 0; const n = (l.likes || 0) - (l.dislikes || 0); net += n; max = Math.max(max, n); if (l.status === 'rated') rated++; });
    const upd = { totalViews: views, netLikes: net, maxPostLikes: max, rated, published: s.size };
    Object.assign(P, upd); await updateDoc(doc(db, 'users', me.uid), upd); checkAch(); renderFooter();
  } catch (e) { console.warn(e); }
}

/* ================= listeners (friend requests, mod ping) ================= */
let reqs = [], reqUnsub = null, modUnsub = null, modPending = 0;
function startListeners() {
  stopListeners();
  reqUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('to', '==', me.uid), where('status', '==', 'pending')), s => {
    const had = reqs.length; reqs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderFooter();
    if (reqs.length > had && had >= 0 && reqReady) toast('📨 New friend request!');
    reqReady = true; if (cur === 'lb' && curP.tab === 'friends') views.lb(curP);
  }, () => { });
  if (isMod()) {
    let first = true;
    modUnsub = onSnapshot(query(collection(db, 'levels'), where('status', '==', 'unrated')), s => {
      modPending = s.size; renderFooter();
      if (!first) s.docChanges().forEach(c => { if (c.type === 'added') toast(`🔔 New level to rate: ${c.doc.data().title}`); });
      first = false;
    }, () => { });
  }
}
let reqReady = false;
function stopListeners() { reqUnsub && reqUnsub(); modUnsub && modUnsub(); reqUnsub = modUnsub = null; reqs = []; modPending = 0; reqReady = false; }

/* ================= account / settings ================= */
const settingsHTML = () => `<div class="card"><div class="row"><button class="btn ${settings.music ? 'green' : 'red'}" data-act="tog" data-k="music">Music: ${settings.music ? 'ON' : 'OFF'}</button><button class="btn ${settings.sfx ? 'green' : 'red'}" data-act="tog" data-k="sfx">SFX: ${settings.sfx ? 'ON' : 'OFF'}</button></div><label style="margin-top:12px">Volume<input type="range" min="0" max="1" step=".05" value="${settings.vol}" id="volr"></label></div>`;
views.account = ({ tab = 'account' } = {}) => {
  const tabs = `<div class="tabs"><button class="${tab === 'account' ? 'on' : ''}" data-act="acctab" data-t="account">Account</button><button class="${tab === 'settings' ? 'on' : ''}" data-act="acctab" data-t="settings">Settings</button></div>`;
  let body;
  if (tab === 'settings') body = settingsHTML();
  else if (!me) body = `<div class="card" style="max-width:460px"><h3>Playing as Anonymous</h3><p class="muted">Log in to like, dislike, comment, create levels and save progress. You can still view and play other people's levels.</p><label>Username<input id="au" maxlength="16" autocomplete="username"></label><label>Password<input id="ap" type="password" autocomplete="current-password"></label><div class="row"><button class="btn green" data-act="login">Log in</button><button class="btn blue" data-act="signup">Sign up</button></div></div>`;
  else if (!P) body = '<p>Loading…</p>';
  else body = `<div class="card"><div class="row"><img src="${myIcon(96)}" width="96" height="96"><div><h2 style="margin:0">${nameHTML(P.username)}</h2><div class="muted">💎 ${fmt(P.crystals)} · ⭐ ${fmt(P.stars)} · 😈 ${fmt(P.demons)} · 👍 ${fmt(P.netLikes)} · ✅ ${fmt(P.levelsBeaten)} beaten · 👁 ${fmt(P.totalViews)} views</div></div></div><div class="row" style="margin-top:12px"><button class="btn blue" data-act="myprofile">View my profile</button><button class="btn red" data-act="logout">Log out</button></div></div>`;
  page('Account', tabs + body);
};

/* ================= cosmetics ================= */
views.cosmetics = ({ tab = 'cube' } = {}) => {
  const un = unlocked_(), sk = P?.skin || 0, sh = P?.ship || 0, c1 = P?.c1 || 0, c2 = P?.c2 || 0;
  const req = (k, i) => { const a = ACH.find(a => a.rw.k === k && a.rw.i === i); return a ? `${a.name}: ${a.desc}` : 'Default'; };
  const grid = (k, n, cur, img) => Array.from({ length: n }, (_, i) => `<div class="sk ${un[k].has(i) ? '' : 'locked'} ${i === cur ? 'sel' : ''}" data-act="equip" data-k="${k}" data-i="${i}" title="${esc(un[k].has(i) ? k + ' ' + (i + 1) : req(k, i))}"><img src="${img(i)}"></div>`).join('');
  const sw = (k, arr, cur) => arr.map((c, i) => `<div class="sw ${un[k].has(i) ? '' : 'locked'} ${i === cur ? 'sel' : ''}" style="background:${c}" data-act="equip" data-k="${k}" data-i="${i}" title="${esc(un[k].has(i) ? 'Color ' + (i + 1) : req(k, i))}"></div>`).join('');
  let body;
  if (tab === 'cube') body = `<div class="skgrid">${grid('skin', 36, sk, i => skinURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'ship') body = `<div class="skgrid">${grid('ship', 30, sh, i => shipURL(i, sk, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'colors') body = `<h3>Primary</h3><div class="swatches">${sw('p', PRIMARY, c1)}</div><h3>Secondary</h3><div class="swatches">${sw('s', SECONDARY, c2)}</div>`;
  else body = ACH.map(a => { const v = P?.[a.stat] || 0, done = !!me && v >= a.n; return `<div class="ach ${done ? 'done' : ''}"><div><b>${a.name}</b><div class="muted">${a.desc} → ${rwName(a.rw)}</div></div><span class="st">${done ? '✔' : fmt(Math.min(v, a.n)) + '/' + fmt(a.n)}</span></div>`; }).join('');
  const tabs = ['cube', 'ship', 'colors', 'achievements'].map(t => `<button class="${t === tab ? 'on' : ''}" data-act="costab" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  page('Cosmetics', `<div class="tabs">${tabs}</div><div class="cosm"><div class="preview card"><div class="pvrow"><img src="${myIcon(120)}"><img src="${shipURL(sh, sk, PRIMARY[c1], SECONDARY[c2], 120)}"></div><div class="muted">${me ? 'Tap an unlocked item to equip it' : 'Log in to unlock cosmetics with achievements'}</div></div><div>${body}</div></div>`);
};

/* ================= community ================= */
const svg = p => `<i class="bb-ico"><svg viewBox="0 0 24 24" fill="#fff">${p}</svg></i>`;
const ICO = { tools: svg('<rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><rect x="8" y="3" width="8" height="8" rx="2"/>'), star: svg('<polygon points="12,2 15,9 22,9.5 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9.5 9,9"/>'), plus: svg('<circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10" stroke="#1450d0" stroke-width="3"/>'), trophy: svg('<path d="M7 3h10v6a5 5 0 01-10 0zM4 4h3v4H4zM17 4h3v4h-3zM11 14h2v4h3v3H8v-3h3z"/>') };
views.community = () => {
  const mb = isMod() && modPending ? `<em class="badge">${modPending}</em>` : '', rb = reqs.length ? `<em class="badge">${reqs.length}</em>` : '';
  page('Community', `<div class="grid menu4"><button class="big-btn green" data-act="go" data-v="editor">${ICO.tools}Editor</button><button class="big-btn orange" data-act="go" data-v="levels" data-kind="stars">${ICO.star}Stars</button><button class="big-btn blue" data-act="go" data-v="levels" data-kind="new">${ICO.plus}New Levels${mb}</button><button class="big-btn red" data-act="go" data-v="lb">${ICO.trophy}Leaderboards &amp; Friends${rb}</button></div>`);
};

/* ---- level lists ---- */
const LISTS = {}, LV = {};
async function fetchLevels(kind) {
  const s = await getDocs(query(collection(db, 'levels'), where('status', '==', kind === 'stars' ? 'rated' : 'unrated'), limit(200)));
  const a = s.docs.map(d => ({ id: d.id, ...d.data() })); a.sort((x, y) => (y.created?.seconds || 0) - (x.created?.seconds || 0)); return a;
}
const lvlCard = l => `<div class="lvl" data-act="openlvl" data-id="${l.id}"><img src="${l.diff ? diffURL(l.diff, 56) : diffURL('easy', 56)}" style="${l.diff ? '' : 'filter:grayscale(1) brightness(.6)'}"><div><h3>${esc(l.title)}</h3><div class="muted">by ${nameHTML(l.authorName)}${l.diff ? ' · ' + DIFFS.find(d => d.id === l.diff).name + ' ⭐' + (DIFFS.find(d => d.id === l.diff).stars) : ' · Unrated'}</div></div><div class="meta">👍 ${fmt((l.likes || 0) - (l.dislikes || 0))}<br>👁 ${fmt(l.views)}</div></div>`;
views.levels = async ({ kind }) => {
  page(kind === 'stars' ? 'Stars - Rated Levels' : 'New Levels', '<p class="muted">Loading…</p>');
  try { LISTS[kind] = await fetchLevels(kind); } catch (e) { return page('Levels', `<p>${esc(errMsg(e))}</p>`); }
  renderLevels(kind, 0);
};
function renderLevels(kind, pg) {
  const a = LISTS[kind], pages = Math.max(1, Math.ceil(a.length / 10));
  const body = a.length ? `<div class="list">${a.slice(pg * 10, pg * 10 + 10).map(lvlCard).join('')}</div>` : '<p class="muted">No levels here yet.</p>';
  page(kind === 'stars' ? 'Stars - Rated Levels' : 'New Levels', body + `<div class="pager"><button class="btn sm" data-act="pg" data-kind="${kind}" data-pg="${pg - 1}" ${pg <= 0 ? 'disabled' : ''}>◀ Prev</button><b>Page ${pg + 1} / ${pages}</b><button class="btn sm" data-act="pg" data-kind="${kind}" data-pg="${pg + 1}" ${pg >= pages - 1 ? 'disabled' : ''}>Next ▶</button></div>`);
}

/* ---- level page ---- */
const bestKey = id => 'dash_best_' + id;
async function getBest(id) {
  let b = +localStorage[bestKey(id)] || 0;
  if (me) { try { const s = await getDoc(doc(db, 'users', me.uid, 'progress', id)); if (s.exists()) b = Math.max(b, s.data().best || 0); } catch { } }
  return b;
}
views.level = async ({ id }) => {
  page('Level', '<p class="muted">Loading…</p>');
  let lv;
  try {
    const snap = await getDoc(doc(db, 'levels', id)); if (!snap.exists()) return page('Level', '<p>This level is no longer on the servers.</p>');
    lv = { id, ...snap.data() }; LV[id] = lv;
  } catch (e) { return page('Level', `<p>${esc(errMsg(e))}</p>`); }
  let my = 0; if (me) { try { const v = await getDoc(doc(db, 'levels', id, 'votes', me.uid)); my = v.exists() ? v.data().v : 0; } catch { } }
  const best = await getBest(id);
  let cms = []; try { cms = (await getDocs(query(collection(db, 'levels', id, 'comments'), orderBy('t', 'desc'), limit(60)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  const d = DIFFS.find(x => x.id === lv.diff), mine = me && lv.authorId === me.uid;
  const dl = (lv.songParts || lv.songUrl) ? (await idbGet('level:' + id) ? '<span class="muted">✔ Song downloaded</span>' : `<button class="btn sm blue" data-act="dlsong" data-id="${id}">⬇ Download song${lv.songName ? ': ' + esc(lv.songName) : ''}</button>`) : '';
  const cmHtml = cms.map(c => `<div class="cm">${isMod() || (me && c.uid === me.uid) ? `<span class="del" data-act="delcm" data-id="${id}" data-cid="${c.id}">✕</span>` : ''}<b data-act="profile" data-uid="${c.uid}">${nameHTML(c.name)}</b><br>${esc(c.text)}</div>`).join('') || '<p class="muted">No comments yet.</p>';
  page(esc(lv.title), `<div class="lp"><div class="lp-main">
    <h1>${esc(lv.title)}</h1><div>by <b style="color:#8fe9ff;cursor:pointer" data-act="profile" data-uid="${lv.authorId}">${nameHTML(lv.authorName)}</b></div>
    <div class="row" style="justify-content:center"><img src="${d ? diffURL(d.id, 56) : diffURL('easy', 56)}" width="56" style="${d ? '' : 'filter:grayscale(1) brightness(.6)'}"><b>${d ? d.name + ' · ⭐ ' + d.stars : 'Unrated'}</b></div>
    <p class="muted" style="max-width:480px">${esc(lv.desc || 'No description')}</p>
    <button class="playbtn" data-act="playlvl" data-id="${id}">▶</button>
    <div class="pb"><i style="width:${best}%"></i><b>Best: ${best}%</b></div>
    <div class="votes"><button class="round ${my === 1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="1">👍</button><span>${fmt((lv.likes || 0) - (lv.dislikes || 0))}</span><button class="round down ${my === -1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="-1">👎</button></div>
    <div class="muted">👁 ${fmt(lv.views)} views</div>${dl}
    <div class="row" style="justify-content:center">${isMod() ? `<button class="btn orange sm" data-act="ratemenu" data-id="${id}">⭐ Rate</button>` : ''}${isMod() || mine ? `<button class="btn red sm" data-act="takedown" data-id="${id}">Take down</button>` : ''}</div>
  </div><div class="side"><h3 style="margin:0 0 8px">Comments</h3><div class="comments">${cmHtml}</div>${me ? `<input id="cmt" maxlength="200" placeholder="Write a comment…"><button class="btn green sm" data-act="comment" data-id="${id}">Post</button>` : '<p class="muted">Log in to comment.</p>'}</div></div>`);
};
async function vote(id, v) {
  if (!me) return toast('Log in to like or dislike', 'err');
  const lr = doc(db, 'levels', id), vr = doc(db, 'levels', id, 'votes', me.uid);
  const [vs, ls] = await Promise.all([getDoc(vr), getDoc(lr)]); if (!ls.exists()) return;
  const old = vs.exists() ? vs.data().v : 0, nv = old === v ? 0 : v, b = writeBatch(db);
  nv === 0 ? b.delete(vr) : b.set(vr, { v: nv });
  b.update(lr, { likes: increment((nv === 1 ? 1 : 0) - (old === 1 ? 1 : 0)), dislikes: increment((nv === -1 ? 1 : 0) - (old === -1 ? 1 : 0)) });
  b.update(doc(db, 'users', ls.data().authorId), { netLikes: increment(nv - old) });
  await b.commit(); if (ls.data().authorId === me.uid) refreshMyStats(); views.level({ id });
}
async function takeDown(id) {
  const s = await getDoc(doc(db, 'levels', id)); if (!s.exists()) return; const lv = s.data();
  await delCol(['levels', id, 'comments']); await delCol(['levels', id, 'votes']); await delCol(['levels', id, 'songChunks']).catch(() => { });
  await deleteDoc(doc(db, 'levels', id));
  await updateDoc(doc(db, 'users', lv.authorId), { netLikes: increment(-((lv.likes || 0) - (lv.dislikes || 0))) }).catch(() => { });
  if (lv.songUrl) deleteObject(sref(storage, `songs/${id}.mp3`)).catch(() => { });
  slots.forEach(x => { if (x && x.pub === id) x.pub = null; }); saveSlots();
}
async function rateLevel(id, diff) {
  const d = DIFFS.find(x => x.id === diff);
  await updateDoc(doc(db, 'levels', id), { status: 'rated', diff, stars: d.stars * STAR_SCALE }); closeModal(); toast(`Rated ${d.name}`, 'ok'); views.level({ id });
}
async function fetchSong(id, lv) {
  if (lv.songParts) {
    const s = await getDocs(query(collection(db, 'levels', id, 'songChunks'), orderBy('n')));
    if (s.size < lv.songParts) throw 'Song data is incomplete on the server';
    const blob = new Blob(s.docs.map(d => Uint8Array.from(atob(d.data().d), c => c.charCodeAt(0))), { type: 'audio/mpeg' });
    await idbSet('level:' + id, blob); return blob;
  }
  if (lv.songUrl) { try { const r = await fetch(lv.songUrl); if (!r.ok) throw 0; const b = await r.blob(); await idbSet('level:' + id, b); return b; } catch { const o = { url: lv.songUrl }; await idbSet('level:' + id, o); return o; } }
  return null;
}
async function downloadSong(id) {
  toast('Downloading song…'); try { await fetchSong(id, LV[id]); } catch (e) { return toast(errMsg(e), 'err'); }
  if (me) updateDoc(doc(db, 'users', me.uid), { songs: arrayUnion(id) }).catch(() => { });
  toast('Song saved', 'ok'); views.level({ id });
}
async function syncSongs() {
  for (const id of (P?.songs || [])) {
    if (await idbGet('level:' + id)) continue;
    try { const s = await getDoc(doc(db, 'levels', id)); if (s.exists()) await fetchSong(id, { id, ...s.data() }); } catch { }
  }
}

/* ================= playing ================= */
const game = new Game($('#gameCanvas'));
let PL = null, lvAudio = null, prevA = null;
async function playPublished(id) {
  const lv = LV[id]; updateDoc(doc(db, 'levels', id), { views: increment(1) }).catch(() => { }); lv.views = (lv.views || 0) + 1;
  let songUrl = null;
  if (lv.songParts || lv.songUrl) { let s = await idbGet('level:' + id); if (!s) { toast('Loading song…'); try { s = await fetchSong(id, lv); } catch (e) { toast('Song failed to load: ' + errMsg(e), 'err'); } } if (s instanceof Blob) songUrl = URL.createObjectURL(s); else if (s?.url) songUrl = s.url; }
  startPlay({ level: JSON.parse(lv.data), kind: 'play', id, lv, songUrl, songSpeed: lv.songSpeed, songOff: lv.songOff, onExit: () => { showLayer('view'); views.level({ id }); } });
}
function startPlay(o) {
  PL = o; PL.sx = o.startX || 0; PL.sy = o.startY || 0; PL.best = 0;
  $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open'); $('#pfill').style.width = '0';
  showLayer('play'); setTrack(null);
  game.skin = { id: P?.skin || 0, ship: P?.ship || 0, c1: PRIMARY[P?.c1 || 0], c2: SECONDARY[P?.c2 || 0] };
  game.load(o.level); lvAudio = o.songUrl ? new Audio(o.songUrl) : null;
  game.cb = {
    onSpawn: t => { if (!lvAudio || !settings.music) return; lvAudio.volume = settings.vol; const go = () => { try { const sp = PL.songSpeed || 1; lvAudio.playbackRate = sp; lvAudio.currentTime = (PL.songOff || 0) / 1000 + t * sp; } catch { } lvAudio.play().catch(() => { }); }; lvAudio.readyState >= 1 ? go() : lvAudio.addEventListener('loadedmetadata', go, { once: true }); },
    onDeath: pct => { lvAudio && lvAudio.pause(); sfx('die'); PL.best = Math.max(PL.best, pct); if (PL.kind === 'play' && pct > (+localStorage[bestKey(PL.id)] || 0)) localStorage[bestKey(PL.id)] = Math.floor(pct); },
    onWin: () => { lvAudio && lvAudio.pause(); sfx('win'); $('#pfill').style.width = '100%'; $('#ppct').textContent = '100%'; $('#winInfo').textContent = `Attempts: ${game.attempts} · Jumps: ${game.jumps}`; $('#winBox').classList.add('open'); onWon(); },
    onFrame: pct => { $('#pfill').style.width = pct + '%'; $('#ppct').textContent = Math.floor(pct) + '%'; },
    onPause: pauseToggle
  };
  game.start({ x: PL.sx, y: PL.sy });
}
function pauseToggle() {
  if (game.won) return;
  if (game.paused) { game.resume(); $('#pauseBox').classList.remove('open'); if (lvAudio && !game.p.dead) lvAudio.play().catch(() => { }); }
  else { game.pause(); lvAudio && lvAudio.pause(); $('#pauseBox').classList.add('open'); }
}
async function stopPlay() {
  game.stop(); lvAudio && lvAudio.pause(); $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open');
  const p = PL; PL = null;
  if (p.kind === 'play') { const b = Math.max(+localStorage[bestKey(p.id)] || 0, p.best ? Math.floor(p.best) : 0); if (me && b > 0) setDoc(doc(db, 'users', me.uid, 'progress', p.id), { best: b }).catch(() => { }); }
  setTrack(p.kind === 'test' ? 'editor' : 'menu'); p.onExit && p.onExit();
}
async function onWon() {
  const p = PL; if (!p) return;
  if (p.kind === 'test') { if (p.sx === 0 && p.sy === 0) { p.lv0.verified = sigOf(p.lv0.objs); saveSlots(ed.slot); toast('✔ Level verified! You can now upload it.', 'ok'); } else toast('Beat it from the very start to verify', ''); return; }
  localStorage[bestKey(p.id)] = 100; p.best = 100;
  if (!me || !P) { toast('Log in to earn stars and track wins'); return; }
  try {
    const own = p.lv.authorId === me.uid, fresh = await getDoc(doc(db, 'levels', p.id)), L = fresh.exists() ? fresh.data() : p.lv;
    const rated = L.status === 'rated' && !own, d = DIFFS.find(x => x.id === L.diff), ok = rated && !!d;
    const br = doc(db, 'users', me.uid, 'beaten', p.id), snap = await getDoc(br), first = !snap.exists(), starred = snap.exists() && snap.data().starred;
    if (!first && (starred || !ok)) return toast('Already completed', '');
    const ds = ok ? d.stars * STAR_SCALE : 0, cr = ok ? 5 * d.stars : 0, upd = {};
    if (first) { upd.levelsBeaten = increment(1); P.levelsBeaten = (P.levelsBeaten || 0) + 1; if (!own) { upd.crystals = increment(10 + cr); P.crystals = (P.crystals || 0) + 10 + cr; } }
    else { upd.crystals = increment(cr); P.crystals = (P.crystals || 0) + cr; }
    if (ok) { upd.stars = increment(ds); P.stars = (P.stars || 0) + ds; if (d.id === 'demon') { upd.demons = increment(1); P.demons = (P.demons || 0) + 1; } }
    await setDoc(br, { t: serverTimestamp(), starred: ok, level: p.id }, { merge: true }); await updateDoc(doc(db, 'users', me.uid), upd);
    renderFooter(); checkAch(); toast(ok ? `+${ds} stars!` : 'Level beaten!', 'ok');
  } catch (e) { console.error(e); toast('Could not save your win: ' + errMsg(e), 'err'); }
}

/* ================= leaderboards / friends / DMs ================= */
const STATS = { stars: 'Stars', netLikes: 'Likes', levelsBeaten: 'Levels Beaten', demons: 'Demons' };
views.lb = async (p = {}) => {
  const tab = p.tab || 'global', stat = p.stat || 'stars'; curP = { ...p, tab, stat };
  const tabs = `<div class="tabs"><button class="${tab === 'global' ? 'on' : ''}" data-act="lbtab" data-t="global">Global</button><button class="${tab === 'friends' ? 'on' : ''}" data-act="lbtab" data-t="friends">Friends ${reqs.length ? '(' + reqs.length + ')' : ''}</button></div>`;
  if (tab === 'global') {
    const sel = `<div class="tabs">${Object.entries(STATS).map(([k, v]) => `<button class="${k === stat ? 'on' : ''}" data-act="lbtab" data-t="global" data-stat="${k}">${v}</button>`).join('')}</div>`;
    page('Leaderboards', tabs + sel + '<p class="muted">Loading…</p>');
    try {
      const s = await getDocs(query(collection(db, 'users'), orderBy(stat, 'desc'), limit(100)));
      page('Leaderboards', tabs + sel + `<div class="list">${s.docs.map((d, i) => { const u = d.data(); return `<div class="lb" data-act="profile" data-uid="${d.id}"><span class="rk">#${i + 1}</span><img src="${userIcon(u, 40)}"><b>${nameHTML(u.username)}</b><span class="v">${fmt(u[stat])}</span></div>`; }).join('') || '<p class="muted">Nobody yet.</p>'}</div>`);
    } catch (e) { page('Leaderboards', tabs + `<p>${esc(errMsg(e))}</p>`); }
  } else {
    if (!me) return page('Friends', tabs + '<p>Log in to use friends and messages.</p>');
    page('Friends', tabs + '<p class="muted">Loading…</p>');
    let fr = []; try { fr = (await getDocs(collection(db, 'friends', me.uid, 'list'))).docs.map(d => ({ uid: d.id, ...d.data() })); } catch { }
    const inbox = reqs.map(r => `<div class="lb"><img src="${diffURL('easy', 40)}" style="display:none"><b>${nameHTML(r.fromName)}</b> <span class="muted">wants to be friends</span><span style="margin-left:auto" class="row"><button class="btn green sm" data-act="accept" data-id="${r.id}">Accept</button><button class="btn red sm" data-act="decline" data-id="${r.id}">Decline</button></span></div>`).join('') || '<p class="muted">No pending requests.</p>';
    const list = fr.map(f => `<div class="lb"><b data-act="profile" data-uid="${f.uid}">${nameHTML(f.name)}</b><span style="margin-left:auto"><button class="btn blue sm" data-act="dm" data-uid="${f.uid}" data-name="${esc(f.name)}">💬 Message</button></span></div>`).join('') || '<p class="muted">No friends yet - click a name on the leaderboard to add someone.</p>';
    page('Friends', tabs + `<div class="card"><h3>Add a friend</h3><div class="row"><input id="fname" placeholder="Username" style="max-width:260px;margin:0"><button class="btn green sm" data-act="addfriend">Send request</button></div></div><h3>Inbox</h3><div class="list">${inbox}</div><h3>Friends</h3><div class="list">${list}</div><p class="muted">Direct messages are cleared every day at 12am EST.</p>`);
  }
};
async function showProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid)); if (!s.exists()) return toast('Account not found', 'err'); const u = s.data();
  let ls = []; try { ls = (await getDocs(query(collection(db, 'levels'), where('authorId', '==', uid)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  let isF = false; if (me && uid !== me.uid) { try { isF = (await getDoc(doc(db, 'friends', me.uid, 'list', uid))).exists(); } catch { } }
  const acts = me && uid !== me.uid ? (isF ? `<button class="btn blue sm" data-act="dm" data-uid="${uid}" data-name="${esc(u.username)}">💬 Message</button>` : `<button class="btn green sm" data-act="addfriend" data-name="${esc(u.username)}">➕ Add friend</button>`) : '';
  const ban = isMod() && u.username !== MOD ? `<button class="btn red sm" data-act="ban" data-uid="${uid}" data-name="${esc(u.username)}">Ban account</button>` : '';
  modal(`<h2>${nameHTML(u.username)}</h2><div class="row"><img src="${userIcon(u, 96)}" width="96" height="96"><div class="muted" style="font-size:16px">⭐ ${fmt(u.stars)} stars<br>😈 ${fmt(u.demons)} demons<br>👍 ${fmt(u.netLikes)} net likes<br>✅ ${fmt(u.levelsBeaten)} levels beaten<br>👁 ${fmt(u.totalViews)} total views</div></div><div class="row" style="margin:12px 0">${acts}${ban}</div><h3>Levels</h3><div class="list">${ls.map(lvlCard).join('') || '<p class="muted">No published levels.</p>'}</div>`, true);
}
async function addFriend(name) {
  if (!me) return toast('Log in first', 'err'); name = (name || '').trim(); if (!name) return;
  const s = await getDoc(doc(db, 'usernames', name.toLowerCase())); if (!s.exists()) return toast('No such user', 'err');
  const uid = s.data().uid; if (uid === me.uid) return toast("That's you!", 'err');
  const inc = reqs.find(r => r.from === uid); if (inc) return acceptReq(inc.id);
  const toName = (await getDoc(doc(db, 'users', uid))).data().username;
  await setDoc(doc(db, 'friendRequests', `${me.uid}_${uid}`), { from: me.uid, fromName: P.username, to: uid, toName, status: 'pending' }); toast('Friend request sent!', 'ok');
}
async function acceptReq(id) {
  const r = reqs.find(x => x.id === id); if (!r) return;
  await updateDoc(doc(db, 'friendRequests', id), { status: 'accepted' });
  const b = writeBatch(db); b.set(doc(db, 'friends', me.uid, 'list', r.from), { name: r.fromName }); b.set(doc(db, 'friends', r.from, 'list', me.uid), { name: P.username }); await b.commit();
  toast('Friend added!', 'ok');
}
function etMidnight() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  for (const off of [4, 5]) { const t = Date.UTC(+parts.year, +parts.month - 1, +parts.day, off); const h = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(t); if (h % 24 === 0) return t; }
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, 5);
}
async function purgeDMs() {
  if (!me) return; const cut = new Date(etMidnight());
  try {
    const fr = await getDocs(collection(db, 'friends', me.uid, 'list'));
    for (const f of fr.docs) { const pair = [me.uid, f.id].sort().join('_'); const old = await getDocs(query(collection(db, 'dms', pair, 'messages'), where('t', '<', cut))); await batchDelete(old.docs.map(d => d.ref)); }
  } catch (e) { console.warn('dm purge', e); }
}
setInterval(purgeDMs, 15 * 60 * 1000);
function openDM(uid, name) {
  const pair = [me.uid, uid].sort().join('_'); const cut = etMidnight();
  modal(`<h2>💬 ${nameHTML(name)}</h2><div id="dmlist" class="comments" style="height:300px"></div><div class="row"><input id="dmtext" maxlength="300" placeholder="Message…" style="flex:1;margin:0"><button class="btn green sm" data-act="dmsend" data-pair="${pair}">Send</button></div><p class="muted">Messages are deleted every day at 12am EST.</p>`);
  const un = onSnapshot(query(collection(db, 'dms', pair, 'messages'), orderBy('t')), s => {
    const el = $('#dmlist'); if (!el) return;
    el.innerHTML = s.docs.map(d => d.data()).filter(m => !m.t || m.t.toMillis() >= cut).map(m => `<div class="cm" style="${m.from === me.uid ? 'background:#17673a' : ''}"><b>${nameHTML(m.fromName)}</b><br>${esc(m.text)}</div>`).join('') || '<p class="muted">No messages today.</p>'; el.scrollTop = 1e9;
  }, e => toast(errMsg(e), 'err'));
  modalClose = un;
}

/* ================= editor: slots ================= */
let slots = [];
const skey = () => `dash_levels_${me ? me.uid : 'anon'}`;
function loadSlots() { try { slots = JSON.parse(localStorage[skey()] || '[]'); } catch { slots = []; } while (slots.length < SLOTS) slots.push(null); slots.length = SLOTS; }
let pushT = {};
function saveSlots(i) {
  localStorage[skey()] = JSON.stringify(slots);
  if (me && i != null && i >= 0 && slots[i]) { clearTimeout(pushT[i]); pushT[i] = setTimeout(() => { const j = JSON.stringify(slots[i]); if (j.length < 900000) setDoc(doc(db, 'users', me.uid, 'drafts', 's' + i), { slot: i, lv: j, updated: slots[i].updated || 0 }).catch(() => { }); }, 1500); }
}
async function pullDrafts() {
  try {
    const s = await getDocs(collection(db, 'users', me.uid, 'drafts')); let ch = false;
    s.forEach(d => { const r = d.data(), l = slots[r.slot]; if (!l || (r.updated || 0) > (l.updated || 0)) { try { slots[r.slot] = JSON.parse(r.lv); ch = true; } catch { } } });
    if (ch) { localStorage[skey()] = JSON.stringify(slots); if (cur === 'editor') views.editor(); }
  } catch { }
}
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h.toString(36) + s.length; };
const sigOf = objs => hash(objs.map(o => JSON.stringify(o)).join('|'));
const newLevel = name => ({ name, desc: '', objs: [], bg: '#2b5fd9', ground: '#173a94', songName: '', verified: '', pub: null, updated: Date.now() });
views.editor = () => {
  if (!me) { return page('Editor', '<div class="card"><h3>Log in to create levels</h3><p class="muted">Anonymous players can view and play levels. Open the Account menu to log in or sign up.</p><button class="btn green" data-act="go" data-v="account">Account</button></div>'); }
  const cards = slots.map((l, i) => {
    if (!l) return `<div class="card" style="text-align:center"><b>Slot ${i + 1}</b><div class="muted" style="margin:10px 0">Empty</div><button class="btn green sm" data-act="slotnew" data-i="${i}">＋ New level</button></div>`;
    const ok = l.verified === sigOf(l.objs), pub = !!l.pub;
    return `<div class="card"><b>${esc(l.name)}</b> <span class="muted">· ${l.objs.length} objects</span><div class="muted">${pub ? '🌐 Published (locked)' : ok ? '✔ Verified' : 'Not verified'}${l.songName ? ' · 🎵 ' + esc(l.songName) : ''}</div><div class="muted" style="min-height:20px">${esc(l.desc)}</div><div class="row" style="margin-top:8px">${pub ? `<button class="btn blue sm" data-act="openlvl" data-id="${l.pub}">View</button>` : `<button class="btn orange sm" data-act="slotedit" data-i="${i}" title="Edit">🔧</button><button class="btn sm" data-act="slotrename" data-i="${i}">Rename</button><button class="btn sm" data-act="slotdesc" data-i="${i}">Description</button><button class="btn green sm" data-act="slotpub" data-i="${i}" ${ok ? '' : 'disabled'}>⬆ Upload</button>`}<button class="btn sm" data-act="slotcopy" data-i="${i}">Copy</button><button class="btn red sm" data-act="slotdel" data-i="${i}">Delete</button></div></div>`;
  }).join('');
  page('Level Editor', `<p class="muted">20 level slots. Beat your level from 0-100% in the editor to unlock Upload. Published levels can't be edited, but you can copy them.</p><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${cards}</div>`);
};

/* ================= editor: canvas ================= */
const ed = { on: false, slot: -1, lv: null, camX: -90, camY: -80, z: 1, mode: 'build', tool: 'block', rot: 0, sel: null, sels: [], clip: [], hist: [], mx: 300, my: 300, wx: 0, wy: 0, drag: null, tab: 'blocks' };
const iconCache = {};
function objIcon(t) {
  if (iconCache[t]) return iconCache[t];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const o = { t, r: 0, col: t === 'trig_color' ? '#ff5252' : undefined };
  if (t.startsWith('port')) drawObj(c, o, 20, 32, 24, '#000', true); else drawObj(c, o, 10, 10, 44, defColor(t), true);
  return iconCache[t] = cv.toDataURL();
}
function openEditor(i) {
  ed.slot = i; ed.lv = slots[i]; ed.camX = -300; ed.camY = -80; ed.z = 1; ed.sel = null; ed.sels = []; ed.hist = []; ed.mode = 'build'; ed.on = true;
  showLayer('edit'); setTrack('editor'); renderEdUI(); renderProps(); edDraw();
}
function renderEdUI() {
  document.querySelectorAll('#edModes button').forEach(b => b.classList.toggle('on', b.dataset.m === ed.mode));
  const cats = [...new Set(Object.values(OBJ).map(o => o.cat))];
  $('#edTabs').innerHTML = cats.map(c => `<button class="${c === ed.tab ? 'on' : ''}" data-act="edtab" data-c="${c}">${c}</button>`).join('') + `<button data-act="edrotl">↺ Q</button><button data-act="edrotr">↻ E</button><button data-act="edcopy">Copy</button><button data-act="edpaste">Paste</button>`;
  $('#edItems').innerHTML = Object.entries(OBJ).filter(([, o]) => o.cat === ed.tab).map(([t, o]) => `<button class="it ${t === ed.tool ? 'on' : ''}" data-act="edtool" data-t="${t}"><img src="${objIcon(t)}">${o.name}</button>`).join('');
  const ok = ed.lv && ed.lv.verified === sigOf(ed.lv.objs); $('#edStatus').textContent = `${ed.lv.name} · ${ed.lv.objs.length} obj · ${ok ? '✔ Verified' : 'Not verified'}`;
}
const snap = () => { const s = JSON.stringify(ed.lv.objs); if (ed.hist[ed.hist.length - 1] !== s) { ed.hist.push(s); if (ed.hist.length > 60) ed.hist.shift(); } };
let asT = null;
function changed() { ed.lv.updated = Date.now(); clearTimeout(asT); asT = setTimeout(() => saveSlots(ed.slot), 800); renderEdUI(); }
function s2w(e) { const cv = $('#editCanvas'), H = cv.clientHeight; ed.mx = e.offsetX; ed.my = e.offsetY; ed.wx = e.offsetX / ed.z + ed.camX; ed.wy = (H - e.offsetY) / ed.z + ed.camY; return [ed.wx, ed.wy]; }
function pick(cx, cy) { const os = ed.lv.objs; for (let i = os.length - 1; i >= 0; i--) { const o = os[i]; const h = o.t.startsWith('port') ? (o.x === cx && (o.y === cy || o.y + 1 === cy)) : (o.x === cx && o.y === cy); if (h) return o; } return null; }
function place(cx, cy) {
  if (cx < 0 || cy < 0) return; const lv = ed.lv, t = ed.tool;
  if (lv.objs.some(o => o.t === t && o.x === cx && o.y === cy && (o.r || 0) === ed.rot)) return;
  if (!OBJ[t].trig && !OBJ[t].deco) lv.objs = lv.objs.filter(o => OBJ[o.t].trig || OBJ[o.t].deco || !(o.x === cx && o.y === cy));
  if (t === 'trig_end') lv.objs = lv.objs.filter(o => o.t !== 'trig_end');
  const o = { t, x: cx, y: cy, r: ed.rot, g: 0 };
  if (t === 'block' || t === 'spike') o.c = '#0d0d22';
  if (t === 'trig_color') Object.assign(o, { tg: 1, col: '#ff5252', dur: 1 });
  if (t === 'trig_move') Object.assign(o, { tg: 1, dx: 5, dy: 0, dur: 1 });
  lv.objs.push(o); changed();
}
function delAt(cx, cy) { const n = ed.lv.objs.length; ed.lv.objs = ed.lv.objs.filter(o => !(o.x === cx && (o.t.startsWith('port') ? (o.y === cy || o.y + 1 === cy) : o.y === cy))); if (ed.sel && !ed.lv.objs.includes(ed.sel)) { ed.sel = null; renderProps(); } if (n !== ed.lv.objs.length) changed(); }
function renderProps() {
  const el = $('#edProps'), o = ed.sel; if (!ed.sels.length) return el.classList.remove('open'); el.classList.add('open');
  if (!o) { el.innerHTML = `<h3>${ed.sels.length} selected</h3><div class="row"><button class="btn sm" data-act="edrotl">↺ Left</button><button class="btn sm" data-act="edrotr">↻ Right</button><button class="btn sm" data-act="edcopy">Copy</button><button class="btn sm red" data-act="eddel">Delete</button></div>`; return; }
  let h = `<h3>${OBJ[o.t].name}</h3>`;
  if (o.t === 'trig_color') h += `<label>Target group (0 = background, -1 = ground)<input type="number" data-p="tg" value="${o.tg}"></label><label>Color<input type="color" data-p="col" value="${o.col}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_move') h += `<label>Target group<input type="number" min="1" data-p="tg" value="${o.tg}"></label><label>Move X (blocks)<input type="number" data-p="dx" value="${o.dx}"></label><label>Move Y (blocks)<input type="number" data-p="dy" value="${o.dy}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_end') h += '<p class="muted">Touching this ends the level.</p>';
  else { h += `<label>Group (0 = none)<input type="number" min="0" data-p="g" value="${o.g || 0}"></label>`; if (OBJ[o.t].solid || OBJ[o.t].hz || OBJ[o.t].deco) h += `<label>Color<input type="color" data-p="c" value="${o.c || '#0d0d22'}"></label>`; }
  h += `<div class="row"><button class="btn sm" data-act="edrotl">↺</button><button class="btn sm" data-act="edrotr">↻</button><button class="btn sm red" data-act="eddel">Delete</button></div>`; el.innerHTML = h;
}
function edDraw() {
  if (!ed.on) return; requestAnimationFrame(edDraw);
  const cv = $('#editCanvas'), d = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * d || cv.height !== H * d) { cv.width = W * d; cv.height = H * d; }
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); const z = ed.z, cs = U * z, lv = ed.lv, X = x => (x - ed.camX) * z, Y = y => H - (y - ed.camY) * z, now = performance.now() / 1000;
  c.fillStyle = lv.bg; c.fillRect(0, 0, W, H); drawBG(c, W, H, z, ed.camX, lv.bgs);
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath();
  for (let gx = Math.floor(ed.camX / U) * U; X(gx) < W; gx += U) { c.moveTo(X(gx), 0); c.lineTo(X(gx), H); }
  for (let gy = Math.floor(ed.camY / U) * U; Y(gy) > 0; gy += U) { c.moveTo(0, Y(gy)); c.lineTo(W, Y(gy)); } c.stroke();
  if (Y(0) < H) { c.fillStyle = lv.ground; c.fillRect(0, Y(0), W, H - Y(0)); c.fillStyle = '#fff'; c.fillRect(0, Y(0) - 1, W, 3); }
  c.strokeStyle = '#3ddc4a'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), H); c.stroke(); c.setLineDash([]);
  c.globalAlpha = .5; c.save(); c.translate(X(15), Y(15)); drawIcon(c, P?.skin || 0, PRIMARY[P?.c1 || 0], SECONDARY[P?.c2 || 0], cs); c.restore(); c.globalAlpha = 1;
  for (const o of lv.objs) { const sx = X(o.x * U), sy = Y(o.y * U + U); if (sx < -cs * 2 || sx > W + cs || sy < -cs * 3 || sy > H + cs) continue; drawObj(c, o, sx, sy, cs, o.c || defColor(o.t), true, now); }
  c.strokeStyle = '#ffe36b'; c.lineWidth = 3; for (const o of ed.sels) c.strokeRect(X(o.x * U) - 2, Y(o.y * U + U) - 2, cs + 4, cs + 4);
  if (ed.drag && ed.drag.k === 'box' && ed.drag.x1 != null) { const d = ed.drag; c.fillStyle = 'rgba(255,227,107,.18)'; c.fillRect(X(d.x0), Y(d.y0), X(d.x1) - X(d.x0), Y(d.y1) - Y(d.y0)); c.strokeRect(X(d.x0), Y(d.y0), X(d.x1) - X(d.x0), Y(d.y1) - Y(d.y0)); }
  if (ed.mode === 'build') { const cx = Math.floor(ed.wx / U), cy = Math.floor(ed.wy / U); if (cx >= 0 && cy >= 0) { c.globalAlpha = .5; drawObj(c, { t: ed.tool, r: ed.rot }, X(cx * U), Y(cy * U + U), cs, defColor(ed.tool), true, now); c.globalAlpha = 1; } }
}
(() => {
  const cv = $('#editCanvas');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U);
    if (e.button === 1 || e.button === 2 || ed.mode === 'pan') { ed.drag = { k: 'pan', x: e.clientX, y: e.clientY }; return; }
    snap();
    if (ed.mode === 'build') { ed.drag = { k: 'paint' }; place(cx, cy); }
    else if (ed.mode === 'delete') { ed.drag = { k: 'del' }; delAt(cx, cy); }
    else {
      const o = pick(cx, cy);
      if (e.shiftKey) { if (!o) ed.drag = { k: 'box', x0: wx, y0: wy }; else { const i = ed.sels.indexOf(o); i < 0 ? ed.sels.push(o) : ed.sels.splice(i, 1); } }
      else { if (!o) ed.sels = []; else if (!ed.sels.includes(o)) ed.sels = [o]; ed.drag = o ? { k: 'move', cx, cy } : null; }
      ed.sel = ed.sels.length === 1 ? ed.sels[0] : null; renderProps();
    }
  });
  cv.addEventListener('pointermove', e => {
    const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U), dr = ed.drag; if (!dr) return;
    if (dr.k === 'pan') { ed.camX -= (e.clientX - dr.x) / ed.z; ed.camY += (e.clientY - dr.y) / ed.z; dr.x = e.clientX; dr.y = e.clientY; }
    else if (dr.k === 'paint') place(cx, cy); else if (dr.k === 'del') delAt(cx, cy);
    else if (dr.k === 'box') { dr.x1 = wx; dr.y1 = wy; }
    else if (dr.k === 'move' && ed.sels.length && (cx !== dr.cx || cy !== dr.cy)) { const dx = cx - dr.cx, dy = cy - dr.cy; ed.sels.forEach(o => { o.x = Math.max(0, o.x + dx); o.y = Math.max(0, o.y + dy); }); dr.cx = cx; dr.cy = cy; changed(); renderProps(); }
  });
  const up = () => { const d = ed.drag; if (d && d.k === 'box' && d.x1 != null) { const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1); ed.lv.objs.filter(o => (o.x + 1) * U > x0 && o.x * U < x1 && (o.y + 1) * U > y0 && o.y * U < y1).forEach(o => ed.sels.includes(o) || ed.sels.push(o)); ed.sel = ed.sels.length === 1 ? ed.sels[0] : null; renderProps(); } ed.drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const f = e.deltaY < 0 ? 1.1 : .9, bx = e.offsetX / ed.z + ed.camX; ed.z = Math.max(.4, Math.min(2.5, ed.z * f)); ed.camX = bx - e.offsetX / ed.z; }
    else if (e.shiftKey) ed.camX += e.deltaY / ed.z; else { ed.camY -= e.deltaY / ed.z; ed.camX += e.deltaX / ed.z; }
  }, { passive: false });
})();
function edRotate(d = 1) { if (ed.sels.length) { snap(); ed.sels.forEach(o => o.r = (((o.r || 0) + d) % 4 + 4) % 4); changed(); } else ed.rot = ((ed.rot + d) % 4 + 4) % 4; }
function edDelSel() { if (!ed.sels.length) return; snap(); const s = new Set(ed.sels); ed.lv.objs = ed.lv.objs.filter(o => !s.has(o)); ed.sels = []; ed.sel = null; renderProps(); changed(); }
function edCopy() { if (!ed.sels.length) return; const mx = Math.min(...ed.sels.map(o => o.x)), my = Math.min(...ed.sels.map(o => o.y)); ed.clip = ed.sels.map(o => ({ ...JSON.parse(JSON.stringify(o)), x: o.x - mx, y: o.y - my })); toast('Copied ' + ed.clip.length); }
function edPaste() { if (!ed.clip.length) return; snap(); const bx = Math.max(0, Math.floor(ed.wx / U)), by = Math.max(0, Math.floor(ed.wy / U)); const n = ed.clip.filter(o => o.t !== 'trig_end').map(o => ({ ...JSON.parse(JSON.stringify(o)), x: o.x + bx, y: o.y + by })); ed.lv.objs.push(...n); ed.sels = n; ed.sel = n.length === 1 ? n[0] : null; renderProps(); changed(); }
addEventListener('keydown', e => {
  if (!ed.on || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('#modal').classList.contains('open')) return;
  const k = e.key.toLowerCase(), st = 60 / ed.z;
  if (k === 'q') edRotate(-1); else if (k === 'e') edRotate(1);
  else if ((e.ctrlKey || e.metaKey) && k === 'c') edCopy(); else if ((e.ctrlKey || e.metaKey) && k === 'v') edPaste(); else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); edUndo(); }
  else if (k === 'delete' || k === 'backspace') edDelSel();
  else if (k === 'arrowleft') ed.camX -= st; else if (k === 'arrowright') ed.camX += st; else if (k === 'arrowup') ed.camY += st; else if (k === 'arrowdown') ed.camY -= st;
  else if (k === 'p') edPlay(e.shiftKey);
  else if (k === 'escape') { ed.sel = null; ed.sels = []; renderProps(); }
});
function edUndo() { if (!ed.hist.length) return; ed.lv.objs = JSON.parse(ed.hist.pop()); ed.sel = null; ed.sels = []; renderProps(); changed(); }
document.addEventListener('focusin', e => { if (e.target.dataset?.p && ed.on) snap(); });
document.addEventListener('input', e => {
  if (e.target.id === 'volr') { settings.vol = +e.target.value; saveSettings(); return; }
  if (e.target.id === 'songspd') { ed.lv.songSpeed = +e.target.value; saveSlots(ed.slot); return; }
  if (e.target.id === 'songoff') { ed.lv.songOff = Math.max(0, +e.target.value || 0); saveSlots(ed.slot); return; }
  const p = e.target.dataset?.p; if (!p || !ed.sel) return;
  ed.sel[p] = (e.target.type === 'number') ? (+e.target.value || 0) : e.target.value; changed();
});
function edPlay(here) {
  const lv = ed.lv; if (!lv.objs.some(o => o.t === 'trig_end')) return toast('Add an End Trigger first (Triggers tab)', 'err');
  let sx = 0, sy = 0; if (here) { sx = Math.max(0, Math.floor(ed.wx / U) * U); sy = Math.max(0, Math.floor(ed.wy / U) * U); }
  saveSlots(ed.slot); ed.on = false;
  idbGet(`draft:${me.uid}:${ed.slot}`).then(b => {
    startPlay({ level: { objs: lv.objs, bg: lv.bg, ground: lv.ground, bgs: lv.bgs }, kind: 'test', lv0: lv, songSpeed: lv.songSpeed, songOff: lv.songOff, startX: sx, startY: sy, songUrl: b instanceof Blob ? URL.createObjectURL(b) : null, onExit: () => { ed.on = true; showLayer('edit'); renderEdUI(); edDraw(); } });
  });
}
async function edBack() { ed.on = false; saveSlots(ed.slot); clearTimeout(pushT[ed.slot]); const j = JSON.stringify(ed.lv); if (me && j.length < 900000) setDoc(doc(db, 'users', me.uid, 'drafts', 's' + ed.slot), { slot: ed.slot, lv: j, updated: ed.lv.updated || 0 }).catch(() => { }); showLayer('view'); setTrack('menu'); views.editor(); renderFooter(); }
function edSettings() {
  const lv = ed.lv;
  modal(`<h2>Level settings</h2><label>Title<input id="lvName" maxlength="30" value="${esc(lv.name)}"></label><label>Description<textarea id="lvDesc" maxlength="200" rows="3">${esc(lv.desc)}</textarea></label><div class="row"><label style="flex:1">Background<input type="color" id="lvBg" value="${lv.bg}"></label><label style="flex:1">Ground<input type="color" id="lvGr" value="${lv.ground}"></label></div><label>Background style<select id="lvBgs">${BGS.map(([k, n]) => `<option value="${k}" ${(lv.bgs || 'stripes') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>${lv.songName ? 'Change song' : 'Level song'} (mp3)<input type="file" id="songfile" accept="audio/*"></label>${lv.songName ? `<div class="card"><b>🎵 ${esc(lv.songName)}</b><div class="row"><label style="flex:1">Speed<select id="songspd">${[2, 1.5, 1, .5].map(v => `<option value="${v}" ${(lv.songSpeed || 1) == v ? 'selected' : ''}>${v}x</option>`).join('')}</select></label><label style="flex:1">Start offset (ms)<input type="number" min="0" step="10" id="songoff" value="${lv.songOff || 0}"></label></div><div class="row"><button class="btn blue sm" data-act="songprev">▶ Preview / stop</button><button class="btn red sm" data-act="edsong-rm">Remove song</button></div></div>` : '<p class="muted">No song set</p>'}<div class="row"><button class="btn green" data-act="edsave">Save</button></div>`);
}

/* ================= actions (click delegation) ================= */
const val = id => $('#' + id)?.value ?? '';
const actions = {
  go: d => go(d.v, { ...d }), back: () => back(), closemodal: closeModal,
  costab: d => { curP = { ...curP, tab: d.t }; views.cosmetics({ tab: d.t }); },
  acctab: d => { curP = { ...curP, tab: d.t }; views.account({ tab: d.t }); },
  login: async () => { const u = val('au').trim(), p = val('ap'); if (!u || !p) throw 'Enter a username and password'; await signInWithEmailAndPassword(auth, emailOf(u), p); },
  signup: async () => { await signUp(val('au'), val('ap')); toast('Welcome to DASH!', 'ok'); },
  logout: async () => { await signOut(auth); toast('Logged out'); },
  myprofile: () => me && showProfile(me.uid),
  tog: d => { settings[d.k] = !settings[d.k]; saveSettings(); views.account({ tab: 'settings' }); },
  equip: async d => {
    if (!me) return toast('Log in to customize your icon', 'err'); const un = unlocked_(), i = +d.i;
    if (!un[d.k].has(i)) { const a = ACH.find(a => a.rw.k === d.k && a.rw.i === i); return toast('🔒 ' + (a ? `${a.name}: ${a.desc}` : 'Locked'), 'err'); }
    const f = ({ skin: 'skin', ship: 'ship', p: 'c1', s: 'c2' })[d.k]; P[f] = i; await updateDoc(doc(db, 'users', me.uid), { [f]: i }); renderFooter(); views.cosmetics({ tab: curP.tab || 'cube' });
  },
  openlvl: d => { closeModal(); go('level', { id: d.id }); },
  pg: d => renderLevels(d.kind, +d.pg),
  playlvl: d => playPublished(d.id),
  vote: d => vote(d.id, +d.v),
  comment: async d => {
    const t = val('cmt').trim(); if (!t) return; await addDoc(collection(db, 'levels', d.id, 'comments'), { uid: me.uid, name: P.username, text: t, t: serverTimestamp() });
    P.comments = (P.comments || 0) + 1; updateDoc(doc(db, 'users', me.uid), { comments: increment(1) }).catch(() => { }); checkAch(); views.level({ id: d.id });
  },
  delcm: async d => { await deleteDoc(doc(db, 'levels', d.id, 'comments', d.cid)); views.level({ id: d.id }); },
  dlsong: d => downloadSong(d.id),
  takedown: async d => { if (!confirm('Take this level off the servers? All its stats will be cleared.')) return; await takeDown(d.id); toast('Level removed', 'ok'); refreshMyStats(); back(); },
  ratemenu: d => modal(`<h2>Rate level</h2><div class="rate-grid">${DIFFS.map(x => `<button data-act="rate" data-id="${d.id}" data-d="${x.id}"><img src="${diffURL(x.id, 62)}">${x.name}<br>⭐ ${x.stars}</button>`).join('')}</div>`),
  rate: d => rateLevel(d.id, d.d),
  profile: d => showProfile(d.uid),
  lbtab: d => views.lb({ tab: d.t, stat: d.stat || curP.stat }),
  addfriend: async d => { await addFriend(d.name || val('fname')); },
  accept: d => acceptReq(d.id).then(() => views.lb({ tab: 'friends' })),
  decline: async d => { await deleteDoc(doc(db, 'friendRequests', d.id)); },
  dm: d => { closeModal(); openDM(d.uid, d.name); },
  dmsend: async d => { const t = val('dmtext').trim(); if (!t) return; $('#dmtext').value = ''; await addDoc(collection(db, 'dms', d.pair, 'messages'), { from: me.uid, fromName: P.username, text: t, t: serverTimestamp() }); },
  ban: async d => { if (!confirm(`Ban ${d.name}? This deletes their account data and levels.`)) return; await banUser(d.uid, d.name); closeModal(); toast(`${d.name} banned`, 'ok'); },
  // play
  resume: pauseToggle, restart: () => { $('#winBox').classList.remove('open'); $('#pauseBox').classList.remove('open'); game.start({ x: PL.sx, y: PL.sy }); },
  exitplay: () => stopPlay(),
  // editor slots
  slotnew: d => { if (!me) return; const i = +d.i; slots[i] = newLevel('Level ' + (i + 1)); saveSlots(i); openEditor(i); },
  slotedit: d => openEditor(+d.i),
  slotrename: d => { const l = slots[+d.i], n = prompt('Level name', l.name); if (n && n.trim()) { l.name = n.trim().slice(0, 30); l.updated = Date.now(); saveSlots(+d.i); views.editor(); } },
  slotdesc: d => { const l = slots[+d.i], n = prompt('Description', l.desc); if (n !== null) { l.desc = n.slice(0, 200); l.updated = Date.now(); saveSlots(+d.i); views.editor(); } },
  slotdel: async d => { const i = +d.i; if (!confirm('Delete this level slot? (Published copies stay on the servers.)')) return; slots[i] = null; saveSlots(); idbDel(`draft:${me.uid}:${i}`); deleteDoc(doc(db, 'users', me.uid, 'drafts', 's' + i)).catch(() => { }); views.editor(); },
  slotcopy: async d => {
    const i = +d.i, f = slots.findIndex(x => !x); if (f < 0) return toast('No free slots', 'err');
    const c = JSON.parse(JSON.stringify(slots[i])); c.name = (c.name + ' copy').slice(0, 30); c.pub = null; c.verified = ''; c.updated = Date.now(); slots[f] = c; saveSlots(f);
    const b = await idbGet(`draft:${me.uid}:${i}`); if (b) idbSet(`draft:${me.uid}:${f}`, b); toast('Copied to slot ' + (f + 1), 'ok'); views.editor();
  },
  slotpub: async d => { await publish(+d.i); },
  // editor
  edback: edBack, edmode: d => { ed.mode = d.m; ed.drag = null; renderEdUI(); }, edundo: edUndo, edplay: () => edPlay(false), edplayhere: () => edPlay(true),
  edtab: d => { ed.tab = d.c; renderEdUI(); }, edtool: d => { ed.tool = d.t; ed.mode = 'build'; ed.sel = null; ed.sels = []; renderProps(); renderEdUI(); },
  edrot: () => edRotate(1), edsettings: edSettings,
  eddel: edDelSel, edrotl: () => edRotate(-1), edrotr: () => edRotate(1), edcopy: edCopy, edpaste: edPaste,
  songprev: async () => { if (prevA) { prevA.pause(); prevA = null; return; } const b = await idbGet(`draft:${me.uid}:${ed.slot}`); if (!(b instanceof Blob)) return toast('No song file', 'err'); prevA = new Audio(URL.createObjectURL(b)); prevA.volume = settings.vol; prevA.playbackRate = ed.lv.songSpeed || 1; prevA.currentTime = (ed.lv.songOff || 0) / 1000; prevA.play().catch(() => { }); setTimeout(() => { prevA && prevA.pause(); prevA = null; }, 10000); },
  edsave: () => { const lv = ed.lv; lv.name = val('lvName').trim().slice(0, 30) || lv.name; lv.desc = val('lvDesc').slice(0, 200); lv.bg = val('lvBg'); lv.bgs = val('lvBgs') || 'stripes'; lv.ground = val('lvGr'); lv.updated = Date.now(); saveSlots(ed.slot); closeModal(); renderEdUI(); },
  'edsong-rm': async () => { ed.lv.songName = ''; await idbDel(`draft:${me.uid}:${ed.slot}`); saveSlots(ed.slot); closeModal(); },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const f = actions[a.dataset.act]; if (!f) return;
  Promise.resolve().then(() => f(a.dataset, a, e)).catch(err => { console.error(err); toast(errMsg(err), 'err'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') { if (e.target.id === 'ap' || e.target.id === 'au') actions.login().catch(err => toast(errMsg(err), 'err')); else if (e.target.id === 'cmt') $('[data-act=comment]')?.click(); else if (e.target.id === 'dmtext') $('[data-act=dmsend]')?.click(); else if (e.target.id === 'fname') actions.addfriend({}).catch(err => toast(errMsg(err), 'err')); }
  if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal();
});
document.addEventListener('change', async e => {
  if (e.target.id === 'songfile' && e.target.files[0]) {
    const f = e.target.files[0]; if (f.size > 8 * 1024 * 1024) return toast('Song must be under 8 MB', 'err');
    await idbSet(`draft:${me.uid}:${ed.slot}`, f); ed.lv.songName = f.name.replace(/\.[^.]+$/, '').slice(0, 60); ed.lv.songSpeed = ed.lv.songSpeed || 1; ed.lv.songOff = ed.lv.songOff || 0; saveSlots(ed.slot); toast('Song added', 'ok'); edSettings();
  }
});
$('#pauseBtn').addEventListener('click', e => { e.stopPropagation(); pauseToggle(); });
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });

/* ================= publish & moderation ================= */
async function publish(i) {
  const lv = slots[i]; if (!me || !P) return toast('Log in first', 'err');
  if (lv.verified !== sigOf(lv.objs)) return toast('Beat the level from 0 to 100% first', 'err');
  if (!confirm(`Publish "${lv.name}"? Published levels can't be edited (you can copy them).`)) return;
  try {
    const data = JSON.stringify({ v: 2, objs: lv.objs, bg: lv.bg, ground: lv.ground, bgs: lv.bgs || 'stripes', songSpeed: lv.songSpeed || 1, songOff: lv.songOff || 0 });
    if (data.length > 900000) throw 'Level is too big to upload';
    const sb = await idbGet(`draft:${me.uid}:${i}`), has = sb instanceof Blob && sb.size > 0, parts = has ? Math.ceil(sb.size / SONG_CHUNK) : 0;
    const r = doc(collection(db, 'levels')); toast('Uploading level…');
    await setDoc(r, { authorId: me.uid, authorName: P.username, title: lv.name, desc: lv.desc, data, status: 'unrated', diff: null, stars: 0, views: 0, likes: 0, dislikes: 0, created: serverTimestamp(), songUrl: null, songName: has ? lv.songName : null, songParts: parts, songSpeed: lv.songSpeed || 1, songOff: lv.songOff || 0, count: lv.objs.length });
    if (has) {
      try {
        for (let k = 0; k < parts; k += 3) {
          const b = writeBatch(db);
          for (let j = k; j < Math.min(parts, k + 3); j++) b.set(doc(db, 'levels', r.id, 'songChunks', String(j).padStart(3, '0')), { n: j, d: await blobB64(sb.slice(j * SONG_CHUNK, (j + 1) * SONG_CHUNK)) });
          await b.commit(); toast(`Uploading song… ${Math.min(parts, k + 3)}/${parts}`);
        }
      } catch (e) { await delCol(['levels', r.id, 'songChunks']).catch(() => { }); await deleteDoc(r).catch(() => { }); throw 'Song upload failed (' + errMsg(e) + '). Level was not published - did you update the Firestore rules?'; }
    }
    lv.pub = r.id; saveSlots(i); refreshMyStats(); toast('Published! Vortarium has been pinged to rate it.', 'ok'); views.editor();
  } catch (e) { console.error(e); toast('Publish failed: ' + errMsg(e), 'err'); }
}
async function banUser(uid, name) {
  const ls = await getDocs(query(collection(db, 'levels'), where('authorId', '==', uid))); for (const d of ls.docs) await takeDown(d.id);
  for (const sub of ['beaten', 'progress', 'drafts']) await delCol(['users', uid, sub]).catch(() => { });
  await delCol(['friends', uid, 'list']).catch(() => { });
  await deleteDoc(doc(db, 'users', uid)); await deleteDoc(doc(db, 'usernames', name.toLowerCase())).catch(() => { });
  await setDoc(doc(db, 'banned', uid), { name, t: serverTimestamp() });
}

/* ================= boot ================= */
loadSlots(); renderFooter(); go('menu');

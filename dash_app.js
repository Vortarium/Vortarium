// dash_app.js - DASH (single file: Firebase setup, engine, UI, editor). Put all future code here.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, runTransaction, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, addDoc, onSnapshot, serverTimestamp, increment, writeBatch, arrayUnion, collectionGroup } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
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
// LDM = Low Definition Mode (Settings > LDM): a per-device switch that reloads the game and strips the visuals down (no decor / glow / background patterns, flat blocks, half-res canvas) while keeping every hitbox and the gameplay identical
const LDM = (() => { try { return localStorage.dash_ldm === '1'; } catch (e) { return false; } })();
if (LDM) document.documentElement.classList.add('ldm');
const COY = .1;   // coyote time in seconds (about 5 frames at 60fps)
const U = 30, BASE = 311, STEP = 1 / 240, G = 3250, JUMP = 640, VMAX = 950;
const PRIMARY = ['#7dff2a', '#ff3b3b', '#ff9a1f', '#ffe81f', '#1fd1ff', '#2f6bff', '#a43bff', '#ff4fd8', '#ffffff', '#3a3a4c', '#00ffa2', '#c0ff00', '#ff0080'];
const SECONDARY = ['#1fffe0', '#e8f1ff', '#ffd21f', '#ff6a3d', '#ff2f6d', '#7a4dff', '#3a8bff', '#2bd45a', '#111118', '#b0b0c0', '#ffa8e8', '#00a8ff', '#8cff00'];
const DIFFS = [
  { id: 'easy', name: 'EASY', stars: 1, col: '#3aa0ff' },
  { id: 'medium', name: 'MEDIUM', stars: 2, col: '#35d35a' },
  { id: 'hard', name: 'HARD', stars: 3, col: '#ffd21f' },
  { id: 'harder', name: 'HARDER', stars: 4, col: '#ff3b3b' },
  { id: 'insane', name: 'INSANE', stars: 5, col: '#9b3bff' },
  { id: 'edemon', name: 'EASY DEMON', stars: 6, col: '#a855f7', demon: true },
  { id: 'mdemon', name: 'MEDIUM DEMON', stars: 7, col: '#ff6fb5', demon: true },
  { id: 'hdemon', name: 'HARD DEMON', stars: 8, col: '#c4222f', demon: true },
  { id: 'idemon', name: 'INSANE DEMON', stars: 9, col: '#e0101f', demon: true },
  { id: 'xdemon', name: 'EXTREME DEMON', stars: 10, col: '#7a0010', demon: true }
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
  trig_pulse: { name: 'Pulse Trigger', cat: 'triggers', trig: true },
  zone_d: { name: 'D Block', cat: 'triggers', zone: true },
  zone_s: { name: 'S Block', cat: 'triggers', zone: true },
  orb_b: { name: 'Blue Orb (gravity)', cat: 'orbs' },
  port_gd: { name: 'Gravity Down Portal', cat: 'portals' },
  port_gu: { name: 'Gravity Up Portal', cat: 'portals' }
};
OBJ.port_ship = { name: 'Ship Portal', cat: 'portals' }; OBJ.port_cube = { name: 'Cube Portal', cat: 'portals' };
Object.assign(OBJ, {
  orb_r: { name: 'Red Orb', cat: 'orbs' }, orb_d: { name: 'Dash Orb', cat: 'orbs' }, orb_db: { name: 'Reverse Dash Orb', cat: 'orbs' },
  pad_b: { name: 'Blue Pad (gravity)', cat: 'pads' }, pad_r: { name: 'Red Pad', cat: 'pads' },
  trig_zoom: { name: 'Zoom Trigger', cat: 'triggers', trig: true }, trig_toggle: { name: 'Toggle Trigger', cat: 'triggers', trig: true }, trig_alpha: { name: 'Alpha Trigger', cat: 'triggers', trig: true },
  coin: { name: 'Star Coin', cat: 'coins', coin: true }
});
Object.assign(OBJ, {
  port_ball: { name: 'Ball Portal', cat: 'portals' }, port_ufo: { name: 'UFO Portal', cat: 'portals' }, port_wave: { name: 'Wave Portal', cat: 'portals' },
  half: { name: 'Half Block', cat: 'blocks', solid: true, half: true }, slope: { name: 'Slope', cat: 'blocks', solid: true, slope: true }
});
Object.assign(MODEP, { port_ball: 1, port_ufo: 1, port_wave: 1 });
Object.assign(PORT_COL, { port_ball: '#ff7a1f', port_ufo: '#ffd21f', port_wave: '#2fd0ff' });
Object.assign(OBJ, {
  port_robot: { name: 'Robot Portal', cat: 'portals' }, port_spider: { name: 'Spider Portal', cat: 'portals' },
  port_mf: { name: 'Forward Portal (normal view)', cat: 'portals' }, port_mb: { name: 'Reverse Portal (flip view)', cat: 'portals' }
});
Object.assign(MODEP, { port_robot: 1, port_spider: 1 });
const REVP = { port_mf: 1, port_mb: 1 };   // reverse portals: flip the whole screen left<->right
Object.assign(PORT_COL, { port_robot: '#dfe3f2', port_spider: '#a24bff', port_mf: '#4dffb0', port_mb: '#ff5d6e' });
const PMODE = { port_cube: 'cube', port_ship: 'ship', port_ball: 'ball', port_ufo: 'ufo', port_wave: 'wave', port_robot: 'robot', port_spider: 'spider' };
const PLET = { port_cube: 'C', port_ship: 'S', port_ball: 'B', port_ufo: 'U', port_wave: 'W', port_robot: 'R', port_spider: 'SP' };
// size portals: Big = the default size, Mini = every gamemode 1.5x smaller (with tougher physics, see Game.step). The wave itself is now drawn / hitboxed 1.5x bigger than before, so the mini wave is exactly the old wave size.
const SZP = { port_big: 1, port_mini: 1 }, MINI = 1 / 1.5, WAVE_BIG = 1.5, WAVE_MINI_K = Math.tan(60 * Math.PI / 180);   // mini wave climbs / dives at 60 degrees (the big wave stays at 45)
Object.assign(OBJ, {
  port_big: { name: 'Big Portal', cat: 'portals' }, port_mini: { name: 'Mini Portal', cat: 'portals' },
  slope2: { name: 'Tall Slope (1x2)', cat: 'blocks', solid: true, slope: true, tall: true },   // 1 wide, 2 tall: ~63 degrees, made for the mini wave's 60 degree path
  slope_s: { name: 'Slide Slope', cat: 'blocks', solid: true, slope: true, slide: true },       // the wave slides along it instead of dying
  slope2_s: { name: 'Tall Slide Slope (1x2)', cat: 'blocks', solid: true, slope: true, tall: true, slide: true }
});
Object.assign(PORT_COL, { port_big: '#9aa8ff', port_mini: '#e8ff3d' });
const ORBS = ['orb_y', 'orb_p', 'orb_b', 'orb_r', 'orb_d', 'orb_db'], PADS = ['pad_y', 'pad_p', 'pad_b', 'pad_r'], DASH = { orb_d: 1, orb_db: 1 };
const ORBCOL = { orb_y: '#ffe21f', orb_p: '#ff5fd2', orb_b: '#2fb6ff', orb_r: '#ff3030', orb_d: '#3dff5a', orb_db: '#ff8a00' };
const PADCOL = { pad_y: '#ffe21f', pad_p: '#ff5fd2', pad_b: '#2fb6ff', pad_r: '#ff3030' };
const TRC = { trig_color: null, trig_move: '#3aa0ff', trig_end: '#35d35a', trig_zoom: '#b06bff', trig_toggle: '#ff9a1f', trig_alpha: '#8fa0c8', trig_pulse: '#ffffff', zone_d: '#e0408f', zone_s: '#1fb5a8' };
const TRL = { trig_color: 'COL', trig_move: 'MOV', trig_end: 'END', trig_zoom: 'ZOOM', trig_toggle: 'TOG', trig_alpha: 'ALP', trig_pulse: 'PUL', zone_d: 'D', zone_s: 'S' };
OBJ.spike.hz = { k: 't', a: 1, b: 1, n: 1 };
['Plain','Inset','Cross','Dots','Stripes','Checker','Bevel','Slab','Frame','Diamond'].forEach((n, i) => [0, 1].forEach(v => { if (i + v) OBJ['blk' + (i + v * 10)] = { name: n + (v ? ' Dark' : ''), cat: 'blocks', solid: true, bs: i, bv: v }; }));
OBJ.block.solid = true;
[['Half Spike','t',1,.5,1],['Thin Spike','t',.5,1,1],['Wide Spike','t',1,.7,1],['Double Spike','t',1,1,2],['Triple Spike','t',1,1,3],['Mini Spikes','t',1,.5,3],['Quad Mini','t',1,.4,4],['Needle','t',.3,1,1],['Fang','t',.7,1,1],
 ['Mini Saw','s',.22,6],['Small Saw','s',.35,8],['Saw','s',.5,8],['Big Saw','s',.75,10],['Large Saw','s',1,12],['Huge Saw','s',1.5,14],['Star Saw','s',.5,5],['Blade Saw','s',.6,3],['Gear','s',.5,12],['Spiky Ball','s',.4,16]]
 .forEach(([n, k, a, b, c], i) => OBJ['hz' + i] = { name: n, cat: 'hazards', hz: k === 't' ? { k, a, b, n: c } : { k, a, b } });
['Flower','Tulip','Bush','Tree','Grass','Cloud','Big Cloud','Brick','Mini Bricks','Mini Spike','Mini Spike Row','Star','Moon','Sun','Dots','Ring','Diamond','Crystal','Vine','Mushroom','Leaf','Pebbles','Fence','Lamp','Arrow','Cross','Wave','Zigzag','Heart','Pillar']
 .forEach((n, i) => OBJ['dc' + i] = { name: n, cat: 'decor', deco: true, dk: i, di: i });
function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
const SPEC = [];
(() => {
  const add = (c, g) => { PRIMARY.push(c); SECONDARY.push(c); SPEC.push({ i: PRIMARY.length - 1, g }); };
  for (let h = 0; h < 360; h += 30) add(hsl(h, 100, 50), 'rainbow');
  for (let h = 0; h < 360; h += 30) add(hsl(h, 100, 78), 'light');
  for (let h = 0; h < 360; h += 30) add(hsl(h, 100, 26), 'dark');
  for (let h = 15; h < 360; h += 30) add(hsl(h, 55, 48), 'muted');
  ['#0b0b0b', '#2a2a2a', '#444444', '#606060', '#808080', '#a0a0a0', '#c4c4c4', '#e6e6e6'].forEach(c => add(c, 'gray'));
})();
const GEMS = { 1: 10, 2: 25, 3: 50, 4: 100, 5: 150, 6: 250, 7: 250, 8: 250, 9: 250, 10: 250 };   // gems for fully beating a rated level, by star rating (every demon = 250)
// levels rated before the 10-star update: old 'insane' (4 stars) is now HARDER, old 'demon' (5 stars) is now HARD DEMON
function dOf(l) { let id = l && l.diff; if (!id) return null; if (id === 'insane' && (l.stars || 0) === 4) id = 'harder'; else if (id === 'demon') id = 'hdemon'; return DIFFS.find(x => x.id === id) || null; }
const IN = 7.5;                                          // inner hitbox inset (cube 30 -> inner 15, centered)
const lb = (a, x) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].ex < x) lo = m + 1; else hi = m; } return lo; };
const BGS = [['stripes','Stripes'],['dots','Dots'],['tri','Triangles'],['circles','Circles'],['grid','Grid'],['waves','Waves'],['none','Plain']];
// ---- new looks (same hitboxes as the originals: only the artwork differs) ----
const BLK2 = ['Gradient', 'Gradient Up', 'Fade Side', 'Glass', 'Tiles 3x3', 'Thick Tiles', 'Ghost Tiles', 'Tile Ring', 'Diagonal', 'Diagonal Flip', 'Pyramid', 'Pyramid Flip', 'Ghost Pyramid', 'Inset Frame', 'Deep Inset', 'Ghost Frame', 'Solid', 'Hollow', 'Bricks', 'Ghost Bricks', 'Big Bricks', 'Studs', 'Split', 'Slats', 'Panels', 'Corner Cut'];
BLK2.forEach((n, i) => OBJ['bx' + i] = { name: n, cat: 'blocks', solid: true, bs: 10 + i, bv: 0 });
const SPK_LOOKS = [['grad', 'Gradient'], ['white', 'White'], ['ghost', 'Ghost'], ['jag', 'Jagged'], ['hill', 'Hills'], ['saw', 'Sawtooth'], ['ramp', 'Ramp']];
['spike', 'hz0', 'hz2', 'hz4', 'hz5', 'hz7'].forEach(bid => SPK_LOOKS.forEach(([lk, ln]) => OBJ['sk_' + lk + '_' + bid] = { name: ln + ' ' + OBJ[bid].name, cat: 'hazards', hz: { ...OBJ[bid].hz, lk } }));
const defColor = t => { const d = OBJ[t]; if (!d) return '#ffffff'; if (d.base) return defColor(d.base); if (d.nx) return d.dc; if (d.slide) return '#0b2434'; if (d.deco) return hsl(d.di * 47 % 360, 65, 68); if (d.hz && d.hz.lk === 'white') return '#e8edff'; if (d.hz && d.hz.lk === 'ghost') return '#6e7bb0'; if (t === 'block' || d.hz || d.half || d.slope) return '#0d0d22'; if (d.bs !== undefined) return d.bv ? '#27276a' : '#0d0d22'; return '#ffffff'; };
const PHYS = { orb_y: JUMP, orb_p: 450, pad_y: 900, pad_p: 620, orb_r: 900, pad_r: 1100, pad_b: 350 };

const PH = 3;   // portals are 3 cells tall
const topRows = objs => objs.reduce((m, o) => OBJ[o.t].trig ? m : Math.max(m, o.y + (o.t.startsWith('port') ? PH : OBJ[o.t].tall ? 2 : 1)), 0);
// the level ends at the placed End Trigger; without one it ends 3 blocks after the right edge of the farthest object
[['Black Square', 'sq'], ['Black Triangle', 'tri'], ['Black Spike Shape', 'tri2']].forEach(([n, k]) => OBJ['fx_' + k] = { name: n, cat: 'decor', deco: true, nx: k, dc: '#000000' });
[['Small Glow Ball', .45], ['Medium Glow Ball', .9], ['Large Glow Ball', 1.6]].forEach(([n, r], i) => OBJ['fx_gb' + i] = { name: n, cat: 'decor', deco: true, nx: 'gb', gr: r, glow: true, dc: '#4fc3ff' });
OBJ.fx_gl = { name: 'Glow Line', cat: 'decor', deco: true, nx: 'gl', glow: true, dc: '#ff5cf2' };
Object.keys(OBJ).filter(k => OBJ[k].solid).forEach(k => OBJ['fd_' + k] = { name: 'Faded ' + OBJ[k].name, cat: 'decor', deco: true, base: k });   // see-through copy of every block, no hitbox
const endCell = objs => { const e = objs.find(o => o.t === 'trig_end'); if (e) return e.x; let m = -1; for (const o of objs) if (o.x > m) m = o.x; return Math.max(0, m) + 1 + 3; };
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerpC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (h, f) => rgb2hex(hex2rgb(h).map(v => Math.max(0, Math.min(255, v + 255 * f))));

// ---------- icons (30 unique cubes, 30 unique ships) ----------
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawIcon(c, skin, c1, c2, s) {
  const h = s / 2, lw = Math.max(1.5, s * .07), K = '#111', W = '#fff';
  const F = (x, y, w, hh, col = c2) => { c.fillStyle = col; c.fillRect(x * s, y * s, w * s, hh * s); };
  const E = (x, y, r, col = c2) => { c.fillStyle = col; c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); };
  const Pg = (col, ...a) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); c.fill(); };
  const Ln = (w, col, ...a) => { c.strokeStyle = col; c.lineWidth = w * s; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.stroke(); };
  const D = [
    () => { F(-.3, -.3, .6, .6); F(-.19, -.1, .12, .22, K); F(.07, -.1, .12, .22, K); F(-.19, .2, .38, .06, K); },            // 0 classic
    () => { F(-.12, -.5, .24, 1); F(-.5, -.12, 1, .24); E(0, 0, .1, K); },                                                      // 1 cross
    () => { F(-.5, .15, 1, .35); Ln(.07, K, -.38, -.25, -.1, -.12); Ln(.07, K, .38, -.25, .1, -.12); E(-.2, -.02, .07, W); E(.2, -.02, .07, W); }, // 2 angry
    () => { F(-.5, -.2, 1, .26, K); E(-.2, -.07, .07); E(.2, -.07, .07); E(-.4, .38, .05); E(.4, .38, .05); F(-.15, .2, .3, .06); }, // 3 robot
    () => { Pg(c2, 0, -.4, .4, 0, 0, .4, -.4, 0); E(-.1, -.04, .05, K); E(.1, -.04, .05, K); },                                 // 4 diamond
    () => { Pg(c2, -.5, -.5, -.25, -.5, -.375, -.2); Pg(c2, -.12, -.5, .12, -.5, 0, -.15); Pg(c2, .25, -.5, .5, -.5, .375, -.2); Pg(K, -.3, 0, -.05, .05, -.3, .12); Pg(K, .3, 0, .05, .05, .3, .12); F(-.25, .25, .5, .06, K); }, // 5 spiky
    () => { E(0, 0, .34); E(0, 0, .2, W); E(.04, 0, .1, K); },                                                                  // 6 cyclops
    () => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 == 0) F(-.5 + i / 3, -.5 + j / 3, 1 / 3, 1 / 3); }, // 7 checker
    () => { F(-.4, -.5, .14, 1); F(-.07, -.5, .14, 1); F(.26, -.5, .14, 1); },                                                  // 8 stripes
    () => { E(0, -.05, .3, W); F(-.17, .15, .34, .22, W); E(-.12, -.05, .09, K); E(.12, -.05, .09, K); Pg(K, 0, .05, -.04, .13, .04, .13); Ln(.03, K, -.06, .2, -.06, .37); Ln(.03, K, .06, .2, .06, .37); }, // 9 skull
    () => { E(0, 0, .4); E(0, 0, .28, K); E(0, 0, .16); E(0, 0, .06, K); },                                                      // 10 target
    () => { F(-.5, -.5, .5, 1); E(.2, -.05, .1, W); E(.2, -.05, .05, K); F(.06, .2, .3, .06, K); },                              // 11 half split
    () => { E(-.13, -.1, .17); E(.13, -.1, .17); Pg(c2, -.29, 0, .29, 0, 0, .34); },                                             // 12 heart
    () => { Pg(c2, .12, -.45, -.25, .05, -.02, .05, -.12, .45, .27, -.1, .02, -.1); },                                           // 13 bolt
    () => { const a = []; for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? .17 : .4; a.push(Math.cos(t) * r, Math.sin(t) * r); } Pg(c2, ...a); }, // 14 star
    () => { Pg(c2, -.5, -.5, -.5, -.1, -.15, -.5); Pg(c2, .5, -.5, .5, -.1, .15, -.5); E(-.2, .05, .07, W); E(.2, .05, .07, W); Pg(K, -.05, .15, .05, .15, 0, .2); Ln(.03, K, -.46, .15, -.22, .2); Ln(.03, K, .46, .15, .22, .2); }, // 15 cat
    () => { F(-.35, .05, .7, .3, K); F(-.35, .05, .7, .1, W); E(-.2, -.2, .07, K); E(.2, -.2, .07, K); Ln(.03, K, -.1, .15, -.1, .35); Ln(.03, K, .1, .15, .1, .35); }, // 16 grin
    () => { Ln(.1, c2, -.3, -.3, 0, 0, -.3, .3); Ln(.1, c2, .05, -.3, .35, 0, .05, .3); },                                       // 17 chevrons
    () => { E(0, 0, .16); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; Ln(.06, c2, Math.cos(t) * .24, Math.sin(t) * .24, Math.cos(t) * .42, Math.sin(t) * .42); } }, // 18 sun
    () => { E(0, -.2, .14, W); E(-.2, .12, .14, W); E(.2, .12, .14, W); E(0, -.2, .06, K); E(-.2, .12, .06, K); E(.2, .12, .06, K); }, // 19 three eyes
    () => { F(-.5, -.4, 1, .1); F(-.5, -.2, 1, .2); F(-.5, .1, 1, .08); F(-.5, .28, 1, .15); },                                   // 20 barcode
    () => { Ln(.12, c2, -.38, -.38, .38, -.38, .38, .38, -.38, .38, -.38, -.38); E(0, 0, .08, K); },                              // 21 frame
    () => { E(-.05, 0, .32); E(.1, -.05, .27, c1); E(-.2, .22, .04, W); E(.3, .25, .03, W); },                                    // 22 moon
    () => { F(-.1, -.32, .2, .64); F(-.32, -.1, .64, .2); },                                                                      // 23 plus
    () => { Pg(c2, 0, -.4, .4, .35, -.4, .35); E(0, .08, .12, W); E(0, .08, .06, K); },                                           // 24 pyramid eye
    () => { const a = []; for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; a.push(Math.cos(t) * .36, Math.sin(t) * .36); } Pg(c2, ...a); E(0, 0, .1, K); }, // 25 hexagon
    () => { for (let j = 0; j < 3; j++) { const a = []; for (let x = -.5; x <= .5; x += .1) a.push(x, -.3 + j * .3 + Math.sin(x * 12) * .07); Ln(.07, c2, ...a); } }, // 26 waves
    () => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) E(-.27 + i * .27, -.27 + j * .27, .08, (i + j) % 2 ? W : c2); }, // 27 dice
    () => { Pg(c2, 0, -.45, .25, -.1, .3, .2, 0, .42, -.3, .2, -.2, -.1); Pg(c1, 0, -.05, .12, .15, 0, .3, -.12, .15); },        // 28 flame
    () => { Pg(c2, -.4, .3, -.4, -.25, -.2, 0, 0, -.35, .2, 0, .4, -.25, .4, .3); E(0, .08, .07, K); },                         // 29 crown
    () => { for (let i = 0; i < 6; i++) Ln(.09, c2, -.9 + i * .3, .6, .3 + i * .3, -.6); },                                   // 30 diagonal stripes
    () => { for (let i = 0; i < 4; i++) { const r = .46 - i * .12; Ln(.05, i % 2 ? W : c2, -r, -r, r, -r, r, r, -r, r, -r, -r); } }, // 31 nested squares
    () => { for (let j = 0; j < 3; j++) { const a = []; for (let i = 0; i <= 8; i++) a.push(-.5 + i * .125, -.3 + j * .3 + (i % 2 ? .08 : -.08)); Ln(.07, c2, ...a); } }, // 32 zigzag
    () => { for (let i = 0; i < 3; i++) { F(-.5, -.4 + i * .3, 1, .1); F(-.4 + i * .3, -.5, .1, 1, W); } },                     // 33 plaid
    () => { const a = []; for (let i = 0; i <= 40; i++) { const t = i * .4, r = .03 + i * .0095; a.push(Math.cos(t) * r, Math.sin(t) * r); } Ln(.06, c2, ...a); }, // 34 spiral
    () => { F(-.5, -.5, .28, .28); F(.22, -.5, .28, .28); F(-.5, .22, .28, .28); F(.22, .22, .28, .28); E(0, 0, .1, W); },     // 35 corner squares
    () => { for (let i = -2; i <= 2; i++) { Ln(.05, c2, i * .25 - .5, -.5, i * .25 + .5, .5); Ln(.05, c2, i * .25 + .5, -.5, i * .25 - .5, .5); } }, // 36 lattice
    () => { [.3, .6, .9, .5, .75].forEach((h, i) => F(-.45 + i * .19, .5 - h * .9, .14, h * .9)); },                           // 37 equalizer
    () => { E(-.17, -.12, .07, K); E(.17, -.12, .07, K); Ln(.06, K, -.25, .1, -.1, .25, .1, .25, .25, .1); },                  // 38 smile
    () => { c.fillStyle = c2; c.beginPath(); c.arc(0, 0, .4 * s, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill(); E(0, -.2, .1, c1); E(0, .2, .1, c2); } // 39 split disc
  ];
  c.save(); c.lineJoin = 'round'; rr(c, -h, -h, s, s, s * .2); c.fillStyle = c1; c.fill(); c.save(); c.clip();
  D[((skin % 40) + 40) % 40](); c.restore(); rr(c, -h + lw / 2, -h + lw / 2, s - lw, s - lw, s * .2); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke(); c.restore();
}
function drawBall(c, idx, c1, c2, s) {
  const r = s * .5, lw = Math.max(1.5, s * .07), K = '#111', W = '#fff';
  const F = (x, y, w, h, col = c2) => { c.fillStyle = col; c.fillRect(x * s, y * s, w * s, h * s); };
  const E = (x, y, d, col = c2) => { c.fillStyle = col; c.beginPath(); c.arc(x * s, y * s, d * s, 0, 7); c.fill(); };
  const Ln = (w, col, ...a) => { c.strokeStyle = col; c.lineWidth = w * s; c.lineCap = 'round'; c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.stroke(); };
  const Pg = (col, ...a) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); c.fill(); };
  const Wd = (a0, a1, col = c2) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * .6, a0, a1); c.closePath(); c.fill(); };
  const D = [
    () => { F(-.5, -.09, 1, .18); F(-.09, -.5, .18, 1); E(0, 0, .14, K); },
    () => { F(-.5, -.34, 1, .14); F(-.5, -.07, 1, .14); F(-.5, .2, 1, .14); },
    () => { F(-.5, -.5, .5, .5); F(0, 0, .5, .5); },
    () => { E(0, -.22, .13); E(-.2, .14, .13); E(.2, .14, .13); },
    () => { F(-.5, -.5, .5, 1); E(.2, 0, .1, W); E(.2, 0, .05, K); },
    () => { c.fillStyle = c2; c.beginPath(); for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, d = i & 1 ? .15 : .38; c[i ? 'lineTo' : 'moveTo'](Math.cos(t) * d * s, Math.sin(t) * d * s); } c.fill(); },
    () => { E(0, 0, .4); E(0, 0, .3, c1); E(0, 0, .18); E(0, 0, .07, K); },
    () => { for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; Ln(.07, c2, 0, 0, Math.cos(t) * .5, Math.sin(t) * .5); } E(0, 0, .09, K); },
    () => { F(-.5, 0, 1, .5); E(0, .25, .12, c1); E(0, -.25, .12); },
    () => { E(0, 0, .3, W); E(.06, 0, .15, K); E(.1, -.04, .04, W); },
    () => { for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; E(Math.cos(t) * .36, Math.sin(t) * .36, .07); } E(0, 0, .1, K); },
    () => { Ln(.14, c2, -.5, -.1, .1, .5); Ln(.14, c2, -.2, -.5, .5, .2); },
    () => { E(0, 0, .42); E(0, 0, .3, c1); E(0, 0, .18); },
    () => { for (let i = -3; i <= 3; i++) F(i * .15 - .035, -.5, .07, 1); },
    () => { for (let i = -3; i <= 3; i++) Ln(.07, c2, i * .28 - .6, .6, i * .28 + .6, -.6); },
    () => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) E(-.28 + i * .28, -.28 + j * .28, .08); },
    () => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) & 1) F(-.5 + i * .25, -.5 + j * .25, .25, .25); },
    () => { const a = []; for (let i = 0; i <= 36; i++) { const t = i * .45, r = .02 + i * .011; a.push(Math.cos(t) * r, Math.sin(t) * r); } Ln(.07, c2, ...a); },
    () => { E(-.04, 0, .34); E(.1, -.04, .3, c1); },
    () => { F(0, -.5, .5, 1, K); E(-.2, 0, .06, W); },
    () => { for (let i = 0; i < 6; i += 2) Wd(i * Math.PI / 3, (i + 1) * Math.PI / 3); E(0, 0, .07, W); },
    () => { Wd(0, Math.PI / 2); Wd(Math.PI, Math.PI * 1.5); },
    () => { F(-.22, -.22, .44, .44); E(0, 0, .08, K); },
    () => { Ln(.14, c2, -.5, -.5, .5, .5); Ln(.14, c2, .5, -.5, -.5, .5); },
    () => { for (let j = -2; j <= 2; j++) { const a = []; for (let x = -.55; x <= .55; x += .1) a.push(x, j * .2 + Math.sin(x * 10) * .05); Ln(.06, c2, ...a); } },
    () => { Pg(c2, 0, -.38, .36, .26, -.36, .26); },
    () => { for (let i = 0; i < 4; i++) { const t = i * Math.PI / 2 + Math.PI / 4; E(Math.cos(t) * .3, Math.sin(t) * .3, .09); } E(0, 0, .1, K); },
    () => { for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; E(Math.cos(t) * .38, Math.sin(t) * .38, .05); } },
    () => { E(0, 0, .45); F(-.5, -.04, 1, .08, K); },
    () => { Wd(Math.PI / 2, Math.PI * 1.5); E(0, -.25, .25); E(0, .25, .25, c1); E(0, -.25, .07, c1); E(0, .25, .07); },
    () => { for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; Ln(.05, c2, Math.cos(t) * .15, Math.sin(t) * .15, Math.cos(t) * .55, Math.sin(t) * .55); } E(0, 0, .12, K); },
    () => { Pg(c2, 0, -.4, .4, 0, 0, .4, -.4, 0); Pg(c1, 0, -.2, .2, 0, 0, .2, -.2, 0); },
    () => { for (let i = -2; i <= 2; i++) { Ln(.04, c2, i * .22, -.55, i * .22, .55); Ln(.04, c2, -.55, i * .22, .55, i * .22); } },
    () => { E(-.1, -.1, .36); E(-.1, -.1, .22, c1); E(-.1, -.1, .1); },
    () => { Ln(.1, c2, -.3, -.35, 0, -.05, -.3, .25); Ln(.1, c2, .05, -.35, .35, -.05, .05, .25); },
    () => { for (let j = 0; j < 2; j++) { const a = []; for (let i = 0; i <= 8; i++) a.push(-.55 + i * .14, -.18 + j * .36 + (i & 1 ? .08 : -.08)); Ln(.07, c2, ...a); } },
    () => { [[-.25, -.2, .07], [.2, -.28, .05], [.05, 0, .08], [-.2, .22, .05], [.28, .18, .07], [-.05, -.38, .04], [.35, -.05, .04]].forEach(([x, y, r], i) => E(x, y, r, i % 2 ? W : c2)); },
    () => { Pg(c2, -.55, -.55, .55, -.55, -.55, .55); },
    () => { E(0, 0, .5); E(0, 0, .34, c1); E(0, 0, .14); },
    () => { for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; E(Math.cos(t) * .22, Math.sin(t) * .22, .17); } E(0, 0, .1, K); }
  ];
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = c1; c.fill(); c.save(); c.clip(); D[idx % 40](); c.restore();
  c.beginPath(); c.arc(0, 0, r - lw / 2, 0, 7); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke(); c.restore();
}
function drawUfo(c, cube, idx, c1, c2, s) {
  const k = idx % 40, lw = Math.max(1.5, s * .05), dot = (x, y, d, col) => { c.fillStyle = col; c.beginPath(); c.arc(x * s, y * s, d * s, 0, 7); c.fill(); };
  const poly = a => { c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); };
  c.save(); c.lineJoin = 'round'; c.save(); c.translate(0, -s * .2); drawIcon(c, cube, c1, c2, s * .5); c.restore();
  if (k === 0) { c.beginPath(); c.ellipse(0, s * .17, s * .52, s * .16, 0, 0, 7); }
  else if (k === 1) { c.beginPath(); c.ellipse(0, s * .2, s * .58, s * .1, 0, 0, 7); }
  else if (k === 2) { c.beginPath(); c.ellipse(0, s * .15, s * .42, s * .24, 0, 0, 7); }
  else if (k === 3) poly([-.55, .2, -.35, .2, -.25, .02, .25, .02, .35, .2, .55, .2, .35, .34, -.35, .34]);
  else if (k === 4) poly([-.52, .1, .52, .1, 0, .4]);
  else if (k === 5) rr(c, -.45 * s, .04 * s, .9 * s, .3 * s, .08 * s);
  else if (k === 6) poly([-.55, .17, 0, .02, .55, .17, 0, .34]);
  else if (k === 7) { c.beginPath(); c.ellipse(0, s * .12, s * .5, s * .13, 0, 0, 7); }
  else if (k === 8) { c.beginPath(); c.ellipse(0, s * .17, s * .52, s * .16, 0, 0, 7); }
  else if (k === 9) { c.beginPath(); c.moveTo(-.5 * s, .12 * s); c.lineTo(.5 * s, .12 * s); c.ellipse(0, .12 * s, .5 * s, .25 * s, 0, 0, Math.PI); c.closePath(); }
  else if (k === 10) { c.beginPath(); c.ellipse(0, s * .17, s * .5, s * .15, 0, 0, 7); }
  else if (k >= 12) { const q = (k - 12) % 7; if (q === 0) { c.beginPath(); c.ellipse(0, s * .18, s * .56, s * .12, 0, 0, 7); } else if (q === 1) { c.beginPath(); c.ellipse(0, s * .17, s * .36, s * .22, 0, 0, 7); } else if (q === 2) poly([-.5, .34, -.3, .04, .3, .04, .5, .34]); else if (q === 3) poly([-.55, .18, -.3, .04, .3, .04, .55, .18, .3, .32, -.3, .32]); else if (q === 4) rr(c, -.5 * s, .05 * s, s, .28 * s, .14 * s); else if (q === 5) poly([-.6, .2, -.4, .1, .4, .1, .6, .2, .4, .3, -.4, .3]); else rr(c, -.4 * s, .03 * s, .8 * s, .32 * s, .05 * s); }
  else poly([-.45, .04, .45, .04, .55, .2, .3, .34, -.3, .34, -.55, .2]);
  c.fillStyle = c2; c.fill(); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke();
  if (k === 0) [-.3, 0, .3].forEach(x => dot(x, .17, .04, c1));
  else if (k === 1) { c.fillStyle = c1; c.fillRect(-.5 * s, .18 * s, s, .04 * s); }
  else if (k === 2) { dot(-.15, .15, .06, c1); dot(.15, .15, .06, c1); }
  else if (k === 3) { dot(0, .2, .06, c1); dot(-.3, .27, .03, c1); dot(.3, .27, .03, c1); }
  else if (k === 4) dot(0, .17, .05, '#fff');
  else if (k === 5) { dot(-.2, .19, .07, c1); dot(.2, .19, .07, c1); }
  else if (k === 6) dot(0, .18, .08, c1);
  else if (k === 7) { c.strokeStyle = '#000'; c.lineWidth = lw; [-.3, 0, .3].forEach(x => { c.beginPath(); c.moveTo(x * s, .24 * s); c.lineTo(x * s, .4 * s); c.stroke(); }); }
  else if (k === 8) { c.strokeStyle = '#000'; c.lineWidth = lw * .8; c.beginPath(); c.moveTo(-.4 * s, .17 * s); c.lineTo(.4 * s, .17 * s); c.stroke(); }
  else if (k === 9) { c.strokeStyle = c1; c.lineWidth = lw; c.beginPath(); c.moveTo(-.3 * s, .22 * s); c.lineTo(.3 * s, .22 * s); c.stroke(); }
  else if (k === 10) [-.4, -.2, 0, .2, .4].forEach(x => { c.fillStyle = c1; poly([x - .05, .3, x + .05, .3, x, .4]); });
  else if (k >= 12) { const d = ((k - 12) / 7) | 0; if (d === 0) [-.3, 0, .3].forEach(x => dot(x, .19, .04, c1)); else if (d === 1) { c.fillStyle = c1; c.fillRect(-.45 * s, .17 * s, .9 * s, .05 * s); } else if (d === 2) { dot(-.2, .19, .045, '#fff'); dot(.2, .19, .045, '#fff'); c.strokeStyle = '#000'; c.lineWidth = lw * .8; c.beginPath(); c.moveTo(-.35 * s, .12 * s); c.lineTo(.35 * s, .12 * s); c.stroke(); } else [-.25, 0, .25].forEach(x => dot(x, .39, .035, c1)); }
  else { c.fillStyle = c1; c.beginPath(); c.ellipse(0, s * .38, s * .22, s * .05, 0, 0, 7); c.fill(); }
  c.restore();
}
const WV = [
  [-.5, -.38, .55, 0, -.5, .38, -.22, 0], [-.5, -.4, .55, 0, -.5, .4], [-.55, -.4, -.1, -.4, .55, 0, -.1, .4, -.55, .4, -.15, 0], [-.5, 0, 0, -.4, .55, 0, 0, .4],
  [-.5, -.25, .1, -.4, .55, 0, .1, .4, -.5, .25], [-.55, -.35, -.15, -.35, -.05, -.1, .55, 0, -.05, .1, -.15, .35, -.55, .35, -.35, 0], [-.5, -.45, .55, -.05, .15, 0, .55, .05, -.5, .45, -.3, 0], [-.55, -.4, -.3, 0, -.55, .4, .1, .3, .55, 0, .1, -.3],
  [-.5, -.4, .5, -.3, -.1, -.1, .55, 0, -.1, .1, .5, .3, -.5, .4, -.25, 0], [-.45, -.35, .2, -.4, .55, 0, .2, .4, -.45, .35], [-.55, 0, -.2, -.12, -.3, -.45, 0, -.2, .55, 0, 0, .2, -.3, .45, -.2, .12], [-.5, -.4, .3, -.4, .55, 0, .3, .4, -.5, .4, -.3, 0]
];
const WV2 = [
  [-.55, -.3, .1, -.3, .55, 0, .1, .3, -.55, .3], [-.5, -.45, .55, 0, -.5, .45], [-.55, -.2, -.1, -.4, .55, 0, -.1, .4, -.55, .2], [-.5, -.35, .05, -.35, .55, -.1, .55, .1, .05, .35, -.5, .35],
  [-.55, 0, -.2, -.4, .2, -.15, .55, 0, .2, .15, -.2, .4], [-.5, -.4, -.1, -.15, .55, -.15, .55, .15, -.1, .15, -.5, .4], [-.55, -.25, .55, 0, -.55, .25]
];
function drawWave(c, idx, c1, c2, s) {
  const a = idx < 12 ? WV[idx] : WV2[(idx - 12) % 7], poly = k => { c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s * k, a[i + 1] * s * k); c.closePath(); };
  c.save(); c.lineJoin = 'round'; poly(1); c.fillStyle = c1; c.fill(); c.strokeStyle = '#000'; c.lineWidth = Math.max(1.5, s * .08); c.stroke();
  const st = idx < 12 ? 0 : ((idx - 12) / 7) | 0;
  if (st === 0) { c.translate(-s * .05, 0); poly(.5); c.fillStyle = c2; c.fill(); }
  else if (st === 1) { c.save(); poly(1); c.clip(); c.fillStyle = c2; c.fillRect(-s, -.07 * s, 2 * s, .14 * s); c.restore(); }
  else if (st === 2) { c.fillStyle = c2; [-.25, 0, .25].forEach(x => { c.beginPath(); c.arc(x * s, 0, .07 * s, 0, 7); c.fill(); }); }
  else { c.save(); poly(1); c.clip(); c.fillStyle = c2; c.fillRect(-s, 0, 2 * s, s); c.restore(); poly(1); c.strokeStyle = '#000'; c.lineWidth = Math.max(1.5, s * .08); c.stroke(); }
  c.restore();
}
function drawRobot(c, idx, c1, c2, s, ph = 0, air = false) {
  const kk = ((idx % 40) + 40) % 40, m = kk - 12, nw = kk >= 12, k = nw ? 0 : kk, bd = nw ? 1 + m % 4 : 0, ey = nw ? 3 + ((m / 4) | 0) : k % 4, tp = nw ? (m >> 2) % 3 : k % 3, ac = nw ? (m >> 1) % 3 : k >> 2, lw = Math.max(1.5, s * .06), K = '#14141c';
  const seg = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0 * s, y0 * s); c.lineTo(x1 * s, y1 * s); c.stroke(); };
  const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); };
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  [[-.2, 0], [.2, Math.PI]].forEach(([hx, off]) => {   // legs (swing while running, tuck in the air)
    const a = air ? (hx < 0 ? -.55 : .5) : Math.sin(ph + off) * .75, b = air ? (hx < 0 ? .9 : -.2) : -a * .6 + .35 + Math.max(0, Math.cos(ph + off)) * .45;
    const kx = hx + Math.sin(a) * .19, ky = .1 + Math.cos(a) * .19, fx = kx + Math.sin(b) * .2, fy = ky + Math.cos(b) * .2;
    seg(hx, .1, kx, ky, lw * 2.5, '#000'); seg(kx, ky, fx, fy, lw * 2.5, '#000'); seg(hx, .1, kx, ky, lw * 1.2, c2); seg(kx, ky, fx, fy, lw * 1.2, c2);
    c.fillStyle = c1; c.strokeStyle = '#000'; c.lineWidth = lw * .8; c.beginPath(); c.rect((fx - .02) * s, (fy - .03) * s, .12 * s, .06 * s); c.fill(); c.stroke();
  });
  if (tp === 0) { seg(0, -.42, .06, -.5, lw * 1.2, '#000'); dot(.06, -.5, .04, c2); }
  else if (tp === 1) [[-.46, -.3], [.38, -.3]].forEach(([x, y]) => { rr(c, x * s, y * s, .08 * s, .2 * s, .03 * s); c.fillStyle = c2; c.fill(); c.strokeStyle = '#000'; c.lineWidth = lw * .8; c.stroke(); });
  else { rr(c, -.18 * s, -.5 * s, .36 * s, .09 * s, .03 * s); c.fillStyle = c2; c.fill(); c.strokeStyle = '#000'; c.lineWidth = lw * .8; c.stroke(); }
  c.fillStyle = c1; c.strokeStyle = '#000'; c.lineWidth = lw;
  if (bd === 2) { const pts = [-.3, -.42, .3, -.42, .4, -.3, .4, 0, .3, .1, -.3, .1, -.4, 0, -.4, -.3]; c.beginPath(); for (let i = 0; i < pts.length; i += 2) c[i ? 'lineTo' : 'moveTo'](pts[i] * s, pts[i + 1] * s); c.closePath(); }
  else rr(c, -.4 * s, -.42 * s, .8 * s, .52 * s, (bd === 1 ? .22 : bd === 3 ? .03 : bd === 4 ? .16 : .1) * s);
  c.fill(); c.stroke(); c.fillStyle = c2; if (bd === 3) c.fillRect(-.37 * s, -.4 * s, .74 * s, .07 * s); else if (bd === 4) c.fillRect(-.4 * s, -.1 * s, .8 * s, .05 * s);
  rr(c, -.3 * s, -.34 * s, .6 * s, .24 * s, .06 * s); c.fillStyle = K; c.fill();
  c.fillStyle = c2;
  if (ey === 0) c.fillRect(-.23 * s, -.25 * s, .46 * s, .06 * s);
  else if (ey === 1) { c.fillRect(-.22 * s, -.3 * s, .13 * s, .13 * s); c.fillRect(.09 * s, -.3 * s, .13 * s, .13 * s); }
  else if (ey === 2) { dot(0, -.22, .09, c2); dot(0, -.22, .04, K); }
  else if (ey === 3) { dot(-.13, -.22, .07, c2); dot(.13, -.22, .07, c2); }
  else if (ey === 4) [-.3, -.23, -.16].forEach(y => c.fillRect(-.22 * s, y * s, .44 * s, .04 * s));
  else if (ey === 5) { c.beginPath(); c.moveTo(0, -.32 * s); c.lineTo(.1 * s, -.22 * s); c.lineTo(0, -.12 * s); c.lineTo(-.1 * s, -.22 * s); c.closePath(); c.fill(); }
  else if (ey === 6) { c.strokeStyle = c2; c.lineWidth = lw * .9; c.beginPath(); for (let i = 0; i <= 10; i++) c[i ? 'lineTo' : 'moveTo']((-.22 + i * .044) * s, (-.22 + (i & 1 ? .05 : -.05)) * s); c.stroke(); }
  else if (ey === 7) [-.15, 0, .15].forEach(x => [-.28, -.16].forEach(y => dot(x, y, .03, c2)));
  else if (ey === 8) { c.fillRect(-.14 * s, -.24 * s, .28 * s, .05 * s); c.fillRect(-.025 * s, -.32 * s, .05 * s, .2 * s); }
  else { c.strokeStyle = c2; c.lineWidth = lw * .8; c.beginPath(); c.arc(0, -.22 * s, .08 * s, 0, 7); c.stroke(); }
  if (ac === 0) [-.1, 0, .1].forEach(x => seg(x, -.04, x, .05, lw * .8, '#000'));
  else if (ac === 1) { c.fillStyle = c2; c.fillRect(-.3 * s, -.04 * s, .6 * s, .05 * s); }
  else [-.14, 0, .14].forEach(x => dot(x, .0, .03, c2));
  c.restore();
}
function drawSpider(c, idx, c1, c2, s, ph = 0, air = false) {
  const kk = ((idx % 40) + 40) % 40, m = kk - 12, nw = kk >= 12, k = nw ? 0 : kk, lgv = nw ? 1 + m % 4 : 0, bs = nw ? (m >> 1) % 6 : k % 3, ee = nw ? 3 + ((m / 4) | 0) : k % 4, mk = nw ? (m >> 2) % 3 : k >> 2, lw = Math.max(1.5, s * .06), K = '#14141c';
  const line = (a, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.stroke(); };
  const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x * s, y * s, r * s, 0, 7); c.fill(); };
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  [-1, 1].forEach(sg => [0, 1, 2].forEach(i => {   // 3 legs per side, walking cycle on the ground, splayed out in the air
    const hx = sg * (.08 + i * .05), sw = Math.sin(ph * 1.3 + i * 1.7 + (sg > 0 ? Math.PI : 0)), lift = air ? 0 : Math.max(0, sw);
    const kx = hx + sg * (.14 + i * .03), ky = -.24 + i * .06;
    const fx = air ? hx + sg * (.26 + i * .03) : hx + sg * (.2 + i * .04) + sw * .035, fy = air ? .22 + i * .1 : .46 - lift * .1;
    const a = lgv === 4 ? [hx, 0, kx, ky] : [hx, 0, kx, ky, fx, fy]; line(a, lw * (lgv === 1 ? 3.2 : 2.3), '#000'); line(a, lw * (lgv === 1 ? 1.6 : 1.0), lgv === 2 ? c1 : c2); if (lgv === 3) dot(fx, fy, .035, c2);
  }));
  c.fillStyle = c1; c.strokeStyle = '#000'; c.lineWidth = lw; c.beginPath();
  if (bs === 0) c.arc(0, -.02 * s, .26 * s, 0, 7);
  else if (bs === 1) c.ellipse(0, -.02 * s, .33 * s, .24 * s, 0, 0, 7);
  else if (bs === 2) for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](Math.cos(t) * .29 * s, (-.02 + Math.sin(t) * .27) * s); }
  else if (bs === 3) { c.moveTo(0, -.3 * s); c.lineTo(.32 * s, -.02 * s); c.lineTo(0, .26 * s); c.lineTo(-.32 * s, -.02 * s); }
  else if (bs === 4) c.rect(-.27 * s, -.27 * s, .54 * s, .5 * s);
  else for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4 + Math.PI / 8; c[i ? 'lineTo' : 'moveTo'](Math.cos(t) * .3 * s, (-.02 + Math.sin(t) * .28) * s); }
  c.closePath(); c.fill(); c.stroke();
  if (mk === 0) { c.fillStyle = c2; c.beginPath(); c.ellipse(0, .12 * s, .1 * s, .06 * s, 0, 0, 7); c.fill(); }
  else if (mk === 1) [-.12, 0, .12].forEach(x => dot(x, -.19 + Math.abs(x) * .3, .035, c2));
  else line([-.2, .1, .2, .1], lw * 1.5, c2);
  const eye = (x, y, r) => { dot(x, y, r, '#fff'); dot(x, y + r * .15, r * .5, K); };
  if (ee === 0) { eye(-.1, -.06, .075); eye(.1, -.06, .075); }
  else if (ee === 1) { eye(-.1, -.03, .065); eye(.1, -.03, .065); eye(-.05, -.15, .04); eye(.05, -.15, .04); }
  else if (ee === 2) eye(0, -.04, .12);
  else if (ee === 3) { eye(-.12, -.03, .06); eye(.12, -.03, .06); eye(0, -.14, .05); }
  else if (ee === 4) { c.fillStyle = c2; c.beginPath(); c.moveTo(0, -.14 * s); c.lineTo(.1 * s, -.04 * s); c.lineTo(0, .06 * s); c.lineTo(-.1 * s, -.04 * s); c.closePath(); c.fill(); }
  else if (ee === 5) [-.1, 0, .1].forEach(x => line([x, -.14, x, .04], lw * 1.1, c2));
  else if (ee === 6) { c.strokeStyle = c2; c.lineWidth = lw * .9; c.beginPath(); c.arc(0, -.04 * s, .1 * s, 0, 7); c.stroke(); }
  else if (ee === 7) { dot(0, -.12, .04, c2); dot(-.08, 0, .04, c2); dot(.08, 0, .04, c2); }
  else if (ee === 8) { line([-.1, -.04, .1, -.04], lw * 1.2, c2); line([0, -.14, 0, .06], lw * 1.2, c2); }
  else { dot(0, -.04, .1, c2); dot(.04, -.06, .09, c1); }
  if (mk === 2) { c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = lw * .5; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * .03 * s, .06 * s); c.lineTo(sg * .09 * s, .06 * s); c.lineTo(sg * .06 * s, .15 * s); c.closePath(); c.fill(); c.stroke(); }); }
  c.restore();
}
const SHIPS = [
  [-.5, .3, -.4, .04, .35, .04, .55, .2, .4, .3], [-.55, .1, -.25, .1, -.1, .02, .2, .02, .55, .22, .2, .32, -.3, .32], [-.55, .05, .55, .18, -.55, .3, -.35, .18], [-.5, .32, -.5, .1, .55, .24, .55, .32],
  [-.5, .06, .5, .06, .5, .3, -.5, .3], [-.55, .12, -.4, .04, .2, .04, .55, .18, .2, .32, -.4, .32], [-.5, .04, .55, .18, -.5, .32, -.3, .18], [-.45, .32, -.3, .04, .3, .04, .5, .32],
  [-.5, .1, .5, .1, .3, .32, -.3, .32], [-.55, .04, -.3, .18, -.55, .32, 0, .28, .55, .18, 0, .08], [-.55, .05, -.2, .14, 0, .04, .2, .14, .55, .05, .3, .32, -.3, .32], [-.3, .04, .3, .04, .55, .18, .3, .32, -.3, .32, -.55, .18],
  [-.5, .18, -.2, .04, .2, .04, .4, .14, .58, .18, .4, .22, .2, .32, -.2, .32], [-.55, .2, -.15, .2, -.3, .02, -.1, .02, .1, .2, .55, .2, .1, .32, -.45, .32], [-.5, .32, 0, .02, .5, .32], [-.55, .18, 0, .02, .55, .18, 0, .32],
  [-.5, .32, -.5, .2, -.2, .2, -.2, .1, .2, .1, .2, .02, .55, .02, .55, .32], [-.45, .07, .45, .07, .55, .18, .45, .3, -.45, .3, -.55, .18], [-.55, .04, .2, .04, .55, .2, .3, .3, .3, .18, -.55, .18], [-.5, .3, -.5, .1, -.3, .2, -.15, .02, 0, .2, .15, .02, .3, .2, .5, .1, .5, .3],
  [-.55, .3, -.55, .12, -.3, .04, .3, .04, .58, .2, .58, .3], [-.4, .18, .1, .02, .55, .18, .1, .32], [-.55, .32, .55, .32, .55, .1, -.1, .1, -.55, .04], [-.55, .1, -.2, .28, .2, .28, .55, .1, .4, .04, .15, .2, -.15, .2, -.4, .04],
  [-.55, .04, .5, .04, .58, .18, .5, .32, -.55, .32, -.3, .18], [-.5, .04, .5, .04, .55, .1, -.1, .14, .55, .26, .5, .32, -.5, .32], [-.5, .04, .5, .04, .5, .18, 0, .34, -.5, .18], [-.5, .04, .5, .04, .5, .2, .35, .32, .2, .2, .05, .32, -.1, .2, -.25, .32, -.4, .2, -.5, .2],
  [-.55, .32, -.45, .04, -.25, .18, -.05, .02, .15, .18, .35, .06, .55, .32], [-.55, .18, -.2, .04, .2, .04, .55, .18, .2, .32, -.2, .32],
  [-.5, .3, -.5, .1, -.2, .04, .4, .04, .58, .2, .4, .32], [-.55, .2, -.3, .04, .1, .04, .3, .14, .58, .14, .58, .26, .3, .26, .1, .32, -.3, .32], [-.5, .04, .5, .04, .58, .32, -.58, .32], [-.55, .18, -.35, .04, .35, .04, .55, .18, .35, .32, -.35, .32],
  [-.5, .3, -.3, .04, 0, .2, .3, .04, .5, .3], [-.55, .1, .1, .04, .55, .18, .1, .32, -.55, .26], [-.5, .04, .3, .04, .55, .32, -.5, .32], [-.45, .32, -.55, .18, -.45, .04, .45, .04, .55, .18, .45, .32],
  [-.55, .04, .55, .04, .55, .1, .3, .32, .1, .1, -.1, .32, -.3, .1, -.55, .32], [-.5, .18, -.3, .04, 0, .12, .3, .04, .55, .18, .3, .32, 0, .24, -.3, .32]
];
function hull(c, k, s) { c.beginPath(); const a = SHIPS[k % 40]; for (let i = 0; i < a.length; i += 2) c[i ? 'lineTo' : 'moveTo'](a[i] * s, a[i + 1] * s); c.closePath(); }
function drawShip(c, cube, ship, c1, c2, s) {
  const k = ((ship % 40) + 40) % 40, p = k % 6, lw = Math.max(1.5, s * .05);
  c.save(); c.translate(0, -s * .05); c.lineJoin = 'round';
  c.save(); c.translate(0, -s * .13); drawIcon(c, cube, c1, c2, s * .55); c.restore();
  c.fillStyle = '#ffb020'; c.beginPath(); c.moveTo(-.5 * s, .12 * s); c.lineTo(-.7 * s, .17 * s); c.lineTo(-.5 * s, .22 * s); c.fill();
  hull(c, k, s); c.fillStyle = c2; c.fill(); c.save(); c.clip(); c.fillStyle = c1;
  if (p === 0) c.fillRect(-s, .14 * s, 2 * s, .06 * s);
  else if (p === 1) [-.2, 0, .2].forEach(x => { c.beginPath(); c.arc(x * s, .17 * s, .035 * s, 0, 7); c.fill(); });
  else if (p === 2) c.fillRect(-s, 0, .75 * s, s);
  else if (p === 3) c.fillRect(.3 * s, 0, s, s);
  else if (p === 4) { c.fillRect(-s, .26 * s, 2 * s, .07 * s); c.beginPath(); c.arc(.1 * s, .12 * s, .04 * s, 0, 7); c.fill(); }
  else { c.beginPath(); c.arc(.05 * s, .17 * s, .07 * s, 0, 7); c.fill(); }
  c.restore(); hull(c, k, s); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke(); c.restore();
}
const ICACHE = {};
function shipURL(ship, cube, c1, c2, size = 64) {
  const key = ['ship', ship, cube, c1, c2, size].join('|'); if (ICACHE[key]) return ICACHE[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.translate(size / 2, size / 2); drawShip(x, cube, ship, c1, c2, size * .8); return ICACHE[key] = cv.toDataURL();
}
const urlOf = (key, size, draw) => { if (ICACHE[key]) return ICACHE[key]; const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); x.translate(size / 2, size / 2); draw(x); return ICACHE[key] = cv.toDataURL(); };
const ballURL = (i, c1, c2, size = 64) => urlOf(['ball', i, c1, c2, size].join('|'), size, x => drawBall(x, i, c1, c2, size * .84));
const ufoURL = (i, cube, c1, c2, size = 64) => urlOf(['ufo', i, cube, c1, c2, size].join('|'), size, x => drawUfo(x, cube, i, c1, c2, size * .9));
const waveURL = (i, c1, c2, size = 64) => urlOf(['wave', i, c1, c2, size].join('|'), size, x => drawWave(x, i, c1, c2, size * .8));
const robotURL = (i, c1, c2, size = 64) => urlOf(['robot', i, c1, c2, size].join('|'), size, x => drawRobot(x, i, c1, c2, size * .84, 1.1, false));
const spiderURL = (i, c1, c2, size = 64) => urlOf(['spider', i, c1, c2, size].join('|'), size, x => drawSpider(x, i, c1, c2, size * .84, .8, false));
function skinURL(skin, c1, c2, size = 64) {
  const k = [skin, c1, c2, size].join('|'); if (ICACHE[k]) return ICACHE[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  x.translate(size / 2, size / 2); drawIcon(x, skin, c1, c2, size * .84); return ICACHE[k] = cv.toDataURL();
}
function diffURL(id, size = 64) {
  if (id === 'demon') id = 'hdemon';
  const k = 'd' + id + size; if (ICACHE[k]) return ICACHE[k];
  const d = DIFFS.find(x => x.id === id) || DIFFS[0], n = d.stars, s = size;
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d');
  c.translate(s / 2, s / 2); c.lineJoin = 'round'; c.lineCap = 'round';
  if (n >= 6) { c.translate(0, s * .1); c.scale(.8, .8); }       // demons are drawn a bit smaller so the horns fit
  c.lineWidth = s * .06; c.strokeStyle = '#000';
  if (n >= 6) {   // horns: [tipX, tipY, outer ctrl X, outer ctrl Y, inner ctrl X, inner ctrl Y, color]
    const [tx, ty, cx, cy, ix, iy, hc] = { 6: [.3, -.46, .4, -.3, .2, -.4, '#6b2fb0'], 7: [.34, -.52, .46, -.34, .22, -.44, '#b0306e'], 8: [.42, -.55, .44, -.3, .24, -.4, '#7d0f1a'], 9: [.3, -.62, .58, -.42, .22, -.46, '#4a0008'], 10: [.15, -.7, .64, -.46, .2, -.5, '#1c0004'] }[n];
    c.fillStyle = hc;
    [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * .34, -s * .12); c.quadraticCurveTo(sg * cx * s, cy * s, sg * tx * s, ty * s); c.quadraticCurveTo(sg * ix * s, iy * s, sg * s * .12, -s * .32); c.closePath(); c.fill(); c.stroke(); });
  }
  if (n === 10) { const g = c.createRadialGradient(0, -s * .06, s * .03, 0, 0, s * .4); g.addColorStop(0, '#c00020'); g.addColorStop(1, '#2e0008'); c.fillStyle = g; } else c.fillStyle = d.col;
  c.beginPath(); c.arc(0, 0, s * .36, 0, 7); c.fill(); c.stroke();
  if (n === 10) { c.save(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = s * .03; [-1, 1].forEach(sg => [0, 1].forEach(i => { c.beginPath(); c.moveTo(sg * s * (.2 + i * .06), s * (.0 + i * .02)); c.lineTo(sg * s * (.3 + i * .04), s * (.16 + i * .02)); c.stroke(); })); c.restore(); }
  const brow = (w, ya, yb) => { c.save(); c.lineWidth = s * w; c.strokeStyle = '#000'; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * .29, ya * s); c.lineTo(sg * s * .04, yb * s); c.stroke(); }); c.restore(); };
  const rect = (x, y, w, h) => { c.fillStyle = '#000'; c.fillRect(x * s, y * s, w * s, h * s); c.fillRect(-(x + w) * s, y * s, w * s, h * s); };
  const dots = (y, r) => { c.fillStyle = '#000'; c.beginPath(); c.arc(-s * .13, y * s, r * s, 0, 7); c.arc(s * .13, y * s, r * s, 0, 7); c.fill(); };
  const slit = col => { c.save(); if (n === 10) { c.shadowColor = '#ff7a00'; c.shadowBlur = s * .1; } c.fillStyle = col; c.lineWidth = s * .025; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * .26, -s * .14); c.lineTo(sg * s * .05, -s * .05); c.lineTo(sg * s * .09, s * .01); c.lineTo(sg * s * .25, -s * .07); c.closePath(); c.fill(); c.stroke(); }); c.restore(); };
  const fangs = (x, w, h, y = .14) => { c.fillStyle = '#fff'; c.lineWidth = s * .02; [-1, 1].forEach(sg => { c.beginPath(); c.moveTo(sg * s * x, y * s); c.lineTo(sg * s * (x + w), y * s); c.lineTo(sg * s * (x + w / 2), (y + h) * s); c.closePath(); c.fill(); c.stroke(); }); };
  const grin = (w, top, bot) => {   // wide evil grin with jagged teeth
    const Q = (t, y0, cy) => [(2 * t - 1) * w * s, ((1 - t) * (1 - t) * .08 + 2 * (1 - t) * t * cy + t * t * .08) * s];
    c.beginPath(); c.moveTo(-w * s, .08 * s); c.quadraticCurveTo(0, .2 * s, w * s, .08 * s); c.quadraticCurveTo(0, .38 * s, -w * s, .08 * s); c.closePath(); c.fillStyle = '#000'; c.fill();
    c.fillStyle = '#fff';
    for (let i = 1; i <= top; i++) { const [x, y] = Q(i / (top + 1), .08, .2); c.beginPath(); c.moveTo(x - s * .03, y); c.lineTo(x + s * .03, y); c.lineTo(x, y + s * .075); c.fill(); }
    for (let i = 1; i <= bot; i++) { const [x, y] = Q(i / (bot + 1), .08, .38); c.beginPath(); c.moveTo(x - s * .03, y); c.lineTo(x + s * .03, y); c.lineTo(x, y - s * .07); c.fill(); }
  };
  // eyes + brows
  if (n <= 2) dots(-.08, .05);
  else if (n === 3 || n === 4 || n === 8) rect(.06, -.12, .14, .1);
  else if (n === 5) { rect(.06, -.09, .14, .09); brow(.075, -.27, -.09); }
  else if (n === 6) dots(-.08, .055);
  else if (n === 7) { rect(.07, -.1, .12, .09); brow(.05, -.24, -.14); }
  else if (n === 9) { slit('#ffe21f'); brow(.085, -.31, -.08); }
  else { slit('#fff2a0'); brow(.1, -.36, -.06); }
  // mouth
  c.strokeStyle = '#000'; c.lineWidth = s * .05; c.beginPath();
  if (n === 1) { c.arc(0, s * .02, s * .17, .15, Math.PI - .15); c.stroke(); }
  else if (n === 2) { c.arc(0, s * .05, s * .12, .25, Math.PI - .25); c.stroke(); }
  else if (n === 3) { c.moveTo(-s * .12, s * .14); c.lineTo(s * .12, s * .14); c.stroke(); }
  else if (n === 4) { c.arc(0, s * .24, s * .13, Math.PI + .3, -.3); c.stroke(); }
  else if (n === 5) { c.lineWidth = s * .065; c.arc(0, s * .27, s * .16, Math.PI + .22, -.22); c.stroke(); }
  else if (n === 6) { c.arc(0, s * .04, s * .14, .2, Math.PI - .2); c.stroke(); fangs(.09, .05, .1, .12); }
  else if (n === 7) { c.moveTo(-s * .14, s * .15); c.lineTo(0, s * .16); c.lineTo(s * .14, s * .1); c.stroke(); fangs(.05, .05, .09, .15); }
  else if (n === 8) { c.arc(0, s * .24, s * .13, Math.PI + .3, -.3); c.stroke(); fangs(.06, .06, .1); }
  else if (n === 9) grin(.22, 4, 3);
  else grin(.27, 6, 5);
  return ICACHE[k] = cv.toDataURL();
}

// ---------- object drawing (x,y = top-left of the cell on screen, cs = cell px) ----------
function drawNx(c, d, cs, col, time) {   // origin = cell centre
  const k = d.nx, h = cs / 2;
  if (k === 'sq') { c.fillStyle = col; c.fillRect(-h - .4, -h - .4, cs + .8, cs + .8); }
  else if (k === 'tri') { c.fillStyle = col; c.beginPath(); c.moveTo(-h - .4, h + .4); c.lineTo(h + .4, h + .4); c.lineTo(h + .4, -h - .4); c.closePath(); c.fill(); }
  else if (k === 'tri2') { c.fillStyle = col; c.beginPath(); c.moveTo(-h - .4, h + .4); c.lineTo(h + .4, h + .4); c.lineTo(0, -h); c.closePath(); c.fill(); }
  else {
    const [r, g, b] = hex2rgb(col), A = c.globalAlpha, pul = .92 + .08 * Math.sin(time * 3); c.globalCompositeOperation = 'lighter';
    if (k === 'gb') {
      const R = d.gr * cs * pul, gr = c.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)},${.95 * A})`); gr.addColorStop(.3, `rgba(${r},${g},${b},${.55 * A})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    } else {   // line
      c.lineCap = 'round'; const seg = (w, a, col2) => { c.globalAlpha = A * a; c.strokeStyle = col2; c.lineWidth = w; c.beginPath(); c.moveTo(-h, 0); c.lineTo(h, 0); c.stroke(); };
      const rg = `rgb(${r},${g},${b})`; seg(cs * .55, .10, rg); seg(cs * .34, .2, rg); seg(cs * .18, .45, rg); seg(Math.max(1, cs * .07), .95, `rgb(${Math.min(255, r + 130)},${Math.min(255, g + 130)},${Math.min(255, b + 130)})`);
    }
    c.globalAlpha = A; c.globalCompositeOperation = 'source-over';
  }
}
function drawObj(c, o, x, y, cs, col, ed, time = 0) {
  if (OBJ[o.t].base) { c.save(); c.globalAlpha *= .4; drawObj(c, { ...o, t: OBJ[o.t].base }, x, y, cs, col, ed, time); c.restore(); return; }   // faded block: the real block drawn see-through
  const t = o.t, r = (o.r || 0) + (o.r45 ? .5 : 0), lw = Math.max(1, cs * .07);
  c.save(); c.lineJoin = 'round';
  if (o.sc && o.sc !== 1) { const sy = t.startsWith('port') ? y - cs / 2 : y + cs / 2; c.translate(x + cs / 2, sy); c.scale(o.sc, o.sc); c.translate(-(x + cs / 2), -sy); }
  if (o.alp != null && o.alp !== 1) c.globalAlpha *= o.alp;
  const A0 = c.globalAlpha;   // base alpha (fade-in x alpha trigger); effects below multiply it instead of resetting to 1
  if (OBJ[t].hz) hzDraw(c, OBJ[t].hz, o, x, y, cs, col, lw, time);
  else if (OBJ[t].deco && OBJ[t].nx) { c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2); drawNx(c, OBJ[t], cs, col, time); }
  else if (OBJ[t].deco) { c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2); c.translate(-cs / 2, -cs / 2); decor(c, OBJ[t].dk, cs, col); }
  else if (OBJ[t].bs !== undefined) blockDraw(c, OBJ[t].bs, x, y, cs, col, lw);
  else if (t === 'block') blockDraw(c, 0, x, y, cs, col, lw);
  else if (t === 'half' || OBJ[t].slope) {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2); c.fillStyle = col;
    if (t === 'half') { c.fillRect(-cs / 2, 0, cs, cs / 2); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-cs / 2, 0, cs, cs * .12); c.beginPath(); c.rect(-cs / 2 + lw * .3, lw * .3, cs - lw * .6, cs / 2 - lw * .6); glow(c, lw); }
    else if (OBJ[t].tall) {   // 1 wide x 2 tall right triangle: the anchor cell plus the cell above it. r = which corner is filled (0 lower-right, 1 lower-left, 2 upper-left, 3 upper-right); it never lies on its side
      c.rotate(-r * Math.PI / 2); const L = -cs / 2, R = cs / 2, B = cs / 2, T = -cs * 1.5, ri = Math.round(r) & 3;
      const V = [[[L, B], [R, B], [R, T]], [[L, B], [R, B], [L, T]], [[L, T], [R, T], [L, B]], [[L, T], [R, T], [R, B]]][ri];
      c.beginPath(); c.moveTo(...V[0]); c.lineTo(...V[1]); c.lineTo(...V[2]); c.closePath(); c.fill(); glow(c, lw);
      if (OBJ[t].slide) { const [a, b] = [[0, 2], [2, 1], [1, 2], [0, 2]][ri]; c.beginPath(); c.moveTo(...V[a]); c.lineTo(...V[b]); c.strokeStyle = '#2fe6ff'; c.lineWidth = lw * 2; c.lineCap = 'round'; c.stroke(); }
    }
    else { c.beginPath(); c.moveTo(-cs / 2, cs / 2); c.lineTo(cs / 2, cs / 2); c.lineTo(cs / 2, -cs / 2); c.closePath(); c.fill(); glow(c, lw); if (OBJ[t].slide) { c.beginPath(); c.moveTo(-cs / 2, cs / 2); c.lineTo(cs / 2, -cs / 2); c.strokeStyle = '#2fe6ff'; c.lineWidth = lw * 2; c.lineCap = 'round'; c.stroke(); } }   // plain 45-45-90 right triangle filling the cell's lower-right half (slide slopes get a cyan glide edge along the hypotenuse)
  } else if (ORBS.includes(t)) {
    const cl = ORBCOL[t], cx = x + cs / 2, cy = y + cs / 2, pu = 1 + Math.sin(time * 6) * .07;
    c.beginPath(); c.arc(cx, cy, cs * .46 * pu, 0, 7); c.strokeStyle = cl; c.globalAlpha = A0 * .55; c.lineWidth = lw; c.stroke(); c.globalAlpha = A0;
    c.beginPath(); c.arc(cx, cy, cs * .26, 0, 7); c.fillStyle = cl; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
    if (DASH[t]) { c.save(); c.translate(cx, cy); c.rotate(-(o.a || 0) * Math.PI / 180); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-cs * .14, -cs * .08); c.lineTo(cs * .02, -cs * .08); c.lineTo(cs * .02, -cs * .17); c.lineTo(cs * .17, 0); c.lineTo(cs * .02, cs * .17); c.lineTo(cs * .02, cs * .08); c.lineTo(-cs * .14, cs * .08); c.closePath(); c.fill(); c.restore(); }
    if (t === 'orb_r') { c.beginPath(); c.arc(cx, cy, cs * .12, 0, 7); c.fillStyle = '#ffb0b0'; c.fill(); }
  } else if (PADS.includes(t)) {
    c.translate(x + cs / 2, y + cs / 2); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.moveTo(-cs * .42, cs / 2); c.quadraticCurveTo(0, cs * .05, cs * .42, cs / 2); c.closePath();
    c.fillStyle = PADCOL[t]; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw; c.stroke();
  } else if (SPEEDS[t] || GRAV[t] || MODEP[t] || REVP[t] || SZP[t]) {
    const cl = PORT_COL[t], pcx = x + cs / 2, pcy = y - cs / 2;   // centre of the 3-cell stack
    c.translate(pcx, pcy); c.rotate(r * Math.PI / 2);
    c.beginPath(); c.ellipse(0, 0, cs * .34, cs * PH / 2, 0, 0, 7); c.fillStyle = cl; c.globalAlpha = A0 * .22; c.fill(); c.globalAlpha = A0;
    c.strokeStyle = cl; c.lineWidth = lw * 1.6; c.stroke();
    c.rotate(-r * Math.PI / 2);
    c.fillStyle = '#fff'; c.font = `bold ${cs * (SZP[t] ? .36 : .5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (SZP[t]) { const mini = t === 'port_mini', q = cs * (mini ? .16 : .3); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = lw; c.beginPath(); c.rect(-q / 2, -q / 2 - cs * .3, q, q); mini ? c.stroke() : c.fill(); c.beginPath(); c.rect(-q / 2, -q / 2 + cs * .3, q, q); mini ? c.stroke() : c.fill(); c.fillText(mini ? 'MINI' : 'BIG', 0, 0); }
    else c.fillText(MODEP[t] ? PLET[t] : REVP[t] ? (t === 'port_mf' ? '▶' : '◀') : GRAV[t] ? (t === 'port_gd' ? '▼' : '▲') : ['>', '>>', '>>>', '>>>>'][['port_s1', 'port_s2', 'port_s3', 'port_s4'].indexOf(t)].slice(0, 3), 0, 0);
  } else if (t === 'coin') {
    const cx = x + cs / 2, cy = y + cs / 2, g = o.gold, f = g ? '#ffd21f' : '#c8743a', f2 = g ? '#fff2a0' : '#e8a070', sq = Math.abs(Math.cos(time * 3));
    c.translate(cx, cy); c.scale(.55 + .45 * sq, 1); c.beginPath(); c.arc(0, 0, cs * .36, 0, 7); c.fillStyle = f; c.fill(); c.strokeStyle = '#000'; c.lineWidth = lw; c.stroke();
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? cs * .08 : cs * .2; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fillStyle = f2; c.fill();
  } else if (ed && (OBJ[t].trig || OBJ[t].zone)) {
    const cl = t === 'trig_color' || t === 'trig_pulse' ? (o.col || '#ff5252') : TRC[t];
    c.fillStyle = cl; c.globalAlpha = .85; c.fillRect(x + cs * .08, y + cs * .08, cs * .84, cs * .84); c.globalAlpha = 1;
    c.strokeStyle = '#fff'; c.lineWidth = lw; c.strokeRect(x + cs * .08, y + cs * .08, cs * .84, cs * .84);
    c.fillStyle = '#fff'; c.font = `bold ${cs * .34}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(TRL[t], x + cs / 2, y + cs / 2); if (o.touch) { c.fillStyle = '#000'; c.fillRect(x + cs * .08, y + cs * .08, cs * .22, cs * .22); c.fillStyle = '#fff'; c.font = `bold ${cs * .2}px sans-serif`; c.fillText('T', x + cs * .19, y + cs * .19); }
  }
  c.restore();
}

function rotRect(r, x0, y0, x1, y1, cx = 15, cy = 15) {
  let pts = [[x0, y0], [x1, y1]];
  for (let i = 0; i < r; i++) pts = pts.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dy, cy - dx]; });
  return [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])];
}
function rotRectD(deg, x0, y0, x1, y1, cx = 15, cy = 15) {   // bounding box of a rect turned clockwise by any angle
  const th = deg * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), xs = [], ys = [];
  for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const dx = px - cx, dy = py - cy; xs.push(cx + dx * cs + dy * sn); ys.push(cy - dx * sn + dy * cs); }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
// convex quad (cell coords, placed at ox,oy) against an axis-aligned box: separating axis test
function polyBox(poly, ox, oy, bx0, by0, bx1, by1) {
  const P = poly.map(([a, b]) => [a + ox, b + oy]);
  if (Math.max(...P.map(q => q[0])) <= bx0 || Math.min(...P.map(q => q[0])) >= bx1 || Math.max(...P.map(q => q[1])) <= by0 || Math.min(...P.map(q => q[1])) >= by1) return false;
  const B = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], nx = -(b[1] - a[1]), ny = b[0] - a[0];
    let p0 = 1e9, p1 = -1e9, q0 = 1e9, q1 = -1e9; for (const q of P) { const d = q[0] * nx + q[1] * ny; p0 = Math.min(p0, d); p1 = Math.max(p1, d); } for (const q of B) { const d = q[0] * nx + q[1] * ny; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 <= q0 || q1 <= p0) return false; }
  return true;
}
function drawBG(c, W, H, s, camX, st = 'stripes', lq = false) {
  c.fillStyle = 'rgba(255,255,255,.06)'; c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 2 * s;
  const gg = Math.round((st === 'tri' ? 120 : st === 'circles' ? 140 : 90) * s), off = Math.round(camX * .35 * s) % gg;
  if (st === 'stripes') { const gs = Math.round(150 * s), o = Math.round(camX * .35 * s) % gs, hw = Math.round(gs * .5); for (let x = -o; x < W; x += gs) c.fillRect(x, 0, hw, H); }
  else if (st === 'dots') for (let x = -off; x < W; x += gg) for (let y = gg / 2; y < H; y += gg) { c.beginPath(); c.arc(x, y, 9 * s, 0, 7); c.fill(); }
  else if (st === 'tri') for (let x = -off; x < W; x += gg) for (let y = 0; y < H; y += gg) { c.beginPath(); c.moveTo(x, y + gg * .8); c.lineTo(x + gg * .4, y + gg * .2); c.lineTo(x + gg * .8, y + gg * .8); c.closePath(); c.fill(); }
  else if (st === 'circles') for (let x = -off; x < W; x += gg) for (let y = gg / 2; y < H; y += gg) { c.beginPath(); c.arc(x, y, gg * .3, 0, 7); c.stroke(); }
  else if (st === 'grid') { for (let x = -off; x < W; x += gg) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += gg) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } }
  else if (st === 'waves') for (let y = gg / 2; y < H; y += gg) { c.beginPath(); for (let x = -gg; x < W + gg; x += (lq ? 28 : 12) * s) c[x === -gg ? 'moveTo' : 'lineTo'](x, y + Math.sin((x + off * 2) / (30 * s)) * 12 * s); c.stroke(); }
}
const GRS = [['tiles','Tiles'],['plain','Plain'],['stripes','Diagonal stripes'],['dots','Dots'],['bricks','Bricks'],['grid','Grid'],['waves','Waves']];
function drawGround(c, W, H, gy, s, camX, col, st = 'tiles', lq = false) {
  gy = Math.round(gy); c.fillStyle = col; c.fillRect(0, gy, W, H - gy);
  c.save(); c.beginPath(); c.rect(0, gy, W, H - gy); c.clip();
  c.fillStyle = 'rgba(0,0,0,.18)'; c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 2 * s;
  const g = Math.round(60 * s), o = Math.round(camX * s) % g, B = H - gy;
  if (st === 'tiles') for (let x = -o; x < W; x += g) c.fillRect(x, gy + Math.round(3 * s), Math.round(g / 2), H);
  else if (st === 'stripes') { c.lineWidth = 10 * s; for (let x = -o - B; x < W + B; x += g) { c.beginPath(); c.moveTo(x, gy + B + 20); c.lineTo(x + B + 20, gy - 20); c.stroke(); } }
  else if (st === 'dots') for (let x = -o; x < W; x += g) for (let y = gy + g / 2; y < H + g; y += g) { c.beginPath(); c.arc(x + g / 2, y, 7 * s, 0, 7); c.fill(); }
  else if (st === 'bricks') { const h = g / 2; let r = 0; for (let y = gy; y < H + h; y += h, r++) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); for (let x = -o + (r & 1 ? g / 2 : 0) - g; x < W + g; x += g) { c.moveTo(x, y); c.lineTo(x, y + h); } c.stroke(); } }
  else if (st === 'grid') { c.beginPath(); for (let x = -o; x < W; x += g) { c.moveTo(x, gy); c.lineTo(x, H); } for (let y = gy + g; y < H + g; y += g) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); }
  else if (st === 'waves') for (let y = gy + g * .6; y < H + g; y += g * .6) { c.beginPath(); for (let x = -g; x < W + g; x += (lq ? 24 : 10) * s) c[x === -g ? 'moveTo' : 'lineTo'](x, y + Math.sin((x + o * 2) / (22 * s)) * 6 * s); c.stroke(); }
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(0, gy - Math.round(2 * s), W, Math.max(2, Math.round(3 * s)));
}
// thin white glow outline on the current path: a soft halo kept INSIDE the shape (so it never smears over neighbours) + a hairline
function glow(c, lw, k = 1) {
  if (LDM) { c.lineJoin = 'round'; c.lineWidth = lw * .6; c.strokeStyle = '#fff'; c.stroke(); return; }   // LDM: just the thin outline, no clipped glow passes
  c.save(); c.clip(); c.lineJoin = 'round'; c.strokeStyle = '#fff'; const a = c.globalAlpha;
  c.globalAlpha = a * .13 * k; c.lineWidth = lw * 4.6; c.stroke();
  c.globalAlpha = a * .3 * k; c.lineWidth = lw * 2.2; c.stroke();
  c.restore(); c.lineWidth = lw * .6; c.strokeStyle = '#fff'; c.stroke();
}
const mixHex = (h, t, to = 255) => { const n = parseInt(h.slice(1), 16), f = v => Math.round(v + (to - v) * t); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); };
function blockDraw(c, b, x, y, s, col, lw) {
  if (LDM) { c.fillStyle = col; c.fillRect(x, y, s, s); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(1, lw * .7); c.strokeRect(x + lw * .35, y + lw * .35, s - lw * .7, s - lw * .7); return; }   // LDM: flat tile
  const A0 = c.globalAlpha, K = a => `rgba(0,0,0,${a})`, Wt = a => `rgba(255,255,255,${a})`;
  c.save(); c.beginPath(); c.rect(x, y, s, s); c.clip();
  const body = (al = 1) => { c.globalAlpha = A0 * al; c.fillStyle = col; c.fillRect(x, y, s, s); c.globalAlpha = A0; };
  const R = (px, py, pw, ph, f, al = 1) => { c.globalAlpha = A0 * al; c.fillStyle = f; c.fillRect(x + px * s, y + py * s, pw * s, ph * s); c.globalAlpha = A0; };
  const T = (pts, f, al = 1) => { c.globalAlpha = A0 * al; c.fillStyle = f; c.beginPath(); for (let i = 0; i < pts.length; i += 2) c[i ? 'lineTo' : 'moveTo'](x + pts[i] * s, y + pts[i + 1] * s); c.closePath(); c.fill(); c.globalAlpha = A0; };
  const G = (x0, y0, x1, y1, a0, a1, rgb = '0,0,0') => { const g = c.createLinearGradient(x + x0 * s, y + y0 * s, x + x1 * s, y + y1 * s); g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(1, `rgba(${rgb},${a1})`); c.fillStyle = g; c.fillRect(x, y, s, s); };
  const L = (...p) => { c.beginPath(); for (let i = 0; i < p.length; i += 2) c[i ? 'lineTo' : 'moveTo'](x + p[i] * s, y + p[i + 1] * s); c.stroke(); };
  const hl = lw * .55; c.lineWidth = hl; c.strokeStyle = Wt(.3); c.fillStyle = Wt(.25);
  const grid = (g, fn) => { const cw = (1 - 4 * g) / 3; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) fn(g + i * (cw + g), g + j * (cw + g), cw, i, j); };
  const brick = (rows, gap, ghost) => { const rh = 1 / rows; for (let j = 0; j < rows; j++) { const bw = rows === 2 ? .66 : .5, off = j & 1 ? -bw / 2 : 0; for (let i = 0; i < 4; i++) { const bx = off + i * bw; if (bx >= 1 || bx + bw <= 0) continue; const dim = ghost ? ((i + j * 2) % 3 === 0 ? .3 : 1) : ((i * 5 + j * 3) % 7 === 0 ? .35 : 1); R(Math.max(0, bx) + .03, j * rh + .03, Math.min(1, bx + bw) - Math.max(0, bx) - .06, rh - .06, col, dim); R(Math.max(0, bx) + .03, j * rh + .03, Math.min(1, bx + bw) - Math.max(0, bx) - .06, (rh - .06) * .35, Wt(.14), dim); } } };
  switch (b) {
    case 0: body(); G(0, 0, 0, 1, .16, 0, '255,255,255'); break;
    case 1: body(); R(.2, .2, .6, .6, K(.18)); c.strokeRect(x + s * .2, y + s * .2, s * .6, s * .6); break;
    case 2: body(); L(0, 0, 1, 1); L(1, 0, 0, 1); break;
    case 3: body(); for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + s * (.3 + .4 * (i & 1)), y + s * (.3 + .4 * (i >> 1)), s * .07, 0, 7); c.fill(); } break;
    case 4: body(); for (let i = 1; i < 4; i++) R(0, i / 4 - .03, 1, .06, Wt(.25)); break;
    case 5: body(); R(0, 0, .5, .5, Wt(.2)); R(.5, .5, .5, .5, Wt(.2)); break;
    case 6: body(); R(0, 0, 1, .18, Wt(.25)); R(0, .82, 1, .18, K(.25)); break;
    case 7: body(); R(0, 0, 1, .35, Wt(.22)); break;
    case 8: body(); c.lineWidth = s * .14; c.strokeRect(x + s * .15, y + s * .15, s * .7, s * .7); break;
    case 9: body(); c.beginPath(); c.moveTo(x + s / 2, y + s * .15); c.lineTo(x + s * .85, y + s / 2); c.lineTo(x + s / 2, y + s * .85); c.lineTo(x + s * .15, y + s / 2); c.closePath(); c.stroke(); break;
    case 10: body(); G(0, 0, 0, 1, .62, 0); break;                                   // gradient
    case 11: body(); G(0, 0, 0, 1, .28, .5, '0,0,0'); G(0, 0, 0, .5, .22, 0, '255,255,255'); break;
    case 12: body(); G(0, 0, 1, 0, .6, 0); break;
    case 13: body(.4); T([0, 0, .7, 0, 0, .7], Wt(.14)); T([1, 1, .3, 1, 1, .3], Wt(.07)); break;   // glass
    case 14: body(); R(0, 0, 1, 1, K(.3)); grid(.035, (px, py, w) => R(px, py, w, w, col)); grid(.035, (px, py, w) => R(px, py, w, w * .4, Wt(.1))); break;
    case 15: body(); R(0, 0, 1, 1, K(.45)); grid(.075, (px, py, w) => R(px, py, w, w, Wt(.17))); break;
    case 16: grid(.04, (px, py, w, i, j) => { R(px, py, w, w, col, (i + j) & 1 ? .32 : .9); }); break;   // semi-transparent checker of tiles
    case 17: body(); R(.33, .33, .34, .34, K(.7)); R(.33, .33, .34, .34, Wt(.05)); L(.33, .33, .67, .33, .67, .67, .33, .67, .33, .33); R(0, 0, 1, .33, Wt(.08)); break;
    case 18: body(); T([0, 0, 1, 0, 0, 1], K(.38)); T([1, 1, 1, 0, 0, 1], Wt(.1)); L(1, 0, 0, 1); break;
    case 19: body(); T([0, 0, 1, 0, 1, 1], K(.38)); T([0, 0, 0, 1, 1, 1], Wt(.1)); L(0, 0, 1, 1); break;
    case 20: body(); T([0, 0, 1, 0, .5, .5], K(.36)); T([0, 0, .5, .5, 0, 1], K(.16)); T([1, 0, 1, 1, .5, .5], Wt(.06)); T([0, 1, 1, 1, .5, .5], Wt(.22)); L(0, 0, 1, 1); L(1, 0, 0, 1); break;
    case 21: body(); T([0, 0, 1, 0, .5, .5], Wt(.22)); T([0, 0, .5, .5, 0, 1], Wt(.06)); T([1, 0, 1, 1, .5, .5], K(.16)); T([0, 1, 1, 1, .5, .5], K(.36)); L(0, 0, 1, 1); L(1, 0, 0, 1); break;
    case 22: T([0, 0, 1, 0, .5, .5], col); T([0, 1, 1, 1, .5, .5], col); T([0, 0, .5, .5, 0, 1], col, .28); T([1, 0, 1, 1, .5, .5], col, .28); T([0, 1, 1, 1, .5, .5], Wt(.18)); T([0, 0, 1, 0, .5, .5], K(.3)); L(0, 0, 1, 1); L(1, 0, 0, 1); break;
    case 23: body(); R(0, 0, 1, 1, Wt(.16)); R(.18, .18, .64, .64, col); R(.18, .18, .64, .64, K(.34)); c.strokeRect(x + s * .18, y + s * .18, s * .64, s * .64); break;
    case 24: body(); R(0, 0, 1, 1, Wt(.2)); R(.14, .14, .72, .72, col); R(.14, .14, .72, .72, Wt(.1)); R(.3, .3, .4, .4, col); R(.3, .3, .4, .4, K(.45)); c.strokeRect(x + s * .14, y + s * .14, s * .72, s * .72); c.strokeRect(x + s * .3, y + s * .3, s * .4, s * .4); break;
    case 25: R(0, 0, 1, .2, col); R(0, .8, 1, .2, col); R(0, .2, .2, .6, col); R(.8, .2, .2, .6, col); R(0, 0, 1, .2, Wt(.14)); c.strokeRect(x + s * .2, y + s * .2, s * .6, s * .6); R(.2, .2, .6, .6, col, .12); break;
    case 26: body(); break;
    case 27: body(.12); break;
    case 28: R(0, 0, 1, 1, K(.45)); brick(3, 0, false); break;
    case 29: brick(3, 0, true); break;
    case 30: R(0, 0, 1, 1, K(.45)); brick(2, 0, false); break;
    case 31: body(); c.fillStyle = Wt(.4); [[.16, .16], [.84, .16], [.16, .84], [.84, .84]].forEach(([px, py]) => { c.beginPath(); c.arc(x + s * px, y + s * py, s * .07, 0, 7); c.fill(); }); R(.3, .3, .4, .4, K(.25)); c.strokeRect(x + s * .3, y + s * .3, s * .4, s * .4); break;
    case 32: body(); R(0, 0, .5, 1, K(.34)); R(.5, 0, .5, 1, Wt(.08)); L(.5, 0, .5, 1); break;
    case 33: for (let i = 0; i < 4; i++) { R(i * .25 + .025, 0, .2, 1, col, i & 1 ? .4 : .95); R(i * .25 + .025, 0, .06, 1, Wt(.14), i & 1 ? .4 : .95); } break;
    case 34: R(0, 0, 1, 1, K(.4)); [[0, 0], [.5, 0], [0, .5], [.5, .5]].forEach(([px, py]) => { R(px + .04, py + .04, .42, .42, col); R(px + .04, py + .04, .42, .14, Wt(.12)); }); break;
    case 35: T([1, 0, 1, 1, 0, 1], col); T([0, 0, 1, 0, 0, 1], col, .28); T([1, 0, 1, 1, 0, 1], Wt(.1)); L(1, 0, 0, 1); break;
  }
  c.restore();
  c.beginPath(); c.rect(x + lw * .3, y + lw * .3, s - lw * .6, s - lw * .6); glow(c, lw);
}
// one spike segment (base on y0, spans x0..x0+w, height hh), drawn in the look lk. The hitbox only ever depends on a/b/n so every look is a pure re-skin.
function spikePath(c, lk, x0, y0, w, hh) {
  c.beginPath();
  if (lk === 'jag') { const P = [[0, 0], [.14, .5], [.24, .34], [.4, .8], [.5, 1], [.62, .6], [.74, .78], [.88, .36], [1, 0]]; P.forEach(([u, v], i) => c[i ? 'lineTo' : 'moveTo'](x0 + u * w, y0 - v * hh)); }
  else if (lk === 'hill') { c.moveTo(x0, y0); for (let i = 0; i <= 28; i++) { const u = i / 28, e = Math.pow(Math.sin(Math.PI * u), .6), v = e * (.62 + .38 * Math.sin(u * Math.PI * 3.2 + .8)); c.lineTo(x0 + u * w, y0 - Math.max(0, v) * hh); } c.lineTo(x0 + w, y0); }
  else if (lk === 'saw') { const k = Math.max(1, Math.round(w / (OBJ_S * .34))), tw = w / k; c.moveTo(x0, y0); for (let i = 0; i < k; i++) { c.lineTo(x0 + (i + 1) * tw, y0 - hh); c.lineTo(x0 + (i + 1) * tw, y0); } }
  else if (lk === 'ramp') { const k = Math.max(2, Math.round(w / (OBJ_S * .28))), tw = w / k, yb = u => y0 - hh * .4 * u; c.moveTo(x0, y0); for (let i = 0; i < k; i++) { const u1 = (i + 1) / k; c.lineTo(x0 + i * tw, yb(i / k)); c.lineTo(x0 + (i + 1) * tw, yb(u1) - hh * .6); c.lineTo(x0 + (i + 1) * tw, yb(u1)); } c.lineTo(x0 + w, y0); }
  else { c.moveTo(x0, y0); c.lineTo(x0 + w / 2, y0 - hh); c.lineTo(x0 + w, y0); }
  c.closePath();
}
let OBJ_S = 30;
function hzDraw(c, h, o, x, y, s, col, lw, time) {
  c.translate(x + s / 2, y + s / 2); c.lineWidth = lw; const A0 = c.globalAlpha, lk = h.lk || 'tri'; OBJ_S = s;
  if (h.k === 't') {
    c.rotate(((o.r || 0) + (o.r45 ? .5 : 0)) * Math.PI / 2); const n = h.n, w = s * h.a / n, hh = s * h.b;
    for (let i = 0; i < n; i++) {
      const x0 = -s * h.a / 2 + i * w, y0 = s / 2; spikePath(c, lk, x0, y0, w, hh);
      if (LDM) { c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = lw * .6; c.stroke(); continue; }   // LDM: flat fill + outline (no gradients / clips)
      if (lk === 'grad') { const g = c.createLinearGradient(0, y0, 0, y0 - hh); g.addColorStop(0, col); g.addColorStop(1, mixHex(col, .6, 255) + '10'); c.fillStyle = g; c.fill(); }
      else if (lk === 'white') { const g = c.createLinearGradient(0, y0, 0, y0 - hh); g.addColorStop(0, mixHex(col, .1, 120)); g.addColorStop(1, '#ffffff'); c.fillStyle = g; c.fill(); }
      else if (lk === 'ghost') { c.globalAlpha = A0 * .4; c.fillStyle = col; c.fill(); c.globalAlpha = A0; }
      else if (lk === 'hill') { const g = c.createLinearGradient(0, y0, 0, y0 - hh); g.addColorStop(0, col); g.addColorStop(1, mixHex(col, .35, 255)); c.fillStyle = g; c.fill(); }
      else { c.fillStyle = col; c.fill(); if (lk === 'tri') { c.save(); c.clip(); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(x0 + w / 2, y0 - hh); c.lineTo(x0 + w, y0); c.lineTo(x0 + w / 2, y0); c.closePath(); c.fill(); c.restore(); } }
      spikePath(c, lk, x0, y0, w, hh); glow(c, lw);
      if (lk === 'ghost') { c.save(); c.globalAlpha = A0 * .55; c.lineWidth = lw * .5; spikePath(c, 'tri', x0 + w * .27, y0 - hh * .05, w * .46, hh * .46); c.stroke(); c.restore(); }
    }
  } else {
    c.rotate(time * 4 + (o.r || 0)); const R = s * h.a, N = LDM ? Math.min(h.b, 6) : h.b; c.beginPath();
    for (let i = 0; i < N * 2; i++) { const an = i * Math.PI / N, rr = i & 1 ? R * .72 : R; c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); }
    c.closePath(); c.fillStyle = col; c.fill(); glow(c, lw); c.beginPath(); c.arc(0, 0, R * .22, 0, 7); c.fillStyle = '#fff'; c.fill();
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
// pre-rendered sprites: every object that doesn't change shape is drawn once into a small canvas and then only blitted (big FPS win on levels with thousands of objects, decor, glows, saws, orbs and portals)
// - saws are cached upright and rotated while blitting, orbs / glow balls are cached and pulsed by scaling, so nothing animated is re-drawn from vector paths every frame
// - the cache is a bounded FIFO, and a per-frame "miss budget" stops colour-trigger fades (a new colour every frame) from filling it: past the budget objects are simply drawn directly
const SPR = new Map(); let SPR_MISS = 0; const sprFrame = () => { SPR_MISS = 0; };
function sprRect(o, cs) {   // [x0, y0, x1, y1] of the sprite, relative to the top-left corner of the object's anchor cell (y grows downward)
  const t = o.t, d0 = OBJ[t], d = d0.base ? OBJ[d0.base] : d0, m = Math.ceil(cs * .3) + 3;
  if (t.startsWith('port')) { const h = Math.ceil(cs * 1.5) + 4; return [Math.floor(cs / 2 - h), Math.floor(-cs / 2 - h), Math.ceil(cs / 2 + h), Math.ceil(-cs / 2 + h)]; }
  if (d.tall) return [-m, -cs - m, cs + m, cs + m];
  if (d.hz && d.hz.k === 's') { const h = Math.ceil(cs * d.hz.a) + 4; return [Math.floor(cs / 2 - h), Math.floor(cs / 2 - h), Math.ceil(cs / 2 + h), Math.ceil(cs / 2 + h)]; }
  if (d.glow) { const h = Math.ceil(cs * (d.nx === 'gb' ? d.gr * 1.05 : .95)) + 4; return [Math.floor(cs / 2 - h), Math.floor(cs / 2 - h), Math.ceil(cs / 2 + h), Math.ceil(cs / 2 + h)]; }
  if (d.deco) { const q = Math.ceil(cs * .6); return [-q, -q, cs + q, cs + q]; }
  if (ORBS.includes(t)) return [-m, -m, cs + m, cs + m];
  return [-m, -m, cs + m, cs + m];
}
function drawCached(c, o, x, y, cs, col, time, fast) {
  const t = o.t, d = OBJ[t];
  if (!fast || cs < 4 || (o.sc && o.sc !== 1) || d.coin || d.trig || d.zone) return drawObj(c, o, x, y, cs, col, false, time);
  const key = t + '|' + col + '|' + (o.r || 0) + '|' + (o.r45 || 0) + '|' + (o.a || 0) + '|' + cs.toFixed(1);
  let e = SPR.get(key);
  if (!e) {
    if (SPR_MISS++ > 48) return drawObj(c, o, x, y, cs, col, false, time);   // miss budget spent this frame: draw directly, don't pollute the cache
    if (SPR.size >= 1400) SPR.delete(SPR.keys().next().value);
    const r = sprRect(o, cs), cv = document.createElement('canvas'); cv.width = Math.max(1, r[2] - r[0]); cv.height = Math.max(1, r[3] - r[1]);
    drawObj(cv.getContext('2d'), { t, r: o.r || 0, r45: o.r45 || 0, a: o.a || 0 }, -r[0], -r[1], cs, col, false, 0);
    e = { cv, r }; SPR.set(key, e);
  }
  const A = c.globalAlpha; if (o.alp != null && o.alp !== 1) c.globalAlpha = A * o.alp;
  const s = e.cv, r = e.r, base = d.base ? OBJ[d.base] : d;
  if (base.hz && base.hz.k === 's') { c.save(); c.translate(x + cs / 2, y + cs / 2); c.rotate(time * 4); c.drawImage(s, r[0] - cs / 2, r[1] - cs / 2); c.restore(); }   // saw: upright sprite, spun while blitting
  else if (d.glow) { c.globalCompositeOperation = 'lighter'; if (d.nx === 'gb' && !LDM) { const k = (.92 + .08 * Math.sin(time * 3)) / .92; c.save(); c.translate(x + cs / 2, y + cs / 2); c.scale(k, k); c.drawImage(s, r[0] - cs / 2, r[1] - cs / 2); c.restore(); } else c.drawImage(s, x + r[0], y + r[1]); c.globalCompositeOperation = 'source-over'; }
  else if (ORBS.includes(t) && !LDM) { const k = 1 + Math.sin(time * 6) * .07; c.save(); c.translate(x + cs / 2, y + cs / 2); c.scale(k, k); c.drawImage(s, r[0] - cs / 2, r[1] - cs / 2); c.restore(); }
  else c.drawImage(s, x + r[0], y + r[1]);
  c.globalAlpha = A;
}

// ---- static chunks: objects that never change (no colour / alpha / toggle trigger on their group, not animated, not scaled) are pre-rendered into big tiles of 6x6 cells and blitted,
// so the per-frame cost of the static part of a level is a handful of drawImage calls instead of one per object. Tiles are padded so overflowing art never gets cut, and a bounded pixel budget evicts the oldest.
const CH = new Map(); let CH_PX = 0; const CHW = 6 * U, CHP = 1.5 * U, CH_BUDGET = 16e6;
const chunkable = o => { const d = OBJ[o.t], b = d.base ? OBJ[d.base] : d; return !(o.sc && o.sc !== 1) && !b.glow && !d.coin && !d.trig && !d.zone && !ORBS.includes(o.t) && !(b.hz && b.hz.k === 's'); };
function chunkClear() { CH.clear(); CH_PX = 0; }
function makeLayer(list, dynG) {   // split a sorted object list into static (baked into tiles) and dynamic (drawn one by one) parts. Only DENSE tiles (20+ static objects) are baked: a sparse tile would cost more to blit than its few sprites
  const L = { stat: [], dyn: [], cells: new Map() }, cand = new Map(), key = o => Math.floor(o.ex / CHW) + ',' + Math.floor(o.ey / CHW);
  for (const o of list) if (chunkable(o) && !(o.g && dynG.has(o.g))) { const k = key(o); let a = cand.get(k); if (!a) cand.set(k, a = []); a.push(o); }
  for (const [k, a] of cand) if (a.length >= 20) L.cells.set(k, a);
  for (const o of list) { if (chunkable(o) && !(o.g && dynG.has(o.g)) && L.cells.has(key(o))) L.stat.push(o); else L.dyn.push(o); }
  return L;
}
// ---------- the game ----------
class Game {
  constructor(cv) {
    this.cv = cv; this.c = cv.getContext('2d', { alpha: false }); this.practice = false; this.cps = []; this.cpT = 0; this.cb = {}; this.running = false; this.paused = false;
    this.held = false; this.edgeT = 0; this.skin = { id: 0, c1: PRIMARY[0], c2: SECONDARY[0] };
    const press = d => { if (!this.running || this.paused) return; if (d) { if (!this.held) { this.edgeT = .1; this.orbT = .13; this.holdUsed = false; } this.held = true; } else { this.held = false; this.holdUsed = false; } };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); press(true); });
    addEventListener('pointerup', () => press(false)); addEventListener('pointercancel', () => press(false));
    addEventListener('keydown', e => {
      if (!this.running) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) press(true); }
      else if (e.code === 'Escape' && !e.repeat) this.cb.onPause && this.cb.onPause();
      else if (e.code === 'KeyZ' && !e.repeat && this.practice && !this.paused) this.addCP();
      else if (e.code === 'KeyX' && !e.repeat && this.practice && !this.paused) this.cps.pop();
    });
    addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') press(false); });
    addEventListener('resize', () => this.running && this.resize());
  }
  resize() {
    if (!this.q && this.q !== 0) this.q = +localStorage.dash_q || 0;   // remembered quality tier for this device (0 full, 1 lite, 2 low-res)
    if (LDM) { this.q = 2; this.cv.style.imageRendering = 'pixelated'; }   // LDM: always lowest tier, half-resolution canvas stretched with hard pixels
    const d = this.rs || (this.rs = LDM ? .5 : Math.max(.6, Math.min(this.q ? 1 : 1.5, devicePixelRatio || 1) * (this.q >= 2 ? .75 : 1)));
    const w = Math.max(1, Math.round(this.cv.clientWidth * d)), h = Math.max(1, Math.round(this.cv.clientHeight * d));
    if (this.cv.width !== w) this.cv.width = w; if (this.cv.height !== h) this.cv.height = h;   // only touch the size when it really changes (resetting it blanks the canvas for a frame)
  }
  setQ(q) { this.q = q; localStorage.dash_q = q; this.rs = 0; this.resize(); }
  load(level) {
    this.level = level;
    let cn = 0; const objs = (level.objs || []).map(o => ({ ...o, ci: o.t === 'coin' ? cn++ : -1, gold: !!level.rated, ex: o.x * U, ey: o.y * U, tcol: o.col, col0: o.c || defColor(o.t), col: o.c || defColor(o.t), used: false, alp: 1, off: false, got: false, tf: false }));
    objs.sort((a, b) => a.ex - b.ex);
    this.groups = {};
    objs.forEach(o => { if (o.g) (this.groups[o.g] = this.groups[o.g] || []).push(o); });
    // hitboxes are built lazily in prep() the first time an object comes into range
    const mv = new Set(objs.filter(o => o.t === 'trig_move').map(o => o.tg));
    const solid = o => !OBJ[o.t].trig && !OBJ[o.t].deco && !OBJ[o.t].coin && !OBJ[o.t].zone;
    this.ZD = objs.filter(o => o.t === 'zone_d'); this.ZS = objs.filter(o => o.t === 'zone_s');   // D blocks: the wave slides along blocks / slopes inside them instead of dying (still solid). S blocks: end a dash.
    this.DEC = LDM ? [] : objs.filter(o => OBJ[o.t].deco && !OBJ[o.t].glow); this.GLW = LDM ? [] : objs.filter(o => OBJ[o.t].glow); this.hasGrav = objs.some(o => o.t === 'orb_b' || o.t === 'orb_db' || o.t === 'pad_b' || GRAV[o.t] || MODEP[o.t]); this.mports = objs.filter(o => MODEP[o.t]); this.szp = objs.filter(o => SZP[o.t]);
    this.S = objs.filter(o => solid(o) && !(o.g && mv.has(o.g)));
    this.D = objs.filter(o => solid(o) && o.g && mv.has(o.g));
    this.DG = []; { const m = new Map(); for (const o of this.D) { let G = m.get(o.g); if (!G) { G = { g: o.g, list: [], x0: 1e9, x1: -1e9 }; m.set(o.g, G); this.DG.push(G); } G.list.push(o); G.x0 = Math.min(G.x0, o.ex); G.x1 = Math.max(G.x1, o.ex); } }   // moving objects are handled per group: a whole group far from the player / camera is skipped with one check
    const dynG = new Set(); for (const o of objs) if ((o.t === 'trig_color' && Number(o.tg) > 0) || o.t === 'trig_alpha' || o.t === 'trig_toggle') dynG.add(o.tg);   // groups a trigger recolours / fades / toggles: those objects are never baked into tiles
    chunkClear();
    this.SR = this.S;   // render list. LDM: blocks completely buried in other blocks (all 4 neighbours solid) are never drawn
    if (LDM) { const full = new Set(), isFull = o => { const d = OBJ[o.t]; return d.solid && !d.slope && !d.half && (!o.sc || o.sc === 1) && Number.isInteger(o.x) && Number.isInteger(o.y); }; for (const o of this.S) if (isFull(o)) full.add(o.x + ',' + o.y); this.SR = this.S.filter(o => !(isFull(o) && full.has((o.x - 1) + ',' + o.y) && full.has((o.x + 1) + ',' + o.y) && full.has(o.x + ',' + (o.y - 1)) && full.has(o.x + ',' + (o.y + 1)))); }
    this.LS = makeLayer(this.SR, dynG); this.LD = makeLayer(this.DEC, dynG);
    const tr = objs.filter(o => OBJ[o.t].trig); this.T = tr.filter(o => !o.touch); this.TT = tr.filter(o => o.touch); this.COIN = objs.filter(o => o.t === 'coin'); this.coinTotal = this.COIN.length; this.coinSet = new Set();
    this.ports = objs.filter(o => SPEEDS[o.t]); this.rports = objs.filter(o => REVP[o.t]);
    const end = tr.find(o => o.t === 'trig_end'); this.autoEnd = !end; this.endX = end ? end.ex : (objs.length ? objs.reduce((m, o) => Math.max(m, o.ex), 0) : 0) + U + 3 * U;   // no End Trigger placed: level ends 3 blocks past the farthest object
    this.objs = objs; this.killY = (topRows(level.objs || []) + 10) * U;
  }
  prep(o) {
    o.pp = true; const d = OBJ[o.t], h = d.hz, sc = o.sc || 1;
    if (h) { if (h.k === 's') o.hr = h.a * U * .55 * sc; else { const hw = (h.n > 1 ? 10 : 5 * h.a) * .65, hh = 13 * h.b * .75; o.hb = rotRect(o.r || 0, 15 - hw, 0, 15 + hw, hh).map(v => 15 + (v - 15) * sc);
      { const th = ((o.r || 0) * 90 + (o.r45 ? 45 : 0)) * Math.PI / 180, c_ = Math.cos(th), s_ = Math.sin(th), W = 30 * h.a, w = W / h.n, H2 = 30 * h.b; o.tp = [];   // the visible triangle(s), used against the wave
        for (let i = 0; i < h.n; i++) { const x0 = 15 - W / 2 + i * w; o.tp.push([[x0, 0], [x0 + w, 0], [x0 + w / 2, H2]].map(([px, py]) => { const dx = px - 15, dy = py - 15; return [15 + (dx * c_ + dy * s_) * sc, 15 + (-dx * s_ + dy * c_) * sc]; })); } }
      if (o.r45) { const th = ((o.r || 0) * 90 + 45) * Math.PI / 180, cs_ = Math.cos(th), sn = Math.sin(th); o.hp = [[15 - hw, 0], [15 + hw, 0], [15 + hw, hh], [15 - hw, hh]].map(([px, py]) => { const dx = px - 15, dy = py - 15; return [15 + (dx * cs_ + dy * sn) * sc, 15 + (-dx * sn + dy * cs_) * sc]; }); } } }
    if (o.t.startsWith('port')) { const b = o.r45 ? rotRectD(((o.r || 0) * 90 + 45), 5, 0, 25, PH * U, 15, PH * U / 2) : rotRect(o.r || 0, 5, 0, 25, PH * U, 15, PH * U / 2); o.qb = [15 + (b[0] - 15) * sc, PH * U / 2 + (b[1] - PH * U / 2) * sc, 15 + (b[2] - 15) * sc, PH * U / 2 + (b[3] - PH * U / 2) * sc]; }
    if (PADS.includes(o.t)) o.pb = (o.r45 ? rotRectD(((o.r || 0) * 90 + 45), 3, 0, 27, 10) : rotRect(o.r || 0, 3, 0, 27, 10)).map(v => 15 + (v - 15) * sc);
    if (d.solid && !d.slope) { const r = d.half ? rotRect(o.r || 0, 0, 0, 30, 15) : [0, 0, 30, 30]; o.sb = r.map(v => 15 + (v - 15) * sc); }
  }
  timeAtX(x) {
    let t = 0, x0 = 0, sp = this.level.startSpeed || 1;
    for (const p of this.ports) { if (p.ex >= x) break; t += (p.ex - x0) / (BASE * sp); x0 = p.ex; sp = SPEEDS[p.t]; }
    return t + (x - x0) / (BASE * sp);
  }
  start(o = {}) {
    this.practice = !!o.practice; this.cps = []; this.cpT = 0; this.sx = o.x || 0; this.sy = o.y || 0; this.attempts = 1; this.best = 0; this.jumps = 0; this.camY = -70; this.won = false;
    this.reset(true); this.running = true; this.paused = false; this.acc = 0; this.last = performance.now();
    cancelAnimationFrame(this.raf); this.resize(); this.raf = requestAnimationFrame(t => this.frame(t));
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.held = false; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); }
  reset(first) {
    this.pv = null; this.cyT = 0; this.orbT = 0; this.pulse = null;
    this.objs.forEach(o => { o.col = o.col0; o.used = false; o.alp = 1; o.off = false; o.got = false; o.tf = false; }); this.zoom = 1; this.coinSet = new Set(); this.trail = [];
    this.gr = 1; this.holdUsed = false; this.mode = this.level.startMode || 'cube'; for (const q of this.mports) { if (q.ex >= this.sx) break; this.mode = PMODE[q.t]; } this.mini = false; for (const q of this.szp) { if (q.ex >= this.sx) break; this.mini = q.t === 'port_mini'; } this.gOff = {}; this.acts = []; this.parts = [];
    this.mir = 0; for (const q of this.rports) { if (q.ex >= this.sx) break; this.mir = q.t === 'port_mb' ? 1 : 0; } this.mf = this.mir ? -1 : 1;
    this.bg = this.level.bg || '#2b5fd9'; this.ground = this.level.ground || '#173a94';
    this.p = { x: this.sx, y: this.sy, vy: 0, rot: 0, grounded: false, dead: false, deadT: 0, dash: null, rb: 0 };
    this.speed = this.level.startSpeed || 1; for (const p of this.ports) { if (p.ex >= this.sx) break; this.speed = SPEEDS[p.t]; }
    this.time = this.timeAtX(this.sx); this.ti = 0; this.si = lb(this.S, this.sx - 130); this.tI = lb(this.TT, this.sx - 40); this.cpT = 0;
    while (this.ti < this.T.length && this.T[this.ti].ex < this.sx) { this.fire(this.T[this.ti], true); this.ti++; }
    this.runActs();
    if (!first) this.attempts++;
    this.cb.onSpawn && this.cb.onSpawn(this.time);
  }
  fire(t, instant) {
    const dur = instant ? 0 : (t.dur || 0);
    if (t.t === 'trig_color') {
      const tgt = Number(t.tg) || 0, key = tgt === 0 ? 'bg' : tgt === -1 ? 'gr' : 'c' + tgt; this.acts = this.acts.filter(a => a.key !== key);
      const to = hex2rgb(t.tcol || t.col || '#ff5252');
      if (tgt === 0) this.acts.push({ key, k: 'bg', from: hex2rgb(this.bg), to, t0: this.time, dur });
      else if (tgt === -1) this.acts.push({ key, k: 'gr', from: hex2rgb(this.ground), to, t0: this.time, dur });
      else this.acts.push({ key, k: 'col', list: (this.groups[tgt] || []).map(o => [o, hex2rgb(o.col)]), to, t0: this.time, dur });
    } else if (t.t === 'trig_pulse') {
      if (!instant) { this.acts = this.acts.filter(a => a.k !== 'pulse'); this.acts.push({ k: 'pulse', to: t.tcol || t.col || '#ffffff', t0: this.time, dur: Math.max(.05, t.dur || .5) }); }
    } else if (t.t === 'trig_move') {
      const b = this.gOff[t.tg] || { x: 0, y: 0 };
      this.acts.push({ k: 'mv', g: t.tg, b: { ...b }, d: [t.dx || 0, t.dy || 0], pe: 0, t0: this.time, dur });
      // follow triggers: for the trigger's duration the group tracks the player. "Follow X" = moves up/down with the player, "Follow Y" = moves right with the player, both = follows like a camera
      if (!instant && (t.fx || t.fy)) this.acts.push({ k: 'fol', g: t.tg, vert: !!t.fx, horz: !!t.fy, lx: this.p.x, ly: this.p.y, t0: this.time, dur: Math.max(.05, t.dur || 0) });
    } else if (t.t === 'trig_zoom') {
      this.acts = this.acts.filter(a => a.k !== 'zoom'); this.acts.push({ k: 'zoom', from: this.zoom, to: Math.max(.2, t.zoom || 1), t0: this.time, dur });
    } else if (t.t === 'trig_toggle') {
      (this.groups[t.tg] || []).forEach(o => { o.off = !t.on; });
    } else if (t.t === 'trig_alpha') {
      const key = 'a' + t.tg; this.acts = this.acts.filter(a => a.key !== key);
      this.acts.push({ key, k: 'al', list: (this.groups[t.tg] || []).map(o => [o, o.alp]), to: (t.pc ?? 100) / 100, t0: this.time, dur });
    }
  }
  runActs(m = 0) {   // m: 1 = only the actions that touch physics (move / follow), run every 240Hz step; 2 = only the visual ones (colour, alpha, bg, ground, pulse, zoom), run once per drawn frame; 0 = everything
    for (let i = this.acts.length - 1; i >= 0; i--) {
      const a = this.acts[i]; if (m && (m === 1) !== (a.k === 'mv' || a.k === 'fol')) continue;
      const pr = a.dur > 0 ? Math.min(1, (this.time - a.t0) / a.dur) : 1;
      if (a.k === 'bg') this.bg = rgb2hex(lerpC(a.from, a.to, pr));
      else if (a.k === 'gr') this.ground = rgb2hex(lerpC(a.from, a.to, pr));
      else if (a.k === 'col') { const h = rgb2hex(lerpC([0, 0, 0], a.to, 1)); for (const [o, f] of a.list) o.col = pr >= 1 ? h : rgb2hex(lerpC(f, a.to, pr)); }
      else if (a.k === 'mv') { const e = ease(pr), g = this.gOff[a.g] || (this.gOff[a.g] = { x: 0, y: 0 }); g.x += a.d[0] * (e - (a.pe || 0)); g.y += a.d[1] * (e - (a.pe || 0)); a.pe = e; }
      else if (a.k === 'fol') { const g = this.gOff[a.g] || (this.gOff[a.g] = { x: 0, y: 0 }), dx = this.p.x - a.lx, dy = this.p.y - a.ly; a.lx = this.p.x; a.ly = this.p.y; if (a.horz) g.x += dx / U; if (a.vert) g.y += dy / U; }
      else if (a.k === 'pulse') this.pulse = { col: a.to, a: 1 - pr };
      else if (a.k === 'zoom') this.zoom = a.from + (a.to - a.from) * ease(pr);
      else if (a.k === 'al') for (const [o, f] of a.list) o.alp = f + (a.to - f) * pr;
      if (pr >= 1) this.acts.splice(i, 1);
    }
  }
  snap() {
    const p = this.p, os = [];
    for (const o of this.objs) if (o.used || o.got || o.tf || o.off || o.alp !== 1 || o.col !== o.col0) os.push([o, o.used, o.got, o.tf, o.off, o.alp, o.col]);
    return { p: { ...p, dash: p.dash ? { ...p.dash } : null }, gr: this.gr, mir: this.mir, mini: !!this.mini, mode: this.mode, speed: this.speed, time: this.time, ti: this.ti, zoom: this.zoom, bg: this.bg, ground: this.ground,
      gOff: JSON.parse(JSON.stringify(this.gOff)), acts: this.acts.map(a => ({ ...a })), coins: [...this.coinSet], os };
  }
  restore(k) {
    this.pv = null; this.cyT = 0;
    for (const o of this.objs) { o.col = o.col0; o.used = false; o.alp = 1; o.off = false; o.got = false; o.tf = false; }
    for (const [o, u, g, t, off, al, col] of k.os) { o.used = u; o.got = g; o.tf = t; o.off = off; o.alp = al; o.col = col; }
    this.p = { ...k.p, dash: k.p.dash ? { ...k.p.dash } : null, dead: false, deadT: 0 };
    this.gr = k.gr; this.mini = !!k.mini; this.mir = k.mir || 0; this.mf = this.mir ? -1 : 1; this.mode = k.mode; this.speed = k.speed; this.time = k.time; this.ti = k.ti; this.zoom = k.zoom; this.bg = k.bg; this.ground = k.ground;
    this.gOff = JSON.parse(JSON.stringify(k.gOff)); this.acts = k.acts.map(a => ({ ...a })); this.coinSet = new Set(k.coins);
    this.si = lb(this.S, this.p.x - 130); this.tI = lb(this.TT, this.p.x - 40);
    this.holdUsed = false; this.edgeT = 0; this.parts = []; this.trail = []; this.cpT = 0; this.runActs();
  }
  addCP() { if (!this.practice || this.p.dead || this.won) return; this.cps.push({ x: this.p.x, y: this.p.y, s: this.snap() }); if (this.cps.length > 60) this.cps.shift(); this.cpT = 0; }
  respawn() {
    const c = this.practice && this.cps.length ? this.cps[this.cps.length - 1] : null;
    if (c) { this.restore(c.s); this.attempts++; this.cb.onSpawn && this.cb.onSpawn(this.time); } else this.reset();
  }
  die() {
    const p = this.p; p.dead = true; p.deadT = .7;
    for (let i = 0, N = LDM ? 5 : this.lq ? 10 : 22; i < N; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 260; this.parts.push({ x: p.x + 15, y: p.y + 15, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .6 + Math.random() * .3, col: i % 2 ? this.skin.c1 : this.skin.c2, s: 3 + Math.random() * 5 }); }
    this.cb.onDeath && this.cb.onDeath(this.pct(), this.attempts);
  }
  pct() { return isFinite(this.endX) ? Math.max(0, Math.min(100, this.p.x / this.endX * 100)) : 0; }
  sz() { return this.mode === 'wave' ? (this.mini ? 1 : WAVE_BIG) : (this.mini ? MINI : 1); }   // player scale: wave is 1.5x its old size (mini wave = the old size), everything else 1 (mini = 1/1.5)
  ins(v) { return 15 - (15 - v) * this.sz(); }   // an inset measured on the old 30x30 box, rescaled around the box centre
  hit(p, x, y, w, h, inset = 0) { if (this.mode === 'wave') inset += 11.25; inset = this.ins(inset); return p.x + inset < x + w && p.x + 30 - inset > x && p.y + inset < y + h && p.y + 30 - inset > y; }   // pads / orbs / portals / triggers
  // PRIMARY hitbox = the player's physical outline (wave: 15x15 box, 30% smaller): it is what kills on spikes and saws and what lands on blocks
  priIn() { const m = this.mode; return m === 'wave' ? 15 - 1.25 * this.sz() * .25 : this.ins(m === 'ship' ? 4 : 3); }   // wave kill box is now half of what it was   // wave: spike / saw box is half the size it was (1.875 units at the big size)   // wave spike box is 2.5x2.5 now (was ~10.5), ship 22x22, everything else 24x24
  // SECONDARY hitbox = smaller inner box that decides deaths against walls/blocks (22x22 base; cube -30%, ship -50%; wave has just its one box)
  secIn() { return this.priIn(); }
  // solid box insets [side, bottom, top, floorFlush, ceilFlush]: measured from the real artwork so ship / ufo / wave visibly touch the ground and blocks
  sbx() { const m = this.mode, b = m === 'wave' ? [8.4, 9.6, 9.6, 9.6, 9.6] : m === 'ship' ? [4, 6.3, 1.4, 6.3, 1.4] : m === 'ufo' ? [3, 2.1, 1.5, 2.1, 1.5] : [3, 3, 3, 0, 0]; const r = this.sz() === 1 ? b : b.map(v => this.ins(v)); return m === 'wave' ? r.map((v, i) => i < 3 ? 7.5 + v / 2 : v) : r; }   // wave: side/bottom/top insets halve the box (2x smaller); the flush values [3],[4] keep the visual resting position   // one hitbox decides walls, blocks and spikes alike
  hitI(p, x, y, w, h, i) { return p.x + i < x + w && p.x + 30 - i > x && p.y + i < y + h && p.y + 30 - i > y; }
  step(dt) {
    const p = this.p; if (this.won) return;
    if (p.dead) {
      p.deadT -= dt; for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 600 * dt; q.life -= dt; }
      this.parts = this.parts.filter(q => q.life > 0); if (p.deadT <= 0) this.respawn(); return;
    }
    if (this.autoEnd && p.x >= this.endX) { this.win(); return; }
    this.time += dt; this.edgeT -= dt; this.orbT = (this.orbT || 0) - dt; if (this.practice && (this.cpT += dt) >= 3) this.addCP();
    while (this.ti < this.T.length && this.T[this.ti].ex <= p.x) {
      const t = this.T[this.ti++]; if (t.off) continue; if (t.t === 'trig_end') { this.win(); return; } this.fire(t);
    }
    this.runActs(1);
    {   // zones
      const p_ = this.p; this.inD = false;
      if (this.mode === 'wave' && this.ZD.length) { const sb = this.sbx(); for (let i = lb(this.ZD, p_.x - 40); i < this.ZD.length && this.ZD[i].ex < p_.x + 40; i++) { const z = this.ZD[i]; if (!z.off && p_.x + sb[0] < z.ex + 30 && p_.x + 30 - sb[0] > z.ex && p_.y + sb[1] < z.ey + 30 && p_.y + 30 - sb[2] > z.ey) { this.inD = true; break; } } }
      if (p_.dash && this.ZS.length) for (let i = lb(this.ZS, p_.x - 40); i < this.ZS.length && this.ZS[i].ex < p_.x + 40; i++) { const z = this.ZS[i]; if (!z.off && p_.x + 3 < z.ex + 30 && p_.x + 27 > z.ex && p_.y + 3 < z.ey + 30 && p_.y + 27 > z.ey) { this.endDash(); break; } }
    }
    { const TT = this.TT; while (this.tI < TT.length && TT[this.tI].ex < p.x - 40) this.tI++; for (let i = this.tI; i < TT.length && TT[i].ex < p.x + 40; i++) { const t = TT[i]; if (!t.tf && !t.off && this.hit(p, t.ex, t.ey, U, U)) { t.tf = true; if (t.t === 'trig_end') { this.win(); return; } this.fire(t); } } }
    for (const o of this.COIN) if (!o.got && !o.off) { const sc = o.sc || 1, dx = p.x + 15 - (o.ex + 15), dy = p.y + 15 - (o.ey + 15); if (dx * dx + dy * dy < (24 * sc) ** 2) { o.got = true; this.coinSet.add(o.ci); this.cb.onCoin && this.cb.onCoin(this.coinSet.size, this.coinTotal); } }
    const mi = this.mini;
    if (this.mode === 'cube' && this.held && !this.holdUsed && (p.grounded || this.cyT > 0)) { p.vy = JUMP * this.gr; p.grounded = false; this.cyT = 0; this.jumps++; }   // coyote time: still counts as on the ground for a few frames after running off an edge
    if (this.mode === 'robot' && this.held && !this.holdUsed && (p.grounded || this.cyT > 0)) { p.vy = (mi ? 372 : 441) * this.gr; p.grounded = false; p.rb = .3; this.cyT = 0; this.jumps++; }   // robot: tap = small hop, hold = charges a much higher jump
    const edge = this.edgeT > 0, prevB = p.y, wasG = p.grounded;
    p.grounded = false;
    if (p.dash && (!this.held || this.mode === 'ship' || this.mode === 'wave')) this.endDash(); if (p.dash) { p.dash.t += dt; p.vy = p.dash.vy; }
    const gr = this.gr; p.x += BASE * this.speed * dt; if (this.mode === 'ship') { const tv = (this.held ? 1 : -1) * gr * (mi ? 350 : 270), vm = mi ? 375 : 290; p.vy += (tv - p.vy) * Math.min(1, (mi ? 9.5 : 7) * dt); p.vy = Math.max(-vm, Math.min(vm, p.vy)); } else if (this.mode === 'wave') { p.vy = (this.held ? 1 : -1) * gr * BASE * this.speed * (mi ? WAVE_MINI_K : 1); } else if (!p.dash) {
      if (this.mode === 'ufo' && edge) { p.vy = 400 * gr; this.edgeT = 0; this.jumps++; }
      else if (this.mode === 'ball' && edge && (wasG || this.cyT > 0)) { this.cyT = 0; this.gr = -this.gr; p.vy = -200 * this.gr; this.edgeT = 0; this.jumps++; }
      else if (this.mode === 'spider' && edge && (wasG || this.cyT > 0)) { this.cyT = 0; this.spiderJump(); }
      const gm = this.mode === 'ufo' ? (mi ? .7 : .55) : this.mode === 'ball' ? .9 : this.mode === 'robot' ? ((p.rb -= dt) > 0 && this.held ? .2 : 1) * (mi ? 1.15 : 1) : 1; p.vy -= G * gm * dt * this.gr; if (p.vy * gr < -VMAX) p.vy = -VMAX * gr; } p.y += p.vy * dt;
    { const fb = this.sbx()[3]; if (p.y <= -fb) { p.y = -fb; if (gr > 0 || p.vy < 0) p.vy = 0; if (gr > 0) p.grounded = true; } }
    if (p.y > this.killY) { this.die(); return; }
    const S = this.S;
    while (this.si < S.length && S[this.si].ex < p.x - 130) { S[this.si].pp = false; this.si++; }   // unload objects we've passed (hitboxes rebuilt lazily if we respawn)
    for (let i = this.si; i < S.length && S[i].ex < p.x + 130; i++) { this.inter(S[i], 0, 0, prevB, edge); if (p.dead) return; }
    for (const G of this.DG) {
      const g = this.gOff[G.g], gx = g ? g.x * U : 0, gy = g ? g.y * U : 0; if (G.x1 + gx < p.x - 160 || G.x0 + gx > p.x + 160) continue;
      for (const o of G.list) { if (o.off) continue; if (Math.abs(o.ex + gx - p.x) > 160) continue; this.inter(o, gx, gy, prevB, edge); if (p.dead) return; }
    }
    this.cyT = p.grounded ? COY : (this.cyT || 0) - dt;   // refill while standing, drain while airborne
    if (this.mode === 'ship') { const tr = -Math.atan2(p.vy, BASE * this.speed) * 180 / Math.PI; p.rot += (tr - p.rot) * Math.min(1, 12 * dt); } else if (this.mode === 'wave') p.rot = -Math.atan2(p.vy, BASE * this.speed) * 180 / Math.PI; else if (this.mode === 'ufo' || this.mode === 'robot' || this.mode === 'spider') p.rot += (0 - p.rot) * Math.min(1, 12 * dt); else if (this.mode === 'ball') p.rot += 500 * dt * (this.gr > 0 ? 1 : -1); else if (p.grounded) { const t = Math.round(p.rot / 90) * 90; p.rot += (t - p.rot) * Math.min(1, 30 * dt); }
    else p.rot += 420 * dt * this.gr;
    if (this.mode === 'wave') { const tl = this.trail, l = tl[tl.length - 1]; if (!l || p.x + 15 - l.x > 5) { tl.push({ x: p.x + 15, y: p.y + 15 }); if (tl.length > 45) tl.shift(); } } else if (this.trail.length) this.trail = [];
    if (!LDM && !p.dead && p.grounded && Math.random() < dt * 30) this.parts.push({ x: p.x, y: p.y + 2, vx: -40 - Math.random() * 40, vy: 30 + Math.random() * 50, life: .25, col: this.skin.c1, s: 2 + Math.random() * 2 });
    for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    if (this.parts.length > 60) this.parts = this.parts.filter(q => q.life > 0);
  }
  inter(o, gx, gy, prevB, edge) {
    const p = this.p, x = o.ex + gx, y = o.ey + gy, t = o.t;
    if (o.off) return;
    if (!o.pp) this.prep(o);
    if (OBJ[t].slope) return this.slope(o, x, y);
    if (OBJ[t].solid) {
      const sb = o.sb, bx = x + sb[0], by = y + sb[1], bw = sb[2] - sb[0], bh = sb[3] - sb[1];
      const [ss, ib, it, fl, fc] = this.sbx();
      if (p.x + ss < bx + bw && p.x + 30 - ss > bx && p.y + ib < by + bh && p.y + 30 - it > by) {
        // one box (matching the artwork) decides everything: land / slide on top, ceiling-slide underneath, otherwise it's a wall hit and you die
        const tol = Math.max(4, ib), tolT = Math.max(4, it), m = this.mode, gr = this.gr;
        if (m === 'wave') {
          if (this.inD) {   // D block: the block stays solid, but its top / underside work like the ground / ceiling for the wave
            if (prevB >= by + bh - tol) p.y = by + bh - fl;
            else if (prevB + 30 <= by + fc + tolT) p.y = by - 30 + fc;
            else this.die();
          } else this.die();
        }
        else if (m === 'ship' || m === 'ufo') {
          if (prevB >= by + bh - tol) { p.y = by + bh - fl; if (p.vy < 0) p.vy = 0; }
          else if (prevB + 30 <= by + fc + tolT) { p.y = by - 30 + fc; if (p.vy > 0) p.vy = 0; }
          else this.die();
        } else {
          const land = gr > 0 ? (p.vy <= 0 && prevB >= by + bh - tol) : (p.vy >= 0 && prevB + 30 <= by + tolT);
          if (land) { p.y = gr > 0 ? by + bh - fl : by - 30 + fc; p.vy = 0; p.grounded = true; }
          else this.die();
        }
      }
    } else if (OBJ[t].hz) {
      if (o.hr) { const i = this.priIn(), dx = Math.max(p.x + i, Math.min(x + 15, p.x + 30 - i)) - (x + 15), dy = Math.max(p.y + i, Math.min(y + 15, p.y + 30 - i)) - (y + 15); if (dx * dx + dy * dy < o.hr * o.hr) this.die(); }
      else if (this.mode === 'wave' && o.tp) { const i = this.priIn(); for (const tr of o.tp) if (polyBox(tr, x, y, p.x + i, p.y + i, p.x + 30 - i, p.y + 30 - i)) { this.die(); break; } }
      else if (o.hp) { const i = this.priIn(); if (polyBox(o.hp, x, y, p.x + i, p.y + i, p.x + 30 - i, p.y + 30 - i)) this.die(); }
      else { const h = o.hb; if (this.hitI(p, x + h[0], y + h[1], h[2] - h[0], h[3] - h[1], this.priIn())) this.die(); }
    } else if (ORBS.includes(t)) {
      const hf = 15 * (o.sc || 1), pi = this.mode === 'wave' ? 3 : this.ins(3), on = p.x + pi < x + 15 + hf && p.x + 30 - pi > x + 15 - hf && p.y + pi < y + 15 + hf && p.y + 30 - pi > y + 15 - hf;   // the orb's hitbox is exactly its 1x1 grid cell
      if (on && !o.used && this.orbT > 0) {
        o.used = true; p.grounded = false; this.cyT = 0; p.rb = 0; this.edgeT = 0; this.orbT = 0; this.holdUsed = true; this.jumps++;
        if (t === 'orb_b') { this.gr = -this.gr; p.vy = -200 * this.gr; }
        else if (DASH[t]) { const an = (o.a || 0) * Math.PI / 180; p.dash = { vy: Math.sin(an) * BASE * this.speed * this.gr, t: 0, flip: t === 'orb_db' }; p.vy = p.dash.vy; }
        else p.vy = PHYS[t] * this.gr;
      }
    } else if (PADS.includes(t)) {
      const b = o.pb, on = this.hit(p, x + b[0], y + b[1], b[2] - b[0], b[3] - b[1]);
      if (on && !o.used) { o.used = true; p.grounded = false; this.cyT = 0; p.rb = 0; if (t === 'pad_b') this.gr = -this.gr; p.vy = PHYS[t] * this.gr * (t !== 'pad_b' && ((o.r || 0) & 3) === 2 ? -1 : 1); }   // a pad turned upside down (rotated 180) launches the other way
      else if (!on) o.used = false;
    } else if (t.startsWith('port')) {
      const b = o.qb; if (!this.hit(p, x + b[0], y + b[1], b[2] - b[0], b[3] - b[1])) return;
      if (SPEEDS[t]) this.speed = SPEEDS[t];
      else if (t === 'port_gd' || t === 'port_gu') { this.gr = t === 'port_gu' ? -1 : 1; this.cyT = 0; }
      else if (MODEP[t]) this.mode = PMODE[t];
      else if (REVP[t]) this.mir = t === 'port_mb' ? 1 : 0;
      else if (SZP[t]) this.mini = t === 'port_mini';
    }
  }
  // spider: tap while on a surface = instantly teleport to the nearest solid surface on the other side and flip gravity
  spiderJump() {
    const p = this.p, up = this.gr > 0; let best = null;
    const test = (o, gx, gy) => {
      if (o.off) return; const d = OBJ[o.t]; if (!d.solid) return; if (!o.pp) this.prep(o);
      const sb = d.slope ? [0, 0, 30, d.tall ? 60 : 30] : o.sb, x = o.ex + gx + sb[0], y = o.ey + gy + sb[1], w = sb[2] - sb[0], h = sb[3] - sb[1];
      if (!(p.x + 30 > x && p.x < x + w)) return;
      const sb2 = this.sbx(); if (up) { if (y >= p.y + 30 - 2) { const t = y - 30 + sb2[4]; if (best === null || t < best) best = t; } }
      else if (y + h <= p.y + 2) { const t = y + h - sb2[3]; if (best === null || t > best) best = t; }
    };
    const S = this.S; for (let i = lb(S, p.x - 130); i < S.length && S[i].ex < p.x + 130; i++) test(S[i], 0, 0);
    for (const o of this.D) { const g = this.gOff[o.g]; test(o, g ? g.x * U : 0, g ? g.y * U : 0); }
    if (!up && best === null) best = -this.sbx()[3];
    if (best === null) return;
    const from = p.y; p.y = best; this.gr = -this.gr; p.vy = 0; p.grounded = false; this.edgeT = 0; this.jumps++;
    for (let i = 0; i < 10; i++) this.parts.push({ x: p.x + 15, y: from + (best - from) * i / 9 + 15, vx: -60 - Math.random() * 80, vy: (Math.random() - .5) * 60, life: .3, col: this.skin.c1, s: 3 + Math.random() * 3 });
  }
  endDash() { const d = this.p.dash; this.p.dash = null; if (d && d.flip) { this.gr = -this.gr; this.p.vy = 0; } }
  slope(o, x, y) {
    const d = OBJ[o.t], H = d.tall ? 60 : 30, p = this.p, r = (o.r || 0) & 3, k = r & 1, floor = r < 2, m = this.mode, gr = this.gr, slide = m === 'ship' || m === 'ufo';
    const cl = v => Math.max(0, Math.min(30, v)), sf = xl => y + (k ? H * (1 - xl / 30) : H * xl / 30);   // surface height at local x (0..30); the 1x2 slope is twice as steep
    if (m === 'wave') {   // the wave uses its own small centred hitbox
      const sl = d.slide || this.inD;   // inside a D block every slope behaves like a slide slope
      const sb_ = this.sbx(), x0 = p.x + sb_[0], x1 = p.x + 30 - sb_[0], y0 = p.y + sb_[1], y1 = p.y + 30 - sb_[2];
      if (!(x1 > x && x0 < x + 30) || y0 >= y + H || y1 <= y) return;
      if (floor) { const h = sf(cl(k ? x0 - x : x1 - x)), depth = h - y0; if (depth <= 0) return; if (sl && depth <= 14) p.y = h - sb_[3]; else this.die(); }   // slide slopes: the wave glides along the surface instead of dying
      else { const h = sf(cl(k ? x1 - x : x0 - x)), depth = y1 - h; if (depth <= 0) return; if (sl && depth <= 14) p.y = h - 30 + sb_[4]; else this.die(); }
      return;
    }
    const e = (30 - 30 * this.sz()) / 2, xl = p.x + e, xr = p.x + 30 - e, yb = p.y + e, yt = p.y + 30 - e;   // visible box (smaller than 30 when mini)
    if (!(xr > x && xl < x + 30) || yb >= y + H || yt <= y) return;
    if (floor) {
      const h = sf(cl(k ? xl - x : xr - x)), depth = h - yb; if (depth <= 0) return;
      if (slide) { if (depth <= 14) { p.y = h - e; if (p.vy < 0) p.vy = 0; } else this.die(); }
      else if (gr > 0 && depth <= 14) { if (p.vy <= 0) { p.y = h - e; p.vy = 0; p.grounded = true; } } else this.die();
    } else {
      const h = sf(cl(k ? xr - x : xl - x)), depth = yt - h; if (depth <= 0) return;
      if (slide) { if (depth <= 14) { p.y = h - 30 + e; if (p.vy > 0) p.vy = 0; } else this.die(); }
      else if (gr < 0 && depth <= 14) { if (p.vy >= 0) { p.y = h - 30 + e; p.vy = 0; p.grounded = true; } } else this.die();
    }
  }
  win() { this.won = true; this.p.grounded = true; this.cb.onWin && this.cb.onWin(); }
  frame(ts) {
    if (!this.running) return;
    const dt = Math.min(.05, (ts - this.last) / 1000); this.last = ts;
    this.ft = (this.ft || .0167) * .96 + dt * .04;   // smoothed frame time: if the device can't hold ~60fps, step down the quality (never back up mid-session, so it doesn't flicker between modes)
    if (ts - (this.rsT || 0) > 2000 && this.fcount > 90) {
      if (this.ft > .0195 && (this.q || 0) < 2) { this.setQ((this.q || 0) + 1); this.rsT = ts; this.ft = .0167; this.fcount = 0; }
      else if (!LDM && this.ft > .0215 && (this.q || 0) >= 2 && !this.ldmHint && this.fcount > 240) { this.ldmHint = 1; toast('Still laggy? Turn on LDM (Low Definition Mode) in Settings'); }
    }
    this.fcount = (this.fcount || 0) + 1;
    if (!this.paused && !this.won) {
      this.acc += dt; let n = 0;
      while (this.acc >= STEP && n++ < 40) { const p = this.p, v = this.pv || (this.pv = { x: 0, y: 0 }); v.x = p.x; v.y = p.y; this.step(STEP); this.acc -= STEP; }
      if (n >= 40) this.acc = 0;
      if (this.p.dead === false) this.best = Math.max(this.best, this.pct());
    }
    this.render(dt);
    this.cb.onFrame && this.cb.onFrame(this.pct(), this.attempts);
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  dr(c, o, x, y, cs, fa, fast) { c.globalAlpha = fa < 1 ? fa : 1; drawCached(c, o, x, y, cs, o.col, this.time, fast); c.globalAlpha = 1; }
  render(dt) {
    this.runActs(2); sprFrame();
    const c = this.c, W = this.cv.width, H = this.cv.height, p = this.p, zs = this.acts.some(a => a.k === 'zoom');
    let s = H / 330 * (this.zoom || 1); if (!zs) s = Math.max(1, Math.round(s * U)) / U;   // while the zoom is static, one block is a whole number of pixels so neighbouring blocks never leave seams / flickering lines
    // draw the player between the last two physics steps so motion stays smooth when the display (60Hz) and the 240Hz physics step don't line up
    const pv = this.pv, al = Math.min(1, Math.max(0, this.acc / STEP)); let ix = p.x, iy = p.y;
    if (pv && !p.dead && !this.won && !this.paused && Math.abs(p.x - pv.x) < 20 && Math.abs(p.y - pv.y) < 60) { ix = pv.x + (p.x - pv.x) * al; iy = pv.y + (p.y - pv.y) * al; }
    this.camX = ix - (W / s) * .3;
    const ty = Math.max(-70, iy - (H / s) * .4); this.camY += (ty - this.camY) * Math.min(1, 6 * dt);
    const cxp = Math.round(this.camX * s), cyp = Math.round(this.camY * s);
    const X = x => x * s - cxp, Y = y => H - (y * s - cyp), lq = (this.q || 0) >= 1; this.lq = lq;
    const mt = this.mir ? -1 : 1; this.mf += (mt - this.mf) * Math.min(1, 9 * dt); if (Math.abs(mt - this.mf) < .003) this.mf = mt;
    c.fillStyle = this.bg; c.fillRect(0, 0, W, H); c.save(); if (this.mf !== 1) { c.translate(W / 2, 0); c.scale(this.mf, 1); c.translate(-W / 2, 0); }
    if (!LDM) { const gk = this.bg + '|' + H; if (this.bgK !== gk) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, this.bg); g.addColorStop(1, shade(this.bg, -.35)); this.bgG = g; this.bgK = gk; } }   // gradient only rebuilt when the colour / height changes
    c.fillStyle = LDM ? this.bg : this.bgG; c.fillRect(0, 0, W, H);
    if (!LDM) drawBG(c, W, H, s, cxp / s, this.level.bgs, lq);
    if (!LDM && this.pulse && this.pulse.a > .01) { c.globalAlpha = this.pulse.a; c.fillStyle = this.pulse.col; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }   // pulse trigger flash
    const gy = Y(0);
    if (gy < H) drawGround(c, W, H, gy, s, cxp / s, this.ground, LDM ? 'plain' : this.level.grs, lq);

    if (this.attempts && this.sx === 0) { c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `bold ${30 * s}px "Lilita One",sans-serif`; c.textAlign = 'left'; c.fillText('Attempt ' + this.attempts, X(150), Y(150)); }
    const cs = U * s, S = this.SR; let lo = 0, hi = S.length; const lx = this.camX - (LDM ? 90 : 200);
    while (lo < hi) { const m = (lo + hi) >> 1; if (S[m].ex < lx) lo = m + 1; else hi = m; }
    const rx = this.camX + W / s + (LDM ? 90 : 200);
    const re = this.camX + W / s, fast = !this.acts.some(a => a.k === 'zoom'), FADE = LDM ? 1 : 150;   // objects fade in over 150 units as they enter on the right
    const xClip = re - FADE, drawOne = (o, fa) => { if (o.off) return; const y = Y(o.ey + U); if (y > H + cs * 6 || y < -cs * 9) return; const x = X(o.ex); if (x < -cs * 6 || x > W + cs * 4) return; this.dr(c, o, x, y, cs, fa, fast); };
    const layer = (L, tag) => {   // tiles for the static part (not while zooming: the scale changes every frame), then the dynamic / fading-in objects one by one
      let from = lb(L.stat, lx);
      if (fast) {
        const cxp0 = Math.floor((this.camX - CHP - 1) / CHW), cxp1 = Math.floor((re + 200) / CHW), cy0 = Math.max(0, Math.floor((cyp / s - CHP - 1) / CHW)), cy1 = Math.floor(((H + cyp) / s + CHP) / CHW);
        c.save(); c.beginPath(); c.rect(-W, -H, X(xClip) + W, H * 3); c.clip(); let built = 0;
        for (let cx = cxp0; cx <= cxp1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
          const list = L.cells.get(cx + ',' + cy); if (!list) continue;
          const key = tag + cx + ',' + cy + '|' + s.toFixed(4), ox = cx * CHW - CHP, oyT = cy * CHW + CHW + CHP; let e = CH.get(key);
          if (e) { CH.delete(key); CH.set(key, e); }
          else if (built < 3) {
            built++; const w = Math.ceil((CHW + 2 * CHP) * s), h = w, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
            for (const o of list) drawCached(g, o, (o.ex - ox) * s, (oyT - o.ey - U) * s, cs, o.col, 0, true);
            e = { cv, px: w * h }; CH.set(key, e); CH_PX += e.px; while (CH_PX > CH_BUDGET && CH.size > 1) { const k0 = CH.keys().next().value, v = CH.get(k0); CH.delete(k0); CH_PX -= v.px; }
          } else { for (const o of list) if (o.ex < xClip - 2 * U) drawOne(o, 1); continue; }   // over the build budget this frame: draw the tile's objects one by one
          c.drawImage(e.cv, X(ox), Y(oyT));
        }
        c.restore(); from = lb(L.stat, xClip - 2 * U);   // objects near the right edge fade in individually
      }
      for (let i = from; i < L.stat.length && L.stat[i].ex < rx; i++) { const o = L.stat[i], fa = (re - o.ex) / FADE; if (fa > 0) drawOne(o, fa); }
      for (let i = lb(L.dyn, lx); i < L.dyn.length && L.dyn[i].ex < rx; i++) { const o = L.dyn[i], fa = (re - o.ex) / FADE; if (fa > 0) drawOne(o, fa); }
    };
    layer(this.LD, 'd'); layer(this.LS, 's');
    for (const G of this.DG) { const gg = this.gOff[G.g], gx = gg ? gg.x * U : 0, gyy = gg ? gg.y * U : 0; if (X(G.x1 + gx) < -cs * 2 || X(G.x0 + gx) > W + cs) continue; for (const o of G.list) { if (o.off) continue; const x = X(o.ex + gx), fa = (re - (o.ex + gx)) / FADE; if (fa > 0 && x > -cs * 2 && x < W + cs) this.dr(c, o, x, Y(o.ey + gyy + U), cs, fa, fast); } }
    { const G_ = this.GLW; for (let i = lb(G_, lx); i < G_.length && G_[i].ex < rx; i++) { const o = G_[i]; if (o.off) continue; const x = X(o.ex), fa = Math.min(1, (re - o.ex) / FADE); if (fa <= 0 || x < -cs * 8 || x > W + cs * 6) continue; c.globalAlpha = fa; drawCached(c, o, x, Y(o.ey + U), cs, o.col, this.time, fast); c.globalAlpha = 1; } }
    for (const o of this.COIN) if (!o.got && !o.off) { const x = X(o.ex); if (x > -cs * 2 && x < W + cs) drawObj(c, o, x, Y(o.ey + U), cs, '#fff', false, this.time); }
    if (this.practice) for (const q of this.cps) { const x = X(q.x + 15), y = Y(q.y + 15); if (x > -40 && x < W + 40) { const r = 11 * s; c.fillStyle = '#35ff6a'; c.strokeStyle = '#000'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * .7, y); c.lineTo(x, y + r); c.lineTo(x - r * .7, y); c.closePath(); c.fill(); c.stroke(); } }
    if (isFinite(this.endX)) { const x = X(this.endX); if (x > -50 && x < W + 50) { const gr = c.createLinearGradient(x - 12 * s, 0, x + 12 * s, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - 12 * s, 0, 24 * s, H); } }
    for (const q of this.parts) { c.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); c.fillStyle = q.col; c.fillRect(X(q.x) - q.s * s / 2, Y(q.y) - q.s * s / 2, q.s * s, q.s * s); }
    c.globalAlpha = 1;
    if (!p.dead && this.trail.length > 1) { c.strokeStyle = this.skin.c1; c.lineWidth = 3 * s * this.sz(); c.lineJoin = 'round'; c.globalAlpha = .8; c.beginPath(); this.trail.forEach((q, i) => c[i ? 'lineTo' : 'moveTo'](X(q.x), Y(q.y))); c.lineTo(X(ix + 15), Y(iy + 15)); c.stroke(); c.globalAlpha = 1; }
    if (!p.dead) { const zf = this.mode === 'wave' ? 1 : this.sz(); c.save(); c.translate(X(ix) + 15 * s, Y(iy) - 15 * s); c.rotate(p.rot * Math.PI / 180); if (this.mode === 'ship') { if (this.gr < 0) c.scale(1, -1); drawShip(c, this.skin.id, this.skin.ship || 0, this.skin.c1, this.skin.c2, 30 * s * zf); } else if (this.mode === 'ufo') { if (this.gr < 0) c.scale(1, -1); drawUfo(c, this.skin.id, this.skin.ufo || 0, this.skin.c1, this.skin.c2, 30 * s * zf); } else if (this.mode === 'robot') { if (this.gr < 0) c.scale(1, -1); drawRobot(c, this.skin.robot || 0, this.skin.c1, this.skin.c2, 30 * s * zf, p.x / 14, !p.grounded); } else if (this.mode === 'spider') { if (this.gr < 0) c.scale(1, -1); drawSpider(c, this.skin.spider || 0, this.skin.c1, this.skin.c2, 30 * s * zf, p.x / 14, !p.grounded); } else if (this.mode === 'ball') drawBall(c, this.skin.ball || 0, this.skin.c1, this.skin.c2, 30 * s * zf); else if (this.mode === 'wave') drawWave(c, this.skin.wave || 0, this.skin.c1, this.skin.c2, 12 * s * this.sz()); else drawIcon(c, this.skin.id, this.skin.c1, this.skin.c2, 30 * s * zf); c.restore(); }
    c.restore();
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
function closeModal() { stopPreview(); $('#modal').classList.remove('open'); if (modalClose) { modalClose(); modalClose = null; } }
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
let track = null, unlocked = false, previewing = false;
function applyAudio() {
  for (const k of ['menu', 'editor']) {
    A[k].volume = settings.vol;
    if (settings.music && unlocked && track === k && !(k === 'editor' && previewing)) A[k].play().catch(() => { }); else A[k].pause();
  }
}
function stopPreview() { try { prevA && prevA.pause(); } catch { } prevA = null; if (previewing) { previewing = false; applyAudio(); } }
function setTrack(t) { if (track === t) return; track = t; applyAudio(); }
function sfx(k) { if (!settings.sfx) return; const a = A[k].cloneNode(); a.volume = settings.vol; a.play().catch(() => { }); }
const unlock = () => { unlocked = true; applyAudio(); };
addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });
function saveSettings() { localStorage.dash_settings = JSON.stringify(settings); applyAudio(); if (me) updateDoc(doc(db, 'users', me.uid), { settings }).catch(() => { }); }

/* ================= achievements / unlocks ================= */
const ACH_DEFS = [
  ['totalViews', 'Popular', 'Get {n} total views on your levels', [5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 500, 750, 1000]],
  ['levelsBeaten', 'Winner', 'Beat {n} levels', [1, 2, 3, 5, 8, 12, 16, 20, 25, 30, 40, 50, 75]],
  ['netLikes', 'Liked', 'Reach {n} total net likes', [1, 2, 3, 5, 8, 12, 15, 20, 30, 40, 60, 100, 150]],
  ['maxPostLikes', 'Hit Level', 'Get {n} net likes on a single level', [2, 3, 5, 8, 12, 16, 20, 30, 50]],
  ['rated', 'Verified', 'Get {n} of your levels rated', [1, 2, 3, 5, 8, 12, 20, 30]],
  ['stars', 'Stargazer', 'Collect {n} stars', [1, 3, 6, 10, 15, 20, 30, 40, 60, 80, 100, 150]],
  ['demons', 'Demon Slayer', 'Beat {n} demon levels', [1, 2, 3, 5, 8, 12, 20, 30]],
  ['published', 'Creator', 'Publish {n} levels', [1, 2, 3, 5, 8, 12, 16, 20, 30]],
  ['comments', 'Chatty', 'Post {n} comments', [1, 3, 5, 8, 12, 20, 30, 50, 80, 120]],
  ['crystals', 'Gem Hoarder', 'Collect {n} crystals', [10, 30, 60, 100, 150, 250, 400, 600, 800, 1000, 1500]],
  ['starCoins', 'Coin Collector', 'Collect {n} star coins', [1, 2, 3, 5, 8, 12, 16, 24, 36]]
];
const ACH = (() => {
  const list = []; ACH_DEFS.forEach(([stat, name, desc, ns], ci) => ns.forEach((n, i) => list.push({ stat, n, name: `${name} ${i + 1}`, desc: desc.replace('{n}', fmt(n)), tier: i / ns.length, ci })));
  list.sort((a, b) => a.tier - b.tier || a.ci - b.ci);
  const cols = []; for (let i = 1; i < 23; i++) { cols.push({ k: 'p', i }); cols.push({ k: 's', i }); }
  // each mode has 40 icons (0 = default). Only some are achievement rewards (picked pseudo-randomly, handed out slightly out of order); the rest are shop-only
  const mk = (k, cnt, seed) => {
    const r = rng(seed); let idx = Array.from({ length: 39 }, (_, i) => i + 1);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    idx = idx.slice(0, cnt).sort((a, b) => a - b);
    for (let i = 0; i < idx.length - 1; i++) if (r() < .3) { const j = Math.min(idx.length - 1, i + 1 + Math.floor(r() * 3)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.map(i => ({ k, i }));
  };
  const pools = [{ a: mk('skin', 14, 101) }, { a: cols }, { a: mk('ship', 14, 202) }, { a: mk('ball', 14, 303) }, { a: mk('ufo', 14, 404) }, { a: mk('wave', 15, 505) }]; pools.forEach(p => p.n = p.a.length);
  list.forEach(a => { pools.sort((x, y) => y.a.length / y.n - x.a.length / x.n); a.rw = pools.find(p => p.a.length).a.shift(); });
  // robot + spider skins: extra late-game achievements (assigned after the originals, so existing unlocks never change)
  const rb_ = mk('robot', 11, 606), sp_ = mk('spider', 11, 707), rw2 = []; for (let i = 0; i < 11; i++) rw2.push(rb_[i], sp_[i]);
  const cnt = {};
  [['levelsBeaten', 100], ['stars', 200], ['demons', 40], ['crystals', 2000], ['starCoins', 50], ['totalViews', 1500], ['netLikes', 200], ['published', 40], ['comments', 150], ['rated', 40], ['maxPostLikes', 75],
   ['levelsBeaten', 150], ['stars', 300], ['demons', 50], ['crystals', 3000], ['starCoins', 75], ['totalViews', 2500], ['netLikes', 300], ['published', 50], ['comments', 200], ['rated', 60], ['maxPostLikes', 100]]
    .forEach(([stat, n], j) => { const df = ACH_DEFS.find(d => d[0] === stat); cnt[stat] = (cnt[stat] || df[3].length) + 1; list.push({ stat, n, name: `${df[1]} ${cnt[stat]}`, desc: df[2].replace('{n}', fmt(n)), tier: 1 + j / 100, ci: 99, rw: rw2[j] }); });
  // newer achievements: no cosmetic (every skin is already spoken for), they pay crystals once instead
  const NEWA = [['likesGiven', 'Supporter', 'Like {n} levels', [1, 3, 5, 10, 20, 35, 50, 75, 100, 150], [10, 10, 15, 20, 25, 30, 40, 50, 75, 100]],
                ['deaths', 'Respawner', 'Die {n} times', [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000], [10, 10, 15, 20, 25, 30, 40, 50, 75, 100]]];
  NEWA.forEach(([stat, name, desc, ns, gems], ci) => ns.forEach((n, i) => list.push({ stat, n, name: `${name} ${i + 1}`, desc: desc.replace('{n}', fmt(n)), tier: 2 + i / ns.length, ci: 200 + ci, rw: null, gem: gems[i] })));
  return list;
})();
const RWN = { skin: 'Cube skin', ship: 'Ship skin', ball: 'Ball skin', ufo: 'UFO skin', wave: 'Wave skin', robot: 'Robot skin', spider: 'Spider skin' };
const rwTxt = a => a.rw ? rwName(a.rw) : `+${a.gem} gems`;
const rwName = r => RWN[r.k] ? `${RWN[r.k]} #${r.i + 1}` : r.k === 'p' ? `Primary color #${r.i + 1}` : `Secondary color #${r.i + 1}`;
const isEarned = a => !!me && !!P && (achVal(a) >= a.n || (P.achEarned || []).includes(a.name));   // once earned, always earned (stats dropping later never takes it back)
const achVal = a => a.stat === 'deaths' ? (P?.deaths || 0) + deathBuf : a.stat === 'crystals' ? Math.max(P?.crystals || 0, P?.maxCrystals || 0) : (P?.[a.stat] || 0);   // crystals can be spent, so use the highest amount ever held
function trackMaxCrystals() { if (me && P && (P.crystals || 0) > (P.maxCrystals || 0)) { P.maxCrystals = P.crystals; updateDoc(doc(db, 'users', me.uid), { maxCrystals: P.crystals }).catch(() => { }); } }
function unlocked_() {
  const u = { skin: new Set([0]), ship: new Set([0]), ball: new Set([0]), ufo: new Set([0]), wave: new Set([0]), robot: new Set([0]), spider: new Set([0]), p: new Set([0]), s: new Set([0]) };
  if (me && P) ACH.forEach(a => { if (a.rw && isEarned(a)) u[a.rw.k].add(a.rw.i); });
  if (me && P) (P.bought || []).forEach(k => { const [t, i] = k.split(':'); if (t === 'col') { u.p.add(+i); u.s.add(+i); } else if (u[t]) u[t].add(+i); });
  return u;
}
let payingAch = false, savingEarn = false, deathBuf = 0;
function flushDeaths() { if (!deathBuf || !me || !P) return; const n = deathBuf; deathBuf = 0; P.deaths = (P.deaths || 0) + n; updateDoc(doc(db, 'users', me.uid), { deaths: increment(n) }).catch(() => { deathBuf += n; P.deaths -= n; }); }
addEventListener('pagehide', flushDeaths); document.addEventListener('visibilitychange', () => { if (document.hidden) flushDeaths(); });
function countDeath() { if (!me || !P) return; deathBuf++; if (deathBuf >= 10) flushDeaths(); checkAch(); }
function checkAch() {
  if (!me || !P) return; trackMaxCrystals(); const key = 'dash_ach_' + me.uid; const seen = new Set(JSON.parse(localStorage[key] || '[]'));
  const first = !localStorage[key]; const now = ACH.filter(isEarned).map(a => a.name);
  { const have = new Set(P.achEarned || []), add = ACH.filter(a => achVal(a) >= a.n && !have.has(a.name)).map(a => a.name);
    if (add.length && !savingEarn) { savingEarn = true; P.achEarned = [...have, ...add]; updateDoc(doc(db, 'users', me.uid), { achEarned: arrayUnion(...add) }).catch(() => { P.achEarned = [...have]; }).finally(() => { savingEarn = false; }); } }
  if (!first) now.filter(n => !seen.has(n)).forEach(n => { const a = ACH.find(x => x.name === n); toast(`🏆 Achievement: ${a.name} - ${a.rw ? 'unlocked ' + rwName(a.rw) : 'earned ' + a.gem + ' gems'}`, 'ok'); });
  localStorage[key] = JSON.stringify(now);
  // gem rewards are paid exactly once per achievement (tracked on the account)
  const got = new Set(P.achPaid || []), due = ACH.filter(a => a.gem && isEarned(a) && !got.has(a.name));
  if (due.length && !payingAch) {
    payingAch = true; const sum = due.reduce((t, a) => t + a.gem, 0), names = due.map(a => a.name);
    P.achPaid = [...got, ...names]; P.crystals = (P.crystals || 0) + sum;
    updateDoc(doc(db, 'users', me.uid), { crystals: increment(sum), achPaid: arrayUnion(...names) }).catch(() => { }).finally(() => { payingAch = false; });
    renderFooter();
  }
}

/* ================= navigation ================= */
let cur = 'menu', curP = {}, stack = [];
const views = {};
function showLayer(n) { ['menu', 'view', 'play', 'edit'].forEach(l => $('#' + l).classList.toggle('active', l === n)); document.body.classList.toggle('fs', n === 'play' || n === 'edit'); }
function go(name, p = {}, push = true) {
  if (name === 'menu') { stack = []; cur = 'menu'; curP = {}; showLayer('menu'); }
  else { if (push) stack.push([cur, curP]); cur = name; curP = p; showLayer('view'); views[name](p); if (me && ['account', 'cosmetics', 'community', 'shop'].includes(name)) refreshMyStats().then(refreshProfile).then(() => { if (cur === name) views[name](curP); }); }
  renderFooter(); setTrack('menu');
}
function back() { const s = stack.pop(); s && s[0] !== 'menu' ? go(s[0], s[1], false) : go('menu'); }
const page = (title, html) => { $('#view').innerHTML = `<div class="page"><header><button class="round" data-act="back">◀</button><h2>${title}</h2></header><div class="pbody">${html}</div></div>`; };
function renderFooter() {
  trackMaxCrystals(); const s = P || {};
  $('#footer').innerHTML = `<span class="fname">${me ? nameHTML(P?.username || '…') : 'Anonymous'}</span><span>💎 ${fmt(s.crystals)}</span><span>⭐ ${fmt(s.stars)}</span><span>🪙 ${fmt(s.starCoins)}</span><span>😈 ${fmt(s.demons)}</span><span>👍 ${fmt(s.netLikes)}</span><span>✅ ${fmt(s.levelsBeaten)}</span>`;
  $('#menuIcon').src = myIcon(64);
  const b = $('#menuBadge'); const n = (reqs.length || 0) + (isMod() ? modPending : 0); b.textContent = n; b.classList.toggle('hide', !n);
}

/* ================= auth ================= */
const emailOf = u => `${u.toLowerCase()}@dash-game.app`;
const newProfile = username => ({ username, stars: 0, crystals: 0, levelsBeaten: 0, demons: 0, netLikes: 0, totalViews: 0, published: 0, rated: 0, maxPostLikes: 0, comments: 0, starCoins: 0, bought: [], ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, skin: 0, ship: 0, c1: 0, c2: 0, songs: [], settings, created: serverTimestamp() });
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
    await afterLogin(cred.user); await transferAnon().catch(e => console.warn(e));
  } finally { busySignup = false; }
}
async function afterLogin(u) {
  me = u; P = null;
  if ((await getDoc(doc(db, 'banned', u.uid))).exists()) { await signOut(auth); me = null; toast('This account has been banned', 'err'); return; }
  let s = await getDoc(doc(db, 'users', u.uid)); if (!s.exists()) { await sleep(1200); s = await getDoc(doc(db, 'users', u.uid)); }
  if (!s.exists()) { await signOut(auth); me = null; toast('Account data not found', 'err'); return; }
  P = s.data(); if (P.settings) { Object.assign(settings, P.settings); localStorage.dash_settings = JSON.stringify(settings); applyAudio(); }
  loadSlots(); startListeners(); renderFooter(); loadBeaten(); backfillBeat();
  refreshMyStats(); pullDrafts(); syncSongs(); purgeDMs();
  if (cur === 'account') views.account({ tab: 'account' });
}
onAuthStateChanged(auth, async u => {
  if (busySignup) return;
  if (u) { try { await afterLogin(u); } catch (e) { console.error(e); toast('Could not load account: ' + errMsg(e), 'err'); } }
  else { me = null; P = null; BEATEN = new Set(); stopListeners(); loadSlots(); renderFooter(); if (cur === 'account') views.account({ tab: 'account' }); }
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
    reqReady = true; if (cur === 'lb' && curP.tab === 'friends') views.lb(curP); else if (cur === 'lb') views.lb(curP); else if (cur === 'community') views.community();
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
const settingsHTML = () => `<div class="card"><div class="row"><button class="btn ${settings.music ? 'green' : 'red'}" data-act="tog" data-k="music">Music: ${settings.music ? 'ON' : 'OFF'}</button><button class="btn ${settings.sfx ? 'green' : 'red'}" data-act="tog" data-k="sfx">SFX: ${settings.sfx ? 'ON' : 'OFF'}</button></div><label style="margin-top:12px">Volume<input type="range" min="0" max="1" step=".05" value="${settings.vol}" id="volr"></label></div><div class="card"><div class="row"><button class="btn ${LDM ? 'green' : 'red'}" data-act="ldm">LDM (Low Definition Mode): ${LDM ? 'ON' : 'OFF'}</button></div><p class="muted">For slow devices. Reloads the game, then hides decor / glows / backgrounds, draws flat blocks and spikes, culls buried blocks and renders at half resolution. Hitboxes and gameplay stay exactly the same. This setting is saved on this device only.</p></div>`;
views.account = ({ tab = 'account' } = {}) => {
  const tabs = `<div class="tabs"><button class="${tab === 'account' ? 'on' : ''}" data-act="acctab" data-t="account">Account</button><button class="${tab === 'settings' ? 'on' : ''}" data-act="acctab" data-t="settings">Settings</button></div>`;
  let body;
  if (tab === 'settings') body = settingsHTML();
  else if (!me) body = `<div class="card" style="max-width:460px"><h3>Playing as Anonymous</h3><p class="muted">Log in to like, dislike, comment, create levels and save progress. You can still view and play other people's levels.</p><label>Username<input id="au" maxlength="16" autocomplete="username"></label><label>Password<input id="ap" type="password" autocomplete="current-password"></label><div class="row"><button class="btn green" data-act="login">Log in</button><button class="btn blue" data-act="signup">Sign up</button></div></div>`;
  else if (!P) body = '<p>Loading…</p>';
  else body = `<div class="card"><div class="row"><img src="${myIcon(96)}" width="96" height="96"><div><h2 style="margin:0">${nameHTML(P.username)}</h2><div class="muted">💎 ${fmt(P.crystals)} · ⭐ ${fmt(P.stars)} · 🪙 ${fmt(P.starCoins)} · 😈 ${fmt(P.demons)} · 👍 ${fmt(P.netLikes)} · ✅ ${fmt(P.levelsBeaten)} beaten · 👁 ${fmt(P.totalViews)} views</div></div></div><div class="row" style="margin-top:12px"><button class="btn blue" data-act="myprofile">View my profile</button><button class="btn red" data-act="logout">Log out</button></div></div>`;
  page('Account', tabs + body);
};

/* ================= cosmetics ================= */
views.cosmetics = ({ tab = 'cube' } = {}) => {
  const un = unlocked_(), sk = P?.skin || 0, sh = P?.ship || 0, c1 = P?.c1 || 0, c2 = P?.c2 || 0, bl = P?.ball || 0, uf = P?.ufo || 0, wv = P?.wave || 0, rbt = P?.robot || 0, spd = P?.spider || 0;
  const req = (k, i) => { const a = ACH.find(a => a.rw && a.rw.k === k && a.rw.i === i); return a ? `${a.name}: ${a.desc}` : i ? 'Sold in Community > Shop' : 'Default'; };
  const grid = (k, n, cur, img) => Array.from({ length: n }, (_, i) => `<div class="sk ${un[k].has(i) ? '' : 'locked'} ${i === cur ? 'sel' : ''}" data-act="equip" data-k="${k}" data-i="${i}" title="${esc(un[k].has(i) ? k + ' ' + (i + 1) : req(k, i))}"><img src="${img(i)}"></div>`).join('');
  const sw = (k, arr, cur) => arr.map((c, i) => `<div class="sw ${un[k].has(i) ? '' : 'locked'} ${i === cur ? 'sel' : ''}" style="background:${c}" data-act="equip" data-k="${k}" data-i="${i}" title="${esc(un[k].has(i) ? 'Color ' + (i + 1) : req(k, i))}"></div>`).join('');
  let body;
  if (tab === 'cube') body = `<div class="skgrid">${grid('skin', 40, sk, i => skinURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'ship') body = `<div class="skgrid">${grid('ship', 40, sh, i => shipURL(i, sk, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'ball') body = `<div class="skgrid">${grid('ball', 40, bl, i => ballURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'ufo') body = `<div class="skgrid">${grid('ufo', 40, uf, i => ufoURL(i, sk, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'wave') body = `<div class="skgrid">${grid('wave', 40, wv, i => waveURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'robot') body = `<div class="skgrid">${grid('robot', 40, rbt, i => robotURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'spider') body = `<div class="skgrid">${grid('spider', 40, spd, i => spiderURL(i, PRIMARY[c1], SECONDARY[c2], 56))}</div>`;
  else if (tab === 'colors') body = `<h3>Primary</h3><div class="swatches">${sw('p', PRIMARY, c1)}</div><h3>Secondary</h3><div class="swatches">${sw('s', SECONDARY, c2)}</div>`;
  else body = ACH.map(a => { const v = achVal(a), done = isEarned(a); return `<div class="ach ${done ? 'done' : ''}"><div><b>${a.name}</b><div class="muted">${a.desc} → ${rwTxt(a)}</div></div><span class="st">${done ? '✔' : fmt(Math.min(v, a.n)) + '/' + fmt(a.n)}</span></div>`; }).join('');
  const tabs = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'colors', 'achievements'].map(t => `<button class="${t === tab ? 'on' : ''}" data-act="costab" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  page('Cosmetics', `<div class="tabs">${tabs}</div><div class="cosm"><div class="preview card"><div class="pvrow"><img src="${myIcon(120)}"><img src="${shipURL(sh, sk, PRIMARY[c1], SECONDARY[c2], 120)}"><img src="${ballURL(bl, PRIMARY[c1], SECONDARY[c2], 120)}"><img src="${ufoURL(uf, sk, PRIMARY[c1], SECONDARY[c2], 120)}"><img src="${waveURL(wv, PRIMARY[c1], SECONDARY[c2], 120)}"><img src="${robotURL(rbt, PRIMARY[c1], SECONDARY[c2], 120)}"><img src="${spiderURL(spd, PRIMARY[c1], SECONDARY[c2], 120)}"></div><div class="muted">${me ? 'Tap an unlocked item to equip it' : 'Log in to unlock cosmetics with achievements'}</div></div><div>${body}</div></div>`);
};

/* ================= community ================= */
const svg = p => `<i class="bb-ico"><svg viewBox="0 0 24 24" fill="#fff">${p}</svg></i>`;
const ICO = { tools: svg('<rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/><rect x="8" y="3" width="8" height="8" rx="2"/>'), star: svg('<polygon points="12,2 15,9 22,9.5 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9.5 9,9"/>'), plus: svg('<circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10" stroke="#1450d0" stroke-width="3"/>'), trophy: svg('<path d="M7 3h10v6a5 5 0 01-10 0zM4 4h3v4H4zM17 4h3v4h-3zM11 14h2v4h3v3H8v-3h3z"/>') };
const nBadge = n => n ? `<em class="nbadge" title="${n} pending friend request${n > 1 ? 's' : ''}">${n > 9 ? '9+' : n}</em>` : '';
views.community = () => {
  const mb = isMod() && modPending ? `<em class="badge">${modPending}</em>` : '', rb = nBadge(reqs.length);
  page('Community', `<div class="grid menu4"><button class="big-btn green" data-act="go" data-v="editor">${ICO.tools}Editor</button><button class="big-btn orange" data-act="go" data-v="levels" data-kind="stars">${ICO.star}Stars</button><button class="big-btn blue" data-act="go" data-v="levels" data-kind="new">${ICO.plus}New Levels${mb}</button><button class="big-btn blue" data-act="go" data-v="search">${ICO.search}Search</button><button class="big-btn red" data-act="go" data-v="lb">${ICO.trophy}<span class="nlab">${rb}Leaderboards &amp; Friends</span></button><button class="big-btn purple" data-act="go" data-v="shop">${ICO.gem}Shop</button></div>`);
};

ICO.search = svg('<circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M15 15l7 7" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>');
ICO.gem = svg('<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 9v13" stroke="#6a1fd0" stroke-width="1.2" fill="none"/>');

/* ================= shop ================= */
const SHOP_ROTATE_DAYS = 1;   // stock reshuffles every N days (same for everybody); set 0 for one permanent stock
const SHOP_PRICES = [100, 150, 200, 250, 300, 400, 500, 600, 750, 1000], SHOP_CPRICES = [100, 150, 200, 250, 300, 400];
const SHOP_NAMES = { skin: 'Cube', ship: 'Ship', ball: 'Ball', ufo: 'UFO', wave: 'Wave', robot: 'Robot', spider: 'Spider' };
const SHOP_GROUPS = { rainbow: 'Rainbow', light: 'Light', dark: 'Dark', muted: 'In-between', gray: 'Grayscale' };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let shopCache = null;
function shopStock() {
  const day = SHOP_ROTATE_DAYS ? Math.floor(Date.now() / 864e5 / SHOP_ROTATE_DAYS) : 1;
  if (shopCache && shopCache.day === day) return shopCache;
  const r = rng(day * 2654435761 + 12345), shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = []; [['skin', 39], ['ship', 39], ['ball', 39], ['ufo', 39], ['wave', 39], ['robot', 39], ['spider', 39]].forEach(([k, n]) => { for (let i = 1; i <= n; i++) pool.push({ k, i }); });
  const icons = shuf(pool).slice(0, 30).map(it => ({ ...it, key: it.k + ':' + it.i, price: SHOP_PRICES[Math.floor(r() * SHOP_PRICES.length)] })).sort((a, b) => a.price - b.price);
  const cols = shuf(Object.keys(SHOP_GROUPS)).map(g => { const a = SPEC.filter(x => x.g === g), x = a[Math.floor(r() * a.length)]; return { k: 'col', g, i: x.i, key: 'col:' + x.i, price: SHOP_CPRICES[Math.floor(r() * SHOP_CPRICES.length)] }; });
  return shopCache = { day, icons, cols };
}
const shopImg = (it, z) => { const c1 = PRIMARY[P?.c1 || 0], c2 = SECONDARY[P?.c2 || 0], sk = P?.skin || 0; return it.k === 'skin' ? skinURL(it.i, c1, c2, z) : it.k === 'ship' ? shipURL(it.i, sk, c1, c2, z) : it.k === 'ball' ? ballURL(it.i, c1, c2, z) : it.k === 'ufo' ? ufoURL(it.i, sk, c1, c2, z) : it.k === 'wave' ? waveURL(it.i, c1, c2, z) : it.k === 'robot' ? robotURL(it.i, c1, c2, z) : spiderURL(it.i, c1, c2, z); };
const shopLabel = it => it.k === 'col' ? `${SHOP_GROUPS[it.g]} color` : `${SHOP_NAMES[it.k]} #${it.i + 1}`;
views.shop = ({ pg = 0 } = {}) => {
  const st = shopStock(), un = unlocked_(), pages = Math.max(1, Math.ceil(st.icons.length / 5)); pg = Math.max(0, Math.min(pages - 1, +pg || 0)); curP = { ...curP, pg };
  const owned = it => it.k === 'col' ? un.p.has(it.i) : un[it.k].has(it.i);
  const card = it => { const o = owned(it), can = (P?.crystals || 0) >= it.price;
    const vis = it.k === 'col' ? `<div class="shsw" style="background:${PRIMARY[it.i]}"></div>` : `<img src="${shopImg(it, 64)}" width="64" height="64">`;
    return `<div class="shopit ${o ? 'owned' : ''}">${vis}<b>${shopLabel(it)}</b>${o ? '<span class="own">✔ Owned</span>' : `<button class="btn sm ${can ? 'green' : ''}" data-act="buy" data-key="${it.key}">💎 ${fmt(it.price)}</button>`}</div>`; };
  const items = st.icons.slice(pg * 5, pg * 5 + 5).map(card).join('');
  const cols = pg === pages - 1 ? `<h3>Colors <span class="muted">(unlock for both primary and secondary)</span></h3><div class="shopgrid">${st.cols.map(card).join('')}</div>` : '';
  page('Shop', `<div class="card shophead"><b>💎 ${fmt(P?.crystals)} gems</b><span class="muted">${me ? 'Stock refreshes daily' : 'Log in to buy things'}</span></div><div class="shopgrid">${items}</div>${cols}<div class="pager"><button class="btn sm" data-act="shoppg" data-pg="${pg - 1}" ${pg <= 0 ? 'disabled' : ''}>◀ Prev</button><b>Page ${pg + 1} / ${pages}</b><button class="btn sm" data-act="shoppg" data-pg="${pg + 1}" ${pg >= pages - 1 ? 'disabled' : ''}>Next ▶</button></div>`);
};
async function buyItem(key) {
  if (!me || !P) throw 'Log in to buy things';
  const st = shopStock(), it = [...st.icons, ...st.cols].find(x => x.key === key); if (!it) throw 'That item is no longer in stock';
  if ((P.bought || []).includes(key)) throw 'You already own that';
  trackMaxCrystals(); if ((P.crystals || 0) < it.price) throw `You need ${fmt(it.price - (P.crystals || 0))} more 💎`;
  if (!confirm(`Buy ${shopLabel(it)} for ${fmt(it.price)} gems?`)) return;
  await updateDoc(doc(db, 'users', me.uid), { crystals: increment(-it.price), bought: arrayUnion(key) });
  P.crystals -= it.price; P.bought = [...(P.bought || []), key]; renderFooter(); toast(`Bought ${shopLabel(it)}!`, 'ok'); views.shop({ pg: curP.pg || 0 });
}

/* ---- level lists ---- */
const LISTS = {}, LV = {};
async function fetchLevels(kind) {
  const s = await getDocs(query(collection(db, 'levels'), where('status', '==', kind === 'stars' ? 'rated' : 'unrated'), limit(200)));
  const a = s.docs.map(d => ({ id: d.id, ...d.data() })); a.sort((x, y) => (y.created?.seconds || 0) - (x.created?.seconds || 0)); return a;
}
function lenSecs(objs, ss = 1) {
  if (!objs.length) return 0;
  const ports = objs.filter(o => SPEEDS[o.t]).sort((a, b) => a.x - b.x);
  let t = 0, x0 = 0, sp = ss || 1; const ex = endCell(objs) * U;
  for (const p of ports) { const px = p.x * U; if (px >= ex) break; t += (px - x0) / (BASE * sp); x0 = px; sp = SPEEDS[p.t]; }
  return t + (ex - x0) / (BASE * sp);
}
function levelLen(l) {
  if (l.len == null) { try { l.len = lenSecs(JSON.parse(l.data).objs || []); } catch { l.len = 0; } }
  return l.len;
}
const LENS = [['tiny', 'Tiny', 10], ['short', 'Short', 30], ['medium', 'Medium', 60], ['long', 'Long', 120], ['xl', 'XL', Infinity]];   // [key, label, upper bound in seconds]
const lenKey = s => s ? LENS.find(x => s < x[2])[0] : '';
function lenTag(l) {
  const s = levelLen(l); if (!s) return '';
  const e = LENS.find(x => s < x[2]);
  return `<span class="len len-${e[0]}" title="${Math.round(s)}s">${e[1]}</span>`;
}
const lvlCard = l => { const d = dOf(l); return `<div class="lvl" data-act="openlvl" data-id="${l.id}"><img src="${diffURL(d ? d.id : 'easy', 56)}" style="${d ? '' : 'filter:grayscale(1) brightness(.6)'}"><div><h3>${esc(l.title)}${beatMark(l.id)} ${lenTag(l)}</h3><div class="muted">by <b class="auth" data-act="profile" data-uid="${l.authorId}">${nameHTML(l.authorName)}</b>${d ? ' · ' + d.name + ' ⭐' + d.stars : ' · Unrated'}</div></div><div class="meta">👍 ${fmt((l.likes || 0) - (l.dislikes || 0))}<br>👁 ${fmt(l.views)}</div></div>`; };
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

/* ---- search ---- */
const SRCH = { q: '', status: 'all', diff: 'any', len: 'any', sort: 'new', pg: 0, res: [], cache: null, loading: false };
async function searchPool(status) {
  const c = SRCH.cache; if (!c || Date.now() - c.t > 120000) SRCH.cache = { t: Date.now(), rated: null, unrated: null };
  const need = status === 'rated' ? ['rated'] : status === 'unrated' ? ['unrated'] : ['rated', 'unrated'];
  for (const k of need) if (!SRCH.cache[k]) SRCH.cache[k] = await fetchLevels(k === 'rated' ? 'stars' : 'new');
  return need.flatMap(k => SRCH.cache[k]);
}
views.search = async () => { SRCH.loading = true; renderSearch(); try { await runSearch(); } catch (e) { toast(errMsg(e), 'err'); } SRCH.loading = false; renderSearch(); };
async function runSearch() {
  const q = SRCH.q.trim().toLowerCase(), lw = LENS.find(x => x[0] === q || x[1].toLowerCase() === q);   // typing "short", "long", "xl"... also matches by length
  let a = await searchPool(SRCH.diff !== 'any' ? 'rated' : SRCH.status);
  if (SRCH.diff !== 'any') a = a.filter(l => dOf(l)?.id === SRCH.diff);
  if (SRCH.len !== 'any') a = a.filter(l => lenKey(levelLen(l)) === SRCH.len);
  if (q) a = a.filter(l => (l.title || '').toLowerCase().includes(q) || (l.authorName || '').toLowerCase().includes(q) || (lw && lenKey(levelLen(l)) === lw[0]));
  a.forEach(l => { LV[l.id] = l; });
  const by = SRCH.sort === 'short' ? (x, y) => levelLen(x) - levelLen(y) : SRCH.sort === 'long' ? (x, y) => levelLen(y) - levelLen(x) : (x, y) => (y.created?.seconds || 0) - (x.created?.seconds || 0);
  SRCH.res = a.slice().sort(by); SRCH.pg = 0;
}
function renderSearch() {
  const a = SRCH.res, pages = Math.max(1, Math.ceil(a.length / 10)), pg = Math.min(SRCH.pg, pages - 1), opt = (v, n, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${n}</option>`;
  const ctl = `<div class="card"><div class="row"><input id="sq" maxlength="40" placeholder="Search by level name, creator or length (tiny, short, medium, long, xl)…" value="${esc(SRCH.q)}" style="flex:1;min-width:200px;margin:0"><button class="btn green sm" data-act="dosearch">🔍 Search</button></div><div class="row" style="margin-top:8px"><label style="flex:1">Status<select id="sstat">${opt('all', 'Rated & unrated', SRCH.status)}${opt('rated', 'Rated only', SRCH.status)}${opt('unrated', 'Unrated only', SRCH.status)}</select></label><label style="flex:1">Rating<select id="sdiff">${opt('any', 'Any', SRCH.diff)}${DIFFS.map(d => opt(d.id, `${d.name} (⭐${d.stars})`, SRCH.diff)).join('')}</select></label></div><div class="row" style="margin-top:8px"><label style="flex:1">Length<select id="slen">${opt('any', 'Any length', SRCH.len)}${LENS.map(([k, n, mx], i) => opt(k, `${n} (${i ? LENS[i - 1][2] : 0}${mx === Infinity ? '+' : '–' + mx}s)`, SRCH.len)).join('')}</select></label><label style="flex:1">Sort by<select id="ssort">${opt('new', 'Newest', SRCH.sort)}${opt('short', 'Shortest first', SRCH.sort)}${opt('long', 'Longest first', SRCH.sort)}</select></label></div></div>`;
  const body = SRCH.loading ? '<p class="muted">Searching…</p>' : a.length ? `<p class="muted">${a.length} level${a.length === 1 ? '' : 's'} found</p><div class="list">${a.slice(pg * 10, pg * 10 + 10).map(lvlCard).join('')}</div><div class="pager"><button class="btn sm" data-act="srchpg" data-pg="${pg - 1}" ${pg <= 0 ? 'disabled' : ''}>◀ Prev</button><b>Page ${pg + 1} / ${pages}</b><button class="btn sm" data-act="srchpg" data-pg="${pg + 1}" ${pg >= pages - 1 ? 'disabled' : ''}>Next ▶</button></div>` : '<p class="muted">No levels match.</p>';
  page('Search Levels', ctl + body);
}
async function doSearch() { SRCH.q = val('sq'); SRCH.status = val('sstat'); SRCH.diff = val('sdiff'); SRCH.len = val('slen') || 'any'; SRCH.sort = val('ssort') || 'new'; SRCH.loading = true; renderSearch(); try { await runSearch(); } catch (e) { toast(errMsg(e), 'err'); } SRCH.loading = false; renderSearch(); const i = $('#sq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'sq') doSearch(); });
document.addEventListener('change', e => { if (['sstat', 'sdiff', 'slen', 'ssort'].includes(e.target.id)) doSearch(); });

/* ---- level page ---- */
let BEATEN = new Set();   // ids of levels the current account (or anonymous browser) has beaten
async function loadBeaten() { BEATEN = new Set(); if (!me) return; try { (await getDocs(collection(db, 'users', me.uid, 'beaten'))).forEach(d => BEATEN.add(d.id)); } catch { } }
const isBeaten = id => BEATEN.has(id) || (!me && !!anonGet('dash_anon_beaten')[id]);
const beatMark = id => isBeaten(id) ? ' <span class="beat" title="Beaten">✔</span>' : '';
const bestKey = id => 'dash_best_' + id;
async function getBest(id) {
  let b = +localStorage[bestKey(id)] || 0;
  if (me) { try { const s = await getDoc(doc(db, 'users', me.uid, 'progress', id)); if (s.exists()) b = Math.max(b, s.data().best || 0); } catch { } }
  return b;
}
async function getProgress(id) {
  let best = +localStorage[bestKey(id)] || 0, gems = 0, attempts = 0;
  if (me) { try { const s = await getDoc(doc(db, 'users', me.uid, 'progress', id)); if (s.exists()) { best = Math.max(best, s.data().best || 0); gems = s.data().gems || 0; attempts = s.data().attempts || 0; } } catch { } }
  return { best, gems, attempts };
}
views.level = async ({ id }) => {
  page('Level', '<p class="muted">Loading…</p>');
  let lv;
  try {
    const snap = await getDoc(doc(db, 'levels', id)); if (!snap.exists()) return page('Level', '<p>This level is no longer on the servers.</p>');
    lv = { id, ...snap.data() }; LV[id] = lv;
  } catch (e) { return page('Level', `<p>${esc(errMsg(e))}</p>`); }
  let my = 0; if (me) { try { const v = await getDoc(doc(db, 'levels', id, 'votes', me.uid)); my = v.exists() ? v.data().v : 0; } catch { } }
  const best = await getBest(id), atts = (await getProgress(id)).attempts, attN = Math.max(atts || 0, +localStorage[attKey(id)] || 0);
  let cms = []; try { cms = (await getDocs(query(collection(db, 'levels', id, 'comments'), orderBy('t', 'desc'), limit(60)))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  const d = dOf(lv), mine = me && lv.authorId === me.uid;
  const dl = (lv.songParts || lv.songUrl) ? (await idbGet('level:' + id) ? '<span class="muted">✔ Song downloaded</span>' : `<button class="btn sm blue" data-act="dlsong" data-id="${id}">⬇ Download song${lv.songName ? ': ' + esc(lv.songName) : ''}</button>`) : '';
  const cmHtml = cms.map(c => `<div class="cm">${isMod() || (me && c.uid === me.uid) ? `<span class="del" data-act="delcm" data-id="${id}" data-cid="${c.id}">✕</span>` : ''}<b data-act="profile" data-uid="${c.uid}">${nameHTML(c.name)}</b><br>${esc(c.text)}</div>`).join('') || '<p class="muted">No comments yet.</p>';
  page(esc(lv.title), `<div class="lp"><div class="lp-main">
    <h1>${esc(lv.title)}${beatMark(id)}</h1><div>by <b style="color:#8fe9ff;cursor:pointer" data-act="profile" data-uid="${lv.authorId}">${nameHTML(lv.authorName)}</b></div>
    <div class="row" style="justify-content:center"><img src="${d ? diffURL(d.id, 56) : diffURL('easy', 56)}" width="56" style="${d ? '' : 'filter:grayscale(1) brightness(.6)'}"><b>${d ? d.name + ' · ⭐ ' + d.stars : 'Unrated'}</b> ${lenTag(lv)}</div>
    ${descBox(lv.desc)}
    <button class="playbtn" data-act="playlvl" data-id="${id}">▶</button>
    <div><button class="btn sm orange" data-act="practicelvl" data-id="${id}">⚑ Practice mode</button></div>
    <div class="pb"><i style="width:${best}%"></i><b>Best: ${best}%</b></div>
    <div class="votes"><button class="round ${my === 1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="1">👍</button><span>${fmt((lv.likes || 0) - (lv.dislikes || 0))}</span><button class="round down ${my === -1 ? 'on' : ''}" data-act="vote" data-id="${id}" data-v="-1">👎</button></div>
    <div class="muted">👁 ${fmt(lv.views)} views · 🎯 ${fmt(attN)} attempts</div>${dl}
    <div class="row" style="justify-content:center">${isMod() ? `<button class="btn orange sm" data-act="ratemenu" data-id="${id}">⭐ Rate</button>` : ''}${isMod() && lv.status === 'rated' ? `<button class="btn sm" data-act="unrate" data-id="${id}">Unrate</button>` : ''}${isMod() || mine ? `<button class="btn red sm" data-act="takedown" data-id="${id}">Take down</button>` : ''}</div>
  </div><div class="side"><h3 style="margin:0 0 8px">Comments</h3><div class="comments">${cmHtml}</div>${me ? `<input id="cmt" maxlength="200" placeholder="Write a comment…"><button class="btn green sm" data-act="comment" data-id="${id}">Post</button>` : '<p class="muted">Log in to comment.</p>'}</div></div>`);
};
// level descriptions: kept in their own scrollable box; line breaks, **bold**, *italic* and "- " bullets are formatted
const fmtDesc = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s.,!?)]|$)/g, '$1<i>$2</i>').replace(/^[-•] /gm, '• ');
const descBox = t => `<div class="descbox"><div class="dh">Description</div><div class="db ${t ? '' : 'none'}">${t ? fmtDesc(t) : 'No description'}</div></div>`;
const voteLock = {}, voteLast = {};
async function vote(id, v) {
  if (!me) return toast('Log in to like or dislike', 'err');
  if (voteLock[id]) return;
  if (Date.now() - (voteLast[id] || 0) < 2500) return toast('Slow down a little!', 'err');
  voteLock[id] = true; voteLast[id] = Date.now();
  const lr = doc(db, 'levels', id), vr = doc(db, 'levels', id, 'votes', me.uid); let author = null, likeDelta = 0;
  try {
    // transaction: re-reads this account's saved vote on every click, so one account can only ever hold one like OR one dislike
    await runTransaction(db, async tx => {
      const vs = await tx.get(vr), ls = await tx.get(lr); if (!ls.exists()) throw 'This level no longer exists';
      author = ls.data().authorId;
      const old = vs.exists() ? (vs.data().v || 0) : 0, nv = old === v ? 0 : v;
      likeDelta = (nv === 1 ? 1 : 0) - (old === 1 ? 1 : 0);
      tx.set(vr, { v: nv, t: serverTimestamp() });
      tx.update(lr, { likes: increment((nv === 1 ? 1 : 0) - (old === 1 ? 1 : 0)), dislikes: increment((nv === -1 ? 1 : 0) - (old === -1 ? 1 : 0)) });
      if (nv !== old) tx.update(doc(db, 'users', author), { netLikes: increment(nv - old) });
    });
    if (likeDelta && P) { P.likesGiven = Math.max(0, (P.likesGiven || 0) + likeDelta); updateDoc(doc(db, 'users', me.uid), { likesGiven: increment(likeDelta) }).catch(() => { }); checkAch(); }
    if (author === me.uid) refreshMyStats();
  } catch (e) { console.error(e); toast('Vote failed: ' + errMsg(e), 'err'); }
  finally { voteLock[id] = false; }
  views.level({ id });
}
async function takeDown(id) {
  const s = await getDoc(doc(db, 'levels', id)); if (!s.exists()) return; const lv = s.data();
  await delCol(['levels', id, 'comments']); await delCol(['levels', id, 'votes']); await delCol(['levels', id, 'songChunks']).catch(() => { });
  await deleteDoc(doc(db, 'levels', id));
  await updateDoc(doc(db, 'users', lv.authorId), { netLikes: increment(-((lv.likes || 0) - (lv.dislikes || 0))) }).catch(() => { });
  if (lv.songUrl) deleteObject(sref(storage, `songs/${id}.mp3`)).catch(() => { });
  slots.forEach(x => { if (x && x.pub === id) x.pub = null; }); saveSlots();
}
// when a level gets rated, its (verified) author is credited with beating it: stars, gems, demons, all star coins
async function awardAuthor(id, L, d) {
  const uid = L.authorId, br = doc(db, 'users', uid, 'beaten', id), pr = doc(db, 'users', uid, 'progress', id);
  const [snap, psnap] = await Promise.all([getDoc(br), getDoc(pr)]);
  const first = !snap.exists(), starred = snap.exists() && snap.data().starred, prevC = snap.exists() ? (snap.data().coins || []) : [];
  let nc = L.coins; if (nc == null) { try { nc = JSON.parse(L.data).objs.filter(o => o.t === 'coin').length; } catch { nc = 0; } }
  const addC = Array.from({ length: nc }, (_, i) => i).filter(i => !prevC.includes(i));
  const gemTotal = GEMS[d.stars], gemHave = psnap.exists() ? (psnap.data().gems || 0) : 0, gems = Math.max(0, gemTotal - gemHave), upd = {};
  if (first) upd.levelsBeaten = increment(1);
  if (!starred) { upd.stars = increment(d.stars * STAR_SCALE); if (d.demon) upd.demons = increment(1); }
  if (gems) upd.crystals = increment(gems);
  if (addC.length) upd.starCoins = increment(addC.length);
  await setDoc(br, { t: serverTimestamp(), starred: true, rd: d.id, level: id, coins: [...prevC, ...addC] }, { merge: true });
  await setDoc(pr, { best: 100, gems: Math.max(gemTotal, gemHave) }, { merge: true });
  if (Object.keys(upd).length) await updateDoc(doc(db, 'users', uid), upd);
  if (me && uid === me.uid) { BEATEN.add(id); localStorage[bestKey(id)] = 100; refreshProfile(); }
}
// Everyone who has beaten a level follows its rating: stars, demon count and the difficulty face on their profile.
// unrated -> they lose the stars and the profile counter moves to UNRATED; re-rated -> stars/counter move to the new difficulty.
// (gems and star coins are kept)
async function reconcileBeaters(id, oldD, newD) {
  const snap = await getDocs(query(collectionGroup(db, 'beaten'), where('level', '==', id)));
  const jobs = snap.docs.map(bd => async () => {
    const uid = bd.ref.parent.parent.id, b = bd.data(), had = !!b.starred;
    const oldId = had ? (DIFFS.find(x => x.id === b.rd) ? b.rd : (oldD && oldD.id)) : null, od = oldId ? DIFFS.find(x => x.id === oldId) : null;
    const fromK = od ? od.id : 'unrated', toK = newD ? newD.id : 'unrated';
    const ds = (newD ? newD.stars * STAR_SCALE : 0) - (od ? od.stars * STAR_SCALE : 0), dm = (newD && newD.demon ? 1 : 0) - (od && od.demon ? 1 : 0);
    if (!ds && !dm && fromK === toK && had === !!newD) return 0;
    const us = await getDoc(doc(db, 'users', uid)); if (!us.exists()) return 0;
    const upd = {};
    if (ds) upd.stars = increment(ds);
    if (dm) upd.demons = increment(dm);
    if (us.data().beatByOk && fromK !== toK) { upd['beatBy.' + fromK] = increment(-1); upd['beatBy.' + toK] = increment(1); }
    if (Object.keys(upd).length) await updateDoc(doc(db, 'users', uid), upd);
    await setDoc(bd.ref, { starred: !!newD, rd: newD ? newD.id : null }, { merge: true });
    return 1;
  });
  let n = 0; for (let i = 0; i < jobs.length; i += 10) n += (await Promise.all(jobs.slice(i, i + 10).map(j => j()))).reduce((a, b) => a + b, 0);
  return n;
}
async function unrateLevel(id) {
  const ls = await getDoc(doc(db, 'levels', id)); if (!ls.exists()) return; const L = ls.data(), oldD = dOf(L); if (!oldD) return toast('Already unrated', 'err');
  await updateDoc(doc(db, 'levels', id), { status: 'unrated', diff: null, stars: 0 });
  let n = 0; try { n = await reconcileBeaters(id, oldD, null); } catch (e) { console.warn(e); toast('Unrated, but could not update players who beat it: ' + errMsg(e), 'err'); }
  if (me) { await loadBeaten(); refreshProfile(); }
  toast(`Unrated · ${n} player${n === 1 ? '' : 's'} lost the stars`, 'ok'); views.level({ id });
}
async function rateLevel(id, diff) {
  const d = DIFFS.find(x => x.id === diff);
  const ls = await getDoc(doc(db, 'levels', id)), L = ls.exists() ? ls.data() : null;
  await updateDoc(doc(db, 'levels', id), { status: 'rated', diff, stars: d.stars * STAR_SCALE });
  if (L) { try { await reconcileBeaters(id, L.status === 'rated' ? dOf(L) : null, d); } catch (e) { console.warn(e); toast('Rated, but could not update players who already beat it: ' + errMsg(e), 'err'); } }
  if (L) { try { await awardAuthor(id, L, d); } catch (e) { console.warn(e); toast('Rated, but could not credit the author: ' + errMsg(e), 'err'); } }
  closeModal(); toast(`Rated ${d.name}`, 'ok'); views.level({ id });
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
let dlT = 0;
async function downloadSong(id) {
  if (Date.now() - dlT < 3000) return; dlT = Date.now();
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
let playT = 0;
async function playPublished(id, practice = false) {
  if (Date.now() - playT < 2000) return; playT = Date.now();   // click cooldown
  const lv = LV[id], vk = 'dash_view_' + (me ? me.uid : 'anon') + '_' + id;   // a play only counts as a view once per 10 min per account/device
  if (Date.now() - (+localStorage[vk] || 0) > 600000) { localStorage[vk] = Date.now(); updateDoc(doc(db, 'levels', id), { views: increment(1) }).catch(() => { }); lv.views = (lv.views || 0) + 1; }
  let songUrl = null;
  if (lv.songParts || lv.songUrl) { let s = await idbGet('level:' + id); if (!s) { toast('Loading song…'); try { s = await fetchSong(id, lv); } catch (e) { toast('Song failed to load: ' + errMsg(e), 'err'); } } if (s instanceof Blob) songUrl = URL.createObjectURL(s); else if (s?.url) songUrl = s.url; }
  const prog = await getProgress(id), prevBest = prog.best, dd = dOf(lv);
  startPlay({ level: { ...JSON.parse(lv.data), rated: lv.status === 'rated' }, kind: 'play', id, lv, songUrl, prevBest, attBase: prog.attempts, practice, gemsGot: prog.gems, gemTotal: (lv.status === 'rated' && dd && me && P) ? GEMS[dd.stars] : 0, songSpeed: lv.songSpeed, songOff: lv.songOff, onExit: () => { showLayer('view'); views.level({ id }); } });
}
const attKey = id => 'dash_att_' + id;
function bumpAttempts() { if (!PL || game.practice) return; if (PL.kind === 'play') { PL.attTot = (PL.attTot || 0) + 1; localStorage[attKey(PL.id)] = PL.attTot; } else if (PL.kind === 'test' && PL.lv0) PL.lv0.attempts = (PL.lv0.attempts || 0) + 1; }   // practice runs don't count
function startPlay(o) {
  cancelFade();
  PL = o; PL.sx = o.startX || 0; PL.sy = o.startY || 0; PL.best = 0;
  PL.attTot = o.kind === 'play' ? Math.max(+localStorage[attKey(o.id)] || 0, o.attBase || 0) : 0;
  $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open'); $('#pfill').style.width = '0'; setPracUI();
  showLayer('play'); setTrack(null);
  game.skin = { id: P?.skin || 0, ship: P?.ship || 0, ball: P?.ball || 0, ufo: P?.ufo || 0, wave: P?.wave || 0, robot: P?.robot || 0, spider: P?.spider || 0, c1: PRIMARY[P?.c1 || 0], c2: SECONDARY[P?.c2 || 0] };
  game.load(o.level); lvAudio = o.songUrl ? new Audio(o.songUrl) : null; if (lvAudio) { const a = lvAudio; a.addEventListener('play', () => { if (a !== lvAudio) a.pause(); }); }   // safety net: an old level's song never plays over a new one
  const pf = $('#pfill'), pp = $('#ppct'); let fw = -1, fpc = -1;
  game.cb = {
    onSpawn: t => { bumpAttempts(); cancelFade(); if (!lvAudio || !settings.music || game.won) return; lvAudio.volume = settings.vol; const go = () => { try { const sp = PL.songSpeed || 1; lvAudio.playbackRate = sp; lvAudio.currentTime = (PL.songOff || 0) / 1000 + t * sp; } catch { } lvAudio.play().catch(() => { }); }; lvAudio.readyState >= 1 ? go() : lvAudio.addEventListener('loadedmetadata', go, { once: true }); },
    onDeath: pct => {
      lvAudio && lvAudio.pause(); sfx('die'); if (PL.practice) return;
      if (PL.kind === 'play') countDeath();
      const ls = PL.kind === 'play' ? (+localStorage[bestKey(PL.id)] || 0) : 0, oldBest = Math.max(PL.best, PL.prevBest || 0, ls), fp = Math.floor(pct);
      if (fp >= 1 && fp > Math.floor(oldBest)) newRecord(fp);
      PL.best = Math.max(PL.best, pct);
      if (PL.kind === 'play') { if (pct > ls) localStorage[bestKey(PL.id)] = fp; if (!me && fp > 0) anonBest(PL.id, fp); }
    },
    onWin: () => { winSongFade(); sfx('win'); pf.style.width = '100%'; pp.textContent = '100%'; $('#winTitle').textContent = PL.practice ? 'Practice Complete!' : 'Level Complete!'; $('#winInfo').textContent = `Attempts: ${game.attempts} · Jumps: ${game.jumps}` + (PL.practice ? ' · practice runs don\'t count' : ''); $('#winBox').classList.add('open'); onWon(); },
    onFrame: pct => { const w = Math.round(pct * 10) / 10; if (w !== fw) { fw = w; pf.style.width = w + '%'; } const f = Math.floor(pct); if (f !== fpc) { fpc = f; pp.textContent = f + '%'; } },
    onPause: pauseToggle
  };
  game.start({ x: PL.sx, y: PL.sy, practice: PL.practice });
}
let fadeT = null, fadeI = null;
function cancelFade() { clearTimeout(fadeT); clearInterval(fadeI); fadeT = fadeI = null; if (lvAudio) lvAudio.volume = settings.vol; }
// after beating a level the song keeps playing for 5 seconds, then fades to nothing over 2.5s
function winSongFade() {
  cancelFade(); const a = lvAudio; if (!a || a.paused) return;
  fadeT = setTimeout(() => { const v0 = a.volume, t0 = performance.now(); fadeI = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 2500); a.volume = Math.max(0, v0 * (1 - k)); if (k >= 1) { clearInterval(fadeI); fadeI = null; a.pause(); a.volume = settings.vol; } }, 50); }, 5000);
}
function pauseToggle() {
  if (game.won) return;
  if (game.paused) { game.resume(); $('#pauseBox').classList.remove('open'); if (lvAudio && !game.p.dead) lvAudio.play().catch(() => { }); }
  else { game.pause(); lvAudio && lvAudio.pause(); const pb = Math.floor(Math.max(PL.prevBest || 0, PL.best || 0, game.best || 0, PL.kind === 'play' ? (+localStorage[bestKey(PL.id)] || 0) : 0)); $('#pauseBest').textContent = (PL.practice ? 'Practice mode · ' : '') + 'Current best: ' + pb + '%'; $('#pracBtn').textContent = 'Practice: ' + (PL.practice ? 'ON' : 'OFF'); $('#pauseBox').classList.add('open'); }
}
async function stopPlay() {
  game.stop(); cancelFade(); lvAudio && lvAudio.pause(); $('#recBox').classList.remove('show'); $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open');
  const p = PL; PL = null; if (p.kind === 'test' && p.lv0) saveSlots(ed.slot);
  if (p.kind === 'play') { const b = p.practice ? 0 : Math.max(+localStorage[bestKey(p.id)] || 0, p.best ? Math.floor(p.best) : 0), up = {}; if (b > 0) up.best = b; if (p.attTot) up.attempts = p.attTot; if (me && Object.keys(up).length) setDoc(doc(db, 'users', me.uid, 'progress', p.id), up, { merge: true }).catch(() => { }); }
  setTrack(p.kind === 'test' ? 'editor' : 'menu'); p.onExit && p.onExit();
}
function setPracUI() { $('#pracHud').style.display = PL?.practice ? 'flex' : 'none'; }
function showRecord(fp, gems) {
  const el = $('#recBox'); el.innerHTML = `<div class="rec-t">NEW RECORD!</div><div class="rec-p">${fp}%</div>${gems ? `<div class="rec-g">+${fmt(gems)} 💎</div>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(showRecord.t); showRecord.t = setTimeout(() => el.classList.remove('show'), 1700);
}
// new record: rated levels pay floor(total gems * record%) minus what was already paid; the rest is paid on beating the level
function newRecord(fp) {
  let gems = 0;
  if (PL.kind === 'play' && PL.gemTotal && me && P) {
    const target = Math.floor(PL.gemTotal * fp / 100), d = target - (PL.gemsGot || 0);
    if (d > 0) {
      gems = d; PL.gemsGot = target; P.crystals = (P.crystals || 0) + d; renderFooter();
      const bt = writeBatch(db); bt.set(doc(db, 'users', me.uid, 'progress', PL.id), { best: Math.max(fp, Math.floor(PL.prevBest || 0)), gems: target }, { merge: true }); bt.update(doc(db, 'users', me.uid), { crystals: increment(d) });
      bt.commit().catch(e => console.warn(e));
    }
  }
  showRecord(fp, gems);
}
const anonGet = k => { try { return JSON.parse(localStorage[k] || '{}'); } catch { return {}; } };
function anonBest(id, pct) { const m = anonGet('dash_anon_best'); if (pct > (m[id] || 0)) { m[id] = pct; localStorage.dash_anon_best = JSON.stringify(m); } }
function recordAnonWin(id, coins) { const m = anonGet('dash_anon_beaten'), e = m[id] || { coins: [] }; e.coins = [...new Set([...(e.coins || []), ...coins])]; m[id] = e; localStorage.dash_anon_beaten = JSON.stringify(m); anonBest(id, 100); }
async function awardWin(id, fb, got) {
  const fresh = await getDoc(doc(db, 'levels', id)); if (!fresh.exists() && !fb) return null;
  const L = fresh.exists() ? fresh.data() : fb, rated = L.status === 'rated', d = dOf(L), ok = rated && !!d;
  const br = doc(db, 'users', me.uid, 'beaten', id), pr = doc(db, 'users', me.uid, 'progress', id), [snap, psnap] = await Promise.all([getDoc(br), getDoc(pr)]);
  const first = !snap.exists(), starred = snap.exists() && snap.data().starred, prevC = snap.exists() ? (snap.data().coins || []) : [];
  const addC = ok ? got.filter(i => !prevC.includes(i)) : [], award = ok && !starred;
  const gemTotal = ok ? GEMS[d.stars] : 0, gemHave = psnap.exists() ? (psnap.data().gems || 0) : 0, gems = Math.max(0, gemTotal - gemHave);
  if (!first && !award && !addC.length && !gems) return { nothing: true, rated };
  const ds = award ? d.stars * STAR_SCALE : 0, upd = {};
  if (first) { upd.levelsBeaten = increment(1); P.levelsBeaten = (P.levelsBeaten || 0) + 1; if (P.beatByOk) { const dk = ok ? d.id : 'unrated'; upd['beatBy.' + dk] = increment(1); P.beatBy = P.beatBy || {}; P.beatBy[dk] = (P.beatBy[dk] || 0) + 1; } }
  if (award) { upd.stars = increment(ds); P.stars = (P.stars || 0) + ds; if (d.demon) { upd.demons = increment(1); P.demons = (P.demons || 0) + 1; } }
  if (gems) { upd.crystals = increment(gems); P.crystals = (P.crystals || 0) + gems; }
  if (addC.length) { upd.starCoins = increment(addC.length); P.starCoins = (P.starCoins || 0) + addC.length; }
  await setDoc(br, { t: serverTimestamp(), starred: starred || ok, ...(ok ? { rd: d.id } : {}), level: id, coins: [...prevC, ...addC] }, { merge: true });
  await setDoc(pr, gemTotal ? { best: 100, gems: Math.max(gemTotal, gemHave) } : { best: 100 }, { merge: true });
  if (Object.keys(upd).length) await updateDoc(doc(db, 'users', me.uid), upd);
  return { first, ok, ds, gems, gemTotal, addC: addC.length, rated };
}
// one-time: builds the per-difficulty beaten counts for accounts made before they were tracked
let bfBusy = false;
async function backfillBeat() {
  if (!me || !P || P.beatByOk || bfBusy) return; bfBusy = true;
  try {
    const u0 = (await getDoc(doc(db, 'users', me.uid))).data() || {}; if (u0.beatByOk) { P.beatByOk = true; P.beatBy = u0.beatBy || {}; return; }
    const ids = (await getDocs(collection(db, 'users', me.uid, 'beaten'))).docs.map(d => d.id), by = {};
    for (let i = 0; i < ids.length; i += 20) await Promise.all(ids.slice(i, i + 20).map(async id => { let k = 'unrated'; try { const sn = await getDoc(doc(db, 'levels', id)); if (sn.exists() && sn.data().status === 'rated') { const d = dOf(sn.data()); if (d) k = d.id; } } catch { } by[k] = (by[k] || 0) + 1; }));
    await updateDoc(doc(db, 'users', me.uid), { beatBy: by, beatByOk: true }); P.beatBy = by; P.beatByOk = true;
  } catch (e) { console.warn('beatBy backfill', e); } finally { bfBusy = false; }
}
// wins made while Anonymous are carried over to the account created afterwards
async function transferAnon() {
  if (!me || !P) return;
  const beaten = anonGet('dash_anon_beaten'), bests = anonGet('dash_anon_best'), ids = Object.keys(beaten);
  if (!ids.length && !Object.keys(bests).length) return;
  let n = 0, stars = 0, gems = 0;
  for (const id of ids) { try { const r = await awardWin(id, null, beaten[id].coins || []); if (r && !r.nothing) { n++; stars += r.ds; gems += r.gems; } } catch (e) { console.warn(e); } }
  for (const [id, bst] of Object.entries(bests)) { if (beaten[id]) continue; try { await setDoc(doc(db, 'users', me.uid, 'progress', id), { best: bst }, { merge: true }); } catch { } }
  delete localStorage.dash_anon_beaten; delete localStorage.dash_anon_best;
  renderFooter(); checkAch(); loadBeaten();
  if (n) toast(`Carried over ${n} beaten level${n > 1 ? 's' : ''} from Anonymous: +${stars} ⭐ +${fmt(gems)} 💎`, 'ok');
}
async function onWon() {
  const p = PL; if (!p) return; const got = [...game.coinSet];
  if (p.practice) return;
  if (p.kind === 'test') {
    if (p.sx !== 0 || p.sy !== 0) return toast('Beat it from the very start to verify', '');
    if (got.length < game.coinTotal) return toast(`Collect all ${game.coinTotal} star coins to verify (got ${got.length})`, 'err');
    p.lv0.verified = sigOf(p.lv0.objs); saveSlots(ed.slot); toast('✔ Level verified! You can now upload it.', 'ok'); return;
  }
  localStorage[bestKey(p.id)] = 100; p.best = 100; BEATEN.add(p.id);
  if (!me || !P) { recordAnonWin(p.id, got); toast('Beaten as Anonymous - sign up and it will carry over to your new account!'); return; }
  try {
    const r = await awardWin(p.id, p.lv, got); if (!r) return;
    if (r.nothing) return toast('Already completed', '');
    p.gemsGot = Math.max(p.gemsGot || 0, r.gemTotal);
    if (r.gems && PL === p) $('#winInfo').textContent += ` · +${fmt(r.gems)} 💎`;
    renderFooter(); checkAch();
    toast((r.ok ? `+${r.ds} stars!` : 'Level beaten!') + (r.gems ? ` +${fmt(r.gems)} 💎` : '') + (r.addC ? ` +${r.addC} 🪙` : (got.length && !r.rated ? ' (copper coins only count once rated)' : '')), 'ok');
  } catch (e) { console.error(e); toast('Could not save your win: ' + errMsg(e), 'err'); }
}

/* ================= leaderboards / friends / DMs ================= */
const STATS = { stars: 'Stars', starCoins: 'Star Coins', netLikes: 'Likes', levelsBeaten: 'Levels Beaten', demons: 'Demons' };
views.lb = async (p = {}) => {
  const tab = p.tab || 'global', stat = p.stat || 'stars'; curP = { ...p, tab, stat };
  const tabs = `<div class="tabs"><button class="${tab === 'global' ? 'on' : ''}" data-act="lbtab" data-t="global">Global</button><button class="${tab === 'fboard' ? 'on' : ''}" data-act="lbtab" data-t="fboard">Friends Board</button><button class="${tab === 'friends' ? 'on' : ''}" data-act="lbtab" data-t="friends"><span class="nlab">${nBadge(reqs.length)}Friends</span></button></div>`;
  if (tab === 'global') {
    const sel = `<div class="tabs">${Object.entries(STATS).map(([k, v]) => `<button class="${k === stat ? 'on' : ''}" data-act="lbtab" data-t="global" data-stat="${k}">${v}</button>`).join('')}</div>`;
    page('Leaderboards', tabs + sel + '<p class="muted">Loading…</p>');
    try {
      const s = await getDocs(query(collection(db, 'users'), orderBy(stat, 'desc'), limit(100)));
      page('Leaderboards', tabs + sel + `<div class="list">${s.docs.map((d, i) => { const u = d.data(); return `<div class="lb" data-act="profile" data-uid="${d.id}"><span class="rk">#${i + 1}</span><img src="${userIcon(u, 40)}"><b>${nameHTML(u.username)}</b><span class="v">${fmt(u[stat])}</span></div>`; }).join('') || '<p class="muted">Nobody yet.</p>'}</div>`);
    } catch (e) { page('Leaderboards', tabs + `<p>${esc(errMsg(e))}</p>`); }
  } else if (tab === 'fboard') {
    const sel = `<div class=\"tabs\">${Object.entries(STATS).map(([k, v]) => `<button class=\"${k === stat ? 'on' : ''}\" data-act=\"lbtab\" data-t=\"fboard\" data-stat=\"${k}\">${v}</button>`).join('')}</div>`;
    if (!me) return page('Leaderboards', tabs + '<p>Log in to see how you stack up against your friends.</p>');
    page('Leaderboards', tabs + sel + '<p class=\"muted\">Loading…</p>');
    try {
      const fr = (await getDocs(collection(db, 'friends', me.uid, 'list'))).docs.map(d => d.id);
      const docs = await Promise.all([me.uid, ...fr].map(id => getDoc(doc(db, 'users', id)).catch(() => null)));
      const rows = docs.filter(d => d && d.exists()).map(d => ({ id: d.id, u: d.data() })).sort((a, b) => (b.u[stat] || 0) - (a.u[stat] || 0) || a.u.username.localeCompare(b.u.username));
      const note = fr.length ? '' : '<p class=\"muted\">Add some friends (Friends tab) and they will show up here next to you.</p>';
      page('Leaderboards', tabs + sel + `<div class=\"list\">${rows.map((r, i) => `<div class=\"lb ${r.id === me.uid ? 'me' : ''}\" data-act=\"profile\" data-uid=\"${r.id}\"><span class=\"rk\">#${i + 1}</span><img src=\"${userIcon(r.u, 40)}\"><b>${nameHTML(r.u.username)}${r.id === me.uid ? ' <span class=\"muted\">(you)</span>' : ''}</b><span class=\"v\">${fmt(r.u[stat])}</span></div>`).join('')}</div>${note}`);
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
  const pc1 = PRIMARY[u.c1 || 0], pc2 = SECONDARY[u.c2 || 0], psk = u.skin || 0;
  const pic = [['Cube', skinURL(psk, pc1, pc2, 44)], ['Ship', shipURL(u.ship || 0, psk, pc1, pc2, 44)], ['Ball', ballURL(u.ball || 0, pc1, pc2, 44)], ['UFO', ufoURL(u.ufo || 0, psk, pc1, pc2, 44)], ['Wave', waveURL(u.wave || 0, pc1, pc2, 44)], ['Robot', robotURL(u.robot || 0, pc1, pc2, 44)], ['Spider', spiderURL(u.spider || 0, pc1, pc2, 44)]];
  const bb = u.beatBy || {}, hasB = !!u.beatByOk;
  const brk = [...DIFFS.map(d => [d.id, d.name, false]), ['unrated', 'UNRATED', true]].map(([id, n, un]) => `<div title="${n}"><img src="${diffURL(un ? 'easy' : id, 48)}" width="48" height="48" style="${un ? 'filter:grayscale(1) brightness(.6)' : ''}"><b>${hasB ? fmt(bb[id] || 0) : '–'}</b></div>`).join('');
  modal(`<h2>${nameHTML(u.username)}</h2><div class="row" style="align-items:flex-start"><img src="${userIcon(u, 96)}" width="96" height="96"><div style="flex:1"><div class="picons">${pic.map(([n, src]) => `<div title="${n}"><img src="${src}" width="44" height="44"><small>${n}</small></div>`).join('')}</div><button class="btn blue sm" data-act="beatbreak">✅ ${fmt(u.levelsBeaten)} levels beaten ▾</button></div></div><div id="beatBrk" class="brk" style="display:none">${brk}</div><div class="muted" style="font-size:16px;margin-top:8px">⭐ ${fmt(u.stars)} stars · 🪙 ${fmt(u.starCoins)} star coins · 😈 ${fmt(u.demons)} demons<br>👍 ${fmt(u.netLikes)} net likes · 👁 ${fmt(u.totalViews)} total views</div><div class="row" style="margin:12px 0">${acts}${ban}</div><h3>Levels</h3><div class="list">${ls.map(lvlCard).join('') || '<p class="muted">No published levels.</p>'}</div>`, true);
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
function loadSlots() { try { slots = JSON.parse(localStorage[skey()] || '[]'); } catch { slots = []; } slots.forEach(l => { if (l) { l.name = String(l.name || '').slice(0, 18); l.desc = String(l.desc || '').slice(0, 200); } }); while (slots.length && !slots[slots.length - 1]) slots.pop(); }
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
let EDPG = 0;
const edRefresh = () => cur === 'draft' ? views.draft(curP) : views.editor();
views.editor = () => {
  if (!me) { return page('Editor', '<div class="card"><h3>Log in to create levels</h3><p class="muted">Anonymous players can view and play levels. Open the Account menu to log in or sign up.</p><button class="btn green" data-act="go" data-v="account">Account</button></div>'); }
  const idx = slots.map((l, i) => l ? i : -1).filter(i => i >= 0).sort((a, b) => (slots[b].updated || 0) - (slots[a].updated || 0));
  const pages = Math.max(1, Math.ceil(idx.length / 10)); EDPG = Math.max(0, Math.min(EDPG, pages - 1));
  const rows = idx.slice(EDPG * 10, EDPG * 10 + 10).map(i => {
    const l = slots[i], ok = l.verified === sigOf(l.objs), pub = !!l.pub;
    return `<div class="lvl" data-act="draftopen" data-i="${i}"><img src="${diffURL('easy', 56)}" style="filter:grayscale(1) brightness(.6)"><div><h3>${esc(l.name)}</h3><div class="muted">${l.objs.length} objects · ${pub ? '🌐 Published' : ok ? '✔ Verified' : 'Not verified'}${l.songName ? ' · 🎵 ' + esc(l.songName) : ''}</div></div></div>`;
  }).join('');
  page('Level Editor', `<div class="row" style="margin-bottom:12px"><button class="round" data-act="slotnew" title="New level" style="font-size:30px;line-height:1">＋</button><span class="muted">New level · click a level to open it. Beat it from 0-100% to unlock Upload.</span></div>${idx.length ? `<div class="list">${rows}</div>` : '<p class="muted">No levels yet - press ＋ to make one.</p>'}<div class="pager"><button class="btn sm" data-act="edpg" data-pg="${EDPG - 1}" ${EDPG <= 0 ? 'disabled' : ''}>◀ Prev</button><b>Page ${EDPG + 1} / ${pages}</b><button class="btn sm" data-act="edpg" data-pg="${EDPG + 1}" ${EDPG >= pages - 1 ? 'disabled' : ''}>Next ▶</button></div>`);
};
views.draft = ({ i }) => {
  const l = slots[i]; if (!me || !l) return page('Level', '<p class="muted">Level not found.</p>');
  const ok = l.verified === sigOf(l.objs), pub = !!l.pub;
  page(esc(l.name), `<div class="lp"><div class="lp-main">
    <h1>${esc(l.name)}</h1><div>by <b style="color:#8fe9ff">${nameHTML(P.username)}</b> · <span class="muted">${l.objs.length} objects</span></div>
    <div class="row" style="justify-content:center"><img src="${diffURL('easy', 56)}" width="56" style="filter:grayscale(1) brightness(.6)"><b>${pub ? 'Published' : 'Unrated · ' + (ok ? '✔ Verified' : 'Not verified')}</b></div>
    ${descBox(l.desc)}
    <div class="row" style="justify-content:center"><button class="playbtn" data-act="draftplay" data-i="${i}" title="Play">▶</button>${pub ? '' : `<button class="playbtn wrench" data-act="slotedit" data-i="${i}" title="Edit">🔧</button>`}</div>
    <div class="row" style="justify-content:center"><button class="btn sm" data-act="slotrename" data-i="${i}">Rename</button><button class="btn sm" data-act="slotdesc" data-i="${i}">Description</button>${pub ? `<button class="btn blue sm" data-act="openlvl" data-id="${l.pub}">View online</button>` : `<button class="btn green sm" data-act="slotpub" data-i="${i}" ${ok ? '' : 'disabled'}>⬆ Upload</button>`}<button class="btn sm" data-act="slotcopy" data-i="${i}">Copy</button></div>
    <div class="row" style="justify-content:center"><button class="btn sm blue" data-act="importlvl" data-i="${i}">⬇ Import</button><button class="btn sm blue" data-act="exportlvl" data-i="${i}">⬆ Export</button><button class="btn red sm" data-act="slotdel" data-i="${i}" title="Delete level">🗑</button></div>
    <div class="votes"><button class="round" disabled title="Locked until posted">👍</button><span>🔒</span><button class="round down" disabled title="Locked until posted">👎</button></div>
    <div class="muted">${l.songName ? '🎵 ' + esc(l.songName) : 'No song'} · 🎯 ${fmt(l.attempts || 0)} attempts</div>
  </div><div class="side"><h3 style="margin:0 0 8px">Comments 🔒</h3><div class="comments"><p class="muted">Comments and likes unlock once this level is posted.</p></div><input disabled placeholder="Locked until posted"><button class="btn green sm" disabled>Post</button></div></div>`);
};
function draftPlay(i) {
  const lv = slots[i]; if (!lv) return;
  ed.slot = i; ed.lv = lv; ed.posMode = false; ed.spawn = null; saveSlots(i);
  idbGet(`draft:${me.uid}:${i}`).then(b => startPlay({ level: { objs: lv.objs, bg: lv.bg, ground: lv.ground, bgs: lv.bgs, grs: lv.grs, startMode: lv.startMode, startSpeed: lv.startSpeed }, kind: 'test', lv0: lv, songSpeed: lv.songSpeed, songOff: lv.songOff, startX: 0, startY: 0, songUrl: b instanceof Blob ? URL.createObjectURL(b) : null, onExit: () => { showLayer('view'); views.draft({ i }); } }));
}
function exportLevel(i) {
  const l = slots[i]; if (!l) return;
  const o = { dashLevel: 1, name: l.name, desc: l.desc, bg: l.bg, ground: l.ground, bgs: l.bgs, grs: l.grs, startMode: l.startMode, startSpeed: l.startSpeed, songSpeed: l.songSpeed, songOff: l.songOff, objs: l.objs };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })); a.download = (l.name.replace(/[^\w\- ]+/g, '').trim() || 'level') + '.dashlevel.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Level exported (the song file is not included)', 'ok');
}
function importLevel(i) {
  const l = slots[i]; if (!l) return; if (l.pub) return toast("Published levels can't be changed", 'err');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; if (f.size > 900000) return toast('File too big', 'err');
    let o; try { o = JSON.parse(await f.text()); } catch { return toast('Not a valid level file', 'err'); }
    if (!o || !Array.isArray(o.objs)) return toast('Not a valid level file', 'err');
    const objs = o.objs.filter(q => q && typeof q.t === 'string' && OBJ[q.t] && Number.isFinite(q.x) && Number.isFinite(q.y)).map(q => { const c = {}; for (const [k, v] of Object.entries(q)) if (['number', 'boolean'].includes(typeof v) || (typeof v === 'string' && v.length <= 40)) c[k] = v; return c; });
    if (!objs.length) return toast('No objects found in that file', 'err');
    if (l.objs.length && !confirm(`Replace this level's ${l.objs.length} objects with ${objs.length} imported objects?`)) return;
    const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    l.objs = objs; if (typeof o.name === 'string' && o.name.trim()) l.name = o.name.trim().slice(0, 18); if (typeof o.desc === 'string') l.desc = o.desc.slice(0, 200);
    if (hex(o.bg)) l.bg = o.bg; if (hex(o.ground)) l.ground = o.ground;
    if (BGS.some(b => b[0] === o.bgs)) l.bgs = o.bgs; if (GRS.some(b => b[0] === o.grs)) l.grs = o.grs;
    if (['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'].includes(o.startMode)) l.startMode = o.startMode; if ([.8, 1, 1.3, 1.6].includes(o.startSpeed)) l.startSpeed = o.startSpeed;
    l.verified = ''; l.updated = Date.now(); saveSlots(i); toast(`Imported ${objs.length} objects - beat it to verify`, 'ok'); edRefresh();
  };
  inp.click();
}

/* ================= editor: canvas ================= */
const ed = { on: false, slot: -1, lv: null, camX: -90, camY: -80, z: 1, mode: 'build', tool: 'block', rot: 0, rot45: 0, sel: null, sels: [], clip: [], hist: [], mx: 300, my: 300, wx: 0, wy: 0, drag: null, tab: 'blocks', posMode: false, spawn: null };
const iconCache = {};
function objIcon(t) {
  if (iconCache[t]) return iconCache[t];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const o = { t, r: 0, col: t === 'trig_color' ? '#ff5252' : undefined };
  if (t.startsWith('port')) drawObj(c, o, 24, 44, 16, '#000', true); else if (OBJ[t].tall) drawObj(c, o, 19, 34, 26, defColor(t), true); else drawObj(c, o, 10, 10, 44, defColor(t), true);
  return iconCache[t] = cv.toDataURL();
}
function openEditor(i) {
  ed.slot = i; ed.lv = slots[i]; ed.camX = -300; ed.camY = -80; ed.z = 1; ed.sel = null; ed.sels = []; ed.hist = []; ed.redo = []; ed.mode = 'build'; ed.posMode = false; ed.spawn = null; ed.on = true;
  showLayer('edit'); setTrack('editor'); renderEdUI(); renderProps(); edDraw();
}
function renderEdUI() {
  document.querySelectorAll('#edModes button').forEach(b => b.classList.toggle('on', b.dataset.m === ed.mode));
  const cats = [...new Set(Object.values(OBJ).map(o => o.cat))]; cats.push('edit');
  $('#edTabs').innerHTML = cats.map(c => `<button class="${c === ed.tab ? 'on' : ''}" data-act="edtab" data-c="${c}">${c}</button>`).join('') + `<button data-act="edrotl">↺ Q</button><button data-act="edrotr">↻ E</button><button data-act="edrot45" title="Rotate 45 degrees (R)">⟳ 45°</button><button data-act="edcopy">Copy</button><button data-act="edpaste">Paste</button>`;
  $('#edItems').innerHTML = ed.tab === 'edit' ? EDPANEL() : Object.entries(OBJ).filter(([, o]) => o.cat === ed.tab).map(([t, o]) => `<button class="it ${t === ed.tool ? 'on' : ''}" data-act="edtool" data-t="${t}"><img src="${objIcon(t)}">${o.name}</button>`).join('');
  const pb = $('#edPosBtn'); if (pb) { pb.textContent = '📍 Play at position: ' + (ed.posMode ? 'ON' : 'OFF'); pb.classList.toggle('green', ed.posMode); }
  const ok = ed.lv && ed.lv.verified === sigOf(ed.lv.objs); $('#edStatus').textContent = `${ed.lv.name} · ${ed.lv.objs.length} obj · ${ok ? '✔ Verified' : 'Not verified'}`;
}
const r3 = v => Math.round(v * 1000) / 1000, oh = o => o.t.startsWith('port') ? PH : OBJ[o.t].tall ? 2 : 1;
// bounding box in cells (portals are 3 tall; rotated 90/270 they lie flat: 3 wide, 1 tall, centred on the same spot)
const objBox = o => { if (o.t.startsWith('port') && o.r45) return { x: o.x - 1, y: o.y, w: 3, h: 3 }; if (!o.t.startsWith('port') || ((o.r || 0) & 1) === 0) return { x: o.x, y: o.y, w: 1, h: oh(o) }; return { x: o.x - 1, y: o.y + 1, w: 3, h: 1 }; };
function EDPANEL() {
  const arrows = (n, k) => `<div class="eg"><b>Move ${n}</b><div class="row2"><button class="btn sm" data-act="edhalf" data-dx="${-k}" data-dy="0">◀</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy="${k}">▲</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy="${-k}">▼</button><button class="btn sm" data-act="edhalf" data-dx="${k}" data-dy="0">▶</button></div></div>`;
  return `<div class="eg"><b>Rotate 90°</b><div class="row2"><button class="btn sm" data-act="edxf" data-k="ccw">↺ Left</button><button class="btn sm" data-act="edxf" data-k="cw">↻ Right</button></div></div><div class="eg"><b>Mirror</b><div class="row2"><button class="btn sm" data-act="edxf" data-k="mx">⇋ X axis</button><button class="btn sm" data-act="edxf" data-k="my">⇅ Y axis</button></div></div>` + arrows('½', .5) + arrows('1', 1) + arrows('5', 5) + arrows('1/10', .1) + `<div class="eg"><b>Tip</b><span class="muted" style="font-size:13px;max-width:190px">Use Edit mode to select objects (Shift = multi-select). Rotate/mirror act on the whole selection.</span></div>`;
}
function edXform(kind) {
  if (!ed.sels.length) return toast('Select something first (Edit mode)', 'err');
  snap(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of ed.sels) { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + 1); y1 = Math.max(y1, o.y + oh(o)); }   // (selection centre uses each object's anchor cell)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (const o of ed.sels) {
    const h = oh(o), ox = o.x + .5 - cx, oy = o.y + h / 2 - cy, r = ((o.r || 0) % 4 + 4) % 4, sl = !!OBJ[o.t].slope;
    const [nx, ny] = kind === 'cw' ? [oy, -ox] : kind === 'ccw' ? [-oy, ox] : kind === 'mx' ? [-ox, oy] : [ox, -oy];
    o.x = r3(cx + nx - .5); o.y = r3(cy + ny - h / 2);
    if (kind === 'cw') o.r = (r + 1) % 4; else if (kind === 'ccw') o.r = (r + 3) % 4;
    else if (kind === 'mx') o.r = sl ? r ^ 1 : (r & 1 ? (4 - r) % 4 : r);
    else { o.r = sl ? 3 - r : (r & 1 ? r : (r + 2) % 4); if (DASH[o.t] && o.a) o.a = -o.a; }
  }
  const mx = Math.min(...ed.sels.map(o => o.x)), my = Math.min(...ed.sels.map(o => o.y)), sx = Math.max(0, -mx), sy = Math.max(0, -my);
  if (sx || sy) ed.sels.forEach(o => { o.x = r3(o.x + sx); o.y = r3(o.y + sy); });
  changed(); renderProps();
}
const snap = () => { const s = JSON.stringify(ed.lv.objs); if (ed.hist[ed.hist.length - 1] !== s) { ed.hist.push(s); if (ed.hist.length > 60) ed.hist.shift(); } };
let asT = null;
function changed() { if (!ed.keepRedo) ed.redo = []; ed.lv.updated = Date.now(); clearTimeout(asT); asT = setTimeout(() => saveSlots(ed.slot), 800); renderEdUI(); }
function s2w(e) { const cv = $('#editCanvas'), H = cv.clientHeight; ed.mx = e.offsetX; ed.my = e.offsetY; ed.wx = e.offsetX / ed.z + ed.camX; ed.wy = (H - e.offsetY) / ed.z + ed.camY; return [ed.wx, ed.wy]; }
const under = (o, wx, wy) => { const px = wx / U, py = wy / U, b = objBox(o); return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h; };
function pick(wx, wy) { const os = ed.lv.objs; for (let i = os.length - 1; i >= 0; i--) if (under(os[i], wx, wy)) return os[i]; return null; }
function place(cx, cy) {
  if (cx < 0 || cy < 0) return; const lv = ed.lv, t = ed.tool;
  if (t === 'coin' && lv.objs.filter(o => o.t === 'coin').length >= 3 && !lv.objs.some(o => o.t === 'coin' && o.x === cx && o.y === cy)) return toast('Max 3 star coins per level', 'err');
  if (lv.objs.some(o => o.t === t && o.x === cx && o.y === cy && (o.r || 0) === ed.rot && (o.r45 || 0) === (no45({ t }) ? 0 : ed.rot45))) return;
  if (!OBJ[t].trig && !OBJ[t].deco && !OBJ[t].zone) lv.objs = lv.objs.filter(o => !(o.t === t && o.x === cx && o.y === cy));   // blocks / hazards can now be stacked: only the same object type gets replaced
  if (t === 'trig_end') lv.objs = lv.objs.filter(o => o.t !== 'trig_end');
  const o = { t, x: cx, y: cy, r: ed.rot, g: 0 }; if (ed.rot45 && !no45(o)) o.r45 = 1;
  if (t === 'block' || t === 'spike' || t === 'half' || (OBJ[t].slope && !OBJ[t].slide)) o.c = '#0d0d22';
  if (t === 'trig_pulse') Object.assign(o, { col: '#ffffff', dur: .5 });
  if (t === 'trig_color') { const pv = [...lv.objs].reverse().find(q => q.t === 'trig_color'); Object.assign(o, { tg: pv ? pv.tg : 0, col: '#ff5252', dur: pv ? pv.dur : 1 }); }
  if (t === 'trig_move') Object.assign(o, { tg: 1, dx: 5, dy: 0, dur: 1, fx: false, fy: false });
  if (t === 'trig_zoom') Object.assign(o, { zoom: 1.5, dur: 1 });
  if (t === 'trig_toggle') Object.assign(o, { tg: 1, on: false });
  if (t === 'trig_alpha') Object.assign(o, { tg: 1, pc: 50, dur: 1 });
  if (OBJ[t].trig) o.touch = false;
  if (DASH[t]) o.a = 0;
  lv.objs.push(o); if (t === 'trig_color' || t === 'trig_pulse' || OBJ[t].zone) { ed.sel = o; ed.sels = [o]; renderProps(); } changed();
}
function delAt(wx, wy) { const n = ed.lv.objs.length; ed.lv.objs = ed.lv.objs.filter(o => !under(o, wx, wy)); if (ed.sel && !ed.lv.objs.includes(ed.sel)) { ed.sel = null; renderProps(); } if (n !== ed.lv.objs.length) changed(); }
const HALF = '<div class="row"><button class="btn sm" data-act="edhalf" data-dx="-.5" data-dy="0">◀½</button><button class="btn sm" data-act="edhalf" data-dx=".5" data-dy="0">½▶</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy=".5">▲½</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy="-.5">▼½</button><button class="btn sm" data-act="edscale" data-f="-.1">⤡ −</button><button class="btn sm" data-act="edscale" data-f=".1">⤢ +</button></div>';
function renderProps() {
  const el = $('#edProps'), o = ed.sel; if (!ed.sels.length) return el.classList.remove('open'); el.classList.add('open');
  if (!o) { el.innerHTML = `<h3>${ed.sels.length} selected</h3><label>Group (0 = none)<span class="gp"><input type="number" min="0" data-p="g" value="${ed.sels[0].g || 0}"><button class="btn sm green" data-act="edgrp" title="Use the next unused group ID">+</button></span></label><label>Color<input type="color" data-p="c" value="${ed.sels[0].c || '#0d0d22'}"></label><div class="row"><button class="btn sm" data-act="edrotl">↺ Left</button><button class="btn sm" data-act="edrotr">↻ Right</button><button class="btn sm" data-act="edrot45">⟳ 45°</button><button class="btn sm" data-act="edcopy">Copy</button><button class="btn sm red" data-act="eddel">Delete</button></div><div class="row"><button class="btn sm" data-act="edhalf" data-dx="-.5" data-dy="0">◀½</button><button class="btn sm" data-act="edhalf" data-dx=".5" data-dy="0">½▶</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy=".5">▲½</button><button class="btn sm" data-act="edhalf" data-dx="0" data-dy="-.5">▼½</button><button class="btn sm" data-act="edscale" data-f="-.1">⤡ −</button><button class="btn sm" data-act="edscale" data-f=".1">⤢ +</button></div>`; return; }
  let h = `<h3>${OBJ[o.t].name}</h3>`;
  if (o.t === 'trig_color') h += `<label>Target group (0 = background, -1 = ground)<input type="number" data-p="tg" value="${o.tg}"></label><label>Color<input type="color" data-p="col" value="${o.col}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_move') h += `<label>Target group<input type="number" min="1" data-p="tg" value="${o.tg}"></label><label>Move X (blocks)<input type="number" data-p="dx" value="${o.dx}"></label><label>Move Y (blocks)<input type="number" data-p="dy" value="${o.dy}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label><label>Follow player X<input type="checkbox" data-p="fx" ${o.fx ? 'checked' : ''}> moves up/down with the player</label><label>Follow player Y<input type="checkbox" data-p="fy" ${o.fy ? 'checked' : ''}> moves right with the player</label>`;
  else if (o.t === 'trig_zoom') h += `<label>Zoom (1 = default)<input type="number" step=".1" min=".2" max="4" data-p="zoom" value="${o.zoom ?? 1}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_toggle') h += `<label>Target group<input type="number" min="1" data-p="tg" value="${o.tg}"></label><label>Enable group<input type="checkbox" data-p="on" ${o.on ? 'checked' : ''}> ${o.on ? 'ON' : 'OFF'}</label>`;
  else if (o.t === 'trig_alpha') h += `<label>Target group<input type="number" min="1" data-p="tg" value="${o.tg}"></label><label>Opacity (%)<input type="number" min="0" max="100" data-p="pc" value="${o.pc ?? 100}"></label><label>Duration (s)<input type="number" step=".1" min="0" data-p="dur" value="${o.dur}"></label>`;
  else if (o.t === 'trig_pulse') h += `<label>Pulse color<input type="color" data-p="col" value="${o.col || '#ffffff'}"></label><label>Fade out time (s)<input type="number" step=".1" min=".05" data-p="dur" value="${o.dur ?? .5}"></label><p class="muted">Flashes the background with this color, then fades it out.</p>`;
  else if (o.t === 'zone_d') h += '<p class="muted">Place above (or below) blocks or slopes: the blocks stay solid, but the wave slides along their top / underside like ground instead of dying. Hitting a block's side or a spike still kills. Invisible in play.</p><div class="row"><button class="btn sm red" data-act="eddel">Delete</button></div>';
  else if (o.t === 'zone_s') h += '<p class="muted">Place in front of a dash orb: entering it cancels the dash so you stop dashing. Invisible in play.</p><div class="row"><button class="btn sm red" data-act="eddel">Delete</button></div>';
  else if (o.t === 'trig_end') h += '<p class="muted">Touching this ends the level. While one is placed it replaces the automatic end zone (3 blocks past the last object).</p>';
  else { h += `<label>Group (0 = none)<span class="gp"><input type="number" min="0" data-p="g" value="${o.g || 0}"><button class="btn sm green" data-act="edgrp" title="Use the next unused group ID">+</button></span></label>`; if (OBJ[o.t].solid || OBJ[o.t].hz || OBJ[o.t].deco) h += `<label>Color<input type="color" data-p="c" value="${o.c || defColor(o.t)}"></label>`; if (DASH[o.t]) h += `<label>Dash angle (-75..75)<input type="number" min="-75" max="75" step="15" data-p="a" value="${o.a || 0}"></label>`; }
  if (OBJ[o.t].zone) { el.innerHTML = h; return; }
  if (OBJ[o.t].trig) h += `<label>Own group (for toggles)<span class="gp"><input type="number" min="0" data-p="g" value="${o.g || 0}"><button class="btn sm green" data-act="edgrp" title="Use the next unused group ID">+</button></span></label><label>Touch trigger<input type="checkbox" data-p="touch" ${o.touch ? 'checked' : ''}> only when touched</label>`;
  else if (!OBJ[o.t].slope) h += `<label>Scale (0.1 - 5)<input type="number" min=".1" max="5" step=".1" data-p="sc" value="${o.sc || 1}"></label>`;
  h += `<div class="row"><button class="btn sm" data-act="edrotl">↺</button><button class="btn sm" data-act="edrotr">↻</button><button class="btn sm" data-act="edrot45">⟳ 45°</button><button class="btn sm red" data-act="eddel">Delete</button></div>` + HALF; el.innerHTML = h;
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
  if (Y(0) < H) drawGround(c, W, H, Y(0), z, ed.camX, lv.ground, lv.grs);
  c.strokeStyle = '#3ddc4a'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), H); c.stroke(); c.setLineDash([]);
  const ky = Y((topRows(lv.objs) + 10) * U);
  if (ky > 0) { c.strokeStyle = '#ff4040'; c.lineWidth = 2; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(0, ky); c.lineTo(W, ky); c.stroke(); c.setLineDash([]); c.fillStyle = '#ff4040'; c.font = 'bold 12px sans-serif'; c.textAlign = 'left'; c.fillText('KILL LINE (10 above tallest object)', 8, ky - 4); }
  c.globalAlpha = .5; c.save(); c.translate(X(15), Y(15)); drawIcon(c, P?.skin || 0, PRIMARY[P?.c1 || 0], SECONDARY[P?.c2 || 0], cs); c.restore(); c.globalAlpha = 1;
  for (const pass of [0, 1, 2]) for (const o of lv.objs) { const od = OBJ[o.t], ps = od.glow ? 2 : od.deco ? 0 : 1; if (ps !== pass) continue; const sx = X(o.x * U), sy = Y(o.y * U + U); if (sx < -cs * 4 || sx > W + cs * 3 || sy < -cs * 4 || sy > H + cs * 3) continue; drawObj(c, o, sx, sy, cs, o.c || defColor(o.t), true, now); }   // same layering as the game: decor, then objects, then glow on top
  c.strokeStyle = '#ffe36b'; c.lineWidth = 3; for (const o of ed.sels) { const b = objBox(o); c.strokeRect(X(b.x * U) - 2, Y((b.y + b.h) * U) - 2, b.w * cs + 4, b.h * cs + 4); }
  if (ed.drag && ed.drag.k === 'box' && ed.drag.x1 != null) { const d = ed.drag; c.fillStyle = 'rgba(255,227,107,.18)'; c.fillRect(X(d.x0), Y(d.y0), X(d.x1) - X(d.x0), Y(d.y1) - Y(d.y0)); c.strokeRect(X(d.x0), Y(d.y0), X(d.x1) - X(d.x0), Y(d.y1) - Y(d.y0)); }
  if (ed.spawn && ed.posMode) { const sx = X(ed.spawn.x * U), sy = Y(ed.spawn.y * U + U); c.fillStyle = 'rgba(53,255,106,.35)'; c.fillRect(sx, sy, cs, cs); c.strokeStyle = '#35ff6a'; c.lineWidth = 3; c.strokeRect(sx, sy, cs, cs); c.fillStyle = '#35ff6a'; c.beginPath(); c.moveTo(sx + cs / 2, sy - cs * .45); c.lineTo(sx + cs * .75, sy - cs * .15); c.lineTo(sx + cs / 2, sy + cs * .15); c.lineTo(sx + cs * .25, sy - cs * .15); c.closePath(); c.fill(); }
  if (ed.mode === 'build' && !ed.posMode) { const cx = Math.floor(ed.wx / U), cy = Math.floor(ed.wy / U); if (cx >= 0 && cy >= 0) { c.globalAlpha = .5; drawObj(c, { t: ed.tool, r: ed.rot, r45: no45({ t: ed.tool }) ? 0 : ed.rot45 }, X(cx * U), Y(cy * U + U), cs, defColor(ed.tool), true, now); c.globalAlpha = 1; } }
}
(() => {
  const cv = $('#editCanvas');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U);
    if (ed.posMode && e.button === 0) { ed.spawn = { x: Math.max(0, cx), y: Math.max(0, cy) }; return; }
    if (e.button === 2 && ed.mode === 'build') { snap(); ed.drag = { k: 'del' }; delAt(wx, wy); return; }
    if (e.button === 1 || e.button === 2 || ed.mode === 'pan') { ed.drag = { k: 'pan', x: e.clientX, y: e.clientY }; return; }
    snap();
    if (ed.mode === 'build') { ed.drag = { k: 'paint' }; place(cx, cy); }
    else if (ed.mode === 'delete') { ed.drag = { k: 'del' }; delAt(wx, wy); }
    else {
      const o = pick(wx, wy);
      if (e.shiftKey) { if (!o) ed.drag = { k: 'box', x0: wx, y0: wy }; else { const i = ed.sels.indexOf(o); i < 0 ? ed.sels.push(o) : ed.sels.splice(i, 1); } }
      else { if (!o) ed.sels = []; else if (!ed.sels.includes(o)) ed.sels = [o]; ed.drag = o ? { k: 'move', cx, cy } : null; }
      ed.sel = ed.sels.length === 1 ? ed.sels[0] : null; renderProps();
    }
  });
  cv.addEventListener('pointermove', e => {
    const [wx, wy] = s2w(e), cx = Math.floor(wx / U), cy = Math.floor(wy / U), dr = ed.drag; if (!dr) return;
    if (dr.k === 'pan') { ed.camX -= (e.clientX - dr.x) / ed.z; ed.camY += (e.clientY - dr.y) / ed.z; dr.x = e.clientX; dr.y = e.clientY; }
    else if (dr.k === 'paint') place(cx, cy); else if (dr.k === 'del') delAt(wx, wy);
    else if (dr.k === 'box') { dr.x1 = wx; dr.y1 = wy; }
    else if (dr.k === 'move' && ed.sels.length && (cx !== dr.cx || cy !== dr.cy)) { const dx = cx - dr.cx, dy = cy - dr.cy; ed.sels.forEach(o => { o.x = Math.max(0, o.x + dx); o.y = Math.max(0, o.y + dy); }); dr.cx = cx; dr.cy = cy; changed(); renderProps(); }
  });
  const up = () => { const d = ed.drag; if (d && d.k === 'box' && d.x1 != null) { const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1); ed.lv.objs.filter(o => { const b = objBox(o); return (b.x + b.w) * U > x0 && b.x * U < x1 && (b.y + b.h) * U > y0 && b.y * U < y1; }).forEach(o => ed.sels.includes(o) || ed.sels.push(o)); ed.sel = ed.sels.length === 1 ? ed.sels[0] : null; renderProps(); } ed.drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const f = e.deltaY < 0 ? 1.1 : .9, bx = e.offsetX / ed.z + ed.camX; ed.z = Math.max(.4, Math.min(2.5, ed.z * f)); ed.camX = bx - e.offsetX / ed.z; }
    else if (e.shiftKey) ed.camX += e.deltaY / ed.z; else { ed.camY -= e.deltaY / ed.z; ed.camX += e.deltaX / ed.z; }
  }, { passive: false });
})();
const no45 = o => OBJ[o.t].solid || OBJ[o.t].trig || OBJ[o.t].coin || OBJ[o.t].zone;   // solid blocks stay on the 90-degree grid
function edRot45() {
  if (ed.sels.length) { const ok = ed.sels.filter(o => !no45(o)); if (!ok.length) return toast('Blocks and triggers can only turn in 90 degree steps', 'err'); snap(); ok.forEach(o => { const e = (((o.r || 0) * 2 + (o.r45 ? 1 : 0)) + 1) % 8; o.r = e >> 1; o.r45 = e & 1; if (!o.r45) delete o.r45; }); changed(); renderProps(); }
  else { const e = (ed.rot * 2 + ed.rot45 + 1) % 8; ed.rot = e >> 1; ed.rot45 = e & 1; }
}
function edRotate(d = 1) { if (ed.sels.length) edXform(d > 0 ? 'cw' : 'ccw'); else ed.rot = ((ed.rot + d) % 4 + 4) % 4; }
function edDelSel() { if (!ed.sels.length) return; snap(); const s = new Set(ed.sels); ed.lv.objs = ed.lv.objs.filter(o => !s.has(o)); ed.sels = []; ed.sel = null; renderProps(); changed(); }
function edCopy() { if (!ed.sels.length) return; const mx = Math.min(...ed.sels.map(o => o.x)), my = Math.min(...ed.sels.map(o => o.y)); ed.clip = ed.sels.map(o => ({ ...JSON.parse(JSON.stringify(o)), x: o.x - mx, y: o.y - my })); toast('Copied ' + ed.clip.length); }
function edPaste() { if (!ed.clip.length) return; snap(); const bx = Math.max(0, Math.floor(ed.wx / U)), by = Math.max(0, Math.floor(ed.wy / U)); let room = 3 - ed.lv.objs.filter(o => o.t === 'coin').length; const n = ed.clip.filter(o => o.t !== 'trig_end' && (o.t !== 'coin' || room-- > 0)).map(o => ({ ...JSON.parse(JSON.stringify(o)), x: o.x + bx, y: o.y + by })); ed.lv.objs.push(...n); ed.sels = n; ed.sel = n.length === 1 ? n[0] : null; renderProps(); changed(); }
addEventListener('keydown', e => {
  if (!ed.on || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('#modal').classList.contains('open')) return;
  const k = e.key.toLowerCase(), st = 60 / ed.z;
  if (k === 'q') edRotate(-1); else if (k === 'e') edRotate(1); else if (k === 'r' && !e.ctrlKey && !e.metaKey) edRot45();
  else if ((e.ctrlKey || e.metaKey) && k === 'c') edCopy(); else if ((e.ctrlKey || e.metaKey) && k === 'v') edPaste(); else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); } else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); edRedo(); }
  else if (k === 'delete' || k === 'backspace') edDelSel();
  else if (e.altKey && k.startsWith('arrow')) { e.preventDefault(); actions.edhalf({ dx: k === 'arrowleft' ? -.5 : k === 'arrowright' ? .5 : 0, dy: k === 'arrowup' ? .5 : k === 'arrowdown' ? -.5 : 0 }); }
  else if (k.length === 1 && 'wasd'.includes(k) && !e.ctrlKey && !e.metaKey && !e.altKey) { if (ed.sels.length) { e.preventDefault(); actions.edhalf({ dx: k === 'a' ? -1 : k === 'd' ? 1 : 0, dy: k === 'w' ? 1 : k === 's' ? -1 : 0 }); } }
  else if (k === 'arrowleft') ed.camX -= st; else if (k === 'arrowright') ed.camX += st; else if (k === 'arrowup') ed.camY += st; else if (k === 'arrowdown') ed.camY -= st;
  else if (k === 'p') edPlay(e.shiftKey);
  else if (k === 'escape') { ed.sel = null; ed.sels = []; renderProps(); }
});
function edHistDone() { ed.sel = null; ed.sels = []; renderProps(); ed.keepRedo = true; changed(); ed.keepRedo = false; }
function edUndo() { if (!ed.hist.length) return; (ed.redo = ed.redo || []).push(JSON.stringify(ed.lv.objs)); ed.lv.objs = JSON.parse(ed.hist.pop()); edHistDone(); }
function edRedo() { if (!ed.redo || !ed.redo.length) return; ed.hist.push(JSON.stringify(ed.lv.objs)); ed.lv.objs = JSON.parse(ed.redo.pop()); edHistDone(); }
document.addEventListener('focusin', e => { if (e.target.dataset?.p && ed.on) snap(); });
document.addEventListener('input', e => {
  if (e.target.id === 'volr') { settings.vol = +e.target.value; saveSettings(); return; }
  if (e.target.id === 'songspd') { ed.lv.songSpeed = +e.target.value; saveSlots(ed.slot); return; }
  if (e.target.id === 'songoff') { ed.lv.songOff = Math.max(0, +e.target.value || 0); saveSlots(ed.slot); return; }
  const p = e.target.dataset?.p, tg = ed.sel ? [ed.sel] : ed.sels; if (!p || !tg.length) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? (+e.target.value || 0) : e.target.value; tg.forEach(o => { if (p === 'c' && !(OBJ[o.t].solid || OBJ[o.t].hz || OBJ[o.t].deco)) return; o[p] = p === 'sc' ? Math.max(.1, Math.min(5, v || 1)) : v; }); changed();
});
function edPlay(here) {
  const lv = ed.lv;
  let sx = 0, sy = 0; if (ed.posMode && ed.spawn) { sx = ed.spawn.x * U; sy = ed.spawn.y * U; }
  saveSlots(ed.slot); ed.on = false;
  idbGet(`draft:${me.uid}:${ed.slot}`).then(b => {
    startPlay({ level: { objs: lv.objs, bg: lv.bg, ground: lv.ground, bgs: lv.bgs, grs: lv.grs, startMode: lv.startMode, startSpeed: lv.startSpeed }, kind: 'test', lv0: lv, songSpeed: lv.songSpeed, songOff: lv.songOff, startX: sx, startY: sy, songUrl: b instanceof Blob ? URL.createObjectURL(b) : null, onExit: () => { ed.on = true; showLayer('edit'); renderEdUI(); edDraw(); } });
  });
}
async function edBack() { ed.on = false; saveSlots(ed.slot); clearTimeout(pushT[ed.slot]); const j = JSON.stringify(ed.lv); if (me && j.length < 900000) setDoc(doc(db, 'users', me.uid, 'drafts', 's' + ed.slot), { slot: ed.slot, lv: j, updated: ed.lv.updated || 0 }).catch(() => { }); showLayer('view'); setTrack('menu'); edRefresh(); renderFooter(); }
function edSettings() {
  stopPreview(); const lv = ed.lv;
  modal(`<h2>Level settings</h2><label>Title<input id="lvName" maxlength="18" value="${esc(lv.name)}"></label><label>Description<textarea id="lvDesc" maxlength="200" rows="3">${esc(lv.desc)}</textarea></label><div class="row"><label style="flex:1">Background<input type="color" id="lvBg" value="${lv.bg}"></label><label style="flex:1">Ground<input type="color" id="lvGr" value="${lv.ground}"></label></div><label>Background style<select id="lvBgs">${BGS.map(([k, n]) => `<option value="${k}" ${(lv.bgs || 'stripes') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Ground style<select id="lvGrs">${GRS.map(([k, n]) => `<option value="${k}" ${(lv.grs || 'tiles') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><div class="row"><label style="flex:1">Start gamemode<select id="lvSm">${[['cube','Cube'],['ship','Ship'],['ball','Ball'],['ufo','UFO'],['wave','Wave'],['robot','Robot'],['spider','Spider']].map(([k, n]) => `<option value="${k}" ${(lv.startMode || 'cube') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label style="flex:1">Start speed<select id="lvSs">${[[.8,'Slow (0.8x)'],[1,'Normal (1x)'],[1.3,'Fast (1.3x)'],[1.6,'Faster (1.6x)']].map(([k, n]) => `<option value="${k}" ${(lv.startSpeed || 1) == k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><label>${lv.songName ? 'Change song' : 'Level song'} (mp3)<input type="file" id="songfile" accept="audio/*"></label>${lv.songName ? `<div class="card"><b>🎵 ${esc(lv.songName)}</b><div class="row"><label style="flex:1">Speed<select id="songspd">${[2, 1.5, 1, .5].map(v => `<option value="${v}" ${(lv.songSpeed || 1) == v ? 'selected' : ''}>${v}x</option>`).join('')}</select></label><label style="flex:1">Start offset (ms)<input type="number" min="0" step="10" id="songoff" value="${lv.songOff || 0}"></label></div><div class="row"><button class="btn blue sm" data-act="songprev">▶ Preview / stop</button><button class="btn red sm" data-act="edsong-rm">Remove song</button></div></div>` : '<p class="muted">No song set</p>'}<div class="row"><button class="btn green" data-act="edsave">Save</button></div>`);
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
  ldm: () => { try { localStorage.dash_ldm = LDM ? '0' : '1'; } catch (e) { } location.reload(); },
  tog: d => { settings[d.k] = !settings[d.k]; saveSettings(); views.account({ tab: 'settings' }); },
  equip: async d => {
    if (!me) return toast('Log in to customize your icon', 'err'); const un = unlocked_(), i = +d.i;
    if (!un[d.k].has(i)) { const a = ACH.find(a => a.rw && a.rw.k === d.k && a.rw.i === i); return toast('🔒 ' + (a ? `${a.name}: ${a.desc}` : 'Find it in Community > Shop'), 'err'); }
    const f = ({ skin: 'skin', ship: 'ship', ball: 'ball', ufo: 'ufo', wave: 'wave', robot: 'robot', spider: 'spider', p: 'c1', s: 'c2' })[d.k]; P[f] = i; await updateDoc(doc(db, 'users', me.uid), { [f]: i }); renderFooter(); views.cosmetics({ tab: curP.tab || 'cube' });
  },
  openlvl: d => { closeModal(); go('level', { id: d.id }); },
  pg: d => renderLevels(d.kind, +d.pg), dosearch: doSearch, srchpg: d => { SRCH.pg = Math.max(0, +d.pg); renderSearch(); },
  playlvl: d => playPublished(d.id),
  practicelvl: d => playPublished(d.id, true),
  shoppg: d => views.shop({ pg: +d.pg }),
  buy: d => buyItem(d.key),
  pracadd: () => game.addCP(), pracdel: () => game.cps.pop(),
  pracmode: () => { if (!PL) return; PL.practice = !PL.practice; $('#pauseBox').classList.remove('open'); $('#winBox').classList.remove('open'); setPracUI(); game.start({ x: PL.sx, y: PL.sy, practice: PL.practice }); },
  vote: d => vote(d.id, +d.v),
  comment: async d => {
    const t = val('cmt').trim(); if (!t) return; await addDoc(collection(db, 'levels', d.id, 'comments'), { uid: me.uid, name: P.username, text: t, t: serverTimestamp() });
    P.comments = (P.comments || 0) + 1; updateDoc(doc(db, 'users', me.uid), { comments: increment(1) }).catch(() => { }); checkAch(); views.level({ id: d.id });
  },
  delcm: async d => { await deleteDoc(doc(db, 'levels', d.id, 'comments', d.cid)); views.level({ id: d.id }); },
  dlsong: d => downloadSong(d.id),
  unrate: async d => { if (!confirm('Unrate this level? Everyone who beat it loses its stars and it shows as UNRATED on their profile.')) return; await unrateLevel(d.id); },
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
  resume: pauseToggle, restart: () => { $('#winBox').classList.remove('open'); $('#pauseBox').classList.remove('open'); game.start({ x: PL.sx, y: PL.sy, practice: PL.practice }); },
  exitplay: () => stopPlay(),
  // editor slots
  slotnew: () => { if (!me) return; const f = slots.findIndex(x => !x), i = f < 0 ? slots.length : f; slots[i] = newLevel('Level ' + (i + 1)); saveSlots(i); go('draft', { i }); },
  draftopen: d => go('draft', { i: +d.i }),
  draftplay: d => draftPlay(+d.i),
  edpg: d => { EDPG = Math.max(0, +d.pg); views.editor(); },
  importlvl: d => importLevel(+d.i),
  exportlvl: d => exportLevel(+d.i),
  slotedit: d => openEditor(+d.i),
  beatbreak: () => { const e = $('#beatBrk'); if (e) e.style.display = e.style.display === 'none' ? 'grid' : 'none'; },
  slotrename: d => { const l = slots[+d.i], n = prompt('Level name', l.name); if (n && n.trim()) { l.name = n.trim().slice(0, 18); l.updated = Date.now(); saveSlots(+d.i); edRefresh(); } },
  slotdesc: d => { const l = slots[+d.i]; modal(`<h2>Description</h2><textarea id="slotDescTa" maxlength="200" rows="5" style="width:100%" placeholder="Describe your level (line breaks, **bold**, *italic* and - bullets work)">${esc(l.desc)}</textarea><div class="row" style="margin-top:10px"><button class="btn green" data-act="slotdescsave" data-i="${d.i}">Save</button></div>`); },
  slotdescsave: d => { const l = slots[+d.i]; l.desc = ($('#slotDescTa').value || '').slice(0, 200); l.updated = Date.now(); saveSlots(+d.i); closeModal(); edRefresh(); },
  slotdel: async d => { const i = +d.i; if (!confirm('Delete this level slot? (Published copies stay on the servers.)')) return; slots[i] = null; while (slots.length && !slots[slots.length - 1]) slots.pop(); saveSlots(); idbDel(`draft:${me.uid}:${i}`); deleteDoc(doc(db, 'users', me.uid, 'drafts', 's' + i)).catch(() => { }); if (cur === 'draft') back(); else views.editor(); },
  slotcopy: async d => {
    const i = +d.i, f0 = slots.findIndex(x => !x), f = f0 < 0 ? slots.length : f0;
    const c = JSON.parse(JSON.stringify(slots[i])); c.name = (c.name.slice(0, 13) + ' copy').slice(0, 18); c.pub = null; c.verified = ''; c.updated = Date.now(); slots[f] = c; saveSlots(f);
    const b = await idbGet(`draft:${me.uid}:${i}`); if (b) idbSet(`draft:${me.uid}:${f}`, b); toast('Copied!', 'ok'); edRefresh();
  },
  slotpub: async d => { await publish(+d.i); },
  // editor
  edback: edBack, edmode: d => { ed.mode = d.m; ed.drag = null; renderEdUI(); }, edundo: edUndo, edredo: edRedo, edplay: () => edPlay(false), edpos: () => { ed.posMode = !ed.posMode; ed.drag = null; if (ed.posMode) toast('Click any cell to set the spawn position'); renderEdUI(); },
  edtab: d => { ed.tab = d.c; renderEdUI(); }, edtool: d => { ed.tool = d.t; ed.mode = 'build'; ed.sel = null; ed.sels = []; renderProps(); renderEdUI(); },
  edrot: () => edRotate(1), edrot45: edRot45, edsettings: edSettings,
  eddel: edDelSel,
  edhalf: d => { if (!ed.sels.length) return; snap(); const dx = Math.max(+d.dx, -Math.min(...ed.sels.map(o => o.x))), dy = Math.max(+d.dy, -Math.min(...ed.sels.map(o => o.y))); ed.sels.forEach(o => { o.x = r3(o.x + dx); o.y = r3(o.y + dy); }); changed(); renderProps(); },
  edxf: d => edXform(d.k),
  edscale: d => { if (!ed.sels.length) return; snap(); ed.sels.forEach(o => { if (!OBJ[o.t].trig && !OBJ[o.t].slope) o.sc = Math.max(.1, Math.min(5, Math.round(((o.sc || 1) + +d.f) * 10) / 10)); }); changed(); renderProps(); }, edrotl: () => edRotate(-1), edrotr: () => edRotate(1), edcopy: edCopy, edpaste: edPaste,
  songprev: async () => {
    if (prevA) return stopPreview();
    const b = await idbGet(`draft:${me.uid}:${ed.slot}`); if (!(b instanceof Blob)) return toast('No song file', 'err');
    const a = new Audio(URL.createObjectURL(b)); prevA = a; a.volume = settings.vol; a.playbackRate = ed.lv.songSpeed || 1; a.currentTime = (ed.lv.songOff || 0) / 1000;
    const done = () => { if (prevA === a) stopPreview(); };
    a.addEventListener('ended', done); a.addEventListener('pause', done); a.addEventListener('error', done);
    previewing = true; applyAudio(); a.play().catch(done);
  },
  edsave: () => { const lv = ed.lv; lv.name = val('lvName').trim().slice(0, 18) || lv.name; lv.desc = val('lvDesc').slice(0, 200); lv.bg = val('lvBg'); lv.bgs = val('lvBgs') || 'stripes'; lv.ground = val('lvGr'); { const sm = val('lvSm') || 'cube', ss = +val('lvSs') || 1; if (sm !== (lv.startMode || 'cube') || ss !== (lv.startSpeed || 1)) lv.verified = ''; lv.startMode = sm; lv.startSpeed = ss; lv.grs = val('lvGrs') || 'tiles'; } lv.updated = Date.now(); saveSlots(ed.slot); closeModal(); renderEdUI(); },
  edgrp: () => {   // put the smallest group ID nobody in this level uses yet on the selection
    const tg = ed.sel ? [ed.sel] : ed.sels; if (!tg.length) return; snap();
    const used = new Set(ed.lv.objs.map(o => o.g | 0)); let n = 1; while (used.has(n)) n++;
    tg.forEach(o => { o.g = n; }); changed(); renderProps();
  },
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
    if (lv.objs.filter(o => o.t === 'coin').length > 3) throw 'Max 3 star coins per level';
    const data = JSON.stringify({ v: 2, objs: lv.objs, bg: lv.bg, ground: lv.ground, bgs: lv.bgs || 'stripes', grs: lv.grs || 'tiles', startMode: lv.startMode || 'cube', startSpeed: lv.startSpeed || 1, songSpeed: lv.songSpeed || 1, songOff: lv.songOff || 0 });
    if (data.length > 900000) throw 'Level is too big to upload';
    const sb = await idbGet(`draft:${me.uid}:${i}`), has = sb instanceof Blob && sb.size > 0, parts = has ? Math.ceil(sb.size / SONG_CHUNK) : 0;
    const r = doc(collection(db, 'levels')); toast('Uploading level…');
    await setDoc(r, { authorId: me.uid, authorName: P.username, title: lv.name.slice(0, 18), desc: (lv.desc || '').slice(0, 200), data, status: 'unrated', diff: null, stars: 0, views: 0, likes: 0, dislikes: 0, created: serverTimestamp(), songUrl: null, songName: has ? lv.songName : null, songParts: parts, songSpeed: lv.songSpeed || 1, songOff: lv.songOff || 0, count: lv.objs.length, coins: lv.objs.filter(o => o.t === 'coin').length, len: Math.round(lenSecs(lv.objs, lv.startSpeed) * 10) / 10 });
    if (has) {
      try {
        for (let k = 0; k < parts; k += 3) {
          const b = writeBatch(db);
          for (let j = k; j < Math.min(parts, k + 3); j++) b.set(doc(db, 'levels', r.id, 'songChunks', String(j).padStart(3, '0')), { n: j, d: await blobB64(sb.slice(j * SONG_CHUNK, (j + 1) * SONG_CHUNK)) });
          await b.commit(); toast(`Uploading song… ${Math.min(parts, k + 3)}/${parts}`);
        }
      } catch (e) { await delCol(['levels', r.id, 'songChunks']).catch(() => { }); await deleteDoc(r).catch(() => { }); throw 'Song upload failed (' + errMsg(e) + '). Level was not published - did you update the Firestore rules?'; }
    }
    try {   // you had to beat it to upload it, so it counts as beaten on your profile and gets the checkmark now (stars/gems/coins follow when it is rated)
      await setDoc(doc(db, 'users', me.uid, 'beaten', r.id), { t: serverTimestamp(), starred: false, level: r.id, coins: [] });
      await setDoc(doc(db, 'users', me.uid, 'progress', r.id), { best: 100 }, { merge: true });
      const upd = { levelsBeaten: increment(1) }; P.levelsBeaten = (P.levelsBeaten || 0) + 1;
      if (P.beatByOk) { upd['beatBy.unrated'] = increment(1); P.beatBy = P.beatBy || {}; P.beatBy.unrated = (P.beatBy.unrated || 0) + 1; }
      await updateDoc(doc(db, 'users', me.uid), upd);
      BEATEN.add(r.id); localStorage[bestKey(r.id)] = 100; renderFooter();
    } catch (e) { console.warn('could not credit author', e); }
    lv.pub = r.id; saveSlots(i); refreshMyStats(); toast('Published! Vortarium has been pinged to rate it.', 'ok'); edRefresh();
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

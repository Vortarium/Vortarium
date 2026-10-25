/* Jewelfish asset library — procedurally generated so hundreds of options stay light */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- clip defaults ---------- */
export const DEF = { x: 0, y: 0, s: 1, o: 1, rot: 0, fadeIn: 0, fadeOut: 0, in: 0, fit: "fit", flip: "none", blend: "source-over",
  br: 1, ct: 1, sat: 1, hue: 0, temp: 0, tint: 0, vig: 0, blur: 0, sep: 0, gry: 0, inv: 0, fx: "none",
  vol: 1, mute: 0, boost: 1, pan: 0, bass: 0, treble: 0, speed: 1,
  aIn: "none", aOut: "none", aLoop: "none", aDur: .6,
  color: "#ffffff", fill2: "", strokeC: "#000000", sw: 0, shC: "#000000", shB: 0, shD: 0, bub: "none", bubC: "#000000", line: "none", size: 96 };
export const TEXTRESET = { color: "#ffffff", fill2: "", strokeC: "#000000", sw: 0, shC: "#000000", shB: 0, shD: 0, bub: "none", bubC: "#000000", line: "none" };

/* ---------- color filters (50 looks) ---------- */
const P = "br,ct,sat,hue,sep,blur,inv,gry,temp,tint,vig".split(",");
export const FX = Object.fromEntries(`none:1,1,1,0,0,0,0,0,0,0,0;bw:1,1.05,1,0,0,0,0,1,0,0,0;noir:.9,1.5,1,0,0,0,0,1,0,0,.4;silver:1.05,1.15,1,0,0,0,0,.85,-5,0,0;bw-high:1.1,1.7,1,0,0,0,0,1,0,0,.2;sepia:1,1,.9,0,.8,0,0,0,10,0,0;sepia-dark:.8,1.2,.9,0,1,0,0,0,15,0,.4;vintage:1.02,.9,.8,0,.45,0,0,0,25,5,.35;faded:1.1,.85,.7,0,0,0,0,0,5,0,0;film:1,1.15,.9,0,.1,0,0,0,10,0,.4;cinema:1,1.25,.85,0,0,0,0,0,-10,-5,.5;drama:.9,1.5,.9,0,0,0,0,0,0,0,.3;bleach:1,1.45,.5,0,0,0,0,0,0,0,0;chrome:1.05,1.3,1.2,0,0,0,0,.25,-10,0,0;vivid:1.05,1.2,1.6,0,0,0,0,0,0,0,0;pop:1,1.3,1.8,0,0,0,0,0,0,0,0;neon:1.1,1.3,2.5,0,0,0,0,0,0,0,0;candy:1.1,1.1,2,-15,0,0,0,0,10,25,0;cool:1,1.05,1,-15,0,0,0,0,-25,0,0;warm:1.05,1,1.1,0,.15,0,0,0,30,0,0;sunset:1.05,1.1,1.25,-10,.1,0,0,0,40,15,.2;golden:1.05,1.05,1.3,0,.3,0,0,0,50,5,.15;autumn:1,1.1,1.4,-10,.4,0,0,0,30,0,.2;arctic:1.08,1,.9,-10,0,0,0,0,-45,0,0;polar:1.1,1,.7,-5,0,0,0,0,-30,0,0;ocean:1,1.1,1.3,-45,0,0,0,0,-20,0,0;night:.6,1.15,.8,0,0,0,0,0,-40,5,.55;dusk:.85,1.1,1.1,-20,.2,0,0,0,-15,15,.35;teal-orange:1,1.15,1.25,0,0,0,0,0,20,-12,.15;cyberpunk:1,1.2,1.6,-60,0,0,0,0,0,30,0;matrix:.9,1.2,1.4,90,0,0,0,0,0,-30,.3;toxic:1,1.2,2,70,0,0,0,0,0,0,0;fire:1,1.2,2,-20,0,0,0,0,50,10,.2;rose:1.03,1,1.1,-30,0,0,0,0,10,25,0;lavender:1.05,1,1.2,30,0,0,0,0,-5,20,0;mint:1.05,1,1.1,40,0,0,0,0,-10,-20,0;emerald:1,1.1,1.3,70,0,0,0,0,0,-10,0;dream:1.15,.95,1.3,0,0,1.5,0,0,10,10,0;soft:1.05,.95,1,0,0,3,0,0,0,0,0;blur:1,1,1,0,0,6,0,0,0,0,0;heavy-blur:1,1,1,0,0,16,0,0,0,0,0;ghost:1.3,.8,.3,0,0,1,0,0,-10,0,0;invert:1,1,1,0,0,0,1,0,0,0,0;x-ray:1,1.2,1,0,0,0,1,1,0,0,0;lowkey:.7,1.3,1,0,0,0,0,0,0,0,.3;highkey:1.3,.9,.95,0,0,0,0,0,0,0,0;washed:1.2,.8,.6,0,.1,0,0,0,5,0,0;moody:.8,1.25,.8,-10,.1,0,0,0,-15,10,.4;pastel:1.2,.85,.8,0,0,0,0,0,5,10,0;acid:1,1.4,2.2,100,0,0,0,0,0,0,0`.split(";").map(s => { const [n, v] = s.split(":"); return [n, Object.fromEntries(v.split(",").map((x, i) => [P[i], +x]))]; }));
export const filt = (c, eb = 0) => `brightness(${c.br}) contrast(${c.ct}) saturate(${c.sat}) hue-rotate(${c.hue}deg) sepia(${c.sep}) grayscale(${c.gry}) invert(${c.inv}) blur(${(c.blur || 0) + eb}px)`;
export const fxCss = f => `brightness(${f.br}) contrast(${f.ct}) saturate(${f.sat}) hue-rotate(${f.hue}deg) sepia(${f.sep}) grayscale(${f.gry}) invert(${f.inv}) blur(${Math.min(3, f.blur / 3)}px)`;

/* ---------- 300 text styles = 20 palettes x 15 effects ---------- */
const PAL = "#ffffff|#111111,#111111|#ffffff,#ffe14d|#1b1b1b,#ff4d6d|#ffffff,#ff9f1c|#3d1f00,#2ec27e|#06281a,#00d1c1|#00302d,#3a86ff|#001a4d,#8338ec|#ffffff,#ff5dc8|#4a0033,#f72585|#ffe6f2,#4cc9f0|#032b3a,#b5179e|#ffe0fa,#7bff6a|#0b2a06,#ff5e00|#ffffff,#e0e0e0|#202020,#d4af37|#2b1d00,#c1121f|#ffffff,#003049|#fcbf49,#f1faee|#e63946".split(",");
const EFFS = [["Plain", () => ({})], ["Soft shadow", () => ({ shB: 14, shD: 6, shC: "#000000aa" })], ["Hard shadow", (f, a) => ({ shD: 8, shC: a })], ["Outline", (f, a) => ({ sw: 7, strokeC: a })],
  ["Outline + shadow", (f, a) => ({ sw: 7, strokeC: a, shB: 10, shD: 8, shC: "#000000aa" })], ["Glow", f => ({ shB: 34, shC: f })], ["Neon", f => ({ color: "#ffffff", shB: 42, shC: f })],
  ["Pill", (f, a) => ({ bub: "pill", bubC: a })], ["Box", (f, a) => ({ bub: "box", bubC: a })], ["Underline", () => ({ line: "under" })], ["Strike", () => ({ line: "strike" })],
  ["Retro", (f, a) => ({ sw: 5, strokeC: "#111111", shD: 10, shC: a })], ["Sticker", () => ({ sw: 16, strokeC: "#ffffff", shB: 10, shD: 5, shC: "#00000088" })],
  ["Gradient", (f, a) => ({ fill2: a })], ["Tag", (f, a) => ({ bub: "box", bubC: a, line: "under" })]];
export const TEXT_STYLES = PAL.flatMap(p => { const [f, a] = p.split("|"); return EFFS.map(([n, fn]) => ({ name: n, st: { color: f, ...fn(f, a) } })); });
export const cssFor = st => { let s = `color:${st.color};`; if (st.fill2) s = `background:linear-gradient(${st.color},${st.fill2});-webkit-background-clip:text;background-clip:text;color:transparent;`;
  if (st.sw) s += `-webkit-text-stroke:${Math.min(3, st.sw / 3)}px ${st.strokeC};`; if (st.shD || st.shB) s += `text-shadow:${(st.shD || 0) / 2}px ${(st.shD || 0) / 2}px ${(st.shB || 0) / 3}px ${st.shC};`;
  if (st.bub && st.bub !== "none") s += `background:${st.bubC};padding:1px 8px;border-radius:${st.bub === "pill" ? 20 : 3}px;`; if (st.line === "under") s += "text-decoration:underline;"; if (st.line === "strike") s += "text-decoration:line-through;"; return s; };

/* ---------- shapes (54 shapes x 14 fills = 750+ combos) ---------- */
const poly = (n, r = -90) => (w, h) => { const p = new Path2D(); for (let i = 0; i < n; i++) { const a = (r + 360 * i / n) * Math.PI / 180, x = Math.cos(a) * w / 2, y = Math.sin(a) * h / 2; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); return p; };
const star = (n, k) => (w, h) => { const p = new Path2D(); for (let i = 0; i < n * 2; i++) { const a = (-90 + 180 * i / n) * Math.PI / 180, r = i % 2 ? k : 1, x = Math.cos(a) * w / 2 * r, y = Math.sin(a) * h / 2 * r; i ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); return p; };
const pts = a => (w, h) => { const p = new Path2D(); a.forEach(([x, y], i) => { i ? p.lineTo(x * w, y * h) : p.moveTo(x * w, y * h); }); p.closePath(); return p; };
const mk = f => (w, h) => { const p = new Path2D(); f(p, w, h); return p; };
export const SHAPES = {
  rectangle: mk((p, w, h) => p.rect(-w / 2, -h / 2, w, h)), rounded: mk((p, w, h) => p.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * .22)), pill: mk((p, w, h) => p.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2)),
  circle: mk((p, w, h) => p.ellipse(0, 0, w / 2, h / 2, 0, 0, 7)), ring: mk((p, w, h) => { p.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); p.moveTo(w * .3, 0); p.ellipse(0, 0, w * .3, h * .3, 0, 0, 7); }),
  heart: mk((p, w, h) => { p.moveTo(0, h * .4); p.bezierCurveTo(-w * .65, -h * .05, -w * .35, -h * .6, 0, -h * .2); p.bezierCurveTo(w * .35, -h * .6, w * .65, -h * .05, 0, h * .4); }),
  drop: mk((p, w, h) => { p.moveTo(0, -h / 2); p.bezierCurveTo(w * .6, h * .05, w * .35, h / 2, 0, h / 2); p.bezierCurveTo(-w * .35, h / 2, -w * .6, h * .05, 0, -h / 2); }),
  arrow: pts([[-.5, -.15], [.1, -.15], [.1, -.5], [.5, 0], [.1, .5], [.1, .15], [-.5, .15]]), chevron: pts([[-.5, -.5], [.1, -.5], [.5, 0], [.1, .5], [-.5, .5], [-.1, 0]]),
  plus: pts([[-.17, -.5], [.17, -.5], [.17, -.17], [.5, -.17], [.5, .17], [.17, .17], [.17, .5], [-.17, .5], [-.17, .17], [-.5, .17], [-.5, -.17], [-.17, -.17]]),
  x: pts([[-.5, -.3], [-.3, -.5], [0, -.2], [.3, -.5], [.5, -.3], [.2, 0], [.5, .3], [.3, .5], [0, .2], [-.3, .5], [-.5, .3], [-.2, 0]]),
  bolt: pts([[.1, -.5], [-.4, .1], [-.05, .1], [-.15, .5], [.4, -.1], [.05, -.1]]), parallelogram: pts([[-.3, -.5], [.5, -.5], [.3, .5], [-.5, .5]]), trapezoid: pts([[-.3, -.5], [.3, -.5], [.5, .5], [-.5, .5]]),
  "right-triangle": pts([[-.5, -.5], [-.5, .5], [.5, .5]]), banner: pts([[-.5, -.5], [.5, -.5], [.35, 0], [.5, .5], [-.5, .5]]), tag: pts([[-.5, -.5], [.2, -.5], [.5, 0], [.2, .5], [-.5, .5]]),
  speech: mk((p, w, h) => { p.roundRect(-w / 2, -h / 2, w, h * .78, Math.min(w, h) * .2); p.moveTo(-w * .28, h * .2); p.lineTo(-w * .3, h / 2); p.lineTo(0, h * .2); p.closePath(); }),
  cloud: mk((p, w, h) => { p.ellipse(-w * .22, h * .1, w * .26, h * .28, 0, 0, 7); p.moveTo(w * .35, -h * .1); p.ellipse(w * .05, -h * .1, w * .3, h * .34, 0, 0, 7); p.moveTo(w * .51, h * .12); p.ellipse(w * .27, h * .12, w * .24, h * .26, 0, 0, 7); p.rect(-w * .22, h * .1, w * .5, h * .28); }),
  flower: mk((p, w, h) => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = Math.cos(a) * w * .27, y = Math.sin(a) * h * .27; p.moveTo(x + w * .2, y); p.ellipse(x, y, w * .2, h * .2, 0, 0, 7); } p.moveTo(w * .25, 0); p.ellipse(0, 0, w * .25, h * .25, 0, 0, 7); }),
  gear: mk((p, w, h) => { p.addPath(star(12, .8)(w, h)); p.moveTo(w * .18, 0); p.ellipse(0, 0, w * .18, h * .18, 0, 0, 7); }),
  line: mk((p, w, h) => p.rect(-w / 2, -h * .03, w, h * .06)), burst: star(16, .7), "sparkle": star(4, .25), badge: star(24, .88) };
for (let n = 3; n <= 12; n++) SHAPES["polygon-" + n] = poly(n); for (let n = 4; n <= 16; n++) SHAPES["star-" + n] = star(n, .45); for (let n = 5; n <= 10; n++) SHAPES["spike-" + n] = star(n, .28);
export const SHAPE_NAMES = Object.keys(SHAPES), EO = new Set(["ring", "gear", "flower", "cloud"]);
export const FILLS = [["#ffffff"], ["#111111"], ["#ff4d6d"], ["#ff9f1c"], ["#ffd60a"], ["#2ec27e"], ["#00d1c1"], ["#3a86ff"], ["#8338ec"], ["#ff5dc8"], ["#ff9a9e", "#fad0c4"], ["#4de1d2", "#8a7dff"], ["#f7971e", "#ffd200"], ["#ee0979", "#ff6a00"]];

/* ---------- stickers (1000+ emoji) ---------- */
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).filter(c => /\p{Emoji}/u.test(c));
export const STICKER_CATS = { Faces: R(0x1F600, 0x1F64F), "Nature & travel": R(0x1F300, 0x1F3FF), "Animals & people": R(0x1F400, 0x1F4FF), Objects: R(0x1F500, 0x1F5FF), Transport: R(0x1F680, 0x1F6FF), Gestures: R(0x1F900, 0x1F9FF), Symbols: R(0x2600, 0x26FF), Dingbats: R(0x2700, 0x27BF) };

/* ---------- animation ---------- */
export const ANIMS = ["none", "fade", "rise", "drop", "slideL", "slideR", "pop", "zoom", "spin", "bounce", "blur", "type"], LOOPS = ["none", "pulse", "float", "wiggle", "shake", "spin", "blink"];
export const BLENDS = ["source-over", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "soft-light", "hard-light", "difference", "exclusion", "hue", "color", "luminosity"];
export function animMod(c, r) {
  const m = { dx: 0, dy: 0, s: 1, o: 1, rot: 0, blur: 0, chars: 1 }, A = Math.max(.05, c.aDur || .6);
  const ph = (n, u) => { u = clamp(u, 0, 1); const e = 1 - Math.pow(1 - u, 3), b = 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
    switch (n) { case "fade": m.o *= u; break; case "rise": m.dy += (1 - e) * .12; m.o *= u; break; case "drop": m.dy -= (1 - e) * .12; m.o *= u; break; case "slideL": m.dx -= (1 - e) * .35; m.o *= u; break; case "slideR": m.dx += (1 - e) * .35; m.o *= u; break;
      case "pop": m.s *= Math.max(0, b); m.o *= Math.min(1, u * 4); break; case "zoom": m.s *= .3 + .7 * e; m.o *= u; break; case "spin": m.rot -= (1 - e) * 180; m.s *= e; m.o *= u; break;
      case "bounce": m.dy -= Math.abs(Math.sin((1 - u) * Math.PI * 3)) * (1 - u) * .15; m.o *= Math.min(1, u * 5); break; case "blur": m.blur = (1 - u) * 24; m.o *= u; break; case "type": m.chars = u; } };
  if (c.aIn && c.aIn !== "none" && r < A) ph(c.aIn, r / A); const rem = c.dur - r; if (c.aOut && c.aOut !== "none" && rem < A) ph(c.aOut, rem / A);
  switch (c.aLoop) { case "pulse": m.s *= 1 + .06 * Math.sin(r * 6); break; case "float": m.dy += .015 * Math.sin(r * 3); break; case "wiggle": m.rot += 4 * Math.sin(r * 8); break; case "shake": m.dx += .006 * Math.sin(r * 60); break; case "spin": m.rot += r * 90; break; case "blink": m.o *= Math.sin(r * 8) > 0 ? 1 : .15; }
  return m;
}

/* ---------- audio graph: gain, pan, bass/treble EQ ---------- */
let AC; export const getCtx = () => AC ||= new AudioContext(); export const resumeAudio = () => AC && AC.resume();
export function graph(el, dest) {
  if (!el._g) { const x = getCtx(), s = x.createMediaElementSource(el), bass = x.createBiquadFilter(), treble = x.createBiquadFilter(), pan = x.createStereoPanner(), gain = x.createGain();
    bass.type = "lowshelf"; bass.frequency.value = 200; treble.type = "highshelf"; treble.frequency.value = 3500; s.connect(bass); bass.connect(treble); treble.connect(pan); pan.connect(gain); gain.connect(x.destination); el._g = { bass, treble, pan, gain }; }
  if (dest && !el._gd) { el._g.gain.connect(dest); el._gd = 1; } return el._g;
}
export function applyAudio(el, c, f) {
  const vol = c.mute ? 0 : c.vol * f;
  if (c.pan || c.bass || c.treble || c.boost > 1 || el._g) { const g = graph(el); g.gain.gain.value = vol * c.boost; g.pan.pan.value = c.pan; g.bass.gain.value = c.bass; g.treble.gain.value = c.treble; el.volume = 1; }
  else el.volume = clamp(vol, 0, 1);
  el.playbackRate = c.speed || 1;
}

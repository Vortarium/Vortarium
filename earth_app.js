import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, writeBatch, serverTimestamp, addDoc, query, orderBy, limit, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

import { initGame } from "./earth_game.js";
const app = initializeApp({apiKey:"AIzaSyCi35IyqyH4clYPOletvpu4NTllKKF64E8",authDomain:"earth-aefc5.firebaseapp.com",projectId:"earth-aefc5",storageBucket:"earth-aefc5.firebasestorage.app",messagingSenderId:"766512520129",appId:"1:766512520129:web:24ee38a15dde0da1ed6d40"});
const auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
const W = 360, H = 180, ADMIN = "vortarium";
const AI_ENDPOINT = ""; // optional: your Cloud Function proxy for Gemini (never put the key in client code)

/* ---------- audio ---------- */
const snd = {}; ["music","army","tech","money","army2","army3","religion","button","build","nuke","earthquake"].forEach(n => { snd[n] = new Audio(`earth_${n}.mp3`); });
snd.music.loop = true; snd.music.volume = .4;
const play = n => { try { const a = snd[n]; a.currentTime = 0; a.play(); if (n === "army3") setTimeout(() => { let v = 1; const f = setInterval(() => { v -= .2; a.volume = Math.max(v, 0); if (v <= 0) { a.pause(); a.volume = 1; clearInterval(f); } }, 100); }, 2000); } catch {} };
let musicOn = false;
document.addEventListener("click", e => { if (!musicOn) { musicOn = true; snd.music.play().catch(() => {}); } if (e.target.closest("button")) play("button"); });
window.earthSfx = play;

/* ---------- 25 biomes ---------- */
const BIOMES = [
 ["Frozen Sea","#cfe6f0"],["Cold Ocean","#1d4e7a"],["Temperate Ocean","#1f6fa8"],["Warm Ocean","#2a8ec0"],["Tropical Ocean","#31a9c9"],["Deep Ocean","#0c2f55"],
 ["Lake","#3c8fd0"],["River","#4aa3df"],
 ["Ice Sheet","#f4f9fc"],["Snowy Wasteland","#dbe7ee"],["Tundra","#9aa890"],["Alpine","#b5b8b0"],["Taiga","#2f5d46"],["Temperate Forest","#3f7d3a"],
 ["Grassland","#8fb84a"],["Steppe","#b9b660"],["Savanna","#c7a846"],["Mediterranean Scrub","#8a8a45"],["Hot Desert","#e0c27a"],["Badlands","#b5673a"],
 ["Scorched Valley","#8c4a2c"],["Tropical Rainforest","#12652e"],["Seasonal Tropical Forest","#3b8c33"],["Swamp","#4d6b4a"],["Bare Mountain","#7b7772"]];
const SOIL = ["Cryosol","Podzol","Chernozem","Luvisol","Aridisol","Oxisol","Histosol","Leptosol"];

/* ---------- noise (seeded, 3D on sphere) ---------- */
function rng(s) { return () => (s = Math.imul(s ^ s >>> 15, 2246822507) + 1013904223 | 0, ((s ^ s >>> 13) >>> 0) / 4294967296); }
function makeNoise(seed) {
  const r = rng(seed), P = new Uint8Array(512), p = [...Array(256).keys()].sort(() => r() - .5);
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
  const g = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return (h & 1 ? -u : u) + (h & 2 ? -v : v); };
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z), A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(lerp(lerp(g(P[AA], x, y, z), g(P[BA], x - 1, y, z), u), lerp(g(P[AB], x, y - 1, z), g(P[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(g(P[AA + 1], x, y, z - 1), g(P[BA + 1], x - 1, y, z - 1), u), lerp(g(P[AB + 1], x, y - 1, z - 1), g(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  };
}
const fbm = (n, x, y, z, o = 5) => { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f, z * f); t += a; a *= .5; f *= 2; } return s / t; };

/* ---------- terrain + climate + biome ---------- */
function sample(seed, la, lo) {
  const n = sample.n || (sample.n = {}), N = n[seed] || (n[seed] = [makeNoise(seed), makeNoise(seed + 1), makeNoise(seed + 2), makeNoise(seed + 3)]);
  const phi = la * Math.PI / 180, th = lo * Math.PI / 180, x = Math.cos(phi) * Math.cos(th), y = Math.sin(phi), z = Math.cos(phi) * Math.sin(th);
  const cont = fbm(N[0], x * 1.6, y * 1.6, z * 1.6, 5), ridge = 1 - Math.abs(fbm(N[1], x * 4, y * 4, z * 4, 4)); // ridged => mountain chains / tectonic belts
  let e = cont * 5200 + (cont > 0 ? Math.pow(ridge, 3) * 3800 * (cont + .2) : 0) - 400 * 0; // metres
  const river = Math.abs(fbm(N[3], x * 3, y * 3, z * 3, 3)) < .012 && e > 0 && e < 1800;
  const lake = e > 0 && e < 500 && fbm(N[3], x * 7 + 9, y * 7, z * 7, 3) > .26;
  const moist = Math.max(0, Math.min(1, .5 + fbm(N[2], x * 2.2, y * 2.2, z * 2.2, 4) * 1.6 - (Math.abs(la) > 20 && Math.abs(la) < 35 ? .22 : 0) + (Math.abs(la) < 10 ? .18 : 0)));
  const temp = 31 - 52 * Math.pow(Math.abs(la) / 90, 1.4) - Math.max(0, e) / 1000 * 6.5 + fbm(N[2], x * 5, y * 5, z * 5, 2) * 4; // °C, lapse rate 6.5/km
  return { e: Math.round(e), m: moist, t: temp, river, lake };
}
function biome(s) {
  const { e, m, t } = s;
  if (e <= 0) return t < -8 ? 0 : e < -1200 ? 5 : t < 6 ? 1 : t < 16 ? 2 : t < 24 ? 3 : 4;
  if (s.lake) return 6; if (s.river) return 7;
  if (e > 4300) return t < -10 ? 8 : 24; if (e > 3000) return t < -4 ? 9 : 11;
  if (t < -15) return 8; if (t < -6) return m < .4 ? 9 : 10; if (t < 3) return m < .35 ? 10 : 12;
  if (t < 10) return m < .3 ? 15 : m < .55 ? 12 : 13;
  if (t < 20) return m < .22 ? 19 : m < .4 ? 14 : m < .5 ? 17 : m > .78 ? 23 : 13;
  if (m < .26) return t > 24 && e < 500 ? 20 : 18; if (m < .34) return 19; if (m < .45) return 16; if (m < .65) return 22; return m > .85 ? 21 : 22;
}
const soilOf = b => [8,9,10].includes(b) ? 0 : [12,13].includes(b) ? 1 : [14,15].includes(b) ? 2 : [18,19,20].includes(b) ? 4 : [21,22,16].includes(b) ? 5 : b === 23 ? 6 : b === 24 || b === 11 ? 7 : 3;

/* ---------- 3D scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: $("globe"), antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(devicePixelRatio);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 2000); cam.position.set(0, 0, 4.2);
const sp = new Float32Array(6000); for (let i = 0; i < 6000; i++) sp[i] = (Math.random() - .5) * 1200;
const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: false })));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6); sun.position.set(8, 2, 6); scene.add(sun, new THREE.AmbientLight(0x223344, .6));
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a8 })); sunBall.position.set(60, 14, 40); scene.add(sunBall);
const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
const globe = new THREE.Mesh(new THREE.SphereGeometry(1.5, 96, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, color: 0x111820 })); scene.add(globe);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.56, 64, 64), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: .12, side: THREE.BackSide })); scene.add(atmo);
let spin = true, dist = 4.2, wantDist = 4.2;
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
let drag = null; const cvs = $("globe");
cvs.onpointerdown = e => drag = { x: e.clientX, y: e.clientY, m: 0 };
cvs.onpointermove = e => { if (!drag) return; globe.rotation.y += (e.clientX - drag.x) * .005; globe.rotation.x = Math.max(-1.2, Math.min(1.2, globe.rotation.x + (e.clientY - drag.y) * .005)); drag.m += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; };
cvs.onpointerup = e => { if (drag && drag.m < 5) pick(e); drag = null; };
cvs.onwheel = e => { wantDist = Math.max(1.9, Math.min(8, wantDist + e.deltaY * .003)); };
const TIERS = () => dist < 2.6 ? "Tier 3 · Ground" : dist < 4 ? "Tier 2 · Geopolitical" : "Tier 1 · Globe";
(function loop() { requestAnimationFrame(loop); if (spin) globe.rotation.y += .0012; dist += (wantDist - dist) * .08; cam.position.z = dist; $("tier").textContent = TIERS(); renderer.render(scene, cam); })();

/* ---------- world data ---------- */
let world = null; // {b:Uint8Array,e:Int16Array,m:Uint8Array}
function paint() {
  const img = cx.createImageData(W, H);
  BIOMES.forEach((_, i) => { const c = parseInt(BIOMES[i][1].slice(1), 16); BIOMES[i].rgb = [c >> 16, c >> 8 & 255, c & 255]; });
  for (let i = 0; i < W * H; i++) { const c = BIOMES[world.b[i]].rgb, shade = world.e[i] > 0 ? 1 + Math.min(world.e[i], 5000) / 18000 : 1; img.data.set([c[0] * shade, c[1] * shade, c[2] * shade, 255], i * 4); }
  cx.putImageData(img, 0, 0); tex.needsUpdate = true; globe.material.color.set(0xffffff);
}
async function generate(seed) {
  const bands = [], total = H; $("genbtn").hidden = true;
  for (let y = 0; y < H; y++) {
    const la = 90 - (y + .5) * 180 / H, b = [], e = [], m = [];
    for (let x = 0; x < W; x++) { const s = sample(seed, la, (x + .5) * 360 / W - 180); b.push(biome(s)); e.push(s.e); m.push(Math.round(s.m * 100)); }
    bands.push({ y, b, e, m }); if (y % 6 === 0) { $("genbar").style.width = (y / total * 50) + "%"; $("genmsg").textContent = `Shaping continents, rivers & biomes… row ${y}/${H}`; await new Promise(r => setTimeout(r)); }
  }
  for (let i = 0; i < bands.length; i += 20) {
    const wb = writeBatch(db); bands.slice(i, i + 20).forEach(d => wb.set(doc(db, "world_cells", "r" + String(d.y).padStart(3, "0")), d));
    await wb.commit(); $("genbar").style.width = (50 + i / total * 50) + "%"; $("genmsg").textContent = `Saving to Firestore… ${i + 20}/${H} bands`;
  }
  await setDoc(doc(db, "world", "meta"), { seed, w: W, h: H, generated: true, startedAt: serverTimestamp() });
}
async function loadWorld() {
  const snap = await getDocs(collection(db, "world_cells")); if (snap.empty) return false;
  world = { b: new Uint8Array(W * H), e: new Int16Array(W * H), m: new Uint8Array(W * H) };
  snap.forEach(d => { const v = d.data(); world.b.set(v.b, v.y * W); world.e.set(v.e, v.y * W); world.m.set(v.m, v.y * W); });
  paint(); return true;
}

/* ---------- screens ---------- */
const show = id => { document.querySelectorAll(".screen").forEach(s => s.classList.remove("show")); id && $(id).classList.add("show"); };
let welcomeDone = false, hasUser = false;
setTimeout(() => { welcomeDone = true; if (!hasUser) show("auth"); }, 4200);
const eb = document.body.appendChild(Object.assign(document.createElement("div"), { id: "errbar" }));
const fail = e => { console.error(e); eb.textContent = "Error: " + (e?.code || e?.message || e) + (/permission/i.test(e?.code + e?.message) ? " (publish earth_firestore.rules in Firebase)" : ""); eb.style.display = "block"; };
addEventListener("unhandledrejection", e => fail(e.reason)); addEventListener("error", e => fail(e.error || e.message));
const mail = () => $("user").value.trim().toLowerCase() + "@earth.game";
const authGo = fn => async () => { $("autherr").textContent = ""; try { await fn(auth, mail(), $("pass").value); } catch (e) { $("autherr").textContent = e.code?.replace("auth/", "").replace(/-/g, " ") || "error"; } };
$("login").onclick = authGo(signInWithEmailAndPassword); $("signup").onclick = authGo(createUserWithEmailAndPassword);
let me = null, meta = null, empire = null;
onAuthStateChanged(auth, async u => {
  if (!u) { hasUser = false; if (welcomeDone) show("auth"); return; } hasUser = true; me = u; show("load"); $("loadbar").style.width = "20%";
  const name = u.email.split("@")[0], isAdmin = name === ADMIN;
  const m = await getDoc(doc(db, "world", "meta")); meta = m.exists() ? m.data() : null;
  if (!meta || !(await loadWorld())) {
    show("gen"); $("genmsg").textContent = isAdmin ? "The planet is empty. Generate it to begin." : "The world has not been generated yet. Please wait for Vortarium.";
    if (isAdmin) { $("genbtn").hidden = false; $("genbtn").onclick = async () => { await generate((Math.random() * 1e9) | 0); location.reload(); }; } return;
  }
  $("loadbar").style.width = "60%";
  const p = await getDoc(doc(db, "players", u.uid)); empire = p.exists() ? p.data() : null;
  if (empire?.collapsed) { show("auth"); $("autherr").textContent = "Your empire collapsed. This account is forgotten; make a new account."; signOut(auth); return; }
  if (!empire) { show("found"); $("foundbtn").onclick = found; } else start();
});
async function found() {
  const nm = $("empname").value.trim(); if (!nm) return; show("load"); $("loadtxt").textContent = "Choosing your starting lands…";
  let tries = 0, c; do { const x = Math.random() * W | 0, y = 20 + Math.random() * (H - 40) | 0, i = y * W + x; c = { x, y, b: world.b[i] }; tries++; } while (![10, 12, 13, 14, 15, 16, 17, 21, 22, 23].includes(c.b) && tries < 2000);
  empire = { name: nm, owner: me.email.split("@")[0], spawn: { x: c.x, y: c.y }, era: "Tribal", pop: 120 + (Math.random() * 60 | 0), food: 400, water: 400, happiness: 70, currency: nm.slice(0, 3).toUpperCase() + " Mark", treasury: 100, explored: 1 };
  try { await setDoc(doc(db, "players", me.uid), empire); } catch (e) { fail(e); show("found"); return; } start();
}
const MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], MN = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function gameTime() {
  const s = Math.floor((Date.now() - meta.startedAt.toMillis()) / 1000 * 60), D = Math.floor(s / 86400), yr = Math.floor(D / 365); let d = D % 365, mo = 0; while (d >= MONTHS[mo]) d -= MONTHS[mo++];
  const lon = empire ? empire.spawn.x * 360 / W - 180 : 0, off = Math.round(lon / 15), t = s + off * 3600, hh = Math.floor(t % 86400 / 3600), mm = Math.floor(t % 3600 / 60);
  const doy = D % 365, north = doy > 79 && doy < 172 ? "Spring" : doy < 266 && doy >= 172 ? "Summer" : doy < 355 && doy >= 266 ? "Autumn" : "Winter", south = { Spring: "Autumn", Summer: "Winter", Autumn: "Spring", Winter: "Summer" }[north];
  return { str: `${MN[mo]} ${d + 1}, ${String(yr).padStart(4, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} (UTC${off >= 0 ? "+" : ""}${off})`, north, south };
}
function start() {
  show(null); $("hud").hidden = false; spin = false; $("empire").textContent = empire.name;
  const lat = 90 - (empire.spawn.y + .5) * 180 / H, lon = (empire.spawn.x + .5) * 360 / W - 180, ph = lat * Math.PI / 180;
  globe.rotation.y = Math.atan2(-Math.cos(lon * Math.PI / 180), -Math.sin(lon * Math.PI / 180)); globe.rotation.x = ph * .6; wantDist = 3.2;
  setInterval(() => { const g = gameTime(); $("clock").textContent = g.str; $("season").textContent = `N: ${g.north} · S: ${g.south}`; }, 500);
  initGame({ THREE, globe, cam, db, me, empire, world, BIOMES, play, snd, W, H, auth, signOut, gameTime, getDist: () => dist, setDist: v => { wantDist = v; }, startMs: meta.startedAt.toMillis(), fs: { doc, setDoc, getDocs, collection, addDoc, query, orderBy, limit, updateDoc, deleteDoc, where } });
  return;
  $("stats").innerHTML = `Era: ${empire.era}<br>Population: ${empire.pop}<br>Food: ${empire.food} t · Water: ${empire.water} kL<br>Happiness: ${empire.happiness}%<br>Currency: ${empire.currency}<br>Treasury: ${empire.treasury}`;
}
const ray = new THREE.Raycaster();
function pick(e) {
  if (!world) return; ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, cam);
  const h = ray.intersectObject(globe)[0]; if (!h) return; const x = Math.min(W - 1, h.uv.x * W | 0), y = Math.min(H - 1, (1 - h.uv.y) * H | 0), i = y * W + x, b = world.b[i], el = world.e[i];
  const la = 90 - (y + .5) * 180 / H, t = (31 - 52 * Math.pow(Math.abs(la) / 90, 1.4) - Math.max(0, el) / 1000 * 6.5).toFixed(1);
  $("info").hidden = false; $("info").innerHTML = `<h3>${BIOMES[b][0]}</h3>Lat ${la.toFixed(1)}° · Lon ${((x + .5) * 360 / W - 180).toFixed(1)}°<br>${el > 0 ? "Elevation" : "Depth"}: ${Math.abs(el)} m<br>Mean temp: ${t} °C<br>Rainfall index: ${world.m[i]}%<br>Soil: ${el > 0 ? SOIL[soilOf(b)] : "Marine sediment"}<br>Surface area per tile: ~${Math.round(510e6 * Math.cos(la * Math.PI / 180) / (W * H) * 360 / 2 / Math.PI * 0 + 510e6 / (W * H))} km²`;
}
window.earthAI = async prompt => { if (!AI_ENDPOINT) return null; try { const r = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await auth.currentUser.getIdToken() }, body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(8000) }); return (await r.json()).text; } catch { return null; } }; // optional helper; game never depends on it

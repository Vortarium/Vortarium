import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js";

import { DEF, FX, filt, fxCss, TEXT_STYLES, TEXTRESET, cssFor, SHAPES, SHAPE_NAMES, EO, FILLS, STICKER_CATS, ANIMS, LOOPS, BLENDS, animMod, applyAudio, graph, getCtx, resumeAudio, clamp } from "./jewelfish_assets.js";

const app = initializeApp({ apiKey: "AIzaSyB3Qaz6ybfPKqhHjLQxrfjEpLDnY94oZ_w", authDomain: "jewelfish-6972c.firebaseapp.com", projectId: "jewelfish-6972c", storageBucket: "jewelfish-6972c.firebasestorage.app", messagingSenderId: "883520734279", appId: "1:883520734279:web:a5ead565bb996ace4f9d62" });
const auth = getAuth(app), db = getFirestore(app), store = getStorage(app);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const show = id => { $$(".screen").forEach(s => s.classList.toggle("active", s.id === id)); };
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 2200); };
const fmt = s => { s = Math.max(0, s); return Math.floor(s / 60) + ":" + (s % 60).toFixed(2).padStart(5, "0"); };

/* ---------- auth ---------- */
let user = null, signup = false;
$$("[data-go]").forEach(b => b.onclick = () => show(b.dataset.go));
$("#authSwap").onclick = () => { signup = !signup; $("#authTitle").textContent = signup ? "Create account" : "Sign in"; $("#authGo").textContent = signup ? "Sign up" : "Sign in"; $("#authSwap").textContent = signup ? "I have an account" : "Create an account"; };
$("#authGo").onclick = async () => {
  const u = $("#user").value.trim().toLowerCase(), p = $("#pass").value; $("#authErr").textContent = "";
  if (!/^[a-z0-9_.-]{3,20}$/.test(u)) return $("#authErr").textContent = "Username: 3–20 letters, numbers, _ . -";
  try { const e = u + "@jewelfish.app"; signup ? await createUserWithEmailAndPassword(auth, e, p) : await signInWithEmailAndPassword(auth, e, p); }
  catch (x) { $("#authErr").textContent = x.code.replace("auth/", "").replace(/-/g, " "); }
};
$("#logout").onclick = () => signOut(auth);
onAuthStateChanged(auth, u => { user = u; if (u) { $("#who").textContent = u.email.split("@")[0]; loadHub(); } else show("title"); });

/* ---------- hub ---------- */
async function loadHub() {
  show("hub"); const L = $("#projList"); L.innerHTML = "";
  const snap = await getDocs(query(collection(db, "projects"), where("uid", "==", user.uid)));
  const rows = snap.docs.map(d => d.data()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (!rows.length) L.innerHTML = '<small style="color:var(--mt)">No projects yet — create one.</small>';
  rows.forEach(p => {
    const c = document.createElement("div"); c.className = "pcard";
    c.innerHTML = `<div class="thumb">${logoTag()}</div><b></b><small>${p.ratio} · ${fmt(duration(p))} · ${new Date(p.updated || 0).toLocaleDateString()}</small><div class="row"><span class="btn" data-a="e">Edit</span><span class="btn" data-a="v">View</span><span class="btn" data-a="d">Delete</span></div>`;
    c.querySelector("b").textContent = p.title;
    c.querySelector('[data-a=e]').onclick = () => openProject(p, false);
    c.querySelector('[data-a=v]').onclick = () => openProject(p, true);
    c.querySelector('[data-a=d]').onclick = async () => { if (confirm(`Delete "${p.title}"?`)) { await deleteDoc(doc(db, "projects", p.id)); loadHub(); } };
    L.appendChild(c);
  });
}
$("#newProj").onclick = () => openProject({ id: uid() + uid(), title: "Untitled", ratio: "16:9", cw: 1280, ch: 720, media: [], clips: [] }, false, true);
$("#mHub").onclick = () => { stop(); loadHub(); };
$("#mLoad").onclick = $("#mHub").onclick;

/* ---------- editor state ---------- */
let P, sel = null, t = 0, playing = false, zoom = 60, last = 0, dirty = false;
const TRACKS = 5, els = {}; // media elements by media id
const cv = $("#cv"), cx = cv.getContext("2d");
const duration = p => Math.max(5, ...(p.clips || []).map(c => c.start + c.dur));
const RATIOS = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1000, 1000], "4:3": [1200, 900], "4:5": [960, 1200], "21:9": [1400, 600], "2:3": [800, 1200] };

function openProject(p, view, fresh) {
  P = JSON.parse(JSON.stringify(p)); P.clips = (P.clips || []).map(c => ({ ...base({}), ...c, id: c.id })); P.media ||= []; hist = []; fut = []; lastSnap = snapStr(); sel = null; t = 0; dirty = !!fresh;
  $("#editor").classList.toggle("view", !!view); $("#projTitle").value = P.title; $("#ratio").value = RATIOS[P.ratio] ? P.ratio : "custom";
  Object.keys(els).forEach(k => delete els[k]); P.media.forEach(prepMedia); setSize(P.cw, P.ch);
  show("editor"); renderAll(); if (view) setTimeout(play, 300);
}
function setSize(w, h) { P.cw = w; P.ch = h; cv.width = w; cv.height = h; draw(); }
$("#ratio").onchange = e => {
  let v = e.target.value; if (v === "custom") { const r = prompt("Custom width x height (e.g. 1080x1350):", "1080x1350"); const m = r && r.match(/(\d{2,5})\s*[x:]\s*(\d{2,5})/i); if (!m) return; P.ratio = `${m[1]}x${m[2]}`; setSize(+m[1], +m[2]); }
  else { P.ratio = v; setSize(...RATIOS[v]); } mark();
};
$("#projTitle").oninput = e => { P.title = e.target.value; mark(); };
$("#mTitle").onclick = () => { const n = prompt("Project title:", P.title); if (n) { P.title = n; $("#projTitle").value = n; mark(); } };

/* ---------- media ---------- */
function prepMedia(m) {
  if (m.type === "image") { const i = new Image(); i.crossOrigin = "anonymous"; i.src = m.url; els[m.id] = i; }
  else { const v = document.createElement(m.type === "video" ? "video" : "audio"); v.crossOrigin = "anonymous"; v.src = m.url; v.preload = "auto"; v.playsInline = true; els[m.id] = v; }
}
$("#upload").onchange = async e => {
  for (const f of e.target.files) {
    const type = f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "image"; const id = uid();
    toast("Uploading " + f.name + "…");
    try {
      const r = ref(store, `users/${user.uid}/${P.id}/${id}_${f.name}`); await uploadBytes(r, f);
      const m = { id, name: f.name, type, url: await getDownloadURL(r) }; P.media.push(m); prepMedia(m);
      if (type !== "image") await new Promise(res => { els[id].onloadedmetadata = res; setTimeout(res, 4000); }); m.dur = type === "image" ? 5 : (els[id].duration || 5);
      mark(); renderBank();
    } catch (x) { toast("Upload failed: " + x.code); }
  } e.target.value = "";
};
function renderBank() {
  const B = $("#bank"); B.innerHTML = "";
  P.media.forEach(m => {
    const d = document.createElement("div"); d.className = "mi"; d.draggable = true;
    d.innerHTML = `<div class="th">${m.type === "image" ? `<img src="${m.url}">` : m.type === "video" ? `<video src="${m.url}#t=0.5" muted></video>` : "♪"}</div><span></span>`; d.querySelector("span").textContent = m.name;
    d.onclick = () => addClip(m, t, firstFree(t, m.dur)); d.ondragstart = ev => ev.dataTransfer.setData("m", m.id); B.appendChild(d);
  });
}
function firstFree(s, dur) { for (let k = 0; k < TRACKS; k++) if (!P.clips.some(c => c.track === k && c.start < s + dur && c.start + c.dur > s)) return k; return 0; }
function base(o) { return Object.assign({ id: uid(), ...DEF, kf: [] }, o); }
function addClip(m, start, track) { const c = base({ mid: m.id, type: m.type, name: m.name, start, dur: Math.min(m.dur || 5, 600), track }); P.clips.push(c); select(c.id); mark(); renderAll(); }
$("#tracks").addEventListener("dragover", e => e.preventDefault());

/* ---------- fonts & text ---------- */
const FONTS = "Roboto,Open Sans,Lato,Montserrat,Oswald,Raleway,Poppins,Playfair Display,Merriweather,Nunito,Ubuntu,Rubik,Bebas Neue,Anton,Lobster,Pacifico,Dancing Script,Caveat,Permanent Marker,Abril Fatface,Archivo Black,Bangers,Cinzel,Comfortaa,Fredoka,Inter,Josefin Sans,Lora,Quicksand,Righteous,Satisfy,Shadows Into Light,Source Code Pro,Space Mono,Teko,Titillium Web,Yanone Kaffeesatz,Zilla Slab,Orbitron,Press Start 2P,Monoton,Great Vibes,Alfa Slab One,Bungee,Cormorant Garamond,DM Serif Display,Syne,Unbounded,Barlow,Bitter,Cabin,Crimson Text,Exo 2,Fira Sans,Heebo,IBM Plex Sans,Karla,Libre Baskerville,Manrope,Mukta,Noto Sans,Noto Serif,Outfit,Overpass,PT Sans,PT Serif,Play,Prompt,Sora,Spectral,Work Sans,Arvo,Asap,Bree Serif,Chivo,Dosis,Hind,Kanit,Maven Pro,Patua One,Philosopher,Signika,Varela Round,Vollkorn,Yeseva One,Amatic SC,Bowlby One,Chewy,Creepster,Fascinate,Gloria Hallelujah,Indie Flower,Kaushan Script,Luckiest Guy,Special Elite,Rock Salt,Sacramento,Shrikhand,Tangerine,VT323,Rubik Glitch,Rubik Mono One,Bungee Shade,Staatliches,Squada One,Russo One,Paytone One".split(",");
let curFont = "Montserrat"; const loaded = new Set();
function loadFont(f) { if (loaded.has(f)) return; loaded.add(f); const l = document.createElement("link"); l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, "+")}&display=swap`; document.head.appendChild(l); }
function renderFonts() {
  const q = ($("#fontSearch")?.value || "").toLowerCase(), L = $("#fontList"); if (!L) return; L.innerHTML = "";
  FONTS.filter(f => f.toLowerCase().includes(q)).forEach(f => { loadFont(f); const d = document.createElement("div"); d.textContent = f; d.style.fontFamily = `"${f}"`; if (f === curFont) d.className = "on";
    d.onclick = () => { curFont = f; const c = cl(sel); if (c && c.type === "text") { c.font = f; mark(); draw(); } renderFonts(); }; L.appendChild(d); });
}
function newText(extra) { const c = base({ type: "text", kind: "title", name: "Text", text: "Your text", font: curFont, size: 110, start: t, dur: 4, track: 0, ...extra }); c.track = firstFree(c.start, c.dur); P.clips.push(c); select(c.id); mark(); renderAll(); }
const KINDS = { Title: { aIn: "pop" }, Countdown: { kind: "countdown", name: "Countdown", text: "Countdown", from: 10, dur: 10, size: 260, aLoop: "pulse" }, Countup: { kind: "countup", name: "Countup", text: "Countup", from: 0, dur: 10, size: 260 },
  Credits: { kind: "credits", name: "Credits", text: "DIRECTED BY\nJewelfish\n\nMUSIC BY\nYou\n\nTHANKS FOR WATCHING", dur: 12, size: 60 },
  "Lower third": { text: "Name · Title", size: 52, y: .36, bub: "pill", bubC: "#000000b0", aIn: "slideL", aOut: "fade" }, Subtitle: { text: "Subtitle text", size: 46, y: .4, bub: "box", bubC: "#000000a0" } };
$("#pane-text").innerHTML = `<div class="kinds">${Object.keys(KINDS).map(k => `<button data-kind="${k}">${k}</button>`).join("")}</div><input id="fontSearch" placeholder="Search ${FONTS.length} fonts…"><div id="fontList" class="fontlist"></div>
<label class="btn up">Upload fonts (.zip / .ttf / .otf) — shared<input id="fontUp" type="file" accept=".ttf,.otf,.woff,.woff2,.zip" multiple hidden></label><h5>${TEXT_STYLES.length} styles — click to apply</h5><div id="styleGrid" class="sgrid"></div>`;
$$("[data-kind]").forEach(b => b.onclick = () => newText(KINDS[b.dataset.kind]));
$("#fontSearch").oninput = renderFonts;
$("#styleGrid").innerHTML = TEXT_STYLES.map((s, i) => `<div class="sc" data-i="${i}" title="${s.name}"><span style="${cssFor(s.st)}">Aa</span></div>`).join("");
$("#styleGrid").onclick = e => { const d = e.target.closest("[data-i]"); if (!d) return; const st = TEXT_STYLES[+d.dataset.i].st, c = cl(sel); if (c && c.type === "text") { Object.assign(c, TEXTRESET, st); mark(); renderInsp(); draw(); } else newText({ ...TEXTRESET, ...st }); };
async function addFontBlob(name, blob) {
  const n = name.replace(/\.\w+$/, ""), r = ref(store, `fonts/${uid()}_${name}`); await uploadBytes(r, blob); const url = await getDownloadURL(r);
  await setDoc(doc(db, "fonts", n.replace(/[^\w-]/g, "_")), { name: n, url, by: user.uid }); const ff = new FontFace(n, `url(${url})`); await ff.load(); document.fonts.add(ff); if (!FONTS.includes(n)) FONTS.unshift(n); loaded.add(n);
}
$("#fontUp").onchange = async e => {
  try { for (const f of e.target.files) {
    if (/\.zip$/i.test(f.name)) { if (!window.JSZip) await new Promise(r => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = r; document.head.appendChild(s); });
      const z = await JSZip.loadAsync(f); for (const en of Object.values(z.files)) if (/\.(ttf|otf|woff2?)$/i.test(en.name) && !en.dir) await addFontBlob(en.name.split("/").pop(), await en.async("blob")); }
    else await addFontBlob(f.name, f); }
    renderFonts(); toast("Fonts added for everyone"); } catch (x) { toast("Font upload failed: " + (x.code || x.message)); } e.target.value = "";
};
onAuthStateChanged(auth, async u => { if (!u) return; try { (await getDocs(collection(db, "fonts"))).docs.forEach(d => { const f = d.data(); new FontFace(f.name, `url(${f.url})`).load().then(ff => { document.fonts.add(ff); if (!FONTS.includes(f.name)) FONTS.unshift(f.name); loaded.add(f.name); renderFonts(); }).catch(() => {}); }); } catch (e) {} });

/* ---------- shapes ---------- */
let shFill = 0;
function shIcon(n, fi) { const k = document.createElement("canvas"); k.width = k.height = 44; const g = k.getContext("2d"), f = FILLS[fi]; g.translate(22, 22); let s = f[0]; if (f[1]) { s = g.createLinearGradient(-18, -18, 18, 18); s.addColorStop(0, f[0]); s.addColorStop(1, f[1]); } g.fillStyle = s; g.strokeStyle = "#8b93a7"; g.fill(SHAPES[n](34, 34), EO.has(n) ? "evenodd" : "nonzero"); if (fi === 0 || fi === 4) g.stroke(SHAPES[n](34, 34)); return k; }
function renderShapes() {
  $("#pane-shapes").innerHTML = `<div class="sw">${FILLS.map((f, i) => `<i data-f="${i}" class="${i === shFill ? "on" : ""}" style="background:linear-gradient(135deg,${f[0]},${f[1] || f[0]})"></i>`).join("")}</div><h5>${SHAPE_NAMES.length} shapes × ${FILLS.length} fills</h5><div class="sgrid shp" id="shGrid"></div>`;
  const G = $("#shGrid"); SHAPE_NAMES.forEach(n => { const d = document.createElement("div"); d.className = "sc"; d.title = n; d.appendChild(shIcon(n, shFill)); d.onclick = () => addShape(n); G.appendChild(d); });
  $$("#pane-shapes [data-f]").forEach(i => i.onclick = () => { shFill = +i.dataset.f; renderShapes(); });
}
function addShape(n) { const f = FILLS[shFill], c = base({ type: "shape", name: n, shape: n, color: f[0], color2: f[1] || "", w: .25, h: .25, strokeC: "#ffffff", start: t, dur: 4, track: 0, aIn: "zoom" }); c.track = firstFree(c.start, c.dur); P.clips.push(c); select(c.id); mark(); renderAll(); }
renderShapes();

/* ---------- stickers ---------- */
let stCat = "Faces";
function renderStickers() {
  $("#pane-stickers").innerHTML = `<select id="stCat">${Object.keys(STICKER_CATS).map(k => `<option ${k === stCat ? "selected" : ""}>${k}</option>`).join("")}</select><h5>${Object.values(STICKER_CATS).flat().length} stickers</h5><div class="sgrid stk" id="stGrid">${STICKER_CATS[stCat].map(e => `<div class="sc">${e}</div>`).join("")}</div>`;
  $("#stCat").onchange = e => { stCat = e.target.value; renderStickers(); };
  $("#stGrid").onclick = e => { const d = e.target.closest(".sc"); if (!d) return; const c = base({ type: "text", kind: "sticker", name: "Sticker", text: d.textContent + "\uFE0F", font: "Noto Color Emoji", size: 260, start: t, dur: 4, track: 0, aIn: "pop", aLoop: "float" }); c.track = firstFree(c.start, c.dur); P.clips.push(c); select(c.id); mark(); renderAll(); };
}
renderStickers();

/* ---------- effects / transitions / sound ---------- */
$("#pane-fx").innerHTML = `<h5>${Object.keys(FX).length} color looks — applies to selected clip</h5><div class="sgrid fxg">${Object.entries(FX).map(([n, f]) => `<div class="fxc" data-fx="${n}"><div class="fxs" style="filter:${fxCss(f)}"></div><span>${n}</span></div>`).join("")}</div>`;
function setFx(c, n) { Object.assign(c, DEF_COLOR, FX[n], { fx: n }); }
const DEF_COLOR = { br: 1, ct: 1, sat: 1, hue: 0, sep: 0, blur: 0, inv: 0, gry: 0, temp: 0, tint: 0, vig: 0 };
$$("[data-fx]").forEach(b => b.onclick = () => { const c = cl(sel); if (!c || c.type === "audio" || c.type === "flash") return toast("Select a visual clip first"); setFx(c, b.dataset.fx); mark(); renderInsp(); draw(); });
const FLASH = ["#ffffff", "#000000", "#ff3b6b", "#3be8ff", "#ffd60a", "#8338ec", "#2ec27e", "#ff9f1c", "#3a86ff", "#ff5dc8", "#7bff6a", "#d4af37"];
$("#pane-trans").innerHTML = `<h5>Fades (selected clip)</h5><div class="kinds"><button data-add="fadeIn">Fade in</button><button data-add="fadeOut">Fade out</button></div><h5>Flashes &amp; dips (at playhead)</h5><div class="sw">${FLASH.map(c => `<i data-flash="${c}" style="background:${c}"></i>`).join("")}</div>
<h5>Entrance</h5><div class="kinds">${ANIMS.slice(1).map(a => `<button data-an="aIn:${a}">${a}</button>`).join("")}</div><h5>Exit</h5><div class="kinds">${ANIMS.slice(1).map(a => `<button data-an="aOut:${a}">${a}</button>`).join("")}</div><h5>Loop</h5><div class="kinds">${LOOPS.slice(1).map(a => `<button data-an="aLoop:${a}">${a}</button>`).join("")}<button data-an="all:none">clear all</button></div>`;
$$("[data-add]").forEach(b => b.onclick = () => { const c = cl(sel); if (!c) return toast("Select a clip first"); c[b.dataset.add] = 1; mark(); renderInsp(); });
$$("[data-flash]").forEach(i => i.onclick = () => { const f = base({ type: "flash", name: "Flash", color: i.dataset.flash, start: t, dur: .6, track: 0 }); f.track = firstFree(t, .6); P.clips.push(f); select(f.id); mark(); renderAll(); });
$$("[data-an]").forEach(b => b.onclick = () => { const c = cl(sel); if (!c || c.type === "audio") return toast("Select a visual clip first"); const [k, v] = b.dataset.an.split(":"); if (k === "all") Object.assign(c, { aIn: "none", aOut: "none", aLoop: "none" }); else c[k] = v; mark(); renderInsp(); });
const SOUND = [["Voice boost", { boost: 1.6, bass: -3, treble: 5 }], ["Bass boost", { bass: 10, boost: 1.3 }], ["Treble boost", { treble: 10 }], ["Telephone", { bass: -15, treble: 6, boost: 1.4 }], ["Muffled", { treble: -15, bass: 4 }], ["Warm", { bass: 5, treble: -3 }], ["Bright", { bass: -2, treble: 8 }],
  ["Pan left", { pan: -1 }], ["Pan right", { pan: 1 }], ["Center", { pan: 0 }], ["Loud ×2", { boost: 2 }], ["Quiet", { vol: .3 }], ["Mute", { mute: 1 }], ["Unmute", { mute: 0 }], ["Slow 0.5×", { speed: .5 }], ["Slow 0.75×", { speed: .75 }], ["Fast 1.5×", { speed: 1.5 }], ["Fast 2×", { speed: 2 }],
  ["Reset sound", { vol: 1, mute: 0, boost: 1, pan: 0, bass: 0, treble: 0, speed: 1 }]];
$("#pane-sound").innerHTML = `<h5>Sound presets — selected video/audio clip</h5><div class="kinds">${SOUND.map(([n], i) => `<button data-snd="${i}">${n}</button>`).join("")}</div><small>Fine control (volume, boost, pan, bass, treble, speed) is in the inspector. EQ/pan/boost need CORS set on your Storage bucket.</small>`;
$$("[data-snd]").forEach(b => b.onclick = () => { const c = cl(sel); if (!c || (c.type !== "video" && c.type !== "audio")) return toast("Select a video or audio clip"); Object.assign(c, SOUND[+b.dataset.snd][1]); mark(); renderInsp(); });
$$(".tab").forEach(b => b.onclick = () => { $$(".tab").forEach(x => x.classList.toggle("active", x === b)); $$(".pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + b.dataset.tab)); });

/* ---------- render ---------- */
const cl = id => P && P.clips.find(c => c.id === id);
const fadeF = (c, r) => { let f = 1; if (c.fadeIn && r < c.fadeIn) f = r / c.fadeIn; if (c.fadeOut && c.dur - r < c.fadeOut) f = Math.min(f, (c.dur - r) / c.fadeOut); return clamp(f, 0, 1); };
function props(c, tt) {
  const r = tt - c.start, p = { x: c.x, y: c.y, s: c.s, o: c.o, rot: c.rot };
  if (c.kf.length) { const k = [...c.kf].sort((a, b) => a.t - b.t); let a = k[0], b = k[k.length - 1];
    if (r <= a.t) Object.assign(p, a); else if (r >= b.t) Object.assign(p, b); else { for (let i = 0; i < k.length - 1; i++) if (r >= k[i].t && r <= k[i + 1].t) { a = k[i]; b = k[i + 1]; } const u = (r - a.t) / (b.t - a.t), e = u * u * (3 - 2 * u); for (const n of ["x", "y", "s", "o", "rot"]) p[n] = a[n] + (b[n] - a[n]) * e; } }
  p.o *= fadeF(c, r); return p;
}
const sc = document.createElement("canvas"), sx = sc.getContext("2d"), nfmt = v => v >= 60 ? Math.floor(v / 60) + ":" + String(v % 60).padStart(2, "0") : String(v);
function drawText(g, c, r, m, H) {
  const stack = c.font.includes(",") ? c.font : `"${c.font}"`; g.font = `${c.size}px ${stack},"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  let txt = c.text || ""; if (c.kind === "countdown") txt = nfmt(Math.max(0, Math.ceil(c.from - r))); else if (c.kind === "countup") txt = nfmt(Math.floor(c.from + r));
  if (m.chars < 1) txt = [...txt].slice(0, Math.floor([...txt].length * m.chars)).join("");
  const lines = txt.split("\n"), lh = c.size * 1.2, bh = lines.length * lh, off = c.kind === "credits" ? (1 - 2 * clamp(r / c.dur, 0, 1)) * (H / 2 + bh / 2) : 0, w = Math.max(1, ...lines.map(l => g.measureText(l).width));
  g.save(); g.translate(0, off);
  if (c.bub && c.bub !== "none") { const pad = c.size * .3, bw = w + pad * 2, bhh = bh + pad * .6; g.fillStyle = c.bubC; g.beginPath(); g.roundRect(-bw / 2, -bhh / 2, bw, bhh, c.bub === "pill" ? bhh / 2 : c.size * .08); g.fill(); }
  lines.forEach((l, i) => { const y = (i - (lines.length - 1) / 2) * lh; let fill = c.color;
    if (c.fill2) { const gr = g.createLinearGradient(0, y - c.size / 2, 0, y + c.size / 2); gr.addColorStop(0, c.color); gr.addColorStop(1, c.fill2); fill = gr; }
    if (c.shB || c.shD) { g.shadowColor = c.shC; g.shadowBlur = c.shB; g.shadowOffsetX = g.shadowOffsetY = c.shD; }
    if (c.sw) { g.lineWidth = c.sw; g.strokeStyle = c.strokeC; g.strokeText(l, 0, y); } g.fillStyle = fill; g.fillText(l, 0, y); if (c.shB > 20) g.fillText(l, 0, y); g.shadowColor = "transparent";
    if (c.line && c.line !== "none") { const lw = g.measureText(l).width, ly = c.line === "under" ? y + c.size * .45 : c.line === "over" ? y - c.size * .5 : y; g.fillStyle = c.color; g.fillRect(-lw / 2, ly - c.size * .035, lw, Math.max(2, c.size * .07)); } });
  g.restore();
}
function drawShape(g, c, W) {
  const w = c.w * W, h = c.h * W, path = (SHAPES[c.shape] || SHAPES.rectangle)(w, h); let f = c.color; if (c.color2) { f = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); f.addColorStop(0, c.color); f.addColorStop(1, c.color2); }
  g.fillStyle = f; g.fill(path, EO.has(c.shape) ? "evenodd" : "nonzero"); if (c.sw) { g.lineWidth = c.sw; g.strokeStyle = c.strokeC; g.lineJoin = "round"; g.stroke(path); }
}
function draw() {
  if (!P) return; const W = cv.width, H = cv.height; if (sc.width !== W || sc.height !== H) { sc.width = W; sc.height = H; }
  cx.globalAlpha = 1; cx.filter = "none"; cx.globalCompositeOperation = "source-over"; cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
  [...P.clips].sort((a, b) => a.track - b.track).forEach(c => {
    const r = t - c.start, active = r >= 0 && r < c.dur, el = els[c.mid];
    if (el && c.type !== "image") { const rel = c.in + r * (c.speed || 1); applyAudio(el, c, fadeF(c, r));
      if (!active || !playing) { if (!el.paused) el.pause(); if (active && Math.abs(el.currentTime - rel) > .05) el.currentTime = rel; }
      else { if (Math.abs(el.currentTime - rel) > .35) el.currentTime = rel; if (el.paused) el.play().catch(() => {}); } }
    if (!active || c.type === "audio") return;
    const p = props(c, t), m = animMod(c, r), o = clamp(p.o * m.o, 0, 1); if (o <= 0) return;
    sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, W, H); sx.globalCompositeOperation = "source-over"; sx.filter = "none";
    if (c.type === "flash") { sx.fillStyle = c.color; sx.fillRect(0, 0, W, H); }
    else { sx.translate(W / 2 + (p.x + m.dx) * W, H / 2 + (p.y + m.dy) * H); sx.rotate((p.rot + m.rot) * Math.PI / 180); const S = p.s * m.s; sx.scale(S * (c.flip === "h" || c.flip === "hv" ? -1 : 1), S * (c.flip === "v" || c.flip === "hv" ? -1 : 1)); sx.filter = filt(c, m.blur);
      if (c.type === "text") drawText(sx, c, r, m, H); else if (c.type === "shape") drawShape(sx, c, W);
      else if (el) { const sw = el.videoWidth || el.naturalWidth, sh = el.videoHeight || el.naturalHeight; if (sw) { const k = (c.fit === "fill" ? Math.max : Math.min)(W / sw, H / sh); try { sx.drawImage(el, -sw * k / 2, -sh * k / 2, sw * k, sh * k); } catch (e) {} } } }
    sx.restore();
    if (c.type !== "flash") { sx.save(); sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = "source-atop";
      if (c.temp) { sx.fillStyle = c.temp > 0 ? `rgba(255,150,40,${c.temp / 300})` : `rgba(40,130,255,${-c.temp / 300})`; sx.fillRect(0, 0, W, H); }
      if (c.tint) { sx.fillStyle = c.tint > 0 ? `rgba(255,40,200,${c.tint / 300})` : `rgba(40,255,120,${-c.tint / 300})`; sx.fillRect(0, 0, W, H); }
      if (c.vig) { const g = sx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${c.vig})`); sx.fillStyle = g; sx.fillRect(0, 0, W, H); }
      sx.restore(); }
    cx.save(); cx.globalAlpha = o * (c.type === "flash" ? Math.sin(Math.PI * clamp(r / c.dur, 0, 1)) : 1); cx.globalCompositeOperation = c.blend || "source-over"; cx.drawImage(sc, 0, 0); cx.restore();
  });
  $("#time").textContent = fmt(t) + " / " + fmt(duration(P)); $("#ph").style.left = t * zoom + "px"; $("#play").textContent = playing ? "⏸" : "▶";
}
function loop(ts) { if (!playing) return; t += (ts - last) / 1000; last = ts; if (t >= duration(P)) { t = duration(P); if (!exporting) stop(); else return; } draw(); requestAnimationFrame(loop); }
function play() { resumeAudio(); if (t >= duration(P) - .05) t = 0; playing = true; last = performance.now(); requestAnimationFrame(loop); }
function stop() { playing = false; Object.values(els).forEach(e => e.pause && e.pause()); draw(); }
$("#play").onclick = () => playing ? stop() : play();
$("#toStart").onclick = () => { t = 0; draw(); $("#tlscroll").scrollLeft = 0; };
$("#full").onclick = () => $("#stage").requestFullscreen?.();
$("#zoom").oninput = e => { zoom = +e.target.value; renderTimeline(); draw(); };

/* ---------- timeline ---------- */
function renderTimeline() {
  const len = Math.max(duration(P) + 10, 30), w = len * zoom + 200, R = $("#ruler"), T = $("#tracks"); R.style.width = w + "px"; R.innerHTML = "";
  const step = zoom > 120 ? 1 : zoom > 40 ? 5 : 10; for (let s = 0; s < len; s += step) { const d = document.createElement("div"); d.className = "tick"; d.style.left = s * zoom + "px"; d.textContent = fmt(s).slice(0, -3); R.appendChild(d); }
  T.innerHTML = ""; T.style.width = w + "px";
  for (let k = TRACKS - 1; k >= 0; k--) {
    const tr = document.createElement("div"); tr.className = "track"; tr.dataset.n = "Track " + (k + 1); tr.dataset.k = k;
    tr.ondragover = e => e.preventDefault();
    tr.ondrop = e => { const m = P.media.find(x => x.id === e.dataTransfer.getData("m")); if (m) { const r = tr.getBoundingClientRect(); addClip(m, Math.max(0, (e.clientX - r.left) / zoom), k); } };
    P.clips.filter(c => c.track === k).forEach(c => tr.appendChild(clipEl(c))); T.appendChild(tr);
  }
}
function clipEl(c) {
  const d = document.createElement("div"); d.className = `clip ${c.type}` + (c.id === sel ? " sel" : ""); d.style.left = c.start * zoom + "px"; d.style.width = Math.max(8, c.dur * zoom) + "px";
  d.textContent = c.type === "text" ? c.text : c.name; d.innerHTML += '<i class="h l"></i><i class="h r"></i>';
  d.onpointerdown = e => {
    e.stopPropagation(); select(c.id); const mode = e.target.classList.contains("l") ? "l" : e.target.classList.contains("r") ? "r" : "m";
    const x0 = e.clientX, s0 = c.start, d0 = c.dur, i0 = c.in, tr0 = c.track; d.setPointerCapture(e.pointerId);
    d.onpointermove = ev => {
      const dx = (ev.clientX - x0) / zoom; const snap = v => { const pts = [t, 0, ...P.clips.filter(o => o !== c).flatMap(o => [o.start, o.start + o.dur])]; const n = pts.find(p => Math.abs(p - v) * zoom < 7); return n ?? v; };
      if (mode === "m") { c.start = Math.max(0, snap(s0 + dx)); const end = snap(c.start + c.dur); if (Math.abs(end - c.start - c.dur) < 1) c.start = Math.max(0, end - c.dur);
        const el2 = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".track"); if (el2) c.track = +el2.dataset.k; }
      else if (mode === "l") { const ns = clamp(snap(s0 + dx), 0, s0 + d0 - .1); c.dur = d0 - (ns - s0); c.in = i0 + (ns - s0); c.start = ns; }
      else c.dur = Math.max(.1, snap(s0 + d0 + dx) - s0);
      mark(); renderTimeline(); draw();
    };
    d.onpointerup = () => { d.onpointermove = null; renderAll(); };
  };
  return d;
}
function seekFrom(e) { const r = $("#ruler").getBoundingClientRect(); t = Math.max(0, (e.clientX - r.left) / zoom); draw(); }
$("#ruler").onpointerdown = e => { seekFrom(e); $("#ruler").setPointerCapture(e.pointerId); $("#ruler").onpointermove = seekFrom; $("#ruler").onpointerup = () => $("#ruler").onpointermove = null; };
$("#tracks").onpointerdown = e => { if (e.target.classList.contains("track")) { select(null); renderTimeline(); } };

/* ---------- history ---------- */
let hist = [], fut = [], lastSnap = "", htimer = null;
const snapStr = () => JSON.stringify({ clips: P.clips, media: P.media });
function mark() { if (!P) return; if (!htimer) { hist.push(lastSnap); if (hist.length > 80) hist.shift(); } clearTimeout(htimer); htimer = setTimeout(() => { htimer = null; lastSnap = snapStr(); }, 500); fut = []; dirty = true; }
function undo(redo) {
  const from = redo ? fut : hist, to = redo ? hist : fut; if (!from.length) return toast("Nothing to " + (redo ? "redo" : "undo"));
  clearTimeout(htimer); htimer = null; to.push(snapStr()); const s = JSON.parse(from.pop()); P.clips = s.clips; P.media = s.media; lastSnap = snapStr(); if (!cl(sel)) sel = null; dirty = true; renderAll();
}
function dup() { const c = cl(sel); if (!c) return; const n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.start = c.start + c.dur; n.track = P.clips.some(o => o.track === c.track && o.start < n.start + n.dur && o.start + o.dur > n.start) ? firstFree(n.start, n.dur) : c.track; P.clips.push(n); select(n.id); mark(); renderAll(); }
$("#undo").onclick = () => undo(false); $("#redo").onclick = () => undo(true); $("#dup").onclick = dup;
addEventListener("keydown", e => {
  if (!$("#editor").classList.contains("active") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase(); if (k === "z") { e.preventDefault(); undo(e.shiftKey); } else if (k === "y") { e.preventDefault(); undo(true); } else if (k === "d") { e.preventDefault(); dup(); }
});

/* ---------- inspector ---------- */
function select(id) { sel = id; renderInsp(); }
const hex = v => /^#[0-9a-f]{6}/i.test(v) ? v.slice(0, 7) : "#000000", NUM = new Set(["mute"]);
function renderInsp() {
  const c = cl(sel), I = $("#insp"); if (!c) { I.innerHTML = '<div class="empty">Select a clip to edit it.</div>'; renderTimeline(); return; }
  const sl = (k, lab, mn, mx, st) => `<label>${lab}<input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st}" value="${c[k]}"><output>${(+c[k]).toFixed(2)}</output></label>`;
  const co = (k, lab) => `<label class="two">${lab}<input type="color" data-k="${k}" value="${hex(c[k])}"></label>`;
  const se = (k, lab, opts) => `<label class="two">${lab}<select data-k="${k}">${opts.map(o => { const [v, n] = Array.isArray(o) ? o : [o, o]; return `<option value="${v}" ${c[k] == v ? "selected" : ""}>${n}</option>`; }).join("")}</select></label>`;
  const vis = c.type !== "audio" && c.type !== "flash", med = c.type === "video" || c.type === "audio", pic = c.type === "video" || c.type === "image";
  let h = `<b>${c.type === "text" ? (c.kind || "Text") : c.name}</b>`;
  if (c.type === "text") {
    h += `<h4>Text</h4>` + (c.kind === "countdown" || c.kind === "countup" ? sl("from", "Start value", 0, 600, 1) : `<textarea id="itext" rows="3">${c.text}</textarea>`) + sl("size", "Size", 16, 500, 1) + co("color", "Fill") + `<label class="two">Gradient end<input type="color" data-k="fill2" value="${hex(c.fill2 || "#ff4d6d")}"><span class="btn xs" id="gclr">off</span></label>`
      + `<h4>Outline &amp; shadow</h4>` + sl("sw", "Outline", 0, 40, 1) + co("strokeC", "Outline color") + sl("shB", "Shadow blur", 0, 60, 1) + sl("shD", "Shadow dist.", 0, 40, 1) + co("shC", "Shadow color")
      + `<h4>Bubble &amp; line</h4>` + se("bub", "Bubble", ["none", "pill", "box"]) + co("bubC", "Bubble color") + se("line", "Line", ["none", "under", "over", "strike"]);
  }
  if (c.type === "shape") h += `<h4>Shape</h4>` + se("shape", "Shape", SHAPE_NAMES) + co("color", "Fill") + `<label class="two">Fill 2<input type="color" data-k="color2" value="${hex(c.color2 || "#8a7dff")}"><span class="btn xs" id="g2clr">off</span></label>` + sl("w", "Width", .02, 1.5, .005) + sl("h", "Height", .02, 1.5, .005) + sl("sw", "Outline", 0, 40, 1) + co("strokeC", "Outline color");
  if (c.type === "flash") h += `<h4>Flash</h4>` + co("color", "Color");
  if (vis) h += `<h4>Transform</h4>` + sl("x", "Position X", -1, 1, .005) + sl("y", "Position Y", -1, 1, .005) + sl("s", "Scale", .05, 5, .01) + sl("rot", "Rotation", -180, 180, 1) + sl("o", "Opacity", 0, 1, .01) + se("flip", "Flip", [["none", "None"], ["h", "Horizontal"], ["v", "Vertical"], ["hv", "Both"]]) + se("blend", "Blend", BLENDS) + (pic ? se("fit", "Crop", [["fit", "Fit to frame"], ["fill", "Crop to fill"]]) : "");
  if (vis) h += `<h4>Color grade</h4>` + se("fx", "Look", Object.keys(FX)) + sl("br", "Exposure", 0, 2.5, .01) + sl("ct", "Contrast", 0, 2.5, .01) + sl("sat", "Saturation", 0, 3, .01) + sl("hue", "Hue", -180, 180, 1) + sl("temp", "Temperature", -100, 100, 1) + sl("tint", "Tint", -100, 100, 1) + sl("vig", "Vignette", 0, 1, .01) + sl("blur", "Blur", 0, 30, .1) + sl("sep", "Sepia", 0, 1, .01) + sl("gry", "Black &amp; white", 0, 1, .01) + sl("inv", "Invert", 0, 1, .01) + `<div class="kfrow"><span class="btn xs" id="gres">Reset color</span></div>`;
  if (vis) h += `<h4>Animation</h4>` + se("aIn", "Enter", ANIMS) + se("aOut", "Exit", ANIMS) + se("aLoop", "Loop", LOOPS) + sl("aDur", "Anim. time", .1, 3, .05);
  if (c.type !== "flash") h += `<h4>Fades (sec)</h4>` + sl("fadeIn", "Fade in", 0, 5, .1) + sl("fadeOut", "Fade out", 0, 5, .1);
  if (med) h += `<h4>Sound</h4>` + sl("vol", "Volume", 0, 1, .01) + se("mute", "Mute", [[0, "Off"], [1, "On"]]) + sl("boost", "Boost ×", 1, 3, .05) + sl("pan", "Pan L↔R", -1, 1, .05) + sl("bass", "Bass dB", -15, 15, .5) + sl("treble", "Treble dB", -15, 15, .5) + sl("speed", "Speed ×", .25, 4, .05);
  if (vis) h += `<h4>Keyframes (${c.kf.length})</h4><div class="kfrow"><span class="btn" id="kfAdd">◆ Add at playhead</span><span class="btn" id="kfClr">Clear</span></div><small style="color:var(--mt)">Move the playhead, adjust transform, add another — the clip animates between keyframes.</small>`;
  I.innerHTML = h;
  I.querySelectorAll("[data-k]").forEach(i => i.oninput = () => { const k = i.dataset.k; if (k === "fx") { setFx(c, i.value); mark(); renderInsp(); draw(); return; }
    c[k] = i.type === "range" || NUM.has(k) ? +i.value : i.value; if (i.type === "range" && i.nextElementSibling) i.nextElementSibling.textContent = (+i.value).toFixed(2); mark(); draw(); if (k === "shape") renderTimeline(); });
  const tx = I.querySelector("#itext"); if (tx) tx.oninput = () => { c.text = tx.value; mark(); draw(); renderTimeline(); };
  const gc = I.querySelector("#gclr"); if (gc) gc.onclick = () => { c.fill2 = ""; mark(); renderInsp(); draw(); }; const g2 = I.querySelector("#g2clr"); if (g2) g2.onclick = () => { c.color2 = ""; mark(); renderInsp(); draw(); };
  const gr = I.querySelector("#gres"); if (gr) gr.onclick = () => { setFx(c, "none"); mark(); renderInsp(); draw(); };
  const ka = I.querySelector("#kfAdd"); if (ka) { ka.onclick = () => { const r = clamp(t - c.start, 0, c.dur); c.kf = c.kf.filter(k => Math.abs(k.t - r) > .02); c.kf.push({ t: r, x: c.x, y: c.y, s: c.s, o: c.o, rot: c.rot }); mark(); renderInsp(); toast("Keyframe at " + r.toFixed(2) + "s"); }; I.querySelector("#kfClr").onclick = () => { c.kf = []; mark(); renderInsp(); draw(); }; }
  renderTimeline();
}

$("#split").onclick = () => { const c = cl(sel); if (!c || t <= c.start + .05 || t >= c.start + c.dur - .05) return toast("Place playhead inside the selected clip"); const n = JSON.parse(JSON.stringify(c)); n.id = uid(); n.start = t; n.dur = c.start + c.dur - t; n.in = c.in + (t - c.start); n.kf = []; c.dur = t - c.start; P.clips.push(n); mark(); renderAll(); };
$("#del").onclick = () => { if (sel) { P.clips = P.clips.filter(c => c.id !== sel); sel = null; mark(); renderAll(); } };
addEventListener("keydown", e => {
  if (!$("#editor").classList.contains("active") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); $("#play").click(); } else if (e.key === "s" || e.key === "S") { if (e.ctrlKey || e.metaKey) { e.preventDefault(); save(); } else $("#split").click(); }
  else if (e.key === "Delete" || e.key === "Backspace") $("#del").click(); else if (e.key === "ArrowLeft") { t = Math.max(0, t - 1 / 30); draw(); } else if (e.key === "ArrowRight") { t += 1 / 30; draw(); }
});
// drag media on canvas
let drag = null;
cv.onpointerdown = e => { const c = cl(sel); if (!c || c.type === "audio" || c.type === "flash") return; const r = cv.getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, w: r.width, h: r.height, c }; cv.setPointerCapture(e.pointerId); };
cv.onpointermove = e => { if (!drag) return; drag.c.x = drag.cx + (e.clientX - drag.x) / drag.w; drag.c.y = drag.cy + (e.clientY - drag.y) / drag.h; drag.c.kf = drag.c.kf; mark(); draw(); };
cv.onpointerup = () => { if (drag) { drag = null; renderInsp(); } };

/* ---------- save ---------- */
async function save() {
  if (!user) return; $("#saveState").textContent = "Saving…";
  try { P.updated = Date.now(); await setDoc(doc(db, "projects", P.id), { ...JSON.parse(JSON.stringify(P)), uid: user.uid }); dirty = false; $("#saveState").textContent = "Saved ✓"; toast("Project saved"); }
  catch (x) { $("#saveState").textContent = "Save failed"; toast("Save failed: " + x.code); }
}
$("#mSave").onclick = $("#mSave2").onclick = save;
addEventListener("beforeunload", e => { if (dirty) e.preventDefault(); });

/* ---------- export ---------- */
let exporting = false;
async function exportVideo(hq) {
  if (exporting) return; stop(); const dur = duration(P); if (!P.clips.length) return toast("Nothing to export");
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) return toast("Recording not supported in this browser");
  const bits = hq ? 25e6 : Math.max(2e5, Math.floor((9.3e6 * 8) / dur - 64e3)), actx = getCtx(), dest = actx.createMediaStreamDestination();
  Object.values(els).forEach(e => { if (e.tagName !== "IMG") { try { graph(e, dest); } catch (x) {} } });
  const stream = cv.captureStream(30); dest.stream.getAudioTracks().forEach(a => stream.addTrack(a));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bits, audioBitsPerSecond: 64e3 }), chunks = []; rec.ondataavailable = e => chunks.push(e.data);
  rec.onstop = () => { exporting = false; stop(); const b = new Blob(chunks, { type: mime }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${P.title}${hq ? "" : "_compressed"}.${mime.includes("mp4") ? "mp4" : "webm"}`; a.click(); toast(`Exported ${(b.size / 1e6).toFixed(1)} MB`); };
  exporting = true; t = 0; actx.resume(); rec.start(); toast("Exporting in real time — keep this tab open"); play();
  const chk = setInterval(() => { if (t >= dur - .02) { clearInterval(chk); setTimeout(() => rec.stop(), 300); } }, 200);
}
$("#mExpHQ").onclick = () => exportVideo(true); $("#mExpSm").onclick = () => exportVideo(false);

function renderAll() { renderBank(); renderFonts(); renderTimeline(); renderInsp(); draw(); }

/* ---------- logo (uses jewelfish_logo.png when present) ---------- */
let logoOK = false; const logoTag = () => logoOK ? '<img src="jewelfish_logo.png" alt="">' : '<svg><use href="#logo"/></svg>';
{ const li = new Image(); li.onload = () => { logoOK = true; $$("svg.smlogo,svg.biglogo").forEach(v => { const m = document.createElement("img"); m.src = "jewelfish_logo.png"; m.className = v.getAttribute("class"); v.replaceWith(m); }); }; li.src = "jewelfish_logo.png"; }

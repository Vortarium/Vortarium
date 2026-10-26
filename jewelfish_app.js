// ==========================================================
//  JEWELFISH — an Infinite Craft-style doodle game
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, increment,
  arrayUnion, collection, query, orderBy, limit, getDocs, where,
  getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------- config ----------
// ---------- AI access ----------
// Keys are tried in order. If one is slow (over 3 seconds) or fails, the next one is used and the
// game remembers the one that worked. After the last key it loops back to the first. Only a full
// rotation back to the key it started on counts as failure.
// They are stored scrambled (reversed, split, shuffled and XORed) and rebuilt only when the game runs.
const _G = [
  [151, [[7,"U7aF5vg="],[2,"wN+NlJI="],[10,"bnIA+6ut"],[0,"8Nfcww=="],[1,"3vn9taA="],[9,"cUEv"],[11,"RVVx8w=="],[5,"Mk2v"],[8,"M5b2"],[4,"1uzHEQ=="],[3,"kPL1"],[12,"JWvTkeo="],[6,"Ny3+"]]],
  [89, [[3,"5IuH"],[0,"CFg3DxQ="],[7,"A3524JXJ"],[11,"/Gs8dA=="],[2,"BpPF"],[4,"vZ2t3c6k"],[10,"vw5x"],[1,"OzYg+g=="],[8,"dXtpkoY="],[9,"7a0zbQ=="],[5,"T1IxEiT7"],[6,"TRMpBQ=="]]],
  [87, [[3,"YuQ="],[5,"b34PJC3Ht+SH"],[6,"ezIncg=="],[8,"PQ=="],[11,"w207PuHPyp09SRup0pUSKg=="],[2,"IAc="],[1,"SBRXq8M="],[9,"lQ=="],[10,"sKRwEg=="],[7,"CXty"],[4,"nYM="],[0,"FhRSWA=="]]],
  [117, [[9,"sw=="],[10,"kw=="],[6,"NxIp"],[7,"VkW6pa4="],[5,"WHocWtHUwp3QoQ=="],[1,"/uo="],[8,"dEKiiZc="],[0,"AgbE3g=="],[12,"SxlS"],[2,"4vo="],[4,"n6XQ6eYxEyA="],[3,"prTR2NTb"],[11,"aRtA"]]],
  [73, [[12,"w1wtU8uZ0g=="],[9,"270="],[6,"ZA=="],[0,"CB0bHSE0Sio="],[7,"SFx3Tw=="],[3,"SZ6Cpw=="],[10,"yw=="],[4,"Y7uNvQ=="],[2,"OSly/4TRt9eXjg=="],[5,"IUIAOQ=="],[8,"BWV+pLc="],[1,"cUk="],[11,"ww=="]]],
]; 
function _dk([seed, parts]) {
  return parts.slice().sort((x, y) => x[0] - y[0]).map(([i, t]) =>
    [...atob(t)].map((c, j) => String.fromCharCode(c.charCodeAt(0) ^ ((seed + i * 13 + j * 7 + i * j * 3) ^ (i * 31)) & 255)).join("")
  ).join("").split("").reverse().join("");
}
const API_KEYS = _G.map(_dk);
const KEY_TIMEOUT_MS = 3000;
let keyIdx = 0; // stays on the last working key between mixes
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const firebaseConfig = {
  apiKey: "AIzaSyB3Qaz6ybfPKqhHjLQxrfjEpLDnY94oZ_w",
  authDomain: "jewelfish-6972c.firebaseapp.com",
  projectId: "jewelfish-6972c",
  storageBucket: "jewelfish-6972c.firebasestorage.app",
  messagingSenderId: "883520734279",
  appId: "1:883520734279:web:a5ead565bb996ace4f9d62",
  measurementId: "G-5NPCNB4SE7"
};


// ---------- sounds ----------
const sfxHover = new Audio("jewelfish_hover.mp3");
sfxHover.volume = 0.5;
const sfxDiscovery = new Audio("jewelfish_discovery.mp3");
sfxDiscovery.volume = 0.8;
const music = new Audio("jewelfish_music.mp3");
music.loop = true;
music.volume = 0.35;
music.preload = "auto";

// Each play uses a fresh copy of the sound, so plays overlap instead of restarting.
function playSfx(a) {
  try {
    const c = a.cloneNode();
    c.volume = a.volume;
    c.addEventListener("ended", () => c.remove());
    c.play().catch(() => {});
  } catch (e) { /* ignore */ }
}
// Start music as soon as the file loads. Browsers may block autoplay until the
// person interacts with the page, so retry on the first click/key/touch.
function startMusic() {
  music.play().then(removeMusicRetry).catch(() => {});
}
function removeMusicRetry() {
  ["pointerdown", "keydown", "touchstart"].forEach((t) => window.removeEventListener(t, startMusic));
}
startMusic();
["pointerdown", "keydown", "touchstart"].forEach((t) => window.addEventListener(t, startMusic));

// hover sound on any button
document.addEventListener("mouseover", (ev) => {
  const btn = ev.target.closest && ev.target.closest("button");
  if (!btn || btn.disabled) return;
  if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
  playSfx(sfxHover);
});

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e) { /* analytics is optional */ }
const auth = getAuth(app);
const db = getFirestore(app);

const START = [
  { n: "Earth", e: "🪨" },
  { n: "Air",   e: "💨" },
  { n: "Water", e: "💧" },
  { n: "Fire",  e: "🔥" }
];

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const authScreen = $("auth"), gameScreen = $("game");
const board = $("board"), elementList = $("elementList");

// ---------- state ----------
let mode = "login";
let me = null;                     // { uid, username, discoveries }
const inventory = new Map();       // key -> {n, e}
const recipeCache = new Map();     // recipeKey -> {n, e}
let zTop = 10;

const keyOf = (n) => n.trim().toLowerCase();
const recipeKey = (a, b) =>
  [keyOf(a), keyOf(b)].sort().join("+").replace(/\//g, "∕").slice(0, 400);

// ==========================================================
//  Live total counter (works on the login page too)
// ==========================================================
onSnapshot(doc(db, "meta", "stats"), (snap) => {
  $("totalCount").textContent = (snap.exists() ? snap.data().total || 0 : 0).toLocaleString();
}, () => { /* ignore */ });

// ==========================================================
//  Auth
// ==========================================================
const setMode = (m) => {
  mode = m;
  $("tabLogin").classList.toggle("active", m === "login");
  $("tabSignup").classList.toggle("active", m === "signup");
  $("authSubmit").textContent = m === "login" ? "Log in" : "Create account";
  $("password").autocomplete = m === "login" ? "current-password" : "new-password";
  $("authError").textContent = "";
};
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

const emailFor = (u) => `${u.toLowerCase()}@jewelfish.app`;

$("authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const err = $("authError"); err.textContent = "";
  const username = $("username").value.trim();
  const password = $("password").value;

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    err.textContent = "Username: 3–16 letters, numbers or _";
    return;
  }
  $("authSubmit").disabled = true;
  try {
    if (mode === "signup") {
      const cred = await createUserWithEmailAndPassword(auth, emailFor(username), password);
      await setDoc(doc(db, "users", cred.user.uid), {
        username, discoveries: 0, elements: [], created: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, emailFor(username), password);
    }
  } catch (e) {
    const map = {
      "auth/email-already-in-use": "That username is taken.",
      "auth/invalid-credential": "Wrong username or password.",
      "auth/user-not-found": "Wrong username or password.",
      "auth/wrong-password": "Wrong username or password.",
      "auth/weak-password": "Password needs at least 6 characters.",
      "auth/too-many-requests": "Too many tries. Wait a bit!"
    };
    err.textContent = map[e.code] || (e.code === "auth/network-request-failed"
      ? "Can't connect right now. Check your internet and try again."
      : "Something went wrong. Please wait a bit and try again.");
  }
  $("authSubmit").disabled = false;
});

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    me = null;
    teardownDaily();
    gameScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    return;
  }
  // load profile (retry briefly: on signup the doc is written right after account creation)
  let snap = await getDoc(doc(db, "users", user.uid));
  for (let i = 0; i < 5 && !snap.exists(); i++) {
    await new Promise((r) => setTimeout(r, 400));
    snap = await getDoc(doc(db, "users", user.uid));
  }
  const data = snap.exists() ? snap.data() : {
    username: (user.email || "player").split("@")[0], discoveries: 0, elements: []
  };
  if (!snap.exists()) await setDoc(doc(db, "users", user.uid), { ...data, created: serverTimestamp() });

  me = {
    uid: user.uid, username: data.username, discoveries: data.discoveries || 0,
    dailyScore: data.dailyScore || 0, streak: data.streak || 0,
    lastDailyDate: data.lastDailyDate || "", lastDailyScore: data.lastDailyScore || 0
  };
  inventory.clear();
  START.forEach((s) => inventory.set(keyOf(s.n), s));
  (data.elements || []).forEach((s) => inventory.set(keyOf(s.n), s));

  $("whoami").textContent = me.username;
  authScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  clearBoard();
  renderSidebar();
  refreshDailyUI();
  await resumeDaily();
});

// ==========================================================
//  Sidebar
// ==========================================================
function renderSidebar() {
  $("searchBox").value = "";
  elementList.innerHTML = "";
  inventory.forEach((el) => elementList.appendChild(makeSidebarBtn(el)));
}
// Search: hide sidebar buttons that don't match what's typed
function applyFilter() {
  const q = $("searchBox").value.trim().toLowerCase();
  elementList.querySelectorAll(".el").forEach((b) => {
    b.classList.toggle("hidden", q !== "" && !b.dataset.k.includes(q));
  });
}
$("searchBox").addEventListener("input", applyFilter);
function makeSidebarBtn(el) {
  const b = document.createElement("button");
  b.className = "el"; b.type = "button";
  b.dataset.k = keyOf(el.n);
  b.textContent = `${el.e} ${el.n}`;
  // plain click = drop a copy on the board; press and drag = pull a copy off the list
  let sx = 0, sy = 0, down = false, dragged = false;
  b.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    down = true; dragged = false; sx = ev.clientX; sy = ev.clientY;
  });
  b.addEventListener("pointermove", (ev) => {
    if (!down || dragged) return;
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    dragged = true;
    const br = board.getBoundingClientRect();
    const node = spawn(el, ev.clientX - br.left - 40, ev.clientY - br.top - 16);
    node._begin(ev);
  });
  const up = () => { down = false; };
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.onclick = () => { if (dragged) { dragged = false; return; } spawn(el); };
  return b;
}
function addToInventory(el, persist = true) {
  const k = keyOf(el.n);
  if (inventory.has(k)) return;
  inventory.set(k, el);
  elementList.appendChild(makeSidebarBtn(el));
  applyFilter();
  if (!persist) return; // daily mode: temporary elements are not saved to the account
  if (daily.active && savedInventory) savedInventory.set(k, el);
  setDoc(doc(db, "users", me.uid), { elements: arrayUnion({ n: el.n, e: el.e }) }, { merge: true })
    .catch(() => {});
}

// ==========================================================
//  Board / dragging
// ==========================================================
function spawn(el, x, y, first = false) {
  $("boardHint").classList.add("hidden");
  const node = document.createElement("div");
  node.className = "item";
  node.dataset.n = el.n; node.dataset.e = el.e;
  node.innerHTML = `<span>${esc(el.e)} ${esc(el.n)}</span>${first ? "<small>first discovery</small>" : ""}`;
  node.style.zIndex = ++zTop;
  board.appendChild(node);

  const w = node.offsetWidth, h = node.offsetHeight;
  const bw = board.clientWidth, bh = board.clientHeight;
  if (x == null) {
    x = 60 + Math.random() * Math.max(10, bw - w - 140);
    y = 70 + Math.random() * Math.max(10, bh - h - 160);
  }
  node.style.left = clamp(x, 0, bw - w) + "px";
  node.style.top = clamp(y, 0, bh - h) + "px";
  makeDraggable(node);
  return node;
}

function makeDraggable(node) {
  let offX = 0, offY = 0, target = null;

  const begin = (ev) => {
    if (node.classList.contains("busy")) return;
    node.setPointerCapture(ev.pointerId);
    const r = node.getBoundingClientRect();
    offX = ev.clientX - r.left; offY = ev.clientY - r.top;
    node.classList.add("dragging");
    node.style.zIndex = ++zTop;
  };
  node._begin = begin;   // lets the sidebar hand a fresh copy over to be dragged
  node.addEventListener("pointerdown", (ev) => { if (ev.button === 0) begin(ev); });

  // right-click = duplicate
  node.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    if (node.classList.contains("busy")) return;
    const x = parseFloat(node.style.left) + 24, y = parseFloat(node.style.top) + 24;
    spawn({ n: node.dataset.n, e: node.dataset.e }, x, y);
  });

  node.addEventListener("pointermove", (ev) => {
    if (!node.classList.contains("dragging")) return;
    const br = board.getBoundingClientRect();
    node.style.left = ev.clientX - br.left - offX + "px";
    node.style.top = ev.clientY - br.top - offY + "px";
    const t = itemUnder(ev.clientX, ev.clientY, node);
    if (t !== target) { target?.classList.remove("target"); target = t; target?.classList.add("target"); }
  });

  const end = async (ev) => {
    if (!node.classList.contains("dragging")) return;
    node.classList.remove("dragging");
    target?.classList.remove("target");
    const t = target; target = null;

    const sb = $("sidebar").getBoundingClientRect();
    if (ev.clientX > sb.left) { node.remove(); return; }   // dropped on sidebar = delete
    if (t) await combine(node, t);
  };
  node.addEventListener("pointerup", end);
  node.addEventListener("pointercancel", end);
}

function itemUnder(cx, cy, self) {
  const items = [...board.querySelectorAll(".item")].reverse();
  for (const it of items) {
    if (it === self || it.classList.contains("busy")) continue;
    const r = it.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return it;
  }
  return null;
}

async function combine(dragged, target) {
  const a = { n: dragged.dataset.n, e: dragged.dataset.e };
  const b = { n: target.dataset.n, e: target.dataset.e };
  const x = parseFloat(target.style.left), y = parseFloat(target.style.top);

  dragged.classList.add("busy"); target.classList.add("busy");
  const think = document.createElement("small");
  think.className = "thinking";
  think.textContent = "thinking";
  target.appendChild(think);
  try {
    const { result, first } = await getResult(a, b);
    dragged.remove(); target.remove();
    spawn(result, x, y, first);
    const isNewToMe = !inventory.has(keyOf(result.n));
    // in daily mode new elements are temporary, except real first discoveries (those are credited to you for good)
    if (isNewToMe) addToInventory(result, !daily.active || first);
    if (first || isNewToMe) playSfx(sfxDiscovery);
    if (first) toast("✨ First discovery!");
    if (daily.active) dailyOnResult(result, first);
  } catch (e) {
    console.error(e);
    think.remove();
    dragged.classList.remove("busy"); target.classList.remove("busy");
    dragged.classList.add("shake");
    setTimeout(() => dragged.classList.remove("shake"), 450);
    toast(friendlyError(e), 5000);
  }
}

// ==========================================================
//  Recipes: local cache -> Firestore -> Gemini (only if new)
// ==========================================================
async function getResult(a, b) {
  const key = recipeKey(a.n, b.n);
  if (recipeCache.has(key)) return { result: recipeCache.get(key), first: false };

  const ref = doc(db, "recipes", key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const r = { n: snap.data().n, e: snap.data().e };
    recipeCache.set(key, r);
    return { result: r, first: false };
  }

  const ai = await askGemini(a, b);

  // Save the recipe forever (every route to a result is kept). If someone beat us
  // to this exact recipe, use theirs so everyone matches.
  // A "discovery" only counts when the RESULT itself has never existed before.
  const elRef = doc(db, "elements", keyOf(ai.n).replace(/\//g, "∕").slice(0, 400));
  const out = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return { result: { n: existing.data().n, e: existing.data().e }, first: false };

    const elSnap = await tx.get(elRef);
    const startEl = START.find((s) => keyOf(s.n) === keyOf(ai.n));
    const isNewElement = !elSnap.exists() && !startEl;
    // use the official name/emoji if this result already exists
    const result = elSnap.exists() ? { n: elSnap.data().n, e: elSnap.data().e } : (startEl || ai);

    tx.set(ref, {
      a: a.n, b: b.n, n: result.n, e: result.e,
      by: me.username, uid: me.uid, created: serverTimestamp()
    });
    if (isNewElement) {
      tx.set(elRef, { n: result.n, e: result.e, by: me.username, uid: me.uid, created: serverTimestamp() });
      tx.set(doc(db, "meta", "stats"), { total: increment(1) }, { merge: true });
      tx.update(doc(db, "users", me.uid), { discoveries: increment(1) });
    }
    return { result, first: isNewElement };
  });

  if (out.first) me.discoveries += 1;
  recipeCache.set(key, out.result);
  return out;
}

async function askGemini(a, b) {
  const prompt =
`You are the engine of an Infinite Craft style game. Combine two things and reply with what they make.
Input A: "${a.n}"
Input B: "${b.n}"
Rules:
- Result is a single noun or short name (1-3 words, Title Case), creative but sensible.
- It may be one of the inputs, or something totally new. Be consistent and logical (Water + Fire = Steam).
- Give ONE emoji that best fits the result.
- Never include explanations.
Reply as JSON: {"name": "...", "emoji": "..."}`;

  return geminiJSON(prompt, {}, (parsed) => {
    const n = String(parsed.name || "").replace(/[^\p{L}\p{N}\s'’&.\-]/gu, "").trim().slice(0, 40);
    const e = [...String(parsed.emoji || "")].slice(0, 4).join("").trim() || "✨";
    if (!n) throw new Error("AI gave an empty name");
    return { n, e };
  });
}

// Shared Gemini caller: rotates keys on slow/failed answers. `shape` turns the parsed JSON into the
// value you want (throw inside it to count as a failed attempt and try the next key).
async function geminiJSON(prompt, { temperature = 0.7, maxOutputTokens = 1024 } = {}, shape = (x) => x) {
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" }
  });

  const tryKey = async (rawKey) => {
    const key = encodeURIComponent(rawKey);
    const vertexUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const studioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    // Express-mode keys (start with "AQ") use the Vertex endpoint, AI Studio keys use the other one.
    const urls = rawKey.startsWith("AQ") ? [vertexUrl, studioUrl] : [studioUrl, vertexUrl];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), KEY_TIMEOUT_MS);
    try {
      let res = null;
      for (const url of urls) {
        res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctrl.signal });
        if (res.ok) break;
        if (![400, 401, 403, 404].includes(res.status)) break; // only switch endpoint on key/endpoint errors
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const m = parts.map((p) => p.text || "").join("").match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI gave no answer");
      return shape(JSON.parse(m[0]));
    } finally {
      clearTimeout(timer);
    }
  };

  // Slow (3 s) or failing? Move to the next key, wrapping around. Stop after one full rotation.
  const n = API_KEYS.length, start = keyIdx % n;
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    try {
      const out = await tryKey(API_KEYS[idx]);
      keyIdx = idx; // next mix starts on the key that worked
      return out;
    } catch (err) {
      console.warn(`AI key #${idx + 1}/${n} failed:`, err);
      keyIdx = (idx + 1) % n;
    }
  }
  throw new Error("The mixer is busy right now. Please wait a bit and try again.");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ==========================================================
//  Clear button
// ==========================================================
function clearBoard() {
  board.querySelectorAll(".item").forEach((n) => n.remove());
  $("boardHint").classList.remove("hidden");
}
$("clearBtn").onclick = clearBoard;

// ==========================================================
//  Dictionary: every element anyone has discovered (names only, no recipes)
// ==========================================================
let dictItems = [], dictToken = 0;
function renderDict() {
  const q = $("dictSearch").value.trim().toLowerCase();
  const rows = q ? dictItems.filter((x) => keyOf(x.n).includes(q)) : dictItems;
  $("dictList").innerHTML = rows.length
    ? rows.map((x) => `<li>${esc(x.e)} ${esc(x.n)}</li>`).join("")
    : `<li class="none">This hasn't been discovered yet, maybe you can find it!</li>`;
}
async function openDict() {
  const token = ++dictToken;
  $("dictModal").classList.remove("hidden");
  $("dictSearch").value = "";
  $("dictList").innerHTML = "<li>Loading…</li>";
  $("dictCount").textContent = "";
  try {
    const snap = await getDocs(collection(db, "elements"));
    if (token !== dictToken) return;
    const all = new Map();
    START.forEach((s) => all.set(keyOf(s.n), { n: s.n, e: s.e }));
    snap.docs.forEach((d) => { const v = d.data(); if (v.n) all.set(keyOf(v.n), { n: v.n, e: v.e || "✨" }); });
    dictItems = [...all.values()].sort((a, b) => a.n.localeCompare(b.n));
    $("dictCount").textContent = `${dictItems.length.toLocaleString()} elements discovered by everyone`;
    renderDict();
  } catch (e) {
    console.error(e);
    if (token === dictToken) $("dictList").innerHTML = "<li>Couldn't load the dictionary. Please wait a bit and try again.</li>";
  }
}
$("dictBtn").onclick = openDict;
$("dictSearch").addEventListener("input", renderDict);
$("dictClose").onclick = () => $("dictModal").classList.add("hidden");
$("dictModal").addEventListener("click", (e) => { if (e.target.id === "dictModal") $("dictModal").classList.add("hidden"); });

// ==========================================================
//  Leaderboard
// ==========================================================
const LB = {
  disc:  { field: "discoveries", icon: "💎", title: "🏆 Top Discoverers",   empty: "No discoveries yet. Be the first!",  mine: () => me.discoveries },
  daily: { field: "dailyScore",  icon: "⭐", title: "⭐ Top Daily Players", empty: "No daily scores yet. Be the first!", mine: () => me.dailyScore || 0 }
};
let lbTab = "disc", lbToken = 0;

async function showLeaderboard(tab = lbTab) {
  lbTab = tab;
  const token = ++lbToken, cfg = LB[tab];
  $("lbModal").classList.remove("hidden");
  $("lbTabDisc").classList.toggle("active", tab === "disc");
  $("lbTabDaily").classList.toggle("active", tab === "daily");
  $("lbTitle").textContent = cfg.title;
  const list = $("lbList");
  list.innerHTML = "<li>Loading…</li>";
  $("lbYou").classList.add("hidden");
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy(cfg.field, "desc"), limit(10)));
    if (token !== lbToken) return; // player switched tabs meanwhile
    list.innerHTML = "";
    let inTop = false;
    snap.docs.forEach((d, i) => {
      const u = d.data();
      const isMe = d.id === me.uid;
      if (isMe) inTop = true;
      const li = document.createElement("li");
      li.className = "lb-row" + (isMe ? " me" : i === 0 ? " gold" : "");
      li.innerHTML = `<span class="rank">${["🥇", "🥈", "🥉"][i] || "#" + (i + 1)}</span>
        <span class="name">${esc(u.username)}</span><span class="score">${u[cfg.field] || 0} ${cfg.icon}</span>`;
      list.appendChild(li);
    });
    if (!snap.size) list.innerHTML = `<li>${cfg.empty}</li>`;

    if (!inTop) {
      const mine = cfg.mine();
      const ahead = await getCountFromServer(
        query(collection(db, "users"), where(cfg.field, ">", mine))
      );
      if (token !== lbToken) return;
      const rank = ahead.data().count + 1;
      $("lbYouRow").innerHTML = `<span class="rank">#${rank}</span>
        <span class="name">${esc(me.username)}</span><span class="score">${mine} ${cfg.icon}</span>`;
      $("lbYou").classList.remove("hidden");
    }
  } catch (e) {
    console.error(e);
    if (token === lbToken) list.innerHTML = "<li>Couldn't load the leaderboard. Please wait a bit and try again.</li>";
  }
}
$("trophyBtn").onclick = () => showLeaderboard("disc");
$("lbTabDisc").onclick = () => showLeaderboard("disc");
$("lbTabDaily").onclick = () => showLeaderboard("daily");
$("lbClose").onclick = () => $("lbModal").classList.add("hidden");
$("lbModal").addEventListener("click", (e) => { if (e.target.id === "lbModal") $("lbModal").classList.add("hidden"); });

// ==========================================================
//  Daily challenge
//  - one shared 5x5 bingo board per calendar day (made by Gemini for whoever opens it first)
//  - your elements are swapped for the original 4 until the challenge ends
//  - 20 min clock starts on your first successful mix
//  - 1 pt per item, bingo = 3 pts, each extra bingo = 3+n pts, whole board = +25
// ==========================================================
const DAILY_MS = 20 * 60 * 1000;
const FALLBACK_ITEMS = ["Human","Lightbulb","Germany","Ruby","Dinosaur","Submarine","Pyramid","Violin","Astronaut","Samurai","Piano","Pizza",
  "Vampire","Telescope","Dragon","Compass","Robot","Diamond","Japan","Library","Skeleton","Penguin","Rocket","Castle","Bacteria","Sword","Clock","Egypt","Wizard","Spaceship"];
// Every board gets randomly drawn categories so the 25 things are truly different and niche, never the easy basics.
const BOARD_THEMES = ["a country","a famous city","an animal","a bird","a sea creature","an insect","a gemstone or mineral","a chemical element","a plant or flower","a fruit or vegetable",
  "a dish or food","a drink","a musical instrument","a tool","a machine or invention","a vehicle","a building or landmark","a profession or job","a mythical creature","a fantasy item",
  "a science concept","a planet, star or space object","a sport or game","a piece of clothing","a household object","a weapon","a historical civilization or era","a body part or organ","a language or writing thing","a disease or medicine",
  "a type of weather phenomenon","a famous profession like scientist or explorer","a geographic feature","a technology or gadget","a toy","a religion-neutral myth or legend figure","an art or craft","a currency or money thing","a container","a holiday or festival"];
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return L;
})();

const daily = { active: false, date: null, items: [], found: new Set(), startAt: null, timer: null, finishing: false };
let savedInventory = null;   // the player's real elements while a daily run is going

const pad2 = (n) => String(n).padStart(2, "0");
const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const yesterdayOf = (ds) => { const [y, m, d] = ds.split("-").map(Number); return dateStr(new Date(y, m - 1, d - 1)); };
const lsKey = (date) => `jf_daily_${me.uid}_${date}`;
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- scoring ----------
const completedLines = () => LINES.filter((l) => l.every((i) => daily.found.has(keyOf(daily.items[i]))));
function bingoPoints(b) { let p = 0; for (let k = 1; k <= b; k++) p += k === 1 ? 3 : 3 + (k - 1); return p; }
function dailyBreakdown() {
  const f = daily.found.size, b = completedLines().length;
  const bp = bingoPoints(b), bonus = f === 25 ? 25 : 0;
  return { f, b, bp, bonus, pts: f + bp + bonus };
}

// ---------- top bar (streak + daily score) ----------
function streakNow() {
  if (!me) return 0;
  const t = dateStr();
  return (me.lastDailyDate === t || me.lastDailyDate === yesterdayOf(t)) ? (me.streak || 0) : 0;
}
function refreshDailyUI() {
  if (!me) return;
  $("streakNum").textContent = streakNow();
  $("flame").classList.toggle("lit", me.lastDailyDate === dateStr());
  $("dailyScoreNum").textContent = (me.dailyScore || 0).toLocaleString();
}
setInterval(refreshDailyUI, 30000); // catches the midnight rollover

// ---------- bingo board ----------
function renderDailyBoard(newKey) {
  const inLine = new Set(completedLines().flat());
  $("dpGrid").innerHTML = daily.items.map((n, i) => {
    const k = keyOf(n), f = daily.found.has(k);
    return `<div class="dp-cell${f ? " found" : ""}${inLine.has(i) ? " bingo" : ""}${k === newKey ? " pop" : ""}">${esc(n)}</div>`;
  }).join("");
  const bd = dailyBreakdown();
  $("dpScore").textContent = `${bd.pts} pts`;
  $("dpFoot").textContent = daily.startAt
    ? `${bd.f}/25 found · ${bd.b} bingo${bd.b === 1 ? "" : "s"}`
    : "Mix two things to start the 20:00 clock!";
}
$("dpToggle").onclick = () => {
  const hide = !$("dpGrid").classList.contains("hidden");
  $("dpGrid").classList.toggle("hidden", hide);
  $("dpFoot").classList.toggle("hidden", hide);
  $("dpToggle").textContent = hide ? "+" : "–";
};

function tick() {
  const left = daily.startAt ? Math.max(0, DAILY_MS - (Date.now() - daily.startAt)) : DAILY_MS;
  const s = Math.ceil(left / 1000);
  $("dpTimer").textContent = `⏱ ${Math.floor(s / 60)}:${pad2(s % 60)}`;
  $("dpTimer").classList.toggle("low", !!daily.startAt && s <= 60);
  if (daily.startAt && left <= 0) finishDaily();
}
function startTick() { clearInterval(daily.timer); daily.timer = setInterval(tick, 250); tick(); }

function saveDailyLocal() {
  if (!daily.active || !me) return;
  const inv = [...inventory.values()].filter((el) => !START.some((s) => keyOf(s.n) === keyOf(el.n)));
  lsSet(lsKey(daily.date), { date: daily.date, items: daily.items, found: [...daily.found], startAt: daily.startAt, inv });
}

// ---------- board creation (Gemini once per day, then shared via Firestore) ----------
async function generateBoardItems(date) {
  const themes = shuffle(BOARD_THEMES.slice()).slice(0, 25);
  const prompt =
`Make a bingo board for a crafting game like Infinite Craft. Players start with only Earth, Air, Water and Fire and combine two things at a time to make new things.
Give exactly 25 DIFFERENT, NICHE and specific things. This is a hard challenge board, so they must take many mixes to reach.
- They must NOT be basic or easy things reachable in 1-2 mixes. Avoid generic words like Steam, Mud, Cloud, Lava, Rain, Sand, Glass, Plant, Tree, Ocean, Storm, Rainbow, Smoke, Ash, Ice, Snow, Fog, Wind, Sun, Mountain, Lake, River, Island, Forest, Clay, Brick, Dust, Metal.
- Aim for specific, unique, interesting words like Human, Lightbulb, Germany, Ruby, Violin, Samurai, Submarine, Pyramid, Penguin, Bacteria.
- One entry per line below, each matching its category, picked by you to be surprising and not the most obvious example:
${themes.map((t, i) => `${i + 1}. ${t}`).join("\n")}
- Short names, 1-2 words, Title Case.
- Do NOT include Earth, Air, Water or Fire.
- Variety seed (use it to pick unusual answers): ${date}-${Math.random().toString(36).slice(2, 10)}
Reply as JSON: {"items": ["...", "..."]}`;
  const blocked = new Set(START.map((s) => keyOf(s.n)));
  const clean = (arr) => {
    const seen = new Set(), out = [];
    for (const raw of arr) {
      const n = String(raw || "").replace(/[^\p{L}\p{N}\s'’&.\-]/gu, "").trim().slice(0, 40);
      const k = keyOf(n);
      if (n && !seen.has(k) && !blocked.has(k)) { seen.add(k); out.push(n); }
    }
    return out;
  };
  let items = [];
  try {
    items = await geminiJSON(prompt, { temperature: 1, maxOutputTokens: 2048 }, (p) => {
      const c = clean(Array.isArray(p.items) ? p.items : []);
      if (c.length < 15) throw new Error("AI board too short");
      return c;
    });
  } catch (e) { console.warn("board generation failed", e); throw e; }
  // top up if Gemini gave fewer than 25 unique entries
  if (items.length < 25) items = clean([...items, ...shuffle(FALLBACK_ITEMS.slice())]);
  return shuffle(items.slice(0, 25));
}

async function loadDailyBoard(date) {
  const ref = doc(db, "daily", date);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data().items;
  const items = await generateBoardItems(date);
  // first writer wins so everyone gets the same board
  return runTransaction(db, async (tx) => {
    const ex = await tx.get(ref);
    if (ex.exists()) return ex.data().items;
    tx.set(ref, { date, items, by: me.username, uid: me.uid, created: serverTimestamp() });
    return items;
  });
}

// ---------- run lifecycle ----------
function startDaily(date, items, resume) {
  savedInventory = new Map(inventory);
  Object.assign(daily, { active: true, date, items, finishing: false,
    found: new Set(resume?.found || []), startAt: resume?.startAt || null });
  inventory.clear();
  START.forEach((s) => inventory.set(keyOf(s.n), s));
  (resume?.inv || []).forEach((s) => inventory.set(keyOf(s.n), s));
  renderSidebar();
  clearBoard();
  $("dailyPanel").classList.remove("hidden");
  $("diamondBtn").classList.add("active");
  renderDailyBoard();
  if (daily.startAt) startTick(); else tick();
  saveDailyLocal();
}

function dailyOnResult(result, first) {
  if (!daily.startAt) { daily.startAt = Date.now(); startTick(); }
  const k = keyOf(result.n);
  const isItem = daily.items.some((x) => keyOf(x) === k);
  if (isItem && !daily.found.has(k)) {
    const before = dailyBreakdown();
    daily.found.add(k);
    const after = dailyBreakdown();
    const gained = after.pts - before.pts;
    const gotBingo = after.b > before.b;
    renderDailyBoard(k);
    saveDailyLocal();
    toast(`${gotBingo ? "🎉 BINGO! " : "✅ "}${result.n} +${gained}${after.bonus && !before.bonus ? " (board cleared!)" : ""}${first ? " · ✨ first discovery!" : ""}`, 3000);
    if (daily.found.size === 25) setTimeout(finishDaily, 700);
  } else {
    renderDailyBoard();
    saveDailyLocal();
  }
}

function teardownDaily() {
  clearInterval(daily.timer);
  daily.active = false; savedInventory = null;
  $("dailyPanel").classList.add("hidden");
  $("diamondBtn").classList.remove("active");
  $("dailyModal").classList.add("hidden");
}

async function finishDaily() {
  if (!daily.active || daily.finishing) return;
  daily.finishing = true;
  clearInterval(daily.timer);
  const date = daily.date, bd = dailyBreakdown();
  const res = { ...bd, date, cleared: bd.f === 25, oldBank: me.dailyScore || 0,
    streakBefore: streakNow(), newStreak: me.lastDailyDate === yesterdayOf(date) ? (me.streak || 0) + 1 : 1 };

  // bring the player's real elements back
  inventory.clear();
  savedInventory.forEach((v, k) => inventory.set(k, v));
  teardownDaily();
  clearBoard();
  renderSidebar();

  lsSet(lsKey(date), { date, finished: true, submitted: false, pts: bd.pts });
  playResult(res);
  for (let i = 0; i < 3; i++) {
    try { await submitDaily(date, bd.pts); return; }
    catch (e) { console.warn("daily save failed", e); await sleep(1200); }
  }
  toast("Couldn't save your score yet. It will retry next time you open the game.", 5000);
}

async function submitDaily(date, pts) {
  if (me.lastDailyDate >= date) { lsSet(lsKey(date), { date, finished: true, submitted: true, pts }); return; }
  const streak = me.lastDailyDate === yesterdayOf(date) ? (me.streak || 0) + 1 : 1;
  try {
    await setDoc(doc(db, "users", me.uid),
      { dailyScore: increment(pts), streak, lastDailyDate: date, lastDailyScore: pts }, { merge: true });
  } catch (e) {
    if (e.code !== "permission-denied") throw e;
    // denied means this day was already counted
    const fresh = (await getDoc(doc(db, "users", me.uid))).data() || {};
    me.dailyScore = fresh.dailyScore || 0; me.streak = fresh.streak || 0;
    me.lastDailyDate = fresh.lastDailyDate || ""; me.lastDailyScore = fresh.lastDailyScore || 0;
    lsSet(lsKey(date), { date, finished: true, submitted: true, pts });
    refreshDailyUI();
    return;
  }
  me.dailyScore = (me.dailyScore || 0) + pts;
  me.streak = streak; me.lastDailyDate = date; me.lastDailyScore = pts;
  lsSet(lsKey(date), { date, finished: true, submitted: true, pts });
  refreshDailyUI();
}

// pick up a run (or an unsent score) left over from a refresh / closed tab
async function resumeDaily() {
  const prefix = `jf_daily_${me.uid}_`;
  let keys = [];
  try { keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)); } catch (e) { return; }
  const today = dateStr();
  let resumed = false;
  for (const k of keys) {
    const st = lsGet(k);
    if (!st) { try { localStorage.removeItem(k); } catch (e) {} continue; }
    if (st.finished) {
      if (!st.submitted) { try { await submitDaily(st.date, st.pts); } catch (e) { /* retry next time */ } }
      else if (st.date !== today) { try { localStorage.removeItem(k); } catch (e) {} }
      continue;
    }
    const stale = me.lastDailyDate >= st.date || (st.date !== today && !st.startAt);
    if (stale || resumed || !Array.isArray(st.items) || st.items.length !== 25) { try { localStorage.removeItem(k); } catch (e) {} continue; }
    resumed = true;
    startDaily(st.date, st.items, st);
    toast("Welcome back! Your daily challenge is still going 💎", 3000);
    if (st.startAt && Date.now() - st.startAt >= DAILY_MS) await finishDaily();
  }
  refreshDailyUI();
}

// ---------- daily modal ----------
const showDailyView = (v) => {
  $("dailyIntro").classList.toggle("hidden", v !== "intro");
  $("dailyResult").classList.toggle("hidden", v !== "result");
};
async function openDaily() {
  if (daily.active) { toast("Daily challenge in progress! Fill that bingo board 💎", 3000); return; }
  showDailyView("intro");
  $("dailyModal").classList.remove("hidden");
  const done = me.lastDailyDate === dateStr();
  $("dailyAccept").classList.toggle("hidden", done);
  $("dailyMsg").textContent = done
    ? `Today's challenge is done: you scored ${me.lastDailyScore || 0} pts. A fresh board arrives at midnight! 🌙`
    : "";
}
$("diamondBtn").onclick = openDaily;
$("dailyClose").onclick = () => $("dailyModal").classList.add("hidden");
$("dailyModal").addEventListener("click", (e) => { if (e.target.id === "dailyModal") $("dailyModal").classList.add("hidden"); });
$("drDone").onclick = () => $("dailyModal").classList.add("hidden");

$("dailyAccept").onclick = async () => {
  const btn = $("dailyAccept"), msg = $("dailyMsg");
  btn.disabled = true; msg.textContent = "Getting today's board…";
  try {
    const date = dateStr();
    const fresh = (await getDoc(doc(db, "users", me.uid))).data() || {};
    if (fresh.lastDailyDate === date) {
      me.lastDailyDate = fresh.lastDailyDate; me.lastDailyScore = fresh.lastDailyScore || 0;
      msg.textContent = `You already finished today's challenge (${me.lastDailyScore} pts). See you at midnight! 🌙`;
      btn.classList.add("hidden"); refreshDailyUI(); return;
    }
    if (fresh.dailyStarted === date && !lsGet(lsKey(date))) {
      msg.textContent = "You already started today's challenge, so it can't be restarted. Try again tomorrow!";
      btn.classList.add("hidden"); return;
    }
    const items = await loadDailyBoard(date);
    await setDoc(doc(db, "users", me.uid), { dailyStarted: date }, { merge: true });
    $("dailyModal").classList.add("hidden");
    msg.textContent = "";
    startDaily(date, items);
  } catch (e) {
    console.error(e);
    msg.textContent = friendlyError(e);
  } finally {
    btn.disabled = false;
  }
};

// ---------- result: charge up, bank it, light the flame ----------
const tween = (ms, fn) => new Promise((res) => {
  const t0 = performance.now();
  (function f(t) {
    const p = Math.min(1, (t - t0) / ms);
    fn(1 - Math.pow(1 - p, 3));
    p < 1 ? requestAnimationFrame(f) : res();
  })(t0);
});
async function playResult(r) {
  showDailyView("result");
  $("dailyModal").classList.remove("hidden");
  $("drTitle").textContent = r.cleared ? "🎉 BOARD CLEARED!" : "⏰ Time's up!";
  const rows = [`Items found: ${r.f} × 1 = ${r.f}`, `Bingos: ${r.b} = +${r.bp}`];
  if (r.cleared) rows.push("Full board bonus: +25");
  $("drBreak").innerHTML = rows.map((x) => `<li>${esc(x)}</li>`).join("");
  $("drScore").textContent = "0";
  $("drFill").style.width = "0%";
  $("drBank").textContent = r.oldBank.toLocaleString();
  $("drFlame").classList.remove("lit");
  $("drStreak").textContent = r.streakBefore ? `${r.streakBefore}-day streak` : "No streak yet";
  $("drDone").classList.add("hidden");
  $("drScoreLabel").textContent = "points earned";

  await sleep(500);
  await tween(Math.min(3800, Math.max(900, 700 + r.pts * 45)), (e) => {
    $("drScore").textContent = Math.round(r.pts * e);
    $("drFill").style.width = (e * 100) + "%";
  });
  await sleep(450);
  $("drScoreLabel").textContent = "banking it…";
  await tween(1100, (e) => {
    const moved = Math.round(r.pts * e);
    $("drScore").textContent = r.pts - moved;
    $("drBank").textContent = (r.oldBank + moved).toLocaleString();
    $("drFill").style.width = ((1 - e) * 100) + "%";
  });
  $("drScoreLabel").textContent = "added to your Daily Score";
  await sleep(300);
  $("drFlame").classList.add("lit");
  $("drStreak").textContent = `${r.newStreak}-day streak! 🔥`;
  playSfx(sfxDiscovery);
  $("drDone").classList.remove("hidden");
}

// ---------- helpers ----------
// Turn any technical error into something a player can understand.
function friendlyError(e) {
  const msg = String((e && e.message) || e || "");
  const code = String((e && e.code) || "");
  if (code === "permission-denied" || code.startsWith("auth/"))
    return "You may have been logged out. Try logging in again, then mix again.";
  if (msg.includes("busy right now")) return msg;
  return "That didn't load. Please wait a bit and try again.";
}
function toast(msg, ms = 2200) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), ms);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(v, Math.max(lo, hi))); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

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
// The AI key is stored in scrambled pieces and put back together only when the game runs.
const _p = [
  [2,"8M2xvrA="],
  [5,"ibKOvg=="],
  [4,"iLyLuA=="],
  [7,"soK1qQ=="],
  [10,"iqm6mw=="],
  [6,"4beQpamB"],
  [9,"v6eKspKR"],
  [1,"jOX0iw=="],
  [0,"7OGd99s="],
  [3,"oPOBhqSf"],
  [8,"t96ohsE="]
];
const _s = 173;
function _k() {
  return _p.slice().sort((a, b) => a[0] - b[0]).map(([i, t]) =>
    [...atob(t)].map((c, j) => String.fromCharCode(c.charCodeAt(0) ^ ((_s + i * 7 + j * 3) & 255))).join("")
  ).join("");
}
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
    err.textContent = map[e.code] || "Something went wrong. Try again.";
  }
  $("authSubmit").disabled = false;
});

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    me = null;
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

  me = { uid: user.uid, username: data.username, discoveries: data.discoveries || 0 };
  inventory.clear();
  START.forEach((s) => inventory.set(keyOf(s.n), s));
  (data.elements || []).forEach((s) => inventory.set(keyOf(s.n), s));

  $("whoami").textContent = me.username;
  authScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  clearBoard();
  renderSidebar();
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
  b.onclick = () => spawn(el);
  return b;
}
function addToInventory(el) {
  const k = keyOf(el.n);
  if (inventory.has(k)) return;
  inventory.set(k, el);
  elementList.appendChild(makeSidebarBtn(el));
  applyFilter();
  elementList.scrollTop = elementList.scrollHeight;
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

  node.addEventListener("pointerdown", (ev) => {
    if (node.classList.contains("busy")) return;
    node.setPointerCapture(ev.pointerId);
    const r = node.getBoundingClientRect();
    offX = ev.clientX - r.left; offY = ev.clientY - r.top;
    node.classList.add("dragging");
    node.style.zIndex = ++zTop;
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
    if (isNewToMe) addToInventory(result);
    if (first || isNewToMe) playSfx(sfxDiscovery);
    if (first) toast("✨ First discovery!");
  } catch (e) {
    console.error(e);
    think.remove();
    dragged.classList.remove("busy"); target.classList.remove("busy");
    dragged.classList.add("shake");
    setTimeout(() => dragged.classList.remove("shake"), 450);
    toast("Mixing failed: " + String(e.message || e).slice(0, 120), 5000);
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

  const key = encodeURIComponent(_k());
  const vertexUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const studioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  // Express-mode keys use the Vertex endpoint, AI Studio keys use the other one.
  const isExpress = _k().slice(0, 2) === String.fromCharCode(65, 81);
  const urls = isExpress ? [vertexUrl, studioUrl] : [studioUrl, vertexUrl];
  let urlIdx = 0;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: "application/json" }
  });

  // Keep trying until the AI answers, so the item stays in its "thinking" state.
  let lastErr = new Error("no answer");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(urls[urlIdx], { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) {
        const t = await res.text();
        const err = new Error(`Gemini ${res.status}: ${t.slice(0, 160)}`);
        if ([400, 401, 403, 404].includes(res.status) && urlIdx < urls.length - 1) { urlIdx++; lastErr = err; continue; }
        if ([429, 500, 502, 503, 504].includes(res.status)) { lastErr = err; await sleep(900 * (attempt + 1)); continue; }
        throw err;
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const m = parts.map((p) => p.text || "").join("").match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI gave no answer");
      const parsed = JSON.parse(m[0]);
      const n = String(parsed.name || "").replace(/[^\p{L}\p{N}\s'’&.\-]/gu, "").trim().slice(0, 40);
      const e = [...String(parsed.emoji || "")].slice(0, 4).join("").trim() || "✨";
      if (!n) throw new Error("AI gave an empty name");
      return { n, e };
    } catch (err) {
      if (err.message.startsWith("Gemini 4")) throw err;
      lastErr = err;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastErr;
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
//  Leaderboard
// ==========================================================
$("trophyBtn").onclick = async () => {
  $("lbModal").classList.remove("hidden");
  const list = $("lbList");
  list.innerHTML = "<li>Loading…</li>";
  $("lbYou").classList.add("hidden");
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("discoveries", "desc"), limit(10)));
    list.innerHTML = "";
    let inTop = false;
    snap.docs.forEach((d, i) => {
      const u = d.data();
      const isMe = d.id === me.uid;
      if (isMe) inTop = true;
      const li = document.createElement("li");
      li.className = "lb-row" + (isMe ? " me" : i === 0 ? " gold" : "");
      li.innerHTML = `<span class="rank">${["🥇", "🥈", "🥉"][i] || "#" + (i + 1)}</span>
        <span class="name">${esc(u.username)}</span><span class="score">${u.discoveries || 0} 💎</span>`;
      list.appendChild(li);
    });
    if (!snap.size) list.innerHTML = "<li>No discoveries yet. Be the first!</li>";

    if (!inTop) {
      const mine = me.discoveries;
      const ahead = await getCountFromServer(
        query(collection(db, "users"), where("discoveries", ">", mine))
      );
      const rank = ahead.data().count + 1;
      $("lbYouRow").innerHTML = `<span class="rank">#${rank}</span>
        <span class="name">${esc(me.username)}</span><span class="score">${mine} 💎</span>`;
      $("lbYou").classList.remove("hidden");
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = "<li>Couldn't load the leaderboard.</li>";
  }
};
$("lbClose").onclick = () => $("lbModal").classList.add("hidden");
$("lbModal").addEventListener("click", (e) => { if (e.target.id === "lbModal") $("lbModal").classList.add("hidden"); });

// ---------- helpers ----------
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

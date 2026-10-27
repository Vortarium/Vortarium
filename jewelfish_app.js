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
  arrayUnion, arrayRemove, updateDoc, deleteDoc, documentId, deleteField, collection, query, orderBy, limit, getDocs, where,
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
  [52, [[13,"YMk="],[2,"BQgM"],[4,"WzaA5Ko="],[1,"NiESEQ=="],[10,"0It1"],[8,"IQh3"],[6,"DlA6MzE="],[11,"z8cKWHg="],[9,"ybmU"],[0,"U3Y="],[14,"GQ=="],[3,"cQ9F"],[12,"9rcwZA=="],[7,"ND8zQnM="],[5,"onZtWmc="]]],
  [44, [[12,"9r8/dg=="],[9,"8eA="],[5,"knMwdw=="],[8,"Bx1pTg=="],[2,"KQBo"],[14,"EY+n"],[6,"81BR"],[10,"950="],[0,"fUQ="],[3,"Rm0dhA=="],[11,"3cI6Ajw="],[7,"Dg42O34="],[13,"cN7w9Hw="],[1,"E2U="],[4,"TyKqtg=="],[15,"fw=="]]],
  [113, [[11,"HgtOG7s="],[12,"K3R1u+M="],[9,"kHBE"],[13,"2Jo="],[7,"VAa2k9c="],[5,"fAFyB6k="],[2,"0dA="],[6,"fS0="],[8,"YEe3+A=="],[4,"nfLb"],[0,"ICgozw=="],[1,"VO+5"],[10,"vxldFeE="],[3,"kpSU0eQ="]]],
  [221, [[6,"0siknXBTMlY="],[2,"5F4adydUPxQ="],[4,"CQ0mfQ=="],[3,"PxADDn9sUw=="],[8,"391VC3g="],[1,"w6mDZTRMDVc="],[5,"8sKXooE="],[7,"r9+R"],[0,"jLzThJE="]]],
  [170, [[12,"Y0Q="],[2,"nd65"],[7,"l6yX"],[0,"69jd1bfghw=="],[6,"CP7c"],[11,"DnXy"],[5,"AuDD"],[10,"STUJm7iBBA=="],[4,"y8wI"],[1,"ypOw"],[8,"joeZ1kdjaw=="],[9,"OzdBo+U="],[3,"+Nb8HQ=="]]],
  [151, [[3,"pdz56g=="],[4,"8+3nPQM="],[7,"ZYXL/fo="],[0,"xtyT7+PluPE="],[8,"KbeE"],[2,"wcWTsYv9hkM="],[1,"+fDih+CDmA=="],[6,"ByvVxsU="],[5,"BD3a8OW7rd8="]]],
  [85, [[5,"SwYI"],[4,"k4el/ZHt"],[6,"KF4JFQ=="],[2,"ZSzGzao="],[0,"BG0="],[9,"k6khRQRN"],[3,"W4CMnpPI45w="],[8,"d0ZI1A=="],[1,"BEI2/vbx6oc="],[10,"sIs="],[7,"AnRZhJA="]]],
  [216, [[6,"+rObo2JVUD8="],[1,"kce0eQ=="],[2,"g4c="],[10,"VCvT0Ylk"],[4,"NTAfaA=="],[8,"9JE="],[9,"FCo="],[5,"1d+VrZ9ZMks="],[3,"+xgBOiVz"],[0,"iZOpmQ=="],[7,"meDqa0o3bQ=="]]],
  [59, [[2,"Em0bb9jEyg=="],[1,"Jz0kJhw="],[5,"1DoDaD0F8w=="],[0,"TCcoCRs="],[9,"9oQ="],[6,"QGFAHyY="],[3,"TkXtiLiGwA=="],[7,"eDtd"],[4,"S7etu/Q="],[8,"bXRLwIWHiw=="]]],
  [151, [[5,"Cxk="],[1,"g9fKp4yB"],[2,"4rfD17eDoA=="],[4,"hP33"],[3,"pPjV38c5"],[0,"xvTp5sY="],[7,"eoep6+nCBQ=="],[9,"SQElJK3wjg=="],[8,"fr6Oks0="],[6,"anHL+sU="]]],
  [109, [[5,"VCkSMq0="],[3,"orSqzg=="],[10,"iGM="],[9,"w11jZx/alw=="],[6,"Ugwv"],[8,"aD2J/czD"],[2,"3Jnp"],[4,"5YPq59YYV2I="],[0,"Cjc347vJoe4="],[1,"K6j7"],[7,"a1Sdpg=="]]],
  [193, [[7,"p6275w=="],[5,"9/rA"],[0,"kL6ruI6mpMA="],[6,"hcGIj7g="],[3,"mP0+"],[9,"Qw5D2ug="],[4,"81kDHEdANk4="],[8,"g4g="],[1,"uL6ypaxFUw=="],[2,"1pmBc1BjJkk="]]],
  [114, [[10,"oG4="],[8,"VVI="],[2,"4u3Kzw=="],[1,"CqLryQ=="],[11,"ei1F"],[3,"k7eU7emH"],[7,"YmCQr6A="],[9,"pHZwbDbUnA=="],[0,"FQ64/8ihrA=="],[6,"LAoc4PA="],[4,"iY7Z9Lo="],[5,"bCs0"]]],
  [105, [[7,"Z3U="],[2,"5P/x8f6Zqg=="],[6,"ag5hwPXrwak="],[5,"WHYkHQ=="],[1,"Efv/3/WF1w=="],[3,"paq4r+U="],[4,"rYTb+A=="],[0,"OAYUBMbb/Q=="],[8,"H0al7tfV"],[9,"50Z0"]]],
  [183, [[9,"ZBVR"],[1,"gqS+"],[3,"8efCDHQ="],[10,"QTqN/A=="],[11,"UhWSqg=="],[2,"mNS9iGk="],[6,"h8XphpBcGD4="],[7,"kbb/8g=="],[0,"5uc="],[4,"zcMXHzxaSlg="],[5,"CcH2kg=="],[8,"n6n9"]]],
  [112, [[4,"tJ8="],[1,"KdE="],[6,"Zxsj0e4="],[10,"lWA="],[7,"VEmrldL2nQ=="],[9,"xF5sZBjZiA=="],[5,"Yy8nIw=="],[0,"FyI508nk4Os="],[2,"gez5zOc="],[3,"85at1cY="],[8,"Q0HaqJXC"]]],
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
// "Saver mode" (toggled by the vortarium account, shared by everyone): every key calls this model instead.
const GEMINI_MODEL_SAVER = "gemini-3.1-flash-lite";
let saverMode = false;
const activeModel = () => (saverMode ? GEMINI_MODEL_SAVER : GEMINI_MODEL);

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
const sfxMerge = new Audio("jewelfish_merge.mp3");
sfxMerge.volume = 0.7;
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

$("logoutBtn").onclick = async () => {
  if (queue.active && queue.playing) {
    if (!confirm("Log out mid-match? Leaving counts as a loss and your points from it are thrown away.")) return;
    try { await updateDoc(doc(db, "matches", queue.matchId), { status: "forfeit", loser: me.uid }); } catch (e) { /* ignore */ }
  } else if (queue.active) {
    try { await updateDoc(doc(db, "matches", queue.matchId), { status: "cancelled" }); } catch (e) { /* ignore */ }
  }
  signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    teardownQueue();
    me = null;
    stopSettingsListener();
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
    lastDailyDate: data.lastDailyDate || "", lastDailyScore: data.lastDailyScore || 0,
    queueScore: data.queueScore || 0,
    dailyStatus: data.dailyStatus || "", dailyDate: data.dailyDate || "", dailyRun: data.dailyRun || null,
    dailyStarted: data.dailyStarted || ""
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
  startSettingsListener(); renderQualityBtn();
  repairElementIndex();   // background, once per account: re-register your elements in the dictionary
  await resumeDaily();
  await resumeQueue();
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
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.hypot(dx, dy) < 6) return;
    // mostly-vertical movement is a scroll of the list, not a drag
    if (ev.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) { down = false; return; }
    dragged = true;
    const br = board.getBoundingClientRect();
    const node = spawn(el, ev.clientX - br.left - 40, ev.clientY - br.top - 16);
    node._begin(ev, true);
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
  if (queue.active && savedInventory && !savedInventory.has(k)) queue.learned++;   // counted as something new you learned
  if ((daily.active || queue.active) && savedInventory) savedInventory.set(k, el);
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
  let offX = 0, offY = 0, target = null, pid = null;

  const place = (cx, cy) => {
    const br = board.getBoundingClientRect();
    const w = node.offsetWidth, h = node.offsetHeight;
    // keep the item visible inside the board while dragging (it can still be dropped on the sidebar to delete)
    node.style.left = clamp(cx - br.left - offX, 0, board.clientWidth - w) + "px";
    node.style.top = clamp(cy - br.top - offY, 0, board.clientHeight - h) + "px";
  };

  const move = (ev) => {
    if (ev.pointerId !== pid) return;
    place(ev.clientX, ev.clientY);
    const t = itemUnder(ev.clientX, ev.clientY, node);
    if (t !== target) { target?.classList.remove("target"); target = t; target?.classList.add("target"); }
  };

  const end = async (ev) => {
    if (ev.pointerId !== pid) return;
    pid = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    node.classList.remove("dragging");
    target?.classList.remove("target");
    const t = target; target = null;

    const sb = $("sidebar").getBoundingClientRect();
    if (ev.type === "pointerup" && ev.clientX > sb.left) { node.remove(); return; }   // dropped on sidebar = delete
    if (t && t.isConnected) await combine(node, t);
  };

  const begin = (ev, centered = false) => {
    if (node.classList.contains("busy") || pid !== null) return;
    pid = ev.pointerId;
    try { node.setPointerCapture(pid); } catch (e) { /* window listeners still track it */ }
    const r = node.getBoundingClientRect();
    if (centered) { offX = node.offsetWidth / 2; offY = node.offsetHeight / 2; }
    else { offX = ev.clientX - r.left; offY = ev.clientY - r.top; }
    node.classList.add("dragging");
    node.style.zIndex = ++zTop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    if (centered) place(ev.clientX, ev.clientY);
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

  playSfx(sfxMerge);   // every mix makes the merge sound
  dragged.classList.add("busy"); target.classList.add("busy");
  const think = document.createElement("small");
  think.className = "thinking";
  think.textContent = "thinking";
  target.appendChild(think);
  try {
    const { result, first } = await getResult(a, b);
    dragged.remove(); target.remove();
    spawn(result, x, y, first);
    const rk = keyOf(result.n), realHad = (savedInventory || inventory).has(rk);   // savedInventory = your real elements during a daily/queue
    const isNewToMe = !inventory.has(rk);
    // in daily mode new elements are temporary, except real first discoveries (those are credited to you for good)
    if (isNewToMe) addToInventory(result, !daily.active || first);
    if (!first && !realHad) ensureElementDoc(result);   // make sure the dictionary knows this element
    if (first) playSfx(sfxDiscovery);   // only a real first discovery gets the discovery sound
    if (first) toast("✨ First discovery!");
    if (daily.active) dailyOnResult(result, first);
    if (queue.active) queueOnResult(result);
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
//  Dictionary index repair
//  The dictionary lists the "elements" collection. An element only got a record there when
//  it was FIRST created, so results reached through older recipes could be in your inventory
//  without being in the dictionary. These two helpers register any missing ones (no discovery
//  credit, no counter change).
// ==========================================================
const elDocId = (n) => keyOf(n).replace(/\//g, "∕").slice(0, 400);
const isStartEl = (n) => START.some((s) => keyOf(s.n) === keyOf(n));
async function ensureElementDoc(el) {
  if (!me || isStartEl(el.n)) return;
  try {
    const ref = doc(db, "elements", elDocId(el.n));
    if (!(await getDoc(ref)).exists())
      await setDoc(ref, { n: el.n, e: el.e, by: me.username, uid: me.uid, created: serverTimestamp() });
  } catch (e) { /* someone else created it first, or offline; fine */ }
}
async function repairElementIndex() {
  const flag = `jf_elfix1_${me.uid}`;
  if (lsGet(flag)) return;
  const mine = [...inventory.values()].filter((x) => !isStartEl(x.n));   // read now, before any daily/queue swap
  const uid = me.uid, username = me.username;
  let restored = 0, failed = false;
  for (let i = 0; i < mine.length; i += 30) {
    const chunk = mine.slice(i, i + 30);
    try {
      const snap = await getDocs(query(collection(db, "elements"), where(documentId(), "in", chunk.map((x) => elDocId(x.n)))));
      const have = new Set(snap.docs.map((d) => d.id));
      for (const el of chunk) {
        if (have.has(elDocId(el.n))) continue;
        try {
          await setDoc(doc(db, "elements", elDocId(el.n)), { n: el.n, e: el.e, by: username, uid, created: serverTimestamp() });
          restored++;
        } catch (e) { failed = true; }
      }
    } catch (e) { failed = true; console.warn("element index repair", e); }
  }
  if (!failed) lsSet(flag, 1);
  if (restored) toast(`📖 Restored ${restored} missing elements to the dictionary`, 4500);
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
  const model = activeModel();   // read once so a whole key rotation uses one model
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" }
  });

  const tryKey = async (rawKey) => {
    const key = encodeURIComponent(rawKey);
    const vertexUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${key}`;
    const studioUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
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

// ---------- Saver mode (owner button, global switch stored in meta/settings) ----------
let settingsUnsub = null;
const isOwner = () => !!me && String(me.username).toLowerCase() === "vortarium";
function renderQualityBtn() {
  const b = $("qualityBtn");
  b.classList.toggle("hidden", !isOwner());
  b.classList.toggle("on", saverMode);
  b.textContent = saverMode ? "🔋" : "⚡";
  b.title = saverMode
    ? "Saver mode ON: every key uses Gemini 3.1 Flash-Lite (click to switch back)"
    : "Saver mode off: using Gemini 3.5 Flash-Lite (click to turn Saver mode on)";
}
function startSettingsListener() {
  if (settingsUnsub) return;
  settingsUnsub = onSnapshot(doc(db, "meta", "settings"),
    (s) => { saverMode = !!(s.exists() && s.data().saver); renderQualityBtn(); },
    () => {});
}
function stopSettingsListener() {
  if (settingsUnsub) settingsUnsub();
  settingsUnsub = null; saverMode = false; renderQualityBtn();
}
$("qualityBtn").onclick = async () => {
  if (!isOwner()) return;
  const next = !saverMode;
  try {
    await setDoc(doc(db, "meta", "settings"), { saver: next, by: me.username, updated: serverTimestamp() }, { merge: true });
    toast(next ? "🔋 Saver mode ON: all keys now use Gemini 3.1 Flash-Lite" : "⚡ Saver mode off: back to Gemini 3.5 Flash-Lite", 3500);
  } catch (e) { console.error(e); toast("Couldn't change it. Did you publish the new Firestore rules?", 4000); }
};

// ==========================================================
//  Clear button
// ==========================================================
function clearBoard() {
  board.querySelectorAll(".item").forEach((n) => n.remove());
  $("boardHint").classList.remove("hidden");
}
$("clearBtn").onclick = clearBoard;

// ==========================================================
//  Theme (light/dark) and music mute
// ==========================================================
function applyTheme(dark, fade) {
  if (fade) { document.body.classList.add("themefade"); setTimeout(() => document.body.classList.remove("themefade"), 650); }
  document.body.classList.toggle("dark", dark);
  $("themeBtn").textContent = dark ? "☀️" : "🌙";
  $("themeBtn").title = dark ? "Light mode" : "Dark mode";
  try { localStorage.setItem("jf_dark", dark ? "1" : "0"); } catch (e) { /* ignore */ }
}
$("themeBtn").onclick = () => applyTheme(!document.body.classList.contains("dark"), true);
function applyMute(m) {
  music.muted = m;
  $("muteBtn").textContent = m ? "🔇" : "🔊";
  $("muteBtn").title = m ? "Unmute music" : "Mute music";
  try { localStorage.setItem("jf_mute", m ? "1" : "0"); } catch (e) { /* ignore */ }
}
$("muteBtn").onclick = () => applyMute(!music.muted);
try {
  applyTheme(localStorage.getItem("jf_dark") === "1", false);
  applyMute(localStorage.getItem("jf_mute") === "1");
} catch (e) { applyTheme(false, false); applyMute(false); }

// ==========================================================
//  Recipes: pick one of your elements, see every known way to make it
// ==========================================================
let rcToken = 0;
const emojiOf = (name) => (inventory.get(keyOf(name)) || {}).e || "";
const RESULT_MAX = 10;   // dictionary and recipe book never show more than this at once
function rcShowList() {
  $("rcBack").classList.add("hidden"); $("rcTitle").classList.add("hidden");
  $("rcSearch").classList.remove("hidden");
  const q = $("rcSearch").value.trim().toLowerCase();
  const list = $("rcList"); list.innerHTML = "";
  if (!q) {
    $("rcHint").textContent = "Search one of your elements to see how it is made";
    list.innerHTML = `<li class="none">Type to search (shows up to ${RESULT_MAX} results)</li>`;
    return;
  }
  const all = [...inventory.values()].filter((x) => keyOf(x.n).includes(q))
    .sort((a, b) => (keyOf(b.n).startsWith(q) - keyOf(a.n).startsWith(q)) || a.n.localeCompare(b.n));
  if (!all.length) { $("rcHint").textContent = ""; list.innerHTML = `<li class="none">No elements match.</li>`; return; }
  $("rcHint").textContent = all.length > RESULT_MAX
    ? `Showing ${RESULT_MAX} of ${all.length}. Keep typing to narrow it down`
    : "Click an element to see how it is made";
  all.slice(0, RESULT_MAX).forEach((x) => {
    const li = document.createElement("li");
    li.className = "pick"; li.textContent = `${x.e} ${x.n}`;
    li.onclick = () => rcShowRecipes(x);
    list.appendChild(li);
  });
}
async function rcShowRecipes(el) {
  const token = ++rcToken;
  $("rcBack").classList.remove("hidden"); $("rcSearch").classList.add("hidden");
  $("rcTitle").classList.remove("hidden"); $("rcTitle").textContent = `${el.e} ${el.n}`;
  $("rcHint").textContent = "";
  const list = $("rcList"); list.innerHTML = "<li>Loading…</li>";
  try {
    const snap = await getDocs(query(collection(db, "recipes"), where("n", "==", el.n), limit(60)));
    if (token !== rcToken) return;
    const seen = new Set(), rows = [];
    snap.docs.forEach((d) => {
      const r = d.data(), k = [keyOf(r.a), keyOf(r.b)].sort().join("+");
      if (seen.has(k)) return; seen.add(k);
      rows.push(`<li class="combo">${esc(emojiOf(r.a))} ${esc(r.a)} + ${esc(emojiOf(r.b))} ${esc(r.b)}</li>`);
    });
    const isStart = START.some((s) => keyOf(s.n) === keyOf(el.n));
    if (isStart) rows.unshift(`<li class="none">Starting element, you begin with this one!</li>`);
    const total = rows.length;
    list.innerHTML = total ? rows.slice(0, RESULT_MAX + (isStart ? 1 : 0)).join("") : `<li class="none">No recipe found for this one.</li>`;
    $("rcHint").textContent = total > RESULT_MAX ? `Showing ${RESULT_MAX} of ${total} ways to make it` : (snap.size > 1 ? `${total} ways to make it` : "");
  } catch (e) {
    console.error(e);
    if (token === rcToken) list.innerHTML = "<li>Couldn't load recipes. Please wait a bit and try again.</li>";
  }
}
$("recipeBtn").onclick = () => { rcToken++; $("rcSearch").value = ""; $("recipeModal").classList.remove("hidden"); rcShowList(); };
$("rcBack").onclick = () => { rcToken++; rcShowList(); };
$("rcSearch").addEventListener("input", rcShowList);
$("rcClose").onclick = () => $("recipeModal").classList.add("hidden");
$("recipeModal").addEventListener("click", (e) => { if (e.target.id === "recipeModal") $("recipeModal").classList.add("hidden"); });

// ==========================================================
//  Dictionary: every element anyone has discovered (names only, no recipes)
// ==========================================================
let dictToken = 0, dictTimer = null;
async function renderDict() {
  const q = keyOf($("dictSearch").value);
  const token = ++dictToken;
  clearTimeout(dictTimer);
  const list = $("dictList");
  if (!q) { list.innerHTML = `<li class="none">Type something to search (shows up to ${RESULT_MAX} results)</li>`; return; }
  list.innerHTML = "<li>Searching…</li>";
  dictTimer = setTimeout(async () => {
    try {
      const found = new Map();
      // your own elements (and the 4 starters) match anywhere in the name
      [...START, ...(savedInventory || inventory).values()].forEach((x) => { const k = keyOf(x.n); if (k.includes(q)) found.set(k, { n: x.n, e: x.e || "✨" }); });
      // everyone's elements: only the first few that START with what you typed are fetched
      const lo = q.replace(/\//g, "∕");
      const snap = await getDocs(query(collection(db, "elements"), where(documentId(), ">=", lo), where(documentId(), "<=", lo + "\uf8ff"), limit(RESULT_MAX)));
      if (token !== dictToken) return;
      snap.docs.forEach((d) => { const v = d.data(), k = keyOf(v.n || ""); if (v.n && !found.has(k)) found.set(k, { n: v.n, e: v.e || "✨" }); });
      const rows = [...found.values()]
        .sort((a, b) => (keyOf(b.n).startsWith(q) - keyOf(a.n).startsWith(q)) || a.n.localeCompare(b.n))
        .slice(0, RESULT_MAX);
      list.innerHTML = rows.length
        ? rows.map((x) => `<li>${esc(x.e)} ${esc(x.n)}</li>`).join("")
        : `<li class="none">This hasn't been discovered yet, maybe you can find it!</li>`;
    } catch (e) {
      console.error(e);
      if (token === dictToken) list.innerHTML = "<li>Couldn't search the dictionary. Please wait a bit and try again.</li>";
    }
  }, 250);
}
function openDict() {
  $("dictModal").classList.remove("hidden");
  $("dictSearch").value = "";
  $("dictCount").textContent = "";
  renderDict();
  getCountFromServer(collection(db, "elements"))
    .then((s) => { $("dictCount").textContent = `${s.data().count.toLocaleString()} elements discovered by everyone`; })
    .catch(() => {});
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
  daily: { field: "dailyScore",  icon: "⭐", title: "⭐ Top Daily Players", empty: "No daily scores yet. Be the first!", mine: () => me.dailyScore || 0 },
  queue: { field: "queueScore", icon: "⚔️", title: "⚔️ Top Queue Players", empty: "No queue points yet. Be the first!", mine: () => me.queueScore || 0 }
};
let lbTab = "disc", lbToken = 0;

async function showLeaderboard(tab = lbTab) {
  lbTab = tab;
  const token = ++lbToken, cfg = LB[tab];
  $("lbModal").classList.remove("hidden");
  $("lbTabDisc").classList.toggle("active", tab === "disc");
  $("lbTabDaily").classList.toggle("active", tab === "daily");
  $("lbTabQueue").classList.toggle("active", tab === "queue");
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
$("lbTabQueue").onclick = () => showLeaderboard("queue");
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
const FALLBACK_ITEMS = ["Cow","Sky","Sleep","Juice","Math","Dog","Book","Moon","Bread","Music","Pizza","Egg","Bird","Fish","Milk","Cheese",
  "Doctor","Farm","Robot","Castle","Pirate","Piano","Boat","Beach","Candy","Soap","Computer","Dream","Knife","Garden"];
// Every board gets randomly drawn, everyday categories: things most people know, a middle difficulty (not trivial, not obscure).
const BOARD_THEMES = ["a farm or pet animal","a wild animal","a bird","a sea creature","a fruit or vegetable","a food or dish","a drink","a musical thing","a tool",
  "a household object","a vehicle","a building or place","a job or profession","a famous creature from myths","a school subject or everyday idea (like Math or Sleep)",
  "something in the sky or space","a sport or game","a piece of clothing","a body part","a plant or flower","a toy","a gadget or machine","a country or famous city",
  "something found in a kitchen","something found at the beach","a feeling or state (like Sleep or Love)","a type of weather","a holiday or party thing","a sweet or snack","a story character type (like Pirate or Wizard)"];
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return L;
})();

const daily = { active: false, date: null, items: [], found: new Set(), startAt: null, timer: null, finishing: false,
  started: false, dailyInv: null, dailyBoard: null, realBoard: null };
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
    : "No time limit until midnight 🌙";
}
$("dpToggle").onclick = () => {
  const hide = !$("dpGrid").classList.contains("hidden");
  $("dpGrid").classList.toggle("hidden", hide);
  $("dpFoot").classList.toggle("hidden", hide);
  $("dpToggle").textContent = hide ? "+" : "–";
};

function dailyEndAt() {   // no time limit: the challenge runs until the next midnight
  const [y, m, d] = daily.date.split("-").map(Number);
  return new Date(y, m - 1, d + 1).getTime();
}
function fmtLeft(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}
function tick() {
  const left = Math.max(0, dailyEndAt() - Date.now());
  $("dpTimer").textContent = `🌙 ${fmtLeft(left)}`;
  $("dpTimer").classList.toggle("low", left <= 60000);
  if (left <= 0) finishDaily();
}
function startTick() { clearInterval(daily.timer); daily.timer = setInterval(tick, 250); tick(); }

// The daily is also kept on your account (dailyStatus: not_started / started / finished), so a refresh, a re-login
// or another device all pick up exactly where you were. Started and not started both stay unlocked.
function dailyStatusToday() {
  const t = dateStr();
  if (me.lastDailyDate === t || (me.dailyDate === t && me.dailyStatus === "finished")) return "finished";
  if (daily.started || (me.dailyDate === t && me.dailyStatus === "started") || me.dailyStarted === t) return "started";
  return "not_started";
}
function dailyRunData() {
  const src = daily.active ? inventory : (daily.dailyInv || new Map());
  return {
    found: [...daily.found], startAt: daily.startAt || null, inside: !!daily.active,
    inv: [...src.values()].filter((el) => !START.some((s) => keyOf(s.n) === keyOf(el.n))).map((el) => ({ n: el.n, e: el.e }))
  };
}
let dailySyncT = null;
function syncDailyRemote(now = false) {
  if (!daily.started || !me) return;
  clearTimeout(dailySyncT);
  const go = () => {
    if (!daily.started || !me) return;
    updateDoc(doc(db, "users", me.uid), { dailyStatus: "started", dailyDate: daily.date, dailyRun: dailyRunData() }).catch(() => {});
  };
  if (now) go(); else dailySyncT = setTimeout(go, 1500);
}
window.addEventListener("pagehide", () => syncDailyRemote(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) syncDailyRemote(true); });

function saveDailyLocal() {
  if (!daily.started || !me) return;
  lsSet(lsKey(daily.date), { date: daily.date, items: daily.items, ...dailyRunData() });
  syncDailyRemote();
}

// ---------- board creation (Gemini once per day, then shared via Firestore) ----------
// Daily boards: well-known words, but each takes roughly 6 to 15 mixes (think Stars, Garden, Library, not Cloud or Plant).
const DAILY_THEMES = ["a famous kind of building or landmark","a musical instrument","a type of vehicle","a prepared dish or meal","a sport or game","a profession or job","a mythical or fantasy creature","something in space","a natural landmark or landscape","a place in a town or city","a place in nature","a tool or gadget with a few parts","a piece of furniture","a sight in the sky","a wild animal","a plant-based place or object (like Garden or Orchard)","a school or science object","a type of clothing or accessory","a kind of celebration or event","an everyday machine","something found at a harbor","a weapon or armor from stories","a book, story or art thing","a source of light or fire","a simple everyday idea (like Dream or Home)","a farm place","a kind of road or bridge","a toy or game piece","a measuring device","a sweet treat or baked good"];
const HARD_FALLBACK = ["Stars","Garden","Rainbow","Castle","Bridge","Library","Lighthouse","Bicycle","Telescope","Volcano","Bakery","Compass","Windmill","Greenhouse","Waterfall","Sailboat","Pyramid","Campfire","Museum","Sunset","Meadow","Harbor","Lantern","Orchard","Clock","Canoe","Desert","Forest","Tower","Orchestra"];
const EASY_FALLBACK = ["Steam","Mud","Cloud","Lava","Rain","Sand","Glass","Plant","Ocean","Storm","Smoke","Ash","Ice","Snow","Fog","Wind","Sun","Mountain","Lake","River","Island","Dust","Metal","Tree","Moon","Salt","Brick","Seed","Wave","Cactus"];
async function generateBoardItems(seed, diff = "daily") {
  const themes = shuffle(DAILY_THEMES.slice()).slice(0, 25);
  const catLines = themes.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const head = `Make a bingo board for a crafting game like Infinite Craft. Players start with only Earth, Air, Water and Fire and combine two things at a time to make new things.\n`;
  const tail = `\n- Short names, 1-2 words, Title Case.\n- Do NOT include Earth, Air, Water or Fire.\n- Variety seed (use it so the board differs from other boards): ${seed}-${Math.random().toString(36).slice(2, 10)}\nReply as JSON: {"items": ["...", "..."]}`;
  const bodies = {
    easy:
`Give exactly 25 DIFFERENT, VERY EASY things that anyone knows. This is an EASY board: every item should be reachable in only 1 to 3 mixes from the four starting elements.
- Good examples of the right difficulty: Steam, Mud, Cloud, Lava, Rain, Sand, Glass, Plant, Ocean, Storm, Smoke, Ash, Ice, Snow, Fog, Wind, Sun, Mountain, Lake, River, Island, Dust, Metal, Tree, Seed.
- Use some of those, and also come up with other similarly easy things (nature, weather, materials, very simple everyday things).
- Nothing obscure and nothing that needs a long chain of mixes.`,
    daily:
`Give exactly 25 DIFFERENT things that most people know. This is a MEDIUM-HARD board: each item should take roughly 6 to 15 mixes to reach from the four starting elements. Not instant, a real little puzzle.
- Good examples of the right difficulty: Stars, Garden, Rainbow, Castle, Bridge, Library, Lighthouse, Bicycle, Telescope, Volcano, Bakery, Compass, Windmill, Orchestra.
- Too easy, do NOT use: Steam, Mud, Cloud, Lava, Rain, Sand, Ocean, Storm, Smoke, Ash, Ice, Snow, Fog, Wind, Sun, Moon, Mountain, Lake, River, Island, Dust, Plant, Tree, Seed, Glass, Brick, Bread, Egg, Fish, Cheese, House, Bird, Flower, Salt, Wave.
- Too hard, do NOT use: Computer, Robot, Doctor, Pirate, Dragon, Rocket, chemical elements, gemstones, rare minerals, scientific terms, obscure animals or historical figures.
- One entry per line below, each matching its category, a common well-known example:
${catLines}`
  };
  const prompt = head + (bodies[diff] || bodies.daily) + tail;
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
    items = await geminiJSON(prompt, { temperature: 0.9, maxOutputTokens: 2048 }, (p) => {
      const c = clean(Array.isArray(p.items) ? p.items : []);
      if (c.length < 15) throw new Error("AI board too short");
      return c;
    });
  } catch (e) { console.warn("board generation failed", e); throw e; }
  // top up if Gemini gave fewer than 25 unique entries
  if (items.length < 25) items = clean([...items, ...shuffle((diff === "easy" ? EASY_FALLBACK : HARD_FALLBACK).slice())]);
  return shuffle(items.slice(0, 25));
}

async function loadDailyBoard(date) {
  const ref = doc(db, "daily", date);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data().items;
  const items = await generateBoardItems(date, "daily");
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
  daily.realBoard = snapshotBoard();   // your own board comes back when you switch out or finish
  Object.assign(daily, { active: true, started: true, dailyInv: null, dailyBoard: null, date, items, finishing: false,
    found: new Set(resume?.found || []), startAt: resume?.startAt || null });
  inventory.clear();
  START.forEach((s) => inventory.set(keyOf(s.n), s));
  (resume?.inv || []).forEach((s) => inventory.set(keyOf(s.n), s));
  renderSidebar();
  clearBoard();
  $("dailyPanel").classList.remove("hidden");
  $("diamondBtn").classList.add("active");
  renderDailyBoard();
  startTick();
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
  clearInterval(daily.timer); clearTimeout(dailySyncT);
  daily.active = false; daily.started = false; daily.dailyInv = null; daily.dailyBoard = null; daily.realBoard = null;
  if (!queue.active) savedInventory = null;
  $("dailyPanel").classList.add("hidden");
  $("diamondBtn").classList.remove("active");
  $("dailyModal").classList.add("hidden");
}

async function finishDaily() {
  if (!daily.started || daily.finishing) return;
  daily.finishing = true;
  clearInterval(daily.timer);
  const date = daily.date, bd = dailyBreakdown();
  const res = { ...bd, date, cleared: bd.f === 25, oldBank: me.dailyScore || 0,
    streakBefore: streakNow(), newStreak: me.lastDailyDate === yesterdayOf(date) ? (me.streak || 0) + 1 : 1 };

  // bring the player's real elements and board back (if they were inside the daily at the time)
  const wasIn = daily.active, realBoard = daily.realBoard;
  if (wasIn) { inventory.clear(); savedInventory.forEach((v, k) => inventory.set(k, v)); }
  teardownDaily();
  if (wasIn) { clearBoard(); restoreBoard(realBoard); renderSidebar(); }

  lsSet(lsKey(date), { date, finished: true, submitted: false, pts: bd.pts });
  playResult(res);
  for (let i = 0; i < 3; i++) {
    try { await submitDaily(date, bd.pts); return; }
    catch (e) { console.warn("daily save failed", e); await sleep(1200); }
  }
  toast("Couldn't save your score yet. It will retry next time you open the game.", 5000);
}

async function submitDaily(date, pts) {
  const finishedFields = { dailyStatus: "finished", dailyDate: date, dailyRun: deleteField() };
  const markFinished = () => { me.dailyStatus = "finished"; me.dailyDate = date; me.dailyRun = null; };
  if (me.lastDailyDate >= date) {
    updateDoc(doc(db, "users", me.uid), finishedFields).catch(() => {}); markFinished();
    lsSet(lsKey(date), { date, finished: true, submitted: true, pts }); return;
  }
  const streak = me.lastDailyDate === yesterdayOf(date) ? (me.streak || 0) + 1 : 1;
  try {
    await setDoc(doc(db, "users", me.uid),
      { dailyScore: increment(pts), streak, lastDailyDate: date, lastDailyScore: pts, ...finishedFields }, { merge: true });
  } catch (e) {
    if (e.code !== "permission-denied") throw e;
    // denied means this day was already counted
    const fresh = (await getDoc(doc(db, "users", me.uid))).data() || {};
    me.dailyScore = fresh.dailyScore || 0; me.streak = fresh.streak || 0;
    me.lastDailyDate = fresh.lastDailyDate || ""; me.lastDailyScore = fresh.lastDailyScore || 0;
    updateDoc(doc(db, "users", me.uid), finishedFields).catch(() => {}); markFinished();
    lsSet(lsKey(date), { date, finished: true, submitted: true, pts });
    refreshDailyUI();
    return;
  }
  me.dailyScore = (me.dailyScore || 0) + pts;
  me.streak = streak; me.lastDailyDate = date; me.lastDailyScore = pts; markFinished();
  lsSet(lsKey(date), { date, finished: true, submitted: true, pts });
  refreshDailyUI();
}

// pick up your daily after a refresh, a re-login or a different device (and any unsent score)
async function resumeDaily() {
  const prefix = `jf_daily_${me.uid}_`;
  let keys = [];
  try { keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix)); } catch (e) { keys = []; }
  const today = dateStr();
  let local = null;
  for (const k of keys) {
    const st = lsGet(k);
    if (!st) { try { localStorage.removeItem(k); } catch (e) {} continue; }
    if (st.finished) {
      if (!st.submitted) { try { await submitDaily(st.date, st.pts); } catch (e) { /* retry next time */ } }
      else if (st.date !== today) { try { localStorage.removeItem(k); } catch (e) {} }
      continue;
    }
    const stale = me.lastDailyDate >= st.date;
    if (stale || !Array.isArray(st.items) || st.items.length !== 25) { try { localStorage.removeItem(k); } catch (e) {} continue; }
    if (!local || st.date > local.date) local = st;
  }
  // the copy on your account
  let remote = null;
  if (me.dailyStatus === "started" && me.dailyDate && me.lastDailyDate < me.dailyDate)
    remote = { ...(me.dailyRun || {}), date: me.dailyDate };
  else if (me.dailyStarted === today && me.lastDailyDate !== today && !(me.dailyStatus === "finished" && me.dailyDate === today))
    remote = { date: today, found: [], inv: [], startAt: null, inside: true };   // older save that never stored progress: unlock it
  let best = null;
  if (local && remote) best = local.date !== remote.date ? (local.date > remote.date ? local : remote)
    : ((local.found || []).length >= (remote.found || []).length ? local : remote);
  else best = local || remote;

  if (best) {
    try {
      const items = (Array.isArray(best.items) && best.items.length === 25) ? best.items : await loadDailyBoard(best.date);
      startDaily(best.date, items, best);
      if (best.inside === false) switchOutDaily(true);
      toast(best.inside === false ? "Your daily is still going. Tap 💎 to jump back in!" : "Welcome back! Your daily challenge is still going 💎", 3500);
      if (Date.now() >= dailyEndAt()) await finishDaily();
    } catch (e) { console.warn("couldn't restore daily", e); toast("Couldn't reload your daily yet. Refresh to try again.", 4000); }
  }

  // keep the account record honest: not_started / started / finished for today
  if (!daily.started) {
    const eff = dailyStatusToday();
    if (eff !== "started" && !(me.dailyStatus === eff && me.dailyDate === today)) {
      updateDoc(doc(db, "users", me.uid), { dailyStatus: eff, dailyDate: today, dailyRun: deleteField() }).catch(() => {});
      me.dailyStatus = eff; me.dailyDate = today; me.dailyRun = null;
    }
  }
  refreshDailyUI();
}

// ---------- switching out of / back into a started daily ----------
function switchOutDaily(quiet) {
  if (board.querySelector(".item.busy")) { toast("Wait for the mix to finish first", 2000); return; }
  daily.dailyInv = new Map(inventory);
  daily.dailyBoard = snapshotBoard();
  inventory.clear(); savedInventory.forEach((v, k) => inventory.set(k, v)); savedInventory = null;
  daily.active = false;
  clearBoard(); restoreBoard(daily.realBoard); daily.realBoard = null;
  renderSidebar();
  $("dailyPanel").classList.add("hidden"); $("diamondBtn").classList.remove("active");
  saveDailyLocal();
  if (!quiet) toast("Back on your own board. Tap 💎 to return to the daily!", 3000);
}
function switchInDaily() {
  if (board.querySelector(".item.busy")) { toast("Wait for the mix to finish first", 2000); return; }
  if (queue.waiting) leaveQueueWait();
  savedInventory = new Map(inventory);
  daily.realBoard = snapshotBoard();
  inventory.clear(); (daily.dailyInv || new Map()).forEach((v, k) => inventory.set(k, v)); daily.dailyInv = null;
  daily.active = true;
  clearBoard(); restoreBoard(daily.dailyBoard); daily.dailyBoard = null;
  renderSidebar();
  $("dailyPanel").classList.remove("hidden"); $("diamondBtn").classList.add("active");
  renderDailyBoard(); tick(); saveDailyLocal();
  toast("Back in the daily 💎", 2000);
}

// ---------- daily modal ----------
const showDailyView = (v) => {
  $("dailyIntro").classList.toggle("hidden", v !== "intro");
  $("dailyResult").classList.toggle("hidden", v !== "result");
};
async function openDaily() {
  if (queue.active) { toast("Finish your queue match first ⚔️", 3000); return; }
  if (daily.started) { daily.active ? switchOutDaily() : switchInDaily(); return; }   // 💎 toggles in and out once a daily is started
  showDailyView("intro");
  $("dailyModal").classList.remove("hidden");
  const done = dailyStatusToday() === "finished";
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
    if (fresh.lastDailyDate === date || (fresh.dailyDate === date && fresh.dailyStatus === "finished")) {
      me.lastDailyDate = fresh.lastDailyDate || me.lastDailyDate; me.lastDailyScore = fresh.lastDailyScore || 0;
      msg.textContent = `You already finished today's challenge (${me.lastDailyScore} pts). See you at midnight! 🌙`;
      btn.classList.add("hidden"); refreshDailyUI(); return;
    }
    const items = await loadDailyBoard(date);
    // started but not finished stays unlocked: pick it back up instead of locking you out
    const wasStarted = (fresh.dailyDate === date && fresh.dailyStatus === "started") || fresh.dailyStarted === date;
    const run = wasStarted && fresh.dailyDate === date && fresh.dailyRun ? fresh.dailyRun : { found: [], inv: [], startAt: null, inside: true };
    if (!wasStarted) await updateDoc(doc(db, "users", me.uid), { dailyStatus: "started", dailyDate: date, dailyStarted: date, dailyRun: run });
    me.dailyStatus = "started"; me.dailyDate = date; me.dailyRun = run;
    $("dailyModal").classList.add("hidden");
    msg.textContent = "";
    if (queue.waiting) leaveQueueWait();
    startDaily(date, items, { ...run, date, inside: true });
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
  $("drTitle").textContent = r.cleared ? "🎉 BOARD CLEARED!" : "🌙 Midnight!";
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

// ==========================================================
//  Queue: 1v1 bingo race on a shared board
//  - queue/{uid}: a waiting player. The newer player of a pair creates the match.
//  - matches/{id}: the shared board + status. matches/{id}/claims/{tile}: one doc per claimed tile
//    (create-only, so if both players grab a tile at once, exactly one wins it).
//  - no inactivity timer: players can take as long as they want
//  - scoring matches the daily (1 per tile, bingos 3+n, whole board +25), banked into queueScore at the end
// ==========================================================
const QUEUE_DIFF = "daily";         // Default mode: AI words at daily difficulty (Stars, Garden, not Cloud, Plant)
const queue = {
  waiting: false, starting: false, active: false, playing: false, startingPlay: false, finishing: false, matching: false,
  matchId: null, players: [], items: [], claims: new Map(), pending: new Set(),
  oppUid: null, oppName: "", endReq: [], learned: 0, savedBoard: null,
  phase: "pick", mode: null, votes: {}, tiles: [], proposal: null, turn: null, ready: [], introDone: false, sel: null,
  genStarted: false, editFor: "",
  unsubs: [], unsubMine: null, seenTimer: null, introTimer: null
};
const qKey = () => `jf_q_${me.uid}`;
const matchDoc = () => doc(db, "matches", queue.matchId);
const qLines = (u) => LINES.filter((l) => l.every((i) => queue.claims.get(i) === u));
const qCount = (u) => { let c = 0; queue.claims.forEach((v) => { if (v === u) c++; }); return c; };
// same scoring as the daily: 1 per tile, bingos 3+n, whole board +25
const qPts = (u) => { const t = qCount(u), b = qLines(u).length; return t + bingoPoints(b) + (t === 25 ? 25 : 0); };

const snapshotBoard = () => [...board.querySelectorAll(".item")].filter((n) => !n.classList.contains("busy"))
  .map((n) => ({ n: n.dataset.n, e: n.dataset.e, x: parseFloat(n.style.left), y: parseFloat(n.style.top) }));
const restoreBoard = (arr) => (arr || []).forEach((s) => spawn({ n: s.n, e: s.e }, s.x, s.y));

const showQView = (v) => ["intro", "wait", "result"].forEach((n) => $("q" + n[0].toUpperCase() + n.slice(1)).classList.toggle("hidden", n !== v));
function updateQueueBtn() {
  $("queueBtn").classList.toggle("waiting", queue.waiting);
  $("queueBtn").title = queue.waiting ? "Waiting for an opponent…" : "Queue (1v1 race)";
}

// ---------- joining / matchmaking ----------
async function joinQueue() {
  if (queue.waiting || queue.active) return;
  const myRef = doc(db, "queue", me.uid);
  $("qMsg").textContent = "";
  try {
    await deleteDoc(myRef).catch(() => {});   // clear any leftover from an old session
    await setDoc(myRef, { uid: me.uid, username: me.username, created: serverTimestamp(), seen: Date.now(), matchId: null });
  } catch (e) { console.error(e); $("qMsg").textContent = friendlyError(e); return; }
  queue.waiting = true; updateQueueBtn(); showQView("wait");
  queue.unsubMine = onSnapshot(myRef, (s) => { const d = s.data(); if (d && d.matchId) beginMatch(d.matchId); });
  queue.seenTimer = setInterval(() => { updateDoc(myRef, { seen: Date.now() }).catch(() => {}); tryMatch(); }, 8000);
  tryMatch();
}
function stopWaiting() {
  clearInterval(queue.seenTimer);
  if (queue.unsubMine) queue.unsubMine();
  queue.unsubMine = null; queue.waiting = false; updateQueueBtn();
}
function leaveQueueWait() {
  stopWaiting();
  if (me) deleteDoc(doc(db, "queue", me.uid)).catch(() => {});
  $("queueModal").classList.add("hidden"); showQView("intro");
}

// The oldest waiting player just waits. Every newer player pairs up with the oldest one.
async function tryMatch() {
  if (!queue.waiting || queue.starting || queue.matching) return;
  queue.matching = true;
  try {
    const snap = await getDocs(query(collection(db, "queue"), where("seen", ">", Date.now() - 30000)));
    const w = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
      .filter((x) => !x.matchId)
      .sort((a, b) => ((a.created?.toMillis?.() || 0) - (b.created?.toMillis?.() || 0)) || a.id.localeCompare(b.id));
    const first = w[0];
    if (!first || first.id === me.uid || !w.some((x) => x.id === me.uid)) return;

    const myRef = doc(db, "queue", me.uid), theirRef = doc(db, "queue", first.id);
    const mRef = doc(collection(db, "matches"));
    await runTransaction(db, async (tx) => {
      const [t, m] = [await tx.get(theirRef), await tx.get(myRef)];
      if (!t.exists() || t.data().matchId || !m.exists() || m.data().matchId) throw new Error("taken");
      tx.set(mRef, {
        players: [first.id, me.uid], names: { [first.id]: first.username, [me.uid]: me.username },
        status: "active", phase: "pick", mode: null, votes: {}, items: null, tiles: Array(25).fill(""),
        proposal: null, turn: first.id, ready: [], endReq: [], loser: null, created: serverTimestamp()
      });
      tx.update(theirRef, { matchId: mRef.id });
      tx.update(myRef, { matchId: mRef.id });
    });
    // my own queue doc now has matchId, its listener calls beginMatch
  } catch (e) { console.warn("matchmaking retry", e); }
  finally { queue.matching = false; }
}

// Found a match: show the "you vs them" screen, then the mode vote. Your elements are NOT touched until the game starts.
async function beginMatch(matchId) {
  if (!queue.waiting || queue.starting || queue.active) return;
  queue.starting = true;
  try {
    const ms = await getDoc(doc(db, "matches", matchId));
    if (!ms.exists()) throw new Error("match missing");
    const m = ms.data();
    const oppUid = m.players.find((p) => p !== me.uid);
    stopWaiting();
    deleteDoc(doc(db, "queue", me.uid)).catch(() => {});
    Object.assign(queue, {
      active: true, playing: false, startingPlay: false, finishing: false, matchId, players: m.players,
      oppUid, oppName: (m.names || {})[oppUid] || "Opponent", items: [], claims: new Map(), pending: new Set(),
      endReq: [], learned: 0, savedBoard: null, phase: m.phase || "pick", mode: null, votes: {},
      tiles: Array(25).fill(""), proposal: null, turn: m.players[0], ready: [], introDone: false, sel: null,
      genStarted: false, editFor: ""
    });
    lsSet(qKey(), { matchId });
    $("queueModal").classList.add("hidden");
    $("vsMe").textContent = me.username; $("vsOpp").textContent = queue.oppName;
    // replay the little transition animation
    const head = $("matchModal").querySelector(".vs-head");
    head.classList.remove("go"); void head.offsetWidth; head.classList.add("go");
    $("matchModal").classList.remove("hidden");
    renderLobby();
    clearTimeout(queue.introTimer);
    queue.introTimer = setTimeout(() => { queue.introDone = true; renderLobby(); }, 2400);
    queue.unsubs = [onSnapshot(matchDoc(), onMatchSnap)];
  } catch (e) {
    console.error(e);
    queue.active = false;
    toast(friendlyError(e), 4000);
  } finally { queue.starting = false; }
}

// deterministic shuffle so both players get the very same shuffled board
function seededShuffle(arr, seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------- lobby (mode vote, AI words or custom building) ----------
function lobbyLogic() {
  const ref = matchDoc();
  if (queue.phase === "pick") {
    const a = queue.votes[queue.players[0]], b = queue.votes[queue.players[1]];
    if (a && a === b) updateDoc(ref, { mode: a, phase: a === "default" ? "gen" : "build", turn: queue.players[0] }).catch(() => {});
  } else if (queue.phase === "gen") {
    if (!queue.genStarted) {
      queue.genStarted = true;
      // the newer player makes the board; if they vanish, the other player takes over after 45 s
      const delay = me.uid === queue.players[1] ? 0 : 45000;
      setTimeout(() => { if (queue.active && !queue.playing && queue.phase === "gen") generateDefaultBoard(); }, delay);
    }
  } else if (queue.phase === "ready") {
    if (queue.players.every((p) => queue.ready.includes(p)))
      updateDoc(ref, { phase: "play", items: seededShuffle(queue.tiles, queue.matchId) }).catch(() => {});
  }
}

async function generateDefaultBoard() {
  const matchId = queue.matchId;
  let items;
  try { items = await generateBoardItems("queue-" + matchId, QUEUE_DIFF); }
  catch (e) { items = shuffle(HARD_FALLBACK.slice()).slice(0, 25); }
  if (!queue.active || queue.matchId !== matchId) return;
  try {
    const ref = doc(db, "matches", matchId);
    await runTransaction(db, async (tx) => {
      const d = (await tx.get(ref)).data();
      if (!d || d.phase !== "gen" || d.items) return;     // someone else already did it
      tx.update(ref, { items, phase: "play" });
    });
  } catch (e) { console.warn("default board write failed", e); }
}

const LOBBY_VIEWS = ["mIntro", "mPick", "mGen", "mBuild", "mReady"];
function renderLobby() {
  if (!queue.active || queue.playing) return;
  LOBBY_VIEWS.forEach((id) => $(id).classList.add("hidden"));
  $("mGrid").classList.add("hidden");
  if (queue.phase === "pick") {
    if (!queue.introDone) { $("mIntro").classList.remove("hidden"); return; }
    $("mPick").classList.remove("hidden");
    const my = queue.votes[me.uid], op = queue.votes[queue.oppUid], L = { default: "Default", custom: "Custom" };
    $("modeDefault").classList.toggle("chosen", my === "default");
    $("modeCustom").classList.toggle("chosen", my === "custom");
    $("mVotes").textContent = !my
      ? (op ? `${queue.oppName} picked ${L[op]}. What do you pick?` : "Pick a mode. You both need to choose the same one.")
      : !op ? `You picked ${L[my]}. Waiting for ${queue.oppName}…`
      : my === op ? "Starting…"
      : `You picked ${L[my]} but ${queue.oppName} picked ${L[op]}. One of you needs to change!`;
  } else if (queue.phase === "gen") {
    $("mGen").classList.remove("hidden");
  } else {
    renderBuild();
  }
}

function renderBuild() {
  const ph = queue.phase, p = queue.proposal, meU = me.uid, opp = queue.oppName;
  const myTurn = queue.turn === meU;
  const canPick = ph === "build" && myTurn && !p;
  const myVetoed = ph === "build" && !!p && p.by === meU && p.state === "vetoed";
  const judging = ph === "build" && !!p && p.by !== meU && p.state === "pending";
  const filled = queue.tiles.filter(Boolean).length;

  $("mGrid").classList.remove("hidden");
  $("mGrid").innerHTML = queue.tiles.map((t, i) => {
    let cls = "m-cell", txt = t;
    if (t) cls += " filled";
    else if (p && p.idx === i) { cls += p.state === "vetoed" ? " vetoed" : " pending"; txt = p.text; }
    else if (canPick) { cls += " open"; if (queue.sel === i) cls += " sel"; }
    return `<div class="${cls}" data-i="${i}"><small>${i + 1}</small>${esc(txt || "")}</div>`;
  }).join("");

  if (ph === "ready") {
    $("mReady").classList.remove("hidden");
    $("mCount").textContent = "";
    const iReady = queue.ready.includes(meU), oppReady = queue.ready.includes(queue.oppUid);
    $("mBegin").disabled = iReady;
    $("mBegin").textContent = iReady ? "Waiting…" : "Begin";
    $("mReadyNote").textContent = iReady ? `Waiting for ${opp} to press begin…` : oppReady ? `${opp} is ready!` : "";
    return;
  }

  $("mBuild").classList.remove("hidden");
  $("mCount").textContent = `${filled}/25 tiles written`;
  let status;
  if (canPick) status = queue.sel === null ? "Your turn! Tap an empty tile and write something you two can realistically make." : `Tile ${queue.sel + 1}: type your word.`;
  else if (myVetoed) status = `${opp} vetoed “${p.text}”. Fix it and submit again.`;
  else if (p && p.by === meU) status = `Waiting for ${opp} to accept or veto “${p.text}”…`;
  else if (judging) status = `${opp} wants tile ${p.idx + 1} to be “${p.text}”.`;
  else if (p) status = `You vetoed “${p.text}”. Waiting for ${opp} to fix it…`;
  else status = `Waiting for ${opp} to pick a tile…`;
  $("mStatus").textContent = status;

  const showEdit = (canPick && queue.sel !== null) || myVetoed;
  $("mEdit").classList.toggle("hidden", !showEdit);
  $("mJudge").classList.toggle("hidden", !judging);
  if (showEdit) {
    const key = myVetoed ? `${p.idx}:${p.text}` : `sel${queue.sel}`;
    if (queue.editFor !== key) { queue.editFor = key; $("mWord").value = myVetoed ? p.text : ""; $("mWord").focus(); }
  } else queue.editFor = "";
}

$("mGrid").addEventListener("click", (e) => {
  const c = e.target.closest(".m-cell.open");
  if (!c || !queue.active) return;
  queue.sel = Number(c.dataset.i); renderBuild();
});
function submitProposal() {
  const p = queue.proposal, myVetoed = !!p && p.by === me.uid && p.state === "vetoed";
  const idx = myVetoed ? p.idx : queue.sel;
  if (idx === null || idx === undefined) return;
  const text = $("mWord").value.replace(/\s+/g, " ").trim().slice(0, 30);
  if (!text) { toast("Type a word first", 1800); return; }
  if (isStartEl(text)) { toast("You already start with that one, pick something else", 2500); return; }
  if (queue.tiles.some((t, i) => t && i !== idx && keyOf(t) === keyOf(text))) { toast("That word is already on the board", 2500); return; }
  updateDoc(matchDoc(), { proposal: { idx, text, by: me.uid, state: "pending" } })
    .then(() => { queue.sel = null; $("mWord").value = ""; queue.editFor = ""; })
    .catch(() => toast("Couldn't send that. Try again.", 2500));
}
$("mSubmit").onclick = submitProposal;
$("mWord").addEventListener("keydown", (e) => { if (e.key === "Enter") submitProposal(); });
$("mAccept").onclick = () => {
  const p = queue.proposal;
  if (!queue.active || !p || p.by === me.uid || p.state !== "pending") return;
  const tiles = queue.tiles.slice(); tiles[p.idx] = p.text;
  const upd = { tiles, proposal: null, turn: me.uid };   // you pick the next tile
  if (tiles.every(Boolean)) upd.phase = "ready";
  updateDoc(matchDoc(), upd).catch(() => toast("Couldn't send that. Try again.", 2500));
};
$("mVeto").onclick = () => {
  const p = queue.proposal;
  if (!queue.active || !p || p.by === me.uid || p.state !== "pending") return;
  updateDoc(matchDoc(), { proposal: { ...p, state: "vetoed" } }).catch(() => toast("Couldn't send that. Try again.", 2500));
};
$("mBegin").onclick = () => updateDoc(matchDoc(), { ready: arrayUnion(me.uid) }).catch(() => toast("Couldn't send that. Try again.", 2500));
const vote = (v) => { if (queue.active && queue.phase === "pick") updateDoc(matchDoc(), { [`votes.${me.uid}`]: v }).catch(() => {}); };
$("modeDefault").onclick = () => vote("default");
$("modeCustom").onclick = () => vote("custom");

function cancelLobby(msg) {
  queue.unsubs.forEach((u) => u()); queue.unsubs = [];
  clearTimeout(queue.introTimer);
  Object.assign(queue, { active: false, playing: false, matchId: null, finishing: false });
  $("matchModal").classList.add("hidden");
  try { localStorage.removeItem(qKey()); } catch (e) { /* ignore */ }
  if (msg) toast(msg, 4000);
}
$("mLeave").onclick = async () => {
  if (!queue.active || queue.playing) return;
  try { await updateDoc(matchDoc(), { status: "cancelled" }); } catch (e) { /* leave anyway */ }
  cancelLobby("You left the match. Nothing was lost.");
};

// the game itself: swap to the 4 basics and show the (shuffled) board
async function startPlay(items) {
  if (queue.playing || queue.startingPlay) return;
  queue.startingPlay = true;
  try {
    for (let i = 0; i < 50 && board.querySelector(".item.busy"); i++) await sleep(100);   // let a mix in progress land first
    savedInventory = new Map(inventory);
    Object.assign(queue, { items, claims: new Map(), pending: new Set(), learned: 0, savedBoard: snapshotBoard() });
    inventory.clear(); START.forEach((s) => inventory.set(keyOf(s.n), s));
    renderSidebar(); clearBoard();
    $("matchModal").classList.add("hidden");
    $("queuePanel").classList.remove("hidden"); $("queueBtn").classList.add("active");
    $("qpTitle").textContent = `⚔️ vs ${queue.oppName}`;
    queue.playing = true;
    renderQueueBoard();
    queue.unsubs.push(onSnapshot(collection(db, "matches", queue.matchId, "claims"), onClaimsSnap));
    toast(`⚔️ Go! You're back to the 4 basics`, 3500);
  } finally { queue.startingPlay = false; }
}

// ---------- live match ----------
function onMatchSnap(s) {
  if (!queue.active || !s.exists()) return;
  const m = s.data({ serverTimestamps: "estimate" });
  if (!queue.playing && (m.status === "cancelled" || m.status === "forfeit" || m.status === "done")) {
    cancelLobby(`${queue.oppName} left before the game started`); return;
  }
  if (m.status === "cancelled") return;
  if (m.status === "forfeit") { finishQueue("forfeit", m.loser); return; }
  if (m.status === "done") { finishQueue("done"); return; }
  Object.assign(queue, {
    phase: m.phase || "pick", mode: m.mode || null, votes: m.votes || {}, tiles: m.tiles || Array(25).fill(""),
    proposal: m.proposal || null, turn: m.turn || m.players[0], ready: m.ready || [], endReq: m.endReq || []
  });
  if (!queue.playing) {
    if (queue.phase === "play") { if (m.items && m.items.length === 25) startPlay(m.items); return; }
    lobbyLogic(); renderLobby(); return;
  }
  renderQueueBoard();
  if (queue.endReq.includes(me.uid) && queue.endReq.includes(queue.oppUid)) {
    updateDoc(matchDoc(), { status: "done" }).catch(() => {});
    finishQueue("agreed");
  }
}

function onClaimsSnap(s) {
  if (!queue.active) return;
  const prevMine = qLines(me.uid).length, prevTheirs = qLines(queue.oppUid).length;
  queue.claims = new Map(s.docs.map((d) => [Number(d.id), d.data().uid]));
  s.docChanges().forEach((ch) => {
    if (ch.type !== "added") return;
    const c = ch.doc.data(), name = queue.items[Number(ch.doc.id)];
    toast(c.uid === me.uid ? `🔵 You claimed ${name}!` : `🔴 ${queue.oppName} claimed ${name}`, 2200);
  });
  const nowMine = qLines(me.uid).length, nowTheirs = qLines(queue.oppUid).length;
  if (nowMine > prevMine) toast("🎉 BINGO!", 3000);
  else if (nowTheirs > prevTheirs) toast(`😬 ${queue.oppName} got a bingo!`, 3000);
  renderQueueBoard();
  if (queue.claims.size >= 25) {
    updateDoc(matchDoc(), { status: "done" }).catch(() => {});
    finishQueue("full");
  }
}

function renderQueueBoard() {
  if (!queue.active || !queue.playing) return;
  const mine = qLines(me.uid), theirs = qLines(queue.oppUid);
  const inLine = new Set([...mine.flat(), ...theirs.flat()]);
  $("qpGrid").innerHTML = queue.items.map((n, i) => {
    const o = queue.claims.get(i);
    return `<div class="dp-cell${o ? (o === me.uid ? " mine" : " theirs") : ""}${o && inLine.has(i) ? " line" : ""}">${esc(n)}</div>`;
  }).join("");
  $("qpScore").textContent = `🔵 ${qPts(me.uid)} · 🔴 ${qPts(queue.oppUid)}`;
  const iAsked = queue.endReq.includes(me.uid), theyAsked = queue.endReq.includes(queue.oppUid);
  $("qpFoot").textContent = `${qCount(me.uid)} yours · ${qCount(queue.oppUid)} theirs · ${25 - queue.claims.size} open` +
    (theyAsked ? " · they want to end!" : iAsked ? " · waiting for them…" : "");
  $("qpEnd").textContent = iAsked ? "⏳ Cancel request" : theyAsked ? "✅ Accept end" : "🤝 Request end";
}

// called after every successful mix while in a match
async function queueOnResult(result) {
  if (!queue.playing) return;
  const idx = queue.items.findIndex((x) => keyOf(x) === keyOf(result.n));
  if (idx < 0 || queue.pending.has(idx)) return;
  const owner = queue.claims.get(idx);
  if (owner) { if (owner !== me.uid) toast(`Too slow, ${queue.oppName} already has ${result.n} 🔴`, 2500); return; }
  const matchId = queue.matchId;
  queue.pending.add(idx);
  try { await setDoc(doc(db, "matches", matchId, "claims", String(idx)), { uid: me.uid, idx }); }
  catch (e) { if (queue.active) toast(`Too slow, ${queue.oppName} grabbed ${result.n} first! 🔴`, 3000); }
  finally { queue.pending.delete(idx); }
}

$("qpEnd").onclick = () => {
  if (!queue.playing) return;
  const asked = queue.endReq.includes(me.uid);
  updateDoc(matchDoc(), { endReq: asked ? arrayRemove(me.uid) : arrayUnion(me.uid) })
    .catch(() => toast("Couldn't send that. Try again.", 2500));
};
$("qpLeave").onclick = async () => {
  if (!queue.playing) return;
  if (!confirm("Leave the match? Leaving counts as a loss and all the points you earned in it are thrown away.")) return;
  try { await updateDoc(matchDoc(), { status: "forfeit", loser: me.uid }); } catch (e) { /* leave anyway */ }
  finishQueue("forfeit", me.uid);
};
// closing the tab mid-match = leaving (best effort). There is no inactivity timeout: players can think as long as they like.
window.addEventListener("pagehide", () => {
  if (queue.active && !queue.finishing && me)
    updateDoc(matchDoc(), queue.playing ? { status: "forfeit", loser: me.uid } : { status: "cancelled" }).catch(() => {});
});

// ---------- end of match ----------
async function finishQueue(reason, loserUid) {
  if (!queue.playing || queue.finishing) return;
  queue.finishing = true;
  queue.unsubs.forEach((u) => u()); queue.unsubs = [];

  const myUid = me.uid, opp = queue.oppUid, oppName = queue.oppName;
  const mineB = qLines(myUid).length, theirB = qLines(opp).length;
  const myT = qCount(myUid), theirT = qCount(opp);
  const iLeft = reason === "forfeit" && loserUid === myUid;
  const oppLeft = reason === "forfeit" && loserUid === opp;
  const bp = bingoPoints(mineB), bonus = myT === 25 ? 25 : 0;
  const myPts = myT + bp + bonus, theirPts = qPts(opp);
  const pts = iLeft ? 0 : myPts;
  const learned = queue.learned, matchId = queue.matchId;
  const won = iLeft ? false : oppLeft ? true : myPts > theirPts;
  const draw = !iLeft && !oppLeft && myPts === theirPts;

  // back to your own board, now with everything you learned
  inventory.clear(); savedInventory.forEach((v, k) => inventory.set(k, v)); savedInventory = null;
  const sb = queue.savedBoard;
  Object.assign(queue, { active: false, playing: false, savedBoard: null, matchId: null });
  $("queuePanel").classList.add("hidden"); $("queueBtn").classList.remove("active");
  clearBoard(); restoreBoard(sb); renderSidebar();
  try { localStorage.removeItem(qKey()); } catch (e) { /* ignore */ }

  const rows = [`🔵 Tiles claimed: ${myT} × 1 = ${myT}`, `Bingos: ${mineB} = +${bp}`];
  if (bonus) rows.push("Whole board yours: +25");
  rows.push(`🔴 ${oppName}: ${theirT} tiles, ${theirB} bingo${theirB === 1 ? "" : "s"} (${theirPts} pts)`);
  if (learned) rows.push(`✨ New elements learned: ${learned}`);
  if (iLeft) rows.push("You left the match, so your points were thrown away.");
  if (oppLeft) rows.push(`${oppName} left the match.`);
  $("qrTitle").textContent = iLeft ? "🚪 You left: loss" : draw ? "🤝 Draw!" : won ? "🏆 You won!" : "😵 You lost";
  $("qrBreak").innerHTML = rows.map((x) => `<li>${esc(x)}</li>`).join("");
  $("qrScore").textContent = pts;
  $("qrTotal").textContent = (me.queueScore || 0).toLocaleString();
  showQView("result"); $("queueModal").classList.remove("hidden");

  if (pts > 0) { await submitQueue(pts, matchId); $("qrTotal").textContent = (me.queueScore || 0).toLocaleString(); }
}

async function submitQueue(pts, matchId) {
  const k = `jf_qsub_${me.uid}_${matchId}`;
  if (lsGet(k)) return;
  for (let i = 0; i < 3; i++) {
    try {
      await setDoc(doc(db, "users", me.uid), { queueScore: increment(pts) }, { merge: true });
      me.queueScore = (me.queueScore || 0) + pts; lsSet(k, 1); return;
    } catch (e) { console.warn("queue save failed", e); await sleep(1200); }
  }
  toast("Couldn't save your queue points.", 5000);
}

// refreshed / reopened the game mid-match = you left it
async function resumeQueue() {
  deleteDoc(doc(db, "queue", me.uid)).catch(() => {});
  const st = lsGet(qKey());
  if (!st || !st.matchId) return;
  try { localStorage.removeItem(qKey()); } catch (e) { /* ignore */ }
  try {
    const ref = doc(db, "matches", st.matchId);
    const s = await getDoc(ref);
    if (s.exists() && s.data().status === "active") {
      if (s.data().phase === "play") {
        await updateDoc(ref, { status: "forfeit", loser: me.uid });
        toast("You left your match, so it counted as a loss ⚔️", 5000);
      } else {
        await updateDoc(ref, { status: "cancelled" });   // still in the lobby: nothing to lose
        toast("Your match was cancelled when you left the page", 4000);
      }
    }
  } catch (e) { /* ignore */ }
}

function teardownQueue() {
  clearInterval(queue.seenTimer);
  if (queue.unsubMine) queue.unsubMine();
  queue.unsubs.forEach((u) => u());
  clearTimeout(queue.introTimer);
  Object.assign(queue, { waiting: false, active: false, playing: false, startingPlay: false, starting: false, finishing: false, matching: false,
    matchId: null, unsubs: [], unsubMine: null, savedBoard: null });
  $("matchModal").classList.add("hidden");
  $("queuePanel").classList.add("hidden"); $("queueBtn").classList.remove("active"); $("queueBtn").classList.remove("waiting");
  $("queueModal").classList.add("hidden");
}

// ---------- queue modal ----------
$("queueBtn").onclick = () => {
  if (queue.active) { toast("Match in progress! Claim those tiles ⚔️", 2500); return; }
  if (daily.active) { toast("Tap 💎 to switch out of your daily first", 2500); return; }
  showQView(queue.waiting ? "wait" : "intro");
  $("qMsg").textContent = "";
  $("queueModal").classList.remove("hidden");
};
$("qJoin").onclick = joinQueue;
$("qLeaveWait").onclick = leaveQueueWait;
$("queueClose").onclick = () => $("queueModal").classList.add("hidden");
$("qDone").onclick = () => $("queueModal").classList.add("hidden");
$("queueModal").addEventListener("click", (e) => { if (e.target.id === "queueModal") $("queueModal").classList.add("hidden"); });

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

/* =========================================================================
   DRAGONEER — rpg_app.js
   Firebase-backed multiplayer doodle RPG.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserSessionPersistence,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, collection,
  addDoc, query, where, orderBy, limit, runTransaction, deleteDoc, arrayUnion, arrayRemove,
  increment, serverTimestamp, collectionGroup, getAggregateFromServer, sum, count
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { DG_TRACK, DG_COOLDOWN_MS, DG_LOCKED_TABS, DG_SKIP_PRICE, isCheckpoint, rollEventType, rollRarity, buildMonster, waveSize, doorOutcome, doorPct, fmtCountdown } from "./rpg_dungeon.js";
import { SKILL_TREES, SKILL_NODES, SKILL_BY_ID, SKILL_TREE_VERSION, LEGACY_SKILL_HM, isSpellNode, describeSkill } from "./rpg_skilltree.js";
import { gearRarity, registerItems, addExpansionRecipes, buildPool, rollPool, GEAR_SHOP_WEIGHT, MODES, FORAGE_RULES, MINE_RULES, MINE_CASH_SHARE, FISH_RULES, RARITY_W, MINE_NEG, craftedArmorStats, craftedTrinketStats, craftedWeaponAttack, gearExtra } from "./rpg_content.js";

/* =========================================================================
   DRAGONEER — rpg_daynight.js
   Device-clock day/night cycle. Pure helpers + a small DOM driver.
   Darkness: 0 (day) .. 1 (night).  8am-7pm = 0 | 7pm-8pm ramps to 1 | 8pm-7am = 1 | 7am-8am ramps to 0
   ========================================================================= */
const NIGHT_START_H = 20, NIGHT_END_H = 8, DIM_MINUTES = 60;

/* ?hour=21.5 in the URL previews any time of day (handy for testing). */
const forced = (()=>{ try{ const v = new URLSearchParams(location.search).get("hour"); return v==null ? null : +v; }catch{ return null; } })();
const hourNow = (d=new Date())=> forced!=null && !isNaN(forced) ? forced : d.getHours() + d.getMinutes()/60 + d.getSeconds()/3600;

function darkness(h=hourNow()){
  const ramp = DIM_MINUTES/60;
  if(h >= NIGHT_START_H || h < NIGHT_END_H - ramp) return 1;                 // 8pm .. 7am
  if(h >= NIGHT_START_H - ramp) return (h-(NIGHT_START_H-ramp))/ramp;        // 7pm-8pm  dimming
  if(h >= NIGHT_END_H - ramp && h < NIGHT_END_H) return 1-(h-(NIGHT_END_H-ramp))/ramp;   // 7am-8am brightening
  return 0;
}
const isNight = (h=hourNow())=> h >= NIGHT_START_H || h < NIGHT_END_H;

/* Time-of-day bands (Bestiary): dawn 7-8am, day 8am-7pm, sunset 7-8pm, night 8pm-7am */
const PERIODS = [
  { id:"dawn",   label:"Dawn",   icon:"🌅", from:7,  to:8  },
  { id:"day",    label:"Day",    icon:"☀️", from:8,  to:19 },
  { id:"sunset", label:"Sunset", icon:"🌇", from:19, to:20 },
  { id:"night",  label:"Night",  icon:"🌙", from:20, to:31 }     // 8pm -> 7am (wraps past midnight)
];
function periodOf(h=hourNow()){
  const x = h < 7 ? h+24 : h;
  return PERIODS.find(p=> x>=p.from && x<p.to) || PERIODS[3];
}

/* "rpg_earth.mp3" -> "rpg_earth_night.mp3" while it's night (title/dungeon tracks stay as they are). */
function trackFor(src, night=isNight()){
  if(!night || !/^rpg_(earth|air|fire|water)\.mp3$/.test(src)) return src;
  return src.replace(/\.mp3$/, "_night.mp3");
}

/* Theme setting: "dynamic" (default) | "light" | "dark" */
const THEMES = ["dynamic","light","dark"];
const wantDarkUI = (mode, d=darkness())=> mode==="dark" || (mode!=="light" && d>=0.5);

/* ---- DOM driver ---- */
let lastNight = null, lastDark = null;
function startDayNight({ getTheme=()=>"dynamic", onNightChange=()=>{} }={}){
  const body = document.body;
  const tick = ()=>{
    const d = darkness();
    body.style.setProperty("--night", d.toFixed(3));
    body.classList.toggle("has-night", d>0.001);
    const dark = wantDarkUI(getTheme(), d);
    if(dark !== lastDark){ body.classList.toggle("theme-dark", dark); lastDark = dark; }
    const n = isNight();
    if(n !== lastNight){ const first = lastNight===null; lastNight = n; if(!first) onNightChange(n); }
  };
  tick(); setInterval(tick, 15000);
  return tick;
}

/* =========================================================================
   Bestiary odds. Fish (and forage) have a habit from their id: a peak hour and an active window.
   FISH: every species has its OWN independent chance per catch (they can add up to far more than 100%),
   rarer fish are far pickier about the hour:   max %  legendary 1-2 · epic 1-5 · rare 2-10 · uncommon 4-15 · common 5-20
   and every fish drops to ~0% at its opposite time of day.  FORAGE keeps the older relative-weight system.
   ========================================================================= */
const hash = s=>{ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); } return h>>>0; };
const SWING = { common:[0.65,1.7], uncommon:[0.5,2.1], rare:[0.3,2.8], epic:[0.15,3.6], legendary:[0.05,5] };
const PEAKS = [ {id:"dawn",label:"Dawn",icon:"🌅",hour:7.5}, {id:"day",label:"Day",icon:"☀️",hour:13.5}, {id:"sunset",label:"Sunset",icon:"🌇",hour:19.5}, {id:"night",label:"Night",icon:"🌙",hour:1.5} ];
const FISH_MAX = { legendary:[1,2], epic:[1,5], rare:[2,10], uncommon:[4,15], common:[5,20] };      // % at the very best hour
const FISH_MIN = { legendary:0, epic:0, rare:0.1, uncommon:0.3, common:0.5 };                       // % at the very worst hour (close to 0)
const FISH_WIDTH = { legendary:[2.5,3.5], epic:[3.5,4.5], rare:[4.5,6], uncommon:[6,8], common:[8,11] };   // half-width of the active window, in hours
const rng01 = (h,k)=> ((h>>>k)%1000)/999;
function habit(id, rarity="common"){
  const h = hash(id), r = SWING[rarity] || SWING.common;
  if(h%7===0) return { id:"any", label:"All day", icon:"🕐", peak:null, width:24, lo:1, hi:1 };
  const pk = PEAKS[(h>>>3)%4], width = 4 + (h>>>7)%4;
  return { id:pk.id, label:pk.label, icon:pk.icon, peak:pk.hour, width, lo:r[0], hi:r[1] };
}
function fishHabit(id, rarity="common"){
  const h = hash("fish:"+id), pk = PEAKS[(h>>>3)%4], [wl,wh] = FISH_WIDTH[rarity]||FISH_WIDTH.common, [ml,mh] = FISH_MAX[rarity]||FISH_MAX.common;
  return { id:pk.id, label:pk.label, icon:pk.icon, peak:pk.hour, width: wl+(wh-wl)*rng01(h,9), max: ml+(mh-ml)*rng01(h,15), min: FISH_MIN[rarity] ?? 0.5 };
}
const circ = (a,b)=>{ const d = Math.abs(a-b)%24; return Math.min(d, 24-d); };
function activity(hb, hour){
  if(hb.peak==null) return 1;
  const d = circ(hour, hb.peak); if(d >= hb.width) return 0;
  return (1+Math.cos(Math.PI*d/hb.width))/2;
}
const weightAt = (hb, hour)=> hb.lo + (hb.hi-hb.lo)*activity(hb, hour);
function poolAt(pool, itemById, hour){                        // forage: relative odds re-weighted for this hour
  const w = pool.map(e=> ({ ...e, p: e.p*weightAt(habit(e.id, e.rarity), hour) }));
  const tot = w.reduce((a,e)=>a+e.p,0) || 1;
  return w.map(e=>({ ...e, p:e.p/tot }));
}
/* fish: independent % chance (0-100) for one fish at an hour */
const fishPct = (fh, hour)=> fh.min + (fh.max-fh.min)*activity(fh, hour);
const fishPctById = (id, rarity, hour)=> fishPct(fishHabit(id, rarity), hour);
const oddsByHour = (pool, id)=>{ const e = pool.find(x=>x.id===id); return Array.from({length:24}, (_,h)=> e ? fishPctById(e.id, e.rarity, h+0.5) : 0); };
/* roll a catch: go through the species in random order, each passing its own independent roll; luck boosts the rarer ones */
function rollFish(pool, hour, luck=0){
  const mult = { rare:1+luck, epic:1+2*luck, legendary:1+3*luck };
  const order = [...pool].sort(()=> Math.random()-0.5);
  for(const e of order) if(Math.random()*100 < Math.min(100, fishPctById(e.id, e.rarity, hour)*(mult[e.rarity]||1))) return e.id;
  const w = pool.map(e=> fishPctById(e.id, e.rarity, hour)+0.01), tot = w.reduce((a,b)=>a+b,0);      // nothing passed: weighted fallback so every catch lands something
  let t = Math.random()*tot; for(let i=0;i<pool.length;i++){ t -= w[i]; if(t<=0) return pool[i].id; }
  return pool[pool.length-1].id;
}
function activeText(hb){
  if(hb.peak==null) return "All day";
  const hrs = []; for(let h=0;h<24;h++) if(activity(hb,h+0.5)>=0.5) hrs.push(h);
  if(!hrs.length) return hb.label;
  let start = hrs[0]; for(const h of hrs) if(!hrs.includes((h+23)%24)) start = h;
  const end = (start+hrs.length)%24, f = h=> `${h%12||12}${h%24<12?"am":"pm"}`;
  return `${f(start)} – ${f(end)}`;
}

/* =========================================================================
   DRAGONEER — rpg_cosmetics.js
   Shop cosmetics: profile gradients, profile/chat fonts, extra boss reactions.
   Pure data + helpers. Ids are whitelisted here, so a message or profile that
   carries an unknown id is simply ignored (nothing user-typed ever reaches CSS).
   ========================================================================= */
const GRADIENTS = [
  { id:"grad_ruby",     name:"Ruby Blaze",     price:900,  css:"linear-gradient(135deg,#ff5a5a 0%,#ffb0b0 100%)" },
  { id:"grad_emerald",  name:"Emerald Meadow", price:900,  css:"linear-gradient(135deg,#3fd16b 0%,#c6f5a0 100%)" },
  { id:"grad_sapphire", name:"Sapphire Tide",  price:900,  css:"linear-gradient(135deg,#3f7bff 0%,#9be3ff 100%)" },
  { id:"grad_sunset",   name:"Sunset (R→G)",   price:1400, css:"linear-gradient(135deg,#ff4d4d 0%,#ffb347 50%,#7ee26a 100%)" },
  { id:"grad_aurora",   name:"Aurora (G→B)",   price:1400, css:"linear-gradient(135deg,#43e08a 0%,#3fc5d6 50%,#4a6bff 100%)" },
  { id:"grad_twilight", name:"Twilight (B→R)", price:1400, css:"linear-gradient(135deg,#4a6bff 0%,#9a5cf0 50%,#ff5a7a 100%)" }
];
const FONTS = [
  { id:"font_pacifico", name:"Pacifico",     price:700,  family:"'Pacifico', cursive" },
  { id:"font_cinzel",   name:"Cinzel",       price:700,  family:"'Cinzel', serif" },
  { id:"font_orbitron", name:"Orbitron",     price:900,  family:"'Orbitron', sans-serif" },
  { id:"font_typewriter", name:"Special Elite", price:900, family:"'Special Elite', monospace" },
  { id:"font_pixel",    name:"Press Start 2P", price:1100, family:"'Press Start 2P', monospace" }
];
const REACTIONS = [
  { id:"rx_money",  emoji:"🤑", name:"Money Eyes", price:1000 },
  { id:"rx_cross",  emoji:"❌", name:"Big X",      price:1500 },
  { id:"rx_melt",   emoji:"🫩", name:"Tired Face", price:2500 },
  { id:"rx_gem",    emoji:"💎", name:"Gem",        price:5000 }
];
GRADIENTS.push(
  { id:"grad_peach",    name:"Peach Fizz",      price:1200, rot:true, css:"linear-gradient(135deg,#ffb88c 0%,#ffe3d0 100%)" },
  { id:"grad_mint",     name:"Mint Frost",      price:1200, rot:true, css:"linear-gradient(135deg,#a8f0d0 0%,#e0fff2 100%)" },
  { id:"grad_lavender", name:"Lavender Haze",   price:1300, rot:true, css:"linear-gradient(135deg,#c9a9ff 0%,#f0e4ff 100%)" },
  { id:"grad_cotton",   name:"Cotton Candy",    price:1500, rot:true, css:"linear-gradient(135deg,#ffb3de 0%,#b3e6ff 100%)" },
  { id:"grad_golden",   name:"Golden Hour",     price:1500, rot:true, css:"linear-gradient(135deg,#ffd36e 0%,#ff9a6e 100%)" },
  { id:"grad_ocean",    name:"Ocean Breeze",    price:1400, rot:true, css:"linear-gradient(135deg,#6ec6ff 0%,#b8f2e6 100%)" },
  { id:"grad_moss",     name:"Forest Moss",     price:1300, rot:true, css:"linear-gradient(135deg,#8fd18f 0%,#d8f0a0 100%)" },
  { id:"grad_blossom",  name:"Cherry Blossom",  price:1600, rot:true, css:"linear-gradient(135deg,#ffc2d4 0%,#fff0f5 100%)" },
  { id:"grad_lava",     name:"Lava Flow",       price:1800, rot:true, css:"linear-gradient(135deg,#ff7a45 0%,#ffd166 100%)" },
  { id:"grad_nlights",  name:"Northern Lights", price:2000, rot:true, css:"linear-gradient(135deg,#7dffb5 0%,#7db8ff 50%,#c58bff 100%)" },
  { id:"grad_bubble",   name:"Bubblegum Pop",   price:1700, rot:true, css:"linear-gradient(135deg,#ff8fcf 0%,#ffe08f 100%)" },
  { id:"grad_sky",      name:"Clear Sky",       price:1200, rot:true, css:"linear-gradient(135deg,#8ecbff 0%,#e8f6ff 100%)" }
);
FONTS.push(
  { id:"font_bangers",  name:"Bangers",            price:800,  rot:true, family:"'Bangers', cursive" },
  { id:"font_lobster",  name:"Lobster",            price:800,  rot:true, family:"'Lobster', cursive" },
  { id:"font_creepster",name:"Creepster",          price:1000, rot:true, family:"'Creepster', cursive" },
  { id:"font_righteous",name:"Righteous",          price:900,  rot:true, family:"'Righteous', sans-serif" },
  { id:"font_marker",   name:"Permanent Marker",   price:900,  rot:true, family:"'Permanent Marker', cursive" },
  { id:"font_audiowide",name:"Audiowide",          price:1000, rot:true, family:"'Audiowide', sans-serif" },
  { id:"font_indie",    name:"Indie Flower",       price:800,  rot:true, family:"'Indie Flower', cursive" },
  { id:"font_blackops", name:"Black Ops One",      price:1100, rot:true, family:"'Black Ops One', cursive" },
  { id:"font_fred",     name:"Fredericka the Great",price:1200, rot:true, family:"'Fredericka the Great', cursive" }
);
REACTIONS.push(
  { id:"rx_laugh", emoji:"😂", name:"Laughing",   price:1000, rot:true }, { id:"rx_think", emoji:"🤔", name:"Thinking",  price:1000, rot:true },
  { id:"rx_cool",  emoji:"😎", name:"Cool",       price:1500, rot:true }, { id:"rx_party", emoji:"🥳", name:"Party",     price:1800, rot:true },
  { id:"rx_mind",  emoji:"🤯", name:"Mind Blown", price:2200, rot:true }, { id:"rx_clap",  emoji:"👏", name:"Clap",      price:1200, rot:true },
  { id:"rx_skull", emoji:"💀", name:"Skull",      price:2500, rot:true }, { id:"rx_pray",  emoji:"🙏", name:"Please",    price:1200, rot:true },
  { id:"rx_angry", emoji:"😡", name:"Angry",      price:1500, rot:true }, { id:"rx_cold",  emoji:"🥶", name:"Freezing",  price:2000, rot:true },
  { id:"rx_clown", emoji:"🤡", name:"Clown",      price:3000, rot:true }, { id:"rx_eyes",  emoji:"👀", name:"Eyes",      price:1800, rot:true },
  { id:"rx_poop",  emoji:"💩", name:"Poop",       price:3500, rot:true }, { id:"rx_salute",emoji:"🫡", name:"Salute",    price:2800, rot:true },
  { id:"rx_sleep", emoji:"😴", name:"Sleepy",     price:1600, rot:true }, { id:"rx_corn",  emoji:"🍿", name:"Popcorn",   price:4000, rot:true }
);
const BASE_REACTIONS = ["❤️","⚔️","🔥","😭"];
const ALL_COSMETICS = [...GRADIENTS.map(c=>({...c,kind:"gradient"})), ...FONTS.map(c=>({...c,kind:"font"})), ...REACTIONS.map(c=>({...c,kind:"reaction"}))];
const COSMETIC_BY_ID = Object.fromEntries(ALL_COSMETICS.map(c=>[c.id,c]));
const gradientCss = id=> GRADIENTS.find(g=>g.id===id)?.css || "";
const fontFamily  = id=> FONTS.find(f=>f.id===id)?.family || "";
const ownedReactions = owned=> REACTIONS.filter(r=> (owned||[]).includes(r.id)).map(r=>r.emoji);
const allowedReactions = owned=> [...BASE_REACTIONS, ...ownedReactions(owned)];
/* inline style for a chat bubble / profile card carrying this gradient+font id pair */
function cosmeticStyle(gid, fid){
  const g = gradientCss(gid), f = fontFamily(fid);
  return (g ? `background:${g};color:#1d1a16;` : "") + (f ? `font-family:${f};` : "");
}


const firebaseConfig = {
  apiKey: "AIzaSyAGgBTS_rLY1OFdNmEzPkeRx6ipaW-MP_o",
  authDomain: "game1-65ce0.firebaseapp.com",
  projectId: "game1-65ce0",
  storageBucket: "game1-65ce0.firebasestorage.app",
  messagingSenderId: "655445406483",
  appId: "1:655445406483:web:9264de939328cb553b20e6",
  measurementId: "G-YXYBS4VGXJ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
setPersistence(auth, browserSessionPersistence).catch(()=>{});   // session persistence: closing the tab logs you out (a refresh keeps you in)

/* Phones/tablets (Android, iPhone, iPad incl. iPadOS that reports as a Mac) get a compact layout via body.is-mobile. */
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  || navigator.userAgentData?.mobile === true;
if(IS_MOBILE) document.body.classList.add("is-mobile");

/* Firebase Auth needs an email under the hood. Usernames are mapped to a
   synthetic address on the "players.dragoneer.game" domain so players only
   ever see/enter a username + password — this requires Email/Password
   sign-in to be enabled in the Firebase console (see deployment notes). */
const AUTH_DOMAIN = "players.dragoneer.game";
const usernameToEmail = (u) => `${u.toLowerCase()}@${AUTH_DOMAIN}`;

/* =========================================================================
   ERROR HANDLING HELPERS
   Every Firebase call that can plausibly fail (offline, denied by rules,
   race condition, bad input) is routed through one of these so the UI
   never just "goes quiet" — the player always gets a toast.
   ========================================================================= */
/* TEMP DEBUG SWITCH — set to false once auth/signup is confirmed working.
   While true, every Firebase error shown to the player (and logged) is the
   raw {code, message} instead of a friendly string, so nothing is hidden
   during debugging. */
const DEBUG_AUTH_ERRORS = false;

function friendlyFirebaseError(err){
  console.error("FIREBASE ERROR:", err?.code, err?.message, err);
  if(String(err?.message||"").startsWith("insufficient-item:")){
    const itemId = err.message.split(":")[1];
    return `You don't have enough ${ITEM_BY_ID[itemId]?.name || "of that item"} for that.`;
  }
  { const m = String(err?.message||"");
    if(m==="inv-full") return "Your inventory is full — sell something or buy a bigger backpack.";
    if(m==="nomoney") return "Not enough money!";
    if(m==="daily-claimed") return "You already claimed today's daily reward.";
    if(m==="daily-changed") return "Your daily streak changed — reopen the Dailies tab and try again.";
    if(m==="backpack-owned") return "You already own that backpack (or a better one).";
    if(m.startsWith("backpack-order:")) return `You need Backpack Tier ${m.split(":")[1]} first — backpacks must be bought in order.`; }
  const code = err?.code || "";
  if(DEBUG_AUTH_ERRORS){
    return `[DEBUG] ${code || "unknown-code"}: ${err?.message || String(err)}`;
  }
  // Players only ever see plain-English messages; the raw code/message is still
  // logged to the console above for debugging. NOTE: order matters — the generic
  // "not-found" check must stay AFTER every specific code that contains it
  // (user-not-found, configuration-not-found).
  if(code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("user-not-found") || code.includes("invalid-login")) return "Incorrect username or password.";
  if(code.includes("email-already-in-use")) return "That username is already taken.";
  if(code.includes("weak-password")) return "Password is too short — use at least 6 characters.";
  if(code.includes("invalid-email")) return "That username isn't valid. Try a different one.";
  if(code.includes("too-many-requests")) return "Too many attempts. Please wait a few minutes and try again.";
  if(code.includes("user-disabled")) return "This account has been disabled.";
  if(code.includes("requires-recent-login")) return "For your security, please log out, log back in, and try again.";
  if(code.includes("network") || code.includes("unavailable")) return "Connection problem — check your internet and try again.";
  if(code.includes("resource-exhausted") || code.includes("quota")) return "The game is busy right now. Try again in a moment.";
  if(code.includes("permission-denied")) return "You're not allowed to do that.";
  if(code.includes("configuration-not-found") || code.includes("operation-not-allowed")) return "Sign-in is unavailable right now. Please try again later.";
  if(code.includes("not-found")) return "That no longer exists.";
  return "Something went wrong. Please try again.";
}
async function withErrorToast(fn){
  try{ return await fn(); }
  catch(err){ console.error(err); toast(friendlyFirebaseError(err)); return null; }
}

/* =========================================================================
   USERNAME / CHAT FILTER
   NOTE: this project intentionally does NOT ship a hard-coded list of
   slurs/profanity in source — bundling that word list is avoided on
   purpose. What's implemented instead: leetspeak/spacing normalization,
   a small blocklist of common mild profanity as a working example, and a
   clearly marked extension point (BLOCKLIST_EXTRA / moderateChatText)
   where you should plug in a real moderation source before launch — e.g.
   the Firebase "Moderate Text" / Perspective API extension, or an npm list
   like `bad-words`/`obscenity` loaded server-side via a Cloud Function so
   the real list never ships to clients (client-side lists are trivially
   bypassed anyway).
   ========================================================================= */
const BLOCKLIST_EXTRA = []; // <-- load a real moderation list/service here
const BASIC_BLOCKLIST = ["damn","hell","crap","ass","piss"]; // mild example only
function normalizeWord(w){
  return w.toLowerCase()
    .replace(/[0@]/g,'o').replace(/1|!/g,'i').replace(/3/g,'e')
    .replace(/4/g,'a').replace(/5|\$/g,'s').replace(/7/g,'t')
    .replace(/[^a-z]/g,'');
}
// IMPORTANT: this checks whole WORDS, not raw substrings. The previous
// version stripped spaces before matching, so "hello" (contains "hell"),
// "class"/"mass"/"glass" (contain "ass"), "scrap"/"crap" etc. were all
// getting silently mangled into asterisks — which is what made chat feel
// broken. Splitting on word boundaries first and only flagging an exact
// normalized-word match fixes that without weakening the filter itself.
function containsBlockedWord(raw){
  const blocked = new Set([...BASIC_BLOCKLIST, ...BLOCKLIST_EXTRA]);
  const words = String(raw).split(/[^A-Za-z0-9@!$]+/).map(normalizeWord).filter(Boolean);
  return words.some(w => blocked.has(w));
}
function isValidUsername(u){
  if(!/^[A-Za-z0-9_]{3,16}$/.test(u)) return "3-16 letters, numbers, underscore only.";
  if(containsBlockedWord(u)) return "That username isn't allowed.";
  return null;
}
function moderateChatText(t){
  return containsBlockedWord(t) ? "*".repeat(Math.min(t.length,12)) : t;
}

/* =========================================================================
   CORE GAME DATA
   ========================================================================= */
const ELEMENTS = {
  fire:  { name:"Fire",  boon:"rage",  strong:"earth", weak:"water", color:"#FFB199" },
  water: { name:"Water", boon:"mana",  strong:"fire",  weak:"air",   color:"#A8D8F0" },
  earth: { name:"Earth", boon:"xp",    strong:"air",   weak:"fire",  color:"#B7E4A8" },
  air:   { name:"Air",   boon:"hp",    strong:"water", weak:"earth", color:"#E4D6F7" }
};
const ARCHETYPE_DESC = {
  fire:  "More RAGE. Strong against Earth, weak to Water.",
  water: "More MANA. Strong against Fire, weak to Air.",
  earth: "More XP gain. Strong against Air, weak to Fire.",
  air:   "More HP. Strong against Water, weak to Earth."
};
const CLASSES = {
  warrior:{ name:"Warrior", desc:"Stronger, sword fighter, slower.", bonus:{STRENGTH:1} },
  mage:   { name:"Mage",    desc:"Smarter, mana fighter (spells), weaker.", bonus:{SMARTS:1} },
  cleric: { name:"Cleric",  desc:"More charm, mana/weapon mix, less smart.", bonus:{CHARM:1} },
  rogue:  { name:"Rogue",   desc:"Faster, small weapons and ranged, less charm.", bonus:{SPEED:1} }
};
const REGIONS = {
  forest:    { name:"Enchanted Forest", element:"earth", css:"region-forest",    track:"rpg_earth.mp3" },
  mountains: { name:"Frosted Mountains",element:"air",   css:"region-mountains", track:"rpg_air.mp3" },
  volcano:   { name:"Blackrock Volcano",element:"fire",  css:"region-volcano",   track:"rpg_fire.mp3" },
  reef:      { name:"Coral Reef Cove",  element:"water", css:"region-reef",      track:"rpg_water.mp3" }
};
const RARITIES = ["common","uncommon","rare","epic","legendary"];
const HEAL_BY_RARITY = { common:10, uncommon:40, rare:120, epic:300, legendary:500 };
const RARITY_MULT = { common:1, uncommon:1.4, rare:2, epic:3, legendary:4.5 };

/* Numbers simplify at 1,000: 1.34K, 2.5M, 1B ... (max 2 decimals, never rounded up). */
function fmtMoney(n){
  n = Math.floor(Number(n)||0);
  const sign = n<0 ? "-" : "", a = Math.abs(n);
  const units = [[1e15,"Q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
  for(const [val,suf] of units){
    if(a >= val) return sign + (Math.floor(a/val*100)/100).toFixed(2).replace(/\.?0+$/,"") + suf;
  }
  return sign + String(a);
}
/* Parses typed amounts: "500", "1.34k", "2m". Whole numbers only — a decimal is
   only allowed together with a K/M/B/T suffix, and at most 2 decimals (1.34k ok, 1.3482k not). */
function parseAmount(raw){
  const m = String(raw ?? "").trim().toLowerCase().replace(/[,\s$]/g,"").match(/^(\d+(?:\.\d+)?)([kmbtq]?)$/);
  if(!m) return { err:"Enter a whole number, like 500 or 1.34k." };
  const [ , num, suf ] = m, mult = { "":1, k:1e3, m:1e6, b:1e9, t:1e12, q:1e15 }[suf];
  const dec = (num.split(".")[1]||"").length;
  if(!suf && dec) return { err:"Whole numbers only — no decimals (use 1.34k for 1,340)." };
  if(dec > 2) return { err:"Too many decimals — use at most 2, like 1.34k." };
  const value = Math.round(Number(num.replace(".","")) * mult / Math.pow(10, dec));
  if(!Number.isSafeInteger(value) || value < 1) return { err:"That amount isn't valid." };
  return { value };
}
// "7d 0m" style countdown (zero hours are skipped)
function fmtAuctionLeft(ms){
  ms = Math.max(0, ms);
  const d = Math.floor(ms/864e5), h = Math.floor(ms%864e5/36e5), m = Math.floor(ms%36e5/6e4);
  return [d?`${d}d`:"", h?`${h}h`:"", `${m}m`].filter(Boolean).join(" ");
}
function fmtDur(ms){
  let s = Math.max(0, Math.ceil(ms/1000));
  const d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60); s = s%60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

/* ---------- procedural item bank: 5 types x 96 = 480 items ---------- */
const ITEM_TYPES = ["weapon","armor","trinket","consumable","material"];
const PREFIXES = ["Rusty","Sturdy","Ancient","Glowing","Cursed","Blessed","Mystic","Shadow",
  "Radiant","Fragile","Gilded","Frosted","Ember","Coral","Windswept","Stone-etched",
  "Moonlit","Sunburnt","Dew-kissed","Thorned","Feathered","Scaled","Runic","Doodled"];
const BASE_NAMES = {
  weapon:["Sword","Dagger","Staff","Bow","Axe","Mace","Wand","Spear","Claws","Rapier","Fan","Chakram"],
  armor:["Helm","Hood","Coif","Tunic","Plate","Cuirass","Greaves","Leggings","Legwraps","Boots","Treads","Sabatons"],
  trinket:["Charm","Ring","Amulet","Locket","Bell","Feather","Bead","Totem","Pendant","Coin","Idol","Sigil"],
  consumable:["Potion","Elixir","Berry","Bread","Stew","Tonic","Draught","Cookie","Tea","Scroll","Candy","Brew"],
  material:["Scale","Claw","Fang","Ore","Crystal","Fiber","Resin","Dust","Shard","Feather","Root","Ember"]
};
// Armor now splits into 4 equip slots (helmet/chestplate/leggings/boots)
// instead of one generic "armor" slot — each base name below maps to
// exactly one of the 4, 3 names apiece, so the existing 12-name/96-item
// generation loop still produces an even spread across all four.
const ARMOR_SLOT_BY_NAME = {
  Helm:"helmet", Hood:"helmet", Coif:"helmet",
  Tunic:"chestplate", Plate:"chestplate", Cuirass:"chestplate",
  Greaves:"leggings", Leggings:"leggings", Legwraps:"leggings",
  Boots:"boots", Treads:"boots", Sabatons:"boots"
};
const ARMOR_SLOTS = ["helmet","chestplate","leggings","boots"];
/* There is no "defense" stat in this game. Armor instead changes your real
   stats (and max HP) for as long as it is worn. Each slot has a profile;
   heavier pieces trade some speed/charm for their bonuses. */
const ARMOR_PROFILE = {
  helmet:     { hp:3, SMARTS:1 },
  chestplate: { hp:6, STRENGTH:1, SPEED:-1 },
  leggings:   { hp:4, SPEED:1 },
  boots:      { hp:3, SPEED:1, CHARM:-1 }
};
function armorStats(slot, m, extra=0){
  const prof = ARMOR_PROFILE[slot] || ARMOR_PROFILE.chestplate, out = {};
  Object.entries(prof).forEach(([k,v])=>{
    if(k==="hp") out.hp = Math.round(v*m) + extra*2;
    else if(v>0) out[k] = Math.max(1, Math.round(v*m)) + extra;
    else out[k] = -Math.max(1, Math.round(-v*m*0.5));
  });
  return out;
}
function seededRand(seed){ let s = seed % 2147483647; if(s<=0)s+=2147483646;
  return () => (s = s*16807 % 2147483647) / 2147483647; }

function buildItemBank(){
  const bank = [];
  let id = 0;
  for(const type of ITEM_TYPES){
    const rnd = seededRand(1000 + ITEM_TYPES.indexOf(type));
    for(let i=0;i<96;i++){
      const prefix = PREFIXES[i % PREFIXES.length];
      // (prefix, base) pair is unique for all 96 items of a type: the base name is
      // shifted by 3 for every full cycle of the 24 prefixes.
      const nb = BASE_NAMES[type].length;
      const base = BASE_NAMES[type][(i % nb + 3*Math.floor(i/PREFIXES.length)) % nb];
      const rarity = RARITIES[Math.min(4, Math.floor(rnd()*rnd()*5))];
      const elementKeys = Object.keys(ELEMENTS);
      const element = elementKeys[i % 4];
      const mult = RARITY_MULT[rarity];
      const basePrice = Math.round((8 + rnd()*40) * mult * (type==="weapon"||type==="armor"?2.2:1));
      const item = {
        id: `itm_${type}_${id++}`,
        name: `${prefix} ${base}`,
        type, rarity, element,
        price: basePrice,
        sellPrice: Math.max(1, Math.round(basePrice*0.35)),
        desc: itemFlavor(type, prefix, base, element, rarity),
        stats: itemStats(type, rarity)
      };
      if(type==="armor"){
        item.armorSlot = ARMOR_SLOT_BY_NAME[base] || "chestplate";
        item.stats = armorStats(item.armorSlot, mult);
      }
      bank.push(item);
    }
  }
  return bank;
}
function itemFlavor(type, prefix, base, element, rarity){
  const flavors = {
    weapon:`A ${rarity} ${base.toLowerCase()}, ${prefix.toLowerCase()} and humming faintly with ${ELEMENTS[element].name.toLowerCase()} energy.`,
    armor:`${prefix} ${base.toLowerCase()} that smells faintly of ${ELEMENTS[element].name.toLowerCase()} weather. Wearing it shifts your stats (${rarity}).`,
    trinket:`A small ${base.toLowerCase()}, ${prefix.toLowerCase()}, said to nudge fate for its wearer.`,
    consumable:`A ${prefix.toLowerCase()} ${base.toLowerCase()} — drink or eat to feel its ${rarity} effects.`,
    material:`Raw crafting material: a ${prefix.toLowerCase()} ${base.toLowerCase()}, useful at the forge.`
  };
  return flavors[type];
}
function itemStats(type, rarity){
  const m = RARITY_MULT[rarity];
  if(type==="weapon") return { attack: Math.round(3*m) };
  if(type==="armor") return {}; // filled in per-slot by armorStats() in buildItemBank
  if(type==="trinket"){
    const pool = ["SPEED","STRENGTH","CHARM","SMARTS"];
    const stat = pool[Math.floor(Math.random()*pool.length)];
    return { [stat]: Math.round(1*m), curse: Math.random()<0.15 };
  }
  if(type==="consumable") return { heal: HEAL_BY_RARITY[rarity], mana: Math.round(5*m) };
  return {}; // material: no combat stats, used in crafting
}
const ITEM_BANK = buildItemBank();
ITEM_BANK.filter(i=>i.type==="consumable").forEach(i=>{ i.price=Math.max(2,Math.round(i.price*0.3)); i.sellPrice=Math.max(1,Math.round(i.price*0.4)); });
const ITEM_BY_ID = Object.fromEntries(ITEM_BANK.map(i=>[i.id,i]));

/* ---------- job items: fish, ores/gems, and the tools jobs need ---------- */
const JOB_ITEM_BANK = [
  { id:"tool_pickaxe", name:"Pickaxe", type:"tool", rarity:"common", price:60, sellPrice:20, desc:"Needed to mine rocks.", stats:{} },
  { id:"tool_fishingrod", name:"Fishing Rod", type:"tool", rarity:"common", price:60, sellPrice:20, desc:"Needed to fish.", stats:{} },
  { id:"fish_minnow", name:"Minnow", type:"consumable", rarity:"common", sellPrice:4, desc:"A tiny fish.", stats:{} },
  { id:"fish_bass", name:"Bass", type:"consumable", rarity:"uncommon", sellPrice:10, desc:"A decent catch.", stats:{} },
  { id:"fish_trout", name:"Trout", type:"consumable", rarity:"uncommon", sellPrice:14, desc:"A tasty trout.", stats:{} },
  { id:"fish_swordfish", name:"Swordfish", type:"consumable", rarity:"rare", sellPrice:35, desc:"A prized catch.", stats:{} },
  { id:"fish_golden", name:"Golden Koi", type:"consumable", rarity:"legendary", sellPrice:120, desc:"Extremely rare.", stats:{} },
  { id:"ore_copper", name:"Copper Ore", type:"material", rarity:"common", sellPrice:5, desc:"Common ore.", stats:{} },
  { id:"ore_iron", name:"Iron Ore", type:"material", rarity:"uncommon", sellPrice:12, desc:"Sturdy ore.", stats:{} },
  { id:"gem_quartz", name:"Quartz Shard", type:"material", rarity:"rare", sellPrice:30, desc:"A clear gem.", stats:{} },
  { id:"gem_ruby", name:"Ruby", type:"material", rarity:"epic", sellPrice:80, desc:"A brilliant red gem.", stats:{} },
  { id:"forage_berry", name:"Wild Berries", type:"consumable", rarity:"common", sellPrice:3, desc:"Foraged berries.", stats:{heal:4} },
  { id:"forage_herb", name:"Healing Herb", type:"material", rarity:"uncommon", sellPrice:9, desc:"A useful herb.", stats:{} },
  { id:"forage_mushroom", name:"Wild Mushroom", type:"material", rarity:"common", sellPrice:5, desc:"Foraged mushroom.", stats:{} }
];
// Durability tiers: basic 3 -> 10 -> 25 -> 50 -> 100 (best). Tiers 5 and 6 both top out at 100.
/* Pickaxe / fishing-rod ladder, worst -> best. Roughly $16 per use at every step, so a pricier tool is a fair deal, not a trap. */
const TOOL_LADDER = [   // [id suffix, name, uses, shop price, rarity, material ingot]
  ["",   "Wooden",    3,   60,   "common",    "ing_copper"],
  ["_cu","Copper",    6,   105,  "common",    "ing_copper"],
  ["2",  "Sturdy",    10,  150,  "uncommon",  "ing_iron"],
  ["_br","Bronze",    16,  245,  "uncommon",  "ing_bronze"],
  ["3",  "Iron",      25,  400,  "rare",      "ing_steel"],
  ["_st","Steel",     36,  580,  "rare",      "ing_steel"],
  ["4",  "Gold",      50,  820,  "rare",      "ing_gold"],
  ["_pt","Platinum",  72,  1150, "epic",      "ing_platinum"],
  ["_ti","Titanium",  95,  1550, "epic",      "ing_titanium"],
  ["5",  "Emerald",   125, 2050, "epic",      "gem_emerald_cut"],
  ["_my","Mythril",   165, 2700, "epic",      "ing_mithril"],
  ["6",  "Diamond",   220, 3600, "legendary", "gem_diamond_cut"],
  ["_ad","Adamantite",300, 4900, "legendary", "ing_adamantite"]
];
const jobToolId = (kind, suffix)=> "tool_"+kind+suffix;
const TOOL_USES = { tool_pickaxe:3, tool_fishingrod:3, tool_pickaxe2:10, tool_fishingrod2:10, tool_pickaxe3:25, tool_fishingrod3:25 };
[["tool_pickaxe2","Sturdy Pickaxe",150,"uncommon",10],["tool_pickaxe3","Iron Pickaxe",400,"rare",25],
 ["tool_fishingrod2","Sturdy Fishing Rod",150,"uncommon",10],["tool_fishingrod3","Iron Fishing Rod",400,"rare",25]]
 .forEach(([id,name,price,rarity,uses])=> JOB_ITEM_BANK.push({ id,name,type:"tool",rarity,price,sellPrice:Math.round(price/3),desc:`Breaks after ${uses} uses.`,stats:{} }));
JOB_ITEM_BANK.push(
 { id:"ore_coal", name:"Coal", type:"material", rarity:"common", sellPrice:4, desc:"Fuel for cooking and smelting.", stats:{} },
 { id:"ore_silver", name:"Silver Ore", type:"material", rarity:"uncommon", sellPrice:18, desc:"A gleaming ore.", stats:{} },
 { id:"ore_gold", name:"Gold Ore", type:"material", rarity:"rare", sellPrice:40, desc:"Heavy, shiny ore.", stats:{} },
 { id:"gem_sapphire", name:"Sapphire", type:"material", rarity:"rare", sellPrice:55, desc:"A deep blue gem.", stats:{} },
 { id:"gem_emerald", name:"Emerald", type:"material", rarity:"epic", sellPrice:110, desc:"A vivid green gem.", stats:{} },
 { id:"gem_diamond", name:"Diamond", type:"material", rarity:"legendary", sellPrice:250, desc:"The hardest gem of all.", stats:{} },
 { id:"forage_apple", name:"Wild Apple", type:"consumable", rarity:"uncommon", sellPrice:8, desc:"A crisp foraged apple.", stats:{} },
 { id:"forage_truffle", name:"Forest Truffle", type:"consumable", rarity:"rare", sellPrice:25, desc:"A prized foraged truffle.", stats:{} },
 { id:"forage_goldapple", name:"Golden Apple", type:"consumable", rarity:"legendary", sellPrice:100, desc:"Glows faintly. Restores a ton.", stats:{} });
JOB_ITEM_BANK.filter(i=>i.id==="tool_pickaxe"||i.id==="tool_fishingrod").forEach(i=> i.desc+=" Breaks after 3 uses.");
JOB_ITEM_BANK.filter(i=>i.type==="consumable").forEach(i=> i.stats.heal = Math.round(HEAL_BY_RARITY[i.rarity]*(i.id.startsWith("fish_")?0.6:1)));
JOB_ITEM_BANK.forEach(i=> ITEM_BY_ID[i.id]=i);
// Content expansion: 50 forageables, 30 minerals, 90 fish (see rpg_content.js)
const CATALOG = registerItems(ITEM_BY_ID);

/* ---------- farming + backpack items ---------- */
// Hoes till 1 tile per use, watering cans water 1 tile per use. 5 durability tiers each.
const FARM_TOOL_TIERS = [["Wooden",10,60,"common"],["Sturdy",30,160,"uncommon"],["Iron",80,420,"rare"],["Gold",200,1100,"epic"],["Diamond",500,2800,"legendary"]];
const FARM_TOOLS = [];
[["hoe","Hoe","Tills 1 tile per use."],["can","Watering Can","Waters 1 tile per use."]].forEach(([k,nm,d])=> FARM_TOOL_TIERS.forEach(([pre,uses,price,rar],i)=>{
  const id = i===0 ? `tool_${k}` : `tool_${k}${i+1}`;
  TOOL_USES[id] = uses;
  const it = { id, name:`${pre} ${nm}`, type:"tool", rarity:rar, price, sellPrice:Math.round(price/3), desc:`${d} Breaks after ${uses} uses.`, stats:{} };
  ITEM_BY_ID[id] = it; FARM_TOOLS.push(it);
}));
const GROW_HOURS = { common:[16,24], uncommon:[20,30], rare:[24,36], epic:[36,50], legendary:[50,100] };
const DECAY_HOURS = { common:16, uncommon:12, rare:8, epic:4, legendary:2 };
const CROP_YIELDS = { common:[5,10], uncommon:[6,11], rare:[8,14], epic:[9,17], legendary:[10,20] };
// Mystery seeds: [chance of a real crop of the seed's rarity, chance of a plain common crop]; the rest grows nothing.
const MYSTERY_ODDS = { common:[.15,.45], uncommon:[.25,.45], rare:[.35,.42], epic:[.45,.40], legendary:[.60,.32] };
const CROP_SELL = { common:14, uncommon:38, rare:95, epic:230, legendary:520 };
const SEED_PRICE = { common:40, uncommon:110, rare:300, epic:800, legendary:2200 };
const CROP_DEFS = {
  common:[["carrot","Carrot","🥕"],["potato","Potato","🥔"],["cabbage","Cabbage","🥬"],["radish","Radish","🌱"],["turnip","Turnip","🍠"]],
  uncommon:[["tomato","Tomato","🍅"],["corn","Corn","🌽"],["onion","Onion","🧅"],["pumpkin","Pumpkin","🎃"],["eggplant","Eggplant","🍆"]],
  rare:[["strawberry","Strawberry","🍓"],["pineapple","Pineapple","🍍"],["watermelon","Watermelon","🍉"],["grape","Grape","🍇"],["chili","Chili Pepper","🌶️"]],
  epic:[["dragonfruit","Dragonfruit","🐲"],["starfruit","Starfruit","⭐"],["moonmelon","Moonmelon","🌙"],["frostberry","Frostberry","❄️"],["emberpepper","Emberpepper","🔥"]],
  legendary:[["sunpetal","Sunpetal Bloom","🌻"],["phoenixfruit","Phoenix Fruit","🪶"],["worldroot","Worldroot","🌳"],["starorchid","Starlight Orchid","🌸"],["voidberry","Voidberry","🫐"]]
};
const CROP_ITEMS = [], SEED_ITEMS = [], CROPS_BY_RARITY = {};
RARITIES.forEach(rar=>{
  CROPS_BY_RARITY[rar] = [];
  CROP_DEFS[rar].forEach(([slug,name,emoji],i)=>{
    const crop = { id:`crop_${slug}`, name, type:"material", rarity:rar, price:0, emoji,
      sellPrice: Math.round(CROP_SELL[rar]*(0.9+i*0.05)), stats:{},
      desc:`A freshly harvested ${name.toLowerCase()}. Sell it, or craft 3 into a preserve worth far more.` };
    const [g1,g2] = GROW_HOURS[rar], [y1,y2] = CROP_YIELDS[rar];
    const seed = { id:`seed_${slug}`, name:`${name} Seeds`, type:"seed", rarity:rar, price:SEED_PRICE[rar], sellPrice:Math.round(SEED_PRICE[rar]*0.3),
      cropId:crop.id, farmRarity:rar, emoji:"🌱", stats:{},
      desc:`Grows in ${g1}–${g2}h and yields ${y1}–${y2} ${name}. Waters dry out; a thirsty plant dies ${DECAY_HOURS[rar]}h after drying out.` };
    ITEM_BY_ID[crop.id] = crop; ITEM_BY_ID[seed.id] = seed;
    CROP_ITEMS.push(crop); SEED_ITEMS.push(seed); CROPS_BY_RARITY[rar].push(crop.id);
  });
  const cap = rar[0].toUpperCase()+rar.slice(1), [y1,y2] = CROP_YIELDS[rar];
  const mystery = { id:`seed_random_${rar}`, name:`Mystery Seeds (${cap})`, type:"seed", rarity:rar, price:Math.round(SEED_PRICE[rar]*0.8),
    sellPrice:Math.round(SEED_PRICE[rar]*0.25), cropId:null, farmRarity:rar, random:true, emoji:"❓", stats:{},
    desc:`Who knows what grows? Takes 16–100h. Could be a real ${rar} crop (${y1}–${y2} yields), a plain common crop… or nothing at all. You won't know until harvest.` };
  ITEM_BY_ID[mystery.id] = mystery; SEED_ITEMS.push(mystery);
});
// Backpacks are permanent upgrades bought in order (Tier 1, then 2, ...). They never enter your inventory.
const BACKPACK_SLOTS = [12,24,48,72,108,180];
const BACKPACK_PRICE = [0,800,3000,10000,30000,100000];
const BACKPACK_ITEMS = [1,2,3,4,5].map(t=>{
  const it = { id:`backpack_${t}`, name:`Backpack Tier ${t}`, type:"backpack", tier:t, rarity:RARITIES[t-1], price:BACKPACK_PRICE[t], sellPrice:0,
    desc:`Permanent upgrade: ${BACKPACK_SLOTS[t-1]} → ${BACKPACK_SLOTS[t]} inventory slots. Must be bought in order (you need Tier ${t-1>0?t-1:"0 (none)"} first).`, stats:{} };
  ITEM_BY_ID[it.id] = it; return it;
});
/* Rebirth: rare shop item. Using it refunds every skill-tree point (see resetSkillTree). */
ITEM_BY_ID.rebirth_scroll = { id:"rebirth_scroll", name:"Rebirth", type:"rebirth", rarity:"legendary", price:5000, sellPrice:0,
  desc:"A swirl of ash and light. Use it to refund ALL your skill tree points and reset the tree back to the top.", stats:{} };
const invCap = p=> BACKPACK_SLOTS[Math.min(5, Math.max(0, (p&&p.backpackTier)||0))];
const invUsed = inv=> (inv||[]).filter(e=>e.qty>0).length;
const AUCTION_MS = 7*24*60*60*1000;   // auction listings last 7 days

/* ---------- procedural enemy bank: 4 regions x 3 difficulties x 10 = 120 ---------- */
const ENEMY_NAME_PARTS = {
  forest:["Bramblefang","Mosshide","Thornback","Glade Sprite","Root Walker","Acorn Golem","Fern Wisp","Vine Serpent","Bark Beetle","Sap Slime"],
  mountains:["Frost Yeti","Gale Hawk","Ice Wraith","Snow Wolf","Cloud Ram","Rime Bat","Windshard","Glacier Troll","Peak Harpy","Chill Sprite"],
  volcano:["Ember Imp","Ash Drake","Magma Crab","Cinder Wolf","Lava Golem","Flare Bat","Coal Fiend","Soot Hound","Sulfur Wisp","Brimstone Ogre"],
  reef:["Coral Crab","Tide Serpent","Bubble Jelly","Pearl Turtle","Riptide Shark","Kelp Wisp","Foam Sprite","Shell Guardian","Abyssal Eel","Barnacle Brute"]
};
/* Difficulty was shifted up one tier: "easy" is now what "medium" used to be,
   "medium" is what "hard" used to be, and "hard" is tougher still. The labels
   shown to the player are unchanged. Rewards: easy pays less, hard pays more,
   and every tier gets a small bonus per monster level (see makeMonsterFromSlot). */
const DIFF = {
  easy:{ mult:1.0, xp:[3,6], money:[1,15] },
  medium:{ mult:1.3, xp:[9,15], money:[5,40] },
  hard:{ mult:1.6, xp:[18,34], money:[10,75] }
};
const REWARD_PER_LEVEL = 0.04;   // +4% xp/money per monster level above 1
/* Monster level is generated RELATIVE to the player's CURRENT level at the
   moment the monster spawns, per design:
     easy:   playerLevel +/- 3, randomly            (old "medium")
     medium: playerLevel + (1 to 3)                 (old "hard")
     hard:   playerLevel + (3 to 5)                 (new, tougher)
   buildEnemyBank() only enumerates the 10 name slots per region for
   variety; level/stats are computed fresh in makeMonsterFromSlot() using
   whatever the player's level is right now. */
function rollMonsterLevel(diff, playerLevel, rnd=Math.random){
  playerLevel = Math.max(1, playerLevel||1);
  if(diff==="hard"){
    const over = 3 + Math.floor(rnd()*3); // 3-5 levels over
    return playerLevel + over;
  }
  if(diff==="medium"){
    const over = 1 + Math.floor(rnd()*3); // 1-3 levels over
    return playerLevel + over;
  }
  const delta = Math.floor(rnd()*7) - 3; // easy: -3..+3, randomly
  return Math.max(1, playerLevel + delta);
}
function buildEnemyBank(){
  const bank = [];
  let id=0;
  for(const region of Object.keys(REGIONS)){
    for(const diff of Object.keys(DIFF)){
      const names = ENEMY_NAME_PARTS[region];
      for(let i=0;i<10;i++){
        bank.push({ id:`enm_${id++}`, name:names[i], region, difficulty:diff });
      }
    }
  }
  return bank;
}
const ENEMY_BANK = buildEnemyBank();
// Builds a full monster from a name/region/diff slot at a level computed
// relative to the player's level right now.
function makeMonsterFromSlot(slot, playerLevel, rnd=Math.random){
  const d = DIFF[slot.difficulty];
  const lvl = rollMonsterLevel(slot.difficulty, playerLevel, rnd);
  return {
    id: slot.id, name: slot.name, region: slot.region, difficulty: slot.difficulty,
    level: lvl, element: REGIONS[slot.region].element,
    hp: Math.round((20 + lvl*8) * d.mult),
    attack: Math.round((3 + lvl*1.5) * d.mult),
    xpReward: Math.max(1, Math.round((d.xp[0] + rnd()*(d.xp[1]-d.xp[0])) * (1 + REWARD_PER_LEVEL*(lvl-1)))),
    moneyReward: d.money[0] + Math.floor(rnd()*(d.money[1]-d.money[0]+1)),   // exactly the tier range (easy $1-15, medium $5-40, hard $10-75)
    dropChance: slot.difficulty==="easy"?0.25:slot.difficulty==="medium"?0.45:0.7
  };
}

/* =========================================================================
   DRAGON DOODLE (2-frame hand-drawn animation)
   Redrawn as one cohesive curled-up dragon (snout, horns, folded wings,
   a spiral tail, closed sleepy eyes, tucked paw) instead of loose floating
   shapes, while keeping the flat pastel hand-drawn look and the 2-frame
   swap-every-second "gif" breathing effect.
   ========================================================================= */
function dragonFrame(breathe){
  /* Perched red dragon (after the reference painting): spread bat wings, plated cream belly, spiked tail,
     standing on a rock. Two frames swapped every second give the breathing / wing-shift "gif". */
  const lift = breathe ? -2 : 0, wing = breathe ? -2.5 : 0, chest = breathe ? 1.04 : 1;
  const INK = "#4A3F35", RED = "#D9534F", RED_D = "#A83A3A", RED_L = "#E9766F", BONE = "#8E2F2F", CREAM = "#F3E2BD", MEM = "#EC8F86", MEM_D = "#C96A66", ROCK = "#D8C49A", ROCK_D = "#B9A173";
  const sc = (x,y)=> `<path d="M${x},${y} q4,5 8,0" stroke="${RED_D}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  return `
  <!-- rock -->
  <path d="M60,236 C50,210 78,192 118,190 C170,184 232,188 266,198 C292,208 300,226 292,236 Z" fill="${ROCK}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
  <path d="M96,206 q14,-8 30,-3 M176,200 q20,-5 38,2 M120,222 q18,-6 34,0 M228,214 q14,-4 26,3" stroke="${ROCK_D}" stroke-width="3" fill="none" stroke-linecap="round"/>

  <!-- tail with spikes -->
  <path d="M248,140 C284,142 320,136 330,112 C333,104 331,97 326,92 C331,108 323,128 302,138 C284,148 266,158 248,164 Z" fill="${RED}" stroke="${INK}" stroke-width="3.5" filter="url(#doodleWobble)"/>
  <path d="M276,142 l-2,-9 l8,6 M292,136 l0,-10 l8,7 M306,128 l2,-10 l7,8 M318,114 l4,-9 l5,9 M326,100 l6,-6 l0,9" stroke="${INK}" stroke-width="2.5" fill="${RED_D}" stroke-linejoin="round"/>

  <g transform="translate(0,${lift})">
    <!-- far wing (behind) -->
    <g transform="rotate(${wing/2} 150 112)">
      <path d="M150,112 L84,40 L88,26 L116,56 L116,32 L140,68 L146,48 L170,100 Z" fill="${MEM_D}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" filter="url(#doodleWobble)"/>
      <path d="M150,112 L86,34" stroke="${BONE}" stroke-width="4" stroke-linecap="round"/>
    </g>

    <!-- far legs -->
    <path d="M166,168 L180,168 L184,204 L168,206 Z" fill="${RED_D}" stroke="${INK}" stroke-width="3"/>
    <path d="M206,166 L220,166 L226,204 L210,206 Z" fill="${RED_D}" stroke="${INK}" stroke-width="3"/>

    <!-- body -->
    <g transform="translate(190 150) scale(${chest} 1) translate(-190 -150)">
      <path d="M120,134 C140,110 192,104 240,118 C266,126 272,152 252,168 C230,184 158,186 128,174 C110,166 110,148 120,134 Z" fill="${RED}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
      <path d="M128,172 C166,186 234,184 252,166 C240,178 170,174 134,160 Z" fill="${CREAM}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M150,174 l0,8 M166,177 l0,8 M182,178 l0,8 M198,178 l0,8 M214,176 l0,8 M230,172 l0,8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      ${sc(146,132)}${sc(166,124)}${sc(188,122)}${sc(210,124)}${sc(232,130)}${sc(158,146)}${sc(184,140)}${sc(210,142)}${sc(236,148)}
      <path d="M150,110 l4,-9 l5,10 M174,106 l4,-10 l5,11 M198,106 l4,-10 l5,11 M222,111 l4,-9 l5,10" stroke="${INK}" stroke-width="2.5" fill="${RED_D}" stroke-linejoin="round"/>
    </g>

    <!-- neck -->
    <path d="M108,146 C84,124 82,94 96,74 L132,72 C128,98 142,116 164,126 Z" fill="${RED}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
    <path d="M98,78 C86,98 90,124 112,146 C100,122 98,100 108,80 Z" fill="${CREAM}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M92,98 l9,0 M93,108 l9,0 M97,118 l9,0 M103,128 l9,0 M110,138 l8,0" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    ${sc(112,92)}${sc(118,106)}${sc(126,120)}
    <path d="M132,74 l10,-6 l-2,10 M135,88 l11,-4 l-4,10 M142,102 l11,-2 l-5,9" stroke="${INK}" stroke-width="2.5" fill="${RED_D}" stroke-linejoin="round"/>

    <!-- head -->
    <path d="M134,62 C120,50 98,50 84,58 L62,68 C58,73 60,80 67,82 L90,86 C112,92 130,84 136,72 Z" fill="${RED}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
    <path d="M122,52 L150,30 L134,62 Z M110,50 L130,24 L122,56 Z" fill="${RED_D}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M138,66 l12,-2 l-9,10 M134,76 l11,2 l-10,6" stroke="${INK}" stroke-width="2.5" fill="${RED_D}" stroke-linejoin="round"/>
    <path d="M72,82 l3,7 l4,-6 M84,85 l3,7 l4,-6" stroke="${INK}" stroke-width="2" fill="#FFF8E8" stroke-linejoin="round"/>
    <ellipse cx="108" cy="64" rx="7" ry="4.5" fill="#F7C948" stroke="${INK}" stroke-width="2.5" transform="rotate(-12 108 64)"/>
    <path d="M108,60 L108,68" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M98,56 q10,-6 22,-1" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="68" cy="72" r="2.4" fill="${INK}"/>
    ${breathe ? `<circle cx="56" cy="70" r="4.5" fill="#FFFFFF" opacity="0.75"/><circle cx="46" cy="63" r="3" fill="#FFFFFF" opacity="0.55"/><circle cx="38" cy="58" r="2" fill="#FFFFFF" opacity="0.4"/>` : ``}

    <!-- near wing (big, raised) -->
    <g transform="rotate(${wing} 172 114)">
      <path d="M172,114 L262,22 C300,34 332,60 346,94 C324,86 312,98 306,110 C290,98 272,102 264,114 C242,102 212,106 190,122 Z" fill="${MEM}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" filter="url(#doodleWobble)"/>
      <path d="M190,122 C212,106 242,102 264,114 C240,92 212,96 188,110 Z" fill="${CREAM}" opacity="0.85"/>
      <path d="M172,114 L262,22 M262,22 L306,110 M262,22 L264,114 M262,22 L346,94" stroke="${BONE}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M262,22 q-6,-8 -14,-4 q4,6 10,6" stroke="${INK}" stroke-width="3" fill="${BONE}" stroke-linejoin="round"/>
    </g>
  </g>

  <!-- near legs -->
  <path d="M140,162 C130,182 126,196 118,206 L142,212 C146,198 158,184 168,170 Z" fill="${RED}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
  <path d="M118,206 l-6,8 M126,208 l-3,9 M135,210 l-1,9 M142,212 l2,8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M222,162 C234,178 240,196 232,208 L256,210 C258,194 254,176 248,162 Z" fill="${RED}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>
  <path d="M232,208 l-4,9 M241,209 l-1,10 M251,210 l3,8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  ${breathe ? "" : ""}
  `;
}
function setupDragonAnim(){
  let frame = false;
  const svgs = () => document.querySelectorAll(".dragon-doodle");
  const render = () => svgs().forEach(s => s.innerHTML = dragonFrame(frame));
  render();
  setInterval(()=>{ frame = !frame; render(); }, 1000);
}

/* =========================================================================
   AUDIO
   ========================================================================= */
const musicEl = () => document.getElementById("music-player");
function playSfx(name){
  if(state.settings.muteSfx) return;
  const el = document.getElementById(`sfx-${name}`); if(!el) return;   // files are named rpg_<name>.mp3 (see index.html)
  // a fresh Audio per play, so repeated sounds overlap instead of restarting
  const a = new Audio(el.currentSrc || el.src); a.volume = el.volume;
  a.addEventListener("ended", ()=> a.remove?.()); a.play().catch(()=>{});
}
let wantedTrack = null;
function playMusic(src){
  const el = musicEl(); if(!el) return;
  wantedTrack = src; src = trackFor(src);                       // 8pm-8am: swap in the *_night.mp3 version
  if(state.settings.muteMusic){ el.pause(); return; }
  if(el.getAttribute('data-track') === src) return;
  el.style.transition="opacity 1s";
  el.volume = 0.5;
  el.setAttribute('data-track', src);
  el.src = src;
  el.play().catch(()=>{});
}

/* =========================================================================
   TOASTS
   ========================================================================= */
function toast(msg, ms=3500, cls="", onClick=null){
  const stack = document.getElementById("toast-stack");
  const t = document.createElement("div");
  t.className="toast"+(cls?" "+cls:"")+(onClick?" toast-click":""); t.textContent=msg;
  if(onClick){ t.title="Click to open"; t.addEventListener("click", ()=>{ t.remove(); onClick(); }); }
  stack.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}

/* =========================================================================
   SCREEN NAV
   ========================================================================= */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function openModal(id){ document.getElementById(id).classList.add("active"); }
function closeModal(id){ document.getElementById(id).classList.remove("active"); }
document.querySelectorAll("[data-close-modal]").forEach(b=>{
  b.addEventListener("click", ()=> b.closest(".modal-backdrop").classList.remove("active"));
});

/* =========================================================================
   GLOBAL STATE
   ========================================================================= */
const state = {
  uid:null, username:null,
  profile:null,           // mirrors Firestore player doc
  settings:{ muteMusic:false, muteSfx:false, theme:(localStorage.getItem("dragoneer_theme")||"dynamic") },
  selArchetype:null, selClass:null,
  invPage:0,
  currentChatPartner:null,
  pmContactsExtra:{},     // uid -> username for people you've PM'd who aren't (yet) friends
  craftA:null, craftB:null,
  selectedInvItem:null,
  battle:null,
  unsubs:[]
};

/* Player doc must be creatable with NO archetype/class yet (signup happens
   before archetype/class selection), so every lookup below is guarded. */
/* Max Rage is set by level: 8 at level 1, +1 every 3 levels (Lv3=9, Lv6=10,
   Lv9=11, Lv12=12 ...). The Fire archetype's Rage boon is kept as a flat +4. */
function rageMaxFor(level, archetype, smarts=0){
  const boon = (archetype && ELEMENTS[archetype]) ? ELEMENTS[archetype].boon : null;
  const base = 8 + Math.floor(Math.max(1, level||1)/3) + (boon==="rage" ? 4 : 0);
  return Math.max(2, base - Math.floor(Math.max(0, smarts||0)/3));   // every 3 points of SMARTS = -1 max Rage (rounded down, never below 2)
}
function defaultPlayerDoc(username, archetype, klass){
  const bonus = (klass && CLASSES[klass]) ? CLASSES[klass].bonus : {};
  const stats = { SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0, ...bonus };
  const boon = (archetype && ELEMENTS[archetype]) ? ELEMENTS[archetype].boon : null;
  const bars = { hp:100, hpMax:100, mana:20, manaMax:20, rage:rageMaxFor(1,archetype,stats.SMARTS), rageMax:rageMaxFor(1,archetype,stats.SMARTS), xp:0, xpMax:10 };
  if(boon==="hp"){ bars.hp=120; bars.hpMax=120; }
  if(boon==="mana"){ bars.mana=26; bars.manaMax=26; }
  return {
    username, archetype: archetype||null, klass: klass||null, level:1, money:0, backpackTier:0,
    stats, ...bars,
    region:"forest",
    inventory: [{ itemId:"tool_pickaxe2", qty:1 }, { itemId:"tool_fishingrod2", qty:1 }], // {itemId, qty} — new players start with a Sturdy Pickaxe + Sturdy Fishing Rod and $0
    equipped: { weapon:null, helmet:null, chestplate:null, leggings:null, boots:null, trinket:null },
    kills:0, deaths:0, killstreak:0, monstersKilled:0,
    friends: [], sentFriendRequests: [], privateSocial: false, privateProfile: false, skillTreeVer: SKILL_TREE_VERSION, createdAt: Date.now(),
    lastHpRegenTs: Date.now(), // used to catch up 10hp/hour regen even while the game was closed
    lastForageTs: 0, mineHourStart: 0, minePicksThisHour: 0, fishingXp: 0, miningXp: 0, foragingXp: 0
  };
}
const HP_REGEN_PER_HOUR = 1; // now per MINUTE
const HP_REGEN_MS = 60*1000;
/* Catches up HP regen for however long the player was away (or since the
   last catch-up), at 10 HP per full hour elapsed, capped at hpMax. Safe to
   call often — it's a no-op unless at least one full hour has passed. Also
   used for the live in-session ticking (called every minute while the tab
   is open) so regen keeps happening even if the player never reloads. */
async function catchUpHpRegen(p){
  if(!p || p.hp >= p.hpMax) {
    // still bump the timestamp forward so a full-HP player doesn't bank
    // hours of regen for later
    if(p && p.lastHpRegenTs && Date.now()-p.lastHpRegenTs >= HP_REGEN_MS){
      await updateDoc(doc(db,"players",state.uid), { lastHpRegenTs: Date.now() }).catch(()=>{});
    }
    return;
  }
  const last = p.lastHpRegenTs || p.createdAt || Date.now();
  const elapsedHours = Math.floor((Date.now()-last)/HP_REGEN_MS);
  if(elapsedHours <= 0) return;
  const newHp = Math.min(p.hpMax, p.hp + elapsedHours*HP_REGEN_PER_HOUR);
  const newTs = last + elapsedHours*HP_REGEN_MS; // carry remainder forward, don't discard partial progress
  await updateDoc(doc(db,"players",state.uid), { hp:newHp, lastHpRegenTs:newTs }).catch(()=>{});
}
/* Applies the chosen archetype/class to an EXISTING player doc without
   wiping fields the player may already have (money/inventory/etc.), unlike
   re-running defaultPlayerDoc() over the top of it. */
function archetypeClassUpdates(archetype, klass){
  const bonus = CLASSES[klass].bonus;
  const stats = { SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0, ...bonus };
  const boon = ELEMENTS[archetype].boon;
  const updates = { archetype, klass, stats };
  if(boon==="hp"){ updates.hp=120; updates.hpMax=120; }
  if(boon==="mana"){ updates.mana=26; updates.manaMax=26; }
  updates.rageMax = rageMaxFor(1, archetype, stats.SMARTS); updates.rage = updates.rageMax;
  return updates;
}

/* =========================================================================
   AUTH FLOW
   ========================================================================= */
let authMode = "signup";
document.getElementById("btnLogin").addEventListener("click", ()=>{
  authMode="login";
  document.getElementById("authTitle").textContent="Log In";
  document.getElementById("authSubmit").textContent="Log In";
  document.getElementById("authError").textContent="";
  openModal("authModal");
});
document.getElementById("btnSignup").addEventListener("click", ()=>{
  authMode="signup";
  document.getElementById("authTitle").textContent="Sign Up";
  document.getElementById("authSubmit").textContent="Create Account";
  document.getElementById("authError").textContent="";
  openModal("authModal");
});
// Set true for the entire duration of the signup/login submit handler.
// onAuthStateChanged fires the instant Firebase considers the user signed
// in — which, on signup, is BEFORE this file has finished writing
// /players/{uid} and /usernames/{username}. Without this guard the global
// listener races the signup handler, sees no player doc yet, and signs the
// brand-new account back out — which then makes the signup handler's own
// still-pending setDoc calls fail with permission-denied because the user
// is no longer authenticated by the time they run.
let authFlowBusy = false;

/* Shared by onAuthStateChanged (page load / token refresh / other tabs)
   and the auth form itself (right after a signup/login it just performed),
   so both paths route the player the same way without racing each other. */
const BANNED_MSG = "This account was banned and will no longer work.";
let banKicked = false;
async function forceBanLogout(){
  if(banKicked) return; banKicked = true;
  stopPresence(); stopOnlineBeat();
  await signOut(auth).catch(()=>{});
  toast("🚫 You have been banned. This account will no longer work.", 10000);
  setTimeout(()=>{ banKicked = false; }, 2500);
}
async function loadPlayerAndRoute(user){
  cleanupSubs();
  if(!user){ resetSessionUI(); showScreen("screen-title"); playMusic("rpg_title.mp3"); return; }
  state.uid = user.uid;
  let psnap;
  try{
    psnap = await getDoc(doc(db,"players",user.uid));
  }catch(err){
    toast(friendlyFirebaseError(err));
    showScreen("screen-title");
    return;
  }
  if(!psnap.exists()){
    // signed in but the player document is missing (deleted, or account
    // creation was interrupted) — don't hang silently, get them back to a
    // known-good state instead.
    toast("Your account data couldn't be found. Please sign up again.");
    await signOut(auth).catch(()=>{});
    showScreen("screen-title");
    return;
  }
  const p = psnap.data();
  if(p.banned){ await signOut(auth).catch(()=>{}); showScreen("screen-title"); toast(BANNED_MSG, 8000); return; }
  state.username = p.username;
  if(!p.archetype || !p.klass){
    showScreen("screen-archetype");
  } else {
    enterGame();
  }
}

document.getElementById("authForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const uname = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value;
  const errEl = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");
  errEl.textContent="";
  submitBtn.disabled = true;
  authFlowBusy = true;
  try{
    if(authMode==="signup"){
      const problem = isValidUsername(uname);
      if(problem){ errEl.textContent = problem; return; }
      if(pass.length < 6){ errEl.textContent="Password is too short — use at least 6 characters."; return; }

      // reserve the username first so two people can't grab the same one
      let takenSnap;
      try{
        takenSnap = await getDoc(doc(db,"usernames",uname.toLowerCase()));
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }
      if(takenSnap.exists()){
        // a banned account's name can never be re-registered
        let banned = false;
        try{ const ps = await getDoc(doc(db,"players",takenSnap.data().uid)); banned = !!(ps.exists() && ps.data().banned); }catch(_){}
        errEl.textContent = banned ? BANNED_MSG : "That username is taken.";
        return;
      }

      let cred;
      try{
        cred = await createUserWithEmailAndPassword(auth, usernameToEmail(uname), pass);
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }

      try{
        const pdoc = defaultPlayerDoc(uname, null, null);
        await setDoc(doc(db,"players",cred.user.uid), pdoc);
        await setDoc(doc(db,"usernames",uname.toLowerCase()), { uid:cred.user.uid });
      }catch(err){
        console.error("SIGNUP FIRESTORE ERROR:", err);
        // roll back the auth account so we don't leave an orphaned login
        // with no matching player document
        try{ await cred.user.delete(); }catch(e2){ console.error("ROLLBACK DELETE FAILED:", e2); }
        errEl.textContent = DEBUG_AUTH_ERRORS
          ? `[DEBUG] player/username doc create failed: ${err?.code||"unknown"}: ${err?.message||err}`
          : "Couldn't finish creating your account. Please try again.";
        return;
      }
      closeModal("authModal");
      await loadPlayerAndRoute(cred.user);
    } else {
      try{    // banned usernames can't log back in
        const us = await getDoc(doc(db,"usernames",uname.toLowerCase()));
        if(us.exists()){
          const ps = await getDoc(doc(db,"players",us.data().uid));
          if(ps.exists() && ps.data().banned){ errEl.textContent = BANNED_MSG; return; }
        }
      }catch(_){}
      let cred;
      try{
        cred = await signInWithEmailAndPassword(auth, usernameToEmail(uname), pass);
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }
      closeModal("authModal");
      await loadPlayerAndRoute(cred.user);
    }
  } finally {
    authFlowBusy = false;
    submitBtn.disabled = false;
  }
});
document.getElementById("btnLogout").addEventListener("click", async ()=>{
  stopPresence();                                    // tell the other side we've left BEFORE we lose auth
  stopOnlineBeat();
  if(state.uid) await updateDoc(doc(db,"players",state.uid), { onlineAt: 0 }).catch(()=>{});   // show as offline immediately
  await withErrorToast(()=> signOut(auth));
  closeModal("settingsModal");
});

document.getElementById("btnShowDeleteAccount").addEventListener("click", ()=>{
  document.getElementById("deleteAccountConfirm").style.display = "block";
  document.getElementById("deleteAccountPassword").value = "";
  document.getElementById("deleteAccountError").textContent = "";
});
document.getElementById("btnConfirmDeleteAccount").addEventListener("click", async ()=>{
  const pass = document.getElementById("deleteAccountPassword").value;
  const errEl = document.getElementById("deleteAccountError");
  errEl.textContent = "";
  if(!pass){ errEl.textContent = "Enter your password to confirm."; return; }
  const btn = document.getElementById("btnConfirmDeleteAccount");
  btn.disabled = true;
  try{
    // Firebase requires a recent sign-in for account deletion; re-proving
    // the password here covers both that requirement and "are you sure".
    const cred = EmailAuthProvider.credential(usernameToEmail(state.username), pass);
    await reauthenticateWithCredential(auth.currentUser, cred);

    // Firestore data must go BEFORE the Auth user — once that's deleted
    // the client is signed out and loses write access to clean anything up.
    const questsSnap = await getDocs(collection(db,"players",state.uid,"quests"));
    for(const d of questsSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db,"players",state.uid,"farm","plots")).catch(()=>{});
    const inboxSnap = await getDocs(collection(db,"players",state.uid,"inbox"));
    for(const d of inboxSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db,"players",state.uid));
    await deleteDoc(doc(db,"usernames",state.username.toLowerCase())).catch(()=>{});

    await deleteUser(auth.currentUser);
    toast("Your account has been deleted.");
    closeModal("settingsModal");
    cleanupSubs(); resetSessionUI();
    showScreen("screen-title");
    playMusic("rpg_title.mp3");
  }catch(err){
    errEl.textContent = friendlyFirebaseError(err);
  }finally{
    btn.disabled = false;
  }
});

onAuthStateChanged(auth, async (user)=>{
  // The auth form calls loadPlayerAndRoute() itself once signup/login
  // finishes — skip here so we don't race it (see authFlowBusy above).
  if(authFlowBusy) return;
  await loadPlayerAndRoute(user);
});

/* =========================================================================
   ARCHETYPE + CLASS SELECT
   ========================================================================= */
function renderRuneGrid(){
  const grid = document.getElementById("runeGrid");
  grid.innerHTML="";
  Object.entries(ELEMENTS).forEach(([key,el])=>{
    const card = document.createElement("div");
    card.className = `rune-card rune-${key}`;
    card.innerHTML = `<div style="font-size:34px">${{fire:"🔥",water:"💧",earth:"🌱",air:"💨"}[key]}</div><div>${el.name}</div>`;
    card.addEventListener("mouseenter", ()=> document.getElementById("archetypeDesc").innerHTML=`<b>${el.name}:</b> ${ARCHETYPE_DESC[key]}`);
    card.addEventListener("click", ()=>{
      state.selArchetype = key;
      grid.querySelectorAll(".rune-card").forEach(c=>c.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirmArchetype").disabled=false;
      document.getElementById("archetypeDesc").innerHTML=`<b>${el.name}:</b> ${ARCHETYPE_DESC[key]}`;
      playSfx("click");
    });
    grid.appendChild(card);
  });
}
document.getElementById("btnConfirmArchetype").addEventListener("click", ()=>{
  if(!state.selArchetype) return;
  showScreen("screen-class");
});
function renderClassGrid(){
  const grid = document.getElementById("classGrid");
  grid.innerHTML="";
  Object.entries(CLASSES).forEach(([key,c])=>{
    const card = document.createElement("div");
    card.className="class-card";
    card.innerHTML = `<div style="font-size:34px">${{warrior:"⚔️",mage:"🪄",cleric:"✨",rogue:"🗡️"}[key]}</div><div>${c.name}</div>`;
    card.addEventListener("mouseenter", ()=> document.getElementById("classDesc").innerHTML=`<b>${c.name}:</b> ${c.desc}`);
    card.addEventListener("click", ()=>{
      state.selClass = key;
      grid.querySelectorAll(".class-card").forEach(c2=>c2.classList.remove("selected"));
      card.classList.add("selected");
      document.getElementById("btnConfirmClass").disabled=false;
      document.getElementById("classDesc").innerHTML=`<b>${c.name}:</b> ${c.desc}`;
      playSfx("click");
    });
    grid.appendChild(card);
  });
}
document.getElementById("btnConfirmClass").addEventListener("click", async ()=>{
  if(!state.selClass || !state.uid) return;
  const btn = document.getElementById("btnConfirmClass");
  btn.disabled = true;
  const ok = await withErrorToast(async ()=>{
    await updateDoc(doc(db,"players",state.uid), archetypeClassUpdates(state.selArchetype, state.selClass));
    return true;
  });
  btn.disabled = false;
  if(ok) enterGame();
});
renderRuneGrid();
renderClassGrid();

/* =========================================================================
   ENTER GAME / LIVE SYNC
   ========================================================================= */
// Clears everything tied to the logged-in session so nothing from it (like the
// Welcome Back popup) can leak onto the title screen.
function resetSessionUI(){
  farm.plots = null; farm.loaded = false; farm.sel = null; farm.seedSig = "";
  state.profile = null; state.recapPromise = null; state.battle = null;
  document.body.classList.remove("dungeon-mode");   // never leave the title screen dark
  ["recapModal","eatModal","battleModal","journalModal","compassModal","skillModal","dgModal","profileModal","settingsModal"].forEach(id=> closeModal(id));
}
function cleanupSubs(){
  stopPresence(); stopOnlineBeat();
  state.unsubs.forEach(u=>u()); state.unsubs=[]; chatSubbed=false;
  if(pmUnsub){ pmUnsub(); } pmUnsub=null;
  if(auctionUnsub){ auctionUnsub(); auctionUnsub=null; }
  stopManaRegen(); bossCleanup();
  if(state.hpRegenInterval){ clearInterval(state.hpRegenInterval); state.hpRegenInterval=null; }
}

function enterGame(){
  showScreen("screen-game");
  let firstSnapshot = true;
  const unsub = onSnapshot(doc(db,"players",state.uid), (snap)=>{
    if(!snap.exists()) return;
    const prevRegion = state.profile?.region;
    state.profile = snap.data();
    if(state.profile.banned){ forceBanLogout(); return; }   // an admin just banned you: logged out right now
    renderHUD();
    refreshDmReceipt(); syncNotifBoxes();
    if(document.getElementById("journalModal").classList.contains("active")){ renderInventory(); renderDailies(); }
    if(document.getElementById("eatModal").classList.contains("active")) renderEatModal();
    if(document.getElementById("overflowModal").classList.contains("active")) renderOverflow();
    // Keep music in sync with whatever region is actually on the player
    // doc — on first load (including re-signing in mid-session) and any
    // time the region field itself changes, not just on manual travel.
    if(firstSnapshot || state.profile.region !== prevRegion){
      const r = REGIONS[state.profile.region] || REGIONS.forest;
      playMusic(dgActive() ? DG_TRACK : r.track);
    }
    if(document.querySelectorAll(".rx-extra").length !== ownedReactions(cosOwned()).length) renderReactionBar();
    if(document.getElementById("customizeModal").classList.contains("active")) renderCustomize();
    if(firstSnapshot){
      { const rm = rageMaxFor(state.profile.level, state.profile.archetype, state.profile.stats?.SMARTS);   // bring existing accounts onto the level-based Rage cap
        if(state.profile.archetype && state.profile.rageMax !== rm) updateDoc(doc(db,"players",state.uid), { rageMax: rm, rage: Math.min(state.profile.rage||0, rm) }).catch(()=>{}); }
      { const gf = gearSyncFields(state.profile, state.profile.equipped); if(Object.keys(gf).length) updateDoc(doc(db,"players",state.uid), gf).catch(()=>{}); }
      catchUpHpRegen(state.profile); // pick up hours missed while the game was closed
      const since = state.profile.lastSeen; updateDoc(doc(db,"players",state.uid), { lastSeen: Date.now() }).catch(()=>{}); state.recapPromise = showRecap(since); ensureChatSubscriptions(); initBoss(); startQuestListener(); migrateSkillTree(); startManaRegen(); startOnlineBeat();
    }
    firstSnapshot = false;
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
  subscribeGlobalChat();
  if(state.hpRegenInterval) clearInterval(state.hpRegenInterval);
  // Re-check every minute while the tab is open so regen still lands on
  // the hour even without a reload; catchUpHpRegen itself no-ops unless a
  // full hour has actually elapsed.
  // 1 HP/min now rides on the single per-minute heartbeat (startManaRegen)
}
function renderHUD(){
  const p = state.profile; if(!p) return;
  document.getElementById("hudName").textContent = p.username;
  document.getElementById("hudLevel").textContent = p.level;
  document.getElementById("hudArchetype").textContent = ELEMENTS[p.archetype].name;
  document.getElementById("hudClass").textContent = CLASSES[p.klass].name;
  document.getElementById("hudMoney").textContent = fmtMoney(p.money);
  updateMuteUI();
  document.getElementById("hudRegion").textContent = REGIONS[p.region].name;

  document.getElementById("regionBg").className = "paper-bg " + REGIONS[p.region].css;

  setBar("HP", p.hp, p.hpMax);
  setBar("MANA", p.mana, p.manaMax);
  setBar("RAGE", p.rage, p.rageMax);
  setBar("XP", p.xp, p.xpMax);

  document.getElementById("statSPEED").textContent = p.stats.SPEED;
  document.getElementById("statSTRENGTH").textContent = p.stats.STRENGTH;
  document.getElementById("statCHARM").textContent = p.stats.CHARM;
  document.getElementById("statSMARTS").textContent = p.stats.SMARTS;
  const bm=document.getElementById("bossMine"); if(bm) bm.textContent=fmtBig(p.bossDamage||0);
  updateDailyDot();
  updateSkillUI();
  updateDungeonUI();
}
function setBar(key, val, max){
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  document.getElementById("bar"+key).style.width = pct+"%";
  document.getElementById("num"+key).textContent = `${Math.max(0,Math.round(val))}/${max}`;
}

/* level-up: xp scales by 1.2x rounded down each level */
const SKILL_KEYS = ["SPEED","STRENGTH","CHARM","SMARTS"];
async function grantXP(amount){
  await withErrorToast(async ()=>{
    let p = state.profile;
    let xp = p.xp + amount;
    let xpMax = p.xpMax;
    let level = p.level;
    let levelsGained = 0;
    const stats = { ...p.stats };
    while(xp >= xpMax){
      xp -= xpMax;
      xpMax = Math.floor(xpMax*1.2);
      level++;
      levelsGained++;
      // one free skill point per level, dropped into a random stat
      const pick = SKILL_KEYS[Math.floor(Math.random()*SKILL_KEYS.length)];
      stats[pick] = (stats[pick]||0) + 1;
    }
    const updates = { xp, xpMax, level };
    if(levelsGained > 0){
      updates.stats = stats;
      updates.hpMax = p.hpMax + 10*levelsGained;
      updates.hp = updates.hpMax;
      updates.manaMax = p.manaMax + 3*levelsGained;
      updates.mana = updates.manaMax;
      updates.rageMax = rageMaxFor(level, p.archetype, stats.SMARTS);   // max Rage grows with level (and shrinks with Smarts)
      updates.rage = Math.min(p.rage||0, updates.rageMax);
      playSfx("levelup");
      toast(`Level up! You are now level ${level} (+${levelsGained} skill point${levelsGained>1?"s":""}).`);
    }
    await updateDoc(doc(db,"players",state.uid), updates);
  });
}
async function grantMoney(amount){
  await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), snap = await tx.get(ref);
    tx.update(ref, { money: Math.max(0, (snap.data().money||0) + amount) });
  }));
}

/* =========================================================================
   INVENTORY / EQUIPMENT / JOURNAL
   ========================================================================= */
document.getElementById("btnJournal").addEventListener("click", ()=>{ openModal("journalModal"); renderInventory(); renderLeaderboard("money"); renderQuests(); renderDailies(); });
document.querySelectorAll("[data-jtab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-jtab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".jtab-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("jtab-"+btn.dataset.jtab).classList.add("active");
  });
});

function invExpanded(){
  const p = state.profile; if(!p) return [];
  return (p.inventory||[]).map(entry => ({ ...entry, item: ITEM_BY_ID[entry.itemId] })).filter(e=>e.item);
}
function renderInventory(){
  dgRenderLootNote();
  const grid = document.getElementById("invGrid");
  const items = invExpanded();
  const perPage = 12;
  const cap = invCap(state.profile);
  const pages = Math.max(1, Math.ceil(Math.max(cap, items.length)/perPage));
  state.invPage = Math.min(state.invPage, pages-1);
  const slice = items.slice(state.invPage*perPage, state.invPage*perPage+perPage);
  grid.innerHTML="";
  for(let i=0;i<perPage;i++){
    const cell = document.createElement("div");
    const entry = slice[i];
    cell.className = "inv-cell" + (entry? " rarity-"+entry.item.rarity : "");
    if(entry){
      cell.innerHTML = `<div>${entry.item.name}</div><span class="qty-badge">x${entry.qty}</span>`;
      cell.addEventListener("click", ()=> selectInvItem(entry));
    }
    grid.appendChild(cell);
  }
  document.getElementById("invPageLabel").textContent = `Page ${state.invPage+1}/${pages} · ${invUsed(state.profile.inventory)}/${cap} slots`;
  renderEquipSlots();
}
document.getElementById("invPrev").addEventListener("click", ()=>{ state.invPage=Math.max(0,state.invPage-1); renderInventory(); });
document.getElementById("invNext").addEventListener("click", ()=>{ state.invPage++; renderInventory(); });

// One-line effect summary for the inspect panel: heal/mana for consumables,
// damage for weapons, stat/HP changes for armor, +/- stat buffs for trinkets, uses for tools.
function itemEffectText(item){
  const st = item.stats || {};
  if(item.type==="consumable"){
    const bits = [];
    if(st.heal) bits.push(`Restores ${healText(st)} HP`);
    if(st.mana) bits.push(`Restores ${manaText(st)} mana`);
    if(st.luck) bits.push(`+${Math.round(st.luck*100)}% luck for ${Math.round(st.luckMs/60000)} min`);
    return bits.join(" · ") || "No effect";
  }
  if(item.type==="weapon") return `Damage: +${st.attack||0} attack`;
  if(item.type==="armor"){
    const bits = [];
    if(st.hp) bits.push(`${st.hp>=0?"+":""}${st.hp} max HP`);
    Object.keys(st).filter(k=>!["hp","curse"].includes(k)).forEach(k=> bits.push(`${st[k]>=0?"+":""}${st[k]} ${k}`));
    return `${item.armorSlot?item.armorSlot[0].toUpperCase()+item.armorSlot.slice(1)+": ":""}${bits.join(", ")||"No bonuses"}`;
  }
  if(item.type==="trinket"){
    const bits = Object.keys(st).filter(k=>k!=="curse").map(k=>{
      const v = st[k]; const n = st.curse ? -Math.abs(v) : v;
      return `${n>=0?"+":""}${n} ${k}${st.curse?" (cursed)":""}`;
    });
    return bits.join(", ") || "No bonuses";
  }
  if(item.type==="tool") return `Durability: ${TOOL_USES[item.id]||"?"} uses before it breaks`;
  if(item.type==="seed"){
    const r = item.farmRarity, [g1,g2] = item.random ? [16,100] : GROW_HOURS[r], [y1,y2] = CROP_YIELDS[r];
    return `Grows ${g1}–${g2}h · ${y1}–${y2} yields${item.random?" (maybe)":""} · dies ${DECAY_HOURS[r]}h after drying out`;
  }
  if(item.type==="rebirth") return "Resets your skill tree and refunds every skill point (consumed on use)";
  if(item.type==="backpack") return `Inventory ${BACKPACK_SLOTS[item.tier-1]} → ${BACKPACK_SLOTS[item.tier]} slots (permanent)`;
  return "Crafting material — no combat effect";
}
function selectInvItem(entry){
  state.selectedInvItem = entry;
  const canEquip = ["weapon","armor","trinket"].includes(entry.item.type);
  const detail = document.getElementById("itemDetail");
  detail.innerHTML = `
    <b>${entry.item.name}</b> <i>(${entry.item.rarity})</i><br>
    ${entry.item.desc}<br>
    <b>${escapeHTML(itemEffectText(entry.item))}</b><br>
    <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
      ${canEquip? `<button class="doodle-btn btn-sm btn-blue" id="btnEquip">Equip</button>`:""}
      ${entry.item.type==="consumable"? `<button class="doodle-btn btn-sm btn-green" id="btnUse">Use</button>`:""}
      ${entry.item.type==="rebirth"? `<button class="doodle-btn btn-sm btn-green" id="btnRebirth">Use</button>`:""}
      ${entry.item.type==="seed"? `<button class="doodle-btn btn-sm btn-green" id="btnPlantSeed">Plant 🌱</button>`:""}
      ${entry.item.type==="rebirth" ? "" : `<button class="doodle-btn btn-sm btn-yellow" id="btnSell">Sell ($${fmtMoney(entry.item.sellPrice)})</button>`}
    </div>`;
  const eq = document.getElementById("btnEquip");
  if(eq) eq.addEventListener("click", ()=> equipItem(entry.item));
  const use = document.getElementById("btnUse");
  if(use) use.addEventListener("click", ()=> useConsumable(entry.item));
  const plantBtn = document.getElementById("btnPlantSeed");
  if(plantBtn) plantBtn.addEventListener("click", ()=> startPlantingFromInventory(entry.item.id));
  const rb = document.getElementById("btnRebirth");
  if(rb) rb.addEventListener("click", ()=> dgConfirm({ title:"Use Rebirth?", yes:"Reset my skill tree", danger:false,
    html:"<p>This <b>consumes the Rebirth</b>, refunds <b>all</b> your skill tree points and resets the tree to the top. Max HP / Mana from skill nodes is removed too.</p>", onYes:()=> resetSkillTree({ consumeItem:true }) }));
  const sellBtn = document.getElementById("btnSell");
  if(sellBtn) sellBtn.addEventListener("click", async ()=>{
    await sellItem(entry.item);
    afterInvChangeRefreshDetail(entry.item.id);
  });
}
// After a use/toss/sell, re-check how many of that item are left: if none,
// clear the detail panel and deselect instead of leaving stale Use/Toss/Sell
// buttons that still fire against a stack that no longer exists (which is
// what let people spam "Use" past having zero of an item).
function afterInvChangeRefreshDetail(itemId){
  const fresh = invExpanded().find(e=>e.item.id===itemId);
  if(fresh){ selectInvItem(fresh); }
  else {
    state.selectedInvItem = null;
    document.getElementById("itemDetail").innerHTML = "Select an item to inspect it.";
  }
  renderInventory();
}
// All inventory-array mutations go through here so that a multi-item
// action (like crafting, which removes 2 ingredients and adds 1 result)
// reads the inventory ONCE and writes it ONCE. Doing separate sequential
// changeInvQty() calls for that was the actual cause of the "crafting
// duplicates items" bug: the 2nd call could read state.profile before the
// 1st call's write had round-tripped back down, so it wrote a version of
// the array that still had the 1st ingredient at full quantity.
// Runs entirely inside a Firestore transaction: reads the CURRENT
// server-side inventory (never the possibly-stale local state.profile),
// validates every `remove` actually has enough quantity available, and
// writes the merged result in one atomic round-trip. This is what closes
// the "crafting duplicates items / creates items out of thin air" bug —
// two rapid actions (e.g. double-clicking Craft, or crafting right after
// eating) can no longer both read the same stale pre-write inventory,
// because each transaction re-reads from the server and Firestore retries
// on conflict instead of silently racing.
// extraFields may be a plain object OR a function (freshData)=>object, so
// callers that need to compute a field off the CURRENT server value (like
// healing off current hp, not the possibly-stale local state.profile.hp)
// can do so from inside the same transaction that validates/spends items.
async function applyInvChanges({remove=[], add=[], strict=false, onDropped=null}={}, extraFields={}){
  /* Slot cap: every distinct item is one slot. A NEW item that doesn't fit is
     dropped (and you're told) — unless strict is set (purchases, crafting,
     harvests), in which case the whole action is refused instead. */
  let dropped = [];
  const res = await withErrorToast(async ()=>{
    const pref = doc(db,"players",state.uid);
    await runTransaction(db, async (tx)=>{
      dropped = [];
      const snap = await tx.get(pref);
      const data = snap.data() || {};
      const inv = (data.inventory||[]).map(e=>({...e}));
      for(const {itemId, qty} of remove){
        const idx = inv.findIndex(e=>e.itemId===itemId);
        const have = idx>=0 ? inv[idx].qty : 0;
        if(have < qty){
          throw new Error(`insufficient-item:${itemId}`);
        }
        inv[idx].qty -= qty;
      }
      const cap = invCap(data);
      for(const {itemId, qty} of add){
        const idx = inv.findIndex(e=>e.itemId===itemId);
        if(idx>=0 && inv[idx].qty>0){ inv[idx].qty += qty; continue; }
        if(invUsed(inv) >= cap){ if(strict) throw new Error("inv-full"); dropped.push({ itemId, qty }); continue; }
        if(idx>=0) inv[idx].qty = qty; else inv.push({ itemId, qty });
      }
      const fields = typeof extraFields==="function" ? extraFields(data) : extraFields;
      tx.update(pref, { inventory: inv.filter(e=>e.qty>0), ...fields });
    });
  });
  if(res!==null && dropped.length){ if(onDropped) onDropped(dropped); else queueOverflow(dropped); }
  return res;
}
/* ---------- full-bag pickup menu ----------
   Items that don't fit are parked in `overflow` and a menu opens: your bag (sell things to free slots)
   plus a floating 1x3 "tower" of the picked-up items. Each time a slot frees up, the next picked-up
   item moves in automatically. Closing the menu / pressing Done discards whatever is left. */
let overflow = [], ovPage = 0, ovInvPage = 0, ovSel = null, ovBusy = false;
const OV_PER_PAGE = 3;
function mergeOverflow(list){
  const out = [];
  list.forEach(({itemId,qty})=>{ const e = out.find(x=>x.itemId===itemId); if(e) e.qty += qty; else out.push({ itemId, qty }); });
  return out;
}
function queueOverflow(list){
  overflow = mergeOverflow([...overflow, ...list].filter(o=>ITEM_BY_ID[o.itemId]));
  if(!overflow.length) return;
  ovPage = Math.min(ovPage, Math.ceil(overflow.length/OV_PER_PAGE)-1);
  openModal("overflowModal"); renderOverflow();
}
function renderOverflow(){
  const modal = document.getElementById("overflowModal"); if(!modal || !state.profile) return;
  // --- your bag ---
  const items = invExpanded(), per = 12, cap = invCap(state.profile);
  const pages = Math.max(1, Math.ceil(Math.max(cap, items.length)/per));
  ovInvPage = Math.min(ovInvPage, pages-1);
  const grid = document.getElementById("ovInvGrid"); grid.innerHTML = "";
  const slice = items.slice(ovInvPage*per, ovInvPage*per+per);
  for(let i=0;i<per;i++){
    const entry = slice[i], cell = document.createElement("div");
    cell.className = "inv-cell" + (entry ? " rarity-"+entry.item.rarity : "") + (entry && entry.itemId===ovSel ? " selected" : "");
    if(entry){
      cell.innerHTML = `<div>${escapeHTML(entry.item.name)}</div><span class="qty-badge">x${entry.qty}</span>`;
      cell.addEventListener("click", ()=>{ ovSel = entry.itemId; renderOverflow(); });
    }
    grid.appendChild(cell);
  }
  document.getElementById("ovInvLabel").textContent = `Page ${ovInvPage+1}/${pages} · ${invUsed(state.profile.inventory)}/${cap} slots`;
  // --- detail / sell ---
  const det = document.getElementById("ovDetail"), sel = items.find(e=>e.itemId===ovSel);
  if(!sel){ ovSel = null; det.textContent = "Tap an item in your bag to sell it and make room."; }
  else {
    det.innerHTML = `<b>${escapeHTML(sel.item.name)}</b> <i>(${sel.item.rarity})</i> &middot; x${sel.qty}<br>
      <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="doodle-btn btn-sm btn-yellow" id="ovSell1">Sell 1 ($${fmtMoney(sel.item.sellPrice)})</button>
        ${sel.qty>1 ? `<button class="doodle-btn btn-sm btn-yellow" id="ovSellAll">Sell all ($${fmtMoney(sel.item.sellPrice*sel.qty)})</button>` : ""}
      </div>`;
    document.getElementById("ovSell1").addEventListener("click", ()=> ovSell(sel.itemId, false));
    const all = document.getElementById("ovSellAll"); if(all) all.addEventListener("click", ()=> ovSell(sel.itemId, true));
  }
  // --- the 1x3 pickup tower ---
  const tPages = Math.max(1, Math.ceil(overflow.length/OV_PER_PAGE));
  ovPage = Math.max(0, Math.min(ovPage, tPages-1));
  const tower = document.getElementById("ovTower"); tower.innerHTML = "";
  const shown = overflow.slice(ovPage*OV_PER_PAGE, ovPage*OV_PER_PAGE+OV_PER_PAGE);
  for(let i=0;i<OV_PER_PAGE;i++){
    const o = shown[i], it = o && ITEM_BY_ID[o.itemId], cell = document.createElement("div");
    cell.className = "inv-cell" + (it ? " rarity-"+it.rarity : " ov-empty");
    if(it) cell.innerHTML = `<div>${escapeHTML(it.name)}</div><span class="qty-badge">x${o.qty}</span>`;
    tower.appendChild(cell);
  }
  document.getElementById("ovPageLabel").textContent = `${ovPage+1}/${tPages} · ${overflow.reduce((s,o)=>s+o.qty,0)} item${overflow.reduce((s,o)=>s+o.qty,0)===1?"":"s"}`;
  document.getElementById("ovUp").disabled = ovPage<=0;
  document.getElementById("ovDown").disabled = ovPage>=tPages-1;
}
async function fillFromOverflow(){
  if(!overflow.length) return;
  let left = null;
  const before = overflow.map(o=>({...o}));
  const res = await applyInvChanges({ add:before.map(o=>({...o})), onDropped: d=>{ left = d; } });
  if(res===null) return;                                   // write failed — keep everything parked
  overflow = left ? mergeOverflow(left) : [];
  const movedNames = before.filter(o=> !(overflow.some(x=>x.itemId===o.itemId))).map(o=>ITEM_BY_ID[o.itemId].name);
  if(movedNames.length) toast(`🎒 Moved into your bag: ${movedNames.join(", ")}`);
  if(!overflow.length) closeModal("overflowModal");
}
async function ovSell(itemId, all){
  if(ovBusy) return;
  const e = (state.profile.inventory||[]).find(x=>x.itemId===itemId && x.qty>0), item = ITEM_BY_ID[itemId];
  if(!e || !item) return;
  ovBusy = true;
  try{
    const qty = all ? e.qty : 1;
    const ok = await applyInvChanges({ remove:[{ itemId, qty }] });
    if(ok!==null){
      await grantMoney(item.sellPrice*qty); playSfx("sell");
      toast(`Sold ${qty>1?qty+"x ":""}${item.name} for $${fmtMoney(item.sellPrice*qty)}`);
      await fillFromOverflow();
    }
  } finally { ovBusy = false; renderOverflow(); }
}
function closeOverflow(){
  const n = overflow.reduce((s,o)=>s+o.qty,0);
  overflow = []; ovPage = 0; ovSel = null;
  closeModal("overflowModal");
  if(n) toast(`Discarded ${n} picked-up item${n===1?"":"s"}.`);
}
document.getElementById("ovClose").addEventListener("click", closeOverflow);
document.getElementById("ovDone").addEventListener("click", closeOverflow);
document.getElementById("ovUp").addEventListener("click", ()=>{ ovPage--; renderOverflow(); });
document.getElementById("ovDown").addEventListener("click", ()=>{ ovPage++; renderOverflow(); });
document.getElementById("ovInvPrev").addEventListener("click", ()=>{ ovInvPage = Math.max(0, ovInvPage-1); renderOverflow(); });
document.getElementById("ovInvNext").addEventListener("click", ()=>{ ovInvPage++; renderOverflow(); });
async function changeInvQty(itemId, delta){
  return delta>=0
    ? applyInvChanges({ add:[{itemId, qty:delta}] })
    : applyInvChanges({ remove:[{itemId, qty:-delta}] });
}
async function addItemToInv(itemId, qty=1){
  return applyInvChanges({ add:[{itemId, qty}] });
}
async function sellItem(item){
  await changeInvQty(item.id, -1);
  await grantMoney(item.sellPrice);
  playSfx("sell");
  toast(`Sold ${item.name} for $${fmtMoney(item.sellPrice)}`);
}
async function equipItem(item){
  const slot = item.type==="armor" ? item.armorSlot : item.type; // weapon/helmet/chestplate/leggings/boots/trinket
  let swapped = null;
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const pref = doc(db,"players",state.uid), snap = await tx.get(pref), d = snap.data()||{};
    const inv = (d.inventory||[]).map(e=>({...e}));
    const idx = inv.findIndex(e=>e.itemId===item.id);
    if(idx<0 || inv[idx].qty<1) throw new Error(`insufficient-item:${item.id}`);
    inv[idx].qty -= 1;
    const old = d.equipped?.[slot] || null;
    if(old){                                   // swap: old piece goes back to the bag
      const oi = inv.findIndex(e=>e.itemId===old);
      if(oi>=0) inv[oi].qty += 1; else inv.push({ itemId:old, qty:1 });
      swapped = old;
    }
    const newEq = { ...(d.equipped||{}), [slot]: item.id };
    tx.update(pref, { inventory: inv.filter(e=>e.qty>0), [`equipped.${slot}`]: item.id, ...gearSyncFields(d, newEq) });
  }));
  if(ok!==null){
    toast(`Equipped ${item.name}` + (swapped ? ` (${ITEM_BY_ID[swapped]?.name||"old item"} returned to inventory)` : ""));
    afterInvChangeRefreshDetail(item.id);
  }
}
async function unequipItem(slot){
  let name = "item";
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const pref = doc(db,"players",state.uid), snap = await tx.get(pref), d = snap.data()||{};
    const itemId = d.equipped?.[slot];
    if(!itemId) return;
    name = ITEM_BY_ID[itemId]?.name || "item";
    const inv = (d.inventory||[]).map(e=>({...e}));
    const idx = inv.findIndex(e=>e.itemId===itemId);
    if(idx>=0 && inv[idx].qty>0) inv[idx].qty += 1;
    else { if(invUsed(inv) >= invCap(d)) throw new Error("inv-full"); if(idx>=0) inv[idx].qty = 1; else inv.push({ itemId, qty:1 }); }
    const newEq = { ...(d.equipped||{}), [slot]: null };
    tx.update(pref, { inventory: inv, [`equipped.${slot}`]: null, ...gearSyncFields(d, newEq) });
  }));
  if(ok!==null) toast(`${name} moved back to your inventory`);
}
/* Armor works by shifting the real numbers on the player doc (hpMax + the
   four stats) while it is worn. `gearApplied` remembers exactly what is
   currently baked in, so taking a piece off (or an item's stats changing
   later) always removes the right amount. */
function gearBonus(equipped){
  const out = { hp:0, stats:{ SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0 } };
  [...ARMOR_SLOTS, "trinket"].forEach(slot=>{
    const it = equipped?.[slot] && ITEM_BY_ID[equipped[slot]]; if(!it) return;
    const st = it.stats||{}, sign = (slot==="trinket" && st.curse) ? -1 : 1;     // trinkets give their stats now (cursed ones take them away)
    out.hp += st.hp||0;
    SKILL_KEYS.forEach(k=> out.stats[k] += sign*(st[k]||0));
  });
  return out;
}
function gearSyncFields(data, equipped){
  const want = gearBonus(equipped), had = data.gearApplied || { hp:0, stats:{} };
  const stats = { ...(data.stats||{}) };
  let changed = want.hp !== (had.hp||0);
  SKILL_KEYS.forEach(k=>{
    const delta = want.stats[k] - (had.stats?.[k]||0);
    if(delta){ stats[k] = (stats[k]||0) + delta; changed = true; }
  });
  if(!changed) return {};
  const hpMax = Math.max(1, (data.hpMax||1) + (want.hp - (had.hp||0)));
  const out = { stats, hpMax, hp: Math.max(1, Math.min(hpMax, data.hp||1)), gearApplied: want };
  if(data.archetype && want.stats.SMARTS !== (had.stats?.SMARTS||0)){      // Smarts moved, so max Rage moves with it
    out.rageMax = rageMaxFor(data.level, data.archetype, stats.SMARTS);
    out.rage = Math.min(data.rage||0, out.rageMax);
  }
  return out;
}
const EQUIP_SLOTS = ["weapon","helmet","chestplate","leggings","boots","trinket"];
function renderEquipSlots(){
  const p = state.profile; if(!p) return;
  EQUIP_SLOTS.forEach(slot=>{
    const el = document.getElementById("equip"+slot.charAt(0).toUpperCase()+slot.slice(1));
    if(!el) return;
    const itemId = p.equipped?.[slot];
    if(itemId && ITEM_BY_ID[itemId]){
      el.classList.add("filled");
      el.innerHTML = `<span>${ITEM_BY_ID[itemId].name}</span><button type="button" class="doodle-btn btn-sm equip-deslot-btn" data-deequip="${slot}" title="Take off">✕</button>`;
      el.querySelector("[data-deequip]").addEventListener("click", (ev)=>{ ev.stopPropagation(); unequipItem(slot); });
    } else {
      el.classList.remove("filled");
      el.innerHTML = `<span>${slot[0].toUpperCase()+slot.slice(1)}</span>`;
    }
  });
}
/* Luck potions: profile.luckPct (0.1 / 0.2 / 0.4) until profile.luckUntil (ms). */
function activeLuck(){ const p = state.profile; return p && (p.luckUntil||0) > Date.now() ? (p.luckPct||0) : 0; }
async function useConsumable(item){
  if(item.stats.luck && activeLuck() > item.stats.luck){ toast("A stronger luck potion is still working."); return; }
  // Everything — the qty check, the qty decrement, AND the hp/mana gain —
  // happens inside ONE transaction now (via applyInvChanges' extraFields),
  // reading the server's current inventory each time. That's what stops a
  // double-click (or eating right after crafting) from consuming an item
  // you don't actually have anymore, or applying its effect twice.
  const rolled = rollHeal(item), rolledMana = rollMana(item);
  const ok = await applyInvChanges({ remove:[{itemId:item.id, qty:1}] }, (fresh)=>{
    const fields = {};
    if(item.stats.heal) fields.hp = Math.min(fresh.hpMax, fresh.hp+rolled);
    if(item.stats.mana) fields.mana = Math.min(fresh.manaMax, fresh.mana+rolledMana);
    if(item.stats.luck){ fields.luckPct = item.stats.luck; fields.luckUntil = Date.now() + item.stats.luckMs; }
    return fields;
  });
  if(ok===null){
    afterInvChangeRefreshDetail(item.id);
    return;
  }
  toast(item.stats.luck ? `🍀 ${item.name}: +${Math.round(item.stats.luck*100)}% luck for ${Math.round(item.stats.luckMs/60000)} minutes!` : `Used ${item.name}${rolled?` (+${rolled} HP)`:""}${item.stats.mana?` (+${rolledMana} mana)`:""}`);
  afterInvChangeRefreshDetail(item.id);
}

/* =========================================================================
   LEADERBOARD + PROFILE BOOK
   ========================================================================= */
/* Following = everyone this player has friended, plus everyone they have a friend request out to. */
const followingIds = d => [ ...new Set([ ...(d.friends||[]), ...(d.sentFriendRequests||[]) ]) ];
async function computeFollowerCount(uid, friendCount){
  try{
    const q = query(collection(db,"players"), where("sentFriendRequests","array-contains",uid));
    const snap = await getDocs(q);
    return friendCount + snap.size;
  }catch(err){ console.error(err); return friendCount; }
}
document.querySelectorAll(".lb-cat").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".lb-cat").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    renderLeaderboard(b.dataset.cat);
  });
});
const LB_FIELDS = { money:"money", level:"level", kills:"monstersKilled", pvpkills:"kills", deaths:"deaths" };
const LB_LABEL = { money:"💰", level:"⭐", kills:"👹", pvpkills:"⚔️", deaths:"💀" };
const lbCache = {};
/* Highest level first; players on the same level are ordered by XP (more XP ranks higher). */
const lvlThenXp = (x,y)=> ((y.data.level||0)-(x.data.level||0)) || ((y.data.xp||0)-(x.data.xp||0));
async function getLb(cat){
  const c = lbCache[cat]; if(c && Date.now()-c.t < 60000) return c.rows;
  const snap = await getDocs(query(collection(db,"players"), orderBy(LB_FIELDS[cat],"desc"), limit(cat==="level" ? 100 : 30)));
  const rows = snap.docs.filter(d=>!d.data().banned).map(d=>({id:d.id, data:d.data()}));
  if(cat==="level") rows.sort(lvlThenXp);
  lbCache[cat] = { t:Date.now(), rows }; return rows;
}
let lbUnsub = null;
function renderLeaderboard(cat){
  const field = LB_FIELDS[cat], list = document.getElementById("lbList");
  if(lbUnsub){ lbUnsub(); lbUnsub = null; }
  else state.unsubs.push(()=>{ if(lbUnsub){ lbUnsub(); lbUnsub = null; } });
  list.innerHTML = "<li>Loading…</li>";
  lbUnsub = onSnapshot(query(collection(db,"players"), orderBy(field,"desc"), limit(cat==="level" ? 100 : 30)), snap=>{
    lbCache[cat] = { t:Date.now(), rows: snap.docs.filter(d=>!d.data().banned).map(d=>({id:d.id, data:d.data()})) };
    if(cat==="level") lbCache[cat].rows.sort(lvlThenXp);
    const rows = lbCache[cat].rows.slice(0,10);
    list.innerHTML = "";
    rows.forEach((r,i)=>{
      const data = r.data, li = document.createElement("li");
      li.className = RANK_CLASS(i);       // gold / silver / copper for the top 3
      li.innerHTML = `<span>#${i+1} ${escapeHTML(data.username)}${onlineDot(data, r.id===state.uid)}</span><span>${cat==="money"? "$"+fmtMoney(data[field]||0) : (data[field]||0)}</span>`;
      li.addEventListener("click", ()=> openProfileBook(r.id, data, i+1, cat));
      list.appendChild(li);
    });
    if(!rows.length) list.innerHTML = "<li>No players yet.</li>";
  }, e=>{ console.error(e); list.innerHTML = "<li>Leaderboard unavailable right now.</li>"; });
}
/* A private profile is only visible to a MUTUAL friend (each of you has the other in your friends list). */
const isMutualFriend = (uid, data)=> (state.profile?.friends||[]).includes(uid) && (data?.friends||[]).includes(state.uid);
const RANK_CLASS = pos=> pos===0 ? "rank-gold" : pos===1 ? "rank-silver" : pos===2 ? "rank-copper" : "rank-plain";
function openProfileBook(uid, data, rank, cat){
  const profileHidden = uid!==state.uid && !!data.privateProfile && !isMutualFriend(uid, data);
  document.getElementById("profileName").innerHTML = escapeHTML(data.username) + onlineDot(data, uid===state.uid);
  document.getElementById("profileStats").innerHTML = profileHidden
    ? `<div class="profile-locked"><div class="lock-big">🔒</div><p>This profile is private. Be friends with this person first to view their profile.</p></div>`
    : `
    Level ${data.level} ${ELEMENTS[data.archetype]?.name||""} ${CLASSES[data.klass]?.name||""}<br>
    Money: $${fmtMoney(data.money||0)}<br>
    Monsters Killed: ${data.monstersKilled||0}<br>
    PvP Kills: ${data.kills||0} &middot; Deaths: ${data.deaths||0} &middot; Killstreak: ${data.killstreak||0}<br>
    Friends: <a class="social-link" id="profileFriendsLink">${(data.friends||[]).length}</a> &middot; Followers: <a class="social-link" id="profileFollowersLink"><span id="profileFollowerCount">…</span></a> &middot; Following: <a class="social-link" id="profileFollowingLink">${followingIds(data).length}</a><br>
    Playtime: ${fmtPlaytime(data.playtime||0)}<div class="lb-bubbles" id="lbBubbles"></div>`;
  { const rk = document.getElementById("profileRank");
    rk.textContent = (!profileHidden && rank) ? `Ranked #${rank} in ${cat}` : "";
    rk.className = "profile-rank" + ((!profileHidden && rank) ? " "+RANK_CLASS(rank-1) : ""); }
  const card = document.querySelector("#profileModal .book-card");
  card.style.background = profileHidden ? "" : (gradientCss(data.gradient) || ELEMENTS[data.archetype]?.color || "");
  card.style.fontFamily = profileHidden ? "" : fontFamily(data.font);
  document.getElementById("btnCustomize").style.display = uid===state.uid ? "" : "none";
  if(!profileHidden) Promise.all(Object.keys(LB_FIELDS).map(getLb)).then(all=>{
    const box = document.getElementById("lbBubbles"); if(!box) return;
    // 1st = gold, 2nd = silver, 3rd = copper, everyone else plain white
    box.innerHTML = Object.keys(LB_FIELDS).map((c,i)=>{ const pos = all[i].findIndex(r=>r.id===uid); return `<span class="lb-bubble ${pos>=0 ? RANK_CLASS(pos) : "rank-plain"}" title="${c}">${LB_LABEL[c]} ${pos>=0?"#"+(pos+1):"30+"}</span>`; }).join("");
  }).catch(()=>{});
  const payBox = document.getElementById("payBox");
  payBox.style.display = uid===state.uid ? "none" : "";
  document.getElementById("payAmount").value = "";
  document.getElementById("btnPay").onclick = async ()=>{ const pa = parseAmount(document.getElementById("payAmount").value); if(pa.err){ toast(pa.err); return; } if(await payPlayer(uid, data.username, pa.value)) document.getElementById("payAmount").value=""; };
  // Followers = friends + people who have a pending friend request out to
  // this player (i.e. anyone whose own sentFriendRequests contains them).
  if(!profileHidden) computeFollowerCount(uid, (data.friends||[]).length).then(count=>{
    const el = document.getElementById("profileFollowerCount");
    if(el) el.textContent = count;
  });
  { const locked = !!data.privateSocial && uid!==state.uid;   // private lists: shown as locked, and re-checked live when clicked
    [["friends","profileFriendsLink"],["followers","profileFollowersLink"],["following","profileFollowingLink"]].forEach(([kind,id])=>{
      const a = document.getElementById(id); if(!a) return;
      a.classList.toggle("locked", locked); if(locked) a.append(" 🔒");
      a.onclick = ()=> openSocialList(uid, kind);
    }); }

  const pmBtn = document.getElementById("btnPM");
  const friendBtn = document.getElementById("btnFriendReq");
  const banBtn = document.getElementById("btnBanUser");
  const isSelf = uid === state.uid;
  // a private profile can only be messaged once you've BOTH added each other
  pmBtn.style.display = (isSelf || (data.privateProfile && !isMutualFriend(uid, data))) ? "none" : "";
  friendBtn.style.display = isSelf ? "none" : "";
  banBtn.style.display = (!isSelf && isAdminUI()) ? "" : "none";
  if(!isSelf && isAdminUI()){
    banBtn.onclick = ()=> banUser(uid, data.username);
  }
  // mod-only mute box
  const muteBox = document.getElementById("muteBox");
  muteBox.style.display = (!isSelf && isAdminUI()) ? "" : "none";
  if(!isSelf && isAdminUI()){
    const durInput = document.getElementById("muteDuration"), status = document.getElementById("muteStatus"), unBtn = document.getElementById("btnUnmuteUser");
    durInput.value = "";
    const showStatus = d=>{
      const left = muteLeftMs(d);
      status.textContent = left>0 ? `Currently muted — ${fmtMuteLeft(left)} left.` : "Not muted.";
      status.style.color = left>0 ? "#c0392b" : "";
      unBtn.style.display = left>0 ? "" : "none";
    };
    showStatus(data);
    getDoc(doc(db,"players",uid)).then(s=>{ if(s.exists()) showStatus(s.data()); }).catch(()=>{});   // fresh value, the one passed in may be a cached leaderboard row
    document.getElementById("btnMuteUser").onclick = async ()=>{
      const r = parseMuteDuration(durInput.value);
      if(r.err){ toast(r.err); return; }
      if(await muteUser(uid, data.username, r.ms)){ durInput.value = ""; showStatus({ mutedUntil: Date.now()+r.ms }); }
    };
    unBtn.onclick = async ()=>{ if(await unmuteUser(uid, data.username)) showStatus({ mutedUntil:0 }); };
  }
  if(!isSelf){
    pmBtn.onclick = ()=>{ closeModal("profileModal"); openPrivateChatWith(uid, data.username); };
    const isFriend = (state.profile.friends||[]).includes(uid);
    const isPending = (state.profile.sentFriendRequests||[]).includes(uid);
    if(isFriend){
      // accepted: red "Remove Friend"
      friendBtn.textContent = "Remove Friend";
      friendBtn.className = "doodle-btn btn-danger";
      friendBtn.disabled = false;
      friendBtn.onclick = ()=> withErrorToast(async ()=>{
        await updateDoc(doc(db,"players",state.uid), { friends: arrayRemove(uid) });
        toast(`Removed ${data.username} as a friend.`);
        closeModal("profileModal");
      });
    } else if(isPending){
      // sent, waiting on them: yellow "Pending", not clickable again
      friendBtn.textContent = "Pending";
      friendBtn.className = "doodle-btn btn-yellow";
      friendBtn.disabled = true;
      friendBtn.onclick = null;
    } else {
      // green "Add Friend"
      friendBtn.textContent = "Add Friend";
      friendBtn.className = "doodle-btn btn-blue";
      friendBtn.disabled = false;
      friendBtn.onclick = ()=> sendFriendRequest(uid, data.username);
    }
  }
  openModal("profileModal");
}
/* Bans a user: scrubs their display name to banneduser_##### (so old chat
   lines and the leaderboard show that instead of their real name) and
   wipes their public chat history. Enforced server-side by isAdmin() in
   rpg_firestore.rules, not by this client-side isAdminUI() check.
   NOTE: fully deleting another user's Firebase Auth account (so they can
   never log back in at all) is not something a client app can do for
   someone else's account — Firebase only allows a user to delete their
   OWN auth account. Truly deleting the Auth record too requires a small
   Cloud Function using the Admin SDK, triggered off this banned:true
   flag; this client-side ban already fully removes them from chat and
   leaderboards and scrubs their name in the meantime. */
async function banUser(uid, username){
  if(!isAdminUI()) return;
  if(!confirm(`Ban ${username}? This scrubs their name and deletes everything they contributed (chat, private messages, auction listings, friendships and requests). It cannot be undone from here.`)) return;
  const bannedName = `banneduser_${Math.floor(10000 + Math.random()*90000)}`;
  // Remember who they had sent friend requests to BEFORE we blank that list (their pending requests get cleaned up below).
  let sentTargets = [];
  try{ sentTargets = (await getDoc(doc(db,"players",uid))).data()?.sentFriendRequests || []; }catch(_){}
  // 1) Flag first, so they are kicked out immediately and the name can never be re-registered.
  const flagged = await withErrorToast(async ()=>{
    await updateDoc(doc(db,"players",uid), { username: bannedName, banned:true, friends:[], sentFriendRequests:[], mutedUntil:0 });
  });
  if(flagged===null) return;
  // 2) Sweep up their data. Each step is independent: one failing (e.g. a missing index) never stops the rest.
  const failed = [], counts = {};
  const step = async (label, fn)=>{ try{ counts[label] = await fn(); }catch(e){ console.error("ban cleanup:", label, e); failed.push(label); } };
  const delAll = async (q)=>{ const snap = await getDocs(q); await Promise.all(snap.docs.map(d=> deleteDoc(d.ref))); return snap.size; };

  await step("chat messages", ()=> delAll(query(collection(db,"globalChat"), where("uid","==",uid))));
  // private messages they sent, in every thread (a collection-group query — see the note in rpg_firestore.rules about its index)
  await step("private messages", ()=> delAll(query(collectionGroup(db,"messages"), where("uid","==",uid))));
  await step("auction listings", ()=> delAll(query(collection(db,"auction"), where("sellerUid","==",uid))));
  await step("reactions", ()=> delAll(query(collection(db,"reactions"), where("uid","==",uid))));
  await step("duel rooms", ()=> delAll(query(collection(db,"duelRooms"), where("hostUid","==",uid))));
  await step("duel queue", async ()=>{ await deleteDoc(doc(db,"queue",uid)); return 1; });
  // remove them from every friends list, and from every pending-request list
  await step("friends lists", async ()=>{
    const snap = await getDocs(query(collection(db,"players"), where("friends","array-contains",uid)));
    await Promise.all(snap.docs.map(d=> updateDoc(d.ref, { friends: arrayRemove(uid) })));
    return snap.size;
  });
  await step("friend requests", async ()=>{
    const snap = await getDocs(query(collection(db,"players"), where("sentFriendRequests","array-contains",uid)));
    await Promise.all(snap.docs.map(d=> updateDoc(d.ref, { sentFriendRequests: arrayRemove(uid) })));
    return snap.size;
  });
  // their own outstanding friend requests sitting in other players' inboxes
  await step("pending requests sent", async ()=>{
    let n = 0;
    for(const t of sentTargets){
      const ib = await getDocs(query(collection(db,"players",t,"inbox"), where("fromUid","==",uid)));
      await Promise.all(ib.docs.map(d=> deleteDoc(d.ref))); n += ib.size;
    }
    return n;
  });

  closeModal("profileModal");
  const summary = Object.entries(counts).filter(([,n])=>n).map(([k,n])=>`${n} ${k}`).join(", ");
  toast(`${username} has been banned.${summary ? " Removed: "+summary+"." : ""}`, 8000);
  if(failed.length) toast(`⚠️ Banned, but couldn't clear: ${failed.join(", ")}. Check the console / Firestore rules & indexes.`, 12000);
}

/* =========================================================================
   SIDEQUESTS — flat rewards ($50 / $75 / $125), always 3 different kinds at once,
   3 slots (Tier I / II / III), 12h / 24h / 3-day reroll while
   unaccepted, 24h to complete once accepted, and the same 24h also gates
   the slot's refill (accepting locks the slot for exactly that window).
   ========================================================================= */
const QUEST_TIERS = ["I","II","III"];
const QUEST_TIER_PERIOD_MS = { I:12*3600*1000, II:24*3600*1000, III:3*24*3600*1000 };
const QUEST_ACCEPT_WINDOW_MS = 24*3600*1000;
const QUEST_REWARD = { I:50, II:75, III:125 };           // flat cash per tier
// lifetime counters on the player doc that quests count off (progress = counter now - counter at accept)
const QUEST_COUNTER = { mine:"miningXp", fish:"fishingXp", forage:"foragingXp", shop:"shopBought",
                        craft:"craftCount", plant:"plantCount", harvest:"harvestCount", dragon:"dragonClicks" };
// base target per tier [I, II, III] + random spread
const QUEST_TARGETS = { forage:[5,12,30], mine:[4,10,25], fish:[3,7,16], slay:[3,6,14], craft:[2,5,10],
                        plant:[3,6,12], harvest:[3,6,12], dragon:[100,500,1000], obtain:[1,2,3] };
const QUEST_SPREAD  = { forage:4, mine:3, fish:2, slay:2, craft:1, plant:2, harvest:2, dragon:0, obtain:1 };
// "Click the dragon" asks for a random number of clicks inside a range (rounded to the nearest 10)
const DRAGON_CLICK_RANGE = { I:[100,1000], II:[500,5000], III:[1000,10000] };
const QUEST_KINDS = ["forage","mine","fish","slay","craft","farm","dragon","obtain"];
const QUEST_SOURCES = [
  { verb:"foraging", pool:()=>POOLS.forage.green },
  { verb:"fishing",  pool:()=>POOLS.fish.green },
  { verb:"mining",   pool:()=>POOLS.mine.green }
];
const questKindOf = q => ({ plant:"farm", harvest:"farm" })[q.type] || q.type;
const questTarget = (type, tier, rnd)=>{
  if(type==="dragon"){ const [lo,hi] = DRAGON_CLICK_RANGE[tier]; return Math.round((lo + rnd()*(hi-lo))/10)*10; }
  return QUEST_TARGETS[type][QUEST_TIERS.indexOf(tier)] + Math.floor(rnd()*(QUEST_SPREAD[type]+1));
};
function buildQuest(kind, tier, rnd){
  const mk = (type, label, target, extra={})=> ({ tier, type, target, label, moneyReward:QUEST_REWARD[tier], ...extra });
  const n = t=> questTarget(t, tier, rnd);
  switch(kind){
    case "forage": { const k=n("forage"); return mk("forage", `Forage ${k} times`, k); }
    case "mine":   { const k=n("mine");   return mk("mine",   `Mine ${k} times`, k); }
    case "fish":   { const k=n("fish");   return mk("fish",   `Catch ${k} fish`, k); }
    case "slay":   { const k=n("slay");   return mk("slay",   `Slay ${k} enemies`, k); }
    case "craft":  { const k=n("craft");  return mk("craft",  `Craft ${k} item${k===1?"":"s"}`, k); }
    case "farm":   { if(rnd()<.5){ const k=n("plant");   return mk("plant",   `Plant ${k} seeds`, k); }
                     const k=n("harvest"); return mk("harvest", `Harvest ${k} crops`, k); }
    case "dragon": { const k=n("dragon"); return mk("dragon", `Click the dragon ${k.toLocaleString()} times`, k); }
    default: {   // obtain: a likely item from foraging / fishing / mining, a few times
      const src = QUEST_SOURCES[Math.floor(rnd()*QUEST_SOURCES.length)];
      const top = src.pool().slice(0,6);                // pools are sorted most-likely first
      const e = top[Math.floor(rnd()*top.length)], k = n("obtain");
      return mk("obtain", `Obtain ${ITEM_BY_ID[e.id].name} from ${src.verb} ${k} time${k===1?"":"s"}`, k, { itemId:e.id });
    }
  }
}
/* Each tier walks its own shuffled "deck" of the 8 quest kinds (one card per rotation period),
   so a kind never repeats until the whole deck has been used, and never twice in a row
   across a deck boundary. */
function questDeck(tier, cycle){
  const rnd = seededRand(cycle*7919 + tier.charCodeAt(0)*17 + tier.length*131 + 12345); rnd(); rnd();
  const d = QUEST_KINDS.map((_,i)=>i);
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  if(cycle>0 && d[0]===questDeck(tier,cycle-1)[QUEST_KINDS.length-1]) [d[0],d[1]]=[d[1],d[0]];
  return d;
}
/* `taken` = kinds already in use by an accepted quest or an earlier tier's offer, so the three
   slots are always three different kinds of quest. */
function offeredQuestFor(tier, taken=new Set()){
  const len = QUEST_KINDS.length, period = Math.floor(Date.now()/QUEST_TIER_PERIOD_MS[tier]);
  let k = questDeck(tier, Math.floor(period/len))[period%len];
  for(let i=0;i<len && taken.has(QUEST_KINDS[k]); i++) k = (k+1)%len;
  const rnd = seededRand(period*104729 + tier.charCodeAt(0)*7919 + k*31 + 7); rnd(); rnd();
  return buildQuest(QUEST_KINDS[k], tier, rnd);
}
function questProgress(quest, p){
  if(quest.type==="gather") return Math.max(0, (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty - quest.baseline || 0);   // legacy
  if(quest.type==="money") return Math.max(0, p.money - quest.baseline);                                                       // legacy
  if(quest.type==="slay") return Math.max(0, (p.monstersKilled||0) - quest.baseline);
  if(quest.type==="obtain") return Math.max(0, ((p.finds||{})[quest.itemId]||0) - quest.baseline);
  if(QUEST_COUNTER[quest.type]) return Math.max(0, (p[QUEST_COUNTER[quest.type]]||0) - quest.baseline);
  return 0;
}
function questBaseline(quest, p){
  if(quest.type==="gather") return (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty || 0;
  if(quest.type==="money") return p.money||0;
  if(quest.type==="slay") return p.monstersKilled||0;
  if(quest.type==="obtain") return (p.finds||{})[quest.itemId]||0;
  if(QUEST_COUNTER[quest.type]) return p[QUEST_COUNTER[quest.type]]||0;
  return 0;
}
const questOfferCache = {};
/* Active quests live in memory, kept fresh by a listener that starts at login, and the offers are computed
   locally — so the Quests tab draws instantly instead of waiting on three database reads. */
let questDocs = {}, questUnsub = null;
const questBusy = {};
function startQuestListener(){
  if(questUnsub) questUnsub();
  questUnsub = onSnapshot(collection(db,"players",state.uid,"quests"), snap=>{
    const next = {}; snap.forEach(d=>{ next[d.id] = d.data(); });
    questDocs = next;
    if(document.getElementById("journalModal")?.classList.contains("active")) renderQuests();
  }, err=> console.error(err));
  state.unsubs.push(()=>{ if(questUnsub){ questUnsub(); questUnsub = null; } questDocs = {}; });
}
function renderQuests(){
  const list = document.getElementById("questList"); if(!list) return;
  const p = state.profile; if(!p) return;
  const slots = QUEST_TIERS.map((tier,i)=>{
    const slotKey = `slot${i+1}`;
    let quest = questDocs[slotKey] || null;
    if(quest && Date.now() >= quest.deadlineAt) quest = null;      // 24h window is up — the slot is free (acceptQuest overwrites it)
    return { slotKey, quest, tier };
  });
  const taken = new Set(slots.filter(s=>s.quest).map(s=>questKindOf(s.quest)));
  const rows = slots.map(s=>{
    if(s.quest) return renderActiveSlotRow(s.slotKey, s.quest, p);
    const q = offeredQuestFor(s.tier, taken);
    taken.add(questKindOf(q)); questOfferCache[s.slotKey] = q;
    return renderEmptySlotRow(s.slotKey, q);
  });
  list.innerHTML = rows.join("");
  list.querySelectorAll("[data-quest-accept]").forEach(btn=>{
    btn.addEventListener("click", ()=> acceptQuest(btn.dataset.questAccept, btn.dataset.questTier));
  });
  list.querySelectorAll("[data-quest-claim]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ btn.disabled = true; claimQuest(btn.dataset.questClaim); });
  });
}
function renderEmptySlotRow(slotKey, q){
  const tier = q.tier, period = QUEST_TIER_PERIOD_MS[tier];
  const hrsLeft = Math.max(1, Math.round((period - Date.now() % period)/3600000));
  return `<li class="quest-row">
    <div><b>Tier ${tier}:</b> ${escapeHTML(q.label)}</div>
    <div style="font-size:12px">Rerolls in ~${hrsLeft}h if not accepted &middot; Reward: ${q.moneyReward?`$${fmtMoney(q.moneyReward)}`:""}${q.itemRewardId?` + ${q.itemRewardQty}x ${ITEM_BY_ID[q.itemRewardId].name}`:""}</div>
    <button class="doodle-btn btn-sm btn-green" data-quest-accept="${slotKey}" data-quest-tier="${tier}">Accept (24h)</button>
  </li>`;
}
function renderActiveSlotRow(slotKey, quest, p){
  const progress = questProgress(quest, p);
  const done = progress >= quest.target;
  const msLeft = Math.max(0, quest.deadlineAt - Date.now());
  const hrsLeft = Math.floor(msLeft/3600000), minsLeft = Math.floor((msLeft%3600000)/60000);
  return `<li class="quest-row">
    <div><b>Tier ${quest.tier}:</b> ${escapeHTML(quest.label)}</div>
    <div style="font-size:12px">Progress: ${Math.min(progress,quest.target).toLocaleString()}/${quest.target.toLocaleString()} &middot; ${hrsLeft}h ${minsLeft}m left</div>
    ${done && !quest.rewardClaimed
      ? `<button class="doodle-btn btn-sm btn-green" data-quest-claim="${slotKey}">Claim Reward</button>`
      : quest.rewardClaimed
        ? `<div style="font-size:12px">Reward claimed — slot frees up when the 24h window ends.</div>`
        : `<div style="font-size:12px">In progress…</div>`}
  </li>`;
}
/* Accepting is one transaction: it refuses if the slot still holds a live quest, so a stale tab or a double click
   can never overwrite a finished quest with a fresh one (which would let it be claimed twice). */
async function acceptQuest(slotKey, tier){
  if(questBusy[slotKey]) return; questBusy[slotKey] = true;
  try{
    const cached = questOfferCache[slotKey];
    const offered = (cached && cached.tier===tier) ? cached : offeredQuestFor(tier);   // exactly what the player was shown
    const ref = doc(db,"players",state.uid,"quests",slotKey), pref = doc(db,"players",state.uid);
    let quest = null;
    const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
      const cur = await tx.get(ref), cd = cur.exists() ? cur.data() : null;
      if(cd && Date.now() < cd.deadlineAt) throw new Error("That slot already has a quest.");
      const pd = (await tx.get(pref)).data() || {};
      quest = { ...offered, baseline: questBaseline(offered, pd), acceptedAt: Date.now(), deadlineAt: Date.now() + QUEST_ACCEPT_WINDOW_MS, rewardClaimed:false };
      tx.set(ref, quest);
      return true;
    }));
    if(!ok) return;
    questDocs[slotKey] = quest; renderQuests();
    playSfx("send"); toast(`Accepted: ${offered.label}`);
  } finally { questBusy[slotKey] = false; }
}
/* Claiming is ONE transaction that re-checks everything against the saved data: the quest exists, isn't expired,
   hasn't been claimed, and is really finished — then flips rewardClaimed and pays the money together. Rapid clicks,
   two tabs, or a double tap can only ever pay once. */
async function claimQuest(slotKey){
  if(questBusy["claim"+slotKey]) return; questBusy["claim"+slotKey] = true;
  try{
    const qref = doc(db,"players",state.uid,"quests",slotKey), pref = doc(db,"players",state.uid);
    let quest = null;
    const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
      const qs = await tx.get(qref); if(!qs.exists()) throw new Error("That quest is gone.");
      const q = qs.data();
      if(q.rewardClaimed) throw new Error("You already claimed that reward.");
      if(Date.now() >= q.deadlineAt) throw new Error("That quest has expired.");
      const pd = (await tx.get(pref)).data() || {};
      if(questProgress(q, pd) < q.target) throw new Error("That quest isn't finished yet.");
      tx.update(qref, { rewardClaimed:true, claimedAt:Date.now() });
      if(q.moneyReward) tx.update(pref, { money: Math.max(0, (pd.money||0) + q.moneyReward) });
      quest = q; return true;
    }));
    if(!ok){ renderQuests(); return; }
    questDocs[slotKey] = { ...quest, rewardClaimed:true };
    if(quest.itemRewardId) await addItemToInv(quest.itemRewardId, quest.itemRewardQty||1);   // legacy quests only
    toast(`Quest reward claimed!${quest.moneyReward?` +$${fmtMoney(quest.moneyReward)}`:""}`);
    renderQuests();
  } finally { questBusy["claim"+slotKey] = false; }
}


/* =========================================================================
   SKILL TREE (⭐ button next to the Compass)
   Every level = +1 skill token. Own ONE node per row; buying one locks the
   rest of its row and unlocks the next. Tokens left = level − tokens spent.
   ========================================================================= */
/* An account saved on the old 12-row layout owns nothing on the new one until migrateSkillTree() refunds it
   (an account with no nodes needs no migration). */
const skillVerOk = p => (p.skillTreeVer||1) >= SKILL_TREE_VERSION || !(p.skillNodes && p.skillNodes.length);
function ownedSkills(p){ return (p && Array.isArray(p.skillNodes) && skillVerOk(p)) ? p.skillNodes.map(id=>SKILL_BY_ID[id]).filter(Boolean) : []; }
/* One-time, at login: the trees were rebuilt (25 rows, new nodes), so take the old purchases' Max HP / Max Mana
   back off the bars, clear the old nodes and stamp the new version. Every token comes back (tokens = level − spent). */
async function migrateSkillTree(){
  const p = state.profile; if(!p || !p.archetype || (p.skillTreeVer||1) >= SKILL_TREE_VERSION) return;
  let refunded = 0;
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data() || {};
    if((d.skillTreeVer||1) >= SKILL_TREE_VERSION) return true;
    const old = d.skillNodes || []; refunded = old.length;
    let hpDrop = 0, manaDrop = 0;
    old.forEach(id=>{ const c = LEGACY_SKILL_HM[id]; if(!c) return; if(c[0]==="H") hpDrop += +c.slice(1); else manaDrop += +c.slice(1); });
    const hpMax = Math.max(1, (d.hpMax||1) - hpDrop), manaMax = Math.max(0, (d.manaMax||0) - manaDrop);
    tx.update(ref, { skillNodes:[], skillTreeVer:SKILL_TREE_VERSION, hpMax, manaMax, hp:Math.min(d.hp||1, hpMax), mana:Math.min(d.mana||0, manaMax) });
    return true;
  }));
  if(ok && refunded) toast("🌳 The skill trees grew to 25 rows! Your old picks were refunded — spend your ⭐ again.", 9000);
}
function skillDamage(p){ return ownedSkills(p).reduce((a,n)=> a + (n.kind==="D" ? n.val : 0), 0); }
function skillTokensLeft(p){ return Math.max(0, (p.level||1) - ownedSkills(p).reduce((a,n)=>a+n.cost,0)); }
function skillNodeState(p, n){
  const owned = new Set(p.skillNodes||[]);
  if(owned.has(n.id)) return "owned";
  const list = SKILL_NODES[n.el];
  if(list.some(m=>m.row===n.row && owned.has(m.id))) return "locked";            // another node in this row was taken
  if(n.row>1){
    const prev = list.find(m=>m.row===n.row-1 && owned.has(m.id));
    if(!prev) return "locked";                                                  // previous row not bought yet
    if(n.parent && n.parent!==prev.id) return "locked";                         // not on the path you are following
  }
  return "available";
}
let skillSel = null;
const skillOpen = ()=> document.getElementById("skillModal").classList.contains("active");
function updateSkillUI(){
  const p = state.profile; if(!p) return;
  const left = p.archetype ? skillTokensLeft(p) : 0, b = document.getElementById("starBadge");
  if(b){ b.textContent = left; b.style.display = left>0 ? "" : "none"; }
  if(skillOpen()) renderSkillTree();
}
function skillShort(n){
  if(n.kind==="A") return `New attack · ${n.mana} mana`;
  if(n.kind==="L") return `Heal ${n.lo}-${n.hi} HP · ${n.mana} mana · cd ${n.cd}`;
  if(n.kind==="N") return `Restore ${n.lo}-${n.hi} mana · ${n.mana} mana · cd ${n.cd}`;
  return describeSkill(n).replace("Max ","");
}
function renderSkillTree(){
  const p = state.profile; if(!p || !p.archetype) return;
  const el = p.archetype, tree = SKILL_TREES[el], card = document.getElementById("skillCard");
  card.className = `modal-card doodle-panel skill-card sk-${el}`;
  document.getElementById("skillTitle").textContent = `${tree.icon} ${tree.title}`;
  document.getElementById("skillSub").textContent = tree.sub;
  document.getElementById("skillTokens").textContent = `⭐ ${skillTokensLeft(p)}`;
  document.getElementById("skillReset").style.display = (p.username||"").toLowerCase()==="vortarium" ? "" : "none";
  const scroll = document.getElementById("skillScroll"), keep = scroll.scrollTop, board = document.getElementById("skillBoard");
  board.innerHTML = '<svg class="sk-lines" id="skLines"></svg>';
  tree.rows.forEach((_, r)=>{
    const row = document.createElement("div"); row.className = "sk-row";
    const nm = tree.rowNames[r+1];
    row.innerHTML = `<div class="sk-rowlabel">ROW ${r+1}${nm ? " — "+nm : ""}</div>`;
    const box = document.createElement("div"); box.className = "sk-nodes";
    SKILL_NODES[el].filter(n=>n.row===r+1).forEach(n=>{
      const st = skillNodeState(p, n), b = document.createElement("button");
      b.className = `sk-node ${st}${isSpellNode(n)?" attack":""}${skillSel===n.id?" sel":""}`; b.dataset.node = n.id;
      b.innerHTML = `<b>${n.name}</b><span>${skillShort(n)}</span><em>${st==="owned" ? "✔ owned" : n.cost+" ⭐"}</em>`;
      b.addEventListener("click", ()=>{ skillSel = n.id; renderSkillTree(); });
      box.appendChild(b);
    });
    row.appendChild(box); board.appendChild(row);
  });
  scroll.scrollTop = keep;
  drawSkillLines(el);
  renderSkillDetail();
}
function drawSkillLines(el){
  const board = document.getElementById("skillBoard"), svg = document.getElementById("skLines"); if(!board||!svg) return;
  const br = board.getBoundingClientRect(); if(!br.width) return;
  const owned = new Set(state.profile.skillNodes||[]), at = id=> board.querySelector(`[data-node="${id}"]`), list = SKILL_NODES[el];
  let out = "";
  // The path reconnects to whatever you chose: from your pick in a row to your pick (solid) or to the choices you can still make (dashed) in the next row.
  list.forEach(n=>{
    const prev = list.find(m=>m.row===n.row-1 && owned.has(m.id)); if(!prev) return;
    const st = skillNodeState(state.profile, n); if(st==="locked") return;
    const a = at(prev.id), b = at(n.id); if(!a||!b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), hot = st==="owned";
    out += `<line x1="${ra.left+ra.width/2-br.left}" y1="${ra.bottom-br.top}" x2="${rb.left+rb.width/2-br.left}" y2="${rb.top-br.top}" stroke="#4A3F35" stroke-width="${hot?5:2.5}" stroke-dasharray="${hot?"":"6 6"}" opacity="${hot?0.9:0.4}"/>`;
  });
  svg.innerHTML = out;
}
function renderSkillDetail(){
  const p = state.profile, d = document.getElementById("skillDetail"), n = skillSel && SKILL_BY_ID[skillSel];
  if(!n || n.el!==p.archetype){ d.textContent = "Tap a node to read what it does. You can only follow one path — one node per row."; return; }
  const st = skillNodeState(p, n), left = skillTokensLeft(p);
  let note = st==="owned" ? "You own this node." : st==="locked" ? "Locked — you can only take one node per row, and you can\'t go back to earlier rows."
           : left<n.cost ? `Not enough tokens — you have ${left}, need ${n.cost}.` : "Ready to unlock.";
  d.innerHTML = `<div><div class="sd-name">${n.name}</div><div>${describeSkill(n)}</div><div class="sd-note">Cost: ${n.cost} ⭐ · Row ${n.row} · ${note}</div></div>`;
  if(st==="available"){
    const btn = document.createElement("button"); btn.className = "doodle-btn btn-green"; btn.textContent = `Unlock (${n.cost} ⭐)`; btn.disabled = left<n.cost;
    btn.addEventListener("click", ()=> buySkill(n)); d.appendChild(btn);
  }
}
async function buySkill(n){
  await withErrorToast(async ()=>{
    const ref = doc(db,"players",state.uid);
    await runTransaction(db, async tx=>{
      const snap = await tx.get(ref), p = snap.data();                       // re-check against the saved data, not the screen
      if(p.archetype!==n.el) throw new Error("That node is not in your archetype's tree.");
      if(!skillVerOk(p)) throw new Error("Your skill tree is still being upgraded — try again in a moment.");
      if(skillNodeState(p, n)!=="available") throw new Error("That node is locked.");
      if(skillTokensLeft(p) < n.cost) throw new Error("Not enough skill tokens.");
      const u = { skillNodes: [ ...(p.skillNodes||[]), n.id ], skillTreeVer: SKILL_TREE_VERSION };
      if(n.kind==="S"){                                                     // +1/+2 SPEED / STRENGTH / CHARM / SMARTS
        const st = { ...(p.stats||{}) }; st[n.stat] = (st[n.stat]||0) + n.val; u.stats = st;
        if(n.stat==="SMARTS"){ u.rageMax = rageMaxFor(p.level, p.archetype, st.SMARTS); u.rage = Math.min(p.rage||0, u.rageMax); }
      }
      if(n.kind==="H"){ u.hpMax = p.hpMax+n.val; u.hp = Math.min(u.hpMax, p.hp+n.val); }
      if(n.kind==="M"){ u.manaMax = p.manaMax+n.val; u.mana = Math.min(u.manaMax, p.mana+n.val); }
      tx.update(ref, u);
    });
    playSfx("buy");
    toast(isSpellNode(n) ? `⚔️ New attack unlocked: ${n.name}!` : `⭐ Unlocked ${n.name} (${describeSkill(n)})`);
  });
}
/* Refund everything: clears the nodes, takes the HP/Mana they gave back off the max bars, and (for the Rebirth item) uses one up. */
async function resetSkillTree({ consumeItem=false }={}){
  if(state.battle){ toast("Finish your battle first."); return; }
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data() || {};
    const nodes = ownedSkills(d); if(!nodes.length) throw new Error("Your skill tree is already empty.");
    const hpDrop = nodes.reduce((a,n)=>a+(n.kind==="H"?n.val:0),0), manaDrop = nodes.reduce((a,n)=>a+(n.kind==="M"?n.val:0),0);
    const upd = { skillNodes:[], skillTreeVer:SKILL_TREE_VERSION, hpMax:Math.max(1,(d.hpMax||1)-hpDrop), manaMax:Math.max(0,(d.manaMax||0)-manaDrop) };
    upd.hp = Math.min(d.hp||1, upd.hpMax); upd.mana = Math.min(d.mana||0, upd.manaMax);
    const statNodes = nodes.filter(n=>n.kind==="S");
    if(statNodes.length){                                                   // take the stat boosts back off too
      const st = { ...(d.stats||{}) }; statNodes.forEach(n=>{ st[n.stat] = (st[n.stat]||0) - n.val; }); upd.stats = st;
      if(d.archetype){ upd.rageMax = rageMaxFor(d.level, d.archetype, st.SMARTS); upd.rage = Math.min(d.rage||0, upd.rageMax); }
    }
    if(consumeItem){
      const inv = (d.inventory||[]).map(e=>({...e})), i = inv.findIndex(e=>e.itemId==="rebirth_scroll");
      if(i<0 || inv[i].qty<1) throw new Error("insufficient-item:rebirth_scroll");
      inv[i].qty -= 1; upd.inventory = inv.filter(e=>e.qty>0);
    }
    tx.update(ref, upd);
  }));
  if(ok!==null){ skillSel = null; playSfx("levelup"); toast("✨ Skill tree reset — all your skill tokens are refunded!"); }
}
document.getElementById("skillReset").addEventListener("click", ()=>{
  if((state.profile?.username||"").toLowerCase()!=="vortarium") return;
  dgConfirm({ title:"Reset skill tree?", yes:"Reset & refund", danger:false, html:"<p>Refund every skill point and reset the tree to the top?</p>", onYes:()=> resetSkillTree() });
});
document.getElementById("btnSkills").addEventListener("click", ()=>{
  if(!state.profile || !state.profile.archetype){ toast("Pick an archetype first."); return; }
  openModal("skillModal"); renderSkillTree();
});
window.addEventListener("resize", ()=>{ if(skillOpen()) renderSkillTree(); });

/* =========================================================================
   COMPASS: MAP / SHOP / CHAT / AUCTION / BATTLE / CRAFT
   ========================================================================= */
document.getElementById("btnCompass").addEventListener("click", ()=>{
  openModal("compassModal"); renderRegionGrid(); renderShop(); renderAuction(); renderCraftInv();
  if(dgActive()) document.querySelector('[data-ctab="craft"]').click();   // dungeon: land on a tab that still works
});
document.querySelectorAll("[data-ctab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    if(dgActive() && DG_LOCKED_TABS.includes(btn.dataset.ctab)){ toast("🖍️ The dungeon has scribbled over this part of your compass."); return; }
    document.querySelectorAll("[data-ctab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".ctab-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("ctab-"+btn.dataset.ctab).classList.add("active");
    if(btn.dataset.ctab==="chat"){ ensureChatSubscriptions(); setTimeout(focusVisibleChat,0); }
    if(btn.dataset.ctab==="farm") loadFarm();
  });
});

/* --- map --- */
/* --- map: now doubles as fast-travel — clicking a region teleports you
   into that quadrant instead of just flipping a cosmetic field, since your
   region is normally whatever quadrant your live x/y position is in. --- */
function renderRegionGrid(){
  const grid = document.getElementById("regionGrid");
  grid.innerHTML="";
  Object.entries(REGIONS).forEach(([key,r])=>{
    const card = document.createElement("div");
    card.className = `region-card ${r.css}-c` + (state.profile.region===key? " current":"");
    card.innerHTML = `<div style="font-size:30px">${{forest:"🌲",mountains:"⛰️",volcano:"🌋",reef:"🪸"}[key]}</div><div>${r.name}</div>`;
    card.addEventListener("click", async ()=>{
      if(dgActive()){ toast("🕯️ There is no map down here."); return; }
      if(state.profile.region===key) return;
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { region:key }));
      renderRegionGrid(); renderShop();
      toast(`Traveled to ${r.name}`);
    });
    grid.appendChild(card);
  });
}

/* --- shop ---
   Each regional shop stocks 6 items that rotate every day (seeded by the date +
   region, so the stock is stable across reloads on the same day):
     5 random items from that region's element pool + 1 seed packet.
   Backpacks (permanent inventory upgrades) rarely take over a slot — higher
   tiers are rarer. Job + farm tools live on the tool shelf. Click an item to
   read about it, then press Buy in the detail box. */
const SHOP_SIZE = 8;
const SEED_ROLL = { common:.40, uncommon:.28, rare:.18, epic:.10, legendary:.04 };
const LUCK_SHOP_ODDS = { 3:.03, 2:.06, 1:.12 };
const BACKPACK_ODDS = { 5:.02, 4:.04, 3:.06, 2:.09, 1:.12 };
/* Everything daily (shop stock for ALL regions + the Dailies path) rolls over at 12:00am US Eastern time,
   for every player no matter where they live. (America/New_York, so it follows EST/EDT.) */
const ET_DATE = new Intl.DateTimeFormat("en-CA", { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" });
const ET_CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone:"America/New_York", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" });
const dayIndex = ()=>{ const [y,m,d] = ET_DATE.format(new Date()).split("-").map(Number); return Math.floor(Date.UTC(y,m-1,d)/86400000); };
const msUntilEtMidnight = ()=>{ const [h,m,sec] = ET_CLOCK.format(new Date()).split(":").map(Number); return 86400000 - ((h*60+m)*60+sec)*1000; };
/* Weapons/armor now come from the GEAR section of rpg_content.js. The old procedural itm_weapon_* / itm_armor_* items
   stay registered so existing inventories keep working, but they no longer appear in shops or drops. */
const isGearItem = i=> i.type==="weapon" || i.type==="armor";
const shopPool = el=> [...ITEM_BANK.filter(i=> i.element===el && !isGearItem(i)), ...CATALOG.gearAll.map(id=>ITEM_BY_ID[id]).filter(i=>i.element===el)];
const lootWeight = it=> isGearItem(it) ? (GEAR_SHOP_WEIGHT[it.rarity]||1) : 1;
function weightedShuffle(list, rnd=Math.random){      // rarer gear sinks toward the bottom of the shuffled list
  return list.map(it=>({ it, k: -Math.log(Math.max(1e-9,rnd()))/lootWeight(it) })).sort((x,y)=>x.k-y.k).map(x=>x.it);
}
let shopStockCache = { day:-1, stock:null };
function shopStock(){
  const day = dayIndex();
  if(shopStockCache.day===day) return shopStockCache.stock;
  const used = new Set(), stock = {};
  Object.keys(REGIONS).forEach((region, ri)=>{
    const rnd = seededRand(day*7919 + ri*104729 + 31); rnd(); rnd(); rnd();
    const pool = weightedShuffle(shopPool(REGIONS[region].element), rnd);
    const items = [];
    for(const it of pool){ if(items.length >= SHOP_SIZE-1) break; if(used.has(it.name)) continue; used.add(it.name); items.push(it); }
    // seed slot: pick a rarity by weight, then one of that rarity's 6 seed packets
    let r = rnd(), rar = "common";
    for(const k of RARITIES){ r -= SEED_ROLL[k]; if(r<=0){ rar = k; break; } rar = k; }
    const seeds = SEED_ITEMS.filter(s=>s.rarity===rar);
    items.push(seeds[Math.floor(rnd()*seeds.length)]);
    // a backpack may rarely replace one regular slot
    for(let t=5;t>=1;t--){ if(rnd() < BACKPACK_ODDS[t]){ items[SHOP_SIZE-2] = ITEM_BY_ID["backpack_"+t]; break; } }
    // Rebirth: rarely shows up (any day, any region) in place of the first slot
    if(rnd() < 0.07) items[0] = ITEM_BY_ID.rebirth_scroll;
    // Luck potions: rarely replace the middle slot (tier 3 is the rarest)
    for(let t=3;t>=1;t--){ if(rnd() < LUCK_SHOP_ODDS[t]){ items[2] = ITEM_BY_ID["potion_luck_"+t]; break; } }
    stock[region] = items;
  });
  shopStockCache = { day, stock };
  return stock;
}
function shopItemsForRegion(){ return shopStock()[state.profile.region] || []; }
let shopSel = null, shopTab = "market", shopCat = "gradient", shopPage = 0;
const SHOP_PER_PAGE = 12;                                           // 3 rows x 4 columns per page
/* Tools tab: the full pickaxe + fishing-rod ladder, then the 5 tiers of hoes and watering cans */
const SHOP_TOOL_IDS = [...["pickaxe","fishingrod"].flatMap(k=> TOOL_LADDER.map(t=>jobToolId(k,t[0]))), ...FARM_TOOLS.map(t=>t.id)].filter(id=>ITEM_BY_ID[id]);
const cosOwned = ()=> state.profile?.cosmetics || [];
/* Rotating cosmetics: each day (12am ET) a fixed handful of the rotating pool is on sale — 4 gradients, 3 fonts, 2 reactions. Same in every region. */
const ROT_PER_DAY = { gradient:4, font:3, reaction:2 };
function rotatingToday(kind){
  const pool = ALL_COSMETICS.filter(c=>c.kind===kind && c.rot), rnd = seededRand(dayIndex()*104729 + kind.length*7919 + 11); rnd(); rnd();
  const a = [...pool]; for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a.slice(0, ROT_PER_DAY[kind]||0);
}
const cosCategory = ()=>{ const today = new Set(rotatingToday(shopCat).map(c=>c.id)); return ALL_COSMETICS.filter(c=> c.kind===shopCat && (!c.rot || today.has(c.id))); };
function shopList(){
  if(shopTab==="tools") return SHOP_TOOL_IDS.map(id=>({ id, kind:"item", it:ITEM_BY_ID[id] }));
  if(shopTab==="cosmetics") return cosCategory().map(c=>({ id:c.id, kind:"cosmetic", c }));
  return shopItemsForRegion().map(it=>({ id:it.id, kind:"item", it }));
}
function selectShopItem(id){ shopSel = id; renderShop(); }
function renderShopDetail(){
  const box = document.getElementById("shopDetail"), entry = shopList().find(e=>e.id===shopSel);
  if(!entry){ shopSel = null; box.innerHTML = "Select an item to see what it does."; return; }
  if(entry.kind==="cosmetic"){
    const c = entry.c, owned = cosOwned().includes(c.id);
    const preview = c.kind==="gradient" ? `<div class="cz-preview" style="background:${c.css}">Your profile &amp; chat bubbles</div>`
      : c.kind==="font" ? `<div class="cz-preview" style="font-family:${c.family}">The quick brown dragon jumps over the lazy knight</div>`
      : `<div class="cz-preview" style="font-size:40px">${c.emoji}</div>`;
    box.innerHTML = `<b>${escapeHTML(c.name)}</b> <i>(${c.kind==="gradient"?"profile gradient":c.kind==="font"?"font":"boss reaction"})</i><br>${preview}` +
      (owned ? `<b>✅ Owned</b>${c.kind==="reaction"?" — it's on your reaction bar.":" — equip it from Customize on your own profile."}` : `<div style="margin-top:8px"><button class="doodle-btn btn-green" id="btnShopBuy">Buy ($${fmtMoney(c.price)})</button></div>`);
    document.getElementById("btnShopBuy")?.addEventListener("click", ()=> buyCosmetic(c));
    return;
  }
  const it = entry.it;
  box.innerHTML = `<b>${escapeHTML(it.name)}</b> <i>(${it.rarity})</i><br>${escapeHTML(it.desc||"")}<br><b>${escapeHTML(itemEffectText(it))}</b>` +
    (it.type==="backpack"||it.type==="rebirth" ? "" : `<br><small>Sells back for $${fmtMoney(it.sellPrice||0)}</small>`) +
    `<div style="margin-top:8px"><button class="doodle-btn btn-green" id="btnShopBuy">Buy ($${fmtMoney(it.price)})</button>` +
    (it.type==="backpack"||it.type==="rebirth" ? "" : ` <button class="doodle-btn btn-green" id="btnShopBuy10">Buy 10 ($${fmtMoney(it.price*10)})</button>`) + `</div>`;
  document.getElementById("btnShopBuy").addEventListener("click", ()=> buyItem(it));
  document.getElementById("btnShopBuy10")?.addEventListener("click", ()=> buyItem(it, 10));
}
function renderShop(){
  const label = document.getElementById("shopRegionLabel");
  label.textContent = shopTab==="market" ? `${REGIONS[state.profile.region].name} Market — ${SHOP_SIZE} items, new stock every day at 12am ET`
    : shopTab==="tools" ? "Tools — job tools & farming tools, every rarity" : "Cosmetics — permanent once bought. 🔄 items rotate daily at 12am ET (same in every region)";
  document.querySelectorAll("[data-shoptab]").forEach(b=> b.classList.toggle("active", b.dataset.shoptab===shopTab));
  const catRow = document.getElementById("shopCatRow"); catRow.style.display = shopTab==="cosmetics" ? "" : "none";
  catRow.querySelectorAll("[data-shopcat]").forEach(b=> b.classList.toggle("selected", b.dataset.shopcat===shopCat));
  const list = shopList(), pages = Math.max(1, Math.ceil(list.length/SHOP_PER_PAGE));
  shopPage = Math.min(shopPage, pages-1);
  const grid = document.getElementById("shopGrid"); grid.innerHTML = "";
  list.slice(shopPage*SHOP_PER_PAGE, shopPage*SHOP_PER_PAGE+SHOP_PER_PAGE).forEach(e=>{
    const cell = document.createElement("div");
    cell.className = "shop-cell" + (shopSel===e.id ? " selected" : "");
    if(e.kind==="cosmetic"){
      const c = e.c, owned = cosOwned().includes(c.id);
      cell.innerHTML = `<b style="${c.kind==="font"?`font-family:${c.family}`:""}">${c.kind==="reaction"?c.emoji+" ":""}${escapeHTML(c.name)}</b>` +
        (c.rot ? `<span>🔄 today only</span>` : "") + (c.kind==="gradient" ? `<span class="cz-swatch" style="background:${c.css}"></span>` : "") + `<span>${owned ? "✅ Owned" : "$"+fmtMoney(c.price)}</span>`;
    } else cell.innerHTML = `<b>${escapeHTML(e.it.name)}</b><span>${e.it.rarity}</span><span>$${fmtMoney(e.it.price)}</span>`;
    cell.addEventListener("click", ()=> selectShopItem(e.id));
    grid.appendChild(cell);
  });
  document.getElementById("shopPageLabel").textContent = `Page ${shopPage+1}/${pages}`;
  document.getElementById("shopPrev").disabled = shopPage<=0; document.getElementById("shopNext").disabled = shopPage>=pages-1;
  renderShopDetail();
}
document.querySelectorAll("[data-shoptab]").forEach(b=> b.addEventListener("click", ()=>{ shopTab = b.dataset.shoptab; shopPage = 0; shopSel = null; renderShop(); }));
document.querySelectorAll("[data-shopcat]").forEach(b=> b.addEventListener("click", ()=>{ shopCat = b.dataset.shopcat; shopPage = 0; shopSel = null; renderShop(); }));
document.getElementById("shopPrev").addEventListener("click", ()=>{ shopPage = Math.max(0, shopPage-1); renderShop(); });
document.getElementById("shopNext").addEventListener("click", ()=>{ shopPage++; renderShop(); });

/* ---- cosmetics: buying, equipping, applying ---- */
async function buyCosmetic(c){
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data() || {}, have = d.cosmetics || [];
    if(have.includes(c.id)) throw new Error("cosmetic-owned");
    if((d.money||0) < c.price) throw new Error("nomoney");
    tx.update(ref, { money:(d.money||0)-c.price, cosmetics:[...have, c.id], shopBought:(d.shopBought||0)+1 });
  }));
  if(ok!==null){ playSfx("buy"); toast(`🎨 Unlocked ${c.name}!`); renderShop(); renderReactionBar(); }
}
function renderReactionBar(){
  const row = document.querySelector(".rx-row"); if(!row || !state.profile) return;
  const have = ownedReactions(cosOwned());
  row.querySelectorAll(".rx-extra").forEach(b=>b.remove());
  have.forEach(e=>{ const b = document.createElement("button"); b.className = "rx-btn rx-extra"; b.dataset.rx = e; b.textContent = e; b.addEventListener("click", ()=> sendReaction(b)); row.appendChild(b); });
}
async function equipCosmetic(field, id){
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { [field]: id }));
  renderCustomize();
}
function renderCustomize(){
  const own = cosOwned(), p = state.profile;
  const chip = (c, field, cur)=> `<button class="doodle-btn btn-sm${cur===c.id?" selected":""}" data-eq="${field}:${c.id}" style="${c.css?`background:${c.css}`:""}${c.family?`;font-family:${c.family}`:""}">${escapeHTML(c.name)}</button>`;
  document.getElementById("czGradients").innerHTML = `<button class="doodle-btn btn-sm${!p.gradient?" selected":""}" data-eq="gradient:">Default</button>` + GRADIENTS.filter(g=>own.includes(g.id)).map(g=>chip(g,"gradient",p.gradient)).join("");
  document.getElementById("czFonts").innerHTML = `<button class="doodle-btn btn-sm${!p.font?" selected":""}" data-eq="font:">Default</button>` + FONTS.filter(f=>own.includes(f.id)).map(f=>chip(f,"font",p.font)).join("");
  document.querySelectorAll("[data-eq]").forEach(b=> b.addEventListener("click", ()=>{ const [f,id] = b.dataset.eq.split(":"); equipCosmetic(f, id); }));
}
document.getElementById("btnCustomize").addEventListener("click", ()=>{ renderCustomize(); openModal("customizeModal"); });
async function buyBackpack(item){
  const t = item.tier;
  const ok = await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data() || {}, cur = d.backpackTier||0;
    if(t <= cur) throw new Error("backpack-owned");
    if(t !== cur+1) throw new Error("backpack-order:"+(cur+1));
    if((d.money||0) < item.price) throw new Error("nomoney");
    tx.update(ref, { money:(d.money||0)-item.price, backpackTier:t, shopBought:(d.shopBought||0)+1 });
  }));
  if(ok!==null){ playSfx("buy"); toast(`🎒 Backpack upgraded! You now have ${BACKPACK_SLOTS[t]} inventory slots.`, 5000); renderShop(); }
}
async function buyItem(item, qty=1){
  if(item.type==="backpack") return buyBackpack(item);
  const cost = item.price*qty;
  if(state.profile.money < cost){ toast("Not enough money!"); return; }
  // charge + add in ONE transaction; refused if there is no free slot
  const ok = await applyInvChanges({ add:[{itemId:item.id, qty}], strict:true }, d=>{
    if((d.money||0) < cost) throw new Error("nomoney");
    return { money:(d.money||0)-cost, shopBought:(d.shopBought||0)+qty };   // shopBought feeds shopping sidequests
  });
  if(ok===null) return;
  playSfx("buy");
  toast(qty>1 ? `Bought ${qty}x ${item.name} for $${fmtMoney(cost)}` : `Bought ${item.name}`);
  renderShopDetail();
}


/* =========================================================================
   FARMING — 3x3 plots. Hoe tills (3 days of usable soil), watering can waters
   (8h of water), seeds grow only while the plot is tilled AND watered.
   While dry, growth pauses and a decay timer runs; re-watering resets+pauses
   it; if decay hits 0 the plant dies. A fully grown plant's decay timer runs
   no matter what, so harvest quickly. When soil crumbles the plot (and anything
   in it) is lost. Plot state is simulated lazily from timestamps, so it keeps
   progressing while you're away.
   ========================================================================= */
const FARM_PLOTS = 9, TILL_MS = 3*24*3600*1000, WET_MS = 8*3600*1000, HOUR_MS = 3600*1000;
const emptyPlot = ()=>({ tillUntil:0, wetUntil:0, plant:null, t:Date.now() });
const farm = { plots:null, mode:"inspect", seed:null, sel:null, busy:false, loaded:false, built:false, seedSig:"" };
const farmRef = ()=> doc(db,"players",state.uid,"farm","plots");
const farmTabVisible = ()=> document.getElementById("compassModal").classList.contains("active") && document.getElementById("ctab-farm").classList.contains("active");

// Advance one plot from plot.t to `now`, respecting every boundary (water drying, soil crumbling, growth finishing, decay running out).
function simPlot(plot, now){
  const ev = [], pl = JSON.parse(JSON.stringify(plot||emptyPlot()));
  let t = pl.t || now, guard = 0;
  while(t < now && guard++ < 60){
    if(!pl.tillUntil){ t = now; break; }                       // untilled ground: nothing happens
    if(pl.tillUntil <= t){ ev.push({ type:"crumbled", had:!!pl.plant }); pl.tillUntil = 0; pl.wetUntil = 0; pl.plant = null; t = now; break; }
    const wet = t < (pl.wetUntil||0), p = pl.plant;
    let next = Math.min(now, pl.tillUntil), mode = "idle";
    if(wet && pl.wetUntil > t) next = Math.min(next, pl.wetUntil);
    if(p){
      if(p.ready){ mode = "decay"; next = Math.min(next, t + p.decayLeft); }          // ripe: decays regardless of water
      else if(wet){ mode = "grow"; p.decayLeft = p.decayMs; next = Math.min(next, t + p.growLeft); }   // watered: grows, decay reset + paused
      else { mode = "decay"; next = Math.min(next, t + p.decayLeft); }                // dry: growth paused, decay runs
    }
    const dt = next - t;
    if(mode==="grow") p.growLeft -= dt; else if(mode==="decay") p.decayLeft -= dt;
    t = next;
    if(p && mode==="grow" && p.growLeft <= 0){ p.growLeft = 0; p.ready = true; p.decayLeft = p.decayMs; ev.push({ type:"ready" }); }
    if(p && mode==="decay" && p.decayLeft <= 0){ ev.push({ type: p.ready ? "rotted" : "withered" }); pl.plant = null; }
  }
  if(pl.tillUntil && pl.tillUntil <= now){ ev.push({ type:"crumbled", had:!!pl.plant }); pl.tillUntil = 0; pl.wetUntil = 0; pl.plant = null; }
  pl.t = now;
  return { plot:pl, ev };
}
function simAll(plots, now){
  const ev = [], out = plots.map((p,i)=>{ const r = simPlot(p, now); r.ev.forEach(e=>ev.push({ ...e, idx:i })); return r.plot; });
  return { plots:out, ev };
}
function announceFarmEvents(ev){
  const msgs = ev.map(e=>{
    const n = e.idx+1;
    if(e.type==="ready") return `🧺 Plot ${n} is ready to harvest!`;
    if(e.type==="withered") return `🥀 The plant on plot ${n} withered — it was left dry too long.`;
    if(e.type==="rotted") return `🥀 The plant on plot ${n} rotted — it wasn't harvested in time.`;
    if(e.type==="crumbled") return `🟫 Plot ${n}'s soil crumbled away${e.had?" and its plant was lost":""}. Re-till plots before 3 days pass!`;
    return "";
  }).filter(Boolean);
  msgs.slice(0,4).forEach((m,i)=> setTimeout(()=> toast(m, 6000), i*400));
  if(msgs.length>4) setTimeout(()=> toast(`…and ${msgs.length-4} more farm updates.`, 5000), 1700);
}
async function persistFarm(){ await setDoc(farmRef(), { plots:farm.plots }).catch(()=>{}); }
async function loadFarm(){
  if(!state.uid) return;
  const snap = await getDoc(farmRef()).catch(()=>null);
  let plots = snap?.exists() && Array.isArray(snap.data().plots) ? snap.data().plots : [];
  while(plots.length < FARM_PLOTS) plots.push(emptyPlot());
  const r = simAll(plots.slice(0,FARM_PLOTS), Date.now());
  farm.plots = r.plots; farm.loaded = true;
  if(r.ev.length){ announceFarmEvents(r.ev); persistFarm(); }
  renderFarm();
}
// Runs fn(plots, now) against the latest saved + simulated plots inside a transaction and saves the result.
async function farmTx(fn){
  let finalPlots = null;
  try{
    await runTransaction(db, async tx=>{
      const snap = await tx.get(farmRef());
      let plots = snap.exists() && Array.isArray(snap.data().plots) ? snap.data().plots : [];
      while(plots.length < FARM_PLOTS) plots.push(emptyPlot());
      const now = Date.now(), r = simAll(plots.slice(0,FARM_PLOTS), now);
      const out = fn(r.plots, now);
      finalPlots = r.plots;
      tx.set(farmRef(), { plots:finalPlots });
      finalPlots._out = out;
    });
  }catch(e){
    if(String(e.message).startsWith("farm:")) toast(e.message.slice(5)); else toast(friendlyFirebaseError(e));
    return null;
  }
  const out = finalPlots._out; delete finalPlots._out;
  farm.plots = finalPlots;
  return { out };
}
const farmFail = msg=>{ throw new Error("farm:"+msg); };
const farmToolId = kind=> toolIds(kind).find(hasItem);
function farmToolStatus(kind, label){
  const id = farmToolId(kind);
  return id ? `${label}: ${ITEM_BY_ID[id].name} (${(state.profile.toolUses||{})[id] ?? TOOL_USES[id]} uses left)` : `${label}: none — buy one in the Shop`;
}
async function farmDoTill(i){
  if(!farmToolId("hoe")){ toast("You need a hoe — buy one in the Shop."); return false; }
  const r = await farmTx((plots,now)=>{ const p = plots[i]; p.tillUntil = now + TILL_MS; p.t = now; });
  if(!r) return false;
  playSfx("till");
  await useTool("hoe");
  return true;
}
async function farmDoWater(i){
  const cur = farm.plots[i];
  if(!cur.tillUntil){ toast("Till this plot with a hoe first."); return false; }
  if(!farmToolId("can")){ toast("You need a watering can — buy one in the Shop."); return false; }
  const r = await farmTx((plots,now)=>{
    const p = plots[i];
    if(!p.tillUntil) farmFail("That plot's soil has crumbled — till it again first.");
    p.wetUntil = now + WET_MS; p.t = now;
  });
  if(!r) return false;
  await useTool("can");
  return true;
}
function pickCrop(rar){ const a = CROPS_BY_RARITY[rar]; return a[Math.floor(Math.random()*a.length)]; }
function makePlant(seed){
  const rar = seed.farmRarity, int = (a,b)=> a + Math.floor(Math.random()*(b-a+1));
  const growH = seed.random ? 16 + Math.random()*84 : GROW_HOURS[rar][0] + Math.random()*(GROW_HOURS[rar][1]-GROW_HOURS[rar][0]);
  const growMs = Math.round(growH*HOUR_MS), decayMs = DECAY_HOURS[rar]*HOUR_MS;
  let outcome = "real", cropId = seed.cropId, yieldRarity = rar;
  if(seed.random){                                    // good / mid / bad — hidden until harvest
    const [good, mid] = MYSTERY_ODDS[rar], r = Math.random();
    if(r < good){ outcome = "real"; cropId = pickCrop(rar); }
    else if(r < good+mid){ outcome = "mid"; cropId = pickCrop("common"); yieldRarity = "common"; }
    else { outcome = "none"; cropId = null; }
  }
  return { seedId:seed.id, rarity:rar, mystery:!!seed.random, outcome, cropId, yieldRarity, growMs, growLeft:growMs, decayMs, decayLeft:decayMs, ready:false, plantedAt:Date.now() };
}
async function farmDoPlant(i){
  const seed = farm.seed && ITEM_BY_ID[farm.seed];
  if(!seed || !hasItem(seed.id)){ toast("Pick a seed from your inventory first (Plant mode)."); return false; }
  const cur = farm.plots[i], now = Date.now();
  if(!cur.tillUntil) { toast("Till this plot first."); return false; }
  if(!(cur.wetUntil > now)){ toast("Water this plot first — seeds need damp, tilled soil."); return false; }
  if(cur.plant){ toast("Something is already growing here."); return false; }
  const removed = await changeInvQty(seed.id, -1);          // take the seed first
  if(removed===null) return false;
  const r = await farmTx((plots,n)=>{
    const p = plots[i];
    if(!p.tillUntil) farmFail("That plot's soil has crumbled.");
    if(!(p.wetUntil > n)) farmFail("That plot dried out — water it first.");
    if(p.plant) farmFail("Something is already growing here.");
    p.plant = makePlant(seed); p.t = n;
  });
  if(!r){ await addItemToInv(seed.id, 1); return false; }  // put the seed back if planting failed
  updateDoc(doc(db,"players",state.uid), { plantCount: increment(1) }).catch(()=>{});
  playSfx("till");
  toast(`🌱 Planted ${seed.name}.`);
  return true;
}
async function farmDoHarvest(i){
  const cur = farm.plots[i];
  if(!cur.plant){ toast("Nothing is planted here."); return false; }
  if(!cur.plant.ready){ toast("It isn't ready yet."); return false; }
  const cropId = cur.plant.cropId;
  if(cropId && !hasItem(cropId) && invUsed(state.profile.inventory) >= invCap(state.profile)){ toast("Your inventory is full — free a slot first so the harvest isn't lost."); return false; }
  const r = await farmTx((plots,n)=>{
    const p = plots[i].plant;
    if(!p || !p.ready) farmFail("It isn't ready (anymore).");
    const [a,b] = CROP_YIELDS[p.yieldRarity], qty = p.outcome==="none" ? 0 : a + Math.floor(Math.random()*(b-a+1));
    plots[i].plant = null; plots[i].t = n;
    return { cropId:p.cropId, qty, mystery:p.mystery, outcome:p.outcome };
  });
  if(!r) return false;
  const { cropId:cid, qty, mystery, outcome } = r.out;
  playSfx("till");
  if(!qty || !cid){ toast("🥀 The mystery seeds were duds — nothing grew."); return true; }
  const ok = await applyInvChanges({ add:[{ itemId:cid, qty }], strict:true }, { harvestCount: increment(1) });
  if(ok===null) return true;
  const name = ITEM_BY_ID[cid].name;
  toast(`🧺 Harvested ${qty}x ${name}!` + (mystery ? (outcome==="mid" ? " (just a plain crop…)" : " (a real one!)") : ""), 6000);
  return true;
}
async function farmDoDig(i){
  if(!farm.plots[i].plant){ toast("Nothing is planted here."); return false; }
  if(!confirm("Dig up this plant? You won't get anything back.")) return false;
  return !!(await farmTx((plots,n)=>{ plots[i].plant = null; plots[i].t = n; }));
}
async function farmAct(i){
  if(farm.busy || !farm.loaded) return;
  farm.sel = i;
  const mode = farm.mode;
  if(mode==="inspect"){ renderFarm(); return; }
  farm.busy = true;
  try{
    if(mode==="till") await farmDoTill(i);
    else if(mode==="water") await farmDoWater(i);
    else if(mode==="plant") await farmDoPlant(i);
    else if(mode==="harvest") await farmDoHarvest(i);
    else if(mode==="dig") await farmDoDig(i);
  } finally { farm.busy = false; renderFarm(); }
}
async function farmBulk(kind){
  if(farm.busy || !farm.loaded) return;
  farm.busy = true; let n = 0;
  try{
    for(let i=0;i<FARM_PLOTS;i++){
      if(kind==="water" && !farm.plots[i].tillUntil) continue;
      if(!farmToolId(kind==="till"?"hoe":"can")){ toast(`Your ${kind==="till"?"hoe":"watering can"} is used up.`); break; }
      const ok = kind==="till" ? await farmDoTill(i) : await farmDoWater(i);
      if(!ok) break; n++;
    }
    if(n) toast(`${kind==="till"?"⛏️ Tilled":"💧 Watered"} ${n} plot${n===1?"":"s"}.`);
  } finally { farm.busy = false; renderFarm(); }
}
function startPlantingFromInventory(seedId){
  farm.seed = seedId; farm.mode = "plant";
  closeModal("journalModal"); openModal("compassModal");
  document.querySelector('[data-ctab="farm"]').click();
}
function plotView(p, now){
  const pl = p.plant, wet = p.wetUntil > now;
  const out = { cls:"untilled", icon:"⬜", name:"Untilled", lines:[] };
  if(!p.tillUntil) return out;
  out.cls = wet ? "wet" : "dry"; out.icon = wet ? "💧" : "🟫"; out.name = wet ? "Wet soil" : "Dry soil";
  out.lines.push(`Soil ${fmtDur(p.tillUntil-now)}`);
  if(wet) out.lines.push(`💧 ${fmtDur(p.wetUntil-now)}`);
  if(pl){
    const crop = pl.cropId && ITEM_BY_ID[pl.cropId];
    out.name = pl.mystery ? "Mystery plant" : crop.name;
    if(pl.ready){ out.cls = "ready"; out.icon = pl.mystery ? "❓" : crop.emoji; out.lines = [`🧺 Harvest! Rots ${fmtDur(pl.decayLeft)}`, ...out.lines.slice(0,1)]; }
    else if(wet){ out.cls = "growing"; out.icon = pl.mystery ? "🌱" : "🌱"; out.lines = [`Ready in ${fmtDur(pl.growLeft)}${p.wetUntil-now < pl.growLeft ? " (needs water)" : ""}`, ...out.lines]; }
    else { out.cls = "thirsty"; out.icon = "🥀"; out.lines = [`⏸ Paused · dies in ${fmtDur(pl.decayLeft)}`, ...out.lines]; }
  }
  return out;
}
function farmDetailHTML(i, now){
  const p = farm.plots[i]; if(!p) return "";
  const v = plotView(p, now), L = [`<b>Plot ${i+1}</b> — ${v.name}`];
  if(!p.tillUntil) L.push("Untilled ground. Use the 🪓 Hoe to till it (soil lasts 3 days, then crumbles unless you re-till).");
  else {
    L.push(`Soil is tilled — it crumbles in ${fmtDur(p.tillUntil-now)} (tilling again resets it to 3 days).`);
    L.push(p.wetUntil > now ? `💧 Watered — dries out in ${fmtDur(p.wetUntil-now)}.` : "🏜️ Dry — water it (water lasts 8 hours).");
  }
  if(p.plant){
    const pl = p.plant, s = ITEM_BY_ID[pl.seedId];
    L.push(`Planted: ${s.name} (${pl.rarity})${pl.mystery ? " — you won't know what it becomes until harvest." : ""}`);
    if(pl.ready) L.push(`✅ Ready! Harvest it before it rots in ${fmtDur(pl.decayLeft)} (ripe plants decay even when watered).`);
    else if(p.wetUntil > now) L.push(`🌱 Growing — ready in ${fmtDur(pl.growLeft)}${p.wetUntil-now < pl.growLeft ? ", but the water runs out first." : "."}`);
    else L.push(`⏸ Growth paused. It will die in ${fmtDur(pl.decayLeft)} unless you water it (watering resets this).`);
  }
  return L.join("<br>");
}
const FARM_HINT = { inspect:"Click a plot to inspect it.", till:"Hoe: click a plot to till it (1 use each).", water:"Watering can: click a tilled plot to water it (1 use each).",
  plant:"Pick a seed, then click a tilled AND watered empty plot.", harvest:"Click a ripe plot to harvest it.", dig:"Click a plot to dig up its plant." };
function renderFarm(){
  const grid = document.getElementById("farmGrid"); if(!grid || !farm.plots) return;
  const now = Date.now();
  if(!farm.built){
    grid.innerHTML = "";
    for(let i=0;i<FARM_PLOTS;i++){
      const c = document.createElement("div"); c.className = "farm-cell untilled"; c.dataset.i = i;
      c.addEventListener("click", ()=> farmAct(i)); grid.appendChild(c);
    }
    document.querySelectorAll("[data-fmode]").forEach(b=> b.addEventListener("click", ()=>{ farm.mode = b.dataset.fmode; renderFarm(); }));
    document.getElementById("farmTillAll").addEventListener("click", ()=> farmBulk("till"));
    document.getElementById("farmWaterAll").addEventListener("click", ()=> farmBulk("water"));
    document.getElementById("farmSeedSelect").addEventListener("change", e=>{ farm.seed = e.target.value || null; });
    farm.built = true;
  }
  [...grid.children].forEach((c,i)=>{
    const v = plotView(farm.plots[i], now);
    const html = `<div class="fc-icon">${v.icon}</div><div class="fc-name">${escapeHTML(v.name)}</div>${v.lines.map(l=>`<div class="fc-time">${escapeHTML(l)}</div>`).join("")}`;
    if(c._html !== html){ c.innerHTML = html; c._html = html; }
    c.className = `farm-cell ${v.cls}${farm.sel===i?" sel":""}`;
  });
  document.querySelectorAll("[data-fmode]").forEach(b=> b.classList.toggle("active", b.dataset.fmode===farm.mode));
  document.getElementById("farmHint").textContent = FARM_HINT[farm.mode] || "";
  document.getElementById("farmTools").innerHTML = `⛏️ ${escapeHTML(farmToolStatus("hoe","Hoe"))} &nbsp;·&nbsp; 💧 ${escapeHTML(farmToolStatus("can","Can"))}`;
  // seed picker lists every seed in your inventory
  const seeds = invExpanded().filter(e=>e.item.type==="seed"), sig = seeds.map(e=>e.itemId+":"+e.qty).join(",") + "|" + farm.seed;
  const sel = document.getElementById("farmSeedSelect");
  if(farm.seedSig !== sig){
    farm.seedSig = sig;
    if(farm.seed && !seeds.some(e=>e.itemId===farm.seed)) farm.seed = null;
    if(!farm.seed && seeds.length) farm.seed = seeds[0].itemId;
    sel.innerHTML = seeds.length ? seeds.map(e=>`<option value="${e.itemId}"${e.itemId===farm.seed?" selected":""}>${escapeHTML(e.item.name)} (x${e.qty})</option>`).join("") : `<option value="">No seeds in your inventory</option>`;
  }
  sel.style.display = farm.mode==="plant" ? "" : "none";
  document.getElementById("farmDetail").innerHTML = farm.sel!=null ? farmDetailHTML(farm.sel, now) : "Select a plot to see its details.";
}
setInterval(()=>{
  if(!farm.loaded || !state.profile || !farmTabVisible()) return;
  const r = simAll(farm.plots, Date.now());
  farm.plots = r.plots;
  if(r.ev.length){ announceFarmEvents(r.ev); persistFarm(); }
  renderFarm();
}, 1000);

/* =========================================================================
   WORLD RESOURCE GATHERING — foraging, mining, fishing
   These used to be their own tab UIs; now they're triggered by walking up
   to a tree/bush/rocky cliff/pond in the open world and pressing Space.
   The reward math is unchanged from the old tab-based version.
   ========================================================================= */
function jobLog(msg){ toast(msg); const l=document.getElementById("jobLog"); if(l) l.textContent=msg; }
const toolIds = kind=> (kind==="pickaxe"||kind==="fishingrod") ? [...TOOL_LADDER].reverse().map(t=>jobToolId(kind,t[0])) : ["tool_"+kind+"6","tool_"+kind+"5","tool_"+kind+"4","tool_"+kind+"3","tool_"+kind+"2","tool_"+kind];  // best tool is used first
const toolLeft = id => (state.profile.toolUses||{})[id] ?? TOOL_USES[id];
async function useTool(kind, wear=1, extra={}){
  const label = {pickaxe:"Pickaxe",fishingrod:"Fishing Rod",hoe:"Hoe",can:"Watering Can"}[kind]||kind;
  const owned = toolIds(kind).filter(hasItem);                       // best tool first
  if(!owned.length){ toast(`You need a ${label} — buy one in the Shop.`); return false; }
  // A swing needs its FULL durability cost: a tool with 1 use left can't do a 3-durability swing.
  const id = owned.find(t=> toolLeft(t) >= wear);
  if(!id){
    const most = Math.max(...owned.map(toolLeft));
    toast(`Your ${label} only has ${most} durability left — this mode needs exactly ${wear}. Switch to a lower mode.`);
    return false;
  }
  const uses = { ...(state.profile.toolUses||{}) };
  const left = toolLeft(id) - wear;
  if(left<=0){ delete uses[id]; await changeInvQty(id,-1); jobLog(`Your ${ITEM_BY_ID[id].name} broke!`); } else uses[id]=left;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { toolUses: uses, ...extra }));
  return true;
}
function toolUsesLeft(kind){
  const id = toolIds(kind).find(hasItem);
  return id ? `${ITEM_BY_ID[id].name}: ${(state.profile.toolUses||{})[id] ?? TOOL_USES[id]} uses left` : `No ${kind==="pickaxe"?"pickaxe":"fishing rod"}`;
}

/* --- job modes: 🟢 green (normal) / 🟡 yellow (risky) / 🔴 red (extreme). Client-side choice, remembered on this device. --- */
let jobMode = (()=>{ try{ const m = localStorage.getItem("dragoneer_jobmode"); return MODES[m] ? m : "green"; }catch{ return "green"; } })();
const POOLS = { forage:{}, mine:{}, fish:{} };
Object.keys(MODES).forEach(m=>{
  POOLS.forage[m] = buildPool(CATALOG.forage.map(id=>ITEM_BY_ID[id]), RARITY_W.forage[m], "forage"+m);
  POOLS.mine[m]   = buildPool(CATALOG.mineral.map(id=>ITEM_BY_ID[id]), RARITY_W.mine[m], "mine"+m);
  POOLS.fish[m]   = buildPool(CATALOG.fish[FISH_RULES[m].tier].map(id=>ITEM_BY_ID[id]), RARITY_W.fish[m], "fish"+m);
});
function setJobMode(m){
  if(!MODES[m]) return;
  jobMode = m; try{ localStorage.setItem("dragoneer_jobmode", m); }catch{}
  document.querySelectorAll("[data-jmode]").forEach(b=> b.classList.toggle("active", b.dataset.jmode===m));
  const page = document.getElementById("ctab-jobs"); page.dataset.mode = m;
  document.getElementById("jobModeDesc").textContent = `${MODES[m].emoji} ${MODES[m].blurb}`;
  const mr = MINE_RULES[m];
  document.getElementById("btnMine").title = `Uses ${mr.wear} durability`;
  document.getElementById("btnFish").title = `${FISH_RULES[m].tier} fish`;
  tickJobButtons();
}
document.querySelectorAll("[data-jmode]").forEach(b=> b.addEventListener("click", ()=> setJobMode(b.dataset.jmode)));

document.getElementById("btnForage").addEventListener("click", doForageAction);
document.getElementById("btnMine").addEventListener("click", doMineAction);
// The compass has to hide while the fishing minigame is on screen (it would cover it),
// but it comes straight back when the minigame ends so you can keep going.
let fishReopenCompass = false;
function reopenCompassIf(flag){ if(flag && state.profile && !state.battle) openModal("compassModal"); }
document.getElementById("btnFish").addEventListener("click", async ()=>{
  fishReopenCompass = document.getElementById("compassModal").classList.contains("active");
  closeModal("compassModal");
  await doFishAction();
  if(!fishGame){ reopenCompassIf(fishReopenCompass); fishReopenCompass = false; }   // couldn't start (no rod etc.)
});
function tickJobButtons(){
  if(!state.profile) return;
  const r = forageReadyIn(), fb = document.getElementById("btnForage");
  fb.disabled = r>0; fb.textContent = r>0 ? `Forage (${fmtDur(r)})` : "Forage";
  const mr = mineReadyIn(), mb = document.getElementById("btnMine"), fr = fishReadyIn(), fbtn = document.getElementById("btnFish");
  mb.disabled = mr>0; mb.textContent = mr>0 ? `Mine (${fmtDur(mr)})` : (MINE_RULES[jobMode].wear>1 ? `Mine (−${MINE_RULES[jobMode].wear} 🔧)` : "Mine");
  fbtn.disabled = fr>0 || !!fishGame; fbtn.textContent = fr>0 ? `Fish (${fmtDur(fr)})` : "Fish";
  document.getElementById("jobToolStatus").innerHTML = `⛏️ ${toolUsesLeft("pickaxe")} &nbsp;·&nbsp; 🎣 ${toolUsesLeft("fishingrod")}` + (activeLuck() ? ` &nbsp;·&nbsp; 🍀 +${Math.round(activeLuck()*100)}% (${fmtDur(state.profile.luckUntil-Date.now())})` : "");
}
setInterval(tickJobButtons, 500);
function hasItem(itemId){ return (state.profile.inventory||[]).some(e=>e.itemId===itemId && e.qty>0); }
const pluralize = (id, q)=> `${q>1?q+"× ":"a "}${ITEM_BY_ID[id].name}`;

/* --- foraging: free. Each mode has its OWN cooldown (20s / 5 min / 30 min) --- */
const forageTsKey = m=> m==="green" ? "lastForageTs" : "lastForageTs_"+m;
const JOB_COOLDOWN_MS = 5*1000;         // mining and fishing: 5s after each use
const mineReadyIn = ()=> JOB_COOLDOWN_MS - (Date.now() - (state.profile?.lastMineTs||0));
const fishReadyIn = ()=> JOB_COOLDOWN_MS - (Date.now() - (state.profile?.lastFishTs||0));
function forageReadyIn(m=jobMode){ return FORAGE_RULES[m].cooldown - (Date.now() - (state.profile[forageTsKey(m)]||0)); }
async function doForageAction(){
  const m = jobMode, rule = FORAGE_RULES[m];
  if(forageReadyIn(m) > 0) return;
  playSfx("forage");
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    [forageTsKey(m)]: Date.now(), foragingXp: (state.profile.foragingXp||0)+1
  }));
  if(Math.random() >= Math.min(0.98, rule.chance*(1+activeLuck()))){ jobLog("Nothing this time."); return; }
  const n = rule.qty[0] + Math.floor(Math.random()*(rule.qty[1]-rule.qty[0]+1));
  const got = {};
  for(let i=0;i<n;i++){ const id = rollPool(poolAt(POOLS.forage[m], null, hourNow()), activeLuck()); got[id] = (got[id]||0)+1; }
  await applyInvChanges({ add:Object.entries(got).map(([itemId,qty])=>({itemId,qty})) },
    Object.fromEntries(Object.entries(got).map(([id,q])=>["finds."+id, increment(q)])));
  jobLog(`You foraged ${Object.entries(got).map(([id,q])=>pluralize(id,q)).join(" and ")}!`);
}

/* --- mining: needs a Pickaxe. Green = 50% reward / 50% hazard (1 durability); yellow = 2 durability; red = 3 durability --- */
const MINE_NEG_APPLY = {
  trap(p,u){ const loss = Math.round((p.money||0) * (0.03+Math.random()*0.07)); u.money = Math.max(0,(p.money||0)-loss); return loss ? `A trap! Lost $${fmtMoney(loss)}.` : "A trap! Luckily you had no money to lose."; },
  cavein(p,u){ const l = Math.max(1,Math.round(p.hpMax*(0.05+Math.random()*0.10))); u.hp = Math.max(1,p.hp-l); return `Cave-in! Lost ${l} HP.`; },
  gas(p,u){ const ml = Math.round((p.mana||0)*(0.20+Math.random()*0.20)), hl = Math.max(1,Math.round(p.hpMax*0.03)); u.mana = Math.max(0,(p.mana||0)-ml); u.hp = Math.max(1,p.hp-hl); return `Poison gas! Lost ${ml} mana and ${hl} HP.`; },
  rockslide(p,u){ const ml = Math.round((p.money||0)*(0.02+Math.random()*0.03)), hl = Math.max(1,Math.round(p.hpMax*(0.03+Math.random()*0.05))); u.money = Math.max(0,(p.money||0)-ml); u.hp = Math.max(1,p.hp-hl); return `Rockslide! Lost $${fmtMoney(ml)} and ${hl} HP.`; }
};
const MINE_HP_HAZARDS = new Set(["cavein","gas","rockslide"]);   // these always cost HP
async function doMineAction(){
  const m = jobMode, rule = MINE_RULES[m];
  if(mineReadyIn() > 0) return;
  if(!(await useTool("pickaxe", rule.wear, { lastMineTs: Date.now() }))) return;
  playSfx("mine");
  const updates = { miningXp: (state.profile.miningXp||0)+1 };
  let msg;
  if(Math.random() < Math.min(0.97, rule.pos + (1-rule.pos)*activeLuck())){     // luck also dodges hazards
    if(Math.random() < MINE_CASH_SHARE){
      const amt = rule.cash[0] + Math.floor(Math.random()*(rule.cash[1]-rule.cash[0]+1));
      await grantMoney(amt);
      msg = `Found $${fmtMoney(amt)} under the rock!`;
    } else {
      const id = rollPool(POOLS.mine[m], activeLuck());            // always exactly 1 mineral, in every mode
      await addItemToInv(id, 1);
      updates["finds."+id] = increment(1);           // feeds "obtain an item" sidequests
      msg = `Found ${pluralize(id, 1)}!`;
    }
  } else {
    const total = MINE_NEG.reduce((s,n)=>s+n.w,0); let r = Math.random()*total, pick = MINE_NEG[0];
    for(const n of MINE_NEG){ if((r-=n.w)<=0){ pick = n; break; } }
    if(MINE_HP_HAZARDS.has(pick.id) && (state.profile.hp||0) <= 1){
      // already on 1 HP and the mine hurts you again: that's a death (same penalty as losing a fight)
      const r = await applyDeathPenalty(updates);
      toast(`💀 ${pick.label}! You died. Lost $${fmtMoney(r.moneyLoss)}${r.lostItemName?` and your ${r.lostItemName}`:""}.`);
      jobLog(`💀 ${pick.label} finished you off at 1 HP — lost $${fmtMoney(r.moneyLoss)}${r.lostItemName?` and your ${r.lostItemName}`:""}.`);
      return;
    }
    msg = MINE_NEG_APPLY[pick.id](state.profile, updates);
  }
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), updates));
  jobLog(msg);
}

/* --- fishing (pond): hold-to-catch minigame, needs a Fishing Rod.
   The fish now has real behaviour: it swims toward a target, hovers, changes its mind,
   and darts. Harder modes make it faster, twitchier, and shrink your catch bar. --- */
let fishGame = null;
async function doFishAction(){
  if(fishGame) return;
  const m = jobMode, rule = FISH_RULES[m];
  if(fishReadyIn() > 0) return;
  if(!(await useTool("fishingrod", 1, { lastFishTs: Date.now() }))) return;
  if(fishGame) return;
  playSfx("fish");
  const overlay = document.getElementById("fishOverlay");
  overlay.classList.add("show");
  toast(`${MODES[m].emoji} Something's biting — a ${rule.tier} fish!`);
  const track = document.querySelector(".fish-track-v");
  const trackH = track.clientHeight || 260, barH = rule.bar, fishH = 26, maxFish = trackH - fishH;
  let barY = trackH - barH, vel = 0, held = false, progress = 0, tick = 0;
  let fishY = Math.random()*maxFish, target = fishY, pause = 0, dash = 0, dashDir = 1;
  const emojiEl = document.getElementById("fishEmoji"), barEl = document.getElementById("fishBar"), fillEl = document.getElementById("fishProgressFill");
  const timerEl = document.getElementById("fishTimer"), startedAt = Date.now();
  barEl.style.height = barH+"px";

  const down = e=>{ if(e.target.closest("#btnCancelFish")) return; held = true; };
  const up = ()=>{ held = false; };
  const keyDown = e=>{ if(e.code==="Space"){ e.preventDefault(); held = true; } };
  const keyUp = e=>{ if(e.code==="Space") held = false; };
  overlay.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);

  const newTarget = ()=>{
    // 35%: a long dart across the bar, otherwise a shorter drift around the current spot
    target = Math.random()<(rule.longMove ?? 0.35) ? Math.random()*maxFish : Math.max(0, Math.min(maxFish, fishY + (Math.random()-0.5)*maxFish*0.6));
    if(Math.random()<0.25) pause = 1 + Math.floor(Math.random()*rule.pause);
  };
  const GRAVITY = 1.27, LIFT = -3.6, MAXV = 12;      // the bar rises at the normal rate but now sinks 1.5x slower      // much snappier bar: rises and falls about twice as fast
  const game = fishGame = { id:null, cleanup:null };
  game.id = setInterval(()=>{
    tick++;
    // --- fish AI ---
    if(dash>0){ if(rule.flip && Math.random()<rule.flip) dashDir = -dashDir; fishY += dashDir*rule.speed*(rule.dashMul ?? 3.2); dash--; if(fishY<=0||fishY>=maxFish){ dash = 0; } }
    else if(pause>0){ pause--; fishY += Math.sin(tick/2)*(rule.wobble ?? 0.8); }          // hovers and wobbles
    else {
      if(Math.random() < rule.jitter) newTarget();
      if(Math.random() < rule.dash){ { const [dMin,dMax] = rule.dashLen || [4,8]; dash = dMin + Math.floor(Math.random()*(dMax-dMin+1)); } dashDir = Math.random()<0.5 ? -1 : 1; }
      const dist = target - fishY, step = rule.speed*(1 + Math.min(1.5, Math.abs(dist)/trackH*3));
      if(Math.abs(dist) <= step){ fishY = target; newTarget(); } else fishY += Math.sign(dist)*step;
    }
    fishY = Math.max(0, Math.min(maxFish, fishY));
    emojiEl.style.top = fishY+"px";
    emojiEl.style.transform = `translateX(${Math.sin(tick/3)*(dash>0?7:3)}px) scaleX(${dashDir<0 && dash>0 ? -1 : 1})`;

    // --- your catch bar ---
    vel += held ? LIFT : GRAVITY;
    vel = Math.max(-MAXV, Math.min(MAXV, vel));
    barY += vel;
    if(barY < 0){ barY = 0; vel = 0; }
    if(barY > trackH-barH){ barY = trackH-barH; vel = 0; }
    barEl.style.top = barY+"px";

    const center = fishY + fishH/2, inBar = center >= barY && center <= barY+barH;
    progress += inBar ? 100/(3000/50) : 0;           // 3 seconds inside the bar (50ms ticks) lands the fish; time outside costs nothing
    progress = Math.max(0, Math.min(100, progress));
    fillEl.style.height = progress+"%";
    const left = Math.max(0, rule.time - (Date.now()-startedAt));
    if(timerEl) timerEl.textContent = `${(left/1000).toFixed(1)}s`;

    if(progress >= 100) endFishing(true, m);
    else if(left <= 0) endFishing(false, m, true);          // the fish slips the hook on its own
  }, 50);
  game.cleanup = ()=>{
    overlay.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
    emojiEl.style.transform = "";
  };
}
async function endFishing(success, m=jobMode, timedOut=false){
  if(!fishGame) return;
  clearInterval(fishGame.id); fishGame.cleanup?.(); fishGame = null;
  document.getElementById("fishOverlay").classList.remove("show");
  document.getElementById("fishProgressFill").style.height = "0%";
  reopenCompassIf(fishReopenCompass); fishReopenCompass = false;
  updateDoc(doc(db,"players",state.uid), { lastFishTs: Date.now() }).catch(()=>{});   // the 5s rest starts when the fight ends
  if(success){
    const pick = rollFish(POOLS.fish[m], hourNow(), activeLuck());   // each fish has its own time-of-day chance
    await addItemToInv(pick, 1);
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { fishingXp: (state.profile.fishingXp||0)+1, ["finds."+pick]: increment(1) }));
    jobLog(`Caught a ${ITEM_BY_ID[pick].name}! (${ITEM_BY_ID[pick].rarity})`);
  } else {
    jobLog(timedOut ? "Too slow — the fish slipped off the hook!" : "The fish got away.");
  }
}
document.getElementById("btnCancelFish").addEventListener("click", ()=> endFishing(false));

/* --- Bestiary (journal tab): every fish, when it bites, how likely it is right now --- */
const pctText = p=> { const v = p*100; return (v>=10 ? v.toFixed(1) : v>=1 ? v.toFixed(2) : v.toFixed(3)) + "%"; };
const FISH_TIERS = [["easy","green","Green"],["medium","yellow","Yellow"],["hard","red","Red"]];
let beSel = null;
function beFishList(){ return FISH_TIERS.flatMap(([tier,mode])=> CATALOG.fish[tier].map(id=>({ id, tier, mode, item:ITEM_BY_ID[id] }))); }
function renderBestiary(){
  const grid = document.getElementById("beGrid"), det = document.getElementById("beDetail"), clock = document.getElementById("beClock");
  if(!grid || !state.profile) return;
  const h = hourNow(), per = periodOf(h), finds = state.profile.finds || {}, list = beFishList();
  const hh = Math.floor(h), mm = Math.floor((h-hh)*60);
  clock.textContent = `${per.icon} ${per.label} · ${String(hh%12||12)}:${String(mm).padStart(2,"0")} ${hh<12?"AM":"PM"}`;
  grid.innerHTML = list.map(f=>{
    const hb = fishHabit(f.id, f.item.rarity), act = activity(hb, h), caught = (finds[f.id]||0) > 0;
    return `<button class="be-card rarity-${f.item.rarity}${beSel===f.id?" sel":""}${caught?"":" unseen"}" data-fish="${f.id}" title="${caught?escapeHTML(f.item.name):"???"}">
      <span class="be-emo">${caught?"🐟":"❔"}</span><span class="be-name">${caught?escapeHTML(f.item.name):"???"}</span>
      <span class="be-bar"><i style="width:${Math.round(act*100)}%"></i></span></button>`;
  }).join("");
  grid.querySelectorAll("[data-fish]").forEach(b=> b.addEventListener("click", ()=>{ beSel = b.dataset.fish; renderBestiary(); }));
  const f = list.find(x=>x.id===beSel);
  if(!f){ det.innerHTML = `<p class="doodle-sub">Tap a fish to see when it bites.</p>`; return; }
  const it = f.item, hb = fishHabit(f.id, it.rarity), pool = POOLS.fish[f.mode], caught = (finds[f.id]||0) > 0;
  const odds = oddsByHour(pool, f.id), now = fishPct(hb, h)/100, max = hb.max || 1;
  const bars = odds.map((p,i)=> `<span class="be-hr${i===hh%24?" now":""}" style="height:${Math.max(3, Math.round(p/max*100))}%" title="${i%12||12}${i<12?"am":"pm"}: ${p.toFixed(1)}%"></span>`).join("");
  det.innerHTML = `<h3 class="doodle-h3">${caught?escapeHTML(it.name):"???"} <small class="rarity-${it.rarity}">${it.rarity}</small></h3>
    <p class="doodle-sub">${caught?escapeHTML(it.desc||""):"Catch one to reveal its entry."}</p>
    <div class="be-facts">
      <div><b>Where</b> ${MODES[f.mode].emoji} ${MODES[f.mode].label} fishing</div>
      <div><b>Best time</b> ${hb.icon} ${hb.label} (${activeText(hb)}) · peak ${hb.max.toFixed(1)}%</div>
      <div><b>Sells for</b> $${fmtMoney(it.sellPrice)}</div>
      <div><b>Caught</b> ${finds[f.id]||0}</div>
      <div><b>Odds right now</b> ${(now*100).toFixed(2)}% <span class="be-bar wide"><i style="width:${Math.round(activity(hb,h)*100)}%"></i></span></div>
    </div>
    <div class="be-chart">${bars}</div>
    <div class="be-axis"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>`;
}
document.querySelector('[data-jtab="bestiary"]').addEventListener("click", renderBestiary);
setInterval(()=>{ if(document.getElementById("jtab-bestiary")?.classList.contains("active") && document.getElementById("journalModal").classList.contains("active")) renderBestiary(); }, 30000);
setJobMode(jobMode);


/* =========================================================================
   CHAT
   ========================================================================= */
let chatSubbed = false;
// Client-side display toggle only — decides whether to SHOW the mod
// buttons. The actual permission is enforced in Firestore rules against a
// real Firebase Auth UID (see isAdmin() in rpg_firestore.rules), so a
// modified client that fakes this check still gets rejected server-side.
const ADMIN_USERNAME = "Vortarium";
function isAdminUI(){ return state.profile?.username === ADMIN_USERNAME; }

/* ---------- MUTES ----------
   A mod mutes someone from their profile. The mute is just a timestamp,
   players/{uid}.mutedUntil (ms since epoch), set by the mod and enforced
   server-side in rpg_firestore.rules (chat, auction listings, payments and
   friend requests all check it). It expires on its own — nothing has to be
   cleared. A muted player can still READ every chat; their type boxes are
   swapped for a red live countdown bar and the header shows the countdown too. */
const muteLeftMs = (d=state.profile)=> Math.max(0, (d?.mutedUntil||0) - Date.now());
const isMuted = ()=> muteLeftMs() > 0;
function fmtMuteLeft(ms){
  let t = Math.ceil(ms/1000);
  const d = Math.floor(t/86400); t -= d*86400;
  const h = Math.floor(t/3600); t -= h*3600;
  const m = Math.floor(t/60), sec = t - m*60;
  return [d?`${d}d`:"", (d||h)?`${h}h`:"", (d||h||m)?`${m}m`:"", `${sec}s`].filter(Boolean).join(" ");
}
/* "1d 2m 30s", "5m 10s", "2d", "90m", "1d2m30s" … d = days, m = minutes, s = seconds (h = hours also works). */
function parseMuteDuration(str){
  const src = String(str||"").trim().toLowerCase();
  if(!src) return { err:"Enter how long to mute for, e.g. 1d 2m 30s" };
  const re = /(\d+(?:\.\d+)?)\s*([dhms])/g, UNIT = { d:86400000, h:3600000, m:60000, s:1000 };
  let total = 0, m, used = "", any = false;
  while((m = re.exec(src))){ total += parseFloat(m[1]) * UNIT[m[2]]; used += m[0]; any = true; }
  if(!any || src.replace(/\s+/g,"") !== used.replace(/\s+/g,"")) return { err:"Use d, m and s — like 1d 2m 30s, 5m 10s, 2d or 15m." };
  total = Math.round(total);
  if(total < 1000) return { err:"Mute must be at least 1 second." };
  return { ms: total };
}
function muteBlockedToast(what){ toast(`🔇 You're muted for ${fmtMuteLeft(muteLeftMs())} — you can't ${what}.`); }
let wasMuted = false;
function updateMuteUI(){
  const left = muteLeftMs(), muted = left > 0;
  document.querySelectorAll(".chat-input-row").forEach(f=> f.classList.toggle("muted", muted));
  document.querySelectorAll(".mute-bar-time").forEach(el=> el.textContent = muted ? fmtMuteLeft(left) : "");
  const hud = document.getElementById("hudMute");
  if(hud){ hud.style.display = muted ? "" : "none"; document.getElementById("hudMuteTime").textContent = muted ? fmtMuteLeft(left) : ""; }
  if(muted){ hideChatCmdPopup?.(); }
  if(wasMuted && !muted) toast("🔊 Your mute has ended — you can talk again.");
  wasMuted = muted;
}
setInterval(()=>{ if(state.profile) updateMuteUI(); }, 1000);

/* Mod-side: mute / unmute from a profile. Only the admin's client shows the controls;
   rpg_firestore.rules is what actually lets only the admin write another player's mutedUntil. */
async function muteUser(uid, username, ms){
  if(!isAdminUI()) return false;
  const until = Date.now() + ms;
  const ok = await withErrorToast(()=> updateDoc(doc(db,"players",uid), { mutedUntil: until }));
  if(ok===null) return false;
  toast(`🔇 ${username} is muted for ${fmtMuteLeft(ms)}.`);
  return true;
}
async function unmuteUser(uid, username){
  if(!isAdminUI()) return false;
  const ok = await withErrorToast(()=> updateDoc(doc(db,"players",uid), { mutedUntil: 0 }));
  if(ok===null) return false;
  toast(`🔊 ${username} was unmuted.`);
  return true;
}
/* ---------- online status: a green dot means "logged in with the tab open" ----------
   Every logged-in client stamps `onlineAt` on its own player doc every 45s; anyone whose
   stamp is under 2.5 minutes old counts as online. Logging out / closing the tab clears it. */
const ONLINE_BEAT_MS = 45000, ONLINE_FRESH_MS = 150000;
let onlineTimer = null;
const isOnline = d=> !!(d && !d.banned && (Date.now() - (d.onlineAt||0)) < ONLINE_FRESH_MS);
/* green = online · yellow = logged in but not on this tab · red = online with chat notifications turned off (yellow wins if both) */
const presenceOf = (d, self)=> d?.away && !self ? "away" : (d?.notifSettings?.chat === false ? "muted" : "online");
const DOT_TITLE = { online:"Online", away:"Online — away from the tab", muted:"Online — message notifications off" };
const onlineDot = (d, force)=> { if(!(force || isOnline(d))) return ""; const k = presenceOf(d, force); return `<span class="online-dot dot-${k}" title="${DOT_TITLE[k]}"></span>`; };
function beatOnline(){ if(state.uid && state.profile && !state.profile.banned) updateDoc(doc(db,"players",state.uid), { onlineAt: Date.now(), away: document.hidden }).catch(()=>{}); }
function startOnlineBeat(){ stopOnlineBeat(); beatOnline(); onlineTimer = setInterval(beatOnline, ONLINE_BEAT_MS); }
function stopOnlineBeat(){ if(onlineTimer){ clearInterval(onlineTimer); onlineTimer = null; } }
document.addEventListener("visibilitychange", ()=>{ if(onlineTimer) beatOnline(); });   // flips yellow the moment you leave the tab, green when you return
window.addEventListener("pageshow", ()=>{ if(onlineTimer) beatOnline(); });
window.addEventListener("pagehide", ()=>{ if(state.uid && state.profile) updateDoc(doc(db,"players",state.uid), { onlineAt: 0, away:false }).catch(()=>{}); });
function ensureChatSubscriptions(){
  if(chatSubbed) return; chatSubbed=true;
  subscribeInbox();
  subscribeFriendsAsContacts();
}
async function openProfileByUid(uid){
  if(uid===state.uid){ openProfileBook(uid, state.profile, null, null); return; }
  const snap = await getDoc(doc(db,"players",uid)).catch(()=>null);
  if(!snap || !snap.exists()){ toast("That player no longer exists."); return; }
  openProfileBook(uid, snap.data(), null, null);
}
const cosmeticFields = ()=>{ const p = state.profile||{}, o = {}; if(p.gradient && (p.cosmetics||[]).includes(p.gradient)) o.gid = p.gradient; if(p.font && (p.cosmetics||[]).includes(p.font)) o.fid = p.font; return o; };
function chatMessageHTML(m, id, collectionPath){
  const canDelete = m.uid===state.uid || isAdminUI();
  if(m.system==="deleted") return `<div class="chat-system" data-mid="${id}">${escapeHTML(m.username)} deleted a message</div>`;
  // A reply shows the quoted message as a small bubble attached on top of this
  // one, in the colour that quoted author has for THIS viewer (blue = you, pink = them).
  const rq = m.replyTo && m.replyTo.username
    ? `<div class="reply-quote ${m.replyTo.uid===state.uid?'q-mine':'q-theirs'}"><b>${escapeHTML(m.replyTo.username)}</b> ${escapeHTML(m.replyTo.text||"")}</div>` : "";
  return `
      <div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}${rq?' has-reply':''}" data-mid="${id}">
        <div class="who chat-username" data-uid="${m.uid}">${escapeHTML(m.username)}</div>
        ${rq}
        <div class="bubble"${cosmeticStyle(m.gid, m.fid) ? ` style="${cosmeticStyle(m.gid, m.fid)}"` : ""}>${escapeHTML(m.text)}</div>
        <button class="chat-reply-btn" data-reply="${id}" title="Reply">&#10550;</button>
        ${canDelete ? `<button class="chat-del-btn" data-del="${id}" data-ts="${m.ts||Date.now()}" data-cpath="${collectionPath}" title="Delete message">&times;</button>` : ""}
      </div>`;
}
const lrKey = k=> `lr_${state.uid}_${k}`;
function chatAtBottom(log){ return log.scrollHeight - log.scrollTop - log.clientHeight < 8; }
function markRead(log, key){ localStorage.setItem(lrKey(key), String(Date.now())); log?.querySelector(".unread-line")?.remove(); updateUnreadDots(); }
/* ---------- unread red dots ----------
   A dot sits on the Compass button, the Chat tab, the Global / Private sub-tabs and next to every DM contact
   with messages you haven't read. A chat counts as read the moment you reach the bottom of it. */
let unreadOwner = null, globalLatest = 0;
const dmLatest = {};                         // partner uid -> timestamp of the newest message FROM them
const dmProbed = new Set();
const lrGet = k=> +localStorage.getItem(lrKey(k)) || 0;
function updateUnreadDots(){
  if(!state.uid) return;
  if(unreadOwner !== state.uid){ unreadOwner = state.uid; globalLatest = 0; dmProbed.clear(); Object.keys(dmLatest).forEach(k=> delete dmLatest[k]); }
  const dms = Object.keys(dmLatest).filter(u=> dmLatest[u] > lrGet("pm_"+pmThreadId(state.uid,u)));
  const g = globalLatest > lrGet("global"), any = g || dms.length>0;
  const set = (el,on)=>{ if(el) el.classList.toggle("has-unread", !!on); };
  set(document.getElementById("btnCompass"), any);
  set(document.querySelector('[data-mm="btnCompass"]'), any);
  set(document.querySelector('[data-ctab="chat"]'), any);
  set(document.querySelector('[data-chatsub="global"]'), g);
  set(document.querySelector('[data-chatsub="private"]'), dms.length>0);
  document.querySelectorAll("#pmContacts li[data-uid]").forEach(li=> li.classList.toggle("has-unread", dms.includes(li.dataset.uid)));
}
// Backfill: pings are consumed after one session, so look at each thread once to learn what's waiting.
function probeDmUnread(uids){
  uids.forEach(async uid=>{
    const k = state.uid+":"+uid; if(dmProbed.has(k)) return; dmProbed.add(k);
    try{
      const sn = await getDocs(query(collection(db,"privateChats",pmThreadId(state.uid,uid),"messages"), orderBy("ts","desc"), limit(5)));
      const m = sn.docs.map(d=>d.data()).find(x=>x.uid!==state.uid && !x.system);
      if(m) dmLatest[uid] = Math.max(dmLatest[uid]||0, m.ts);
    }catch(e){ console.error(e); }
    updateUnreadDots();
  });
}
function renderChatLog(log, rows, key, path){
  log._key = key;
  if(localStorage.getItem(lrKey(key))===null) localStorage.setItem(lrKey(key), String(Date.now()));
  const last = +localStorage.getItem(lrKey(key));
  const visible = log.offsetParent!==null, first = !log.dataset.init;
  const wasBottom = chatAtBottom(log), prevTop = log.scrollTop;
  const fu = rows.findIndex(m=> m.ts>last && m.uid!==state.uid);
  const live = !first && visible && wasBottom;           // new msg arrives while you're reading the bottom: no line
  log.innerHTML = rows.map((m,i)=> (i===fu && !live ? '<div class="unread-line"></div>' : "") + chatMessageHTML(m, m.id, path)).join("");
  wireChatRowInteractions(log);
  log._rows = rows;
  if(String(key).startsWith("pm_")) refreshDmReceipt();
  if(!log._sw){ log._sw = true; log.addEventListener("scroll", ()=>{ if(chatAtBottom(log) && log.querySelector(".unread-line")) markRead(log, log._key); }); }
  log.dataset.init = "1";
  if(first){ if(visible) focusChatLog(log); }
  else if(live){ log.scrollTop = log.scrollHeight; markRead(log, key); }
  else log.scrollTop = prevTop;
  if(String(key).startsWith("pm_")) ackDmSeen();
  { const latest = rows.filter(m=>m.uid!==state.uid && !m.system).pop();
    if(latest){
      if(key==="global") globalLatest = Math.max(globalLatest, latest.ts||0);
      else if(String(key).startsWith("pm_") && state.currentChatPartner) dmLatest[state.currentChatPartner.uid] = Math.max(dmLatest[state.currentChatPartner.uid]||0, latest.ts||0);
    } }
  updateUnreadDots();
}
// "Sent" / "Seen" under the last private message YOU sent. "Seen" once the other
// player has had this DM thread open (they ping our inbox; we store it on our own doc).
function refreshDmReceipt(){
  const log = document.getElementById("chatLogPrivate"), partner = state.currentChatPartner;
  if(!log || !partner || !log._rows || !state.profile) return;
  log.querySelectorAll(".dm-receipt").forEach(e=>e.remove());
  const mine = log._rows.filter(m=>m.uid===state.uid && !m.system).pop();
  if(!mine) return;
  const el = log.querySelector(`.chat-msg[data-mid="${mine.id}"]`);
  if(!el) return;
  const seen = ((state.profile.dmSeen||{})[partner.uid]||0) >= mine.ts;
  el.insertAdjacentHTML("beforeend", `<div class="dm-receipt">${seen?"Seen":"Sent"}</div>`);
}
// Tell the sender we've now seen their latest message (only when the DM thread is actually on screen).
function ackDmSeen(){
  const log = document.getElementById("chatLogPrivate"), partner = state.currentChatPartner;
  if(!log || !partner || !log._rows || log.offsetParent===null || document.hidden) return;
  const latest = log._rows.filter(m=>m.uid===partner.uid && !m.system).pop();
  if(!latest) return;
  const k = `dmack_${state.uid}_${partner.uid}`;
  if(+localStorage.getItem(k) >= latest.ts) return;
  localStorage.setItem(k, String(latest.ts));
  addDoc(collection(db,"players",partner.uid,"inbox"), { type:"dm_seen", fromUid: state.uid, ts: latest.ts }).catch(()=>{});
}
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) ackDmSeen(); });
document.querySelectorAll('[data-chatsub],[data-ctab="chat"]').forEach(b=> b.addEventListener("click", ()=> setTimeout(ackDmSeen,50)));
function focusChatLog(log){
  const line = log.querySelector(".unread-line");
  log.scrollTop = line ? Math.max(0, line.offsetTop-10) : log.scrollHeight;
  if(line && chatAtBottom(log)) setTimeout(()=>{ if(log.querySelector(".unread-line")) markRead(log, log._key); }, 2000);
}
function focusVisibleChat(){ ["chatLogGlobal","chatLogPrivate"].forEach(id=>{ const l=document.getElementById(id); if(l.offsetParent!==null) focusChatLog(l); }); }
document.querySelectorAll("[data-chatsub]").forEach(b=> b.addEventListener("click", ()=> setTimeout(focusVisibleChat,0)));
/* ---------- replies ----------
   Clicking the bent arrow puts a mini copy of that message on top of the
   compose box; whatever you send next carries it as `replyTo`. One pending
   reply per chat (global / private). */
const pendingReply = { global:null, private:null };
function replyBox(which){ return document.getElementById(which==="global" ? "globalChatForm" : "privateChatForm"); }
function renderReplyPreview(which){
  const form = replyBox(which); form.querySelector(".reply-compose")?.remove();
  const r = pendingReply[which]; if(!r) return;
  const el = document.createElement("div");
  el.className = "reply-compose " + (r.uid===state.uid ? "q-mine" : "q-theirs");
  el.innerHTML = `<span><b>${escapeHTML(r.username)}</b> ${escapeHTML(r.text)}</span><button type="button" class="reply-cancel" title="Cancel reply">&times;</button>`;
  el.querySelector(".reply-cancel").addEventListener("click", ()=>{ pendingReply[which]=null; renderReplyPreview(which); });
  form.prepend(el);
  form.querySelector("input")?.focus();
}
function takeReply(which){
  const r = pendingReply[which]; pendingReply[which] = null; renderReplyPreview(which);
  return r ? { id:r.id, uid:r.uid, username:r.username, text:r.text } : null;
}
function wireChatRowInteractions(log){
  log.querySelectorAll(".chat-username").forEach(el=>{
    el.addEventListener("click", ()=> openProfileByUid(el.dataset.uid));
  });
  log.querySelectorAll("[data-reply]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const m = (log._rows||[]).find(x=>x.id===btn.dataset.reply); if(!m || m.system) return;
      const which = log.id==="chatLogGlobal" ? "global" : "private";
      pendingReply[which] = { id:m.id, uid:m.uid, username:m.username, text:String(m.text||"").slice(0,80) };
      renderReplyPreview(which);
    });
  });
  log.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const [col, ...rest] = btn.dataset.cpath.split("/");
      const ref = rest.length ? doc(db, col, ...rest, btn.dataset.del) : doc(db, col, btn.dataset.del);
      // Leave a "[user] deleted a message" notice in the same spot, then remove the real message.
      await withErrorToast(async ()=>{
        if(!isMuted()) await addDoc(collection(db, col, ...rest), { uid:state.uid, username:state.profile.username, text:"", system:"deleted", ts:+btn.dataset.ts || Date.now() });   // (muted players can't post, so no notice line)
        await deleteDoc(ref);
      });
    });
  });
}
function subscribeGlobalChat(){
  const q = query(collection(db,"globalChat"), orderBy("ts","desc"), limit(50));
  const unsub = onSnapshot(q, (snap)=>{
    const log = document.getElementById("chatLogGlobal");
    const rows = [];
    snap.forEach(d=>rows.unshift({id:d.id, ...d.data()}));
    renderChatLog(log, rows, "global", "globalChat");
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.getElementById("globalChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const input = document.getElementById("globalChatInput");
  const raw = input.value.trim();
  if(!raw) return;
  if(isMuted()){ muteBlockedToast("send chat messages"); return; }
  hideChatCmdPopup();
  if(raw.startsWith("/")){
    await runChatCommand(raw);
    input.value="";
    return;
  }
  const text = moderateChatText(raw);
  if(!text) return;
  input.value=""; markRead(document.getElementById("chatLogGlobal"), "global");
  const replyTo = takeReply("global");
  const ok = await withErrorToast(()=> addDoc(collection(db,"globalChat"), { uid:state.uid, username:state.profile.username, text, ts: Date.now(), ...cosmeticFields(), ...(replyTo?{replyTo}:{}) }));
  if(ok===null){ input.value = raw; if(replyTo){ pendingReply.global = replyTo; renderReplyPreview("global"); } }
});

/* ---------- slash commands ---------- */
const CHAT_COMMANDS = [
  { cmd:"/pay [username] [amount]", desc:"Send money to another player." },
  { cmd:"/ah", desc:"Jump to the Auction House." },
  { cmd:"/ah sell [item] [price]", desc:"List 1 of that item on the auction for that price." },
  { cmd:"/friend [username]", desc:"Send a friend request." },
  { cmd:"/friend remove [username]", desc:"Unfriend a player." },
  { cmd:"/msg [username]", desc:"Open a private chat with a player." }
];
function hideChatCmdPopup(){
  const pop = document.getElementById("chatCmdPopup");
  pop.style.display = "none"; pop.innerHTML = "";
}
function showChatCmdPopup(filterText){
  const pop = document.getElementById("chatCmdPopup");
  const matches = CHAT_COMMANDS.filter(c=> c.cmd.toLowerCase().startsWith(filterText.toLowerCase()) || filterText==="/");
  if(!matches.length){ hideChatCmdPopup(); return; }
  pop.innerHTML = matches.map(c=>`<div class="chat-cmd-row"><b>${escapeHTML(c.cmd)}</b> — ${escapeHTML(c.desc)}</div>`).join("");
  pop.style.display = "flex";
}
document.getElementById("globalChatInput").addEventListener("input", (e)=>{
  const v = e.target.value;
  if(v.startsWith("/")) showChatCmdPopup(v);
  else hideChatCmdPopup();
});
document.getElementById("globalChatInput").addEventListener("blur", ()=> setTimeout(hideChatCmdPopup, 150));

async function findUidByUsername(username){
  const q = query(collection(db,"players"), where("username","==",username));
  const snap = await getDocs(q);
  if(snap.empty) return null;
  return { uid: snap.docs[0].id, data: snap.docs[0].data() };
}
async function runChatCommand(raw){
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  if(cmd === "/pay"){
    if(isMuted()){ muteBlockedToast("pay people"); return; }
    const [ , username, amountStr ] = parts;
    const pa = parseAmount(amountStr||"");
    if(!username){ toast("Usage: /pay [username] [amount]"); return; }
    if(pa.err){ toast(pa.err); return; }
    const amount = pa.value;
    if(amount > (state.profile.money||0)){ toast("You don't have that much money."); return; }
    if(username.toLowerCase() === state.profile.username.toLowerCase()){ toast("You can't pay yourself."); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    // Never write another player's doc directly — deduct from OUR OWN
    // balance, then drop an inbox notice on theirs (same pattern as
    // auction/duel payouts) that their own client auto-credits.
    const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: (state.profile.money||0) - amount }));
    if(ok===null) return;
    await withErrorToast(()=> addDoc(collection(db,"players",target.uid,"inbox"), {
      type:"payment_received", amount, fromUsername: state.profile.username, ts: Date.now(), credited:false
    }));
    toast(`Paid $${fmtMoney(amount)} to ${username}.`);
    return;
  }
  if(cmd === "/ah"){
    if(parts[1]?.toLowerCase() === "sell"){
      if(isMuted()){ muteBlockedToast("list items on the auction"); return; }
      const itemName = parts[2];
      if(!itemName){ toast("Usage: /ah sell [item] [price]"); return; }
      const pa = parseAmount(parts[3]||"");
      if(pa.err){ toast(pa.err); return; }
      const price = pa.value;
      const entry = invExpanded().find(e=> e.item.name.toLowerCase() === itemName.toLowerCase() || e.item.name.toLowerCase().replace(/\s+/g,"") === itemName.toLowerCase());
      if(!entry || entry.qty<1){ toast(`You don't have a ${itemName}.`); return; }
      try{
        const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid)));
        const activeCount = mySnap.docs.filter(d=>d.data().status==="active").length;
        if(activeCount >= 10){ toast("You can only have 10 auction slots."); return; }
      }catch(err){ toast(friendlyFirebaseError(err)); return; }
      const ok = await applyInvChanges({ remove:[{itemId:entry.item.id, qty:1}] });
      if(ok===null) return;
      const posted = await withErrorToast(()=> addDoc(collection(db,"auction"), {
        sellerUid: state.uid, sellerName: state.profile.username, itemId: entry.item.id, qty:1, pricePer: price,
        status:"active", postedAt: Date.now(), expiresAt: Date.now() + AUCTION_MS
      }));
      if(posted===null){ await addItemToInv(entry.item.id, 1); return; }
      toast(`Posted 1 ${entry.item.name} to the auction for $${fmtMoney(price)}.`);
      return;
    }
    document.querySelector('[data-ctab="auction"]')?.click();
    return;
  }
  if(cmd === "/friend"){
    if(parts[1]?.toLowerCase() === "remove"){
      const username = parts[2];
      if(!username){ toast("Usage: /friend remove [username]"); return; }
      const target = await findUidByUsername(username);
      if(!target){ toast(`No player named ${username}.`); return; }
      if(!(state.profile.friends||[]).includes(target.uid)){ toast(`You're not friends with ${username}.`); return; }
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { friends: arrayRemove(target.uid) }));
      toast(`Removed ${username} as a friend.`);
      return;
    }
    const username = parts[1];
    if(!username){ toast("Usage: /friend [username]"); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    await sendFriendRequest(target.uid, username);
    return;
  }
  if(cmd === "/msg"){
    const username = parts[1];
    if(!username){ toast("Usage: /msg [username]"); return; }
    const target = await findUidByUsername(username);
    if(!target){ toast(`No player named ${username}.`); return; }
    if(target.data.privateProfile && !isMutualFriend(target.uid, target.data)){ toast("That player is private — you both need to add each other as friends first."); return; }
    openPrivateChatWith(target.uid, username);
    return;
  }
  toast(`Unknown command: ${cmd}`);
}
document.querySelectorAll("[data-chatsub]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-chatsub]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".chatsub-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("chatsub-"+btn.dataset.chatsub).classList.add("active");
  });
});
function pmThreadId(a,b){ return [a,b].sort().join("_"); }
function openPrivateChatWith(uid, username){
  state.currentChatPartner = { uid, username };
  // Immediately make sure this person's PM subsection shows up in the
  // contacts list to click between, even if you're not friends yet.
  state.pmContactsExtra[uid] = username;
  openModal("compassModal");
  document.querySelector('[data-ctab="chat"]').click();
  document.querySelector('[data-chatsub="private"]').click();
  subscribePrivateThread();
  renderPMContacts();
}
function subscribeFriendsAsContacts(){
  const unsub = onSnapshot(doc(db,"players",state.uid), snap=>{
    if(snap.exists()) renderPMContacts(snap.data().friends||[]);
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
async function renderPMContacts(friendUids){
  const list = document.getElementById("pmContacts");
  friendUids = friendUids || state.profile?.friends || [];
  // Merge in anyone you've privately messaged who isn't a mutual friend,
  // so their thread stays reachable without needing to add them.
  const allUids = [...new Set([...friendUids, ...Object.keys(state.pmContactsExtra)])];
  const token = (renderPMContacts._t = (renderPMContacts._t||0) + 1);
  const items = [];
  for(const uid of allUids){
    try{
      const snap = await getDoc(doc(db,"players",uid));
      if(!snap.exists() || snap.data().banned) continue;
      const li = document.createElement("li");
      li.innerHTML = escapeHTML(snap.data().username) + onlineDot(snap.data());
      li.dataset.uid = uid;
      if(state.currentChatPartner?.uid===uid) li.classList.add("active");
      li.addEventListener("click", ()=> openPrivateChatWith(uid, snap.data().username));
      items.push(li);
    }catch(err){ console.error(err); }
  }
  if(token !== renderPMContacts._t) return;       // a newer render superseded this one
  list.replaceChildren(...items);
  probeDmUnread(allUids); updateUnreadDots();
}
/* live online dot for the person you're chatting with (header + under their messages) */
const partnerLive = { uid:null, data:null, unsub:null, html:null };
function watchPartnerDoc(uid){
  if(partnerLive.uid===uid && partnerLive.unsub) return;
  if(partnerLive.unsub) partnerLive.unsub();
  partnerLive.uid = uid; partnerLive.data = null; partnerLive.html = null;
  partnerLive.unsub = onSnapshot(doc(db,"players",uid), s=>{ partnerLive.data = s.exists() ? s.data() : null; renderPartnerOnline(); }, ()=>{});
}
function renderPartnerOnline(){
  const head = document.getElementById("dmPartner"), log = document.getElementById("chatLogPrivate");
  const cp = state.currentChatPartner;
  const on = !!(cp && partnerLive.uid===cp.uid && isOnline(partnerLive.data));
  const html = cp ? escapeHTML(cp.username) + (on ? '<span class="online-dot" title="Online"></span>' : "") : "";
  if(head && html !== partnerLive.html){ head.innerHTML = html; partnerLive.html = html; }
  if(log) log.classList.toggle("partner-online", on);
}
let pmUnsub = null;
function subscribePrivateThread(){
  if(pmUnsub) pmUnsub();
  document.getElementById("chatLogPrivate").dataset.init="";
  if(!state.currentChatPartner) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  if(presence.thread !== threadId){ pendingReply.private = null; renderReplyPreview("private"); }
  watchPartnerDoc(state.currentChatPartner.uid); renderPartnerOnline();
  watchPartnerPresence(threadId);
  syncPresence(true);
  const q = query(collection(db,"privateChats",threadId,"messages"), orderBy("ts","desc"), limit(100));
  pmUnsub = onSnapshot(q, snap=>{
    const log = document.getElementById("chatLogPrivate");
    const rows = [];
    snap.forEach(d=>rows.unshift({id:d.id, ...d.data()}));
    renderChatLog(log, rows, "pm_"+threadId, `privateChats/${threadId}/messages`);
  }, (err)=> toast(friendlyFirebaseError(err)));
}

/* =========================================================================
   DM PRESENCE — private chat only (never public chat).
   Each side keeps ONE tiny doc  privateChats/{thread}/presence/{myUid}:
     watching: I'm actively inside this DM thread, in the tab, right now
     typing:   ...and there is text in my message box
   Both are refreshed by a heartbeat and treated as expired by the reader if
   the heartbeat stops (closed tab, lost connection), so nothing gets stuck.
   The other side sees a bubble bottom-left: 👀 while I'm watching, animated
   dots while I'm typing, and nothing when I'm not in the DM screen.
   ========================================================================= */
const PRESENCE_BEAT_MS = 5000, PRESENCE_STALE_MS = 13000;
const presence = { thread:null, sent:{ watching:false, typing:false, at:0 }, partner:null, unsub:null, tick:null, shown:"" };
function iAmWatchingDM(){
  const log = document.getElementById("chatLogPrivate");
  return !!(state.profile && state.currentChatPartner && !document.hidden &&
    document.getElementById("screen-game").classList.contains("active") &&
    log && log.offsetParent !== null);            // visible = compass open + Chat tab + Private sub-tab
}
function presenceRef(thread){ return doc(db,"privateChats",thread,"presence",state.uid); }
// Writes only when something changed, or as a heartbeat while active.
function syncPresence(force){
  if(!state.uid || !state.profile) return;
  const thread = state.currentChatPartner ? pmThreadId(state.uid, state.currentChatPartner.uid) : null;
  // moved to a different thread (or left DMs entirely): clear the old one first
  if(presence.thread && presence.thread !== thread && (presence.sent.watching || presence.sent.typing)){
    setDoc(presenceRef(presence.thread), { watching:false, typing:false, ts:Date.now() }).catch(()=>{});
    presence.sent = { watching:false, typing:false, at:0 };
  }
  presence.thread = thread;
  if(!thread) return;
  const watching = iAmWatchingDM();
  const typing = watching && document.getElementById("privateChatInput").value.trim().length > 0;
  const s = presence.sent, now = Date.now();
  const changed = watching !== s.watching || typing !== s.typing;
  const beat = (watching || typing) && now - s.at >= PRESENCE_BEAT_MS;
  if(!changed && !beat && !force) return;
  if(!changed && !beat && force && !watching && !typing) return;
  presence.sent = { watching, typing, at:now };
  setDoc(presenceRef(thread), { watching, typing, ts:now }).catch(()=>{});
}
function watchPartnerPresence(thread){
  if(presence.unsub){ presence.unsub(); presence.unsub = null; }
  presence.partner = null; renderPartnerPresence();
  const partnerUid = state.currentChatPartner.uid;
  presence.unsub = onSnapshot(doc(db,"privateChats",thread,"presence",partnerUid), snap=>{
    presence.partner = snap.exists() ? snap.data() : null;
    renderPartnerPresence();
  }, ()=>{});
  if(!presence.tick) presence.tick = setInterval(()=>{ syncPresence(); renderPartnerPresence(); renderPartnerOnline(); }, 1000);
}
function renderPartnerPresence(){
  const el = document.getElementById("dmStatus"); if(!el) return;
  const pr = presence.partner, fresh = pr && (Date.now() - (pr.ts||0)) < PRESENCE_STALE_MS;
  // we only show it while WE are also looking at this thread
  const on = fresh && state.currentChatPartner && iAmWatchingDM();
  const want = !on ? "" : (pr.typing ? "typing" : pr.watching ? "watching" : "");
  if(want === presence.shown) return;
  const bubble = el.querySelector(".dm-bubble");
  const prev = presence.shown; presence.shown = want;
  if(!want){                                            // leave: quick pop-out
    bubble.classList.remove("pop-in"); bubble.classList.add("pop-out");
    setTimeout(()=>{ if(!presence.shown){ bubble.className = "dm-bubble"; bubble.innerHTML = ""; } }, 220);
    return;
  }
  bubble.innerHTML = want==="typing" ? '<span class="dm-dots"><i></i><i></i><i></i></span>' : '<span class="dm-eyes">👀</span>';
  bubble.className = "dm-bubble show" + (want==="typing" ? " typing" : "");
  void bubble.offsetWidth;                              // restart the pop animation on every change / appearance
  bubble.classList.add("pop-in");
}
setInterval(()=>{ const l = document.getElementById("chatLogPrivate"); if(state.profile && l && l.offsetParent!==null) renderPMContacts(); }, 30000);   // keep contact dots fresh
function stopPresence(){                                // logout / session reset
  if(partnerLive.unsub){ partnerLive.unsub(); partnerLive.unsub = null; } partnerLive.uid = null; partnerLive.data = null; partnerLive.html = null;
  if(presence.thread && state.uid && (presence.sent.watching || presence.sent.typing)){
    setDoc(presenceRef(presence.thread), { watching:false, typing:false, ts:Date.now() }).catch(()=>{});
  }
  if(presence.unsub){ presence.unsub(); presence.unsub = null; }
  if(presence.tick){ clearInterval(presence.tick); presence.tick = null; }
  presence.thread = null; presence.partner = null; presence.sent = { watching:false, typing:false, at:0 }; presence.shown = "";
  const b = document.querySelector("#dmStatus .dm-bubble"); if(b){ b.className = "dm-bubble"; b.innerHTML = ""; }
}
// typing + focus/visibility/tab changes all just re-evaluate
document.getElementById("privateChatInput").addEventListener("input", ()=> syncPresence());
document.addEventListener("visibilitychange", ()=>{ syncPresence(); renderPartnerPresence(); });
window.addEventListener("pagehide", ()=>{ syncPresence(); });
document.querySelectorAll("[data-chatsub],[data-ctab],[data-close-modal]").forEach(b=> b.addEventListener("click", ()=> setTimeout(()=>{ syncPresence(); renderPartnerPresence(); }, 60)));
document.getElementById("privateChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!state.currentChatPartner) { toast("Pick a friend to message."); return; }
  if(isMuted()){ muteBlockedToast("send chat messages"); return; }
  const input = document.getElementById("privateChatInput");
  const raw = input.value.trim();
  const text = moderateChatText(raw);
  if(!text) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  input.value=""; markRead(document.getElementById("chatLogPrivate"), "pm_"+threadId);
  syncPresence(true);                       // box is empty now: drop the typing indicator right away
  const replyTo = takeReply("private");
  const ok = await withErrorToast(()=> addDoc(collection(db,"privateChats",threadId,"messages"), { uid:state.uid, username:state.profile.username, text, ts:Date.now(), ...cosmeticFields(), ...(replyTo?{replyTo}:{}) }));
  if(ok===null){ input.value = raw; if(replyTo){ pendingReply.private = replyTo; renderReplyPreview("private"); } return; }
  // Ping the recipient's inbox so they get a popup if that chat isn't open
  // (the recipient's client shows the toast, then deletes this ping).
  addDoc(collection(db,"players",state.currentChatPartner.uid,"inbox"), {
    type:"new_message", fromUid: state.uid, fromUsername: state.profile.username, ts: Date.now()
  }).catch(()=>{});
});
/* Friend requests / accept notifications only ever write to the CURRENT
   user's own player doc — never to another player's — because the
   Firestore rules (correctly) forbid writing someone else's document.
   The other side of the handshake is applied by the OTHER player's own
   client, triggered by an inbox notification only they can read. */
async function sendFriendRequest(uid, username){
  if(isMuted()){ muteBlockedToast("send friend requests"); return; }
  if(uid === state.uid){ toast("You can't friend yourself!"); return; }
  if((state.profile.friends||[]).includes(uid)){ toast("You're already friends."); return; }
  if((state.profile.sentFriendRequests||[]).includes(uid)){ toast("Request already pending."); return; }
  const ok = await withErrorToast(async ()=>{
    await addDoc(collection(db,"players",uid,"inbox"), {
      type:"friend_request", fromUid: state.uid, fromUsername: state.profile.username, ts: Date.now()
    });
    // mark pending on OUR OWN doc only — flips the button to yellow
    // everywhere we view this profile, and blocks sending a 2nd request.
    await updateDoc(doc(db,"players",state.uid), { sentFriendRequests: arrayUnion(uid) });
  });
  if(ok!==null){ toast(`Friend request sent to ${username}`); closeModal("profileModal"); }
}
let crediting = false, creditQueued = null;
async function creditInbox(docs){
  if(crediting){ creditQueued = docs; return; } crediting = true;
  const items = [];
  try{
    await runTransaction(db, async tx=>{
      items.length = 0;
      const pref = doc(db,"players",state.uid), ps = await tx.get(pref), fresh = [];
      for(const d of docs){ const s = await tx.get(d.ref); if(s.exists() && !s.data().credited) fresh.push(s); }
      if(!fresh.length) return;
      tx.update(pref, { money: (ps.data().money||0) + fresh.reduce((a,s)=>a+(s.data().amount||0),0) });
      fresh.forEach(s=>{ tx.update(s.ref, { credited:true }); if(s.data().type==="duel_won" && s.data().itemName) items.push(s.data().itemName); });
    });
    items.forEach(n=>{ const it = Object.values(ITEM_BY_ID).find(i=>i.name===n); if(it) addItemToInv(it.id,1); });
  }catch(e){ console.error(e); toast(friendlyFirebaseError(e)); }
  finally{
    crediting = false;
    if(creditQueued){ const q = creditQueued; creditQueued = null; creditInbox(q); }
  }
}
const returnsInFlight = new Set();
async function claimReturnedAuctionItems(docs){
  const todo = docs.filter(d=> !returnsInFlight.has(d.id));
  if(!todo.length) return;
  todo.forEach(d=> returnsInFlight.add(d.id));
  try{
    const names = [];
    await runTransaction(db, async tx=>{
      names.length = 0;
      const pref = doc(db,"players",state.uid), ps = await tx.get(pref), fresh = [];
      for(const d of todo){ const s = await tx.get(d.ref); if(s.exists() && !s.data().claimed) fresh.push(s); }
      if(!fresh.length) return;
      const inv = (ps.data().inventory||[]).map(e=>({...e}));
      // A mod refund is never dropped for lack of space: it is added even if the bag is already full.
      for(const s of fresh){
        const { itemId, qty } = s.data(); if(!ITEM_BY_ID[itemId]) continue;
        const idx = inv.findIndex(e=>e.itemId===itemId);
        if(idx>=0 && inv[idx].qty>0) inv[idx].qty += qty; else if(idx>=0) inv[idx].qty = qty; else inv.push({ itemId, qty });
        names.push(`${ITEM_BY_ID[itemId].name} x${qty}`);
      }
      tx.update(pref, { inventory: inv });
      fresh.forEach(s=> tx.update(s.ref, { claimed:true }));
    });
    if(names.length) toast(`🛡️ A moderator removed your auction listing — ${names.join(", ")} returned to your inventory.`, 8000);
  }catch(e){ console.error(e); }
  finally{ todo.forEach(d=> returnsInFlight.delete(d.id)); }
}
function subscribeInbox(){
  const q = query(collection(db,"players",state.uid,"inbox"), orderBy("ts","desc"));
  let inboxFirst = true;
  const unsub = onSnapshot(q, snap=>{
    // Pop-up notification the instant a payment / auction sale lands
    // (the first snapshot is skipped; the welcome-back recap covers those).
    snap.docChanges().forEach(ch=>{
      if(ch.type!=="added") return;
      const n = ch.doc.data();
      if(n.type==="duel_challenge"){ handleDuelInvite(n, ch.doc.ref, inboxFirst); return; }
      if(n.type==="dm_seen"){
        const cur = (state.profile?.dmSeen||{})[n.fromUid]||0;
        if(n.ts>cur) updateDoc(doc(db,"players",state.uid), { [`dmSeen.${n.fromUid}`]: n.ts }).catch(()=>{});
        deleteDoc(ch.doc.ref).catch(()=>{});
        return;
      }
      if(n.type==="new_message"){
        const log = document.getElementById("chatLogPrivate");
        const viewing = log && log.offsetParent!==null && state.currentChatPartner?.uid===n.fromUid;
        if(!viewing){ dmLatest[n.fromUid] = Math.max(dmLatest[n.fromUid]||0, n.ts||Date.now()); updateUnreadDots(); }
        if(!inboxFirst && !viewing && notifOn("chat")) toast(`💬 ${n.fromUsername} sent you a new message — click to open`, 8000, "toast-money", ()=> openPrivateChatWith(n.fromUid, n.fromUsername));
        (inboxFirst ? (state.recapPromise||Promise.resolve()).catch(()=>{}) : Promise.resolve()).then(()=> deleteDoc(ch.doc.ref)).catch(()=>{});
        return;
      }
      if(inboxFirst) return;
      if(n.type==="payment_received" && !n.credited && notifOn("pay")){ toast(`💰 ${n.fromUsername} paid you $${fmtMoney(n.amount)}!`, 6000, "toast-money"); playSfx("buy"); }
      else if(n.type==="auction_sold" && !n.credited && notifOn("auction")){ toast(`🏷️ ${n.buyerName||"Someone"} bought your ${n.itemName} for $${fmtMoney(n.amount)}!`, 6000, "toast-money"); playSfx("buy"); }
    });
    inboxFirst = false;
    // Auto-credit ALL not-yet-credited auction sales in this batch as ONE
    // combined write (not one write per doc) — several sales landing in
    // the same snapshot and each reading state.profile.money separately
    // would race the same way the old crafting bug did.
    const uncredited = snap.docs.filter(d=> ["auction_sold","duel_won","payment_received"].includes(d.data().type) && !d.data().credited);
    if(uncredited.length) creditInbox(uncredited);
    const unclaimedReturns = snap.docs.filter(d=> d.data().type==="auction_returned" && !d.data().claimed);
    if(unclaimedReturns.length) claimReturnedAuctionItems(unclaimedReturns);
    const list = document.getElementById("inboxList");
    list.innerHTML="";
    snap.forEach(d=>{
      const n = d.data();
      if(n.type==="new_message" || n.type==="dm_seen" || n.type==="duel_challenge") return;
      const li = document.createElement("li");
      if(n.type==="friend_request"){
        li.innerHTML = `<span>${escapeHTML(n.fromUsername)} wants to be friends</span>
          <span><button class="doodle-btn btn-sm btn-green" data-a="accept">Accept</button>
          <button class="doodle-btn btn-sm" data-a="decline">Decline</button></span>`;
        li.querySelector('[data-a="accept"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          // only ever write to OUR OWN doc; notify the other player so
          // their own client adds the friendship on their side too
          await updateDoc(doc(db,"players",state.uid), { friends: arrayUnion(n.fromUid) });
          await addDoc(collection(db,"players",n.fromUid,"inbox"), {
            type:"friend_accept", byUid: state.uid, byUsername: state.profile.username, ts: Date.now()
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
        li.querySelector('[data-a="decline"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          // tell the sender so THEIR client can clear its own pending flag
          // (their button goes back to green) — we still never write to
          // their document directly.
          await addDoc(collection(db,"players",n.fromUid,"inbox"), {
            type:"friend_declined", byUid: state.uid, byUsername: state.profile.username, ts: Date.now()
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="friend_accept"){
        li.innerHTML = `<span>${escapeHTML(n.byUsername)} accepted your friend request!</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          await updateDoc(doc(db,"players",state.uid), {
            friends: arrayUnion(n.byUid), sentFriendRequests: arrayRemove(n.byUid)
          });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="friend_declined"){
        li.innerHTML = `<span>${escapeHTML(n.byUsername)} declined your friend request.</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          await updateDoc(doc(db,"players",state.uid), { sentFriendRequests: arrayRemove(n.byUid) });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="payment_received"){
        li.innerHTML = `<span>${escapeHTML(n.fromUsername)} paid you $${fmtMoney(n.amount)}! (credited to your balance)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="duel_won"){
        const itemMsg = n.itemName ? ` and their ${escapeHTML(n.itemName)}` : "";
        li.innerHTML = `<span>You won a duel vs ${escapeHTML(n.fromUsername)}! +$${fmtMoney(n.amount)}${itemMsg} (credited)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="auction_returned"){
        li.innerHTML = `<span>A moderator removed your ${escapeHTML(n.itemName||"item")} x${n.qty||1} from the auction — it was returned to your inventory.</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="auction_sold"){
        // Money is auto-credited above the moment this doc is seen — this
        // is now purely a dismissible reminder, no claim step.
        li.innerHTML = `<span>${escapeHTML(n.buyerName||"Someone")} bought your ${escapeHTML(n.itemName)} for $${fmtMoney(n.amount)}! (credited to your balance)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else {
        li.innerHTML = `<span>${escapeHTML(n.text||"Notification")}</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      }
      list.appendChild(li);
    });
    if(list.children.length===0) list.innerHTML="<li>Inbox is empty.</li>";
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}

/* =========================================================================
   AUCTION HOUSE
   Purchases are done as an UPDATE (mark status "sold"), never a delete by
   a non-owner — Firestore rules only allow the seller to delete their own
   listing (cancel). See rpg_firestore.rules for the exact conditions this
   depends on, and the note in the final write-up about why this still
   isn't fully trustless without a Cloud Function.
   ========================================================================= */
document.querySelectorAll("[data-aucsub]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-aucsub]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".aucsub-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("aucsub-"+btn.dataset.aucsub).classList.add("active");
    if(btn.dataset.aucsub==="mine") populatePostForm();
  });
});
let auctionUnsub = null;
let auctionListingsCache = {}; // id -> {listing, item}
let auctionSelectedId = null;
let auctionPage = 0, auctionRows = [];
const AUCTION_PER_PAGE = 12;       // 4 columns x 3 rows, same grid as the inventory
function drawAuctionPage(){
  const grid = document.getElementById("auctionGrid"); if(!grid) return;
  const pages = Math.max(1, Math.ceil(auctionRows.length/AUCTION_PER_PAGE));
  auctionPage = Math.max(0, Math.min(auctionPage, pages-1));
  grid.innerHTML = "";
  const slice = auctionRows.slice(auctionPage*AUCTION_PER_PAGE, auctionPage*AUCTION_PER_PAGE+AUCTION_PER_PAGE);
  for(let i=0;i<AUCTION_PER_PAGE;i++){
    const row = slice[i], cell = document.createElement("div");
    if(!row){ cell.className = "inv-cell"; grid.appendChild(cell); continue; }
    const { id, listing, item } = row;
    cell.className = "inv-cell rarity-"+item.rarity + (auctionSelectedId===id ? " selected" : "");
    cell.dataset.listingId = id;
    cell.innerHTML = `<div>${escapeHTML(item.name)}</div><span class="qty-badge">x${listing.qty}</span><div style="font-size:11px">$${fmtMoney(listing.pricePer)} ea</div>`;
    // Hover OR click shows the details/buy panel — buying itself always needs the
    // separate confirm button below, so a stray click can't buy anything.
    cell.addEventListener("mouseenter", ()=> showAuctionDetail(id));
    cell.addEventListener("click", ()=> selectAuctionListing(id));
    grid.appendChild(cell);
  }
  const nav = document.getElementById("auctionNav");
  if(nav){
    nav.style.display = auctionRows.length > AUCTION_PER_PAGE ? "" : "none";     // arrows only appear once there are 12+ listings
    document.getElementById("aucPageLabel").textContent = `Page ${auctionPage+1}/${pages} · ${auctionRows.length} listings`;
    document.getElementById("aucPrev").disabled = auctionPage<=0;
    document.getElementById("aucNext").disabled = auctionPage>=pages-1;
  }
}
document.getElementById("aucPrev").addEventListener("click", ()=>{ auctionPage--; drawAuctionPage(); });
document.getElementById("aucNext").addEventListener("click", ()=>{ auctionPage++; drawAuctionPage(); });
let auctionDetailTimerInterval = null;
function renderAuction(){
  // NOTE: this intentionally does NOT combine where("status","==","active")
  // with orderBy("postedAt") — mixing an equality filter with an orderBy on
  // a DIFFERENT field requires a Firestore composite index. Firebase won't
  // create that automatically, and without it this query fails outright
  // (which is why the auction house looked "broken"). Filtering status and
  // expiry client-side instead avoids needing any manual index.
  const q = query(collection(db,"auction"), orderBy("postedAt","desc"), limit(60));
  if(auctionUnsub) auctionUnsub();
  auctionUnsub = onSnapshot(q, snap=>{
    auctionListingsCache = {}; auctionRows = [];
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.status !== "active") return;
      if(listing.expiresAt < Date.now()) return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      auctionListingsCache[d.id] = { listing, item };
      auctionRows.push({ id:d.id, listing, item });
    });
    drawAuctionPage();
    // if the selected/hovered listing just disappeared (sold/expired/cancelled), hide the panel
    if(auctionSelectedId && !auctionListingsCache[auctionSelectedId]) hideAuctionDetail();
  }, (err)=> toast(friendlyFirebaseError(err)));
}
function selectAuctionListing(id){
  auctionSelectedId = id;
  document.querySelectorAll("#auctionGrid .inv-cell").forEach(c=> c.classList.toggle("selected", c.dataset.listingId===id));
  showAuctionDetail(id);
}
function showAuctionDetail(id){
  const entry = auctionListingsCache[id];
  const panel = document.getElementById("auctionDetail");
  if(!entry){ hideAuctionDetail(); return; }
  const { listing, item } = entry;
  panel.style.display = "";
  document.getElementById("aucDetailName").textContent = `${item.name} (${item.rarity}) x${listing.qty}`;
  document.getElementById("aucDetailMeta").textContent =
    `Posted by ${listing.sellerName} — $${fmtMoney(listing.pricePer)} each, $${fmtMoney(listing.pricePer*listing.qty)} total`;
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  const isOwnListing = listing.sellerUid === state.uid;
  buyBtn.style.display = isOwnListing ? "none" : "";
  buyBtn.disabled = false;
  buyBtn.textContent = "Buy";
  buyBtn.onclick = ()=> buyAuctionListing(id, listing, item);
  // mods get a Remove Item button: takes the listing down and gives the item back to the seller
  const rmBtn = document.getElementById("aucDetailRemoveBtn");
  rmBtn.style.display = isAdminUI() ? "" : "none";
  rmBtn.disabled = false; rmBtn.textContent = "Remove Item (mod)";
  rmBtn.onclick = ()=> modRemoveAuctionListing(id, listing, item);
  if(auctionDetailTimerInterval) clearInterval(auctionDetailTimerInterval);
  const tick = ()=>{
    const entryNow = auctionListingsCache[id];
    const timerEl = document.getElementById("aucDetailTimer");
    if(!entryNow){ clearInterval(auctionDetailTimerInterval); return; }
    const msLeft = entryNow.listing.expiresAt - Date.now();
    if(msLeft <= 0){ timerEl.textContent = "Expired"; clearInterval(auctionDetailTimerInterval); return; }
    timerEl.textContent = `Expires in ${fmtAuctionLeft(msLeft)}`;
  };
  tick();
  auctionDetailTimerInterval = setInterval(tick, 1000);
}
/* Mod removal: delete the listing (only if it's still active — never races a purchase)
   and drop an "auction_returned" notice in the seller's inbox. The SELLER's own client
   puts the item back in their inventory (see claimReturnedAuctionItems), because rules
   don't let anyone write another player's inventory directly. */
async function modRemoveAuctionListing(listingId, listing, item){
  if(!isAdminUI()) return;
  if(!confirm(`Remove ${item.name} x${listing.qty} from ${listing.sellerName}'s listing? It will be returned to them.`)) return;
  const rmBtn = document.getElementById("aucDetailRemoveBtn");
  rmBtn.disabled = true; rmBtn.textContent = "Removing…";
  let res = null, err = null;
  try{
    res = await runTransaction(db, async tx=>{
      const lref = doc(db,"auction",listingId), snap = await tx.get(lref);
      if(!snap.exists() || snap.data().status !== "active") throw new Error("gone");
      const L = snap.data();
      tx.delete(lref);
      return { sellerUid:L.sellerUid, itemId:L.itemId, qty:L.qty };
    });
  }catch(e){ err = e; }
  rmBtn.disabled = false; rmBtn.textContent = "Remove Item (mod)";
  if(!res){ toast(err?.message==="gone" ? "That listing was already sold or removed." : friendlyFirebaseError(err)); return; }
  hideAuctionDetail();
  await withErrorToast(()=> addDoc(collection(db,"players",res.sellerUid,"inbox"), {
    type:"auction_returned", itemId:res.itemId, itemName:item.name, qty:res.qty, ts:Date.now(), claimed:false
  }));
  toast(`Removed ${item.name} x${res.qty} — returned to ${listing.sellerName}.`);
}
function hideAuctionDetail(){
  auctionSelectedId = null;
  document.getElementById("auctionDetail").style.display = "none";
  if(auctionDetailTimerInterval){ clearInterval(auctionDetailTimerInterval); auctionDetailTimerInterval=null; }
}
async function buyAuctionListing(listingId, listing, item){
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  buyBtn.disabled = true; buyBtn.textContent = "Buying…";
  let bought = null, err = null;
  try{
    bought = await runTransaction(db, async (tx)=>{
      const lref = doc(db,"auction",listingId), pref = doc(db,"players",state.uid);
      const lsnap = await tx.get(lref), psnap = await tx.get(pref);
      if(!lsnap.exists() || lsnap.data().status !== "active" || lsnap.data().expiresAt < Date.now()) throw new Error("gone");
      const L = lsnap.data(), cost = L.pricePer * L.qty, d = psnap.data() || {};
      if(L.sellerUid === state.uid) throw new Error("own");
      if((d.money||0) < cost) throw new Error("nomoney");
      const inv = (d.inventory||[]).map(e=>({...e}));
      const idx = inv.findIndex(e=>e.itemId===L.itemId);
      if(idx>=0 && inv[idx].qty>0) inv[idx].qty += L.qty;
      else { if(invUsed(inv) >= invCap(d)) throw new Error("full"); if(idx>=0) inv[idx].qty = L.qty; else inv.push({ itemId:L.itemId, qty:L.qty }); }
      tx.update(lref, { status:"sold", buyerUid: state.uid, buyerName: state.profile.username, soldAt: Date.now() });
      tx.update(pref, { money: (d.money||0) - cost, inventory: inv });
      return { cost, qty:L.qty, sellerUid:L.sellerUid };
    });
  }catch(e){ err = e; }
  buyBtn.disabled=false; buyBtn.textContent="Buy";
  if(!bought){
    if(err?.message==="nomoney") toast("Not enough money!");
    else if(err?.message==="own") toast("You can't buy your own listing.");
    else if(err?.message==="gone") toast("That listing is no longer available.");
    else if(err?.message==="full") toast("Your inventory is full — free a slot (or buy a bigger backpack) first.");
    else toast(friendlyFirebaseError(err));
    return;
  }
  hideAuctionDetail();
  playSfx("buy");
  toast(`Bought ${item.name} x${bought.qty}`);
  // seller credits themselves from this notification — see subscribeInbox()
  await withErrorToast(()=> addDoc(collection(db,"players",bought.sellerUid,"inbox"), {
    type:"auction_sold", itemName:item.name, amount: bought.cost, buyerName: state.profile.username, ts: Date.now()
  }));
}
function populatePostForm(){
  const sel = document.getElementById("postItemSelect");
  sel.innerHTML="";
  invExpanded().forEach(e=>{
    const opt = document.createElement("option");
    opt.value = e.itemId; opt.textContent = `${e.item.name} (x${e.qty})`;
    sel.appendChild(opt);
  });
  updatePostTotal();
  renderMySlots();
}
function updatePostTotal(){
  const qty = Number(document.getElementById("postQty").value)||0;
  const raw = document.getElementById("postPrice").value.trim();
  const pa = raw ? parseAmount(raw) : { value:0 };
  document.getElementById("postTotalLabel").textContent = pa.err ? pa.err : `Total: $${fmtMoney(qty*pa.value)}`;
}
document.getElementById("postQty").addEventListener("input", updatePostTotal);
document.getElementById("postPrice").addEventListener("input", updatePostTotal);
document.getElementById("btnPostAuction").addEventListener("click", async ()=>{
  if(isMuted()){ muteBlockedToast("list items on the auction"); return; }
  const itemId = document.getElementById("postItemSelect").value;
  const qty = Number(document.getElementById("postQty").value);
  const pa = parseAmount(document.getElementById("postPrice").value);
  if(pa.err){ toast(pa.err); return; }
  const price = pa.value;
  if(!itemId || !Number.isInteger(qty) || qty<1){ toast("Quantity must be a whole number."); return; }
  try{
    const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid)));
    const activeCount = mySnap.docs.filter(d=>d.data().status==="active").length;
    if(activeCount >= 10){ toast("You can only have 10 auction slots."); return; }
  }catch(err){ toast(friendlyFirebaseError(err)); return; }
  const entry = invExpanded().find(e=>e.itemId===itemId);
  if(!entry || entry.qty < qty){ toast("You don't have that many."); return; }
  await changeInvQty(itemId, -qty);
  const ok = await withErrorToast(()=> addDoc(collection(db,"auction"), {
    sellerUid: state.uid, sellerName: state.profile.username, itemId, qty, pricePer: price,
    status:"active", postedAt: Date.now(), expiresAt: Date.now() + AUCTION_MS
  }));
  if(ok===null){ await addItemToInv(itemId, qty); return; } // roll back on failure
  playSfx("send");
  toast("Posted to auction house!");
  populatePostForm();
});
let mySlotsUnsub = null;
function renderMySlots(){
  if(mySlotsUnsub) return; // already live
  const q = query(collection(db,"auction"), where("sellerUid","==",state.uid));
  mySlotsUnsub = onSnapshot(q, snap=>{
    const grid = document.getElementById("myAuctionSlots");
    grid.innerHTML="";
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.status !== "active") return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      const cell = document.createElement("div");
      cell.className="inv-cell rarity-"+item.rarity;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><button class="doodle-btn btn-sm" style="margin-top:4px">Cancel</button>`;
      cell.querySelector("button").addEventListener("click", async (ev)=>{
        ev.stopPropagation();
        if(!hasItem(item.id) && invUsed(state.profile.inventory) >= invCap(state.profile)){ toast("Your inventory is full — free a slot before cancelling."); return; }
        const ok = await withErrorToast(()=> deleteDoc(doc(db,"auction",d.id)));
        if(ok===null) return;
        await applyInvChanges({ add:[{itemId:item.id, qty:listing.qty}], strict:true });
      });
      grid.appendChild(cell);
    });
  }, err=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(()=>{ if(mySlotsUnsub){ mySlotsUnsub(); mySlotsUnsub = null; } });
}

/* --- crafting: recipe book (banners you scroll; pick one, confirm with CRAFT) --- */
const RECIPES = [];
(function buildRecipes(){
  const I = ITEM_BY_ID;
  const add = (id, name, type, rarity, extra, ing)=>{
    if(!I[id]){
      const sell = Math.max(1, Math.round(ing.reduce((s,[iid,q])=> s+(I[iid]?.sellPrice||3)*q, 0)*1.3));
      I[id] = { id, name, type, rarity, price:sell*3, sellPrice:sell, desc:"Crafted.", stats:{}, ...extra };
    }
    RECIPES.push({ id:"rc_"+id, out:id, ing });
  };
  // coal-fired basics
  add("ing_copper","Copper Ingot","material","common",{desc:"Smelted copper."},[["ore_copper",2],["ore_coal",1]]);
  add("ing_iron","Iron Ingot","material","uncommon",{desc:"Smelted iron."},[["ore_iron",2],["ore_coal",1]]);
  add("ing_bronze","Bronze Ingot","material","uncommon",{desc:"Copper and iron alloy."},[["ore_copper",2],["ore_iron",1],["ore_coal",1]]);
  add("ing_steel","Steel Ingot","material","rare",{desc:"Hardened steel."},[["ing_iron",2],["ore_coal",2]]);
  add("gem_quartz_cut","Polished Quartz","material","rare",{desc:"A cut gem."},[["gem_quartz",2]]);
  add("gem_ruby_cut","Cut Ruby","material","epic",{desc:"A flawless cut gem."},[["gem_ruby",2]]);
  add("ing_silver","Silver Ingot","material","uncommon",{desc:"Smelted silver."},[["ore_silver",2],["ore_coal",1]]);
  add("ing_gold","Gold Ingot","material","rare",{desc:"Smelted gold."},[["ore_gold",2],["ore_coal",1]]);
  add("gem_sapphire_cut","Cut Sapphire","material","rare",{desc:"A cut gem."},[["gem_sapphire",2]]);
  add("gem_emerald_cut","Cut Emerald","material","epic",{desc:"A cut gem."},[["gem_emerald",2]]);
  add("gem_diamond_cut","Cut Diamond","material","legendary",{desc:"A flawless cut diamond."},[["gem_diamond",2]]);
  // cooked fish: 1 fish + 1 coal
  ["fish_minnow","fish_bass","fish_trout","fish_swordfish","fish_golden"].forEach(f=>
    add("cooked_"+f, "Cooked "+I[f].name, "consumable", I[f].rarity, { stats:{heal:HEAL_BY_RARITY[I[f].rarity]}, desc:"Grilled over coal. Heals well." }, [[f,1],["ore_coal",1]]));
  // roasted forage
  ["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple"].forEach(f=>
    add("roast_"+f, "Roasted "+I[f].name.replace(/^Wild |^Healing |^Forest /,""), "consumable", I[f].rarity, { stats:{heal:HEAL_BY_RARITY[I[f].rarity]}, desc:"Roasted over coal." }, [[f,1],["ore_coal",1]]));
  // dishes: every pair of edible ingredients
  const edible = ["forage_berry","forage_mushroom","forage_herb","forage_apple","forage_truffle","forage_goldapple","fish_minnow","fish_bass","fish_trout","fish_swordfish","fish_golden"];
  const short = id=> I[id].name.replace(/^Wild |^Healing |^Forest /,"");
  const sfx = ["Stew","Skewer","Pie","Soup","Salad","Roast"]; let n=0;
  for(let i=0;i<edible.length;i++) for(let j=i+1;j<edible.length;j++){
    const a=edible[i], b=edible[j];
    const rarity = RARITIES[Math.max(RARITIES.indexOf(I[a].rarity), RARITIES.indexOf(I[b].rarity))];
    add(`dish_${a}_${b}`, `${short(a)} & ${short(b)} ${sfx[n++%6]}`, "consumable", rarity, { stats:{heal:HEAL_BY_RARITY[rarity]}, desc:"A hearty homemade dish." }, [[a,1],[b,1]]);
  }
  // gear tiers
  const tiers = [["Copper","ing_copper","common","SPEED"],["Bronze","ing_bronze","uncommon","STRENGTH"],["Iron","ing_iron","uncommon","STRENGTH"],
                 ["Quartz","gem_quartz_cut","rare","SMARTS"],["Steel","ing_steel","rare","STRENGTH"],["Ruby","gem_ruby_cut","epic","CHARM"],
                 ["Silver","ing_silver","uncommon","SMARTS"],["Gold","ing_gold","rare","CHARM"],["Sapphire","gem_sapphire_cut","rare","SMARTS"],
                 ["Emerald","gem_emerald_cut","epic","SPEED"],["Diamond","gem_diamond_cut","legendary","STRENGTH"]];
  const weapons = ["Sword","Dagger","Axe","Spear","Mace","Bow"];
  const armors = [["Helm","helmet",3],["Chestplate","chestplate",5],["Leggings","leggings",4],["Boots","boots",3]];
  tiers.forEach(([t,mat,rar0,stat],ti)=>{
    const k = t.toLowerCase(), rar = gearRarity(k, rar0);
    weapons.forEach((w,i)=> add(`gear_${k}_${w.toLowerCase()}`, `${t} ${w}`, "weapon", rar, gearExtra({ attack:craftedWeaponAttack(rar,i,k) }, `A ${t.toLowerCase()} ${w.toLowerCase()} you forged yourself.`), [[mat,2+(i%2)],["ore_coal",1]]));
    armors.forEach(([a,slot,q])=> add(`gear_${k}_${a.toLowerCase()}`, `${t} ${a}`, "armor", rar, { armorSlot:slot, ...gearExtra(craftedArmorStats(slot, rar, stat, 0, k), `Sturdy ${t.toLowerCase()} gear.`) }, [[mat,q],["ore_coal",1]]));
    add(`gear_${k}_ring`, `${t} Ring`, "trinket", rar, gearExtra(craftedTrinketStats("ring", rar, stat, k), `A ${t.toLowerCase()} ring boosting ${stat}.`), [[mat,1],["ore_coal",1]]);
    add(`gear_${k}_amulet`, `${t} Amulet`, "trinket", rar, gearExtra(craftedTrinketStats("amulet", rar, stat, k), `A ${t.toLowerCase()} amulet boosting ${stat}.`), [[mat,2],["forage_herb",2]]);
  });
  // tools
  [["tool_pickaxe","ing_copper"],["tool_pickaxe2","ing_iron"],["tool_pickaxe3","ing_steel"]].forEach(([o,m])=> add(o,"","tool","common",{},[[m,2],["forage_mushroom",1]]));
  [["tool_fishingrod","ing_copper"],["tool_fishingrod2","ing_iron"],["tool_fishingrod3","ing_steel"]].forEach(([o,m])=> add(o,"","tool","common",{},[[m,1],["forage_herb",2]]));
  // gem/mineral tools: far more durable
  [[4,"Gold","ing_gold","rare",50],[5,"Emerald","gem_emerald_cut","epic",125],[6,"Diamond","gem_diamond_cut","legendary",220]].forEach(([n,nm,mat,rar,u])=>{
    TOOL_USES["tool_pickaxe"+n] = u; TOOL_USES["tool_fishingrod"+n] = u;
    add("tool_pickaxe"+n, `${nm} Pickaxe`, "tool", rar, { desc:`Breaks after ${u} uses.` }, [[mat,2],["ing_steel",1]]);
    add("tool_fishingrod"+n, `${nm} Fishing Rod`, "tool", rar, { desc:`Breaks after ${u} uses.` }, [[mat,1],["ing_steel",1],["forage_herb",2]]);
  });
  // in-between tiers and everything past diamond (the ladder above prices each at ~$16 per use)
  TOOL_LADDER.filter(t=> ["_cu","_br","_st","_pt","_ti","_my","_ad"].includes(t[0])).forEach(([sf,nm,u,price,rar,mat])=>{
    const light = sf==="_cu" || sf==="_br";
    TOOL_USES["tool_pickaxe"+sf] = u; TOOL_USES["tool_fishingrod"+sf] = u;
    add("tool_pickaxe"+sf, `${nm} Pickaxe`, "tool", rar, { desc:`Breaks after ${u} uses.` }, light ? [[mat,2],["forage_mushroom",1]] : sf==="_st" ? [[mat,3]] : [[mat,2],["ing_steel",1]]);
    add("tool_fishingrod"+sf, `${nm} Fishing Rod`, "tool", rar, { desc:`Breaks after ${u} uses.` }, light ? [[mat,1],["forage_herb",2]] : sf==="_st" ? [[mat,2],["forage_herb",2]] : [[mat,1],["ing_steel",1],["forage_herb",2]]);
  });
  TOOL_LADDER.forEach(([sf,nm,u,price,rar])=> ["pickaxe","fishingrod"].forEach(k=>{ const it = I[jobToolId(k,sf)]; if(it){ it.price = price; it.sellPrice = Math.max(1, Math.round(price*0.3)); TOOL_USES[it.id] = u; } }));
  // crop preserves: 3 crops -> 1 jar worth far more than the crops
  CROP_ITEMS.forEach(c=> add("pres_"+c.id, `${c.name} Preserve`, "material", c.rarity, { sellPrice: Math.round(c.sellPrice*3*1.9), desc:"Jarred and sealed. Sells for a ton." }, [[c.id,3]]));
  // gem elixirs
  ["gem_quartz_cut","gem_ruby_cut","gem_sapphire_cut","gem_emerald_cut","gem_diamond_cut"].forEach(g=>
    add("elixir_"+g, "Elixir of "+I[g].name.replace(/^Polished |^Cut /,""), "consumable", I[g].rarity, { stats:{heal:HEAL_BY_RARITY[I[g].rarity]}, desc:"A shimmering gem elixir." }, [[g,1],["forage_herb",1]]));
  // content expansion: smelting, gems, 18 more gear tiers, cooking, teas, potions (~400 recipes)
  addExpansionRecipes(add, I, { RARITY_MULT, armorStats, cat:CATALOG });
})();
/* ---------- economy: every item sells for ~10% less ----------
   Runs once, after every item (job items, crops, tools, ~400 crafted recipes) is registered.
   Buy prices are untouched. Backpacks (sell $0) stay at 0. */
Object.values(ITEM_BY_ID).forEach(it=>{
  if(it.sellPrice > 0) it.sellPrice = Math.max(1, Math.round(it.sellPrice * 0.9));
});

/* ---------- gear rebalance ----------
   Every armor piece gets its OWN stat line (no two pieces match), generated
   deterministically from the item id so every client agrees. Rarity makes
   better outcomes more common and the numbers bigger:
     - most pieces: +1 or 2 stats and +max HP
     - some pieces: "+this, -that" trade-offs (more common on low rarities)
     - rarely: a pure sacrifice (stat penalties) with a big max-HP bonus
   Weapon damage also scales much harder with rarity. */
(function rebalanceGear(){
  const ARMOR_RANGES = { common:[1,2,1,10], uncommon:[2,4,5,20], rare:[4,8,10,50], epic:[8,14,20,100], legendary:[14,24,50,200] };
  const ATTACK_RANGES = { common:[1,8], uncommon:[5,20], rare:[15,45], epic:[40,100], legendary:[80,200] };
  const FAV = { helmet:["SMARTS","CHARM","SMARTS","SPEED"], chestplate:["STRENGTH","STRENGTH","SMARTS","CHARM"],
                leggings:["SPEED","SPEED","STRENGTH","CHARM"], boots:["SPEED","CHARM","SPEED","STRENGTH"] };
  const hash = id=> ([...id].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0, 7) % 2147483000) + 101;
  const seen = new Set();
  Object.values(ITEM_BY_ID).forEach(it=>{
    if(it.type!=="armor" && it.type!=="weapon") return;
    if(it.fixedStats) return;                       // the GEAR section of rpg_content.js sets its own numbers
    const rnd = seededRand(hash(it.id)); rnd(); rnd();
    const int = (a,b)=> a + Math.floor(rnd()*(b-a+1)), ri = RARITIES.indexOf(it.rarity);
    if(it.type==="weapon"){
      const [lo,hi] = ATTACK_RANGES[it.rarity] || ATTACK_RANGES.common;
      it.stats = { attack: int(lo,hi) + (String(it.id).startsWith("gear_") ? 2 : 0) };
      return;
    }
    const [smin,smax,hmin,hmax] = ARMOR_RANGES[it.rarity] || ARMOR_RANGES.common;
    const fav = FAV[it.armorSlot] || FAV.chestplate;
    const pick = ()=> rnd()<0.6 ? fav[int(0,fav.length-1)] : SKILL_KEYS[int(0,3)];
    const other = not=>{ const o = SKILL_KEYS.filter(k=>k!==not); return o[int(0,o.length-1)]; };
    const pA = 0.5 + 0.1*ri, pC = Math.max(0.03, 0.18 - 0.04*ri), roll = rnd(), out = {};
    const s1 = pick();
    if(roll < pA){                                   // pure boost
      out[s1] = int(smin,smax); out.hp = int(hmin,hmax);
      if(ri>=2 && rnd() < 0.25 + 0.1*(ri-2)) out[other(s1)] = Math.max(1, Math.round(int(smin,smax)/2));
    } else if(roll < 1-pC){                          // trade-off: + this, - that
      out[s1] = int(smin,smax)+1; out[other(s1)] = -int(1, Math.max(1, Math.ceil(smax/2))); out.hp = int(hmin,hmax);
    } else {                                         // pure sacrifice: only penalties, but a big HP bonus
      out[s1] = -int(1, Math.max(1, Math.ceil(smax/2))); out.hp = int(hmax, Math.round(hmax*1.7));
    }
    const sig = o=> [o.hp, ...SKILL_KEYS.map(k=>o[k]||0)].join("|");
    let guard = 0; while(seen.has(sig(out)) && guard++ < 500) out.hp += 1;   // guarantee uniqueness
    seen.add(sig(out));
    it.stats = out;
  });
})();

/* ---------- healing rebalance (all heal amounts halved) ----------
   Every consumable gets a heal RANGE; the actual amount is rolled each time
   it is eaten/drunk. stats.heal stays as the average (used for sorting).
     berries / herbs / mushrooms / apples ..... 5-20
     rare foraged (truffle, golden apple) ..... 20-60
     roasted forage ........................... 10-40 (rare: 40-90)
     raw fish ................................. 10-80 (scaled by rarity)
     cooked fish .............................. 50-150 (scaled by rarity)
     homemade dishes .......................... 40-140 (scaled by rarity)
     potions / elixirs / tonics / draughts .... 5-150 (random)
     other procedural foods (bread, tea, ...) . 5-40 */
const HEAL_RANGES = {
  fishRaw:   { common:[10,30], uncommon:[20,50], rare:[40,70], epic:[50,75], legendary:[60,80] },
  fishCooked:{ common:[50,80], uncommon:[60,100], rare:[80,125], epic:[95,140], legendary:[110,150] },
  dish:      { common:[40,70], uncommon:[50,90], rare:[70,110], epic:[90,125], legendary:[110,140] }
};
function healRangeFor(it){
  const id = it.id, r = it.rarity;
  if(id.startsWith("fish_")) return HEAL_RANGES.fishRaw[r];
  if(id.startsWith("cooked_")) return HEAL_RANGES.fishCooked[r];
  if(id.startsWith("dish_")) return HEAL_RANGES.dish[r];
  if(id.startsWith("elixir_")) return [5,150];
  if(id.startsWith("roast_")) return (id==="roast_forage_truffle"||id==="roast_forage_goldapple") ? [40,90] : [10,40];
  if(id==="forage_truffle") return [20,60];
  if(id==="forage_goldapple") return [40,100];
  if(id.startsWith("forage_")) return ({ rare:[20,60], epic:[40,90], legendary:[60,120] })[r] || [5,20];
  if(/(Potion|Elixir|Tonic|Draught|Brew)$/.test(it.name)) return [5,150];
  return [5,40];
}
Object.values(ITEM_BY_ID).filter(i=>i.type==="consumable").forEach(i=>{
  i.stats = i.stats || {};
  if(i.manaFinal){ i.stats.manaMin = i.manaFinal[0]; i.stats.manaMax = i.manaFinal[1]; i.stats.mana = Math.round((i.manaFinal[0]+i.manaFinal[1])/2); }
  if(i.healFinal){   // potions define their exact heal range (b===0 means "no heal", e.g. mana potions)
    const [a,b] = i.healFinal;
    if(b>0){ i.stats.healMin = a; i.stats.healMax = b; i.stats.heal = Math.round((a+b)/2); }
    else { delete i.stats.heal; delete i.stats.healMin; delete i.stats.healMax; }
    return;
  }
  const [lo0,hi0] = healRangeFor(i);
  const cookedMult = /^(cooked_|dish_|roast_)/.test(i.id) ? 2 : 1;                      // crafted/cooked food heals 2x
  const lo = Math.max(1, Math.round(lo0/2)*cookedMult), hi = Math.max(lo, Math.round(hi0/2)*cookedMult);   // foods now heal half as much (cooked ones are doubled)
  i.stats.healMin = lo; i.stats.healMax = hi; i.stats.heal = Math.round((lo+hi)/2);
});
function rollHeal(item){
  const st = item.stats||{};
  if(st.healMin==null) return st.heal||0;
  return st.healMin + Math.floor(Math.random()*(st.healMax-st.healMin+1));
}
const rollMana = item=>{ const st = item.stats||{}; return st.manaMin==null ? (st.mana||0) : st.manaMin + Math.floor(Math.random()*(st.manaMax-st.manaMin+1)); };
const manaText = st=> st.manaMin!=null ? `${st.manaMin}-${st.manaMax}` : `${st.mana}`;
const healText = st=> st.healMin!=null ? `${st.healMin}-${st.healMax}` : `${st.heal}`;
const haveQty = id=> (state.profile.inventory||[]).find(e=>e.itemId===id)?.qty||0;
const canCraft = r=> r.ing.every(([id,q])=> haveQty(id)>=q);
/* crafting menu categories (tabs) */
const CRAFT_TABS = [
  { id:"all", label:"All" }, { id:"consumable", label:"🍖 Consumables" }, { id:"armor", label:"🛡️ Armor" }, { id:"weapon", label:"⚔️ Weapons" },
  { id:"trinket", label:"💍 Trinkets" }, { id:"tool", label:"🛠️ Tools" }, { id:"ingot", label:"🔩 Ingots" }, { id:"material", label:"💎 Gems & Materials" }
];
const craftCat = it=> it.type==="material" ? (it.id.startsWith("ing_") ? "ingot" : "material") : it.type;
function renderCraftInv(){
  const p = state.profile; if(!p) return;
  const owned = invExpanded().map(e=>e.item.id), disc = new Set(p.discovered||[]);
  const fresh = owned.filter(id=>!disc.has(id));
  if(fresh.length){ fresh.forEach(id=>disc.add(id)); updateDoc(doc(db,"players",state.uid), { discovered: arrayUnion(...fresh) }).catch(()=>{}); }
  const allUnlocked = RECIPES.filter(r=> r.ing.every(([id])=> disc.has(id)));
  document.getElementById("recipeCount").textContent = `${allUnlocked.length} / ${RECIPES.length} recipes discovered`;
  const tab = state.craftTab || "all", counts = {};
  allUnlocked.forEach(r=>{ const c = craftCat(ITEM_BY_ID[r.out]); counts[c] = (counts[c]||0)+1; });
  const tabsEl = document.getElementById("craftTabs"); tabsEl.innerHTML = "";
  CRAFT_TABS.forEach(t=>{
    const n = t.id==="all" ? allUnlocked.length : (counts[t.id]||0);
    const b = document.createElement("button");
    b.className = "craft-tab" + (tab===t.id?" active":"");
    b.textContent = `${t.label} (${n})`;
    b.addEventListener("click", ()=>{ state.craftTab = t.id; renderCraftInv(); });
    tabsEl.appendChild(b);
  });
  const unlocked = allUnlocked.filter(r=> tab==="all" || craftCat(ITEM_BY_ID[r.out])===tab);
  unlocked.sort((a,b)=> canCraft(b)-canCraft(a));
  const list = document.getElementById("recipeList"); list.innerHTML = "";
  if(!unlocked.length) list.innerHTML = "<div class=\"recipe-empty\">Nothing discovered here yet — gather more materials!</div>";
  unlocked.forEach(r=>{
    const it = ITEM_BY_ID[r.out], ok = canCraft(r);
    const el = document.createElement("div");
    el.className = `recipe-banner rarity-${it.rarity}` + (ok?" can":"") + (state.selRecipe===r.id?" sel":"");
    el.innerHTML = `<b>${it.name}</b><span>${r.ing.map(([id,q])=>`${q}x ${ITEM_BY_ID[id].name}`).join(" + ")}</span>`;
    el.addEventListener("click", ()=>{ state.selRecipe=r.id; renderCraftInv(); });
    list.appendChild(el);
  });
  const sel = RECIPES.find(r=>r.id===state.selRecipe), det = document.getElementById("recipeDetail"), btn = document.getElementById("btnCraft");
  if(!sel){ det.textContent = "Pick a recipe above."; btn.disabled = true; return; }
  const it = ITEM_BY_ID[sel.out], st = it.stats||{};
  const eff = st.luck?itemEffectText(it): st.heal?`Heals ${healText(st)} HP`: st.attack?`+${st.attack} attack`: it.type==="armor"?itemEffectText(it): Object.keys(st).filter(k=>k!=="curse").map(k=>`+${st[k]} ${k}`).join(" ");
  det.innerHTML = `<h3>${it.name} <small>(${it.rarity})</small></h3><p>${it.desc||""} ${eff}</p><p><b>Sells for $${fmtMoney(it.sellPrice||0)}</b></p>` +
    sel.ing.map(([id,q])=>`<div class="${haveQty(id)>=q?"ok":"no"}">${ITEM_BY_ID[id].name}: ${haveQty(id)}/${q}</div>`).join("");
  btn.disabled = !canCraft(sel);
}
document.getElementById("btnCraft").addEventListener("click", async ()=>{
  const r = RECIPES.find(x=>x.id===state.selRecipe); if(!r) return;
  if(!canCraft(r)){ toast("You're missing ingredients."); return; }
  const ok = await applyInvChanges({ remove:r.ing.map(([itemId,qty])=>({itemId,qty})), add:[{itemId:r.out, qty:1}], strict:true }, { craftCount: increment(1) });
  if(ok===null) return;
  toast(`Crafted ${ITEM_BY_ID[r.out].name}!`);
  renderCraftInv();
});

/* =========================================================================
   BATTLE: PvE
   ========================================================================= */
/* PvE no longer opens a menu-driven battle modal — monsters live in the
   open world and are fought in real time with Space (see the WORLD
   section below). These pieces are still shared by that system. */
function pickEnemy(difficulty){
  const pool = ENEMY_BANK.filter(e=>e.region===state.profile.region && e.difficulty===difficulty);
  const slot = pool[Math.floor(Math.random()*pool.length)];
  return slot && makeMonsterFromSlot(slot, state.profile.level);
}
/* How hard an enemy hits, relative to YOUR own attack power (dungeon enemies use their own floor scaling):
     easy ~0.6x, medium ~1x, hard ~1.5x — blended 50/50 with the monster's level-based attack so it still grows with level. */
const ENEMY_HIT_REF = { easy:0.6, medium:1.0, hard:1.5 };
function enemyHitBase(m, b){
  if(b && b.dg) return m.attack;
  return (m.attack + playerAttackPower()*(ENEMY_HIT_REF[m.difficulty]||1)) / 2;
}
function playerAttackPower(){
  const p = state.profile;
  const weapon = p.equipped.weapon && ITEM_BY_ID[p.equipped.weapon];
  return 4 + p.stats.STRENGTH*1.5 + p.stats.SMARTS + (weapon?.stats.attack||0) + skillDamage(p);
}
/* Skill-based attacks: Space = basic attack, number keys 1-4 in the open
   world trigger the others (see WORLD section). Kept from the old menu
   system so unlock levels/costs stay consistent. */
const ATTACK_SKILLS = [
  { id:"basic", name:"Attack", key:"1", unlockLevel:1,
    dmgMult:()=>1, desc:"A standard strike. Always available." },
  { id:"power", name:"Power Strike", key:"2", unlockLevel:1, needsFullRage:true,
    dmgMult:()=>2, desc:"Costs full Rage. Double damage." },
  { id:"precision", name:"Precision Strike", key:"3", unlockLevel:10, manaCost:10,
    dmgMult:()=>1.35, desc:"Unlocked at Lv.10. Costs 10 mana. Extra damage that cuts through a brace." },
  { id:"ultimate", name:"Ultimate Strike", key:"4", unlockLevel:30, manaCost:20,
    dmgMult:()=>3, desc:"Unlocked at Lv.30. Costs 20 mana. Devastating hit." },
];
const spellRoll = ([lo,hi])=> lo + Math.floor(Math.random()*(hi-lo+1));
function attackSkillById(id){ return ATTACK_SKILLS.find(s=>s.id===id) || treeAttacks(state.profile).find(s=>s.id===id) || ATTACK_SKILLS[0]; }
/* Skill-tree attacks (Firebolt, Cyclone, ...) join the normal attack list once bought. */
function treeAttacks(p){
  return ownedSkills(p).filter(isSpellNode).map(n=>{
    const s = { id:"tree_"+n.id, name:n.name, unlockLevel:1, manaCost:n.mana, hpCost:0, flatDmg:0, dmgMult:()=>1, cooldown:0 };
    if(n.kind==="A"){ s.flatDmg = n.val; s.desc = `Skill tree attack. Costs ${n.mana} mana. Deals +${n.val} damage compared with a basic attack.`; }
    else if(n.kind==="L"){ s.healHp = [n.lo,n.hi]; s.cooldown = n.cd; s.desc = `Costs ${n.mana} mana. A basic attack that also heals you for ${n.lo}-${n.hi} HP. Cooldown: ${n.cd} moves.`; }
    else { s.healMana = [n.lo,n.hi]; s.hpCost = n.hpCost||0; s.cooldown = n.cd; s.desc = `Costs ${n.mana} mana and ${s.hpCost} HP. A basic attack that also restores ${n.lo}-${n.hi} mana. Cooldown: ${n.cd} moves.`; }
    return s;
  });
}
function knownAttacks(p){ return [ ...ATTACK_SKILLS.filter(s=>p.level>=s.unlockLevel), ...treeAttacks(p) ]; }
// Mana regenerates 1 point/minute while the world is loaded. Persisted to
// Firestore, not just local state, so it survives navigating away.
let manaRegenInterval=null;
function startManaRegen(){
  if(manaRegenInterval) clearInterval(manaRegenInterval);
  manaRegenInterval = setInterval(()=>{
    const p = state.profile; if(!p) return;
    const u = { playtime:(p.playtime||0)+60, lastSeen:Date.now() };
    if((p.mana||0) < (p.manaMax||0)) u.mana = (p.mana||0)+1;
    if((p.hp||0) < (p.hpMax||0)){ u.hp = Math.min(p.hpMax, p.hp+1); u.lastHpRegenTs = Date.now(); }
    updateDoc(doc(db,"players",state.uid), u).catch(()=>{});
  }, 60000);
}
function stopManaRegen(){ if(manaRegenInterval){ clearInterval(manaRegenInterval); manaRegenInterval=null; } }
function battleLogPush(msg){
  state.battle.log.push(msg);
  const el = document.getElementById("battleLog");
  el.innerHTML = state.battle.log.slice(-30).map(m=>`<div>${m}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
// Dying = hitting 1 HP in battle: you're kicked out, lose 10-25% of your
// money, and lose one random item from your inventory. extraFields lets
// callers (world PvE/PvP loss vs. duel loss) merge in their own updates
// in one write.
async function applyDeathPenalty(extraFields={}){
  const p = state.profile;
  const pct = 0.10 + Math.random()*0.15;
  const moneyLoss = Math.floor((p.money||0) * pct);
  const updates = {
    hp: 1, rage: 0,
    deaths: (p.deaths||0)+1,
    money: Math.max(0, (p.money||0) - moneyLoss),
    killstreak: 0,
    ...extraFields
  };
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), updates));
  const inv = p.inventory||[];
  let lostItemName = null;
  if(inv.length){
    const pick = inv[Math.floor(Math.random()*inv.length)];
    lostItemName = ITEM_BY_ID[pick.itemId]?.name || null;
    await changeInvQty(pick.itemId, -1);
  }
  return { moneyLoss, lostItemName };
}


/* =========================================================================
   PvE: strategic turn-based monster battles (Monsters tab)
   Each turn the monster TELEGRAPHS its intent (hard/medium ones sometimes
   feint). Pick a move that answers it, and manage Mana, Rage and food.
   ========================================================================= */
const MAX_EATS_PER_TURN = 3;   // food items you may eat in one turn, PvE and duels alike
const INTENTS = {
  wait:  { icon:"👀", label:"Sizing you up", tip:"It hesitates — enemies can never attack on their first turn." },
  weak:  { icon:"🗡️", label:"Weak Attack",   tip:"A light jab, about 0.6x damage.", mult:0.6, atk:true },
  normal:{ icon:"⚔️", label:"Attack",        tip:"A normal hit.", mult:1, atk:true },
  strong:{ icon:"💥", label:"Strong Attack", tip:"A powerful blow, about 1.9x damage — Guard or Counter it!", mult:1.9, atk:true },
  heal:  { icon:"💚", label:"Recover",       tip:"It heals about 8% of its max HP and does not attack." },
  guard: { icon:"🛡️", label:"Guard",         tip:"Takes 60% less damage this turn — set up a Focus, or use Precision." },
  mana:  { icon:"🔮", label:"Mana Drain",    tip:"Drains about 25% of your mana and heals it. Counter whiffs on this." },
  stun:  { icon:"💫", label:"Stunned",       tip:"It skips its turn — hit it hard!" }
};
/* every move has a 1-turn cooldown: an enemy never picks the same move twice in a row */
const INTENT_WEIGHTS = { easy:{weak:4,normal:4,strong:1,heal:2,guard:2,mana:1}, medium:{weak:2,normal:4,strong:3,heal:2,guard:2,mana:2}, hard:{weak:1,normal:3,strong:4,heal:2,guard:2,mana:2} };
const BOSS_WEIGHTS = { weak:8, normal:26, strong:18, heal:22, guard:16, mana:10 };
const guardTakenMult = ()=> 1 - (0.6 + Math.random()*0.3);   // Guard blocks a random 60-90% of the hit
const REGION_SPRITE = { forest:"🐺", mountains:"🦅", volcano:"🐲", reef:"🦀" };
function rollIntent(w, prev, b){
  const bag = Object.entries(w).filter(([k])=> k!==prev && !(k==="heal" && b.ehp > b.m.hp*0.85) && !(k==="mana" && b.mana < 3)).flatMap(([k,n])=>Array(n).fill(k));
  return bag[Math.floor(Math.random()*bag.length)] || "normal";
}
/* what the enemy WILL do next turn is shown to you up front (no feints) so you can plan around it */
function nextIntent(b){
  const prev = b.actual;
  if(b.m.boss){
    if(prev==="strong" && Math.random()<0.45){ b.shown = b.actual = "stun"; return; }      // a boss that slams is left open
    b.shown = b.actual = rollIntent(BOSS_WEIGHTS, prev, b); return;
  }
  b.shown = b.actual = rollIntent(INTENT_WEIGHTS[b.m.difficulty] || INTENT_WEIGHTS.medium, prev, b);
}
function startPve(diff, dg=null, mOverride=null){
  const p = state.profile, m = dg ? dg.m : (mOverride || pickEnemy(diff));
  if(!m){ toast("No monsters here."); return; }
  if(!dg && m.tierId && pveCdLeft(m.tierId)>0){ toast("That tier is on cooldown."); return; }
  if(state.battle && state.battle.mode==="duel"){ toast("Finish your duel first."); return; }
  state.battle = { mode:"pve", m, dg, ehp:m.hp, php:p.hp, mana:p.mana, rage:p.rage, guard:false, focus:false, counter:false, log:[], over:false, busy:false, eats:0,
    reopenCompass: document.getElementById("compassModal").classList.contains("active") };   // put the compass back when the fight is over
  document.querySelectorAll(".modal-backdrop.active").forEach(x=>x.classList.remove("active"));
  openModal("battleModal"); setPvpRxVisible(false);
  battleLogPush(`A wild ${m.name} (Lv.${m.level}) appears! You move first.`);
  state.battle.shown = state.battle.actual = "wait";          // no enemy attacks on its first turn
  renderPve();
}
function renderPve(){
  const b = state.battle, p = state.profile, m = b.m;
  document.getElementById("battleEnemyName").textContent = `${m.name} Lv.${m.level}`;
  document.getElementById("battleEnemySprite").textContent = m.sprite || REGION_SPRITE[m.region] || "🐉";
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,b.ehp)/m.hp)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,b.ehp)}/${m.hp}`;
  document.getElementById("battlePlayerName").textContent = p.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,b.php)/p.hpMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,b.php)}/${p.hpMax}`;
  document.getElementById("battleStaminaLabel").textContent = `Mana ${b.mana}/${p.manaMax}${b.focus?" · 🎯 Focused (next hit x2)":""}`;
  document.getElementById("battleRageLabel").textContent = `${b.rage}/${p.rageMax}`;
  { const ib = document.getElementById("battleIntent"); if(ib){ const it = INTENTS[b.shown] || INTENTS.normal; ib.innerHTML = b.over ? "" : `${it.icon} <b>${it.label}</b> — ${escapeHTML(it.tip)}`; } }
  if(document.getElementById("eatModal").classList.contains("active")) renderEatModal();
  const box = document.getElementById("battleActions"); box.innerHTML = "";
  if(b.over) return;
  const add = (label, tip, fn, disabled, cls="btn-pink")=>{
    const el = document.createElement("button");
    el.className = `doodle-btn btn-sm ${cls}`; el.textContent = label; el.title = tip; el.disabled = !!disabled;
    el.addEventListener("click", fn); box.appendChild(el);
  };
  knownAttacks(p).forEach(s=>{
    const cd = (b.cd||{})[s.id]||0;
    add(cd>0 ? `${s.name} (${cd})` : s.name, s.desc, ()=>pveAct(s.id), cd>0);
  });
  add(b.lastMove==="guard" ? "Guard (cooldown)" : "Guard", "Block 60-90% of the damage this turn and gain 2 Rage. Can only be used every other turn.", ()=>pveAct("guard"), b.lastMove==="guard", "btn-blue");
  add("Focus", "Skip attacking. Your next attack deals double damage.", ()=>pveAct("focus"), false, "btn-blue");
  const eatsLeftNow = Math.max(0, MAX_EATS_PER_TURN - (b.eats||0));
  add(eatsLeftNow>0 ? "🍖 Eat" : "🍖 Eat (max 3)", `Open your food bag and pick what to eat. Free action — does NOT end your turn. Max ${MAX_EATS_PER_TURN} items per turn.`, openEatModal, eatsLeftNow<=0, "btn-green");
  if(!b.dg || b.dg.gauntlet) add("Flee", b.dg ? "Abandon the boss gauntlet — you start again from the first enemy." : "Escape safely — you lose nothing.", pveFlee, false, "btn-yellow");   // no fleeing from the dungeon
}
async function pveAct(move){
  const b = state.battle; if(!b || b.mode!=="pve" || b.over || b.busy) return;
  b.busy = true;
  const p = state.profile, m = b.m, rnd = ()=>0.9+Math.random()*0.2; let intent = b.actual;
  // Guard and Counter have a 1-turn cooldown: greyed out the turn right after you use them.
  if((move==="guard"||move==="counter") && b.lastMove===move){ toast(`${move==="guard"?"Guard":"Counter"} is on cooldown.`); b.busy=false; return; }
  // Other moves are never greyed out; ones you can't afford just tell you why (and don't use your turn).
  const sk = [...ATTACK_SKILLS, ...treeAttacks(p)].find(x=>x.id===move);
  if(sk && sk.needsFullRage && b.rage<p.rageMax){ toast("Not enough Rage."); b.busy=false; return; }
  if(sk && sk.manaCost && b.mana<sk.manaCost){ toast("Not enough Mana."); b.busy=false; return; }
  if(sk && sk.hpCost && b.php <= sk.hpCost){ toast(`Not enough HP — ${sk.name} costs ${sk.hpCost} HP.`); b.busy=false; return; }
  if(sk && sk.cooldown && ((b.cd||{})[sk.id]||0)>0){ toast(`${sk.name} is on cooldown (${b.cd[sk.id]} more moves).`); b.busy=false; return; }
  b.cd = b.cd || {};                                                            // every move you make ticks the spell cooldowns down
  Object.keys(b.cd).forEach(k=>{ if(b.cd[k]>0) b.cd[k]--; });
  if(sk && sk.cooldown) b.cd[sk.id] = sk.cooldown;
  b.lastMove = move;
  const brace = intent==="guard";
  let guard=false, counter=false;
  if(move==="guard"){ guard=true; b.rage=Math.min(p.rageMax,b.rage+2); battleLogPush("You raise your guard."); }
  else if(move==="counter"){ counter=true; battleLogPush("You ready a counter…"); }
  else if(move==="focus"){ b.focus=true; battleLogPush("You focus, gathering strength."); }
  else {
    const s = attackSkillById(move);
    if(s.needsFullRage) b.rage = 0;
    if(s.manaCost) b.mana -= s.manaCost;
    else if(s.id==="basic") b.rage = Math.min(p.rageMax, b.rage+1);
    if(s.hpCost){ b.php -= s.hpCost; battleLogPush(`${s.name} costs you ${s.hpCost} HP.`); }
    let d = (playerAttackPower()*s.dmgMult() + (s.flatDmg||0))*rnd()*(b.focus?2:1);
    if(brace && s.id!=="precision") d*=0.4;
    d = Math.max(1, Math.round(d)); b.focus = false; b.ehp -= d;
    if(m.boss && b.ehp>0 && d >= m.hp*0.10 && Math.random()<0.5){ intent = b.actual = b.shown = "stun"; battleLogPush(`${m.name} is staggered by the blow!`); }   // big hits can stun a boss
    battleLogPush(`You use ${s.name}: ${d} damage${brace&&s.id!=="precision"?" (braced!)":""}.`);
    if(s.healHp){ const h = Math.min(spellRoll(s.healHp), p.hpMax-b.php); if(h>0){ b.php += h; battleLogPush(`${s.name} heals you for ${h} HP.`); } }
    if(s.healMana){ const g = Math.min(spellRoll(s.healMana), p.manaMax-b.mana); if(g>0){ b.mana += g; battleLogPush(`${s.name} restores ${g} mana.`); } }
  }
  if(b.ehp<=0) return pveEnd(true);
  // enemy turn
  if(intent==="wait") battleLogPush(`${m.name} sizes you up and holds back.`);
  else if(intent==="stun") battleLogPush(`${m.name} is stunned and skips its turn!`);
  else if(intent==="heal"){ const h = Math.round(m.hp*(m.boss?0.05:0.08)); b.ehp = Math.min(m.hp, b.ehp+h); battleLogPush(`${m.name} recovers ${h} HP.`); }
  else if(intent==="guard") battleLogPush(`${m.name} braces itself.`);
  else if(intent==="mana"){
    if(counter) battleLogPush(`${m.name} tries to drain your mana, but your counter whiffs past it.`);
    const take = Math.min(b.mana, Math.max(1, Math.round(b.mana*0.25))); b.mana -= take; const h = take*2; b.ehp = Math.min(m.hp, b.ehp+h);
    battleLogPush(`${m.name} drains ${take} of your mana and heals ${h}.`);
  }
  else {
    const mult = INTENTS[intent]?.mult || 1;
    if(counter && INTENTS[intent]?.atk){
      const back = Math.max(1,Math.round(playerAttackPower()*1.5*rnd())); b.ehp-=back;
      battleLogPush(`Countered! ${m.name}'s ${INTENTS[intent].label} is negated and you deal ${back}.`);
    } else {
      let d = enemyHitBase(m, b)*mult*rnd();
      if(guard) d*=guardTakenMult(); if(counter) d*=1.3;
      d = Math.max(1, Math.max(1, Math.round(d)) - (p.stats?.CHARM||0));       // every point of CHARM = 1 less damage taken (min 1)
      b.php -= d; b.rage=Math.min(p.rageMax,b.rage+2);
      battleLogPush(`${m.name} uses ${INTENTS[intent].label}: ${d} damage${guard?" (guarded)":""}.`);
    }
  }
  if(b.ehp<=0) return pveEnd(true);
  if(b.php<=0) return pveEnd(false);
  b.eats = 0;                                        // new turn: eating is available again
  { const sp = p.stats?.SPEED||0;                    // every point of SPEED = +1 mana regenerated per turn
    if(sp>0 && b.mana<p.manaMax){ const g = Math.min(sp, p.manaMax-b.mana); b.mana += g; battleLogPush(`Your speed restores ${g} mana.`); } }
  nextIntent(b); b.busy=false; renderPve();
}
async function pveFlee(){
  const b = state.battle; if(!b || b.mode!=="pve" || b.over) return;
  b.over = true;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:Math.max(1,b.php), mana:b.mana, rage:b.rage }));
  toast(b.dg?.gauntlet ? "You abandoned the gauntlet — it resets to the first enemy." : "You fled safely — nothing lost.");
  closeModal("eatModal"); closeModal("battleModal"); const rc = b.reopenCompass; state.battle = null; reopenCompassIf(rc);
  if(b.dg?.onFlee) b.dg.onFlee(); else if(!b.dg && b.m.tierId) setPveCd(b.m.tierId);
}
async function pveEnd(won){
  const b = state.battle, m = b.m; b.over = true; renderPve();
  if(!b.dg && m.tierId) setPveCd(m.tierId);
  if(won){
    battleLogPush(`Victory! +${m.xpReward} XP, +$${fmtMoney(m.moneyReward)}.`);
    await grantMoney(m.moneyReward); await grantXP(m.xpReward);
    if(!b.dg && Math.random()<m.dropChance){
      const pool = shopPool(m.element).filter(i=>i.type!=="consumable");
      const it = weightedShuffle(pool)[0];
      if(it){ await addItemToInv(it.id,1); battleLogPush(`It dropped ${it.name}!`); }
    }
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:Math.max(1,b.php), mana:b.mana, rage:b.rage, monstersKilled:increment(1) }));
  } else {
    battleLogPush("You were defeated…");
    if(!b.dg){
      const r = await applyDeathPenalty({ mana:b.mana });
      toast(`Defeated. Lost $${fmtMoney(r.moneyLoss)}${r.lostItemName?` and your ${r.lostItemName}`:""}.`);
    }
  }
  setTimeout(()=>{ closeModal("eatModal"); closeModal("battleModal"); { const ib = document.getElementById("battleIntent"); if(ib) ib.innerHTML = ""; } const rc = b.reopenCompass; state.battle=null; reopenCompassIf(rc);
    if(b.dg){ if(won) b.dg.onWin(); else if(b.dg.onLose) b.dg.onLose(); else dgLeave("death", b.mana); } }, 1800);
}



/* =========================================================================
   BATTLE TAB — PVE tiers, PVP (+ friend challenges), Boss Fights
   ========================================================================= */
const PVE_TIERS = [   // lv = level offset from you, rewards are the exact ranges
  { id:"novice",   label:"Novice",   emoji:"🌱", cls:"btn-green",  diff:"easy",   lv:[-25,-15], money:[1,4],     xp:[1,3],     mult:0.8 },
  { id:"easy",     label:"Easy",     emoji:"🍃", cls:"btn-green",  diff:"easy",   lv:[-12,-6],  money:[3,8],     xp:[3,10],    mult:1.0 },
  { id:"skilled",  label:"Skilled",  emoji:"🗡️", cls:"btn-yellow", diff:"medium", lv:[-5,-2],   money:[5,14],    xp:[6,25],    mult:1.1 },
  { id:"moderate", label:"Moderate", emoji:"⚔️", cls:"btn-yellow", diff:"medium", lv:[-1,1],    money:[8,25],    xp:[10,50],   mult:1.3 },
  { id:"hard",     label:"Hard",     emoji:"🔥", cls:"btn-pink",   diff:"hard",   lv:[2,5],     money:[20,50],   xp:[25,80],   mult:1.6 },
  { id:"deadly",   label:"Deadly",   emoji:"☠️", cls:"btn-pink",   diff:"hard",   lv:[6,10],    money:[35,80],   xp:[50,130],  mult:1.6 },
  { id:"brutal",   label:"Brutal",   emoji:"💀", cls:"btn-danger", diff:"hard",   lv:[10,16],   money:[60,130],  xp:[90,200],  mult:1.6 },
  { id:"extreme",  label:"Extreme",  emoji:"👹", cls:"btn-danger", diff:"hard",   lv:[15,25],   money:[100,200], xp:[130,300], mult:1.6 }
];
const TIER_BY_ID = Object.fromEntries(PVE_TIERS.map(t=>[t.id,t]));
const ri = (a,b)=> a + Math.floor(Math.random()*(b-a+1));
function buildTierMonster(tier, pl){
  const pool = ENEMY_BANK.filter(e=>e.region===state.profile.region && e.difficulty===tier.diff), slot = pool[Math.floor(Math.random()*pool.length)];
  const lvl = Math.max(1, pl + ri(tier.lv[0], tier.lv[1]));
  return { id:slot.id, name:slot.name, region:slot.region, difficulty:tier.diff, level:lvl, element:REGIONS[slot.region].element,
    hp:Math.round((20+lvl*8)*tier.mult), attack:Math.round((3+lvl*1.5)*tier.mult), xpReward:ri(...tier.xp), moneyReward:ri(...tier.money), tierId:tier.id,
    dropChance: tier.diff==="easy"?0.25 : tier.diff==="medium"?0.45 : 0.7 };
}
const lvTxt = t=> { const f = n=> (n>0?"+":"")+n; return t.lv[0]===t.lv[1] ? f(t.lv[0]) : `${f(t.lv[0])} to ${f(t.lv[1])}`; };
const PVE_CD_MS = [10,30,60,120,180,300,600,1200].map(x=>x*1000);          // tier 1..8 cooldown after a fight: 10s 30s 1m 2m 3m 5m 10m 20m
const pveCdLeft = id=> Math.max(0, ((state.profile?.pveCd||{})[id]||0) - Date.now());
function setPveCd(id){
  const i = PVE_TIERS.findIndex(t=>t.id===id); if(i<0 || !state.profile) return;
  const until = Date.now() + PVE_CD_MS[i];
  state.profile.pveCd = { ...(state.profile.pveCd||{}), [id]: until };
  updateDoc(doc(db,"players",state.uid), { [`pveCd.${id}`]: until }).catch(()=>{});
}
function updatePveGrid(){
  document.querySelectorAll("[data-pvet]").forEach(b=>{ const left = pveCdLeft(b.dataset.pvet), sp = b.querySelector(".pve-cd");
    b.disabled = left>0; if(sp) sp.textContent = left>0 ? `⏳ ready in ${fmtDur(left)}` : ""; });
}
function renderPveGrid(){
  document.getElementById("pveGrid").innerHTML = PVE_TIERS.map(t=>
    `<button class="doodle-btn btn-lg ${t.cls}" data-pvet="${t.id}"><b>${t.emoji} ${t.label}</b><small>${lvTxt(t)} lvl · $${t.money[0]}–${t.money[1]} · ${t.xp[0]}–${t.xp[1]} XP</small><small class="pve-cd"></small></button>`).join("");
  document.querySelectorAll("[data-pvet]").forEach(b=> b.addEventListener("click", ()=>{
    const t = TIER_BY_ID[b.dataset.pvet]; if(pveCdLeft(t.id)>0) return; startPve(null, null, buildTierMonster(t, state.profile.level));
  }));
  updatePveGrid();
}
function setBattleSub(sub){
  document.querySelectorAll("[data-btsub]").forEach(b=> b.classList.toggle("active", b.dataset.btsub===sub));
  document.querySelectorAll(".bt-page").forEach(pg=> pg.classList.toggle("active", pg.id==="bt-"+sub));
  if(sub==="pve") renderPveGrid();
  if(sub==="pvp") renderDuelPanel();
  if(sub==="boss") renderBossPanel();
}
document.querySelectorAll("[data-btsub]").forEach(b=> b.addEventListener("click", ()=> setBattleSub(b.dataset.btsub)));
document.querySelector('[data-ctab="duel"]').addEventListener("click", ()=> setBattleSub(document.querySelector("[data-btsub].active")?.dataset.btsub || "pve"));

/* ---- PVP: challenge a friend (15-second invite delivered through their inbox) ---- */
const DUEL_INVITE_MS = 15000;
async function sendDuelChallenge(uid, name){
  if(state.battle){ toast("Finish your current fight first."); return; }
  const snap = await getDoc(doc(db,"players",uid)).catch(()=>null);
  if(!snap || !snap.exists()){ toast("Couldn't find that player."); return; }
  if(snap.data().noDuelRequests){ toast(`🚫 ${name} has duel requests turned off.`); return; }
  const code = randCode(), p = state.profile;
  const ok = await withErrorToast(async ()=>{
    await setDoc(doc(db,"duelRooms",code), { hostUid:state.uid, hostName:p.username, ...duelSide("host", p), ...NO_GUEST, turn:state.uid, status:"waiting", winner:null, createdAt:Date.now(), log:[] });
    await addDoc(collection(db,"players",uid,"inbox"), { type:"duel_challenge", fromUid:state.uid, fromUsername:p.username, code, ts:Date.now() });
  });
  if(ok===null) return;
  toast(`⚔️ Challenge sent to ${name} — they have 15 seconds.`);
  document.getElementById("roomStatus") && (document.getElementById("roomStatus").textContent = `Waiting for ${name}…`);
  watchDuelRoom(code);
  setTimeout(async ()=>{                                  // nobody took it: tear the room down
    const s = await getDoc(doc(db,"duelRooms",code)).catch(()=>null);
    if(s && s.exists() && s.data().status==="waiting"){ roomUnsub?.(); roomUnsub = null; await deleteDoc(doc(db,"duelRooms",code)).catch(()=>{}); toast(`${name} didn't answer your duel challenge.`); }
  }, DUEL_INVITE_MS + 1500);
}
async function renderChallengeList(){
  const box = document.getElementById("challengeList"); box.style.display = ""; box.innerHTML = "Loading friends…";
  const uids = state.profile.friends || [];
  if(!uids.length){ box.innerHTML = `<p class="doodle-sub">You have no friends to challenge yet — add some from the Friends tab!</p>`; return; }
  const snaps = await Promise.all(uids.map(u=> getDoc(doc(db,"players",u)).catch(()=>null)));
  box.innerHTML = `<p class="doodle-sub" style="margin-top:0">Pick a friend to challenge:</p>` + snaps.filter(s=>s&&s.exists()).map(s=>{ const d = s.data();
    return `<button class="doodle-btn btn-sm btn-blue" data-chal="${s.id}" data-n="${escapeHTML(d.username)}">${onlineDot(d)} ${escapeHTML(d.username)} (Lv.${d.level||1})</button>`; }).join(" ");
  box.querySelectorAll("[data-chal]").forEach(b=> b.addEventListener("click", ()=>{ box.style.display = "none"; sendDuelChallenge(b.dataset.chal, b.dataset.n); }));
}
document.getElementById("btnChallengePlayer").addEventListener("click", renderChallengeList);
document.getElementById("allowDuelReq").addEventListener("change", e=> withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { noDuelRequests: !e.target.checked })));
document.getElementById("btnMyProfile").addEventListener("click", ()=>{ if(state.profile) openProfileByUid(state.uid); });
document.getElementById("btnSettings").addEventListener("click", ()=>{ document.getElementById("allowDuelReq").checked = !state.profile?.noDuelRequests; });
function handleDuelInvite(n, ref, first){
  const age = Date.now() - (n.ts||0);
  if(first || age > DUEL_INVITE_MS+5000 || state.profile?.noDuelRequests || state.battle){ deleteDoc(ref).catch(()=>{}); return; }
  toast(`⚔️ ${n.fromUsername} challenges you to a duel, accept? [click here]`, Math.max(2000, DUEL_INVITE_MS-age), "toast-duel", ()=>{ joinDuelRoom(n.code); });
  setTimeout(()=> deleteDoc(ref).catch(()=>{}), Math.max(1000, DUEL_INVITE_MS-age));
}

/* ---- BOSS FIGHTS: a new boss every 12h. Beat a wave of 5 (Easy → Deadly), then the boss. ---- */
const BOSS_MS = 12*3600*1000, BOSS_WAVES = ["easy","skilled","moderate","hard","deadly"];
const BOSS_ROSTER = [ ["Ignarok the Cinder Tyrant","🐲","fire"], ["Thalassa the Drowned Queen","🐙","water"], ["Gorgoth Stonemaw","🗿","earth"], ["Zephyrion Stormwing","🦅","air"],
  ["Nyxaris the Hollow King","👁️","earth"], ["Magmaw the Molten","🌋","fire"], ["Leviathan Prime","🐋","water"], ["Aerion the Skybreaker","🌪️","air"] ];
const bossCycle = ()=> Math.floor(Date.now()/BOSS_MS);
const bossIn = ()=> (bossCycle()+1)*BOSS_MS - Date.now();
const bossDef = c=> { const [name,sprite,element] = BOSS_ROSTER[((c*5+3)%BOSS_ROSTER.length+BOSS_ROSTER.length)%BOSS_ROSTER.length]; return { name, sprite, element }; };
let bossRun = null;
function makeBoss(run){
  const pl = state.profile.level, lvl = run.lvl, d = bossDef(run.cycle);
  return { id:"boss_"+run.cycle, boss:true, name:d.name, sprite:d.sprite, region:state.profile.region, difficulty:"hard", level:lvl, element:d.element,
    hp:Math.round((20+lvl*8)*6), attack:Math.round((3+(pl+5)*1.5)*1.6), xpReward:Math.round(150+pl*10), moneyReward:Math.round(300+pl*30), dropChance:0 };
}
/* ---- boss chests: 3 chests, each worth roughly $700-$1,700 when sold (so ~$2K-$5K for the kill) ---- */
const pickFrom = l=> l[Math.floor(Math.random()*l.length)];
const rareOrBetter = i=> ["rare","epic","legendary"].includes(i.rarity);
function rollChest(){
  const V = 700 + Math.random()*1000, sp = i=> i.sellPrice||0;
  const all = Object.values(ITEM_BY_ID), kinds = [["money",20],["gear",26],["ingot",20],["gem",20],["tool",14]];
  let r = Math.random()*100, kind = "money"; for(const [k,w] of kinds){ r -= w; if(r<=0){ kind = k; break; } }
  const stack = list=>{ const c = list.filter(i=> sp(i)>0 && sp(i)<=V && sp(i)>=V/12); if(!c.length) return null; const it = pickFrom(c);
    return { itemId:it.id, qty:Math.max(1, Math.min(12, Math.round(V*(0.75+Math.random()*0.25)/sp(it)))) }; };
  const single = list=>{ const w = it=> it.rarity==="legendary" ? 1 : it.rarity==="epic" ? 3 : 6; const bag = list.flatMap(i=> Array(w(i)).fill(i)); return bag.length ? { itemId:pickFrom(bag).id, qty:1 } : null; };
  let pick = null;
  if(kind==="gear")  pick = single(CATALOG.gearAll.map(id=>ITEM_BY_ID[id]).filter(rareOrBetter));
  if(kind==="tool")  pick = single(all.filter(i=> i.type==="tool" && /^tool_(pickaxe|fishingrod)/.test(i.id) && rareOrBetter(i)));
  if(kind==="ingot") pick = stack(all.filter(i=> i.id.startsWith("ing_") && i.rarity!=="common"));
  if(kind==="gem")   pick = stack(all.filter(i=> /^gem_.*_cut$/.test(i.id) || (i.id.startsWith("gem_") && rareOrBetter(i))));
  const items = pick ? [pick] : [], val = pick ? sp(ITEM_BY_ID[pick.itemId])*pick.qty : 0;
  return { items, money: Math.max(0, Math.round((V-val)/10)*10) };
}
async function openBossChests(){
  const chests = [rollChest(), rollChest(), rollChest()];
  for(const c of chests){ if(c.money) await grantMoney(c.money); for(const it of c.items) await addItemToInv(it.itemId, it.qty); }
  document.getElementById("chestBody").innerHTML = chests.map((c,i)=> `<div class="chest-card"><b>🎁 Chest ${i+1}</b><ul>` +
    c.items.map(it=> `<li>${it.qty}× ${escapeHTML(ITEM_BY_ID[it.itemId].name)} <i>(${ITEM_BY_ID[it.itemId].rarity})</i></li>`).join("") + (c.money ? `<li>💰 $${fmtMoney(c.money)}</li>` : "") + `</ul></div>`).join("");
  openModal("chestModal"); playSfx("levelup");
}
function renderBossPanel(){
  const box = document.getElementById("bossPanel"); if(!box || !state.profile) return;
  const cyc = bossCycle(), d = bossDef(cyc), cleared = state.profile.bossCleared === cyc, run = bossRun && bossRun.cycle===cyc ? bossRun : null;
  let body;
  if(cleared) body = `<p><b>✅ You defeated this boss!</b> A new one arrives in ${fmtDur(bossIn())}.</p>`;
  else if(run && run.stage<5){ const t = TIER_BY_ID[BOSS_WAVES[run.stage]];
    body = `<p>Wave ${run.stage+1}/5 — next up: <b>${t.emoji} ${t.label}</b>. </p><button class="doodle-btn btn-lg btn-green" id="btnBossGo">Fight wave ${run.stage+1}</button> <button class="doodle-btn btn-sm" id="btnBossQuit">Give up</button>`; }
  else if(run) body = `<p>The wave is cleared — <b>${escapeHTML(d.name)}</b> descends!</p><button class="doodle-btn btn-lg btn-danger" id="btnBossGo">Fight the boss!</button> <button class="doodle-btn btn-sm" id="btnBossQuit">Give up</button>`;
  else body = `<p>Fight a wave of 5 enemies (Easy → Skilled → Moderate → Hard → Deadly) back to back, then face the boss — each next enemy steps up the moment the last one falls. Your HP carries over, dying ends the run for free, and fleeing cancels it so you restart from the first enemy. Beating the boss earns 3 chests.</p><button class="doodle-btn btn-lg btn-danger" id="btnBossGo">Begin the gauntlet</button>`;
  box.innerHTML = `<div class="boss-head"><span class="boss-sprite">${d.sprite}</span><div><h3 class="doodle-h3" style="margin:0">${escapeHTML(d.name)}</h3><small>${ELEMENTS[d.element]?.name||d.element} · ~30–50 levels above you · enormous HP · slams, regenerates, guards, and sometimes gets stunned</small></div></div>
    <p class="doodle-sub">Next boss in <b>${fmtDur(bossIn())}</b></p>${body}`;
  document.getElementById("btnBossGo")?.addEventListener("click", ()=>{ if(!bossRun || bossRun.cycle!==cyc) bossRun = { cycle:cyc, stage:0, lvl: state.profile.level + ri(30,50) }; bossNextStage(); });
  document.getElementById("btnBossQuit")?.addEventListener("click", ()=>{ bossRun = null; renderBossPanel(); });
}
function bossNextStage(){
  const run = bossRun; if(!run || state.battle) return;
  const onLose = async ()=>{ bossRun = null; await updateDoc(doc(db,"players",state.uid), { hp:Math.max(1,Math.round(state.profile.hpMax*0.25)) }).catch(()=>{}); toast("💀 You fell in the gauntlet… you wake up at 25% HP."); openModal("compassModal"); renderBossPanel(); };
  const onFlee = ()=>{ bossRun = null; renderBossPanel(); };
  if(run.stage < 5){
    const m = buildTierMonster(TIER_BY_ID[BOSS_WAVES[run.stage]], state.profile.level); m.attack = Math.round(enemyHitBase(m, null)); m.dropChance = 0; delete m.tierId;
    startPve(null, { m, gauntlet:true, onLose, onFlee, onWin: ()=>{ run.stage++; bossNextStage(); } });         // the next enemy steps up right away
  } else {
    startPve(null, { m:makeBoss(run), gauntlet:true, onLose, onFlee, onWin: async ()=>{
      bossRun = null; await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { bossCleared: run.cycle }));
      await openBossChests(); renderBossPanel();
    } });
  }
}
setInterval(()=>{ if(document.getElementById("bt-pve")?.classList.contains("active")) updatePveGrid(); }, 1000);
setInterval(()=>{ if(document.getElementById("bt-boss")?.classList.contains("active") && document.getElementById("compassModal").classList.contains("active")) renderBossPanel(); }, 1000);

/* =========================================================================
   EAT OVERLAY — shared by PvE and PvP battles. Pick any food/consumable
   straight from your inventory, read its description, and press Eat (or
   spam it). HP and Mana bars update live as you eat.
   ========================================================================= */
let eatSel = null, eatBusy = false;
function eatContext(){
  const b = state.battle, p = state.profile; if(!b || !p) return null;
  const eatsLeft = Math.max(0, MAX_EATS_PER_TURN - (b.eats||0));
  if(b.mode==="pve") return { hp:b.php, hpMax:p.hpMax, mana:b.mana, manaMax:p.manaMax, canEat:!b.over && eatsLeft>0, eatsLeft, why: eatsLeft>0 ? "" : `You can only eat ${MAX_EATS_PER_TURN} items per turn.` };
  if(b.mode==="duel" && b.d){
    const d = b.d, me = b.iAmHost?"host":"guest";
    return { hp:d[me+"Hp"], hpMax:d[me+"HpMax"], mana:d[me+"Mana"] ?? p.mana, manaMax:d[me+"ManaMax"] ?? p.manaMax,
      canEat: d.turn===state.uid && d.status!=="finished" && eatsLeft>0, eatsLeft,
      why: d.turn!==state.uid ? "You can only eat on your turn." : `You can only eat ${MAX_EATS_PER_TURN} items per turn.` };
  }
  return null;
}
function eatableFoods(){
  return invExpanded().filter(e=> e.item.type==="consumable" && ((e.item.stats.heal||0)>0 || (e.item.stats.mana||0)>0));
}
function openEatModal(){
  if(!eatContext()){ return; }
  openModal("eatModal"); renderEatModal();
}
function renderEatModal(){
  const ctx = eatContext();
  if(!ctx){ closeModal("eatModal"); return; }
  const setEat = (k, v, max)=>{
    document.getElementById("eatBar"+k).style.width = Math.max(0,Math.min(100,(v/max)*100))+"%";
    document.getElementById("eatNum"+k).textContent = `${Math.max(0,Math.round(v))}/${max}`;
  };
  setEat("HP", ctx.hp, ctx.hpMax); setEat("MANA", ctx.mana, ctx.manaMax);
  const foods = eatableFoods();
  if(eatSel && !foods.some(e=>e.item.id===eatSel)) eatSel = null;
  const grid = document.getElementById("eatGrid"); grid.innerHTML = "";
  if(!foods.length) grid.innerHTML = `<p class="doodle-sub" style="grid-column:1/-1">You have no food.</p>`;
  foods.forEach(e=>{
    const cell = document.createElement("div");
    cell.className = `inv-cell rarity-${e.item.rarity}` + (eatSel===e.item.id?" selected":"");
    cell.innerHTML = `<div>${escapeHTML(e.item.name)}</div><span class="qty-badge">x${e.qty}</span>`;
    cell.addEventListener("click", ()=>{ eatSel = e.item.id; renderEatModal(); });
    grid.appendChild(cell);
  });
  const sel = eatSel && ITEM_BY_ID[eatSel], det = document.getElementById("eatDetail"), btn = document.getElementById("btnEatNow");
  det.innerHTML = sel
    ? `<b>${escapeHTML(sel.name)}</b> <i>(${sel.rarity})</i><br>${escapeHTML(sel.desc||"")}<br><b>${escapeHTML(itemEffectText(sel))}</b>` + (!ctx.canEat && ctx.why ? `<br><small>${ctx.why}</small>` : "")
    : "Select a food to read about it.";
  btn.disabled = !sel || !ctx.canEat;
  btn.textContent = `Eat (${ctx.eatsLeft}/${MAX_EATS_PER_TURN} left this turn)`;
}
document.getElementById("btnEatNow").addEventListener("click", eatSelected);
async function eatSelected(){
  if(eatBusy || !eatSel) return;             // spam-safe: clicks during an in-flight eat are ignored
  const ctx = eatContext(), item = ITEM_BY_ID[eatSel];
  if(!ctx || !item) return;
  if(!ctx.canEat){ toast(ctx.why || "You can't eat right now."); return; }
  if(!eatableFoods().some(e=>e.item.id===item.id)){ eatSel = null; renderEatModal(); return; }
  eatBusy = true;
  try{
    const b = state.battle;
    const heal = item.stats.heal ? Math.min(rollHeal(item), ctx.hpMax-ctx.hp) : 0;
    const manaGain = item.stats.mana ? Math.min(item.stats.mana, ctx.manaMax-ctx.mana) : 0;
    if(heal<=0 && manaGain<=0){ toast("You're already full — save it for later."); return; }
    const gains = [heal>0?`+${heal} HP`:"", manaGain>0?`+${manaGain} mana`:""].filter(Boolean).join(", ");
    const removed = await changeInvQty(item.id, -1);   // inventory first: no free heals if the item isn't really there
    if(removed===null) return;
    b.eats = (b.eats||0) + 1;                          // counts toward this turn's limit of 3
    if(b.mode==="pve"){
      b.php += heal; b.mana += manaGain;
      battleLogPush(`You eat ${item.name}: ${gains}. (free action)`);
      renderPve();
    } else {
      const me = b.iAmHost?"host":"guest", d = b.d;
      await withErrorToast(()=> updateDoc(doc(db,"duelRooms",b.code), {
        [me+"Hp"]: ctx.hp+heal, [me+"Mana"]: ctx.mana+manaGain,
        log: [...(d.log||[]), `${state.profile.username} eats ${item.name} (${gains}).`].slice(-60)
      }));
      if(b.d) renderDuelBattle(b.d);
    }
  } finally { eatBusy = false; renderEatModal(); }
}

/* --- duel (challenge a friend) --- */
function renderDuelPanel(){
  const panel = document.getElementById("duelPanel");
  panel.innerHTML = `
    <button class="doodle-btn btn-sm btn-blue" id="btnStartRoom">Start a Duel Room</button>
    <div style="margin-top:8px;">
      <input type="text" id="joinCodeInput" maxlength="5" placeholder="5-digit code" style="font-family:'Patrick Hand'; padding:6px; border:2px solid #4A3F35; border-radius:8px;">
      <button class="doodle-btn btn-sm btn-green" id="btnJoinRoom">Join</button>
    </div>
    <div style="margin-top:8px;">
      <button class="doodle-btn btn-sm btn-yellow" id="btnJoinQueue">Join Random Queue</button>
      <button class="doodle-btn btn-sm" id="btnCancelQueue">Leave Queue</button>
      <span id="queueTimerLabel"></span>
    </div>
    <div id="roomStatus" style="margin-top:8px;"></div>`;
  document.getElementById("btnStartRoom").addEventListener("click", startDuelRoom);
  document.getElementById("btnJoinRoom").addEventListener("click", ()=>{
    const code = document.getElementById("joinCodeInput").value.trim();
    joinDuelRoom(code);
  });
  document.getElementById("btnJoinQueue").addEventListener("click", joinQueue);
  document.getElementById("btnCancelQueue").addEventListener("click", cancelQueue);
}
function randCode(){ return String(Math.floor(10000+Math.random()*90000)); }
let roomUnsub=null, queueInterval=null;
/* One side's live numbers, copied straight from that player's CURRENT
   profile so you enter the duel exactly as you are (10 HP stays 10 HP). */
function duelSide(role, s){
  return { [role+"Hp"]:s.hp, [role+"HpMax"]:s.hpMax, [role+"Mana"]:s.mana, [role+"ManaMax"]:s.manaMax,
           [role+"Rage"]:s.rage, [role+"RageMax"]:s.rageMax,
           [role+"Speed"]:s.stats?.SPEED||0, [role+"Charm"]:s.stats?.CHARM||0 };     // read by the OTHER client to apply mana regen / damage reduction
}
const NO_GUEST = { guestUid:null, guestName:null, guestHp:null, guestHpMax:null, guestMana:null, guestManaMax:null, guestRage:null, guestRageMax:null, guestSpeed:null, guestCharm:null, guestCd:null };
async function startDuelRoom(){
  const code = randCode();
  const p = state.profile;
  const ok = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
    hostUid: state.uid, hostName: state.profile.username,
    ...duelSide("host", p), ...NO_GUEST,
    // Host always goes first. Turn-based: only "turn" may act.
    turn: state.uid,
    status:"waiting", winner:null, createdAt: Date.now(), log:[]
  }));
  if(ok===null) return;
  document.getElementById("roomStatus").textContent = `Room code: ${code} — waiting for opponent…`;
  watchDuelRoom(code);
}
async function joinDuelRoom(code){
  if(!/^\d{5}$/.test(code)){ toast("Enter a valid 5-digit code."); return; }
  const rref = doc(db,"duelRooms",code);
  try{
    const snap = await getDoc(rref);
    if(!snap.exists() || snap.data().status!=="waiting"){ toast("Room not found or full."); return; }
    // Joining immediately flips the room to "active" — there is no separate
    // "host clicks start" step, both sides connect live at the same moment.
    await updateDoc(rref, {
      guestUid: state.uid, guestName: state.profile.username,
      ...duelSide("guest", state.profile),
      status:"active", turn: Math.random()<0.5 ? state.uid : snap.data().hostUid
    });
    document.getElementById("roomStatus").textContent = "Duel starting…";
    watchDuelRoom(code);
  }catch(err){ toast(friendlyFirebaseError(err)); }
}
// Both sides re-copy their own live stats the moment the duel opens (only
// before anyone has acted), so time spent waiting in a room/queue — eating,
// regen, etc. — never leaves stale numbers in the fight.
async function syncMyDuelStats(code, role){
  const rref = doc(db,"duelRooms",code);
  await runTransaction(db, async tx=>{
    const s = await tx.get(rref); if(!s.exists()) return;
    if((s.data().log||[]).length) return;      // fight already started
    tx.update(rref, duelSide(role, state.profile));
  }).catch(()=>{});
}
function watchDuelRoom(code){
  if(roomUnsub) roomUnsub();
  state.duel = { code };
  roomUnsub = onSnapshot(doc(db,"duelRooms",code), snap=>{
    if(!snap.exists()){ const el=document.getElementById("roomStatus"); if(el) el.textContent="Room closed."; return; }
    const d = snap.data();
    if(d.status==="waiting"){
      const el=document.getElementById("roomStatus"); if(el) el.textContent = `Room code: ${code} — waiting for opponent…`;
      return;
    }
    // Whoever is the host flips to "active" the instant a guest doc appears,
    // so both clients enter the live duel together with no manual start.
    // Checked against our battle state (not just the modal's CSS class) so
    // a stale modal-closing animation can't stop the host from joining.
    if(d.status==="active" && d.guestUid && !(state.battle && state.battle.mode==="duel" && state.battle.code===code)){
      openDuelBattle(code, d);
    }
    if(state.battle?.mode==="duel" && state.battle.code===code){
      renderDuelBattle(d);
      pvpReactionsFromRoom(d);
    }
    if(d.status==="finished" && state.battle?.mode==="duel" && state.battle.code===code && !state.battle.resolved){
      state.battle.resolved = true;
      const won = d.winner===state.uid;
      const me = state.battle.iAmHost ? "host" : "guest", pp = state.profile;
      // Whatever HP/mana/rage you finish the duel with is carried back to your character.
      const fin = { hp: Math.max(1, d[me+"Hp"] ?? pp.hp), mana: d[me+"Mana"] ?? pp.mana, rage: d[me+"Rage"] ?? pp.rage };
      if(won){
        battleLogPush("You won the duel!");
        toast("Duel won!");
        withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
          kills:(pp.kills||0)+1, killstreak:(pp.killstreak||0)+1, ...fin
        }));
      } else {
        battleLogPush("You were defeated in the duel.");
        // The LOSER'S own client computes and applies the loss (never
        // writes another player's doc), then forwards the exact amount/
        // item to the WINNER's inbox — same pattern as auction payouts —
        // so the winner's subscribeInbox() can credit it to their own doc.
        const fled = d.fledBy===state.uid;
        (fled ? withErrorToast(()=> updateDoc(doc(db,"players",state.uid), fin)).then(()=>null) : applyDeathPenalty({ mana: fin.mana })).then((res)=>{
          if(!res){ toast("You fled the duel — nothing lost."); return; }
          const {moneyLoss,lostItemName} = res;
          const lossMsg = lostItemName ? `Lost $${fmtMoney(moneyLoss)} and your ${lostItemName}.` : `Lost $${fmtMoney(moneyLoss)}.`;
          toast(`Duel lost. ${lossMsg}`);
          withErrorToast(()=> addDoc(collection(db,"players",d.winner,"inbox"), {
            type:"duel_won", amount: moneyLoss, itemName: lostItemName,
            fromUsername: state.profile.username, ts: Date.now(), credited:false
          }));
        });
      }
      setTimeout(()=>{ closeModal("eatModal"); closeModal("battleModal"); setPvpRxVisible(false); state.battle=null; if(roomUnsub){roomUnsub(); roomUnsub=null;} }, 1400);
    }
  }, (err)=> toast(friendlyFirebaseError(err)));
}
function openDuelBattle(code, d){
  const iAmHost = d.hostUid===state.uid;
  state.battle = { mode:"duel", code, iAmHost, resolved:false, d, log:[`${d.hostName} vs ${d.guestName} — fight!`],
    seenRx:{ host:d.hostRx?.ts||0, guest:d.guestRx?.ts||0 } };
  document.querySelectorAll(".modal-backdrop.active").forEach(m=>m.classList.remove("active"));
  openModal("battleModal"); setPvpRxVisible(true);
  syncMyDuelStats(code, iAmHost?"host":"guest");
  renderDuelBattle(d);
}
/* Mana/Rage income, granted to a player the moment the turn comes back to them
   (so it's applied when their opponent finishes acting):
     Mana:  +1 every turn, +2 more if their last move was Guard, +5 more if it was Skip
     Rage:  +1 for an attack, +2 for a Power Strike or Guard */
function turnMana(last){ return 1 + (last==="guard" ? 2 : last==="skip" ? 5 : 0); }
function turnRage(last){ return last==="guard" || last==="power" ? 2 : (last && (ATTACK_SKILLS.some(s=>s.id===last) || String(last).startsWith("tree_"))) ? 1 : 0; }
function renderDuelBattle(d){
  const b = state.battle;
  b.d = d;                                   // latest room data (used by the Eat overlay)
  const iAmHost = b.iAmHost;
  const myHp = iAmHost ? d.hostHp : d.guestHp, myMax = iAmHost ? d.hostHpMax : d.guestHpMax;
  const oppHp = iAmHost ? d.guestHp : d.hostHp, oppMax = iAmHost ? d.guestHpMax : d.hostHpMax;
  document.getElementById("battleEnemyName").textContent = iAmHost ? d.guestName : d.hostName;
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,oppHp)/oppMax)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,oppHp)}/${oppMax}`;
  document.getElementById("battlePlayerName").textContent = state.profile.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,myHp)/myMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,myHp)}/${myMax}`;
  const me = iAmHost ? "host" : "guest", pp = state.profile;
  const myFx = d[me+"Fx"]||{}, opFxNow = d[(iAmHost?"guest":"host")+"Fx"]||{};
  const manaNow = d[me+"Mana"] ?? pp.mana, manaMax = d[me+"ManaMax"] ?? pp.manaMax;
  const rageNow = d[me+"Rage"] ?? pp.rage, rageMax = d[me+"RageMax"] ?? pp.rageMax;
  document.getElementById("battleStaminaLabel").textContent = `Mana ${manaNow}/${manaMax} · One move per turn` + (myFx.focus?" · 🎯 Focused":"") + (myFx.guard?" · 🛡️ Guarding":"") + (opFxNow.guard?" · Foe guarding":"");
  document.getElementById("battleRageLabel").textContent = `${rageNow}/${rageMax}`;
  // The log is stored on the room doc itself (not local state) so both
  // players see the same "who did what" history, attributed by name.
  const logEl = document.getElementById("battleLog");
  logEl.innerHTML = (d.log||[]).slice(-30).map(m=>`<div>${escapeHTML(m)}</div>`).join("");
  logEl.scrollTop = logEl.scrollHeight;
  if(document.getElementById("eatModal").classList.contains("active")) renderEatModal();
  const actions = document.getElementById("battleActions");
  actions.innerHTML="";
  if(d.status==="finished") return;
  const isMyTurn = d.turn === state.uid;
  if(!isMyTurn) b.eats = 0;                  // my turn is over: eating resets for my next one
  const addBtn = (id, label, tip, extraDis, cls, fn)=>{
    const el = document.createElement("button");
    el.className = `doodle-btn btn-sm ${cls}`; el.textContent = label; el.title = tip;
    el.disabled = !isMyTurn || myHp<=0 || oppHp<=0 || !!extraDis;   // greyed when it isn't your turn (or Guard on cooldown)
    el.addEventListener("click", fn || (()=> duelAct(d, id))); actions.appendChild(el);
  };
  const myCdNow = d[me+"Cd"]||{};
  knownAttacks(pp).forEach(s=>{
    const cd = myCdNow[s.id]||0;
    addBtn(s.id, cd>0 ? `${s.name} (${cd})` : s.name, s.desc + (s.id==="power" ? " Gives +2 Rage when your turn returns." : " Gives +1 Rage when your turn returns."), cd>0, "btn-pink");
  });
  addBtn("guard", d[me+"Last"]==="guard" ? "Guard (cooldown)" : "Guard", "Block 60-90% of their next hit. When your turn returns: +2 Rage and +2 Mana. Can only be used every other turn.", d[me+"Last"]==="guard", "btn-blue");
  addBtn("focus", "Focus", "Your next attack deals double damage.", false, "btn-blue");
  addBtn("skip", "Skip Turn", "Pass your turn. When your turn returns: +5 Mana.", false, "btn-blue");
  // Eat is a free action and opens the food picker instead of forcing one food.
  const eatEl = document.createElement("button");
  eatEl.className = "doodle-btn btn-sm btn-green"; eatEl.textContent = "🍖 Eat"; eatEl.title = "Pick food from your inventory. Free action — does not end your turn.";
  const duelEatsLeft = Math.max(0, MAX_EATS_PER_TURN - (b.eats||0));
  if(isMyTurn && duelEatsLeft<=0) eatEl.textContent = "🍖 Eat (max 3)";
  eatEl.disabled = !isMyTurn || myHp<=0 || oppHp<=0 || duelEatsLeft<=0;
  eatEl.addEventListener("click", openEatModal); actions.appendChild(eatEl);
  if(!isMyTurn){ const w = document.createElement("span"); w.textContent = "Waiting for opponent…"; actions.appendChild(w); }
  const fleeBtn = document.createElement("button");
  fleeBtn.className = "doodle-btn btn-sm btn-yellow"; fleeBtn.textContent = "Flee";
  fleeBtn.addEventListener("click", ()=> duelFlee(d));
  actions.appendChild(fleeBtn);
}
async function duelAct(d, move){
  const b = state.battle; if(!b || b.mode!=="duel" || b.busy) return;
  if(d.turn !== state.uid){ toast("It's not your turn."); return; }
  b.busy = true;   // lock immediately so a fast double-click can't fire a second action off stale room data
  try{ await duelActInner(b.d || d, move); } finally { b.busy = false; }
}
async function duelActInner(d, move){
  const b = state.battle;
  const p = state.profile, me = b.iAmHost?"host":"guest", op = b.iAmHost?"guest":"host";
  if(move==="guard" && d[me+"Last"]==="guard"){ toast("Guard is on cooldown."); return; }
  const myCd = { ...(d[me+"Cd"]||{}) };
  if((myCd[move]||0)>0){ toast(`That spell is on cooldown (${myCd[move]} more moves).`); return; }
  const myName = p.username, opName = d[op+"Name"], opUid = d[op+"Uid"];
  let myHp = d[me+"Hp"], opHp = d[op+"Hp"], mana = d[me+"Mana"] ?? p.mana, rage = d[me+"Rage"] ?? p.rage;
  const rageMax = d[me+"RageMax"] ?? p.rageMax;
  const myFx = { ...(d[me+"Fx"]||{}) }, opFx = { ...(d[op+"Fx"]||{}) }, lines = [], rnd = ()=>0.9+Math.random()*0.2;
  if(move==="guard"){ myFx.guard = true; lines.push(`${myName} raises their guard.`); }
  else if(move==="focus"){ myFx.focus = true; lines.push(`${myName} focuses their strength.`); }
  else if(move==="skip"){ lines.push(`${myName} skips their turn.`); }
  else {
    const s = attackSkillById(move);
    if((s.needsFullRage && rage<rageMax) || (s.manaCost && mana<s.manaCost)){ toast("Not enough Rage/Mana."); return; }
    if(s.hpCost && myHp <= s.hpCost){ toast(`Not enough HP — ${s.name} costs ${s.hpCost} HP.`); return; }
    if(s.needsFullRage) rage = 0;
    if(s.manaCost) mana -= s.manaCost;
    if(s.hpCost){ myHp -= s.hpCost; lines.push(`${myName} pays ${s.hpCost} HP.`); }
    let dmg = (playerAttackPower()*s.dmgMult() + (s.flatDmg||0))*rnd()*(myFx.focus?2:1); myFx.focus = false;
    if(opFx.guard) dmg *= guardTakenMult();
    dmg = Math.max(1, Math.max(1, Math.round(dmg)) - (d[op+"Charm"]||0));    // their CHARM trims 1 damage per point (min 1)
    opHp -= dmg;
    lines.push(`${myName} uses ${s.name}: ${dmg} damage${opFx.guard?" (guarded)":""}.`);
    if(s.healHp){ const h = Math.min(spellRoll(s.healHp), (d[me+"HpMax"]||myHp)-myHp); if(h>0){ myHp += h; lines.push(`${myName} heals ${h} HP.`); } }
    if(s.healMana){ const g = Math.min(spellRoll(s.healMana), (d[me+"ManaMax"]||mana)-mana); if(g>0){ mana += g; lines.push(`${myName} restores ${g} mana.`); } }
  }
  Object.keys(myCd).forEach(k=>{ if(myCd[k]>0) myCd[k]--; });                // every move ticks spell cooldowns down
  { const used = [...ATTACK_SKILLS, ...treeAttacks(p)].find(x=>x.id===move); if(used && used.cooldown) myCd[move] = used.cooldown; }
  opFx.guard = false;   // their stance lasts one action of mine
  const patch = { [me+"Hp"]:Math.max(0,myHp), [op+"Hp"]:Math.max(0,opHp), [me+"Mana"]:mana, [me+"Rage"]:rage,
    [me+"Fx"]:myFx, [op+"Fx"]:opFx, [me+"Last"]:move, [me+"Cd"]:myCd, turn:opUid };
  if(opHp<=0 && myHp>0){ patch.status="finished"; patch.winner=state.uid; }
  else if(myHp<=0){ patch.status="finished"; patch.winner=opUid; }
  else {
    // The turn is going back to the opponent: pay out THEIR income for what they did last turn.
    const opLast = d[op+"Last"];
    const opMana = d[op+"Mana"] ?? 0, opManaMax = d[op+"ManaMax"] ?? opMana, opRage = d[op+"Rage"] ?? 0, opRageMax = d[op+"RageMax"] ?? opRage;
    const newMana = Math.min(opManaMax, opMana + turnMana(opLast) + (d[op+"Speed"]||0)), newRage = Math.min(opRageMax, opRage + turnRage(opLast));
    patch[op+"Mana"] = newMana; patch[op+"Rage"] = newRage;
    const gm = newMana-opMana, gr = newRage-opRage;
    if(gm>0 || gr>0) lines.push(`${opName} recovers ${[gm>0?`${gm} mana`:"", gr>0?`${gr} rage`:""].filter(Boolean).join(" and ")}.`);
  }
  patch.log = [...(d.log||[]), ...lines].slice(-60);
  await withErrorToast(()=> updateDoc(doc(db,"duelRooms",b.code), patch));
}
async function duelFlee(d){
  const b = state.battle;
  if(!b || b.mode!=="duel") return;
  const rref = doc(db,"duelRooms",b.code);
  const winner = b.iAmHost ? d.guestUid : d.hostUid;
  await withErrorToast(()=> updateDoc(rref, {
    status:"finished", winner, fledBy: state.uid, log: arrayUnion(`${state.profile.username} fled the duel.`)
  }));
}

/* --- PvP reaction buttons: 😡 😂 🤯 🤔, 3s cooldown. Sent through the duel room
   doc (one small field per player), so no extra collection/rules are needed.
   They pop up over the sender's side of the screen. --- */
const PVP_RX = ["😡","😂","🤯","🤔"];
let lastPvpRx = 0;
function setPvpRxVisible(on){ document.getElementById("pvpRxRow").style.display = on ? "flex" : "none"; }
function setPvpRxCooldown(){
  const btns = document.querySelectorAll("[data-pvprx]");
  btns.forEach(x=>{ x.disabled = true; x.classList.add("cooling"); });
  setTimeout(()=> btns.forEach(x=>{ x.disabled = false; x.classList.remove("cooling"); }), 3000);
}
document.querySelectorAll("[data-pvprx]").forEach(btn=> btn.addEventListener("click", async ()=>{
  const b = state.battle, emoji = btn.dataset.pvprx;
  if(!b || b.mode!=="duel" || b.resolved || !PVP_RX.includes(emoji) || Date.now()-lastPvpRx < 3000) return;
  lastPvpRx = Date.now(); setPvpRxCooldown();
  await withErrorToast(()=> updateDoc(doc(db,"duelRooms",b.code), { [(b.iAmHost?"host":"guest")+"Rx"]: { emoji, ts: Date.now() } }));
}));
function pvpReactionsFromRoom(d){
  const b = state.battle, mine = b.iAmHost ? "host" : "guest";
  ["host","guest"].forEach(role=>{
    const rx = d[role+"Rx"];
    if(!rx || !PVP_RX.includes(rx.emoji) || !(rx.ts > (b.seenRx[role]||0))) return;
    b.seenRx[role] = rx.ts;
    spawnPvpReaction(role===mine, rx.emoji, role==="host" ? d.hostName : d.guestName);
  });
}
function spawnPvpReaction(isMine, emoji, name){
  const el = document.createElement("div"); el.className = "pvp-rx-bubble " + (isMine ? "mine" : "foe");
  const e = document.createElement("span"); e.className = "pvp-rx-emoji"; e.textContent = emoji;
  const u = document.createElement("span"); u.className = "pvp-rx-name"; u.textContent = name || "";
  el.append(e, u);
  // yours rise on the right (your side), theirs on the left (their side)
  el.style.left = (isMine ? 66 + Math.random()*20 : 10 + Math.random()*20) + "%";
  document.getElementById("pvpRxLayer").appendChild(el);
  setTimeout(()=> el.remove(), 2300);
}
let queueUnsub=null, queueGuestUnsub=null;
function setQueueUI(on){ document.getElementById("queueFloat").style.display = on?"flex":"none"; }
function leaveQueueListeners(){
  setQueueUI(false);
  clearInterval(queueInterval); queueInterval=null;
  if(queueUnsub){ queueUnsub(); queueUnsub=null; }
  if(queueGuestUnsub){ queueGuestUnsub(); queueGuestUnsub=null; }
}
async function cancelQueue(){
  leaveQueueListeners();
  await withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
  const label = document.getElementById("queueTimerLabel");
  if(label) label.textContent = "";
  toast("Left the queue.");
}
async function joinQueue(){
  leaveQueueListeners();
  toast("Searching for an opponent…");
  let seconds=0;
  queueInterval = setInterval(()=>{
    seconds++;
    const label = document.getElementById("queueTimerLabel");
    if(label) label.textContent = ` ${Math.floor(seconds/60)}m ${seconds%60}s`;
  },1000);
  const ok = await withErrorToast(()=> setDoc(doc(db,"queue",state.uid), {
    username: state.profile.username, ...duelSide("", state.profile), joinedAt: Date.now()
  }));
  if(ok===null) return;
  setQueueUI(true);

  // Real matchmaking: watch the whole queue for another waiting player.
  // Whoever has the lexicographically lower uid becomes host and creates
  // the room directly (so both clients can't race to create two rooms).
  queueUnsub = onSnapshot(collection(db,"queue"), async (snap)=>{
    if(!state.profile) return;
    const others = snap.docs.filter(d=> d.id!==state.uid).map(d=>({uid:d.id,...d.data()}));
    if(others.length===0) return;
    others.sort((a,b)=> (a.joinedAt||0)-(b.joinedAt||0));
    const opp = others[0];
    if(state.uid < opp.uid){
      leaveQueueListeners();
      const code = randCode();
      const created = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
        hostUid: state.uid, hostName: state.profile.username,
        ...duelSide("host", state.profile),
        guestUid: opp.uid, guestName: opp.username,
        ...duelSide("guest", { hp:opp.Hp ?? opp.hpMax ?? 100, hpMax:opp.HpMax ?? opp.hpMax ?? 100, mana:opp.Mana ?? 0, manaMax:opp.ManaMax ?? 0, rage:opp.Rage ?? 0, rageMax:opp.RageMax ?? 0, stats:{ SPEED:opp.Speed ?? 0, CHARM:opp.Charm ?? 0 } }),
        status:"active", turn: Math.random()<0.5 ? state.uid : opp.uid, winner:null, createdAt: Date.now(), log:[]
      }));
      if(created===null) return;
      await withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
      const el = document.getElementById("roomStatus"); if(el) el.textContent = "Opponent found!";
      watchDuelRoom(code);
    }
  }, (err)=> toast(friendlyFirebaseError(err)));

  // Watch for a room where someone else matched US as the guest.
  queueGuestUnsub = onSnapshot(
    query(collection(db,"duelRooms"), where("guestUid","==",state.uid), where("status","==","active")),
    (snap)=>{
      if(snap.empty) return;
      const fresh = snap.docs.find(dd=> (Date.now()-(dd.data().createdAt||0)) < 60000);
      if(!fresh) return;
      leaveQueueListeners();
      withErrorToast(()=> deleteDoc(doc(db,"queue",state.uid)));
      const el = document.getElementById("roomStatus"); if(el) el.textContent = "Opponent found!";
      watchDuelRoom(fresh.id);
    }, (err)=> toast(friendlyFirebaseError(err))
  );
}

/* --- playtime, players list, leaderboard cache, pay, recap --- */
function fmtPlaytime(sec){
  sec = Math.floor(sec||0);
  if(sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  if(sec < 86400) return `${Math.floor(sec/3600)}h ${Math.floor(sec%3600/60)}m`;
  return `${Math.floor(sec/86400)}d ${Math.floor(sec%86400/3600)}h`;
}
let playersCache = { t:0, rows:[] };
async function loadPlayers(){
  if(Date.now()-playersCache.t < 60000) return playersCache.rows;
  const snap = await getDocs(query(collection(db,"players"), limit(300)));
  playersCache = { t:Date.now(), rows: snap.docs.filter(d=>!d.data().banned && d.id!==state.uid).map(d=>({id:d.id, data:d.data()})) };
  return playersCache.rows;
}
async function renderPlayerList(){
  const list = document.getElementById("playerList"), q = document.getElementById("playerSearch").value.trim().toLowerCase();
  list.innerHTML = "<p class='doodle-sub'>Loading…</p>";
  try{
    const friends = new Set(state.profile.friends||[]);
    const rows = (await loadPlayers()).filter(r=> !q || (r.data.username||"").toLowerCase().includes(q))
      .sort((a,b)=> (friends.has(b.id)-friends.has(a.id)) || (b.data.level||0)-(a.data.level||0));
    list.innerHTML = rows.length ? "" : "<p class='doodle-sub'>No players found.</p>";
    rows.forEach(r=>{
      const d = r.data, el = document.createElement("div");
      el.className = "player-card"; el.style.background = ELEMENTS[d.archetype]?.color || "#FFFDF7";
      el.innerHTML = `<b>${escapeHTML(d.username)}${onlineDot(d)}</b><span>Lv.${d.level||1} ${ELEMENTS[d.archetype]?.name||""} ${CLASSES[d.klass]?.name||""}</span>${friends.has(r.id)?"<em>★ Friend</em>":""}`;
      el.addEventListener("click", ()=> openProfileBook(r.id, d, null, null));
      list.appendChild(el);
    });
  }catch(e){ list.innerHTML = "<p class='doodle-sub'>Couldn't load players.</p>"; }
}
document.getElementById("playerSearch").addEventListener("input", ()=>{ clearTimeout(renderPlayerList._t); renderPlayerList._t = setTimeout(renderPlayerList, 200); });
document.querySelector('[data-jtab="players"]').addEventListener("click", renderPlayerList);

async function payPlayer(uid, username, amount){
  if(isMuted()){ muteBlockedToast("pay people"); return false; }
  amount = Math.floor(amount);
  if(!(amount>0)){ toast("Enter an amount."); return false; }
  if(uid === state.uid){ toast("You can't pay yourself."); return false; }
  try{
    await runTransaction(db, async tx=>{
      const ref = doc(db,"players",state.uid), snap = await tx.get(ref), m = snap.data()?.money||0;
      if(m < amount) throw new Error("nomoney");
      tx.update(ref, { money: m - amount });
    });
  }catch(e){
    toast(e.message==="nomoney" ? "You don't have that much money." : friendlyFirebaseError(e));
    return false;
  }
  const sent = await withErrorToast(()=> addDoc(collection(db,"players",uid,"inbox"), { type:"payment_received", amount, fromUsername: state.profile.username, ts: Date.now(), credited:false }));
  if(sent===null){ await grantMoney(amount); return false; } // refund
  toast(`Paid $${fmtMoney(amount)} to ${username}.`);
  return true;
}
async function showRecap(since){
  if(!since) return;                       // brand-new account: nothing to recap
  if(document.getElementById("recapModal").classList.contains("active")) return;
  const inGame = ()=> state.profile && document.getElementById("screen-game").classList.contains("active");
  if(!inGame()) return;
  let sold=0, soldN=0, paid=0, paidN=0;
  const friendReqs = [], payers = {}, dmFrom = {};
  try{
    const ib = await getDocs(query(collection(db,"players",state.uid,"inbox"), where("ts",">",since)));
    ib.forEach(d=>{ const n=d.data();
      if(n.type==="auction_sold"){ sold+=n.amount||0; soldN++; }
      else if(n.type==="payment_received"){ paid+=n.amount||0; paidN++; payers[n.fromUsername]=(payers[n.fromUsername]||0)+(n.amount||0); }
      else if(n.type==="friend_request") friendReqs.push(n.fromUsername);
      else if(n.type==="new_message"){ const k=n.fromUid; dmFrom[k]=dmFrom[k]||{name:n.fromUsername,n:0}; dmFrom[k].n++; } });
    // also count DMs straight from the threads (covers anything without a ping)
    const uids = [...new Set([...(state.profile.friends||[]), ...Object.keys(state.pmContactsExtra)])];
    const counts = await Promise.all(uids.map(u=> getDocs(query(collection(db,"privateChats",pmThreadId(state.uid,u),"messages"), where("ts",">",since))).then(sn=>sn.docs.filter(d=>d.data().uid!==state.uid && !d.data().system).length).catch(()=>0)));
    uids.forEach((u,i)=>{ if(counts[i] > (dmFrom[u]?.n||0)) dmFrom[u] = { name:dmFrom[u]?.name || state.pmContactsExtra[u] || "a friend", n:counts[i] }; });
  }catch(e){ console.error(e); }
  if(!inGame()) return;                    // logged out while the recap was loading
  const dms = Object.values(dmFrom).reduce((a,x)=>a+x.n,0), fr = friendReqs.length;
  const list = (arr)=> arr.length ? `<div class="recap-detail">${arr.slice(0,5).map(escapeHTML).join(", ")}${arr.length>5?", …":""}</div>` : "";
  const nothing = !soldN && !paidN && !fr && !dms;
  document.getElementById("recapBody").innerHTML = `
    <p class="recap-away">You were away for ${fmtPlaytime((Date.now()-since)/1000)}</p>
    <div class="recap-grid">
      <div><span>🏷️</span><b>$${fmtMoney(sold)}</b><small>earned from the auction (${soldN} sale${soldN===1?"":"s"})</small></div>
      <div><span>💰</span><b>$${fmtMoney(paid)}</b><small>paid to you (${paidN} payment${paidN===1?"":"s"})</small>${list(Object.entries(payers).map(([n,a])=>`${n} ($${fmtMoney(a)})`))}</div>
      <div><span>🤝</span><b>${fr}</b><small>friend request${fr===1?"":"s"}</small>${list(friendReqs)}</div>
      <div><span>💬</span><b>${dms}</b><small>new private message${dms===1?"":"s"}</small>${list(Object.values(dmFrom).map(x=>`${x.name} (${x.n})`))}</div>
    </div>${nothing?'<p class="recap-away">Nothing new while you were gone.</p>':""}`;
  openModal("recapModal");
}
// The recap is shown once per login only (from enterGame). It is NOT re-shown
// when you tab back in, and it is wiped on logout so it can never appear on
// the title/login screen.
document.getElementById("btnRecapOk").addEventListener("click", ()=> closeModal("recapModal"));
document.querySelectorAll("[data-pay]").forEach(b=> b.addEventListener("click", ()=>{
  const inp = document.getElementById("payAmount");
  inp.value = Math.min(state.profile.money||0, (Number(inp.value)||0) + Number(b.dataset.pay));
}));
document.getElementById("payAmount").addEventListener("input", (e)=>{
  const v = Math.floor(Number(e.target.value)||0);
  e.target.value = v>0 ? Math.min(v, state.profile.money||0) : "";
});

/* =========================================================================
   SETTINGS
   ========================================================================= */
// Notification toggles (ON = show popups, OFF = hide them). Saved on the player doc so they follow the account.
const notifOn = k=> state.profile?.notifSettings?.[k] !== false;
const NOTIF_BOXES = { chat:"notifChat", pay:"notifPay", auction:"notifAuction" };
function syncNotifBoxes(){ Object.entries(NOTIF_BOXES).forEach(([k,id])=>{ const el=document.getElementById(id); if(el) el.checked = notifOn(k); }); const ps=document.getElementById("privateSocial"); if(ps) ps.checked = !!state.profile?.privateSocial; const pp=document.getElementById("privateProfile"); if(pp) pp.checked = !!state.profile?.privateProfile; }
Object.entries(NOTIF_BOXES).forEach(([k,id])=>{
  document.getElementById(id).addEventListener("change", (e)=>{
    withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { [`notifSettings.${k}`]: e.target.checked }));
  });
});
document.getElementById("btnSettings").addEventListener("click", ()=>{ syncNotifBoxes(); openModal("settingsModal"); });
document.getElementById("muteMusic").addEventListener("change", (e)=>{ state.settings.muteMusic=e.target.checked; if(e.target.checked) musicEl().pause(); else musicEl().play().catch(()=>{}); });
{ const sel = document.getElementById("themeMode"); sel.value = THEMES.includes(state.settings.theme) ? state.settings.theme : "dynamic";
  sel.addEventListener("change", ()=>{ state.settings.theme = sel.value; localStorage.setItem("dragoneer_theme", sel.value); dayTick(); }); }
document.getElementById("muteSfx").addEventListener("change", (e)=>{ state.settings.muteSfx=e.target.checked; });

/* =========================================================================
   GLOBAL HOVER/CLICK SFX
   ========================================================================= */
document.addEventListener("mouseover", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("hover"); });
document.addEventListener("click", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("click"); });

/* =========================================================================
   BOOT
   ========================================================================= */
/* =========================================================================
   WORLD BOSS — the sleeping dragon (shared, multiplayer) + emoji reactions
   ========================================================================= */
const BOSS_MAX = 1000000000;
const bossRef = ()=> doc(db,"boss","main");
let bossUnsub=null, rxUnsub=null, bossPending=0, bossClicks=0, bossTimer=null, bossHp=BOSS_MAX, bossResetTimer=null, lastRx=0;
/* The dragon's HP is NOT a number somebody keeps decrementing (that drifted away from reality whenever a write was
   rejected or lost). It is always worked out from the players themselves:
       HP = 1,000,000,000 − (everyone's total bossDamage − the total at the moment the dragon last woke up)
   so it is exactly max HP minus the sum of every account's dragon damage, and can never disagree with the leaderboard. */
let bossTotalSeen = 0, bossBaseSeen = 0;
function fmtBig(n){ return Math.max(0,Math.round(n)).toLocaleString(); }
function renderBoss(){
  document.getElementById("bossFill").style.width = (100*Math.max(0,bossHp)/BOSS_MAX)+"%";
  document.getElementById("bossNum").textContent = bossHp<=0 ? "DEFEATED — it stirs again soon…" : `${fmtBig(bossHp)} / ${fmtBig(BOSS_MAX)}`;
}
async function bossFetch(){
  const [s, agg] = await Promise.all([ getDoc(bossRef()), getAggregateFromServer(collection(db,"players"), { total: sum("bossDamage") }) ]);
  return { base: (s.exists() && s.data().base) || 0, total: agg.data().total || 0 };
}
let bossPoll=null;
async function pollBoss(){
  if(document.hidden) return;
  let r; try{ r = await bossFetch(); }catch(err){ console.error(err); return; }
  bossBaseSeen = r.base; bossTotalSeen = r.total;
  const real = BOSS_MAX - (r.total - r.base);                    // what everyone's saved damage adds up to
  bossHp = real - bossPending; renderBoss();                      // plus what I've clicked but not saved yet
  if(real<=0 && !bossResetTimer) bossResetTimer = setTimeout(async ()=>{
    bossResetTimer = null;
    try{
      const f = await bossFetch(); if(BOSS_MAX - (f.total - f.base) > 0) return;       // somebody else already woke it
      await runTransaction(db, async tx=>{
        const c = await tx.get(bossRef());
        if(((c.data()||{}).base||0) !== f.base) return;            // already reset by another player
        tx.update(bossRef(), { hp:BOSS_MAX, base:f.total });
      });
    }catch(err){ console.error(err); }
  }, 6000);
}
async function initBoss(){
  bossCleanup();
  const snap = await getDoc(bossRef()).catch(()=>null);
  if(snap && !snap.exists()) await setDoc(bossRef(), { hp:BOSS_MAX, hpMax:BOSS_MAX, base:0 }).catch(()=>{});
  loadBossState();
  pollBoss(); bossPoll = setInterval(pollBoss, 7000);   // the bar refreshes every 7s
  rxUnsub = onSnapshot(query(collection(db,"reactions"), where("ts",">",Date.now()-3000)), snap=>{
    snap.docChanges().forEach(c=>{ if(c.type==="added" && Date.now()-c.doc.data().ts < 4000) spawnReaction(c.doc.data()); });
  }, ()=>{});
}
function bossCleanup(){
  if(bossPoll){ clearInterval(bossPoll); bossPoll=null; }
  if(rxUnsub){ rxUnsub(); rxUnsub=null; }
  if(bossTimer){ clearTimeout(bossTimer); bossTimer=null; }
}
/* Clicks are batched for 3s and then added to MY player doc (bossDamage / dragonClicks) — that is the single source
   of truth. Unsaved clicks are mirrored to localStorage, so closing the tab or a failed write never loses damage;
   they are retried until they land. */
let bossFlushing = false;
const bossStoreKey = ()=> "dragoneer_boss_"+(state.uid||"");
function saveBossState(){
  try{ if(bossPending>0 || bossClicks>0) localStorage.setItem(bossStoreKey(), JSON.stringify({ p:bossPending, c:bossClicks })); else localStorage.removeItem(bossStoreKey()); }catch{}
}
function loadBossState(){
  try{
    const s = JSON.parse(localStorage.getItem(bossStoreKey())||"null"); if(!s) return;
    bossPending += s.p||0; bossClicks += s.c||0; saveBossState();
    if(bossPending>0) flushBoss();
  }catch{}
}
async function flushBoss(){
  bossTimer = null;
  if(bossFlushing || !state.uid) return;
  const dmg = bossPending, clicks = bossClicks; if(!dmg && !clicks) return;
  bossFlushing = true;
  let ok = true;
  try{
    await updateDoc(doc(db,"players",state.uid), { bossDamage: increment(dmg), dragonClicks: increment(clicks) });
    bossPending -= dmg; bossClicks -= clicks;                    // clicks made during the write stay pending
    saveBossState();
  }catch(err){ console.error(err); ok = false; }
  finally{ bossFlushing = false; }
  if(!ok) bossTimer = setTimeout(flushBoss, 5000);
  else if(bossPending>0 && !bossTimer) bossTimer = setTimeout(flushBoss, 1000);
}
document.getElementById("bossDragon").addEventListener("click", (e)=>{
  if(!state.profile) return;
  if(bossHp<=0){ toast("The dragon has fallen! It will stir again soon."); return; }
  const dmg = Math.max(1, Math.round(playerAttackPower()));
  bossPending += dmg; bossClicks++; bossHp -= dmg; renderBoss(); saveBossState();
  const svg = e.currentTarget; svg.classList.remove("hit"); void svg.getBoundingClientRect(); svg.classList.add("hit");
  const n = document.createElement("div"); n.className="dmg-pop"; n.textContent = "-"+fmtBig(dmg);
  const r = document.getElementById("gameStage").getBoundingClientRect();
  n.style.left = (e.clientX-r.left)+"px"; n.style.top = (e.clientY-r.top)+"px";
  document.getElementById("reactionLayer").appendChild(n); setTimeout(()=>n.remove(), 900);
  playSfx("attack");
  if(!bossTimer) bossTimer = setTimeout(flushBoss, 3000);
});
async function sendReaction(btn){
  if(!state.profile || !allowedReactions(cosOwned()).includes(btn.dataset.rx) || Date.now()-lastRx < 3000) return;
  lastRx = Date.now();
  const all = document.querySelectorAll(".rx-btn"); all.forEach(b=>b.disabled=true); setTimeout(()=>all.forEach(b=>b.disabled=false), 3000);
  const ref = await withErrorToast(()=> addDoc(collection(db,"reactions"), { uid:state.uid, username:state.profile.username, emoji:btn.dataset.rx, ts:Date.now() }));
  if(ref) setTimeout(()=> deleteDoc(ref).catch(()=>{}), 6000);
}
document.querySelectorAll("[data-rx]").forEach(btn=> btn.addEventListener("click", ()=> sendReaction(btn)));
function spawnReaction(r){
  const el = document.createElement("div"); el.className = "rx-bubble";
  const e = document.createElement("span"); e.className="rx-emoji"; e.textContent = r.emoji;
  const u = document.createElement("span"); u.className="rx-name"; u.textContent = r.username;
  el.append(e,u); el.style.left = (15+Math.random()*70)+"%";
  document.getElementById("reactionLayer").appendChild(el); setTimeout(()=>el.remove(), 2200);
}
window.addEventListener("pagehide", ()=>{ saveBossState(); if(bossPending) flushBoss(); });
document.getElementById("btnLeaveQueue").addEventListener("click", cancelQueue);


/* =========================================================================
   DAILIES — a path of day-nodes in the Journal. Claim one node per day (resets 12am ET,
   same moment the shop rotates). Miss a day and the path resets to Day 1.
   Every 4 days the pattern restarts, buffed: 💰 Money → 💎 Minerals → ⚔️ Weapon/Armor → 🛠️ Tool
   ========================================================================= */
const DAILY_CYCLE = [
  { kind:"money",   icon:"💰", name:"Money" },
  { kind:"mineral", icon:"💎", name:"Minerals" },
  { kind:"gear",    icon:"⚔️", name:"Weapon / Armor" },
  { kind:"tool",    icon:"🛠️", name:"Tool" }
];
// $10, $30, $80, $150, $250, then +$150 every round (capped at $3,000) — meaningful early, never runaway
const MONEY_LADDER = [10,30,80,150,250];
const dailyMoney = c=> c < MONEY_LADDER.length ? MONEY_LADDER[c] : Math.min(3000, 250 + (c-4)*150);
// cheap stuff first (coal, copper…), climbing to gems and rare ores
const MINERAL_STEPS = ["ore_coal","ore_copper","ore_tin","ore_iron","gem_garnet","ore_silver","gem_quartz","ore_gold","gem_amethyst","gem_sapphire","gem_ruby","ore_platinum","gem_emerald","ore_mithril","gem_opal","gem_diamond","ore_adamantite"];
function dailyMinerals(c){
  const lad = MINERAL_STEPS.filter(id=>ITEM_BY_ID[id]);
  const p = Math.min(lad.length-1, c), distinct = Math.min(4, 1+Math.floor(c/3)), qty = Math.min(8, 2+Math.floor(c/2));
  const out = [];
  for(let j=0;j<distinct;j++){ const id = lad[Math.max(0,p-j*2)], ex = out.find(o=>o.itemId===id); if(ex) ex.qty += qty; else out.push({ itemId:id, qty }); }
  return out;
}
const dailyRarityWeights = c=>{ const mu = Math.min(3.4, c*0.45); return RARITIES.map((r,i)=> Math.exp(-((i-mu)**2)/0.72)); };
function dailyGearBand(c){
  const w = dailyRarityWeights(c);
  return RARITIES.map((r,i)=>({r,w:w[i]})).sort((a,b)=>b.w-a.w).slice(0,2).map(x=>x.r).sort((a,b)=>RARITIES.indexOf(a)-RARITIES.indexOf(b));
}
const gearByRarity = {};
function rollDailyGear(c){
  const w = dailyRarityWeights(c), sum = w.reduce((a,b)=>a+b,0);
  let r = Math.random()*sum, rar = "common";
  for(let i=0;i<RARITIES.length;i++){ if((r-=w[i])<=0){ rar = RARITIES[i]; break; } }
  const pool = gearByRarity[rar] ||= Object.values(ITEM_BY_ID).filter(i=> (i.type==="weapon"||i.type==="armor") && i.rarity===rar);
  return pool.length ? pool[Math.floor(Math.random()*pool.length)].id : null;
}
const DAILY_TOOL_KINDS = [["pickaxe",6],["fishingrod",6],["hoe",5],["can",5]];
const dailyToolHi = c=> Math.min(6, 1+Math.floor(c*0.75));
function rollDailyTool(c){
  const [kind,cap] = DAILY_TOOL_KINDS[Math.floor(Math.random()*DAILY_TOOL_KINDS.length)];
  const hi = Math.min(cap, dailyToolHi(c)), lo = Math.max(1, hi-1), tier = Math.random()<0.5 ? lo : hi;
  const id = tier===1 ? "tool_"+kind : "tool_"+kind+tier;
  return ITEM_BY_ID[id] ? id : "tool_"+kind;
}
const capWords = s=> s.charAt(0).toUpperCase()+s.slice(1);
// What a day gives (previews for the path; rollDailyReward makes the real random picks at claim time)
function dailyPlan(n){
  const c = Math.floor((n-1)/4), slot = DAILY_CYCLE[(n-1)%4];
  if(slot.kind==="money"){ const amt = dailyMoney(c); return { ...slot, short:`$${fmtMoney(amt)}`, text:`$${fmtMoney(amt)} cash` }; }
  if(slot.kind==="mineral"){
    const list = dailyMinerals(c), first = list[0];
    return { ...slot, short: `${ITEM_BY_ID[first.itemId].name.replace(/ Ore$/,"")} ×${first.qty}${list.length>1?` +${list.length-1}`:""}`,
      text: list.map(m=>`${m.qty}× ${ITEM_BY_ID[m.itemId].name}`).join(", ") };
  }
  if(slot.kind==="gear"){ const band = dailyGearBand(c); return { ...slot, short:"Gear", text:`A random ${band.map(capWords).join("/")} weapon or armor piece` }; }
  const hi = dailyToolHi(c); return { ...slot, short:`Tool T${hi}`, text:`A random tool (tier ${Math.max(1,hi-1)}–${hi}): pickaxe, fishing rod, hoe or watering can` };
}
function rollDailyReward(n){
  const c = Math.floor((n-1)/4), kind = DAILY_CYCLE[(n-1)%4].kind;
  if(kind==="money"){ const amt = dailyMoney(c); return { money:amt, add:[], label:`$${fmtMoney(amt)}` }; }
  if(kind==="mineral"){ const list = dailyMinerals(c); return { add:list, label:list.map(m=>`${m.qty}× ${ITEM_BY_ID[m.itemId].name}`).join(", ") }; }
  const id = kind==="gear" ? rollDailyGear(c) : rollDailyTool(c);
  return id ? { add:[{ itemId:id, qty:1 }], label:`${ITEM_BY_ID[id].name} (${ITEM_BY_ID[id].rarity})` } : { add:[], money:dailyMoney(c), label:`$${fmtMoney(dailyMoney(c))}` };
}
function dailyInfo(){
  const d = state.profile?.dailies || {}, today = dayIndex();
  const claimedToday = d.day===today, alive = d.day===today || d.day===today-1;
  return { today, claimedToday, streak: alive ? (d.streak||0) : 0, missed: !alive && (d.streak||0) > 0 };
}
function updateDailyDot(){
  if(!state.profile) return;
  const open = !dailyInfo().claimedToday;
  const dot = document.getElementById("dailyDot"); if(dot) dot.style.display = open ? "" : "none";
  document.getElementById("btnJournal")?.classList.toggle("has-daily", open);
}
const fmtClock = ms=>{ const s = Math.max(0,Math.floor(ms/1000)); return [Math.floor(s/3600), Math.floor(s%3600/60), s%60].map(x=>String(x).padStart(2,"0")).join(":"); };
function renderDailies(){
  const page = document.getElementById("jtab-dailies");
  if(!state.profile || !page || !page.classList.contains("active") || !document.getElementById("journalModal").classList.contains("active")) return;
  const info = dailyInfo(), streak = info.streak, claimable = !info.claimedToday, focusN = claimable ? streak+1 : streak;
  const startCycle = Math.floor((Math.max(1,focusN)-1)/4);
  let html = "";
  for(let c=startCycle; c<startCycle+3; c++){
    html += `<div class="daily-round">Round ${c+1}${c>0?` <small>— buffed rewards</small>`:""}</div><div class="daily-row${c%2?" rev":""}">`;
    for(let k=0;k<4;k++){
      const n = c*4+k+1, plan = dailyPlan(n);
      const cls = n<=streak ? "done" : n===streak+1 ? (claimable ? "today" : "tomorrow") : "locked";
      if(k>0) html += `<span class="daily-link${n<=streak ? " done" : ""}"></span>`;
      html += `<button class="daily-node ${cls}${n===streak&&info.claimedToday?" just":""}" data-n="${n}" title="${escapeHTML(plan.text)}"><span class="dn-day">Day ${n}</span><span class="dn-ico">${n<=streak?"✅":plan.icon}</span><span class="dn-rw">${escapeHTML(plan.short)}</span></button>`;
    }
    html += `</div>` + (c<startCycle+2 ? `<div class="daily-turn ${c%2?"l":"r"}"></div>` : "");
  }
  document.getElementById("dailyPath").innerHTML = html;
  document.getElementById("dailyPath").querySelectorAll(".daily-node.today").forEach(b=> b.addEventListener("click", claimDaily));
  document.getElementById("dailyHeader").textContent = info.missed
    ? "You missed a day, so the path reset. Claim Day 1 to start a new streak."
    : `🔥 Streak: ${streak} day${streak===1?"":"s"} — ${claimable ? "today's reward is ready!" : "claimed today. Come back tomorrow!"}`;
  const next = streak+1, plan = dailyPlan(claimable ? next : next);
  document.getElementById("dailyReward").innerHTML = `<b>${claimable?"Today":"Tomorrow"} — Day ${next}:</b> ${escapeHTML(plan.text)}`;
  const btn = document.getElementById("btnDailyClaim");
  btn.disabled = !claimable; btn.textContent = claimable ? `Claim Day ${next}` : "Claimed ✓";
  tickDailyClock();
}
function tickDailyClock(){
  const el = document.getElementById("dailyCountdown"); if(el) el.textContent = `New reward in ${fmtClock(msUntilEtMidnight())} (resets 12am ET)`;
}
let dailyBusy = false;
async function claimDaily(){
  if(dailyBusy || !state.profile) return;
  const info = dailyInfo();
  if(info.claimedToday){ toast("You already claimed today's reward — it resets at 12am ET."); return; }
  const n = info.streak+1, rw = rollDailyReward(n), today = info.today;
  dailyBusy = true;
  try{
    const ok = await applyInvChanges({ add:rw.add, strict:true }, d=>{
      const dd = d.dailies || {};
      if(dd.day===today) throw new Error("daily-claimed");
      const streak = dd.day===today-1 ? (dd.streak||0)+1 : 1;
      if(streak!==n) throw new Error("daily-changed");
      return { dailies:{ day:today, streak }, ...(rw.money ? { money:(d.money||0)+rw.money } : {}) };
    });
    if(ok===null) return;
    playSfx("buy"); toast(`🎁 Day ${n} claimed: ${rw.label}`, 6000, "toast-money");
  } finally { dailyBusy = false; renderDailies(); updateDailyDot(); }
}
document.getElementById("btnDailyClaim").addEventListener("click", claimDaily);
document.querySelector('[data-jtab="dailies"]').addEventListener("click", renderDailies);
let seenEtDay = dayIndex();
setInterval(()=>{
  if(!state.profile) return;
  if(document.getElementById("jtab-dailies").classList.contains("active")) tickDailyClock();
  const d = dayIndex();
  if(d!==seenEtDay){                       // midnight ET passed: dailies + every region's shop roll over
    seenEtDay = d; updateDailyDot(); renderDailies();
    if(document.getElementById("compassModal").classList.contains("active")) renderShop();
    toast("🌅 It's a new day — fresh shop stock and a new daily reward!");
  }
}, 1000);

/* =========================================================================
   FRIENDS / FOLLOWERS LISTS (+ privacy setting)
   ========================================================================= */
async function openSocialList(uid, kind){
  const title = document.getElementById("socialTitle"), list = document.getElementById("socialList");
  title.textContent = kind==="friends" ? "Friends" : kind==="following" ? "Following" : "Followers";
  list.innerHTML = "<p class='doodle-sub'>Loading…</p>"; openModal("socialModal");
  try{
    const snap = await getDoc(doc(db,"players",uid)), d = snap.exists() ? snap.data() : {};   // fresh read, so a just-flipped privacy setting is respected
    if(uid!==state.uid && d.privateSocial){ list.innerHTML = "<p class='doodle-sub'>🔒 This player keeps their friends, followers and following private.</p>"; return; }
    const friendSet = new Set(d.friends||[]);
    const ids = (kind==="following" ? followingIds(d) : (d.friends||[])).slice(0,100), rows = new Map();
    (await Promise.all(ids.map(id=> getDoc(doc(db,"players",id)).catch(()=>null)))).forEach((s,i)=>{
      if(s?.exists() && !s.data().banned) rows.set(ids[i], { data:s.data(), friend:friendSet.has(ids[i]) });
    });
    if(kind==="followers"){   // followers = friends + everyone with a friend request out to this player
      const q = await getDocs(query(collection(db,"players"), where("sentFriendRequests","array-contains",uid)));
      q.docs.forEach(x=>{ if(!x.data().banned && !rows.has(x.id)) rows.set(x.id, { data:x.data(), friend:false }); });
    }
    list.innerHTML = rows.size ? "" : `<p class='doodle-sub'>${kind==="friends" ? "No friends yet." : kind==="following" ? "Not following anyone yet." : "No followers yet."}</p>`;
    [...rows.entries()].sort((a,b)=> (b[1].data.level||0)-(a[1].data.level||0)).forEach(([id,r])=>{
      const x = r.data, el = document.createElement("div");
      el.className = "player-card"; el.style.background = ELEMENTS[x.archetype]?.color || "#FFFDF7";
      el.innerHTML = `<b>${escapeHTML(x.username)}${onlineDot(x, id===state.uid)}</b><span>Lv.${x.level||1} ${ELEMENTS[x.archetype]?.name||""} ${CLASSES[x.klass]?.name||""}</span>${r.friend ? "<em>★ Friend</em>" : kind==="following" ? "<em>Requested</em>" : "<em>Follower</em>"}`;
      el.addEventListener("click", ()=>{ closeModal("socialModal"); openProfileBook(id, x, null, null); });
      list.appendChild(el);
    });
  }catch(e){ console.error(e); list.innerHTML = "<p class='doodle-sub'>Couldn't load that list.</p>"; }
}
document.getElementById("privateProfile").addEventListener("change", e=>{
  withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { privateProfile: e.target.checked }));
});
document.getElementById("privateSocial").addEventListener("change", e=>{
  withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { privateSocial: e.target.checked }));
});


/* =========================================================================
   DUNGEON (🕯️ next to the Compass)
   Run state lives on the player doc as `dungeon` = { floor, ev, loot } (null when outside),
   so a reload drops you back on the same floor. Other fields: dungeonRecord (best floor),
   dungeonNextOpen (ms timestamp the door re-opens). Pure odds/scaling are in rpg_dungeon.js.
   ========================================================================= */
const dgRun = ()=> (state.profile && state.profile.dungeon) || null;
const dgActive = ()=> !!dgRun();
let dgLastHtml = "", dgCandleInit = false;

/* ----- pools for chests / the vendor ----- */
function dgGearPool(){ return Object.values(ITEM_BY_ID).filter(i=> (i.type==="weapon"||i.type==="armor"||i.type==="trinket") && String(i.id).startsWith("gear_")); }
function dgPick(list){ return list[Math.floor(Math.random()*list.length)]; }
function dgItemOfRarity(list, rarity){
  const order = ["common","uncommon","rare","epic","legendary"], at = order.indexOf(rarity);
  for(let d=0; d<5; d++) for(const r of [order[at-d], order[at+d]]){ const m = list.filter(i=>i.rarity===r); if(r && m.length) return dgPick(m); }
  return dgPick(list);
}
/* A chest holds at most ONE item: 25% nothing, 75% any item in the game. Commons are always the most likely rarity (depth only nudges the odds slightly). */
function dgRollChest(f){
  if(Math.random() < 0.25) return [];
  const all = Object.values(ITEM_BY_ID).filter(i=> i.rarity && i.type!=="backpack" && i.type!=="rebirth");
  const t = Math.min(1, f/60), w = { common:55-10*t, uncommon:25, rare:12+4*t, epic:6+4*t, legendary:2+2*t };
  let r = Math.random()*Object.values(w).reduce((x,y)=>x+y,0), rar = "common";
  for(const k of Object.keys(w)){ r -= w[k]; if(r<=0){ rar = k; break; } }
  const it = dgItemOfRarity(all, rar);
  return it ? [{ itemId:it.id, qty:1 }] : [];
}
const dgPrice = it=> Math.max(15, Math.round((it.price || (it.sellPrice||5)*4) * 1.5));
function dgRollShop(f){
  const foods = Object.values(ITEM_BY_ID).filter(i=>i.type==="consumable" && ((i.stats?.heal||0)>0 || (i.stats?.mana||0)>0));
  const food = dgItemOfRarity(foods, rollRarity(f));
  const gearItem = dgItemOfRarity(dgGearPool(), rollRarity(f));
  return { items:[food, gearItem].map(it=>({ itemId:it.id, price:dgPrice(it), sold:false })), skipSold:false };
}

/* ----- events ----- */
function dgRollEvent(f){
  if(isCheckpoint(f)) return { type:"safe" };
  const t = rollEventType(f), lvl = state.profile.level||1;
  if(t==="nothing") return { type:"nothing" };
  if(t==="chest")   return { type:"chest", opened:false, loot:[] };
  if(t==="shop")    return { type:"shop", ...dgRollShop(f) };
  if(t==="doors")   return { type:"doors", pick:-1, outcome:"", note:"" };
  if(t==="boss")    return { type:"boss", done:false, ms:[buildMonster(f,"boss",lvl)], idx:0 };
  if(t==="waves")   return { type:"waves", done:false, ms:Array.from({length:waveSize(f)}, ()=>buildMonster(f,"wave",lvl)), idx:0 };
  return { type:"battle", done:false, ms:[buildMonster(f,"normal",lvl)], idx:0 };
}
const dgEvDone = ev=> ev.type==="start"||ev.type==="safe"||ev.type==="nothing"||ev.type==="shop" ? true : ev.type==="chest" ? ev.opened : ev.type==="doors" ? ev.pick>=0 : !!ev.done;

async function dgSave(run){
  state.profile.dungeon = run; dgLastHtml = ""; updateDungeonUI();
  await updateDoc(doc(db,"players",state.uid), { dungeon: run }).catch(e=>toast(friendlyFirebaseError(e)));
}
function dgAddLoot(run, list){ list.forEach(({itemId,qty})=>{ const e = run.loot.find(x=>x.itemId===itemId); if(e) e.qty += qty; else run.loot.push({ itemId, qty }); }); }
/* gives items and records only what really fit in the bag (overflow is handled by the normal overflow popup) */
async function dgGive(list){
  let dropped = [];
  const ok = await applyInvChanges({ add:list, onDropped:d=>{ dropped = d; queueOverflow(d); } });
  if(ok===null) return false;
  const run = dgRun(); if(!run) return true;
  const got = list.map(x=>({ ...x })).map(x=>{ const d = dropped.find(y=>y.itemId===x.itemId); return d ? { ...x, qty:x.qty-d.qty } : x; }).filter(x=>x.qty>0);
  dgAddLoot(run, got); return true;
}

/* ----- stage rendering ----- */
function dgItemCard(itemId, extra=""){
  const it = ITEM_BY_ID[itemId]; if(!it) return "";
  return `<div class="dg-card rarity-${it.rarity}"><b>${escapeHTML(it.name)}</b><span>${it.rarity}</span><span>${escapeHTML(itemEffectText(it)||"")}</span>${extra}</div>`;
}
function dgStageHTML(run){
  const p = state.profile, ev = run.ev, f = run.floor, rec = p.dungeonRecord||0;
  let body = "", arrow = true, door = "🚪";
  if(ev.type==="start") body = `<div>The door groans open. Death down here kicks you out and costs you your loot.</div>`;
  else if(ev.type==="safe") { door = "🕯️"; arrow = false; body = `<div><b>Checkpoint.</b> Nothing here but quiet.</div><div class="dg-note">Your progress is only saved on this floor — you can leave now with everything, or push forward.</div>
      <div><button class="doodle-btn btn-green" data-act="leave">Leave safely</button> <button class="doodle-btn btn-pink" data-act="next">Push forward ⬇️</button></div>`; }
  else if(ev.type==="nothing") body = `<div>An empty room. The path onward is free.</div>`;
  else if(ev.type==="chest") body = ev.opened
      ? (ev.loot.length ? `<div>📦 You found:</div><div class="dg-items">${ev.loot.map(l=>dgItemCard(l.itemId, l.qty>1?`<span>x${l.qty}</span>`:"")).join("")}</div>` : `<div>📦 The chest is empty…</div>`)
      : `<button class="doodle-btn btn-lg btn-yellow" data-act="chest">📦 Open the chest</button>`;
  else if(ev.type==="shop"){
    body = `<div>🛒 A hooded vendor lights a lantern. <span class="dg-note">You have $${fmtMoney(p.money)}</span></div><div class="dg-items">` +
      ev.items.map((s,i)=> dgItemCard(s.itemId, s.sold ? `<span>SOLD</span>` : `<button class="doodle-btn btn-sm btn-green" data-act="buy" data-i="${i}">Buy $${fmtMoney(s.price)}</button>`).replace('class="dg-card','class="dg-card'+(s.sold?" sold":""))).join("") +
      `<div class="dg-card${ev.skipSold?" sold":""}"><b>⏬ Floor Skip</b><span>Next arrow drops you down 2 floors.</span>${ev.skipSold?"<span>BOUGHT</span>":`<button class="doodle-btn btn-sm btn-green" data-act="skip">Buy $${DG_SKIP_PRICE}</button>`}</div></div>`;
  }
  else if(ev.type==="doors"){
    body = ev.pick<0 ? `<div>Three doors. Only one way forward each... but not all are kind.</div><div class="dg-doors">${[0,1,2].map(i=>`<button data-act="door" data-i="${i}">🚪</button>`).join("")}</div>`
      : `<div class="dg-doors">${[0,1,2].map(i=>`<button disabled>${i===ev.pick ? (ev.outcome==="safe"?"✅":ev.outcome==="spike"?"🩸":"💸") : "🚪"}</button>`).join("")}</div><div>${escapeHTML(ev.note)}</div>`;
  }
  else {                                                                         // battle / boss / waves
    const m = ev.ms[Math.min(ev.idx, ev.ms.length-1)], tag = ev.type==="boss" ? "👁️ BOSS" : ev.type==="waves" ? `⚔️ WAVE ${Math.min(ev.idx+1,ev.ms.length)}/${ev.ms.length}` : "⚔️ BATTLE";
    body = ev.done ? `<div>The room falls silent. ${ev.type==="battle"?"It is dead.":ev.type==="boss"?"The boss is dead.":"All enemies are dead."}</div>`
      : `<div>${tag}: ${escapeHTML(m.name)} (Lv.${m.level})</div><button class="doodle-btn btn-lg btn-danger" data-act="fight">Fight!</button>`;
  }
  const done = dgEvDone(ev), nextN = (ev.type==="shop" && ev.skipSold) ? 2 : 1;
  const next = arrow && done ? `<button class="doodle-btn btn-lg btn-green dg-arrow" data-act="next">➜ ${ev.type==="nothing"||ev.type==="start" ? "Enter" : "Next floor"}${nextN===2?" (skip 2)":""}</button>` : "";
  return `<div class="dg-record">🏆 Record floor: ${rec}</div><div class="dg-floor">Floor ${f}</div><div class="dg-door">${door}</div><div class="doodle-panel dg-panel">${body}</div>${next}`;
}
function dgRenderStage(){
  const run = dgRun(), el = document.getElementById("dungeonStage"); if(!el) return;
  if(!run){ el.innerHTML = ""; dgLastHtml = ""; return; }
  const html = dgStageHTML(run);
  if(html!==dgLastHtml){ el.innerHTML = html; dgLastHtml = html; }
}
function dgRenderLootNote(){
  const n = document.getElementById("dgLootNote"), run = dgRun(); if(!n) return;
  if(!run){ n.style.display = "none"; return; }
  const list = run.loot.map(l=>`${escapeHTML(ITEM_BY_ID[l.itemId]?.name||l.itemId)} x${l.qty}`);
  n.style.display = ""; n.innerHTML = `🕯️ <b>Dungeon loot</b> — lost if you leave off a checkpoint or die: ${list.length ? list.join(", ") : "nothing yet"}`;
}
function updateDungeonUI(){
  const p = state.profile; if(!p) return;
  const on = dgActive();
  document.body.classList.toggle("dungeon-mode", on);
  document.querySelectorAll('[data-ctab]').forEach(b=> b.classList.toggle("dg-locked", on && DG_LOCKED_TABS.includes(b.dataset.ctab)));
  if(on){
    document.getElementById("hudRegion").textContent = `🕯️ Floor ${dgRun().floor} · Record ${p.dungeonRecord||0}`;
    document.getElementById("regionBg").className = "paper-bg region-dungeon";
    dgRenderStage();
  }
  dgRenderLootNote(); dgTick();
}
function dgTick(){
  const p = state.profile, b = document.getElementById("btnDungeon"); if(!p||!b) return;
  b.classList.toggle("locked", (p.dungeonNextOpen||0) - Date.now() > 0);   // greyed out while sealed; the time left is shown when you click it
}
setInterval(dgTick, 1000);

/* ----- confirm dialog ----- */
function dgConfirm({ title, html, yes="Confirm", no="Cancel", danger=true, onYes }){
  document.getElementById("dgModalTitle").textContent = title;
  document.getElementById("dgModalBody").innerHTML = html;
  const y = document.getElementById("dgModalYes"), n = document.getElementById("dgModalNo");
  y.textContent = yes; n.textContent = no; y.className = "doodle-btn " + (danger ? "btn-danger" : "btn-green");
  y.onclick = ()=>{ closeModal("dgModal"); onYes(); }; n.onclick = ()=> closeModal("dgModal");
  openModal("dgModal");
}

/* ----- enter / leave ----- */
document.getElementById("btnDungeon").addEventListener("click", ()=>{
  const p = state.profile; if(!p) return;
  if(!p.archetype){ toast("Pick an archetype first."); return; }
  if(state.battle){ toast("Finish your battle first."); return; }
  const left = (p.dungeonNextOpen||0) - Date.now();
  if(left>0){ toast(`🔒 The dungeon door is sealed. It opens again in ${fmtCountdown(left)}.`); return; }
  dgConfirm({ title:"🕯️ Enter the Dungeon?", yes:"Descend",
    html:`<p><b>Death kicks you out</b> — you lose the items you found and your progress. The deeper you go, the harder it gets and the stronger the enemies.</p>
          <p>You can only back out safely on <b>checkpoint floors</b> (5, 10, 15 …). Leaving anywhere else means dropping everything you found, losing 50% of your money and being left on 1 HP.</p>
          <p>Your Compass will be tampered with: Jobs, Shop, Farm and Battle are locked while you are inside. Leaving locks the door for 24 hours.</p>`,
    onYes: async ()=>{
      ["compassModal","journalModal","skillModal"].forEach(closeModal);
      await dgSave({ floor:0, ev:{ type:"start" }, loot:[] });
      playMusic(DG_TRACK); toast("🕯️ The door closes behind you…");
    }});
});
document.getElementById("btnDungeonExit").addEventListener("click", ()=>{
  const run = dgRun(); if(!run || state.battle) return;
  if(isCheckpoint(run.floor)) dgConfirm({ title:"Leave the dungeon?", yes:"Leave safely", danger:false,
    html:`<p>You are on a checkpoint (floor ${run.floor}). Your items <b>WILL be saved</b> when leaving.</p><p>The door will lock for 24 hours, and re-entering starts you back at floor 0.</p>`, onYes:()=> dgLeave("safe") });
  else dgConfirm({ title:"⚠️ Leave now?", yes:"Leave and lose it all",
    html:`<p>You are on floor ${run.floor}, not a checkpoint. If you leave now you will <b>drop every item you found in the dungeon</b>, <b>lose 50% of your money</b> and be left on <b>1 HP</b>.</p><p>The next checkpoint is floor ${Math.ceil((run.floor+1)/5)*5}.</p>`, onYes:()=> dgLeave("unsafe") });
});
/* reason: "safe" | "unsafe" | "death". Unsafe/death drop dungeon loot, take half the money and leave 1 HP. */
async function dgLeave(reason, manaLeft=null){
  const run = dgRun(); if(!run) return;
  const penalty = reason!=="safe";
  let lostMoney = 0;
  await withErrorToast(()=> runTransaction(db, async tx=>{
    const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data() || {};
    const upd = { dungeon:null, dungeonNextOpen: Date.now()+DG_COOLDOWN_MS, dungeonRecord: Math.max(d.dungeonRecord||0, run.floor) };
    if(penalty){
      const inv = (d.inventory||[]).map(e=>({...e})), eq = { ...(d.equipped||{}) }; let eqChanged = false;
      for(const { itemId, qty } of run.loot){
        let left = qty; const i = inv.findIndex(e=>e.itemId===itemId);
        if(i>=0){ const t = Math.min(left, inv[i].qty); inv[i].qty -= t; left -= t; }
        for(const slot of Object.keys(eq)) if(left>0 && eq[slot]===itemId){ eq[slot] = null; left--; eqChanged = true; }
      }
      upd.inventory = inv.filter(e=>e.qty>0);
      if(eqChanged){ upd.equipped = eq; Object.assign(upd, gearSyncFields(d, eq)); }
      lostMoney = Math.floor((d.money||0)*0.5); upd.money = (d.money||0) - lostMoney;
      upd.hp = 1; upd.rage = 0; upd.killstreak = 0;
      if(manaLeft!==null) upd.mana = manaLeft;
      if(reason==="death") upd.deaths = (d.deaths||0)+1;
    }
    tx.update(ref, upd);
  }));
  state.profile.dungeon = null; dgLastHtml = "";
  document.body.classList.remove("dungeon-mode");
  playMusic((REGIONS[state.profile.region]||REGIONS.forest).track);
  renderHUD();
  toast(reason==="safe" ? "🕯️ You left the dungeon safely. The door seals for 24 hours."
    : reason==="death" ? `💀 You died on floor ${run.floor}. You lost your dungeon loot and $${fmtMoney(lostMoney)}.`
    : `🏃 You fled from floor ${run.floor}: dungeon loot dropped, $${fmtMoney(lostMoney)} lost, 1 HP left.`, 6000);
}

/* ----- stage actions ----- */
async function dgAdvance(){
  const run = dgRun(); if(!run) return;
  const step = (run.ev.type==="shop" && run.ev.skipSold) ? 2 : 1, f = run.floor+step;
  const next = { floor:f, ev:dgRollEvent(f), loot:run.loot };
  if(f > (state.profile.dungeonRecord||0)){ state.profile.dungeonRecord = f; updateDoc(doc(db,"players",state.uid), { dungeonRecord:f }).catch(()=>{}); }
  await dgSave(next);
}
function dgStartFight(){
  const run = dgRun(), ev = run && run.ev; if(!ev || state.battle) return;
  const m = ev.ms[ev.idx];
  startPve("medium", { m, onWin: async ()=>{
    const r = dgRun(); if(!r) return;
    r.ev.idx++;
    if(r.ev.idx < r.ev.ms.length){ await dgSave(r); toast(`Next enemy: ${r.ev.ms[r.ev.idx].name}!`); setTimeout(dgStartFight, 600); }
    else { r.ev.idx = r.ev.ms.length-1; r.ev.done = true; await dgSave(r); }
  }});
}
document.getElementById("dungeonStage").addEventListener("click", async (e)=>{
  const btn = e.target.closest("[data-act]"); if(!btn || btn.disabled) return;
  const run = dgRun(); if(!run || state.battle) return;
  const act = btn.dataset.act, ev = run.ev, i = +btn.dataset.i;
  if(act==="next"){ if(dgEvDone(ev)) dgAdvance(); }
  else if(act==="leave"){ document.getElementById("btnDungeonExit").click(); }
  else if(act==="fight") dgStartFight();
  else if(act==="chest" && ev.type==="chest" && !ev.opened){
    ev.opened = true; ev.loot = dgRollChest(run.floor); await dgSave(run);   // saved first so a reload can't reroll it
    if(ev.loot.length){ playSfx("buy"); await dgGive(ev.loot); } await dgSave(run);
  }
  else if(act==="buy" && ev.type==="shop"){
    const s = ev.items[i]; if(!s || s.sold) return;
    if(state.profile.money < s.price){ toast("Not enough money!"); return; }
    const ok = await applyInvChanges({ add:[{ itemId:s.itemId, qty:1 }], strict:true }, d=>{ if((d.money||0)<s.price) throw new Error("nomoney"); return { money:(d.money||0)-s.price }; });
    if(ok===null) return;
    s.sold = true; dgAddLoot(run, [{ itemId:s.itemId, qty:1 }]); playSfx("buy"); await dgSave(run);
  }
  else if(act==="skip" && ev.type==="shop" && !ev.skipSold){
    if(state.profile.money < DG_SKIP_PRICE){ toast("Not enough money!"); return; }
    await withErrorToast(()=> runTransaction(db, async tx=>{ const ref = doc(db,"players",state.uid), d = (await tx.get(ref)).data()||{}; if((d.money||0)<DG_SKIP_PRICE) throw new Error("nomoney"); tx.update(ref, { money:d.money-DG_SKIP_PRICE }); }));
    ev.skipSold = true; playSfx("buy"); await dgSave(run);
  }
  else if(act==="door" && ev.type==="doors" && ev.pick<0){
    const out = doorOutcome(), p = state.profile; ev.pick = i; ev.outcome = out;
    if(out==="safe") ev.note = "The door swings open onto a quiet passage. Safe.";
    else if(out==="spike"){
      const dmg = Math.max(1, Math.round(p.hpMax*doorPct())), hp = Math.max(1, p.hp-dmg);
      ev.note = `Spikes! You lose ${p.hp-hp} HP.`; await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp }));
    } else {
      const loss = Math.floor((p.money||0)*doorPct());
      ev.note = loss>0 ? `A pickpocket snatches $${fmtMoney(loss)}!` : "A pickpocket reaches in… and finds nothing.";
      if(loss>0) await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: Math.max(0,(p.money||0)-loss) }));
    }
    await dgSave(run);
  }
});
/* candle light follows the pointer (mouse or finger) */
{
  const o = document.getElementById("candleOverlay"), no = document.getElementById("nightOverlay"), mv = (x,y)=>{ [o,no].forEach(el=>{ el.style.setProperty("--mx", x+"px"); el.style.setProperty("--my", y+"px"); }); };
  window.addEventListener("pointermove", e=> mv(e.clientX, e.clientY), { passive:true });
  window.addEventListener("touchstart", e=>{ const t = e.touches[0]; if(t) mv(t.clientX, t.clientY); }, { passive:true });
  window.addEventListener("touchmove",  e=>{ const t = e.touches[0]; if(t) mv(t.clientX, t.clientY); }, { passive:true });
}

/* =========================================================================
   MOBILE: the "⋯" menu (Journal / Compass / Settings) in the compact header
   ========================================================================= */
{
  const menu = document.getElementById("mobileMenu"), btn = document.getElementById("btnMobileMore");
  btn.addEventListener("click", e=>{ e.stopPropagation(); menu.classList.toggle("open"); });
  menu.querySelectorAll("[data-mm]").forEach(b=> b.addEventListener("click", ()=>{ menu.classList.remove("open"); document.getElementById(b.dataset.mm).click(); }));
  document.addEventListener("click", e=>{ if(!e.target.closest("#mobileMenu") && !e.target.closest("#btnMobileMore")) menu.classList.remove("open"); });
}

const dayTick = startDayNight({ getTheme:()=>state.settings.theme, onNightChange:()=>{ if(wantedTrack) playMusic(wantedTrack); } });   // at 8pm / 8am all soundtracks swap to their night / day versions
/* title screen: total accounts + players online right now */
async function refreshTitleCounts(){
  const box = document.getElementById("titleCounts"); if(!box || !document.getElementById("screen-title").classList.contains("active")) return;
  try{
    const [t, o] = await Promise.all([ getAggregateFromServer(collection(db,"players"), { n:count() }), getAggregateFromServer(query(collection(db,"players"), where("onlineAt",">",Date.now()-ONLINE_FRESH_MS)), { n:count() }) ]);
    document.getElementById("tcTotal").textContent = t.data().n.toLocaleString(); document.getElementById("tcOnline").textContent = o.data().n.toLocaleString(); box.style.visibility = "visible";
  }catch{ box.style.visibility = "hidden"; }
}
setInterval(refreshTitleCounts, 30000); setTimeout(refreshTitleCounts, 1200);
setupDragonAnim();
setTimeout(()=>{ showScreen("screen-title"); document.getElementById("screen-loading").classList.remove("active"); }, 900);

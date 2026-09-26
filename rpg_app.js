/* =========================================================================
   DRAGONEER — rpg_app.js
   Firebase-backed multiplayer doodle RPG.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, collection,
  addDoc, query, where, orderBy, limit, runTransaction, deleteDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(()=>{});

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
function friendlyFirebaseError(err){
  const code = err?.code || "";
  if(code.includes("permission-denied")) return "That action isn't allowed.";
  if(code.includes("unavailable") || code.includes("network")) return "Connection problem — check your internet and try again.";
  if(code.includes("not-found")) return "That no longer exists.";
  if(code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong username or password.";
  if(code.includes("user-not-found")) return "No account with that username.";
  if(code.includes("email-already-in-use")) return "That username is taken.";
  if(code.includes("weak-password")) return "Password needs 6+ characters.";
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
function normalizeForFilter(s){
  return s.toLowerCase()
    .replace(/[0@]/g,'o').replace(/1|!/g,'i').replace(/3/g,'e')
    .replace(/4/g,'a').replace(/5|\$/g,'s').replace(/7/g,'t')
    .replace(/[^a-z]/g,'');
}
function containsBlockedWord(raw){
  const n = normalizeForFilter(raw);
  return [...BASIC_BLOCKLIST, ...BLOCKLIST_EXTRA].some(w => n.includes(w));
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
const RARITY_MULT = { common:1, uncommon:1.4, rare:2, epic:3, legendary:4.5 };

function fmtMoney(n){
  n = Math.floor(n);
  const units = [[1e15,"Q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
  for(const [val,suf] of units){
    if(Math.abs(n) >= val) return (n/val).toFixed(2)+suf;
  }
  return String(n);
}

/* ---------- procedural item bank: 5 types x 96 = 480 items ---------- */
const ITEM_TYPES = ["weapon","armor","trinket","consumable","material"];
const PREFIXES = ["Rusty","Sturdy","Ancient","Glowing","Cursed","Blessed","Mystic","Shadow",
  "Radiant","Fragile","Gilded","Frosted","Ember","Coral","Windswept","Stone-etched",
  "Moonlit","Sunburnt","Dew-kissed","Thorned","Feathered","Scaled","Runic","Doodled"];
const BASE_NAMES = {
  weapon:["Sword","Dagger","Staff","Bow","Axe","Mace","Wand","Spear","Claws","Rapier","Fan","Chakram"],
  armor:["Tunic","Plate","Robe","Cloak","Helm","Gauntlets","Boots","Shield","Vest","Hood","Greaves","Cuirass"],
  trinket:["Charm","Ring","Amulet","Locket","Bell","Feather","Bead","Totem","Pendant","Coin","Idol","Sigil"],
  consumable:["Potion","Elixir","Berry","Bread","Stew","Tonic","Draught","Cookie","Tea","Scroll","Candy","Brew"],
  material:["Scale","Claw","Fang","Ore","Crystal","Fiber","Resin","Dust","Shard","Feather","Root","Ember"]
};
function seededRand(seed){ let s = seed % 2147483647; if(s<=0)s+=2147483646;
  return () => (s = s*16807 % 2147483647) / 2147483647; }

function buildItemBank(){
  const bank = [];
  let id = 0;
  for(const type of ITEM_TYPES){
    const rnd = seededRand(1000 + ITEM_TYPES.indexOf(type));
    for(let i=0;i<96;i++){
      const prefix = PREFIXES[i % PREFIXES.length];
      const base = BASE_NAMES[type][i % BASE_NAMES[type].length];
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
      bank.push(item);
    }
  }
  return bank;
}
function itemFlavor(type, prefix, base, element, rarity){
  const flavors = {
    weapon:`A ${rarity} ${base.toLowerCase()}, ${prefix.toLowerCase()} and humming faintly with ${ELEMENTS[element].name.toLowerCase()} energy.`,
    armor:`${prefix} ${base.toLowerCase()} that smells faintly of ${ELEMENTS[element].name.toLowerCase()} weather. Offers ${rarity} protection.`,
    trinket:`A small ${base.toLowerCase()}, ${prefix.toLowerCase()}, said to nudge fate for its wearer.`,
    consumable:`A ${prefix.toLowerCase()} ${base.toLowerCase()} — drink or eat to feel its ${rarity} effects.`,
    material:`Raw crafting material: a ${prefix.toLowerCase()} ${base.toLowerCase()}, useful at the forge.`
  };
  return flavors[type];
}
function itemStats(type, rarity){
  const m = RARITY_MULT[rarity];
  if(type==="weapon") return { attack: Math.round(3*m) };
  if(type==="armor") return { defense: Math.round(2*m), hp: Math.round(4*m) };
  if(type==="trinket"){
    const pool = ["SPEED","STRENGTH","CHARM","SMARTS"];
    const stat = pool[Math.floor(Math.random()*pool.length)];
    return { [stat]: Math.round(1*m), curse: Math.random()<0.15 };
  }
  if(type==="consumable") return { heal: Math.round(10*m), mana: Math.round(5*m) };
  return {}; // material: no combat stats, used in crafting
}
const ITEM_BANK = buildItemBank();
const ITEM_BY_ID = Object.fromEntries(ITEM_BANK.map(i=>[i.id,i]));

/* ---------- procedural enemy bank: 4 regions x 3 difficulties x 10 = 120 ---------- */
const ENEMY_NAME_PARTS = {
  forest:["Bramblefang","Mosshide","Thornback","Glade Sprite","Root Walker","Acorn Golem","Fern Wisp","Vine Serpent","Bark Beetle","Sap Slime"],
  mountains:["Frost Yeti","Gale Hawk","Ice Wraith","Snow Wolf","Cloud Ram","Rime Bat","Windshard","Glacier Troll","Peak Harpy","Chill Sprite"],
  volcano:["Ember Imp","Ash Drake","Magma Crab","Cinder Wolf","Lava Golem","Flare Bat","Coal Fiend","Soot Hound","Sulfur Wisp","Brimstone Ogre"],
  reef:["Coral Crab","Tide Serpent","Bubble Jelly","Pearl Turtle","Riptide Shark","Kelp Wisp","Foam Sprite","Shell Guardian","Abyssal Eel","Barnacle Brute"]
};
const DIFF = {
  easy:{ mult:0.7, xp:[3,6], money:[5,15], lvlOffset:-2 },
  medium:{ mult:1.0, xp:[8,14], money:[15,35], lvlOffset:0 },
  hard:{ mult:1.6, xp:[20,40], money:[40,100], lvlOffset:3 }
};
function buildEnemyBank(){
  const bank = [];
  let id=0;
  for(const region of Object.keys(REGIONS)){
    for(const diff of Object.keys(DIFF)){
      const names = ENEMY_NAME_PARTS[region];
      for(let i=0;i<10;i++){
        const d = DIFF[diff];
        const lvl = Math.max(1, i+1+d.lvlOffset);
        bank.push({
          id:`enm_${id++}`, name:`${names[i]}`, region, difficulty:diff, level:lvl,
          element: REGIONS[region].element,
          hp: Math.round((20 + lvl*8) * d.mult),
          attack: Math.round((3 + lvl*1.5) * d.mult),
          xpReward: Math.round(d.xp[0] + Math.random()*(d.xp[1]-d.xp[0])),
          moneyReward: Math.round(d.money[0] + Math.random()*(d.money[1]-d.money[0])),
          dropChance: diff==="easy"?0.25:diff==="medium"?0.45:0.7
        });
      }
    }
  }
  return bank;
}
const ENEMY_BANK = buildEnemyBank();

/* =========================================================================
   DRAGON DOODLE (2-frame hand-drawn animation)
   Redrawn as one cohesive curled-up dragon (snout, horns, folded wings,
   a spiral tail, closed sleepy eyes, tucked paw) instead of loose floating
   shapes, while keeping the flat pastel hand-drawn look and the 2-frame
   swap-every-second "gif" breathing effect.
   ========================================================================= */
function dragonFrame(breathe){
  const lift = breathe ? -3 : 0;     // whole body rises slightly on the "in-breath" frame
  const INK = "#4A3F35";
  const BODY = "#CDEFC2";
  const BODY_D = "#A9DE9B";
  const BELLY = "#F3FBEE";
  return `
  <!-- curled tail, drawn first so the body overlaps its base -->
  <path d="M266,${178+lift} C298,${186+lift} 320,${164+lift} 313,${134+lift}
           C309,${116+lift} 292,${104+lift} 277,${112+lift}
           C289,${118+lift} 299,${132+lift} 294,${147+lift}
           C290,${160+lift} 278,${168+lift} 264,${170+lift} Z"
        fill="${BODY}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>

  <!-- main curled body -->
  <ellipse cx="190" cy="${172+lift}" rx="112" ry="50" fill="${BODY}" stroke="${INK}" stroke-width="4.5" filter="url(#doodleWobble)"/>

  <!-- folded wings along the spine -->
  <path d="M152,${132+lift} Q145,${106+lift} 163,${99+lift} Q170,${116+lift} 163,${128+lift}
           Q176,${114+lift} 188,${120+lift} Q180,${134+lift} 165,${138+lift} Z"
        fill="${BODY_D}" stroke="${INK}" stroke-width="3" filter="url(#doodleWobble)"/>
  <path d="M206,${130+lift} Q202,${104+lift} 220,${99+lift} Q226,${116+lift} 218,${127+lift}
           Q231,${115+lift} 242,${122+lift} Q233,${135+lift} 219,${138+lift} Z"
        fill="${BODY_D}" stroke="${INK}" stroke-width="3" filter="url(#doodleWobble)"/>

  <!-- spine ridge bumps -->
  <path d="M118,${132+lift} l9,-15 l9,15 Z" fill="${BODY_D}" stroke="${INK}" stroke-width="2"/>
  <path d="M148,${122+lift} l8,-14 l8,14 Z" fill="${BODY_D}" stroke="${INK}" stroke-width="2"/>

  <!-- tucked front paw -->
  <ellipse cx="150" cy="${203+lift}" rx="17" ry="11" fill="${BODY}" stroke="${INK}" stroke-width="3"/>
  <path d="M140,${205+lift} l-4,5 M148,${208+lift} l-2,6 M157,${208+lift} l1,6" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- belly shading -->
  <path d="M108,${196+lift} Q190,${214+lift} 270,${194+lift}" stroke="${BELLY}" stroke-width="10" fill="none" opacity="0.55" stroke-linecap="round"/>

  <!-- neck bridge so head reads as part of the body, not a floating circle -->
  <ellipse cx="132" cy="${158+lift}" rx="38" ry="31" fill="${BODY}" stroke="${INK}" stroke-width="3.5" filter="url(#doodleWobble)"/>

  <!-- head -->
  <ellipse cx="98" cy="${149+lift}" rx="44" ry="37" fill="${BODY}" stroke="${INK}" stroke-width="4.5" filter="url(#doodleWobble)"/>

  <!-- horns -->
  <path d="M84,${116+lift} Q73,${92+lift} 58,${86+lift}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M104,${113+lift} Q99,${88+lift} 87,${79+lift}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>

  <!-- snout -->
  <ellipse cx="60" cy="${159+lift}" rx="25" ry="18" fill="${BODY}" stroke="${INK}" stroke-width="4" filter="url(#doodleWobble)"/>

  <!-- closed sleepy eye -->
  <path d="M72,${138+lift} Q83,${131+lift} 94,${138+lift}" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M92,${137+lift} l7,-4" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- nostril + mouth -->
  <circle cx="42" cy="${161+lift}" r="2.6" fill="${INK}"/>
  <path d="M50,${170+lift} Q62,${176+lift} 74,${170+lift}" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- breath puff, only on the exhale frame -->
  ${breathe ? `
  <circle cx="30" cy="${158}" r="4.5" fill="#FFFFFF" opacity="0.75"/>
  <circle cx="20" cy="151" r="2.8" fill="#FFFFFF" opacity="0.55"/>` : ``}

  <text x="150" y="${68+lift}" font-family="Caveat, cursive" font-size="28" fill="${INK}" opacity="${breathe?1:0.45}">z z z</text>
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
  const el = document.getElementById(`sfx-${name}`);
  if(el){ try{ el.currentTime=0; el.play().catch(()=>{}); }catch(e){} }
}
function playMusic(src){
  const el = musicEl(); if(!el) return;
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
function toast(msg){
  const stack = document.getElementById("toast-stack");
  const t = document.createElement("div");
  t.className="toast"; t.textContent=msg;
  stack.appendChild(t);
  setTimeout(()=>t.remove(), 3500);
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
  settings:{ muteMusic:false, muteSfx:false },
  selArchetype:null, selClass:null,
  invPage:0,
  currentChatPartner:null,
  craftA:null, craftB:null,
  selectedInvItem:null,
  battle:null,
  unsubs:[]
};

/* Player doc must be creatable with NO archetype/class yet (signup happens
   before archetype/class selection), so every lookup below is guarded. */
function defaultPlayerDoc(username, archetype, klass){
  const bonus = (klass && CLASSES[klass]) ? CLASSES[klass].bonus : {};
  const stats = { SPEED:0, STRENGTH:0, CHARM:0, SMARTS:0, ...bonus };
  const boon = (archetype && ELEMENTS[archetype]) ? ELEMENTS[archetype].boon : null;
  const bars = { hp:100, hpMax:100, mana:20, manaMax:20, rage:10, rageMax:10, xp:0, xpMax:10 };
  if(boon==="hp"){ bars.hp=120; bars.hpMax=120; }
  if(boon==="mana"){ bars.mana=26; bars.manaMax=26; }
  if(boon==="rage"){ bars.rage=14; bars.rageMax=14; }
  return {
    username, archetype: archetype||null, klass: klass||null, level:1, money:100,
    stats, ...bars,
    region:"forest",
    inventory: [], // {itemId, qty}
    equipped: { weapon:null, armor:null, trinket:null },
    kills:0, deaths:0, killstreak:0, monstersKilled:0,
    friends: [], createdAt: Date.now()
  };
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
  if(boon==="rage"){ updates.rage=14; updates.rageMax=14; }
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
document.getElementById("authForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const uname = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value;
  const errEl = document.getElementById("authError");
  const submitBtn = document.getElementById("authSubmit");
  errEl.textContent="";
  submitBtn.disabled = true;
  try{
    if(authMode==="signup"){
      const problem = isValidUsername(uname);
      if(problem){ errEl.textContent = problem; return; }
      if(pass.length < 6){ errEl.textContent="Password needs 6+ characters."; return; }

      // reserve the username first so two people can't grab the same one
      const takenSnap = await getDoc(doc(db,"usernames",uname.toLowerCase()));
      if(takenSnap.exists()){ errEl.textContent="That username is taken."; return; }

      let cred;
      try{
        cred = await createUserWithEmailAndPassword(auth, usernameToEmail(uname), pass);
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }

      try{
        const pdoc = defaultPlayerDoc(uname, null, null);
        await setDoc(doc(db,"players",cred.user.uid), pdoc);
        await setDoc(doc(db,"usernames",uname.toLowerCase()), { uid:cred.user.uid });
      }catch(err){
        // roll back the auth account so we don't leave an orphaned login
        // with no matching player document
        try{ await cred.user.delete(); }catch(e2){ /* best effort */ }
        errEl.textContent = "Couldn't finish creating your account. Please try again.";
        return;
      }
      closeModal("authModal");
    } else {
      try{
        await signInWithEmailAndPassword(auth, usernameToEmail(uname), pass);
        closeModal("authModal");
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); }
    }
  } finally {
    submitBtn.disabled = false;
  }
});
document.getElementById("btnLogout").addEventListener("click", async ()=>{
  await withErrorToast(()=> signOut(auth));
  closeModal("settingsModal");
});

onAuthStateChanged(auth, async (user)=>{
  cleanupSubs();
  if(!user){ showScreen("screen-title"); playMusic("rpg_title.mp3"); return; }
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
  state.username = p.username;
  if(!p.archetype || !p.klass){
    showScreen("screen-archetype");
  } else {
    enterGame();
  }
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
function cleanupSubs(){ state.unsubs.forEach(u=>u()); state.unsubs=[]; chatSubbed=false; pmUnsub=null; }

function enterGame(){
  showScreen("screen-game");
  const unsub = onSnapshot(doc(db,"players",state.uid), (snap)=>{
    if(!snap.exists()) return;
    state.profile = snap.data();
    renderHUD();
    if(document.getElementById("journalModal").classList.contains("active")) renderInventory();
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
  subscribeGlobalChat();
  playMusic(REGIONS.forest.track);
}

function renderHUD(){
  const p = state.profile; if(!p) return;
  document.getElementById("hudName").textContent = p.username;
  document.getElementById("hudLevel").textContent = p.level;
  document.getElementById("hudArchetype").textContent = ELEMENTS[p.archetype].name;
  document.getElementById("hudClass").textContent = CLASSES[p.klass].name;
  document.getElementById("hudMoney").textContent = fmtMoney(p.money);
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
}
function setBar(key, val, max){
  const pct = Math.max(0, Math.min(100, (val/max)*100));
  document.getElementById("bar"+key).style.width = pct+"%";
  document.getElementById("num"+key).textContent = `${Math.max(0,Math.round(val))}/${max}`;
}

/* level-up: xp scales by 1.2x rounded down each level */
async function grantXP(amount){
  await withErrorToast(async ()=>{
    let p = state.profile;
    let xp = p.xp + amount;
    let xpMax = p.xpMax;
    let level = p.level;
    let leveled = false;
    while(xp >= xpMax){
      xp -= xpMax;
      xpMax = Math.floor(xpMax*1.2);
      level++;
      leveled = true;
    }
    const updates = { xp, xpMax, level };
    if(leveled){
      updates.hpMax = p.hpMax + 10;
      updates.hp = updates.hpMax;
      updates.manaMax = p.manaMax + 3;
      updates.mana = updates.manaMax;
      playSfx("levelup");
      toast(`Level up! You are now level ${level}.`);
    }
    await updateDoc(doc(db,"players",state.uid), updates);
  });
}
async function grantMoney(amount){
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: Math.max(0, state.profile.money + amount) }));
}

/* =========================================================================
   INVENTORY / EQUIPMENT / JOURNAL
   ========================================================================= */
document.getElementById("btnJournal").addEventListener("click", ()=>{ openModal("journalModal"); renderInventory(); renderLeaderboard("money"); renderQuests(); });
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
  const grid = document.getElementById("invGrid");
  const items = invExpanded();
  const perPage = 12;
  const pages = Math.max(1, Math.ceil(items.length/perPage));
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
  document.getElementById("invPageLabel").textContent = `Page ${state.invPage+1}/${pages}`;
  renderEquipSlots();
}
document.getElementById("invPrev").addEventListener("click", ()=>{ state.invPage=Math.max(0,state.invPage-1); renderInventory(); });
document.getElementById("invNext").addEventListener("click", ()=>{ state.invPage++; renderInventory(); });

function selectInvItem(entry){
  state.selectedInvItem = entry;
  const canEquip = ["weapon","armor","trinket"].includes(entry.item.type);
  const detail = document.getElementById("itemDetail");
  detail.innerHTML = `
    <b>${entry.item.name}</b> <i>(${entry.item.rarity})</i><br>
    ${entry.item.desc}<br>
    <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
      ${canEquip? `<button class="doodle-btn btn-sm btn-blue" id="btnEquip">Equip</button>`:""}
      ${entry.item.type==="consumable"? `<button class="doodle-btn btn-sm btn-green" id="btnUse">Use</button>`:""}
      <button class="doodle-btn btn-sm" id="btnToss">Toss</button>
      <button class="doodle-btn btn-sm btn-yellow" id="btnSell">Sell ($${entry.item.sellPrice})</button>
    </div>`;
  const eq = document.getElementById("btnEquip");
  if(eq) eq.addEventListener("click", ()=> equipItem(entry.item));
  const use = document.getElementById("btnUse");
  if(use) use.addEventListener("click", ()=> useConsumable(entry.item));
  document.getElementById("btnToss").addEventListener("click", ()=> changeInvQty(entry.item.id, -1));
  document.getElementById("btnSell").addEventListener("click", ()=> sellItem(entry.item));
}
async function changeInvQty(itemId, delta){
  return withErrorToast(async ()=>{
    const p = state.profile;
    const inv = [...(p.inventory||[])];
    const idx = inv.findIndex(e=>e.itemId===itemId);
    if(idx<0) return;
    inv[idx] = { ...inv[idx], qty: inv[idx].qty+delta };
    const filtered = inv.filter(e=>e.qty>0);
    await updateDoc(doc(db,"players",state.uid), { inventory: filtered });
  });
}
async function addItemToInv(itemId, qty=1){
  return withErrorToast(async ()=>{
    const p = state.profile;
    const inv = [...(p.inventory||[])];
    const idx = inv.findIndex(e=>e.itemId===itemId);
    if(idx>=0) inv[idx] = { ...inv[idx], qty: inv[idx].qty+qty };
    else inv.push({ itemId, qty });
    await updateDoc(doc(db,"players",state.uid), { inventory: inv });
  });
}
async function sellItem(item){
  await changeInvQty(item.id, -1);
  await grantMoney(item.sellPrice);
  playSfx("sell");
  toast(`Sold ${item.name} for $${item.sellPrice}`);
}
async function equipItem(item){
  const slot = item.type; // weapon/armor/trinket
  const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { [`equipped.${slot}`]: item.id }));
  if(ok!==null) toast(`Equipped ${item.name}`);
}
function renderEquipSlots(){
  const p = state.profile; if(!p) return;
  ["weapon","armor","trinket"].forEach(slot=>{
    const el = document.getElementById("equip"+slot.charAt(0).toUpperCase()+slot.slice(1));
    const itemId = p.equipped?.[slot];
    if(itemId && ITEM_BY_ID[itemId]){
      el.classList.add("filled");
      el.innerHTML = `<span>${ITEM_BY_ID[itemId].name}</span>`;
    } else {
      el.classList.remove("filled");
      el.innerHTML = `<span>${slot[0].toUpperCase()+slot.slice(1)}</span>`;
    }
  });
}
async function useConsumable(item){
  await withErrorToast(async ()=>{
    const p = state.profile;
    const updates = {};
    if(item.stats.heal) updates.hp = Math.min(p.hpMax, p.hp+item.stats.heal);
    if(item.stats.mana) updates.mana = Math.min(p.manaMax, p.mana+item.stats.mana);
    await updateDoc(doc(db,"players",state.uid), updates);
  });
  await changeInvQty(item.id, -1);
  toast(`Used ${item.name}`);
}

/* =========================================================================
   LEADERBOARD + PROFILE BOOK
   ========================================================================= */
document.querySelectorAll(".lb-cat").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".lb-cat").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    renderLeaderboard(b.dataset.cat);
  });
});
async function renderLeaderboard(cat){
  const fieldMap = { money:"money", level:"level", kills:"monstersKilled" };
  const field = fieldMap[cat];
  const list = document.getElementById("lbList");
  list.innerHTML = "<li>Loading…</li>";
  try{
    const q = query(collection(db,"players"), orderBy(field,"desc"), limit(10));
    const snap = await getDocs(q);
    list.innerHTML="";
    snap.forEach((d,i)=>{
      const data = d.data();
      const li = document.createElement("li");
      li.innerHTML = `<span>#${i+1} ${data.username}</span><span>${cat==="money"? "$"+fmtMoney(data[field]||0) : (data[field]||0)}</span>`;
      li.addEventListener("click", ()=> openProfileBook(d.id, data, i+1, cat));
      list.appendChild(li);
    });
    if(list.children.length===0) list.innerHTML="<li>No players yet.</li>";
  }catch(e){ console.error(e); list.innerHTML="<li>Leaderboard unavailable right now.</li>"; }
}
function openProfileBook(uid, data, rank, cat){
  document.getElementById("profileName").textContent = data.username;
  document.getElementById("profileStats").innerHTML = `
    Level ${data.level} ${ELEMENTS[data.archetype]?.name||""} ${CLASSES[data.klass]?.name||""}<br>
    Money: $${fmtMoney(data.money||0)}<br>
    Monsters Killed: ${data.monstersKilled||0}<br>
    PvP Kills: ${data.kills||0} &middot; Deaths: ${data.deaths||0} &middot; Killstreak: ${data.killstreak||0}`;
  document.getElementById("profileRank").textContent = rank? `Ranked #${rank} in ${cat}` : "";
  document.getElementById("btnPM").onclick = ()=>{ closeModal("profileModal"); openPrivateChatWith(uid, data.username); };
  document.getElementById("btnFriendReq").onclick = ()=> sendFriendRequest(uid, data.username);
  openModal("profileModal");
}

/* =========================================================================
   SIDEQUESTS
   ========================================================================= */
async function renderQuests(){
  const list = document.getElementById("questList");
  list.innerHTML="";
  try{
    const q = query(collection(db,"players",state.uid,"quests"), where("expiresAt",">",Date.now()));
    const snap = await getDocs(q);
    snap.forEach(d=>{
      const quest = d.data();
      const li = document.createElement("li");
      li.innerHTML = `<span>${quest.text}</span><button class="doodle-btn btn-sm btn-green">Claim</button>`;
      li.querySelector("button").addEventListener("click", ()=> withErrorToast(async ()=>{
        if(quest.rewardMoney) await grantMoney(quest.rewardMoney);
        if(quest.rewardXP) await grantXP(quest.rewardXP);
        await deleteDoc(doc(db,"players",state.uid,"quests",d.id));
        renderQuests();
      }));
      list.appendChild(li);
    });
    if(list.children.length===0) list.innerHTML="<li>No active sidequests. Defeat monsters to find some!</li>";
  }catch(e){ console.error(e); list.innerHTML="<li>Could not load sidequests.</li>"; }
}
async function maybeSpawnQuest(){
  if(Math.random()>0.3) return;
  await withErrorToast(()=> addDoc(collection(db,"players",state.uid,"quests"), {
    text:`Defeat ${1+Math.floor(Math.random()*3)} monsters in ${REGIONS[state.profile.region].name}`,
    rewardMoney: Math.round(20+Math.random()*80), rewardXP: Math.round(5+Math.random()*10),
    expiresAt: Date.now() + 1000*60*60*6
  }));
}

/* =========================================================================
   COMPASS: MAP / SHOP / CHAT / AUCTION / BATTLE / CRAFT
   ========================================================================= */
document.getElementById("btnCompass").addEventListener("click", ()=>{
  openModal("compassModal"); renderRegionGrid(); renderShop(); renderAuction(); renderCraftInv();
});
document.querySelectorAll("[data-ctab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("[data-ctab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".ctab-page").forEach(p=>p.classList.remove("active"));
    document.getElementById("ctab-"+btn.dataset.ctab).classList.add("active");
    if(btn.dataset.ctab==="chat") ensureChatSubscriptions();
  });
});

/* --- map --- */
function renderRegionGrid(){
  const grid = document.getElementById("regionGrid");
  grid.innerHTML="";
  Object.entries(REGIONS).forEach(([key,r])=>{
    const card = document.createElement("div");
    card.className = `region-card ${r.css}-c` + (state.profile.region===key? " current":"");
    card.innerHTML = `<div style="font-size:30px">${{forest:"🌲",mountains:"⛰️",volcano:"🌋",reef:"🪸"}[key]}</div><div>${r.name}</div>`;
    card.addEventListener("click", async ()=>{
      if(state.profile.region===key) return;
      const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { region:key }));
      if(ok===null) return;
      playMusic(r.track);
      renderRegionGrid(); renderShop();
      toast(`Traveled to ${r.name}`);
    });
    grid.appendChild(card);
  });
}

/* --- shop --- */
function shopItemsForRegion(){
  const p = state.profile;
  const region = REGIONS[p.region];
  const own = ITEM_BANK.filter(i => i.element === region.element);
  const unlocked = Math.min(own.length, 6 + Math.floor(p.level/5));
  return own.slice(0, unlocked);
}
function dailyItem(){
  const day = new Date().toISOString().slice(0,10);
  const seed = [...day].reduce((a,c)=>a+c.charCodeAt(0),0);
  return ITEM_BANK[seed % ITEM_BANK.length];
}
function renderShop(){
  document.getElementById("shopRegionLabel").textContent = `${REGIONS[state.profile.region].name} Shop`;
  const daily = dailyItem();
  document.getElementById("dailyItemBox").innerHTML = `<b>Today's Special:</b> ${daily.name} (${daily.rarity}) — $${daily.price} <button class="doodle-btn btn-sm btn-yellow" id="buyDaily">Buy</button>`;
  document.getElementById("buyDaily").addEventListener("click", ()=> buyItem(daily));
  const grid = document.getElementById("shopGrid");
  grid.innerHTML="";
  shopItemsForRegion().forEach(item=>{
    const cell = document.createElement("div");
    cell.className="shop-cell";
    cell.innerHTML = `<b>${item.name}</b><span>${item.rarity}</span><span>$${item.price}</span><button class="doodle-btn btn-sm btn-green">Buy</button>`;
    cell.querySelector("button").addEventListener("click", ()=> buyItem(item));
    grid.appendChild(cell);
  });
}
async function buyItem(item){
  if(state.profile.money < item.price){ toast("Not enough money!"); return; }
  await grantMoney(-item.price);
  await addItemToInv(item.id, 1);
  playSfx("buy");
  toast(`Bought ${item.name}`);
}

/* =========================================================================
   CHAT
   ========================================================================= */
let chatSubbed = false;
function ensureChatSubscriptions(){
  if(chatSubbed) return; chatSubbed=true;
  subscribeInbox();
  subscribeFriendsAsContacts();
}
function subscribeGlobalChat(){
  const q = query(collection(db,"globalChat"), orderBy("ts","desc"), limit(50));
  const unsub = onSnapshot(q, (snap)=>{
    const log = document.getElementById("chatLogGlobal");
    const rows = [];
    snap.forEach(d=>rows.unshift(d.data()));
    log.innerHTML = rows.map(m=>`
      <div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}">
        <div class="who">${escapeHTML(m.username)}</div>
        <div class="bubble">${escapeHTML(m.text)}</div>
      </div>`).join("");
    log.scrollTop = log.scrollHeight;
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.getElementById("globalChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const input = document.getElementById("globalChatInput");
  const text = moderateChatText(input.value.trim());
  if(!text) return;
  const ok = await withErrorToast(()=> addDoc(collection(db,"globalChat"), { uid:state.uid, username:state.profile.username, text, ts: Date.now() }));
  if(ok!==null) input.value="";
});
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
  list.innerHTML="";
  for(const uid of friendUids){
    try{
      const snap = await getDoc(doc(db,"players",uid));
      if(!snap.exists()) continue;
      const li = document.createElement("li");
      li.textContent = snap.data().username;
      if(state.currentChatPartner?.uid===uid) li.classList.add("active");
      li.addEventListener("click", ()=> openPrivateChatWith(uid, snap.data().username));
      list.appendChild(li);
    }catch(err){ console.error(err); }
  }
}
let pmUnsub = null;
function subscribePrivateThread(){
  if(pmUnsub) pmUnsub();
  if(!state.currentChatPartner) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  const q = query(collection(db,"privateChats",threadId,"messages"), orderBy("ts","asc"), limit(100));
  pmUnsub = onSnapshot(q, snap=>{
    const log = document.getElementById("chatLogPrivate");
    const rows = [];
    snap.forEach(d=>rows.push(d.data()));
    log.innerHTML = rows.map(m=>`
      <div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}">
        <div class="who">${escapeHTML(m.username)}</div>
        <div class="bubble">${escapeHTML(m.text)}</div>
      </div>`).join("");
    log.scrollTop = log.scrollHeight;
  }, (err)=> toast(friendlyFirebaseError(err)));
}
document.getElementById("privateChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!state.currentChatPartner) { toast("Pick a friend to message."); return; }
  const input = document.getElementById("privateChatInput");
  const text = moderateChatText(input.value.trim());
  if(!text) return;
  const threadId = pmThreadId(state.uid, state.currentChatPartner.uid);
  const ok = await withErrorToast(()=> addDoc(collection(db,"privateChats",threadId,"messages"), { uid:state.uid, username:state.profile.username, text, ts:Date.now() }));
  if(ok!==null) input.value="";
});
/* Friend requests / accept notifications only ever write to the CURRENT
   user's own player doc — never to another player's — because the
   Firestore rules (correctly) forbid writing someone else's document.
   The other side of the handshake is applied by the OTHER player's own
   client, triggered by an inbox notification only they can read. */
async function sendFriendRequest(uid, username){
  const ok = await withErrorToast(()=> addDoc(collection(db,"players",uid,"inbox"), {
    type:"friend_request", fromUid: state.uid, fromUsername: state.profile.username, ts: Date.now()
  }));
  if(ok!==null) toast(`Friend request sent to ${username}`);
}
function subscribeInbox(){
  const q = query(collection(db,"players",state.uid,"inbox"), orderBy("ts","desc"));
  const unsub = onSnapshot(q, snap=>{
    const list = document.getElementById("inboxList");
    list.innerHTML="";
    snap.forEach(d=>{
      const n = d.data();
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
        li.querySelector('[data-a="decline"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="friend_accept"){
        li.innerHTML = `<span>${escapeHTML(n.byUsername)} accepted your friend request!</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          await updateDoc(doc(db,"players",state.uid), { friends: arrayUnion(n.byUid) });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
      } else if(n.type==="auction_sold"){
        li.innerHTML = `<span>Your ${escapeHTML(n.itemName)} sold for $${n.amount}!</span><button class="doodle-btn btn-sm" data-a="ok">OK</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(async ()=>{
          // the money is credited HERE, by the seller's own client, on
          // their own document — never written by the buyer directly.
          await updateDoc(doc(db,"players",state.uid), { money: state.profile.money + n.amount });
          await deleteDoc(doc(db,"players",state.uid,"inbox",d.id));
        }));
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
function renderAuction(){
  const q = query(collection(db,"auction"), where("status","==","active"), orderBy("postedAt","desc"), limit(40));
  const unsub = onSnapshot(q, snap=>{
    const grid = document.getElementById("auctionGrid");
    grid.innerHTML="";
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.expiresAt < Date.now()) return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      const cell = document.createElement("div");
      cell.className = "inv-cell rarity-"+item.rarity;
      const mins = Math.max(0, Math.round((listing.expiresAt-Date.now())/60000));
      cell.title = `Posted by ${listing.sellerName} — ${mins}m left`;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><div style="font-size:11px">$${listing.pricePer} ea</div>`;
      if(listing.sellerUid !== state.uid){
        cell.addEventListener("click", ()=> buyAuctionListing(d.id, listing, item));
      }
      grid.appendChild(cell);
    });
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
async function buyAuctionListing(listingId, listing, item){
  const totalCost = listing.pricePer * listing.qty;
  if(state.profile.money < totalCost){ toast("Not enough money!"); return; }
  const bought = await withErrorToast(async ()=>{
    await runTransaction(db, async (tx)=>{
      const lref = doc(db,"auction",listingId);
      const lsnap = await tx.get(lref);
      if(!lsnap.exists() || lsnap.data().status !== "active") throw new Error("gone");
      // buyer marks it sold (allowed by rules) instead of deleting a
      // listing they don't own; buyer also debits their OWN money here
      tx.update(lref, { status:"sold", buyerUid: state.uid, soldAt: Date.now() });
      tx.update(doc(db,"players",state.uid), { money: state.profile.money - totalCost });
    });
    return true;
  });
  if(!bought) { toast("That listing is no longer available."); return; }
  await addItemToInv(item.id, listing.qty);
  // seller credits themselves from this notification — see subscribeInbox()
  await withErrorToast(()=> addDoc(collection(db,"players",listing.sellerUid,"inbox"), {
    type:"auction_sold", itemName:item.name, amount: totalCost, ts: Date.now()
  }));
  playSfx("buy");
  toast(`Bought ${item.name} x${listing.qty}`);
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
  const price = Number(document.getElementById("postPrice").value)||0;
  document.getElementById("postTotalLabel").textContent = `Total: $${qty*price}`;
}
document.getElementById("postQty").addEventListener("input", updatePostTotal);
document.getElementById("postPrice").addEventListener("input", updatePostTotal);
document.getElementById("btnPostAuction").addEventListener("click", async ()=>{
  const itemId = document.getElementById("postItemSelect").value;
  const qty = Number(document.getElementById("postQty").value);
  const price = Number(document.getElementById("postPrice").value);
  if(!itemId || qty<1 || price<1){ toast("Enter a valid quantity and price."); return; }
  try{
    const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid), where("status","==","active")));
    if(mySnap.size >= 5){ toast("You can only have 5 auction slots."); return; }
  }catch(err){ toast(friendlyFirebaseError(err)); return; }
  const entry = invExpanded().find(e=>e.itemId===itemId);
  if(!entry || entry.qty < qty){ toast("You don't have that many."); return; }
  await changeInvQty(itemId, -qty);
  const ok = await withErrorToast(()=> addDoc(collection(db,"auction"), {
    sellerUid: state.uid, sellerName: state.profile.username, itemId, qty, pricePer: price,
    status:"active", postedAt: Date.now(), expiresAt: Date.now() + 1000*60*60*24
  }));
  if(ok===null){ await addItemToInv(itemId, qty); return; } // roll back on failure
  toast("Posted to auction house!");
  populatePostForm();
});
async function renderMySlots(){
  try{
    const q = query(collection(db,"auction"), where("sellerUid","==",state.uid), where("status","==","active"));
    const snap = await getDocs(q);
    const grid = document.getElementById("myAuctionSlots");
    grid.innerHTML="";
    snap.forEach(d=>{
      const listing = d.data();
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      const cell = document.createElement("div");
      cell.className="inv-cell rarity-"+item.rarity;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><button class="doodle-btn btn-sm" style="margin-top:4px">Cancel</button>`;
      cell.querySelector("button").addEventListener("click", async (ev)=>{
        ev.stopPropagation();
        const ok = await withErrorToast(()=> deleteDoc(doc(db,"auction",d.id)));
        if(ok===null) return;
        await addItemToInv(item.id, listing.qty);
        renderMySlots();
      });
      grid.appendChild(cell);
    });
  }catch(err){ toast(friendlyFirebaseError(err)); }
}

/* --- crafting --- */
function renderCraftInv(){
  const grid = document.getElementById("craftInvGrid");
  grid.innerHTML="";
  invExpanded().forEach(e=>{
    const cell = document.createElement("div");
    cell.className="inv-cell rarity-"+e.item.rarity;
    cell.innerHTML = `<div>${e.item.name}</div><span class="qty-badge">x${e.qty}</span>`;
    cell.addEventListener("click", ()=> assignCraftSlot(e));
    grid.appendChild(cell);
  });
}
function assignCraftSlot(entry){
  if(!state.craftA){ state.craftA = entry; document.getElementById("craftSlotA").textContent = entry.item.name; document.getElementById("craftSlotA").classList.add("filled"); }
  else if(!state.craftB){ state.craftB = entry; document.getElementById("craftSlotB").textContent = entry.item.name; document.getElementById("craftSlotB").classList.add("filled"); }
  previewCraftResult();
}
document.querySelectorAll(".craft-slot[data-craft]").forEach(slot=>{
  slot.addEventListener("click", ()=>{
    if(slot.dataset.craft==="A"){ state.craftA=null; slot.textContent="Slot A"; slot.classList.remove("filled"); }
    else { state.craftB=null; slot.textContent="Slot B"; slot.classList.remove("filled"); }
    previewCraftResult();
  });
});
function previewCraftResult(){
  const result = document.getElementById("craftResult");
  result.textContent = (state.craftA && state.craftB) ? "Ready to craft!" : "?";
}
document.getElementById("btnCraft").addEventListener("click", async ()=>{
  if(!state.craftA || !state.craftB){ toast("Choose two items first."); return; }
  const a = state.craftA.item, b = state.craftB.item;
  let resultItem;
  if(a.type==="material" && b.type!=="material") resultItem = upgradeItem(b);
  else if(b.type==="material" && a.type!=="material") resultItem = upgradeItem(a);
  else {
    const pool = ITEM_BANK.filter(i=> i.type===(a.type==="material"?"material":a.type));
    resultItem = pool[Math.floor(Math.random()*pool.length)];
  }
  await changeInvQty(a.id, -1);
  await changeInvQty(b.id, -1);
  await addItemToInv(resultItem.id, 1);
  toast(`Crafted ${resultItem.name}!`);
  state.craftA=null; state.craftB=null;
  document.getElementById("craftSlotA").textContent="Slot A"; document.getElementById("craftSlotA").classList.remove("filled");
  document.getElementById("craftSlotB").textContent="Slot B"; document.getElementById("craftSlotB").classList.remove("filled");
  previewCraftResult();
  renderCraftInv();
});
function upgradeItem(item){
  const idx = RARITIES.indexOf(item.rarity);
  const nextRarity = RARITIES[Math.min(RARITIES.length-1, idx+1)];
  return ITEM_BANK.find(i=>i.type===item.type && i.rarity===nextRarity) || item;
}

/* =========================================================================
   BATTLE: PvE
   ========================================================================= */
document.getElementById("btnFightEasy").addEventListener("click", ()=> startPvE("easy"));
document.getElementById("btnFightMedium").addEventListener("click", ()=> startPvE("medium"));
document.getElementById("btnFightHard").addEventListener("click", ()=> startPvE("hard"));

function pickEnemy(difficulty){
  const pool = ENEMY_BANK.filter(e=>e.region===state.profile.region && e.difficulty===difficulty);
  return pool[Math.floor(Math.random()*pool.length)];
}
function playerAttackPower(){
  const p = state.profile;
  const weapon = p.equipped.weapon && ITEM_BY_ID[p.equipped.weapon];
  return 4 + p.stats.STRENGTH*1.5 + p.stats.SMARTS + (weapon?.stats.attack||0);
}
function playerDefense(){
  const p = state.profile;
  const armor = p.equipped.armor && ITEM_BY_ID[p.equipped.armor];
  return (armor?.stats.defense||0);
}
function startPvE(difficulty){
  const enemy = pickEnemy(difficulty);
  if(!enemy){ toast("No enemies found here."); return; }
  state.battle = {
    mode:"pve", difficulty,
    enemy: { ...enemy, curHp: enemy.hp },
    playerHp: state.profile.hp,
    stamina: 4, rage: state.profile.rage, rageMax: state.profile.rageMax,
    log: [`A wild ${enemy.name} (Lv.${enemy.level}) appears!`]
  };
  closeModal("compassModal");
  openBattleModal();
}
function openBattleModal(){
  renderBattle();
  openModal("battleModal");
}
function battleLogPush(msg){
  state.battle.log.push(msg);
  const el = document.getElementById("battleLog");
  el.innerHTML = state.battle.log.slice(-30).map(m=>`<div>${m}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}
function renderBattle(){
  const b = state.battle;
  document.getElementById("battleEnemyName").textContent = `${b.enemy.name} Lv.${b.enemy.level}`;
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,b.enemy.curHp)/b.enemy.hp)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,b.enemy.curHp)}/${b.enemy.hp}`;
  document.getElementById("battlePlayerName").textContent = state.profile.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,b.playerHp)/state.profile.hpMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,b.playerHp)}/${state.profile.hpMax}`;
  document.getElementById("battleStaminaLabel").textContent = `${b.stamina} (${Math.floor(b.stamina/4)} moves)`;
  document.getElementById("battleRageLabel").textContent = `${b.rage}/${b.rageMax}`;
  document.getElementById("btnPowerAttack").disabled = b.rage < b.rageMax;
  document.getElementById("battleLog").innerHTML = b.log.slice(-30).map(m=>`<div>${m}</div>`).join("");

  const actions = document.getElementById("battleActions");
  actions.innerHTML="";
  const attackBtn = document.createElement("button");
  attackBtn.className="doodle-btn btn-sm btn-pink"; attackBtn.textContent="Attack";
  attackBtn.disabled = b.stamina<4;
  attackBtn.addEventListener("click", ()=> playerAttack(false));
  actions.appendChild(attackBtn);

  invExpanded().filter(e=>e.item.type==="consumable").slice(0,4).forEach(e=>{
    const btn = document.createElement("button");
    btn.className="doodle-btn btn-sm btn-green"; btn.textContent=`Use ${e.item.name}`;
    btn.disabled = b.stamina<4;
    btn.addEventListener("click", ()=> useItemInBattle(e.item));
    actions.appendChild(btn);
  });
}
async function playerAttack(power){
  const b = state.battle;
  if(!b || b.stamina<4) return;
  if(power && b.rage < b.rageMax) return;
  let dmg = Math.round(playerAttackPower() * (power?2:1) * (0.85+Math.random()*0.3));
  b.enemy.curHp -= dmg;
  b.stamina -= 4;
  b.rage = power ? 0 : Math.min(b.rageMax, b.rage + Math.round(dmg*0.15)+1);
  battleLogPush(`You hit ${b.enemy.name} for ${dmg} damage${power?" (POWER ATTACK!)":""}.`);
  playSfx("attack");
  if(b.enemy.curHp<=0){ await winBattle(); return; }
  renderBattle();
}
document.getElementById("btnPowerAttack").addEventListener("click", ()=> playerAttack(true));
async function useItemInBattle(item){
  const b = state.battle;
  if(!b || b.stamina<4) return;
  if(item.stats.heal) b.playerHp = Math.min(state.profile.hpMax, b.playerHp+item.stats.heal);
  b.stamina -= 4;
  battleLogPush(`You use ${item.name}.`);
  await changeInvQty(item.id, -1);
  if(b.enemy.curHp>0){ enemyTurnIfNeeded(); }
  renderBattle();
}
document.getElementById("btnEndTurn").addEventListener("click", ()=> enemyTurnIfNeeded());
function enemyTurnIfNeeded(){
  const b = state.battle;
  if(!b) return;
  const dmg = Math.round(Math.max(1, b.enemy.attack - playerDefense()) * (0.8+Math.random()*0.4));
  b.playerHp -= dmg;
  battleLogPush(`${b.enemy.name} hits you for ${dmg} damage.`);
  playSfx("attack");
  b.stamina = 4;
  if(b.playerHp<=0){ loseBattle(); return; }
  renderBattle();
}
async function winBattle(){
  const b = state.battle;
  battleLogPush(`You defeated ${b.enemy.name}!`);
  await grantXP(b.enemy.xpReward);
  await grantMoney(b.enemy.moneyReward);
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    hp: Math.max(1,b.playerHp), rage: b.rage, monstersKilled: (state.profile.monstersKilled||0)+1
  }));
  if(Math.random() < b.enemy.dropChance){
    const pool = ITEM_BANK.filter(i=>i.element===b.enemy.element);
    const drop = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(drop.id,1);
    battleLogPush(`You found ${drop.name}!`);
  }
  await maybeSpawnQuest();
  toast(`Victory! +${b.enemy.xpReward} XP, +$${b.enemy.moneyReward}`);
  setTimeout(()=>{ closeModal("battleModal"); state.battle=null; }, 1400);
}
async function loseBattle(){
  const b = state.battle;
  battleLogPush(`You were defeated by ${b.enemy.name}...`);
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp: 1, rage: 0 }));
  toast("You were defeated! Rest up and try again.");
  setTimeout(()=>{ closeModal("battleModal"); state.battle=null; }, 1400);
}

/* --- duel (challenge a friend) --- */
document.getElementById("btnFightFriend").addEventListener("click", renderDuelPanel);
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
      <span id="queueTimerLabel"></span>
    </div>
    <div id="roomStatus" style="margin-top:8px;"></div>`;
  document.getElementById("btnStartRoom").addEventListener("click", startDuelRoom);
  document.getElementById("btnJoinRoom").addEventListener("click", ()=>{
    const code = document.getElementById("joinCodeInput").value.trim();
    joinDuelRoom(code);
  });
  document.getElementById("btnJoinQueue").addEventListener("click", joinQueue);
}
function randCode(){ return String(Math.floor(10000+Math.random()*90000)); }
let roomUnsub=null, queueInterval=null;
async function startDuelRoom(){
  const code = randCode();
  const ok = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
    hostUid: state.uid, hostName: state.profile.username, guestUid:null, guestName:null, status:"waiting", createdAt: Date.now()
  }));
  if(ok===null) return;
  document.getElementById("roomStatus").textContent = `Room code: ${code} — waiting for opponent…`;
  if(roomUnsub) roomUnsub();
  roomUnsub = onSnapshot(doc(db,"duelRooms",code), snap=>{
    if(!snap.exists()){ document.getElementById("roomStatus").textContent="Room closed."; return; }
    const d = snap.data();
    if(d.status==="ready") document.getElementById("roomStatus").textContent = `${d.guestName} joined! (Full live-synced PvP battle logic isn't wired up in this build — see the notes on extending the PvE combat loop with the opponent's live stats.)`;
  }, (err)=> toast(friendlyFirebaseError(err)));
}
async function joinDuelRoom(code){
  if(!/^\d{5}$/.test(code)){ toast("Enter a valid 5-digit code."); return; }
  const rref = doc(db,"duelRooms",code);
  try{
    const snap = await getDoc(rref);
    if(!snap.exists() || snap.data().status!=="waiting"){ toast("Room not found or full."); return; }
    await updateDoc(rref, { guestUid: state.uid, guestName: state.profile.username, status:"ready" });
    document.getElementById("roomStatus").textContent = "Joined! Waiting for host to start.";
  }catch(err){ toast(friendlyFirebaseError(err)); }
}
function joinQueue(){
  toast("Searching for an opponent…");
  let seconds=0;
  clearInterval(queueInterval);
  queueInterval = setInterval(()=>{
    seconds++;
    const label = document.getElementById("queueTimerLabel");
    if(label) label.textContent = ` ${Math.floor(seconds/60)}m ${seconds%60}s`;
  },1000);
  // NOTE: production queue-matching belongs in a Cloud Function that pairs
  // two `queue/{uid}` docs atomically; this client only starts the timer/UI.
  withErrorToast(()=> setDoc(doc(db,"queue",state.uid), { username: state.profile.username, joinedAt: Date.now() }));
}

/* =========================================================================
   SETTINGS
   ========================================================================= */
document.getElementById("btnSettings").addEventListener("click", ()=> openModal("settingsModal"));
document.getElementById("muteMusic").addEventListener("change", (e)=>{ state.settings.muteMusic=e.target.checked; if(e.target.checked) musicEl().pause(); else musicEl().play().catch(()=>{}); });
document.getElementById("muteSfx").addEventListener("change", (e)=>{ state.settings.muteSfx=e.target.checked; });
document.getElementById("btnAccountBack").addEventListener("click", ()=> openModal("settingsModal"));

/* =========================================================================
   GLOBAL HOVER/CLICK SFX
   ========================================================================= */
document.addEventListener("mouseover", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("hover"); });
document.addEventListener("click", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("click"); });

/* =========================================================================
   BOOT
   ========================================================================= */
setupDragonAnim();
setTimeout(()=>{ showScreen("screen-title"); document.getElementById("screen-loading").classList.remove("active"); }, 900);

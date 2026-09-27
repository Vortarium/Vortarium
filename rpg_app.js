/* =========================================================================
   DRAGONEER — rpg_app.js
   Firebase-backed multiplayer doodle RPG.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence,
  deleteUser, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, collection,
  addDoc, query, where, orderBy, limit, runTransaction, deleteDoc, arrayUnion, arrayRemove,
  increment, serverTimestamp
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
/* TEMP DEBUG SWITCH — set to false once auth/signup is confirmed working.
   While true, every Firebase error shown to the player (and logged) is the
   raw {code, message} instead of a friendly string, so nothing is hidden
   during debugging. */
const DEBUG_AUTH_ERRORS = true;

function friendlyFirebaseError(err){
  console.error("FIREBASE ERROR:", err?.code, err?.message, err);
  const code = err?.code || "";
  if(DEBUG_AUTH_ERRORS){
    return `[DEBUG] ${code || "unknown-code"}: ${err?.message || String(err)}`;
  }
  // NOTE: order matters here. "auth/user-not-found" and
  // "auth/configuration-not-found" both contain the substring "not-found",
  // so the generic not-found check MUST come after every specific code
  // that also happens to contain "not-found" — otherwise it shadows them
  // and every one of those errors gets mislabeled as "That no longer
  // exists.", which is exactly what was happening here.
  if(code.includes("permission-denied")) return `That action isn't allowed. (${code})`;
  if(code.includes("unavailable") || code.includes("network")) return "Connection problem — check your internet and try again.";
  if(code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong username or password.";
  if(code.includes("user-not-found")) return "No account with that username.";
  if(code.includes("email-already-in-use")) return "That username is taken.";
  if(code.includes("weak-password")) return "Password needs 6+ characters.";
  if(code.includes("invalid-email")) return `That username isn't valid. (${code})`;
  if(code.includes("configuration-not-found") || code.includes("operation-not-allowed")){
    return `Sign-in isn't configured correctly yet. (${code}) — enable Email/Password sign-in for this project in the Firebase console.`;
  }
  if(code.includes("not-found")) return `That no longer exists. (${code})`;
  // Fallback: never swallow the real reason. Show the raw code/message so
  // this is debuggable instead of a dead-end "Something went wrong."
  return `Something went wrong${code ? ` (${code})` : ""}: ${err?.message || err}`;
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
      if(type==="armor") item.armorSlot = ARMOR_SLOT_BY_NAME[base] || "chestplate";
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
JOB_ITEM_BANK.forEach(i=> ITEM_BY_ID[i.id]=i);

/* ---------- placeable building items for the open world ---------- */
const BUILD_ITEM_BANK = [
  { id:"build_bench", name:"Wooden Bench", type:"material", rarity:"common", price:40, sellPrice:8, desc:"Place it to mark a spot as yours.", stats:{}, placeable:true, buildType:"bench" },
  { id:"build_fence", name:"Fence Post", type:"material", rarity:"common", price:20, sellPrice:5, desc:"Mark out territory.", stats:{}, placeable:true, buildType:"fence" },
  { id:"build_bed", name:"Cozy Bed", type:"material", rarity:"uncommon", price:150, sellPrice:20, desc:"Place it and you'll respawn there instead of your spawn point.", stats:{}, placeable:true, buildType:"bed" },
  { id:"build_home", name:"Small Home Kit", type:"material", rarity:"rare", price:500, sellPrice:60, desc:"A tiny house frame you can build on your land.", stats:{}, placeable:true, buildType:"home" },
  { id:"build_guard", name:"Guard Post", type:"material", rarity:"uncommon", price:200, sellPrice:25, desc:"Warns off wandering monsters that wander too close.", stats:{}, placeable:true, buildType:"guard" }
];
BUILD_ITEM_BANK.forEach(i=> ITEM_BY_ID[i.id]=i);
document.getElementById("buildShelf").insertAdjacentHTML("beforeend",
  BUILD_ITEM_BANK.map(i=>`<button class="doodle-btn btn-sm btn-green" data-buy-build="${i.id}">Buy ${i.name} ($${i.price})</button>`).join(" ")
);
document.querySelectorAll("[data-buy-build]").forEach(btn=>{
  btn.addEventListener("click", ()=> buyItem(ITEM_BY_ID[btn.dataset.buyBuild]));
});

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
  pmContactsExtra:{},     // uid -> username for people you've PM'd who aren't (yet) friends
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
    equipped: { weapon:null, helmet:null, chestplate:null, leggings:null, boots:null, trinket:null },
    kills:0, deaths:0, killstreak:0, monstersKilled:0,
    friends: [], sentFriendRequests: [], createdAt: Date.now(),
    lastHpRegenTs: Date.now(), // used to catch up 10hp/hour regen even while the game was closed
    lastManaRegenTs: Date.now(), // used to catch up 1 mana/minute regen
    lastForageTs: 0, mineHourStart: 0, minePicksThisHour: 0, fishingXp: 0, miningXp: 0, foragingXp: 0
  };
}
const HP_REGEN_PER_HOUR = 10;
const HP_REGEN_MS = 60*60*1000;
const MANA_REGEN_MS = 60*1000; // 1 mana per minute
async function catchUpManaRegen(p){
  if(!p || p.mana >= p.manaMax){
    if(p && p.lastManaRegenTs && Date.now()-p.lastManaRegenTs >= MANA_REGEN_MS){
      await updateDoc(doc(db,"players",state.uid), { lastManaRegenTs: Date.now() }).catch(()=>{});
    }
    return;
  }
  const last = p.lastManaRegenTs || p.createdAt || Date.now();
  const ticks = Math.floor((Date.now()-last)/MANA_REGEN_MS);
  if(ticks <= 0) return;
  const newMana = Math.min(p.manaMax, p.mana + ticks);
  const newTs = last + ticks*MANA_REGEN_MS;
  await updateDoc(doc(db,"players",state.uid), { mana:newMana, lastManaRegenTs:newTs }).catch(()=>{});
}
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
async function loadPlayerAndRoute(user){
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
      if(pass.length < 6){ errEl.textContent="Password needs 6+ characters."; return; }

      // reserve the username first so two people can't grab the same one
      let takenSnap;
      try{
        takenSnap = await getDoc(doc(db,"usernames",uname.toLowerCase()));
      }catch(err){ errEl.textContent = friendlyFirebaseError(err); return; }
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
    const inboxSnap = await getDocs(collection(db,"players",state.uid,"inbox"));
    for(const d of inboxSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db,"players",state.uid));
    await deleteDoc(doc(db,"usernames",state.username.toLowerCase())).catch(()=>{});

    await deleteUser(auth.currentUser);
    toast("Your account has been deleted.");
    closeModal("settingsModal");
    cleanupSubs();
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
function cleanupSubs(){
  state.unsubs.forEach(u=>u()); state.unsubs=[]; chatSubbed=false; pmUnsub=null;
  if(auctionUnsub){ auctionUnsub(); auctionUnsub=null; }
  if(worldUnsubAll) worldUnsubAll();
  if(state.hpRegenInterval){ clearInterval(state.hpRegenInterval); state.hpRegenInterval=null; }
}

function enterGame(){
  showScreen("screen-game");
  let firstSnapshot = true;
  const unsub = onSnapshot(doc(db,"players",state.uid), (snap)=>{
    if(!snap.exists()) return;
    const prevRegion = state.profile?.region;
    state.profile = snap.data();
    renderHUD();
    if(document.getElementById("journalModal").classList.contains("active")) renderInventory();
    // Keep music in sync with whatever region is actually on the player
    // doc — on first load (including re-signing in mid-session) and any
    // time the region field itself changes, not just on manual travel.
    if(firstSnapshot || state.profile.region !== prevRegion){
      const r = REGIONS[state.profile.region] || REGIONS.forest;
      playMusic(r.track);
    }
    if(firstSnapshot){
      catchUpHpRegen(state.profile); // pick up hours missed while the game was closed
      catchUpManaRegen(state.profile);
      ensureSpawnPoint().then(pos=> initWorld(pos));
    }
    firstSnapshot = false;
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
  subscribeGlobalChat();
  if(state.hpRegenInterval) clearInterval(state.hpRegenInterval);
  // Re-check every minute while the tab is open so regen still lands on
  // the hour even without a reload; catchUpHpRegen itself no-ops unless a
  // full hour has actually elapsed.
  state.hpRegenInterval = setInterval(()=>{ catchUpHpRegen(state.profile); catchUpManaRegen(state.profile); }, 60*1000);
}
// Every account gets a random permanent spawn point the first time it
// enters the open world (existing accounts from before this update get
// one lazily assigned here too), between -10000..10000 on both axes.
// Returns the coordinates to actually start at, so initWorld() never has
// to guess whether state.profile has caught up with this write yet.
async function ensureSpawnPoint(){
  const p = state.profile;
  if(p.spawnX!=null && p.spawnY!=null && p.x!=null && p.y!=null){
    return { x:p.x, y:p.y };
  }
  const spawnX = Math.floor(Math.random()*20001)-10000;
  const spawnY = Math.floor(Math.random()*20001)-10000;
  const x = p.x ?? spawnX, y = p.y ?? spawnY;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { spawnX, spawnY, x, y }));
  return { x, y };
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
  renderHotbar();
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
      playSfx("levelup");
      toast(`Level up! You are now level ${level} (+${levelsGained} skill point${levelsGained>1?"s":""}).`);
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
  document.getElementById("btnToss").addEventListener("click", async ()=>{
    await changeInvQty(entry.item.id, -1);
    afterInvChangeRefreshDetail(entry.item.id);
  });
  document.getElementById("btnSell").addEventListener("click", async ()=>{
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
async function applyInvChanges({remove=[], add=[]}={}){
  return withErrorToast(async ()=>{
    const p = state.profile;
    const inv = (p.inventory||[]).map(e=>({...e}));
    for(const {itemId, qty} of remove){
      const idx = inv.findIndex(e=>e.itemId===itemId);
      if(idx>=0) inv[idx].qty -= qty;
    }
    for(const {itemId, qty} of add){
      const idx = inv.findIndex(e=>e.itemId===itemId);
      if(idx>=0) inv[idx].qty += qty;
      else inv.push({ itemId, qty });
    }
    await updateDoc(doc(db,"players",state.uid), { inventory: inv.filter(e=>e.qty>0) });
  });
}
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
  toast(`Sold ${item.name} for $${item.sellPrice}`);
}
async function equipItem(item){
  const slot = item.type==="armor" ? item.armorSlot : item.type; // weapon/helmet/chestplate/leggings/boots/trinket
  const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { [`equipped.${slot}`]: item.id }));
  if(ok!==null) toast(`Equipped ${item.name}`);
}
async function unequipItem(slot){
  const p = state.profile;
  const itemId = p.equipped?.[slot];
  if(!itemId) return;
  const ok = await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { [`equipped.${slot}`]: null }));
  if(ok!==null) toast(`Unequipped ${ITEM_BY_ID[itemId]?.name||"item"}`);
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
async function useConsumable(item){
  // Guard against using a stack you no longer actually hold (stale button
  // from before a re-render, or spam-clicking past the last one).
  const have = (state.profile.inventory||[]).find(e=>e.itemId===item.id);
  if(!have || have.qty<=0){
    toast(`You don't have any ${item.name} left.`);
    afterInvChangeRefreshDetail(item.id);
    return;
  }
  await withErrorToast(async ()=>{
    const p = state.profile;
    const updates = {};
    if(item.stats.heal) updates.hp = Math.min(p.hpMax, p.hp+item.stats.heal);
    if(item.stats.mana) updates.mana = Math.min(p.manaMax, p.mana+item.stats.mana);
    await updateDoc(doc(db,"players",state.uid), updates);
  });
  await changeInvQty(item.id, -1);
  toast(`Used ${item.name}`);
  afterInvChangeRefreshDetail(item.id);
}

/* =========================================================================
   LEADERBOARD + PROFILE BOOK
   ========================================================================= */
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
async function renderLeaderboard(cat){
  const fieldMap = { money:"money", level:"level", kills:"monstersKilled", pvpkills:"kills", deaths:"deaths" };
  const field = fieldMap[cat];
  const list = document.getElementById("lbList");
  list.innerHTML = "<li>Loading…</li>";
  try{
    // fetch extra and filter out banned users client-side, since older
    // player docs don't have a `banned` field for a where() filter to key on
    const q = query(collection(db,"players"), orderBy(field,"desc"), limit(30));
    const snap = await getDocs(q);
    list.innerHTML="";
    let rank = 0;
    snap.docs.filter(d=>!d.data().banned).slice(0,10).forEach((d)=>{
      rank++;
      const data = d.data();
      const li = document.createElement("li");
      li.innerHTML = `<span>#${rank} ${data.username}</span><span>${cat==="money"? "$"+fmtMoney(data[field]||0) : (data[field]||0)}</span>`;
      li.addEventListener("click", ()=> openProfileBook(d.id, data, rank, cat));
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
    PvP Kills: ${data.kills||0} &middot; Deaths: ${data.deaths||0} &middot; Killstreak: ${data.killstreak||0}<br>
    Friends: ${(data.friends||[]).length} &middot; Followers: <span id="profileFollowerCount">…</span>`;
  document.getElementById("profileRank").textContent = rank? `Ranked #${rank} in ${cat}` : "";
  // Followers = friends + people who have a pending friend request out to
  // this player (i.e. anyone whose own sentFriendRequests contains them).
  computeFollowerCount(uid, (data.friends||[]).length).then(count=>{
    const el = document.getElementById("profileFollowerCount");
    if(el) el.textContent = count;
  });

  const pmBtn = document.getElementById("btnPM");
  const friendBtn = document.getElementById("btnFriendReq");
  const banBtn = document.getElementById("btnBanUser");
  const isSelf = uid === state.uid;
  pmBtn.style.display = isSelf ? "none" : "";
  friendBtn.style.display = isSelf ? "none" : "";
  banBtn.style.display = (!isSelf && isAdminUI()) ? "" : "none";
  if(!isSelf && isAdminUI()){
    banBtn.onclick = ()=> banUser(uid, data.username);
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
  if(!confirm(`Ban ${username}? This scrubs their name everywhere and cannot be undone from here.`)) return;
  const bannedName = `banneduser_${Math.floor(10000 + Math.random()*90000)}`;
  const ok = await withErrorToast(async ()=>{
    await updateDoc(doc(db,"players",uid), { username: bannedName, banned:true });
    const gcSnap = await getDocs(query(collection(db,"globalChat"), where("uid","==",uid)));
    for(const d of gcSnap.docs) await deleteDoc(d.ref);
  });
  if(ok!==null){ toast(`${username} has been banned.`); closeModal("profileModal"); }
}

/* =========================================================================
   SIDEQUESTS — 3 slots (Tier I / II / III), 12h / 24h / 3-day reroll while
   unaccepted, 24h to complete once accepted, and the same 24h also gates
   the slot's refill (accepting locks the slot for exactly that window).
   ========================================================================= */
const QUEST_TIERS = ["I","II","III"];
const QUEST_TIER_PERIOD_MS = { I:12*3600*1000, II:24*3600*1000, III:3*24*3600*1000 };
const QUEST_ACCEPT_WINDOW_MS = 24*3600*1000;
const QUEST_MATERIAL_IDS = ITEM_BANK.filter(i=>i.type==="material").map(i=>i.id)
  .concat(["ore_copper","ore_iron","gem_quartz","gem_ruby","forage_herb","forage_mushroom"]);
const QUEST_TEMPLATES = [
  (rnd, tier) => {
    const itemId = QUEST_MATERIAL_IDS[Math.floor(rnd()*QUEST_MATERIAL_IDS.length)];
    const item = ITEM_BY_ID[itemId];
    const target = { I:3, II:6, III:12 }[tier] + Math.floor(rnd()*4);
    return {
      type:"gather", itemId, target,
      label:`Gather ${target}x ${item.name}`,
      moneyReward: Math.round(target * (8+rnd()*6) * {I:1,II:1.6,III:2.4}[tier])
    };
  },
  (rnd, tier) => {
    const target = Math.round({ I:60, II:150, III:400 }[tier] + rnd()*100);
    return {
      type:"money", target,
      label:`Earn $${target}`,
      itemRewardId: QUEST_MATERIAL_IDS[Math.floor(rnd()*QUEST_MATERIAL_IDS.length)],
      itemRewardQty: {I:1,II:2,III:3}[tier]
    };
  },
  (rnd, tier) => {
    const target = { I:3, II:6, III:14 }[tier] + Math.floor(rnd()*3);
    return {
      type:"slay", target,
      label:`Slay ${target} enemies`,
      moneyReward: Math.round(target * (12+rnd()*8) * {I:1,II:1.6,III:2.4}[tier])
    };
  }
];
function offeredQuestFor(tier){
  const period = QUEST_TIER_PERIOD_MS[tier];
  const seed = Math.floor(Date.now()/period) + tier.charCodeAt(0)*7919 + tier.length*131;
  const rnd = seededRand(seed);
  const tpl = QUEST_TEMPLATES[Math.floor(rnd()*QUEST_TEMPLATES.length)];
  return { tier, ...tpl(rnd, tier) };
}
function questProgress(quest, p){
  if(quest.type==="gather") return Math.max(0, (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty - quest.baseline || 0);
  if(quest.type==="money") return Math.max(0, p.money - quest.baseline);
  if(quest.type==="slay") return Math.max(0, (p.monstersKilled||0) - quest.baseline);
  return 0;
}
function questBaseline(quest, p){
  if(quest.type==="gather") return (p.inventory||[]).find(e=>e.itemId===quest.itemId)?.qty || 0;
  if(quest.type==="money") return p.money||0;
  if(quest.type==="slay") return p.monstersKilled||0;
  return 0;
}
async function renderQuests(){
  const list = document.getElementById("questList");
  list.innerHTML="<li>Loading…</li>";
  const p = state.profile;
  const rows = [];
  for(let i=0;i<3;i++){
    const slotKey = `slot${i+1}`;
    const ref = doc(db,"players",state.uid,"quests",slotKey);
    const snap = await getDoc(ref).catch(()=>null);
    const quest = snap?.exists() ? snap.data() : null;
    if(quest && Date.now() >= quest.deadlineAt){
      // 24h window is up either way — free the slot
      await deleteDoc(ref).catch(()=>{});
      rows.push(renderEmptySlotRow(slotKey));
    } else if(quest){
      rows.push(renderActiveSlotRow(slotKey, quest, p, ref));
    } else {
      rows.push(renderEmptySlotRow(slotKey));
    }
  }
  list.innerHTML = rows.join("");
  document.querySelectorAll("[data-quest-accept]").forEach(btn=>{
    btn.addEventListener("click", ()=> acceptQuest(btn.dataset.questAccept, btn.dataset.questTier));
  });
  document.querySelectorAll("[data-quest-claim]").forEach(btn=>{
    btn.addEventListener("click", ()=> claimQuest(btn.dataset.questClaim));
  });
}
function renderEmptySlotRow(slotKey){
  // slot's tier is fixed to slot 1/2/3 = I/II/III for the FIRST ever
  // offer; after that a slot's tier is effectively whatever it re-rolls
  // to via offeredQuestFor's own period, so this stays simple and stable.
  const tier = QUEST_TIERS[Number(slotKey.slice(-1))-1];
  const q = offeredQuestFor(tier);
  const period = QUEST_TIER_PERIOD_MS[tier];
  const msIntoPeriod = Date.now() % period;
  const msLeft = period - msIntoPeriod;
  const hrsLeft = Math.max(1, Math.round(msLeft/3600000));
  return `<li class="quest-row">
    <div><b>Tier ${tier}:</b> ${q.label}</div>
    <div style="font-size:12px">Rerolls in ~${hrsLeft}h if not accepted &middot; Reward: ${q.moneyReward?`$${q.moneyReward}`:""}${q.itemRewardId?` + ${q.itemRewardQty}x ${ITEM_BY_ID[q.itemRewardId].name}`:""}</div>
    <button class="doodle-btn btn-sm btn-green" data-quest-accept="${slotKey}" data-quest-tier="${tier}">Accept (24h)</button>
  </li>`;
}
function renderActiveSlotRow(slotKey, quest, p, ref){
  const progress = questProgress(quest, p);
  const done = progress >= quest.target;
  const msLeft = Math.max(0, quest.deadlineAt - Date.now());
  const hrsLeft = Math.floor(msLeft/3600000), minsLeft = Math.floor((msLeft%3600000)/60000);
  return `<li class="quest-row">
    <div><b>Tier ${quest.tier}:</b> ${quest.label}</div>
    <div style="font-size:12px">Progress: ${Math.min(progress,quest.target)}/${quest.target} &middot; ${hrsLeft}h ${minsLeft}m left</div>
    ${done && !quest.rewardClaimed
      ? `<button class="doodle-btn btn-sm btn-green" data-quest-claim="${slotKey}">Claim Reward</button>`
      : quest.rewardClaimed
        ? `<div style="font-size:12px">Reward claimed — slot frees up when the 24h window ends.</div>`
        : `<div style="font-size:12px">In progress…</div>`}
  </li>`;
}
async function acceptQuest(slotKey, tier){
  const p = state.profile;
  const offered = offeredQuestFor(tier);
  const quest = {
    ...offered,
    baseline: questBaseline(offered, p),
    acceptedAt: Date.now(),
    deadlineAt: Date.now() + QUEST_ACCEPT_WINDOW_MS,
    rewardClaimed: false
  };
  await withErrorToast(()=> setDoc(doc(db,"players",state.uid,"quests",slotKey), quest));
  toast(`Accepted: ${offered.label}`);
  renderQuests();
}
async function claimQuest(slotKey){
  const ref = doc(db,"players",state.uid,"quests",slotKey);
  const snap = await getDoc(ref).catch(()=>null);
  if(!snap?.exists()) return;
  const quest = snap.data();
  if(quest.rewardClaimed) return;
  await withErrorToast(async ()=>{
    if(quest.moneyReward) await grantMoney(quest.moneyReward);
    if(quest.itemRewardId) await addItemToInv(quest.itemRewardId, quest.itemRewardQty||1);
    await updateDoc(ref, { rewardClaimed:true });
  });
  toast(`Quest reward claimed!${quest.moneyReward?` +$${quest.moneyReward}`:""}`);
  renderQuests();
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
/* --- map: now doubles as fast-travel — clicking a region teleports you
   into that quadrant instead of just flipping a cosmetic field, since your
   region is normally whatever quadrant your live x/y position is in. --- */
const QUADRANT_TRAVEL_POINT = { forest:{x:2000,y:2000}, reef:{x:-2000,y:2000}, mountains:{x:-2000,y:-2000}, volcano:{x:2000,y:-2000} };
function renderRegionGrid(){
  const grid = document.getElementById("regionGrid");
  grid.innerHTML="";
  Object.entries(REGIONS).forEach(([key,r])=>{
    const card = document.createElement("div");
    card.className = `region-card ${r.css}-c` + (state.profile.region===key? " current":"");
    card.innerHTML = `<div style="font-size:30px">${{forest:"🌲",mountains:"⛰️",volcano:"🌋",reef:"🪸"}[key]}</div><div>${r.name}</div>`;
    card.addEventListener("click", async ()=>{
      if(state.profile.region===key) return;
      const pt = QUADRANT_TRAVEL_POINT[key];
      teleportTo(pt.x, pt.y);
      closeModal("compassModal");
      toast(`Traveled to ${r.name}`);
    });
    grid.appendChild(card);
  });
}

/* --- shop ---
   Stock is 2 random weapons, 2 armor, 2 trinkets, 2 consumables
   (food/potion) and 2 materials — reshuffled once per day per region, but
   stable across re-renders/reloads on the same day (seeded by date+region
   so it doesn't change every time the shop is opened). */
function shopItemsForRegion(){
  const p = state.profile;
  const region = REGIONS[p.region];
  const own = ITEM_BANK.filter(i => i.element === region.element);
  const day = new Date().toISOString().slice(0,10);
  const seedStr = day + p.region;
  const seed = [...seedStr].reduce((a,c)=>a+c.charCodeAt(0),0) + 7000;
  const rnd = seededRand(seed);
  const pickTwo = (type) => {
    const pool = own.filter(i => i.type===type);
    const picked = [];
    const used = new Set();
    while(picked.length < 2 && picked.length < pool.length){
      const idx = Math.floor(rnd()*pool.length);
      if(used.has(idx)) continue;
      used.add(idx); picked.push(pool[idx]);
    }
    return picked;
  };
  return [
    ...pickTwo("weapon"), ...pickTwo("armor"), ...pickTwo("trinket"),
    ...pickTwo("consumable"), ...pickTwo("material")
  ];
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
   WORLD RESOURCE GATHERING — foraging, mining, fishing
   These used to be their own tab UIs; now they're triggered by walking up
   to a tree/bush/rocky cliff/pond in the open world and pressing Space.
   The reward math is unchanged from the old tab-based version.
   ========================================================================= */
function hasItem(itemId){ return (state.profile.inventory||[]).some(e=>e.itemId===itemId && e.qty>0); }

/* --- foraging (bush): free, once every 60s, 5% money / 45% item / 50% nothing --- */
const FORAGE_COOLDOWN_MS = 60*1000;
function forageReadyIn(){ return FORAGE_COOLDOWN_MS - (Date.now() - (state.profile.lastForageTs||0)); }
async function doForageAction(){
  if(forageReadyIn() > 0) return;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    lastForageTs: Date.now(), foragingXp: (state.profile.foragingXp||0)+1
  }));
  const roll = Math.random();
  if(roll < 0.05){
    const amt = 5 + Math.floor(Math.random()*15);
    await grantMoney(amt);
    worldLogMsg(`You found $${amt} in the bush!`);
  } else if(roll < 0.50){
    const pool = ["forage_berry","forage_herb","forage_mushroom"];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    worldLogMsg(`You foraged a ${ITEM_BY_ID[pick].name}!`);
  } else {
    worldLogMsg("Nothing this time.");
  }
}

/* --- mining (rocky cliff): 3 pulls per hour, needs a Pickaxe --- */
const MINE_HOUR_MS = 60*60*1000;
document.getElementById("btnBuyPickaxe").addEventListener("click", async ()=>{
  if(hasItem("tool_pickaxe")){ toast("You already have a pickaxe."); return; }
  await buyItem(ITEM_BY_ID.tool_pickaxe);
});
function minePicksLeft(){
  const p = state.profile;
  const inWindow = Date.now() - (p.mineHourStart||0) < MINE_HOUR_MS;
  return inWindow ? Math.max(0, 3-(p.minePicksThisHour||0)) : 3;
}
async function doMineAction(){
  if(!hasItem("tool_pickaxe")){ toast("You need a Pickaxe (buy it in the Shop) to mine."); return; }
  const p = state.profile;
  const inWindow = Date.now() - (p.mineHourStart||0) < MINE_HOUR_MS;
  const hourStart = inWindow ? p.mineHourStart : Date.now();
  const picks = inWindow ? (p.minePicksThisHour||0) : 0;
  if(picks >= 3){ toast("Out of rock pulls for this hour."); return; }
  const roll = Math.random();
  let msg;
  const updates = { mineHourStart: hourStart, minePicksThisHour: picks+1, miningXp: (p.miningXp||0)+1 };
  if(roll < 0.4){ // good
    const pool = ["ore_copper","ore_iron","gem_quartz","gem_ruby","money"];
    const w = [0.35,0.3,0.2,0.08,0.07];
    let r = Math.random(), pick=pool[0], acc=0;
    for(let i=0;i<pool.length;i++){ acc+=w[i]; if(r<=acc){ pick=pool[i]; break; } }
    if(pick==="money"){
      const amt = 20 + Math.floor(Math.random()*80);
      updates.money = p.money + amt;
      msg = `Found $${amt} under the rock!`;
    } else {
      await addItemToInv(pick, 1);
      msg = `Found a ${ITEM_BY_ID[pick].name}!`;
    }
  } else if(roll < 0.75){ // neutral
    const pool = ["ore_copper","forage_mushroom"];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    msg = `Just some ${ITEM_BY_ID[pick].name}.`;
  } else { // negative
    if(Math.random()<0.5){
      const loss = Math.round(p.money * (0.03+Math.random()*0.07));
      updates.money = Math.max(0, p.money - loss);
      msg = `A trap! Lost $${loss}.`;
    } else {
      const hpLoss = Math.round(p.hpMax * (0.05+Math.random()*0.1));
      updates.hp = Math.max(1, p.hp - hpLoss);
      msg = `Ouch! Lost ${hpLoss} HP.`;
    }
  }
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), updates));
  worldLogMsg(msg);
}

/* --- fishing (pond): vertical hold-to-catch minigame, needs a Fishing Rod --- */
document.getElementById("btnBuyRod").addEventListener("click", async ()=>{
  if(hasItem("tool_fishingrod")){ toast("You already have a fishing rod."); return; }
  await buyItem(ITEM_BY_ID.tool_fishingrod);
});
let fishGame = null;
function doFishAction(){
  if(!hasItem("tool_fishingrod")){ toast("You need a Fishing Rod (buy it in the Shop) to fish."); return; }
  if(fishGame) return;
  worldState.controlsSuspended = true; // movement/attack pause while the minigame overlay is up
  document.getElementById("fishOverlay").classList.add("show");
  const track = document.querySelector(".fish-track-v");
  const trackH = track.clientHeight || 260;
  const barH = 64;
  let barY = trackH - barH;
  let vel = 0;
  let held = false;
  let progress = 0;
  const progressNeeded = 100;
  let fishY = Math.random()*(trackH-26);
  // Each fish has a random speed trait — slow/medium/fast — that's harder
  // to track the faster it is, but pays off with better catch quality.
  const traitRoll = Math.random();
  const trait = traitRoll<0.45 ? FISH_TRAITS.slow : traitRoll<0.8 ? FISH_TRAITS.medium : FISH_TRAITS.fast;
  let fishVel = (Math.random()<0.5?-1:1) * trait.speed;
  const emojiEl = document.getElementById("fishEmoji");
  const barEl = document.getElementById("fishBar");
  const fillEl = document.getElementById("fishProgressFill");

  const holdOn = ()=> held = true;
  const holdOff = ()=> held = false;
  const keyDown = (e)=>{ if(e.code==="Space"){ e.preventDefault(); held=true; } };
  const keyUp = (e)=>{ if(e.code==="Space"){ held=false; } };
  track.addEventListener("mousedown", holdOn); track.addEventListener("touchstart", holdOn);
  window.addEventListener("mouseup", holdOff); window.addEventListener("touchend", holdOff);
  window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);

  const GRAVITY = 0.9, LIFT = -1.8, MAXV = 6;
  fishGame = setInterval(()=>{
    fishY += fishVel;
    if(fishY < 0){ fishY = 0; fishVel = Math.abs(fishVel); }
    if(fishY > trackH-26){ fishY = trackH-26; fishVel = -Math.abs(fishVel); }
    if(Math.random()<0.03) fishVel = (Math.random()<0.5?-1:1) * trait.speed;
    emojiEl.style.top = fishY+"px";

    vel += held ? LIFT : GRAVITY;
    vel = Math.max(-MAXV, Math.min(MAXV, vel));
    barY += vel;
    if(barY < 0){ barY = 0; vel = 0; }
    if(barY > trackH-barH){ barY = trackH-barH; vel = 0; }
    barEl.style.height = barH+"px";
    barEl.style.top = barY+"px";

    const fishCenter = fishY + 13;
    const inBar = fishCenter >= barY && fishCenter <= barY+barH;
    progress += inBar ? 1.4 : -1.2;
    progress = Math.max(0, Math.min(progressNeeded, progress));
    fillEl.style.height = progress+"%";

    if(progress >= progressNeeded){ endFishing(true, trait); }
  }, 50);
  setTimeout(()=>{ if(fishGame) endFishing(false, trait); }, 15000);
  fishGame.cleanup = ()=>{
    track.removeEventListener("mousedown", holdOn); track.removeEventListener("touchstart", holdOn);
    window.removeEventListener("mouseup", holdOff); window.removeEventListener("touchend", holdOff);
    window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
  };
}
// Speed traits for the fishing minigame: a fish that darts up/down fast is
// harder to keep the bar on, so it rolls against a better loot table as a
// reward for landing it. "medium"/"easy to catch" fish stay on the base table.
const FISH_TRAITS = {
  slow:   { name:"slow",   speed:0.5,  qualityBonus:0 },
  medium: { name:"medium", speed:1.1,  qualityBonus:0.15 },
  fast:   { name:"fast",   speed:1.9,  qualityBonus:0.35 }
};
async function endFishing(success, trait){
  if(!fishGame) return;
  clearInterval(fishGame); fishGame.cleanup?.(); fishGame = null;
  document.getElementById("fishOverlay").classList.remove("show");
  document.getElementById("fishProgressFill").style.height = "0%";
  worldState.controlsSuspended = false;
  if(success){
    const bonus = trait?.qualityBonus || 0;
    const roll = Math.max(0, Math.min(0.999, Math.random() + bonus));
    const pool = roll<0.55 ? ["fish_minnow"] : roll<0.85 ? ["fish_bass","fish_trout"] : roll<0.98 ? ["fish_swordfish"] : ["fish_golden"];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    await addItemToInv(pick, 1);
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { fishingXp: (state.profile.fishingXp||0)+1 }));
    worldLogMsg(`Caught a ${trait?.name||""} fish — a ${ITEM_BY_ID[pick].name}!`);
  } else {
    worldLogMsg("The fish got away.");
  }
}
document.getElementById("btnCancelFish").addEventListener("click", ()=> endFishing(false));


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
function chatMessageHTML(m, id, collectionPath){
  const canDelete = m.uid===state.uid || isAdminUI();
  return `
      <div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}" data-mid="${id}">
        <div class="who chat-username" data-uid="${m.uid}">${escapeHTML(m.username)}</div>
        <div class="bubble">${escapeHTML(m.text)}</div>
        ${canDelete ? `<button class="chat-del-btn" data-del="${id}" data-cpath="${collectionPath}" title="Delete message">&times;</button>` : ""}
      </div>`;
}
function wireChatRowInteractions(log){
  log.querySelectorAll(".chat-username").forEach(el=>{
    el.addEventListener("click", ()=> openProfileByUid(el.dataset.uid));
  });
  log.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const [col, ...rest] = btn.dataset.cpath.split("/");
      const ref = rest.length ? doc(db, col, ...rest, btn.dataset.del) : doc(db, col, btn.dataset.del);
      await withErrorToast(()=> deleteDoc(ref));
    });
  });
}
function subscribeGlobalChat(){
  const q = query(collection(db,"globalChat"), orderBy("ts","desc"), limit(50));
  const unsub = onSnapshot(q, (snap)=>{
    const log = document.getElementById("chatLogGlobal");
    const rows = [];
    snap.forEach(d=>rows.unshift({id:d.id, ...d.data()}));
    log.innerHTML = rows.map(m=> chatMessageHTML(m, m.id, "globalChat")).join("");
    log.scrollTop = log.scrollHeight;
    wireChatRowInteractions(log);
  }, (err)=> toast(friendlyFirebaseError(err)));
  state.unsubs.push(unsub);
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
document.getElementById("globalChatForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const input = document.getElementById("globalChatInput");
  const raw = input.value.trim();
  if(!raw) return;
  if(raw.startsWith("/")){
    hideCmdMenu();
    input.value = "";
    await runSlashCommand(raw);
    return;
  }
  const text = moderateChatText(raw);
  if(!text) return;
  const ok = await withErrorToast(()=> addDoc(collection(db,"globalChat"), { uid:state.uid, username:state.profile.username, text, ts: Date.now() }));
  if(ok!==null) input.value="";
});

/* =========================================================================
   CHAT SLASH COMMANDS
   ========================================================================= */
const SLASH_COMMANDS = [
  { cmd:"/pay", usage:"/pay [username] [amount]", desc:"Send money to another player (up to what you have)." },
  { cmd:"/ah", usage:"/ah", desc:"Open the Auction House." },
  { cmd:"/ah sell", usage:"/ah sell [item] [amount]", desc:"List 1 of that item on the auction for that price." },
  { cmd:"/friend", usage:"/friend [username]", desc:"Send a friend request." },
  { cmd:"/friend remove", usage:"/friend remove [username]", desc:"Unfriend a player." },
  { cmd:"/msg", usage:"/msg [username]", desc:"Open (or start) a private chat with a player." }
];
function hideCmdMenu(){
  const menu = document.getElementById("chatCmdMenu");
  menu.classList.remove("show");
  menu.innerHTML = "";
}
function renderCmdMenu(filterText){
  const menu = document.getElementById("chatCmdMenu");
  const matches = SLASH_COMMANDS.filter(c=> c.cmd.startsWith(filterText.split(" ")[0]) );
  if(!matches.length){ hideCmdMenu(); return; }
  menu.innerHTML = matches.map(c=> `
    <div class="chat-cmd-item" data-cmd="${escapeHTML(c.usage)}">
      <b>${escapeHTML(c.usage)}</b>
      <span class="cmd-desc">${escapeHTML(c.desc)}</span>
    </div>`).join("");
  menu.classList.add("show");
  menu.querySelectorAll("[data-cmd]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const input = document.getElementById("globalChatInput");
      // drop the "[...]" placeholders, leave the command word(s) + a trailing space
      input.value = el.dataset.cmd.replace(/\s*\[[^\]]*\]/g, "").trim() + " ";
      input.focus();
      hideCmdMenu();
    });
  });
}
document.getElementById("globalChatInput").addEventListener("input", (e)=>{
  const v = e.target.value;
  if(v.startsWith("/")) renderCmdMenu(v); else hideCmdMenu();
});
document.getElementById("globalChatInput").addEventListener("blur", ()=> setTimeout(hideCmdMenu, 150));

async function findPlayerByUsername(username){
  const snap = await getDocs(query(collection(db,"players"), where("username","==",username), limit(1)));
  if(snap.empty) return null;
  return { uid: snap.docs[0].id, data: snap.docs[0].data() };
}
async function runSlashCommand(raw){
  const parts = raw.trim().split(/\s+/);
  const head = parts[0].toLowerCase();
  try{
    if(head==="/pay"){
      const [, username, amountStr] = parts;
      const amount = Number(amountStr);
      if(!username || !amount || amount<=0){ toast("Usage: /pay [username] [amount]"); return; }
      if(username===state.profile.username){ toast("You can't pay yourself."); return; }
      if(amount > (state.profile.money||0)){ toast(`You only have $${fmtMoney(state.profile.money||0)}.`); return; }
      const target = await findPlayerByUsername(username);
      if(!target){ toast(`No player named "${username}" found.`); return; }
      // Same self-write-only pattern as auction sales/duel rewards: debit
      // ourselves now, and deliver the money via the recipient's inbox,
      // which auto-credits it the instant they see it.
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: (state.profile.money||0)-amount }));
      await withErrorToast(()=> addDoc(collection(db,"players",target.uid,"inbox"), {
        type:"pay_received", amount, fromUsername: state.profile.username, ts: Date.now(), credited:false
      }));
      toast(`Paid ${username} $${amount}.`);
    } else if(head==="/ah"){
      if(parts[1]==="sell"){
        const itemQuery = parts.slice(2, -1).join(" ");
        const price = Number(parts[parts.length-1]);
        if(!itemQuery || !price || price<=0){ toast("Usage: /ah sell [item] [amount]"); return; }
        const entry = invExpanded().find(e=> e.item.name.toLowerCase()===itemQuery.toLowerCase())
                    || invExpanded().find(e=> e.item.name.toLowerCase().includes(itemQuery.toLowerCase()));
        if(!entry){ toast(`You don't have an item matching "${itemQuery}".`); return; }
        await postAuctionListing(entry.itemId, 1, price);
      } else {
        document.querySelector('[data-ctab="auction"]').click();
      }
    } else if(head==="/friend"){
      if(parts[1]==="remove"){
        const username = parts[2];
        if(!username){ toast("Usage: /friend remove [username]"); return; }
        const target = await findPlayerByUsername(username);
        if(!target){ toast(`No player named "${username}" found.`); return; }
        if(!(state.profile.friends||[]).includes(target.uid)){ toast(`You aren't friends with ${username}.`); return; }
        await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { friends: arrayRemove(target.uid) }));
        toast(`Removed ${username} from your friends.`);
      } else {
        const username = parts[1];
        if(!username){ toast("Usage: /friend [username]"); return; }
        if(username===state.profile.username){ toast("You can't friend yourself."); return; }
        const target = await findPlayerByUsername(username);
        if(!target){ toast(`No player named "${username}" found.`); return; }
        if((state.profile.friends||[]).includes(target.uid)){ toast(`You're already friends with ${username}.`); return; }
        await sendFriendRequest(target.uid, username);
      }
    } else if(head==="/msg"){
      const username = parts[1];
      if(!username){ toast("Usage: /msg [username]"); return; }
      const target = await findPlayerByUsername(username);
      if(!target){ toast(`No player named "${username}" found.`); return; }
      document.querySelector('[data-ctab="chat"]').click();
      document.querySelector('[data-chatsub="private"]').click();
      openPrivateChatWith(target.uid, username);
    } else {
      toast(`Unknown command: ${head}`);
    }
  }catch(err){ toast(friendlyFirebaseError(err)); }
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
  list.innerHTML="";
  for(const uid of allUids){
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
    snap.forEach(d=>rows.push({id:d.id, ...d.data()}));
    log.innerHTML = rows.map(m=> chatMessageHTML(m, m.id, `privateChats/${threadId}/messages`)).join("");
    log.scrollTop = log.scrollHeight;
    wireChatRowInteractions(log);
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
function subscribeInbox(){
  const q = query(collection(db,"players",state.uid,"inbox"), orderBy("ts","desc"));
  const unsub = onSnapshot(q, snap=>{
    // Auto-credit ALL not-yet-credited auction sales in this batch as ONE
    // combined write (not one write per doc) — several sales landing in
    // the same snapshot and each reading state.profile.money separately
    // would race the same way the old crafting bug did.
    const uncredited = snap.docs.filter(d=> ["auction_sold","duel_reward","pay_received"].includes(d.data().type) && !d.data().credited);
    if(uncredited.length){
      const total = uncredited.reduce((sum,d)=> sum + (d.data().amount||0), 0);
      const itemAdds = uncredited.filter(d=>d.data().itemId).map(d=>({itemId:d.data().itemId, qty:1}));
      if(itemAdds.length) withErrorToast(()=> applyInvChanges({ add: itemAdds }));
      if(total>0) withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { money: (state.profile.money||0) + total }));
      uncredited.forEach(d=> withErrorToast(()=> updateDoc(doc(db,"players",state.uid,"inbox",d.id), { credited:true })));
    }
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
      } else if(n.type==="auction_sold"){
        // Money is auto-credited above the moment this doc is seen — this
        // is now purely a dismissible reminder, no claim step.
        li.innerHTML = `<span>Your ${escapeHTML(n.itemName)} sold for $${n.amount}! (credited to your balance)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="duel_reward"){
        // Auto-credited above the moment this doc is seen — dismiss-only reminder.
        li.innerHTML = `<span>Beat ${escapeHTML(n.fromUsername)} in a duel — won $${n.amount}${n.itemName?` and their ${escapeHTML(n.itemName)}`:""}! (credited)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
        li.querySelector('[data-a="ok"]').addEventListener("click", ()=> withErrorToast(()=> deleteDoc(doc(db,"players",state.uid,"inbox",d.id))));
      } else if(n.type==="pay_received"){
        li.innerHTML = `<span>${escapeHTML(n.fromUsername)} paid you $${n.amount}. (credited)</span><button class="doodle-btn btn-sm" data-a="ok">Dismiss</button>`;
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
    const grid = document.getElementById("auctionGrid");
    grid.innerHTML="";
    auctionListingsCache = {};
    snap.forEach(d=>{
      const listing = d.data();
      if(listing.status !== "active") return;
      if(listing.expiresAt < Date.now()) return;
      const item = ITEM_BY_ID[listing.itemId];
      if(!item) return;
      auctionListingsCache[d.id] = { listing, item };
      const cell = document.createElement("div");
      cell.className = "inv-cell rarity-"+item.rarity + (auctionSelectedId===d.id ? " selected" : "");
      cell.dataset.listingId = d.id;
      cell.innerHTML = `<div>${item.name}</div><span class="qty-badge">x${listing.qty}</span><div style="font-size:11px">$${listing.pricePer} ea</div>`;
      // Hover OR click shows the details/buy panel — buying itself always
      // needs the separate confirm button below, never the cell itself,
      // so a stray click can't accidentally purchase something.
      cell.addEventListener("mouseenter", ()=> showAuctionDetail(d.id));
      cell.addEventListener("click", ()=> selectAuctionListing(d.id));
      grid.appendChild(cell);
    });
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
    `Posted by ${listing.sellerName} — $${listing.pricePer} each, $${listing.pricePer*listing.qty} total`;
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  const isOwnListing = listing.sellerUid === state.uid;
  buyBtn.style.display = isOwnListing ? "none" : "";
  buyBtn.disabled = false;
  buyBtn.textContent = "Buy";
  buyBtn.onclick = ()=> buyAuctionListing(id, listing, item);
  if(auctionDetailTimerInterval) clearInterval(auctionDetailTimerInterval);
  const tick = ()=>{
    const entryNow = auctionListingsCache[id];
    const timerEl = document.getElementById("aucDetailTimer");
    if(!entryNow){ clearInterval(auctionDetailTimerInterval); return; }
    const msLeft = entryNow.listing.expiresAt - Date.now();
    if(msLeft <= 0){ timerEl.textContent = "Expired"; clearInterval(auctionDetailTimerInterval); return; }
    const mins = Math.floor(msLeft/60000), secs = Math.floor((msLeft%60000)/1000);
    timerEl.textContent = `Expires in ${mins}m ${secs}s`;
  };
  tick();
  auctionDetailTimerInterval = setInterval(tick, 1000);
}
function hideAuctionDetail(){
  auctionSelectedId = null;
  document.getElementById("auctionDetail").style.display = "none";
  if(auctionDetailTimerInterval){ clearInterval(auctionDetailTimerInterval); auctionDetailTimerInterval=null; }
}
async function buyAuctionListing(listingId, listing, item){
  const buyBtn = document.getElementById("aucDetailBuyBtn");
  const totalCost = listing.pricePer * listing.qty;
  if(state.profile.money < totalCost){ toast("Not enough money!"); return; }
  buyBtn.disabled = true; buyBtn.textContent = "Buying…";
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
  if(!bought) { toast("That listing is no longer available."); buyBtn.disabled=false; buyBtn.textContent="Buy"; return; }
  await addItemToInv(item.id, listing.qty);
  hideAuctionDetail();
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
// Shared by the Post button and the /ah sell chat command.
async function postAuctionListing(itemId, qty, price){
  if(!itemId || qty<1 || price<1){ toast("Enter a valid quantity and price."); return false; }
  try{
    const mySnap = await getDocs(query(collection(db,"auction"), where("sellerUid","==",state.uid)));
    const activeCount = mySnap.docs.filter(d=>d.data().status==="active").length;
    if(activeCount >= 5){ toast("You can only have 5 auction slots."); return false; }
  }catch(err){ toast(friendlyFirebaseError(err)); return false; }
  const entry = invExpanded().find(e=>e.itemId===itemId);
  if(!entry || entry.qty < qty){ toast("You don't have that many."); return false; }
  await changeInvQty(itemId, -qty);
  const ok = await withErrorToast(()=> addDoc(collection(db,"auction"), {
    sellerUid: state.uid, sellerName: state.profile.username, itemId, qty, pricePer: price,
    status:"active", postedAt: Date.now(), expiresAt: Date.now() + 1000*60*60*24
  }));
  if(ok===null){ await addItemToInv(itemId, qty); return false; } // roll back on failure
  toast("Posted to auction house!");
  populatePostForm();
  return true;
}
document.getElementById("btnPostAuction").addEventListener("click", async ()=>{
  const itemId = document.getElementById("postItemSelect").value;
  const qty = Number(document.getElementById("postQty").value);
  const price = Number(document.getElementById("postPrice").value);
  await postAuctionListing(itemId, qty, price);
});
async function renderMySlots(){
  try{
    const q = query(collection(db,"auction"), where("sellerUid","==",state.uid));
    const snap = await getDocs(q);
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
  // Block picking the same stack into both slots unless there are at
  // least 2 of it — otherwise you'd be "spending" one copy twice.
  const other = !state.craftA ? state.craftB : (!state.craftB ? state.craftA : null);
  if(other && other.item.id===entry.item.id && entry.qty<2){
    toast(`You only have 1 ${entry.item.name} — can't use it in both slots.`);
    return;
  }
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
  // Both ingredients removed and the result added in ONE write — see
  // applyInvChanges() for why this has to be atomic.
  await applyInvChanges({
    remove:[{itemId:a.id, qty:1}, {itemId:b.id, qty:1}],
    add:[{itemId:resultItem.id, qty:1}]
  });
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
/* PvE no longer opens a menu-driven battle modal — monsters live in the
   open world and are fought in real time with Space (see the WORLD
   section below). These pieces are still shared by that system. */
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
  return ARMOR_SLOTS.reduce((sum,slot)=>{
    const piece = p.equipped[slot] && ITEM_BY_ID[p.equipped[slot]];
    return sum + (piece?.stats.defense||0);
  }, 0);
}
/* Skill-based attacks: Space = basic attack, number keys 1-4 in the open
   world trigger the others (see WORLD section). Kept from the old menu
   system so unlock levels/costs stay consistent. */
const ATTACK_SKILLS = [
  { id:"basic", name:"Attack", stamina:4, unlockLevel:1,
    dmgMult:()=>1, desc:"A standard strike. Always available." },
  { id:"power", name:"Power Strike", stamina:4, unlockLevel:1, needsFullRage:true,
    dmgMult:()=>2, desc:"Costs full Rage. Double damage." },
  { id:"precision", name:"Precision Strike", stamina:4, unlockLevel:10,
    dmgMult:()=>1.35, desc:"Unlocked at Lv.10. Reliable extra damage, ignores half enemy defense." },
  { id:"ultimate", name:"Ultimate Strike", stamina:8, unlockLevel:30,
    dmgMult:()=>3, desc:"Unlocked at Lv.30. Devastating hit, costs double stamina." },
];
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
      <button class="doodle-btn btn-sm" id="btnCancelQueue">Cancel Queue</button>
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
async function startDuelRoom(){
  const code = randCode();
  const ok = await withErrorToast(()=> setDoc(doc(db,"duelRooms",code), {
    hostUid: state.uid, hostName: state.profile.username,
    hostHp: state.profile.hp, hostHpMax: state.profile.hpMax,
    guestUid:null, guestName:null, guestHp:null, guestHpMax:null,
    status:"waiting", winner:null, turn: state.uid, createdAt: Date.now(), log:[]
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
      guestHp: state.profile.hp, guestHpMax: state.profile.hpMax,
      status:"active"
    });
    document.getElementById("roomStatus").textContent = "Duel starting…";
    watchDuelRoom(code);
  }catch(err){ toast(friendlyFirebaseError(err)); }
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
    }
    if(d.status==="finished" && state.battle?.mode==="duel" && state.battle.code===code && !state.battle.resolved){
      state.battle.resolved = true;
      const won = d.winner===state.uid;
      // HP as it stood at the end of the duel carries over to your real
      // profile (per spec: hp/mana/stats from the fight are saved, not
      // reset) — never above your normal max.
      const myFinalHp = Math.max(1, Math.min(state.profile.hpMax, state.battle.iAmHost ? d.hostHp : d.guestHp));
      if(won){
        battleLogPush("You won the duel!");
        toast("Duel won!");
        withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
          hp: myFinalHp, kills:(state.profile.kills||0)+1, killstreak:(state.profile.killstreak||0)+1
        }));
      } else {
        battleLogPush("You were defeated in the duel.");
        withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp: myFinalHp }));
        applyDuelLossReward(d.winner).then(({moneyLoss,lostItemName})=>{
          const lossMsg = lostItemName ? `Lost $${moneyLoss} and your ${lostItemName}.` : `Lost $${moneyLoss}.`;
          toast(`Duel lost. ${lossMsg}`);
        });
      }
      setTimeout(()=>{ closeModal("battleModal"); state.battle=null; if(roomUnsub){roomUnsub(); roomUnsub=null;} }, 1400);
    }
  }, (err)=> toast(friendlyFirebaseError(err)));
}
function openDuelBattle(code, d){
  const iAmHost = d.hostUid===state.uid;
  state.battle = { mode:"duel", code, iAmHost, resolved:false, log:[`${d.hostName} vs ${d.guestName} — fight!`] };
  closeModal("compassModal");
  openModal("battleModal");
  renderDuelBattle(d);
}
function renderDuelBattle(d){
  const b = state.battle;
  const iAmHost = b.iAmHost;
  const myHp = iAmHost ? d.hostHp : d.guestHp, myMax = iAmHost ? d.hostHpMax : d.guestHpMax;
  const oppHp = iAmHost ? d.guestHp : d.hostHp, oppMax = iAmHost ? d.guestHpMax : d.hostHpMax;
  document.getElementById("battleEnemyName").textContent = iAmHost ? d.guestName : d.hostName;
  document.getElementById("battleEnemyHPBar").style.width = (100*Math.max(0,oppHp)/oppMax)+"%";
  document.getElementById("battleEnemyHPNum").textContent = `${Math.max(0,oppHp)}/${oppMax}`;
  document.getElementById("battlePlayerName").textContent = state.profile.username;
  document.getElementById("battlePlayerHPBar").style.width = (100*Math.max(0,myHp)/myMax)+"%";
  document.getElementById("battlePlayerHPNum").textContent = `${Math.max(0,myHp)}/${myMax}`;
  document.getElementById("battleStaminaLabel").textContent = "Live PvP";
  document.getElementById("battleRageLabel").textContent = "-";
  // The log is stored on the room doc itself (not local state) so both
  // players see the same "who did what" history, attributed by name.
  const logEl = document.getElementById("battleLog");
  logEl.innerHTML = (d.log||[]).slice(-30).map(m=>`<div>${escapeHTML(m)}</div>`).join("");
  logEl.scrollTop = logEl.scrollHeight;
  const actions = document.getElementById("battleActions");
  actions.innerHTML="";
  if(d.status==="finished") return;
  // Strict turn system: only the player named in d.turn may attack. The
  // button flips to "Waiting..." on your opponent's turn so it's obvious
  // whose go it is instead of both sides being able to swing at once.
  const isMyTurn = d.turn === state.uid;
  const atkBtn = document.createElement("button");
  atkBtn.className="doodle-btn btn-sm btn-pink";
  atkBtn.textContent = isMyTurn ? "Attack" : "Waiting for opponent…";
  atkBtn.disabled = myHp<=1 || oppHp<=1 || !isMyTurn;
  atkBtn.addEventListener("click", ()=> duelAttack(d));
  actions.appendChild(atkBtn);
  const fleeBtn = document.createElement("button");
  fleeBtn.className="doodle-btn btn-sm btn-yellow"; fleeBtn.textContent="Flee";
  fleeBtn.addEventListener("click", ()=> duelFlee(d));
  actions.appendChild(fleeBtn);
}
async function duelAttack(d){
  const b = state.battle;
  if(!b || b.mode!=="duel") return;
  if(d.turn !== state.uid){ toast("Wait for your turn!"); return; }
  const rref = doc(db,"duelRooms",b.code);
  const dmg = Math.round(playerAttackPower() * (0.85+Math.random()*0.3));
  const oppField = b.iAmHost ? "guestHp" : "hostHp";
  const oppUid = b.iAmHost ? d.guestUid : d.hostUid;
  const oppName = b.iAmHost ? d.guestName : d.hostName;
  // Death = reaching 1 HP, same threshold as PvE/world PvP.
  const newOppHp = Math.max(1, (b.iAmHost ? d.guestHp : d.hostHp) - dmg);
  const patch = {
    [oppField]: newOppHp,
    turn: oppUid, // end my turn, hand it to the opponent
    log: arrayUnion(`${state.profile.username} hit ${oppName} for ${dmg} damage.`)
  };
  if(newOppHp<=1){ patch.status="finished"; patch.winner=state.uid; patch.loser=oppUid; }
  await withErrorToast(()=> updateDoc(rref, patch));
}
// The winner's money/inventory can never be written directly by the loser's
// client (players collection is self-write-only) — so, same pattern as
// auction sales, the LOSER debits themselves and drops the winnings in the
// WINNER's inbox, which auto-credits them (see subscribeInbox).
async function applyDuelLossReward(winnerUid){
  const p = state.profile;
  const pct = 0.10 + Math.random()*0.15; // 10%-25%
  const moneyLoss = Math.floor((p.money||0) * pct);
  const inv = p.inventory||[];
  let lostItemId=null, lostItemName=null;
  if(inv.length){
    const pick = inv[Math.floor(Math.random()*inv.length)];
    lostItemId = pick.itemId;
    lostItemName = ITEM_BY_ID[pick.itemId]?.name || null;
  }
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    money: Math.max(0, (p.money||0)-moneyLoss), deaths:(p.deaths||0)+1, killstreak:0
  }));
  if(lostItemId) await changeInvQty(lostItemId, -1);
  await withErrorToast(()=> addDoc(collection(db,"players",winnerUid,"inbox"), {
    type:"duel_reward", amount: moneyLoss, itemId: lostItemId, itemName: lostItemName,
    fromUsername: state.profile.username, ts: Date.now(), credited:false
  }));
  return { moneyLoss, lostItemName };
}
async function duelFlee(d){
  const b = state.battle;
  if(!b || b.mode!=="duel") return;
  const rref = doc(db,"duelRooms",b.code);
  const winner = b.iAmHost ? d.guestUid : d.hostUid;
  await withErrorToast(()=> updateDoc(rref, {
    status:"finished", winner, log: arrayUnion(`${state.profile.username} fled the duel.`)
  }));
}
let queueUnsub=null, queueGuestUnsub=null;
function leaveQueueListeners(){
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
    username: state.profile.username, hp: state.profile.hp, hpMax: state.profile.hpMax, joinedAt: Date.now()
  }));
  if(ok===null) return;

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
        hostHp: state.profile.hp, hostHpMax: state.profile.hpMax,
        guestUid: opp.uid, guestName: opp.username,
        guestHp: opp.hp!=null?opp.hp:(opp.hpMax||100), guestHpMax: opp.hpMax||100,
        status:"active", winner:null, turn: state.uid, createdAt: Date.now(), log:[]
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

/* =========================================================================
   SETTINGS
   ========================================================================= */
document.getElementById("btnSettings").addEventListener("click", ()=> openModal("settingsModal"));
document.getElementById("muteMusic").addEventListener("change", (e)=>{ state.settings.muteMusic=e.target.checked; if(e.target.checked) musicEl().pause(); else musicEl().play().catch(()=>{}); });
document.getElementById("muteSfx").addEventListener("change", (e)=>{ state.settings.muteSfx=e.target.checked; });

/* =========================================================================
   GLOBAL HOVER/CLICK SFX
   ========================================================================= */
document.addEventListener("mouseover", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("hover"); });
document.addEventListener("click", (e)=>{ if(e.target.closest(".doodle-btn")) playSfx("click"); });

/* =========================================================================
   OPEN WORLD — replaces the old dragon idle screen. Birds-eye, WASD to
   move, Space to gather/attack/pick up depending on what's nearby.

   Honest simplifications (documented rather than hidden):
   - Resource nodes and monster POSITIONS are deterministic (a pure hash of
     chunk coordinates), so everyone's world looks the same without any
     server storage. Monster STATS scale to whichever player is viewing
     them (matches "spawning based on your level" literally) — two players
     standing in the same spot can therefore see a monster at different
     strength. Node/monster "defeated" state is tracked per-client with a
     respawn timer, not synced across players — true shared monster HP
     would need a much heavier chunk-document architecture.
   - Player positions, attacks (PvP), loot drops and placed buildings ARE
     fully synced through Firestore, so those are genuinely multiplayer.
   ========================================================================= */
const WORLD_BOUND = 10000;
const CHUNK = 500;
const VIEW_CHUNK_RADIUS = 2;       // how many chunks out to draw nodes/monsters
const NODE_RESPAWN_MS = 120000;    // 2 min, client-local
const MONSTER_RESPAWN_MS = 180000; // 3 min, client-local
const ATTACK_COOLDOWN_MS = 450;
const GATHER_RANGE = 46, ATTACK_RANGE = 46, AGGRO_RANGE = 150, PICKUP_RANGE = 40;
const POS_SYNC_MS = 180;
const MONSTER_HIT_INTERVAL = 1400;

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashCoords(x,y){ return (Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263)) | 0; }
function chunkOf(x,y){ return { cx: Math.floor(x/CHUNK), cy: Math.floor(y/CHUNK) }; }
function chunkKeyStr(cx,cy){ return `${cx}_${cy}`; }
// Quadrant -> region, per spec: Q1 forest/earth, Q2 ocean/water, Q3 snowy
// cliffs/wind, Q4 fire/volcano. (0,0) is where all four meet.
function quadrantRegion(x,y){
  if(x>=0 && y>=0) return "forest";
  if(x<0 && y>=0)  return "reef";
  if(x<0 && y<0)   return "mountains";
  return "volcano";
}
const QUADRANT_COLOR = { forest:"#bfe3a8", reef:"#a8d8e3", mountains:"#dce6ee", volcano:"#e3a89c" };
const QUADRANT_GLYPH = { tree:"🌳", bush:"🌿", pond:"💧", rock:"🪨" };

const worldState = {
  x:0, y:0, facing:"down",
  keys:{}, lastAttackTs:0, lastPosSentTs:0, lastSentX:null, lastSentY:null,
  currentChunkKey:null, controlsSuspended:false,
  nearbyPlayers:{}, nearbyPlayersUnsub:null,
  nearbyLoot:{}, nearbyLootUnsub:null,
  nearbyObjects:{}, nearbyObjectsUnsub:null,
  incomingHitsUnsub:null, killCreditsUnsub:null,
  chunkNodeCache:{}, chunkMonsterCache:{},
  interactTarget:null, canvas:null, ctx:null, mmCtx:null, raf:null, lastTs:0,
  respawning:false
};
function worldUnsubAll(){
  [worldState.nearbyPlayersUnsub, worldState.nearbyLootUnsub, worldState.nearbyObjectsUnsub,
   worldState.incomingHitsUnsub, worldState.killCreditsUnsub].forEach(u=> u && u());
  if(worldState.raf) cancelAnimationFrame(worldState.raf);
}

function generateChunkNodes(cx,cy){
  const key = chunkKeyStr(cx,cy);
  if(worldState.chunkNodeCache[key]) return worldState.chunkNodeCache[key];
  const rnd = mulberry32(hashCoords(cx, cy));
  const count = 4 + Math.floor(rnd()*5);
  const types = ["tree","bush","pond","rock"];
  const nodes = [];
  for(let i=0;i<count;i++){
    nodes.push({
      id:`${key}_n${i}`, type: types[Math.floor(rnd()*types.length)],
      x: cx*CHUNK + rnd()*CHUNK, y: cy*CHUNK + rnd()*CHUNK,
      depletedAt: 0
    });
  }
  worldState.chunkNodeCache[key] = nodes;
  return nodes;
}
/* Monster level is generated relative to the PLAYER'S level at the moment
   the chunk is first seen, per spec:
     easy   = 1-5 levels BELOW the player, always at least level 1
     medium = player level +/- (0-3), randomly
     hard   = 1-5 levels ABOVE the player
   Stats/xp/money then scale off that computed level using the same
   difficulty multipliers as the old static ENEMY_BANK, so an easy monster
   at level 3 hits the same as any other level-3 easy monster. */
function levelForDifficulty(diff, playerLevel, rnd){
  if(diff==="easy") return Math.max(1, playerLevel - (1+Math.floor(rnd()*5)));
  if(diff==="hard") return playerLevel + (1+Math.floor(rnd()*5));
  return Math.max(1, playerLevel + (Math.floor(rnd()*7)-3)); // medium: -3..+3
}
function generateChunkMonsters(cx,cy){
  const key = chunkKeyStr(cx,cy);
  if(worldState.chunkMonsterCache[key]) return worldState.chunkMonsterCache[key];
  const rnd = mulberry32(hashCoords(cx*7+3, cy*7+3));
  const region = quadrantRegion(cx*CHUNK+1, cy*CHUNK+1);
  const monsters = [];
  if(rnd() >= 0.4){ // 60% of chunks have monsters
    const count = 1 + Math.floor(rnd()*3);
    const playerLevel = state.profile.level||1;
    const names = ENEMY_NAME_PARTS[region];
    for(let i=0;i<count;i++){
      const roll = rnd();
      const diff = roll<0.4 ? "easy" : roll<0.8 ? "medium" : "hard";
      const mLevel = levelForDifficulty(diff, playerLevel, rnd);
      const d = DIFF[diff];
      const tmpl = {
        id:`${key}_m${i}_tmpl`, name: names[Math.floor(rnd()*names.length)],
        region, difficulty:diff, level: mLevel,
        element: REGIONS[region].element,
        hp: Math.round((20 + mLevel*8) * d.mult),
        attack: Math.round((3 + mLevel*1.5) * d.mult),
        xpReward: Math.round(d.xp[0] + rnd()*(d.xp[1]-d.xp[0])),
        moneyReward: Math.round(d.money[0] + rnd()*(d.money[1]-d.money[0])),
        dropChance: diff==="easy"?0.25:diff==="medium"?0.45:0.7
      };
      monsters.push({
        id:`${key}_m${i}`, x: cx*CHUNK + rnd()*CHUNK, y: cy*CHUNK + rnd()*CHUNK,
        tmpl, hp: tmpl.hp, maxHp: tmpl.hp, dead:false, deadAt:0, lastHitTs:0
      });
    }
  }
  worldState.chunkMonsterCache[key] = monsters;
  return monsters;
}
function nodesNearPlayer(){
  const {cx,cy} = chunkOf(worldState.x, worldState.y);
  const out = [];
  for(let dx=-VIEW_CHUNK_RADIUS; dx<=VIEW_CHUNK_RADIUS; dx++)
    for(let dy=-VIEW_CHUNK_RADIUS; dy<=VIEW_CHUNK_RADIUS; dy++)
      out.push(...generateChunkNodes(cx+dx, cy+dy).filter(n=> !n.depletedAt || Date.now()-n.depletedAt > NODE_RESPAWN_MS));
  return out;
}
function monstersNearPlayer(){
  const {cx,cy} = chunkOf(worldState.x, worldState.y);
  const out = [];
  for(let dx=-VIEW_CHUNK_RADIUS; dx<=VIEW_CHUNK_RADIUS; dx++)
    for(let dy=-VIEW_CHUNK_RADIUS; dy<=VIEW_CHUNK_RADIUS; dy++)
      out.push(...generateChunkMonsters(cx+dx, cy+dy).filter(m=> !m.dead || Date.now()-m.deadAt > MONSTER_RESPAWN_MS));
  // respawn: reset hp once past the timer
  out.forEach(m=>{ if(m.dead && Date.now()-m.deadAt>MONSTER_RESPAWN_MS){ m.dead=false; m.hp=m.maxHp; } });
  return out;
}

/* ---------- init ---------- */
function initWorld(pos){
  worldState.x = pos.x; worldState.y = pos.y;
  worldState.canvas = document.getElementById("worldCanvas");
  worldState.ctx = worldState.canvas.getContext("2d");
  worldState.mmCtx = document.getElementById("minimapCanvas").getContext("2d");
  resizeWorldCanvas();
  window.addEventListener("resize", resizeWorldCanvas);

  window.addEventListener("keydown", (e)=>{
    if(worldControlsBlocked()) return;
    if(["w","a","s","d","W","A","S","D"].includes(e.key)) worldState.keys[e.key.toLowerCase()]=true;
    if(e.code==="Space"){ e.preventDefault(); handleSpacebar(1); }
    if(["1","2","3","4"].includes(e.key)){ handleSpacebar(Number(e.key)); }
  });
  window.addEventListener("keyup", (e)=>{
    if(["w","a","s","d","W","A","S","D"].includes(e.key)) worldState.keys[e.key.toLowerCase()]=false;
  });

  updateNearbySubscriptions(true);
  setupIncomingHitsListener();
  setupKillCreditsListener();
  renderHotbar();
  worldState.raf = requestAnimationFrame(worldTick);
}
function resizeWorldCanvas(){
  const c = worldState.canvas, stage = document.getElementById("gameStage");
  if(!c || !stage) return;
  c.width = stage.clientWidth; c.height = stage.clientHeight;
}
function worldControlsBlocked(){
  if(worldState.controlsSuspended) return true;
  if(document.activeElement && ["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return true;
  if(document.querySelector(".modal-backdrop.active")) return true;
  return false;
}

/* ---------- main loop ---------- */
function worldTick(ts){
  const dt = worldState.lastTs ? Math.min(50, ts-worldState.lastTs) : 16;
  worldState.lastTs = ts;
  if(!worldControlsBlocked()) stepMovement(dt);
  syncPositionThrottled();
  updateInteractTarget();
  applyMonsterAggro();
  drawWorld();
  drawMinimap();
  worldState.raf = requestAnimationFrame(worldTick);
}
function stepMovement(dt){
  const p = state.profile; if(!p) return;
  const speed = (140 + (p.stats?.SPEED||0)*5) * (dt/1000);
  let dx=0, dy=0;
  if(worldState.keys.w) dy -= 1;
  if(worldState.keys.s) dy += 1;
  if(worldState.keys.a) dx -= 1;
  if(worldState.keys.d) dx += 1;
  if(dx||dy){
    const len = Math.hypot(dx,dy);
    worldState.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, worldState.x + (dx/len)*speed));
    worldState.y = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, worldState.y + (dy/len)*speed));
    worldState.facing = Math.abs(dx)>Math.abs(dy) ? (dx>0?"right":"left") : (dy>0?"down":"up");
  }
}
function syncPositionThrottled(){
  const now = Date.now();
  if(now - worldState.lastPosSentTs < POS_SYNC_MS) return;
  const moved = worldState.lastSentX==null || Math.hypot(worldState.x-worldState.lastSentX, worldState.y-worldState.lastSentY) > 2;
  if(!moved) return;
  worldState.lastPosSentTs = now;
  worldState.lastSentX = worldState.x; worldState.lastSentY = worldState.y;
  const {cx,cy} = chunkOf(worldState.x, worldState.y);
  const chunkKey = chunkKeyStr(cx,cy);
  const region = quadrantRegion(worldState.x, worldState.y);
  withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
    x: Math.round(worldState.x), y: Math.round(worldState.y), facing: worldState.facing,
    chunkKey, region
  }));
  if(chunkKey !== worldState.currentChunkKey){
    worldState.currentChunkKey = chunkKey;
    updateNearbySubscriptions(false);
  }
}

/* ---------- nearby players / loot / objects (real multiplayer sync) --- */
function neighborChunkKeys(){
  const {cx,cy} = chunkOf(worldState.x, worldState.y);
  const keys = [];
  for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++) keys.push(chunkKeyStr(cx+dx,cy+dy));
  return keys;
}
function updateNearbySubscriptions(){
  const keys = neighborChunkKeys();
  worldState.currentChunkKey = chunkKeyStr(...Object.values(chunkOf(worldState.x, worldState.y)));
  if(worldState.nearbyPlayersUnsub) worldState.nearbyPlayersUnsub();
  worldState.nearbyPlayersUnsub = onSnapshot(
    query(collection(db,"players"), where("chunkKey","in",keys)),
    snap=>{
      worldState.nearbyPlayers = {};
      snap.forEach(d=>{ if(d.id!==state.uid) worldState.nearbyPlayers[d.id]=d.data(); });
    }, ()=>{}
  );
  if(worldState.nearbyLootUnsub) worldState.nearbyLootUnsub();
  worldState.nearbyLootUnsub = onSnapshot(
    query(collection(db,"worldLoot"), where("chunkKey","in",keys)),
    snap=>{
      worldState.nearbyLoot = {};
      snap.forEach(d=> worldState.nearbyLoot[d.id]={id:d.id, ...d.data()});
    }, ()=>{}
  );
  if(worldState.nearbyObjectsUnsub) worldState.nearbyObjectsUnsub();
  worldState.nearbyObjectsUnsub = onSnapshot(
    query(collection(db,"worldObjects"), where("chunkKey","in",keys)),
    snap=>{
      worldState.nearbyObjects = {};
      snap.forEach(d=> worldState.nearbyObjects[d.id]={id:d.id, ...d.data()});
    }, ()=>{}
  );
}

/* ---------- PvP: incoming hits + kill credits (self-write-only pattern) - */
function setupIncomingHitsListener(){
  worldState.incomingHitsUnsub = onSnapshot(
    collection(db,"players",state.uid,"incomingHits"),
    snap=> snap.docChanges().forEach(ch=>{ if(ch.type==="added") processIncomingHit(ch.doc); }),
    ()=>{}
  );
}
async function processIncomingHit(hitDoc){
  const hit = hitDoc.data();
  await withErrorToast(()=> deleteDoc(hitDoc.ref));
  const p = state.profile;
  const newHp = Math.max(0, p.hp - hit.dmg);
  if(newHp <= 1){
    worldLogMsg(`${hit.fromUsername} defeated you!`);
    await worldPlayerDeath(hit.fromUid, hit.fromUsername);
  } else {
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:newHp }));
    worldLogMsg(`${hit.fromUsername} hit you for ${hit.dmg}!`);
  }
}
function setupKillCreditsListener(){
  worldState.killCreditsUnsub = onSnapshot(
    collection(db,"players",state.uid,"killCredits"),
    snap=> snap.docChanges().forEach(async ch=>{
      if(ch.type!=="added") return;
      const c = ch.doc.data();
      await withErrorToast(()=> deleteDoc(ch.doc.ref));
      await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), {
        kills:(state.profile.kills||0)+1, killstreak:(state.profile.killstreak||0)+1
      }));
      worldLogMsg(`You defeated ${c.victimUsername}!`);
    }),
    ()=>{}
  );
}
// Victim's own client drops their loot bag, credits the killer, respawns.
async function worldPlayerDeath(killerUid, killerUsername){
  const { moneyLoss, lostItemName } = await applyDeathPenalty();
  await withErrorToast(()=> addDoc(collection(db,"worldLoot"), {
    x: worldState.x, y: worldState.y, chunkKey: worldState.currentChunkKey,
    money: moneyLoss, itemName: lostItemName||null, ts: Date.now()
  }));
  if(killerUid){
    await withErrorToast(()=> addDoc(collection(db,"players",killerUid,"killCredits"), {
      victimUsername: state.profile.username, ts: Date.now()
    }));
  }
  respawnPlayer();
}
function respawnPlayer(){
  const p = state.profile;
  const rx = p.bedX ?? p.spawnX ?? 0, ry = p.bedY ?? p.spawnY ?? 0;
  teleportTo(rx, ry);
  toast("You respawned.");
}
function teleportTo(x,y){
  worldState.x = x; worldState.y = y;
  worldState.lastSentX = null; // force an immediate position sync
  const chunkKey = chunkKeyStr(...Object.values(chunkOf(x,y)));
  const region = quadrantRegion(x,y);
  withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { x:Math.round(x), y:Math.round(y), chunkKey, region }));
  updateNearbySubscriptions();
}

/* ---------- monster AI: simple aggro + periodic hit --------------------- */
function applyMonsterAggro(){
  if(worldControlsBlocked()) return;
  const now = Date.now();
  monstersNearPlayer().forEach(m=>{
    if(m.dead) return;
    const d = Math.hypot(m.x-worldState.x, m.y-worldState.y);
    if(d > AGGRO_RANGE) return;
    if(now - m.lastHitTs < MONSTER_HIT_INTERVAL) return;
    m.lastHitTs = now;
    const dmg = Math.round(Math.max(1, m.tmpl.attack - playerDefense()) * (0.8+Math.random()*0.4));
    const newHp = Math.max(0, (state.profile.hp||1) - dmg);
    if(newHp <= 1){
      worldLogMsg(`${m.tmpl.name} defeated you!`);
      applyDeathPenalty().then(()=> respawnPlayer());
    } else {
      withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { hp:newHp }));
      worldLogMsg(`${m.tmpl.name} hits you for ${dmg}.`);
    }
  });
}
async function killMonsterReward(m){
  m.dead = true; m.deadAt = Date.now();
  await grantXP(m.tmpl.xpReward);
  await grantMoney(m.tmpl.moneyReward);
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { monstersKilled:(state.profile.monstersKilled||0)+1 }));
  if(Math.random() < m.tmpl.dropChance){
    const pool = ITEM_BANK.filter(i=>i.element===m.tmpl.element);
    const drop = pool[Math.floor(Math.random()*pool.length)];
    if(drop){ await addItemToInv(drop.id,1); worldLogMsg(`Defeated ${m.tmpl.name}! +${m.tmpl.xpReward} XP, +$${m.tmpl.moneyReward}, found ${drop.name}!`); return; }
  }
  worldLogMsg(`Defeated ${m.tmpl.name}! +${m.tmpl.xpReward} XP, +$${m.tmpl.moneyReward}`);
}

/* ---------- interact target + Space handling ---------------------------- */
function updateInteractTarget(){
  const prompt = document.getElementById("interactPrompt");
  let best = null, bestDist = Infinity;
  nodesNearPlayer().forEach(n=>{
    const d = Math.hypot(n.x-worldState.x, n.y-worldState.y);
    if(d<GATHER_RANGE && d<bestDist){ bestDist=d; best={kind:"node", ref:n}; }
  });
  monstersNearPlayer().forEach(m=>{
    if(m.dead) return;
    const d = Math.hypot(m.x-worldState.x, m.y-worldState.y);
    if(d<ATTACK_RANGE && d<bestDist){ bestDist=d; best={kind:"monster", ref:m}; }
  });
  Object.values(worldState.nearbyPlayers).forEach(op=>{
    const d = Math.hypot((op.x||0)-worldState.x, (op.y||0)-worldState.y);
    if(d<ATTACK_RANGE && d<bestDist){ bestDist=d; best={kind:"player", ref:op}; }
  });
  Object.values(worldState.nearbyLoot).forEach(l=>{
    const d = Math.hypot(l.x-worldState.x, l.y-worldState.y);
    if(d<PICKUP_RANGE && d<bestDist){ bestDist=d; best={kind:"loot", ref:l}; }
  });
  Object.values(worldState.nearbyObjects).forEach(o=>{
    if(o.ownerUid!==state.uid) return;
    const d = Math.hypot(o.x-worldState.x, o.y-worldState.y);
    if(d<PICKUP_RANGE && d<bestDist){ bestDist=d; best={kind:"object", ref:o}; }
  });
  worldState.interactTarget = best;
  if(!best){ prompt.classList.remove("show"); return; }
  const labels = {
    node: n=> `Space to ${n.type==="pond"?"fish":n.type==="rock"?"mine":"forage"}`,
    monster: m=> `Space to attack ${m.tmpl.name} (Lv.${m.tmpl.level})`,
    player: p=> `Space to attack ${p.username}`,
    loot: l=> `Space to pick up loot`,
    object: o=> `Space to reclaim your ${o.type}`
  };
  prompt.textContent = labels[best.kind](best.ref);
  prompt.classList.add("show");
}
// Attacks 1 & 2 are free basic strikes; attacks 3 & 4 cost mana in
// exchange for extra damage (see WORLD_ATTACKS below). You regen 1 mana
// per minute (see catchUpManaRegen).
const WORLD_ATTACKS = {
  1: { manaCost:0,  mult:1,   label:"Attack" },
  2: { manaCost:0,  mult:1.25, label:"Heavy Attack" },
  3: { manaCost:8,  mult:1.8, label:"Mana Strike" },
  4: { manaCost:15, mult:2.5, label:"Mana Burst" }
};
function handleSpacebar(slot=1){
  const now = Date.now();
  const t = worldState.interactTarget;
  if(!t) return;
  if(t.kind==="node"){ interactNode(t.ref); return; }
  if(now - worldState.lastAttackTs < ATTACK_COOLDOWN_MS) return;
  const atk = WORLD_ATTACKS[slot] || WORLD_ATTACKS[1];
  if(atk.manaCost>0){
    if((state.profile.mana||0) < atk.manaCost){ toast(`Not enough mana for ${atk.label} (needs ${atk.manaCost}).`); return; }
  }
  worldState.lastAttackTs = now;
  if(t.kind==="monster") attackWorldMonster(t.ref, atk);
  else if(t.kind==="player") attackWorldPlayer(t.ref, atk);
  else if(t.kind==="loot") pickupWorldLoot(t.ref);
  else if(t.kind==="object") reclaimWorldObject(t.ref);
}
function interactNode(n){
  if(n.type==="pond") doFishAction();
  else if(n.type==="rock") doMineAction();
  else doForageAction(); // tree or bush
  n.depletedAt = Date.now();
}
async function spendAttackMana(atk){
  if(!atk || !atk.manaCost) return;
  await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { mana: Math.max(0, (state.profile.mana||0)-atk.manaCost) }));
}
async function attackWorldMonster(m, atk=WORLD_ATTACKS[1]){
  const dmg = Math.round(playerAttackPower() * atk.mult * (0.85+Math.random()*0.3));
  m.hp -= dmg;
  playSfx("attack");
  worldLogMsg(`You hit ${m.tmpl.name} for ${dmg}${atk.manaCost?` (${atk.label})`:""}.`);
  await spendAttackMana(atk);
  if(m.hp <= 0) await killMonsterReward(m);
}
async function attackWorldPlayer(op, atk=WORLD_ATTACKS[1]){
  const targetUid = Object.keys(worldState.nearbyPlayers).find(uid=> worldState.nearbyPlayers[uid]===op);
  if(!targetUid) return;
  const dmg = Math.round(playerAttackPower() * atk.mult * (0.85+Math.random()*0.3));
  playSfx("attack");
  worldLogMsg(`You hit ${op.username} for ${dmg}${atk.manaCost?` (${atk.label})`:""}.`);
  await spendAttackMana(atk);
  await withErrorToast(()=> addDoc(collection(db,"players",targetUid,"incomingHits"), {
    fromUid: state.uid, fromUsername: state.profile.username, dmg, ts: Date.now()
  }));
}
async function pickupWorldLoot(l){
  await withErrorToast(()=> deleteDoc(doc(db,"worldLoot",l.id)));
  if(l.money) await grantMoney(l.money);
  if(l.itemName){
    const item = ITEM_BANK.find(i=>i.name===l.itemName) || Object.values(ITEM_BY_ID).find(i=>i.name===l.itemName);
    if(item) await addItemToInv(item.id, 1);
  }
  worldLogMsg(`Picked up loot${l.money?` (+$${l.money})`:""}.`);
}
async function reclaimWorldObject(o){
  await withErrorToast(()=> deleteDoc(doc(db,"worldObjects",o.id)));
  await addItemToInv(o.itemId, 1);
  if(o.type==="bed"){
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { bedX:null, bedY:null }));
  }
  worldLogMsg(`Reclaimed your ${o.type}.`);
}
function worldLogMsg(msg){
  const el = document.getElementById("stageLog");
  const line = document.createElement("div");
  line.className = "stage-log-line";
  line.textContent = msg;
  el.appendChild(line);
  setTimeout(()=> line.remove(), 4000);
}

/* ---------- hotbar: first 9 items, click to Drop or Place --------------- */
function renderHotbar(){
  const bar = document.getElementById("hotbar");
  if(!bar || !state.profile) return;
  const entries = invExpanded().slice(0,9);
  bar.innerHTML = entries.map((e,i)=>`
    <div class="hotbar-slot" data-hb="${i}">
      <span class="hb-key">${i+1}</span>
      <span>${e.item.name.split(" ").slice(0,2).join(" ")}</span>
      <span class="qty-badge">x${e.qty}</span>
    </div>`).join("");
  bar.querySelectorAll("[data-hb]").forEach((el,i)=>{
    el.addEventListener("click", ()=> openHotbarAction(entries[i], el));
  });
}
function openHotbarAction(entry, el){
  document.querySelectorAll(".hb-action-popup").forEach(p=>p.remove());
  const pop = document.createElement("div");
  pop.className = "hb-action-popup doodle-panel";
  pop.innerHTML = `
    <button class="doodle-btn btn-sm" data-hba="drop">Drop</button>
    ${entry.item.placeable ? `<button class="doodle-btn btn-sm btn-green" data-hba="place">Place</button>` : ""}
  `;
  el.appendChild(pop);
  pop.querySelector('[data-hba="drop"]').addEventListener("click", (ev)=>{ ev.stopPropagation(); dropHotbarItem(entry); pop.remove(); });
  const placeBtn = pop.querySelector('[data-hba="place"]');
  if(placeBtn) placeBtn.addEventListener("click", (ev)=>{ ev.stopPropagation(); placeHotbarItem(entry); pop.remove(); });
  setTimeout(()=> document.addEventListener("click", function h(ev){ if(!pop.contains(ev.target)){ pop.remove(); document.removeEventListener("click",h); } }), 0);
}
async function dropHotbarItem(entry){
  await changeInvQty(entry.item.id, -1);
  await withErrorToast(()=> addDoc(collection(db,"worldLoot"), {
    x: worldState.x, y: worldState.y, chunkKey: worldState.currentChunkKey,
    money:0, itemName: entry.item.name, ts: Date.now()
  }));
  worldLogMsg(`Dropped ${entry.item.name}.`);
}
async function placeHotbarItem(entry){
  const facingOffset = { down:{x:0,y:40}, up:{x:0,y:-40}, left:{x:-40,y:0}, right:{x:40,y:0} }[worldState.facing];
  const px = worldState.x + facingOffset.x, py = worldState.y + facingOffset.y;
  await changeInvQty(entry.item.id, -1);
  await withErrorToast(()=> addDoc(collection(db,"worldObjects"), {
    x:px, y:py, chunkKey: chunkKeyStr(...Object.values(chunkOf(px,py))),
    type: entry.item.buildType, itemId: entry.item.id, ownerUid: state.uid, ts: Date.now()
  }));
  if(entry.item.buildType==="bed"){
    await withErrorToast(()=> updateDoc(doc(db,"players",state.uid), { bedX:px, bedY:py }));
  }
  worldLogMsg(`Placed a ${entry.item.name}.`);
}

/* ---------- rendering ---------------------------------------------------- */
const OBJECT_GLYPH = { bench:"🪑", fence:"🚧", bed:"🛏️", home:"🏠", guard:"🛡️" };
function drawWorld(){
  const ctx = worldState.ctx, c = worldState.canvas;
  if(!ctx) return;
  const w=c.width, h=c.height;
  ctx.clearRect(0,0,w,h);
  const camX = worldState.x - w/2, camY = worldState.y - h/2;

  // quadrant-colored ground, split at the world axes
  const region = quadrantRegion(worldState.x, worldState.y);
  ctx.fillStyle = QUADRANT_COLOR[region];
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = "rgba(74,63,53,.12)"; ctx.lineWidth=1;
  for(let gx = Math.floor(camX/100)*100; gx < camX+w; gx+=100){ ctx.beginPath(); ctx.moveTo(gx-camX,0); ctx.lineTo(gx-camX,h); ctx.stroke(); }
  for(let gy = Math.floor(camY/100)*100; gy < camY+h; gy+=100){ ctx.beginPath(); ctx.moveTo(0,gy-camY); ctx.lineTo(w,gy-camY); ctx.stroke(); }
  // world-axis lines (x=0 / y=0) drawn heavier — "quadrants collide" marker
  ctx.strokeStyle = "rgba(74,63,53,.35)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0-camX,0); ctx.lineTo(0-camX,h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,0-camY); ctx.lineTo(w,0-camY); ctx.stroke();

  ctx.font = "28px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  nodesNearPlayer().forEach(n=>{
    if(n.depletedAt && Date.now()-n.depletedAt<NODE_RESPAWN_MS) return;
    ctx.fillText(QUADRANT_GLYPH[n.type], n.x-camX, n.y-camY);
  });
  Object.values(worldState.nearbyObjects).forEach(o=>{
    ctx.fillText(OBJECT_GLYPH[o.type]||"📦", o.x-camX, o.y-camY);
  });
  Object.values(worldState.nearbyLoot).forEach(l=>{
    ctx.fillText("💰", l.x-camX, l.y-camY);
  });
  monstersNearPlayer().forEach(m=>{
    if(m.dead) return;
    ctx.fillText("👹", m.x-camX, m.y-camY);
    drawMiniHpBar(ctx, m.x-camX, m.y-camY-24, m.hp/m.maxHp, "#c0392b");
    ctx.font = "10px sans-serif"; ctx.fillStyle="#2a2016";
    ctx.fillText(`${m.tmpl.name} Lv.${m.tmpl.level}`, m.x-camX, m.y-camY-32);
    ctx.font = "28px sans-serif";
  });
  Object.entries(worldState.nearbyPlayers).forEach(([uid,op])=>{
    const ox=(op.x||0)-camX, oy=(op.y||0)-camY;
    ctx.fillText("🧙", ox, oy);
    ctx.font = "11px sans-serif"; ctx.fillStyle="#2a2016";
    ctx.fillText(op.username||"?", ox, oy-24);
    ctx.font = "28px sans-serif";
  });
  // self, always centered
  ctx.fillText("🧝", w/2, h/2);
  ctx.font = "11px sans-serif"; ctx.fillStyle="#2a2016";
  ctx.fillText(state.profile.username, w/2, h/2-24);
}
function drawMiniHpBar(ctx,x,y,pct,color){
  ctx.fillStyle="rgba(0,0,0,.25)"; ctx.fillRect(x-16,y,32,4);
  ctx.fillStyle=color; ctx.fillRect(x-16,y,32*Math.max(0,pct),4);
}
function drawMinimap(){
  const ctx = worldState.mmCtx; if(!ctx) return;
  const size = 150, range = 1200; // world units shown across the minimap
  ctx.clearRect(0,0,size,size);
  // 4 quadrant quarters, colored, always centered on true (0,0) so the
  // "where all 4 sections collide" point is visually anchored
  const originPx = size/2 - (worldState.x/range)*size;
  const originPy = size/2 - (worldState.y/range)*size;
  ctx.fillStyle = QUADRANT_COLOR.forest;    ctx.fillRect(originPx, originPy-size, size, size);
  ctx.fillStyle = QUADRANT_COLOR.reef;      ctx.fillRect(originPx-size, originPy-size, size, size);
  ctx.fillStyle = QUADRANT_COLOR.mountains; ctx.fillRect(originPx-size, originPy, size, size);
  ctx.fillStyle = QUADRANT_COLOR.volcano;   ctx.fillRect(originPx, originPy, size, size);
  ctx.strokeStyle="#4a3f35"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(originPx,0); ctx.lineTo(originPx,size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,originPy); ctx.lineTo(size,originPy); ctx.stroke();
  // nearby players as dots
  ctx.fillStyle="#2a6fdb";
  Object.values(worldState.nearbyPlayers).forEach(op=>{
    const px = size/2 + ((op.x||0)-worldState.x)/range*size, py = size/2 + ((op.y||0)-worldState.y)/range*size;
    if(px>=0&&px<=size&&py>=0&&py<=size){ ctx.beginPath(); ctx.arc(px,py,3,0,7); ctx.fill(); }
  });
  // self, always dead-center
  ctx.fillStyle="#c0392b";
  ctx.beginPath(); ctx.arc(size/2,size/2,4,0,7); ctx.fill();
}


/* =========================================================================
   BOOT
   ========================================================================= */
setupDragonAnim();
setTimeout(()=>{ showScreen("screen-title"); document.getElementById("screen-loading").classList.remove("active"); }, 900);
